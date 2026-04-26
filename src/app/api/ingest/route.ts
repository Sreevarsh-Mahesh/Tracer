import { NextRequest, NextResponse } from "next/server";
import { getPubSub, type StoredEvent } from "@/lib/gcp-services";

/**
 * POST /api/ingest
 *
 * Receives batched events from the tracer-sdk and publishes them to Pub/Sub.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, apiKey, sessionId, route, userLabel, userSegment, events } = body as {
      projectId: string;
      apiKey: string;
      sessionId: string;
      route: string;
      userLabel: string;
      userSegment: string;
      events: StoredEvent[];
    };

    if (!projectId || !apiKey || !sessionId || !Array.isArray(events)) {
      return NextResponse.json(
        { error: "Missing required fields: projectId, apiKey, sessionId, events" },
        { status: 400, headers: corsHeaders }
      );
    }

    const configuredApiKey = process.env.TRACER_API_KEY;
    if (!configuredApiKey || apiKey !== configuredApiKey) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401, headers: corsHeaders }
      );
    }

    const cappedEvents = events.slice(0, 500);

    const pubsub = getPubSub();
    const topicName = process.env.PUBSUB_TOPIC_NAME || "tracer-events";
    
    // Instead of querying/updating DB here, just publish standard payload to topic
    const payload = {
      projectId,
      sessionId,
      route: route ?? "/",
      userLabel: userLabel ?? "Anonymous",
      userSegment: userSegment ?? "default",
      events: cappedEvents,
      timestamp: Date.now(),
    };

    const dataBuffer = Buffer.from(JSON.stringify(payload));
    await pubsub.topic(topicName).publishMessage({ data: dataBuffer });

    return NextResponse.json(
      { ok: true, eventsReceived: cappedEvents.length },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("[tracer/ingest] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
