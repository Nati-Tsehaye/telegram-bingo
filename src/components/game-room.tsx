"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Users, Coins, Clock } from "lucide-react"
import BingoCard from "./bingo-card"

interface GameRoomProps {
  roomId: number
  stake: number
  onBack: () => void
}

export default function GameRoom({ roomId, stake, onBack }: GameRoomProps) {
  const [gameStarted, setGameStarted] = useState(false)
  const [currentNumber, setCurrentNumber] = useState<number | null>(null)
  const [calledNumbers, setCalledNumbers] = useState<number[]>([])
  const startGame = () => {
    setGameStarted(true)
    // Simulate number calling
    const interval = setInterval(() => {
      const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1).filter((num) => !calledNumbers.includes(num))

      if (availableNumbers.length > 0) {
        const newNumber = availableNumbers[Math.floor(Math.random() * availableNumbers.length)]
        setCurrentNumber(newNumber)
        setCalledNumbers((prev) => [...prev, newNumber])
      }
    }, 3000)

    return () => clearInterval(interval)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 via-blue-700 to-blue-800">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 bg-black/20">
        <Button onClick={onBack} variant="ghost" size="icon" className="text-white hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-white text-xl font-bold">Room {roomId}</h1>
          <p className="text-white/70">Stake: {stake} ETB</p>
        </div>
      </div>

      {!gameStarted ? (
        /* Waiting Room */
        <div className="p-4">
          <Card className="bg-blue-800/50 border-blue-600/30 text-white">
            <CardContent className="p-6 text-center">
              <div className="mb-6">
                <Users className="h-12 w-12 mx-auto mb-4 text-blue-300" />
                <h2 className="text-2xl font-bold mb-2">Waiting for Players</h2>
                <p className="text-blue-200">Game will start when enough players join</p>
              </div>

              <div className="flex items-center justify-center gap-4 mb-6">
                <Badge className="bg-blue-600 text-white">
                  <Users className="h-4 w-4 mr-1" />5 Players
                </Badge>
                <Badge className="bg-green-600 text-white">
                  <Coins className="h-4 w-4 mr-1" />
                  {stake * 5} ETB Prize
                </Badge>
              </div>

              <div className="flex items-center justify-center gap-2 mb-6">
                <Clock className="h-5 w-5 text-blue-300" />
                <span className="text-blue-200">Starting in 30s</span>
              </div>

              <Button onClick={startGame} className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-3">
                Start Game Now
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Game View */
        <div className="p-4">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <BingoCard calledNumbers={calledNumbers} currentNumber={currentNumber} />
            </div>

            <div className="space-y-4">
              {/* Current Number */}
              <Card className="bg-blue-800/50 border-blue-600/30 text-white">
                <CardContent className="p-4 text-center">
                  <h3 className="text-lg font-bold mb-2">Current Number</h3>
                  <div className="text-4xl font-bold text-yellow-400">{currentNumber || "--"}</div>
                </CardContent>
              </Card>

              {/* Called Numbers */}
              <Card className="bg-blue-800/50 border-blue-600/30 text-white">
                <CardContent className="p-4">
                  <h3 className="text-lg font-bold mb-2">Called Numbers</h3>
                  <div className="grid grid-cols-5 gap-1 max-h-32 overflow-y-auto">
                    {calledNumbers.map((num) => (
                      <div
                        key={num}
                        className="bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded text-center"
                      >
                        {num}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Players */}
              <Card className="bg-blue-800/50 border-blue-600/30 text-white">
                <CardContent className="p-4">
                  <h3 className="text-lg font-bold mb-2">Players (5)</h3>
                  <div className="space-y-2">
                    {["Player 1", "Player 2", "Player 3", "Player 4", "You"].map((name, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm">{name}</span>
                        <Badge variant="outline" className="text-xs">
                          Playing
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
