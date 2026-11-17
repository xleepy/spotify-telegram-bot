import { randomUUID } from 'node:crypto'
import type TelegramBot from 'node-telegram-bot-api'
import type {
  InlineQueryResultArticle,
  InlineQueryResultVideo,
} from 'node-telegram-bot-api'
import { extractMedia, parseMediaUrl } from '../media.js'
import {
  createPostCaption,
  extractFirstHttpUrl,
  extractUsernameFromUrl,
  getBestVideoUrl,
  pickUsername,
} from '../utils.js'

const TIKWM_ORIGIN = 'https://www.tikwm.com'
const TIKWM_TIMEOUT_MS = 5_000

interface TikwmResponse {
  code?: number
  data?: {
    play?: string
    wmplay?: string
    hdplay?: string
    cover?: string
    title?: string
    author?: { unique_id?: string, uniqueId?: string, nickname?: string }
  }
}

function resolveTikwmUrl(value?: string): string | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined
  }

  try {
    const url = new URL(value, TIKWM_ORIGIN)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.href
    }
  } catch {
    return undefined
  }
}

async function getTikwmResult(url: URL): Promise<InlineQueryResultVideo | undefined> {
  try {
    const apiUrl = new URL('/api/', TIKWM_ORIGIN)
    apiUrl.searchParams.set('url', url.href)
    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(TIKWM_TIMEOUT_MS),
    })
    if (!response.ok) {
      throw new Error(`TikWM returned HTTP ${response.status}`)
    }

    const payload: TikwmResponse | null = await response.json()
    if (payload?.code !== 0 || !payload.data) {
      return undefined
    }

    const { play, wmplay, hdplay, cover, title: apiTitle, author } = payload.data
    const videoUrl = resolveTikwmUrl(hdplay) ?? resolveTikwmUrl(play) ?? resolveTikwmUrl(wmplay)
    const thumbnailUrl = resolveTikwmUrl(cover)
    if (!videoUrl || !thumbnailUrl) {
      return undefined
    }

    const title = (apiTitle || author?.nickname || 'TikTok Video').slice(0, 256)
    const username = extractUsernameFromUrl(url.href) ??
      pickUsername(author?.unique_id, author?.uniqueId)

    return {
      type: 'video',
      id: randomUUID(),
      video_url: videoUrl,
      mime_type: 'video/mp4',
      thumbnail_url: thumbnailUrl,
      title,
      ...createPostCaption(title, url.href, username),
    }
  } catch (err) {
    console.error('TikWM request failed:', err)
    return undefined
  }
}

async function getFallbackResult(url: URL): Promise<InlineQueryResultArticle | InlineQueryResultVideo> {
  try {
    const info = await extractMedia('tiktok', url)
    const title = (info.title || 'TikTok Video').slice(0, 256)
    const postCaption = createPostCaption(
      title,
      url.href,
      extractUsernameFromUrl(url.href) ?? pickUsername(info.uploader_id, info.channel_id),
    )
    const videoUrl = getBestVideoUrl(info)
    const thumbnailUrl = extractFirstHttpUrl(info.thumbnail)

    if (videoUrl && thumbnailUrl) {
      return {
        type: 'video',
        id: randomUUID(),
        video_url: videoUrl,
        mime_type: 'video/mp4',
        thumbnail_url: thumbnailUrl,
        title,
        ...postCaption,
      }
    }

    return {
      type: 'article',
      id: randomUUID(),
      title,
      description: info.uploader || info.channel || 'TikTok Video',
      input_message_content: {
        message_text: postCaption.caption,
        entities: postCaption.caption_entities,
      },
      ...(thumbnailUrl ? { thumbnail_url: thumbnailUrl } : {}),
    }
  } catch (err) {
    console.error('TikTok extraction failed:', err)
    const message = 'Failed to fetch TikTok video. The link may be private or unavailable.'
    return {
      type: 'article',
      id: randomUUID(),
      title: message,
      input_message_content: { message_text: message },
    }
  }
}

export const handler = {
  matches: (query: string) => parseMediaUrl('tiktok', query) !== null,

  handle: async (query: string, id: string, bot: TelegramBot) => {
    const url = parseMediaUrl('tiktok', query)
    if (!url) {
      return
    }

    const result = await getTikwmResult(url) ?? await getFallbackResult(url)
    await bot.answerInlineQuery(id, [result])
  },
}
