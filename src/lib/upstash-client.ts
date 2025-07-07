import { Redis } from "@upstash/redis"

// Initialize Redis client with environment variables
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Game state management with Redis
export class GameStateManager {
  // Store game state in Redis with TTL
  static async setGameState(roomId: string, state: unknown) {
    await redis.setex(`game:${roomId}`, 3600, JSON.stringify(state)) // 1 hour TTL

    // Publish update to subscribers
    await redis.publish(
      `room:${roomId}`,
      JSON.stringify({
        type: "game_update",
        data: state,
        timestamp: new Date().toISOString(),
      }),
    )
  }

  static async getGameState(roomId: string) {
    const data = await redis.get(`game:${roomId}`)
    if (!data) return null

    // Handle both string and object responses
    if (typeof data === "string") {
      return JSON.parse(data)
    }
    return data // Already parsed by Upstash client
  }

  // Board selections management
  static async setBoardSelection(roomId: string, playerId: string, selection: unknown) {
    await redis.hset(`boards:${roomId}`, { [playerId]: JSON.stringify(selection) })

    // Publish board selection update
    await redis.publish(
      `room:${roomId}`,
      JSON.stringify({
        type: "board_selection",
        data: { playerId, selection },
        timestamp: new Date().toISOString(),
      }),
    )
  }

  static async getBoardSelections(roomId: string) {
    const selections = await redis.hgetall(`boards:${roomId}`)
    if (!selections) return []

    return Object.entries(selections).map(([playerId, data]) => ({
      playerId,
      ...JSON.parse(data as string),
    }))
  }

  static async removeBoardSelection(roomId: string, playerId: string) {
    await redis.hdel(`boards:${roomId}`, playerId)

    // Publish removal update
    await redis.publish(
      `room:${roomId}`,
      JSON.stringify({
        type: "board_deselection",
        data: { playerId },
        timestamp: new Date().toISOString(),
      }),
    )
  }

  // Room management - Fixed JSON parsing
  static async setRoom(roomId: string, room: unknown) {
    await redis.setex(`room:${roomId}`, 7200, JSON.stringify(room)) // 2 hours TTL
  }

  static async getRoom(roomId: string) {
    const data = await redis.get(`room:${roomId}`)
    if (!data) return null

    // Handle both string and object responses
    if (typeof data === "string") {
      return JSON.parse(data)
    }
    return data // Already parsed by Upstash client
  }

  static async getAllRooms() {
    try {
      const keys = await redis.keys("room:*")
      if (keys.length === 0) return []

      const rooms = await Promise.all(
        keys.map(async (key) => {
          try {
            const data = await redis.get(key)
            if (!data) return null

            // Handle both string and object responses
            if (typeof data === "string") {
              return JSON.parse(data)
            }
            return data // Already parsed by Upstash client
          } catch (error) {
            console.error(`Error parsing room data for key ${key}:`, error)
            // Delete corrupted data
            await redis.del(key)
            return null
          }
        }),
      )
      return rooms.filter(Boolean)
    } catch (error) {
      console.error("Error getting all rooms:", error)
      return []
    }
  }

  // Player session management
  static async setPlayerSession(playerId: string, roomId: string) {
    await redis.setex(`player:${playerId}`, 3600, roomId)
  }

  static async getPlayerSession(playerId: string) {
    return await redis.get(`player:${playerId}`)
  }

  static async removePlayerSession(playerId: string) {
    await redis.del(`player:${playerId}`)
  }

  // Game number calling with auto-increment
  static async callNextNumber(roomId: string) {
    const gameState = await this.getGameState(roomId)
    if (!gameState || gameState.gameStatus !== "active") return null

    // Get available numbers (1-75 that haven't been called)
    const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1).filter(
      (num) => !gameState.calledNumbers.includes(num),
    )

    if (availableNumbers.length === 0) {
      // Game over - all numbers called
      gameState.gameStatus = "finished"
      gameState.lastUpdate = new Date().toISOString()
      await this.setGameState(roomId, gameState)
      return null
    }

    // Pick a random available number
    const randomIndex = Math.floor(Math.random() * availableNumbers.length)
    const newNumber = availableNumbers[randomIndex]

    // Update game state
    gameState.currentNumber = newNumber
    gameState.calledNumbers.push(newNumber)
    gameState.lastUpdate = new Date().toISOString()

    await this.setGameState(roomId, gameState)
    return newNumber
  }

  // Auto number calling scheduler
  static async scheduleNumberCalling(roomId: string) {
    const key = `scheduler:${roomId}`
    await redis.setex(key, 300, "active") // 5 minutes TTL
  }

  static async isNumberCallingActive(roomId: string) {
    const key = `scheduler:${roomId}`
    return await redis.exists(key)
  }

  // Cleanup expired data and corrupted entries
  static async cleanup() {
    try {
      // Clean up expired game data
      const gameKeys = await redis.keys("game:*")
      for (const key of gameKeys) {
        const ttl = await redis.ttl(key)
        if (ttl <= 0) {
          await redis.del(key)
        }
      }

      // Clean up corrupted room data
      const roomKeys = await redis.keys("room:*")
      for (const key of roomKeys) {
        try {
          const data = await redis.get(key)
          if (data && typeof data === "string") {
            JSON.parse(data) // Test if it's valid JSON
          }
        } catch (error) {
          console.log(`Deleting corrupted room data: ${key}`)
          await redis.del(key)
        }
      }
    } catch (error) {
      console.error("Error during cleanup:", error)
    }
  }

  // Clear all data (for development/testing)
  static async clearAllData() {
    try {
      const allKeys = await redis.keys("*")
      if (allKeys.length > 0) {
        await redis.del(...allKeys)
      }
      console.log(`Cleared ${allKeys.length} keys from Redis`)
    } catch (error) {
      console.error("Error clearing data:", error)
    }
  }
}

// Rate limiting
export class RateLimiter {
  static async checkLimit(identifier: string, limit = 10, window = 60) {
    const key = `rate:${identifier}`
    const current = await redis.incr(key)

    if (current === 1) {
      await redis.expire(key, window)
    }

    return current <= limit
  }
}
