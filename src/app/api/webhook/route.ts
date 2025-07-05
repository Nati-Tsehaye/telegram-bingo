import { type NextRequest, NextResponse } from "next/server"

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from: {
      id: number
      is_bot: boolean
      first_name: string
      last_name?: string
      username?: string
    }
    chat: {
      id: number
      type: string
    }
    date: number
    text?: string
  }
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://your-app-url.vercel.app"

async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN is not set")
    return
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: replyMarkup,
        parse_mode: "HTML",
      }),
    })

    if (!response.ok) {
      console.error("Failed to send message:", await response.text())
    }
  } catch (error) {
    console.error("Error sending message:", error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json()

    if (!update.message) {
      return NextResponse.json({ ok: true })
    }

    const { message } = update
    const chatId = message.chat.id
    const text = message.text || ""
    const firstName = message.from.first_name

    // Handle different commands
    switch (text) {
      case "/start":
        await sendMessage(
          chatId,
          `🎉 Welcome to <b>Arada Bingo</b>, ${firstName}!\n\n` +
            `🎯 Play exciting bingo games with friends\n` +
            `💰 Win real prizes\n` +
            `🚀 Join rooms with different stakes\n\n` +
            `Tap the button below to start playing!`,
          {
            inline_keyboard: [
              [
                {
                  text: "🎮 Play Arada Bingo",
                  web_app: { url: APP_URL },
                },
              ],
            ],
          },
        )
        break

      case "/help":
        await sendMessage(
          chatId,
          `🆘 <b>Arada Bingo Help</b>\n\n` +
            `<b>Commands:</b>\n` +
            `/start - Start the game\n` +
            `/play - Quick play\n` +
            `/rooms - Show available rooms\n` +
            `/balance - Check your balance\n` +
            `/help - Show this help\n\n` +
            `<b>How to Play:</b>\n` +
            `1️⃣ Choose a room with your preferred stake\n` +
            `2️⃣ Select your bingo board\n` +
            `3️⃣ Mark numbers as they're called\n` +
            `4️⃣ Get 5 in a row to win!\n\n` +
            `Good luck! 🍀`,
          {
            inline_keyboard: [
              [
                {
                  text: "🎮 Play Now",
                  web_app: { url: APP_URL },
                },
              ],
            ],
          },
        )
        break

      case "/play":
        await sendMessage(
          chatId,
          `🎯 <b>Quick Play</b>\n\n` +
            `Ready to jump into a game? Tap the button below to find an available room and start playing immediately!`,
          {
            inline_keyboard: [
              [
                {
                  text: "🚀 Quick Play",
                  web_app: { url: `${APP_URL}?mode=quickplay` },
                },
              ],
            ],
          },
        )
        break

      case "/rooms":
        await sendMessage(
          chatId,
          `🏠 <b>Game Rooms</b>\n\n` +
            `Browse all available game rooms, check stakes, prizes, and player counts. Find the perfect room for your playing style!`,
          {
            inline_keyboard: [
              [
                {
                  text: "🏠 Browse Rooms",
                  web_app: { url: `${APP_URL}?tab=rooms` },
                },
              ],
            ],
          },
        )
        break

      case "/balance":
        await sendMessage(
          chatId,
          `💰 <b>Your Balance</b>\n\n` +
            `Current Balance: <b>0 ETB</b>\n` +
            `Games Played: <b>0</b>\n` +
            `Games Won: <b>0</b>\n\n` +
            `💡 <i>Start playing to build your stats!</i>`,
          {
            inline_keyboard: [
              [
                {
                  text: "🎮 Start Playing",
                  web_app: { url: APP_URL },
                },
              ],
            ],
          },
        )
        break

      default:
        // For any other message, show the main menu
        await sendMessage(
          chatId,
          `🎲 <b>Arada Bingo</b>\n\n` +
            `I didn't understand that command. Here's what you can do:\n\n` +
            `🎮 Play bingo games\n` +
            `🏠 Browse game rooms\n` +
            `💰 Check your balance\n` +
            `🆘 Get help\n\n` +
            `Use the menu button or tap below to start!`,
          {
            inline_keyboard: [
              [
                {
                  text: "🎮 Play Arada Bingo",
                  web_app: { url: APP_URL },
                },
              ],
            ],
          },
        )
        break
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: "Telegram webhook endpoint" })
}
