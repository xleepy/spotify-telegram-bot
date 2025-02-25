export async function makeRequest(url: string, opts: RequestInit) {
  const response = await fetch(url, opts);
  if (response.ok) {
    return response.json();
  }
  const text = await response.text();

  const { statusText, status } = response;

  let error: any;

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
export function debounce<T extends (...args: any) => void>(
  func: T,
  wait: number,
  immediate?: true
) {
  let timeout: NodeJS.Timeout | null;
  return function (this: ThisParameterType<T>, ...args: any[]) {
    if (timeout) {
      clearTimeout(timeout);
    }
    if (immediate && !timeout) func.apply(this, args);
    timeout = setTimeout(() => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    }, wait);
  };
}
