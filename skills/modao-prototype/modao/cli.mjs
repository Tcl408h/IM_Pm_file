// Modao prototype CLI for the IM review workflow. Only get_proto_details is used.
//
//   node skills/modao-prototype/modao/cli.mjs projects
//   node skills/modao-prototype/modao/cli.mjs pages  <project_cid>
//   node skills/modao-prototype/modao/cli.mjs tree   <project_cid> [page_key] [--refresh] [--md]
//   node skills/modao-prototype/modao/cli.mjs node   <project_cid> <target_key>
//   node skills/modao-prototype/modao/cli.mjs text   <project_cid> <canvas_key>
//   node skills/modao-prototype/modao/cli.mjs shot   <project_cid>            export page PNGs + index.html
//   node skills/modao-prototype/modao/cli.mjs shot   <project_cid> <target_key>
//
// tree  walks one top-level page (or the whole project) down to rResCanvas nodes
//       and caches the result in cache/tree-<project>.json; --refresh re-walks.
// node  prints one node with its fill and text summary, no full JSON dump.
// text  lists every visible text/button inside a canvas in reading order.
// shot  exports each selected page group as PNG (export_proto_to_png) and builds
//       out/<project>/index.html listing them, ready to review or feed a prompt.
//
// Keep this file pure ASCII; run it from the repo root.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CACHE_DIR,
  CLIENT_LABEL,
  OUT_DIR,
  accessToken,
  ensureDir,
  getProtoDetails,
  isCanvas,
  nodeSize,
  unpack,
} from './lib/modao.mjs';

const MCP_URL = 'https://modao.cc/agent-py/ai/mcp';
const argv = process.argv.slice(2);
const flags = argv.filter((a) => a.startsWith('--'));
const args = argv.filter((a) => !a.startsWith('--'));
const [cmd, cid, key] = args;

const usage = () => {
  console.log(`usage:
  node skills/modao-prototype/modao/cli.mjs projects
  node skills/modao-prototype/modao/cli.mjs pages  <project_cid>
  node skills/modao-prototype/modao/cli.mjs tree   <project_cid> [page_key] [--refresh] [--md]
  node skills/modao-prototype/modao/cli.mjs node   <project_cid> <target_key>
  node skills/modao-prototype/modao/cli.mjs text   <project_cid> <canvas_key>
  node skills/modao-prototype/modao/cli.mjs shot   <project_cid> [canvas_key]   # 导出 PNG 并下载到 out/`);
};

// ---------- shared: raw JSON-RPC for tools beyond get_proto_details ----------
// export_proto_to_png is reached here only, and only when the user asks for a
// screenshot export; the review flow itself stays on get_proto_details.
async function callOtherTool(name, toolArgs) {
  const token = await accessToken();
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    authorization: 'Bearer ' + token,
  };
  await fetch(MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'modao-cli', version: '1.0.0' } },
    }),
  });
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: toolArgs } }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(name + ' HTTP ' + res.status + ' ' + text.slice(0, 300));
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('text/event-stream')
    ? text.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n')
    : text;
  const parsed = JSON.parse(body);
  if (parsed.error) throw new Error(name + ' error ' + JSON.stringify(parsed.error).slice(0, 300));
  const joined = ((parsed.result && parsed.result.content) || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
  try {
    return JSON.parse(joined);
  } catch {
    return { raw: joined };
  }
}

// ---------- projects ----------
async function projects() {
  const res = await callOtherTool('list_created_prototypes', { client: CLIENT_LABEL });
  const list = (res && res.projects) || [];
  if (!list.length) {
    console.log('(no projects)');
    return;
  }
  console.log('project_cid\tname\tspace\tupdated');
  for (const p of list) {
    console.log([p.project_cid, p.project_name, p.space_name || p.org_name || '', p.updated_at || ''].join('\t'));
  }
}

// ---------- pages ----------
async function pages(projectCid) {
  const p = await getProtoDetails({ project_cid: projectCid });
  if (!p || !p.success) {
    console.log('FAILED ' + (p && p.message));
    return;
  }
  console.log('project_cid\t' + (p.project_cid || projectCid));
  console.log('');
  console.log('name\tkey');
  for (const it of p.json || []) console.log([it.name, it.key].join('\t'));
}

