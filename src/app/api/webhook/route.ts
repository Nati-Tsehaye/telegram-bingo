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

interface ReplyMarkup {
  inline_keyboard?: Array<
    Array<{
      text: string
      web_app?: { url: string }
      switch_inline_query?: string
    }>
  >
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://your-app-url.vercel.app"

async function sendMessage(chatId: number, text: string, replyMarkup?: ReplyMarkup) {
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
          `📚 <b>How To Play Arada Bingo</b>\n\n` +
            `<b>🎯 Game Rules:</b>\n` +
            `1️⃣ Choose a room with your preferred stake\n` +
            `2️⃣ Select your bingo board (1-100)\n` +
            `3️⃣ Mark numbers as they're called\n` +
            `4️⃣ Get 5 in a row to win the prize!\n\n` +
            `<b>💰 Winning Patterns:</b>\n` +
            `• Horizontal line (any row)\n` +
            `• Vertical line (any column)\n` +
            `• Diagonal line (corner to corner)\n\n` +
            `<b>🎮 Commands:</b>\n` +
            `🎮 /play - Start playing\n` +
            `💰 /deposit - Add funds\n` +
            `💸 /withdraw - Cash out\n` +
            `🤑 /balance - Check balance\n` +
            `🔗 /invite - Invite friends\n\n` +
            `Good luck and have fun! 🍀`,
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
          `🤑 <b>Your Account Balance</b>\n\n` +
            `💰 <b>Current Balance:</b> 0 ETB\n` +
            `🎮 <b>Games Played:</b> 0\n` +
            `🏆 <b>Games Won:</b> 0\n` +
            `💸 <b>Total Winnings:</b> 0 ETB\n` +
            `🔗 <b>Friends Invited:</b> 0\n\n` +
            `💡 <i>Start playing to build your stats and earnings!</i>`,
          {
            inline_keyboard: [
              [
                {
                  text: "💰 Deposit",
                  web_app: { url: `${APP_URL}?page=deposit` },
                },
                {
                  text: "💸 Withdraw",
                  web_app: { url: `${APP_URL}?page=withdraw` },
                },
              ],
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

      case "/deposit":
        await sendMessage(
          chatId,
          `💰 <b>Deposit Funds</b>\n\n` +
            `Add money to your Arada Bingo account to join games with higher stakes!\n\n` +
            `<b>Available Methods:</b>\n` +
            `💳 Credit/Debit Card\n` +
            `📱 Mobile Money\n` +
            `🏦 Bank Transfer\n\n` +
            `Minimum deposit: <b>10 ETB</b>`,
          {
            inline_keyboard: [
              [
                {
                  text: "💰 Deposit Now",
                  web_app: { url: `${APP_URL}?page=deposit` },
                },
              ],
            ],
          },
        )
        break

      case "/withdraw":
        await sendMessage(
          chatId,
          `💸 <b>Withdraw Winnings</b>\n\n` +
            `Cash out your winnings from Arada Bingo!\n\n` +
            `<b>Current Balance:</b> 0 ETB\n` +
            `<b>Available to Withdraw:</b> 0 ETB\n\n` +
            `<b>Withdrawal Methods:</b>\n` +
            `📱 Mobile Money\n` +
            `🏦 Bank Transfer\n\n` +
            `Minimum withdrawal: <b>50 ETB</b>`,
          {
            inline_keyboard: [
              [
                {
                  text: "💸 Withdraw Now",
                  web_app: { url: `${APP_URL}?page=withdraw` },
                },
              ],
            ],
          },
        )
        break

      case "/invite":
        await sendMessage(
          chatId,
          `🔗 <b>Invite Friends</b>\n\n` +
            `Invite your friends to Arada Bingo and earn rewards!\n\n` +
            `<b>Your Referral Benefits:</b>\n` +
            `🎁 Get 10 ETB for each friend who joins\n` +
            `💰 Earn 5% of their first deposit\n` +
            `🏆 Unlock exclusive bonuses\n\n` +
            `<b>Your Referral Link:</b>\n` +
            `https://t.me/SetbBingoBot?start=ref_${chatId}\n\n` +
            `Share this link with your friends!`,
          {
            inline_keyboard: [
              [
                {
                  text: "📤 Share Referral Link",
                  switch_inline_query: `🎮 Join me on Arada Bingo! Use my link to get bonus: https://t.me/SetbBingoBot?start=ref_${chatId}`,
                },
              ],
              [
                {
                  text: "🔗 Invite Manager",
                  web_app: { url: `${APP_URL}?page=invite` },
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
