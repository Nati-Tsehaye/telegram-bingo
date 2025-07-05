"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Volume2, VolumeX } from "lucide-react"
import type { BingoBoard } from "@/data/bingo-boards"

interface GameRoom {
  id: number
  stake: number
  players: number
  prize: number
  status: "waiting" | "active"
  activeGames?: number
  hasBonus: boolean
}

interface BingoGameProps {
  room: GameRoom
  selectedBoard: BingoBoard
  onBack: () => void
}

export default function BingoGame({ room, selectedBoard, onBack }: BingoGameProps) {
  const [isMuted, setIsMuted] = useState(false)
  const currentCall = "G-52"
  const recentCalls = ["G-52", "I-25", "N-42", "G-57"]
  // const [calledNumbers, setCalledNumbers] = useState<number[]>([16, 25, 42, 52])
  const [markedCells, setMarkedCells] = useState<boolean[][]>([
    [false, false, false, false, false],
    [false, false, false, false, false],
    [false, false, true, false, false], // FREE space marked
    [false, false, false, false, false],
    [false, false, false, false, false],
  ])

  const bingoLetters = ["B", "I", "N", "G", "O"]
  const letterColors = ["bg-yellow-500", "bg-green-500", "bg-blue-500", "bg-orange-500", "bg-purple-500"]

  // Generate 15x5 calling board (1-75)
  const generateCallingBoard = () => {
    const board = []
    for (let row = 0; row < 15; row++) {
      const rowNumbers = []
      for (let col = 0; col < 5; col++) {
        const number = row + 1 + col * 15
        rowNumbers.push(number)
      }
      board.push(rowNumbers)
    }
    return board
  }

  const callingBoard = generateCallingBoard()

  const toggleCellMark = (row: number, col: number) => {
    const newMarked = [...markedCells]
    newMarked[row][col] = !newMarked[row][col]
    setMarkedCells(newMarked)
  }

  return (
    <div className="min-h-screen bg-blue-800 overflow-x-auto">
      {/* Header Stats */}
      <div className="bg-amber-600 p-2 min-w-full">
        <div className="flex justify-between items-center text-white text-xs font-medium px-2">
          <div className="text-center">
            <div>Game ID</div>
            <div className="font-bold">5c481</div>
          </div>
          <div className="text-center">
            <div>Derash</div>
            <div className="font-bold">448</div>
          </div>
          <div className="text-center">
            <div>Players</div>
            <div className="font-bold">{room.players}</div>
          </div>
          <div className="text-center">
            <div>Bet</div>
            <div className="font-bold">{room.stake}</div>
          </div>
          <div className="text-center">
            <div>Call</div>
            <div className="font-bold">5</div>
          </div>
        </div>
      </div>

      {/* Main Game Area - Fixed Side by Side Layout */}
      <div className="flex min-w-full">
        {/* Left Side - Calling Board */}
        <div className="w-1/2 bg-orange-500 p-2">
          {/* BINGO Header */}
          <div className="flex justify-center gap-1 mb-2">
            {bingoLetters.map((letter) => (
              <div
                key={letter}
                className="bg-orange-600 text-white font-bold text-lg w-8 h-8 rounded flex items-center justify-center"
              >
                {letter}
              </div>
            ))}
          </div>

          {/* Numbers Grid 15x5 */}
          <div className="space-y-1">
            {callingBoard.map((row, rowIndex) => (
              <div key={rowIndex} className="flex gap-1">
                {row.map((number) => {
                  return (
                    <div
                      key={number}
                      className="w-8 h-6 flex items-center justify-center text-xs font-bold rounded bg-amber-700 text-white"
                    >
                      {number}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Right Side - Game Interface */}
        <div className="w-1/2 bg-blue-800 p-2 space-y-3">
          {/* Playing Status and Mute */}
          <div className="flex items-center justify-between">
            <Badge className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1 text-sm font-bold">playing</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMuted(!isMuted)}
              className="text-white hover:bg-white/10 bg-orange-500 px-2 py-1"
            >
              {isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
              <span className="ml-1 text-xs">Mute</span>
            </Button>
          </div>

          {/* Current Call */}
          <div className="text-center">
            <div className="text-white text-sm mb-1">Current Call</div>
            <div className="bg-orange-500 text-white text-2xl font-bold rounded-full w-16 h-16 flex items-center justify-center mx-auto">
              {currentCall}
            </div>
          </div>

          {/* Recent Calls */}
          <div className="flex gap-1 justify-center">
            {recentCalls.map((call, index) => (
              <div key={index} className="bg-amber-700 text-white px-2 py-1 rounded-full text-xs font-medium">
                {call}
              </div>
            ))}
          </div>

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

          {/* Player Bingo Card - Using Selected Board */}
          <div className="bg-amber-100 rounded-lg p-2">
            <div className="grid grid-cols-5 gap-1 mb-2">
              {selectedBoard.numbers.map((row, rowIndex) =>
                row.map((number, colIndex) => {
                  const isMarked = markedCells[rowIndex][colIndex]
                  const isFree = number === 0
                  return (
                    <button
                      key={`${rowIndex}-${colIndex}`}
                      onClick={() => toggleCellMark(rowIndex, colIndex)}
                      className={`
                        w-8 h-8 flex items-center justify-center text-xs font-bold rounded
                        ${isMarked && !isFree ? "bg-green-500 text-white" : "bg-amber-700 text-white"}
                        ${isFree ? "bg-green-500 text-white" : ""}
                        hover:opacity-80 transition-opacity
                      `}
                    >
                      {isFree ? "★" : number}
                    </button>
                  )
                }),
              )}
            </div>
            <div className="text-center text-red-600 font-bold text-sm">Board No.{selectedBoard.id}</div>
          </div>
        </div>
      </div>

      {/* BINGO Banner */}
      <div className="bg-red-500 text-white text-center py-3">
        <div className="text-2xl font-bold">BINGO!</div>
      </div>

      {/* Bottom Buttons */}
      <div className="flex justify-center gap-6 py-4">
        <Button className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-8 py-3 rounded-full text-base">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button
          onClick={onBack}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-3 rounded-full text-base"
        >
          Leave
        </Button>
      </div>
    </div>
  )
}
