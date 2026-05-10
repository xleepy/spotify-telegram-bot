# AGENTS.md

## Project Overview

**spotify-telegram-bot** is a Telegram inline bot that resolves social media links into inline results. Originally built for Spotify, it now supports TikTok, Twitter/X, and Instagram as well.

- **User:** `@xleepy_bot` (invoke via inline query in any Telegram chat)
- **Runtime:** Node.js, TypeScript compiled to CommonJS (ES2024 target)


---

## Architecture

### Pattern

The bot follows a **handler/plugin pattern** — each supported platform has its own handler module implementing a simple interface:

```ts
interface Handler {
  matches: (query: string) => boolean;
  handle: (query: string, id: string, bot: TelegramBot) => Promise<void>;
}
```

### Data Flow

1. User types `@xleepy_bot <url>` in a Telegram chat (inline query)
2. `src/index.ts` receives the inline query, **debounced at 500ms**
3. Iterates through all registered handlers until `matches()` returns `true`
4. The matched handler fetches data from external APIs and sends back an inline result (video or article)

### Directory Structure

```
src/
├── index.ts              # Entry point: env loading, bot init, handler registration
├── utils.ts              # Shared utilities: debounce, fetch wrapper, video URL picker
├── api/
│   └── spotify.ts        # Spotify OAuth (Client Credentials) & API client
└── handlers/
    ├── spotify.ts        # open.spotify.com → track/album/playlist metadata
    ├── tiktok.ts         # tiktok.com → video (tikwm.com API + yt-dlp fallback)
    ├── twitter.ts        # twitter.com / x.com → video (yt-dlp)
    └── instagram.ts      # instagram.com → video (yt-dlp, single-video only)
scripts/
└── update-ytdlp.js       # Postinstall: updates yt-dlp binary
```

### Key Design Decisions

- **Inline mode only** — no commands, keyboards, or message handlers
- **Stateless & in-memory** — no database or file persistence
- **Spotify Client Credentials OAuth** — server-to-server, token cached in memory, auto-refreshes on 401
- **No user authentication** — the bot serves anonymous inline queries to anyone

---

## Dependencies & Documentation

| Package | Docs |
|---|---|
| [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api) | Telegram Bot API client (polling mode) |
| [yt-dlp-exec](https://github.com/Richienb/yt-dlp-exec) | Node wrapper for yt-dlp (video extraction) |
| [dotenv](https://github.com/motdotla/dotenv) | Loads `.env` into `process.env` |
| [TypeScript](https://www.typescriptlang.org/docs/) | Type checking & compilation |
| [ESLint](https://eslint.org/docs/latest/) (airbnb-base) | Linting |
| [Prettier](https://prettier.io/docs/en/) | Code formatting |

**External APIs / Services:**

| Service | Docs |
|---|---|
| [Telegram Bot API](https://core.telegram.org/bots/api) | Bot platform (inline mode) |
| [Spotify Web API](https://developer.spotify.com/documentation/web-api) | Track/album/playlist metadata |
| [tikwm.com](https://tikwm.com/) | Unofficial TikTok video downloader (no docs) |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Video extraction for Twitter, Instagram, TikTok |

---

## Scripts

| Command | What it does |
|---|---|
| `npm run build` | Runs `tsc` — compiles `src/` → `dist/` |
| `npm start` | Runs `node dist/index.js` — starts the bot |
| `npm install` (postinstall) | Runs `scripts/update-ytdlp.js` — auto-updates yt-dlp binary |

---

## Configuration

| File | Purpose |
|---|---|
| `.env` | `API_TOKEN`, `CLIENT_ID`, `CLIENT_SECRET` (Telegram + Spotify credentials) |
| `tsconfig.json` | TypeScript compiler options |
| `.eslintrc.js` | ESLint config (airbnb-base + custom overrides) |
| `.prettierrc` | Prettier config (`singleQuote: true`) |

---

## Guidelines for AI Agents

### When in doubt, ask the user

If any instruction is ambiguous, unclear, or conflicts with existing patterns in the codebase, **ask the user for clarification before proceeding**. Do not make assumptions.

### Code conventions

- **Single quotes** (`prettier` + `.prettierrc`)
- **No semicolons** (follow existing style — none of the source files use them)
- **CommonJS modules** (`require` / `module.exports` in compiled output, but source uses ES imports since `esModuleInterop` is enabled)
- **`console.error` only** — no logging framework is used; only log errors
- **No comments** in source unless absolutely necessary
- **Follow existing handler pattern** when adding new platforms

### Before making changes

1. Read the relevant source files to understand the existing patterns
2. Check whether the change affects the handler registration in `src/index.ts`
3. Run `npm run build` to ensure TypeScript compiles without errors
4. If editing a handler, verify the `matches()` regex and `handle()` logic against known URL formats

### Project Reflection

- **No tests exist** — there is no testing framework, no test files, and no test scripts
- **No graceful shutdown** — no SIGTERM/SIGINT handlers
- **Stale compiled file** — `dist/spotify.js` is a leftover from an older build and should be removed
- **Secrets in `.env`** — the `.env` file contains real credentials; do not modify or expose them
- **No CI/CD** — no GitHub Actions, Docker, or automated deployment configured
- **Outdated README** — only mentions Spotify, but the bot supports 4 platforms
- **No version pinning for yt-dlp** — the binary auto-updates on every `npm install`, which could introduce breaking changes
