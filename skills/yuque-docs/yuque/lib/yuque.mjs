// Yuque read-only client.
// Hard rule: this file contains GET requests only. No POST / PUT / PATCH / DELETE.
// All text is ASCII on purpose: Windows code pages corrupt non-ASCII sources.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// state.json lives one level up (yuque/state.json), next to auth.mjs / repos.mjs / doc.mjs.
export const STATE_FILE = join(HERE, '..', 'state.json');
export const OUT_DIR = join(HERE, '..', 'out');
const API = 'https://www.yuque.com/api/v2';

export function readState() {
  if (!existsSync(STATE_FILE)) return { token: '' };
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { token: '' };
  }
}

export function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

export function getToken() {
  const token = process.env.YUQUE_TOKEN || readState().token || '';
  if (!token) {
    throw new Error('no yuque token: run `node skills/yuque-docs/yuque/auth.mjs set <token>` first');
  }
  return token;
}

// GET only. Anything else is a bug in this repo.
//
// Yuque rate-limits hard (HTTP 429). Observed: after ~8 requests in a few minutes
// every endpoint returns 429 for several minutes. So:
//   - a 429 is never retried aggressively: we wait `retryAfter` seconds once, then fail;
//   - a doc body is cached on disk for `DOC_TTL_MS` so outline + section + --md in one
//     session cost exactly ONE request;
//   - `--refresh` / `--no-cache` on the command line bypasses the cache.
export const DOC_TTL_MS = 30 * 60 * 1000;
const DOC_CACHE_DIR = join(HERE, '..', 'cache');

function docCacheFile(namespace, slug) {
  const safe = String(namespace).replace(/[^\w.-]+/g, '_') + '__' + String(slug).replace(/[^\w.-]+/g, '_');
  return join(DOC_CACHE_DIR, 'doc-' + safe + '.json');
}

export async function get(path, { timeout = 30000, retryAfter = 20 } = {}) {
  const url = path.startsWith('http') ? path : API + path;
  const once = async () => {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        // Yuque only accepts this header name; Authorization: Bearer always returns 401.
        'X-Auth-Token': getToken(),
        'User-Agent': 'im-chat-group/0.1 (readonly)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(timeout),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { res, text, json };
  };
  let { res, text, json } = await once();
  if (res.status === 429) {
    const hinted = Number(res.headers.get('retry-after') || 0);
    const wait = Math.min(hinted > 0 ? hinted : retryAfter, 60);
    console.error('  429 rate limited -> waiting ' + wait + 's, then one retry');
    await new Promise((r) => setTimeout(r, wait * 1000));
    ({ res, text, json } = await once());
    if (res.status === 429) {
      throw new Error('GET ' + path + ' -> HTTP 429 语雀接口限流：一次会话里请求太密。等 5-10 分钟后重试，'
        + '或先用本地缓存（skills/yuque-docs/yuque/cache/，有效期 30 分钟）');
    }
  }
  if (!res.ok) {
    const msg = (json && json.message) || text.slice(0, 200);
    throw new Error('GET ' + path + ' -> HTTP ' + res.status + ' ' + msg);
  }
  return json;
}

export async function whoami() {
  return (await get('/user')).data;
}

export async function listRepos(login) {
  const user = login || (await whoami()).login;
  // No ?type=all: that value is rejected with HTTP 422 "type invalid".
  const data = (await get('/users/' + encodeURIComponent(user) + '/repos')).data || [];
  return data.map((r) => ({
    namespace: r.namespace,
    name: r.name,
    slug: r.slug,
    public: !!r.public,
    items: r.items_count,
    type: r.type,
    updated: r.updated_at,
  }));
}

// The namespace prefix follows the same rule as the repo endpoint:
//   repo  level: /repos/<login>/<slug>      -> both path segments encoded
//   doc   level: /repos/<login>/<slug>/docs -> login encoded, slug left raw
// Getting this wrong yields a 404 or silently returns the Book object instead of the doc list.
function repoPath(namespace) {
  const [login, ...rest] = String(namespace).split('/');
  return '/repos/' + encodeURIComponent(login) + '/' + rest.join('/');
}

export async function listDocs(namespace) {
  const res = await get(repoPath(namespace) + '/docs');
  const data = res.data;
  const rows = Array.isArray(data) ? data : (data && Array.isArray(data.docs) ? data.docs : null);
  if (!rows) {
    throw new Error('unexpected /docs payload for ' + namespace + ': ' + JSON.stringify(data).slice(0, 200));
  }
  return rows.map((d) => ({
    title: d.title,
    slug: d.slug,
    id: d.id,
    words: d.word_count,
    public: !!d.public,
    updated: d.updated_at,
  }));
}

export async function getDoc(namespace, slug, { refresh = false } = {}) {
  const file = docCacheFile(namespace, slug);
  if (!refresh && existsSync(file)) {
    try {
      const cached = JSON.parse(readFileSync(file, 'utf8'));
      if (Date.now() - cached.at < DOC_TTL_MS) return cached.doc;
    } catch { /* corrupt cache, fall through to network */ }
  }
  const res = await get(repoPath(namespace) + '/docs/' + slug);
  const d = res.data;
  const doc = {
    title: d.title,
    slug: d.slug,
    id: d.id,
    words: d.word_count,
    format: d.format,
    public: !!d.public,
    created: d.created_at,
    updated: d.updated_at,
    // `body` is clean markdown even for lake-format docs; body_html / body_lake also exist.
    body: d.body || '',
  };
  try {
    if (!existsSync(DOC_CACHE_DIR)) mkdirSync(DOC_CACHE_DIR, { recursive: true });
    writeFileSync(file, JSON.stringify({ at: Date.now(), namespace, slug, doc }), 'utf8');
  } catch { /* cache is best effort */ }
  return doc;
}

// Pull the heading outline of a markdown body.
export function outline(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^#{1,6}\s+\S/.test(line))
    .map((line) => {
      const m = line.match(/^(#{1,6})\s+(.*)$/);
      return { level: m[1].length, text: m[2].trim() };
    });
}

// Slice a markdown body by heading text.
// mode "section": the heading and everything under it, up to the next same-or-higher heading.
// mode "subtree": same, but includes every descendant heading level.
export function sliceSection(markdown, headingText, mode = 'section') {
  const lines = markdown.split(/\r?\n/);
  const starts = [];
  lines.forEach((line, i) => {
    const m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m) starts.push({ i, level: m[1].length, text: m[2].trim() });
  });
  const norm = (s) => s.replace(/\s+/g, ' ').toLowerCase();
  const target = starts.find((s) => norm(s.text) === norm(headingText)) ||
    starts.find((s) => norm(s.text).includes(norm(headingText)));
  if (!target) return null;
  const end = starts.find((s) => s.i > target.i && s.level <= target.level);
  const stop = end ? end.i : lines.length;
  return {
    level: target.level,
    text: target.text,
    lineStart: target.i + 1,
    lineEnd: stop,
    body: lines.slice(target.i, stop).join('\n').replace(/\s+$/, '') + '\n',
  };
}
