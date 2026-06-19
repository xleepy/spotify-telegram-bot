import { randomUUID } from 'crypto';
import TelegramBot, {
  type InlineQueryResultArticle,
  type InputTextMessageContent,
  type LinkPreviewOptions,
} from 'node-telegram-bot-api';
import spotifyInit from '../api/spotify.js';

type SpotifyClient = Awaited<ReturnType<typeof spotifyInit>>;

// Minimal Spotify API response shapes (only the fields we use)
interface SpotifyImage {
  url: string;
  height: number;
  width: number;
}

interface SpotifyArtist {
  name: string;
}

interface SpotifyTrackData {
  name: string;
  artists: SpotifyArtist[];
  album: { images: SpotifyImage[] };
  external_urls: { spotify: string };
}

interface SpotifyAlbumData {
  name: string;
  images: SpotifyImage[];
  artists: SpotifyArtist[];
  external_urls: { spotify: string };
}

interface SpotifyPlaylistData {
  name: string;
  images: SpotifyImage[];
  external_urls: { spotify: string };
}

type ArticleResult = InlineQueryResultArticle & {
  input_message_content: InputTextMessageContent & {
    link_preview_options?: LinkPreviewOptions;
  };
};

function parseQuery(query: string): { id: string; type: string } | null {
  const urlArr = query.split('/');
  if (urlArr.length === 0) return null;
  const type = urlArr[urlArr.length - 2];
  const [id] = urlArr[urlArr.length - 1].split('?');
  return { id, type };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function createMessageText(...parts: string[]): string {
  return parts.filter(Boolean).join('\n');
}

function createArticle(
  name: string,
  thumb: SpotifyImage | undefined,
  messageText: string,
  previewUrl: string,
): ArticleResult {
  return {
    id: randomUUID(),
    type: 'article',
    title: name,
    description: name,
    thumbnail_url: thumb?.url,
    thumbnail_width: thumb?.width,
    thumbnail_height: thumb?.height,
    input_message_content: {
      message_text: messageText,
      parse_mode: 'HTML',
      link_preview_options: {
        url: previewUrl,
        prefer_large_media: true,
      },
    },
  };
}

function makeTrackArticle(data: SpotifyTrackData): ArticleResult {
  const url = data.external_urls.spotify;
  const fullName =
    data.artists.length > 0
      ? `${data.artists.map((a) => a.name).join(', ')}: ${data.name}`
      : data.name;
  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(fullName)}`;
  return createArticle(
    fullName,
    data.album.images[0],
    createMessageText(
      `<b>${escapeHtml(fullName)}</b>`,
      `<a href="${url}">Spotify</a>`,
      `<a href="${youtubeUrl}">Youtube</a>`,
    ),
    url,
  );
}

function makeAlbumArticle(data: SpotifyAlbumData): ArticleResult {
  const url = data.external_urls.spotify;
  const fullName =
    data.artists.length > 0
      ? `${data.artists.map((a) => a.name).join(', ')}: ${data.name}`
      : data.name;
  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(fullName)}`;
  return createArticle(
    fullName,
    data.images[0],
    createMessageText(
      `<b>${escapeHtml(fullName)}</b>`,
      `<a href="${url}">Spotify</a>`,
      `<a href="${youtubeUrl}">Youtube</a>`,
    ),
    url,
  );
}

function makePlaylistArticle(data: SpotifyPlaylistData): ArticleResult {
  const url = data.external_urls.spotify;
  return createArticle(
    data.name,
    data.images[0],
    createMessageText(
      `<b>${escapeHtml(data.name)}</b>`,
      `<a href="${url}">Spotify</a>`,
    ),
    url,
  );
}

export function createHandler(client: SpotifyClient) {
  const { getTrackInfoById, getAlbumInfoById, getPlaylistById } = client;

  return {
    matches: (query: string) => query.includes('open.spotify.com'),

    handle: async (query: string, id: string, bot: TelegramBot) => {
      const parsed = parseQuery(query);
      if (!parsed) return;
      const { id: spotifyId, type } = parsed;

      try {
        let article: ArticleResult | null = null;

        if (type === 'track') {
          const data = (await getTrackInfoById(spotifyId)) as SpotifyTrackData;
          article = makeTrackArticle(data);
        } else if (type === 'album') {
          const data = (await getAlbumInfoById(spotifyId)) as SpotifyAlbumData;
          article = makeAlbumArticle(data);
        } else if (type === 'playlist') {
          const data = (await getPlaylistById(
            spotifyId,
          )) as SpotifyPlaylistData;
          article = makePlaylistArticle(data);
        }

        if (article) {
          await bot.answerInlineQuery(id, [article]);
        }
      } catch (err) {
        console.error('Spotify handler error:', err);
      }
    },
  };
}
