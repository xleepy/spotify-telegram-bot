import dotenv from 'dotenv';
dotenv.config();
import spotify from './spotify';
import { debounce } from './utils';
import { randomUUID } from 'crypto';
import TelegramBot from 'node-telegram-bot-api';

function parseQuery(query = '') {
  const urlArr = query.split('/');
  if (urlArr.length === 0) {
    return null;
  }
  // node 16.1.0 on windows doesn't support at function
  const type = urlArr[urlArr.length - 2];
  const [id] = urlArr[urlArr.length - 1].split('?');
  return {
    id,
    type,
  };
}

function createMessageText(...arr: string[]) {
  if (arr.length === 0) {
    return 'Not found';
  }
  return (arr || []).filter(Boolean).join('\n');
}

type Thumbnail = {
  url: string;
  height: number;
  width: number;
};

function createArticle(
  url: string,
  name: string,
  thumb?: Thumbnail,
  messageText = ''
): TelegramBot.InlineQueryResult {
  return {
    id: randomUUID(),
    type: 'article',
    input_message_content: {
      message_text: messageText,
      parse_mode: 'HTML',
    },
    title: name,
    url,
    hide_url: true,
    thumb_url: thumb?.url,
    thumb_height: thumb?.height ?? 200,
    thumb_width: thumb?.width ?? 200,
  };
}

function makeArticleByType(
  type: string,
  data: any // todo fix spotify types
): TelegramBot.InlineQueryResult | null {
  const url = data?.external_urls?.spotify;
  if (!url) {
    console.log('url not found for', type, data);
    return null;
  }
  if (type === 'playlist') {
    const { name, images = [] } = data;
    return createArticle(
      url,
      name,
      images[0],
      createMessageText(`*${name}*`, `[Spotify](${url})`)
    );
  }
  const { name, images = [], artists = [], album } = data;
  const image = type === 'track' ? album.images[0] : images[0];
  const fullName =
    artists.length > 0
      ? `${artists.map((a: any) => a.name).join(', ')}: ${name}`
      : name;
  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    fullName
  )}`;
  return createArticle(
    url,
    fullName,
    image,
    createMessageText(
      `<b>${fullName}</b>`,
      `<a href="${url}">Spotify</a>`,
      `<a href="${youtubeUrl}">Youtube</a>`,
      `<a href="${image.url}">&#8288</a>`
    )
  );
}

(async () => {
  const { getTrackInfoById, getAlbumInfoById, getPlaylistById } =
    await spotify();
  const tgApiToken = process.env.API_TOKEN;
  if (!tgApiToken) {
    throw new Error('API_TOKEN is missing');
  }
  const bot = new TelegramBot(tgApiToken, {
    polling: true,
  });

  const debouncedSearch = debounce(async ({ query, id }) => {
    const isSpotifyURL = query.includes('open.spotify.com');
    if (query.length === 0 || !isSpotifyURL) {
      return;
    }
    const parsedQuery = parseQuery(query);
    if (!parsedQuery) {
      return;
    }
    const { id: spotifyId, type } = parsedQuery;
    const getInfo = () => {
      switch (type) {
        case 'track':
          return getTrackInfoById(spotifyId);
        case 'album':
          return getAlbumInfoById(spotifyId);
        case 'playlist':
          return getPlaylistById(spotifyId);
        default:
          return null;
      }
    };
    try {
      const data = await getInfo();
      if (!data) {
        return;
      }
      const article = makeArticleByType(type, data);
      if (!article) {
        return;
      }
      await bot.answerInlineQuery(id, [article]);
    } catch (err) {
      console.error(err);
    }
  }, 500);

  bot.on('inline_query', debouncedSearch);
})();
