import { NextRequest, NextResponse } from "next/server";
import { fetchAllSessions, computeFunnelMetrics, getTrackedElements } from "@/lib/tracer-store";

export async function POST(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const body = await request.json();
    const { steps } = body as { steps: string[] };

    if (!Array.isArray(steps)) {
      return NextResponse.json({ error: "steps must be an array" }, { status: 400 });
    }

    const sessions = await fetchAllSessions(projectId);
    const metrics = computeFunnelMetrics(sessions, steps);
    const elements = getTrackedElements(sessions);
    return NextResponse.json({ metrics, elements });
  } catch (error) {
    console.error("[tracer/funnels]", error);
    return NextResponse.json({ error: "Failed to compute funnel" }, { status: 500 });
  }
}
