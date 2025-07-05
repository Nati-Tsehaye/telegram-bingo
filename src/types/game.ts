export interface Player {
  id: string
  name: string
  telegramId?: number
  joinedAt: string
  isReady: boolean
}

export interface GameRoom {
  id: string
  stake: number
  players: Player[]
  maxPlayers: number
  status: "waiting" | "starting" | "active" | "finished"
  prize: number
  createdAt: string
  activeGames: number
  hasBonus: boolean
  gameStartTime?: string
  calledNumbers: number[]
  currentNumber?: number
}

export interface GameState {
  roomId: string
  calledNumbers: number[]
  currentNumber: number | null
  gameStatus: "waiting" | "active" | "finished"
  winners: Winner[]
  lastUpdate: string
  gameStartTime?: string
}

export interface Winner {
  playerId: string
  playerName: string
  winningPattern: string
  timestamp: string
}

export interface RoomResponse {
  success: boolean
  rooms: GameRoom[]
  totalPlayers: number
  timestamp: string
}

export interface JoinRoomRequest {
  action: "join" | "leave" | "ready"
  roomId?: string
  playerId: string
  playerData?: {
    name: string
    telegramId?: number
  }
}

export interface GameStateRequest {
  roomId: string
  action: "call-number" | "claim-bingo" | "start-game" | "reset-game"
  data?: {
    playerId?: string
    playerName?: string
    winningPattern?: string
  }
}
