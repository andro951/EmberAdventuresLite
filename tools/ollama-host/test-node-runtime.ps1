$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'node-runtime.ps1')
function Write-State($state, $message) {}
function Stop-Requested { return $false }
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('ea-node-test-' + [Guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $testRoot)
$script:expanded = $false
function Invoke-RestMethod { return @([pscustomobject]@{version='v24.0.0'; lts='Synthetic'; files=@('win-x64-zip','win-arm64-zip')}) }
function Invoke-WebRequest($Uri, $OutFile, [switch]$UseBasicParsing) {
    if ($OutFile) { [IO.File]::WriteAllText($OutFile, 'deliberately invalid synthetic archive'); return }
    return @{Content=('0' * 64) + '  node-v24.0.0-win-x64.zip' + "`n" + ('0' * 64) + '  node-v24.0.0-win-arm64.zip'}
}
function Expand-Archive { $script:expanded = $true; throw 'Must not extract an unverified archive.' }
try {
    $existingNode = Find-HostNode
    if (-not $existingNode) { throw 'These tests require an existing Node runtime.' }
    $expectedVersion = & $existingNode --version
    $runtimeDirectory = Join-Path $testRoot 'runtime with spaces'
    [void](New-Item -ItemType Directory -Path $runtimeDirectory)
    $copiedNode = Join-Path $runtimeDirectory 'node.exe'
    Copy-Item -LiteralPath $existingNode -Destination $copiedNode
    $confirmed = Confirm-HostNodeRuntime $runtimeDirectory $expectedVersion
    if ($confirmed -ne $copiedNode -or -not (Test-Path -LiteralPath $copiedNode)) { throw 'Runtime verification must retain the original executable path.' }
    $wrongVersionRejected = $false
    try { [void](Confirm-HostNodeRuntime $runtimeDirectory 'v0.0.0') }
    catch { if ($_.Exception.Message -notmatch 'verification failed') { throw }; $wrongVersionRejected = $true }
    if (-not $wrongVersionRejected) { throw 'Incorrect executable version was accepted.' }
    $rejected = $false
    try { [void](Install-HostNode ([IO.Path]::GetPathRoot($testRoot)) $testRoot) }
    catch { if ($_.Exception.Message -notmatch 'verification failed') { throw }; $rejected = $true }
    if (-not $rejected -or $script:expanded) { throw 'Invalid download was not rejected before installation.' }
    $invalidDriveRejected = $false
    try { [void](Install-HostNode $testRoot $testRoot) }
    catch { $invalidDriveRejected = $true }
    if (-not $invalidDriveRejected) { throw 'Non-root installation drive was accepted.' }
    function Stop-Requested { return $true }
    $cancelled = $false
    try { [void](Install-HostNode ([IO.Path]::GetPathRoot($testRoot)) $testRoot) }
    catch { if ($_.Exception.Message -notmatch 'cancelled') { throw }; $cancelled = $true }
    if (-not $cancelled -or $script:expanded) { throw 'Cancellation did not stop installation.' }
    Write-Output 'Node installer: real executable verification in place, version rejection, checksum rejection, drive validation, and cancellation passed. No persistent runtime installed.'
} finally {
    $resolved = [IO.Path]::GetFullPath($testRoot)
    $allowedRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if (-not $resolved.StartsWith($allowedRoot, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notlike 'ea-node-test-*') { throw 'Unsafe test cleanup path.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
