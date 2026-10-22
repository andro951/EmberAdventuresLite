# Story authoring

Use the [Lite story skill](../skills/emberadventureslite-story/SKILL.md) and its [field contract](../skills/emberadventureslite-story/references/story-contract.md). The Lite character skill supplies the embedded cast format.

A story export has the exact `app`, `exportType`, `storyTemplate`, and `exportedAt` wrapper. The `app` discriminator remains `EmberAdventures`. Include `lite: true` on the template and every full embedded humanoid or animal definition. Uninspected NPC shells are separate lightweight records.

Honor the selected player-library policy. If a default player should be selectable, include it in `state.players` as well as `state.player`. Provide a coherent opening location, map, clock, cast presence, image targets, inventory, and active objective. The opening must leave the player's next meaningful decision to them.

Plan objectives as playable actions with explicit outputs, conditions, rewards, and resolvable IDs. Check each handoff so it establishes the next situation without completing the next action. Trace every branch to an ending or deliberate free play. Use supported rewards and structured state; do not invent persistent fields or infer deterministic changes from prose.

Romance, flirting, and dating are welcome. All character outfits and image instructions use complete opaque coverage. Preserve authored ages and obey the canonical relationship constraints for younger characters. Original-content and real-person publishing policy is separate from file validity.

[The Lantern Road](examples/lantern-road.json) is a validated format example. [The Last Light at Bramble Bridge](../stories/The-Last-Light-at-Bramble-Bridge.json) provides a short branching story with both ending routes covered by local logic checks. Author fresh creative content for new stories.

Validate from the repository with:

```text
node skills/emberadventureslite-character/scripts/validate-content.cjs . path/to/story.json
```

This is canonical schema validation, not an AI playthrough. Browser import, start, save/reload, branch play, and actual generation are separate checks and must be reported accurately.