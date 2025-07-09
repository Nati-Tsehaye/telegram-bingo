"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: TelegramUser
    chat_instance?: string
    chat_type?: string
    start_param?: string
  }
  version: string
  platform: string
  colorScheme: "light" | "dark"
  themeParams: {
    link_color?: string
    button_color?: string
    button_text_color?: string
    secondary_bg_color?: string
    hint_color?: string
    bg_color?: string
    text_color?: string
  }
  isExpanded: boolean
  viewportHeight: number
  viewportStableHeight: number
  headerColor: string
  backgroundColor: string
  isClosingConfirmationEnabled: boolean
  ready: () => void
  expand: () => void
  close: () => void
  MainButton: {
    text: string
    color: string
    textColor: string
    isVisible: boolean
    isActive: boolean
    isProgressVisible: boolean
    setText: (text: string) => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
    show: () => void
    hide: () => void
    enable: () => void
    disable: () => void
    showProgress: (leaveActive?: boolean) => void
    hideProgress: () => void
    setParams: (params: {
      text?: string
      color?: string
      text_color?: string
      is_active?: boolean
      is_visible?: boolean
    }) => void
  }
  BackButton: {
    isVisible: boolean
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
    show: () => void
    hide: () => void
  }
  HapticFeedback: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void
    notificationOccurred: (type: "error" | "success" | "warning") => void
    selectionChanged: () => void
  }
  showPopup: (
    params: {
      title?: string
      message: string
      buttons?: Array<{
        id?: string
        type?: "default" | "ok" | "close" | "cancel" | "destructive"
        text?: string
      }>
    },
    callback?: (buttonId: string) => void,
  ) => void
  showAlert: (message: string, callback?: () => void) => void
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void
  sendData: (data: string) => void
  onEvent?: (eventType: string, eventHandler: () => void) => void
  offEvent?: (eventType: string, eventHandler: () => void) => void
  enableClosingConfirmation?: () => void
}

interface TelegramContextType {
  webApp: TelegramWebApp | null
  user: TelegramUser | null
  isReady: boolean
  guestId: string | null // Add guestId to context
}

const TelegramContext = createContext<TelegramContextType>({
  webApp: null,
  user: null,
  isReady: false,
  guestId: null,
})

export const useTelegram = () => {
  const context = useContext(TelegramContext)
  if (!context) {
    throw new Error("useTelegram must be used within TelegramProvider")
  }
  return context
}

interface TelegramProviderProps {
  children: ReactNode
}

// Helper function to generate a persistent guest ID
function getOrCreateGuestId(): string {
  const GUEST_ID_KEY = "arada_bingo_guest_id"

  // Try to get existing guest ID from localStorage
  if (typeof window !== "undefined") {
    try {
      const existingId = localStorage.getItem(GUEST_ID_KEY)
      if (existingId) {
        console.log("🔄 Using existing guest ID:", existingId)
        return existingId
      }
    } catch (error) {
      console.warn("Failed to read from localStorage:", error)
    }
  }

  // Generate new guest ID with timestamp and random component
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const newGuestId = `guest-${timestamp}-${random}`

  // Save to localStorage
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(GUEST_ID_KEY, newGuestId)
      console.log("✨ Created new guest ID:", newGuestId)
    } catch (error) {
      console.warn("Failed to save to localStorage:", error)
    }
  }

  return newGuestId
}

export default function TelegramProvider({ children }: TelegramProviderProps) {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null)
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [guestId, setGuestId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const tg = (window as unknown as { Telegram?: { WebApp: TelegramWebApp } }).Telegram?.WebApp

      if (tg) {
        tg.ready()
        tg.expand()

        // Enable closing confirmation if available
        if (tg.enableClosingConfirmation) {
          tg.enableClosingConfirmation()
        }

        // Set theme colors
        if (tg.themeParams) {
          const root = document.documentElement
          if (tg.themeParams.bg_color) {
            root.style.setProperty("--tg-theme-bg-color", tg.themeParams.bg_color)
          }
          if (tg.themeParams.text_color) {
            root.style.setProperty("--tg-theme-text-color", tg.themeParams.text_color)
          }
          if (tg.themeParams.button_color) {
            root.style.setProperty("--tg-theme-button-color", tg.themeParams.button_color)
          }
        }

        // Add network status monitoring
        const handleOnline = () => {
          console.log("Network: Online")
          tg.showAlert?.("Connection restored!")
        }

        const handleOffline = () => {
          console.log("Network: Offline")
          tg.showAlert?.("Connection lost. Please check your internet.")
        }

        window.addEventListener("online", handleOnline)
        window.addEventListener("offline", handleOffline)

        setWebApp(tg)
        setUser(tg.initDataUnsafe?.user || null)

        // Set guest ID only if no Telegram user
        if (!tg.initDataUnsafe?.user) {
          const persistentGuestId = getOrCreateGuestId()
          setGuestId(persistentGuestId)
        }

        setIsReady(true)

        // Handle viewport changes
        const handleViewportChanged = () => {
          console.log("Viewport changed")
          // Force a re-render when viewport changes
          setIsReady((prev) => !prev)
          setTimeout(() => setIsReady(true), 0)
        }

        tg.onEvent?.("viewportChanged", handleViewportChanged)

        return () => {
          tg.offEvent?.("viewportChanged", handleViewportChanged)
          window.removeEventListener("online", handleOnline)
          window.removeEventListener("offline", handleOffline)
        }
      } else {
        // For development/testing outside Telegram
        console.warn("Telegram WebApp not available. Running in development mode.")
        const persistentGuestId = getOrCreateGuestId()
        setGuestId(persistentGuestId)
        setIsReady(true)
      }
    }
  }, [])

  return <TelegramContext.Provider value={{ webApp, user, isReady, guestId }}>{children}</TelegramContext.Provider>
}
