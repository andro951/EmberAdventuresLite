# EmberAdventuresLite smoke index

Generated from the current scenario registry. This is an inventory, not a test result.
Browser smokes run only when explicitly requested. The extensive group is excluded from Run All.

| Number | Scenario | Tier | Expected work |
| --- | --- | --- | --- |
| 1 | tessa-objective-chain-smoke | Short | about 1 second with a synthetic fake objective-chain fixture |
| 2 | left-panel-group-tessa-smoke | Short | about 1 second with a synthetic fake objective-chain fixture |
| 3 | world-generation-progress-monotonic-smoke | Short | about 1 second |
| 4 | runtime-narrow-sanitize-smoke | Short | about 2 seconds |
| 5 | story-economy-shops-jobs-smoke | Short | about 1-15 seconds |
| 6 | image-profile-ui | Short | about 2 seconds |
| 7 | manage-images-smoke | Short | about 1-15 seconds |
| 8 | manage-characters-smoke | Short | about 1-15 seconds |
| 9 | profile-library-workflow-smoke | Short | about 1-15 seconds |
| 10 | profile-category-ui | Short | about 1 second |
| 11 | story-template-start-ui | Short | about 1 second; verifies new-story chat starts at the top after the opening image request, plus canceled opening read then same-template restart auto-read |
| 12 | story-player-select-smoke | Short | about 1 second |
| 13 | borderlands-player-select-smoke | Short | about 2 seconds with a synthetic fake player-select fixture |
| 14 | saved-games-restore-ui | Short | about 2 seconds |
| 15 | save-storage-isolation-smoke | Short | about 1 second |
| 16 | worker-task-scheduling-smoke | Short | about 1 second |
| 17 | performance-rendering-smoke | Short | about 1-15 seconds |
| 18 | scene-image-action-scope-smoke | Short | about 1 second |
| 19 | save-scheduler-timing-smoke | Short | about 7 seconds; waits through one real 5 second save and one real 0.5 second urgent save |
| 20 | save-scheduler-actions-smoke | Short | about 1 second |
| 21 | save-session-lifecycle-smoke | Short | about 1 second |
| 22 | smoke-suite-runner-smoke | Short | about 1 second |
| 23 | state-conflict-guard | Short | about 1 second |
| 24 | toolbar-modals-smoke | Short | about 5 seconds |
| 25 | quick-actions-smoke | Short | about 2 seconds |
| 26 | scene-character-controls-smoke | Short | about 2 seconds |
| 27 | state-editor-autosave-smoke | Short | about 1 second |
| 28 | settings-persistence-smoke | Short | about 5 seconds |
| 29 | image-viewer-lab-smoke | Short | about 1 second; verifies normal Image Lab output stays normal and profile-source Image Lab output is stored as a profile image |
| 30 | story-surfaces-smoke | Short | about 2 seconds |
| 31 | story-library-ui-smoke | Short | about 2 seconds |
| 32 | character-library-cast-smoke | Short | about 8 seconds; includes authored character Chat defaults, inspection, override, and save reload |
| 33 | character-library-public-search-smoke | Short | about 2 seconds |
| 34 | character-library-local-pagination-smoke | Short | about 1-15 seconds |
| 35 | character-library-tab-switch-deferred-smoke | Short | about 1 second |
| 36 | ai-character-generation-contract-smoke | Short | about 1 second |
| 37 | manual-character-editor-smoke | Short | about 1 second |
| 38 | prompt-editor-smoke | Short | about 2 seconds |
| 39 | release-polish-smoke | Short | about 1 second |
| 40 | prompt-guidance-devtools-smoke | Short | about 2 seconds |
| 41 | turn-source-parity-smoke | Short | about 1 second |
| 42 | continue-objective-control-smoke | Short | about 1 second |
| 43 | objective-completion-timing-smoke | Short | about 2 seconds |
| 44 | no-agency-retry-smoke | Short | about 1 second |
| 45 | ai-priority-state-sync-smoke | Short | about 1 second |
| 46 | ai-timing-log-smoke | Short | about 1 second |
| 47 | ollama-provider-smoke | Short | about 1 second |
| 48 | exact-objective-ai-timing-smoke | Short | about 3 seconds |
| 49 | real-perchance-streaming-regenerate-smoke | Medium | about 15-60 seconds |
| 50 | find-character-turn-smoke | Short | about 1 second |
| 51 | ai-command-direct-smoke | Short | about 1 second |
| 52 | inspect-npc-direct-smoke | Short | about 1 second |
| 53 | npc-inspect-invite-smoke | Short | up to 6 minutes |
| 54 | template-migration-smoke | Short | about 1 second |
| 55 | immutable-definition-smoke | Short | about 1 second |
| 56 | large-objective-runtime-smoke | Short | about 2 seconds with a synthetic 7,000-objective fixture |
| 57 | story-template-import-export-smoke | Short | about 1 second |
| 58 | canonical-story-state-preservation-smoke | Short | about 1 second |
| 59 | objective-rewards-smoke | Short | about 1 second |
| 60 | story-timeline-pacing-smoke | Short | about 1-15 seconds |
| 61 | ai-outcome-routing-smoke | Short | about 1 second |
| 62 | future-cast-unlock-discipline-smoke | Short | about 1 second |
| 63 | speaker-npc-repair-smoke | Short | about 1 second |
| 64 | message-actions-smoke | Short | about 4 seconds |
| 65 | runtime-display-reference-map-smoke | Short | about 1-15 seconds |
| 66 | voice-segment-smoke | Short | about 1 second; includes Start Playing opening-message auto-read and canceled opening id reuse |
| 67 | voice-gating-smoke | Short | about 1 second |
| 68 | voice-browser-compatibility-smoke | Short | about 1 second |
| 69 | voice-resolution-smoke | Short | about 1 second; validates cached installed voices and stable cross-platform character voice repair |
| 70 | age-diversity-smoke | Short | about 1 second |
| 71 | export-storage-smoke | Short | about 1 second |
| 72 | character-editor-autosave-smoke | Short | about 2 seconds |
| 73 | future-character-prompt-smoke | Short | about 2 seconds |
| 74 | render-focus-preservation-smoke | Short | about 2 seconds |
| 75 | targeted-refresh-redraw-smoke | Short | about 1-15 seconds |
| 76 | character-import-export-smoke | Short | about 2 seconds |
| 77 | character-metadata-repair-import-smoke | Short | about 2 seconds |
| 78 | character-profile-import-edge-smoke | Short | about 2 seconds; includes profile and normal image deletion persistence across character delete/re-import |
| 79 | character-card-action-refresh-smoke | Short | about 2 seconds |
| 80 | image-profile-isolation-smoke | Short | about 1 second |
| 81 | profile-image-trigger-smoke | Short | about 1 second |
| 82 | profile-image-presentation-pointer-smoke | Short | about 1-15 seconds |
| 83 | story-player-select-gender-profile-image-smoke | Short | about 1-15 seconds |
| 84 | preferred-gender-scene-presence-smoke | Short | about 1-15 seconds |
| 85 | profile-image-rules-smoke | Short | about 2 seconds |
| 86 | profile-image-prompt-style-smoke | Short | about 1-15 seconds |
| 87 | profile-image-refresh-preserve-smoke | Short | about 1 second |
| 88 | character-card-export-layout-smoke | Short | about 1 second |
| 89 | logging-settings-smoke | Short | about 4 seconds |
| 90 | npc-full-preservation-smoke | Short | about 1 second |
| 91 | image-target-validation-smoke | Short | about 1 second |
| 92 | gender-adapted-scene-save-projection-smoke | Short | about 1-15 seconds |
| 93 | harem-objective-graph-smoke | Short | about 6 seconds with a synthetic fake objective fixture |
| 94 | harem-objective-schema-smoke | Short | about 1 second with a synthetic fake objective fixture |
| 95 | story-files-schema-smoke | Short | about 1 second with synthetic fake story fixtures |
| 96 | venis-model-branch-smoke | Short | about 1-15 seconds |
| 97 | harem-objective-flow-report | Short | about 12 seconds with a synthetic fake objective fixture |
| 98 | map-travel-objective-smoke | Short | about 1 second |
| 99 | location-hydration-smoke | Short | about 1 second |
| 100 | objective-picker-smoke | Short | about 2 seconds |
| 101 | turn-scene-image-collector-smoke | Short | about 1-15 seconds |
| 102 | clothing-image-target-smoke | Short | about 1 second |
| 103 | outfit-swap-smoke | Short | about 1 second |
| 104 | story-builder-edit-smoke | Short | about 1 second |
| 105 | library-metadata-validation-smoke | Short | about 1 second |
| 106 | creator-identity-ownership-smoke | Short | about 1-15 seconds |
| 107 | json-editor-access-smoke | Short | about 2 seconds |
| 108 | story-builder-metadata-smoke | Short | about 1 second |
| 109 | real-perchance-image-generation-smoke | Medium | about 2m 0s per image request; waits for finished real Perchance scene/profile images |
| 110 | real-profile-start-player-smoke | Medium | deterministic started-player profile generation through the production completion path |
| 111 | real-profile-start-character-smoke | Medium | deterministic started-party-character profile generation through the production completion path |
| 112 | real-profile-start-npc-smoke | Medium | deterministic started-NPC profile generation through the production completion path |
| 113 | real-profile-manual-refresh-smoke | Medium | deterministic manual profile refresh through the production completion path |
| 114 | real-profile-scene-entry-smoke | Medium | deterministic scene-entry profile generation through the production completion path |
| 115 | real-profile-objective-reward-smoke | Medium | deterministic objective-reward profile generation through the production completion path |
| 116 | real-profile-editor-refresh-smoke | Medium | deterministic editor-close profile refresh through the production completion path |
| 117 | real-profile-import-small-smoke | Medium | imports a complete character profile presentation without starting generation |
| 118 | real-maid-sama-start-images-smoke | Medium | deterministic opening normal and player-profile generation through the production completion path |
| 119 | real-borderlands-player-select-images-smoke | Medium | deterministic player-select profile queue coverage through the production completion path |
| 120 | simple-popup-key-close-smoke | Short | about 1 second |
| 121 | reserved-creator-name-client-smoke | Short | about 1-15 seconds |
| 122 | supabase-client-config-smoke | Short | about 2 seconds; read-only live Supabase config and schema check |
| 123 | supabase-auth-session-smoke | Short | about 1 second; read-only live Supabase signed-in session check |
| 124 | supabase-public-browse-smoke | Short | about 1 second; read-only live Supabase public story/character browse check |
| 125 | supabase-auth-ui-smoke | Short | about 1 second; mocked Supabase auth UI and request wiring check |
| 126 | supabase-public-download-smoke | Short | about 3 seconds; mocked public payload download/import check |
| 127 | supabase-public-update-version-mock-smoke | Short | about 1 second; mocked Supabase owned item update/versioning check |
| 128 | supabase-public-import-failure-smoke | Short | about 1 second; mocked public download failure handling check |
| 129 | supabase-public-empty-browse-smoke | Short | about 1 second; mocked empty public browse UI check |
| 130 | supabase-public-search-paging-smoke | Short | about 3 seconds; mocked explicit search, pagination, and request logging check |
| 131 | supabase-public-version-history-smoke | Short | about 1 second; mocked lazy single-item version history check |
| 132 | supabase-public-filter-smoke | Short | about 3 seconds; mocked explicit public-library filters without fetch while editing |
| 133 | supabase-public-version-download-smoke | Short | about 1 second; mocked selected old-version download/import path |
| 134 | perchance-test-upload-delete-smoke | Medium | about 30 seconds; live Perchance tiny text upload, delete, and deletion verification |
| 135 | supabase-live-reserved-creator-name-smoke | Medium | about 15-60 seconds |
| 136 | supabase-live-story-publish-cleanup-smoke | Short | about 3 seconds; live authenticated story publish, anonymous read, Supabase cleanup, and Perchance cleanup |
| 137 | supabase-live-character-publish-cleanup-smoke | Short | about 4 seconds; live authenticated character publish, anonymous read, Supabase cleanup, and Perchance cleanup |
| 138 | supabase-live-update-version-cleanup-smoke | Short | about 6 seconds; live authenticated two-version update, lazy version read, Supabase cleanup, and Perchance cleanup |
| 139 | supabase-live-feedback-cleanup-smoke | Short | about 4 seconds; live authenticated rating/report/tag feedback, anonymous feedback read, and cleanup |
| 140 | supabase-live-download-import-cleanup-smoke | Short | about 5 seconds; live public browse result downloads a temporary Perchance payload, imports it, and cleans up |
| 141 | supabase-live-visibility-cleanup-smoke | Short | about 4 seconds; live hide/unpublish behavior with anonymous and owner read checks |
| 142 | public-library-ui-feedback-smoke | Short | about 2 seconds |
| 143 | public-library-publish-mock-smoke | Short | about 1 second |
| 144 | public-library-beta-contract-smoke | Short | less than 1 second |
| 145 | developer-issue-submit-contract-smoke | Short | about 1 second |
| 146 | character-stats-integer-validation-smoke | Short | less than 1 second |
| 147 | reference-integer-reward-smoke | Short | less than 1 second |
| 148 | character-gender-adaptation-smoke | Short | about 1-15 seconds |
| 149 | reverse-delta-snapshot-smoke | Short | about 1-15 seconds |
| 150 | ai-reply-transaction-smoke | Short | about 1-15 seconds |
| 151 | chat-image-scroll-stability-smoke | Short | about 1-15 seconds |
| 152 | runtime-patch-persistence-matrix-smoke | Short | about 1-15 seconds |
| 153 | player-select-scroll-image-smoke | Short | about 1-15 seconds |
| 154 | ui-action-loading-smoke | Short | about 1-15 seconds |
| 155 | guided-objective-editor-matrix-smoke | Short | about 1-15 seconds |
| 156 | objective-output-runtime-smoke | Short | about 1-15 seconds |
| 157 | reusable-reward-builder-smoke | Short | about 1-15 seconds |
| 158 | batch-character-image-tool-smoke | Short | about 1-15 seconds |
| 159 | image-timeout-retry-smoke | Short | about 1 second; uses short synthetic timeouts and no live image calls |
| 160 | objective-requirement-routing-smoke | Short | about 1 second |
| 161 | extensive-supabase-publish-failures-smoke | Extensive | about 1-3 minutes; publish failure boundaries and cleanup |
| 162 | extensive-supabase-revision-lifecycle-smoke | Extensive | about 2-5 minutes; revisions, visibility, imports, caches, and cleanup |
| 163 | extensive-supabase-concurrent-publishing-smoke | Extensive | about 1-3 minutes; concurrent revisions and cleanup |