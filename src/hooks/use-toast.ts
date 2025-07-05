"use client"

import { useState } from "react"

interface Toast {
  title: string
  description?: string
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = ({ title, description }: Toast) => {
    const newToast = { title, description }
    setToasts((prev) => [...prev, newToast])

    // Auto remove toast after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t !== newToast))
    }, 3000)
  }

  return { toast, toasts }
}
