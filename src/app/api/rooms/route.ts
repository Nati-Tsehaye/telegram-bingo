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

    const existingRooms = await GameStateManager.getAllRooms()
    console.log("📊 Found existing rooms:", existingRooms.length)

    if (existingRooms.length === 0) {
      console.log("🏗️ Creating default rooms...")
      const stakes = [10, 20, 50, 100, 200, 500]

      for (const stake of stakes) {
        const roomId = `room-${stake}`
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
      console.log("🎉 Room creation process completed!")
    } else {
      console.log("✅ Using existing rooms")
    }

    // Verify we have at least some rooms
    const finalRooms = await GameStateManager.getAllRooms()
    if (finalRooms.length === 0) {
      console.log("⚠️ No rooms available, creating minimal set...")
      // Create just one room as fallback
      const fallbackRoom: GameRoom = {
        id: "room-10",
        stake: 10,
        players: [],
        maxPlayers: 100,
        status: "waiting",
        prize: 0,
        createdAt: new Date(),
        activeGames: 0,
        hasBonus: true,
      }
      await GameStateManager.setRoom("room-10", fallbackRoom)
    }
  } catch (error) {
    console.error("❌ Error initializing rooms:", error)
    throw error
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

    console.log("🔧 Initializing rooms...")
    await initializeRooms()

    console.log("📋 Fetching all rooms...")
    const rooms = await GameStateManager.getAllRooms()
    console.log("📊 Total rooms found:", rooms.length)

    // Ensure we have valid room data
    const validRooms = rooms.filter(
      (room) => room && typeof room === "object" && room.id && typeof room.stake === "number",
    )

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

        // Add player to new room
        const player: Player = {
          id: playerId,
          name: playerData?.name || "Guest Player",
          telegramId: playerData?.telegramId,
          joinedAt: new Date(),
        }

        room.players = room.players || []
        room.players.push(player)
        room.prize = room.players.length * room.stake

        // Auto-start logic
        const minPlayers = 2
        const autoStartThreshold = Math.min(room.maxPlayers * 0.1, 10)

        if (room.players.length >= minPlayers && room.players.length >= autoStartThreshold) {
          room.status = "starting"

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

        await GameStateManager.setRoom(roomId, room)
        await GameStateManager.setPlayerSession(playerId, roomId)

        return NextResponse.json(
          {
            success: true,
            room,
            message: "Joined room successfully",
          },
          {
            headers: corsHeaders,
          },
        )

      case "leave":
        const playerRoomId = await GameStateManager.getPlayerSession(playerId)
        if (playerRoomId) {
          const playerRoom = await GameStateManager.getRoom(playerRoomId as string)
          if (playerRoom) {
            playerRoom.players = playerRoom.players?.filter((p: Player) => p.id !== playerId) || []
            playerRoom.prize = (playerRoom.players?.length || 0) * playerRoom.stake

            // Reset room if empty
            if (playerRoom.players.length === 0) {
              playerRoom.status = "waiting"
              playerRoom.activeGames = 0
              playerRoom.calledNumbers = []
              playerRoom.currentNumber = undefined
            }

            await GameStateManager.setRoom(playerRoomId as string, playerRoom)
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
