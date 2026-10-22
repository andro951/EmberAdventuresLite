param([Parameter(Mandatory=$true)][string]$ModelFolder, [Parameter(Mandatory=$true)][string]$SessionDirectory, [string]$NodeInstallDrive)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'node-runtime.ps1')
$ollamaProcess = $null
$bridgeProcess = $null
function Write-State([string]$state, [string]$message, [string]$url = '') {
    $file = Join-Path $SessionDirectory 'status.json'
    @{state=$state; message=$message; url=$url} | ConvertTo-Json | Set-Content -LiteralPath "$file.tmp" -Encoding UTF8
    Move-Item -LiteralPath "$file.tmp" -Destination $file -Force
}
function Stop-Requested { return Test-Path -LiteralPath (Join-Path $SessionDirectory 'stop') }
function Wait-Endpoint([string]$url, $process, $headers, [string]$errorLog) {
    while (-not (Stop-Requested)) {
        if ($process.HasExited) {
            $detail = Get-Content -LiteralPath $errorLog -Raw -ErrorAction SilentlyContinue
            throw "Startup failed. $detail"
        }
        try { return Invoke-RestMethod -Uri $url -Headers $headers -TimeoutSec 2 }
        catch [System.Net.WebException] { Start-Sleep -Milliseconds 300 }
    }
    throw 'Stopped by user.'
}
try {
    Write-State 'starting' 'Starting Ollama...'
    if (-not (Test-Path -LiteralPath $ModelFolder -PathType Container)) { throw 'Choose an existing Ollama models folder first.' }
    $node = Find-HostNode
    if (-not $node -and $NodeInstallDrive) { $node = Install-HostNode $NodeInstallDrive $SessionDirectory }
    if (-not $node) { throw 'Node.js is missing or too old. Press Start and approve installation to continue.' }
    $ollamaCommand = Get-Command ollama -ErrorAction SilentlyContinue
    $ollama = if ($ollamaCommand) { $ollamaCommand.Source } else { $null }
    if (-not $ollama) {
        foreach ($candidate in @('D:\Ollama\ollama.exe', (Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'))) {
            if (Test-Path -LiteralPath $candidate) { $ollama = $candidate; break }
        }
    }
    if (-not $ollama) { throw 'Ollama is not installed. Install Ollama, then press Start again.' }
    $existing = @(Get-NetTCPConnection -LocalPort 51820 -State Listen -ErrorAction SilentlyContinue)
    $configPath = Join-Path $PSScriptRoot 'host-config.json'
    if ($existing.Count -and (Test-Path -LiteralPath $configPath)) {
        $savedConfig = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
        $headers = @{Authorization="Bearer $($savedConfig.token)"}
        try { $identity = Invoke-RestMethod -Uri 'http://127.0.0.1:51820/api/host/info' -Headers $headers -TimeoutSec 3 }
        catch { throw 'Another program or an older host is using the host port. It could not be verified safely, so it was left running.' }
        if ([IO.Path]::GetFullPath($identity.directory) -ne [IO.Path]::GetFullPath($PSScriptRoot) -or $identity.pid -notin $existing.OwningProcess) {
            throw 'A different host is using the port. It was left running.'
        }
        Write-State 'starting' 'Restarting the existing EmberAdventures host...'
        $previous = Get-Process -Id $identity.pid -ErrorAction Stop
        [void](Invoke-RestMethod -Uri 'http://127.0.0.1:51820/api/host/stop' -Method Post -Headers $headers -TimeoutSec 3)
        $previous.WaitForExit()
    }
    foreach ($port in @(11435, 51820, 51821)) {
        if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
            throw "Port $port is already in use. Close the older EmberAdventures host before pressing Start."
        }
    }
    #Own a separate Ollama process so the chosen folder actually applies without restarting someone else's server.
    $env:OLLAMA_HOST = '127.0.0.1:11435'
    $env:OLLAMA_MODELS = $ModelFolder
    $env:EA_OLLAMA_EXE = $ollama
    $env:EA_MODEL_PROGRESS_FILE = Join-Path $SessionDirectory 'model-progress.json'
    $ollamaError = Join-Path $SessionDirectory 'ollama.err.log'
    $ollamaProcess = Start-Process $ollama -ArgumentList 'serve' -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $SessionDirectory 'ollama.out.log') -RedirectStandardError $ollamaError
    [void](Wait-Endpoint 'http://127.0.0.1:11435/api/tags' $ollamaProcess @{} $ollamaError)
    if (Stop-Requested) { throw 'Stopped by user.' }
    Write-State 'starting' 'Preparing secure local connection. Approve the Windows certificate prompt if shown.'
    & (Join-Path $PSScriptRoot 'setup.ps1') -Mode local -OllamaUrl 'http://127.0.0.1:11435' -NodePath $node
    if (Stop-Requested) { throw 'Stopped by user.' }
    Write-State 'starting' 'Starting the game connection...'
    $bridgeError = Join-Path $SessionDirectory 'host.err.log'
    $env:EA_HOST_STOP_FILE = Join-Path $SessionDirectory 'stop'
    $bridgeProcess = Start-Process $node -ArgumentList 'server.cjs' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $SessionDirectory 'host.out.log') -RedirectStandardError $bridgeError
    $config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'host-config.json') -Raw | ConvertFrom-Json
    [void](Wait-Endpoint 'https://localhost:51821/api/status' $bridgeProcess @{Authorization="Bearer $($config.token)"} $bridgeError)
    Write-State 'starting' 'Host ready. Checking Tailscale Serve...'
    $remoteUrl = ''
    $tailscaleMessage = ''
    try {
        $remoteUrl = (& $node (Join-Path $PSScriptRoot 'server.cjs') '--setup-tailscale' 2>&1 | Out-String).Trim()
        if ($LASTEXITCODE -ne 0 -or $remoteUrl -notmatch '^https://[a-z0-9.-]+\.ts\.net$') { throw $remoteUrl }
        $tailscaleMessage = 'Tailscale ready. Copy the address below into the game on your other device.'
    } catch {
        $remoteUrl = ''
        $tailscaleMessage = 'Tailscale unavailable: ' + $_.Exception.Message + ' Local connections are ready.'
    }
    Write-State 'ready' $tailscaleMessage $remoteUrl
    while (-not (Stop-Requested)) {
        if ($ollamaProcess.HasExited -or $bridgeProcess.HasExited) { throw 'The host stopped unexpectedly. Press Start to retry. Details are in the session logs.' }
        Start-Sleep -Milliseconds 500
    }
    Write-State 'stopped' 'Stopped.'
} catch {
    Write-State 'error' $_.Exception.Message
    Write-Error $_.Exception.Message -ErrorAction Continue
} finally {
    #Release the managed model server before the bridge signals completion to a replacement supervisor.
    foreach ($process in @($ollamaProcess, $bridgeProcess)) {
        if ($process -and -not $process.HasExited) { & taskkill.exe /PID $process.Id /T /F | Out-Null }
    }
}
