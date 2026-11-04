import type TelegramBot from 'node-telegram-bot-api'
import { createMediaArticle, createMediaResult, extractMedia, parseMediaUrl } from '../media.js'

export const handler = {
  matches: (query: string) => parseMediaUrl('instagram', query) !== null,

  handle: async (query: string, id: string, bot: TelegramBot) => {
    const url = parseMediaUrl('instagram', query)
    if (!url) return

    let info: Awaited<ReturnType<typeof extractMedia>>
    try {
      info = await extractMedia('instagram', url)
    } catch {
      console.error('Instagram extraction failed')
      await bot.answerInlineQuery(id, [createMediaArticle('Cannot fetch this Instagram post.', url.href)])
      return
    }

    const result = info._type === 'playlist'
      ? createMediaArticle('Cannot fetch carousels — only single videos are supported.', url.href)
      : createMediaResult('instagram', info, url, 'Instagram Video')

    await bot.answerInlineQuery(id, [result])
  },
}
