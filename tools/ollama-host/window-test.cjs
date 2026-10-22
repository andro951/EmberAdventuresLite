const {test} = require('node:test');
const assert = require('node:assert/strict');
const {MessageChannel} = require('node:worker_threads');
const {create} = require('./window-client.js');
const {attach} = require('./connection-window.js');
const contract = require('./contract.js');
const {createHandler} = require('./server.cjs');
const http = require('node:http');
const {once} = require('node:events');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function fixture(t, hostOrigin, hostFetch) {
    const gameOrigin = 'https://synthetic.perchance.org';
    const parentListeners = new Set();
    const childListeners = new Map();
    const intervals = new Set();
    let opens = 0;
    const timers = {
        setInterval(callback, duration) { const timer = setInterval(callback, duration); intervals.add(timer); return timer; },
        clearInterval(timer) { clearInterval(timer); intervals.delete(timer); }
    };
    const parentWindow = {closed: false, postMessage(data) { for (const listener of parentListeners) listener({source: popup, origin: hostOrigin, data}); }};
    const popup = {closed: false, postMessage(data, target, ports) {
        assert.equal(target, hostOrigin);
        for (const listener of childListeners.get('message') || []) listener({source: parentWindow, origin: gameOrigin, data, ports});
    }};
    const child = {
        ...timers, opener: parentWindow, location: {hash: ''},
        document: {createElement: () => ({}), body: {append() {}}},
        addEventListener(type, listener) { if (!childListeners.has(type)) childListeners.set(type, new Set()); childListeners.get(type).add(listener); },
        fetch: hostFetch
    };
    popup.location = {set href(url) { child.location.hash = new URL(url).hash; queueMicrotask(() => attach(child)); }};
    const parent = {
        ...timers, location: {origin: gameOrigin}, crypto: require('node:crypto').webcrypto, MessageChannel, ReadableStream, Response,
        addEventListener(type, listener) { assert.equal(type, 'message'); parentListeners.add(listener); },
        removeEventListener(type, listener) { parentListeners.delete(listener); },
        open(url) { opens++; child.location.hash = new URL(url).hash; queueMicrotask(() => attach(child)); return popup; }
    };
    t.after(() => { for (const timer of intervals) clearInterval(timer); });
    return {transport: create(parent), popup, parent, child, childListeners, parentWindow, get opens() {return opens;}};
}
test('connection window carries approved pairing, model discovery and streaming through actual HTTP', async t => {
    const server = http.createServer(createHandler({token: 'synthetic-administrative-key-1234567890', approve: async () => true, fetchImpl: async url => {
        if (url.endsWith('/api/tags')) return Response.json({models: [{name: 'synthetic:2b'}]});
        if (url.endsWith('/api/ps')) return Response.json({models: []});
        if (url.endsWith('/api/generate')) return Response.json({done: true});
        return new Response(JSON.stringify({message: {content: 'Synthetic 🐉'}, done: false}) + '\n' + JSON.stringify({message: {content: ' reply'}, done: true, done_reason: 'stop'}) + '\n');
    }}));
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    t.after(() => {server.closeAllConnections(); server.close();});
    const origin = `http://127.0.0.1:${server.address().port}`;
    const connection = fixture(t, origin, (route, init) => fetch(origin + route, init));
    const context = vm.createContext({EmberOllama: contract, EmberOllamaWindowTransport: connection.transport,
        document: {featurePolicy: {features: () => ['local-network-access'], allowsFeature: () => false}},
        fetch() {throw new Error('Blocked iframe must not fetch localhost directly.');}});
    vm.runInContext(fs.readFileSync(path.join(__dirname, 'client.js'), 'utf8'), context);
    const client = context.EmberOllamaClient;
    const config = {...contract.defaults, provider:'ollama', url: origin, model:'synthetic:2b'};
    const credential = await client.pair(config);
    assert.equal((await client.status(config, credential)).models[0], 'synthetic:2b');
    assert.equal((await client.load(config, credential)).ready, true);
    const chunks = [];
    assert.equal(await client.generate(config, credential, 'Synthetic test', {onChunk: chunk => chunks.push(chunk)}), 'Synthetic 🐉 reply');
    assert.deepEqual(chunks, ['Synthetic 🐉', ' reply']);
    assert.equal(connection.opens, 1);
    const page = await fetch(origin + '/connection');
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.match(await page.text(), /connection-window.js/);
    assert.equal((await fetch(origin + '/connection-window.js')).status, 200);
});
test('connection window cancels host fetch when a streamed game request is cancelled', async t => {
    let upstreamAborted = false;
    const connection = fixture(t, 'https://localhost:51821', async (_path, init) => new Response(new ReadableStream({start(controller) {
        controller.enqueue(new TextEncoder().encode('partial'));
        init.signal.addEventListener('abort', () => {upstreamAborted = true; controller.error(new DOMException('Cancelled', 'AbortError'));});
    }})));
    const controller = new AbortController();
    const response = await connection.transport.request(contract.defaults, '/api/text/generate', {method:'POST', signal: controller.signal});
    const reading = response.text();
    controller.abort();
    await assert.rejects(reading, /cancel/i);
    while (!upstreamAborted) await new Promise(resolve => setImmediate(resolve));
    assert.equal(upstreamAborted, true);
});
test('closed connection window fails a waiting request without a generation timeout', async t => {
    const connection = fixture(t, 'https://localhost:51821', (_path, init) => new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')));
    }));
    const pending = connection.transport.request(contract.defaults, '/api/status');
    await new Promise(resolve => setImmediate(resolve));
    connection.popup.closed = true;
    await assert.rejects(pending, /window was closed/);
});
test('popup blocking gives an actionable error before any request is sent', () => {
    const transport = create({crypto: require('node:crypto').webcrypto, location: {origin:'https://synthetic.perchance.org'}, addEventListener() {}, removeEventListener() {}, open: () => null});
    assert.throws(() => transport.request(contract.defaults, '/api/pair', {method:'POST'}), /Allow.*popup/);
});
test('a discovered host reuses the player discovery popup for pairing', async t => {
    const origin = 'https://synthetic.tail.ts.net';
    const connection = fixture(t, origin, async () => Response.json({token:'synthetic-credential-12345678901234567890'}));
    connection.transport.adopt(origin, connection.popup);
    assert.equal(connection.transport.hasWindow(origin), true);
    const response = await connection.transport.request({...contract.defaults, connection:'tailscale', url:origin}, '/api/pair', {method:'POST'});
    assert.equal((await response.json()).token, 'synthetic-credential-12345678901234567890');
    assert.equal(connection.opens, 0);
});
test('connection window rejects unsupported routes and ignores unrelated senders', async t => {
    let requests = 0;
    const connection = fixture(t, 'https://localhost:51821', async () => {requests++; return Response.json({});});
    await assert.rejects(connection.transport.request(contract.defaults, '/api/host/stop', {method:'POST'}).then(response => response.text()), /Unsupported connection request/);
    assert.equal(requests, 0);
    const nonce = new URLSearchParams(connection.child.location.hash.slice(1)).get('nonce');
    for (const event of [
        {source: {}, origin:'https://synthetic.perchance.org'},
        {source: connection.parentWindow, origin:'https://other.perchance.org'}
    ]) {
        for (const listener of connection.childListeners.get('message')) await listener({...event, ports:[{}], data:{type:'ea-host-request', nonce, path:'/api/status', method:'GET', headers:{}}});
    }
    assert.equal(requests, 0);
});
