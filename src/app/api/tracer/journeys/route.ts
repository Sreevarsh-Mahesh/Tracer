import { NextResponse } from "next/server";
import { fetchAllSessions, computeJourneyClusters } from "@/lib/tracer-store";

export async function GET() {
  try {
    const sessions = await fetchAllSessions();
    const clusters = computeJourneyClusters(sessions);
    return NextResponse.json({ clusters });
  } catch (error) {
    console.error("[tracer/journeys]", error);
    return NextResponse.json({ error: "Failed to fetch journeys" }, { status: 500 });
  }
}
