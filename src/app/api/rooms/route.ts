import { NextResponse } from "next/server"
import { GameStateManager, RateLimiter } from "@/lib/upstash-client"
import type { GameRoom, Player, JoinRoomRequest, GameRoomSummary } from "@/types/game"

// Add CORS headers for Telegram Mini App
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
}

// Initialize default rooms in Redis if they don't exist
async function initializeRooms() {
  try {
    console.log("🔍 Checking for existing rooms...")

    // First test Redis connection
    const isConnected = await GameStateManager.testConnection()
    if (!isConnected) {
      throw new Error("Redis connection failed")
    }

    console.log("🏗️ Ensuring all required rooms exist...")
    const stakes = [10, 20, 30, 50, 100]

    for (const stake of stakes) {
      const roomId = `room-${stake}`

      // Check if this specific room already exists
      const existingRoom = await GameStateManager.getRoom(roomId)
      if (existingRoom) {
        console.log(`✅ Room ${roomId} already exists, skipping`)
        continue
      }

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

      try {
        console.log(`Creating room: ${roomId}`)
        await GameStateManager.setRoom(roomId, room)
        console.log(`✅ Created room: ${roomId}`)
      } catch (error) {
        console.error(`❌ Failed to create room ${roomId}:`, error)
        // Don't throw here, continue with other rooms
      }
    }

    // Verify all rooms exist
    const allRooms = await GameStateManager.getAllRooms()
    const roomStakes = allRooms.map((room) => room.stake).sort((a, b) => a - b)
    console.log(`📊 Current room stakes: [${roomStakes.join(", ")}]`)

    if (roomStakes.length < 5) {
      console.log(`⚠️ Only ${roomStakes.length} rooms found, expected 5`)
    } else {
      console.log("🎉 All 5 rooms verified!")
    }
  } catch (error) {
    console.error("❌ Error initializing rooms:", error)
    // Don't throw the error, just log it and continue
    console.log("⚠️ Continuing with existing rooms despite initialization error")
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  })
}

