import { NextResponse } from "next/server"
import type { GameRoom, Player, JoinRoomRequest, GameRoomSummary } from "@/types/game"

// In-memory storage (replace with Redis/Database in production)
const gameRooms = new Map<string, GameRoom>()
const playerSessions = new Map<string, { roomId: string; lastActivity: number }>()

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
          createdAt: new Date(),
          activeGames: 0,
          hasBonus: true,
          gameStartTime: undefined,
          calledNumbers: [],
          currentNumber: undefined,
        })
      }
    })
  }
}

export async function GET() {
  try {
    initializeRooms()

    const rooms: GameRoomSummary[] = Array.from(gameRooms.values()).map((room) => ({
      id: room.id,
      stake: room.stake,
      players: room.players.length, // Only send count, not full player data
      maxPlayers: room.maxPlayers,
      status: room.status,
      prize: room.players.length * room.stake,
      createdAt: room.createdAt.toISOString(),
      activeGames: room.activeGames,
      hasBonus: room.hasBonus,
      gameStartTime: room.gameStartTime?.toISOString(),
      calledNumbers: room.calledNumbers,
      currentNumber: room.currentNumber,
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
    const { action, roomId, playerId, playerData }: JoinRoomRequest = await request.json()

    initializeRooms()

    switch (action) {
      case "join":
        if (!roomId) {
          return NextResponse.json({ error: "Room ID required" }, { status: 400 })
        }

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
        gameRooms.forEach((r) => {
          r.players = r.players.filter((p: Player) => p.id !== playerId)
        })

        // Add player to new room
        const player: Player = {
          id: playerId,
          name: playerData?.name || "Guest Player",
          telegramId: playerData?.telegramId,
          joinedAt: new Date(),
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
              currentRoom.gameStartTime = new Date()
              currentRoom.activeGames = 1
            }
          }, 10000)
        }

        playerSessions.set(playerId, { roomId, lastActivity: Date.now() })

        // Return the full room for joining player
        return NextResponse.json({
          success: true,
          room,
          message: "Joined room successfully",
        })

      case "leave":
        gameRooms.forEach((room) => {
          room.players = room.players.filter((p: Player) => p.id !== playerId)
          room.prize = room.players.length * room.stake

          // Reset room if empty
          if (room.players.length === 0) {
            room.status = "waiting"
            room.activeGames = 0
            room.calledNumbers = []
            room.currentNumber = undefined
          }
        })

        playerSessions.delete(playerId)

        return NextResponse.json({
          success: true,
          message: "Left room successfully",
        })

      case "ready":
        const playerRoom = Array.from(gameRooms.values()).find((room) =>
          room.players.some((p: Player) => p.id === playerId),
        )

        if (playerRoom) {
          const player = playerRoom.players.find((p: Player) => p.id === playerId)
          if (player) {
            // Add isReady property if it doesn't exist
            ;(player as Player & { isReady?: boolean }).isReady = true

            // Check if all players are ready
            const readyCount = playerRoom.players.filter((p: Player & { isReady?: boolean }) => p.isReady).length
            if (readyCount >= 2 && readyCount === playerRoom.players.length) {
              playerRoom.status = "starting"
              setTimeout(() => {
                if (playerRoom.status === "starting") {
                  playerRoom.status = "active"
                  playerRoom.gameStartTime = new Date()
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
