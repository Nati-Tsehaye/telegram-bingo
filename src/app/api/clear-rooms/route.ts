import { NextResponse } from "next/server"
import { GameStateManager } from "@/lib/upstash-client"

export async function POST() {
  try {
    console.log("🧹 Clearing all room data...")

    // Clear all room-related data
    const roomKeys = await GameStateManager.redis.keys("room:*")
    if (roomKeys.length > 0) {
      await GameStateManager.redis.del(...roomKeys)
      console.log(`🗑️ Deleted ${roomKeys.length} room keys`)
    }

    const playerKeys = await GameStateManager.redis.keys("player:*")
    if (playerKeys.length > 0) {
      await GameStateManager.redis.del(...playerKeys)
      console.log(`🗑️ Deleted ${playerKeys.length} player keys`)
    }

    const gameKeys = await GameStateManager.redis.keys("game:*")
    if (gameKeys.length > 0) {
      await GameStateManager.redis.del(...gameKeys)
      console.log(`🗑️ Deleted ${gameKeys.length} game keys`)
    }

    const boardKeys = await GameStateManager.redis.keys("boards:*")
    if (boardKeys.length > 0) {
      await GameStateManager.redis.del(...boardKeys)
      console.log(`🗑️ Deleted ${boardKeys.length} board keys`)
    }

    return NextResponse.json({
      success: true,
      message: "All room data cleared successfully",
      deletedKeys: {
        rooms: roomKeys.length,
        players: playerKeys.length,
        games: gameKeys.length,
        boards: boardKeys.length,
      },
    })
  } catch (error) {
    console.error("❌ Error clearing room data:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to clear room data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
