import { NextResponse } from "next/server"

// In-memory storage (replace with Redis/Database in production)
const gameRooms = new Map<string, any>()
const playerSessions = new Map<string, any>()

// Mock room data generator
function generateMockRooms() {
  const stakes = [10, 20, 50, 100]
  return stakes.map((stake, index) => ({
    id: `room-${stake}-${Date.now()}-${index}`,
    stake,
    players: Math.floor(Math.random() * 8) + 1, // 1-8 players
    maxPlayers: 10,
    status: Math.random() > 0.7 ? "active" : "waiting",
    prize: (Math.floor(Math.random() * 8) + 1) * stake,
    createdAt: new Date().toISOString(),
    activeGames: Math.random() > 0.5 ? 1 : 0,
    hasBonus: true,
    gameStartTime: null,
    calledNumbers: [],
    currentNumber: null,
  }))
}

// Initialize default rooms if empty
function initializeRooms() {
  if (gameRooms.size === 0) {
    const stakes = [10, 20, 50, 100, 200, 500]
    stakes.forEach((stake) => {
      // Create multiple rooms per stake to handle more players
      for (let i = 1; i <= 5; i++) {
        const roomId = `room-${stake}-${i}`
        gameRooms.set(roomId, {
          id: roomId,
          stake,
          players: [],
          maxPlayers: 100, // Increased capacity
          status: "waiting",
          prize: 0,
          createdAt: new Date().toISOString(),
          activeGames: 0,
          hasBonus: true,
          gameStartTime: null,
          calledNumbers: [],
          currentNumber: null,
        })
      }
    })
  }
}

export async function GET() {
  try {
    initializeRooms()

    const rooms = Array.from(gameRooms.values()).map((room) => ({
      ...room,
      players: room.players.length, // Only send count, not full player data
      prize: room.players.length * room.stake,
    }))

    return NextResponse.json({
      success: true,
      rooms,
      totalPlayers: Array.from(gameRooms.values()).reduce((sum, room) => sum + room.players.length, 0),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error fetching rooms:", error)
    return NextResponse.json({ error: "Failed to fetch rooms" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { action, roomId, playerId, playerData } = await request.json()

    initializeRooms()

    switch (action) {
      case "join":
        const room = gameRooms.get(roomId)
        if (!room) {
          return NextResponse.json({ error: "Room not found" }, { status: 404 })
        }

        if (room.players.length >= room.maxPlayers) {
          return NextResponse.json({ error: "Room is full" }, { status: 400 })
        }

        if (room.status !== "waiting") {
          return NextResponse.json({ error: "Game already started" }, { status: 400 })
        }

        // Remove player from other rooms first
        gameRooms.forEach((r, id) => {
          r.players = r.players.filter((p: any) => p.id !== playerId)
        })

        // Add player to new room
        const player = {
          id: playerId,
          name: playerData.name,
          telegramId: playerData.telegramId,
          joinedAt: new Date().toISOString(),
          isReady: false,
        }

        room.players.push(player)
        room.prize = room.players.length * room.stake

        // Auto-start if enough players (minimum 2, or 80% capacity)
        const minPlayers = Math.min(2, room.maxPlayers * 0.1)
        const autoStartThreshold = Math.min(room.maxPlayers * 0.8, 50)

        if (room.players.length >= minPlayers && room.players.length >= autoStartThreshold) {
          room.status = "starting"
          // Start game after 10 seconds
          setTimeout(() => {
            const currentRoom = gameRooms.get(roomId)
            if (currentRoom && currentRoom.status === "starting") {
              currentRoom.status = "active"
              currentRoom.gameStartTime = new Date().toISOString()
              currentRoom.activeGames = 1
            }
          }, 10000)
        }

        playerSessions.set(playerId, { roomId, lastActivity: Date.now() })

        return NextResponse.json({
          success: true,
          room: {
            ...room,
            players: room.players.length,
          },
          message: "Joined room successfully",
        })

      case "leave":
        gameRooms.forEach((room, id) => {
          room.players = room.players.filter((p: any) => p.id !== playerId)
          room.prize = room.players.length * room.stake

          // Reset room if empty
          if (room.players.length === 0) {
            room.status = "waiting"
            room.activeGames = 0
            room.calledNumbers = []
            room.currentNumber = null
          }
        })

        playerSessions.delete(playerId)

        return NextResponse.json({
          success: true,
          message: "Left room successfully",
        })

      case "ready":
        const playerRoom = Array.from(gameRooms.values()).find((room) =>
          room.players.some((p: any) => p.id === playerId),
        )

        if (playerRoom) {
          const player = playerRoom.players.find((p: any) => p.id === playerId)
          if (player) {
            player.isReady = true

            // Check if all players are ready
            const readyCount = playerRoom.players.filter((p: any) => p.isReady).length
            if (readyCount >= 2 && readyCount === playerRoom.players.length) {
              playerRoom.status = "starting"
              setTimeout(() => {
                if (playerRoom.status === "starting") {
                  playerRoom.status = "active"
                  playerRoom.gameStartTime = new Date().toISOString()
                  playerRoom.activeGames = 1
                }
              }, 5000)
            }
          }
        }

        return NextResponse.json({
          success: true,
          message: "Player ready",
        })

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error handling room action:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
