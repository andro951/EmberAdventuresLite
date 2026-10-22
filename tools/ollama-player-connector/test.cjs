const {test} = require('node:test');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const path = require('node:path');

test('Windows player connector serves a nonce-bound discovery reply', {skip: process.platform !== 'win32'}, async () => {
    const nonce = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'discover.ps1'), `emberadventures-player://discover/${nonce}`], {windowsHide: true});
    try {
        let response;
        for (let attempt = 0; attempt < 60; attempt++) {
            try { response = await fetch(`http://127.0.0.1:51823/discover/${nonce}`); break; }
            catch { await new Promise(resolve => setTimeout(resolve, 100)); }
        }
        assert.ok(response, 'Connector did not start its local discovery page.');
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.match(html, /ea-player-hosts/);
        assert.match(html, new RegExp(nonce));
        assert.match(html, /window\.parent\.postMessage/);
    } finally {
        if (child.exitCode === null) child.kill();
    }
});
