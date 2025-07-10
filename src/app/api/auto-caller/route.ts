import { NextResponse } from "next/server"
import { GameStateManager } from "@/lib/upstash-client"

// Auto number caller endpoint (called by cron job or scheduler)
export async function POST(request: Request) {
  try {
    const { roomId, serverCall = false } = await request.json()

    if (!roomId) {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 })
    }

    // Only allow server-side calls to prevent individual players from calling numbers
    if (!serverCall) {
      return NextResponse.json(
        {
          error: "Direct number calling not allowed. Numbers are called centrally by the server.",
        },
        { status: 403 },
      )
    }

    console.log(`🎯 Server auto-caller called for room: ${roomId}`)

    const gameState = await GameStateManager.getGameState(roomId)
    if (!gameState) {
      console.log(`❌ No game state found for room ${roomId}`)
      return NextResponse.json({ message: "Game state not found" })
    }

    if (gameState.gameStatus !== "active") {
      console.log(`⏹️ Game not active for room ${roomId}, status: ${gameState.gameStatus}`)
      return NextResponse.json({ message: "Game not active" })
    }

    // Check if all numbers have been called
    const calledCount = gameState.calledNumbers?.length || 0
    if (calledCount >= 75) {
      console.log(`🏁 All numbers called for room ${roomId}`)
      gameState.gameStatus = "finished"
      await GameStateManager.setGameState(roomId, gameState)
      return NextResponse.json({ message: "All numbers called, game finished" })
    }

    // Call next number
    const newNumber = await GameStateManager.callNextNumber(roomId)

    if (newNumber) {
      console.log(`📢 Server called number ${newNumber} for room ${roomId}`)
      return NextResponse.json({
        success: true,
        calledNumber: newNumber,
        message: `Called number ${newNumber}`,
        totalCalled: calledCount + 1,
      })
    } else {
      console.log(`⚠️ No number returned for room ${roomId}`)
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
