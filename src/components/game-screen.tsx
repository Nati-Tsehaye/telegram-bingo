"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import BingoGame from "./bingo-game"
import { getBoardById, type BingoBoard } from "@/data/bingo-boards"
import { useWebSocket } from "@/hooks/use-websocket"
import type { GameRoomClient } from "@/hooks/use-websocket" // Import client-side GameRoom type

interface GameScreenProps {
  room: GameRoomClient // Use client-side GameRoom type
  onBack: () => void
}

export default function GameScreen({ room: initialRoom, onBack }: GameScreenProps) {
  const [selectedBoardNumber, setSelectedBoardNumber] = useState<number | null>(null)
  const [selectedBoard, setSelectedBoard] = useState<BingoBoard | null>(null)
  const [gameStatus, setGameStatus] = useState<"waiting" | "active" | "starting">("waiting")
  const [showBingoGame, setShowBingoGame] = useState(false)

  const {
    rooms,
    playerId,
    isPlayerRegisteredOnServer, // Get new state
    joinRoom,
    startGame,
    selectBoard: sendSelectBoard,
  } = useWebSocket(process.env.NEXT_PUBLIC_WS_URL || "wss://web-service-8dz5.onrender.com")

  // Find the current room from the WebSocket state
  const currentRoom = rooms.find((r) => r.id === initialRoom.id) || initialRoom

  // Generate numbers 1-100 in a 10x10 grid
  const numbers = Array.from({ length: 100 }, (_, i) => i + 1)

  useEffect(() => {
    // Automatically join the room when component mounts
    // Only attempt to join if playerId is available and not yet registered on the server
    if (playerId && initialRoom.id && !isPlayerRegisteredOnServer) {
      const playerName = `Player_${playerId.substring(playerId.length - 5)}` // Use part of player ID for name
      joinRoom(initialRoom.id, playerName)
    }
  }, [playerId, initialRoom.id, joinRoom, isPlayerRegisteredOnServer]) // Add isPlayerRegisteredOnServer to deps

  // Effect to synchronize local selectedBoardNumber with server state
  useEffect(() => {
    if (playerId && currentRoom.selectedBoards) {
      // Corrected: Compare b.playerId with playerId
      const myServerSelectedBoard = currentRoom.selectedBoards.find((b) => b.playerId === playerId)
      if (myServerSelectedBoard && myServerSelectedBoard.boardId !== selectedBoardNumber) {
        setSelectedBoardNumber(myServerSelectedBoard.boardId)
        setSelectedBoard(getBoardById(myServerSelectedBoard.boardId) || null)
      } else if (!myServerSelectedBoard && selectedBoardNumber !== null) {
        // If server says I have no board, but local state says I do, clear local state
        setSelectedBoardNumber(null)
        setSelectedBoard(null)
      }
    }
  }, [currentRoom.selectedBoards, playerId, selectedBoardNumber])

  const handleRefresh = () => {
    console.log("Refreshing game...")
    // In a real scenario, you might re-fetch room data or trigger a server update
  }

  const handleNumberClick = (number: number) => {
    if (!isPlayerRegisteredOnServer) {
      alert("Please wait, connecting to game server...")
      return
    }

    // Check if the board is already selected by another player based on the LATEST server state
    const isTakenByOther = currentRoom.selectedBoards.some((b) => b.boardId === number && b.playerId !== playerId)

    if (isTakenByOther) {
      alert(
        `Board ${number} is already taken by ${currentRoom.selectedBoards.find((b) => b.boardId === number)?.playerName || "another player"}. Please choose another board.`,
      )
      return
    }

    // If clicking the same number, deselect it
    if (selectedBoardNumber === number) {
      setSelectedBoardNumber(null)
      setSelectedBoard(null)
      sendSelectBoard(currentRoom.id, 0) // Send 0 or null to unselect on server
      return
    }

    // Select new board number locally for immediate feedback
    setSelectedBoardNumber(number)
    const board = getBoardById(number)
    setSelectedBoard(board || null)

    // Send selection to server
    sendSelectBoard(currentRoom.id, number)
  }

  const handleStartGame = () => {
    if (!selectedBoard) {
      alert("Please select a board number before starting the game!")
      return
    }

    // Send start game message to server
    startGame(currentRoom.id)

    setGameStatus("starting")

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
    return <BingoGame room={currentRoom} selectedBoard={selectedBoard} onBack={onBack} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-400 via-purple-500 to-purple-600 p-4">
      {/* Status Pills */}
      <div className="flex justify-center gap-4 mb-6">
        <div className="bg-white rounded-full px-6 py-3 shadow-lg">
          <span className="text-gray-800 font-medium">Active Game {currentRoom.activeGames || 0}</span>
        </div>
        <div className="bg-white rounded-full px-6 py-3 shadow-lg">
          <span className="text-gray-800 font-medium">Stake {currentRoom.stake}</span>
        </div>
        <div className="bg-white rounded-full px-6 py-3 shadow-lg">
          <span className="text-gray-800 font-medium">Start in {getStatusText()}</span>
        </div>
      </div>

      {/* Numbers Grid */}
      <div className="max-w-2xl mx-auto mb-6">
        <div className="grid grid-cols-10 gap-2">
          {numbers.map((number) => {
            // Determine if this specific button number is selected by the current player (locally or server-confirmed)
            const isSelectedByMe = selectedBoardNumber === number

            // Determine if this specific button number is selected by any other player on the server
            const serverSelectedBoardEntry = currentRoom.selectedBoards.find((b) => b.boardId === number)
            const isSelectedByOtherPlayer = !!serverSelectedBoardEntry && serverSelectedBoardEntry.playerId !== playerId

            let buttonClass = "bg-white/20 backdrop-blur-sm border border-white/30 hover:bg-white/30" // Default available

            if (isSelectedByOtherPlayer) {
              buttonClass = "bg-red-500 opacity-70 cursor-not-allowed" // Red for others' selection
            } else if (isSelectedByMe) {
              // If it's not taken by another, and it's my local selection, it's green
              buttonClass = "bg-green-500 shadow-lg transform scale-105" // Green for my selection
            }

            return (
              <button
                key={number}
                onClick={() => handleNumberClick(number)}
                disabled={isSelectedByOtherPlayer || !isPlayerRegisteredOnServer} // Disable if taken by other or not registered
                className={`
                  aspect-square flex items-center justify-center rounded-lg text-white font-bold text-sm
                  ${buttonClass}
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
          disabled={gameStatus === "active" || !selectedBoard || !isPlayerRegisteredOnServer} // Disable if not registered
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
