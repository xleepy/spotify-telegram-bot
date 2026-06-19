import { randomUUID } from 'crypto';
import TelegramBot, {
  type InlineQueryResultArticle,
  type InlineQueryResultVideo,
} from 'node-telegram-bot-api';
import ytdlp from 'yt-dlp-exec';
import {
  createPostCaption,
  extractFirstHttpUrl,
  extractUsernameFromUrl,
  pickUsername,
} from '../utils.js';

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
  matches: (query: string) => query.includes('tiktok.com'),

  handle: async (query: string, id: string, bot: TelegramBot) => {
    try {
      const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(query)}`;
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (data.code === 0 && data.data) {
        const { play, wmplay, hdplay, cover, title: apiTitle, author } = data.data;
        const videoUrl = hdplay || play || wmplay;
        const thumb = cover || '';
        const postUrl = extractFirstHttpUrl(query);
        const username =
          extractUsernameFromUrl(query) ??
          pickUsername(author?.unique_id, author?.uniqueId);

        if (videoUrl) {
          const title = (apiTitle || author?.nickname || 'TikTok Video').slice(0, 256);

          await bot.answerInlineQuery(id, [
            {
              type: 'video',
              id: randomUUID(),
              video_url: videoUrl,
              mime_type: 'video/mp4',
              thumbnail_url: thumb,
              title,
              ...createPostCaption(title, postUrl, username),
            } satisfies InlineQueryResultVideo,
          ]);
          return;
        }
      }

      const info: any = await ytdlp(query, {
        dumpSingleJson: true,
        noWarnings: true,
      });

      const uploader = info.uploader || info.channel || '';
      const title = (info.title || 'TikTok Video').slice(0, 256);
      const webpageUrl = extractFirstHttpUrl(info.webpage_url, query);
      const {
        caption: messageText,
        caption_entities: entities,
      } = createPostCaption(
        title,
        webpageUrl,
        extractUsernameFromUrl(query) ??
          pickUsername(info.uploader_id, info.channel_id),
      );

      await bot.answerInlineQuery(id, [
        {
          type: 'article',
          id: randomUUID(),
          title,
          description: uploader || 'TikTok Video',
          input_message_content: {
            message_text: messageText,
            entities,
          },
          ...(info.thumbnail ? { thumbnail_url: info.thumbnail } : {}),
        },
      ]);
    } catch (err) {
      console.error('TikTok handler error:', err);
      await bot.answerInlineQuery(id, [
        errorResult('Failed to fetch TikTok video. The link may be private or unavailable.'),
      ]).catch(() => {});
    }
  },
};
