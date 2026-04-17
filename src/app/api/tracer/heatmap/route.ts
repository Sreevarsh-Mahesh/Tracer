import { NextRequest, NextResponse } from "next/server";
import { fetchAllSessions, computeHeatmapMetrics, getTrackedElements } from "@/lib/tracer-store";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }
    
    const route = request.nextUrl.searchParams.get("route") ?? "/demo-store";
    const sessions = await fetchAllSessions(projectId);
    const metrics = computeHeatmapMetrics(sessions, route);
    const elements = getTrackedElements(sessions);
    return NextResponse.json({ metrics, elements });
  } catch (error) {
    console.error("[tracer/heatmap]", error);
    return NextResponse.json({ error: "Failed to fetch heatmap" }, { status: 500 });
  }
}
