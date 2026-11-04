import { randomUUID } from 'node:crypto'
import type { InlineQueryResultArticle, InlineQueryResultVideo } from 'node-telegram-bot-api'
import ytdlp from 'yt-dlp-exec'
import {
  createPostCaption,
  extractFirstHttpUrl,
  extractUsernameFromUrl,
  getBestVideoUrl,
  pickUsername,
} from './utils.js'

const platforms = {
  twitter: {
    hosts: /^(?:(?:www|m|mobile)\.)?(?:x|twitter)\.com$/,
    path: /^\/(?:(?:i\/web|[\w]+)\/status|statuses)\/\d+(?:\/(?:video|photo)\/\d+)?\/?$/,
    extractors: 'twitter',
  },
  instagram: {
    hosts: /^(?:www\.)?instagram\.com$/,
    path: /^\/(?:(?:[\w.]+\/)?(?:p|tv|reels?)\/[\w-]+(?:\/embed)?|share\/(?:p\/|reel\/)?[\w-]+)\/?$/,
    extractors: 'instagram',
  },
  tiktok: {
    hosts: /^(?:(?:www|m|vm|vt)\.)?tiktok\.com$/,
    path: /^\/(?:(?:@[\w.-]+\/(?:video|photo)|share\/video|embed(?:\/v2)?)\/\d+|t\/\w+)\/?$/,
    extractors: 'tiktok,vm.tiktok',
  },
}

type MediaPlatform = keyof typeof platforms
type MediaInfo = Awaited<ReturnType<typeof ytdlp>> & { _type?: string }

export function parseMediaUrl(platform: MediaPlatform, input: string): URL | null {
  const text = input.trim()
  if (!/^https?:\/\//i.test(text) || /[\s\\\u0000-\u001f\u007f]/.test(text)) return null

  let url: URL
  try {
    url = new URL(text)
  } catch {
    return null
  }
  const { hosts, path } = platforms[platform]
  if (!hosts.test(url.hostname) || url.username || url.password || url.port) return null

  const shortTikTok = platform === 'tiktok' && /^(?:vm|vt)\./.test(url.hostname)
  if (!(shortTikTok ? /^\/\w+\/?$/ : path).test(url.pathname)) return null

  url.protocol = 'https:'
  url.hash = ''
  if (platform === 'tiktok' && !shortTikTok) {
    url.hostname = 'www.tiktok.com'
    url.pathname = url.pathname.replace(/^\/embed\/v2\//, '/embed/')
  }
  return url
}

// The wrapper accepts an argv array at runtime, but its declaration only accepts a URL string.
const runYtDlp = ytdlp as (
  args: string | string[],
  flags?: Parameters<typeof ytdlp>[1],
  options?: Parameters<typeof ytdlp>[2],
) => Promise<MediaInfo>

async function resolveInstagramShare(url: URL): Promise<URL> {
  const response = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(4_000),
  })
  const location = response.headers.get('location')
  await response.body?.cancel()

  if (response.status < 300 || response.status >= 400 || !location) {
    throw new Error('Instagram share link did not redirect')
  }
  const target = parseMediaUrl('instagram', new URL(location, url).href)
  if (!target || target.pathname.startsWith('/share/')) {
    throw new Error('Unsupported Instagram share target')
  }
  return target
}

export async function extractMedia(platform: MediaPlatform, url: URL): Promise<MediaInfo> {
  const validatedUrl = parseMediaUrl(platform, url.href)
  if (!validatedUrl) throw new Error('Unsupported media URL')
  const sourceUrl = platform === 'instagram' && validatedUrl.pathname.startsWith('/share/')
    ? await resolveInstagramShare(validatedUrl)
    : validatedUrl

  const args = [
    '--ignore-config', '--no-cookies', '--no-cookies-from-browser', '--no-plugin-dirs',
    '--no-update', '--dump-single-json', '--no-warnings',
    '--use-extractors', platforms[platform].extractors,
  ]
  if (platform !== 'tiktok') {
    args.push('--format', 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio/best')
  }
  if (platform === 'instagram') args.push('--impersonate', 'chrome')

  return runYtDlp([...args, '--', sourceUrl.href], undefined, { timeout: 15_000 })
}

export function createMediaArticle(
  title: string,
  url: string,
  username?: string,
): InlineQueryResultArticle {
  const { caption, caption_entities: entities } = createPostCaption(title, url, username)
  return {
    type: 'article',
    id: randomUUID(),
    title,
    input_message_content: { message_text: caption, entities },
  }
}

export function createMediaResult(
  platform: 'twitter' | 'instagram',
  info: MediaInfo,
  url: URL,
  defaultTitle: string,
): InlineQueryResultArticle | InlineQueryResultVideo {
  const title = (info.title || defaultTitle).slice(0, 256)
  const postUrl = parseMediaUrl(platform, info.webpage_url || '')?.href ?? url.href
  const username = extractUsernameFromUrl(postUrl) ?? pickUsername(info.uploader_id, info.channel_id)
  const videoUrl = getBestVideoUrl(info)
  const thumbnail = extractFirstHttpUrl(info.thumbnail)

  if (!videoUrl || !thumbnail) return createMediaArticle(title, postUrl, username)

  return {
    type: 'video',
    id: randomUUID(),
    video_url: videoUrl,
    mime_type: 'video/mp4',
    thumbnail_url: thumbnail,
    title,
    ...createPostCaption(title, postUrl, username),
  }
}
