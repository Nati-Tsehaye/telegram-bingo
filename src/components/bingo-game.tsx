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
  const { user, webApp, guestId } = useTelegram()
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
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const bingoLetters = ["B", "I", "N", "G", "O"]
  const letterColors = ["bg-yellow-500", "bg-green-500", "bg-blue-500", "bg-orange-500", "bg-purple-500"]

  // Get consistent player ID - use Telegram user ID or persistent guest ID
  const getPlayerId = useCallback(() => {
    if (user?.id) {
      return user.id.toString()
    }
    if (guestId) {
      return guestId
    }
    // Fallback - this should rarely happen now
    console.warn("No user ID or guest ID available, using fallback")
    return `fallback-${Date.now()}`
  }, [user?.id, guestId])

  const playerId = getPlayerId()
  const playerName = user?.first_name || "Guest Player"

  // Function to play audio for called number - FIXED VERSION
  const playNumberAudio = useCallback(
    (number: number) => {
      if (isMuted) {
        console.log(`🔇 Audio muted, skipping number ${number}`)
        return
      }

      console.log(`🔊 Attempting to play audio for number: ${number}`)

      try {
        // Create audio element
        const audio = new Audio()
        audio.preload = "auto"
        audio.volume = 0.7
        audio.crossOrigin = "anonymous" // Add this for CORS

        // Set the source
        audio.src = `/audio/men/${number}.mp3`
        console.log(`🎵 Audio source set: ${audio.src}`)

        // Handle successful load and play
        const playAudio = () => {
          console.log(`▶️ Playing audio for number ${number}`)
          audio
            .play()
            .then(() => {
              console.log(`✅ Successfully playing audio for number ${number}`)
              setLastPlayedNumber(number)
            })
            .catch((error) => {
              console.warn(`❌ Failed to play audio for number ${number}:`, error)
              // Fallback: try to play a generic sound or show visual feedback
              webApp?.HapticFeedback.notificationOccurred("success")
              setLastPlayedNumber(number) // Still mark as played for tracking
            })
        }

        // Handle errors
        const handleError = (error: Event) => {
          console.warn(`❌ Error loading audio for number ${number}:`, error)
          // Fallback to haptic feedback
          webApp?.HapticFeedback.notificationOccurred("success")
          setLastPlayedNumber(number) // Still mark as played for tracking
        }

        // Set up event listeners
        audio.addEventListener("canplay", playAudio, { once: true })
        audio.addEventListener("error", handleError, { once: true })

        // Cleanup after playing
        audio.addEventListener("ended", () => {
          console.log(`🏁 Audio ended for number ${number}`)
          audio.remove()
        })

        // Load the audio
        audio.load()

        // Cleanup timeout as fallback
        setTimeout(() => {
          if (audio) {
            audio.pause()
            audio.remove()
          }
        }, 10000) // 10 seconds max
      } catch (error) {
        console.warn(`❌ Error creating audio for number ${number}:`, error)
        // Fallback to haptic feedback
        webApp?.HapticFeedback.notificationOccurred("success")
        setLastPlayedNumber(number) // Still mark as played for tracking
      }
    },
    [isMuted, webApp],
  )

  // Function to play BINGO win sound
  const playBingoSound = useCallback(() => {
    if (isMuted) return

    try {
      const audio = new Audio()
      audio.preload = "auto"
      audio.volume = 0.8
      audio.src = `/audio/bingo-win.mp3`

      const playAudio = () => {
        audio.play().catch((error) => {
          console.warn("Failed to play BINGO sound:", error)
          // Fallback to number sound or haptic
          webApp?.HapticFeedback.notificationOccurred("success")
          playNumberAudio(75) // Play number 75 as fallback
        })
      }

      if (audio.readyState >= 2) {
        playAudio()
      } else {
        audio.addEventListener("canplay", playAudio, { once: true })
        audio.addEventListener(
          "error",
          (error) => {
            console.warn("Error loading BINGO sound, using fallback")
            webApp?.HapticFeedback.notificationOccurred("success")
            playNumberAudio(75)
          },
          { once: true },
        )

        audio.load()
      }
    } catch (error) {
      console.warn("Error playing BINGO sound:", error)
      webApp?.HapticFeedback.notificationOccurred("success")
    }
  }, [isMuted, webApp, playNumberAudio])

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
      console.log(`🔍 Fetching game state for room: ${room.id}`)
      const response = await fetch(`/api/game-state?roomId=${room.id}`)
      const data = await response.json()

      if (data.success) {
        console.log(`📊 Game state fetched:`, {
          status: data.gameState.gameStatus,
          calledNumbers: data.gameState.calledNumbers?.length || 0,
          currentNumber: data.gameState.currentNumber,
        })
        setGameState(data.gameState)
      } else {
        console.error("Failed to fetch game state:", data.error)
      }
    } catch (error) {
      console.error("Failed to fetch game state:", error)
    }
  }, [room.id])

  // Manual number calling function for testing
  const _callNumberManually = useCallback(async () => {
    try {
      console.log(`🎯 Manually calling number for room: ${room.id}`)
      const response = await fetch("/api/auto-caller", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: room.id,
        }),
      })

      const data = await response.json()
      console.log("Manual call response:", data)

      if (data.success && data.calledNumber) {
        console.log(`📢 Manually called number: ${data.calledNumber}`)
        // Refresh game state to get the updated data
        await fetchGameState()
      } else {
        console.log("Manual call failed or no number returned:", data.message)
      }
    } catch (error) {
      console.error("Error in manual number calling:", error)
    }
  }, [room.id, fetchGameState])

  // Auto number calling function
  const startAutoNumberCalling = useCallback(() => {
    console.log(`🚀 Starting auto number calling for room: ${room.id}`)

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    const callNumber = async () => {
      try {
        console.log(`⏰ Auto-calling number for room: ${room.id}`)
        const response = await fetch("/api/auto-caller", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomId: room.id,
          }),
        })

        const data = await response.json()
        console.log("Auto call response:", data)

        if (data.success && data.calledNumber) {
          console.log(`📢 Auto-called number: ${data.calledNumber}`)
          // Refresh game state to get the updated data
          await fetchGameState()
        } else {
          console.log("Auto call failed or no number returned:", data.message)
          // If game is finished or no more numbers, stop calling
          if (data.message?.includes("finished") || data.message?.includes("All numbers called")) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }
          }
        }
      } catch (error) {
        console.error("Error in auto number calling:", error)
      }
    }

    // Call first number after 2 seconds
    setTimeout(callNumber, 2000)

    // Then call every 4 seconds
    intervalRef.current = setInterval(callNumber, 4000)

    console.log(`✅ Auto calling started for room: ${room.id}`)
  }, [room.id, fetchGameState])

  // Update the startGame function
  const startGame = useCallback(async () => {
    try {
      setIsLoading(true)
      console.log("🎮 Starting game for room:", room.id)

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
        console.log("✅ Game started, status:", data.gameState.gameStatus)

        // Start auto number calling after a short delay
        if (data.gameState.gameStatus === "active") {
          setTimeout(() => {
            startAutoNumberCalling()
          }, 1000)
        }
      } else {
        console.error("Failed to start game:", data.error)
      }
    } catch (error) {
      console.error("Failed to start game:", error)
    } finally {
      setIsLoading(false)
    }
  }, [room.id, startAutoNumberCalling])

  // Reset/restart the game
  const resetGame = useCallback(async () => {
    try {
      setIsLoading(true)
      setShowResultScreen(false)

      // Clear any running intervals
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

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
        setRecentCalls([]) // Add this line to clear recent calls
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
    } catch (_error) {
      console.error("Failed to reset game:", _error)
    } finally {
      setIsLoading(false)
    }
  }, [room.id])

  // Auto-start game when component mounts
  useEffect(() => {
    const initGame = async () => {
      console.log("🚀 Initializing game...")

      // Clear any previous game state when component mounts
      setRecentCalls([])
      setLastPlayedNumber(null)
      setHasBingo(false)
      setBingoClaimed(false)

      await fetchGameState()

      setTimeout(async () => {
        console.log("🔍 Checking if game needs to be started...")
        const currentState = await fetch(`/api/game-state?roomId=${room.id}`)
        const data = await currentState.json()

        if (data.success) {
          console.log("Current game status:", data.gameState.gameStatus)
          if (data.gameState.gameStatus === "waiting") {
            console.log("🎮 Game is waiting, starting it...")
            await startGame()
          } else if (data.gameState.gameStatus === "active") {
            console.log("🎮 Game is already active, starting auto calling...")
            startAutoNumberCalling()
          }
        }
      }, 1000)
    }

    initGame()

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [room.id, fetchGameState, startGame, startAutoNumberCalling])

  // Add these imports at the top
  const { isConnected: _isConnected } = useRealtime(room.id, playerId)

  // FIXED: Add event listener for game state updates with proper recent calls tracking
  useEffect(() => {
    const handleGameStateUpdate = (event: CustomEvent) => {
      const newGameState = event.detail
      console.log("🔄 Game state update received:", newGameState)

      // If this is a fresh game (no called numbers), clear recent calls
      if (!newGameState.calledNumbers || newGameState.calledNumbers.length === 0) {
        setRecentCalls([])
        setLastPlayedNumber(null)
      }

      // FIXED: Check if there's a new number called and play audio
      if (newGameState.currentNumber && newGameState.currentNumber !== gameState.currentNumber) {
        console.log(`🆕 New number detected: ${newGameState.currentNumber} (previous: ${gameState.currentNumber})`)

        // Only play if this number hasn't been played yet
        if (newGameState.currentNumber !== lastPlayedNumber) {
          console.log(`🎵 Playing audio for new number: ${newGameState.currentNumber}`)
          playNumberAudio(newGameState.currentNumber)
        } else {
          console.log(`🔇 Number ${newGameState.currentNumber} already played, skipping audio`)
        }

        // FIXED: Update recent calls when we have a new current number
        // Add the PREVIOUS current number to recent calls (not the new one)
        if (gameState.currentNumber !== null && gameState.currentNumber !== newGameState.currentNumber) {
          console.log(`📝 Adding ${gameState.currentNumber} to recent calls`)
          setRecentCalls((prev) => {
            const newRecent = [gameState.currentNumber!, ...prev.slice(0, 3)] // Keep only 3 previous + new one = 4 total
            console.log(`📋 Updated recent calls:`, newRecent)
            return newRecent
          })
        }
      }

      // Check if game finished and show result screen
      if (newGameState.gameStatus === "finished" && gameState.gameStatus !== "finished") {
        // Stop auto calling
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
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

  // FIXED: Handle direct gameState updates for recent calls
  useEffect(() => {
    // When gameState.currentNumber changes directly, update recent calls
    if (gameState.currentNumber && gameState.calledNumbers.length > 1) {
      // Get the last 4 called numbers (excluding the current one) for recent calls
      const previousCalls = gameState.calledNumbers
        .filter((num) => num !== gameState.currentNumber) // Exclude current number
        .slice(-4) // Get last 4
        .reverse() // Most recent first

      console.log(`📋 Direct state update - setting recent calls:`, previousCalls)
      setRecentCalls(previousCalls)
    }
  }, [gameState.currentNumber, gameState.calledNumbers])

  // FIXED: Also check for current number changes when gameState updates directly
  useEffect(() => {
    if (gameState.currentNumber && gameState.currentNumber !== lastPlayedNumber) {
      console.log(`🎵 Direct state update - playing audio for: ${gameState.currentNumber}`)
      playNumberAudio(gameState.currentNumber)
    }
  }, [gameState.currentNumber, lastPlayedNumber, playNumberAudio])

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

  // Test audio function for debugging
  const _testAudio = () => {
    console.log("🧪 Testing audio with current number:", gameState.currentNumber)
    if (gameState.currentNumber) {
      playNumberAudio(gameState.currentNumber)
    } else {
      // Test with a random number
      const testNumber = Math.floor(Math.random() * 75) + 1
      console.log("🧪 Testing with random number:", testNumber)
      playNumberAudio(testNumber)
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

      {/* Bottom Buttons */}
      <div className="flex justify-center gap-6 py-4">
        <Button
          onClick={fetchGameState}
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-8 py-3 rounded-full text-base"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button
          onClick={onBack}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-3 rounded-full text-base"
        >
          Leave
        </Button>
      </div>

      {/* BINGO Banner */}
      <div className={`text-white text-center py-3 ${hasBingo ? "bg-yellow-500 animate-pulse" : "bg-red-500"}`}>
        <div className="text-2xl font-bold">{hasBingo ? "🎉 BINGO! 🎉" : "BINGO!"}</div>
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
