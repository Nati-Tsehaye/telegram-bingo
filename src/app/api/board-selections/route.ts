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

    console.log("GET board-selections for room:", roomId)

    if (!roomId) {
      return NextResponse.json(
        { error: "Room ID required" },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        },
      )
    }

    const selections = boardSelections.get(roomId) || []
    console.log("Returning selections:", selections)

    return NextResponse.json(
      {
        success: true,
        selections,
        selectedNumbers: selections.map((s) => s.boardNumber),
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      },
    )
  } catch (error) {
    console.error("Error fetching board selections:", error)
    return NextResponse.json(
      { error: "Failed to fetch selections" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      },
    )
  }
}

export async function POST(request: Request) {
  try {
    const { roomId, playerId, playerName, boardNumber, action } = await request.json()

    console.log("POST board-selections:", { roomId, playerId, playerName, boardNumber, action })

    if (!roomId || !playerId) {
      return NextResponse.json(
        { error: "Room ID and Player ID required" },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        },
      )
    }

    let selections = boardSelections.get(roomId) || []

    if (action === "select") {
      // Check if number is already taken by another player
      const existingSelection = selections.find((s) => s.boardNumber === boardNumber && s.playerId !== playerId)
      if (existingSelection) {
        console.log("Board already taken:", existingSelection)
        return NextResponse.json(
          {
            error: `Board ${boardNumber} is already selected by ${existingSelection.playerName}`,
            takenBy: existingSelection.playerName,
          },
          {
            status: 400,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
            },
          },
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

      console.log("Board selected successfully:", newSelection)

      return NextResponse.json(
        {
          success: true,
          message: `Board ${boardNumber} selected successfully`,
          selections,
          selectedNumbers: selections.map((s) => s.boardNumber),
        },
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        },
      )
    }

    if (action === "deselect") {
      // Remove selection by this player
      const originalLength = selections.length
      selections = selections.filter((s) => s.playerId !== playerId)
      boardSelections.set(roomId, selections)

      console.log("Board deselected:", { originalLength, newLength: selections.length })

      return NextResponse.json(
        {
          success: true,
          message: "Selection removed",
          selections,
          selectedNumbers: selections.map((s) => s.boardNumber),
        },
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        },
      )
    }

    return NextResponse.json(
      { error: "Invalid action" },
      {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      },
    )
  } catch (error) {
    console.error("Error handling board selection:", error)
    return NextResponse.json(
      { error: "Failed to handle selection" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      },
    )
  }
}

// Add OPTIONS handler for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
