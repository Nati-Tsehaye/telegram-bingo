"use client"

import { useEffect, useRef, useState, useCallback } from "react"

// Client-side representation of GameRoom (without Set)
export interface GameRoomClient {
  id: number
  stake: number
  players: number
  prize: number
  status: "waiting" | "active" | "starting" | "game_over" // Added "game_over" status
  activeGames?: number
  hasBonus: boolean
  selectedBoards: { boardId: number; playerId: string; playerName: string }[] // Client-side: array of selected boards
  startTime?: number // New: Timestamp when the game started (for countdown sync)
  calledNumbers: number[] // New: Track all called numbers
  currentNumber?: number // New: Current number being called
  winner?: {
    playerId: string
    playerName: string
    prize: number
    winnerBoard?: number[][] // New: Winner's board numbers
    winnerMarkedCells?: boolean[][] // New: Winner's marked cells
  } | null // Changed to allow null
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
    | "number_called"
    | "bingo_won" // New message type
  roomId?: number
  playerId?: string
  playerName?: string
  rooms?: GameRoomClient[]
  message?: string
  boardId?: number
  calledNumber?: number // New: The number that was called
  allCalledNumbers?: number[] // New: All numbers called so far
  winnerPlayerId?: string // New: ID of the player who won
  winnerName?: string // New: Name of the player who won
  winningPrize?: number // New: Prize amount for the winner
  winnerBoard?: number[][] // New: For bingo_won message
  winnerMarkedCells?: boolean[][] // New: For bingo_won message
}

// Global WebSocket instance to persist across component mounts/unmounts
let globalWs: WebSocket | null = null
const globalConnectionState = {
  isConnected: false,
  rooms: [] as GameRoomClient[],
  error: null as string | null,
  playerId: null as string | null,
  isPlayerRegisteredOnServer: false,
  currentCalledNumber: null as number | null,
  allCalledNumbers: [] as number[],
  winnerInfo: null as {
    playerId: string
    playerName: string
    prize: number
    winnerBoard?: number[][] // New: Winner's board numbers
    winnerMarkedCells?: boolean[][] // New: Winner's marked cells
  } | null, // New: Store winner info
}

// Global listeners for state updates
const globalListeners = new Set<(state: typeof globalConnectionState) => void>()

function notifyListeners() {
  globalListeners.forEach((listener) => listener({ ...globalConnectionState }))
}

function connectGlobalWebSocket(url: string) {
  if (globalWs && globalWs.readyState === WebSocket.OPEN) {
    return // Already connected
  }

  if (globalWs && globalWs.readyState === WebSocket.CONNECTING) {
    return // Already connecting
  }

  try {
    console.log("🔌 Connecting to WebSocket:", url)
    globalWs = new WebSocket(url)

    globalWs.onopen = () => {
      console.log("✅ WebSocket connected")
      globalConnectionState.isConnected = true
      globalConnectionState.error = null

      let storedPlayerId = localStorage.getItem("bingoPlayerId")
      if (!storedPlayerId) {
        storedPlayerId = `player_${Math.random().toString(36).substr(2, 9)}`
        localStorage.setItem("bingoPlayerId", storedPlayerId)
      }
      globalConnectionState.playerId = storedPlayerId
      notifyListeners()
    }

    globalWs.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        console.log("📨 Received message:", message)

        switch (message.type) {
          case "room_update":
            if (message.rooms) {
              console.log("🏠 Room update received:", message.rooms)
              globalConnectionState.rooms = message.rooms
              notifyListeners()
            }
            break
          case "error":
            console.error("❌ Server error:", message.message)
            globalConnectionState.error = message.message || "Unknown error"
            notifyListeners()
            break
          case "player_joined":
            console.log("✅ Successfully joined room:", message.roomId)
            globalConnectionState.isPlayerRegisteredOnServer = true
            notifyListeners()
            break
          case "player_left":
            console.log("✅ Successfully left room:", message.roomId)
            globalConnectionState.isPlayerRegisteredOnServer = false
            notifyListeners()
            break
          case "number_called": // New case
            if (message.calledNumber && message.allCalledNumbers) {
              console.log(
                `🎯 Number called: ${message.calledNumber}, All called: [${message.allCalledNumbers.join(", ")}]`,
              )
              globalConnectionState.currentCalledNumber = message.calledNumber
              globalConnectionState.allCalledNumbers = message.allCalledNumbers
              notifyListeners()
            } else {
              console.warn("⚠️ Received number_called message but missing data:", message)
            }
            break
          case "bingo_won": // New case for BINGO win broadcast
            if (
              message.winnerPlayerId &&
              message.winnerName &&
              message.winningPrize !== undefined &&
              message.winnerBoard &&
              message.winnerMarkedCells
            ) {
              console.log(`🏆 BINGO won by ${message.winnerName} with prize ${message.winningPrize}!`)
              globalConnectionState.winnerInfo = {
                playerId: message.winnerPlayerId,
                playerName: message.winnerName,
                prize: message.winningPrize,
                winnerBoard: message.winnerBoard, // Store winner's board
                winnerMarkedCells: message.winnerMarkedCells, // Store winner's marked cells
              }
              // Also update the room status to game_over if it's not already
              globalConnectionState.rooms = globalConnectionState.rooms.map((room) =>
                room.id === message.roomId
                  ? { ...room, status: "game_over", winner: globalConnectionState.winnerInfo }
                  : room,
              )
              notifyListeners()
            } else {
              console.warn("⚠️ Received bingo_won message but missing data:", message)
            }
            break
        }
      } catch (err) {
        console.error("❌ Error parsing WebSocket message:", err)
      }
    }

    globalWs.onclose = (event) => {
      console.log("🔌 WebSocket disconnected:", event.code, event.reason)
      globalConnectionState.isConnected = false
      globalConnectionState.isPlayerRegisteredOnServer = false
      globalConnectionState.currentCalledNumber = null
      globalConnectionState.allCalledNumbers = []
      globalConnectionState.winnerInfo = null // Clear winner info on disconnect
      notifyListeners()

      // Only reconnect if it wasn't a manual close (code 1000)
      if (event.code !== 1000) {
        setTimeout(() => {
          console.log("🔄 Attempting to reconnect...")
          connectGlobalWebSocket(url)
        }, 3000)
      }
    }

    globalWs.onerror = (error) => {
      console.error("❌ WebSocket error:", error)
      globalConnectionState.error = "Connection error"
      notifyListeners()
    }
  } catch (err) {
    console.error("❌ Failed to create WebSocket connection:", err)
    globalConnectionState.error = "Failed to connect"
    notifyListeners()
  }
}

