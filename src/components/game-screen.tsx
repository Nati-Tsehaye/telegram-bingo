"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, Users } from "lucide-react"
import BingoGame from "./bingo-game"
import { getBoardById, type BingoBoard } from "@/data/bingo-boards"
import { useTelegram } from "@/components/telegram-provider"
import type { GameRoom } from "@/types/game"

interface BoardSelection {
  roomId: string
  playerId: string
  playerName: string
  boardNumber: number
  timestamp: string
}

interface GameScreenProps {
  room: GameRoom
  onBack: () => void
}

export default function GameScreen({ room, onBack }: GameScreenProps) {
  const { user } = useTelegram()
  const [selectedBoardNumber, setSelectedBoardNumber] = useState<number | null>(null)
  const [selectedBoard, setSelectedBoard] = useState<BingoBoard | null>(null)
  const [gameStatus, setGameStatus] = useState<"waiting" | "active" | "starting">("waiting")
  const [activeGames, setActiveGames] = useState(room.activeGames || 0)
  const [showBingoGame, setShowBingoGame] = useState(false)
  const [boardSelections, setBoardSelections] = useState<BoardSelection[]>([])
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const playerId = user?.id?.toString() || `guest-${Date.now()}`
  const playerName = user?.first_name || "Guest Player"

  // Generate numbers 1-100 in a 10x10 grid
  const numbers = Array.from({ length: 100 }, (_, i) => i + 1)

  // Fetch current board selections
  const fetchBoardSelections = useCallback(async () => {
    try {
      const response = await fetch(`/api/board-selections?roomId=${room.id}`)
      const data = await response.json()

      if (data.success) {
        setBoardSelections(data.selections)
        setSelectedNumbers(data.selectedNumbers)
      }
    } catch (error) {
      console.error("Failed to fetch board selections:", error)
    }
  }, [room.id])

  // Load selections on mount and refresh every 3 seconds
  useEffect(() => {
    fetchBoardSelections()
    const interval = setInterval(fetchBoardSelections, 3000)
    return () => clearInterval(interval)
  }, [fetchBoardSelections])

  const handleRefresh = () => {
    fetchBoardSelections()
  }

  const handleNumberClick = async (number: number) => {
    if (isLoading) return

    // If clicking the same number, deselect it
    if (selectedBoardNumber === number) {
      setIsLoading(true)
      try {
        const response = await fetch("/api/board-selections", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomId: room.id,
            playerId,
            playerName,
            action: "deselect",
          }),
        })

        if (response.ok) {
          setSelectedBoardNumber(null)
          setSelectedBoard(null)
          fetchBoardSelections()
        }
      } catch (error) {
        console.error("Failed to deselect board:", error)
      } finally {
        setIsLoading(false)
      }
      return
    }

    // Check if number is already taken by another player
    const takenByOther = boardSelections.find((s) => s.boardNumber === number && s.playerId !== playerId)
    if (takenByOther) {
      alert(`Board ${number} is already selected by ${takenByOther.playerName}`)
      return
    }

    // Select new board number
    setIsLoading(true)
    try {
      const response = await fetch("/api/board-selections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: room.id,
          playerId,
          playerName,
          boardNumber: number,
          action: "select",
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSelectedBoardNumber(number)
        const board = getBoardById(number)
        setSelectedBoard(board || null)
        fetchBoardSelections()
      } else {
        alert(data.error || "Failed to select board")
      }
    } catch (error) {
      console.error("Failed to select board:", error)
      alert("Failed to select board. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartGame = () => {
    if (!selectedBoard) {
      alert("Please select a board number before starting the game!")
      return
    }

    setGameStatus("starting")
    setActiveGames(1)

    // Show the bingo game after a short delay
    setTimeout(() => {
      setGameStatus("active")
      setShowBingoGame(true)
    }, 1000)
  }

  const getStatusText = () => {
    switch (gameStatus) {
      case "waiting":
        return "waiting"
      case "starting":
        return "starting..."
      case "active":
        return "in progress"
      default:
        return "waiting"
    }
  }

  // Get the selection info for a number
  const getNumberStatus = (number: number) => {
    const selection = boardSelections.find((s) => s.boardNumber === number)
    const isMySelection = selectedBoardNumber === number
    const isTakenByOther = selection && selection.playerId !== playerId

    return {
      isMySelection,
      isTakenByOther,
      takenBy: selection?.playerName,
      isAvailable: !selection,
    }
  }

  // Show the bingo game if started
  if (showBingoGame && selectedBoard) {
    return <BingoGame room={room} selectedBoard={selectedBoard} onBack={onBack} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-400 via-purple-500 to-purple-600 p-4">
      {/* Status Pills */}
      <div className="flex justify-center gap-4 mb-6">
        <div className="bg-white rounded-full px-6 py-3 shadow-lg">
          <span className="text-gray-800 font-medium">Active Game {activeGames}</span>
        </div>
        <div className="bg-white rounded-full px-6 py-3 shadow-lg">
          <span className="text-gray-800 font-medium">Stake {room.stake}</span>
        </div>
        <div className="bg-white rounded-full px-6 py-3 shadow-lg">
          <span className="text-gray-800 font-medium">Start in {getStatusText()}</span>
        </div>
      </div>

      {/* Players Info */}
      <div className="flex justify-center mb-4">
        <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-white" />
          <span className="text-white font-medium">{boardSelections.length} players selected boards</span>
        </div>
      </div>

      {/* Numbers Grid */}
      <div className="max-w-2xl mx-auto mb-6">
        <div className="grid grid-cols-10 gap-2">
          {numbers.map((number) => {
            const status = getNumberStatus(number)

            return (
              <button
                key={number}
                onClick={() => handleNumberClick(number)}
                disabled={isLoading || status.isTakenByOther}
                className={`
                  aspect-square flex items-center justify-center rounded-lg text-white font-bold text-sm
                  ${
                    status.isMySelection
                      ? "bg-green-500 shadow-lg transform scale-105"
                      : status.isTakenByOther
                        ? "bg-red-500 cursor-not-allowed opacity-75"
                        : "bg-white/20 backdrop-blur-sm border border-white/30 hover:bg-white/30"
                  }
                  ${isLoading ? "opacity-50" : ""}
                  transition-all duration-300
                `}
                title={
                  status.isTakenByOther
                    ? `Taken by ${status.takenBy}`
                    : status.isMySelection
                      ? "Your selection (click to deselect)"
                      : "Available"
                }
              >
                {number}
              </button>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-white text-sm">Your Selection</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className="text-white text-sm">Taken by Others</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white/20 border border-white/30 rounded"></div>
          <span className="text-white text-sm">Available</span>
        </div>
      </div>

      {/* Selected Board Preview */}
      {selectedBoard && (
        <div className="flex justify-center mb-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-center text-white font-medium mb-2">Your Board #{selectedBoard.id}</div>
            <div className="grid grid-cols-5 gap-1">
              {selectedBoard.numbers.map((row, rowIndex) =>
                row.map((number, colIndex) => {
                  const isFree = number === 0
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`
                        w-8 h-6 flex items-center justify-center rounded text-white font-medium text-xs
                        ${isFree ? "bg-green-500" : "bg-white/30 backdrop-blur-sm border border-white/40"}
                      `}
                    >
                      {isFree ? "F" : number}
                    </div>
                  )
                }),
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center gap-6 mb-8">
        <Button
          onClick={handleRefresh}
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-8 py-4 rounded-full text-lg shadow-lg"
        >
          <RefreshCw className={`h-5 w-5 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button
          onClick={handleStartGame}
          disabled={gameStatus === "active" || !selectedBoard}
          className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-bold px-8 py-4 rounded-full text-lg shadow-lg"
        >
          {gameStatus === "active" ? "Game Active" : "Start Game"}
        </Button>
      </div>

      {/* Footer */}
      <div className="text-center text-white/80 text-sm">© Arada Bingo 2024</div>

      {/* Back button */}
      <button
        onClick={onBack}
        className="fixed top-4 left-4 text-white/60 hover:text-white"
        style={{ fontSize: "24px" }}
      >
        ←
      </button>
    </div>
  )
}
