import type { MessageEntity } from 'node-telegram-bot-api';

const TELEGRAM_CAPTION_LIMIT = 1024;
const LINK_FALLBACK_TEXT = '[link]';
const TRUNCATION_SUFFIX = '...';
const TWITTER_RESERVED_PATHS = new Set([
  'compose',
  'explore',
  'hashtag',
  'home',
  'i',
  'intent',
  'login',
  'messages',
  'notifications',
  'search',
  'settings',
  'share',
  'signup',
]);
const INSTAGRAM_RESERVED_PATHS = new Set([
  'accounts',
  'direct',
  'explore',
  'p',
  'reel',
  'reels',
  'stories',
  'tv',
]);

interface RichCaption {
  caption: string;
  caption_entities?: MessageEntity[];
}

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

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  if (maxLength <= TRUNCATION_SUFFIX.length) {
    return text.slice(0, maxLength);
  }
  return `${text.slice(0, maxLength - TRUNCATION_SUFFIX.length).trimEnd()}${TRUNCATION_SUFFIX}`;
}

function normalizeUsername(username?: string): string | null {
  const trimmed = username?.trim().replace(/^@+/, '');
  if (!trimmed || !/^[a-zA-Z0-9._]{1,64}$/.test(trimmed)) {
    return null;
  }
  return `@${trimmed}`;
}

function normalizeHttpUrl(url?: string): string {
  if (!url) {
    return '';
  }
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch (err) {
    return '';
  }
  return '';
}

function matchesHostname(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function decodePathPart(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch (err) {
    return part;
  }
}

export function extractFirstHttpUrl(
  ...values: Array<string | undefined>
): string {
  for (const value of values) {
    const match = value?.match(/https?:\/\/[^\s"'<>]+/);
    const url = normalizeHttpUrl(match?.[0] ?? value);
    if (url) {
      return url;
    }
  }
  return '';
}

export function extractUsernameFromUrl(value?: string): string | undefined {
  const url = extractFirstHttpUrl(value);
  if (!url) {
    return undefined;
  }

  const parsed = new URL(url);
  const hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();
  const parts = parsed.pathname
    .split('/')
    .filter(Boolean)
    .map(decodePathPart);
  let username: string | undefined;

  if (matchesHostname(hostname, 'x.com') || matchesHostname(hostname, 'twitter.com')) {
    const [firstPart] = parts;
    if (firstPart && !TWITTER_RESERVED_PATHS.has(firstPart.toLowerCase())) {
      username = firstPart;
    }
  } else if (matchesHostname(hostname, 'tiktok.com')) {
    username = parts.find((part) => part.startsWith('@'))?.slice(1);
  } else if (matchesHostname(hostname, 'instagram.com')) {
    const [firstPart] = parts;
    if (firstPart && !INSTAGRAM_RESERVED_PATHS.has(firstPart.toLowerCase())) {
      username = firstPart;
    }
  }

  return normalizeUsername(username)?.slice(1);
}

export function pickUsername(
  ...values: Array<string | undefined>
): string | undefined {
  for (const value of values) {
    const username = normalizeUsername(value)?.slice(1);
    if (username && !/^\d+$/.test(username)) {
      return username;
    }
  }
  return undefined;
}

export function createPostCaption(
  title: string,
  postUrl: string,
  username?: string,
): RichCaption {
  const linkUrl = normalizeHttpUrl(postUrl);
  const linkText = normalizeUsername(username) ?? LINK_FALLBACK_TEXT;
  const maxTitleLength = linkUrl
    ? TELEGRAM_CAPTION_LIMIT - linkText.length - 1
    : TELEGRAM_CAPTION_LIMIT;
  const captionTitle = truncateText(
    normalizeWhitespace(title) || 'Video',
    maxTitleLength,
  );
  const caption = linkUrl ? `${captionTitle}\n${linkText}` : captionTitle;
  const captionEntities: MessageEntity[] = [
    {
      type: 'bold',
      offset: 0,
      length: captionTitle.length,
    },
  ];

  if (linkUrl) {
    captionEntities.push({
      type: 'text_link',
      offset: captionTitle.length + 1,
      length: linkText.length,
      url: linkUrl,
    });
  }

  return {
    caption,
    caption_entities: captionEntities,
  };
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
