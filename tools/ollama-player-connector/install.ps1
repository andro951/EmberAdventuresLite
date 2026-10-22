$ErrorActionPreference = 'Stop'
try {
    $destination = Join-Path $env:LOCALAPPDATA 'EmberAdventures\PlayerConnector'
    [void](New-Item -ItemType Directory -Path $destination -Force)
    $scriptPath = Join-Path $destination 'discover.ps1'
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'discover.ps1') -Destination $scriptPath -Force
    $protocol = 'HKCU:\Software\Classes\emberadventures-player'
    [void](New-Item -Path $protocol -Force)
    Set-Item -Path $protocol -Value 'URL:EmberAdventures Player Connector'
    New-ItemProperty -Path $protocol -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
    $commandPath = Join-Path $protocol 'shell\open\command'
    [void](New-Item -Path $commandPath -Force)
    $powershell = Join-Path $PSHOME 'powershell.exe'
    Set-Item -Path $commandPath -Value ('"' + $powershell + '" -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $scriptPath + '" "%1"')
    Write-Output 'Player Connector installed for this Windows account. Return to EmberAdventures and choose Another computer through Tailscale.'
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
