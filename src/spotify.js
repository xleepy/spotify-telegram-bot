const { makeRequest } = require('./utils');

const authOptions = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    Authorization:
      'Basic ' +
      Buffer.from(process.env.CLIENT_ID + ':' + process.env.CLIENT_SECRET).toString('base64'),
  },
  body: 'grant_type=client_credentials',
};

const getRequestOptions = (token) => {
  return {
    headers: {
      Authorization: 'Bearer ' + token,
    },
  };
};

async function authenticateSpotify() {
  const { access_token } = await makeRequest('https://accounts.spotify.com/api/token', authOptions);
  return access_token;
}

async function init() {
  const token = await authenticateSpotify();

  const createSpotifyRequest = (path) => {
    return makeRequest(`https://api.spotify.com/v1${path}`, getRequestOptions(token));
  };

  const getPlaylistById = (id) => {
    return createSpotifyRequest(`/playlists/${id}`);
  };

  const getAlbumInfoById = (id) => {
    return createSpotifyRequest(`/albums/${id}`);
  };

  const getTrackInfoById = (id = '') => {
    return createSpotifyRequest(`/tracks/${id}`);
  };

  return {
    getAlbumInfoById,
    getTrackInfoById,
    getPlaylistById,
  };
}

module.exports = init;
