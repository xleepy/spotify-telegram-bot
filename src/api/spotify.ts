import { makeRequest } from '../utils.js';

const REQUEST_TIMEOUT_MS = 4000

let token: string | null = null
let tokenRequest: Promise<string> | null = null

async function authenticateSpotify() {
  const { CLIENT_ID, CLIENT_SECRET } = process.env
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Spotify client credentials are missing')
  }

  const response = await makeRequest('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (response instanceof Error) {
    const status = 'status' in response ? ` (HTTP ${response.status})` : ''
    throw new Error(`Spotify authentication failed${status}`)
  }
  const accessToken = response?.access_token
  if (
    typeof accessToken !== 'string' ||
    accessToken !== accessToken.trim() ||
    !/^[A-Za-z0-9._~+/-]+=*$/.test(accessToken)
  ) {
    throw new Error('Spotify authentication returned an invalid access token')
  }
  return accessToken
}

async function getToken() {
  if (token) return token

  tokenRequest ??= authenticateSpotify()
    .then((accessToken) => {
      token = accessToken
      return accessToken
    })
    .finally(() => {
      tokenRequest = null
    })

  return tokenRequest
}

async function fetchWithReauth(url: string) {
  const request = (accessToken: string) =>
    makeRequest(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

  const accessToken = await getToken()
  let response = await request(accessToken)
  if (response instanceof Error && 'status' in response && response.status === 401) {
    if (token === accessToken) token = null
    response = await request(await getToken())
  }

  if (response instanceof Error) throw response
  return response
}

async function init() {
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
