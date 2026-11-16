// Fetch a web page and turn it into readable material: title, main text,
// headings, links, images and meta. This is the "read the web page" tool; it
// works on any public URL (a Modao share link, a docs page, a PRD in Notion...).
//
//   node skills/read-web/webread/read.mjs <url>                 page text + structure
//   node skills/read-web/webread/read.mjs <url> --md            same, as markdown (saved too)
//   node skills/read-web/webread/read.mjs <url> --json          full structured payload
//   node skills/read-web/webread/read.mjs <url> --raw           raw HTML on stdout (no parsing)
//   node skills/read-web/webread/read.mjs <url> --img           download every <img> to cache
//   node skills/read-web/webread/read.mjs <url> --sel h1,.card  keep only matching elements
//   node skills/read-web/webread/read.mjs <url> --wait 3000     retry after JS-heavy pages stall
//
// Options: --timeout <ms> (default 30000), --cookie "<header>" for pages behind a
// login, --save <name> to choose the cache file name.
//
// Every fetch is cached in cache/<slug>-<hash>.{html,md}; nothing is written
// outside skills/read-web/webread. Keep this file pure ASCII.

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureDir, ROOT } from '../../modao-prototype/modao/lib/modao.mjs';

// ROOT is skills/modao-prototype/modao, so two levels up is skills/
const CACHE = join(ROOT, '..', '..', 'read-web', 'webread', 'cache');
const OUT = join(ROOT, '..', '..', 'read-web', 'webread', 'out');

const argv = process.argv.slice(2);
const flags = argv.filter((a) => a.startsWith('--'));
const flagValue = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const url = argv.find((a) => !a.startsWith('--') && /^https?:\/\//i.test(a));

if (!url) {
  console.log('usage: node skills/read-web/webread/read.mjs <url> [--md] [--json] [--raw] [--img] [--sel css] [--timeout ms] [--cookie hdr] [--save name]');
  process.exit(2);
}

const timeout = Number(flagValue('--timeout', '30000'));
const cookie = flagValue('--cookie', '');
const saveName = flagValue('--save', '');
const waitExtra = Number(flagValue('--wait', '0'));
const selector = flagValue('--sel', '');

ensureDir(CACHE);
ensureDir(OUT);

const hash = createHash('sha1').update(url).digest('hex').slice(0, 8);
const slug = (saveName || new URL(url).hostname.replace(/^www\./, '') + '-' + (new URL(url).pathname.split('/').filter(Boolean).pop() || 'index'))
  .replace(/[^\w.-]+/g, '_')
  .slice(0, 60);
const base = slug + '-' + hash;

async function fetchText(target) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(target, {
      redirect: 'follow',
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        ...(cookie ? { cookie } : {}),
      },
      signal: ctrl.signal,
    });
    const body = await res.text();
    return { status: res.status, headers: res.headers, body };
  } finally {
    clearTimeout(timer);
  }
}

const decodeEntities = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&');

function textOf(html) {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|section|article|li|tr|h[1-6]|header|footer|blockquote)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    out[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? '');
  }
  return out;
}

function meta(html, name) {
  for (const m of html.matchAll(/<meta\s+[^>]*>/gi)) {
    const a = attrs(m[0]);
    const k = (a.property || a.name || '').toLowerCase();
    if (k === name) return a.content || '';
  }
  return '';
}

