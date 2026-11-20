import test from 'node:test';
import assert from 'node:assert/strict';
import { getEntries, compare } from './compare-production-assets.mjs';

test('extract script and css, ignore preloads', () => {
  assert.deepEqual(getEntries('<link rel="preload" href="/assets/x.js"><script type="module" src="/assets/main.js"></script><link rel="stylesheet" href="/assets/main.css">'),[
    {kind:'js',path:'/assets/main.js'}, {kind:'css',path:'/assets/main.css'}
  ]);
});

test('detects difference and does not silently claim parity', async () => {
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
  assert.equal(report.status,'DRIFT');
  assert.equal(report.findings[0].equal,true);
  assert.equal(report.findings[1].equal,false);
});
