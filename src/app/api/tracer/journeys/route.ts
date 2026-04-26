import { NextRequest, NextResponse } from "next/server";
import { fetchAllSessions, computeJourneyClusters } from "@/lib/tracer-store";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") ?? undefined;
    const sessions = await fetchAllSessions(projectId);
    const clusters = computeJourneyClusters(sessions);

    return NextResponse.json({ clusters });
  } catch (error) {
    console.error("[tracer/journeys]", error);
    return NextResponse.json({ error: "Failed to fetch journeys" }, { status: 500 });
  }
}
