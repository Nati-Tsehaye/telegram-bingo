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

// Simplified room initialization that's less likely to fail
async function initializeRooms() {
  try {
    console.log("🔍 Checking for existing rooms...")

    // First test Redis connection
    const isConnected = await GameStateManager.testConnection()
    if (!isConnected) {
      console.error("❌ Redis connection failed")
      throw new Error("Redis connection failed")
    }

    const existingRooms = await GameStateManager.getAllRooms()
    console.log("📊 Found existing rooms:", existingRooms.length)

    // If we have rooms, just return success
    if (existingRooms.length > 0) {
      console.log("✅ Using existing rooms, skipping initialization")
      return true
    }

    console.log("🏗️ Creating default rooms...")
    const stakes = [10, 20, 50, 100]

    for (const stake of stakes) {
      const roomId = `room-${stake}`

      try {
        // Check if this specific room already exists
        const existingRoom = await GameStateManager.getRoom(roomId)
        if (existingRoom) {
          console.log(`✅ Room ${roomId} already exists, skipping`)
          continue
        }

        // Create minimal room object with only essential fields
        const room: GameRoom = {
          id: roomId,
          stake: stake,
          players: [],
          maxPlayers: 100,
          status: "waiting",
          prize: 0,
          createdAt: new Date(),
          activeGames: 0,
          hasBonus: true,
        }

        console.log(`🏗️ Creating room: ${roomId} with stake: ${stake}`)
        console.log(`📝 Room object:`, {
          id: room.id,
          stake: room.stake,
          playersLength: room.players.length,
          status: room.status,
        })

        await GameStateManager.setRoom(roomId, room)
        console.log(`✅ Successfully created room: ${roomId}`)

        // Verify the room was created
        const verifyRoom = await GameStateManager.getRoom(roomId)
        if (!verifyRoom) {
          throw new Error(`Room verification failed for ${roomId}`)
        }
        console.log(`✅ Verified room: ${roomId}`)
      } catch (error) {
        console.error(`❌ Failed to create room ${roomId}:`, error)
        // Log the specific error details
        if (error instanceof Error) {
          console.error(`Error details: ${error.message}`)
          console.error(`Error stack: ${error.stack}`)
        }
        throw new Error(`Failed to create room ${roomId}: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }

    console.log(`🎉 Room creation completed successfully!`)
    return true
  } catch (error) {
    console.error("❌ Error initializing rooms:", error)
    throw error // Re-throw to be handled by caller
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

    // Get existing rooms first
    console.log("📋 Fetching existing rooms...")
    let rooms: GameRoom[] = []

    try {
      rooms = await GameStateManager.getAllRooms()
      console.log("📊 Found existing rooms:", rooms.length)
    } catch (error) {
      console.error("❌ Error fetching existing rooms:", error)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch existing rooms",
          details: error instanceof Error ? error.message : "Unknown error",
          debug: true,
        },
        {
          status: 500,
          headers: corsHeaders,
        },
      )
    }

    // Only try to initialize if we have no rooms
    if (rooms.length === 0) {
      console.log("🔧 No rooms found, initializing...")
      try {
        await initializeRooms()
        // Fetch rooms again after initialization
        rooms = await GameStateManager.getAllRooms()
        console.log("📊 Rooms after initialization:", rooms.length)
      } catch (error) {
        console.error("❌ Room initialization failed:", error)
        return NextResponse.json(
          {
            success: false,
            error: "Failed to initialize rooms",
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

    // If still no rooms, return empty response instead of failing
    if (rooms.length === 0) {
      console.log("⚠️ No rooms available after initialization")
      return NextResponse.json(
        {
          success: true,
          rooms: [],
          totalPlayers: 0,
          timestamp: new Date().toISOString(),
          message: "No rooms available. Please try refreshing.",
        },
        {
          headers: corsHeaders,
        },
      )
    }

    // Filter and validate rooms
    const validRooms = rooms.filter((room) => {
      if (!room || typeof room !== "object") {
        console.warn("Invalid room object:", room)
        return false
      }
      if (!room.id || typeof room.id !== "string") {
        console.warn("Invalid room ID:", room.id)
        return false
      }
      if (!room.stake || typeof room.stake !== "number" || room.stake <= 0) {
        console.warn("Invalid room stake:", room.stake)
        return false
      }
      return true
    })

    console.log("📊 Valid rooms:", validRooms.length)

    const roomSummaries: GameRoomSummary[] = validRooms.map((room) => ({
      id: room.id,
      stake: room.stake,
      players: Array.isArray(room.players) ? room.players.length : 0,
      maxPlayers: room.maxPlayers || 100,
      status: room.status || "waiting",
      prize: (Array.isArray(room.players) ? room.players.length : 0) * room.stake,
      createdAt:
        room.createdAt instanceof Date ? room.createdAt.toISOString() : room.createdAt || new Date().toISOString(),
      activeGames: room.activeGames || 0,
      hasBonus: room.hasBonus !== false,
      gameStartTime: room.gameStartTime instanceof Date ? room.gameStartTime.toISOString() : room.gameStartTime,
      calledNumbers: Array.isArray(room.calledNumbers) ? room.calledNumbers : [],
      currentNumber: room.currentNumber,
    }))

    const totalPlayers = roomSummaries.reduce((sum, room) => sum + room.players, 0)

    console.log("✅ Returning response with", roomSummaries.length, "rooms and", totalPlayers, "total players")

    return NextResponse.json(
      {
        success: true,
        rooms: roomSummaries,
        totalPlayers,
        timestamp: new Date().toISOString(),
      },
      {
        headers: corsHeaders,
      },
    )
  } catch (error) {
    console.error("❌ Error in GET /api/rooms:", error)

    // Log detailed error information
    if (error instanceof Error) {
      console.error("Error name:", error.name)
      console.error("Error message:", error.message)
      console.error("Error stack:", error.stack)
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch rooms",
        details: error instanceof Error ? error.message : "Unknown error",
        errorName: error instanceof Error ? error.name : "UnknownError",
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

    console.log("🚀 POST /api/rooms called with action:", action)

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

        if ((room.players?.length || 0) >= room.maxPlayers) {
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

        if (room.status !== "waiting") {
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

        // Check if player is already in this room
        const existingPlayer = room.players?.find((p: Player) => p.id === playerId)
        if (existingPlayer) {
          return NextResponse.json(
            {
              success: true,
              room,
              message: "Already in room",
            },
            {
              headers: corsHeaders,
            },
          )
        }

        // Remove player from other rooms first
        const currentRoomId = await GameStateManager.getPlayerSession(playerId)
        if (currentRoomId && currentRoomId !== roomId) {
          const currentRoom = await GameStateManager.getRoom(currentRoomId as string)
          if (currentRoom) {
            currentRoom.players = currentRoom.players?.filter((p: Player) => p.id !== playerId) || []
            currentRoom.prize = (currentRoom.players?.length || 0) * currentRoom.stake
            await GameStateManager.setRoom(currentRoomId as string, currentRoom)
          }
        }

        // Create player with robust data handling
        const player: Player = {
          id: playerId || `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: (playerData?.name || `Player ${Date.now().toString().slice(-4)}`).trim() || "Guest Player",
          telegramId:
            playerData?.telegramId && !isNaN(Number(playerData.telegramId)) ? Number(playerData.telegramId) : undefined,
          joinedAt: new Date(),
        }

        // Validate player data
        if (!player.id || !player.name) {
          return NextResponse.json(
            {
              success: false,
              error: "Invalid player data",
            },
            {
              status: 400,
              headers: corsHeaders,
            },
          )
        }

        console.log(`Adding player to room ${roomId}:`, {
          id: player.id,
          name: player.name,
          telegramId: player.telegramId,
        })

        // Create a new room object with the player added
        const updatedRoom: GameRoom = {
          ...room,
          players: [...(room.players || []), player],
        }
        updatedRoom.prize = updatedRoom.players.length * updatedRoom.stake

        // Auto-start logic
        const minPlayers = 2
        const autoStartThreshold = Math.min(updatedRoom.maxPlayers * 0.1, 10)

        if (updatedRoom.players.length >= minPlayers && updatedRoom.players.length >= autoStartThreshold) {
          updatedRoom.status = "starting"

          // Schedule game start
          setTimeout(async () => {
            try {
              const currentRoom = await GameStateManager.getRoom(roomId)
              if (currentRoom && currentRoom.status === "starting") {
                const startedRoom: GameRoom = {
                  ...currentRoom,
                  status: "active",
                  gameStartTime: new Date(),
                  activeGames: 1,
                }
                await GameStateManager.setRoom(roomId, startedRoom)

                // Start auto number calling
                await GameStateManager.scheduleNumberCalling(roomId)
              }
            } catch (error) {
              console.error(`Error auto-starting game for room ${roomId}:`, error)
            }
          }, 10000)
        }

        try {
          await GameStateManager.setRoom(roomId, updatedRoom)
          await GameStateManager.setPlayerSession(playerId, roomId)

          return NextResponse.json(
            {
              success: true,
              room: updatedRoom,
              message: "Joined room successfully",
            },
            {
              headers: corsHeaders,
            },
          )
        } catch (error) {
          console.error(`Error saving room after player join:`, error)
          return NextResponse.json(
            {
              success: false,
              error: "Failed to join room due to server error",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            {
              status: 500,
              headers: corsHeaders,
            },
          )
        }

      case "leave":
        const playerRoomId = await GameStateManager.getPlayerSession(playerId)
        if (playerRoomId) {
          const playerRoom = await GameStateManager.getRoom(playerRoomId as string)
          if (playerRoom) {
            const updatedPlayerRoom: GameRoom = {
              ...playerRoom,
              players: playerRoom.players?.filter((p: Player) => p.id !== playerId) || [],
            }
            updatedPlayerRoom.prize = updatedPlayerRoom.players.length * updatedPlayerRoom.stake

            // Reset room if empty
            if (updatedPlayerRoom.players.length === 0) {
              updatedPlayerRoom.status = "waiting"
              updatedPlayerRoom.activeGames = 0
              updatedPlayerRoom.calledNumbers = []
              updatedPlayerRoom.currentNumber = undefined
            }

            await GameStateManager.setRoom(playerRoomId as string, updatedPlayerRoom)
          }
        }

        await GameStateManager.removePlayerSession(playerId)

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
