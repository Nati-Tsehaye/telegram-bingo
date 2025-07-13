"use client"

import { useEffect, useRef, useState, useCallback } from "react"

// Client-side representation of GameRoom (without Set)
export interface GameRoomClient {
  id: number
  stake: number
  players: number
  prize: number
  status: "waiting" | "active"
  activeGames?: number
  hasBonus: boolean
  selectedBoards: { boardId: number; playerId: string; playerName: string }[] // Client-side: array of selected boards
}

interface WebSocketMessage {
  type:
    | "join_room"
    | "leave_room"
    | "room_update"
    | "player_joined"
    | "player_left"
    | "error"
    | "select_board"
    | "start_game"
  roomId?: number
  playerId?: string
  playerName?: string
  rooms?: GameRoomClient[]
  message?: string
  boardId?: number // For select_board message
}

export function useWebSocket(url: string) {
  const [isConnected, setIsConnected] = useState(false)
  const [rooms, setRooms] = useState<GameRoomClient[]>([])
  const [error, setError] = useState<string | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null) // Store current player's ID
  const [isPlayerRegisteredOnServer, setIsPlayerRegisteredOnServer] = useState(false) // New state
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null) // Corrected: Initialize with null

  const connect = useCallback(() => {
    try {
      console.log("🔌 Connecting to WebSocket:", url)
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log("✅ WebSocket connected")
        setIsConnected(true)
        setError(null)
        // Generate a unique player ID if not already set, and persist it
        let storedPlayerId = localStorage.getItem("bingoPlayerId")
        if (!storedPlayerId) {
          storedPlayerId = `player_${Math.random().toString(36).substr(2, 9)}`
          localStorage.setItem("bingoPlayerId", storedPlayerId)
        }
        setPlayerId(storedPlayerId)
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          console.log("📨 Received message:", message)

          switch (message.type) {
            case "room_update":
              if (message.rooms) {
                console.log("🏠 Room update received:", message.rooms)
                setRooms(message.rooms)
              }
              break
            case "error":
              console.error("❌ Server error:", message.message)
              setError(message.message || "Unknown error")
              break
            case "player_joined":
              console.log("✅ Successfully joined room:", message.roomId)
              setIsPlayerRegisteredOnServer(true) // Player is now registered on server
              break
            case "player_left":
              console.log("✅ Successfully left room:", message.roomId)
              // No need to set isPlayerRegisteredOnServer to false here, as player might rejoin
              break
          }
        } catch (err) {
          console.error("❌ Error parsing WebSocket message:", err)
        }
      }

      ws.onclose = (event) => {
        console.log("🔌 WebSocket disconnected:", event.code, event.reason)
        setIsConnected(false)
        setIsPlayerRegisteredOnServer(false) // Reset registration status on disconnect

        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("🔄 Attempting to reconnect...")
          connect()
        }, 3000)
      }

      ws.onerror = (error) => {
        console.error("❌ WebSocket error:", error)
        setError("Connection error")
      }
    } catch (err) {
      console.error("❌ Failed to create WebSocket connection:", err)
      setError("Failed to connect")
    }
  }, [url])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const sendMessage = useCallback(
    (message: WebSocketMessage) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // Attach playerId to all outgoing messages
        const messageWithPlayerId = { ...message, playerId: playerId || undefined }
        console.log("📤 Sending message:", messageWithPlayerId)
        wsRef.current.send(JSON.stringify(messageWithPlayerId))
      } else {
        console.error("❌ WebSocket is not connected")
        setError("Not connected to server")
      }
    },
    [playerId], // Depend on playerId
  )

  const joinRoom = useCallback(
    (roomId: number, playerName: string) => {
      console.log(`🎮 Joining room ${roomId} as ${playerName}`)
      sendMessage({
        type: "join_room",
        roomId,
        playerName,
      })
    },
    [sendMessage],
  )

  const leaveRoom = useCallback(
    (roomId: number) => {
      console.log(`🚪 Leaving room ${roomId}`)
      sendMessage({
        type: "leave_room",
        roomId,
      })
    },
    [sendMessage],
  )

  const selectBoard = useCallback(
    (roomId: number, boardId: number) => {
      console.log(`🔢 Selecting board ${boardId} for room ${roomId}`)
      sendMessage({
        type: "select_board",
        roomId,
        boardId,
      })
    },
    [sendMessage],
  )

  const startGame = useCallback(
    (roomId: number) => {
      console.log(`🚀 Starting game in room ${roomId}`)
      sendMessage({
        type: "start_game",
        roomId,
      })
    },
    [sendMessage],
  )

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    isConnected,
    rooms,
    error,
    playerId, // Expose playerId
    isPlayerRegisteredOnServer, // Expose new state
    joinRoom,
    leaveRoom,
    selectBoard, // Expose new function
    startGame, // Expose new function
    sendMessage,
  }
}
