const { execFileSync } = require('child_process');
const path = require('path');

const bin = path.join(
  'node_modules',
  'yt-dlp-exec',
  'bin',
  process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp',
);

execFileSync(bin, ['-U'], { stdio: 'inherit' });
