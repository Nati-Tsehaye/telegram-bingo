"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Volume2, VolumeX } from "lucide-react"
import type { BingoBoard } from "@/data/bingo-boards"
import type { GameRoom } from "@/types/game"
import { useTelegram } from "@/components/telegram-provider"
import BingoResultScreen from "./bingo-result-screen"
import { useRealtime } from "@/hooks/use-realtime"

interface GameState {
  roomId: string
  calledNumbers: number[]
  currentNumber: number | null
  gameStatus: "waiting" | "active" | "finished"
  winners: Array<{
    playerId: string
    playerName: string
    winningPattern: string
    timestamp: string
  }>
  lastUpdate: string
  gameStartTime?: string
}

interface BingoGameProps {
  room: GameRoom
  selectedBoard: BingoBoard
  onBack: () => void
}

type WinPattern = "horizontal" | "vertical" | "diagonal" | "edges" | "full-house"

export default function BingoGame({ room, selectedBoard, onBack }: BingoGameProps) {
  const { user, webApp } = useTelegram()
  const [isMuted, setIsMuted] = useState(false)
  const [gameState, setGameState] = useState<GameState>({
    roomId: room.id,
    calledNumbers: [],
    currentNumber: null,
    gameStatus: "waiting",
    winners: [],
    lastUpdate: new Date().toISOString(),
  })
  const [recentCalls, setRecentCalls] = useState<number[]>([])
  const [markedCells, setMarkedCells] = useState<boolean[][]>([
    [false, false, false, false, false],
    [false, false, false, false, false],
    [false, false, true, false, false], // FREE space marked
    [false, false, false, false, false],
    [false, false, false, false, false],
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [lastPlayedNumber, setLastPlayedNumber] = useState<number | null>(null)
  const [hasBingo, setHasBingo] = useState(false)
  const [winningCells, setWinningCells] = useState<boolean[][]>([
    [false, false, false, false, false],
    [false, false, false, false, false],
    [false, false, false, false, false],
    [false, false, false, false, false],
    [false, false, false, false, false],
  ])
  const [bingoClaimed, setBingoClaimed] = useState(false)
  const [showResultScreen, setShowResultScreen] = useState(false)

  // Audio ref for playing number sounds
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const bingoLetters = ["B", "I", "N", "G", "O"]
  const letterColors = ["bg-yellow-500", "bg-green-500", "bg-blue-500", "bg-orange-500", "bg-purple-500"]

  const playerId = user?.id?.toString() || `guest-${Date.now()}`
  const playerName = user?.first_name || "Guest Player"

  // Function to play audio for called number
  const playNumberAudio = useCallback(
    (number: number) => {
      if (isMuted) return

      try {
        const audio = new Audio(`/audio/men/${number}.mp3`)
        audio.volume = 0.7
        audio.play().catch((error) => {
          console.warn(`Failed to play audio for number ${number}:`, error)
        })

        audio.addEventListener("ended", () => {
          audio.remove()
        })

        setTimeout(() => {
          if (audio) {
            audio.pause()
            audio.remove()
          }
        }, 5000)
      } catch (error) {
        console.warn(`Error creating audio for number ${number}:`, error)
      }
    },
    [isMuted],
  )

  // Function to play BINGO win sound
  const playBingoSound = useCallback(() => {
    if (isMuted) return

    try {
      const audio = new Audio(`/audio/bingo-win.mp3`)
      audio.volume = 0.8
      audio.play().catch(() => {
        playNumberAudio(75)
      })
    } catch (error) {
      console.warn("Error playing BINGO sound:", error)
    }
  }, [isMuted, playNumberAudio])

  // Check for winning patterns
  const checkForBingo = useCallback(
    (marked: boolean[][]): { hasWin: boolean; pattern: WinPattern | null; cells: boolean[][] } => {
      const winCells: boolean[][] = [
        [false, false, false, false, false],
        [false, false, false, false, false],
        [false, false, false, false, false],
        [false, false, false, false, false],
        [false, false, false, false, false],
      ]

      // Check horizontal lines
      for (let row = 0; row < 5; row++) {
        if (marked[row].every((cell) => cell)) {
          for (let col = 0; col < 5; col++) {
            winCells[row][col] = true
          }
          return { hasWin: true, pattern: "horizontal", cells: winCells }
        }
      }

      // Check vertical lines
      for (let col = 0; col < 5; col++) {
        if (marked.every((row) => row[col])) {
          for (let row = 0; row < 5; row++) {
            winCells[row][col] = true
          }
          return { hasWin: true, pattern: "vertical", cells: winCells }
        }
      }

      // Check diagonal (top-left to bottom-right)
      if (marked.every((row, index) => row[index])) {
        for (let i = 0; i < 5; i++) {
          winCells[i][i] = true
        }
        return { hasWin: true, pattern: "diagonal", cells: winCells }
      }

      // Check diagonal (top-right to bottom-left)
      if (marked.every((row, index) => row[4 - index])) {
        for (let i = 0; i < 5; i++) {
          winCells[i][4 - i] = true
        }
        return { hasWin: true, pattern: "diagonal", cells: winCells }
      }

      // Check edges
      const edgeCells = [
        [0, 0],
        [0, 1],
        [0, 2],
        [0, 3],
        [0, 4],
        [4, 0],
        [4, 1],
        [4, 2],
        [4, 3],
        [4, 4],
        [1, 0],
        [2, 0],
        [3, 0],
        [1, 4],
        [2, 4],
        [3, 4],
      ]

      const allEdgesMarked = edgeCells.every(([row, col]) => marked[row][col])
      if (allEdgesMarked) {
        edgeCells.forEach(([row, col]) => {
          winCells[row][col] = true
        })
        return { hasWin: true, pattern: "edges", cells: winCells }
      }

      // Check full house
      const allMarked = marked.every((row) => row.every((cell) => cell))
      if (allMarked) {
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 5; col++) {
            winCells[row][col] = true
          }
        }
        return { hasWin: true, pattern: "full-house", cells: winCells }
      }

      return { hasWin: false, pattern: null, cells: winCells }
    },
    [],
  )

  // Automatically claim BINGO win
  const autoClaimBingo = useCallback(
    async (pattern: WinPattern) => {
      if (bingoClaimed) return

      setBingoClaimed(true)

      try {
        console.log(`Auto-claiming BINGO with ${pattern} pattern`)

        const response = await fetch("/api/game-state", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomId: room.id,
            action: "claim-bingo",
            data: {
              playerId,
              playerName,
              winningPattern: pattern,
            },
          }),
        })

        const data = await response.json()
        if (data.success) {
          setGameState(data.gameState)
          webApp?.HapticFeedback.notificationOccurred("success")
          playBingoSound()

          // Show result screen after a short delay
          setTimeout(() => {
            setShowResultScreen(true)
          }, 1500)

          console.log(`BINGO claimed successfully: ${pattern}`)
        } else {
          console.error("Failed to claim BINGO:", data.error)
          setBingoClaimed(false)
        }
      } catch (error) {
        console.error("Failed to claim BINGO:", error)
        setBingoClaimed(false)
      }
    },
    [bingoClaimed, room.id, playerId, playerName, webApp, playBingoSound],
  )

  // Generate 15x5 calling board (1-75)
  const generateCallingBoard = useCallback(() => {
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
  }, [])

  const callingBoard = generateCallingBoard()

  // Fetch game state from server
  const fetchGameState = useCallback(async () => {
    try {
      const response = await fetch(`/api/game-state?roomId=${room.id}`)
      const data = await response.json()

      if (data.success) {
        setGameState(data.gameState)
      }
    } catch (error) {
      console.error("Failed to fetch game state:", error)
    }
  }, [room.id])

  // Start the game
  const startGame = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/game-state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: room.id,
          action: "start-game",
        }),
      })

      const data = await response.json()
      if (data.success) {
        setGameState(data.gameState)
      }
    } catch (error) {
      console.error("Failed to start game:", error)
    } finally {
      setIsLoading(false)
    }
  }, [room.id])

  // Reset/restart the game
  const resetGame = useCallback(async () => {
    try {
      setIsLoading(true)
      setShowResultScreen(false)

      const response = await fetch("/api/game-state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: room.id,
          action: "reset-game",
        }),
      })

      const data = await response.json()
      if (data.success) {
        setGameState(data.gameState)
        setRecentCalls([])
        setLastPlayedNumber(null)
        setHasBingo(false)
        setBingoClaimed(false)
        setWinningCells([
          [false, false, false, false, false],
          [false, false, false, false, false],
          [false, false, false, false, false],
          [false, false, false, false, false],
          [false, false, false, false, false],
        ])
        setMarkedCells([
          [false, false, false, false, false],
          [false, false, false, false, false],
          [false, false, true, false, false], // FREE space marked
          [false, false, false, false, false],
          [false, false, false, false, false],
        ])
      }
    } catch (error) {
      console.error("Failed to reset game:", error)
    } finally {
      setIsLoading(false)
    }
  }, [room.id])

  // Auto-start game when component mounts
  useEffect(() => {
    const initGame = async () => {
      await fetchGameState()

      setTimeout(async () => {
        const currentState = await fetch(`/api/game-state?roomId=${room.id}`)
        const data = await currentState.json()

        if (data.success && data.gameState.gameStatus === "waiting") {
          await startGame()
        }
      }, 1000)
    }

    initGame()
  }, [room.id, fetchGameState, startGame])

  // Add these imports at the top
  const { isConnected } = useRealtime(room.id, playerId)

  // Add event listener for game state updates
  useEffect(() => {
    const handleGameStateUpdate = (event: CustomEvent) => {
      const newGameState = event.detail
      console.log("Game state update received:", newGameState)

      // Check if there's a new number called and play audio
      if (
        newGameState.currentNumber &&
        newGameState.currentNumber !== gameState.currentNumber &&
        newGameState.currentNumber !== lastPlayedNumber
      ) {
        console.log(`New number called: ${newGameState.currentNumber}`)
        playNumberAudio(newGameState.currentNumber)
        setLastPlayedNumber(newGameState.currentNumber)
      }

      // Update recent calls when current number changes
      if (newGameState.currentNumber !== gameState.currentNumber && gameState.currentNumber !== null) {
        setRecentCalls((prev) => {
          const newRecent = [gameState.currentNumber!, ...prev]
          return newRecent.slice(0, 4)
        })
      }

      // Check if game finished and show result screen
      if (newGameState.gameStatus === "finished" && gameState.gameStatus !== "finished") {
        setTimeout(() => {
          setShowResultScreen(true)
        }, 2000)
      }

      setGameState(newGameState)
    }

    window.addEventListener("gameStateUpdate", handleGameStateUpdate as EventListener)

    return () => {
      window.removeEventListener("gameStateUpdate", handleGameStateUpdate as EventListener)
    }
  }, [gameState.currentNumber, gameState.gameStatus, lastPlayedNumber, playNumberAudio])

  // Replace the polling interval with initial fetch only
  useEffect(() => {
    fetchGameState()
  }, [fetchGameState])

  // Auto-mark called numbers on player's board and check for wins
  useEffect(() => {
    if (gameState.calledNumbers.length > 0) {
      const newMarked = [...markedCells]
      let hasNewMarks = false

      for (let rowIndex = 0; rowIndex < 5; rowIndex++) {
        for (let colIndex = 0; colIndex < 5; colIndex++) {
          const cellNumber = selectedBoard.numbers[rowIndex][colIndex]

          if (cellNumber === 0) continue

          if (gameState.calledNumbers.includes(cellNumber) && !markedCells[rowIndex][colIndex]) {
            newMarked[rowIndex][colIndex] = true
            hasNewMarks = true
          }
        }
      }

      if (hasNewMarks) {
        setMarkedCells(newMarked)

        const { hasWin, pattern, cells } = checkForBingo(newMarked)
        if (hasWin && !hasBingo && !bingoClaimed) {
          console.log(`BINGO detected: ${pattern}`)
          setHasBingo(true)
          setWinningCells(cells)
          autoClaimBingo(pattern!)
        }
      }
    }
  }, [
    gameState.calledNumbers,
    selectedBoard.numbers,
    markedCells,
    checkForBingo,
    hasBingo,
    bingoClaimed,
    autoClaimBingo,
  ])

  const toggleCellMark = (row: number, col: number) => {
    if (hasBingo) return

    const cellNumber = selectedBoard.numbers[row][col]
    if (cellNumber === 0) return

    const newMarked = [...markedCells]
    newMarked[row][col] = !newMarked[row][col]
    setMarkedCells(newMarked)

    const { hasWin, pattern, cells } = checkForBingo(newMarked)
    if (hasWin && !hasBingo && !bingoClaimed) {
      console.log(`BINGO detected (manual): ${pattern}`)
      setHasBingo(true)
      setWinningCells(cells)
      autoClaimBingo(pattern!)
    } else if (!hasWin && hasBingo) {
      setHasBingo(false)
      setBingoClaimed(false)
      setWinningCells([
        [false, false, false, false, false],
        [false, false, false, false, false],
        [false, false, false, false, false],
        [false, false, false, false, false],
        [false, false, false, false, false],
      ])
    }
  }

  const handleMuteToggle = () => {
    setIsMuted(!isMuted)

    if (!isMuted && audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }

  const getBingoLetter = (number: number) => {
    if (number >= 1 && number <= 15) return "B"
    if (number >= 16 && number <= 30) return "I"
    if (number >= 31 && number <= 45) return "N"
    if (number >= 46 && number <= 60) return "G"
    if (number >= 61 && number <= 75) return "O"
    return ""
  }

  const getCallingBoardCellStyle = (number: number) => {
    if (number === gameState.currentNumber) {
      return "bg-red-500 text-white animate-pulse"
    }
    if (gameState.calledNumbers.includes(number) && number !== gameState.currentNumber) {
      return "bg-green-500 text-white"
    }
    return "bg-amber-700 text-white"
  }

  // Check if current player won
  const currentPlayerWon = gameState.winners.some((winner) => winner.playerId === playerId)
  const firstWinner = gameState.winners[0]

  return (
    <div className="min-h-screen bg-blue-800 overflow-x-auto relative">
      {/* Header Stats */}
      <div className="bg-amber-600 p-2 min-w-full">
        <div className="flex justify-between items-center text-white text-xs font-medium px-2">
          <div className="text-center">
            <div>Game ID</div>
            <div className="font-bold">{room.id.slice(-5)}</div>
          </div>
          <div className="text-center">
            <div>Called</div>
            <div className="font-bold">{gameState.calledNumbers.length}</div>
          </div>
          <div className="text-center">
            <div>Players</div>
            <div className="font-bold">{room.players.length}</div>
          </div>
          <div className="text-center">
            <div>Bet</div>
            <div className="font-bold">{room.stake}</div>
          </div>
          <div className="text-center">
            <div>Status</div>
            <div className="font-bold">
              {gameState.gameStatus === "active"
                ? "Active"
                : gameState.gameStatus === "finished"
                  ? "Finished"
                  : "Waiting"}
            </div>
          </div>
        </div>
      </div>

      {/* Main Game Area - Fixed Side by Side Layout */}
      <div className="flex min-w-full">
        {/* Left Side - Calling Board */}
        <div className="w-1/2 bg-orange-500 p-2">
          {/* BINGO Header */}
          <div className="flex justify-center gap-1 mb-2">
            {bingoLetters.map((letter, index) => (
              <div
                key={letter}
                className={`${letterColors[index]} text-white font-bold text-lg w-8 h-8 rounded flex items-center justify-center`}
              >
                {letter}
              </div>
            ))}
          </div>

          {/* Numbers Grid 15x5 */}
          <div className="space-y-1">
            {callingBoard.map((row, rowIndex) => (
              <div key={rowIndex} className="flex gap-1">
                {row.map((number) => (
                  <div
                    key={number}
                    className={`w-8 h-6 flex items-center justify-center text-xs font-bold rounded ${getCallingBoardCellStyle(number)}`}
                  >
                    {number}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Right Side - Game Interface */}
        <div className="w-1/2 bg-blue-800 p-2 space-y-3">
          {/* Playing Status and Mute */}
          <div className="flex items-center justify-between">
            <Badge
              className={`px-4 py-1 text-sm font-bold ${
                hasBingo
                  ? "bg-yellow-500 hover:bg-yellow-600 text-black animate-bounce"
                  : "bg-orange-500 hover:bg-orange-600 text-white"
              }`}
            >
              {hasBingo
                ? "BINGO!"
                : gameState.gameStatus === "active"
                  ? "playing"
                  : gameState.gameStatus === "finished"
                    ? "finished"
                    : "waiting"}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMuteToggle}
              className={`text-white hover:bg-white/10 px-2 py-1 ${
                isMuted ? "bg-red-500 hover:bg-red-600" : "bg-orange-500 hover:bg-orange-600"
              }`}
            >
              {isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
              <span className="ml-1 text-xs">{isMuted ? "Unmute" : "Mute"}</span>
            </Button>
          </div>

          {/* Current Call */}
          <div className="text-center">
            <div className="text-white text-sm mb-1">Current Call</div>
            <div className="bg-orange-500 text-white text-2xl font-bold rounded-full w-16 h-16 flex items-center justify-center mx-auto">
              {gameState.currentNumber ? `${getBingoLetter(gameState.currentNumber)}-${gameState.currentNumber}` : "--"}
            </div>
          </div>

          {/* Recent Calls - Fixed 4 circles */}
          <div className="flex gap-2 justify-center">
            {Array.from({ length: 4 }, (_, index) => {
              const call = recentCalls[index]
              return (
                <div
                  key={index}
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
                    call
                      ? "bg-amber-700 text-white"
                      : "bg-gray-500/30 text-gray-400 border-2 border-dashed border-gray-400"
                  }`}
                >
                  {call ? `${getBingoLetter(call)}-${call}` : "--"}
                </div>
              )
            })}
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
          <div className={`bg-amber-100 rounded-lg p-3 ${hasBingo ? "ring-4 ring-yellow-400 animate-pulse" : ""}`}>
            <div className="grid grid-cols-5 gap-1">
              {selectedBoard.numbers.map((row, rowIndex) =>
                row.map((number, colIndex) => {
                  const isMarked = markedCells[rowIndex][colIndex]
                  const isFree = number === 0
                  const isCurrentCall = number === gameState.currentNumber
                  const isWinningCell = winningCells[rowIndex][colIndex]

                  return (
                    <button
                      key={`${rowIndex}-${colIndex}`}
                      onClick={() => toggleCellMark(rowIndex, colIndex)}
                      disabled={hasBingo}
                      className={`
                        w-8 h-8 flex items-center justify-center text-xs font-bold rounded
                        ${
                          isWinningCell && hasBingo
                            ? "bg-yellow-400 text-black ring-2 ring-yellow-600 animate-pulse"
                            : isMarked && !isFree
                              ? "bg-green-500 text-white"
                              : "bg-amber-700 text-white"
                        }
                        ${isFree ? "bg-green-500 text-white" : ""}
                        ${isCurrentCall && !isFree ? "ring-2 ring-red-400 animate-pulse" : ""}
                        ${hasBingo ? "cursor-not-allowed" : "hover:opacity-80"}
                        transition-all duration-300
                      `}
                    >
                      {isFree ? "★" : number}
                    </button>
                  )
                }),
              )}
            </div>
            <div className="text-center text-red-600 font-bold text-sm mt-2">
              Board No.{selectedBoard.id}
              {hasBingo && <div className="text-yellow-600 font-bold text-lg animate-bounce">🎉 BINGO! 🎉</div>}
            </div>
          </div>
        </div>
      </div>

      {/* BINGO Banner */}
      <div className={`text-white text-center py-3 ${hasBingo ? "bg-yellow-500 animate-pulse" : "bg-red-500"}`}>
        <div className="text-2xl font-bold">{hasBingo ? "🎉 BINGO! 🎉" : "BINGO!"}</div>
      </div>

      {/* Bottom Buttons */}
      <div className="flex justify-center gap-6 py-4">
        <Button
          onClick={resetGame}
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-8 py-3 rounded-full text-base"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Restart Game
        </Button>
        <Button
          onClick={onBack}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-3 rounded-full text-base"
        >
          Leave
        </Button>
      </div>

      {/* Result Screen Overlay - Rendered as overlay when showResultScreen is true */}
      {showResultScreen && gameState.gameStatus === "finished" && (
        <BingoResultScreen
          isWinner={currentPlayerWon}
          currentPlayerName={playerName}
          winner={firstWinner}
          winnerBoard={selectedBoard}
          winningCells={winningCells}
          prizeAmount={room.stake * room.players.length}
          onPlayAgain={resetGame}
          onLeave={onBack}
        />
      )}

      {/* Hidden audio element for preloading */}
      <audio ref={audioRef} preload="none" style={{ display: "none" }} />
    </div>
  )
}
