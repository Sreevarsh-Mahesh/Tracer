import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const htmlPath = path.join(process.cwd(), "public", "index.html");
    const htmlContent = fs.readFileSync(htmlPath, "utf-8");
    return new NextResponse(htmlContent, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("Failed to read public/index.html", error);
    return new NextResponse("<h1>Delight Cart App Loading...</h1>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  }
}
