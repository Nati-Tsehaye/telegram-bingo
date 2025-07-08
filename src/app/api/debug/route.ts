import { NextResponse } from "next/server"
import { GameStateManager } from "@/lib/upstash-client"

export async function GET() {
  try {
    console.log("🔍 Debug: Checking environment and Redis connection...")

    // Check environment variables
    const envCheck = {
      NODE_ENV: process.env.NODE_ENV,
      hasUpstashUrl: !!process.env.UPSTASH_REDIS_REST_URL,
      hasUpstashToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      hasKvUrl: !!process.env.KV_REST_API_URL,
      hasKvToken: !!process.env.KV_REST_API_TOKEN,
      upstashUrlLength: process.env.UPSTASH_REDIS_REST_URL?.length || 0,
      upstashTokenLength: process.env.UPSTASH_REDIS_REST_TOKEN?.length || 0,
      kvUrlLength: process.env.KV_REST_API_URL?.length || 0,
      kvTokenLength: process.env.KV_REST_API_TOKEN?.length || 0,
    }

    console.log("Environment check:", envCheck)

    // Test Redis connection
    let connectionTest = null
    try {
      connectionTest = await GameStateManager.testConnection()
      console.log("Redis connection test result:", connectionTest)
    } catch (error) {
      console.error("Redis connection test failed:", error)
      connectionTest = false
    }

    // Try to get existing rooms
    let existingRooms = []
    try {
      existingRooms = await GameStateManager.getAllRooms()
      console.log("Existing rooms count:", existingRooms.length)
    } catch (error) {
      console.error("Failed to get existing rooms:", error)
    }

    return NextResponse.json({
      success: true,
      debug: {
        environment: envCheck,
        redisConnection: connectionTest,
        existingRoomsCount: existingRooms.length,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("Debug endpoint error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Debug failed",
        details: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