function absolute(href, baseUrl) {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

function parse(html) {
  const pick = selector
    ? (() => {
        const cls = selector.replace(/^[.#]/, '');
        const re = new RegExp('<([a-z0-9]+)[^>]*(?:class|id)\\s*=\\s*"[^"]*' + cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^"]*"[^>]*>([\\s\\S]*?)</\\1>', 'gi');
        return [...html.matchAll(re)].map((m) => m[0]).join('\n');
      })()
    : html;
  const title = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1]).trim();
  const headings = [];
  for (const m of pick.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const t = textOf(m[2]).replace(/\s+/g, ' ');
    if (t) headings.push({ level: Number(m[1]), text: t });
  }
  const links = [];
  for (const m of pick.matchAll(/<a\s+[^>]*>([\s\S]*?)<\/a>/gi)) {
    const a = attrs(m[0]);
    const t = textOf(m[1]).replace(/\s+/g, ' ');
    if (a.href && t) links.push({ text: t, href: absolute(a.href, url) });
  }
  const images = [];
  for (const m of pick.matchAll(/<img\s+[^>]*>/gi)) {
    const a = attrs(m[0]);
    if (a.src) images.push({ alt: a.alt || '', src: absolute(a.src, url) });
  }
  const text = textOf(pick);
  return {
    url,
    title,
    description: meta(html, 'description') || meta(html, 'og:description'),
    ogTitle: meta(html, 'og:title'),
    ogImage: meta(html, 'og:image'),
    text,
    headings,
    links,
    images,
  };
}

function toMarkdown(p) {
  const out = [];
  out.push('# ' + (p.ogTitle || p.title || p.url));
  out.push('');
  out.push('> ' + p.url);
  if (p.description) out.push('> ' + p.description);
  out.push('');
  if (p.headings.length) {
    out.push('## 目录');
    for (const h of p.headings) out.push('  '.repeat(Math.max(0, h.level - 1)) + '- ' + h.text);
    out.push('');
  }
  out.push('## 正文');
  out.push('');
  out.push(p.text);
  if (p.images.length) {
    out.push('');
    out.push('## 图片 (' + p.images.length + ')');
    for (const img of p.images) out.push('- ' + (img.alt || '(no alt)') + ' ' + img.src);
  }
  if (p.links.length) {
    out.push('');
    out.push('## 链接 (' + p.links.length + ')');
    for (const l of p.links.slice(0, 80)) out.push('- [' + l.text + '](' + l.href + ')');
  }
  return out.join('\n');
}

const main = async () => {
  let res = await fetchText(url);
  if (waitExtra && (res.status >= 400 || res.body.length < 500)) {
    await new Promise((r) => setTimeout(r, waitExtra));
    res = await fetchText(url);
  }
  const htmlPath = join(CACHE, base + '.html');
  writeFileSync(htmlPath, res.body, 'utf8');
  console.log('HTTP\t' + res.status + '\t' + (res.headers.get('content-type') || ''));
  console.log('bytes\t' + res.body.length);
  console.log('html\t' + htmlPath);

  if (flags.includes('--raw')) {
    process.stdout.write(res.body);
    return;
  }
  if (!/html/i.test(res.headers.get('content-type') || '') && !/<html/i.test(res.body.slice(0, 2000))) {
    console.log('\n(not an HTML document; --raw prints it)');
    return;
  }

  const page = parse(res.body);
  const md = toMarkdown(page);
  const mdPath = join(CACHE, base + '.md');
  writeFileSync(mdPath, md, 'utf8');
  console.log('md\t' + mdPath + '\t' + md.length + ' chars');
  console.log('title\t' + (page.title || '(none)'));
  console.log('headings\t' + page.headings.length + '\tlinks\t' + page.links.length + '\timages\t' + page.images.length);
  console.log('text\t' + page.text.length + ' chars');

  if (flags.includes('--img')) {
    const dir = join(OUT, base);
    ensureDir(dir);
    let n = 0;
    for (const img of page.images) {
      try {
        const r = await fetch(img.src, { headers: { 'user-agent': 'Mozilla/5.0', referer: url } });
        if (!r.ok) continue;
        const ext = (img.src.split('?')[0].match(/\.(png|jpe?g|webp|gif|svg)$/i) || [, 'bin'])[1];
        const file = join(dir, String(++n).padStart(2, '0') + '.' + ext.toLowerCase());
        writeFileSync(file, Buffer.from(await r.arrayBuffer()));
        console.log('img\t' + file + '\t' + img.src);
      } catch (e) {
        console.log('img-fail\t' + img.src + '\t' + e.message);
      }
    }
    console.log('images saved to\t' + dir);
  }

  if (flags.includes('--json')) {
    const jsonPath = join(CACHE, base + '.json');
    writeFileSync(jsonPath, JSON.stringify(page, null, 2), 'utf8');
    console.log('json\t' + jsonPath);
  }

  console.log('\n' + (flags.includes('--md') ? md : page.text.slice(0, 20000)));
};

await main().catch((e) => {
  console.error('ERROR ' + (e && e.message ? e.message : String(e)));
  process.exit(1);
});
