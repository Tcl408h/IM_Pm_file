// Client for the Modao MCP server (https://modao.cc/agent-py/ai/mcp).
//
// Only two things live here: OAuth token handling (PKCE login, auto refresh)
// and one JSON-RPC call to the get_proto_details tool. Nothing else of the
// server's 17 tools is ever called.
//
// Keep this file pure ASCII: Windows tooling mangles UTF-8 Chinese in .mjs.

import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url))); // skills/modao-prototype/modao
export const STATE_FILE = join(ROOT, 'state.json');
export const CACHE_DIR = join(ROOT, 'cache');
export const OUT_DIR = join(ROOT, 'out');
export const CLIENT_LABEL = 'deepseek-harness';

export const MCP_URL = 'https://modao.cc/agent-py/ai/mcp';
const REGISTER_ENDPOINT = 'https://modao.cc/agent-py/mcp/oauth/register';
const TOKEN_ENDPOINT = 'https://modao.cc/agent-py/mcp/oauth/token';
const AUTH_ENDPOINT = 'https://modao.cc/embed/mcp_oauth';
const REFRESH_MARGIN_MS = 300 * 1000;

export const CALLBACK_PORT = Number(process.env.MODAO_CALLBACK_PORT || 3090);
export const REDIRECT_URI = 'http://127.0.0.1:' + CALLBACK_PORT + '/oauth/callback';

// ---------- state ----------
export function readState() {
  if (!existsSync(STATE_FILE)) {
    throw new Error('no authorization yet: run  node skills/modao-prototype/modao/login.mjs');
  }
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

export function writeState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

// ---------- OAuth ----------
export async function registerClient() {
  const res = await fetch(REGISTER_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: 'DeepSeek Harness',
      redirect_uris: [REDIRECT_URI],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  });
  if (!res.ok) throw new Error('client registration failed: ' + res.status + ' ' + (await res.text()).slice(0, 300));
  return res.json();
}

export function newAuthorization(client) {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(16).toString('base64url');
  const url = AUTH_ENDPOINT + '?' + new URLSearchParams({
    response_type: 'code',
    client_id: client.client_id,
    redirect_uri: REDIRECT_URI,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    resource: MCP_URL,
  });
  const pending = {
    client_id: client.client_id,
    verifier,
    state,
    redirect_uri: REDIRECT_URI,
    token: null,
    created_at: Date.now(),
  };
  return { pending, url };
}

export async function exchangeCode(pending, code) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: pending.redirect_uri,
      client_id: pending.client_id,
      code_verifier: pending.verifier,
      resource: MCP_URL,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error('code exchange failed: ' + res.status + ' ' + text.slice(0, 300));
  const tokens = JSON.parse(text);
  const state = { ...pending, verifier: null, token: { ...tokens, saved_at: Date.now() } };
  writeState(state);
  return state.token;
}

async function refreshToken(state) {
  const rt = state.token && state.token.refresh_token;
  if (!rt) throw new Error('no refresh_token in ' + STATE_FILE + '; run  node skills/modao-prototype/modao/login.mjs');
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
  if (!res.ok) throw new Error('token refresh failed: ' + res.status + ' ' + text.slice(0, 300));
  const t = JSON.parse(text);
  state.token = {
    access_token: t.access_token,
    token_type: t.token_type || 'Bearer',
    expires_in: t.expires_in,
    refresh_token: t.refresh_token || rt,
    saved_at: Date.now(),
  };
  writeState(state);
  return state.token.access_token;
}

export async function accessToken() {
  const state = readState();
  const t = state.token;
  if (!t || !t.access_token) throw new Error('state.json has no token; run  node skills/modao-prototype/modao/login.mjs');
  const age = Date.now() - (t.saved_at || 0);
  if (age > (t.expires_in || 3600) * 1000 - REFRESH_MARGIN_MS) return refreshToken(state);
  return t.access_token;
}

// ---------- MCP transport ----------
// The server is stateless (no mcp-session-id) and answers either JSON or SSE.
function parseBody(text, contentType) {
  if (contentType && contentType.includes('text/event-stream')) {
    const payload = text
      .split(/\r?\n/)
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .join('\n')
      .trim();
    if (!payload) throw new Error('empty SSE payload');
    return JSON.parse(payload);
  }
  return JSON.parse(text);
}

async function rpc(token, payload) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: 'Bearer ' + token,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    const hint = res.status === 401 ? ' (token rejected, run  node skills/modao-prototype/modao/auth.mjs refresh)' : '';
    throw new Error('HTTP ' + res.status + hint + ' ' + text.slice(0, 300));
  }
  return parseBody(text, res.headers.get('content-type'));
}

export async function pingToken() {
  const token = await accessToken();
  const res = await rpc(token, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'modao-cli', version: '1.0.0' } },
  });
  return (res.result && res.result.serverInfo) || res;
}

// ---------- the only tool we use ----------
export async function getProtoDetails({ project_cid, target_key } = {}) {
  if (!project_cid) throw new Error('getProtoDetails needs project_cid');
  const token = await accessToken();
  await rpc(token, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'modao-cli', version: '1.0.0' } },
  });
  const args = { project_cid, client: CLIENT_LABEL };
  if (target_key) args.target_key = target_key;
  const res = await rpc(token, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_proto_details', arguments: args } });
  if (res.error) throw new Error('tools/call error: ' + JSON.stringify(res.error).slice(0, 300));
  const text = ((res.result && res.result.content) || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, message: text.slice(0, 500) };
  }
}

// ---------- tree helpers (shared by the CLI commands) ----------
// A get_proto_details response carries the target node under [key] and its
// direct children under [key + " SUB"] as { childKey: node }.
export function unpack(payload, key) {
  const json = (payload && payload.json) || {};
  return { node: json[key] || null, children: json[key + ' SUB'] || null };
}

export const isCanvas = (n) => !!n && n.type === 'rResCanvas';
export const isPageFolder = (n) => !!n && n.bunch === 'rbPage';
export const nodeSize = (n) => [
  (n && (n.w || n.deviceW)) || 0,
  (n && (n.h || n.deviceH)) || 0,
];
