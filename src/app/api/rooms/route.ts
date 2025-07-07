import { NextResponse } from "next/server"
import { GameStateManager, RateLimiter } from "@/lib/upstash-client"
import type { GameRoom, Player, JoinRoomRequest, GameRoomSummary } from "@/types/game"

// Initialize default rooms in Redis if they don't exist
async function initializeRooms() {
  const existingRooms = await GameStateManager.getAllRooms()

  if (existingRooms.length === 0) {
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
        gameStartTime: undefined,
        calledNumbers: [],
        currentNumber: undefined,
      }

      await GameStateManager.setRoom(roomId, room)
    }
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams: _searchParams } = new URL(request.url)
    const clientIp = request.headers.get("x-forwarded-for") || "unknown"

    // Rate limiting
    const canProceed = await RateLimiter.checkLimit(`rooms:${clientIp}`, 30, 60)
    if (!canProceed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    await initializeRooms()
    const rooms = await GameStateManager.getAllRooms()

    const roomSummaries: GameRoomSummary[] = rooms.map((room) => ({
      id: room.id,
      stake: room.stake,
      players: room.players?.length || 0,
      maxPlayers: room.maxPlayers,
      status: room.status,
      prize: (room.players?.length || 0) * room.stake,
      createdAt: room.createdAt,
      activeGames: room.activeGames || 0,
      hasBonus: room.hasBonus,
      gameStartTime: room.gameStartTime,
      calledNumbers: room.calledNumbers || [],
      currentNumber: room.currentNumber,
    }))

    const totalPlayers = rooms.reduce((sum, room) => sum + (room.players?.length || 0), 0)

    return NextResponse.json({
      success: true,
      rooms: roomSummaries,
      totalPlayers,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error fetching rooms:", error)
    return NextResponse.json({ error: "Failed to fetch rooms" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { action, roomId, playerId, playerData }: JoinRoomRequest = await request.json()
    const clientIp = request.headers.get("x-forwarded-for") || "unknown"

    // Rate limiting
    const canProceed = await RateLimiter.checkLimit(`action:${clientIp}`, 20, 60)
    if (!canProceed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    await initializeRooms()

    switch (action) {
      case "join":
        if (!roomId) {
          return NextResponse.json({ error: "Room ID required" }, { status: 400 })
        }

        const room = await GameStateManager.getRoom(roomId)
        if (!room) {
          return NextResponse.json({ error: "Room not found" }, { status: 404 })
        }

        if ((room.players?.length || 0) >= room.maxPlayers) {
          return NextResponse.json({ error: "Room is full" }, { status: 400 })
        }

        if (room.status !== "waiting") {
          return NextResponse.json({ error: "Game already started" }, { status: 400 })
        }

        // Check if player is already in this room
        const existingPlayer = room.players?.find((p: Player) => p.id === playerId)
        if (existingPlayer) {
          return NextResponse.json({
            success: true,
            room,
            message: "Already in room",
          })
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

        return NextResponse.json({
          success: true,
          room,
          message: "Joined room successfully",
        })

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

        return NextResponse.json({
          success: true,
          message: "Left room successfully",
        })

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error handling room action:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
