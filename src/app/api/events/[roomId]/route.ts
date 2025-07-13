import type { NextRequest } from "next/server"
import { RealtimeManager } from "@/lib/realtime-manager"

export async function GET(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const { searchParams } = new URL(request.url)
  const playerId = searchParams.get("playerId")

  if (!playerId) {
    return new Response("Player ID required", { status: 400 })
  }

  console.log(`📡 SSE connection request for room ${roomId}, player ${playerId}`)

  // Create a readable stream for Server-Sent Events
  const stream = new ReadableStream({
    start(controller) {
      console.log(`🔌 Starting SSE stream for room ${roomId}, player ${playerId}`)

      // Send initial connection message
      const initialMessage = `data: ${JSON.stringify({
        type: "connected",
        roomId,
        playerId,
        timestamp: Date.now(),
      })}\n\n`
      controller.enqueue(new TextEncoder().encode(initialMessage))

      let isActive = true
      let heartbeatInterval: NodeJS.Timeout

      // Send periodic heartbeat to keep connection alive
      heartbeatInterval = setInterval(() => {
        if (!isActive) {
          clearInterval(heartbeatInterval)
          return
        }

        try {
          const heartbeatMessage = `data: ${JSON.stringify({
            type: "heartbeat",
            timestamp: Date.now(),
          })}\n\n`
          controller.enqueue(new TextEncoder().encode(heartbeatMessage))
        } catch (error) {
          console.log(`💔 Heartbeat failed for room ${roomId}, player ${playerId}`)
          clearInterval(heartbeatInterval)
          isActive = false
        }
      }, 30000) // Every 30 seconds

      // Create a proper mock response for the RealtimeManager
      const mockResponse = {
        write: (data: string) => {
          if (isActive) {
            try {
              controller.enqueue(new TextEncoder().encode(data))
            } catch (error) {
              console.log(`📡 Failed to write to stream: ${error}`)
              isActive = false
            }
          }
        },
        close: () => {
          isActive = false
          clearInterval(heartbeatInterval)
          try {
            controller.close()
          } catch (error) {
            console.log(`Error closing controller: ${error}`)
          }
        },
        isActive: () => isActive,
      }

      RealtimeManager.addConnection(roomId, mockResponse)

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        console.log(`🔌 SSE connection closed for room ${roomId}, player ${playerId}`)
        isActive = false
        clearInterval(heartbeatInterval)
        RealtimeManager.removeConnection(roomId, mockResponse)
        try {
          controller.close()
        } catch (error) {
          console.log(`Error closing stream: ${error}`)
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