// ---------- tree ----------
const treeFile = (projectCid) => join(CACHE_DIR, 'tree-' + projectCid + '.json');

async function buildTree(projectCid, pageKey) {
  const roots = [];
  if (pageKey) {
    roots.push(pageKey);
  } else {
    const index = await getProtoDetails({ project_cid: projectCid });
    if (!index || !index.success) throw new Error('index failed: ' + (index && index.message));
    for (const it of index.json || []) roots.push(it.key);
  }
  const rows = [];
  const seen = new Set();
  let calls = 0;

  async function walk(root) {
    const stack = [{ key: root, path: [], depth: 0 }];
    while (stack.length) {
      const { key: k, path, depth } = stack.pop();
      if (!k || seen.has(k) || depth > 8) continue;
      seen.add(k);
      calls += 1;
      const payload = await getProtoDetails({ project_cid: projectCid, target_key: k });
      if (!payload || !payload.success) {
        rows.push({ key: k, name: '(error)', path: path.join(' / '), type: 'ERROR', note: payload && payload.message });
        continue;
      }
      const { node, children } = unpack(payload, k);
      const name = (node && node.name) || k;
      const here = [...path, name];
      if (isCanvas(node)) {
        const [w, h] = nodeSize(node);
        rows.push({ key: k, name, path: here.join(' / '), type: 'canvas', device: node.device || '', w, h });
      } else if (!children) {
        rows.push({ key: k, name, path: here.join(' / '), type: 'leaf' });
      }
      if (!children) continue;
      for (const ck of Object.keys(children)) {
        if (ck.endsWith(' SUB')) continue;
        stack.push({ key: ck, path: here, depth: depth + 1 });
      }
      await sleep(350); // the Modao edge (ALB) rate-limits rapid bursts
    }
  }

  for (const root of roots) await walk(root);
  const doc = { projectCid, pageKey: pageKey || null, at: new Date().toISOString(), calls, rows };
  ensureDir(CACHE_DIR);
  writeFileSync(treeFile(projectCid), JSON.stringify(doc, null, 2), 'utf8');
  return doc;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tree(projectCid, pageKey) {
  const file = treeFile(projectCid);
  let doc;
  if (!flags.includes('--refresh') && existsSync(file)) {
    doc = JSON.parse(readFileSync(file, 'utf8'));
    if ((pageKey || null) !== (doc.pageKey || null)) doc = await buildTree(projectCid, pageKey);
  } else {
    doc = await buildTree(projectCid, pageKey);
  }
  const canvases = doc.rows.filter((r) => r.type === 'canvas');
  if (flags.includes('--md')) {
    console.log('| # | 页面路径 | canvas_key | 设备 | 尺寸 |');
    console.log('|---|---|---|---|---|');
    canvases.forEach((r, i) => console.log(`| ${i + 1} | ${r.path} | ${r.key} | ${r.device} | ${r.w}x${r.h} |`));
  } else {
    console.log('calls\t' + doc.calls + (doc.pageKey ? ' (page ' + doc.pageKey + ')' : ' (whole project)'));
    console.log('canvases\t' + canvases.length);
    console.log('');
    console.log('#\tpath\tkey\tdevice\tsize');
    canvases.forEach((r, i) => console.log([i + 1, r.path, r.key, r.device, r.w + 'x' + r.h].join('\t')));
  }
}

// ---------- node ----------
function summarizeNode(node) {
  const [w, h] = nodeSize(node);
  const out = {
    type: node.type,
    bunch: node.bunch || undefined,
    name: node.name || '',
    size: w + 'x' + h,
    device: node.device || undefined,
    fill: node.fill && node.fill.fillIsVisible ? node.fill.solidColor : undefined,
    isVisible: node.isVisible,
    asOverlay: node.asOverlay,
  };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

async function node(projectCid, targetKey) {
  const p = await getProtoDetails({ project_cid: projectCid, target_key: targetKey });
  if (!p || !p.success) {
    console.log('FAILED ' + (p && p.message));
    return;
  }
  const { node: n, children } = unpack(p, targetKey);
  console.log(JSON.stringify(summarizeNode(n || {}), null, 2));
  const kids = children ? Object.keys(children).filter((k) => !k.endsWith(' SUB')) : [];
  console.log('\nchildren\t' + kids.length);
  for (const k of kids) {
    const c = children[k];
    console.log([k, c.type, c.name || '', (c.w || 0) + 'x' + (c.h || 0), c.isVisible === false ? 'hidden' : ''].join('\t'));
  }
}

// ---------- text ----------
async function text(projectCid, canvasKey) {
  const p = await getProtoDetails({ project_cid: projectCid, target_key: canvasKey });
  if (!p || !p.success) {
    console.log('FAILED ' + (p && p.message));
    return;
  }
  const { children } = unpack(p, canvasKey);
  const lines = [];
  const collect = (map) => {
    for (const k of Object.keys(map)) {
      const c = map[k];
      if (c.isVisible === false) continue;
      const label = c.text || c.content || c.name || '';
      if (['wRichText', 'wButton', 'wMTextInput', 'wDropMenu', 'wTable'].includes(c.type) && label) {
        lines.push([c.type, label.replace(/\s+/g, ' ').slice(0, 120), (c.x || 0) + ',' + (c.y || 0)].join('\t'));
      }
    }
  };
  if (children) collect(children);
  console.log('items\t' + lines.length);
  console.log('#\ttype\ttext\tx,y');
  lines.forEach((l, i) => console.log(i + 1 + '\t' + l));
}

// ---------- shot ----------
// export_proto_to_png takes project_cid + canvas_key (NOT target_key);
// it returns a temporary URL valid for 60 minutes, which we download right away.
const PNG_URL_RE = /(https?:\/\/[^\s"'<>]+\.png)/i;

async function downloadPng(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('download HTTP ' + res.status + ' ' + url);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  return buf.length;
}

async function shot(projectCid, targetKey) {
  const outDir = join(OUT_DIR, projectCid);
  ensureDir(outDir);
  const targets = [];
  if (targetKey) {
    targets.push(targetKey);
  } else {
    const file = treeFile(projectCid);
    if (!existsSync(file)) throw new Error('no tree cache; run  node skills/modao-prototype/modao/cli.mjs tree ' + projectCid + '  first');
    const doc = JSON.parse(readFileSync(file, 'utf8'));
    for (const r of doc.rows.filter((x) => x.type === 'canvas')) targets.push(r.key);
  }
  const results = [];
  let ok = 0;
  for (const t of targets) {
    let res;
    let saved = null;
    try {
      res = await callOtherTool('export_proto_to_png', { project_cid: projectCid, canvas_key: t });
      if (res && res.isError) throw new Error('tool error: ' + String(res.raw || '').split('\n')[0]);
      const url = (JSON.stringify(res).match(PNG_URL_RE) || [])[1];
      if (!url) throw new Error('no png url in reply: ' + JSON.stringify(res).slice(0, 160));
      const dest = join(outDir, t + '.png');
      const bytes = await downloadPng(url, dest);
      saved = { path: dest, bytes };
      ok += 1;
      console.log(t + '\tOK\t' + bytes + 'B\t' + dest);
    } catch (e) {
      res = res || {};
      console.log(t + '\tFAIL\t' + String(e.message).slice(0, 200));
    }
    results.push({ key: t, saved, res });
    await sleep(800);
  }
  writeFileSync(join(outDir, 'export.json'), JSON.stringify(results, null, 2), 'utf8');
  console.log('--- ' + ok + '/' + targets.length + ' exported -> ' + outDir);
  if (!ok) process.exitCode = 1;
}

// ---------- main ----------
try {
  if (!cmd || cmd === '-h' || cmd === '--help') {
    usage();
  } else if (cmd === 'projects') {
    await projects();
  } else if (cmd === 'pages' && cid) {
    await pages(cid);
  } else if (cmd === 'tree' && cid) {
    await tree(cid, key);
  } else if (cmd === 'node' && cid && key) {
    await node(cid, key);
  } else if (cmd === 'text' && cid && key) {
    await text(cid, key);
  } else if (cmd === 'shot' && cid) {
    await shot(cid, key);
  } else {
    usage();
    process.exit(2);
  }
} catch (err) {
  console.error('ERROR ' + (err && err.message ? err.message : String(err)));
  process.exit(1);
}
