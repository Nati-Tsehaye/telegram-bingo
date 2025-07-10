"use client"

import { useEffect, useRef, useState, useCallback } from "react"

interface RealtimeEvent {
  type: string
  data?: unknown
  timestamp?: string
  roomId?: string
}

export function useGlobalRealtime(playerId: string) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const url = `/api/events?playerId=${playerId}`
    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log("Global SSE connected for player:", playerId)
      setIsConnected(true)
      setReconnectAttempts(0)
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setLastEvent(data)

        // Handle different event types with more specific data
        switch (data.type) {
          case "room_updated":
          case "player_joined":
          case "player_left":
            // Dispatch global room update event with specific room data
            window.dispatchEvent(
              new CustomEvent("globalRoomUpdate", {
                detail: {
                  type: data.type,
                  roomId: data.roomId,
                  data: data.data,
                  timestamp: data.timestamp,
                },
              }),
            )
            break
          case "game_update":
            // Game state changed
            window.dispatchEvent(new CustomEvent("gameStateUpdate", { detail: data.data }))
            break
          case "board_selection":
            // Board selection changed
            window.dispatchEvent(new CustomEvent("boardSelectionUpdate", { detail: data.data }))
            break
          case "board_deselection":
            // Board deselection
            window.dispatchEvent(new CustomEvent("boardDeselectionUpdate", { detail: data.data }))
            break
          case "heartbeat":
            // Keep connection alive
            break
          default:
            console.log("Unknown global event type:", data.type, data)
        }
      } catch (error) {
        console.error("Error parsing global SSE message:", error)
      }
    }

    eventSource.onerror = (error) => {
      console.error("Global SSE error:", error)
      setIsConnected(false)

      // Implement exponential backoff for reconnection
      const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)

      reconnectTimeoutRef.current = setTimeout(() => {
        setReconnectAttempts((prev) => prev + 1)
        connect()
      }, backoffDelay)
    }
  }, [playerId, reconnectAttempts])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    setIsConnected(false)
  }, [])

  useEffect(() => {
    if (playerId) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [playerId, connect, disconnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    isConnected,
    lastEvent,
    reconnectAttempts,
    disconnect,
    reconnect: connect,
  }
}
