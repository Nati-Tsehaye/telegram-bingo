// Real-time event management for board selections and game updates

interface Connection {
  write: (data: string) => void
  close: () => void
  isActive: () => boolean
}

export class RealtimeManager {
  private static connections = new Map<string, Set<Connection>>()

  // Add a connection to a room
  static addConnection(roomId: string, connection: Connection) {
    if (!this.connections.has(roomId)) {
      this.connections.set(roomId, new Set())
    }
    this.connections.get(roomId)!.add(connection)
    console.log(`📡 Added connection to room ${roomId}, total: ${this.connections.get(roomId)!.size}`)
  }

  // Remove a connection from a room
  static removeConnection(roomId: string, connection: Connection) {
    const roomConnections = this.connections.get(roomId)
    if (roomConnections) {
      roomConnections.delete(connection)
      console.log(`📡 Removed connection from room ${roomId}, remaining: ${roomConnections.size}`)

      if (roomConnections.size === 0) {
        this.connections.delete(roomId)
        console.log(`🗑️ Cleaned up empty room ${roomId}`)
      }
    }
  }

  // Broadcast an event to all connections in a room
  static broadcast(roomId: string, event: { type: string; data: any }) {
    const roomConnections = this.connections.get(roomId)
    if (!roomConnections || roomConnections.size === 0) {
      console.log(`📡 No connections to broadcast to in room ${roomId}`)
      return
    }

    const message = `data: ${JSON.stringify(event)}\n\n`
    const deadConnections: Connection[] = []

    roomConnections.forEach((connection) => {
      try {
        if (connection.isActive()) {
          connection.write(message)
        } else {
          deadConnections.push(connection)
        }
      } catch (error) {
        console.log(`📡 Dead connection detected in room ${roomId}`)
        deadConnections.push(connection)
      }
    })

    // Clean up dead connections
    deadConnections.forEach((deadConnection) => {
      this.removeConnection(roomId, deadConnection)
    })

    console.log(
      `📡 Broadcasted ${event.type} to ${roomConnections.size - deadConnections.length} connections in room ${roomId}`,
    )
  }

  // Get connection count for a room
  static getConnectionCount(roomId: string): number {
    return this.connections.get(roomId)?.size || 0
  }

  // Clean up all connections for a room
  static cleanupRoom(roomId: string) {
    const roomConnections = this.connections.get(roomId)
    if (roomConnections) {
      roomConnections.forEach((connection) => {
        try {
          connection.close()
        } catch (error) {
          console.log(`Error closing connection: ${error}`)
        }
      })
      this.connections.delete(roomId)
      console.log(`🧹 Cleaned up all connections for room ${roomId}`)
    }
  }
}
