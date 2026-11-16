// Knowledge bases and document lists. GET only.
//
//   node skills/yuque-docs/yuque/repos.mjs                  all knowledge bases
//   node skills/yuque-docs/yuque/repos.mjs --json           machine readable
//   node skills/yuque-docs/yuque/repos.mjs <namespace>      documents inside one knowledge base
//   node skills/yuque-docs/yuque/repos.mjs <namespace> --json

import { whoami, listRepos, listDocs } from './lib/yuque.mjs';

const args = process.argv.slice(2);
const json = args.includes('--json');
const target = args.find((a) => !a.startsWith('--'));
// With a namespace argument the same script lists that knowledge base's documents.
const isToc = Boolean(target);

function table(rows) {
  if (!rows.length) return '(empty)';
  const cols = Object.keys(rows[0]);
  const width = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length)));
  const line = (vals) => vals.map((v, i) => String(v ?? '').padEnd(width[i])).join('  ');
  return [line(cols), line(width.map((w) => '-'.repeat(w))), ...rows.map((r) => line(cols.map((c) => r[c])))].join('\n');
}

if (isToc) {
  if (!target) {
    console.error('usage: toc.mjs <namespace> [--json]');
    process.exit(1);
  }
  const docs = await listDocs(target);
  if (json) {
    console.log(JSON.stringify({ namespace: target, docs }, null, 2));
  } else {
    console.log('# ' + target + '  (' + docs.length + ' docs)');
    console.log(table(docs.map((d) => ({ slug: d.slug, title: d.title, words: d.words, updated: (d.updated || '').slice(0, 10) }))));
  }
} else {
  const me = await whoami();
  const repos = await listRepos(me.login);
  if (json) {
    console.log(JSON.stringify({ user: me.login, repos }, null, 2));
  } else {
    console.log('# ' + me.name + ' (' + me.login + ')  ' + repos.length + ' knowledge bases');
    console.log(table(repos.map((r) => ({ namespace: r.namespace, name: r.name, items: r.items, type: r.type, updated: (r.updated || '').slice(0, 10) }))));
  }
}
