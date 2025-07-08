import { NextResponse } from "next/server"
import { GameStateManager } from "@/lib/upstash-client"
import type { GameRoom } from "@/types/game"

export async function GET() {
  try {
    console.log("🧪 Testing individual room creation steps...")

    // Step 1: Test Redis connection
    console.log("Step 1: Testing Redis connection...")
    const connectionTest = await GameStateManager.testConnection()
    if (!connectionTest) {
      return NextResponse.json({
        success: false,
        error: "Redis connection failed",
        step: 1,
      })
    }
    console.log("✅ Step 1 passed: Redis connection working")

    // Step 2: Test simple Redis operations
    console.log("Step 2: Testing basic Redis operations...")
    try {
      await GameStateManager.redis.set("test-key", "test-value")
      const testResult = await GameStateManager.redis.get("test-key")
      await GameStateManager.redis.del("test-key")

      if (testResult !== "test-value") {
        throw new Error("Basic Redis operations failed")
      }
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: "Basic Redis operations failed",
        details: error instanceof Error ? error.message : "Unknown error",
        step: 2,
      })
    }
    console.log("✅ Step 2 passed: Basic Redis operations working")

    // Step 3: Test JSON serialization
    console.log("Step 3: Testing JSON serialization...")
    const testRoom: GameRoom = {
      id: "test-room",
      stake: 10,
      players: [],
      maxPlayers: 100,
      status: "waiting",
      prize: 0,
      createdAt: new Date(),
      activeGames: 0,
      hasBonus: true,
    }

    let serialized: string
    try {
      serialized = JSON.stringify(testRoom)
      const parsed = JSON.parse(serialized)
      if (!parsed.id || !parsed.stake) {
        throw new Error("Serialization test failed")
      }
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: "JSON serialization failed",
        details: error instanceof Error ? error.message : "Unknown error",
        step: 3,
      })
    }
    console.log("✅ Step 3 passed: JSON serialization working")

    // Step 4: Test direct Redis storage
    console.log("Step 4: Testing direct Redis storage...")
    try {
      await GameStateManager.redis.set("room:test-direct", serialized)
      const retrieved = await GameStateManager.redis.get("room:test-direct")
      await GameStateManager.redis.del("room:test-direct")

      if (!retrieved) {
        throw new Error("Direct Redis storage failed")
      }
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: "Direct Redis storage failed",
        details: error instanceof Error ? error.message : "Unknown error",
        step: 4,
      })
    }
    console.log("✅ Step 4 passed: Direct Redis storage working")

    // Step 5: Test GameStateManager.setRoom
    console.log("Step 5: Testing GameStateManager.setRoom...")
    try {
      await GameStateManager.setRoom("test-room-manager", testRoom)
      const retrievedRoom = await GameStateManager.getRoom("test-room-manager")
      await GameStateManager.redis.del("room:test-room-manager")

      if (!retrievedRoom || retrievedRoom.id !== "test-room-manager") {
        throw new Error("GameStateManager.setRoom failed")
      }
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: "GameStateManager.setRoom failed",
        details: error instanceof Error ? error.message : "Unknown error",
        step: 5,
      })
    }
    console.log("✅ Step 5 passed: GameStateManager.setRoom working")

    // Step 6: Test creating multiple rooms
    console.log("Step 6: Testing multiple room creation...")
    const stakes = [10, 20, 50]
    const createdRooms = []

    try {
      for (const stake of stakes) {
        const roomId = `test-multi-${stake}`
        const room: GameRoom = {
          id: roomId,
          stake,
          players: [],
          maxPlayers: 100,
          status: "waiting",
          prize: 0,
          createdAt: new Date(),
          activeGames: 0,
          hasBonus: true,
        }

        await GameStateManager.setRoom(roomId, room)
        createdRooms.push(roomId)
      }

      // Verify all rooms were created
      const allRooms = await GameStateManager.getAllRooms()
      const testRooms = allRooms.filter((room) => room.id.startsWith("test-multi-"))

      if (testRooms.length !== stakes.length) {
        throw new Error(`Expected ${stakes.length} rooms, found ${testRooms.length}`)
      }

      // Clean up
      for (const roomId of createdRooms) {
        await GameStateManager.redis.del(`room:${roomId}`)
      }
    } catch (error) {
      // Clean up on error
      for (const roomId of createdRooms) {
        try {
          await GameStateManager.redis.del(`room:${roomId}`)
        } catch {}
      }

      return NextResponse.json({
        success: false,
        error: "Multiple room creation failed",
        details: error instanceof Error ? error.message : "Unknown error",
        step: 6,
      })
    }
    console.log("✅ Step 6 passed: Multiple room creation working")

    return NextResponse.json({
      success: true,
      message: "All room creation tests passed",
      stepsCompleted: 6,
    })
  } catch (error) {
    console.error("❌ Room creation test failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Room creation test failed",
        details: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
