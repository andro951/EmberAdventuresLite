$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'node-runtime.ps1')
$node = Find-HostNode
if (-not $node) { throw 'Open the host panel and press Start to install Node.js before running tests.' }
& (Join-Path $PSScriptRoot 'test-node-runtime.ps1')
& $node --test (Join-Path $PSScriptRoot 'test.cjs')
exit $LASTEXITCODE
