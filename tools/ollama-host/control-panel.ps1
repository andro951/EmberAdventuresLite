param([switch]$CheckLayout)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'node-runtime.ps1')
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$script:session = $null
$script:sessionDirectory = $null
$script:quitting = $false
$script:lastState = ''
$form = New-Object System.Windows.Forms.Form
$form.Text = 'EmberAdventures Host'
$form.Size = New-Object System.Drawing.Size(700, 345)
$form.MinimumSize = $form.Size
$form.StartPosition = 'CenterScreen'
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$layout = New-Object System.Windows.Forms.TableLayoutPanel
$layout.Dock = 'Fill'
$layout.Padding = New-Object System.Windows.Forms.Padding(18)
$layout.ColumnCount = 2
$layout.RowCount = 5
[void]$layout.RowStyles.Add((New-Object System.Windows.Forms.RowStyle('Absolute', 46)))
[void]$layout.RowStyles.Add((New-Object System.Windows.Forms.RowStyle('Absolute', 50)))
[void]$layout.RowStyles.Add((New-Object System.Windows.Forms.RowStyle('Absolute', 46)))
[void]$layout.RowStyles.Add((New-Object System.Windows.Forms.RowStyle('Absolute', 26)))
[void]$layout.RowStyles.Add((New-Object System.Windows.Forms.RowStyle('Percent', 100)))
[void]$layout.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle('AutoSize')))
[void]$layout.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle('Percent', 100)))
$form.Controls.Add($layout)
$choose = New-Object System.Windows.Forms.Button
$choose.Text = 'Choose Models Folder'
$choose.AutoSize = $true
$choose.Height = 36
$layout.Controls.Add($choose, 0, 0)
$folder = New-Object System.Windows.Forms.Label
$folder.Dock = 'Fill'
$folder.TextAlign = 'MiddleLeft'
$folder.AutoEllipsis = $true
$folder.Text = [Environment]::GetEnvironmentVariable('OLLAMA_MODELS', 'User')
if (-not $folder.Text) { $folder.Text = Join-Path $env:USERPROFILE '.ollama\models' }
$layout.Controls.Add($folder, 1, 0)
$tip = New-Object System.Windows.Forms.ToolTip
$tip.SetToolTip($folder, $folder.Text)
$start = New-Object System.Windows.Forms.Button
$start.Text = 'Start'
$start.AutoSize = $true
$start.Height = 40
$layout.Controls.Add($start, 0, 1)
$openLogs = New-Object System.Windows.Forms.Button
$openLogs.Text = 'Open Host Logs'
$openLogs.AutoSize = $true
$openLogs.Height = 36
$openLogs.Enabled = $false
$layout.Controls.Add($openLogs, 1, 1)
$remoteLabel = New-Object System.Windows.Forms.Label
$remoteLabel.Text = 'Remote URL'
$remoteLabel.AutoSize = $true
$remoteLabel.TextAlign = 'MiddleLeft'
$layout.Controls.Add($remoteLabel, 0, 2)
$remoteAddress = New-Object System.Windows.Forms.TextBox
$remoteAddress.Dock = 'Fill'
$remoteAddress.ReadOnly = $true
$remoteAddress.Text = 'Tailscale address will appear when the host starts.'
$layout.Controls.Add($remoteAddress, 1, 2)
$modelProgress = New-Object System.Windows.Forms.ProgressBar
$modelProgress.Dock = 'Fill'
$modelProgress.Style = 'Marquee'
$modelProgress.MarqueeAnimationSpeed = 25
$modelProgress.Visible = $false
$layout.Controls.Add($modelProgress, 0, 3)
$layout.SetColumnSpan($modelProgress, 2)
$status = New-Object System.Windows.Forms.TextBox
$status.Dock = 'Fill'
$status.Multiline = $true
$status.ReadOnly = $true
$status.BorderStyle = 'None'
$status.ScrollBars = 'Vertical'
$status.Text = 'Stopped. Select the folder containing your models, then press Start.'
$status.ForeColor = [System.Drawing.Color]::DimGray
$layout.Controls.Add($status, 0, 4)
$layout.SetColumnSpan($status, 2)
$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = [System.Drawing.SystemIcons]::Application
$tray.Text = 'EmberAdventures Host'
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$show = $menu.Items.Add('Open Host Panel')
$quit = $menu.Items.Add('Quit and Stop Host')
$tray.ContextMenuStrip = $menu
function Show-Panel { $form.Show(); $form.WindowState = 'Normal'; $form.Activate() }
$show.Add_Click({ Show-Panel })
$tray.Add_DoubleClick({ Show-Panel })
function Request-Stop {
    if ($script:session -and -not $script:session.HasExited) {
        Set-Content -LiteralPath (Join-Path $script:sessionDirectory 'stop') -Value 'stop'
        $status.Text = 'Stopping...'
        $start.Enabled = $false
    }
}
$quit.Add_Click({ $script:quitting = $true; Request-Stop; if (-not $script:session -or $script:session.HasExited) { $form.Close() } })
$openLogs.Add_Click({
    if ($script:sessionDirectory -and (Test-Path -LiteralPath $script:sessionDirectory -PathType Container)) {
        [void][System.Diagnostics.Process]::Start('explorer.exe', ('"' + $script:sessionDirectory + '"'))
    }
})
$choose.Add_Click({
    $picker = New-Object System.Windows.Forms.FolderBrowserDialog
    $picker.Description = 'Choose the folder containing Ollama models or GGUF files in subfolders.'
    $picker.SelectedPath = $folder.Text
    if ($picker.ShowDialog() -eq 'OK') {
        $folder.Text = $picker.SelectedPath
        $tip.SetToolTip($folder, $folder.Text)
        [Environment]::SetEnvironmentVariable('OLLAMA_MODELS', $folder.Text, 'User')
    }
    $picker.Dispose()
})
$start.Add_Click({
    if ($script:session -and -not $script:session.HasExited) { Request-Stop; return }
    try {
        $installDrive = $null
        if (-not (Find-HostNode)) {
            $permission = [System.Windows.Forms.MessageBox]::Show($form, 'This host needs Node.js 22.15 or newer. Download and install the supported Node.js LTS runtime from nodejs.org? You will choose the drive next. This installs a private runtime for EmberAdventures without changing your system PATH.', 'Install Node.js?', 'YesNo', 'Question', 'Button2')
            if ($permission -ne 'Yes') { $status.Text = 'Node.js installation declined. Nothing was downloaded.'; return }
            $dialog = New-Object System.Windows.Forms.Form
            $dialog.Text = 'Choose Node.js installation drive'
            $dialog.Size = New-Object System.Drawing.Size(460, 190)
            $dialog.StartPosition = 'CenterParent'
            $drives = New-Object System.Windows.Forms.ComboBox
            $drives.DropDownStyle = 'DropDownList'
            $drives.SetBounds(20, 20, 400, 30)
            foreach ($drive in [IO.DriveInfo]::GetDrives()) {
                if ($drive.IsReady -and $drive.DriveType -eq 'Fixed') { [void]$drives.Items.Add($drive.RootDirectory.FullName) }
            }
            if ($drives.Items.Count) { $drives.SelectedIndex = 0 }
            $description = New-Object System.Windows.Forms.Label
            $description.Text = 'Installs under EmberAdventuresRuntime on this drive.'
            $description.SetBounds(20, 55, 400, 30)
            $install = New-Object System.Windows.Forms.Button
            $install.Text = 'Install'
            $install.SetBounds(240, 90, 85, 30)
            $install.DialogResult = 'OK'
            $install.Enabled = $drives.Items.Count -gt 0
            $cancelInstall = New-Object System.Windows.Forms.Button
            $cancelInstall.Text = 'Cancel'
            $cancelInstall.SetBounds(335, 90, 85, 30)
            $cancelInstall.DialogResult = 'Cancel'
            $dialog.Controls.AddRange(@($drives, $description, $install, $cancelInstall))
            $dialog.AcceptButton = $install
            $dialog.CancelButton = $cancelInstall
            $result = $dialog.ShowDialog($form)
            if ($result -eq 'OK') { $installDrive = [string]$drives.SelectedItem }
            $dialog.Dispose()
            if (-not $installDrive) { $status.Text = 'Installation cancelled. Nothing was downloaded.'; return }
        }
        $script:sessionDirectory = Join-Path $PSScriptRoot ('sessions\' + [Guid]::NewGuid().ToString('N'))
        [void](New-Item -ItemType Directory -Path $script:sessionDirectory -Force)
        $openLogs.Enabled = $true
        $script:lastState = ''
        $remoteAddress.Text = 'Checking Tailscale address...'
        $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + (Join-Path $PSScriptRoot 'host-session.ps1') + '"'), '-ModelFolder', ('"' + $folder.Text + '"'), '-SessionDirectory', ('"' + $script:sessionDirectory + '"'))
        if ($installDrive) { $arguments += @('-NodeInstallDrive', $installDrive) }
        $script:session = Start-Process powershell.exe -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $script:sessionDirectory 'setup.out.log') -RedirectStandardError (Join-Path $script:sessionDirectory 'setup.err.log')
        $choose.Enabled = $false
        $start.Text = 'Stop'
        $start.BackColor = [System.Drawing.Color]::Khaki
        $status.Text = 'Starting...'
        $status.ForeColor = [System.Drawing.Color]::DarkGoldenrod
    } catch { $status.Text = $_.Exception.Message; $status.ForeColor = [System.Drawing.Color]::Firebrick }
})
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 400
$timer.Add_Tick({
    if (-not $script:session) { return }
    $state = $null
    $file = Join-Path $script:sessionDirectory 'status.json'
    if (Test-Path -LiteralPath $file) {
        try {
            $state = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
            if ($script:lastState -ne ($state.state + $state.message)) {
                $script:lastState = $state.state + $state.message
                $status.Text = $state.message
                $remoteAddress.Text = if ($state.url) { $state.url } else { 'No Tailscale address available.' }
                $color = switch ($state.state) { 'ready' { 'ForestGreen' }; 'starting' { 'DarkGoldenrod' }; 'error' { 'Firebrick' }; default { 'DimGray' } }
                $status.ForeColor = [System.Drawing.Color]::FromName($color)
                $start.BackColor = switch ($state.state) { 'ready' { [System.Drawing.Color]::LightGreen }; 'starting' { [System.Drawing.Color]::Khaki }; 'error' { [System.Drawing.Color]::MistyRose }; default { [System.Drawing.SystemColors]::Control } }
                $tray.Text = 'EmberAdventures Host: ' + $state.state
            }
        } catch { $status.Text = 'Cannot read host status: ' + $_.Exception.Message; $status.ForeColor = [System.Drawing.Color]::Firebrick }
    }
    $progressFile = Join-Path $script:sessionDirectory 'model-progress.json'
    if ($state -and $state.state -eq 'ready' -and (Test-Path -LiteralPath $progressFile)) {
        try {
            $modelState = Get-Content -LiteralPath $progressFile -Raw | ConvertFrom-Json
            $status.Text = $modelState.message
            if ($modelState.state -eq 'active') {
                $modelProgress.Visible = $true
                if ($null -ne $modelState.percent) {
                    $modelProgress.Style = 'Blocks'
                    $modelProgress.Value = [Math]::Max(0, [Math]::Min(100, [int]$modelState.percent))
                } else { $modelProgress.Style = 'Marquee' }
                $status.ForeColor = [System.Drawing.Color]::DarkGoldenrod
            } else {
                $modelProgress.Visible = $false
                $status.ForeColor = if ($modelState.state -eq 'error') { [System.Drawing.Color]::Firebrick } else { [System.Drawing.Color]::ForestGreen }
            }
        } catch { }
    } else { $modelProgress.Visible = $false }
    if ($script:session.HasExited) {
        if (-not $script:lastState -or ($state -and $state.state -notin @('stopped', 'error'))) { $status.Text = 'Host stopped unexpectedly. ' + (Get-Content -LiteralPath (Join-Path $script:sessionDirectory 'setup.err.log') -Raw); $status.ForeColor = [System.Drawing.Color]::Firebrick; $start.BackColor = [System.Drawing.Color]::MistyRose }
        $script:session = $null
        $start.Text = 'Start'
        $start.Enabled = $true
        $choose.Enabled = $true
        if ($script:quitting) { $form.Close() }
    }
})
$form.Add_FormClosing({
    if (-not $script:quitting -and $script:session -and -not $script:session.HasExited) {
        $_.Cancel = $true
        $form.Hide()
        $tray.ShowBalloonTip(3000, 'EmberAdventures Host is still running', 'Use the tray icon to reopen it or choose Quit and Stop Host.', [System.Windows.Forms.ToolTipIcon]::Info)
    }
})
if ($CheckLayout) {
    if ($layout.Controls.Count -ne 8 -or $layout.GetRow($folder) -ne $layout.GetRow($choose) -or $layout.GetRow($remoteAddress) -ne $layout.GetRow($remoteLabel) -or $layout.GetRow($modelProgress) -ne 3) { throw 'The host panel layout is invalid.' }
    Write-Output 'Host panel layout passed.'
} else {
    $mutex = New-Object System.Threading.Mutex($false, 'Local\EmberAdventuresOllamaPanel')
    if (-not $mutex.WaitOne(0)) { [System.Windows.Forms.MessageBox]::Show('The host panel is already running. Open it from the system tray.') | Out-Null }
    else {
        try { $tray.Visible = $true; $timer.Start(); [void]$form.ShowDialog() }
        finally { $mutex.ReleaseMutex() }
    }
    $mutex.Dispose()
}
$timer.Dispose()
$tray.Dispose()
$tip.Dispose()
$form.Dispose()
