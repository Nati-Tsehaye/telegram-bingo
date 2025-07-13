"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Users, Coins } from "lucide-react"
import GameScreen from "@/components/game-screen"

interface GameRoom {
  id: number
  stake: number
  players: number
  prize: number
  status: "waiting" | "active"
  activeGames?: number
  hasBonus: boolean
}

export default function Homepage() {
  const [activeTab, setActiveTab] = useState("Stake")
  const [gameRooms, setGameRooms] = useState<GameRoom[]>([
    {
      id: 1,
      stake: 10,
      players: 3,
      prize: 30,
      status: "waiting",
      hasBonus: true,
    },
    {
      id: 2,
      stake: 20,
      players: 4,
      prize: 80,
      status: "waiting",
      hasBonus: true,
    },
    {
      id: 3,
      stake: 50,
      players: 28,
      prize: 1120,
      status: "active",
      activeGames: 1,
      hasBonus: true,
    },
    {
      id: 4,
      stake: 100,
      players: 6,
      prize: 480,
      status: "active",
      activeGames: 1,
      hasBonus: true,
    },
  ])

  const [currentScreen, setCurrentScreen] = useState<"lobby" | "game">("lobby")
  const [selectedRoom, setSelectedRoom] = useState<GameRoom | null>(null)

//   // Initialize Telegram Web App
//   useEffect(() => {
//     if (typeof window !== "undefined" && window.Telegram?.WebApp) {
//       const tg = window.Telegram.WebApp
//       tg.ready()
//       tg.expand()

//       // Set theme colors to match the blue design
//       document.documentElement.style.setProperty("--tg-theme-bg-color", "#1e40af")
//       document.documentElement.style.setProperty("--tg-theme-text-color", "#ffffff")
//     }
//   }, [])

  const handleRefresh = () => {
    // Simulate refreshing room data
    setGameRooms((prev) =>
      prev.map((room) => ({
        ...room,
        players: Math.floor(Math.random() * 30) + 1,
        prize: room.stake * (Math.floor(Math.random() * 20) + 5),
      })),
    )
  }

  const handlePlay = (room: GameRoom) => {
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
                  {room.players}
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
      <div className="text-center py-8 text-white/70 text-sm">© Arada Bingo 2024</div>
    </div>
  )
}
