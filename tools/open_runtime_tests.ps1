$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$selectedPort = $null

function Test-LocalPort {
    param([int]$Port)

    $client = [System.Net.Sockets.TcpClient]::new()

    try {
        $task = $client.ConnectAsync("127.0.0.1", $Port)
        return $task.Wait(100)
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

foreach ($port in 4180..4199) {
    if (-not (Test-LocalPort -Port $port)) {
        $selectedPort = $port
        break
    }
}

if ($null -eq $selectedPort) {
    throw "No free runtime-test port was found from 4180 through 4199."
}

$python = Get-Command "python" -ErrorAction SilentlyContinue

if ($null -eq $python) {
    throw "Python is required to run the local runtime-test server."
}

Start-Process `
    -FilePath $python.Source `
    -ArgumentList @("-m", "http.server", $selectedPort, "--bind", "127.0.0.1") `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden

$url = "http://127.0.0.1:$selectedPort/bottom.runtime-tests.html?runtimeTests=1"

for ($attempt = 0; $attempt -lt 50; $attempt++) {
    Start-Sleep -Milliseconds 100

    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1

        if ($response.StatusCode -eq 200) {
            Start-Process $url
            Write-Host "Runtime tests opened at $url"
            exit 0
        }
    }
    catch {
    }
}

throw "The runtime-test server did not become ready at $url."
