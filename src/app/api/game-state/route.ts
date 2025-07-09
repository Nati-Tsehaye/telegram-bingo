import { NextResponse } from "next/server"
import { GameStateManager, RateLimiter } from "@/lib/upstash-client"
import type { GameStateRequest, Winner } from "@/types/game"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get("roomId")
    const clientIp = request.headers.get("x-forwarded-for") || "unknown"

    if (!roomId) {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 })
    }

    // Rate limiting
    const canProceed = await RateLimiter.checkLimit(`gamestate:${clientIp}`, 60, 60)
    if (!canProceed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    let gameState = await GameStateManager.getGameState(roomId)

    if (!gameState) {
      gameState = {
        roomId,
        calledNumbers: [],
        currentNumber: null,
        gameStatus: "waiting",
        winners: [],
        lastUpdate: new Date().toISOString(),
      }
      await GameStateManager.setGameState(roomId, gameState)
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
    const clientIp = request.headers.get("x-forwarded-for") || "unknown"

    if (!roomId) {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 })
    }

    // Rate limiting
    const canProceed = await RateLimiter.checkLimit(`gameaction:${clientIp}`, 30, 60)
    if (!canProceed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    let gameState = await GameStateManager.getGameState(roomId)

    if (!gameState) {
      gameState = {
        roomId,
        calledNumbers: [],
        currentNumber: null,
        gameStatus: "waiting",
        winners: [],
        lastUpdate: new Date().toISOString(),
      }
    }

    switch (action) {
      case "start-game":
        if (gameState.gameStatus === "waiting") {
          gameState.gameStatus = "active"
          gameState.gameStartTime = new Date().toISOString()
          gameState.lastUpdate = new Date().toISOString()

          // Initialize empty arrays if they don't exist
          if (!gameState.calledNumbers) {
            gameState.calledNumbers = []
          }
          if (!gameState.winners) {
            gameState.winners = []
          }

          await GameStateManager.setGameState(roomId, gameState)
          await GameStateManager.scheduleNumberCalling(roomId)

          console.log(`🎮 Game started for room ${roomId}, status: ${gameState.gameStatus}`)
        } else {
          console.log(`⚠️ Game already started for room ${roomId}, current status: ${gameState.gameStatus}`)
        }
        break

      case "call-number":
        const newNumber = await GameStateManager.callNextNumber(roomId)
        if (newNumber) {
          gameState = await GameStateManager.getGameState(roomId) // Get updated state
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

          gameState.lastUpdate = new Date().toISOString()
          await GameStateManager.setGameState(roomId, gameState)
        }
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
        await GameStateManager.setGameState(roomId, gameState)
        break
    }

    return NextResponse.json({
      success: true,
      gameState,
    })
  } catch (error) {
    console.error("Error updating game state:", error)
    return NextResponse.json({ error: "Failed to update game state" }, { status: 500 })
  }
}
