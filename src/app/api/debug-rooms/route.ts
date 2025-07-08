import { NextResponse } from "next/server"
import { GameStateManager } from "@/lib/upstash-client"
import type { GameRoom } from "@/types/game"

export async function GET() {
  try {
    console.log("🔍 Debug: Starting room creation test...")

    // Test Redis connection first
    const connectionTest = await GameStateManager.testConnection()
    console.log("Redis connection test:", connectionTest)

    if (!connectionTest) {
      return NextResponse.json({
        success: false,
        error: "Redis connection failed",
        step: "connection_test",
      })
    }

    // Try to create a simple test room
    const testRoomId = "test-room-debug"
    const testRoom: GameRoom = {
      id: testRoomId,
      stake: 10,
      players: [],
      maxPlayers: 100,
      status: "waiting",
      prize: 0,
      createdAt: new Date(),
      activeGames: 0,
      hasBonus: true,
    }

    console.log("🧪 Creating test room:", testRoomId)

    try {
      await GameStateManager.setRoom(testRoomId, testRoom)
      console.log("✅ Test room created successfully")
    } catch (error) {
      console.error("❌ Test room creation failed:", error)
      return NextResponse.json({
        success: false,
        error: "Test room creation failed",
        details: error instanceof Error ? error.message : "Unknown error",
        step: "test_room_creation",
      })
    }

    // Try to retrieve the test room
    try {
      const retrievedRoom = await GameStateManager.getRoom(testRoomId)
      console.log("📖 Retrieved test room:", !!retrievedRoom)

      if (!retrievedRoom) {
        return NextResponse.json({
          success: false,
          error: "Could not retrieve test room",
          step: "test_room_retrieval",
        })
      }
    } catch (error) {
      console.error("❌ Test room retrieval failed:", error)
      return NextResponse.json({
        success: false,
        error: "Test room retrieval failed",
        details: error instanceof Error ? error.message : "Unknown error",
        step: "test_room_retrieval",
      })
    }

    // Clean up test room
    try {
      await GameStateManager.redis.del(`room:${testRoomId}`)
      console.log("🗑️ Test room cleaned up")
    } catch (error) {
      console.warn("⚠️ Could not clean up test room:", error)
    }

    // Get all existing rooms
    const existingRooms = await GameStateManager.getAllRooms()
    console.log("📊 Existing rooms count:", existingRooms.length)

    return NextResponse.json({
      success: true,
      message: "Room creation test passed",
      existingRoomsCount: existingRooms.length,
      testsPassed: ["redis_connection", "room_creation", "room_retrieval", "room_cleanup"],
    })
  } catch (error) {
    console.error("❌ Debug test failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Debug test failed",
        details: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
