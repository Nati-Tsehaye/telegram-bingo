import { NextResponse } from "next/server"

// This would be replaced with Redis or Database in production
const gameStates = new Map<string, any>()

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get("roomId")

    if (!roomId) {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 })
    }

    const gameState = gameStates.get(roomId) || {
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
    const { roomId, action, data } = await request.json()

    if (!roomId) {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 })
    }

    let gameState = gameStates.get(roomId) || {
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
        const { playerId, playerName, winningPattern } = data
        gameState.winners.push({
          playerId,
          playerName,
          winningPattern,
          timestamp: new Date().toISOString(),
        })

        if (gameState.winners.length === 1) {
          gameState.gameStatus = "finished"
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
