function Find-HostNode {
    $command = Get-Command node -CommandType Application -ErrorAction SilentlyContinue
    $pathFile = Join-Path $PSScriptRoot 'node-runtime-path.txt'
    $candidates = @()
    if ($command) { $candidates += $command.Source }
    if (Test-Path -LiteralPath $pathFile) { $candidates += (Get-Content -LiteralPath $pathFile -Raw).Trim() }
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            $versionText = & $candidate --version 2>$null
            if ($LASTEXITCODE -eq 0 -and $versionText -match '^v(\d+)\.(\d+)\.(\d+)$') {
                if ([version]$versionText.Substring(1) -ge [version]'22.15.0') { return $candidate }
            }
        }
    }
    return $null
}
function Confirm-HostNodeRuntime([string]$Directory, [string]$ExpectedVersion) {
    $executable = Join-Path $Directory 'node.exe'
    if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) { throw 'The verified archive did not contain node.exe.' }
    $version = & $executable --version
    if ($LASTEXITCODE -ne 0 -or $version -ne $ExpectedVersion) { throw 'Node.js installation verification failed.' }
    return $executable
}
function Install-HostNode([string]$DriveRoot, [string]$SessionDirectory) {
    $drive = [IO.DriveInfo]::new($DriveRoot)
    if ($drive.RootDirectory.FullName -ne $DriveRoot -or -not $drive.IsReady -or $drive.DriveType -ne 'Fixed') { throw 'Select an available local installation drive.' }
    $architecture = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { 'arm64' } else { 'x64' }
    Write-State 'starting' 'Finding the official Node.js LTS download...'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $releases = Invoke-RestMethod 'https://nodejs.org/dist/index.json'
    $release = $releases | Where-Object { $_.version -match '^v24\.\d+\.\d+$' -and $_.lts -and $_.files -contains "win-$architecture-zip" } | Select-Object -First 1
    if (-not $release) { throw 'No supported Node.js LTS Windows download was found on nodejs.org.' }
    $package = "node-$($release.version)-win-$architecture"
    $baseUrl = "https://nodejs.org/dist/$($release.version)"
    $archive = Join-Path $SessionDirectory "$package.zip"
    Write-State 'starting' "Downloading Node.js $($release.version) to $DriveRoot..."
    Invoke-WebRequest "$baseUrl/$package.zip" -OutFile $archive -UseBasicParsing
    if (Stop-Requested) { throw 'Installation cancelled.' }
    $checksums = (Invoke-WebRequest "$baseUrl/SHASUMS256.txt" -UseBasicParsing).Content
    $match = [regex]::Match($checksums, '(?m)^([a-fA-F0-9]{64})\s+' + [regex]::Escape("$package.zip") + '\s*$')
    if (-not $match.Success -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $match.Groups[1].Value) { throw 'Node.js download verification failed. Nothing was installed.' }
    Write-State 'starting' 'Verified download. Installing Node.js...'
    $runtimeRoot = Join-Path $DriveRoot 'EmberAdventuresRuntime'
    # Extract into its permanent unique directory. Moving a just-executed runtime
    # can fail while Windows or antivirus still holds handles to its files.
    $installation = Join-Path $runtimeRoot ([Guid]::NewGuid().ToString('N'))
    [void](New-Item -ItemType Directory -Path $installation -Force)
    Expand-Archive -LiteralPath $archive -DestinationPath $installation
    if (Stop-Requested) { throw 'Installation cancelled.' }
    $installed = Confirm-HostNodeRuntime (Join-Path $installation $package) $release.version
    Set-Content -LiteralPath (Join-Path $PSScriptRoot 'node-runtime-path.txt') -Value $installed
    return $installed
}
