import { NextResponse } from "next/server"
import { GameStateManager } from "@/lib/upstash-client"

// Auto number caller endpoint (called by cron job or scheduler)
export async function POST(request: Request) {
  try {
    const { roomId } = await request.json()

    if (!roomId) {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 })
    }

    // Check if auto calling is still active for this room
    const isActive = await GameStateManager.isNumberCallingActive(roomId)
    if (!isActive) {
      return NextResponse.json({ message: "Auto calling not active" })
    }

    const gameState = await GameStateManager.getGameState(roomId)
    if (!gameState || gameState.gameStatus !== "active") {
      return NextResponse.json({ message: "Game not active" })
    }

    // Call next number
    const newNumber = await GameStateManager.callNextNumber(roomId)

    if (newNumber) {
      console.log(`Auto-called number ${newNumber} for room ${roomId}`)
      return NextResponse.json({
        success: true,
        calledNumber: newNumber,
        message: `Called number ${newNumber}`,
      })
    } else {
      return NextResponse.json({ message: "No more numbers to call or game finished" })
    }
  } catch (error) {
    console.error("Error in auto caller:", error)
    return NextResponse.json({ error: "Failed to call number" }, { status: 500 })
  }
}

// Get all active games that need number calling
export async function GET() {
  try {
    const rooms = await GameStateManager.getAllRooms()
    const activeRooms = rooms.filter((room) => room.status === "active")

    return NextResponse.json({
      success: true,
      activeRooms: activeRooms.map((room) => ({
        id: room.id,
        status: room.status,
        players: room.players?.length || 0,
      })),
    })
  } catch (error) {
    console.error("Error getting active rooms:", error)
    return NextResponse.json({ error: "Failed to get active rooms" }, { status: 500 })
  }
}
