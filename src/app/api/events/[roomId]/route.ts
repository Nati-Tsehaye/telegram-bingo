import type { NextRequest } from "next/server"
import Redis from "ioredis"

export async function GET(request: NextRequest, { params }: { params: { roomId: string } }) {
  const { roomId } = params
  const { searchParams } = new URL(request.url)
  const playerId = searchParams.get("playerId")

  if (!playerId) {
    return new Response("Player ID required", { status: 400 })
  }

  // Create Server-Sent Events stream
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(`data: ${JSON.stringify({ type: "connected", roomId })}\n\n`)

      // Subscribe to Redis pub/sub for this room
      const subscriber = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      })

      let isActive = true

      // Subscribe to room events
      const subscribeToRoom = async () => {
        try {
          // Use Redis SUBSCRIBE for real-time updates
          await subscriber.subscribe(`room:${roomId}`)

          subscriber.on("message", (_channel, message) => {
            if (!isActive) return

            try {
              const data = JSON.parse(message)
              controller.enqueue(`data: ${JSON.stringify(data)}\n\n`)
            } catch {
              console.error("Error parsing message")
            }
          })
        } catch {
          console.error("Subscription error")
        }
      }

      subscribeToRoom()

      // Send periodic heartbeat
      const heartbeat = setInterval(() => {
        if (!isActive) {
          clearInterval(heartbeat)
          return
        }

        try {
          controller.enqueue(`data: ${JSON.stringify({ type: "heartbeat", timestamp: Date.now() })}\n\n`)
        } catch {
          clearInterval(heartbeat)
          isActive = false
        }
      }, 30000) // Every 30 seconds

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        isActive = false
        clearInterval(heartbeat)
        subscriber.disconnect()
        try {
          controller.close()
        } catch {
          // Stream already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    },
  })
}
