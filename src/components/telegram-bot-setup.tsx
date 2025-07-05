"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Copy, ExternalLink, CheckCircle } from "lucide-react"

export default function TelegramBotSetup() {
  const [copiedStep, setCopiedStep] = useState<number | null>(null)

  const copyToClipboard = (text: string, step: number) => {
    navigator.clipboard.writeText(text)
    setCopiedStep(step)
    setTimeout(() => setCopiedStep(null), 2000)
  }

  const botCommands = [
    {
      command: "/start",
      description: "Start the Arada Bingo game",
    },
    {
      command: "/help",
      description: "Show help information",
    },
    {
      command: "/play",
      description: "Quick play - join a random room",
    },
    {
      command: "/rooms",
      description: "Show available game rooms",
    },
    {
      command: "/balance",
      description: "Check your balance",
    },
  ]

  const setupSteps = [
    {
      title: "Create Telegram Bot",
      description: "Message @BotFather on Telegram",
      command: "/newbot",
      details: "Follow the prompts to create your bot and get the bot token",
    },
    {
      title: "Set Bot Commands",
      description: "Configure bot commands with @BotFather",
      command: "/setcommands",
      details: "Copy and paste the commands below",
    },
    {
      title: "Create Mini App",
      description: "Set up the Mini App with @BotFather",
      command: "/newapp",
      details: "Select your bot and provide the web app URL",
    },
    {
      title: "Configure Menu Button",
      description: "Add menu button to launch the Mini App",
      command: "/setmenubutton",
      details: "Set button text as 'Play Bingo' and provide your app URL",
    },
  ]

  const commandsText = botCommands.map((cmd) => `${cmd.command} - ${cmd.description}`).join("\n")

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-400 via-purple-500 to-purple-600 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Telegram Bot Setup Guide</h1>
          <p className="text-white/80">Follow these steps to set up your Arada Bingo Telegram Mini App</p>
        </div>

        <div className="grid gap-6 mb-8">
          {setupSteps.map((step, index) => (
            <Card key={index} className="bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-3">
                  <Badge className="bg-orange-500 text-white px-3 py-1">Step {index + 1}</Badge>
                  {step.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-white/90">{step.description}</p>

                <div className="bg-black/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/70 text-sm">Command:</span>
                    <Button
                      onClick={() => copyToClipboard(step.command, index)}
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-white/10"
                    >
                      {copiedStep === index ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <code className="text-green-400 font-mono">{step.command}</code>
                </div>

                <p className="text-white/80 text-sm">{step.details}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bot Commands Section */}
        <Card className="bg-white/10 border-white/20 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-3">
              <Badge className="bg-blue-500 text-white px-3 py-1">Commands</Badge>
              Bot Commands Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/90 mb-4">
              Copy this text and paste it when @BotFather asks for your bot commands:
            </p>

            <div className="bg-black/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/70 text-sm">Commands List:</span>
                <Button
                  onClick={() => copyToClipboard(commandsText, 999)}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10"
                >
                  {copiedStep === 999 ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap">{commandsText}</pre>
            </div>
          </CardContent>
        </Card>

        {/* Environment Variables */}
        <Card className="bg-white/10 border-white/20 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-3">
              <Badge className="bg-red-500 text-white px-3 py-1">Config</Badge>
              Environment Variables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/90 mb-4">Add these environment variables to your deployment:</p>

            <div className="space-y-3">
              <div className="bg-black/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/70 text-sm">Bot Token:</span>
                  <Button
                    onClick={() => copyToClipboard("TELEGRAM_BOT_TOKEN=your_bot_token_here", 100)}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/10"
                  >
                    {copiedStep === 100 ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <code className="text-green-400 font-mono">TELEGRAM_BOT_TOKEN=your_bot_token_here</code>
              </div>

              <div className="bg-black/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/70 text-sm">Web App URL:</span>
                  <Button
                    onClick={() => copyToClipboard("NEXT_PUBLIC_APP_URL=https://your-app-url.vercel.app", 101)}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/10"
                  >
                    {copiedStep === 101 ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <code className="text-green-400 font-mono">NEXT_PUBLIC_APP_URL=https://your-app-url.vercel.app</code>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Useful Links */}
        <Card className="bg-white/10 border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-3">
              <Badge className="bg-purple-500 text-white px-3 py-1">Links</Badge>
              Useful Resources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <a
                href="https://core.telegram.org/bots/webapps"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-300 hover:text-blue-200 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Telegram Mini Apps Documentation
              </a>
              <a
                href="https://core.telegram.org/bots/api"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-300 hover:text-blue-200 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Telegram Bot API Documentation
              </a>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-300 hover:text-blue-200 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                @BotFather - Create and manage bots
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
