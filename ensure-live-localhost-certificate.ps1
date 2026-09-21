$ErrorActionPreference = "Stop"

$certificatePath = Join-Path $PSScriptRoot "live-localhost.pfx"
$certificatePasswordText = "emberadventures-lite-local"
$certificatePassword = ConvertTo-SecureString $certificatePasswordText -AsPlainText -Force
$certificate = $null

if (Test-Path -LiteralPath $certificatePath) {
    try {
        $flags = [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet
        $certificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
            $certificatePath,
            $certificatePasswordText,
            $flags
        )
    } catch {
        Remove-Item -LiteralPath $certificatePath -Force
    }
}

if (-not $certificate) {
    $created = New-SelfSignedCertificate `
        -DnsName "localhost" `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -FriendlyName "EmberAdventures localhost" `
        -KeyAlgorithm RSA `
        -KeyLength 2048 `
        -KeyExportPolicy Exportable `
        -NotAfter (Get-Date).AddYears(5)
    Export-PfxCertificate `
        -Cert $created `
        -FilePath $certificatePath `
        -Password $certificatePassword | Out-Null
    $certificate = $created
}

$trusted = Get-ChildItem -Path "Cert:\CurrentUser\Root" |
    Where-Object Thumbprint -eq $certificate.Thumbprint |
    Select-Object -First 1
if (-not $trusted) {
    $temporaryCertificatePath = Join-Path $env:TEMP "emberadventures-lite-localhost.cer"
    Export-Certificate -Cert $certificate -FilePath $temporaryCertificatePath -Force | Out-Null
    try {
        Import-Certificate `
            -FilePath $temporaryCertificatePath `
            -CertStoreLocation "Cert:\CurrentUser\Root" | Out-Null
    } finally {
        Remove-Item -LiteralPath $temporaryCertificatePath -Force -ErrorAction SilentlyContinue
    }
}

Write-Output "Localhost certificate ready: $($certificate.Thumbprint)"