export async function GET(request: Request) {
  try {
    console.log("🚀 GET /api/rooms called")
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"

    // Rate limiting
    const canProceed = await RateLimiter.checkLimit(`rooms:${clientIp}`, 30, 60)
    if (!canProceed) {
      console.log("⚠️ Rate limit exceeded for IP:", clientIp)
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded",
        },
        {
          status: 429,
          headers: corsHeaders,
        },
      )
    }

    // Always try to initialize rooms to ensure all 5 exist
    try {
      console.log("🔧 Initializing rooms...")
      await initializeRooms()
    } catch (error) {
      console.error("⚠️ Room initialization failed, but continuing:", error)
    }

    console.log("📋 Fetching all rooms...")
    const rooms = await GameStateManager.getAllRooms()
    console.log("📊 Total rooms found:", rooms.length)

    // If we still don't have enough rooms, create emergency fallback rooms
    if (rooms.length < 5) {
      console.log(`🆘 Only ${rooms.length} rooms found, creating missing emergency rooms...`)
      const stakes = [10, 20, 30, 50, 100]
      const existingStakes = new Set(rooms.map((room) => room.stake))

      for (const stake of stakes) {
        if (!existingStakes.has(stake)) {
          try {
            const fallbackRoom: GameRoom = {
              id: `room-emergency-${stake}`,
              stake,
              players: [],
              maxPlayers: 100,
              status: "waiting",
              prize: 0,
              createdAt: new Date(),
              activeGames: 0,
              hasBonus: true,
            }
            await GameStateManager.setRoom(`room-emergency-${stake}`, fallbackRoom)
            rooms.push(fallbackRoom)
            console.log(`✅ Created emergency room for stake ${stake}`)
          } catch (error) {
            console.error(`❌ Failed to create emergency room for stake ${stake}:`, error)
          }
        }
      }
    }

    // Ensure we have valid room data
    const validRooms = rooms.filter(
      (room) => room && typeof room === "object" && room.id && typeof room.stake === "number",
    )

    console.log("📊 Valid rooms:", validRooms.length)

    // Collect all current active player IDs from all rooms (for aggressive cleanup)
    const currentActivePlayerIds = new Set<string>()
    const now = new Date()
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000) // Increased to 10 minutes for more stability

    validRooms.forEach((room) => {
      if (Array.isArray(room.players)) {
        room.players.forEach((player) => {
          if (player && player.id && player.joinedAt) {
            const joinedAt = player.joinedAt instanceof Date ? player.joinedAt : new Date(player.joinedAt)
            // Only consider players from last 10 minutes as "active"
            if (joinedAt > tenMinutesAgo) {
              currentActivePlayerIds.add(player.id)
            }
          }
        })
      }
    })

    console.log("🔍 Current active player IDs (last 10 min):", Array.from(currentActivePlayerIds))

    // Run GENTLE cleanup instead of aggressive - only remove truly inactive players
    const cleanupResult = await GameStateManager.gentleGhostCleanup(currentActivePlayerIds)
    console.log("🧹 Gentle cleanup result:", cleanupResult)

    // Fetch rooms again after cleanup
    const cleanedRooms = await GameStateManager.getAllRooms()
    const cleanedValidRooms = cleanedRooms.filter(
      (room) => room && typeof room === "object" && room.id && typeof room.stake === "number",
    )

    // Generate room summaries with active players (use longer time window for stability)
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000) // 5 minutes for display
    const roomSummaries: GameRoomSummary[] = cleanedValidRooms.map((room) => {
      // Count players who joined in the last 5 minutes
      let activePlayers = 0
      if (Array.isArray(room.players)) {
        activePlayers = room.players.filter((player) => {
          if (!player || !player.joinedAt) return false
          const joinedAt = player.joinedAt instanceof Date ? player.joinedAt : new Date(player.joinedAt)
          return joinedAt > fiveMinutesAgo
        }).length
      }

      return {
        id: room.id,
        stake: room.stake,
        players: activePlayers, // Use cleaned count
        maxPlayers: room.maxPlayers || 100,
        status: room.status || "waiting",
        prize: activePlayers * room.stake, // Recalculate prize based on active players
        createdAt:
          room.createdAt instanceof Date ? room.createdAt.toISOString() : room.createdAt || new Date().toISOString(),
        activeGames: room.activeGames || 0,
        hasBonus: room.hasBonus !== false,
        gameStartTime: room.gameStartTime instanceof Date ? room.gameStartTime.toISOString() : room.gameStartTime,
        calledNumbers: Array.isArray(room.calledNumbers) ? room.calledNumbers : [],
        currentNumber: room.currentNumber,
      }
    })

    // Sort rooms by stake for consistent ordering
    roomSummaries.sort((a, b) => a.stake - b.stake)

    // Calculate total unique ACTIVE players across all rooms (last 5 minutes)
    const totalActivePlayers = new Set()
    cleanedValidRooms.forEach((room) => {
      if (Array.isArray(room.players)) {
        room.players.forEach((player) => {
          if (player && player.id && player.joinedAt) {
            const joinedAt = player.joinedAt instanceof Date ? player.joinedAt : new Date(player.joinedAt)
            if (joinedAt > fiveMinutesAgo) {
              totalActivePlayers.add(player.id)
            }
          }
        })
      }
    })

    console.log(
      "✅ Returning response with",
      roomSummaries.length,
      "rooms and",
      totalActivePlayers.size,
      "active players",
    )
    console.log("🏠 Room stakes:", roomSummaries.map((r) => r.stake).join(", "))
    console.log("🔍 Final active player IDs:", Array.from(currentActivePlayerIds))

    return NextResponse.json(
      {
        success: true,
        rooms: roomSummaries,
        totalPlayers: totalActivePlayers.size,
        timestamp: new Date().toISOString(),
      },
      {
        headers: corsHeaders,
      },
    )
  } catch (error) {
    console.error("❌ Error in GET /api/rooms:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch rooms",
        details: error instanceof Error ? error.message : "Unknown error",
        debug: true,
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    )
  }
}

