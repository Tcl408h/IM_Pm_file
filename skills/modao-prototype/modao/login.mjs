// One-shot OAuth (PKCE) login for the Modao MCP server.
//
//   node skills/modao-prototype/modao/login.mjs             start a flow: prints the URL, waits on
//                                          http://127.0.0.1:3090/oauth/callback
//   node skills/modao-prototype/modao/login.mjs --code XXX  exchange a code you already captured
//
// Port 3080 belongs to the DSH web UI and never forwards /oauth/callback, so the
// receiver uses 3090. redirect_uri is re-registered on every run (DCR), which
// makes a port change free.
//
// Codes expire within seconds: keep this process running while you authorize.
// Keep this file pure ASCII.

import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  REDIRECT_URI,
  ROOT,
  exchangeCode,
  newAuthorization,
  readState,
  registerClient,
  writeState,
} from './lib/modao.mjs';

const URL_FILE = join(ROOT, 'open-url.txt');
const argv = process.argv.slice(2);
const manualCode = argv.includes('--code') ? argv[argv.indexOf('--code') + 1] : null;

if (manualCode) {
  const pending = readState();
  const token = await exchangeCode(pending, manualCode);
  console.log('TOKENS SAVED ttl=' + token.expires_in);
  process.exit(0);
}

const client = await registerClient();
const { pending, url } = newAuthorization(client);
writeState(pending);
writeFileSync(URL_FILE, url + '\r\n', 'utf8');

console.log('client_id    ' + client.client_id);
console.log('redirect_uri ' + REDIRECT_URI);
console.log('state        ' + pending.state);
console.log('');
console.log('1) open this URL, sign in to Modao if asked, click the authorize button:');
console.log('');
console.log(url);
console.log('');
console.log('(same URL written to ' + URL_FILE + ')');
console.log('waiting for the callback on ' + REDIRECT_URI + ' ...');

let finished = false;

const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  if (u.pathname !== '/oauth/callback') {
    res.writeHead(404).end('404');
    return;
  }
  const send = (html) => res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(
    '<!doctype html><meta charset="utf-8"><title>Modao OAuth</title>' +
      '<body style="font:16px/1.7 system-ui;padding:60px;text-align:center">' + html + '</body>',
  );

  const error = u.searchParams.get('error');
  const code = u.searchParams.get('code');
  if (error) {
    send('authorization failed: ' + error);
    server.close();
    process.exit(1);
  }
  if (!code) {
    send('no code in callback, retry the authorize step');
    return;
  }
  if (u.searchParams.get('state') !== pending.state) {
    send('state mismatch (stale authorize page), start a new login');
    return;
  }
  if (finished) {
    send('this flow already finished');
    return;
  }
  finished = true;
  try {
    const token = await exchangeCode(pending, code);
    console.log('TOKENS SAVED ttl=' + token.expires_in);
    send('OK, tokens saved. You can close this tab.');
    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 300);
  } catch (err) {
    console.log(String(err && err.message ? err.message : err));
    send('token exchange failed: codes expire within seconds, run login again.');
    setTimeout(() => {
      server.close();
      process.exit(1);
    }, 300);
  }
});

server.on('error', (err) => {
  console.error('listen failed: ' + err.code + ' ' + err.message);
  process.exit(3);
});
server.listen(Number(new URL(REDIRECT_URI).port), '127.0.0.1');

setTimeout(() => {
  console.log('TIMEOUT: no callback within 10 minutes');
  server.close();
  process.exit(4);
}, 10 * 60 * 1000);
