import { NextRequest, NextResponse } from "next/server";
import { saveFunnel, getSavedFunnels } from "@/lib/tracer-store";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId");
    
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const funnels = await getSavedFunnels(projectId);
    return NextResponse.json({ funnels });
  } catch (error) {
    console.error("[tracer/funnels/saved] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch saved funnels" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { projectId, name, steps } = await request.json();

    if (!projectId || !name || !steps || !Array.isArray(steps)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const funnel = await saveFunnel(projectId, name, steps);
    return NextResponse.json({ funnel }, { status: 201 });
  } catch (error) {
    console.error("[tracer/funnels/saved] POST error:", error);
    return NextResponse.json({ error: "Failed to save funnel" }, { status: 500 });
  }
}
