"use client"

import { Button } from "@/components/ui/button"
import type { BingoBoard } from "@/data/bingo-boards"

interface Winner {
  playerId: string
  playerName: string
  winningPattern: string
  timestamp: string
}

interface BingoResultScreenProps {
  isWinner: boolean
  currentPlayerName: string
  winner?: Winner
  winnerBoard?: BingoBoard
  winningCells?: boolean[][]
  prizeAmount: number
  onPlayAgain: () => void
  onLeave: () => void
}

export default function BingoResultScreen({
  isWinner,
  currentPlayerName,
  winner,
  winnerBoard,
  winningCells,
  prizeAmount,
  onPlayAgain,
  onLeave,
}: BingoResultScreenProps) {
  const bingoLetters = ["B", "I", "N", "G", "O"]
  const letterColors = ["bg-yellow-500", "bg-green-500", "bg-blue-500", "bg-orange-500", "bg-purple-500"]

  // Get cell style based on winning pattern
  const getCellStyle = (rowIndex: number, colIndex: number, number: number) => {
    const isFree = number === 0
    const isWinningCell = winningCells?.[rowIndex]?.[colIndex] || false

    if (isFree) {
      return "bg-green-500 text-white font-bold" // FREE space always green
    }

    if (isWinningCell) {
      return "bg-green-500 text-white font-bold" // Winning line in green
    }

    return "bg-amber-700 text-white font-bold" // Regular cells
  }

  if (isWinner) {
    // Winner Screen - Simple "You Win" message as overlay
    return (
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50 p-4">
        <div className="bg-blue-600 rounded-lg p-6 max-w-sm mx-auto text-center shadow-2xl border-2 border-blue-400 pointer-events-auto">
          <div className="text-4xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-white mb-2">You Win!</h1>
          <p className="text-lg text-white/90 mb-2">Congratulations {currentPlayerName}!</p>
          <p className="text-xl font-bold text-yellow-400 mb-6">Amount: {prizeAmount} Birr</p>

          <div className="space-y-3">
            <Button
              onClick={onPlayAgain}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 text-lg"
            >
              Play Again
            </Button>
            <Button
              onClick={onLeave}
              variant="outline"
              className="w-full bg-transparent border-white text-white hover:bg-white/10"
            >
              Leave Game
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Loser Screen - Show winner's details and board as overlay
  return (
    <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50 p-4">
      <div className="bg-blue-600 rounded-lg p-6 max-w-sm mx-auto text-center shadow-2xl border-2 border-blue-400 pointer-events-auto">
        {/* Winner announcement */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-white mb-2">{winner?.playerName || "Player"} Won 🎉</h1>
          <p className="text-lg font-semibold text-yellow-400">Amount: {prizeAmount} Birr</p>
        </div>

        {/* BINGO Letters */}
        <div className="flex justify-center gap-1 mb-4">
          {bingoLetters.map((letter, index) => (
            <div
              key={letter}
              className={`${letterColors[index]} text-white font-bold text-lg w-8 h-8 rounded flex items-center justify-center`}
            >
              {letter}
            </div>
          ))}
        </div>

        {/* Winner's Board */}
        {winnerBoard && (
          <div className="bg-amber-100 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-5 gap-1 mb-3">
              {winnerBoard.numbers.map((row, rowIndex) =>
                row.map((number, colIndex) => (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={`w-10 h-10 flex items-center justify-center text-sm rounded ${getCellStyle(rowIndex, colIndex, number)}`}
                  >
                    {number === 0 ? "★" : number}
                  </div>
                )),
              )}
            </div>
            <div className="text-red-600 font-bold text-sm">Board No. {winnerBoard.id}</div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={onPlayAgain}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 text-lg"
          >
            Play Again
          </Button>
          <Button
            onClick={onLeave}
            variant="outline"
            className="w-full bg-transparent border-white text-white hover:bg-white/10"
          >
            Leave Game
          </Button>
        </div>
      </div>
    </div>
  )
}
