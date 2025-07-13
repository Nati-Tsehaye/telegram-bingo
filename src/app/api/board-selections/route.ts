import { NextResponse } from "next/server"
import { GameStateManager, RateLimiter } from "@/lib/upstash-client"
import { RealtimeManager } from "@/lib/realtime-manager"

interface BoardSelection {
  roomId: string
  playerId: string
  playerName: string
  boardNumber: number
  timestamp: string
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get("roomId")
    const clientIp = request.headers.get("x-forwarded-for") || "unknown"

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

    // Rate limiting
    const canProceed = await RateLimiter.checkLimit(`boards:${clientIp}`, 60, 60)
    if (!canProceed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    const selections = await GameStateManager.getBoardSelections(roomId)
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
      {
        success: false,
        error: "Failed to fetch selections",
        details: error instanceof Error ? error.message : "Unknown error",
      },
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
    const body = await request.json()
    const { roomId, playerId, playerName, boardNumber, action } = body
    const clientIp = request.headers.get("x-forwarded-for") || "unknown"

    console.log("POST board-selections:", { roomId, playerId, playerName, boardNumber, action })

    // Validate required fields
    if (!roomId || !playerId) {
      return NextResponse.json(
        {
          success: false,
          error: "Room ID and Player ID are required",
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

    if (action === "select" && (!boardNumber || !playerName)) {
      return NextResponse.json(
        {
          success: false,
          error: "Board number and player name are required for selection",
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

    // Rate limiting
    const canProceed = await RateLimiter.checkLimit(`boardaction:${clientIp}`, 20, 60)
    if (!canProceed) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded",
        },
        { status: 429 },
      )
    }

    const selections = await GameStateManager.getBoardSelections(roomId)

    if (action === "select") {
      // Check if number is already taken by another player
      const existingSelection = selections.find((s) => s.boardNumber === boardNumber && s.playerId !== playerId)
      if (existingSelection) {
        console.log("Board already taken:", existingSelection)
        return NextResponse.json(
          {
            success: false,
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
      await GameStateManager.removeBoardSelection(roomId, playerId)

      // Add new selection
      const newSelection: BoardSelection = {
        roomId,
        playerId,
        playerName: playerName || "Unknown Player",
        boardNumber,
        timestamp: new Date().toISOString(),
      }

      await GameStateManager.setBoardSelection(roomId, playerId, newSelection)

      console.log("Board selected successfully:", newSelection)

      const updatedSelections = await GameStateManager.getBoardSelections(roomId)

      // 🚀 BROADCAST REAL-TIME UPDATE TO ALL PLAYERS IN THE ROOM
      RealtimeManager.broadcast(roomId, {
        type: "board_selection_update",
        data: {
          action: "select",
          selection: newSelection,
          allSelections: updatedSelections,
          selectedNumbers: updatedSelections.map((s) => s.boardNumber),
          timestamp: new Date().toISOString(),
        },
      })

      return NextResponse.json(
        {
          success: true,
          message: `Board ${boardNumber} selected successfully`,
          selections: updatedSelections,
          selectedNumbers: updatedSelections.map((s) => s.boardNumber),
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
      await GameStateManager.removeBoardSelection(roomId, playerId)

      console.log("Board deselected for player:", playerId)

      const updatedSelections = await GameStateManager.getBoardSelections(roomId)

      // 🚀 BROADCAST REAL-TIME UPDATE TO ALL PLAYERS IN THE ROOM
      RealtimeManager.broadcast(roomId, {
        type: "board_selection_update",
        data: {
          action: "deselect",
          playerId,
          allSelections: updatedSelections,
          selectedNumbers: updatedSelections.map((s) => s.boardNumber),
          timestamp: new Date().toISOString(),
        },
      })

      return NextResponse.json(
        {
          success: true,
          message: "Selection removed",
          selections: updatedSelections,
          selectedNumbers: updatedSelections.map((s) => s.boardNumber),
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
      {
        success: false,
        error: "Invalid action. Use 'select' or 'deselect'",
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
  } catch (error) {
    console.error("Error handling board selection:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to handle selection",
        details: error instanceof Error ? error.message : "Unknown error",
      },
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
