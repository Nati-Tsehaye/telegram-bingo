import { NextResponse } from "next/server"

interface BoardSelection {
  roomId: string
  playerId: string
  playerName: string
  boardNumber: number
  timestamp: string
}

// In-memory storage for board selections (replace with Redis/Database in production)
const boardSelections = new Map<string, BoardSelection[]>() // roomId -> selections[]

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get("roomId")

    if (!roomId) {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 })
    }

    const selections = boardSelections.get(roomId) || []

    return NextResponse.json({
      success: true,
      selections,
      selectedNumbers: selections.map((s) => s.boardNumber),
    })
  } catch (error) {
    console.error("Error fetching board selections:", error)
    return NextResponse.json({ error: "Failed to fetch selections" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { roomId, playerId, playerName, boardNumber, action } = await request.json()

    if (!roomId || !playerId) {
      return NextResponse.json({ error: "Room ID and Player ID required" }, { status: 400 })
    }

    let selections = boardSelections.get(roomId) || []

    if (action === "select") {
      // Check if number is already taken by another player
      const existingSelection = selections.find((s) => s.boardNumber === boardNumber && s.playerId !== playerId)
      if (existingSelection) {
        return NextResponse.json(
          {
            error: `Board ${boardNumber} is already selected by ${existingSelection.playerName}`,
            takenBy: existingSelection.playerName,
          },
          { status: 400 },
        )
      }

      // Remove any previous selection by this player
      selections = selections.filter((s) => s.playerId !== playerId)

      // Add new selection
      const newSelection: BoardSelection = {
        roomId,
        playerId,
        playerName: playerName || "Unknown Player",
        boardNumber,
        timestamp: new Date().toISOString(),
      }

      selections.push(newSelection)
      boardSelections.set(roomId, selections)

      return NextResponse.json({
        success: true,
        message: `Board ${boardNumber} selected successfully`,
        selections,
        selectedNumbers: selections.map((s) => s.boardNumber),
      })
    }

    if (action === "deselect") {
      // Remove selection by this player
      selections = selections.filter((s) => s.playerId !== playerId)
      boardSelections.set(roomId, selections)

      return NextResponse.json({
        success: true,
        message: "Selection removed",
        selections,
        selectedNumbers: selections.map((s) => s.boardNumber),
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Error handling board selection:", error)
    return NextResponse.json({ error: "Failed to handle selection" }, { status: 500 })
  }
}
//test