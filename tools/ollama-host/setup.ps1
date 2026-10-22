param([ValidateSet("local", "tailscale")][string]$Mode, [string]$OllamaUrl = 'http://127.0.0.1:11434', [string]$NodePath)
$ErrorActionPreference = "Stop"
if (-not $NodePath) { . (Join-Path $PSScriptRoot 'node-runtime.ps1'); $NodePath = Find-HostNode }
if (-not $NodePath) { throw 'Open the host panel and press Start to install Node.js.' }
try {
    $modelList = Invoke-RestMethod -Uri "$OllamaUrl/api/tags"
} catch {
    throw 'Cannot connect to Ollama at http://127.0.0.1:11434. Install and start Ollama on this computer, then run setup again. A downloaded model is not required for HTTPS setup.'
}
Write-Host 'Installed Ollama models:'
$modelList.models | ForEach-Object { Write-Host $_.name }
if (-not $Mode) { $Mode = Read-Host 'Type local for this PC, or tailscale for a remote host' }
if ($mode -notin @('local', 'tailscale')) { throw 'Choose local or tailscale.' }
if ($mode -eq 'tailscale') {
    Get-Command tailscale -ErrorAction Stop | Out-Null
}
$configPath = Join-Path $PSScriptRoot 'host-config.json'
if (Test-Path -LiteralPath $configPath) {
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    $token = $config.token
} else {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    $token = [Convert]::ToBase64String($bytes)
}
@{ token = $token; ollamaUrl = $OllamaUrl } | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8
if ($mode -eq 'local') {
    $certPath = Join-Path $PSScriptRoot 'localhost.pfx'
    $password = ConvertTo-SecureString 'emberadventures-local' -AsPlainText -Force
    if (-not (Test-Path -LiteralPath $certPath)) {
        $cert = New-SelfSignedCertificate -DnsName 'localhost' -CertStoreLocation 'Cert:\CurrentUser\My' -FriendlyName 'EmberAdventures Ollama localhost' -KeyAlgorithm RSA -KeyLength 2048 -KeyExportPolicy Exportable -NotAfter (Get-Date).AddYears(2)
        Export-PfxCertificate -Cert $cert -FilePath $certPath -Password $password | Out-Null
        $publicPath = Join-Path $PSScriptRoot 'localhost.cer'
        Export-Certificate -Cert $cert -FilePath $publicPath | Out-Null
    }
    $publicPath = Join-Path $PSScriptRoot 'localhost.cer'
    $publicCertificate = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($publicPath)
    if ($publicCertificate.NotAfter -lt (Get-Date)) { throw 'The local HTTPS certificate has expired. Remove localhost.pfx and localhost.cer from the host folder and press Start to create a new certificate.' }
    if (-not (Test-Path "Cert:\CurrentUser\Root\$($publicCertificate.Thumbprint)")) {
        Import-Certificate -FilePath $publicPath -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
    }
    if (-not (Test-Path "Cert:\CurrentUser\Root\$($publicCertificate.Thumbprint)")) { throw 'Windows did not trust the local certificate. Press Start again and approve the certificate prompt.' }
    Write-Host 'Game host URL: https://localhost:51821'
} else {
    & tailscale serve --bg http://127.0.0.1:51820
    if ($LASTEXITCODE -ne 0) { throw 'Tailscale Serve setup failed. Enable HTTPS in your tailnet and retry.' }
    & tailscale serve status
    Write-Host 'Use the HTTPS .ts.net URL above in the game. Do not enable Funnel.'
}
Write-Host 'Setup complete. The host control panel starts the host automatically.'
