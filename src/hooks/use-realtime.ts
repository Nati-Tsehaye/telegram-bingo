"use client"

import { useEffect, useRef, useState, useCallback } from "react"

interface RealtimeEvent {
  type: string
  data?: any
  timestamp?: string
}

export function useRealtime(roomId: string, playerId: string) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const url = `/api/events/${roomId}?playerId=${playerId}`
    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log("SSE connected to room:", roomId)
      setIsConnected(true)
      setReconnectAttempts(0)
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setLastEvent(data)

        // Handle different event types
        switch (data.type) {
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
            console.log("Unknown event type:", data.type)
        }
      } catch (error) {
        console.error("Error parsing SSE message:", error)
      }
    }

    eventSource.onerror = (error) => {
      console.error("SSE error:", error)
      setIsConnected(false)

      // Implement exponential backoff for reconnection
      const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)

      reconnectTimeoutRef.current = setTimeout(() => {
        setReconnectAttempts((prev) => prev + 1)
        connect()
      }, backoffDelay)
    }
  }, [roomId, playerId, reconnectAttempts])

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
    if (roomId && playerId) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [roomId, playerId, connect, disconnect])

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
