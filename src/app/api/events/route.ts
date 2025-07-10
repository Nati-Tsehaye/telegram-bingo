import type { NextRequest } from "next/server"
import { SSEManager } from "@/lib/sse-manager"
import type { GameEvent } from "@/lib/redis-pubsub"
import { redis } from "@/lib/upstash-client"

// Global SSE endpoint for all rooms
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const playerId = searchParams.get("playerId")

  if (!playerId) {
    return new Response("Player ID required", { status: 400 })
  }

  console.log(`🔌 Global SSE connection request for Player ${playerId}`)

  // Create Server-Sent Events stream
  const stream = new ReadableStream({
    start(controller) {
      const connectionId = `global-${playerId}-${Date.now()}`

      // Add connection to manager (use "global" as roomId for global updates)
      SSEManager.addConnection(connectionId, "global", playerId, controller)

      // Send initial connection message
      const welcomeEvent: GameEvent = {
        type: "room_updated",
        roomId: "global",
        data: { message: "Connected to global real-time updates" },
        timestamp: new Date().toISOString(),
        playerId,
      }

      try {
        controller.enqueue(`data: ${JSON.stringify(welcomeEvent)}\n\n`)
      } catch (error) {
        console.error(`Error sending welcome message:`, error)
      }

      // Set up polling for global updates
      const pollForUpdates = async () => {
        try {
          // Poll for global events
          const globalMessages = await redis.lpop(`events:global`, 10)

          if (globalMessages && Array.isArray(globalMessages)) {
            for (const message of globalMessages) {
              try {
                const event: GameEvent = typeof message === "string" ? JSON.parse(message) : message
                controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
              } catch (error) {
                console.error("Error parsing global event message:", error)
              }
            }
          }

          // Also poll for room-specific events for all rooms
          const roomKeys = await redis.keys("events:room-*")
          for (const key of roomKeys) {
            try {
              const messages = await redis.lpop(key, 5) // Get fewer messages per room
              if (messages && Array.isArray(messages)) {
                for (const message of messages) {
                  try {
                    const event: GameEvent = typeof message === "string" ? JSON.parse(message) : message
                    controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
                  } catch (error) {
                    console.error("Error parsing room event message:", error)
                  }
                }
              }
            } catch (error) {
              console.error(`Error polling ${key}:`, error)
            }
          }
        } catch (error) {
          console.error("Error polling for global updates:", error)
        }
      }

      // Poll for updates every 1 second for better responsiveness
      const pollInterval = setInterval(pollForUpdates, 1000)

      // Cleanup on connection close
      const cleanup = () => {
        clearInterval(pollInterval)
        SSEManager.removeConnection(connectionId)
      }

      // Handle client disconnect
      request.signal.addEventListener("abort", cleanup)

      // Store cleanup function for manual cleanup
      ;(controller as ReadableStreamDefaultController & { _cleanup?: () => void })._cleanup = cleanup
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
