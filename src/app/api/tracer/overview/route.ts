import { NextResponse } from "next/server";
import { fetchAllSessions, computeDashboardOverview } from "@/lib/tracer-store";

export async function GET() {
  try {
    const sessions = await fetchAllSessions();
    const overview = computeDashboardOverview(sessions);
    return NextResponse.json(overview);
  } catch (error) {
    console.error("[tracer/overview]", error);
    return NextResponse.json({ error: "Failed to fetch overview" }, { status: 500 });
  }
}
