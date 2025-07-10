import type { GameEvent } from "@/lib/redis-pubsub"

export interface SSEConnection {
  id: string
  roomId: string
  playerId: string
  controller: ReadableStreamDefaultController
  lastHeartbeat: number
}

export class SSEManager {
  private static connections = new Map<string, SSEConnection>()
  private static heartbeatInterval: NodeJS.Timeout | null = null

  // Add a new SSE connection
  static addConnection(
    connectionId: string,
    roomId: string,
    playerId: string,
    controller: ReadableStreamDefaultController,
  ) {
    const connection: SSEConnection = {
      id: connectionId,
      roomId,
      playerId,
      controller,
      lastHeartbeat: Date.now(),
    }

    this.connections.set(connectionId, connection)
    console.log(`📡 SSE connection added: ${connectionId} (Room: ${roomId}, Player: ${playerId})`)
    console.log(`📊 Total connections: ${this.connections.size}`)

    // Start heartbeat if this is the first connection
    if (this.connections.size === 1) {
      this.startHeartbeat()
    }

    return connection
  }

  // Remove an SSE connection
  static removeConnection(connectionId: string) {
    const connection = this.connections.get(connectionId)
    if (connection) {
      try {
        connection.controller.close()
      } catch (error) {
        console.warn(`Error closing SSE connection ${connectionId}:`, error)
      }

      this.connections.delete(connectionId)
      console.log(`📡 SSE connection removed: ${connectionId}`)
      console.log(`📊 Total connections: ${this.connections.size}`)

      // Stop heartbeat if no connections remain
      if (this.connections.size === 0) {
        this.stopHeartbeat()
      }
    }
  }

  // Send event to all connections in a room
  static sendToRoom(roomId: string, event: GameEvent) {
    const roomConnections = Array.from(this.connections.values()).filter((conn) => conn.roomId === roomId)

    console.log(`📤 Sending ${event.type} to ${roomConnections.length} connections in room ${roomId}`)

    let successCount = 0
    const failedConnections: string[] = []

    for (const connection of roomConnections) {
      try {
        const data = `data: ${JSON.stringify(event)}\n\n`
        connection.controller.enqueue(data)
        connection.lastHeartbeat = Date.now()
        successCount++
      } catch (error) {
        console.warn(`Failed to send to connection ${connection.id}:`, error)
        failedConnections.push(connection.id)
      }
    }

    // Clean up failed connections
    for (const failedId of failedConnections) {
      this.removeConnection(failedId)
    }

    console.log(`✅ Sent to ${successCount} connections, ${failedConnections.length} failed`)
  }

  // Send event to a specific player
  static sendToPlayer(playerId: string, event: GameEvent) {
    const playerConnections = Array.from(this.connections.values()).filter((conn) => conn.playerId === playerId)

    console.log(`📤 Sending ${event.type} to player ${playerId} (${playerConnections.length} connections)`)

    for (const connection of playerConnections) {
      try {
        const data = `data: ${JSON.stringify(event)}\n\n`
        connection.controller.enqueue(data)
        connection.lastHeartbeat = Date.now()
      } catch (error) {
        console.warn(`Failed to send to player ${playerId} connection ${connection.id}:`, error)
        this.removeConnection(connection.id)
      }
    }
  }

  // Send to all connections (global broadcast)
  static sendToAll(event: GameEvent) {
    console.log(`📤 Broadcasting ${event.type} to all ${this.connections.size} connections`)

    let successCount = 0
    const failedConnections: string[] = []

    for (const connection of this.connections.values()) {
      try {
        const data = `data: ${JSON.stringify(event)}\n\n`
        connection.controller.enqueue(data)
        connection.lastHeartbeat = Date.now()
        successCount++
      } catch (error) {
        console.warn(`Failed to broadcast to connection ${connection.id}:`, error)
        failedConnections.push(connection.id)
      }
    }

    // Clean up failed connections
    for (const failedId of failedConnections) {
      this.removeConnection(failedId)
    }

    console.log(`✅ Broadcast to ${successCount} connections, ${failedConnections.length} failed`)
  }

  // Start heartbeat to keep connections alive and clean up stale ones
  private static startHeartbeat() {
    if (this.heartbeatInterval) return

    console.log(`💓 Starting SSE heartbeat`)
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now()
      const staleConnections: string[] = []

      // Send heartbeat and identify stale connections
      for (const [connectionId, connection] of this.connections.entries()) {
        try {
          // Check if connection is stale (no activity for 2 minutes)
          if (now - connection.lastHeartbeat > 120000) {
            staleConnections.push(connectionId)
            continue
          }

          // Send heartbeat
          const heartbeat = `data: ${JSON.stringify({
            type: "heartbeat",
            timestamp: new Date().toISOString(),
            roomId: connection.roomId,
          })}\n\n`

          connection.controller.enqueue(heartbeat)
          connection.lastHeartbeat = now
        } catch (error) {
          console.warn(`Heartbeat failed for connection ${connectionId}:`, error)
          staleConnections.push(connectionId)
        }
      }

      // Clean up stale connections
      for (const staleId of staleConnections) {
        console.log(`🧹 Removing stale SSE connection: ${staleId}`)
        this.removeConnection(staleId)
      }

      if (this.connections.size > 0) {
        console.log(
          `💓 Heartbeat sent to ${this.connections.size} connections, removed ${staleConnections.length} stale`,
        )
      }
    }, 30000) // Every 30 seconds
  }

  // Stop heartbeat
  private static stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
      console.log(`💓 SSE heartbeat stopped`)
    }
  }

  // Get connection stats
  static getStats() {
    const roomStats = new Map<string, number>()

    for (const connection of this.connections.values()) {
      const count = roomStats.get(connection.roomId) || 0
      roomStats.set(connection.roomId, count + 1)
    }

    return {
      totalConnections: this.connections.size,
      roomBreakdown: Object.fromEntries(roomStats.entries()),
    }
  }

  // Clean up all connections (for shutdown)
  static cleanup() {
    console.log(`🧹 Cleaning up ${this.connections.size} SSE connections`)

    for (const connection of this.connections.values()) {
      try {
        connection.controller.close()
      } catch (error) {
        console.warn(`Error closing connection during cleanup:`, error)
      }
    }

    this.connections.clear()
    this.stopHeartbeat()
  }
}
