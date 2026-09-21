# Brotli File Compressor

Compress any local file to an explicitly selected output path using Node's built-in Brotli implementation:

```powershell
node "D:\Program Files\JS Dev\EmberAdventuresLite\tools\brotli-file\compress-brotli.js" "D:\input\story.json" "D:\output\story.json.br"
```

An optional final argument selects Brotli quality from `0` through `11`. The default is `11`.

The compressor verifies every result by decompressing it and comparing the exact bytes before replacing the output file. Source files are never modified.
