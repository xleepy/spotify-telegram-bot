import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Install a verified standalone build because the generic Unix build lacks curl-cffi.
const assets = {
  linux: { x64: 'yt-dlp_linux', arm64: 'yt-dlp_linux_aarch64' },
  darwin: { x64: 'yt-dlp_macos', arm64: 'yt-dlp_macos' },
  win32: { x64: 'yt-dlp.exe', arm64: 'yt-dlp_arm64.exe' },
}
const asset = assets[process.platform]?.[process.arch]
if (!asset) {
  throw new Error(`No yt-dlp build with curl-cffi for ${process.platform}/${process.arch}`)
}

const directory = path.join('node_modules', 'yt-dlp-exec', 'bin')
const bin = path.join(
  directory,
  process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp',
)
const releaseResponse = await fetch(
  'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest',
)
if (!releaseResponse.ok) {
  throw new Error(`Cannot fetch yt-dlp release: HTTP ${releaseResponse.status}`)
}
const release = await releaseResponse.json()
const base = `https://github.com/yt-dlp/yt-dlp/releases/download/${release.tag_name}`
const [binaryResponse, checksumsResponse] = await Promise.all([
  fetch(`${base}/${asset}`),
  fetch(`${base}/SHA2-256SUMS`),
])
if (!binaryResponse.ok || !checksumsResponse.ok) {
  throw new Error(
    `Cannot download yt-dlp: HTTP ${binaryResponse.status}/${checksumsResponse.status}`,
  )
}
const binary = Buffer.from(await binaryResponse.arrayBuffer())
const checksums = await checksumsResponse.text()
const checksum = checksums
  .split('\n')
  .map((line) => line.trim().split(/\s+/))
  .find(([, name]) => name?.replace(/^\*/, '') === asset)?.[0]
if (createHash('sha256').update(binary).digest('hex') !== checksum) {
  throw new Error('yt-dlp checksum verification failed')
}

const temporaryDirectory = await mkdtemp(path.join(directory, 'yt-dlp-update-'))
try {
  const candidate = path.join(temporaryDirectory, path.basename(bin))
  await writeFile(candidate, binary, { mode: 0o755 })
  const targets = execFileSync(
    path.resolve(candidate),
    ['--ignore-config', '--no-cookies', '--no-cookies-from-browser', '--list-impersonate-targets'],
    { encoding: 'utf8' },
  )
  if (!/^Chrome.*\bcurl_cffi\s*$/m.test(targets)) {
    throw new Error('yt-dlp build has no Chrome impersonation support')
  }
  await rename(candidate, bin)
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
