const fetch = require("node-fetch");

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
  error.status = status;
  return error;
}

// https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore?tab=readme-ov-file#_debounce
function debounce(func, wait, immediate) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    if (immediate && !timeout) func.apply(context, args);
    timeout = setTimeout(() => {
      timeout = null;
      if (!immediate) func.apply(context, args);
    }, wait);
  };
}

module.exports = {
  makeRequest,
  debounce,
};
