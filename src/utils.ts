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

interface VideoFormat {
  url: string;
  vcodec: string;
  acodec: string;
  ext: string;
  height: number;
}

export interface VideoInfo {
  url?: string;
  formats?: VideoFormat[];
}

export function getBestVideoUrl(info: VideoInfo): string | null {
  if (info.url) {
    return info.url;
  }
  const formats = info.formats ?? [];
  const combined = formats.filter(
    (f) => f.url && f.vcodec !== 'none' && f.acodec !== 'none',
  );
  if (combined.length > 0) {
    combined.sort((a, b) => {
      const aIsMp4 = a.ext === 'mp4' ? 1 : 0;
      const bIsMp4 = b.ext === 'mp4' ? 1 : 0;
      if (aIsMp4 !== bIsMp4) return bIsMp4 - aIsMp4;
      return b.height - a.height;
    });
    return combined[0].url;
  }
  return formats.find((f) => f.url && f.vcodec !== 'none')?.url ?? null;
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
