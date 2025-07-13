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
    console.log(`📡 Connecting to SSE: ${url}`)

    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log(`📡 SSE connected to room: ${roomId}`)
      setIsConnected(true)
      setReconnectAttempts(0)
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log(`📡 SSE message received:`, data)
        setLastEvent(data)

        // Handle different event types and dispatch custom events
        switch (data.type) {
          case "board_selection_update":
            console.log(`🎯 Board selection update:`, data.data)
            window.dispatchEvent(new CustomEvent("boardSelectionUpdate", { detail: data.data }))
            break

          case "number_called":
            console.log(`🎲 Number called:`, data.data.newNumber)
            window.dispatchEvent(new CustomEvent("gameStateUpdate", { detail: data.data.gameState }))
            break

          case "game_started":
            console.log(`🎮 Game started`)
            window.dispatchEvent(new CustomEvent("gameStateUpdate", { detail: data.data }))
            break

          case "game_finished":
            console.log(`🏁 Game finished`)
            window.dispatchEvent(new CustomEvent("gameStateUpdate", { detail: data.data }))
            break

          case "bingo_claimed":
            console.log(`🎉 BINGO claimed by:`, data.data.winner.playerName)
            window.dispatchEvent(new CustomEvent("gameStateUpdate", { detail: data.data.gameState }))
            break

          case "game_reset":
            console.log(`🔄 Game reset`)
            window.dispatchEvent(new CustomEvent("gameStateUpdate", { detail: data.data }))
            break

          case "connected":
            console.log(`🔌 Connected to room ${data.roomId}`)
            break

          case "heartbeat":
            // Keep connection alive - no action needed
            break

          default:
            console.log(`📡 Unknown event type: ${data.type}`, data)
        }
      } catch (error) {
        console.error("📡 Error parsing SSE message:", error, event.data)
      }
    }

    eventSource.onerror = (error) => {
      console.error(`📡 SSE error for room ${roomId}:`, error)
      setIsConnected(false)

      // Implement exponential backoff for reconnection
      const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
      console.log(`📡 Reconnecting in ${backoffDelay}ms (attempt ${reconnectAttempts + 1})`)

      reconnectTimeoutRef.current = setTimeout(() => {
        setReconnectAttempts((prev) => prev + 1)
        connect()
      }, backoffDelay)
    }
  }, [roomId, playerId, reconnectAttempts])

  const disconnect = useCallback(() => {
    console.log(`📡 Disconnecting from room ${roomId}`)

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    setIsConnected(false)
  }, [roomId])

  useEffect(() => {
    if (roomId && playerId) {
      console.log(`📡 Setting up real-time connection for room ${roomId}, player ${playerId}`)
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
