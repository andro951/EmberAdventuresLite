@echo off
setlocal

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root = Join-Path (Split-Path -Parent (Split-Path -Parent '%~f0')) 'characters'; $files = @(Get-ChildItem -LiteralPath $root -Recurse -File -Filter '*.json' | Where-Object { try { $json = Get-Content -Raw -LiteralPath $_.FullName | ConvertFrom-Json; $null -ne $json.character_definition.id -and $null -ne $json.character_definition.name } catch { $false } }); if ($files.Count -lt 10) { Write-Error ('Found only {0} character files.' -f $files.Count); exit 1 }; $files | Get-Random -Count 10 | ForEach-Object -Begin { $i = 1 } -Process { '{0:D2}. {1}' -f $i, $_.Name; $i++ }"

echo.
pause
endlocal
