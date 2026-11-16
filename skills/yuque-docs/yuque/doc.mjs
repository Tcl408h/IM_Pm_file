// Read one document. GET only.
//
//   node skills/yuque-docs/yuque/doc.mjs <namespace> <slug>                heading outline
//   node skills/yuque-docs/yuque/doc.mjs <namespace> <slug> --md          full markdown to stdout
//   node skills/yuque-docs/yuque/doc.mjs <namespace> <slug> --out <file>  save markdown to a file
//   node skills/yuque-docs/yuque/doc.mjs <namespace> <slug> --section "<heading>"   one section
//   node skills/yuque-docs/yuque/doc.mjs <namespace> <slug> --section "<heading>" --out <file>
//
// --section matches a heading line by exact text first, then by substring.
// A section runs from its heading to the next heading of the same or higher level.
//
// The body is cached on disk for 30 minutes (skills/yuque-docs/yuque/cache/), so
// outline -> section -> --md in one session costs exactly one API request.
// Yuque returns HTTP 429 when requests come too densely; --refresh forces a re-fetch.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { getDoc, outline, sliceSection } from './lib/yuque.mjs';

const args = process.argv.slice(2);
const value = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const pos = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out' && args[i - 1] !== '--section');

const [namespace, slug] = pos;
if (!namespace || !slug) {
  console.error('usage: doc.mjs <namespace> <slug> [--md | --out <file>] [--section "<heading>"] [--refresh]');
  process.exit(1);
}

const doc = await getDoc(namespace, slug, { refresh: args.includes('--refresh') || args.includes('--no-cache') });
const section = value('--section');
const outFile = value('--out');

if (args.includes('--refresh') || args.includes('--no-cache')) console.error('# cache bypassed');
else console.error('# source: cache (<=30min) or yuque');

let body = doc.body;
let part = null;
if (section) {
  part = sliceSection(doc.body, section);
  if (!part) {
    console.error('section not found: ' + section);
    console.error('available headings:');
    for (const h of outline(doc.body)) console.error('  ' + '#'.repeat(h.level) + ' ' + h.text);
    process.exit(2);
  }
  body = part.body;
  console.error('# section: ' + part.text + '  (lines ' + part.lineStart + '-' + part.lineEnd + ')');
}

if (outFile) {
  const abs = isAbsolute(outFile) ? outFile : join(process.cwd(), outFile);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body, 'utf8');
  console.error('# saved ' + body.length + ' chars -> ' + abs);
} else if (args.includes('--md')) {
  console.log(body);
} else if (section) {
  // Selected one section without --out: print exactly that section, nothing else.
  console.log('## ' + part.text + '  (lines ' + part.lineStart + '-' + part.lineEnd + ', ' + body.length + ' chars)');
  console.log('');
  console.log(body);
} else {
  const heads = outline(body);
  console.log('# ' + doc.title + '   (' + (doc.body.length) + ' chars, ' + doc.words + ' words, format=' + doc.format + ')');
  console.log('# updated ' + doc.updated + '   namespace=' + namespace + '  slug=' + slug);
  console.log('');
  for (const h of heads) console.log('  '.repeat(h.level - 1) + '#'.repeat(h.level) + ' ' + h.text);
  if (!heads.length) console.log('(no headings - use --md to see the body)');
}
