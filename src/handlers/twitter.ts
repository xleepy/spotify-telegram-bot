import { randomUUID } from 'crypto';
import TelegramBot, { type InlineQueryResultVideo } from 'node-telegram-bot-api';
import ytdlp from 'yt-dlp-exec';
import {
  createPostCaption,
  extractFirstHttpUrl,
  extractUsernameFromUrl,
  getBestVideoUrl,
  pickUsername,
} from '../utils.js';

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
      const title = (info.title || 'Twitter Video').slice(0, 256);
      const postUrl = extractFirstHttpUrl(info.webpage_url, query);
      const username =
        extractUsernameFromUrl(query) ??
        pickUsername(info.uploader_id, info.channel_id);

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
          thumbnail_url: thumbnail,
          title,
          ...createPostCaption(title, postUrl, username),
        } satisfies InlineQueryResultVideo,
      ]);
    } catch (err) {
      console.error('Twitter handler error:', err);
    }
  },
};
