import { NextResponse } from "next/server";

export async function GET(request) {
  const connected = request.cookies.get("google_connected")?.value === "true";
  return NextResponse.json({ connected });
}
