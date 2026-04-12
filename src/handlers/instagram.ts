import { randomUUID } from 'crypto';
import TelegramBot from 'node-telegram-bot-api';
import ytdlp from 'yt-dlp-exec';
import { getBestVideoUrl, VideoInfo } from '../utils';

interface InstagramMediaInfo extends VideoInfo {
  ext?: string;
  width?: number;
  height?: number;
  title?: string;
  thumbnail?: string;
  _type?: string;
  entries?: InstagramMediaInfo[];
}

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'webp', 'png']);

function isPhoto(info: InstagramMediaInfo): boolean {
  if (info.ext && IMAGE_EXTS.has(info.ext)) return true;
  return !getBestVideoUrl(info) && !!info.url;
}

type InlineResult = TelegramBot.InlineQueryResultPhoto | TelegramBot.InlineQueryResultVideo;

function buildResult(info: InstagramMediaInfo, fallbackTitle: string): InlineResult | null {
  const title = info.title || fallbackTitle;
  const thumbnail = info.thumbnail || '';

  if (isPhoto(info) && info.url) {
    return {
      type: 'photo',
      id: randomUUID(),
      photo_url: info.url,
      thumb_url: thumbnail || info.url,
      photo_width: info.width,
      photo_height: info.height,
      title,
      caption: title,
    };
  }

  const videoUrl = getBestVideoUrl(info);
  if (videoUrl) {
    return {
      type: 'video',
      id: randomUUID(),
      video_url: videoUrl,
      mime_type: 'video/mp4',
      thumb_url: thumbnail,
      title,
      caption: title,
    };
  }

  return null;
}

export const handler = {
  matches: (query: string) => query.includes('instagram.com'),

  handle: async (query: string, id: string, bot: TelegramBot) => {
    try {
      const info = await ytdlp(query, {
        dumpSingleJson: true,
        noWarnings: true,
        format: 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio/best',
      }) as unknown as InstagramMediaInfo;

      const title = info.title || 'Instagram Post';

      // Carousel / gallery — return all items so the user can pick one
      if (info._type === 'playlist' && info.entries?.length) {
        const results = info.entries
          .map((entry) => buildResult(entry, title))
          .filter((r): r is InlineResult => r !== null);

        if (results.length > 0) {
          await bot.answerInlineQuery(id, results);
        }
        return;
      }

      // Single photo or video
      const result = buildResult(info, title);
      if (!result) {
        console.error('No media found for Instagram post:', query);
        return;
      }

      await bot.answerInlineQuery(id, [result]);
    } catch (err) {
      console.error('Instagram handler error:', err);
    }
  },
};
