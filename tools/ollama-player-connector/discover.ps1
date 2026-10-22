param([string]$LaunchUrl)
$ErrorActionPreference = 'Stop'
if ($LaunchUrl -notmatch '^emberadventures-player://discover/([0-9a-fA-F-]{36})/?$') { exit 1 }
$nonce = $Matches[1]
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 51823)
try { $listener.Start() } catch { exit 1 }
try {
    $client = $listener.AcceptTcpClient()
    try {
        $client.ReceiveTimeout = 10000
        $stream = $client.GetStream()
        $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
        $firstLine = $reader.ReadLine()
        if ($firstLine -ne "GET /discover/$nonce HTTP/1.1") { exit 1 }
        while ($true) { $line = $reader.ReadLine(); if ($null -eq $line -or $line -eq '') { break } }
        $hosts = @()
        $errorText = ''
        try {
            $tailscaleCommand = Get-Command tailscale.exe -CommandType Application -ErrorAction SilentlyContinue
            $tailscale = if ($tailscaleCommand) { $tailscaleCommand.Source } else { Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe' }
            if (-not (Test-Path -LiteralPath $tailscale)) { throw 'Install Tailscale and sign in on this computer first.' }
            $tailnet = $null
            try { $tailnet = & $tailscale status --json 2>$null | ConvertFrom-Json } catch { }
            if (-not $tailnet -or $tailnet.BackendState -ne 'Running') {
                $tailscaleUi = Join-Path (Split-Path -Parent $tailscale) 'tailscale-ipn.exe'
                if (Test-Path -LiteralPath $tailscaleUi) { Start-Process -FilePath $tailscaleUi }
                throw 'Tailscale was opened. Sign in or turn it on, then click Find Tailscale Host again.'
            }
            foreach ($peer in $tailnet.Peer.PSObject.Properties.Value) {
                $name = [string]$peer.DNSName
                if (-not $peer.Online -or $name -notmatch '^[a-zA-Z0-9.-]+\.ts\.net\.?$') { continue }
                $name = $name.TrimEnd('.')
                try {
                    $probe = Invoke-RestMethod -Uri "https://$name/api/host/discovery" -TimeoutSec 3
                    if ($probe.app -eq 'EmberAdventures Host' -and $probe.version -eq 1) {
                        $hosts += @{name=($name.Split('.')[0]); url="https://$name"}
                    }
                } catch { }
            }
            if (-not $hosts.Count) { $errorText = 'No running EmberAdventures Host was found on this tailnet.' }
        } catch { $errorText = $_.Exception.Message }
        $payload = @{type='ea-player-hosts'; nonce=$nonce; hosts=@($hosts); error=$errorText} | ConvertTo-Json -Compress -Depth 5
        $html = '<!doctype html><html><head><meta charset="utf-8"><title>EmberAdventures host discovery</title></head><body><script>window.parent.postMessage(' + $payload + ',"*");</script></body></html>'
        $body = [Text.Encoding]::UTF8.GetBytes($html)
        $header = [Text.Encoding]::ASCII.GetBytes("HTTP/1.1 200 OK`r`nContent-Type: text/html; charset=utf-8`r`nContent-Security-Policy: default-src 'none'; script-src 'unsafe-inline'`r`nCache-Control: no-store`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n")
        $stream.Write($header, 0, $header.Length)
        $stream.Write($body, 0, $body.Length)
    } finally { $client.Dispose() }
} finally { $listener.Stop() }
