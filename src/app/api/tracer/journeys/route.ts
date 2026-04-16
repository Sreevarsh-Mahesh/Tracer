import { NextRequest, NextResponse } from "next/server";
import { fetchAllSessions } from "@/lib/tracer-store";

export interface ReplaySession {
  id: string;
  sessionId: string;
  userLabel: string;
  userSegment: string;
  route: string;
  durationMs: number;
  startedAt: number;
  clickCount: number;
  hoverCount: number;
  frustrationClicks: number;
  points: Array<{
    x: number;
    y: number;
    ts: number;
    type: "move" | "click";
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }
    
    const sessions = await fetchAllSessions(projectId);

    const replaySessions: ReplaySession[] = sessions.map((session) => {
      const pointerEvents = session.events.filter(
        (e) =>
          (e.type === "mousemove" || e.type === "click") &&
          typeof e.x === "number" &&
          typeof e.y === "number"
      );

      const startTs = pointerEvents[0]?.ts ?? session.startedAt;

      const points = pointerEvents.map((e) => ({
        x: e.x ?? 0,
        y: e.y ?? 0,
        ts: e.ts - startTs,
        type: (e.type === "click" ? "click" : "move") as "move" | "click",
      }));

      const clickCount = session.events.filter((e) => e.type === "click").length;
      const hoverCount = session.events.filter((e) => e.type === "hover").length;
      const frustrationClicks = session.events.filter(
        (e) => e.type === "click" && (e.repeatIndex ?? 1) > 1
      ).length;

      return {
        id: `${session.projectId}_${session.id}`,
        sessionId: session.id,
        userLabel: session.userLabel,
        userSegment: session.userSegment,
        route: session.route,
        durationMs: Math.max(0, session.endedAt - session.startedAt),
        startedAt: session.startedAt,
        clickCount,
        hoverCount,
        frustrationClicks,
        points,
      };
    });

    return NextResponse.json({ sessions: replaySessions });
  } catch (error) {
    console.error("[tracer/journeys]", error);
    return NextResponse.json({ error: "Failed to fetch journeys" }, { status: 500 });
  }
}
