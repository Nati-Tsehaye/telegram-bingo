import { NextResponse } from "next/server"
import { GameStateManager } from "@/lib/upstash-client"

// Cron job endpoint for auto number calling
// This will be called every 4 seconds by Vercel Cron or external service
export async function GET() {
  try {
    console.log(`🎯 Auto-caller cron job triggered at ${new Date().toISOString()}`)

    const rooms = await GameStateManager.getAllRooms()
    const activeRooms = rooms.filter((room) => room.status === "active")

    console.log(`Processing ${activeRooms.length} active rooms`)

    const results = []

    for (const room of activeRooms) {
      try {
        // Check if this room should have auto calling
        const isActive = await GameStateManager.isNumberCallingActive(room.id)
        if (!isActive) {
          console.log(`⏹️ Auto calling not active for room ${room.id}`)
          continue
        }

        const gameState = await GameStateManager.getGameState(room.id)
        if (!gameState || gameState.gameStatus !== "active") {
          console.log(`⏹️ Game not active for room ${room.id}`)
          continue
        }

        // Check if all numbers have been called
        const calledCount = gameState.calledNumbers?.length || 0
        if (calledCount >= 75) {
          console.log(`🏁 All numbers called for room ${room.id}`)
          gameState.gameStatus = "finished"
          await GameStateManager.setGameState(room.id, gameState)
          continue
        }

        // Call next number - this will broadcast to all players
        const newNumber = await GameStateManager.callNextNumber(room.id)

        if (newNumber) {
          results.push({
            roomId: room.id,
            calledNumber: newNumber,
            success: true,
            totalCalled: calledCount + 1,
          })
          console.log(`📢 Auto-called number ${newNumber} for room ${room.id} (${calledCount + 1}/75)`)
        } else {
          console.log(`⚠️ No number returned for room ${room.id}`)
        }
      } catch (error) {
        console.error(`Error processing room ${room.id}:`, error)
        results.push({
          roomId: room.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return NextResponse.json({
      success: true,
      processedRooms: activeRooms.length,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error in auto caller cron:", error)
    return NextResponse.json(
      {
        error: "Failed to process auto calling",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
