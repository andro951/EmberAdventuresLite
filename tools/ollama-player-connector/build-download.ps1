$ErrorActionPreference = 'Stop'
$archive = Join-Path $PSScriptRoot 'EmberAdventuresPlayerConnector.zip'
$target = Join-Path $PSScriptRoot '..\ollama-host\player-connector-download.js'
$base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($archive))
$source = @'
(function(root) {
    const archive = "BASE64_REPLACE";
    function download() {
        const bytes = Uint8Array.from(root.atob(archive), character => character.charCodeAt(0));
        const url = root.URL.createObjectURL(new Blob([bytes], {type: "application/zip"}));
        const link = root.document.createElement("a");
        link.href = url;
        link.download = "EmberAdventuresPlayerConnector.zip";
        root.document.body.append(link);
        link.click();
        link.remove();
        root.setTimeout(() => root.URL.revokeObjectURL(url), 60000);
    }
    root.EmberOllamaPlayerConnectorDownload = {download};
})(globalThis);
'@
$source = $source.Replace('BASE64_REPLACE', $base64)
[IO.File]::WriteAllText([IO.Path]::GetFullPath($target), $source, [Text.UTF8Encoding]::new($false))
