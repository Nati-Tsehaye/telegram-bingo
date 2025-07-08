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
      await redis.del(`game:${roomId}`)
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
      throw error
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
        } catch (parseError) {
          console.error(`Error parsing selection for player ${playerId}:`, parseError)
          corruptedKeys.push(playerId)
        }
      }

      // Clean up corrupted entries
      if (corruptedKeys.length > 0) {
        console.log(`Cleaning up ${corruptedKeys.length} corrupted board selections`)
        await redis.hdel(`boards:${roomId}`, ...corruptedKeys)
      }

      return validSelections
    } catch (error) {
      console.error(`Error getting board selections for room ${roomId}:`, error)
      // If there's a major error, clear the entire hash and return empty array
      await redis.del(`boards:${roomId}`)
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
      throw error
    }
  }

  // Room management - Fixed JSON parsing
  static async setRoom(roomId: string, room: unknown) {
    try {
      await redis.setex(`room:${roomId}`, 7200, JSON.stringify(room)) // 2 hours TTL
    } catch (error) {
      console.error(`Error setting room ${roomId}:`, error)
      throw error
    }
  }

  static async getRoom(roomId: string) {
    try {
      const data = await redis.get(`room:${roomId}`)
      if (!data) return null

      // Handle both string and object responses
      if (typeof data === "string") {
        return JSON.parse(data)
      }
      return data // Already parsed by Upstash client
    } catch (error) {
      console.error(`Error getting room ${roomId}:`, error)
      // Delete corrupted data
      await redis.del(`room:${roomId}`)
      return null
    }
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
    try {
      await redis.setex(`player:${playerId}`, 3600, roomId)
    } catch (error) {
      console.error(`Error setting player session for ${playerId}:`, error)
      throw error
    }
  }

  static async getPlayerSession(playerId: string) {
    try {
      return await redis.get(`player:${playerId}`)
    } catch (_error) {
      console.error(`Error getting player session for ${playerId}:`, _error)
      return null
    }
  }

  static async removePlayerSession(playerId: string) {
    try {
      await redis.del(`player:${playerId}`)
    } catch (_error) {
      console.error(`Error removing player session for ${playerId}:`, _error)
      throw _error // Corrected variable name
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
        } catch (error) {
          console.error(`Error cleaning game key ${key}:`, error)
          await redis.del(key)
          cleanedGames++
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
        } catch (error) {
          console.log(`Deleting corrupted room data: ${key}`)
          await redis.del(key)
          cleanedRooms++
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
        } catch (error) {
          console.log(`Deleting corrupted board data: ${key}`)
          await redis.del(key)
          cleanedBoards++
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
