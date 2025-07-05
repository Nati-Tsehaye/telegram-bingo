import { NextResponse } from "next/server"
import type { GameState, GameStateRequest, Winner } from "@/types/game"

// This would be replaced with Redis or Database in production
const gameStates = new Map<string, GameState>()

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
      case "call-number":
        // Generate next bingo number
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
          }
        }
        break

      case "start-game":
        gameState.gameStatus = "active"
        gameState.gameStartTime = new Date().toISOString()
        break

      case "reset-game":
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
