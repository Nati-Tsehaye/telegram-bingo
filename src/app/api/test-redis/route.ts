import { NextResponse } from "next/server"
import { redis } from "@/lib/upstash-client"

export async function GET() {
  try {
    console.log("🧪 Testing Redis connection...")

    // Test basic Redis operations
    const testKey = "test-connection"
    const testValue = "Hello Redis!"

    // Set a test value
    await redis.set(testKey, testValue)
    console.log("✅ Redis SET successful")

    // Get the test value
    const result = await redis.get(testKey)
    console.log("✅ Redis GET successful, result:", result)

    // Clean up
    await redis.del(testKey)
    console.log("✅ Redis DEL successful")

    return NextResponse.json({
      success: true,
      message: "Redis connection workings!",
      testResult: result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Redis connection failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Redis connection failed",
        details: error instanceof Error ? error.message : "Unknown error",
        envCheck: {
          hasUrl: !!process.env.KV_REST_API_URL,
          hasToken: !!process.env.KV_REST_API_TOKEN,
          urlPreview: process.env.KV_REST_API_URL?.substring(0, 20) + "...",
        },
      },
      { status: 500 },
    )
  }
}
