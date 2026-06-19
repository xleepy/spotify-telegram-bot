import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import spotifyInit from './api/spotify.js';
import { debounce } from './utils.js';
import { createHandler as createSpotifyHandler } from './handlers/spotify.js';
import { handler as twitterHandler } from './handlers/twitter.js';
import { handler as instagramHandler } from './handlers/instagram.js';
import { handler as tiktokHandler } from './handlers/tiktok.js';

(async () => {
  const spotifyClient = await spotifyInit();

  const tgApiToken = process.env.API_TOKEN;
  if (!tgApiToken) {
    throw new Error('API_TOKEN is missing');
  }
  const bot = new TelegramBot(tgApiToken, { polling: true });

  const handlers = [
    createSpotifyHandler(spotifyClient),
    twitterHandler,
    instagramHandler,
    tiktokHandler,
  ];

  const debouncedSearch = debounce(
    async ({ query, id }: { query: string; id: string }) => {
      const handler = handlers.find((h) => h.matches(query));
      if (handler) {
        await handler.handle(query, id, bot);
      }
    },
    500,
  );

  bot.on('inline_query', debouncedSearch);
})();
