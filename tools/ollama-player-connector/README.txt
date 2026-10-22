EmberAdventures Windows Player Connector

On the Windows computer where you play EmberAdventures, install and sign into
Tailscale. Unzip this folder and double-click Install Player Connector.bat once.
The installer registers a private Windows link handler for your user account.
It does not install Node.js, Ollama, or a background service.

After installation, select "Another computer through Tailscale" in the game's
Text Model settings. The browser may ask whether to open EmberAdventures Player
Connector; choose Open. A small popup searches online Tailscale peers for a
running EmberAdventures Host. With one host it connects automatically. With
several, select the host shown in the game. Approve the connection on the host
computer when prompted.

If the browser blocks popups or external app links, allow them for the game and
click Find Tailscale Host again.
