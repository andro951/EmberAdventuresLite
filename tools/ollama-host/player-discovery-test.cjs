const {test} = require('node:test');
const assert = require('node:assert/strict');
const {create} = require('./player-discovery.js');
const fs = require('node:fs');
const path = require('node:path');

test('game download contains the exact Windows player connector archive', () => {
    const source = fs.readFileSync(path.join(__dirname, 'player-connector-download.js'), 'utf8');
    const encoded = source.match(/const archive = "([A-Za-z0-9+/=]+)";/)?.[1];
    assert.ok(encoded);
    assert.deepEqual(Buffer.from(encoded, 'base64'), fs.readFileSync(path.join(__dirname, '..', 'ollama-player-connector', 'EmberAdventuresPlayerConnector.zip')));
});

test('player discovery launches the installed connector and accepts only its matching result', async () => {
    let listener;
    let retry;
    const frameWindow = {};
    const frame = {contentWindow: frameWindow, src: '', setAttribute() {}};
    const clicked = [];
    const popup = {
        closed: false,
        location: {href: ''},
        addEventListener(type, callback) {assert.equal(type, 'message'); listener = callback;},
        removeEventListener() {},
        document: {
            createElement: type => type === 'iframe' ? frame : ({click() {clicked.push(this.href);}}),
            body: {append() {}}
        }
    };
    const environment = {
        crypto: {randomUUID: () => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'},
        open: () => popup,
        setInterval(callback) {retry = callback; return 1;},
        clearInterval() {}
    };
    const {promise} = create(environment).find();
    assert.deepEqual(clicked, ['emberadventures-player://discover/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']);
    retry();
    retry();
    assert.equal(frame.src, 'http://127.0.0.1:51823/discover/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    assert.equal(popup.location.href, '', 'retries must not replace the install controls in the popup');
    const data = {type: 'ea-player-hosts', nonce: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', hosts: [{name:'Synthetic', url:'https://synthetic.tail.ts.net'}]};
    listener({source: {}, origin:'http://127.0.0.1:51823', data});
    listener({source: frameWindow, origin:'https://untrusted.invalid', data});
    listener({source: frameWindow, origin:'http://127.0.0.1:51823', data:{...data, nonce:'wrong'}});
    listener({source: frameWindow, origin:'http://127.0.0.1:51823', data});
    assert.deepEqual(await promise, data.hosts);
});
