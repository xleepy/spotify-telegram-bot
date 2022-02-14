require('dotenv').config();
const spotify = require('./spotify');
const { randomUUID } = require('crypto');

const TelegramBot = require('node-telegram-bot-api');

function parseQuery(query = '') {
  const urlArr = query.split('/');
  if (urlArr.length == 0) {
    return null;
  }
  const type = urlArr.at(-2);
  const [id] = urlArr.at(-1).split('?');
  return {
    id,
    type,
  };
}

function createMessageText(...arr) {
  if (arr.length === 0) {
    return 'Not found';
  }
  return (arr || []).join('\n');
}

function createArticle(name, url, thumb) {
  return {
    id: randomUUID(),
    type: 'article',
    input_message_content: {
      message_text: createMessageText(
        `*${name}*`,
        `[Spotify](${url})`,
        `[Youtube](https://www.youtube.com/results?search_query=${encodeURIComponent(name)})`
      ),
      parse_mode: 'Markdown',
    },
    title: name,
    thumb_url: thumb?.url,
    thumb_height: thumb?.height,
    thumb_width: thumb?.width,
  };
}

(async () => {
  const { getTrackInfoById, getAlbumInfoById, getPlaylistById } = await spotify();
  const bot = new TelegramBot(process.env.API_TOKEN, {
    polling: true,
  });

  bot.on('inline_query', async ({ query, id }) => {
    if (query.length == 0) {
      return;
    }

    const { id: spotifyId, type } = parseQuery(query);

    const getInfo = () => {
      switch (type) {
        case 'track':
          return getTrackInfoById(spotifyId);
        case 'album':
          return getAlbumInfoById(spotifyId);
        case 'playlist':
          return getPlaylistById(spotifyId);
      }
    };

    const { name, images = [], external_urls, artists = [], album } = await getInfo();

    const thumb = type == 'track' ? album.images[0] : images[0];

    const fullName =
      artists.length > 0 ? `${artists.map((a) => a.name).join(', ')}: ${name}` : name;

    bot.answerInlineQuery(id, [createArticle(fullName, external_urls.spotify, thumb)]);
  });
})();
