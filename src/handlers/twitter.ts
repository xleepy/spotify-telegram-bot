import { randomUUID } from 'crypto';
import TelegramBot from 'node-telegram-bot-api';
import ytdlp from 'yt-dlp-exec';
import { getBestVideoUrl } from '../utils';

export const handler = {
  matches: (query: string) =>
    query.includes('twitter.com') || query.includes('x.com'),

  handle: async (query: string, id: string, bot: TelegramBot) => {
    try {
      const info = await ytdlp(query, {
        dumpSingleJson: true,
        noWarnings: true,
        format: 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio/best',
      });

      const videoUrl = getBestVideoUrl(info);
      const thumbnail = info.thumbnail || '';
      const title = info.title || 'Twitter Video';

      if (!videoUrl) {
        console.error('No video URL found for Twitter post:', query);
        return;
      }

      await bot.answerInlineQuery(id, [
        {
          type: 'video',
          id: randomUUID(),
          video_url: videoUrl,
          mime_type: 'video/mp4',
          thumb_url: thumbnail,
          title,
          caption: title,
        },
      ]);
    } catch (err) {
      console.error('Twitter handler error:', err);
    }
  },
};
