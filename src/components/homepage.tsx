"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Users, Coins, User, Zap } from "lucide-react"
import GameScreen from "@/components/game-screen"
import { useTelegram } from "@/components/telegram-provider"
import type { GameRoom, GameRoomSummary, RoomResponse } from "@/types/game"

export default function Homepage() {
  const { webApp, user, isReady, guestId } = useTelegram()
  const [activeTab, setActiveTab] = useState("Stake")
  const [gameRooms, setGameRooms] = useState<GameRoomSummary[]>([])
  const [currentScreen, setCurrentScreen] = useState<"lobby" | "game">("lobby")
  const [selectedRoom, setSelectedRoom] = useState<GameRoom | null>(null)
  const [connectingRoomId, setConnectingRoomId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [error, setError] = useState<string | null>(null)

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

  // Fetch rooms from API with better error handling
  const fetchRooms = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      console.log("🔄 Fetching rooms...")

      // Use absolute URL for Telegram Mini App
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const url = `${baseUrl}/api/rooms`

      console.log("📡 Request URL:", url)

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        // Add cache busting
        cache: "no-cache",
      })

      console.log("📊 Response status:", response.status)
      console.log("📊 Response headers:", Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorText = await response.text()
        console.error("❌ HTTP Error:", response.status, errorText)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const data: RoomResponse = await response.json()
      console.log("✅ Fetched data:", data)

      if (data.success) {
        setGameRooms(data.rooms)
        setTotalPlayers(data.totalPlayers)
        setLastUpdate(new Date())
        console.log(`✅ Loaded ${data.rooms.length} rooms with ${data.totalPlayers} total players`)
      } else {
        throw new Error("API returned success: false")
      }
    } catch (error) {
      console.error("❌ Failed to fetch rooms:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setError(errorMessage)
      webApp?.showAlert(`Failed to load rooms: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }, [webApp])

  // Load rooms when component mounts and when returning to lobby
  useEffect(() => {
    if (isReady && currentScreen === "lobby") {
      console.log("🚀 Component ready, fetching rooms...")
      fetchRooms()
    }
  }, [isReady, currentScreen, fetchRooms])

  const handleRefresh = useCallback(() => {
    console.log("🔄 Manual refresh triggered")
    webApp?.HapticFeedback.impactOccurred("medium")
    fetchRooms()
  }, [webApp, fetchRooms])

  const handlePlay = async (room: GameRoomSummary) => {
    if (connectingRoomId) return

    webApp?.HapticFeedback.impactOccurred("heavy")
    setConnectingRoomId(room.id)

    try {
      const playerId = getPlayerId()
      console.log("🎮 Joining room with player ID:", playerId)

      // Use absolute URL for Telegram Mini App
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const url = `${baseUrl}/api/rooms`

      console.log("🎮 Joining room:", room.id, "Player:", playerId)

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
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
          await handleLeaveRoom(playerId)
        })
      } else {
        webApp?.showAlert(data.error || "Failed to join room")
      }
    } catch (error) {
      console.error("Failed to join room:", error)
      webApp?.showAlert("Failed to join room. Please try again.")
    } finally {
      setConnectingRoomId(null)
    }
  }

  // Enhanced leave room function
  const handleLeaveRoom = async (playerId: string) => {
    try {
      console.log("👋 Leaving room for player:", playerId)

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const url = `${baseUrl}/api/rooms`

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "leave",
          playerId,
        }),
      })

      const data = await response.json()
      console.log("Leave room response:", data)

      // Always return to lobby and refresh rooms
      setCurrentScreen("lobby")
      setSelectedRoom(null)
      webApp?.BackButton.hide()

      // Force refresh rooms to update player counts
      await fetchRooms()

      if (!data.success) {
        console.warn("Leave room API returned error:", data.error)
      }
    } catch (error) {
      console.error("Error leaving room:", error)
      // Still return to lobby even if API call fails
      setCurrentScreen("lobby")
      setSelectedRoom(null)
      webApp?.BackButton.hide()
      await fetchRooms()
    }
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
    return <GameScreen room={selectedRoom} onBack={() => handleLeaveRoom(getPlayerId())} />
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
          {!user && guestId && (
            <div className="flex items-center gap-2 text-white text-sm">
              <User className="h-4 w-4" />
              <span>Guest Player</span>
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

      {/* Debug Info - Show in development */}
      {process.env.NODE_ENV === "development" && (
        <div className="bg-yellow-500 text-black p-2 text-xs">
          <div>Environment: {process.env.NODE_ENV}</div>
          <div>App URL: {process.env.NEXT_PUBLIC_APP_URL || "Not set"}</div>
          <div>Is Telegram: {webApp ? "Yes" : "No"}</div>
          <div>User ID: {user?.id || "None"}</div>
          <div>Guest ID: {guestId || "None"}</div>
          <div>Player ID: {getPlayerId()}</div>
          <div>Rooms loaded: {gameRooms.length}</div>
          {error && <div className="text-red-600">Error: {error}</div>}
        </div>
      )}

      {/* Game Rooms */}
      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="text-center text-white/70 py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p>Loading rooms...</p>
          </div>
        ) : error ? (
          <div className="text-center text-white/70 py-8">
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-4">
              <p className="text-red-300 font-medium">Failed to load rooms</p>
              <p className="text-red-200 text-sm mt-1">{error}</p>
            </div>
            <Button onClick={handleRefresh} className="bg-orange-500 hover:bg-orange-600">
              Try Again
            </Button>
          </div>
        ) : gameRooms.length === 0 ? (
          <div className="text-center text-white/70 py-8">
            <p>No rooms available. Try refreshing!</p>
            <Button onClick={handleRefresh} className="mt-4 bg-orange-500 hover:bg-orange-600">
              Refresh Rooms
            </Button>
          </div>
        ) : (
          gameRooms.map((room) => {
            const isConnecting = connectingRoomId === room.id

            return (
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
                  {room.hasBonus && (
                    <Badge className="bg-purple-500 hover:bg-purple-600 text-white text-xs">Bonus</Badge>
                  )}
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
            )
          })
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
        {!user && guestId && <div className="mt-2 text-xs">Playing as Guest • ID: {guestId.split("-")[1]}</div>}
      </div>
    </div>
  )
}
