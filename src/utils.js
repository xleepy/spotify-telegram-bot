const fetch = require('node-fetch');

async function makeRequest(url, opts) {
  const response = await fetch(url, opts);
  if (response.ok) {
    return response.json();
  }
  const text = await response.text();

  const { statusText, status } = response;

  let error;

  try {
    const json = JSON.parse(text);
    error = new Error();
    error.message = json || `${status} - ${statusText}`;
    error.code = status;
    error.url = response.url;
  } catch (err) {
    error = new Error(`${status} ${statusText} ${text}`);
    error.response = response;
    error.responseText = text;
  }
  return error;
}

module.exports = {
  makeRequest,
};
