"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Users, Coins, Wifi, WifiOff } from "lucide-react"
import GameScreen from "@/components/game-screen"
import { useWebSocket } from "@/hooks/use-websocket"
import type { GameRoomClient } from "@/hooks/use-websocket" // Import client-side GameRoom type

export default function Homepage() {
  const [activeTab, setActiveTab] = useState("Stake")
  const [currentScreen, setCurrentScreen] = useState<"lobby" | "game">("lobby")
  const [selectedRoom, setSelectedRoom] = useState<GameRoomClient | null>(null) // Use GameRoomClient

  // WebSocket connection
  const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "wss://web-service-8dz5.onrender.com"
  const { isConnected, rooms, error } = useWebSocket(WS_URL) // Removed joinRoom

  // Fallback rooms for when WebSocket is not connected
  const [fallbackRooms] = useState<GameRoomClient[]>([
    // Use GameRoomClient
    {
      id: 1,
      stake: 10,
      players: 0,
      prize: 0,
      status: "waiting",
      hasBonus: true,
      selectedBoards: [], // Add selectedBoards for fallback
    },
    {
      id: 2,
      stake: 20,
      players: 0,
      prize: 0,
      status: "waiting",
      hasBonus: true,
      selectedBoards: [], // Add selectedBoards for fallback
    },
    {
      id: 3,
      stake: 50,
      players: 0,
      prize: 0,
      status: "waiting",
      activeGames: 0,
      hasBonus: true,
      selectedBoards: [], // Add selectedBoards for fallback
    },
    {
      id: 4,
      stake: 100,
      players: 0,
      prize: 0,
      status: "waiting",
      activeGames: 0,
      hasBonus: true,
      selectedBoards: [], // Add selectedBoards for fallback
    },
  ])

  // Use WebSocket rooms if connected, otherwise use fallback
  const gameRooms = isConnected && rooms.length > 0 ? rooms : fallbackRooms

  const handleRefresh = () => {
    // Force reconnection if not connected
    if (!isConnected) {
      window.location.reload()
    }
  }

  const handlePlay = (room: GameRoomClient) => {
    // Use GameRoomClient
    // Navigate to game screen without joining the room yet
    setSelectedRoom(room)
    setCurrentScreen("game")
  }

  const tabs = ["Stake", "Active", "Players", "Derash", "Play"]

  if (currentScreen === "game" && selectedRoom) {
    return <GameScreen room={selectedRoom} onBack={() => setCurrentScreen("lobby")} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 via-blue-700 to-blue-800">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/20">
        <div className="flex items-center gap-2">
          <div className="bg-black px-3 py-1 rounded">
            <span className="text-yellow-400 font-bold text-lg">📺 SETB</span>
          </div>
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            {isConnected ? (
              <div className="flex items-center gap-1 text-green-400 text-sm">
                <Wifi className="h-4 w-4" />
                <span>Live</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-red-400 text-sm">
                <WifiOff className="h-4 w-4" />
                <span>Offline</span>
              </div>
            )}
          </div>
        </div>
        <Button
          onClick={handleRefresh}
          variant="secondary"
          className="bg-gray-600 hover:bg-gray-700 text-white border-0"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 mx-4 rounded-lg">
          <p className="text-sm">⚠️ {error}</p>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-orange-500 px-4 py-2">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-white font-medium py-2 px-1 border-b-2 transition-colors ${
                activeTab === tab ? "border-white" : "border-transparent hover:border-white/50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Game Rooms */}
      <div className="p-4 space-y-3">
        {gameRooms.map((room) => (
          <div
            key={room.id}
            className="relative bg-blue-800/50 backdrop-blur-sm border border-blue-600/30 rounded-lg p-4"
          >
            {/* Bonus Ribbon */}
            {room.hasBonus && (
              <div className="absolute -left-2 -top-2">
                <div className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-r-lg transform -rotate-12 shadow-lg">
                  Bonus
                </div>
              </div>
            )}

            {/* Active Game Indicator */}
            {room.status === "active" && (
              <div className="absolute top-2 left-16">
                <Badge className="bg-red-500 hover:bg-red-600 text-white text-xs">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></div>
                  Active game {room.activeGames}
                </Badge>
              </div>
            )}

            <div className="flex items-center justify-between">
              {/* Stake */}
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-1">{room.stake}</div>
              </div>

              {/* Balance Status */}
              <div className="text-center">
                <div className="text-white text-sm">Low</div>
                <div className="text-white text-sm">balance</div>
              </div>

              {/* Players */}
              <div className="text-center">
                <div className="text-2xl font-bold text-white flex items-center gap-1">
                  <Users className="h-5 w-5" />
                  <span className={isConnected ? "text-green-300" : "text-gray-300"}>{room.players}</span>
                </div>
              </div>

              {/* Prize */}
              <div className="text-center">
                <div className="text-xl font-bold text-white flex items-center gap-1">
                  <Coins className="h-5 w-5 text-yellow-400" />
                  {room.prize} ETB
                </div>
              </div>

              {/* Play Button */}
              <div>
                <Button
                  onClick={() => handlePlay(room)}
                  className="bg-gray-600 hover:bg-gray-700 text-purple-300 font-bold px-6 py-2 rounded-lg border-0"
                >
                  Play
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center py-8 text-white/70 text-sm">
        © Arada Bingo 2024
        {isConnected && <div className="text-xs text-green-400 mt-1">🟢 Connected to live server</div>}
      </div>
    </div>
  )
}
