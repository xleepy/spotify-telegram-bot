import { randomUUID } from 'crypto';
import TelegramBot from 'node-telegram-bot-api';
import ytdlp from 'yt-dlp-exec';

function errorResult(message: string): TelegramBot.InlineQueryResultArticle {
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

        if (videoUrl) {
          const title = (apiTitle || author?.nickname || 'TikTok Video').slice(0, 256);

          await bot.answerInlineQuery(id, [
            {
              type: 'video',
              id: randomUUID(),
              video_url: videoUrl,
              mime_type: 'video/mp4',
              thumb_url: thumb,
              title,
              caption: title,
            },
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
      const webpageUrl = (info.webpage_url || query);

      await bot.answerInlineQuery(id, [
        {
          type: 'article',
          id: randomUUID(),
          title,
          description: uploader || 'TikTok Video',
          input_message_content: {
            message_text: `<b>${title}</b>\n${uploader ? `<i>by ${uploader}</i>\n` : ''}<a href="${webpageUrl}">Watch on TikTok</a>`,
            parse_mode: 'HTML',
          },
          thumb_url: info.thumbnail || '',
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
