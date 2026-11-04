import type TelegramBot from 'node-telegram-bot-api'
import { createMediaResult, extractMedia, parseMediaUrl } from '../media.js'

export const handler = {
  matches: (query: string) => parseMediaUrl('twitter', query) !== null,

  handle: async (query: string, id: string, bot: TelegramBot) => {
    const url = parseMediaUrl('twitter', query)
    if (!url) return

    const info = await extractMedia('twitter', url)
    await bot.answerInlineQuery(id, [createMediaResult('twitter', info, url, 'Twitter Video')])
  },
}
