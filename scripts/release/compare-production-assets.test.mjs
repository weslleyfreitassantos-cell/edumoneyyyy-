import { it, expect } from 'vitest';
import { getEntries, compare } from './compare-production-assets.mjs';

it('extracts script and css, ignores third-party styles and preloads', () => {
  expect(getEntries('<link rel="preload" href="/assets/x.js"><link rel="stylesheet" href="https://fonts.googleapis.com/css2"><script type="module" src="/assets/main.js"></script><link rel="stylesheet" href="/assets/main.css">')).toEqual([
    {kind:'js',path:'/assets/main.js'}, {kind:'css',path:'/assets/main.css'}
  ]);
});

it('detects different production assets without falsely claiming parity', async () => {
  const local = '<script type="module" src="/assets/local.js"></script><link rel="stylesheet" href="/assets/local.css">';
  const live = '<script type="module" src="/assets/prod.js"></script><link rel="stylesheet" href="/assets/prod.css">';
  const fetchImpl = async (url) => {
    const s = url.endsWith('.js') ? 'identical' : url.endsWith('.css') ? 'prod-css' : live;
    return {ok:true,status:200,text:async()=>s,arrayBuffer:async()=>Buffer.from(s)};
  };
  const readFileImpl = async (path) => {
    const s = String(path).endsWith('index.html') ? local : String(path).endsWith('.js') ? 'identical' : 'local-css';
    return String(path).endsWith('index.html') ? s : Buffer.from(s);
  };
  const report = await compare({fetchImpl,readFileImpl});
  expect(report.status).toBe('DRIFT');
  expect(report.findings[0].equal).toBe(true);
  expect(report.findings[1].equal).toBe(false);
});
