"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import BingoGame from "./bingo-game"
import { getBoardById, type BingoBoard } from "@/data/bingo-boards"
import type { GameRoom } from "@/types/game"

interface GameScreenProps {
  room: GameRoom
  onBack: () => void
}

export default function GameScreen({ room, onBack }: GameScreenProps) {
  const [selectedBoardNumber, setSelectedBoardNumber] = useState<number | null>(null) // Green number from image
  const [selectedBoard, setSelectedBoard] = useState<BingoBoard | null>(null)
  const [gameStatus, setGameStatus] = useState<"waiting" | "active" | "starting">("waiting")
  const [activeGames, setActiveGames] = useState(room.activeGames || 0)
  const [showBingoGame, setShowBingoGame] = useState(false)

  // Generate numbers 1-100 in a 10x10 grid
  const numbers = Array.from({ length: 100 }, (_, i) => i + 1)

  const handleRefresh = () => {
    console.log("Refreshing game...")
  }

  const handleNumberClick = (number: number) => {
    // If clicking the same number, deselect it
    if (selectedBoardNumber === number) {
      setSelectedBoardNumber(null)
      setSelectedBoard(null)
      return
    }

    // Select new board number
    setSelectedBoardNumber(number)
    const board = getBoardById(number)
    setSelectedBoard(board || null) // Fix: Handle undefined case
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

      {/* Numbers Grid */}
      <div className="max-w-2xl mx-auto mb-6">
        <div className="grid grid-cols-10 gap-2">
          {numbers.map((number) => {
            const isSelected = selectedBoardNumber === number
            return (
              <button
                key={number}
                onClick={() => handleNumberClick(number)}
                className={`
                  aspect-square flex items-center justify-center rounded-lg text-white font-bold text-sm
                  ${
                    isSelected
                      ? "bg-green-500 shadow-lg transform scale-105"
                      : "bg-white/20 backdrop-blur-sm border border-white/30 hover:bg-white/30"
                  }
                  transition-all duration-300
                `}
              >
                {number}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected Board Preview - Made Much Smaller */}
      {selectedBoard && (
        <div className="flex justify-center mb-6">
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
      )}

      {/* Action Buttons */}
      <div className="flex justify-center gap-6 mb-8">
        <Button
          onClick={handleRefresh}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-8 py-4 rounded-full text-lg shadow-lg"
        >
          <RefreshCw className="h-5 w-5 mr-2" />
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
