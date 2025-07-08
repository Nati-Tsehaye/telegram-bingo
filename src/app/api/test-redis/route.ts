import { NextResponse } from "next/server"
import { redis } from "@/lib/upstash-client"

export async function GET() {
  try {
    console.log("🧪 Testing Redis connection...")

    // Check environment variables first
    const hasUrl = !!process.env.UPSTASH_REDIS_REST_URL || !!process.env.KV_REST_API_URL
    const hasToken = !!process.env.UPSTASH_REDIS_REST_TOKEN || !!process.env.KV_REST_API_TOKEN

    console.log("Environment check:", { hasUrl, hasToken })

    if (!hasUrl || !hasToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing Redis environment variables",
          details: {
            hasUrl,
            hasToken,
            availableEnvVars: Object.keys(process.env).filter(
              (key) => key.includes("REDIS") || key.includes("KV") || key.includes("UPSTASH"),
            ),
          },
        },
        { status: 500 },
      )
    }

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
      message: "Redis connection working!",
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
          hasUpstashUrl: !!process.env.UPSTASH_REDIS_REST_URL,
          hasUpstashToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
          hasKvUrl: !!process.env.KV_REST_API_URL,
          hasKvToken: !!process.env.KV_REST_API_TOKEN,
          nodeEnv: process.env.NODE_ENV,
        },
      },
      { status: 500 },
    )
  }
}
