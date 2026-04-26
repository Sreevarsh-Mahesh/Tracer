const { Datastore } = require('@google-cloud/datastore');
const { Storage } = require('@google-cloud/storage');

const datastore = new Datastore();
const storage = new Storage();

/**
 * Cloud Functions v2 (Gen2) entry point.
 *
 * Triggered by Pub/Sub via Eventarc. The CloudEvent envelope wraps the
 * original Pub/Sub message under `cloudEvent.data.message`.
 *
 * @param {import('@google-cloud/functions-framework').CloudEvent} cloudEvent
 */
exports.processTracerEvents = async (cloudEvent) => {
  // Gen2 CloudEvent format: cloudEvent.data.message.data is base64-encoded
  const message = cloudEvent.data?.message;
  if (!message?.data) {
    console.error('No message data found in CloudEvent');
    return;
  }

  const dataStr = Buffer.from(message.data, 'base64').toString('utf-8');
  let payload;

  try {
    payload = JSON.parse(dataStr);
  } catch (err) {
    console.error('Failed to parse Pub/Sub message data:', err);
    return;
  }

  const { projectId, sessionId, route, userLabel, userSegment, events, timestamp } = payload;
  if (!projectId || !sessionId) {
    console.error('Missing projectId or sessionId in payload');
    return;
  }

  try {
    // 1. Process metadata for Datastore
    const sessionKey = datastore.key(['TracerSession', `${projectId}_${sessionId}`]);
    const [existingSession] = await datastore.get(sessionKey);

    let updatedEvents = events;
    let startedAt = timestamp;

    if (existingSession) {
      updatedEvents = [...(existingSession.events ? JSON.parse(existingSession.events) : []), ...events].slice(0, 5000);
      startedAt = existingSession.startedAt;
    }

    const endedAt = Math.max(startedAt, ...updatedEvents.map(e => e.ts));

    const sessionEntity = {
      key: sessionKey,
      data: [
        { name: 'projectId', value: projectId },
        { name: 'sessionId', value: sessionId },
        { name: 'route', value: route },
        { name: 'userLabel', value: userLabel },
        { name: 'userSegment', value: userSegment },
        { name: 'source', value: existingSession?.source || 'sdk' },
        { name: 'startedAt', value: startedAt },
        { name: 'endedAt', value: endedAt },
        {
          name: 'events',
          value: JSON.stringify(updatedEvents),
          excludeFromIndexes: true, // Large text property — must exclude from indexing
        },
        { name: 'updatedAt', value: Date.now() },
      ],
    };

    await datastore.save(sessionEntity);
    console.log(`Saved session metadata to Datastore: ${projectId}_${sessionId}`);

    // 2. Heavy DOM Payloads to GCS
    const bucketName = process.env.SNAPSHOTS_BUCKET;
    if (bucketName) {
      const gcsFileName = `${projectId}/${sessionId}/${timestamp}.json`;
      const file = storage.bucket(bucketName).file(gcsFileName);
      await file.save(JSON.stringify(events), {
        contentType: 'application/json',
      });
      console.log(`Saved events chunk to GCS: gs://${bucketName}/${gcsFileName}`);
    }

  } catch (error) {
    console.error(`Error processing session ${sessionId}:`, error);
    throw error; // Let Pub/Sub retry mechanism handle it
  }
};
