import { NextResponse } from "next/server"
import { GameStateManager, RateLimiter } from "@/lib/upstash-client"
import { RealtimeManager } from "@/lib/realtime-manager"
import type { GameStateRequest, Winner } from "@/types/game"

// Centralized number calling - only one instance per room
const activeCallers = new Map<string, NodeJS.Timeout>()

function startCentralizedNumberCalling(roomId: string) {
  // Clear any existing caller for this room
  if (activeCallers.has(roomId)) {
    clearInterval(activeCallers.get(roomId)!)
    activeCallers.delete(roomId)
  }

  console.log(`🎯 Starting centralized number calling for room: ${roomId}`)

  const callNumber = async () => {
    try {
      const gameState = await GameStateManager.getGameState(roomId)
      if (!gameState || gameState.gameStatus !== "active") {
        console.log(`⏹️ Stopping number calling for room ${roomId} - game not active`)
        if (activeCallers.has(roomId)) {
          clearInterval(activeCallers.get(roomId)!)
          activeCallers.delete(roomId)
        }
        return
      }

      // Check if all numbers have been called
      const calledCount = gameState.calledNumbers?.length || 0
      if (calledCount >= 75) {
        console.log(`🏁 All numbers called for room ${roomId}`)
        gameState.gameStatus = "finished"
        await GameStateManager.setGameState(roomId, gameState)

        // 🚀 BROADCAST GAME FINISHED TO ALL PLAYERS
        RealtimeManager.broadcast(roomId, {
          type: "game_finished",
          data: gameState,
        })

        // Stop calling
        if (activeCallers.has(roomId)) {
          clearInterval(activeCallers.get(roomId)!)
          activeCallers.delete(roomId)
        }
        return
      }

      // Call next number
      const newNumber = await GameStateManager.callNextNumber(roomId)
      if (newNumber) {
        console.log(`📢 Centrally called number ${newNumber} for room ${roomId}`)

        // Get updated game state
        const updatedGameState = await GameStateManager.getGameState(roomId)

        // 🚀 BROADCAST NEW NUMBER TO ALL PLAYERS IN REAL-TIME
        RealtimeManager.broadcast(roomId, {
          type: "number_called",
          data: {
            newNumber,
            gameState: updatedGameState,
            timestamp: new Date().toISOString(),
          },
        })
      }
    } catch (error) {
      console.error(`Error in centralized number calling for room ${roomId}:`, error)
    }
  }

  // Call first number after 3 seconds, then every 5 seconds
  setTimeout(callNumber, 3000)
  const interval = setInterval(callNumber, 5000)
  activeCallers.set(roomId, interval)
}

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

          // 🚀 BROADCAST GAME START TO ALL PLAYERS
          RealtimeManager.broadcast(roomId, {
            type: "game_started",
            data: gameState,
          })

          // Start centralized number calling for this room
          startCentralizedNumberCalling(roomId)

          console.log(`🎮 Game started for room ${roomId}, status: ${gameState.gameStatus}`)
        } else {
          console.log(`⚠️ Game already started for room ${roomId}, current status: ${gameState.gameStatus}`)
        }
        break

      case "call-number":
        const newNumber = await GameStateManager.callNextNumber(roomId)
        if (newNumber) {
          gameState = await GameStateManager.getGameState(roomId) // Get updated state

          // 🚀 BROADCAST NEW NUMBER TO ALL PLAYERS
          RealtimeManager.broadcast(roomId, {
            type: "number_called",
            data: {
              newNumber,
              gameState,
              timestamp: new Date().toISOString(),
            },
          })
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

            // Stop number calling
            if (activeCallers.has(roomId)) {
              clearInterval(activeCallers.get(roomId)!)
              activeCallers.delete(roomId)
            }
          }

          gameState.lastUpdate = new Date().toISOString()
          await GameStateManager.setGameState(roomId, gameState)

          // 🚀 BROADCAST BINGO WIN TO ALL PLAYERS
          RealtimeManager.broadcast(roomId, {
            type: "bingo_claimed",
            data: {
              winner,
              gameState,
              timestamp: new Date().toISOString(),
            },
          })
        }
        break

      case "reset-game":
        // Stop any active number calling
        if (activeCallers.has(roomId)) {
          clearInterval(activeCallers.get(roomId)!)
          activeCallers.delete(roomId)
        }

        gameState = {
          roomId,
          calledNumbers: [],
          currentNumber: null,
          gameStatus: "waiting",
          winners: [],
          lastUpdate: new Date().toISOString(),
        }
        await GameStateManager.setGameState(roomId, gameState)

        // 🚀 BROADCAST GAME RESET TO ALL PLAYERS
        RealtimeManager.broadcast(roomId, {
          type: "game_reset",
          data: gameState,
        })
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
