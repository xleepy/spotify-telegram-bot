require('dotenv').config();
const spotify = require('./spotify');
const { randomUUID } = require('crypto');

const TelegramBot = require('node-telegram-bot-api');

(async () => {
  const { getTrackInfoByURL } = await spotify();
  const bot = new TelegramBot(process.env.API_TOKEN, {
    polling: true,
  });

  bot.on('inline_query', async ({ query, from, id }) => {
    if (query.length == 0) {
      return;
    }
    console.log(query, from);
    const { album, external_urls, name, artists } = await getTrackInfoByURL(query);
    const { images } = album;
    const [thumb] = images;
    const fullSongName = `${artists.map((a) => a.name).join(', ')}: ${name}`;

    bot.answerInlineQuery(
      id,
      [
        {
          id: randomUUID(),
          type: 'article',
          input_message_content: {
            message_text: `
          *${fullSongName}*\n[Spotify](${external_urls.spotify})\n[Youtube](https://www.youtube.com/results?search_query=${fullSongName})
          `,
            parse_mode: 'Markdown',
          },
          title: fullSongName,
          thumb_url: thumb.url,
          thumb_height: thumb.height,
          thumb_width: thumb.width,
        },
      ],
      {}
    );
  });
})();
