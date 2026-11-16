// Token / scope self-check. GET only.
//
//   node skills/yuque-docs/yuque/auth.mjs            who am i + which scopes work
//   node skills/yuque-docs/yuque/auth.mjs set <t>    save token into state.json
//   node skills/yuque-docs/yuque/auth.mjs show       print the stored token (debug, do not share)

import { readState, saveState, whoami, listRepos } from './lib/yuque.mjs';

const [, , cmd, arg] = process.argv;

if (cmd === 'set') {
  if (!arg) {
    console.error('usage: auth.mjs set <token>');
    process.exit(1);
  }
  const state = readState();
  state.token = arg.trim();
  state.saved_at = new Date().toISOString();
  saveState(state);
  console.log('token saved to yuque/state.json (gitignored)');
  process.exit(0);
}

if (cmd === 'show') {
  const t = readState().token || '';
  console.log(t ? t.slice(0, 6) + '...' + t.slice(-4) + '  (' + t.length + ' chars)' : '(empty)');
  process.exit(0);
}

try {
  const me = await whoami();
  console.log('USER OK  ' + me.name + '  login=' + me.login + '  id=' + me.id);

  try {
    const repos = await listRepos(me.login);
    console.log('repos    OK  ' + repos.length + ' knowledge bases  (scope repo:read)');
    for (const r of repos) {
      console.log('   ' + (r.public ? 'public ' : 'private') + '  ' + r.namespace.padEnd(22) + ' ' + r.name + '  items=' + r.items);
    }
  } catch (e) {
    console.log('repos    FAIL ' + e.message);
  }
} catch (e) {
  console.log('USER FAIL ' + e.message);
  process.exit(1);
}