export async function POST(request: Request) {
  try {
    const { action, roomId, playerId, playerData }: JoinRoomRequest = await request.json()
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"

    console.log("🚀 POST /api/rooms called with action:", action, "playerId:", playerId)

    // Rate limiting
    const canProceed = await RateLimiter.checkLimit(`action:${clientIp}`, 20, 60)
    if (!canProceed) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded",
        },
        {
          status: 429,
          headers: corsHeaders,
        },
      )
    }

    await initializeRooms()

    switch (action) {
      case "join":
        if (!roomId) {
          return NextResponse.json(
            {
              success: false,
              error: "Room ID required",
            },
            {
              status: 400,
              headers: corsHeaders,
            },
          )
        }

        const room = await GameStateManager.getRoom(roomId)
        if (!room) {
          return NextResponse.json(
            {
              success: false,
              error: "Room not found",
            },
            {
              status: 404,
              headers: corsHeaders,
            },
          )
        }

        // Run gentle cleanup before joining - protect only the current player
        const protectedPlayerIds = new Set([playerId])
        await GameStateManager.gentleGhostCleanup(protectedPlayerIds)

        // Fetch room again after cleanup
        const cleanedRoom = await GameStateManager.getRoom(roomId)
        if (!cleanedRoom) {
          return NextResponse.json(
            {
              success: false,
              error: "Room not found after cleanup",
            },
            {
              status: 404,
              headers: corsHeaders,
            },
          )
        }

        if ((cleanedRoom.players?.length || 0) >= cleanedRoom.maxPlayers) {
          return NextResponse.json(
            {
              success: false,
              error: "Room is full",
            },
            {
              status: 400,
              headers: corsHeaders,
            },
          )
        }

        if (cleanedRoom.status !== "waiting") {
          return NextResponse.json(
            {
              success: false,
              error: "Game already started",
            },
            {
              status: 400,
              headers: corsHeaders,
            },
          )
        }

        // Check if this Telegram user is already in this room (prevent duplicate joins from different devices)
        let existingPlayer = null
        if (playerData?.telegramId) {
          // For Telegram users, check by Telegram ID to prevent duplicate joins from different devices
          existingPlayer = cleanedRoom.players?.find((p: Player) => p.telegramId === playerData.telegramId)
          if (existingPlayer && existingPlayer.id !== playerId) {
            console.log(`🚫 Telegram user ${playerData.telegramId} already in room with different session ID`)
            console.log(`   Existing: ${existingPlayer.id}, New: ${playerId}`)

            // Remove the old session and replace with new one
            cleanedRoom.players =
              cleanedRoom.players?.filter((p: Player) => p.telegramId !== playerData.telegramId) || []

            // Clean up old player session and board selections
            await GameStateManager.removePlayerSession(existingPlayer.id)
            await GameStateManager.removePlayerFromAllBoardSelections(existingPlayer.id)

            console.log(`🔄 Replaced old session ${existingPlayer.id} with new session ${playerId}`)
          }
        } else {
          // For guest users, check by player ID as before
          existingPlayer = cleanedRoom.players?.find((p: Player) => p.id === playerId)
        }

        if (existingPlayer && existingPlayer.id === playerId) {
          console.log("🔄 Player already in room with same session, updating session")
          // Update player session to ensure it's tracked
          await GameStateManager.setPlayerSession(playerId, roomId)
          return NextResponse.json(
            {
              success: true,
              room: cleanedRoom,
              message: "Already in room",
            },
            {
              headers: corsHeaders,
            },
          )
        }

        // Remove player from other rooms first (but protect this player ID)
        console.log("🧹 Cleaning up player from other rooms...")
        if (playerData?.telegramId) {
          // For Telegram users, remove all other sessions with same Telegram ID
          console.log(`🔍 Removing duplicate Telegram sessions for user ${playerData.telegramId}`)
          await GameStateManager.removePlayerByTelegramId(playerData.telegramId, playerId)
        } else {
          // For guest users, use the regular cleanup
          await GameStateManager.removePlayerFromAllRooms(playerId)
        }

        // Add player to new room
        const player: Player = {
          id: playerId,
          name: playerData?.name || "Guest Player",
          telegramId: playerData?.telegramId,
          joinedAt: new Date(), // Always use current time for new joins
        }

        cleanedRoom.players = cleanedRoom.players || []
        cleanedRoom.players.push(player)
        cleanedRoom.prize = cleanedRoom.players.length * cleanedRoom.stake

        // Auto-start logic
        const minPlayers = 2
        const autoStartThreshold = Math.min(cleanedRoom.maxPlayers * 0.1, 10)

        if (cleanedRoom.players.length >= minPlayers && cleanedRoom.players.length >= autoStartThreshold) {
          cleanedRoom.status = "starting"

          // Schedule game start
          setTimeout(async () => {
            const currentRoom = await GameStateManager.getRoom(roomId)
            if (currentRoom && currentRoom.status === "starting") {
              currentRoom.status = "active"
              currentRoom.gameStartTime = new Date()
              currentRoom.activeGames = 1
              await GameStateManager.setRoom(roomId, currentRoom)

              // Start auto number calling
              await GameStateManager.scheduleNumberCalling(roomId)
            }
          }, 10000)
        }

        await GameStateManager.setRoom(roomId, cleanedRoom)
        await GameStateManager.setPlayerSession(playerId, roomId)

        console.log("✅ Player joined room successfully:", playerId, "->", roomId)

        return NextResponse.json(
          {
            success: true,
            room: cleanedRoom,
            message: "Joined room successfully",
          },
          {
            headers: corsHeaders,
          },
        )

      case "leave":
        console.log("👋 Player leaving:", playerId)

        // Get player's current room
        const playerRoomId = await GameStateManager.getPlayerSession(playerId)
        if (playerRoomId) {
          console.log("🏠 Found player in room:", playerRoomId)
          const playerRoom = await GameStateManager.getRoom(playerRoomId as string)
          if (playerRoom) {
            // Remove player from room
            const originalPlayerCount = playerRoom.players?.length || 0
            playerRoom.players = playerRoom.players?.filter((p: Player) => p.id !== playerId) || []
            playerRoom.prize = (playerRoom.players?.length || 0) * playerRoom.stake

            console.log(`🔢 Player count: ${originalPlayerCount} -> ${playerRoom.players.length}`)

            // Only reset room if completely empty
            if (playerRoom.players.length === 0) {
              console.log("🔄 Resetting room to waiting state (empty)")
              playerRoom.status = "waiting"
              playerRoom.activeGames = 0
              playerRoom.calledNumbers = []
              playerRoom.currentNumber = undefined
              playerRoom.gameStartTime = undefined

              // Also reset the game state in Redis
              await GameStateManager.resetGameState(playerRoomId as string)
            }
            // Remove the condition that resets when < 2 players to prevent unnecessary resets

            await GameStateManager.setRoom(playerRoomId as string, playerRoom)
            console.log("✅ Updated room after player left")
          }
        }

        // Remove player session
        await GameStateManager.removePlayerSession(playerId)
        console.log("🗑️ Removed player session")

        // Also remove board selections for this player from all rooms
        console.log("🧹 Cleaning up board selections for player:", playerId)
        await GameStateManager.removePlayerFromAllBoardSelections(playerId)

        return NextResponse.json(
          {
            success: true,
            message: "Left room successfully",
          },
          {
            headers: corsHeaders,
          },
        )

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action",
          },
          {
            status: 400,
            headers: corsHeaders,
          },
        )
    }
  } catch (error) {
    console.error("❌ Error handling room action:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    )
  }
}
