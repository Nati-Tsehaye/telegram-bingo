import type { NextRequest } from "next/server"

// This will be handled by the server setup
export async function GET(request: NextRequest) {
  return new Response("Socket.IO server should be running", { status: 200 })
}
