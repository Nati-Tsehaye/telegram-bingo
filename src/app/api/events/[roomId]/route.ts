import type { NextRequest } from "next/server"
import { SSEManager } from "@/lib/sse-manager"
import type { GameEvent } from "@/lib/redis-pubsub"
import { redis } from "@/lib/upstash-client"

export async function GET(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const { searchParams } = new URL(request.url)
  const playerId = searchParams.get("playerId")

  if (!playerId) {
    return new Response("Player ID required", { status: 400 })
  }

  console.log(`🔌 SSE connection request: Room ${roomId}, Player ${playerId}`)

  // Create Server-Sent Events stream
  const stream = new ReadableStream({
    start(controller) {
      const connectionId = `${roomId}-${playerId}-${Date.now()}`

      // Add connection to manager
      SSEManager.addConnection(connectionId, roomId, playerId, controller)

      // Send initial connection message
      const welcomeEvent: GameEvent = {
        type: "room_updated",
        roomId,
        data: { message: "Connected to real-time updates" },
        timestamp: new Date().toISOString(),
        playerId,
      }

      try {
        controller.enqueue(`data: ${JSON.stringify(welcomeEvent)}\n\n`)
      } catch (error) {
        console.error(`Error sending welcome message:`, error)
      }

      // Set up Redis subscription for this room
      const pollForUpdates = async () => {
        try {
          // Since Upstash doesn't support traditional pub/sub in serverless,
          // we'll use a polling mechanism with Redis lists as a message queue
          const messages = await redis.lpop(`events:${roomId}`, 10) // Get up to 10 messages

          if (messages && Array.isArray(messages)) {
            for (const message of messages) {
              try {
                const event: GameEvent = typeof message === "string" ? JSON.parse(message) : message
                controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
              } catch (error) {
                console.error("Error parsing event message:", error)
              }
            }
          }
        } catch (error) {
          console.error("Error polling for updates:", error)
        }
      }

      // Poll for updates every 2 seconds
      const pollInterval = setInterval(pollForUpdates, 2000)

      // Cleanup on connection close
      const cleanup = () => {
        clearInterval(pollInterval)
        SSEManager.removeConnection(connectionId)
      }

      // Handle client disconnect
      request.signal.addEventListener("abort", cleanup)

      // Store cleanup function for manual cleanup
      ;(controller as any)._cleanup = cleanup
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  })
}
