import { Server as SocketIOServer } from "socket.io"
import type { Server as HTTPServer } from "http"

export interface Player {
  id: string
  name: string
  telegramId?: number
  avatar?: string
  joinedAt: Date
}

export interface GameRoom {
  id: string
  stake: number
  players: Player[]
  maxPlayers: number
  status: "waiting" | "starting" | "active" | "finished"
  prize: number
  createdAt: Date
  gameStartTime?: Date
}

class GameRoomManager {
  private rooms: Map<string, GameRoom> = new Map()
  private playerRooms: Map<string, string> = new Map() // playerId -> roomId

  constructor() {
    // Initialize default rooms for each stake
    this.createDefaultRooms()
  }

  private createDefaultRooms() {
    const stakes = [10, 20, 50, 100]
    stakes.forEach((stake) => {
      const roomId = `room-${stake}-${Date.now()}`
      const room: GameRoom = {
        id: roomId,
        stake,
        players: [],
        maxPlayers: 10,
        status: "waiting",
        prize: 0,
        createdAt: new Date(),
      }
      this.rooms.set(roomId, room)
    })
  }

  getRoomsByStake(stake: number): GameRoom[] {
    return Array.from(this.rooms.values())
      .filter((room) => room.stake === stake)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }

  getAllRooms(): GameRoom[] {
    return Array.from(this.rooms.values())
  }

  findAvailableRoom(stake: number): GameRoom | null {
    const rooms = this.getRoomsByStake(stake)
    return rooms.find((room) => room.status === "waiting" && room.players.length < room.maxPlayers) || null
  }

  createRoom(stake: number): GameRoom {
    const roomId = `room-${stake}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const room: GameRoom = {
      id: roomId,
      stake,
      players: [],
      maxPlayers: 10,
      status: "waiting",
      prize: 0,
      createdAt: new Date(),
    }
    this.rooms.set(roomId, room)
    return room
  }

  joinRoom(roomId: string, player: Player): boolean {
    const room = this.rooms.get(roomId)
    if (!room || room.players.length >= room.maxPlayers || room.status !== "waiting") {
      return false
    }

    // Remove player from previous room if exists
    const previousRoomId = this.playerRooms.get(player.id)
    if (previousRoomId) {
      this.leaveRoom(previousRoomId, player.id)
    }

    room.players.push(player)
    room.prize = room.players.length * room.stake
    this.playerRooms.set(player.id, roomId)

    // Auto-start game if room is full
    if (room.players.length >= 2 && room.players.length >= room.maxPlayers * 0.8) {
      room.status = "starting"
      // Start game after 10 seconds
      setTimeout(() => {
        if (room.status === "starting") {
          room.status = "active"
          room.gameStartTime = new Date()
        }
      }, 10000)
    }

    return true
  }

  leaveRoom(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId)
    if (!room) return false

    const playerIndex = room.players.findIndex((p) => p.id === playerId)
    if (playerIndex === -1) return false

    room.players.splice(playerIndex, 1)
    room.prize = room.players.length * room.stake
    this.playerRooms.delete(playerId)

    // Reset room status if no players
    if (room.players.length === 0) {
      room.status = "waiting"
    }

    return true
  }

  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId)
  }

  getPlayerRoom(playerId: string): GameRoom | undefined {
    const roomId = this.playerRooms.get(playerId)
    return roomId ? this.rooms.get(roomId) : undefined
  }
}

export function initializeSocketServer(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  })

  const roomManager = new GameRoomManager()

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id)

    // Send initial room data
    socket.emit("rooms-update", roomManager.getAllRooms())

    // Join a room
    socket.on("join-room", ({ stake, player }: { stake: number; player: Omit<Player, "joinedAt"> }) => {
      let room = roomManager.findAvailableRoom(stake)

      if (!room) {
        room = roomManager.createRoom(stake)
      }

      const fullPlayer: Player = {
        ...player,
        joinedAt: new Date(),
      }

      const success = roomManager.joinRoom(room.id, fullPlayer)

      if (success) {
        socket.join(room.id)
        socket.emit("room-joined", room)

        // Broadcast room update to all clients
        io.emit("rooms-update", roomManager.getAllRooms())

        // Notify room members
        io.to(room.id).emit("player-joined", { room, player: fullPlayer })
      } else {
        socket.emit("join-failed", { message: "Could not join room" })
      }
    })

    // Leave room
    socket.on("leave-room", ({ playerId }: { playerId: string }) => {
      const room = roomManager.getPlayerRoom(playerId)
      if (room) {
        const success = roomManager.leaveRoom(room.id, playerId)
        if (success) {
          socket.leave(room.id)
          socket.emit("room-left")

          // Broadcast updates
          io.emit("rooms-update", roomManager.getAllRooms())
          io.to(room.id).emit("player-left", { room, playerId })
        }
      }
    })

    // Get room details
    socket.on("get-room", ({ roomId }: { roomId: string }) => {
      const room = roomManager.getRoom(roomId)
      socket.emit("room-details", room)
    })

    // Refresh rooms
    socket.on("refresh-rooms", () => {
      socket.emit("rooms-update", roomManager.getAllRooms())
    })

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id)
      // Note: In a production app, you'd want to track socket.id to player mapping
      // and remove players when they disconnect
    })
  })

  return io
}
