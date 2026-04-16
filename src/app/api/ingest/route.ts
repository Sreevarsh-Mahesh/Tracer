import { NextRequest, NextResponse } from "next/server";
import { getDb, SESSIONS_COLLECTION, type StoredEvent } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/ingest
 *
 * Receives batched events from the tracer-sdk and writes them to Firestore.
 * This is the single ingestion endpoint the SDK calls.
 *
 * Expected body:
 * {
 *   projectId: string,
 *   apiKey: string,
 *   sessionId: string,
 *   route: string,
 *   userLabel: string,
 *   userSegment: string,
 *   events: TracerEvent[]
 * }
 */

// CORS headers — the SDK runs on any domain
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
    const { projectId, apiKey, sessionId, route, userLabel, userSegment, events } =
      body as {
        projectId: string;
        apiKey: string;
        sessionId: string;
        route: string;
        userLabel: string;
        userSegment: string;
        events: StoredEvent[];
      };

    // ── Validate required fields ──────────────────────────────────────────
    if (!projectId || !apiKey || !sessionId || !Array.isArray(events)) {
      return NextResponse.json(
        { error: "Missing required fields: projectId, apiKey, sessionId, events" },
        { status: 400, headers: corsHeaders }
      );
    }

    // ── Validate API key ──────────────────────────────────────────────────
    const configuredApiKey = process.env.TRACER_API_KEY;
    if (!configuredApiKey || apiKey !== configuredApiKey) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401, headers: corsHeaders }
      );
    }

    // ── Cap events to prevent abuse ───────────────────────────────────────
    const cappedEvents = events.slice(0, 500);

    // ── Upsert session in Firestore ───────────────────────────────────────
    const db = getDb();
    const docId = `${projectId}_${sessionId}`;
    const sessionRef = db.collection(SESSIONS_COLLECTION).doc(docId);
    const existingDoc = await sessionRef.get();

    if (existingDoc.exists) {
      // Append events to existing session
      const existingData = existingDoc.data()!;
      const existingEvents = (existingData.events ?? []) as StoredEvent[];

      // Cap total events per session at 5000
      const totalAfterAppend = existingEvents.length + cappedEvents.length;
      const eventsToAppend =
        totalAfterAppend > 5000
          ? cappedEvents.slice(0, Math.max(0, 5000 - existingEvents.length))
          : cappedEvents;

      if (eventsToAppend.length > 0) {
        const newEndedAt = Math.max(
          existingData.endedAt ?? 0,
          ...eventsToAppend.map((e) => e.ts)
        );

        await sessionRef.update({
          events: FieldValue.arrayUnion(...eventsToAppend),
          endedAt: newEndedAt,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    } else {
      // Create new session document
      const startedAt = cappedEvents[0]?.ts ?? Date.now();
      const endedAt = Math.max(startedAt, ...cappedEvents.map((e) => e.ts));

      await sessionRef.set({
        projectId,
        sessionId,
        route: route ?? "/",
        startedAt,
        endedAt,
        userLabel: userLabel ?? "Anonymous",
        userSegment: userSegment ?? "default",
        source: "sdk",
        events: cappedEvents,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

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