function sendGlobalMessage(message: WebSocketMessage) {
  if (globalWs && globalWs.readyState === WebSocket.OPEN) {
    // Attach playerId to all outgoing messages
    const messageWithPlayerId = { ...message, playerId: globalConnectionState.playerId || undefined }
    console.log("📤 Sending message:", messageWithPlayerId)
    globalWs.send(JSON.stringify(messageWithPlayerId))
  } else {
    console.error("❌ WebSocket is not connected")
    globalConnectionState.error = "Not connected to server"
    notifyListeners()
  }
}

export function useWebSocket(url: string) {
  const [state, setState] = useState(globalConnectionState)
  const listenerRef = useRef<(state: typeof globalConnectionState) => void | null>(null)

  useEffect(() => {
    // Create listener function
    listenerRef.current = (newState) => {
      setState(newState)
    }

    // Add listener
    globalListeners.add(listenerRef.current)

    // Connect if not already connected
    connectGlobalWebSocket(url)

    // Set initial state
    setState(globalConnectionState)

    // Cleanup on unmount
    return () => {
      if (listenerRef.current) {
        globalListeners.delete(listenerRef.current)
      }
    }
  }, [url])

  const joinRoom = useCallback((roomId: number, playerName: string) => {
    console.log(`🎮 Joining room ${roomId} as ${playerName}`)
    sendGlobalMessage({
      type: "join_room",
      roomId,
      playerName,
    })
  }, [])

  const leaveRoom = useCallback((roomId: number) => {
    console.log(`🚪 Leaving room ${roomId}`)
    sendGlobalMessage({
      type: "leave_room",
      roomId,
    })
  }, [])

  const selectBoard = useCallback((roomId: number, boardId: number) => {
    console.log(`🔢 Selecting board ${boardId} for room ${roomId}`)
    sendGlobalMessage({
      type: "select_board",
      roomId,
      boardId,
    })
  }, [])

  const startGame = useCallback((roomId: number) => {
    console.log(`🚀 Starting game in room ${roomId}`)
    sendGlobalMessage({
      type: "start_game",
      roomId,
    })
  }, [])

  const claimBingo = useCallback((roomId: number, boardNumbers: number[][], markedCells: boolean[][]) => {
    console.log(`🎉 Claiming BINGO in room ${roomId}`)
    sendGlobalMessage({
      type: "bingo_won",
      roomId,
      winnerBoard: boardNumbers, // Send the actual board numbers
      winnerMarkedCells: markedCells, // Send the marked cells
    })
  }, [])

  return {
    isConnected: state.isConnected,
    rooms: state.rooms,
    error: state.error,
    playerId: state.playerId,
    isPlayerRegisteredOnServer: state.isPlayerRegisteredOnServer,
    currentCalledNumber: state.currentCalledNumber,
    allCalledNumbers: state.allCalledNumbers,
    winnerInfo: state.winnerInfo, // Expose winner info
    joinRoom,
    leaveRoom,
    selectBoard,
    startGame,
    claimBingo, // Expose claimBingo
    sendMessage: sendGlobalMessage,
  }
}

// Cleanup function for when the app is closing
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (globalWs) {
      globalWs.close(1000, "Page unload")
    }
  })
}
