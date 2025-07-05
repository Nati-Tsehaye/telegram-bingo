"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface BingoCardProps {
  calledNumbers: number[]
  currentNumber?: number
}

export default function BingoCard({ calledNumbers, currentNumber }: BingoCardProps) {
  const [bingoNumbers, setBingoNumbers] = useState<number[][]>([])
  const [markedCells, setMarkedCells] = useState<boolean[][]>([])
  const [hasWon, setHasWon] = useState(false)
  const { toast } = useToast()

  const checkForWin = useCallback(
    (marked: boolean[][]) => {
      // Check rows
      for (let row = 0; row < 5; row++) {
        if (marked.every((col) => col[row])) {
          setHasWon(true)
          toast({
            title: "🎉 BINGO!",
            description: "You got a horizontal line!",
          })
          return
        }
      }

      // Check columns
      for (let col = 0; col < 5; col++) {
        if (marked[col].every((cell) => cell)) {
          setHasWon(true)
          toast({
            title: "🎉 BINGO!",
            description: "You got a vertical line!",
          })
          return
        }
      }

      // Check diagonals
      if (marked.every((col, index) => col[index])) {
        setHasWon(true)
        toast({
          title: "🎉 BINGO!",
          description: "You got a diagonal line!",
        })
        return
      }

      if (marked.every((col, index) => col[4 - index])) {
        setHasWon(true)
        toast({
          title: "🎉 BINGO!",
          description: "You got a diagonal line!",
        })
        return
      }
    },
    [toast],
  )

  // Generate bingo card
  useEffect(() => {
    const generateCard = () => {
      const card: number[][] = []
      const marked: boolean[][] = []

      for (let col = 0; col < 5; col++) {
        const column: number[] = []
        const markedColumn: boolean[] = []
        const min = col * 15 + 1
        const max = col * 15 + 15
        const usedNumbers = new Set<number>()

        for (let row = 0; row < 5; row++) {
          if (col === 2 && row === 2) {
            // Free space in the middle
            column.push(0)
            markedColumn.push(true)
          } else {
            let num: number
            do {
              num = Math.floor(Math.random() * (max - min + 1)) + min
            } while (usedNumbers.has(num))
            usedNumbers.add(num)
            column.push(num)
            markedColumn.push(false)
          }
        }
        card.push(column)
        marked.push(markedColumn)
      }

      setBingoNumbers(card)
      setMarkedCells(marked)
    }

    generateCard()
  }, [])

  // Auto-mark called numbers
  useEffect(() => {
    if (calledNumbers.length > 0 && bingoNumbers.length > 0) {
      const newMarked = [...markedCells]
      let hasNewMarks = false

      for (let col = 0; col < 5; col++) {
        for (let row = 0; row < 5; row++) {
          const cellNumber = bingoNumbers[col][row]
          if (cellNumber > 0 && calledNumbers.includes(cellNumber) && !markedCells[col][row]) {
            newMarked[col][row] = true
            hasNewMarks = true
          }
        }
      }

      if (hasNewMarks) {
        setMarkedCells(newMarked)
        checkForWin(newMarked)
      }
    }
  }, [calledNumbers, bingoNumbers, markedCells, checkForWin])

  const toggleCell = (col: number, row: number) => {
    if (bingoNumbers[col][row] === 0) return // Free space

    const newMarked = [...markedCells]
    newMarked[col][row] = !newMarked[col][row]
    setMarkedCells(newMarked)
    checkForWin(newMarked)
  }

  const generateNewCard = () => {
    const card: number[][] = []
    const marked: boolean[][] = []

    for (let col = 0; col < 5; col++) {
      const column: number[] = []
      const markedColumn: boolean[] = []
      const min = col * 15 + 1
      const max = col * 15 + 15
      const usedNumbers = new Set<number>()

      for (let row = 0; row < 5; row++) {
        if (col === 2 && row === 2) {
          column.push(0)
          markedColumn.push(true)
        } else {
          let num: number
          do {
            num = Math.floor(Math.random() * (max - min + 1)) + min
          } while (usedNumbers.has(num))
          usedNumbers.add(num)
          column.push(num)
          markedColumn.push(false)
        }
      }
      card.push(column)
      marked.push(markedColumn)
    }

    setBingoNumbers(card)
    setMarkedCells(marked)
    setHasWon(false)
  }

  if (bingoNumbers.length === 0) {
    return <div>Loading bingo card...</div>
  }

  return (
    <Card className={`${hasWon ? "ring-4 ring-yellow-400 bg-yellow-50" : ""}`}>
      <CardHeader className="text-center pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold">
            {hasWon ? (
              <span className="flex items-center gap-2 text-yellow-600">
                <Sparkles className="h-6 w-6" />
                BINGO!
                <Sparkles className="h-6 w-6" />
              </span>
            ) : (
              "Your Bingo Card"
            )}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={generateNewCard}>
            New Card
          </Button>
        </div>
        <div className="flex justify-center gap-4 text-lg font-bold text-purple-600">
          <span>B</span>
          <span>I</span>
          <span>N</span>
          <span>G</span>
          <span>O</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-2 max-w-md mx-auto">
          {Array.from({ length: 5 }, (_, row) =>
            Array.from({ length: 5 }, (_, col) => {
              const number = bingoNumbers[col][row]
              const isMarked = markedCells[col][row]
              const isFreeSpace = col === 2 && row === 2
              const isCurrentNumber = number === currentNumber

              return (
                <Button
                  key={`${col}-${row}`}
                  variant={isMarked ? "default" : "outline"}
                  className={`
                    aspect-square p-0 text-sm font-bold h-12 w-12
                    ${isMarked ? "bg-purple-600 hover:bg-purple-700 text-white" : ""}
                    ${isFreeSpace ? "bg-green-500 hover:bg-green-600 text-white" : ""}
                    ${isCurrentNumber ? "ring-2 ring-yellow-400 animate-pulse" : ""}
                    ${hasWon ? "animate-bounce" : ""}
                  `}
                  onClick={() => toggleCell(col, row)}
                  disabled={isFreeSpace}
                >
                  {isFreeSpace ? "FREE" : number}
                </Button>
              )
            }),
          )}
        </div>

        {currentNumber && (
          <div className="mt-4 text-center">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              Current: {currentNumber}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
