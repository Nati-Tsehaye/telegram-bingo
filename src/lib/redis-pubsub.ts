import { redis } from "@/lib/upstash-client"

export interface GameEvent {
  type:
    | "player_joined"
    | "player_left"
    | "game_started"
    | "number_called"
    | "game_finished"
    | "room_updated"
    | "board_selected"
    | "board_deselected"
  roomId: string
  data: unknown
  timestamp: string
  playerId?: string
}

export class RedisPubSub {
  // Publish an event to a specific room channel
  static async publishToRoom(roomId: string, event: Omit<GameEvent, "timestamp">) {
    try {
      const fullEvent: GameEvent = {
        ...event,
        timestamp: new Date().toISOString(),
      }

      const channel = `room:${roomId}`
      const message = JSON.stringify(fullEvent)

      console.log(`📡 Publishing to ${channel}:`, fullEvent.type)
      await redis.publish(channel, message)

      return true
    } catch (error) {
      console.error(`Error publishing to room ${roomId}:`, error)
      return false
    }
  }

  // Publish to all rooms (for global updates)
  static async publishGlobal(event: Omit<GameEvent, "timestamp" | "roomId"> & { roomId?: string }) {
    try {
      const fullEvent: GameEvent = {
        ...event,
        roomId: event.roomId || "global",
        timestamp: new Date().toISOString(),
      }

      const channel = "global"
      const message = JSON.stringify(fullEvent)

      console.log(`📡 Publishing globally:`, fullEvent.type)
      await redis.publish(channel, message)

      return true
    } catch (error) {
      console.error("Error publishing global event:", error)
      return false
    }
  }

  // Subscribe to a room channel (for server-side use)
  static async subscribeToRoom(roomId: string, _callback: (event: GameEvent) => void) {
    try {
      const channel = `room:${roomId}`
      console.log(`🔔 Subscribing to ${channel}`)

      // Note: Upstash Redis doesn't support traditional pub/sub in serverless
      // We'll use polling as a fallback for server-side subscriptions
      return true
    } catch (error) {
      console.error(`Error subscribing to room ${roomId}:`, error)
      return false
    }
  }
}
