// Token maintenance for the Modao MCP connection.
//
//   node skills/modao-prototype/modao/auth.mjs check     initialize with the stored token
//   node skills/modao-prototype/modao/auth.mjs refresh   exchange refresh_token for a new access_token
//
// access_token lives 3600 s; every CLI call refreshes automatically when fewer
// than 300 s are left. Keep this file pure ASCII.

import { STATE_FILE, accessToken, pingToken, readState, writeState } from './lib/modao.mjs';

const TOKEN_ENDPOINT = 'https://modao.cc/agent-py/mcp/oauth/token';
const MCP_URL = 'https://modao.cc/agent-py/ai/mcp';
const cmd = process.argv[2] || 'check';

async function refresh() {
  const state = readState();
  const rt = state.token && state.token.refresh_token;
  if (!rt) throw new Error('no refresh_token in ' + STATE_FILE + ', run  node skills/modao-prototype/modao/login.mjs');
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: rt,
      client_id: state.client_id,
      resource: MCP_URL,
    }),
  });
  const text = await res.text();
  console.log('refresh -> ' + res.status);
  if (!res.ok) {
    console.log(text.slice(0, 400));
    return false;
  }
  const t = JSON.parse(text);
  state.token = {
    access_token: t.access_token,
    token_type: t.token_type || 'Bearer',
    expires_in: t.expires_in,
    refresh_token: t.refresh_token || rt,
    saved_at: Date.now(),
  };
  writeState(state);
  console.log('TOKEN REFRESHED ttl=' + t.expires_in);
  return true;
}

async function check() {
  const info = await pingToken();
  console.log('initialize OK ' + JSON.stringify(info));
}

try {
  if (cmd === 'refresh') {
    if (await refresh()) await check();
  } else if (cmd === 'check') {
    await check();
  } else if (cmd === 'token') {
    console.log(await accessToken());
  } else {
    console.log('usage: node skills/modao-prototype/modao/auth.mjs check|refresh|token');
    process.exit(2);
  }
} catch (err) {
  console.error('ERROR ' + (err && err.message ? err.message : String(err)));
  if (String(err && err.message).includes('401')) {
    console.error('hint: node skills/modao-prototype/modao/auth.mjs refresh   (or re-run login.mjs)');
  }
  process.exit(1);
}
