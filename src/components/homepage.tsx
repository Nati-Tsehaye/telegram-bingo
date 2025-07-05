"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Users, Coins, User } from "lucide-react"
import GameScreen from "@/components/game-screen"
import { useTelegram } from "@/components/telegram-provider"
import SocketClient from "@/lib/socket-client"
import type { GameRoom, Player } from "@/lib/socket-server"

export default function Homepage() {
  const { webApp, user, isReady } = useTelegram()
  const [activeTab, setActiveTab] = useState("Stake")
  const [gameRooms, setGameRooms] = useState<GameRoom[]>([])
  const [currentScreen, setCurrentScreen] = useState<"lobby" | "game">("lobby")
  const [selectedRoom, setSelectedRoom] = useState<GameRoom | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [socketClient] = useState(() => SocketClient.getInstance())

  // Initialize socket connection
  useEffect(() => {
    if (isReady) {
      const socket = socketClient.connect()

      // Listen for room updates
      socketClient.onRoomsUpdate((rooms) => {
        setGameRooms(rooms)
      })

      socketClient.onRoomJoined((room) => {
        setSelectedRoom(room)
        setCurrentScreen("game")
        setIsConnecting(false)
      })

      socketClient.onJoinFailed((data) => {
        webApp?.showAlert(`Failed to join room: ${data.message}`)
        setIsConnecting(false)
      })

      socketClient.onRoomLeft(() => {
        setCurrentScreen("lobby")
        setSelectedRoom(null)
      })

      // Request initial room data
      socketClient.refreshRooms()

      return () => {
        socketClient.off("rooms-update")
        socketClient.off("room-joined")
        socketClient.off("join-failed")
        socketClient.off("room-left")
      }
    }
  }, [isReady, socketClient, webApp])

  const handleRefresh = useCallback(() => {
    webApp?.HapticFeedback.impactOccurred("medium")
    socketClient.refreshRooms()
    webApp?.showAlert("Rooms refreshed!")
  }, [webApp, socketClient])

  const handlePlay = (room: GameRoom) => {
    if (isConnecting) return

    webApp?.HapticFeedback.impactOccurred("heavy")

    // Show confirmation before joining
    webApp?.showConfirm(`Join room with ${room.stake} ETB stake?`, (confirmed) => {
      if (confirmed) {
        setIsConnecting(true)

        const player: Omit<Player, "joinedAt"> = {
          id: user?.id.toString() || `guest-${Date.now()}`,
          name: user?.first_name || "Guest Player",
          telegramId: user?.id,
          avatar: user?.photo_url,
        }

        socketClient.joinRoom(room.stake, player)

        // Configure back button
        webApp?.BackButton.show()
        webApp?.BackButton.onClick(() => {
          socketClient.leaveRoom(player.id)
          setCurrentScreen("lobby")
          webApp?.BackButton.hide()
        })
      }
    })
  }

  // Configure main button
  useEffect(() => {
    if (webApp) {
      webApp.MainButton.setParams({
        text: "Refresh Rooms",
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
  }, [webApp, handleRefresh])

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
        <Button
          onClick={handleRefresh}
          variant="secondary"
          className="bg-gray-600 hover:bg-gray-700 text-white border-0"
          disabled={isConnecting}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isConnecting ? "animate-spin" : ""}`} />
          Refresh
        </Button>
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
        {gameRooms.length === 0 ? (
          <div className="text-center text-white/70 py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p>Loading rooms...</p>
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
                    {room.players.length}/{room.maxPlayers}
                  </div>
                </div>

                {/* Players */}
                <div className="text-center">
                  <div className="text-2xl font-bold text-white flex items-center gap-1">
                    <Users className="h-5 w-5" />
                    {room.players.length}
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
                    disabled={isConnecting || room.status !== "waiting" || room.players.length >= room.maxPlayers}
                    className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 text-purple-300 font-bold px-6 py-2 rounded-lg border-0"
                  >
                    {isConnecting
                      ? "Joining..."
                      : room.players.length >= room.maxPlayers
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
        © Arada Bingo 2024
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
