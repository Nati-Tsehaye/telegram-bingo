"use client"

import { io, type Socket } from "socket.io-client"
import type { GameRoom, Player } from "./socket-server"

class SocketClient {
  private socket: Socket | null = null
  private static instance: SocketClient

  static getInstance(): SocketClient {
    if (!SocketClient.instance) {
      SocketClient.instance = new SocketClient()
    }
    return SocketClient.instance
  }

  connect() {
    if (this.socket?.connected) return this.socket

    const serverUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    this.socket = io(serverUrl, {
      transports: ["websocket", "polling"],
    })

    this.socket.on("connect", () => {
      console.log("Connected to Socket.IO server")
    })

    this.socket.on("disconnect", () => {
      console.log("Disconnected from Socket.IO server")
    })

    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  // Room management
  joinRoom(stake: number, player: Omit<Player, "joinedAt">) {
    this.socket?.emit("join-room", { stake, player })
  }

  leaveRoom(playerId: string) {
    this.socket?.emit("leave-room", { playerId })
  }

  refreshRooms() {
    this.socket?.emit("refresh-rooms")
  }

  getRoomDetails(roomId: string) {
    this.socket?.emit("get-room", { roomId })
  }

  // Event listeners
  onRoomsUpdate(callback: (rooms: GameRoom[]) => void) {
    this.socket?.on("rooms-update", callback)
  }

  onRoomJoined(callback: (room: GameRoom) => void) {
    this.socket?.on("room-joined", callback)
  }

  onRoomLeft(callback: () => void) {
    this.socket?.on("room-left", callback)
  }

  onPlayerJoined(callback: (data: { room: GameRoom; player: Player }) => void) {
    this.socket?.on("player-joined", callback)
  }

  onPlayerLeft(callback: (data: { room: GameRoom; playerId: string }) => void) {
    this.socket?.on("player-left", callback)
  }

  onJoinFailed(callback: (data: { message: string }) => void) {
    this.socket?.on("join-failed", callback)
  }

  // Remove event listeners
  off(event: string, callback?: (...args: unknown[]) => void) {
    this.socket?.off(event, callback)
  }

  getSocket() {
    return this.socket
  }
}

export default SocketClient
