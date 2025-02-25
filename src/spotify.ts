import { makeRequest } from './utils';

const authOptions = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    Authorization: `Basic ${Buffer.from(
      `${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`
    ).toString('base64')}`,
  },
  body: 'grant_type=client_credentials',
};

let token: string | null = null;

async function authenticateSpotify() {
  const { access_token } = await makeRequest(
    'https://accounts.spotify.com/api/token',
    authOptions
  );
  return access_token;
}

const fetchWithReauth = async (url: string, opts?: RequestInit) => {
  if (!token) {
    token = await authenticateSpotify();
  }
  const response = await makeRequest(url, {
    ...opts,
    headers: { ...opts?.headers, Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) {
    token = await authenticateSpotify();
    return makeRequest(url, {
      ...opts,
      headers: { ...opts?.headers, Authorization: `Bearer ${token}` },
    });
  }
  return response;
};

async function init() {
  token = await authenticateSpotify();

  const createSpotifyRequest = (path: string) =>
    fetchWithReauth(`https://api.spotify.com/v1${path}`);

  const getPlaylistById = (id: string) =>
    createSpotifyRequest(`/playlists/${id}`);

  const getAlbumInfoById = (id: string) =>
    createSpotifyRequest(`/albums/${id}`);

  const getTrackInfoById = (id = '') => createSpotifyRequest(`/tracks/${id}`);

  return {
    getAlbumInfoById,
    getTrackInfoById,
    getPlaylistById,
  };
}

export default init;
