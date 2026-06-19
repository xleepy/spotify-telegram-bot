import { randomUUID } from 'crypto';
import TelegramBot, {
  type InlineQueryResultArticle,
  type InlineQueryResultVideo,
} from 'node-telegram-bot-api';
import ytdlp from 'yt-dlp-exec';
import { getBestVideoUrl, type VideoInfo } from '../utils.js';

interface InstagramMediaInfo extends VideoInfo {
  ext?: string;
  title?: string;
  thumbnail?: string;
  _type?: string;
  entries?: InstagramMediaInfo[];
}

function errorResult(message: string): InlineQueryResultArticle {
  return {
    type: 'article',
    id: randomUUID(),
    title: message,
    input_message_content: {
      message_text: message,
    },
  };
}

export const handler = {
  matches: (query: string) => query.includes('instagram.com'),

  handle: async (query: string, id: string, bot: TelegramBot) => {
    try {
      const info = (await ytdlp(query, {
        dumpSingleJson: true,
        noWarnings: true,
        format: 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio/best',
      })) as unknown as InstagramMediaInfo;

      if (info._type === 'playlist') {
        await bot.answerInlineQuery(id, [
          errorResult('Cannot fetch carousels — only single videos are supported.'),
        ]);
        return;
      }

      const videoUrl = getBestVideoUrl(info);
      if (!videoUrl) {
        await bot.answerInlineQuery(id, [
          errorResult('Cannot fetch images — only videos are supported.'),
        ]);
        return;
      }

      const title = info.title || 'Instagram Video';
      await bot.answerInlineQuery(id, [
        {
          type: 'video',
          id: randomUUID(),
          video_url: videoUrl,
          mime_type: 'video/mp4',
          thumbnail_url: info.thumbnail || '',
          title,
          caption: title,
        } satisfies InlineQueryResultVideo,
      ]);
    } catch (err) {
      console.error('Instagram handler error:', err);
    }
  },
};
