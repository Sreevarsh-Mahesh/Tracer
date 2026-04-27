import { NextRequest, NextResponse } from "next/server";
import { fetchAllSessions } from "@/lib/tracer-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ sessions: [] });
    }

    const sessions = await fetchAllSessions(projectId);

    return NextResponse.json({
      sessions
    });
  } catch (error) {
    console.error("[tracer/sessions] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
