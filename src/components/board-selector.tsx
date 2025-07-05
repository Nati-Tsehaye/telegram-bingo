"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Shuffle } from "lucide-react"
import { bingoBoards, getBoardById, getRandomBoard, type BingoBoard } from "@/data/bingo-boards"

interface BoardSelectorProps {
  onSelectBoard: (board: BingoBoard) => void
  onBack: () => void
}

export default function BoardSelector({ onSelectBoard, onBack }: BoardSelectorProps) {
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null)
  const [previewBoard, setPreviewBoard] = useState<BingoBoard | null>(null)

  const handleBoardClick = (boardId: number) => {
    setSelectedBoardId(boardId)
    const board = getBoardById(boardId)
    if (board) {
      setPreviewBoard(board)
    }
  }

  const handleSelectBoard = () => {
    if (previewBoard) {
      onSelectBoard(previewBoard)
    }
  }

  const handleRandomBoard = () => {
    const randomBoard = getRandomBoard()
    setSelectedBoardId(randomBoard.id)
    setPreviewBoard(randomBoard)
  }

  const bingoLetters = ["B", "I", "N", "G", "O"]
  const letterColors = ["bg-yellow-500", "bg-green-500", "bg-blue-500", "bg-orange-500", "bg-purple-500"]

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-400 via-purple-500 to-purple-600 p-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button onClick={onBack} variant="ghost" size="icon" className="text-white hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-white text-2xl font-bold">Select Your Bingo Board</h1>
          <p className="text-white/80">Choose from {bingoBoards.length} available boards</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Board Grid */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white text-lg font-semibold">Available Boards</h2>
            <Button onClick={handleRandomBoard} className="bg-orange-500 hover:bg-orange-600 text-white">
              <Shuffle className="h-4 w-4 mr-2" />
              Random Board
            </Button>
          </div>

          {/* Board Numbers Grid */}
          <div className="grid grid-cols-10 gap-2 max-h-96 overflow-y-auto bg-white/10 p-4 rounded-lg">
            {Array.from({ length: 100 }, (_, i) => i + 1).map((boardNum) => {
              const isAvailable = bingoBoards.some((board) => board.id === boardNum)
              const isSelected = selectedBoardId === boardNum

              return (
                <button
                  key={boardNum}
                  onClick={() => isAvailable && handleBoardClick(boardNum)}
                  disabled={!isAvailable}
                  className={`
                    aspect-square flex items-center justify-center rounded-lg text-white font-bold text-sm
                    ${
                      isSelected
                        ? "bg-green-500 shadow-lg transform scale-105"
                        : isAvailable
                          ? "bg-white/20 backdrop-blur-sm border border-white/30 hover:bg-white/30"
                          : "bg-gray-500/50 cursor-not-allowed opacity-50"
                    }
                    transition-all duration-300
                  `}
                >
                  {boardNum}
                </button>
              )
            })}
          </div>
        </div>

        {/* Board Preview */}
        <div className="w-80">
          <Card className="bg-white/10 border-white/20">
            <CardHeader>
              <CardTitle className="text-white text-center">
                {previewBoard ? `Board #${previewBoard.id}` : "Select a Board"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {previewBoard ? (
                <div className="space-y-4">
                  {/* BINGO Letters */}
                  <div className="flex gap-1 justify-center">
                    {bingoLetters.map((letter, index) => (
                      <div
                        key={letter}
                        className={`${letterColors[index]} text-white font-bold text-sm w-8 h-8 rounded flex items-center justify-center`}
                      >
                        {letter}
                      </div>
                    ))}
                  </div>

                  {/* Board Preview */}
                  <div className="bg-amber-100 rounded-lg p-3">
                    <div className="grid grid-cols-5 gap-1">
                      {previewBoard.numbers.map((row, rowIndex) =>
                        row.map((number, colIndex) => {
                          const isFree = number === 0
                          return (
                            <div
                              key={`${rowIndex}-${colIndex}`}
                              className={`
                                w-8 h-8 flex items-center justify-center text-xs font-bold rounded
                                ${isFree ? "bg-green-500 text-white" : "bg-amber-700 text-white"}
                              `}
                            >
                              {isFree ? "★" : number}
                            </div>
                          )
                        }),
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={handleSelectBoard}
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold"
                  >
                    Select This Board
                  </Button>
                </div>
              ) : (
                <div className="text-center text-white/70 py-8">
                  <p>Click on a board number to preview it</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-white text-sm">Selected Board</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-white/20 border border-white/30 rounded"></div>
              <span className="text-white text-sm">Available Board</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-500/50 rounded"></div>
              <span className="text-white text-sm">Coming Soon</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
