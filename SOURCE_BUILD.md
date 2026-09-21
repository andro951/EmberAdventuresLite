# EmberAdventures Source Build

The files under `src/` are the authoritative bottom-pane source. `bottom.html`
and `bottom_compressed.html` are generated artifacts.

Run `Build bottom_compressed.bat` to:

1. Assemble the CSS, HTML shell, dependency script, and ordered application
   fragments listed in `src/source-manifest.json`.
2. Parse-check both generated script blocks.
3. Write `bottom.html`.
4. Gzip the page and verify that decompression reproduces it exactly.
5. Write the self-extracting `bottom_compressed.html` used by Perchance.

Application fragments intentionally remain parts of one shared IIFE. Their
manifest order is therefore part of the runtime contract. This first split
changes source ownership and build mechanics without changing browser behavior.
A later runtime rewrite can convert subsystem fragments to explicit modules and
worker entry points incrementally.

Do not edit either generated HTML file directly. Edit `src/`, then run the build.
