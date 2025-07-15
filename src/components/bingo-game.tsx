"use client"

import { useState, useEffect, useCallback } from "react" // Import useCallback
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Volume2, VolumeX, Sparkles } from "lucide-react" // Import Sparkles for win animation
import type { BingoBoard } from "@/data/bingo-boards"
import { useWebSocket } from "@/hooks/use-websocket" // Import useWebSocket
import type { GameRoomClient } from "@/hooks/use-websocket"
import { useToast } from "@/hooks/use-toast" // Import useToast
import BingoWinPanel from "./bingo-win-panel" // Import the new component

interface BingoGameProps {
  room: GameRoomClient
  selectedBoard: BingoBoard
  onBack: () => void
  currentCalledNumber?: number | null
  allCalledNumbers?: number[]
}

export default function BingoGame({
  room,
  selectedBoard,
  onBack,
  currentCalledNumber = null,
  allCalledNumbers = [],
}: BingoGameProps) {
  const { playerId, winnerInfo, claimBingo } = useWebSocket(process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001") // Get playerId and winnerInfo from hook
  const [isMuted, setIsMuted] = useState(false)
  const [remainingTime, setRemainingTime] = useState<number>(40)
  const [gameStartedInternally, setGameStartedInternally] = useState(false)
  const [markedCells, setMarkedCells] = useState<boolean[][]>([
    [false, false, false, false, false],
    [false, false, false, false, false],
    [false, false, true, false, false], // FREE space marked
    [false, false, false, false, false],
    [false, false, false, false, false],
  ])
  const [bingoDetected, setBingoDetected] = useState(false) // New state: BINGO can be claimed
  const [hasWonLocally, setHasWonLocally] = useState(false) // Renamed to avoid conflict with global winnerInfo
  const { toast } = useToast() // Initialize toast

  const bingoLetters = ["B", "I", "N", "G", "O"]
  const letterColors = ["bg-yellow-500", "bg-green-500", "bg-blue-500", "bg-orange-500", "bg-purple-500"]

  // useCallback for checkForWin to prevent re-creation on every render
  const checkForWin = useCallback(
    (currentMarkedCells: boolean[][]) => {
      if (hasWonLocally || bingoDetected || room.status === "game_over") return // Already won or BINGO already detected or game over

      const board = selectedBoard.numbers // Get the actual numbers board

      // Helper to check if a line is marked AND contains called numbers
      const isLineMarkedAndCalled = (line: { row: number; col: number }[]) => {
        return line.every(({ row, col }) => {
          const number = board[row][col]
          const isFreeSpace = number === 0
          const isCalled = allCalledNumbers.includes(number) || isFreeSpace // Free space is always "called"
          const isMarked = currentMarkedCells[row][col]
          return isMarked && isCalled
        })
      }

      // Check rows
      for (let r = 0; r < 5; r++) {
        const rowLine = Array.from({ length: 5 }, (_, c) => ({ row: r, col: c }))
        if (isLineMarkedAndCalled(rowLine)) {
          setBingoDetected(true)
          return
        }
      }

      // Check columns
      for (let c = 0; c < 5; c++) {
        const colLine = Array.from({ length: 5 }, (_, r) => ({ row: r, col: c }))
        if (isLineMarkedAndCalled(colLine)) {
          setBingoDetected(true)
          return
        }
      }

      // Check main diagonal (top-left to bottom-right)
      const mainDiagonal = Array.from({ length: 5 }, (_, i) => ({ row: i, col: i }))
      if (isLineMarkedAndCalled(mainDiagonal)) {
        setBingoDetected(true)
        return
      }

      // Check anti-diagonal (top-right to bottom-left)
      const antiDiagonal = Array.from({ length: 5 }, (_, i) => ({ row: i, col: 4 - i }))
      if (isLineMarkedAndCalled(antiDiagonal)) {
        setBingoDetected(true)
        return
      }
    },
    [hasWonLocally, bingoDetected, selectedBoard.numbers, allCalledNumbers, room.status],
  )

  // Effect to check for win whenever markedCells or allCalledNumbers change
  useEffect(() => {
    checkForWin(markedCells)
  }, [markedCells, allCalledNumbers, checkForWin])

  // Countdown effect synchronized with server's startTime
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined

    if (room.status === "starting" && room.startTime !== undefined) {
      const initialCountdownDurationMs = 40 * 1000

      const calculateTime = () => {
        const elapsedTime = Date.now() - room.startTime!
        const calculatedRemaining = Math.max(0, (initialCountdownDurationMs - elapsedTime) / 1000)
        setRemainingTime(calculatedRemaining)

        if (calculatedRemaining <= 0) {
          setGameStartedInternally(true)
          clearInterval(timer)
        }
      }

      calculateTime()
      timer = setInterval(calculateTime, 1000)
    } else if (room.status === "active") {
      setGameStartedInternally(true)
      setRemainingTime(0)
    } else {
      setGameStartedInternally(false)
      setRemainingTime(40)
    }

    return () => {
      if (timer) {
        clearInterval(timer)
      }
    }
  }, [room.status, room.startTime])

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
    if (hasWonLocally || bingoDetected || room.status === "game_over") return // Cannot mark after winning or if BINGO is detected or game over

    const number = selectedBoard.numbers[row][col]

    // Don't allow marking the FREE space
    if (number === 0) return

    // Check if the number has been called before allowing marking
    if (number > 0 && !(allCalledNumbers || []).includes(number)) {
      toast({
        title: "🚫 Invalid Mark",
        description: `Number ${number} has not been called yet!`,
        variant: "destructive",
      })
      return
    }

    const newMarked = markedCells.map((r) => [...r]) // Deep copy
    newMarked[row][col] = !newMarked[row][col]
    setMarkedCells(newMarked)
  }

  const handleClaimBingo = () => {
    if (bingoDetected && !hasWonLocally && room.status !== "game_over") {
      setHasWonLocally(true) // Set local state for the winner
      claimBingo(room.id, selectedBoard.numbers, markedCells) // Pass board numbers and marked cells
    }
  }

  const handlePlayAgain = () => {
    // Reset local game state
    setMarkedCells([
      [false, false, false, false, false],
      [false, false, false, false, false],
      [false, false, true, false, false], // FREE space marked
      [false, false, false, false, false],
      [false, false, false, false, false],
    ])
    setHasWonLocally(false)
    setBingoDetected(false)
    // The server will reset the room and broadcast, which will update the client's room state.
    // For now, just go back to lobby.
    onBack()
  }

  // Helper function to get the BINGO letter for a number
  const getBingoLetter = (number: number): string => {
    if (number >= 1 && number <= 15) return "B"
    if (number >= 16 && number <= 30) return "I"
    if (number >= 31 && number <= 45) return "N"
    if (number >= 46 && number <= 60) return "G"
    if (number >= 61 && number <= 75) return "O"
    return ""
  }

  // Determine if the win panel should be shown
  const showWinPanel = room.status === "game_over" && winnerInfo !== null

  return (
    <div className="min-h-screen bg-blue-800 overflow-x-auto">
      {/* Header Stats */}
      <div className="bg-amber-600 p-2 min-w-full">
        <div className="flex justify-between items-center text-white text-xs font-medium px-2">
          <div className="text-center">
            <div>Game ID</div>
            <div className="font-bold">{room.id}</div>
          </div>
          <div className="text-center">
            <div>Derash</div>
            <div className="font-bold">{room.prize}</div>
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
            <div className="font-bold">{allCalledNumbers?.length || 0}</div>
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
                  const isCurrent = currentCalledNumber === number
                  const isPreviouslyCalled = (allCalledNumbers || []).includes(number) && !isCurrent

                  return (
                    <div
                      key={number}
                      className={`w-8 h-6 flex items-center justify-center text-xs font-bold rounded transition-colors ${
                        isCurrent
                          ? "bg-red-500 text-white animate-pulse" // Current number - red and pulsing
                          : isPreviouslyCalled
                            ? "bg-green-500 text-white" // Previously called numbers - green
                            : "bg-amber-700 text-white" // Uncalled numbers - default
                      }`}
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
            {gameStartedInternally ? (
              <Badge className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1 text-sm font-bold">
                playing
              </Badge>
            ) : (
              <Badge className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1 text-sm font-bold">
                Starting in {Math.ceil(remainingTime)}
              </Badge>
            )}
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
            <div className="bg-red-500 text-white text-xl font-bold rounded-full w-16 h-16 flex items-center justify-center mx-auto animate-pulse">
              {currentCalledNumber ? `${getBingoLetter(currentCalledNumber)}-${currentCalledNumber}` : "--"}
            </div>
          </div>

          {/* Recent Calls */}
          <div className="flex gap-1 justify-center flex-wrap">
            {(allCalledNumbers || [])
              .slice(-5)
              .reverse()
              .map((number, index) => (
                <div
                  key={`${number}-${index}`}
                  className="bg-green-600 text-white px-2 py-1 rounded-full text-xs font-medium"
                >
                  {getBingoLetter(number)}-{number}
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
          <div className={`bg-amber-100 rounded-lg p-2 ${hasWonLocally ? "ring-4 ring-yellow-400" : ""}`}>
            <div className="grid grid-cols-5 gap-1 mb-2">
              {selectedBoard.numbers.map((row, rowIndex) =>
                row.map((number, colIndex) => {
                  const isMarked = markedCells[rowIndex][colIndex]
                  const isFree = number === 0

                  return (
                    <button
                      key={`${rowIndex}-${colIndex}`}
                      onClick={() => toggleCellMark(rowIndex, colIndex)}
                      disabled={hasWonLocally || bingoDetected || room.status === "game_over" || isFree} // Disable marking if won, BINGO detected, game over, or free space
                      className={`
                    w-8 h-8 flex items-center justify-center text-xs font-bold rounded transition-all
                    ${isMarked && !isFree ? "bg-green-500 text-white" : ""}
                    ${isFree ? "bg-yellow-500 text-white" : ""}
                    ${!isMarked && !isFree ? "bg-amber-700 text-white" : ""}
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

      {/* BINGO Banner and Claim Button */}
      <div className="bg-red-500 text-white text-center py-3">
        <div className="text-2xl font-bold">
          {hasWonLocally ? (
            <span className="flex items-center justify-center gap-2 text-yellow-300">
              <Sparkles className="h-6 w-6 animate-spin" />
              BINGO!
              <Sparkles className="h-6 w-6 animate-spin" />
            </span>
          ) : (
            "BINGO!"
          )}
        </div>
        {bingoDetected && !hasWonLocally && room.status !== "game_over" && (
          <Button
            onClick={handleClaimBingo}
            className="mt-2 bg-yellow-400 hover:bg-yellow-500 text-red-800 font-bold px-6 py-2 rounded-full text-lg shadow-lg animate-pulse"
          >
            Claim BINGO!
          </Button>
        )}
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

      {/* Winning Panel Overlay */}
      {showWinPanel && winnerInfo && (
        <BingoWinPanel
          prizeAmount={winnerInfo.prize}
          selectedBoard={selectedBoard} // Pass the local player's board for display
          markedCells={markedCells} // Pass the local player's marked cells for display
          onPlayAgain={handlePlayAgain}
          isWinner={winnerInfo.playerId === playerId} // Check if current player is the winner
          winnerName={winnerInfo.playerName}
        />
      )}
    </div>
  )
}
