"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Users, Coins, User, Zap } from "lucide-react"
import GameScreen from "@/components/game-screen"
import { useTelegram } from "@/components/telegram-provider"

export default function Homepage() {
  const { webApp, user, isReady } = useTelegram()
  const [activeTab, setActiveTab] = useState("Stake")
  const [gameRooms, setGameRooms] = useState<any[]>([])
  const [currentScreen, setCurrentScreen] = useState<"lobby" | "game">("lobby")
  const [selectedRoom, setSelectedRoom] = useState<any>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // Fetch rooms from API
  const fetchRooms = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/rooms")
      const data = await response.json()

      if (data.success) {
        setGameRooms(data.rooms)
        setTotalPlayers(data.totalPlayers)
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error("Failed to fetch rooms:", error)
      webApp?.showAlert("Failed to load rooms. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }, [webApp])

  // Auto-refresh rooms every 5 seconds
  useEffect(() => {
    if (isReady && currentScreen === "lobby") {
      fetchRooms()

      const interval = setInterval(fetchRooms, 5000)
      return () => clearInterval(interval)
    }
  }, [isReady, currentScreen, fetchRooms])

  const handleRefresh = useCallback(() => {
    webApp?.HapticFeedback.impactOccurred("medium")
    fetchRooms()
  }, [webApp, fetchRooms])

  const handlePlay = async (room: any) => {
    if (isConnecting) return

    webApp?.HapticFeedback.impactOccurred("heavy")

    // Show confirmation before joining
    webApp?.showConfirm(`Join room with ${room.stake} ETB stake?`, async (confirmed) => {
      if (confirmed) {
        setIsConnecting(true)

        try {
          const playerId = user?.id?.toString() || `guest-${Date.now()}`
          const response = await fetch("/api/rooms", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "join",
              roomId: room.id,
              playerId,
              playerData: {
                name: user?.first_name || "Guest Player",
                telegramId: user?.id,
              },
            }),
          })

          const data = await response.json()

          if (data.success) {
            setSelectedRoom(data.room)
            setCurrentScreen("game")

            // Configure back button
            webApp?.BackButton.show()
            webApp?.BackButton.onClick(async () => {
              // Leave room when going back
              await fetch("/api/rooms", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  action: "leave",
                  playerId,
                }),
              })

              setCurrentScreen("lobby")
              setSelectedRoom(null)
              webApp?.BackButton.hide()
              fetchRooms() // Refresh rooms
            })
          } else {
            webApp?.showAlert(data.error || "Failed to join room")
          }
        } catch (error) {
          console.error("Failed to join room:", error)
          webApp?.showAlert("Failed to join room. Please try again.")
        } finally {
          setIsConnecting(false)
        }
      }
    })
  }

  // Configure main button
  useEffect(() => {
    if (webApp && currentScreen === "lobby") {
      webApp.MainButton.setParams({
        text: "🔄 Refresh Rooms",
        color: "#3b82f6",
        text_color: "#ffffff",
        is_visible: true,
        is_active: true,
      })

      webApp.MainButton.onClick(() => {
        handleRefresh()
        webApp.HapticFeedback.impactOccurred("light")
      })

      return () => {
        webApp.MainButton.hide()
      }
    }
  }, [webApp, handleRefresh, currentScreen])

  const tabs = ["Stake", "Active", "Players", "Derash", "Play"]

  if (!isReady) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-600 via-blue-700 to-blue-800 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading Arada Bingo...</p>
        </div>
      </div>
    )
  }

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
          {user && (
            <div className="flex items-center gap-2 text-white text-sm">
              <User className="h-4 w-4" />
              <span>Hi, {user.first_name}!</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-500 text-white">
            <Zap className="h-3 w-3 mr-1" />
            {totalPlayers} Online
          </Badge>
          <Button
            onClick={handleRefresh}
            variant="secondary"
            className="bg-gray-600 hover:bg-gray-700 text-white border-0"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-orange-500 px-4 py-2">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab)
                webApp?.HapticFeedback.selectionChanged()
              }}
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
        {isLoading ? (
          <div className="text-center text-white/70 py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p>Loading rooms...</p>
          </div>
        ) : gameRooms.length === 0 ? (
          <div className="text-center text-white/70 py-8">
            <p>No rooms available. Try refreshing!</p>
            <Button onClick={handleRefresh} className="mt-4 bg-orange-500 hover:bg-orange-600">
              Refresh Rooms
            </Button>
          </div>
        ) : (
          gameRooms.map((room) => (
            <div
              key={room.id}
              className="relative bg-blue-800/50 backdrop-blur-sm border border-blue-600/30 rounded-lg p-4"
            >
              {/* Status Indicators */}
              <div className="absolute top-2 right-2 flex gap-2">
                {room.status === "active" && (
                  <Badge className="bg-red-500 hover:bg-red-600 text-white text-xs">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></div>
                    Live
                  </Badge>
                )}
                {room.status === "starting" && (
                  <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs">Starting...</Badge>
                )}
                {room.hasBonus && <Badge className="bg-purple-500 hover:bg-purple-600 text-white text-xs">Bonus</Badge>}
              </div>

              <div className="flex items-center justify-between">
                {/* Stake */}
                <div className="text-center">
                  <div className="text-3xl font-bold text-white mb-1">{room.stake}</div>
                  <div className="text-white/70 text-xs">ETB</div>
                </div>

                {/* Room Status */}
                <div className="text-center">
                  <div className="text-white text-sm">
                    {room.status === "waiting"
                      ? "Waiting"
                      : room.status === "starting"
                        ? "Starting"
                        : room.status === "active"
                          ? "Playing"
                          : "Finished"}
                  </div>
                  <div className="text-white/70 text-xs">
                    {room.players}/{room.maxPlayers}
                  </div>
                </div>

                {/* Players */}
                <div className="text-center">
                  <div className="text-2xl font-bold text-white flex items-center gap-1">
                    <Users className="h-5 w-5" />
                    {room.players}
                  </div>
                  <div className="text-white/70 text-xs">Players</div>
                </div>

                {/* Prize */}
                <div className="text-center">
                  <div className="text-xl font-bold text-white flex items-center gap-1">
                    <Coins className="h-5 w-5 text-yellow-400" />
                    {room.prize}
                  </div>
                  <div className="text-white/70 text-xs">Prize</div>
                </div>

                {/* Play Button */}
                <div>
                  <Button
                    onClick={() => handlePlay(room)}
                    disabled={isConnecting || room.status !== "waiting" || room.players >= room.maxPlayers}
                    className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 text-purple-300 font-bold px-6 py-2 rounded-lg border-0"
                  >
                    {isConnecting
                      ? "Joining..."
                      : room.players >= room.maxPlayers
                        ? "Full"
                        : room.status !== "waiting"
                          ? "Started"
                          : "Play"}
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-8 text-white/70 text-sm">
        © Arada Bingo 2024 • {totalPlayers} Players Online
        <div className="text-xs mt-1">Last updated: {lastUpdate.toLocaleTimeString()}</div>
        {user && (
          <div className="mt-2 text-xs">
            Welcome, {user.first_name} {user.last_name || ""}
            {user.username && ` (@${user.username})`}
          </div>
        )}
      </div>
    </div>
  )
}
