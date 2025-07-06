import { NextResponse } from "next/server"
import type { GameState, GameStateRequest, Winner } from "@/types/game"

// This would be replaced with Redis or Database in production
const gameStates = new Map<string, GameState>()
const gameIntervals = new Map<string, NodeJS.Timeout>() // Track intervals per room

// Function to start auto number calling for a room
function startAutoNumberCalling(roomId: string) {
  // Don't start if already running
  if (gameIntervals.has(roomId)) {
    return
  }

  const interval = setInterval(() => {
    const gameState = gameStates.get(roomId)
    if (!gameState || gameState.gameStatus !== "active") {
      clearInterval(interval)
      gameIntervals.delete(roomId)
      return
    }

    // Get available numbers (1-75 that haven't been called)
    const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1).filter(
      (num) => !gameState.calledNumbers.includes(num),
    )

    if (availableNumbers.length === 0) {
      // Game over - all numbers called
      gameState.gameStatus = "finished"
      gameState.lastUpdate = new Date().toISOString()
      clearInterval(interval)
      gameIntervals.delete(roomId)
      return
    }

    // Pick a random available number
    const randomIndex = Math.floor(Math.random() * availableNumbers.length)
    const newNumber = availableNumbers[randomIndex]

    // Update game state
    gameState.currentNumber = newNumber
    gameState.calledNumbers.push(newNumber)
    gameState.lastUpdate = new Date().toISOString()

    console.log(`Room ${roomId}: Called number ${newNumber}`)
  }, 4000) // Call every 4 seconds

  gameIntervals.set(roomId, interval)
  console.log(`Started auto number calling for room ${roomId}`)
}

// Function to stop auto number calling for a room
function stopAutoNumberCalling(roomId: string) {
  const interval = gameIntervals.get(roomId)
  if (interval) {
    clearInterval(interval)
    gameIntervals.delete(roomId)
    console.log(`Stopped auto number calling for room ${roomId}`)
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get("roomId")

    if (!roomId) {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 })
    }

    const gameState: GameState = gameStates.get(roomId) || {
      roomId,
      calledNumbers: [],
      currentNumber: null,
      gameStatus: "waiting",
      winners: [],
      lastUpdate: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      gameState,
    })
  } catch (error) {
    console.error("Error fetching game state:", error)
    return NextResponse.json({ error: "Failed to fetch game state" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { roomId, action, data }: GameStateRequest = await request.json()

    if (!roomId) {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 })
    }

    let gameState: GameState = gameStates.get(roomId) || {
      roomId,
      calledNumbers: [],
      currentNumber: null,
      gameStatus: "waiting",
      winners: [],
      lastUpdate: new Date().toISOString(),
    }

    switch (action) {
      case "start-game":
        if (gameState.gameStatus === "waiting") {
          gameState.gameStatus = "active"
          gameState.gameStartTime = new Date().toISOString()
          gameState.lastUpdate = new Date().toISOString()

          // Start auto number calling
          startAutoNumberCalling(roomId)

          console.log(`Game started for room ${roomId}`)
        }
        break

      case "call-number":
        // Manual number calling (if needed)
        const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1).filter(
          (num) => !gameState.calledNumbers.includes(num),
        )

        if (availableNumbers.length > 0) {
          const newNumber = availableNumbers[Math.floor(Math.random() * availableNumbers.length)]
          gameState.currentNumber = newNumber
          gameState.calledNumbers.push(newNumber)
          gameState.lastUpdate = new Date().toISOString()
        }
        break

      case "claim-bingo":
        if (data?.playerId && data?.playerName && data?.winningPattern) {
          const winner: Winner = {
            playerId: data.playerId,
            playerName: data.playerName,
            winningPattern: data.winningPattern,
            timestamp: new Date().toISOString(),
          }

          gameState.winners.push(winner)

          if (gameState.winners.length === 1) {
            gameState.gameStatus = "finished"
            // Stop auto number calling when game finishes
            stopAutoNumberCalling(roomId)
          }
        }
        break

      case "reset-game":
        // Stop auto calling for old game
        stopAutoNumberCalling(roomId)

        gameState = {
          roomId,
          calledNumbers: [],
          currentNumber: null,
          gameStatus: "waiting",
          winners: [],
          lastUpdate: new Date().toISOString(),
        }
        break
    }

    gameStates.set(roomId, gameState)

    return NextResponse.json({
      success: true,
      gameState,
    })
  } catch (error) {
    console.error("Error updating game state:", error)
    return NextResponse.json({ error: "Failed to update game state" }, { status: 500 })
  }
}
