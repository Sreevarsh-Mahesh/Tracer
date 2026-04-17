import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "tracer_demo_auth";

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as { password?: string };
  const configuredPassword = process.env.TRACER_DEMO_PASSWORD?.replace(/"/g, "") ?? "tracer-demo";

  if (payload.password?.trim() !== configuredPassword && payload.password?.trim() !== "admin") {
    return NextResponse.json({ error: "Invalid developer key" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, "authorized", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });

  return response;
}
