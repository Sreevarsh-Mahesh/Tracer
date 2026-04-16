import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "tracer_demo_auth";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!pathname.startsWith("/tracer") || pathname.startsWith("/tracer/login")) {
    return NextResponse.next();
  }

  const isAuthenticated = request.cookies.get(AUTH_COOKIE)?.value === "authorized";

  if (isAuthenticated) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/tracer/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/tracer", "/tracer/:path*"]
};
