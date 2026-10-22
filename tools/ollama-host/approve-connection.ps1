Add-Type -AssemblyName System.Windows.Forms
$answer = [System.Windows.Forms.MessageBox]::Show('A browser is asking to use this computer for EmberAdventures text generation. Approve only if you just clicked Connect in your game (or asked someone you trust to connect).', 'Allow EmberAdventures connection?', 'YesNo', 'Question', 'Button2', 'DefaultDesktopOnly')
if ($answer -eq 'Yes') { Write-Output 'approved' } else { Write-Output 'declined' }
