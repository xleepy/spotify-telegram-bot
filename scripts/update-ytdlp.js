import { execFileSync } from 'node:child_process';
import path from 'node:path';

const bin = path.join(
  'node_modules',
  'yt-dlp-exec',
  'bin',
  process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp',
);

execFileSync(bin, ['-U'], { stdio: 'inherit' });
