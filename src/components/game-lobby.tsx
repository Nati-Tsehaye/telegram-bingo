"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Users, Crown, Copy, Play, ArrowLeft, UserCheck, Clock } from "lucide-react"

interface Player {
  id: string
  name: string
  avatar?: string
  isHost: boolean
  isReady: boolean
  score: number
}

interface GameRoom {
  id: string
  name: string
  players: Player[]
  maxPlayers: number
  isStarted: boolean
  currentNumber?: number
  calledNumbers: number[]
}

interface GameLobbyProps {
  room: GameRoom
  currentPlayer: Player
  onStartGame: () => void
  onLeaveRoom: () => void
  onCopyRoomCode: () => void
}

export default function GameLobby({ room, currentPlayer, onStartGame, onLeaveRoom, onCopyRoomCode }: GameLobbyProps) {
  const readyPlayers = room.players.filter((p) => p.isReady).length
  const canStart = currentPlayer.isHost && readyPlayers >= 2

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={onLeaveRoom}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Game Lobby</h1>
            <p className="text-gray-600">{room.name}</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Room Code
                </span>
                <Button variant="outline" size="sm" onClick={onCopyRoomCode}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 tracking-wider mb-2">{room.id}</div>
                <p className="text-sm text-gray-600">Share this code with friends to join</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Players ({room.players.length}/{room.maxPlayers})
                </span>
                <Badge variant="secondary">{readyPlayers} Ready</Badge>
              </CardTitle>
              <CardDescription>Waiting for players to join and get ready</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {room.players.map((player) => (
                  <div key={player.id} className="flex items-center justify-between p-3 rounded-lg border bg-white">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={player.avatar || "/placeholder.svg"} />
                        <AvatarFallback>{player.name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{player.name}</span>
                          {player.isHost && <Crown className="h-4 w-4 text-yellow-500" />}
                          {player.id === currentPlayer.id && (
                            <Badge variant="outline" className="text-xs">
                              You
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{player.isHost ? "Host" : "Player"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {player.isReady ? (
                        <Badge className="bg-green-500 hover:bg-green-600">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Ready
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          Waiting
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}

                {/* Empty slots */}
                {Array.from({ length: room.maxPlayers - room.players.length }, (_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-gray-300 bg-gray-50"
                  >
                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <Users className="h-5 w-5 text-gray-400" />
                    </div>
                    <span className="text-gray-500">Waiting for player...</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Game Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Mark numbers on your bingo card as they are called</li>
                <li>• Get 5 in a row (horizontal, vertical, or diagonal) to win</li>
                <li>• The center square is a FREE space</li>
                <li>• First player to get BINGO wins the round</li>
                <li>• Have fun and good luck!</li>
              </ul>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            {!currentPlayer.isReady && (
              <Button className="flex-1 bg-transparent" variant="outline">
                <UserCheck className="h-4 w-4 mr-2" />
                Ready Up
              </Button>
            )}

            {currentPlayer.isHost && (
              <Button onClick={onStartGame} disabled={!canStart} className="flex-1 bg-purple-600 hover:bg-purple-700">
                <Play className="h-4 w-4 mr-2" />
                Start Game
                {!canStart && ` (Need ${Math.max(2 - readyPlayers, 0)} more ready)`}
              </Button>
            )}
          </div>

          {!currentPlayer.isHost && (
            <div className="text-center text-sm text-gray-600">Waiting for host to start the game...</div>
          )}
        </div>
      </div>
    </div>
  )
}
