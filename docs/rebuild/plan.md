# Lite rebuild decisions — October 22, 2026

Rebuilt from the current normal engine while preserving ordinary gameplay and the existing Lite story/library work. Source code lives in src; generated pages are released together. No existing Lite saves require migration.

## Approved behavior

- Keep stories, objectives, maps, time, party/NPCs, shops/jobs, equipment, inventory, voices, images, profiles/accounts, shared publishing, auto turns and developer tools.
- Keep romance, flirting, dating, trust, attraction and affection. Exclude sexual systems, preferences, scene state, controls and prompts. Outfits and image projections provide opaque coverage.
- Restore ten appearance fields with the reviewed Lite scales. Preserve numeric values across shared imports. The grouped body-description field is removed.
- Lite authored character, animal and story definitions require lite: true; normal definitions omit it. Runtime records use their own exact schema.
- One shared public-library project and publishing identity. Lite queries the general-audience subset and projects shared files through the explicit adapter before canonical validation.
- Shared characters with a required alternate gender use their authored fallback. Preserve IDs/sliders; switch authored alternate name, outfits, starting outfit and profile when needed. Missing required fallbacks reject unchanged.
- Normal marked-Lite import supplies only the agreed omitted-field defaults. Normal source stories/characters remain unchanged.
- Valid general-audience story publishing preserves character ages. Standalone age requirements, younger-character safeguards and original-content/real-person policies remain.
- Keep Ollama/Tailscale and direct HTTPS text/image hosting. Model reasoning is optional; no paid jobs start during build/testing.

## Approved female chest table

| Value | Description |
| --- | --- |
| 0 | Extremely massive, heavily sagging K-cup breasts |
| 1 | Massive, heavily sagging J-cup breasts |
| 2 | Huge, sagging H-cup breasts |
| 3 | Very large, sagging G-cup breasts |
| 4 | Large, sagging F-cup breasts |
| 5 | Full, moderately sagging E-cup breasts |
| 6 | Moderately sized, sagging D-cup breasts |
| 7 | Medium, slightly sagging C-cup breasts |
| 8 | Small, slightly sagging B-cup breasts |
| 9 | Very small, slightly sagging A-cup breasts |
| 10 | Very small AA-cup breasts with minimal projection |
| 11 | Small A-cup breasts |
| 12 | Small B-cup breasts |
| 13 | Medium C-cup breasts |
| 14 | Moderately sized D-cup breasts |
| 15 | Full E-cup breasts |
| 16 | Large F-cup breasts |
| 17 | Very large G-cup breasts |
| 18 | Huge H-cup breasts |
| 19 | Massive J-cup breasts |
| 20 | Extremely massive K-cup breasts |

## Completion and evidence

All 41 standalone characters and 55 stories, documentation examples, and skill references use the current format. The installed/public Lite skills and downloadable ZIP match repository version 2.0.1. Detailed implementation inventories are archived in the task workspace rather than bundled with the game. See status.json, ../verification.md and ../../hosting/VERIFICATION.md for build and check results.

Browser smokes and live backend/model checks remain distinct verification gates. Local Node tests do not establish browser or paid-provider success.