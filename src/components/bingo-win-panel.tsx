"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles } from "lucide-react"
import type { BingoBoard } from "@/data/bingo-boards"

interface BingoWinPanelProps {
  prizeAmount: number
  selectedBoard: BingoBoard
  markedCells: boolean[][]
  onPlayAgain: () => void
  isWinner: boolean // New prop to distinguish winner from others
  winnerName?: string // New prop for winner's name (for other players)
}

export default function BingoWinPanel({
  prizeAmount,
  selectedBoard,
  markedCells,
  onPlayAgain,
  isWinner,
  winnerName,
}: BingoWinPanelProps) {
  const bingoLetters = ["B", "I", "N", "G", "O"]
  const letterColors = ["bg-yellow-500", "bg-green-500", "bg-blue-500", "bg-orange-500", "bg-purple-500"]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md bg-blue-700 text-white border-blue-500 shadow-lg">
        <CardHeader className="text-center pb-4">
          <CardTitle className="flex items-center justify-center gap-2 text-3xl font-bold text-yellow-300">
            <Sparkles className="h-8 w-8 animate-bounce" />
            {isWinner ? "You Win!" : `${winnerName || "Someone"} Won!`} {/* Dynamic title */}
            <Sparkles className="h-8 w-8 animate-bounce" />
          </CardTitle>
          <div className="text-xl font-semibold mt-2">Amount: {prizeAmount} Birr</div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* BINGO Letters */}
          <div className="flex gap-1 justify-center">
            {bingoLetters.map((letter, index) => (
              <div
                key={letter}
                className={`${letterColors[index]} text-white font-bold text-lg w-8 h-8 rounded flex items-center justify-center`}
              >
                {letter}
              </div>
            ))}
          </div>

          {/* Winning Bingo Card Preview */}
          <div className="bg-amber-100 rounded-lg p-3">
            <div className="grid grid-cols-5 gap-1">
              {selectedBoard.numbers.map((row, rowIndex) =>
                row.map((number, colIndex) => {
                  const isMarked = markedCells[rowIndex][colIndex]
                  const isFree = number === 0
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`
                        w-10 h-10 flex items-center justify-center text-sm font-bold rounded
                        ${isMarked && !isFree ? "bg-green-500 text-white" : ""}
                        ${isFree ? "bg-yellow-500 text-white" : ""}
                        ${!isMarked && !isFree ? "bg-amber-700 text-white" : ""}
                      `}
                    >
                      {isFree ? "★" : number}
                    </div>
                  )
                }),
              )}
            </div>
            <div className="text-center text-red-600 font-bold text-sm mt-2">Board No.{selectedBoard.id}</div>
          </div>

          <Button
            onClick={onPlayAgain}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold text-lg py-3"
          >
            Play Again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
