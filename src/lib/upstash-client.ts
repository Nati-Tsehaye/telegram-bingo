import { Redis } from "@upstash/redis"
import type { GameRoom } from "@/types/game"

// Initialize Redis client with better error handling and logging
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN

console.log("🔧 Redis Configuration Check:")
console.log("- URL exists:", !!redisUrl)
console.log("- Token exists:", !!redisToken)
console.log("- URL length:", redisUrl?.length || 0)
console.log("- Token length:", redisToken?.length || 0)

if (!redisUrl || !redisToken) {
  console.error("❌ Missing Redis configuration:")
  console.error(
    "Available env vars:",
    Object.keys(process.env).filter((key) => key.includes("REDIS") || key.includes("KV") || key.includes("UPSTASH")),
  )
  throw new Error(`Redis configuration missing: URL=${!!redisUrl}, Token=${!!redisToken}`)
}

export const redis = new Redis({
  url: redisUrl,
  token: redisToken,
})

// Game state management with Redis
export class GameStateManager {
  // Store game state in Redis with TTL
  static async setGameState(roomId: string, state: unknown) {
    try {
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
    } catch (error) {
      console.error(`Error setting game state for room ${roomId}:`, error)
      throw new Error(`Failed to set game state: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  static async getGameState(roomId: string) {
    try {
      const data = await redis.get(`game:${roomId}`)
      if (!data) return null

      // Handle both string and object responses
      if (typeof data === "string") {
        return JSON.parse(data)
      }
      return data // Already parsed by Upstash client
    } catch (error) {
      console.error(`Error getting game state for room ${roomId}:`, error)
      // Delete corrupted data
      try {
        await redis.del(`game:${roomId}`)
      } catch {}
      return null
    }
  }

  // Board selections management - Fixed to handle corrupted data
  static async setBoardSelection(roomId: string, playerId: string, selection: unknown) {
    try {
      // Ensure selection is properly serialized
      const serializedSelection = JSON.stringify(selection)
      await redis.hset(`boards:${roomId}`, { [playerId]: serializedSelection })

      // Publish board selection update
      await redis.publish(
        `room:${roomId}`,
        JSON.stringify({
          type: "board_selection",
          data: { playerId, selection },
          timestamp: new Date().toISOString(),
        }),
      )
    } catch (error) {
      console.error(`Error setting board selection for room ${roomId}, player ${playerId}:`, error)
      throw new Error(`Failed to set board selection: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  static async getBoardSelections(roomId: string) {
    try {
      const selections = await redis.hgetall(`boards:${roomId}`)
      if (!selections || Object.keys(selections).length === 0) return []

      const validSelections = []
      const corruptedKeys = []

      for (const [playerId, data] of Object.entries(selections)) {
        try {
          // Handle different data types
          let parsedData
          if (typeof data === "string") {
            // Check if it's valid JSON
            if (data.startsWith("{") || data.startsWith("[")) {
              parsedData = JSON.parse(data)
            } else {
              // Invalid JSON string
              console.warn(`Invalid JSON for player ${playerId}:`, data)
              corruptedKeys.push(playerId)
              continue
            }
          } else if (typeof data === "object" && data !== null) {
            parsedData = data
          } else {
            // Invalid data type
            console.warn(`Invalid data type for player ${playerId}:`, typeof data, data)
            corruptedKeys.push(playerId)
            continue
          }

          // Validate the parsed data structure
          if (parsedData && typeof parsedData === "object" && parsedData.boardNumber) {
            validSelections.push({
              playerId,
              ...parsedData,
            })
          } else {
            console.warn(`Invalid selection structure for player ${playerId}:`, parsedData)
            corruptedKeys.push(playerId)
          }
        } catch (error) {
          console.error(`Error parsing selection for player ${playerId}:`, error)
          corruptedKeys.push(playerId)
        }
      }

      // Clean up corrupted entries
      if (corruptedKeys.length > 0) {
        console.log(`Cleaning up ${corruptedKeys.length} corrupted board selections`)
        try {
          await redis.hdel(`boards:${roomId}`, ...corruptedKeys)
        } catch (error) {
          console.error("Error cleaning up corrupted selections:", error)
        }
      }

      return validSelections
    } catch (error) {
      console.error(`Error getting board selections for room ${roomId}:`, error)
      // If there's a major error, clear the entire hash and return empty array
      try {
        await redis.del(`boards:${roomId}`)
      } catch {}
      return []
    }
  }

  static async removeBoardSelection(roomId: string, playerId: string) {
    try {
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
    } catch (error) {
      console.error(`Error removing board selection for room ${roomId}, player ${playerId}:`, error)
      throw new Error(`Failed to remove board selection: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  // Room management - Now properly typed to accept GameRoom with better error handling
  static async setRoom(roomId: string, room: GameRoom) {
    try {
      console.log(`🏠 Setting room ${roomId}...`)

      // Validate required fields
      if (!room.id || !room.stake || typeof room.stake !== "number") {
        throw new Error(`Invalid room data: missing id or stake`)
      }

      // Ensure the room object is properly serializable
      const roomData = {
        id: room.id || roomId,
        stake: room.stake || 0,
        players: Array.isArray(room.players) ? room.players : [],
        maxPlayers: room.maxPlayers || 100,
        status: room.status || "waiting",
        prize: room.prize || 0,
        activeGames: room.activeGames || 0,
        hasBonus: room.hasBonus !== false,
        createdAt:
          room.createdAt instanceof Date ? room.createdAt.toISOString() : room.createdAt || new Date().toISOString(),
        gameStartTime: room.gameStartTime instanceof Date ? room.gameStartTime.toISOString() : room.gameStartTime,
        calledNumbers: Array.isArray(room.calledNumbers) ? room.calledNumbers : [],
        currentNumber: room.currentNumber,
      }

      console.log(`📝 Room data prepared for ${roomId}:`, {
        id: roomData.id,
        stake: roomData.stake,
        playersCount: roomData.players.length,
        status: roomData.status,
      })

      const serializedRoom = JSON.stringify(roomData)
      console.log(`💾 Serialized room size: ${serializedRoom.length} characters`)

      // Test Redis connection before attempting to set
      const connectionTest = await this.testConnection()
      if (!connectionTest) {
        throw new Error("Redis connection test failed")
      }

      await redis.setex(`room:${roomId}`, 7200, serializedRoom) // 2 hours TTL
      console.log(`✅ Successfully set room ${roomId}`)
    } catch (error) {
      console.error(`❌ Error setting room ${roomId}:`, error)
      console.error(`Room data:`, room)
      throw new Error(`Failed to set room: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  static async getRoom(roomId: string): Promise<GameRoom | null> {
    try {
      const data = await redis.get(`room:${roomId}`)
      if (!data) return null

      // Handle both string and object responses
      let roomData
      if (typeof data === "string") {
        roomData = JSON.parse(data)
      } else {
        roomData = data // Already parsed by Upstash client
      }

      // Convert date strings back to Date objects if needed
      if (roomData.createdAt && typeof roomData.createdAt === "string") {
        roomData.createdAt = new Date(roomData.createdAt)
      }
      if (roomData.gameStartTime && typeof roomData.gameStartTime === "string") {
        roomData.gameStartTime = new Date(roomData.gameStartTime)
      }

      return roomData as GameRoom
    } catch (error) {
      console.error(`Error getting room ${roomId}:`, error)
      // Delete corrupted data
      try {
        await redis.del(`room:${roomId}`)
      } catch {}
      return null
    }
  }

  static async getAllRooms(): Promise<GameRoom[]> {
    try {
      const keys = await redis.keys("room:*")
      if (keys.length === 0) return []

      const rooms = await Promise.all(
        keys.map(async (key) => {
          try {
            const data = await redis.get(key)
            if (!data) return null

            // Handle both string and object responses
            let roomData
            if (typeof data === "string") {
              roomData = JSON.parse(data)
            } else {
              roomData = data // Already parsed by Upstash client
            }

            // Convert date strings back to Date objects if needed
            if (roomData.createdAt && typeof roomData.createdAt === "string") {
              roomData.createdAt = new Date(roomData.createdAt)
            }
            if (roomData.gameStartTime && typeof roomData.gameStartTime === "string") {
              roomData.gameStartTime = new Date(roomData.gameStartTime)
            }

            return roomData as GameRoom
          } catch (error) {
            console.error(`Error parsing room data for key ${key}:`, error)
            // Delete corrupted data
            try {
              await redis.del(key)
            } catch {}
            return null
          }
        }),
      )
      return rooms.filter((room): room is GameRoom => room !== null)
    } catch (error) {
      console.error("Error getting all rooms:", error)
      return []
    }
  }

  // Player session management
  static async setPlayerSession(playerId: string, roomId: string) {
    try {
      await redis.setex(`player:${playerId}`, 3600, roomId)
    } catch (error) {
      console.error(`Error setting player session for ${playerId}:`, error)
      throw new Error(`Failed to set player session: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  static async getPlayerSession(playerId: string) {
    try {
      return await redis.get(`player:${playerId}`)
    } catch (error) {
      console.error(`Error getting player session for ${playerId}:`, error)
      return null
    }
  }

  static async removePlayerSession(playerId: string) {
    try {
      await redis.del(`player:${playerId}`)
    } catch (error) {
      console.error(`Error removing player session for ${playerId}:`, error)
    }
  }

  // Game number calling with auto-increment
  static async callNextNumber(roomId: string) {
    try {
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
    } catch (error) {
      console.error(`Error calling next number for room ${roomId}:`, error)
      return null
    }
  }

  // Auto number calling scheduler
  static async scheduleNumberCalling(roomId: string) {
    try {
      const key = `scheduler:${roomId}`
      await redis.setex(key, 300, "active") // 5 minutes TTL
    } catch (error) {
      console.error(`Error scheduling number calling for room ${roomId}:`, error)
    }
  }

  static async isNumberCallingActive(roomId: string) {
    try {
      const key = `scheduler:${roomId}`
      return await redis.exists(key)
    } catch (error) {
      console.error(`Error checking number calling status for room ${roomId}:`, error)
      return false
    }
  }

  // Test Redis connection with detailed logging
  static async testConnection() {
    try {
      console.log("🧪 Testing Redis connection...")
      const testKey = "connection-test"
      const testValue = "test-value"

      console.log("📝 Setting test value...")
      await redis.set(testKey, testValue)

      console.log("📖 Getting test value...")
      const result = await redis.get(testKey)

      console.log("🗑️ Deleting test value...")
      await redis.del(testKey)

      const success = result === testValue
      console.log(`✅ Redis connection test ${success ? "passed" : "failed"}`)
      return success
    } catch (error) {
      console.error("❌ Redis connection test failed:", error)
      return false
    }
  }

  // Cleanup expired data and corrupted entries
  static async cleanup() {
    try {
      console.log("🧹 Starting Redis cleanup...")

      // Clean up expired game data
      const gameKeys = await redis.keys("game:*")
      let cleanedGames = 0
      for (const key of gameKeys) {
        try {
          const ttl = await redis.ttl(key)
          if (ttl <= 0) {
            await redis.del(key)
            cleanedGames++
          }
        } catch {
          console.error(`Error cleaning game key ${key}`)
          try {
            await redis.del(key)
            cleanedGames++
          } catch {}
        }
      }

      // Clean up corrupted room data
      const roomKeys = await redis.keys("room:*")
      let cleanedRooms = 0
      for (const key of roomKeys) {
        try {
          const data = await redis.get(key)
          if (data && typeof data === "string") {
            JSON.parse(data) // Test if it's valid JSON
          }
        } catch {
          console.log(`Deleting corrupted room data: ${key}`)
          try {
            await redis.del(key)
            cleanedRooms++
          } catch {}
        }
      }

      // Clean up corrupted board selections
      const boardKeys = await redis.keys("boards:*")
      let cleanedBoards = 0
      for (const key of boardKeys) {
        try {
          const selections = await redis.hgetall(key)
          if (selections) {
            const corruptedFields = []
            for (const [field, value] of Object.entries(selections)) {
              try {
                if (typeof value === "string" && !value.startsWith("{")) {
                  corruptedFields.push(field)
                }
              } catch {
                corruptedFields.push(field)
              }
            }
            if (corruptedFields.length > 0) {
              await redis.hdel(key, ...corruptedFields)
              cleanedBoards += corruptedFields.length
            }
          }
        } catch {
          console.log(`Deleting corrupted board data: ${key}`)
          try {
            await redis.del(key)
            cleanedBoards++
          } catch {}
        }
      }

      console.log(
        `✅ Cleanup completed: ${cleanedGames} games, ${cleanedRooms} rooms, ${cleanedBoards} board selections`,
      )
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
    try {
      const key = `rate:${identifier}`
      const current = await redis.incr(key)

      if (current === 1) {
        await redis.expire(key, window)
      }

      return current <= limit
    } catch (error) {
      console.error(`Error checking rate limit for ${identifier}:`, error)
      return true // Allow request if rate limiting fails
    }
  }
}
