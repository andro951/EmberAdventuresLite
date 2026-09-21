async function devRunNpcFullPreservationSmokeTest() {
    devTestLog("Scenario start: npc-full-preservation-smoke");
    devResetForLiveTest("npc-full-preservation-smoke");
    devResetPreferenceSettingsForSmoke({});
    const glissFull = materializeCharacterForRuntime({
      ...blankCharacterTemplate("Gliss Molden"),
      name: "Gliss Molden",
      age: 34,
      gender: "female",
      role: "golden slime treasurer",
      voice: "Smoke Voice",
      personality_description: "A precise treasurer with a gold slime body.",
      relationship_to_player: "introduced",
      appearance: {
        species: "slime woman",
        skin_color: "warm translucent gold gel"
      }
    }, "Gliss Molden");
    app.state = repairAiGeneratedState({
      ...clone(defaultState),
      meta: {
        ...clone(defaultState.meta || {}),
        setup_complete: true,
        story_source: {
          mode: "original",
          title: "NPC Full Preservation Smoke"
        }
      },
      player: {
        ...clone(defaultState.player || {}),
        name: "Preservation Tester",
        age: 26,
        gender: "male"
      },
      scene: {
        ...clone(defaultState.scene || {}),
        party_members_present: ["Gliss Molden"],
        npcs_present: ["Gliss Molden"]
      },
      npc_directory: {
        locations: {
          "vault-hall": {
            label: "Vault Hall",
            characters: {
              "Gliss Molden": {
                name: "Gliss Molden",
                gender: "female",
                age: 34,
                role: "golden slime treasurer",
                relationship: "introduced",
                note: "Introduced future-cast NPC.",
                inspected: true,
                future_character_id: "gliss-molden",
                full_character: glissFull
              }
            }
          }
        }
      },
      future_cast: {
        enabled: true,
        items: {
          "gliss-molden": {
            id: "gliss-molden",
            name: "Gliss Molden",
            status: "introduced",
            introduce_as: "npc",
            full_character: glissFull
          }
        }
      }
    });
    const patched = applyStatePatch(clone(app.state), {
      characters: {
        "Gliss Molden": {
          current_appearance: "counting gold coins",
          pose: "kneeling",
          state_of_mind: "focused"
        }
      }
    }, {
      source: "npc full preservation smoke",
      currentState: app.state
    });
    const glissAfterPatch = findNpcEntryInState(patched, "Gliss Molden")?.npc;
    devAssert(glissAfterPatch?.inspected === true && !!glissAfterPatch?.full_character && glissAfterPatch.full_character.role === "golden slime treasurer" && glissAfterPatch.current_appearance === "counting gold coins" && glissAfterPatch.full_character.pose !== "kneeling" && glissAfterPatch.full_character.state_of_mind !== "focused", "allowed character patch for non-party NPC preserves inspected full_character while unrelated fields remain unchanged", glissAfterPatch);
    patched.npc_directory.locations["slime-guild-lobby"] = {
      label: "Slime Guild Lobby",
      characters: {
        "Gliss Molden": {
          name: "Gliss Molden",
          gender: "unspecified",
          age: 39,
          role: "local",
          relationship: "unknown",
          note: "appeared in the current scene but has not joined the party",
          inspected: false,
          full_character: null
        }
      }
    };
    delete patched.npc_directory.locations["vault-hall"];
    assertRuntimeNpcReferences(patched);
    const assertedGliss = findNpcEntryInState(patched, "Gliss Molden")?.npc;
    devAssert(assertedGliss?.inspected === false && !assertedGliss?.full_character, "runtime NPC assertions validate references without silently rewriting state", assertedGliss);
    const sanitizedDamagedState = repairAiGeneratedState(patched);
    const sanitizedGliss = findNpcEntryInState(sanitizedDamagedState, "Gliss Molden")?.npc;
    devAssert(sanitizedGliss?.inspected === true && !!sanitizedGliss?.full_character && sanitizedGliss.full_character.role === "golden slime treasurer", "loaded/imported damaged future-cast NPC shell is repaired during repairAiGeneratedState", sanitizedGliss);
    addMessage("system", "NPC full preservation smoke test passed.");
    showNotice("Live Test Passed", "NPC full preservation smoke test passed.");
    scheduleActiveGameSave();
    render();
    devTestLog("Scenario complete: npc-full-preservation-smoke");
  }
  async function devRunTurnSceneImageCollectorSmokeTest() {
    devTestLog("Scenario start: turn-scene-image-collector-smoke");
    devResetForLiveTest("turn-scene-image-collector-smoke");
    devResetPreferenceSettingsForSmoke({});
    app.state.player.name = "Collector Tester";
    app.state.player.age = 28;
    app.state.scene.party_members_present = ["Collector Tester"];
    app.state.scene.image_characters = ["Collector Tester"];
    app.state.characters ||= {};
    app.state.characters["Position Partner"] = {
      ...clone(app.state.player),
      id: "position-partner",
      name: "Position Partner"
    };
    app.state.characters["Scene Bystander"] = {
      ...clone(app.state.player),
      id: "scene-bystander",
      name: "Scene Bystander"
    };
    const originalGenerateImage = generateImage;
    const generated = [];
    try {
      generateImage = async (reason, options = {}) => {
        generated.push({
          reason,
          options: clone(options || {})
        });
        return {
          id: `collector-smoke-${generated.length}`
        };
      };
      app.settings.autoImages = true;
      const prompt = buildImageDecisionInstruction("assistant", "They talk quietly.", {
        scene: {
          summary: "quiet talk"
        }
      });
      devAssert(/Default to \{"should_generate":false\}/.test(prompt) && /ordinary dialogue/i.test(prompt) && /Do not request an image just because the state changed/i.test(prompt), "normal image decision prompt defaults to no image and discourages trivial auto images", {
        prompt
      });
      const originalImageDecisionAiText = aiText;
      const originalMaybeEnqueueAutoVisualNovelTurn = maybeEnqueueAutoVisualNovelTurn;
      const originalAutoVisualNovel = app.settings.autoVisualNovel;
      const imageDecisionOrder = [];
      try {
        app.settings.autoVisualNovel = true;
        maybeEnqueueAutoVisualNovelTurn = () => {
          imageDecisionOrder.push("auto");
          return true;
        };
        aiText = async () => {
          imageDecisionOrder.push("image decision");
          return "#";
        };
        runGroupedImageSection({
          source: "assistant",
          text: "They talk quietly.",
          startedAt: performance.now(),
          cancelPromise: Promise.resolve(false)
        });
        await new Promise(resolve => setTimeout(resolve, 25));
        devAssert(prettyJson(imageDecisionOrder) === prettyJson(["auto", "image decision"]), "grouped image decisions yield the shared AI queue to an enabled Auto turn", imageDecisionOrder);
      } finally {
        aiText = originalImageDecisionAiText;
        maybeEnqueueAutoVisualNovelTurn = originalMaybeEnqueueAutoVisualNovelTurn;
        app.settings.autoVisualNovel = originalAutoVisualNovel;
      }
      const collectorId = startTurnSceneImageCollector("collector-smoke");
      requestTurnSceneImage("ordinary state update");
      const playerClothingRequestAccepted = requestTurnSceneImage("outfit changed", {
        kind: "clothing",
        targets: ["Player"]
      });
      const npcClothingRequestAccepted = requestTurnSceneImage("waist clothing removed", {
        kind: "clothing",
        targets: ["Position Partner"]
      });
      requestTurnSceneImage("duplicate waist clothing removal", {
        kind: "clothing",
        targets: ["Position Partner"]
      });
      queueOneOffCharacterImage("Collector Tester", "character state changed");
      const storyDecisionRequestAccepted = requestTurnSceneImage("final image decision", {
        kind: "decision",
        targets: ["Player"]
      });
      app.state.scene.party_members_present = ["Collector Tester", "Position Partner", "Scene Bystander"];
      app.state.scene.image_characters = ["Collector Tester", "Position Partner", "Scene Bystander"];
      const positionRequestAccepted = requestTurnSceneImage("position changed", {
        kind: "clothing",
        targets: ["Position Partner"],
        immediate: true
      });
      const duplicateVisualRequestAccepted = requestTurnSceneImage("same resulting visual state", {
        kind: "clothing",
        targets: ["Position Partner"],
        immediate: true
      });
      const collector = currentTurnSceneImageCollector();
      await new Promise(resolve => setTimeout(resolve, 950));
      devAssert(generated.length === 1 && generated[0].reason === "position changed" && generated[0].options.immediate === true && playerClothingRequestAccepted === false && npcClothingRequestAccepted === true && storyDecisionRequestAccepted === true && positionRequestAccepted === true && duplicateVisualRequestAccepted === false && collector.requests.filter(entry => entry.options?.kind === "clothing").length === 0 && collector.requests.some(entry => entry.options?.kind === "character" && entry.options?.targets?.[0] === "Collector Tester"), "collector deduplicates outfit images and preserves the story decision", {
        generated,
        requests: collector.requests
      });
      flushTurnSceneImageCollector(collectorId);
      devAssert(generated.length === 2 && generated[1].reason === "final image decision" && prettyJson(generated[1].options.targets) === prettyJson(["Collector Tester"]), "turn scene image collector preserves the prompt position image and later final decision image without generating the superseded clothing image", {
        generated
      });
      const replacementCollectorId = startTurnSceneImageCollector("collector-replacement-smoke");
      requestTurnSceneImage("replacement collector clothing change", {
        kind: "clothing",
        targets: ["Scene Bystander"]
      });
      startTurnSceneImageCollector("collector-following-turn-smoke");
      devAssert(generated.length === 3 && generated[2].reason === "replacement collector clothing change" && generated[2].options.kind === "clothing" && prettyJson(generated[2].options.targets) === prettyJson(["Scene Bystander"]) && replacementCollectorId !== currentTurnSceneImageCollector()?.id, "starting the next turn flushes a pending clothing image instead of abandoning it", {
        generated,
        replacementCollectorId
      });
      cancelTurnSceneImageCollector();
      requestTurnSceneImage("manual fallback outside collector", {
        ignoreAutoImages: true
      });
      devAssert(generated.length === 4 && generated[3].reason === "manual fallback outside collector", "normal image requests outside a turn collector still generate directly", {
        generated
      });
      app.state.scene.image_characters = ["Collector Tester", "Position Partner"];
      app.state.scene.party_members_present = ["Collector Tester", "Position Partner"];
      const positionWithoutActAccepted = requestTurnSceneImage("new pose", {
        targets: ["Position Partner"],
        ignoreAutoImages: true
      });
      devAssert(positionWithoutActAccepted === true, "a pose change can request a non-player image", {
        generated,
        positionWithoutActAccepted
      });
      const distinctCollectorId = startTurnSceneImageCollector("collector-distinct-visual-events-smoke");
      app.state.characters["Position Partner"].clothing ||= {};
      app.state.characters["Position Partner"].clothing.shirt = null;
      const clothingVisualAccepted = requestTurnSceneImage("distinct clothing state", {
        kind: "clothing",
        targets: ["Position Partner"],
        immediate: true
      });
      app.state.characters["Position Partner"].pose = "waving from the doorway";
      const laterPositionVisualAccepted = requestTurnSceneImage("distinct later position state", {
        kind: "clothing",
        targets: ["Position Partner"],
        immediate: true
      });
      const repeatedPositionVisualAccepted = requestTurnSceneImage("duplicate later position state", {
        kind: "clothing",
        targets: ["Position Partner"],
        immediate: true
      });
      devAssert(clothingVisualAccepted === true && laterPositionVisualAccepted === true && repeatedPositionVisualAccepted === false && generated.length === 7 && generated[5].reason === "distinct clothing state" && generated[6].reason === "distinct later position state", "a clothing change and a later pose change generate promptly as two distinct visuals while an identical repeat is suppressed", {
        generated,
        distinctCollectorId,
        clothingVisualAccepted,
        laterPositionVisualAccepted,
        repeatedPositionVisualAccepted
      });
      cancelTurnSceneImageCollector(distinctCollectorId);
    } finally {
      generateImage = originalGenerateImage;
      cancelTurnSceneImageCollector();
    }
    addMessage("system", "Turn scene image collector smoke test passed.");
    showNotice("Live Test Passed", "Turn scene image collector smoke test passed.");
    scheduleActiveGameSave();
    render();
    devTestLog("Scenario complete: turn-scene-image-collector-smoke");
  }
  async function devRunImageTargetValidationSmokeTest() {
    devTestLog("Scenario start: image-target-validation-smoke");
    devResetForLiveTest("image-target-validation-smoke");
    devResetPreferenceSettingsForSmoke({});
    // Smoke invariant: normal image targets are only real image-eligible
    // entities. Generic labels like "Muscular woman" must never survive as
    // saved image targets, and an empty saved list falls back only at request time.
    app.state = repairAiGeneratedState({
      ...clone(defaultState),
      meta: {
        ...clone(defaultState.meta || {}),
        setup_complete: true,
        story_source: {
          mode: "original",
          title: "Image Target Validation Smoke"
        }
      },
      location: {
        ...clone(defaultState.location || {}),
        specific_place: "test square",
        npc_location_id: "test-square"
      },
      player: {
        ...clone(defaultState.player || {}),
        name: "Image Target Tester",
        age: 26,
        gender: "female"
      },
      characters: {
        "Ally One": {
          ...blankCharacterTemplate("Ally One"),
          name: "Ally One",
          age: 28,
          gender: "female",
          role: "companion"
        }
      },
      npc_directory: {
        locations: {
          "test-square": {
            label: "test square",
            characters: {
              "Nora Vale": {
                name: "Nora Vale",
                gender: "female",
                age: 29,
                role: "scout",
                inspected: true,
                full_character: {
                  ...blankCharacterTemplate("Nora Vale"),
                  name: "Nora Vale",
                  age: 29,
                  gender: "female",
                  role: "scout"
                }
              },
              "Uninspected Vale": {
                name: "Uninspected Vale",
                gender: "female",
                age: 29,
                role: "guard",
                inspected: false,
                full_character: null
              }
            }
          }
        }
      },
      scene: {
        ...clone(defaultState.scene || {}),
        party_members_present: ["Ally One"],
        npcs_present: ["Nora Vale", "Uninspected Vale"],
        image_characters: ["Player", "Ally One", "Nora Vale", "Muscular woman", "Unknown Woman", "Missing Person", "Uninspected Vale"]
      }
    });
    app.messages = [];
    scheduleActiveGameSave();
    render();
    const normalized = repairAiImageTargetsForState(app.state.scene.image_characters, app.state);
    devAssert(normalized.includes("Image Target Tester") && normalized.includes("Ally One") && normalized.includes("Nora Vale") && !normalized.includes("Muscular woman") && !normalized.includes("Unknown Woman") && !normalized.includes("Missing Person") && normalized.includes("Uninspected Vale"), "AI image-target repair keeps real inspected and uninspected entities while dropping generic or unknown labels", {
      normalized,
      scene: app.state.scene
    });
    app.state.scene.image_characters = [];
    const fallbackTargets = imageTargetNames();
    devAssert(fallbackTargets.includes("Image Target Tester") && app.state.scene.image_characters.length === 0, "empty saved image target list falls back to Player for generation without mutating saved targets", {
      fallbackTargets,
      savedTargets: app.state.scene.image_characters
    });
    app.state.scene.image_characters = ["Ally One"];
    addMessage("system", "Image target validation smoke test passed.");
    showNotice("Live Test Passed", "Image target validation smoke test passed.");
    scheduleActiveGameSave();
    render();
    devTestLog("Scenario complete: image-target-validation-smoke");
  }
  async function devRunGenderAdaptedSceneSaveProjectionSmokeTest() {
    devTestLog("Scenario start: gender-adapted-scene-save-projection-smoke");
    devResetForLiveTest("gender-adapted-scene-save-projection-smoke");
    devResetPreferenceSettingsForSmoke({});
    const danielle = devSmokeRuntimeCharacter("Danielle Mercer", {
      id: "smoke-save-danielle",
      gender: "female",
      romanceable: true,
      role: "gender-adapted scene NPC"
    });
    danielle.fallback_name = "Daniel Mercer";
    const player = devSmokeRuntimeCharacter("Save Projection Player", {
      id: "smoke-save-projection-player",
      gender: "female",
      role: "save projection tester"
    });
    app.state = {
      ...clone(defaultState),
      player,
      characters: {},
      npc_directory: {
        locations: {
          "smoke-save-room": {
            label: "Save Projection Room",
            characters: {
              "Danielle Mercer": {
                id: danielle.id,
                name: "Danielle Mercer",
                full_character: danielle
              }
            }
          }
        }
      },
      scene: {
        ...clone(defaultState.scene || {}),
        summary: "A save projection smoke scene.",
        image_action: "standing together",
        party_members_present: [],
        npcs_present: [],
        image_characters: []
      }
    };
    const objective = {
      id: "gender-adapted-scene-save-objective",
      title: "Gender-adapted scene save"
    };
    const resolvedRewardTarget = storyRewardCharacterTarget(app.state, {
      target: "Daniel Mercer"
    });
    devAssert(resolvedRewardTarget?.entity?.id === danielle.id && resolvedRewardTarget.name === "Danielle Mercer", "objective character targets resolve an authored name to the active gender-adapted runtime entity", {
      resolvedRewardTarget
    });
    applyObjectiveReward(app.state, objective, {
      type: "add_state_list_item",
      field_path: ["scene", "npcs_present"],
      value: "Daniel Mercer"
    });
    applyObjectiveReward(app.state, objective, {
      type: "add_state_list_item",
      field_path: ["scene", "image_characters"],
      value: "Daniel Mercer"
    });
    devAssert(app.state.scene.npcs_present.length === 1 && app.state.scene.npcs_present[0] === "Danielle Mercer" && app.state.scene.image_characters.length === 1 && app.state.scene.image_characters[0] === "Danielle Mercer", "objective scene-list rewards resolve an authored name to the active gender-adapted name", {
      scene: app.state.scene
    });
    const operations = sceneSaveOperations();
    const memberIds = operations.filter(operation => operation.type === "scene.member.add").map(operation => operation.characterId);
    const imageTargetIds = operations.find(operation => operation.type === "runtime.records.replace" && operation.storeName === "sceneImageTargets")?.records.map(record => record.characterId) || [];
    devAssert(memberIds.length === 1 && memberIds[0] === danielle.id && imageTargetIds.length === 1 && imageTargetIds[0] === danielle.id, "scene save projection accepts gender-adapted aliases and writes the stable runtime character id", {
      memberIds,
      imageTargetIds,
      operations
    });
    initializeSaveProjectionState();
    cancelSaveProjectionFlush();
    addMessage("system", "Gender-adapted scene save projection smoke test passed.");
    showNotice("Live Test Passed", "Gender-adapted scene save projection smoke test passed.");
    devTestLog("Scenario complete: gender-adapted-scene-save-projection-smoke");
  }
  async function devRunVenisModelBranchSmokeTest() {
    devTestLog("Scenario start: venis-model-branch-smoke");
    devResetForLiveTest("venis-model-branch-smoke");
    devResetPreferenceSettingsForSmoke({});
    const template = devSmokeVenisReplacementTemplate();
    devAssert(!!template, "Synthetic branch-lab story template is available for branch smoke.");
    devAssert(!!template?.state, "Synthetic branch-lab story template normalizes for branch smoke");
    const firstContact = (template.state.objectives?.items || []).find(objective => String(objective.id) === "first-contact");
    for (const choice of firstContact?.choices || []) {
      if (String(choice.id) === "stay-hidden") choice.title = "Stay hidden";
      if (String(choice.id) === "step-out-to-reassure-her") choice.title = "Step out and reassure her";
    }
    const originalStoryTemplates = app.storyTemplates;
    try {
      app.storyTemplates = [...originalStoryTemplates, template];
      const materialized = await storyImportWorkerRequest("materialize-story-runtime", {
        state: clone(template.state),
        messages: clone(template.messages || [])
      });
      app.state = repairAiGeneratedState(materialized.state);
      app.state.meta ||= {};
      app.state.meta.setup_complete = true;
      app.messages = materialized.messages;
      assertExactMessageStorage();
      app.images = [];
      app.profileImages = [];
      await devCompileCurrentStoryFixture("venis-model-branch-smoke");
      reconcileStoryRuntimeState(app.state, "venis model branch seed");
      const objectiveById = id => app.state.objectives?.items?.find(item => String(item.id) === String(id));
      const storyRuleIds = () => new Set((app.state.story_rules || []).map(rule => String(rule.id || "")));
      const hasRule = id => storyRuleIds().has(id);
      const branchNpcName = "Smoke Branch Android";
      const branchNpc = () => getNpcEntry(branchNpcName)?.full_character || getNpcEntry(branchNpcName) || {};
      const completeObjectiveForTest = id => {
        const before = clone(app.state);
        const completed = completeCurrentObjective(app.state, id);
        const rewardResult = applyObjectiveProgressRewards(before, app.state, "venis-model-branch-smoke", {
          silentGameMessage: true
        });
        reconcileStoryRuntimeState(app.state, "venis model completed " + id);
        devAssert(!!completed || objectiveIsComplete(objectiveById(id)), "Venis Model objective can be completed: " + id, {
          rewardResult,
          objective: objectiveById(id)
        });
        return objectiveById(id);
      };
      const completeMany = ids => ids.forEach(id => completeObjectiveForTest(id));
      const completeChoiceForTest = choiceId => {
        const owner = (app.state.objectives?.items || []).find(objective => (objective.choices || []).some(choice => String(choice.id) === String(choiceId)));
        if (!owner) throw new Error(`Synthetic branch choice owner is missing: ${choiceId}`);
        owner.status = "active";
        app.state.objectives.active_id = owner.id;
        app.state.objectives.no_current = false;
        syncSparseObjectiveRuntimeEntry(owner, app.state, {
          markDirty: false,
          bumpRevision: false
        });
        syncSparseObjectiveRuntimeControls(app.state, {
          markDirty: false,
          bumpRevision: false
        });
        const candidates = currentDirectChoiceCandidates(app.state);
        if (!candidates.some(choice => String(choice.id) === String(choiceId))) throw new Error(`Synthetic branch choice is unavailable: ${choiceId}; ` + `owner=${owner.id}; status=${effectiveObjectiveStatus(owner, app.state)}; ` + `active=${app.state.objectives.active_id}; ` + `candidates=${candidates.map(choice => choice.id).join(",")}`);
        return completeDirectObjectiveChoice(choiceId);
      };
      const openingChoiceIds = currentDirectChoiceCandidates(app.state).map(item => String(item.id));
      devAssert(openingChoiceIds.includes("stay-hidden") && openingChoiceIds.includes("step-out-to-reassure-her") && !objectiveById("stay-hidden") && !objectiveById("step-out-to-reassure-her"), "Venis Model opens with internal direct wake-up choices, not visible option objectives", {
        choices: openingChoiceIds,
        objectives: app.state.objectives?.items?.map(item => item.id)
      });
      render();
      await new Promise(resolve => setTimeout(resolve, 80));
      closeModal();
      openDirectObjectiveChoiceModal();
      const openingChoiceModalText = $("modalBox")?.textContent || "";
      devAssert(/Stay hidden/i.test(openingChoiceModalText) && /Step out and reassure her/i.test(openingChoiceModalText) && /Choose/i.test($("sendBtn")?.textContent || "") && !$("topObjectivePanel")?.classList.contains("hidden") && /Objective:\s*First Contact/i.test($("topObjectivePanel")?.textContent || ""), "Venis Model opening direct choice auto-opens, keeps the current objective banner visible, and Send becomes Choose", {
        modal: openingChoiceModalText,
        send: $("sendBtn")?.textContent || "",
        topObjectivePanel: $("topObjectivePanel")?.outerHTML || "",
        choices: openingChoiceIds
      });
      devAssert(!/Litia kills|Game over; roll back|repair arc continues|last battery charge|selected consequences/i.test(openingChoiceModalText), "Venis Model opening direct choice modal hides outcome spoilers", {
        modal: openingChoiceModalText
      });
      closeModal();
      openDirectObjectiveChoiceResponseModal("step-out-to-reassure-her");
      const stepOutResponseModalText = $("modalBox")?.textContent || "";
      devAssert(/Step out and reassure her/i.test(stepOutResponseModalText) && !/Litia kills|Game over; roll back|before her battery failed/i.test(stepOutResponseModalText), "Venis Model step-out response modal hides death spoilers", {
        modal: stepOutResponseModalText
      });
      if ($("directObjectiveChoiceText")) $("directObjectiveChoiceText").value = `"I'm Davin."`;
      const savedBusyForGameOverChoice = app.busy;
      app.busy = true;
      await confirmDirectObjectiveChoice("step-out-to-reassure-her");
      app.busy = savedBusyForGameOverChoice;
      const gameOverMessage = [...(app.messages || [])].reverse().find(message => message.role === "game");
      devAssert(String(app.state.player?.physical_state || "").toLowerCase() === "dead" && hasRule("ending-smoke-player-death") && app.state.meta?.game_over === true && app.queue.length === 1 && app.queue[0]?.source === "game_over" && /killed|dies|dead|fatal|Game Over/i.test(app.queue[0]?.directive || "") && /^GAME OVER\s+Use the choose-differently button/i.test(gameOverMessage?.text || "") && !!choiceRollbackSnapshotForMessage(gameOverMessage), "Venis Model step-out choice kills the player, records a clear game-over message, queues one final AI ending narration, and exposes a choose-differently rollback backup", {
        player: app.state.player,
        meta: app.state.meta,
        rules: Array.from(storyRuleIds()),
        queue: clone(app.queue),
        gameOverMessage
      });
      render();
      devAssert(/Game Over/i.test($("sendBtn")?.textContent || "") && $("sendBtn")?.disabled === true && /Game Over/i.test($("quickActions")?.textContent || ""), "Venis Model game-over state disables continuation controls and labels them Game Over", {
        send: $("sendBtn")?.outerHTML || "",
        quickActions: $("quickActions")?.textContent || ""
      });
      await submitUserText("I keep playing anyway.");
      const blockedGameMessage = [...(app.messages || [])].reverse().find(message => /game has ended, you cannot send more messages/i.test(message.text || ""));
      devAssert(!!blockedGameMessage && app.queue.length === 1 && app.queue[0]?.source === "game_over", "Venis Model game-over state blocks new player messages without consuming the final ending narration queue", {
        blockedGameMessage,
        queue: clone(app.queue)
      });
      devAssert(/restoreDirectObjectiveChoiceFromMessage/.test(document.querySelector(`[data-message-id="${cssEscape(String(gameOverMessage.id))}"] .message-actions`)?.innerHTML || ""), "Venis Model game-over message renders an in-chat choose-differently button while its snapshot exists", document.querySelector(`[data-message-id="${cssEscape(String(gameOverMessage.id))}"] .message-actions`)?.outerHTML || "");
      const gameOverChoiceSnapshot = choiceRollbackSnapshotForMessage(gameOverMessage);
      app.snapshots = (app.snapshots || []).filter(snapshot => String(snapshot.id || "") !== String(gameOverChoiceSnapshot.id));
      render();
      devAssert(!/restoreDirectObjectiveChoiceFromMessage/.test(document.querySelector(`[data-message-id="${cssEscape(String(gameOverMessage.id))}"] .message-actions`)?.innerHTML || ""), "Venis Model choose-differently button disappears when the associated rollback snapshot is gone", document.querySelector(`[data-message-id="${cssEscape(String(gameOverMessage.id))}"] .message-actions`)?.outerHTML || "");
      app.snapshots.push(gameOverChoiceSnapshot);
      await restoreDirectObjectiveChoiceFromMessage(gameOverMessage.id);
      app.queue = app.queue.filter(item => item?.source !== "game_over");
      devAssert(directObjectiveChoiceIsWaiting(app.state) && !app.state.meta?.game_over && String(app.state.player?.physical_state || "").toLowerCase() !== "dead" && !hasRule("ending-smoke-player-death"), "Venis Model choose-differently button restores the pre-choice snapshot and reopens the choice instead of leaving the player dead", {
        meta: app.state.meta,
        player: app.state.player,
        rules: Array.from(storyRuleIds()),
        choices: currentDirectChoiceCandidates(app.state).map(item => item.id)
      });
      closeModal();
      const savedAutoForChoice = app.settings.autoVisualNovel;
      const savedAutoCompletesForChoice = app.settings.autoModeCompletesObjectives;
      const savedBusyForAutoChoice = app.busy;
      const savedAiTextForAutoChoice = aiText;
      app.settings.autoVisualNovel = true;
      app.settings.autoModeCompletesObjectives = true;
      app.busy = true;
      aiText = async (instruction, opts = {}) => {
        devAssert(/STATE ACCESSIBLE TO THE PLAYER:/i.test(instruction) && /AVAILABLE CHOICES:/i.test(instruction) && /stay-hidden/i.test(instruction) && /step-out-to-reassure-her/i.test(instruction), "auto direct choice AI prompt includes auto-player context and available choice ids", {
          instructionStart: instruction.slice(0, 1800),
          opts
        });
        return `{"id":"stay-hidden","text":""}`;
      };
      let autoChoiceStarted = false;
      try {
        autoChoiceStarted = beginAutoDirectObjectiveChoice("venis branch smoke");
        await devWaitFor(() => !app.autoDirectObjectiveChoiceInProgress, 1000, "auto direct objective choice completion");
      } finally {
        aiText = savedAiTextForAutoChoice;
        app.busy = savedBusyForAutoChoice;
        app.settings.autoVisualNovel = savedAutoForChoice;
        app.settings.autoModeCompletesObjectives = savedAutoCompletesForChoice;
      }
      devAssert(autoChoiceStarted && hasRule("smoke-android-unconscious-after-wakeup") && /unconscious/i.test(String(branchNpc().physical_state || "")) && !directObjectiveChoiceIsWaiting(app.state) && objectiveById("retrieve-the-broken-model")?.status === "active", "Venis Model auto mode can complete the opening direct choice and advance the story without opening the choice UI", {
        autoChoiceStarted,
        branchNpc: branchNpc(),
        choices: currentDirectChoiceCandidates(app.state).map(item => item.id),
        next: objectiveById("retrieve-the-broken-model"),
        queue: clone(app.queue)
      });
      app.queue = [];
      completeMany(["retrieve-the-broken-model", "reach-the-hideout", "isolate-motor-control", "connect-power-and-wake-her", "repair-her-voice"]);
      completeChoiceForTest("build-trust");
      completeMany(["question-her-origin", "sit-with-her-fear", "ask-what-will-kill-her"]);
      const repairChoiceSnapshot = clone(app.state);
      completeChoiceForTest("repair-valuable-systems-first");
      const branchNpcAfterDeath = getNpcEntry(branchNpcName) || {};
      devAssert(npcIsDead(branchNpcAfterDeath) && hasRule("ending-smoke-android-died-on-table"), "Synthetic branch valuable-systems-first path kills the fake android and records the ending", {
        branchNpc: branchNpcAfterDeath,
        rules: Array.from(storyRuleIds())
      });
      app.state = clone(repairChoiceSnapshot);
      reconcileStoryRuntimeState(app.state, "venis model restore repair choice");
      completeChoiceForTest("repair-core-first");
      completeMany(["seal-the-core-leak", "wait-through-the-silence", "rebuild-the-arm", "let-her-test-the-arm", "repair-hip-actuators", "restore-first-leg", "restore-second-leg", "calibrate-first-steps", "talk-about-desired-bodies", "build-the-regen-cradle", "enter-the-regen-cradle", "restore-synthetic-flesh"]);
      const controlChoiceSnapshot = clone(app.state);
      completeChoiceForTest("restore-combat-systems");
      completeObjectiveForTest("weapon-reborn-ending");
      devAssert(String(app.state.player?.physical_state || "").toLowerCase() === "dead" && hasRule("ending-weapon-reborn"), "Venis Model aggressive combat restoration leads to player death ending", {
        player: app.state.player,
        rules: Array.from(storyRuleIds())
      });
      app.state = clone(controlChoiceSnapshot);
      reconcileStoryRuntimeState(app.state, "venis model restore control choice");
      completeChoiceForTest("keep-control-systems-safe");
      completeMany(["admit-the-market-plan", "prepare-the-market-run", "bring-her-to-the-sale"]);
      const marketChoiceSnapshot = clone(app.state);
      completeChoiceForTest("transfer-smoke-android");
      devAssert(hasRule("ending-smoke-android-transferred") && app.state.objectives?.exclusive_group_choices?.["market-choice"] === "choose-whether-to-transfer-smoke-android", "Synthetic branch transfer path records transfer ending and locks the refusal sibling", {
        rules: Array.from(storyRuleIds()),
        saleChoice: objectiveById("choose-whether-to-transfer-smoke-android"),
        choices: app.state.objectives?.exclusive_group_choices
      });
      app.state = clone(marketChoiceSnapshot);
      reconcileStoryRuntimeState(app.state, "venis model restore market choice");
      completeChoiceForTest("refuse-to-transfer-smoke-android");
      completeMany(["return-from-market", "let-relief-break"]);
      completeChoiceForTest("remove-final-lock");
      completeMany(["let-her-choose"]);
      completeChoiceForTest("let-her-stay-without-price");
      completeMany(["share-a-first-soft-moment", "repair-by-choice", "ask-what-she-wants-to-be"]);
      completeChoiceForTest("support-her-chosen-form");
      completeMany(["choose-the-future-together"]);
      completeChoiceForTest("choose-home-together");
      devAssert(hasRule("ending-home-together") && branchNpc().appearance?.body_description === "A sturdy, athletic build." && app.state.objectives?.exclusive_group_choices?.["final-future-choice"] === "choose-your-future-together", "Venis Model trust/freedom/body path reaches the home ending with deterministic body changes", {
        branchNpc: branchNpc(),
        finalChoice: objectiveById("choose-your-future-together"),
        choices: app.state.objectives?.exclusive_group_choices
      });
    } finally {
      app.storyTemplates = originalStoryTemplates;
    }
    devTestLog("Scenario complete: venis-model-branch-smoke");
  }
  async function devRunMapTravelObjectiveSmokeTest() {
    devTestLog("Scenario start: map-travel-objective-smoke");
    devResetForLiveTest("map-travel-objective-smoke");
    devResetPreferenceSettingsForSmoke({});
    // SANITIZE KEEP (dev fixture): synthetic map-travel state setup.
    // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
    app.state = repairAiGeneratedState({
      ...clone(defaultState),
      meta: {
        ...clone(defaultState.meta || {}),
        setup_complete: true,
        story_source: {
          mode: "original",
          title: "Map Travel Objective Smoke"
        }
      },
      player: {
        ...clone(defaultState.player || {}),
        name: "Map Tester",
        age: 28,
        gender: "male",
        role: "cartographer"
      },
      location: {
        universe: "Smoke World",
        world: "Smoke World",
        continent: "",
        region: "Old Road",
        settlement_type: "camp",
        settlement_name: "North Camp",
        district: "",
        specific_place: "North Camp",
        npc_location_id: "north-camp"
      },
      world_map: {
        current_location_id: "north-camp",
        current_location: "North Camp",
        focus_location_id: "north-camp",
        travel_history: ["north-camp"],
        locations: {
          "north-camp": {
            id: "north-camp",
            name: "North Camp",
            type: "camp",
            scale: "site",
            parent_id: "",
            x: 25,
            y: 45,
            discovered: true,
            travel_enabled: true,
            summary: "Starting camp for map travel smoke testing.",
            detail: "A small camp beside the old road.",
            connections: ["east-gate"],
            tags: ["safe"]
          },
          "east-gate": {
            id: "east-gate",
            name: "East Gate",
            type: "gate",
            scale: "site",
            parent_id: "",
            x: 72,
            y: 45,
            discovered: true,
            travel_enabled: true,
            summary: "Reachable gate for travel smoke testing.",
            detail: "A watch gate with a clear view of the road.",
            connections: ["north-camp"],
            tags: ["travel"],
            npcs: ["Doran Vale"]
          }
        }
      },
      npc_directory: {
        locations: {
          "north-camp": {
            label: "North Camp",
            characters: {
              "Camp Witness": {
                name: "Camp Witness",
                gender: "female",
                age: 31,
                role: "road witness",
                relationship: "neutral",
                note: "Remains in scene until the scene-removal check says otherwise.",
                inspected: false
              }
            }
          },
          "east-gate": {
            label: "East Gate",
            characters: {
              "Doran Vale": {
                name: "Doran Vale",
                gender: "male",
                age: 36,
                role: "gate warden",
                relationship: "neutral",
                note: "Watches the east road for the map travel smoke test.",
                inspected: false
              }
            }
          }
        }
      },
      scene: {
        ...clone(defaultState.scene || {}),
        summary: "Waiting at North Camp.",
        party_members_present: ["Map Tester"],
        image_characters: ["Map Tester"],
        npcs_present: ["Camp Witness"]
      },
      objectives: {
        active_id: "main-map-objective",
        focus_id: "side-map-objective",
        items: [{
          id: "main-map-objective",
          title: "Hold Main Route",
          type: "story",
          status: "active",
          summary: "Keep the main road secure.",
          objective: "Stay aware of the road.",
          steps: [],
          notes: [],
          rewards: [],
          travel_location_id: "north-camp",
          travel_location_name: "North Camp"
        }, {
          id: "side-map-objective",
          title: "Check East Gate",
          type: "side",
          status: "active",
          summary: "Inspect the east gate.",
          objective: "Travel to East Gate.",
          steps: [{
            text: "Reach East Gate",
            status: "active"
          }],
          notes: [],
          rewards: [],
          travel_location_id: "east-gate",
          travel_location_name: "East Gate"
        }],
        suggestions: []
      }
    });
    app.messages = [{
      id: nextEntryId(),
      role: "assistant",
      speaker: "Narrator",
      text: "Map travel objective smoke test ready.",
      at: new Date().toISOString()
    }];
    await devCompileCurrentStoryFixture("map-travel-objective-smoke");
    scheduleActiveGameSave();
    render();
    devAssert(currentObjectiveTarget()?.id === "side-map-objective", "focused side objective is selected story target", selectedObjectiveRuntime());
    devAssert(sceneObjectiveLabel() === "Inspect the east gate.", "scene objective label is derived from selected objective", {
      label: sceneObjectiveLabel()
    });
    const mapBeforeOpen = app.state.world_map;
    openMapModal();
    await new Promise(resolve => setTimeout(resolve, 150));
    devAssert($("modal")?.classList.contains("open") && /East Gate/i.test($("modal")?.textContent || ""), "map modal renders reachable target location", $("modal")?.textContent || "");
    devAssert(app.state.world_map === mapBeforeOpen, "opening the map modal does not mutate persisted world-map state", {
      sameReference: app.state.world_map === mapBeforeOpen
    });
    const eastGateNodeButton = [...document.querySelectorAll(".map-node")].find(button => /East Gate/i.test(button.textContent || ""));
    devAssert(!!eastGateNodeButton && !!eastGateNodeButton.querySelector(".map-node-icon") && !!eastGateNodeButton.querySelector(".map-node-detail") && !eastGateNodeButton.querySelector(".map-node-meta") && !/Reachable gate for travel smoke testing/i.test(String(eastGateNodeButton.querySelector(".map-node-title")?.textContent || "")), "map canvas nodes use compact icon markers and keep summaries out of always-visible labels", {
      nodeText: eastGateNodeButton?.textContent || "",
      title: eastGateNodeButton?.getAttribute("title") || ""
    });
    const currentBeforeMarkerClick = app.state.world_map?.current_location_id;
    clickMapNode("east-gate");
    await new Promise(resolve => setTimeout(resolve, 150));
    devAssert(app.state.world_map?.current_location_id === currentBeforeMarkerClick && document.querySelector(".map-node.selected")?.textContent?.includes("East Gate") && /Reachable gate for travel smoke testing/i.test($("modalBox")?.textContent || ""), "clicking a map marker selects it and shows details without immediately traveling", {
      currentBeforeMarkerClick,
      current: app.state.world_map?.current_location_id,
      selected: document.querySelector(".map-node.selected")?.textContent || "",
      modalText: $("modalBox")?.textContent || ""
    });
    const originalProcessQueue = processQueue;
    let processQueueCalled = false;
    processQueue = async () => {
      processQueueCalled = true;
    };
    try {
      await travelToMapLocation("east-gate");
    } finally {
      processQueue = originalProcessQueue;
    }
    await new Promise(resolve => setTimeout(resolve, 150));
    devAssert(app.state.world_map?.current_location_id === safeMapId("east-gate") && app.state.location?.specific_place === "East Gate", "travel updates current map and location state before AI turn", {
      map: app.state.world_map,
      location: app.state.location
    });
    devAssert(app.state.scene?.summary === "The scene shifts to East Gate." && (app.state.scene?.npcs_present || []).includes("Doran Vale") && (app.state.scene?.npcs_present || []).includes("Camp Witness"), "travel adds destination NPCs without clearing existing scene NPCs", app.state.scene);
    const locationPatched = applyStatePatch(app.state, {
      location: {
        ...app.state.location,
        specific_place: "East Gate Office"
      }
    }, {
      source: "map travel location preservation smoke"
    });
    devAssert((locationPatched.scene?.npcs_present || []).includes("Doran Vale") && (locationPatched.scene?.npcs_present || []).includes("Camp Witness"), "state location patches do not remove scene NPCs", locationPatched.scene);
    devAssert((app.state.recent_changes || [])[0] === "Traveled to East Gate.", "travel records recent change", app.state.recent_changes);
    devAssert((app.queue || []).some(entry => /Travel to East Gate/i.test(entry?.text || "")) && processQueueCalled, "travel queues the arrival message for normal AI processing", {
      queue: app.queue,
      processQueueCalled
    });
    devAssert(currentObjectiveTarget()?.id === "side-map-objective" && activeObjective()?.id === "main-map-objective", "travel preserves selected side target and active main objective", {
      selected: currentObjectiveTarget(),
      active: activeObjective()
    });
    app.queue = [];
    addMessage("system", "Map travel objective smoke test passed.");
    scheduleActiveGameSave();
    render();
    devTestLog("Scenario complete: map-travel-objective-smoke");
  }
  async function devRunLocationHydrationSmokeTest() {
    devTestLog("Scenario start: location-hydration-smoke");
    devResetForLiveTest("location-hydration-smoke");
    devResetPreferenceSettingsForSmoke({});
    // SANITIZE KEEP (dev fixture): synthetic location-hydration state setup.
    // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
    app.state = repairAiGeneratedState({
      ...clone(defaultState),
      meta: {
        ...clone(defaultState.meta || {}),
        setup_complete: true,
        story_source: {
          mode: "original",
          title: "Location Hydration Smoke"
        }
      },
      player: {
        ...clone(defaultState.player || {}),
        name: "Location Tester",
        age: 28,
        gender: "non-male",
        role: "scout"
      },
      location: {
        ...clone(defaultState.location || {})
      },
      world_map: {
        current_location_id: "moonlit-yard",
        focus_location_id: "moonlit-yard",
        travel_history: ["moonlit-yard"],
        locations: {
          "moonlit-yard": {
            id: "moonlit-yard",
            name: "Moonlit Yard",
            type: "training yard",
            scale: "site",
            parent_id: "silver-keep",
            x: 55,
            y: 70,
            discovered: true,
            travel_enabled: true,
            summary: "A moonlit yard used for drills.",
            detail: {
              world: "Test Realm",
              region: "Silver March",
              settlement_name: "Silver Keep",
              specific_place: "Moonlit Yard"
            },
            connections: ["silver-keep"],
            tags: ["training"]
          },
          "silver-keep": {
            id: "silver-keep",
            name: "Silver Keep",
            type: "keep",
            scale: "settlement",
            parent_id: "",
            x: 48,
            y: 52,
            discovered: true,
            travel_enabled: true,
            summary: "A keep in the Silver March.",
            detail: {
              world: "Test Realm",
              region: "Silver March",
              settlement_name: "Silver Keep"
            },
            connections: ["moonlit-yard"],
            tags: ["settlement"]
          }
        }
      },
      scene: {
        ...clone(defaultState.scene || {}),
        summary: "Testing map-derived location label.",
        party_members_present: ["Location Tester"],
        image_characters: ["Location Tester"],
        npcs_present: []
      },
      objectives: {
        active_id: "location-hydration-objective",
        focus_id: "",
        items: [{
          id: "location-hydration-objective",
          title: "Confirm Location",
          type: "story",
          status: "active",
          summary: "Make sure the HUD uses the map location.",
          objective: "Read the current place.",
          steps: [],
          notes: [],
          rewards: []
        }],
        suggestions: []
      }
    });
    render();
    setLeftPanelGroup("scene");
    const sceneText = `${$("leftGroupBody")?.textContent || ""} ${$("sceneCard")?.textContent || ""}`;
    devAssert(/Moonlit Yard/i.test(sceneText) && !/Unknown place/i.test(sceneText), "scene HUD derives current place from world_map when state.location starts blank", {
      sceneText,
      location: app.state.location,
      map: app.state.world_map
    });
    devAssert(currentSettlementName() === "Moonlit Yard", "current settlement label falls back to current map node", {
      label: currentSettlementName(),
      location: currentLocationDetail()
    });
    // SANITIZE KEEP (dev fixture): synthetic location fallback state setup.
    // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
    app.state = repairAiGeneratedState({
      ...clone(defaultState),
      meta: {
        ...clone(defaultState.meta || {}),
        setup_complete: true,
        story_source: {
          mode: "existing",
          title: "RuneScape"
        }
      },
      player: {
        ...clone(defaultState.player || {}),
        name: "Generated Tester",
        age: 25,
        role: "new adventurer"
      },
      location: {
        ...clone(defaultState.location || {})
      },
      world_map: {
        current_location_id: "",
        focus_location_id: "",
        travel_history: [],
        locations: {}
      },
      scene: {
        ...clone(defaultState.scene || {}),
        summary: "Testing generated-story fallback location.",
        party_members_present: ["Generated Tester"],
        image_characters: ["Generated Tester"],
        npcs_present: []
      },
      objectives: {
        active_id: "generated-location-objective",
        focus_id: "",
        items: [{
          id: "generated-location-objective",
          title: "Confirm Generated Location",
          type: "story",
          status: "active",
          summary: "Make sure generated games never start at an unknown place.",
          objective: "Read the generated current place.",
          steps: [],
          notes: [],
          rewards: []
        }],
        suggestions: []
      }
    });
    render();
    setLeftPanelGroup("scene");
    const fallbackSceneText = `${$("leftGroupBody")?.textContent || ""} ${$("sceneCard")?.textContent || ""}`;
    devAssert(/Starting Area/i.test(fallbackSceneText) && !/Unknown place/i.test(fallbackSceneText), "generated state uses neutral fallback current place when map and location are blank", {
      sceneText: fallbackSceneText,
      location: app.state.location,
      map: app.state.world_map
    });
    addMessage("system", "Location hydration smoke test passed.");
    scheduleActiveGameSave();
    render();
    devTestLog("Scenario complete: location-hydration-smoke");
  }
  async function devRunObjectivePickerSmokeTest() {
    devTestLog("Scenario start: objective-picker-smoke");
    devResetForLiveTest("objective-picker-smoke");
    devResetPreferenceSettingsForSmoke({});
    // SANITIZE KEEP (dev fixture): synthetic objective-picker state setup.
    // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
    app.state = repairAiGeneratedState({
      ...clone(defaultState),
      meta: {
        ...clone(defaultState.meta || {}),
        setup_complete: true,
        story_source: {
          mode: "original",
          title: "Objective Picker Smoke"
        }
      },
      player: {
        ...clone(defaultState.player || {}),
        name: "Objective Tester",
        age: 26,
        gender: "non-male",
        role: "planner"
      },
      scene: {
        ...clone(defaultState.scene || {}),
        summary: "Testing objective picker.",
        party_members_present: ["Ally One"],
        image_characters: ["Objective Tester"],
        objective: "Old stale scene objective should become suggestion."
      },
      characters: {
        "Ally One": {
          ...blankCharacterTemplate("Ally One"),
          name: "Ally One",
          age: 29,
          gender: "female",
          role: "objective smoke ally",
          trust: 1,
          attraction: 1,
          affection: 1
        }
      },
      progression: {
        ...clone(defaultState.progression || {}),
        current_goal: "Old stale progression goal should be removed."
      },
      objectives: {
        active_id: "main-objective-a",
        focus_id: "side-objective-a",
        items: [{
          id: "main-objective-a",
          title: "Primary Route",
          type: "story",
          status: "active",
          summary: "Main story route.",
          objective: "Follow the main road.",
          steps: [],
          notes: [],
          rewards: [{
            type: "start_objective",
            objective_id: "main-objective-b"
          }]
        }, {
          id: "main-objective-b",
          title: "Future Route",
          type: "story",
          status: "future",
          summary: "Future story route.",
          objective: "Do this later.",
          steps: [],
          notes: [],
          rewards: []
        }, {
          id: "side-objective-a",
          title: "Side Errand",
          type: "side",
          status: "active",
          summary: "Optional side target.",
          objective: "Handle the side errand.",
          steps: [{
            text: "Check the side route",
            status: "active"
          }],
          notes: [],
          rewards: []
        }, {
          id: "hidden-side-objective",
          title: "Hidden Side",
          type: "side",
          status: "hidden",
          summary: "Hidden side target.",
          objective: "Should not show in picker.",
          steps: [],
          notes: [],
          rewards: []
        }],
        suggestions: [{
          id: "suggestion-one",
          title: "Ask the Dockmaster",
          reason: "Recent scene mentioned a dockmaster.",
          available_now: true,
          status: "suggested"
        }]
      }
    });
    await devCompileCurrentStoryFixture("objective-picker-smoke");
    reconcileStoryRuntimeState(app.state, "objective picker smoke seed");
    app.messages = [];
    addMessage("assistant", "Objective picker smoke test ready.", "Narrator");
    scheduleActiveGameSave();
    render();
    devAssert(currentObjectiveTarget()?.id === "side-objective-a" && sceneObjectiveLabel() === "Optional side target.", "focused side objective drives selected objective label", {
      selected: currentObjectiveTarget(),
      label: sceneObjectiveLabel()
    });
    devAssert(!("objective" in (app.state.scene || {})) && !("current_goal" in (app.state.progression || {})), "reconcile removes stale scene/progression objective mirrors", {
      scene: app.state.scene,
      progression: app.state.progression
    });
    devAssert((app.state.objectives?.suggestions || []).some(item => item.id === "suggestion-one"), "objective suggestions remain separate from selected objective source of truth", app.state.objectives?.suggestions);
    const objectiveSuggestionBaseState = clone(app.state);
    openObjectivePickerModal();
    await new Promise(resolve => setTimeout(resolve, 150));
    const pickerText = $("modal")?.textContent || "";
    devAssert(/Primary Route/i.test(pickerText) && /Side Errand/i.test(pickerText) && !/Future Route/i.test(pickerText) && !/Hidden Side/i.test(pickerText), "objective picker shows active main and visible side objectives only", pickerText);
    openSetObjectiveModal();
    await new Promise(resolve => setTimeout(resolve, 150));
    const setObjectiveOptionsText = $("setObjectiveExisting")?.textContent || "";
    devAssert(/Primary Route/i.test(setObjectiveOptionsText) && /Side Errand/i.test(setObjectiveOptionsText) && !/Future Route/i.test(setObjectiveOptionsText) && !/Hidden Side/i.test(setObjectiveOptionsText), "set objective existing selector hides locked/future objectives", setObjectiveOptionsText);
    closeModal();
    setObjectiveFocus("main-objective-a");
    await new Promise(resolve => setTimeout(resolve, 150));
    devAssert(app.state.objectives?.active_id === "main-objective-a" && !app.state.objectives?.focus_id && currentObjectiveTarget()?.id === "main-objective-a" && sceneObjectiveLabel() === "Main story route.", "selecting main objective clears side focus and updates selected target", {
      objectives: app.state.objectives,
      label: sceneObjectiveLabel()
    });
    const beforeObjectiveReward = clone(app.state);
    completeCurrentObjective(app.state, "main-objective-a");
    const rewardResult = applyObjectiveProgressRewards(beforeObjectiveReward, app.state, "objective-picker-smoke", {
      silentGameMessage: true
    });
    devAssert(app.state.objectives?.active_id === "main-objective-b" && currentObjectiveTarget()?.id === "main-objective-b" && app.state.objectives.items.find(item => item.id === "main-objective-b")?.status === "active", "start_objective reward activates an existing future objective by objective_id", {
      rewardResult,
      objectives: app.state.objectives
    });
    const noNextObjectiveState = clone(app.state.objectives);
    app.storyDefinition = null;
    app.state.objectives = {
      active_id: "orphan-main-a",
      focus_id: "",
      no_current: false,
      items: [{
        id: "orphan-main-a",
        title: "Orphan Main A",
        type: "story",
        status: "active",
        summary: "Completes without a single next objective.",
        rewards: []
      }, {
        id: "orphan-main-b",
        title: "Orphan Main B",
        type: "story",
        status: "active",
        summary: "A separate available main objective.",
        rewards: []
      }, {
        id: "orphan-side-a",
        title: "Orphan Side A",
        type: "side",
        status: "active",
        summary: "A separate available side objective.",
        rewards: []
      }],
      suggestions: []
    };
    await devCompileCurrentStoryFixture("objective-picker-no-next-smoke");
    reconcileStoryRuntimeState(app.state, "objective picker no-next seed");
    completeCurrentObjective(app.state, "orphan-main-a");
    devAssert(app.state.objectives?.no_current === true && app.state.objectives?.pending_choice?.reason === "no_next_objective" && app.state.objectives.pending_choice.objective_ids.includes("orphan-main-b") && app.state.objectives.pending_choice.objective_ids.includes("orphan-side-a"), "main objective with no dependent next objective opens explicit objective selection", app.state.objectives);
    maybeOpenObjectiveChoiceModal();
    await new Promise(resolve => setTimeout(resolve, 150));
    const noNextPickerText = $("modalBox")?.textContent || "";
    devAssert(/Choose Next Objective/i.test(noNextPickerText) && /Orphan Main B/i.test(noNextPickerText) && /Orphan Side A/i.test(noNextPickerText) && /Continue With No Objective/i.test(noNextPickerText) && !!$("modalBox")?.querySelector(".modal-close"), "no-next objective picker lists alternatives and can be dismissed", noNextPickerText);
    closeModal();
    const savedAutoForPendingChoice = app.settings.autoVisualNovel;
    const savedAutoCompletesForPendingChoice = app.settings.autoModeCompletesObjectives;
    const savedAiTextForPendingChoice = aiText;
    let autoPendingChoicePrompt = "";
    app.settings.autoVisualNovel = true;
    app.settings.autoModeCompletesObjectives = true;
    aiText = async (instruction, opts = {}) => {
      autoPendingChoicePrompt = finalAiTextInstruction(instruction, opts);
      return '{"id":"orphan-side-a"}';
    };
    let autoPendingStarted = false;
    try {
      autoPendingStarted = beginAutoPendingObjectiveChoice("objective picker smoke");
      await devWaitFor(() => !app.autoPendingObjectiveChoiceInProgress, 1000, "auto pending objective AI selection");
    } finally {
      aiText = savedAiTextForPendingChoice;
      app.settings.autoVisualNovel = savedAutoForPendingChoice;
      app.settings.autoModeCompletesObjectives = savedAutoCompletesForPendingChoice;
    }
    devAssert(autoPendingStarted && app.state.objectives?.focus_id === "orphan-side-a" && /orphan-main-b/i.test(autoPendingChoicePrompt) && /orphan-side-a/i.test(autoPendingChoicePrompt) && !app.state.objectives?.pending_choice, "auto mode asks AI to select a pending objective and follows its non-first route", {
      autoPendingStarted,
      autoPendingChoicePrompt,
      objectives: app.state.objectives
    });
    app.state.objectives.pending_choice = {
      reason: "invalid-auto-selection-smoke",
      completed_id: "orphan-main-a",
      objective_ids: ["orphan-main-b", "orphan-side-a"]
    };
    const focusBeforeInvalidAutoChoice = app.state.objectives.focus_id;
    let invalidAutoChoiceError = "";
    aiText = async () => '{"id":"not-an-authored-objective"}';
    try {
      await chooseAutoPendingObjectiveWithAi(app.state);
    } catch (err) {
      invalidAutoChoiceError = err?.message || String(err);
    } finally {
      aiText = savedAiTextForPendingChoice;
    }
    devAssert(/invalid objective id/i.test(invalidAutoChoiceError) && app.state.objectives?.focus_id === focusBeforeInvalidAutoChoice && !!app.state.objectives?.pending_choice, "invalid Auto-mode AI output does not silently choose the first objective", {
      invalidAutoChoiceError,
      objectives: app.state.objectives
    });
    app.storyDefinition = null;
    app.state.objectives = noNextObjectiveState;
    await devCompileCurrentStoryFixture("objective-picker-restored-main-smoke");
    reconcileStoryRuntimeState(app.state, "objective picker restore after no-next smoke");
    const objectiveById = id => app.state.objectives.items.find(item => String(item.id) === String(id));
    const objectiveSelectable = id => objectiveCanBeSelected(objectiveById(id), app.state);
    app.storyDefinition = null;
    app.state.objectives.items.push({
      id: "exclusive-route-alpha",
      title: "Take Alpha Route",
      type: "story",
      status: "active",
      summary: "Choose alpha.",
      requires: [],
      exclusive_group: "exclusive-smoke-route",
      selectable: true,
      available_now: true,
      blocked_reason: "",
      notes: [],
      rewards: []
    }, {
      id: "exclusive-route-beta",
      title: "Take Beta Route",
      type: "story",
      status: "active",
      summary: "Choose beta.",
      requires: [],
      exclusive_group: "exclusive-smoke-route",
      selectable: true,
      available_now: true,
      blocked_reason: "",
      notes: [],
      rewards: []
    }, {
      id: "exclusive-route-gamma",
      title: "Take Gamma Route",
      type: "story",
      status: "active",
      summary: "Choose gamma.",
      requires: [],
      exclusive_group: "exclusive-smoke-route",
      selectable: true,
      available_now: true,
      blocked_reason: "",
      notes: [],
      rewards: []
    }, {
      id: "exclusive-alpha-followup",
      title: "Alpha Follow-Up",
      type: "story",
      status: "hidden",
      summary: "Alpha-only follow-up.",
      requires: ["exclusive-route-alpha"],
      exclusive_group: "",
      selectable: true,
      available_now: false,
      blocked_reason: "",
      notes: [],
      rewards: []
    }, {
      id: "exclusive-beta-followup",
      title: "Beta Follow-Up",
      type: "story",
      status: "hidden",
      summary: "Beta-only follow-up.",
      requires: ["exclusive-route-beta"],
      exclusive_group: "",
      selectable: true,
      available_now: false,
      blocked_reason: "",
      notes: [],
      rewards: []
    }, {
      id: "exclusive-gamma-followup",
      title: "Gamma Follow-Up",
      type: "story",
      status: "hidden",
      summary: "Gamma-only follow-up.",
      requires: ["exclusive-route-gamma"],
      exclusive_group: "",
      selectable: true,
      available_now: false,
      blocked_reason: "",
      notes: [],
      rewards: []
    }, {
      id: "exclusive-beta-ending-mercy",
      title: "Beta Mercy Ending",
      type: "story",
      status: "hidden",
      summary: "Choose mercy ending.",
      requires: ["exclusive-beta-followup"],
      exclusive_group: "exclusive-smoke-beta-ending",
      selectable: true,
      available_now: false,
      blocked_reason: "",
      notes: [],
      rewards: []
    }, {
      id: "exclusive-beta-ending-power",
      title: "Beta Power Ending",
      type: "story",
      status: "hidden",
      summary: "Choose power ending.",
      requires: ["exclusive-beta-followup"],
      exclusive_group: "exclusive-smoke-beta-ending",
      selectable: true,
      available_now: false,
      blocked_reason: "",
      notes: [],
      rewards: []
    }, {
      id: "exclusive-beta-mercy-epilogue",
      title: "Beta Mercy Epilogue",
      type: "story",
      status: "hidden",
      summary: "Mercy epilogue.",
      requires: ["exclusive-beta-ending-mercy"],
      exclusive_group: "",
      selectable: true,
      available_now: false,
      blocked_reason: "",
      notes: [],
      rewards: []
    }, {
      id: "exclusive-beta-power-epilogue",
      title: "Beta Power Epilogue",
      type: "story",
      status: "hidden",
      summary: "Power epilogue.",
      requires: ["exclusive-beta-ending-power"],
      exclusive_group: "",
      selectable: true,
      available_now: false,
      blocked_reason: "",
      notes: [],
      rewards: []
    }, {
      id: "parallel-branch-left",
      title: "Parallel Left",
      type: "story",
      status: "active",
      summary: "Parallel objective left.",
      requires: [],
      exclusive_group: "",
      selectable: true,
      available_now: true,
      blocked_reason: "",
      notes: [],
      rewards: []
    }, {
      id: "parallel-branch-right",
      title: "Parallel Right",
      type: "story",
      status: "active",
      summary: "Parallel objective right.",
      requires: [],
      exclusive_group: "",
      selectable: true,
      available_now: true,
      blocked_reason: "",
      notes: [],
      rewards: []
    }, {
      id: "parallel-branch-converge",
      title: "Parallel Converge",
      type: "story",
      status: "hidden",
      summary: "Completes when both parallel objectives are done.",
      requires: ["parallel-branch-left", "parallel-branch-right"],
      exclusive_group: "",
      selectable: true,
      completion_control: "reward_only",
      requirement_check_only: true,
      available_now: false,
      blocked_reason: "",
      notes: [],
      rewards: []
    });
    const exclusiveSourceObjectives = app.state.objectives.items.map(clone);
    app.state.objectives.items = devSmokeConnectAuthoredObjectives(exclusiveSourceObjectives.map(devSmokeAuthoredObjective), exclusiveSourceObjectives, {
      connectOrphans: false
    });
    await devCompileCurrentStoryFixture("objective-picker-exclusive-branch-smoke");
    reconcileStoryRuntimeState(app.state, "objective picker exclusive branch smoke seed");
    const beforeExclusiveChoice = clone(app.state.objectives);
    setObjectiveFocus("exclusive-route-beta");
    devAssert(app.state.objectives.exclusive_group_choices?.["exclusive-smoke-route"] === "exclusive-route-beta" && objectiveSelectable("exclusive-route-beta") && !objectiveSelectable("exclusive-route-alpha") && !objectiveSelectable("exclusive-route-gamma") && !objectiveSelectable("exclusive-alpha-followup") && !objectiveSelectable("exclusive-gamma-followup") && !objectiveSelectable("exclusive-beta-followup"), "selecting one of three exclusive routes records the choice, blocks sibling routes, and leaves descendants locked until prerequisites complete", {
      choices: app.state.objectives.exclusive_group_choices,
      alpha: objectiveById("exclusive-route-alpha"),
      beta: objectiveById("exclusive-route-beta"),
      gamma: objectiveById("exclusive-route-gamma"),
      betaFollowup: objectiveById("exclusive-beta-followup")
    });
    openObjectivePickerModal();
    await new Promise(resolve => setTimeout(resolve, 150));
    const exclusivePickerText = $("modal")?.textContent || "";
    devAssert(/Take Beta Route/i.test(exclusivePickerText) && !/Take Alpha Route/i.test(exclusivePickerText) && !/Take Gamma Route/i.test(exclusivePickerText) && /Parallel Left/i.test(exclusivePickerText) && /Parallel Right/i.test(exclusivePickerText), "objective picker hides losing exclusive route choices while leaving non-exclusive parallel choices visible", exclusivePickerText);
    closeModal();
    app.storyDefinition = null;
    app.state.objectives = clone(beforeExclusiveChoice);
    await devCompileCurrentStoryFixture("objective-picker-exclusive-branch-restore-smoke");
    reconcileStoryRuntimeState(app.state, "objective picker exclusive branch smoke restore");
    devAssert(!app.state.objectives.exclusive_group_choices?.["exclusive-smoke-route"] && objectiveSelectable("exclusive-route-alpha") && objectiveSelectable("exclusive-route-beta") && objectiveSelectable("exclusive-route-gamma"), "restoring an earlier objectives snapshot clears exclusive branch locks and reopens all route choices", {
      choices: app.state.objectives.exclusive_group_choices,
      alpha: objectiveById("exclusive-route-alpha"),
      beta: objectiveById("exclusive-route-beta"),
      gamma: objectiveById("exclusive-route-gamma")
    });
    completeCurrentObjective(app.state, "exclusive-route-beta");
    devAssert(app.state.objectives.exclusive_group_choices?.["exclusive-smoke-route"] === "exclusive-route-beta" && !objectiveSelectable("exclusive-route-alpha") && !objectiveSelectable("exclusive-route-gamma") && objectiveSelectable("exclusive-beta-followup") && !objectiveSelectable("exclusive-alpha-followup") && !objectiveSelectable("exclusive-gamma-followup"), "completing an exclusive route records the branch and unlocks only that route's direct descendants", JSON.stringify({
      choices: app.state.objectives.exclusive_group_choices,
      alpha: objectiveById("exclusive-route-alpha"),
      gamma: objectiveById("exclusive-route-gamma"),
      betaFollowup: objectiveById("exclusive-beta-followup"),
      objectiveRuntime: app.objectiveRuntime
    }));
    completeCurrentObjective(app.state, "exclusive-beta-followup");
    devAssert(objectiveSelectable("exclusive-beta-ending-mercy") && !objectiveSelectable("exclusive-beta-ending-power"), "multiple deterministic outputs activate only the first eligible route", {
      mercy: objectiveById("exclusive-beta-ending-mercy"),
      power: objectiveById("exclusive-beta-ending-power")
    });
    setObjectiveFocus("exclusive-beta-ending-mercy");
    devAssert(app.state.objectives.exclusive_group_choices?.["exclusive-smoke-beta-ending"] === "exclusive-beta-ending-mercy" && objectiveSelectable("exclusive-beta-ending-mercy") && !objectiveSelectable("exclusive-beta-ending-power") && !objectiveSelectable("exclusive-beta-mercy-epilogue") && !objectiveSelectable("exclusive-beta-power-epilogue"), "nested exclusive route records independently and blocks its sibling before completion", {
      choices: app.state.objectives.exclusive_group_choices,
      mercy: objectiveById("exclusive-beta-ending-mercy"),
      power: objectiveById("exclusive-beta-ending-power"),
      mercyEpilogue: objectiveById("exclusive-beta-mercy-epilogue"),
      powerEpilogue: objectiveById("exclusive-beta-power-epilogue")
    });
    completeCurrentObjective(app.state, "exclusive-beta-ending-mercy");
    devAssert(objectiveSelectable("exclusive-beta-mercy-epilogue") && !objectiveSelectable("exclusive-beta-power-epilogue"), "completing a nested exclusive ending unlocks only its own epilogue", {
      choices: app.state.objectives.exclusive_group_choices,
      mercyEpilogue: objectiveById("exclusive-beta-mercy-epilogue"),
      powerEpilogue: objectiveById("exclusive-beta-power-epilogue")
    });
    completeCurrentObjective(app.state, "parallel-branch-left");
    devAssert(objectiveSelectable("parallel-branch-right") && !objectiveIsComplete(objectiveById("parallel-branch-converge")), "non-exclusive parallel branches stay selectable after one parallel objective completes", {
      left: objectiveById("parallel-branch-left"),
      right: objectiveById("parallel-branch-right"),
      converge: objectiveById("parallel-branch-converge")
    });
    completeCurrentObjective(app.state, "parallel-branch-right");
    resolveReadyRewardOnlyObjectives(app.state, "objective picker parallel convergence smoke", {
      silentGameMessage: true
    });
    devAssert(objectiveIsComplete(objectiveById("parallel-branch-converge")) && !app.state.objectives.exclusive_group_choices?.["parallel-branch-left"] && !app.state.objectives.exclusive_group_choices?.["parallel-branch-right"], "non-exclusive parallel branches can converge without recording any exclusive branch choice", {
      choices: app.state.objectives.exclusive_group_choices,
      converge: objectiveById("parallel-branch-converge")
    });
    app.storyDefinition = null;
    app.state.objectives = {
      active_id: "direct-choice-setup",
      focus_id: "",
      no_current: false,
      exclusive_group_choices: {},
      items: [{
        id: "direct-choice-setup",
        title: "Reach the Law Choice",
        type: "story",
        status: "active",
        summary: "Reach the immediate choice.",
        requires: [],
        rewards: [],
        completion_control: "player"
      }, {
        id: "direct-choice-mercy",
        title: "Choose Mercy",
        type: "story",
        status: "hidden",
        summary: "Choose mercy as the new law.",
        requires: ["direct-choice-setup"],
        exclusive_group: "direct-choice-smoke-law",
        selectable: true,
        available_now: false,
        rewards: [{
          type: "add_story_rule",
          rule_id: "direct-choice-mercy-law",
          text: "The player chose mercy as the first law."
        }, {
          type: "adjust_relationship",
          target: "all_present",
          preset: "all",
          amount: 1
        }, {
          type: "generate_story_image",
          id: "direct-choice-mercy-image",
          title: "Mercy Choice Image",
          prompt: "single glowing blue law sigil floating over a stone altar, dramatic magic light",
          negative_prompt: "extra people"
        }],
        completion_control: "choice",
        next_objectives: [{
          id: "direct-choice-mercy-output",
          objective_id: "direct-choice-mercy-followup",
          target_input_group_id: "direct-choice-mercy-followup-input",
          completion_instruction: "Continue along the mercy route.",
          requirements: [],
          rewards: []
        }]
      }, {
        id: "direct-choice-power",
        title: "Choose Power",
        type: "story",
        status: "hidden",
        summary: "Choose power as the new law.",
        requires: ["direct-choice-setup"],
        exclusive_group: "direct-choice-smoke-law",
        selectable: true,
        available_now: false,
        rewards: [{
          type: "add_story_rule",
          rule_id: "direct-choice-power-law",
          text: "The player chose power as the first law."
        }],
        completion_control: "choice",
        next_objectives: [{
          id: "direct-choice-power-output",
          objective_id: "direct-choice-power-followup",
          target_input_group_id: "direct-choice-power-followup-input",
          completion_instruction: "Continue along the power route.",
          requirements: [],
          rewards: []
        }]
      }, {
        id: "direct-choice-mercy-followup",
        title: "Mercy Follow-Up",
        type: "story",
        status: "hidden",
        summary: "Mercy path follow-up.",
        next_objectives: [{
          id: "direct-choice-mercy-ending",
          completion_instruction: "Conclude the mercy route.",
          rewards: [],
          ending_type: "freeplay",
          ending_message: "The mercy direct-choice route is complete."
        }],
        rewards: [],
        selectable: true
      }, {
        id: "direct-choice-power-followup",
        title: "Power Follow-Up",
        type: "story",
        status: "hidden",
        summary: "Power path follow-up.",
        next_objectives: [{
          id: "direct-choice-power-ending",
          completion_instruction: "Conclude the power route.",
          rewards: [],
          ending_type: "freeplay",
          ending_message: "The power direct-choice route is complete."
        }],
        rewards: [],
        selectable: true
      }]
    };
    await devCompileCurrentStoryFixture("objective-picker-direct-choice-smoke");
    reconcileStoryRuntimeState(app.state, "direct choice smoke seed");
    const beforeDirectChoiceSetup = clone(app.state);
    completeCurrentObjective(app.state, "direct-choice-setup");
    reconcileStoryRuntimeState(app.state, "direct choice smoke unlocked");
    for (const choiceId of ["direct-choice-mercy", "direct-choice-power"]) {
      const choiceObjective = objectiveById(choiceId);
      choiceObjective.available_now = true;
      setObjectiveRuntimeStatus(app.state, choiceObjective, "queued");
    }
    app.state.objectives.active_id = "";
    app.state.objectives.pending_choice = {
      reason: "smoke_direct_choice_ui",
      completed_id: "direct-choice-setup",
      objective_ids: ["direct-choice-mercy", "direct-choice-power"],
      side_objective_ids: [],
      message: "Choose the law route."
    };
    devAssert(pendingObjectiveChoiceIsDirect(app.state) && directObjectiveChoiceIsWaiting(app.state) && currentDirectChoiceCandidates(app.state).length === 2, "pending direct-choice objective groups expose all selectable candidates", {
      pendingChoice: app.state.objectives.pending_choice,
      candidates: currentDirectChoiceCandidates(app.state).map(item => item.id)
    });
    if ($("input")) {
      $("input").value = "I choose mercy and say why.";
      $("input").focus();
    }
    render();
    if ($("input")) {
      $("input").value = "I choose mercy and say why.";
      $("input").focus();
    }
    await new Promise(resolve => setTimeout(resolve, 80));
    devAssert(!/Choose Mercy/i.test($("modalBox")?.textContent || ""), "rendering a loaded or pending direct choice does not auto-open its modal", $("modalBox")?.textContent || "");
    const loadedChoiceKey = directObjectiveChoiceAutoOpenKey(app.state);
    app.directObjectiveChoiceAutoOpenKey = loadedChoiceKey;
    const loadedReadMessage = addMessage("assistant", "Loaded choice narration should not reopen the existing choice.", "Narrator", {
      autoRead: false
    });
    const loadedReadToken = setActiveVoiceMessage(loadedReadMessage.id);
    clearActiveVoiceMessage(loadedReadToken);
    devAssert(!app.directObjectiveChoiceAutoOpenReadingMessageId && !app.directObjectiveChoiceAutoOpenTimer, "a choice already present when a game loads is suppressed for that choice set", {
      key: app.directObjectiveChoiceAutoOpenKey,
      readingMessageId: app.directObjectiveChoiceAutoOpenReadingMessageId
    });
    app.directObjectiveChoiceAutoOpenKey = "";
    const manualReadMessage = addMessage("assistant", "Manual choice opening should cancel the pending automatic popup.", "Narrator", {
      autoRead: false
    });
    const manualReadToken = setActiveVoiceMessage(manualReadMessage.id);
    devAssert(String(app.directObjectiveChoiceAutoOpenReadingMessageId) === String(manualReadMessage.id), "assistant screen-reader playback arms the pending choice auto-popup");
    openDirectObjectiveChoiceModal();
    clearActiveVoiceMessage(manualReadToken);
    devAssert(!app.directObjectiveChoiceAutoOpenReadingMessageId && !app.directObjectiveChoiceAutoOpenTimer, "manually opening the choice cancels its pending automatic popup");
    closeModal();
    app.directObjectiveChoiceAutoOpenKey = "";
    const automaticReadMessage = addMessage("assistant", "Automatic choice opening waits until this narration is finished.", "Narrator", {
      autoRead: false
    });
    const automaticReadToken = setActiveVoiceMessage(automaticReadMessage.id);
    clearActiveVoiceMessage(automaticReadToken);
    await new Promise(resolve => setTimeout(resolve, 1100));
    devAssert(/Choose/i.test($("sendBtn")?.textContent || ""), "Send button changes to Choose while a direct objective choice is waiting", $("sendBtn")?.outerHTML);
    devAssert(/Choose Mercy/i.test($("modalBox")?.textContent || "") && /Choose Power/i.test($("modalBox")?.textContent || ""), "direct objective choice modal opens once after assistant reading finishes and the one-second delay passes", $("modalBox")?.textContent || "");
    closeModal();
    devAssert(/Choose/i.test($("sendBtn")?.textContent || ""), "closing direct objective choice modal keeps Send button as Choose", $("sendBtn")?.outerHTML);
    openDirectObjectiveChoiceModal();
    await new Promise(resolve => setTimeout(resolve, 100));
    app.directObjectiveChoiceCopiedText = "I choose mercy and say why.";
    openDirectObjectiveChoiceResponseModal("direct-choice-mercy");
    await new Promise(resolve => setTimeout(resolve, 100));
    devAssert($("directObjectiveChoiceText")?.value === "I choose mercy and say why.", "direct objective choice response modal copies composer text", $("directObjectiveChoiceText")?.value);
    const directChoiceResponseField = $("directObjectiveChoiceText");
    const shiftEnterEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      shiftKey: true,
      bubbles: true,
      cancelable: true
    });
    directChoiceResponseField.dispatchEvent(shiftEnterEvent);
    devAssert(!shiftEnterEvent.defaultPrevented && !objectiveIsComplete(objectiveById("direct-choice-mercy")) && directChoiceResponseField.isConnected, "Shift+Enter remains available for a newline without submitting the optional choice response", {
      defaultPrevented: shiftEnterEvent.defaultPrevented,
      connected: directChoiceResponseField.isConnected
    });
    const savedBusyForDirectChoice = app.busy;
    try {
      app.busy = true;
      const enterEvent = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true
      });
      directChoiceResponseField.dispatchEvent(enterEvent);
      devAssert(!mainModalOpen(), "confirming an optional direct choice closes its popup before objective processing finishes", {
        modalOpen: mainModalOpen(),
        responseFieldConnected: directChoiceResponseField.isConnected
      });
      await directChoiceResponseField.__directObjectiveChoiceSubmitPromise;
      devAssert(enterEvent.defaultPrevented, "Enter submits the optional direct-choice response", {
        defaultPrevented: enterEvent.defaultPrevented
      });
    } finally {
      app.busy = savedBusyForDirectChoice;
    }
    devAssert(objectiveIsComplete(objectiveById("direct-choice-mercy")) && app.state.objectives.exclusive_group_choices?.["direct-choice-smoke-law"] === "direct-choice-mercy" && !objectiveSelectable("direct-choice-power") && objectiveSelectable("direct-choice-mercy-followup") && !objectiveSelectable("direct-choice-power-followup") && app.queue.some(item => item.source === "choice" && item.visibleText === "I choose mercy and say why." && item.objectiveResult?.completed?.id === "direct-choice-mercy") && (app.state.story_rules || []).some(rule => rule.id === "direct-choice-mercy-law") && app.state.characters["Ally One"]?.trust === 2 && app.state.characters["Ally One"]?.attraction === 2 && app.state.characters["Ally One"]?.affection === 2 && (app.images || []).some(image => image.storyImageRewardId === "direct-choice-mercy-image"), "confirming a direct objective choice completes it immediately, locks sibling paths, applies rewards including all-present relationship stats without unrelated fields, and queues the optional player response", {
      objectives: app.state.objectives,
      queue: app.queue,
      storyRules: app.state.story_rules,
      ally: app.state.characters["Ally One"],
      images: app.images
    });
    app.queue = [];
    app.state.story_inventory = {
      public_exposure: 2
    };
    app.storyDefinition = null;
    app.state.objectives = {
      active_id: "conditional-next-setup",
      focus_id: "",
      no_current: false,
      exclusive_group_choices: {},
      items: [{
        id: "conditional-next-setup",
        title: "Help Without Being Seen",
        type: "story",
        status: "active",
        summary: "Resolve the public rescue attempt.",
        requires: [],
        rewards: [],
        next_objectives: [{
          id: "conditional-next-public-output",
          objective_id: "conditional-next-agency",
          target_input_group_id: "conditional-next-agency-input",
          requirements: [{
            path: "story_inventory.public_exposure",
            op: ">=",
            value: 5
          }]
        }, {
          id: "conditional-next-quiet-output",
          objective_id: "conditional-next-quiet",
          target_input_group_id: "conditional-next-quiet-input",
          fallback: true
        }],
        completion_control: "ai"
      }, {
        id: "conditional-next-agency",
        title: "The Agency Notices",
        type: "story",
        status: "hidden",
        summary: "Public exposure brings official attention.",
        requires: ["conditional-next-setup"],
        rewards: [],
        selectable: true
      }, {
        id: "conditional-next-quiet",
        title: "Stay Below the Radar",
        type: "story",
        status: "hidden",
        summary: "The player remains unnoticed for now.",
        requires: ["conditional-next-setup"],
        rewards: [],
        selectable: true
      }]
    };
    await devCompileCurrentStoryFixture("objective-picker-conditional-low-smoke");
    reconcileStoryRuntimeState(app.state, "conditional next low exposure smoke seed");
    completeCurrentObjective(app.state, "conditional-next-setup");
    devAssert(app.state.objectives.active_id === "conditional-next-quiet" && !app.state.objectives.pending_choice, "conditional next objectives route to the first matching low-exposure/default branch without a choice menu", {
      activeId: app.state.objectives.active_id,
      pendingChoice: app.state.objectives.pending_choice,
      quiet: objectiveById("conditional-next-quiet"),
      agency: objectiveById("conditional-next-agency"),
      storyInventory: app.state.story_inventory
    });
    app.state.story_inventory = {
      public_exposure: 6
    };
    app.storyDefinition = null;
    app.state.objectives = {
      active_id: "conditional-next-setup",
      focus_id: "",
      no_current: false,
      exclusive_group_choices: {},
      items: [{
        id: "conditional-next-setup",
        title: "Help Without Being Seen",
        type: "story",
        status: "active",
        summary: "Resolve the public rescue attempt.",
        requires: [],
        rewards: [],
        next_objectives: [{
          id: "conditional-next-public-output",
          objective_id: "conditional-next-agency",
          target_input_group_id: "conditional-next-agency-input",
          requirements: [{
            path: "story_inventory.public_exposure",
            op: ">=",
            value: 5
          }]
        }, {
          id: "conditional-next-quiet-output",
          objective_id: "conditional-next-quiet",
          target_input_group_id: "conditional-next-quiet-input",
          fallback: true
        }],
        completion_control: "ai"
      }, {
        id: "conditional-next-agency",
        title: "The Agency Notices",
        type: "story",
        status: "hidden",
        summary: "Public exposure brings official attention.",
        requires: ["conditional-next-setup"],
        rewards: [],
        selectable: true
      }, {
        id: "conditional-next-quiet",
        title: "Stay Below the Radar",
        type: "story",
        status: "hidden",
        summary: "The player remains unnoticed for now.",
        requires: ["conditional-next-setup"],
        rewards: [],
        selectable: true
      }]
    };
    await devCompileCurrentStoryFixture("objective-picker-conditional-high-smoke");
    reconcileStoryRuntimeState(app.state, "conditional next high exposure smoke seed");
    completeCurrentObjective(app.state, "conditional-next-setup");
    devAssert(app.state.objectives.active_id === "conditional-next-agency" && !app.state.objectives.pending_choice, "conditional next objectives route to the threshold branch when story inventory requirements are met", {
      activeId: app.state.objectives.active_id,
      pendingChoice: app.state.objectives.pending_choice,
      quiet: objectiveById("conditional-next-quiet"),
      agency: objectiveById("conditional-next-agency"),
      storyInventory: app.state.story_inventory
    });
    app.state.story_inventory = {
      selected_route: ""
    };
    app.storyDefinition = null;
    app.state.objectives = {
      active_id: "reward-first-choice-owner",
      focus_id: "",
      no_current: false,
      items: [{
        id: "reward-first-choice-owner",
        title: "Choose a Reward-Gated Route",
        type: "story",
        status: "active",
        summary: "The selected choice determines the next route.",
        requires: [],
        rewards: [],
        completion_control: "choice",
        choices: [{
          id: "reward-first-worker-choice",
          title: "Choose Worker Route",
          summary: "Set the worker route.",
          rewards: [{
            type: "set_state_field",
            field_path: ["story_inventory", "selected_route"],
            value: "worker"
          }]
        }],
        next_objectives: [{
          id: "reward-first-worker-output",
          objective_id: "reward-first-worker-followup",
          requirements: [{
            path: "story_inventory.selected_route",
            op: "==",
            value: "worker"
          }]
        }]
      }, {
        id: "reward-first-worker-followup",
        title: "Worker Route Follow-Up",
        type: "story",
        status: "hidden",
        summary: "Continue down the worker route.",
        requires: ["reward-first-choice-owner"],
        rewards: [],
        selectable: true
      }]
    };
    await devCompileCurrentStoryFixture("objective-picker-reward-before-route-smoke");
    reconcileStoryRuntimeState(app.state, "direct choice reward before route smoke seed");
    const rewardFirstChoiceResult = completeDirectObjectiveChoice("reward-first-worker-choice");
    devAssert(!!rewardFirstChoiceResult?.completed && app.state.story_inventory.selected_route === "worker" && app.state.objectives.active_id === "reward-first-worker-followup" && !app.state.objectives.no_current, "direct choice applies selected rewards before evaluating reward-gated next routes", {
      result: rewardFirstChoiceResult,
      storyInventory: app.state.story_inventory,
      objectives: app.state.objectives
    });
    app.storyDefinition = null;
    app.state.objectives = {
      active_id: "direct-choice-owner",
      focus_id: "",
      no_current: false,
      exclusive_group_choices: {},
      items: [{
        id: "direct-choice-owner",
        title: "Choose the Test Route",
        type: "story",
        status: "active",
        summary: "Choose which route to take.",
        requires: [],
        exclusive_group: "direct-choice-owner-smoke",
        selectable: true,
        rewards: [],
        completion_control: "choice",
        choices: [{
          id: "owner-choice-mercy",
          title: "Choose Mercy",
          summary: "Choose the merciful route.",
          effects: ["Adds the mercy rule.", "Starts the mercy follow-up."],
          requirements: [{
            path: "characters.Ally One.trust",
            op: ">=",
            value: 2
          }],
          rewards: [{
            type: "add_story_rule",
            rule_id: "owner-choice-mercy-law",
            text: "The player chose mercy from the owner choice menu."
          }, {
            type: "start_objective",
            objective_id: "owner-choice-mercy-followup",
            activate: true
          }]
        }, {
          id: "owner-choice-power",
          title: "Choose Power",
          summary: "Choose the forceful route.",
          effects: ["Adds the power rule."],
          requirements: [{
            path: "characters.Ally One.trust",
            op: ">=",
            value: 4
          }],
          rewards: [{
            type: "add_story_rule",
            rule_id: "owner-choice-power-law",
            text: "The player chose power from the owner choice menu."
          }]
        }]
      }, {
        id: "owner-choice-mercy-followup",
        title: "Mercy Follow-Up",
        type: "story",
        status: "hidden",
        summary: "Continue the merciful route.",
        requires: [],
        rewards: [],
        selectable: false
      }]
    };
    await devCompileCurrentStoryFixture("objective-picker-owner-choice-smoke");
    reconcileStoryRuntimeState(app.state, "owner direct choice smoke seed");
    devAssert(directObjectiveChoiceIsWaiting(app.state) && currentDirectChoiceCandidates(app.state).map(item => item.id).join("|") === "owner-choice-mercy|owner-choice-power" && !visibleObjectiveChoices(app.state).some(({
      objective
    }) => objective.id === "direct-choice-owner") && !objectiveById("owner-choice-mercy") && !objectiveById("owner-choice-power"), "owner direct choice exposes internal choices without showing the owner as a normal objective or adding option objectives", {
      candidates: currentDirectChoiceCandidates(app.state).map(item => item.id),
      visible: visibleObjectiveChoices(app.state).map(({
        objective
      }) => objective.id),
      objectives: app.state.objectives.items.map(item => item.id)
    });
    if ($("input")) $("input").value = "I choose mercy from the owner.";
    render();
    closeModal();
    openDirectObjectiveChoiceModal();
    await new Promise(resolve => setTimeout(resolve, 80));
    const ownerModalText = $("modalBox")?.textContent || "";
    devAssert(/Choose Mercy/i.test(ownerModalText) && /Choose Power/i.test(ownerModalText) && /characters\.Ally One\.trust >= 2/i.test(ownerModalText) && /characters\.Ally One\.trust >= 4/i.test(ownerModalText) && !/Adds the mercy rule|Adds the power rule|Mercy path|Power path/i.test(ownerModalText), "owner direct choice modal lists internal choices and visible requirements without leaking internal choice details", ownerModalText);
    devAssert(directObjectiveChoiceRequirementResults(currentDirectChoiceCandidates(app.state).find(item => item.id === "owner-choice-mercy")).every(item => item.met) && directObjectiveChoiceRequirementResults(currentDirectChoiceCandidates(app.state).find(item => item.id === "owner-choice-power")).some(item => !item.met) && !openDirectObjectiveChoiceResponseModal("owner-choice-power"), "direct objective choice requirements show locked choices and block unmet options", {
      candidates: currentDirectChoiceCandidates(app.state).map(item => ({
        id: item.id,
        requirements: directObjectiveChoiceRequirementResults(item)
      }))
    });
    closeModal();
    const savedBusyForOwnerDirectChoice = app.busy;
    try {
      app.busy = true;
      openDirectObjectiveChoiceResponseModal("owner-choice-mercy");
      await confirmDirectObjectiveChoice("owner-choice-mercy");
    } finally {
      app.busy = savedBusyForOwnerDirectChoice;
    }
    devAssert(objectiveIsComplete(objectiveById("direct-choice-owner")) && objectiveSelectable("owner-choice-mercy-followup") && (app.state.story_rules || []).some(rule => rule.id === "owner-choice-mercy-law") && app.queue.some(item => item.source === "choice" && item.objectiveResult?.completed?.id === "direct-choice-owner" && item.visibleText === "I choose mercy from the owner."), "manual optional choice text remains unchanged while completing the owner objective and applying selected option rewards", {
      objectives: app.state.objectives,
      queue: app.queue,
      storyRules: app.state.story_rules
    });
    app.queue = [];
    app.storyDefinition = null;
    app.state.objectives = {
      active_id: "targetless-choice-owner",
      focus_id: "",
      no_current: false,
      items: [{
        id: "targetless-choice-owner",
        title: "Choose Then Route",
        type: "story",
        status: "active",
        summary: "Choose an option before following the objective-level route.",
        requires: [],
        rewards: [],
        completion_control: "choice",
        choices: [{
          id: "targetless-choice-option",
          title: "Choose the Available Option",
          summary: "Select the choice without a direct objective target.",
          rewards: [{
            type: "add_story_rule",
            rule_id: "targetless-choice-selected",
            text: "The targetless choice was selected."
          }]
        }],
        next_objectives: [{
          objective_id: "targetless-choice-followup",
          requirements: []
        }]
      }, {
        id: "targetless-choice-followup",
        title: "Targetless Choice Follow-Up",
        type: "story",
        status: "hidden",
        summary: "Continue after the targetless choice.",
        requires: ["targetless-choice-owner"],
        rewards: []
      }]
    };
    await devCompileCurrentStoryFixture("objective-picker-targetless-auto-choice-smoke");
    reconcileStoryRuntimeState(app.state, "targetless auto direct choice smoke seed");
    const savedAutoForTargetlessChoice = app.settings.autoVisualNovel;
    const savedAutoCompletesForTargetlessChoice = app.settings.autoModeCompletesObjectives;
    const savedAiTextForTargetlessChoice = aiText;
    const savedMaybeEnqueueAutoVisualNovelTurnForTargetlessChoice = maybeEnqueueAutoVisualNovelTurn;
    const targetlessAutoContinuationAttempts = [];
    let targetlessAutoStarted = false;
    app.settings.autoVisualNovel = true;
    app.settings.autoModeCompletesObjectives = true;
    aiText = async () => '{"id":"targetless-choice-option","text":"I choose the targetless route."}';
    const plainAutoChoice = await chooseAutoDirectObjectiveChoiceWithAi(currentDirectChoiceCandidates(app.state));
    aiText = async () => '{"id":"targetless-choice-option","text":"\\"I already used quotes.\\""}';
    const quotedAutoChoice = await chooseAutoDirectObjectiveChoiceWithAi(currentDirectChoiceCandidates(app.state));
    aiText = async () => '{"id":"targetless-choice-option","text":""}';
    const blankAutoChoice = await chooseAutoDirectObjectiveChoiceWithAi(currentDirectChoiceCandidates(app.state));
    devAssert(plainAutoChoice.responseText === '"I choose the targetless route."' && quotedAutoChoice.responseText === '"I already used quotes."' && blankAutoChoice.responseText === "", "AI optional choice text gains dialogue quotes exactly once while blank text remains blank", {
      plain: plainAutoChoice.responseText,
      quoted: quotedAutoChoice.responseText,
      blank: blankAutoChoice.responseText
    });
    aiText = async () => '{"id":"targetless-choice-option","text":""}';
    maybeEnqueueAutoVisualNovelTurn = (reason = "auto") => {
      targetlessAutoContinuationAttempts.push({
        reason,
        choiceInProgress: app.autoDirectObjectiveChoiceInProgress
      });
      return false;
    };
    try {
      targetlessAutoStarted = beginAutoDirectObjectiveChoice("targetless choice route smoke");
      await devWaitFor(() => !app.autoDirectObjectiveChoiceInProgress, 1000, "targetless auto direct objective choice");
    } finally {
      aiText = savedAiTextForTargetlessChoice;
      maybeEnqueueAutoVisualNovelTurn = savedMaybeEnqueueAutoVisualNovelTurnForTargetlessChoice;
      app.settings.autoVisualNovel = savedAutoForTargetlessChoice;
      app.settings.autoModeCompletesObjectives = savedAutoCompletesForTargetlessChoice;
    }
    devAssert(targetlessAutoStarted && objectiveIsComplete(objectiveById("targetless-choice-owner")) && app.state.objectives.active_id === "targetless-choice-followup" && effectiveObjectiveStatus(objectiveById("targetless-choice-followup"), app.state) === "active" && (app.state.story_rules || []).some(rule => rule.id === "targetless-choice-selected") && app.objectiveRuntime.selectedChoiceById["targetless-choice-owner"] === "targetless-choice-option" && targetlessAutoContinuationAttempts.some(attempt => attempt.reason === "direct objective choice finished" && attempt.choiceInProgress === false), "auto mode preserves a targetless selected choice, follows the owner route, and resumes only after its choice lock clears", {
      targetlessAutoStarted,
      autoContinuationAttempts: targetlessAutoContinuationAttempts,
      objectives: app.state.objectives,
      selectedChoiceById: app.objectiveRuntime.selectedChoiceById,
      storyRules: app.state.story_rules,
      transitionDiagnostic: app.lastObjectiveTransitionDiagnostic
    });
    app.queue = [];
    app.storyDefinition = null;
    app.state.objectives = {
      active_id: "exact-choice-owner",
      focus_id: "",
      no_current: false,
      items: [{
        id: "exact-choice-owner",
        title: "Answer Exactly",
        type: "story",
        status: "active",
        summary: "Choose an exact authored response.",
        requires: [],
        rewards: [],
        completion_control: "choice",
        choice_response_mode: "exact_text",
        choices: [{
          id: "exact-choice-accept",
          title: "Accept",
          summary: "Accept the offer.",
          player_text: "\"I accept your offer.\"",
          rewards: []
        }, {
          id: "exact-choice-decline",
          title: "Decline",
          summary: "Decline the offer.",
          player_text: "\"No. I will find another way.\"",
          rewards: []
        }]
      }, {
        id: "exact-choice-followup",
        title: "Continue After Exact Choice",
        type: "story",
        status: "hidden",
        summary: "Continue after the exact response.",
        requires: ["exact-choice-owner"],
        rewards: []
      }]
    };
    await devCompileCurrentStoryFixture("objective-picker-exact-choice-smoke");
    reconcileStoryRuntimeState(app.state, "exact direct choice smoke seed");
    render();
    closeModal();
    openDirectObjectiveChoiceModal();
    await new Promise(resolve => setTimeout(resolve, 60));
    devAssert(/I accept your offer/i.test($("modalBox")?.textContent || "") && /No\. I will find another way/i.test($("modalBox")?.textContent || ""), "exact player dialogue is visible in the initial choice menu", $("modalBox")?.textContent || "");
    openDirectObjectiveChoiceResponseModal("exact-choice-accept");
    await new Promise(resolve => setTimeout(resolve, 40));
    devAssert(!$("directObjectiveChoiceText") && /The player will say/i.test($("modalBox")?.textContent || "") && /I accept your offer/i.test($("modalBox")?.textContent || ""), "exact-text choices show authored dialogue without an editable response field", $("modalBox")?.textContent || "");
    const savedBusyForExactChoice = app.busy;
    try {
      app.busy = true;
      await submitDirectObjectiveChoice("exact-choice-accept", {
        responseText: "This attempted override must be ignored.",
        closeModal: true
      });
    } finally {
      app.busy = savedBusyForExactChoice;
    }
    devAssert(objectiveIsComplete(objectiveById("exact-choice-owner")) && app.queue.some(item => item.source === "choice" && item.visibleText === "\"I accept your offer.\"" && !String(item.visibleText).includes("attempted override")), "exact-text choices submit only the authored player dialogue", app.queue);
    app.queue = [];
    app.state = clone(objectiveSuggestionBaseState);
    await devCompileCurrentStoryFixture("objective-picker-final-restore-smoke");
    reconcileStoryRuntimeState(app.state, "direct choice smoke restore");
    openObjectivePickerModal();
    await new Promise(resolve => setTimeout(resolve, 150));
    acceptObjectiveSuggestion("suggestion-one");
    await new Promise(resolve => setTimeout(resolve, 150));
    devAssert(currentObjectiveTarget()?.title === "Ask the Dockmaster" && !(app.state.objectives?.suggestions || []).some(item => item.id === "suggestion-one"), "accepting suggestion creates and focuses a side objective", {
      selected: currentObjectiveTarget(),
      objectives: app.state.objectives
    });
    closeModal();
    addMessage("system", "Objective picker smoke test passed.");
    scheduleActiveGameSave();
    render();
    devTestLog("Scenario complete: objective-picker-smoke");
  }
  async function devRunClothingImageTargetSmokeTest() {
    devResetForLiveTest("clothing-image-target-smoke");
    devResetPreferenceSettingsForSmoke({});
    app.state = devMakeGameControlState();
    const ally = devSmokeRuntimeCharacter("Outfit Tester", {
      gender: "female",
      role: "explorer"
    });
    ally.clothing = {
      ...blankClothingTemplate(),
      shirt: "blue linen tunic",
      pants: "brown travel trousers",
      feet: "leather boots"
    };
    ally.outfits = [{
      id: "travel",
      name: "Travel",
      clothing: clone(ally.clothing)
    }, {
      id: "formal",
      name: "Formal",
      clothing: {
        ...blankClothingTemplate(),
        shirt: "green formal jacket",
        pants: "black formal trousers",
        feet: "polished shoes"
      }
    }];
    ally.active_outfit_id = "travel";
    app.state.characters[ally.name] = ally;
    app.state.scene.party_members_present = [ally.name];
    app.state.scene.image_characters = [ally.name];
    app.state.scene.image_action = "examining an old map";
    let prompt = buildImagePrompt(ally.name, ally);
    devAssert(/blue linen tunic/.test(prompt) && /brown travel trousers/.test(prompt) && /leather boots/.test(prompt), "single-character image includes each visible outfit item", prompt);
    devAssert(/fully clothed/.test(prompt) && /family-friendly/.test(prompt) && /opaque full-coverage clothing/.test(prompt), "scene images carry the general-audience presentation contract", prompt);
    const safetyExclusions = buildImageSafetyNegativePrompt({includeTurnaroundNegatives: false}).split(", ");
    devAssert(preserveImageSafetyNegativePrompt("custom exclusion").includes("exposed genitals"), "Custom negatives retain image safety");
    devAssert(sanitizeFamilyFriendlyImagePrompt("forest").includes("family-friendly"), "Custom positives retain image safety");
    devAssert(joinVisibleClothing({ bra: "plain bra", shirt: "tunic", underwear: "plain underwear", pants: "trousers" }) === "tunic, trousers", "Hidden undergarments stay out of image prompts");
    devAssert(hasUpperBodyCovering({ bra: "plain bra" }) && hasLowerBodyCovering({ underwear: "plain underwear" }), "Undergarments remain valid engine coverage");
    for (const count of [1, 2, 3, 4]) {
      const groupNegative = buildGroupImageNegativePrompt(Array.from({length: count}, (_, index) => [`Coverage Fixture ${index}`, ally]));
      devAssert(safetyExclusions.every(exclusion => groupNegative.includes(exclusion)), "group images retain all safety exclusions", {count, groupNegative});
    }
    const clothingBefore = JSON.stringify(ally.clothing);
    const appearanceBefore = JSON.stringify(ally.appearance);
    for (const gender of ["male", "female"]) {
      const entity = {
        ...clone(ally),
        gender
      };
      entity.appearance.body_description = "A sturdy, athletic build.";
      devAssert(buildBodyStatPrompt(entity.appearance, entity).includes(entity.appearance.body_description), "overall body description is preserved for either presentation");
      for (const slot of Object.keys(BODY_STAT_DEFAULTS)) {
        for (const value of [0, 10, 20]) devAssert(typeof bodyStatPhrase(slot, value, {
          entity
        }) === "string" && bodyStatPhrase(slot, value, {
          entity
        }).length > 0, `${slot} accepts both ends and the center of its numeric scale`);
        const custom = bodyStatPhrase(slot, "broad stone-built silhouette", {
          entity
        });
        devAssert(custom === "broad stone-built silhouette", `${slot} supports an authored custom description`, custom);
      }
    }
    devAssert(JSON.stringify(ally.clothing) === clothingBefore && JSON.stringify(ally.appearance) === appearanceBefore, "prompt generation does not rewrite source clothing or proportions");
    applyOutfitToEntity(ally, "formal");
    prompt = buildImagePrompt(ally.name, ally);
    devAssert(/green formal jacket/.test(prompt) && /black formal trousers/.test(prompt) && !prompt.includes("blue linen tunic"), "outfit changes replace the previous clothing in subsequent image prompts", prompt);
    applyCharacterClothingOperations(ally.name, [{
      operation: "remove",
      slots: ["coat"]
    }], app.state);
    devAssert(ally.active_outfit_id === "formal" && clothingItemText(ally.clothing.shirt) === "green formal jacket", "an absent outer layer does not discard the character's outfit");
  }
  async function devRunOutfitSwapSmokeTest() {
    devTestLog("Scenario start: outfit-swap-smoke");
    devResetForLiveTest("outfit-swap-smoke");
    devResetPreferenceSettingsForSmoke({});
    app.settings.reducedUi = false;
    applyReducedUiClass();
    app.state = devMakeGameControlState();
    app.state.player.clothing = {
      ...blankClothingTemplate(),
      shirt: "linen shirt",
      pants: "travel pants",
      feet: "boots"
    };
    app.state.player.outfits = [{
      id: "travel",
      name: "Travel",
      clothing: app.state.player.clothing
    }, {
      id: "formal",
      name: "Formal",
      clothing: {
        shirt: "blue formal coat",
        pants: "pressed trousers",
        feet: "polished shoes"
      }
    }];
    app.state.player.active_outfit_id = "travel";
    app.state.characters["Ally Vale"] = {
      ...blankCharacterTemplate("Ally Vale"),
      name: "Ally Vale",
      clothing: {
        ...blankClothingTemplate(),
        shirt: "green tunic",
        pants: "brown trousers",
        feet: "leather boots"
      },
      outfits: [{
        id: "casual",
        name: "Casual",
        clothing: {
          shirt: "green tunic",
          pants: "brown trousers",
          feet: "leather boots"
        }
      }, {
        id: "armor",
        name: "Armor",
        clothing: {
          shirt: "padded armor",
          pants: "armored leggings",
          feet: "steel boots"
        }
      }, {
        id: "bare",
        name: "Bare",
        clothing: {
          shirt: null,
          pants: null,
          underwear: null,
          feet: null
        }
      }, {
        id: "minimal-safe",
        name: "Minimal Safe",
        clothing: {
          shirt: null,
          pants: null,
          underwear: null,
          feet: null
        }
      }],
      active_outfit_id: "casual",
      known_facts: ["Ally knows the public route."]
    };
    app.state.scene.party_members_present = ["Ally Vale"];
    app.state.npc_directory = {
      locations: {
        Camp: {
          label: "Camp",
          characters: {
            "Nia Inspect": {
              name: "Nia Inspect",
              inspected: true,
              full_character: {
                ...blankCharacterTemplate("Nia Inspect"),
                name: "Nia Inspect",
                clothing: {
                  ...blankClothingTemplate(),
                  shirt: "blue guide tunic",
                  pants: "brown field trousers",
                  feet: "soft boots"
                },
                outfits: [{
                  id: "guide",
                  name: "Guide",
                  clothing: {
                    shirt: "blue guide tunic",
                    pants: "brown field trousers",
                    feet: "soft boots"
                  }
                }, {
                  id: "cloak",
                  name: "Cloak",
                  clothing: {
                    shirt: "silver travel cloak",
                    pants: "black travel trousers",
                    feet: "soft boots"
                  }
                }],
                active_outfit_id: "guide"
              }
            }
          }
        }
      }
    };
    app.state.scene.npcs_present = ["Nia Inspect"];
    app.settings.leftPanelGroup = "characters";
    app.messages = [{
      id: nextEntryId(),
      role: "assistant",
      speaker: "Narrator",
      text: "Outfit swap smoke test ready.",
      at: new Date().toISOString()
    }];
    app.images = [];
    const originalStartStoredImageRequest = startStoredImageRequest;
    startStoredImageRequest = async record => {
      const image = (app.images || []).find(item => String(item.id) === String(record.id));
      if (image) {
        image.html = `<img src="${devSmokeOnePixelDataUrl()}" alt="Smoke captured outfit image request">`;
        image.pending = false;
        image.error = "";
      }
    };
    scheduleActiveGameSave();
    render();
    try {
      devAssert(document.querySelectorAll('select[title="Saved outfits"]').length >= 2, "character cards render saved-outfit dropdowns for player and party members");
      devAssert(!!document.querySelector('[data-character-action="save-outfit"][data-character-name="Ally Vale"]'), "character cards render a save-current-outfit button");
      selectCharacterOutfit("Ally Vale", "armor");
      await new Promise(resolve => setTimeout(resolve, 250));
      devAssert(app.state.characters["Ally Vale"].active_outfit_id === "armor" && clothingItemText(app.state.characters["Ally Vale"].clothing.shirt) === "padded armor" && clothingItemText(app.state.characters["Ally Vale"].clothing.feet) === "steel boots", "manual outfit dropdown swaps party character clothing and clears stale removal state", app.state.characters["Ally Vale"]);
      const outfitImageRecord = (app.images || [])[0];
      devAssert(!!outfitImageRecord && JSON.stringify(outfitImageRecord.targets || []) === JSON.stringify(["Ally Vale"]), "manual outfit swap creates a normal image targeted only at the selected character", outfitImageRecord);
      devAssert(/padded armor/i.test(outfitImageRecord?.prompt || "") && /armored leggings/i.test(outfitImageRecord?.prompt || "") && /steel boots/i.test(outfitImageRecord?.prompt || "") && !/Player/i.test(outfitImageRecord?.prompt || ""), "manual outfit swap image prompt uses every selected outfit clothing item and excludes other scene characters", outfitImageRecord?.prompt || "");
      app.images = [];
      selectCharacterOutfit("Player", "formal");
      await new Promise(resolve => setTimeout(resolve, 250));
      devAssert(app.state.player.active_outfit_id === "formal" && clothingItemText(app.state.player.clothing.shirt) === "blue formal coat", "manual outfit dropdown swaps player clothing", app.state.player);
      const playerOutfitImageRecord = (app.images || [])[0];
      devAssert(!!playerOutfitImageRecord && JSON.stringify(playerOutfitImageRecord.targets || []) === JSON.stringify([playerEntityDisplayName(app.state)]), "manual player outfit swap creates a normal image targeted only at the player", playerOutfitImageRecord);
      devAssert(/blue formal coat/i.test(playerOutfitImageRecord?.prompt || "") && /pressed trousers/i.test(playerOutfitImageRecord?.prompt || "") && /polished shoes/i.test(playerOutfitImageRecord?.prompt || ""), "manual player outfit swap image prompt includes every selected outfit clothing item", playerOutfitImageRecord?.prompt || "");
      app.images = [];
      selectCharacterOutfit("Nia Inspect", "cloak");
      await new Promise(resolve => setTimeout(resolve, 250));
      const npc = getNpcEntryFromState(app.state, "Nia Inspect")?.full_character;
      devAssert(npc?.active_outfit_id === "cloak" && clothingItemText(npc.clothing?.shirt) === "silver travel cloak", "manual outfit dropdown swaps inspected NPC clothing", npc);
      const npcOutfitImageRecord = (app.images || [])[0];
      devAssert(!!npcOutfitImageRecord && JSON.stringify(npcOutfitImageRecord.targets || []) === JSON.stringify(["Nia Inspect"]), "manual inspected NPC outfit swap creates a normal image targeted only at that NPC", npcOutfitImageRecord);
      devAssert(/silver travel cloak/i.test(npcOutfitImageRecord?.prompt || "") && /black travel trousers/i.test(npcOutfitImageRecord?.prompt || "") && /soft boots/i.test(npcOutfitImageRecord?.prompt || ""), "manual inspected NPC outfit swap image prompt includes every selected outfit clothing item", npcOutfitImageRecord?.prompt || "");
      app.images = [];
      devResetPreferenceSettingsForSmoke({});
      render();
      app.state.player = {
        ...app.state.player,
        ...extractPlayer({
          active_outfit_id: "formal"
        }, app.state.player)
      };
      devAssert(app.state.player.active_outfit_id === "formal" && clothingItemText(app.state.player.clothing.shirt) === "blue formal coat", "AI/state patch can swap the player by active_outfit_id", app.state.player);
      applyOutfitToEntity(app.state.characters["Ally Vale"], "casual");
      applyOutfitToEntity(getNpcEntryFromState(app.state, "Nia Inspect")?.full_character, "guide");
      app.state.characters["Ally Vale"].clothing.shirt = "black hooded jacket";
      app.state.characters["Ally Vale"].clothing.pants = "dark fitted pants";
      const saveOutfitPromise = saveCharacterCurrentOutfit("Ally Vale");
      await devWaitFor(() => {
        const popup = [...document.querySelectorAll(".popup-modal.open")].at(-1);
        return popup?.querySelector("#styledPromptInput") && /Save Outfit/i.test(popup.textContent || "");
      }, 2000, "styled save outfit prompt to open");
      const saveOutfitPopup = [...document.querySelectorAll(".popup-modal.open")].at(-1);
      const saveOutfitInput = saveOutfitPopup?.querySelector("#styledPromptInput");
      devAssert(saveOutfitInput && /Save Outfit/i.test(saveOutfitPopup?.textContent || ""), `save-current-outfit opens an EmberAdventures popup: ${saveOutfitPopup?.textContent || "no open popup"}`, {
        popupText: saveOutfitPopup?.textContent || ""
      });
      saveOutfitInput.value = "Stealth";
      saveOutfitPopup.querySelector("#promptSubmitBtn")?.click();
      await saveOutfitPromise;
    } finally {
      startStoredImageRequest = originalStartStoredImageRequest;
    }
    addMessage("system", "Outfit swap smoke test passed.");
    scheduleActiveGameSave();
    render();
    devTestLog("Scenario complete: outfit-swap-smoke");
  }
  async function devRunStoryBuilderEditSmokeTest() {
    devTestLog("Scenario start: story-builder-edit-smoke");
    devResetForLiveTest("story-builder-edit-smoke");
    devResetPreferenceSettingsForSmoke({});
    const classifiedOutfitMarkup = renderStoryBuilderGrantOutfitPresentation({
      outfit: {
        id: "classified-outfit",
        name: "Classified Outfit",
        clothing: {}
      }
    }, "outfit");
    devAssert(/Outfit ID/.test(classifiedOutfitMarkup) && /Outfit Name/.test(classifiedOutfitMarkup) && /classified-outfit/.test(classifiedOutfitMarkup), "Story Builder outfit editor preserves the authored identity and name", {
      classifiedOutfitMarkup
    });
    const obsoleteBuilderFixture = () => validatedStoryTemplateRecord({
      id: "story-builder-smoke-template",
      title: "Builder Smoke Original",
      description: "Original builder description.",
      source: "manual",
      creation_tool: "rev18 smoke",
      genres: ["fantasy"],
      // SANITIZE KEEP (dev fixture): synthetic story template record state setup.
      // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
      state: repairAiGeneratedState({
        ...clone(defaultState),
        meta: {
          ...clone(defaultState.meta || {}),
          setup_complete: true,
          genres: ["fantasy"],
          story_source: {
            mode: "original",
            title: "Builder Smoke Original"
          },
          story_guidance: "Keep the starting objective clear."
        },
        player: {
          ...devSmokeRuntimeCharacter("Builder Tester", {
            gender: "non-male",
            role: "tester"
          }),
          name: "Builder Tester",
          age: 25,
          gender: "non-male",
          role: "tester"
        },
        location: {
          ...clone(defaultState.location || {}),
          npc_location_id: "builder-workshop",
          specific_place: "Builder Workshop"
        },
        npc_directory: {
          locations: {
            "builder-workshop": {
              label: "Builder Workshop",
              characters: {}
            }
          }
        },
        objectives: {
          active_id: "first-objective",
          items: [{
            id: "first-objective",
            title: "First Objective",
            type: "story",
            status: "active",
            summary: "First summary.",
            while_active_guidance: "Keep the fake builder scene focused on the first objective.",
            completion_control: "player",
            completion_criteria: "Do the first thing.",
            completion_instruction: "Show the result of doing the first thing.",
            notes: [],
            rewards: [{
              type: "generate_story_image",
              id: "builder-smoke-story-image",
              title: "Builder Smoke Story Image",
              prompt: "A glowing workshop gate at dawn"
            }, {
              type: "generate_story_image",
              id: "builder-hosted-story-image",
              title: "Builder Hosted Story Image",
              image: {
                url: devSmokePublicImageUrl("story-builder-reward", "hosted-story-image")
              }
            }, {
              type: "add_story_item",
              item: {
                id: "builder-hosted-item",
                name: "Builder Hosted Item",
                image: {
                  url: devSmokePublicImageUrl("story-builder-item", "hosted-item")
                }
              }
            }, {
              type: "add_story_rule",
              rule_id: "builder-smoke-rule",
              text: "Builder smoke rule"
            }],
            next_objectives: [{
              id: "first-objective-output-1",
              objective_id: "second-objective",
              requirements: [],
              target_input_group_id: "second-objective-input-1"
            }]
          }, {
            id: "second-objective",
            title: "Second Objective",
            type: "story",
            status: "future",
            summary: "Second summary.",
            while_active_guidance: "Keep the fake builder scene focused on the second objective.",
            completion_control: "player",
            completion_criteria: "Do the second thing.",
            completion_instruction: "Show the result of doing the second thing.",
            completion_message: "The builder smoke objective chain is complete.",
            next_objectives: [{
              id: "second-objective-ending",
              completion_instruction: "Show the result of doing the second thing.",
              rewards: [],
              ending_type: "ending",
              ending_message: "The builder smoke objective chain is complete."
            }],
            notes: [],
            rewards: []
          }]
        },
        future_cast: {
          enabled: true,
          items: {
            "mira-builder": {
              id: "mira-builder",
              name: "Mira Builder",
              status: "locked",
              introduce_as: "npc",
              location_hint: "Workshop",
              scene_presence: "nearby",
              greeting: "You found the workshop.",
              note: "Smoke-test future character.",
              on_unlock: {
                image: {
                  id: "mira-builder-unlock",
                  title: "Mira unlock",
                  prompt: "Mira Builder at a workshop",
                  favorite: true
                }
              },
              full_character: devSmokeRuntimeCharacter("Mira Builder", {
                gender: "female",
                role: "future smoke-test character"
              }),
              profile_images: [],
              images: [{
                id: "mira-workshop-gallery",
                title: "Mira Workshop Gallery",
                prompt: "A bright fantasy workshop filled with brass tools"
              }, {
                id: "mira-hosted-gallery",
                title: "Mira Hosted Gallery",
                image: {
                  url: devSmokePublicImageUrl("story-builder-gallery", "mira-hosted-gallery")
                }
              }]
            }
          }
        }
      })
    });
    const template = devSmokeStoryRecord({
      id: "story-builder-smoke-template",
      title: "Builder Smoke Original",
      description: "Original builder description.",
      source: "manual",
      player: devSmokeRuntimeCharacter("Builder Tester", {
        gender: "non-male",
        role: "tester"
      }),
      npc_directory: {
        locations: {
          "builder-workshop": {
            label: "Builder Workshop",
            characters: {}
          }
        }
      },
      npc_location_id: "builder-workshop",
      location: {
        specific_place: "Builder Workshop",
        npc_location_id: "builder-workshop"
      },
      objectives: [devSmokeObjective("first-objective", "First Objective", {
        status: "active",
        summary: "First summary.",
        completion_control: "player",
        completion_criteria: "Do the first thing.",
        completion_instruction: "Show the result of doing the first thing.",
        rewards: [{
          type: "generate_story_image",
          id: "builder-smoke-story-image",
          title: "Builder Smoke Story Image",
          prompt: "A glowing workshop gate at dawn",
          negative_prompt: "text, watermark"
        }, {
          type: "generate_story_image",
          id: "builder-hosted-story-image",
          title: "Builder Hosted Story Image",
          prompt: "A hosted glowing workshop gate at dawn",
          negative_prompt: "text, watermark",
          image: {
            id: "builder-hosted-story-image-slot",
            title: "Builder Hosted Story Image",
            prompt: "A hosted glowing workshop gate at dawn",
            negative_prompt: "text, watermark",
            seed: 0,
            model: selectedImageModel(app.settings?.imageModel),
            source: "hosted",
            url: devSmokePublicImageUrl("story-builder-reward", "hosted-story-image"),
            favorite: false
          }
        }, {
          type: "add_story_rule",
          rule_id: "builder-smoke-rule",
          text: "Builder smoke rule"
        }],
        next_objectives: ["second-objective"]
      }), devSmokeObjective("second-objective", "Second Objective", {
        status: "hidden",
        summary: "Second summary.",
        completion_control: "player",
        completion_criteria: "Do the second thing.",
        completion_instruction: "Show the result of doing the second thing.",
        ending_type: "ending",
        ending_message: "The builder smoke objective chain is complete."
      })],
      active_id: "first-objective",
      future_cast: {
        enabled: true,
        items: {
          "mira-builder": {
            id: "mira-builder",
            name: "Mira Builder",
            status: "locked",
            canonical_order: 1,
            introduce_as: "npc",
            can_die: true,
            npc_location_id: "builder-workshop",
            location_hint: "Workshop",
            scene_presence: "nearby",
            role: "future smoke-test character",
            relationship: "future acquaintance",
            note: "Smoke-test future character.",
            personality_description: "A precise and practical fake builder character.",
            greeting: "You found the workshop.",
            full_character: devSmokeEmbeddedCharacterDefinition("Mira Builder", {
              gender: "female",
              role: "future smoke-test character"
            }),
            meet_condition: "The builder objective introduces Mira.",
            join_condition: "Mira joins when the builder objective says so.",
            on_unlock: {
              greeting: "You found the workshop.",
              image: {
                id: "mira-builder-unlock",
                title: "Mira unlock",
                prompt: "Mira Builder at a workshop",
                negative_prompt: "text, watermark",
                seed: 0,
                model: selectedImageModel(app.settings?.imageModel),
                source: "generated",
                url: "",
                favorite: true
              }
            },
            unlocked_by: "",
            last_triggered_reason: "",
            on_purchase_objective: "",
            fallback_name: "Mira Builder Alternate",
            outfits: [],
            fallback_outfits: [],
            starting_outfit_id: "",
            fallback_starting_outfit_id: ""
          }
        }
      }
    });
    devUpsertStoryTemplatesForSmoke([template]);
    app.messages = [{
      id: nextEntryId(),
      role: "assistant",
      speaker: "Narrator",
      text: "Story builder edit smoke test ready.",
      at: new Date().toISOString()
    }];
    scheduleActiveGameSave();
    render();
    openStoryBuilder(template.id);
    setStoryBuilderPanel("tree");
    await new Promise(resolve => setTimeout(resolve, 150));
    devAssert(!!app.storyBuilder && !$("storyBuilderOverlay")?.classList.contains("hidden"), "story builder opens for template", app.storyBuilder);
    const headerTitle = $("storyBuilderHeaderTitle");
    devAssert(headerTitle?.tagName === "INPUT" && headerTitle.value === "Builder Smoke Original", "story builder header title is directly editable", {
      tagName: headerTitle?.tagName || "",
      value: headerTitle?.value || ""
    });
    devAssert(storyLibraryVisibleTemplates().find(record => record.id === template.id)?.title === "Builder Smoke Original", "story builder smoke primes the story library projection before renaming", app.storyLibraryVisibleTemplatesCache);
    headerTitle.value = "Builder Smoke Header Edited";
    headerTitle.dispatchEvent(new Event("input", {
      bubbles: true
    }));
    await saveStoryBuilderDraft(false);
    devAssert(storyTemplateById(template.id)?.title === "Builder Smoke Header Edited", "editing the story builder header title persists through the normal save path", storyTemplateById(template.id));
    devAssert(storyLibraryVisibleTemplates().find(record => record.id === template.id)?.title === "Builder Smoke Header Edited", "saving a renamed story invalidates stale story library projected metadata", app.storyLibraryVisibleTemplatesCache);
    devAssert(!!document.querySelector(".story-builder-tree-layout") && !!document.querySelector('[data-tree-node-id="first-objective"]') && !!document.querySelector('[data-tree-node-id="second-objective"]') && !!document.querySelector(".story-builder-link-layer"), "story builder opens on the visual tree and renders objective nodes", $("storyBuilderOverlay")?.textContent || "");
    const storyBuilderBody = document.querySelector(".story-builder-body");
    const storyBuilderSidebar = storyBuilderBody?.querySelector(":scope > .story-builder-sidebar");
    const storyBuilderTreeMain = storyBuilderBody?.querySelector(":scope > .story-builder-main.tree");
    const storyBuilderTreeCenter = storyBuilderTreeMain?.querySelector(":scope > .story-builder-tree-center");
    const storyBuilderDetails = storyBuilderTreeMain?.querySelector(":scope > .story-builder-details");
    const storyBuilderDetailsBody = storyBuilderDetails?.querySelector(":scope > .story-builder-panel-body");
    devAssert(!!storyBuilderSidebar && !!storyBuilderTreeCenter && !!storyBuilderDetails && !!storyBuilderDetailsBody && storyBuilderSidebar.querySelector(":scope > .story-builder-panel-head") && storyBuilderSidebar.querySelector(":scope > .story-builder-panel-body") && storyBuilderDetails.querySelector(":scope > .story-builder-panel-head") && getComputedStyle(storyBuilderDetailsBody).overflowY === "auto" && getComputedStyle(storyBuilderDetails.querySelector(".story-builder-inspector-stack")).overflowY === "visible" && document.body.classList.contains("story-builder-open") && !$("app")?.classList.contains("mobile-left-drawer-open") && !$("app")?.classList.contains("mobile-right-drawer-open"), "story builder uses isolated prototype-style menu, graph, and details columns with one details scroll owner", {
      sidebar: !!storyBuilderSidebar,
      center: !!storyBuilderTreeCenter,
      details: !!storyBuilderDetails,
      detailsOverflow: storyBuilderDetailsBody && getComputedStyle(storyBuilderDetailsBody).overflowY,
      inspectorOverflow: storyBuilderDetails && getComputedStyle(storyBuilderDetails.querySelector(".story-builder-inspector-stack")).overflowY
    });
    const firstGraphNode = document.querySelector('[data-tree-node-id="first-objective"]');
    const firstGraphNodeStyle = getComputedStyle(firstGraphNode);
    const firstGraphActions = firstGraphNode.querySelectorAll(".story-builder-node-action");
    devAssert(firstGraphNode?.getAttribute("role") === "button", "objective graph node is selectable", {
      role: firstGraphNode?.getAttribute("role") || ""
    });
    devAssert(firstGraphNode.querySelector(".story-builder-node-index")?.textContent === "1" && firstGraphActions.length === 2 && !!firstGraphNode.querySelector(".story-builder-node-start-icon") && !!document.querySelector(".story-builder-node-primary-actions"), "objective graph shows node numbering, starting-node status, and focused actions", {
      index: firstGraphNode.querySelector(".story-builder-node-index")?.textContent || "",
      focusedActions: firstGraphActions.length,
      hasStartingNodeIcon: !!firstGraphNode.querySelector(".story-builder-node-start-icon"),
      hasPrimaryActions: !!document.querySelector(".story-builder-node-primary-actions")
    });
    devAssert(firstGraphNode.classList.contains("selected") && firstGraphNodeStyle.outlineStyle !== "none" && Number.parseFloat(firstGraphNodeStyle.outlineWidth) > 0, "selected objective graph node is visibly marked", {
      selected: firstGraphNode.classList.contains("selected"),
      outlineStyle: firstGraphNodeStyle.outlineStyle,
      outlineWidth: firstGraphNodeStyle.outlineWidth
    });
    devAssert(!document.querySelector("[data-story-builder-link-label]"), "single-output objective connections omit redundant labels");
    const firstGraphObjective = storyBuilderObjectiveById("first-objective", app.storyBuilder.draft);
    const originalFirstGraphOutputs = clone(firstGraphObjective.next_objectives);
    const rectsIntersect = (first, second) => first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
    const graphOutputs = count => Array.from({
      length: count
    }, (_, index) => index === 0 ? {
      ...clone(originalFirstGraphOutputs[0]),
      id: "first-objective-path-1",
      title: "Continue to the second objective"
    } : {
      id: `first-objective-path-${index + 1}`,
      title: index === count - 1 && count === 5 ? "A deliberately long branch label that must be constrained without losing its full tooltip" : `Terminal branch ${index + 1}`,
      requirements: [],
      rewards: [],
      ending_type: "freeplay",
      ending_message: `Terminal branch ${index + 1}.`
    });
    for (const outputCount of [2, 3, 4, 5]) {
      firstGraphObjective.next_objectives = graphOutputs(outputCount);
      renderStoryBuilder();
      const labels = [...document.querySelectorAll('[data-story-builder-link-label][data-link-source-id="first-objective"]')];
      const coordinates = new Set(labels.map(label => `${label.dataset.graphLabelX}:${label.dataset.graphLabelY}`));
      const nodeRects = [...document.querySelectorAll("[data-tree-node-id]")].map(node => node.getBoundingClientRect());
      const controlRects = [...document.querySelectorAll(".story-builder-node-actions button")].map(control => control.getBoundingClientRect());
      const labelRects = labels.map(label => label.getBoundingClientRect());
      devAssert(labels.length === outputCount && coordinates.size === outputCount && labelRects.every(labelRect => !nodeRects.some(nodeRect => rectsIntersect(labelRect, nodeRect)) && !controlRects.some(controlRect => rectsIntersect(labelRect, controlRect))) && labelRects.every((labelRect, index) => !labelRects.slice(index + 1).some(otherRect => rectsIntersect(labelRect, otherRect))), `${outputCount}-output branch labels are distinct and collision-free`, {
        labelCount: labels.length,
        coordinateCount: coordinates.size
      });
      if (outputCount === 5) {
        const fullLongLabel = graphOutputs(5)[4].title;
        const constrainedLongLabel = storyBuilderGraphLabelText(fullLongLabel);
        devAssert(constrainedLongLabel.endsWith("...") && constrainedLongLabel.length <= 44 && constrainedLongLabel.length < fullLongLabel.length && storyBuilderGraphLabelWidth(constrainedLongLabel) <= 330, "long graph labels are deterministically constrained");
      }
    }
    firstGraphObjective.next_objectives = graphOutputs(3);
    renderStoryBuilder();
    const centerBranch = document.querySelector('[data-story-builder-link-label][data-link-source-id="first-objective"][data-link-output-index="1"]');
    const centerSourceNode = document.querySelector('[data-tree-node-id="first-objective"]');
    devAssert(!!centerBranch && !!centerSourceNode && centerBranch.getBoundingClientRect().left >= centerSourceNode.getBoundingClientRect().right, "odd middle branch label sits to the right of its vertical route", {
      labelLeft: centerBranch?.getBoundingClientRect().left,
      sourceRight: centerSourceNode?.getBoundingClientRect().right
    });
    const branchLabels = [...document.querySelectorAll('[data-story-builder-link-label][data-link-source-id="first-objective"]')];
    const stableLabels = branchLabels.map(label => ({
      node: label,
      x: label.dataset.graphLabelX,
      y: label.dataset.graphLabelY
    }));
    const graphLabelCanvas = $("storyBuilderTreeCanvas");
    const treeViewport = storyBuilderTreeEditorData(app.storyBuilder.draft).viewport;
    const transformBeforePan = graphLabelCanvas?.style.transform || "";
    storyBuilderSetTreeViewport((Number(treeViewport.x) || 0) + 31, (Number(treeViewport.y) || 0) + 19, Number(treeViewport.zoom) || 1);
    const transformAfterPan = graphLabelCanvas?.style.transform || "";
    for (const factor of [1.05, 0.95, 1.1]) storyBuilderZoomTreeAtViewportPoint((Number(treeViewport.zoom) || 1) * factor, 300, 240);
    const labelsAfterViewportChanges = [...document.querySelectorAll('[data-story-builder-link-label][data-link-source-id="first-objective"]')];
    devAssert(labelsAfterViewportChanges.every((label, index) => label === stableLabels[index].node && label.dataset.graphLabelX === stableLabels[index].x && label.dataset.graphLabelY === stableLabels[index].y) && graphLabelCanvas === $("storyBuilderTreeCanvas") && transformBeforePan !== transformAfterPan && transformAfterPan !== graphLabelCanvas?.style.transform, "pan and zoom transform the existing graph without rebuilding labels");
    const originalLayoutCache = app.storyBuilder.graphLayoutCache;
    const originalLayoutRequest = app.storyBuilder.graphLayoutRequest;
    const originalGraphStatus = app.storyBuilder.status;
    const newestLayout = {
      marker: "newest-layout"
    };
    app.storyBuilder.graphLayoutCache = {
      signature: "existing-layout",
      layout: {
        marker: "existing-layout"
      }
    };
    app.storyBuilder.graphLayoutRequest = {
      requestId: 52,
      signature: "new-layout"
    };
    const staleCommitted = storyBuilderCommitGraphLayout(app.storyBuilder, 51, "old-layout", {
      marker: "stale-layout"
    });
    const newestCommitted = storyBuilderCommitGraphLayout(app.storyBuilder, 52, "new-layout", newestLayout, 12);
    devAssert(!staleCommitted && newestCommitted && app.storyBuilder.graphLayoutCache?.layout === newestLayout, "out-of-order graph workers cannot replace the newest layout");
    app.storyBuilder.graphLayoutCache = originalLayoutCache;
    app.storyBuilder.graphLayoutRequest = originalLayoutRequest;
    app.storyBuilder.status = originalGraphStatus;
    firstGraphObjective.next_objectives = originalFirstGraphOutputs;
    renderStoryBuilder();
    const retiredGraphControls = $("storyBuilderOverlay")?.querySelector('button[title="Zoom in"], button[title="Zoom out"], button[title="Undo"], button[title="Redo"]');
    devAssert(!$("storyBuilderAddMainObjectiveBtn") && !$("storyBuilderAddSideObjectiveBtn") && !retiredGraphControls, "objective graph omits manual placement, zoom, undo, and redo controls", {
      hasAddMainObjectiveButton: !!$("storyBuilderAddMainObjectiveBtn"),
      hasAddSideObjectiveButton: !!$("storyBuilderAddSideObjectiveBtn"),
      retiredGraphControlTitle: retiredGraphControls?.getAttribute("title") || ""
    });
    const firstGraphTitle = firstGraphNode.querySelector(".story-builder-node-dot-label");
    const originalGraphTitle = firstGraphTitle.textContent;
    fitStoryBuilderGraphNodeTitle(firstGraphTitle);
    const originalGraphTitleSize = Number(firstGraphTitle.dataset.storyBuilderBaseFontSize) || 14;
    firstGraphTitle.textContent = "A deliberately extremely long objective title that must shrink until every word remains inside the fixed objective card";
    fitStoryBuilderGraphNodeTitle(firstGraphTitle);
    const fittedGraphTitleSize = Number.parseFloat(firstGraphTitle.style.fontSize) || originalGraphTitleSize;
    const graphTitleHasLayout = firstGraphTitle.scrollWidth > 0 && firstGraphTitle.scrollHeight > 0;
    devAssert(Number.isFinite(originalGraphTitleSize) && Number.isFinite(fittedGraphTitleSize) && fittedGraphTitleSize <= originalGraphTitleSize && (!graphTitleHasLayout || fittedGraphTitleSize < originalGraphTitleSize && firstGraphTitle.scrollWidth <= Number.parseFloat(firstGraphTitle.style.width) + 0.5 && firstGraphTitle.scrollHeight <= Number.parseFloat(firstGraphTitle.style.maxHeight) + 0.5), "long objective titles shrink until they fit inside the fixed graph card", {
      originalGraphTitleSize,
      fittedGraphTitleSize,
      graphTitleHasLayout,
      scrollWidth: firstGraphTitle.scrollWidth,
      width: firstGraphTitle.style.width,
      scrollHeight: firstGraphTitle.scrollHeight,
      maxHeight: firstGraphTitle.style.maxHeight
    });
    firstGraphTitle.textContent = originalGraphTitle;
    fitStoryBuilderGraphNodeTitle(firstGraphTitle);
    const secondGraphNode = document.querySelector('[data-tree-node-id="second-objective"]');
    secondGraphNode.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: 40,
      clientY: 40,
      isPrimary: true,
      pointerId: 109
    }));
    devAssert(!app.storyBuilder.treePan, "pressing an objective card does not start background graph panning", app.storyBuilder.treePan);
    secondGraphNode.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      button: 0,
      isPrimary: true,
      pointerId: 109
    }));
    secondGraphNode.click();
    await new Promise(resolve => setTimeout(resolve, 20));
    devAssert(app.storyBuilder.selectedObjectiveId === "second-objective" && !!document.querySelector('[data-tree-node-id="second-objective"].selected'), "clicking an objective card selects it in the graph and opens its inspector", {
      selectedObjectiveId: app.storyBuilder.selectedObjectiveId
    });
    document.querySelector('[data-tree-node-id="first-objective"]')?.click();
    await new Promise(resolve => setTimeout(resolve, 20));
    devAssert(storyBuilderSetStartingObjective("second-objective") === true && app.storyBuilder.draft.state.objectives.active_id === "second-objective" && storyBuilderObjectiveById("second-objective", app.storyBuilder.draft)?.status === "active" && storyBuilderObjectiveById("first-objective", app.storyBuilder.draft)?.status === "hidden" && !!document.querySelector('[data-tree-node-id="second-objective"] .story-builder-node-start-icon'), "the starting node can be reassigned and derives every authored initial status", app.storyBuilder.draft.state.objectives);
    storyBuilderSetStartingObjective("first-objective");
    await new Promise(resolve => setTimeout(resolve, 20));
    const addedNextObjectiveId = await storyBuilderAddNextObjective("main");
    const firstWithAddedNext = storyBuilderObjectiveById("first-objective", app.storyBuilder?.draft);
    devAssert(!!addedNextObjectiveId && objectiveNextOptions(firstWithAddedNext).some(route => String(route.objective_id || "") === String(addedNextObjectiveId)) && String(app.storyBuilder?.selectedObjectiveId || "") === String(addedNextObjectiveId), "Add Next Node creates, selects, and links a contextual objective", {
      addedNextObjectiveId,
      routes: objectiveNextOptions(firstWithAddedNext)
    });
    const noticesBeforeInvalidAutosave = document.querySelectorAll(".popup-modal.open #noticeOkBtn").length;
    const repeatedInvalidSave = await saveStoryBuilderDraft(false, {
      collectVisible: false,
      validationNoticeMode: "transition"
    });
    devAssert(repeatedInvalidSave === false && document.querySelectorAll(".popup-modal.open #noticeOkBtn").length === noticesBeforeInvalidAutosave, "field autosave does not repeat a validation popup while the draft is already invalid");
    app.storyBuilder.validationHadErrors = false;
    const newlyInvalidSave = await saveStoryBuilderDraft(false, {
      collectVisible: false,
      validationNoticeMode: "transition"
    });
    devAssert(newlyInvalidSave === false && document.querySelectorAll(".popup-modal.open #noticeOkBtn").length === noticesBeforeInvalidAutosave + 1, "field autosave shows one validation popup when a previously valid draft becomes invalid");
    document.querySelector(".popup-modal.open #noticeOkBtn")?.click();
    await new Promise(resolve => setTimeout(resolve, 40));
    const addedNextObjectiveIndex = storyBuilderObjectiveList(app.storyBuilder?.draft).findIndex(objective => String(objective.id || "") === String(addedNextObjectiveId));
    storyBuilderObjectiveList(app.storyBuilder?.draft).splice(addedNextObjectiveIndex, 1);
    firstWithAddedNext.next_objectives = objectiveNextOptions(firstWithAddedNext).filter(route => String(route.objective_id || "") !== String(addedNextObjectiveId));
    app.storyBuilder.selectedObjectiveId = "first-objective";
    app.storyBuilder.mobileInspectorOpen = false;
    app.storyBuilder.dirty = true;
    const guidedObjectiveSaved = await saveStoryBuilderDraft(false, {
      collectVisible: false
    });
    renderStoryBuilder();
    devAssert(storyBuilderStartLinkObjective() === true && app.storyBuilder.pendingGraphLinkSourceId === "first-objective" && !!document.querySelector('[data-tree-node-id="second-objective"].link-target'), "Link Node enters a focused tap-to-link mode with valid destination cards", {
      pendingGraphLinkSourceId: app.storyBuilder.pendingGraphLinkSourceId
    });
    await storyBuilderSelectObjective("second-objective");
    devAssert(!app.storyBuilder.pendingGraphLinkSourceId && objectiveNextOptions(storyBuilderObjectiveById("first-objective", app.storyBuilder?.draft)).some(route => route.objective_id === "second-objective"), "selecting a destination completes Link Node without duplicating graph mechanics", storyBuilderObjectiveById("first-objective", app.storyBuilder?.draft)?.next_objectives);
    await storyBuilderSelectObjective("first-objective");
    const largeGraphDraft = {
      state: {
        objectives: {
          items: Array.from({
            length: 1200
          }, (_, index) => ({
            id: `large-${index}`,
            title: `Large ${index}`,
            type: "story",
            status: index ? "future" : "active",
            requires: index ? [`large-${index - 1}`] : [],
            next_objectives: index < 1199 ? [{
              objective_id: `large-${index + 1}`,
              requirements: []
            }, ...(index === 0 ? [{
              objective_id: "large-100",
              requirements: []
            }] : [])] : [{
              objective_id: "large-0",
              requirements: []
            }]
          }))
        }
      }
    };
    const largeGraphStarted = performance.now();
    const largeGraphLayout = buildStoryBuilderObjectiveGraphLayout(largeGraphDraft);
    const largeGraphElapsed = performance.now() - largeGraphStarted;
    devAssert(largeGraphLayout.displayNodes.length === 1201 && largeGraphLayout.displayEdges.some(edge => edge.cycle) && largeGraphLayout.routeChannelCount > 0 && largeGraphLayout.displayEdges.some(edge => {
      const source = largeGraphLayout.nodesByDisplayId.get(edge.sourceId);
      const target = largeGraphLayout.nodesByDisplayId.get(edge.targetId);
      return Number.isFinite(Number(edge.routeX)) && storyBuilderLinkPath(source, target, edge).includes(`L ${Number(edge.routeX)}`);
    }) && largeGraphLayout.occupancy.every(row => row instanceof Int32Array) && largeGraphElapsed < 2000, "automatic graph layout handles large cyclic graphs with typed occupancy and bounded work", {
      elapsedMs: largeGraphElapsed,
      nodes: largeGraphLayout.displayNodes.length,
      edges: largeGraphLayout.displayEdges.length,
      routeChannels: largeGraphLayout.routeChannelCount
    });
    const largeWorkerObjectives = largeGraphDraft.state.objectives.items.map(objective => ({
      id: objective.id,
      title: objective.title,
      type: objective.type,
      status: objective.status,
      completion_control: objective.completion_control
    }));
    const largeWorkerEdges = storyBuilderRawGraphEdges(largeGraphDraft.state.objectives.items);
    const largeWorkerSignature = storyBuilderLargeGraphSignature(largeWorkerObjectives, largeWorkerEdges);
    const largeWorkerLayout = await storyBuilderRequestLargeGraphLayout(largeWorkerObjectives, largeWorkerEdges, `${largeWorkerSignature}:smoke`);
    devAssert(largeWorkerLayout.displayNodes.length === 1201 && largeWorkerLayout.displayEdges.some(edge => edge.cycle) && largeWorkerLayout.routeChannelCount > 0, "production large-graph layout runs in the dedicated worker and returns the complete routed graph", {
      nodes: largeWorkerLayout.displayNodes.length,
      edges: largeWorkerLayout.displayEdges.length,
      routeChannels: largeWorkerLayout.routeChannelCount
    });
    const graphViewport = $("storyBuilderGraphViewport");
    const graphCanvas = $("storyBuilderTreeCanvas");
    const graphOverflow = getComputedStyle(graphViewport);
    devAssert(graphOverflow.overflowX === "hidden" && graphOverflow.overflowY === "hidden", "objective graph viewport never exposes scrollbars", {
      overflowX: graphOverflow.overflowX,
      overflowY: graphOverflow.overflowY,
      scrollWidth: graphViewport?.scrollWidth || 0,
      clientWidth: graphViewport?.clientWidth || 0
    });
    storyBuilderToggleInspectorFocus();
    devAssert(app.storyBuilder.inspectorFocus === true && getComputedStyle(document.querySelector(".story-builder-tree-center")).display === "none" && getComputedStyle(document.querySelector(".story-builder-details")).display !== "none", "objective inspector can expand to a full-width focused editing mode");
    storyBuilderToggleInspectorFocus();
    const graphRect = graphViewport.getBoundingClientRect();
    const wheelPointX = Math.round(graphViewport.clientWidth * 0.42);
    const wheelPointY = Math.round(graphViewport.clientHeight * 0.38);
    const treeBeforeWheel = storyBuilderTreeEditorData(app.storyBuilder.draft);
    const zoomBeforeWheel = Number(treeBeforeWheel.viewport.zoom);
    const wheelEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: graphRect.left + wheelPointX,
      clientY: graphRect.top + wheelPointY,
      deltaY: -120,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      ctrlKey: false,
      metaKey: false
    });
    const eventPointX = wheelEvent.clientX - graphRect.left;
    const eventPointY = wheelEvent.clientY - graphRect.top;
    const graphPointBeforeWheel = {
      x: (eventPointX - Number(treeBeforeWheel.viewport.x || 0)) / zoomBeforeWheel,
      y: (eventPointY - Number(treeBeforeWheel.viewport.y || 0)) / zoomBeforeWheel
    };
    graphViewport.dispatchEvent(wheelEvent);
    const treeAfterWheel = storyBuilderTreeEditorData(app.storyBuilder.draft);
    const zoomAfterWheel = Number(treeAfterWheel.viewport.zoom);
    const graphPointAfterWheel = {
      x: (eventPointX - Number(treeAfterWheel.viewport.x || 0)) / zoomAfterWheel,
      y: (eventPointY - Number(treeAfterWheel.viewport.y || 0)) / zoomAfterWheel
    };
    devTestLog("objective graph wheel diagnostics", {
      defaultPrevented: wheelEvent.defaultPrevented,
      zoomBeforeWheel,
      zoomAfterWheel,
      graphPointBeforeWheel,
      graphPointAfterWheel,
      sameCanvas: $("storyBuilderTreeCanvas") === graphCanvas
    });
    devAssert(wheelEvent.defaultPrevented && zoomAfterWheel > zoomBeforeWheel && Math.abs(graphPointAfterWheel.x - graphPointBeforeWheel.x) < 0.01 && Math.abs(graphPointAfterWheel.y - graphPointBeforeWheel.y) < 0.01 && $("storyBuilderTreeCanvas") === graphCanvas, "hovered objective graph zooms around the pointer without Ctrl or rerendering", {
      defaultPrevented: wheelEvent.defaultPrevented,
      zoomBeforeWheel,
      zoomAfterWheel,
      graphPointBeforeWheel,
      graphPointAfterWheel,
      sameCanvas: $("storyBuilderTreeCanvas") === graphCanvas
    });
    storyBuilderSetTreeViewport(37, 29, 1.59);
    const highZoomTreeBefore = storyBuilderTreeEditorData(app.storyBuilder.draft);
    const highZoomGraphPointBefore = {
      x: (eventPointX - Number(highZoomTreeBefore.viewport.x || 0)) / Number(highZoomTreeBefore.viewport.zoom),
      y: (eventPointY - Number(highZoomTreeBefore.viewport.y || 0)) / Number(highZoomTreeBefore.viewport.zoom)
    };
    graphViewport.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: wheelEvent.clientX,
      clientY: wheelEvent.clientY,
      deltaY: -60,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL
    }));
    const highZoomTreeAfter = storyBuilderTreeEditorData(app.storyBuilder.draft);
    const repeatedHighZoomTree = storyBuilderTreeEditorData(app.storyBuilder.draft);
    const highZoomGraphPointAfter = {
      x: (eventPointX - Number(highZoomTreeAfter.viewport.x || 0)) / Number(highZoomTreeAfter.viewport.zoom),
      y: (eventPointY - Number(highZoomTreeAfter.viewport.y || 0)) / Number(highZoomTreeAfter.viewport.zoom)
    };
    devAssert(Number(highZoomTreeAfter.viewport.zoom) > 1.6 && highZoomTreeAfter === repeatedHighZoomTree && Math.abs(highZoomGraphPointAfter.x - highZoomGraphPointBefore.x) < 0.01 && Math.abs(highZoomGraphPointAfter.y - highZoomGraphPointBefore.y) < 0.01, "objective graph crosses the former zoom discontinuities without resetting or moving the pointer anchor", {
      zoom: highZoomTreeAfter.viewport.zoom,
      sameTree: highZoomTreeAfter === repeatedHighZoomTree,
      graphPointBefore: highZoomGraphPointBefore,
      graphPointAfter: highZoomGraphPointAfter
    });
    const panBefore = {
      x: Number(treeAfterWheel.viewport.x || 0),
      y: Number(treeAfterWheel.viewport.y || 0)
    };
    graphViewport.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      pointerId: 91,
      isPrimary: true,
      button: 0,
      buttons: 1,
      clientX: graphRect.left + 90,
      clientY: graphRect.top + 90
    }));
    graphViewport.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true,
      cancelable: true,
      pointerId: 91,
      isPrimary: true,
      button: -1,
      buttons: 1,
      clientX: graphRect.left + 137,
      clientY: graphRect.top + 121
    }));
    graphViewport.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      cancelable: true,
      pointerId: 91,
      isPrimary: true,
      button: 0,
      buttons: 0,
      clientX: graphRect.left + 137,
      clientY: graphRect.top + 121
    }));
    const treeAfterPan = storyBuilderTreeEditorData(app.storyBuilder.draft);
    devAssert(Math.abs(Number(treeAfterPan.viewport.x) - (panBefore.x + 47)) < 0.01 && Math.abs(Number(treeAfterPan.viewport.y) - (panBefore.y + 31)) < 0.01 && !graphViewport.classList.contains("panning") && !app.storyBuilder.treePan, "dragging empty objective graph space pans and releases cleanly", {
      before: panBefore,
      after: treeAfterPan.viewport,
      className: graphViewport.className,
      activePan: app.storyBuilder.treePan || null
    });
    storyBuilderFitTree();
    const treeAfterFit = storyBuilderTreeEditorData(app.storyBuilder.draft);
    const fitWidth = Number(graphCanvas.dataset.graphWidth) * Number(treeAfterFit.viewport.zoom);
    const fitHeight = Number(graphCanvas.dataset.graphHeight) * Number(treeAfterFit.viewport.zoom);
    devAssert(Number(treeAfterFit.viewport.x) >= -0.01 && Number(treeAfterFit.viewport.y) >= -0.01 && Number(treeAfterFit.viewport.x) + fitWidth <= graphViewport.clientWidth + 0.01 && Number(treeAfterFit.viewport.y) + fitHeight <= graphViewport.clientHeight + 0.01 && graphViewport.scrollLeft === 0 && graphViewport.scrollTop === 0, "fit nodes calculates a centered transform without graph scrolling", {
      viewport: treeAfterFit.viewport,
      fitWidth,
      fitHeight,
      clientWidth: graphViewport.clientWidth,
      clientHeight: graphViewport.clientHeight,
      scrollLeft: graphViewport.scrollLeft,
      scrollTop: graphViewport.scrollTop
    });
    const fitZoomBounds = storyBuilderTreeZoomBounds(graphViewport, graphCanvas);
    storyBuilderZoomTreeAtViewportPoint(fitZoomBounds.minimum / 10, graphViewport.clientWidth / 2, graphViewport.clientHeight / 2);
    devAssert(Math.abs(Number(storyBuilderTreeEditorData(app.storyBuilder.draft).viewport.zoom) - fitZoomBounds.minimum) < 0.0001, "objective graph cannot zoom out beyond the fitted whole-graph view", {
      zoom: storyBuilderTreeEditorData(app.storyBuilder.draft).viewport.zoom,
      minimum: fitZoomBounds.minimum
    });
    storyBuilderSelectObjective("first-objective");
    await new Promise(resolve => setTimeout(resolve, 50));
    document.querySelector('[data-tree-objective-field="title"]').value = "First Objective Edited From Tree";
    document.querySelector('[data-tree-objective-field="summary"]').value = "Tree inspector summary persists.";
    const guidedOutput = document.querySelector('[data-story-output-block="0"]');
    const structuredNextObjective = storyBuilderObjectiveOutputRows(app.storyBuilder.draft.state.objectives.items[0])[0];
    devAssert(structuredNextObjective?.objective_id === "second-objective" && /Second Objective/.test(guidedOutput?.textContent || "") && !$("storyBuilderOverlay")?.textContent?.includes("Next routes JSON") && !document.querySelector("[data-tree-json-field]"), "objective routes use structured controls without raw JSON fields", {
      nextObjective: structuredNextObjective?.objective_id || "",
      text: $("storyBuilderOverlay")?.textContent || ""
    });
    openStoryBuilderRewardEditor(0, 1);
    const rewardTypeField = document.querySelector("[data-story-reward-type]");
    devAssert(!!rewardTypeField, "guided reward editor opens from an objective output");
    rewardTypeField.value = "advance_time";
    rewardTypeField.dispatchEvent(new Event("change", {
      bubbles: true
    }));
    await new Promise(resolve => setTimeout(resolve, 100));
    const guidedRewardEditor = document.querySelector("[data-story-reward-editor]");
    devAssert(!!guidedRewardEditor?.querySelector('[data-story-reward-field="minutes"]') && !guidedRewardEditor?.querySelector('[data-story-reward-field="character_id"]') && app.storyBuilder.rewardEditor?.draft?.type === "advance_time", "changing a reward type replaces its form with contextual fields", app.storyBuilder.rewardEditor?.draft);
    const contextualRewardType = document.querySelector("[data-story-reward-type]");
    contextualRewardType.value = "remove_character_shop_listing";
    contextualRewardType.dispatchEvent(new Event("change", {
      bubbles: true
    }));
    await new Promise(resolve => setTimeout(resolve, 100));
    devAssert(!!document.querySelector('[data-story-reward-field="shop_id"]') && !!document.querySelector('[data-story-reward-field="character_id"]'), "guided reward editor exposes named shop and character-listing selectors for removal rewards");
    closeStoryBuilderRewardEditor();
    await saveStoryBuilderDraft(false);
    const savedTreeEdit = storyTemplateById(template.id);
    devAssert(savedTreeEdit?.state?.objectives?.items?.[0]?.title === "First Objective Edited From Tree" && savedTreeEdit?.state?.objectives?.items?.[0]?.summary === "Tree inspector summary persists." && savedTreeEdit?.state?.objectives?.items?.[0]?.next_objectives?.[0]?.objective_id === "second-objective" && !!document.querySelector(".story-builder-graph-node.auto-node") && Number($("storyBuilderTreeCanvas")?.dataset.graphWidth || 0) > 0 && Number($("storyBuilderTreeCanvas")?.dataset.graphHeight || 0) > 0, "visual tree inspector saves focused fields and automatic layout renders", savedTreeEdit?.state?.objectives?.items?.[0]);
    await storyBuilderConnectTreePorts({
      objectiveId: "first-objective",
      port: "output"
    }, {
      objectiveId: "second-objective",
      port: "input"
    });
    const savedTreeConnect = storyTemplateById(template.id);
    devAssert(savedTreeConnect?.state?.objectives?.items?.[0]?.next_objectives?.some(item => item.objective_id === "second-objective"), "visual tree output-to-input connection writes next_objectives", savedTreeConnect?.state?.objectives?.items?.[0]?.next_objectives);
    devAssert(savedTreeConnect?.state?.objectives?.items?.[1]?.available_now !== true, "tree inspector does not make a prerequisite-locked objective available", savedTreeConnect?.state?.objectives?.items?.[1]);
    const choiceObjectiveSaved = await storyBuilderAddChoiceObjective();
    devAssert(choiceObjectiveSaved === true, "visual tree creates a guided direct choice objective without prematurely saving it", {
      status: app.storyBuilder?.status || "",
      failedBuilderChecks: storyBuilderValidationChecks(app.storyBuilder?.draft || {}).filter(check => !check.ok),
      validationErrors: validateStoryDefinition(app.storyBuilder?.draft || {}).errors
    });
    const choiceObjective = app.storyBuilder.draft.state.objectives.items.find(item => item.completion_control === "choice");
    devAssert(Array.isArray(choiceObjective?.choices) && choiceObjective.choices.length === 2 && storyBuilderValidationChecks(app.storyBuilder.draft).some(check => !check.ok && check.objectiveId === choiceObjective.id), "new choice objectives own their options and remain visibly invalid until their outputs are finished", choiceObjective);
    app.storyBuilder.draft.state.objectives.items = app.storyBuilder.draft.state.objectives.items.filter(item => item !== choiceObjective);
    app.storyBuilder.dirty = false;
    storyBuilderSelectObjective("first-objective");
    setStoryBuilderPanel("overview");
    await new Promise(resolve => setTimeout(resolve, 50));
    devAssert(!!$("storyBuilderTitle"), "story builder overview fields render");
    $("storyBuilderTitle").value = "Builder Smoke Edited";
    $("storyBuilderTitle").dispatchEvent(new Event("input", {
      bubbles: true
    }));
    $("storyBuilderDescription").value = "Edited description persists from focused field.";
    $("storyBuilderGuidance").value = "Edited guidance should save without requiring blur.";
    devAssert($("storyBuilderHeaderTitle")?.value === "Builder Smoke Edited", "overview story name stays synchronized with the editable header title", {
      overview: $("storyBuilderTitle")?.value || "",
      header: $("storyBuilderHeaderTitle")?.value || ""
    });
    await saveStoryBuilderDraft(false);
    const savedOverview = storyTemplateById(template.id);
    devAssert(savedOverview?.title === "Builder Smoke Edited" && savedOverview?.description === "Edited description persists from focused field." && savedOverview?.state?.meta?.story_guidance === "Edited guidance should save without requiring blur.", "header save captures focused overview fields", savedOverview);
    setStoryBuilderPanel("overview");
    $("storyBuilderAllowAnyPlayer").checked = true;
    $("storyBuilderAllowAnyPlayer").dispatchEvent(new Event("change", {
      bubbles: true
    }));
    await new Promise(resolve => setTimeout(resolve, 50));
    const anyPlayerRole = devFieldByPath("#storyBuilderAnyPlayerEditor", ["any_player_starting_state", "role"]);
    anyPlayerRole.value = "library hero";
    await saveStoryBuilderDraft(false);
    devAssert(storyTemplateById(template.id)?.allow_any_player === true && storyTemplateById(template.id)?.any_player_starting_state?.role === "library hero" && Array.isArray(storyTemplateById(template.id)?.any_player_starting_state?.male_outfits) && Array.isArray(storyTemplateById(template.id)?.any_player_starting_state?.non_male_outfits), "any-player starting overrides use structured controls and preserve both outfit presentations", storyTemplateById(template.id)?.any_player_starting_state);
    setStoryBuilderPanel("opening");
    await new Promise(resolve => setTimeout(resolve, 50));
    const locationNameField = devFieldByPath("#storyBuilderStructuredEditor", ["location", "specific_place"]);
    devAssert(!!locationNameField && !/JSON authoring required/i.test($("storyBuilderOverlay")?.textContent || ""), "opening, world, scene, and time render as structured controls", $("storyBuilderOverlay")?.textContent || "");
    locationNameField.value = "Builder Workshop";
    await saveStoryBuilderDraft(false);
    devAssert(storyTemplateById(template.id)?.state?.location?.specific_place === "Builder Workshop", "structured opening and world fields persist", storyTemplateById(template.id)?.state?.location);
    app.storyBuilder.draft.state.story_clock = {
      elapsed_minutes: 0,
      label: "Day 1, 12:00 PM"
    };
    setStoryBuilderPanel("systems");
    await new Promise(resolve => setTimeout(resolve, 50));
    const storyClockField = devFieldByPath("#storyBuilderStructuredEditor", ["story_clock", "elapsed_minutes"]);
    storyClockField.value = "45";
    await saveStoryBuilderDraft(false);
    devAssert(storyTemplateById(template.id)?.state?.story_clock?.elapsed_minutes === 45, "story systems persist typed values without raw JSON", storyTemplateById(template.id)?.state?.story_clock);
    const importCandidate = clone(app.storyBuilder.draft);
    mergeStoryBuilderImport({
      world_flags: {
        builder_imported: true
      },
      numeric_precision: {
        story_inventory: {
          builder_number: 2
        },
        character_stats: {}
      },
      character_shop_cost_templates: {
        builder_cost: {
          type: "stat",
          costs: [],
          effects: []
        }
      }
    }, importCandidate);
    devTestLog("story builder canonical import coverage", {
      world_flags: importCandidate.state.world_flags,
      numeric_precision: importCandidate.state.numeric_precision,
      character_shop_cost_templates: importCandidate.state.character_shop_cost_templates,
      aliasKeys: ["story_flags", "story_numeric_precision", "story_cost_templates"].filter(key => key in importCandidate.state)
    });
    devAssert(importCandidate.state.world_flags?.builder_imported === true && importCandidate.state.numeric_precision?.story_inventory?.builder_number === 2 && importCandidate.state.character_shop_cost_templates?.builder_cost?.type === "stat" && !("story_flags" in importCandidate.state) && !("story_numeric_precision" in importCandidate.state) && !("story_cost_templates" in importCandidate.state), "Story Builder imports canonical system keys without creating aliases", importCandidate.state);
    setStoryBuilderPanel("economy");
    app.storyBuilder.draft.state.npc_directory ||= {
      locations: {}
    };
    app.storyBuilder.draft.state.npc_directory.locations["starting-area"] ||= {
      label: "Builder Workshop",
      characters: {}
    };
    app.storyBuilder.draft.state.story_shops = {
      "builder-shop": {
        id: "builder-shop",
        title: "Builder Shop",
        type: "general",
        currency: "coins",
        location: {
          specific_place: "Builder Workshop"
        },
        npc_location_id: app.storyBuilder.draft.state.location?.npc_location_id || "",
        unlocked: true,
        markup: 1,
        items: []
      }
    };
    renderStoryBuilder();
    await new Promise(resolve => setTimeout(resolve, 50));
    const shopTitleField = devFieldByPath("#storyBuilderStructuredEditor", ["story_shops", "builder-shop", "title"]);
    shopTitleField.value = "Builder Market";
    shopTitleField.dispatchEvent(new Event("blur", {
      bubbles: true
    }));
    await new Promise(resolve => setTimeout(resolve, 25));
    await saveStoryBuilderDraft(false);
    devAssert(storyTemplateById(template.id)?.state?.story_shops?.["builder-shop"]?.title === "Builder Market", "shops, jobs, and cost templates use structured controls and persist", storyTemplateById(template.id)?.state?.story_shops);
    setStoryBuilderPanel("cast");
    await new Promise(resolve => setTimeout(resolve, 150));
    devAssert(/Playable Characters/i.test($("storyBuilderOverlay")?.textContent || "") && /Starting Party Members/i.test($("storyBuilderOverlay")?.textContent || "") && /Opening NPCs/i.test($("storyBuilderOverlay")?.textContent || ""), "story builder cast panel separates player options, starting party members, and opening NPCs");
    const playerOptionSaved = await storyBuilderAddPlayerOption();
    const playerOptionStatus = app.storyBuilder?.status || "";
    const startingCharacterSaved = await storyBuilderAddStartingCharacter();
    const startingCharacterStatus = app.storyBuilder?.status || "";
    const openingNpcSaved = await storyBuilderAddOpeningNpc();
    const openingNpcStatus = app.storyBuilder?.status || "";
    devTestLog("story builder cast addition results", {
      playerOptionSaved,
      playerOptionStatus,
      startingCharacterSaved,
      startingCharacterStatus,
      openingNpcSaved,
      openingNpcStatus
    });
    devAssert([playerOptionSaved, startingCharacterSaved, openingNpcSaved].every(saved => saved === true), "story builder cast additions save successfully", {
      playerOptionSaved,
      startingCharacterSaved,
      openingNpcSaved,
      status: app.storyBuilder?.status || ""
    });
    const openingNpcEntry = storyBuilderOpeningNpcEntries(app.storyBuilder.draft.state).find(entry => entry.npc?.name === "New NPC");
    const npcLocationField = document.querySelector(`[data-story-cast-kind="npc"][data-story-cast-key="${CSS.escape(`${openingNpcEntry.locationId}||${openingNpcEntry.key}`)}"][data-story-cast-field="locationId"]`);
    npcLocationField.value = "builder-annex";
    storyBuilderApplyCastField(npcLocationField);
    const npcMoveSaved = await saveStoryBuilderDraft(false, {
      collectVisible: false
    });
    devAssert(npcMoveSaved === true && !!app.storyBuilder.draft.state.npc_directory.locations[openingNpcEntry.locationId] && Object.keys(app.storyBuilder.draft.state.npc_directory.locations[openingNpcEntry.locationId].characters || {}).length === 0 && !!app.storyBuilder.draft.state.npc_directory.locations["builder-annex"]?.characters?.["New NPC"], "moving an opening NPC preserves the now-empty source location definition", app.storyBuilder.draft.state.npc_directory.locations);
    const savedCast = storyTemplateById(template.id)?.state || {};
    devTestLog("story builder cast persistence boundary", {
      players: savedCast.players?.map(player => player.name) || [],
      characters: Object.keys(savedCast.characters || {}),
      npcs: storyBuilderOpeningNpcEntries(savedCast).map(entry => entry.npc?.name),
      draftCharacters: Object.keys(app.storyBuilder?.draft?.state?.characters || {}),
      draftNpcs: storyBuilderOpeningNpcEntries(app.storyBuilder?.draft?.state || {}).map(entry => entry.npc?.name)
    });
    devAssert(Array.isArray(savedCast.players) && savedCast.players.length === 1 && !!savedCast.characters?.["New Ally"] && storyBuilderOpeningNpcEntries(savedCast).some(entry => entry.npc?.name === "New NPC"), "story builder cast panel can add player options, starting party members, and opening NPCs", {
      players: savedCast.players?.map(player => player.name),
      characters: Object.keys(savedCast.characters || {}),
      npcs: storyBuilderOpeningNpcEntries(savedCast).map(entry => entry.npc?.name)
    });
    setStoryBuilderPanel("state");
    await new Promise(resolve => setTimeout(resolve, 150));
    devAssert(!devFieldWithPathPrefix("#storyBuilderStateEditor", ["meta"]) && !devFieldWithPathPrefix("#storyBuilderStateEditor", ["objectives"]) && !devFieldWithPathPrefix("#storyBuilderStateEditor", ["future_cast"]) && !devFieldWithPathPrefix("#storyBuilderStateEditor", ["recent_changes"]) && !devFieldByPath("#storyBuilderStateEditor", ["player", "profile_image_id"]) && !devFieldByPath("#storyBuilderStateEditor", ["player", "profile_images"]), "story builder structured state editor hides metadata and image/profile internals", {
      text: ($("storyBuilderOverlay")?.textContent || "").slice(0, 1000)
    });
    setStoryBuilderPanel("future_cast");
    await new Promise(resolve => setTimeout(resolve, 150));
    const futureName = document.querySelector('[data-future-id="mira-builder"][data-future-field="name"]');
    const futurePrompt = document.querySelector('[data-future-id="mira-builder"][data-future-field="on_unlock.image.prompt"]');
    const futureScenePresence = devFieldByPath('[data-story-builder-future-shell="mira-builder"]', ["scene_presence"]);
    devAssert(!!futureName && !!futurePrompt && !!futureScenePresence, "future cast fields and structured shell render");
    futureName.value = "Mira Revised";
    futurePrompt.value = "Mira Revised unlock image";
    futureScenePresence.value = "none";
    await saveStoryBuilderDraft(false);
    const savedFuture = storyTemplateById(template.id)?.state?.future_cast?.items?.["mira-builder"];
    devAssert(savedFuture?.name === "Mira Revised" && savedFuture?.on_unlock?.image?.prompt === "Mira Revised unlock image" && savedFuture?.on_unlock?.image?.favorite === true && savedFuture?.scene_presence === "none", "future character shell edits persist", savedFuture);
    storyBuilderEditCharacterDefinition("future", "mira-builder");
    await new Promise(resolve => setTimeout(resolve, 50));
    const characterEditorText = $("storyBuilderCharacterDefinitionEditor")?.textContent || "";
    const characterEditorCoverage = {
      outfits: /Outfits/i.test(characterEditorText),
      startingOutfit: /Starting Outfit Id/i.test(characterEditorText),
      fallbackOutfits: /Fallback Outfits/i.test(characterEditorText),
      fallbackStartingOutfit: /Fallback Starting Outfit Id/i.test(characterEditorText),
      profilePresentations: /Profile Image Presentations/i.test(characterEditorText),
      voice: !!devFieldByPath("#storyBuilderCharacterDefinitionEditor", ["character_definition", "voice", "preferred_voice_name"])
    };
    devTestLog("story builder character editor coverage labels", {
      ...characterEditorCoverage,
      voicePaths: [...document.querySelectorAll("#storyBuilderCharacterDefinitionEditor [data-state-path]")].map(field => {
        try {
          return JSON.parse(decodeURIComponent(field.dataset.statePath || "[]")).join(".");
        } catch {
          return "";
        }
      }).filter(path => /voice/i.test(path))
    });
    devAssert(Object.values(characterEditorCoverage).every(Boolean), "embedded character editor exposes outfits, fallback presentation, image metadata, and voice fields", characterEditorText);
    closeModal();
    setStoryBuilderPanel("images");
    await new Promise(resolve => setTimeout(resolve, 150));
    devAssert(/Story Images/i.test($("storyBuilderOverlay")?.textContent || "") && /Title Card/i.test($("storyBuilderOverlay")?.textContent || "") && /Featured subjects/i.test($("storyBuilderOverlay")?.textContent || "") && /Generate Missing/i.test($("storyBuilderOverlay")?.textContent || "") && /Male profile image/i.test($("storyBuilderOverlay")?.textContent || "") && /Female profile image/i.test($("storyBuilderOverlay")?.textContent || "") && /Builder Smoke Story Image/i.test($("storyBuilderOverlay")?.textContent || "") && /Builder Hosted Story Image/i.test($("storyBuilderOverlay")?.textContent || "") && !document.querySelector("[data-future-field='profile_images']") && !document.querySelector("[data-future-field='images']") && !document.querySelector("[data-future-field='on_unlock.image']"), "story builder images panel exposes generation controls and hides raw image/profile JSON internals", $("storyBuilderOverlay")?.textContent || "");
    const pluginOverrides = globalThis.__emberAdventuresPluginOverrides ||= {};
    const hadTextToImageOverride = Object.prototype.hasOwnProperty.call(pluginOverrides, "textToImagePlugin");
    const previousTextToImageOverride = pluginOverrides.textToImagePlugin;
    pluginOverrides.textToImagePlugin = () => ({
      iframeHtml: "",
      onFinishPromise: Promise.resolve({
        dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
      })
    });
    try {
      $("storyBuilderTitleCardPrompt").value = "Builder smoke title card";
      $("storyBuilderTitleCardSubjects").value = "Mira Revised\nworkshop gate";
      const titleCardSaved = await storyBuilderGenerateTitleCardImage();
      const maleProfileSaved = await storyBuilderGenerateDefaultProfileImage("future", "mira-builder", "male");
      const maleProfileStatus = app.storyBuilder?.status || "";
      const femaleProfileSaved = await storyBuilderGenerateDefaultProfileImage("future", "mira-builder", "female");
      const femaleProfileStatus = app.storyBuilder?.status || "";
      const rewardImageEntry = storyBuilderImageManifest(app.storyBuilder.draft).find(entry => entry.kind === "story-reward");
      const rewardImageSaved = await storyBuilderGenerateManifestImage(rewardImageEntry?.slotId);
      const generatedRewardReady = storyBuilderImageEntryIsReady(storyBuilderImageManifest(app.storyBuilder.draft).find(entry => entry.kind === "story-reward"));
      devTestLog("story builder generated image results", {
        titleCardSaved,
        maleProfileSaved,
        maleProfileStatus,
        femaleProfileSaved,
        femaleProfileStatus,
        rewardImageSaved,
        generatedRewardReady,
        status: app.storyBuilder?.status || ""
      });
      devAssert(titleCardSaved && maleProfileSaved && femaleProfileSaved && generatedRewardReady, "story builder generated images save successfully", {
        titleCardSaved,
        maleProfileSaved,
        femaleProfileSaved,
        rewardImageSaved,
        status: app.storyBuilder?.status || ""
      });
    } finally {
      if (hadTextToImageOverride) pluginOverrides.textToImagePlugin = previousTextToImageOverride;else delete pluginOverrides.textToImagePlugin;
    }
    const savedImages = storyTemplateById(template.id);
    const savedFutureImage = savedImages?.state?.future_cast?.items?.["mira-builder"]?.full_character?.default_profile_image;
    const savedFuturePresentations = savedImages?.state?.future_cast?.items?.["mira-builder"]?.full_character?.profile_image_presentations || {};
    const savedRewardImage = savedImages?.state?.objectives?.items?.[0]?.rewards?.find(reward => reward.id === "builder-smoke-story-image")?.image;
    devTestLog("story builder persisted image results", {
      titleCardUrl: savedImages?.title_card_image?.url || "",
      titleCardHtml: savedImages?.title_card_image?.html || "",
      titleCardPrompt: savedImages?.title_card_image?.prompt || "",
      titleCardSubjects: savedImages?.title_card_subjects?.join("|") || "",
      futureUrl: savedFutureImage?.url || "",
      futureMaleUrl: savedFuturePresentations.male?.url || "",
      futureNonMaleUrl: savedFuturePresentations.non_male?.url || "",
      rewardUrl: savedRewardImage?.url || ""
    });
    devAssert(String(savedImages?.title_card_image?.url || "").startsWith("data:image/") && savedImages?.title_card_image?.prompt === "Builder smoke title card" && savedImages?.title_card_subjects?.join("|") === "Mira Revised|workshop gate" && String(savedFutureImage?.url || "").startsWith("data:image/") && String(savedFuturePresentations.male?.url || "").startsWith("data:image/") && String(savedFuturePresentations.non_male?.url || "").startsWith("data:image/") && String(savedRewardImage?.url || "").startsWith("data:image/"), "story builder image tools generate title-card art, character presentations, and reward images", {
      titleCard: savedImages?.title_card_image,
      savedFutureImage,
      savedFuturePresentations,
      savedRewardImage
    });
    setStoryBuilderPanel("tree");
    storyBuilderSelectObjective("first-objective");
    await new Promise(resolve => setTimeout(resolve, 150));
    if (!app.storyBuilder.nodeListOpen) storyBuilderToggleNodeList();
    await new Promise(resolve => setTimeout(resolve, 50));
    const firstTitleField = document.querySelector('[data-tree-objective-field="title"]');
    const firstSummaryField = document.querySelector('[data-tree-objective-field="summary"]');
    devAssert(!!firstTitleField && !!firstSummaryField && !!document.querySelector('.story-builder-mode-control[aria-label="Objective control mode"]') && !!document.querySelector('.story-builder-mode-control[aria-label="Objective output mode"]') && !!document.querySelector('[data-tree-objective-field="while_active_guidance"]') && !!document.querySelector('[data-tree-objective-field="completion_criteria"]') && !!document.querySelector('[data-story-output-field="completion_instruction"]') && !!document.querySelector("[data-story-output-block]") && !document.querySelector('[data-tree-objective-field="status"]') && !document.querySelector('[data-tree-objective-field="available_now"]'), "objective inspector organizes control and outputs first, exposes private active guidance, and hides runtime status fields");
    devAssert(!document.querySelector('[data-objective-field="objective"]'), "story builder objective editor does not expose the legacy objective field");
    const originalInspectorStack = document.querySelector(".story-builder-inspector-stack");
    originalInspectorStack.style.maxHeight = "180px";
    originalInspectorStack.scrollTop = Math.min(120, originalInspectorStack.scrollHeight - originalInspectorStack.clientHeight);
    const originalInspectorScroll = originalInspectorStack.scrollTop;
    firstTitleField.focus();
    firstTitleField.value = "First Objective Edited";
    firstTitleField.dispatchEvent(new Event("input", {
      bubbles: true
    }));
    firstTitleField.dispatchEvent(new FocusEvent("blur", {
      relatedTarget: firstSummaryField
    }));
    firstSummaryField.focus();
    await waitForRenderedFrame();
    const firstObjectiveAfterTitleBlur = storyBuilderObjectiveById("first-objective", app.storyBuilder?.draft);
    const firstNodeListTitle = document.querySelector('[data-story-builder-node-list-id="first-objective"]')?.textContent || "";
    const firstGraphTitleAfterBlur = document.querySelector('[data-tree-node-id="first-objective"] .story-builder-node-dot-label')?.textContent || "";
    devAssert(document.querySelector(".story-builder-inspector-stack") === originalInspectorStack && originalInspectorStack.scrollTop === originalInspectorScroll && document.activeElement === firstSummaryField && firstObjectiveAfterTitleBlur?.title === "First Objective Edited" && firstNodeListTitle === "First Objective Edited" && firstGraphTitleAfterBlur === "First Objective Edited", "moving between Node text fields commits without rebuilding or scrolling the inspector", {
      panelPreserved: document.querySelector(".story-builder-inspector-stack") === originalInspectorStack,
      scrollTop: originalInspectorStack.scrollTop,
      expectedScroll: originalInspectorScroll,
      activeField: document.activeElement?.dataset?.treeObjectiveField || "",
      draftTitle: firstObjectiveAfterTitleBlur?.title || "",
      nodeListTitle: firstNodeListTitle,
      graphTitle: firstGraphTitleAfterBlur
    });
    firstSummaryField.value = "First summary edited for the player.";
    firstSummaryField.dispatchEvent(new Event("input", {
      bubbles: true
    }));
    firstSummaryField.dispatchEvent(new FocusEvent("blur", {
      relatedTarget: firstTitleField
    }));
    firstTitleField.focus();
    await waitForRenderedFrame();
    devAssert(document.querySelector(".story-builder-inspector-stack") === originalInspectorStack && originalInspectorStack.scrollTop === originalInspectorScroll && document.activeElement === firstTitleField && storyBuilderObjectiveById("first-objective", app.storyBuilder?.draft)?.summary === "First summary edited for the player.", "Node textarea blur updates the draft without moving focus or replacing the panel", {
      scrollTop: originalInspectorStack.scrollTop,
      expectedScroll: originalInspectorScroll,
      summary: storyBuilderObjectiveById("first-objective", app.storyBuilder?.draft)?.summary
    });
    app.storyBuilder.mobileInspectorOpen = true;
    renderStoryBuilder();
    devAssert(document.querySelector(".story-builder-body")?.classList.contains("right-open") && !!document.querySelector(".story-builder-details .story-builder-panel-head") && storyBuilderCloseMobileInspector() === true && !document.querySelector(".story-builder-body")?.classList.contains("right-open"), "mobile objective details use a closable full-screen drawer state");
    storyBuilderToggleOutputDialogue(0, true);
    devAssert(Array.isArray(storyBuilderObjectiveOutputRows(storyBuilderObjectiveById("first-objective", app.storyBuilder.draft))[0]?.dialogue_lines) && !!document.querySelector('[data-story-dialogue-index="0"]') && !document.querySelector('.story-builder-mode-control[aria-label="Player choice response mode"]'), "an output can enable exact dialogue without enabling a player choice");
    storyBuilderSetObjectiveControlMode("ai");
    devAssert(storyBuilderObjectiveById("first-objective", app.storyBuilder.draft)?.completion_control === "ai" && /Auto Complete/.test(document.querySelector(".story-builder-details")?.textContent || ""), "AI control exposes activation evaluation only for an AI-controlled objective");
    storyBuilderSetObjectiveOutputMode("multiple");
    devAssert(objectiveRouteControl(storyBuilderObjectiveById("first-objective", app.storyBuilder.draft)) === "ai" && Array.isArray(storyBuilderObjectiveById("first-objective", app.storyBuilder.draft)?.outcome_routes) && !document.querySelector('.story-builder-mode-control[aria-label="Player choice response mode"]'), "multiple AI outputs expose private ordered outcome routes");
    storyBuilderSetObjectiveControlMode("player");
    storyBuilderSetChoiceObjective(true);
    devAssert(storyBuilderObjectiveById("first-objective", app.storyBuilder.draft)?.completion_control === "choice" && Array.isArray(storyBuilderObjectiveById("first-objective", app.storyBuilder.draft)?.choices) && !!document.querySelector('.story-builder-mode-control[aria-label="Player choice response mode"]') && !storyBuilderObjectiveById("first-objective", app.storyBuilder.draft)?.outcome_routes, "player choice mode exposes visible player choices instead of AI outcomes");
    storyBuilderSetChoiceResponseMode("exact_text");
    devAssert(objectiveChoiceResponseMode(storyBuilderObjectiveById("first-objective", app.storyBuilder.draft)) === "exact_text" && !!document.querySelector('[data-story-output-field="player_text"]'), "exact-text player choices expose authored player dialogue on each choice");
    const exactChoiceObjective = storyBuilderObjectiveById("first-objective", app.storyBuilder.draft);
    const exactChoiceText = exactChoiceObjective.choices[0].player_text;
    exactChoiceObjective.choices[0].player_text = "";
    const missingExactChoiceText = validateStoryDefinition(app.storyBuilder.draft);
    exactChoiceObjective.choices[0].player_text = exactChoiceText;
    devAssert(missingExactChoiceText.errors.some(error => /choices\.0\.player_text$/i.test(error.path || "") && error.code === "required"), "exact-text player choices reject missing authored player dialogue", missingExactChoiceText.errors);
    storyBuilderSetObjectiveControlMode("player");
    storyBuilderSetChoiceObjective(false);
    storyBuilderSetObjectiveOutputMode("one");
    storyBuilderToggleOutputDialogue(0, false);
    const guidedObjective = storyBuilderObjectiveById("first-objective", app.storyBuilder.draft);
    guidedObjective.completion_criteria = "The player completes the edited first objective.";
    guidedObjective.while_active_guidance = "Privately keep the captain impatient while this objective remains active.";
    await saveStoryBuilderDraft(false, {
      collectVisible: false
    });
    renderStoryBuilder();
    const guidedPrompt = runtimeObjectiveForPrompt(storyTemplateById(template.id)?.state?.objectives?.items?.find(objective => objective.id === "first-objective"));
    devTestLog("story builder while-active prompt projection", {
      guidedPrompt,
      status: app.storyBuilder?.status || ""
    });
    devAssert(guidedPrompt.while_active_guidance === "Privately keep the captain impatient while this objective remains active." && !JSON.stringify(guidedPrompt).includes("completion_instruction"), "while-active guidance reaches AI objective context without exposing completion instructions", guidedPrompt);
    const objectiveMoveSaved = await storyBuilderMoveObjective(0, 1);
    if (!objectiveMoveSaved) {
      const moveValidation = validateStoryDefinition(app.storyBuilder?.draft || {});
      devTestLog("story builder objective move save failure", {
        status: app.storyBuilder?.status || "",
        validationErrors: moveValidation.errors,
        failedBuilderChecks: storyBuilderValidationChecks(app.storyBuilder?.draft || {}, moveValidation).filter(check => !check.ok)
      });
    }
    devAssert(objectiveMoveSaved === true, "story builder objective move saves successfully", app.storyBuilder?.status || "");
    let savedObjectives = storyTemplateById(template.id)?.state?.objectives?.items || [];
    devAssert(savedObjectives[0]?.id === "second-objective" && savedObjectives[1]?.id === "first-objective" && savedObjectives[1]?.title === "First Objective Edited" && savedObjectives[1]?.summary === "First summary edited for the player." && !("objective" in savedObjectives[1]), "objective move preserves title/summary edits and keeps the summary-only schema", savedObjectives);
    const structuralStack = document.querySelector(".story-builder-inspector-stack");
    const structuralDetails = [...structuralStack.querySelectorAll("details")];
    const structuralDetailIndex = structuralDetails.length ? structuralDetails.length - 1 : -1;
    if (structuralDetailIndex >= 0) structuralDetails[structuralDetailIndex].open = true;
    structuralStack.scrollTop = Math.min(140, structuralStack.scrollHeight - structuralStack.clientHeight);
    const structuralScroll = structuralStack.scrollTop;
    const structuralTitleField = structuralStack.querySelector('[data-tree-objective-field="title"]');
    structuralTitleField.focus();
    storyBuilderSetObjectiveControlMode(storyBuilderObjectiveControlMode(storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft)));
    await new Promise(resolve => setTimeout(resolve, 80));
    const restoredStructuralStack = document.querySelector(".story-builder-inspector-stack");
    const restoredStructuralTitleField = restoredStructuralStack.querySelector('[data-tree-objective-field="title"]');
    const restoredDetails = [...restoredStructuralStack.querySelectorAll("details")];
    devAssert(restoredStructuralStack !== structuralStack && restoredStructuralStack.scrollTop === structuralScroll && document.activeElement === restoredStructuralTitleField && (structuralDetailIndex < 0 || restoredDetails[structuralDetailIndex]?.open === true), "Node structural redraws preserve inspector scroll, focus, and expanded sections", {
      scrollTop: restoredStructuralStack.scrollTop,
      expectedScroll: structuralScroll,
      activeField: document.activeElement?.dataset?.treeObjectiveField || "",
      detailOpen: structuralDetailIndex < 0 ? null : restoredDetails[structuralDetailIndex]?.open
    });
    const objectiveDeletePromise = storyBuilderDeleteObjective(0);
    await devWaitFor(() => [...document.querySelectorAll(".popup-modal")].some(popup => /Delete Objective/i.test(popup.textContent || "") && !!popup.querySelector("#confirmYesBtn")), 3000, "Delete Objective confirmation popup");
    const objectiveDeletePopup = [...document.querySelectorAll(".popup-modal")].findLast(popup => /Delete Objective/i.test(popup.textContent || ""));
    objectiveDeletePopup?.querySelector("#confirmYesBtn")?.click();
    const objectiveDeleteSaved = await objectiveDeletePromise;
    devAssert(objectiveDeleteSaved === false && app.storyBuilder.draft.state.objectives.items.length === 1 && storyTemplateById(template.id)?.state?.objectives?.items?.length === 2, "an objective deletion that creates an invalid graph remains an unsaved draft", {
      status: app.storyBuilder?.status || "",
      draft: app.storyBuilder.draft.state.objectives.items,
      saved: storyTemplateById(template.id)?.state?.objectives?.items
    });
    openStoryBuilder(template.id);
    await new Promise(resolve => setTimeout(resolve, 80));
    savedObjectives = storyTemplateById(template.id)?.state?.objectives?.items || [];
    devAssert(savedObjectives.length === 2 && app.storyBuilder?.draft?.state?.objectives?.items?.length === 2, "reopening the editor restores the last valid graph after an invalid deletion", savedObjectives);
    app.storyBuilder.pendingPatch = [{
      op: "set",
      path: "draft.description",
      value: "AI reviewed description."
    }];
    setStoryBuilderPanel("ai");
    await new Promise(resolve => setTimeout(resolve, 50));
    devAssert(!!document.querySelector("[data-story-builder-patch-index]") && /Set Description/i.test($("storyBuilderOverlay")?.textContent || "") && !document.querySelector(".story-builder-ai-output"), "AI changes render as selectable human-readable operations instead of raw JSON", $("storyBuilderOverlay")?.textContent || "");
    const hostedBuilderEntries = storyBuilderImageManifest(app.storyBuilder.draft).filter(entry => entry.title === "Builder Hosted Story Image");
    devAssert(hostedBuilderEntries.length === 1 && hostedBuilderEntries.every(storyBuilderImageEntryIsReady), "story builder image inventory discovers URL-only reward images as ready", {
      hostedBuilderEntries
    });
    const patchSaved = await storyBuilderApplyPendingPatch();
    devAssert(patchSaved === true && storyTemplateById(template.id)?.description === "AI reviewed description.", "selected AI changes validate and apply transactionally", storyTemplateById(template.id)?.description);
    setStoryBuilderPanel("validate");
    await new Promise(resolve => setTimeout(resolve, 50));
    devAssert(/Validation/i.test($("storyBuilderOverlay")?.textContent || "") && /Ready to save and export/i.test($("storyBuilderOverlay")?.textContent || ""), "validation panel combines builder checks with full story contract validation", $("storyBuilderOverlay")?.textContent || "");
    openStoryBuilder(template.id);
    await new Promise(resolve => setTimeout(resolve, 150));
    devAssert(app.storyBuilder?.draft?.title === "Builder Smoke Edited" && app.storyBuilder?.draft?.state?.objectives?.items?.length === 2, "reopening builder reloads saved draft", app.storyBuilder?.draft);
    app.storyBuilder = null;
    document.body.classList.remove("story-builder-open");
    $("storyBuilderOverlay")?.classList.add("hidden");
    if ($("storyBuilderOverlay")) $("storyBuilderOverlay").innerHTML = "";
    openStoryTemplateLibrary({
      tab: "local"
    });
    const renamedStoryCard = document.querySelector(`[data-story-library-tab-panel="local"] [data-story-library-id="${cssEscape(template.id)}"]`);
    devAssert(renamedStoryCard?.querySelector(".story-library-card-title-text")?.textContent === "Builder Smoke Edited", "closing the story builder renders the saved title in the story library card", {
      cardTitle: renamedStoryCard?.querySelector(".story-library-card-title-text")?.textContent || "",
      storedTitle: storyTemplateById(template.id)?.title || ""
    });
    closeModal();
    addMessage("system", "Story builder edit smoke test passed.");
    showNotice("Live Test Passed", "Story builder edit smoke test passed.");
    scheduleActiveGameSave();
    render();
    devTestLog("Scenario complete: story-builder-edit-smoke");
  }
  async function devRunLibraryMetadataValidationSmokeTest() {
    devTestLog("Scenario start: library-metadata-validation-smoke");
    const validStory = devSmokeTemplateRecord({
      id: "library-metadata-valid-story",
      title: "Library Metadata Valid Story",
      description: "Valid metadata smoke story.",
      source: "Original",
      creator: "debug harness",
      creator_id: "00000000-0000-4000-8000-000000000001",
      creation_tool: "debug harness",
      genres: ["fantasy"]
    });
    const invalidStory = clone(validStory);
    invalidStory.id = "library-metadata-invalid-story";
    invalidStory.title = "Library Metadata Invalid Story";
    invalidStory.genres = [];
    delete invalidStory.creation_tool;
    const validCharacter = devSmokeCharacterRecord("Metadata Valid Character", {
      character: {
        age: 30,
        gender: "female"
      }
    });
    const invalidCharacter = clone(validCharacter.character);
    invalidCharacter.name = "Metadata Invalid Character";
    invalidCharacter.source = "";
    invalidCharacter.creation_tool = "";
    invalidCharacter.genres = [];
    const versionlessGeneratedCharacter = clone(validCharacter.character);
    delete versionlessGeneratedCharacter.version;
    const generatedCharacterDefinition = runtimeCharacterDefinitionRecord(versionlessGeneratedCharacter.name, versionlessGeneratedCharacter).character;
    const expectedAppearanceScaleFields = ["height"];
    const legacyAppearanceFields = ["shoulder_width", "chest", "upper_body_build", "midsection_build", "hip_width", "butt_build", "lower_body_build", "arm_length", "leg_length", "muscular", "shoulders", "stomach", "hips", "waist", "legs", "arms", "race", "ancestry"];
    const endpointCharacter = clone(validCharacter.character);
    expectedAppearanceScaleFields.forEach((field, index) => {
      endpointCharacter.appearance[field] = index % 2 === 0 ? 0 : 20;
    });
    const decimalScaleCharacter = clone(validCharacter.character);
    expectedAppearanceScaleFields.forEach(field => {
      decimalScaleCharacter.appearance[field] = 10.5;
    });
    const outOfRangeScaleCharacter = clone(validCharacter.character);
    expectedAppearanceScaleFields.forEach((field, index) => {
      outOfRangeScaleCharacter.appearance[field] = index % 2 === 0 ? -1 : 21;
    });
    const legacyScaleCharacter = clone(validCharacter.character);
    legacyAppearanceFields.forEach(field => {
      legacyScaleCharacter.appearance[field] = 5;
    });
    const missingVersionCharacter = clone(validCharacter.character);
    delete missingVersionCharacter.version;
    const anotherVersionCharacter = clone(validCharacter.character);
    anotherVersionCharacter.version = 7;
    const missingBodyCharacter = clone(validCharacter);
    delete missingBodyCharacter.character.appearance.body_description;
    const missingBodyStory = clone(validStory);
    delete missingBodyStory.state.player.appearance.body_description;
    const generatedBodyCharacter = { gender: "female", appearance: { body_description: "A powerful build." } };

    const authoredBodyState = repairAiGeneratedState({
      ...clone(validStory.state),
      player: {
        ...clone(validStory.state.player),
        appearance: {
          ...clone(validStory.state.player.appearance),
          body_description: "A slender build.",
        }
      },
      characters: {
        "Authored Body Character": {
          ...blankCharacterTemplate("Authored Body Character"),
          appearance: {
            ...blankAppearanceTemplate(),
            body_description: "A stocky build.",
          }
        }
      }
    });
    const patchedAuthoredCharacter = mergeCharacterPatch(authoredBodyState.characters["Authored Body Character"], {
      state_of_mind: "unchanged body smoke"
    });
    devAssert(validateStoryDefinition(validStory).ok, "valid story definition passes the canonical story validator", validateStoryDefinition(validStory));
    const wrongCaseStory = clone(validStory);
    wrongCaseStory.creationTool = wrongCaseStory.creation_tool;
    delete wrongCaseStory.creation_tool;
    const wrongCaseStoryDefinitionValidation = validateStoryDefinition(wrongCaseStory);
    const wrongCaseStoryExportValidation = validateStoryExport({
      app: "EmberAdventures",
      exportType: "story-template",
      storyTemplate: wrongCaseStory,
      exportedAt: new Date().toISOString()
    });
    devAssert(!wrongCaseStoryDefinitionValidation.ok && !wrongCaseStoryExportValidation.ok && wrongCaseStoryDefinitionValidation.errors.some(error => error.path === "storyTemplate.creationTool" && error.code === "unknown_field") && wrongCaseStoryDefinitionValidation.errors.some(error => error.path === "storyTemplate.creation_tool") && wrongCaseStoryExportValidation.errors.some(error => error.path === "storyTemplate.creationTool" && error.code === "unknown_field"), "story definition and story-file validation both reject wrong-case fields", {
      definition: wrongCaseStoryDefinitionValidation,
      export: wrongCaseStoryExportValidation
    });
    const validRuntimeKnownFactRewardStory = clone(validStory);
    validRuntimeKnownFactRewardStory.state.objectives.items = [{
      id: "valid-runtime-known-fact-reward",
      title: "Valid Runtime Known Fact Reward",
      type: "story",
      status: "active",
      summary: "Learn a runtime fact.",
      while_active_guidance: "Keep the fake metadata-validation scene focused on learning the runtime fact.",
      completion_control: "player",
      completion_criteria: "Learn the runtime fact.",
      next_objectives: [{
        id: "valid-runtime-known-fact-reward-ending",
        completion_instruction: "Learn a runtime fact.",
        rewards: [],
        ending_type: "freeplay",
        ending_message: "The runtime known-fact validation smoke continues in freeplay."
      }],
      rewards: [{
        type: "add_state_list_item",
        target: "Player",
        field_path: ["known_facts"],
        value: {
          id: "metadata-smoke-runtime-fact",
          text: "The player learned the runtime smoke fact."
        }
      }]
    }];
    validRuntimeKnownFactRewardStory.state.objectives.active_id = "valid-runtime-known-fact-reward";
    const invalidStartingKnownFactRewardStory = clone(validRuntimeKnownFactRewardStory);
    invalidStartingKnownFactRewardStory.state.objectives.items[0].rewards[0].field_path = ["starting_known_facts"];
    const invalidStartingKnownFactRewardValidation = validateStoryDefinition(invalidStartingKnownFactRewardStory);
    devAssert(validateStoryDefinition(validRuntimeKnownFactRewardStory).ok && !invalidStartingKnownFactRewardValidation.ok && invalidStartingKnownFactRewardValidation.errors.some(error => error.code === "definition_field" && /starting_known_facts/i.test(error.message || "")), "story validation accepts runtime known-fact rewards and rejects definition-only starting fact targets", {
      valid: validateStoryDefinition(validRuntimeKnownFactRewardStory),
      invalid: invalidStartingKnownFactRewardValidation
    });
    const oldKnownFactCharacter = clone(validCharacter.character);
    oldKnownFactCharacter.durable_known_facts = ["Old field smoke fact."];
    const oldKnownFactCharacterValidation = validateCharacterDefinition(oldKnownFactCharacter);
    devAssert(!oldKnownFactCharacterValidation.ok && oldKnownFactCharacterValidation.errors.some(error => error.code === "unknown_field" && error.path === "character_definition.durable_known_facts"), "character validation strictly rejects the unapproved durable_known_facts definition field", oldKnownFactCharacterValidation);
    const invalidStoryValidation = validateStoryDefinition(invalidStory);
    devAssert(!invalidStoryValidation.ok && invalidStoryValidation.errors.some(error => error.path === "creation_tool") && invalidStoryValidation.errors.some(error => error.path === "genres"), "invalid story metadata is rejected loudly", invalidStoryValidation);
    let invalidStoryAssertRejected = false;
    try {
      assertValidStoryDefinition(invalidStory, "library metadata invalid story smoke");
    } catch (err) {
      invalidStoryAssertRejected = /library metadata invalid story smoke is invalid/i.test(err.message || String(err));
      $("issueDismissBtn")?.click();
      app.issuePopupOpen = false;
    }
    devAssert(invalidStoryAssertRejected, "invalid story definition assert path blocks mutation and reports the exact context");
    devAssert(validateCharacterDefinition(validCharacter.character).ok, "valid character definition passes the canonical character validator", validateCharacterDefinition(validCharacter.character));
    devAssert(generatedCharacterDefinition.version === 1 && validateCharacterDefinition(generatedCharacterDefinition).ok, "runtime-generated humanoid character definitions use pre-release version 1", generatedCharacterDefinition);
    const blankAppearance = blankAppearanceTemplate();
    devAssert(JSON.stringify(CHARACTER_APPEARANCE_SCALE_FIELDS) === JSON.stringify(expectedAppearanceScaleFields) && JSON.stringify(bodyStatKeys()) === JSON.stringify(expectedAppearanceScaleFields) && JSON.stringify(Object.keys(BODY_STAT_DEFAULTS)) === JSON.stringify(expectedAppearanceScaleFields) && expectedAppearanceScaleFields.every(field => Object.hasOwn(blankAppearance, field)) && legacyAppearanceFields.every(field => !Object.hasOwn(blankAppearance, field) && !CHARACTER_APPEARANCE_FIELDS.includes(field)), "schema, defaults, and editor expose exactly the eleven 0-20 appearance scale fields and reject removed legacy fields", {
      schema: CHARACTER_APPEARANCE_SCALE_FIELDS,
      defaults: Object.keys(BODY_STAT_DEFAULTS),
      editor: bodyStatKeys(),
      blankAppearance
    });
    const legacyScaleValidation = validateCharacterDefinition(legacyScaleCharacter);
    devAssert(!legacyScaleValidation.ok && legacyAppearanceFields.every(field => legacyScaleValidation.errors.some(error => error.code === "unknown_field" && error.path === `character_definition.appearance.${field}`)), "all removed legacy appearance fields are rejected explicitly", legacyScaleValidation);
    const missingVersionValidation = validateCharacterDefinition(missingVersionCharacter);
    const anotherVersionValidation = validateCharacterDefinition(anotherVersionCharacter);
    devAssert(validCharacter.character.version === 1 && validateCharacterDefinition(validCharacter.character).ok && anotherVersionValidation.ok && !missingVersionValidation.ok && missingVersionValidation.errors.some(error => error.path === "character_definition.version" && error.code === "required"), "humanoid character definitions accept positive versions with the current 0-20 appearance shape", {
      anotherVersionCharacter,
      anotherVersionValidation,
      missingVersionValidation
    });
    const endpointScaleValidation = validateCharacterDefinition(endpointCharacter);
    const decimalScaleValidation = validateCharacterDefinition(decimalScaleCharacter);
    const outOfRangeScaleValidation = validateCharacterDefinition(outOfRangeScaleCharacter);
    devAssert(endpointScaleValidation.ok && expectedAppearanceScaleFields.every(field => decimalScaleValidation.errors.some(error => error.path === `character_definition.appearance.${field}`)) && expectedAppearanceScaleFields.every(field => outOfRangeScaleValidation.errors.some(error => error.path === `character_definition.appearance.${field}`)), "all eleven appearance scales accept integer endpoints 0 and 20 and reject decimals and out-of-range values", {
      endpointScaleValidation,
      decimalScaleValidation,
      outOfRangeScaleValidation
    });
    let editorDecimalRejected = false;
    let editorOutOfRangeRejected = false;
    try {
      parseBodyStatInput("10.5");
    } catch (err) {
      editorDecimalRejected = /whole numbers from 0 to 20/i.test(err.message || String(err));
    }
    try {
      parseBodyStatInput("21");
    } catch (err) {
      editorOutOfRangeRejected = /whole numbers from 0 to 20/i.test(err.message || String(err));
    }
    devAssert(parseBodyStatInput("20") === 20 && editorDecimalRejected && editorOutOfRangeRejected && repairAiBodyStatValue(21) === 20 && repairAiBodyStatValue(-1) === 0 && stateNumberRule(["appearance", "height"]).max === 20 && /max="20"/.test(stateEditorInputAttributes(["appearance", "height"], "number")), "state editor parsing, repair clamping, and numeric controls use maximum 20", {
      attributes: stateEditorInputAttributes(["appearance", "height"], "number")
    });

    for (const value of [0, 12, null, [], {}]) {
      const invalidBody = clone(validCharacter.character);
      invalidBody.appearance.body_description = value;
      devAssert(validateCharacterDefinition(invalidBody, "character").errors.some(error => error.path === "character.appearance.body_description"), "body descriptions reject non-text values", {value});
    }
    const blankBody = clone(validCharacter.character);
    blankBody.appearance.body_description = "";
    devAssert(validateCharacterDefinition(blankBody).ok, "body description may be left blank");
    const missingBodyCharacterValidation = validateCharacterDefinition(missingBodyCharacter.character, "character");
    const missingBodyStoryValidation = validateStoryDefinition(missingBodyStory);
    devAssert(!missingBodyCharacterValidation.ok && missingBodyCharacterValidation.errors.some(error => error.path === "character.appearance.body_description") && !missingBodyStoryValidation.ok && missingBodyStoryValidation.errors.some(error => error.path === "state.player.appearance.body_description"), "character and story imports reject missing body description fields", {
      missingBodyCharacterValidation,
      missingBodyStoryValidation
    });
    devAssert(authoredBodyState.player.appearance.body_description === "A slender build." && authoredBodyState.characters["Authored Body Character"].appearance.body_description === "A stocky build." && patchedAuthoredCharacter.appearance.body_description === "A stocky build.", "authored body descriptions survive runtime validation and unrelated AI state patches", {
      playerBody: authoredBodyState.player.appearance.body_description,
      characterBody: authoredBodyState.characters["Authored Body Character"].appearance.body_description,
      patchedBody: patchedAuthoredCharacter.appearance.body_description
    });
    devAssert(generatedBodyCharacter.appearance.body_description === "A powerful build.", "character body descriptions are not overridden by global preferences");
    const invalidCharacterValidation = validateCharacterDefinition(invalidCharacter);
    devAssert(!invalidCharacterValidation.ok && invalidCharacterValidation.errors.some(error => error.path === "character_definition.genres"), "invalid character metadata is rejected loudly", invalidCharacterValidation);
    let invalidCharacterAssertRejected = false;
    try {
      assertValidCharacterDefinition(invalidCharacter, "library metadata invalid character smoke");
    } catch (err) {
      invalidCharacterAssertRejected = /library metadata invalid character smoke is invalid/i.test(err.message || String(err));
      $("issueDismissBtn")?.click();
      app.issuePopupOpen = false;
    }
    devAssert(invalidCharacterAssertRejected, "invalid character definition assert path blocks mutation and reports the exact context");
    const imageEntry = createPublicLibraryEntry({
      type: "image",
      name: "Metadata Image",
      url: "https://example.com/image.png",
      source: "generated",
      creator: "debug harness",
      creation_tool: "debug harness"
    });
    devAssert(!publicLibraryPublishPolicyErrors(imageEntry).includes("approved genre is required"), "image public metadata is not forced to use story/character genre metadata", publicLibraryPublishPolicyErrors(imageEntry));
    const feedbackIndex = devSmokePublicLibraryIndex({
      items: [createPublicLibraryEntry({
        type: "story-template",
        name: "Feedback Story",
        url: "https://example.com/story.json",
        source: "Smoke Source",
        creator: "debug harness",
        creator_id: "00000000-0000-4000-8000-000000000001",
        creation_tool: "debug harness",
        genres: ["fantasy"]
      })]
    });
    const feedbackEntry = feedbackIndex.items[0];
    const feedbackAt = "2026-08-20T00:00:00.000Z";
    feedbackIndex.story_feedback = [createPublicStoryFeedback({
      entry_id: feedbackEntry.id,
      type: "rating",
      rating: 5,
      comment: "Good smoke story.",
      creator: "tester",
      at: feedbackAt
    }), createPublicStoryFeedback({
      entry_id: feedbackEntry.id,
      type: "report",
      report_reason: "wrong genre or tags",
      comment: "Smoke report.",
      creator: "tester",
      at: feedbackAt
    }), createPublicStoryFeedback({
      entry_id: feedbackEntry.id,
      type: "tag_suggestion",
      comment: "Smoke tag suggestion.",
      creator: "tester",
      at: feedbackAt
    })].filter(Boolean);
    const summary = publicLibraryStoryFeedbackSummary(feedbackIndex, feedbackEntry.id);
    devAssert(summary.ratingCount === 1 && summary.ratingAverage === 5 && summary.reportCount === 1 && /wrong genre/i.test(summary.latestReportReason) && summary.tagSuggestionCount === 1, "public story ratings, reports, and tag suggestions normalize into feedback summaries", summary);
    const normalizedStoryEntry = publicLibraryStoryMetadata(validStory, "https://example.com/story.json", {
      creator_name: "debug harness",
      creator_id: "00000000-0000-4000-8000-000000000001"
    });
    const normalizedCharacterEntry = publicLibraryCharacterMetadata(validCharacter, "https://example.com/character.json");
    addMessage("system", "Library metadata validation smoke test passed.");
    devTestLog("Scenario complete: library-metadata-validation-smoke");
  }
  function devSmokePublicImageUrl(kind = "item", id = "") {
    return `https://example.com/emberadventures-lite-smoke-${safeUploadSlug(kind)}-${safeUploadSlug(id || "image")}.png`;
  }
  function devSmokeTitleCardImage(title = "Smoke Story Template") {
    return {
      id: `${objectiveIdFromTitle(title, "story")}-title-card`,
      title: `${title} title card`,
      url: devSmokePublicImageUrl("story-title-card", title),
      prompt: `Smoke title card for ${title}.`,
      negativePrompt: "text, logo, watermark",
      seed: 0,
      model: selectedImageModel(app.settings?.imageModel),
      source: "hosted",
      hosted_url: "",
      html: "",
      favorite: false
    };
  }
  function devSmokeDefaultProfileImage(name = "Smoke Character", male = false) {
    return {
      url: devSmokePublicImageUrl("character-profile", name),
      local_image_id: "",
      source: "hosted",
      prompt: `Smoke profile image for ${name}.`,
      seed: 0,
      negative_prompt: "",
      note: "Smoke profile image fixture.",
      male: !!male
    };
  }
  function devCompleteSmokeOutfitClassifications(character = {}) {
    const next = clone(character || {});
    for (const field of ["outfits", "fallback_outfits"]) {
      if (!Array.isArray(next[field])) continue;
      next[field] = next[field].map(outfit => ({
        ...outfit
      }));
    }
    {}
    return next;
  }
  function devCompleteSmokeGenderPresentation(character = {}, name = "Smoke Character", options = {}) {
    const next = clone(character || {});
    const characterName = textSlot(next.name, name);
    const fallbackOutfitId = textSlot(next.fallback_starting_outfit_id, "") || "smoke-fallback-default";
    next.fallback_name ||= `${characterName} Alternate`;
    if (!Array.isArray(next.fallback_outfits) || !next.fallback_outfits.length) {
      next.fallback_outfits = [{
        id: fallbackOutfitId,
        name: "Smoke Fallback Default",
        clothing: {
          shirt: "plain smoke fallback shirt",
          pants: "plain smoke fallback trousers",
          underwear: "plain smoke fallback underwear",
          feet: "plain smoke fallback shoes"
        }
      }];
    }
    next.fallback_starting_outfit_id = fallbackOutfitId;
    next.appearance ||= blankAppearanceTemplate();
    {}
    if (typeof next.romanceable !== "boolean") next.romanceable = false;
    const classified = devCompleteSmokeOutfitClassifications(next);
    if (options.profileImages === false) return classified;
    const presentations = createProfileImagePresentations(classified.profile_image_presentations || {});
    if (!defaultProfileImageSlotIsConfigured(presentations.male)) presentations.male = devSmokeDefaultProfileImage(`${characterName} Male`, true);
    if (!defaultProfileImageSlotIsConfigured(presentations.non_male)) presentations.non_male = devSmokeDefaultProfileImage(`${characterName} Non-Male`, false);
    classified.profile_image_presentations = presentations;
    const canonicalMale = characterPresentationUsesMaleFields(next.gender);
    const canonicalPresentation = canonicalMale ? presentations.male : presentations.non_male;
    if (!characterProfilePresentationCandidate(classified, canonicalMale)) classified.default_profile_image = clone(canonicalPresentation);
    return classified;
  }
  function devSmokeRuntimeCharacter(name = "Smoke Character", overrides = {}) {
    const gender = textSlot(overrides.gender, "female");
    const clothing = {
      shirt: "plain smoke-test tunic",
      pants: "plain smoke-test trousers",
      feet: "plain smoke-test boots",
      ...(isPlainObject(overrides.clothing) ? overrides.clothing : {})
    };
    const outfitId = textSlot(overrides.active_outfit_id, "default");
    const character = {
      ...blankCharacterTemplate(name),
      ...devCompleteLibraryCharacterMetadata(),
      id: `smoke-character-${objectiveIdFromTitle(name, "character")}`,
      name,
      age: overrides.age || 28,
      gender,
      role: overrides.role || "smoke fixture character",
      relationship_to_player: overrides.relationship_to_player || "smoke-test acquaintance",
      trust: overrides.trust ?? 0,
      attraction: overrides.attraction ?? 0,
      affection: overrides.affection ?? 0,
      state_of_mind: overrides.state_of_mind || "focused",
      physical_state: overrides.physical_state || "healthy",
      pose: overrides.pose || "standing",
      speech_style: overrides.speech_style || "Direct smoke-test dialogue.",
      boldness: overrides.boldness ?? 5,
      can_die: overrides.can_die ?? true,
      voice: {
        gender_bucket: /^male$/i.test(gender) ? "male" : "non_male",
        preferred_voice_name: ""
      },
      clothing,
      outfits: [{
        id: outfitId,
        name: "Default",
        clothing
      }],
      active_outfit_id: outfitId,
      starting_outfit_id: outfitId,
      default_profile_image: devSmokeDefaultProfileImage(name, characterPresentationUsesMaleFields(gender)),
      profile_images: [],
      profile_image_id: "",
      default_seed: overrides.seed ?? 0,
      image_prompt_config: {
        seed_enabled: true,
        seed: overrides.seed ?? 0,
        style: "high detail fantasy RPG character art, cinematic lighting",
        profile_style: "",
        negative: "",
        negative_prompt: ""
      },
      image: {
        seed_enabled: true,
        seed: overrides.seed ?? 0,
        style: "high detail fantasy RPG character art, cinematic lighting",
        profile_style: "",
        negative: ""
      },
      ...overrides
    };
    if (typeof character.profile_image_id !== "string") character.profile_image_id = "";
    const runtime = materializeCharacterForRuntime(devCompleteSmokeGenderPresentation(devCompleteSmokeOutfitClassifications(character), name), name);
    runtime.relationship_to_player = overrides.relationship_to_player || "smoke-test acquaintance";
    runtime.trust = overrides.trust ?? 0;
    runtime.attraction = overrides.attraction ?? 0;
    runtime.affection = overrides.affection ?? 0;
    runtime.state_of_mind = overrides.state_of_mind || "focused";
    runtime.physical_state = overrides.physical_state || "healthy";
    runtime.pose = overrides.pose || "standing";
    return runtime;
  }
  function devSmokeCharacterDefinition(name = "Smoke Character", overrides = {}) {
    const character = devSmokeRuntimeCharacter(name, overrides);
    const definition = runtimeCharacterDefinitionRecord(name, character).character;
    delete definition.genres;
    return definition;
  }
  function devSmokeEmbeddedCharacterDefinition(name = "Smoke Character", character = {}) {
    const existing = clone(character || {});
    for (const field of CHARACTER_DEFINITION_FIELDS) if (!STORY_EMBEDDED_CHARACTER_FIELDS.includes(field)) delete existing[field];
    if (!Object.hasOwn(existing, "clothing") && validateCharacterDefinition(existing, "smoke embedded character", {
      embedded: true
    }).ok) return existing;
    let definition;
    try {
      definition = runtimeCharacterDefinitionRecord(name, devSmokeRuntimeCharacter(name, {
        ...character,
        gender: textSlot(character?.gender, "female")
      })).character;
    } catch (err) {
      throw new Error(`Smoke embedded character ${name} is invalid: ${err.message || err}`);
    }
    for (const field of CHARACTER_DEFINITION_FIELDS) if (!STORY_EMBEDDED_CHARACTER_FIELDS.includes(field)) delete definition[field];
    return definition;
  }
  function devSmokeAuthoredOutput(sourceId, output, index, kind = "next") {
    const source = isPlainObject(output) ? clone(output) : {
      objective_id: String(output || "")
    };
    const targetField = kind === "next" ? "objective_id" : "next_objective_id";
    const targetId = textSlot(source[targetField] || source.objective_id || source.next_objective_id, "");
    const endingType = ["freeplay", "ending", "game_over"].includes(source.ending_type) ? source.ending_type : targetId ? "" : "freeplay";
    const result = {
      id: textSlot(source.id, `${sourceId}--${kind}-${index + 1}`),
      completion_instruction: textSlot(source.completion_instruction, endingType ? "Resolve this ending smoke-test output." : "Continue the smoke-test objective chain."),
      rewards: Array.isArray(source.rewards) ? clone(source.rewards) : []
    };
    if (kind !== "next") {
      result.title = textSlot(source.title, `Smoke ${kind} ${index + 1}`);
      result.summary = textSlot(source.summary, "A synthetic smoke-test output.");
      if (Object.hasOwn(source, "player_text")) result.player_text = String(source.player_text || "");
      if (Object.hasOwn(source, "criteria")) result.criteria = String(source.criteria || "");
      if (Object.hasOwn(source, "fallback")) result.fallback = source.fallback === true;
      if (Object.hasOwn(source, "default_mode")) result.default_mode = String(source.default_mode || "");
      if (Object.hasOwn(source, "effects")) result.effects = Array.isArray(source.effects) ? clone(source.effects) : [];
    }
    if (Array.isArray(source.dialogue_lines) && source.dialogue_lines.length) result.dialogue_lines = clone(source.dialogue_lines);
    if (Array.isArray(source.requirements)) result.requirements = clone(source.requirements);
    if (textSlot(source.travel_location_id, "")) result.travel_location_id = source.travel_location_id;
    if (textSlot(source.travel_location_name, "")) result.travel_location_name = source.travel_location_name;
    if (endingType) {
      result.ending_type = endingType;
      if (textSlot(source.ending_message, "")) result.ending_message = textSlot(source.ending_message, "");
    } else {
      result[targetField] = targetId;
      result.target_input_group_id = textSlot(source.target_input_group_id, "") || `${targetId}--from--${sourceId}--${kind}-${index + 1}`;
    }
    return result;
  }
  function devSmokeAuthoredObjective(objective = {}, index = 0) {
    const source = clone(objective || {});
    const id = textSlot(source.id, `smoke-objective-${index + 1}`);
    const control = ["player", "ai", "choice", "reward_only"].includes(source.completion_control) ? source.completion_control : "player";
    const result = {
      id,
      title: textSlot(source.title, `Smoke Objective ${index + 1}`),
      type: source.type === "side" ? "side" : "story",
      status: ["active", "hidden", "locked", "future", "queued", "complete"].includes(source.status) ? source.status : "future",
      summary: textSlot(source.summary, "A synthetic smoke-test objective."),
      while_active_guidance: textSlot(source.while_active_guidance, `Keep the smoke test focused on ${textSlot(source.title, id)}.`),
      completion_control: control
    };
    if (!["choice", "reward_only"].includes(control)) result.completion_criteria = textSlot(source.completion_criteria, `Complete ${textSlot(source.title, id)}.`);
    if (control === "reward_only") result.requirement_check_only = true;
    if (Array.isArray(source.completion_requirements)) result.completion_requirements = clone(source.completion_requirements);
    if (control === "choice") {
      result.choice_response_mode = ["optional_text", "exact_text"].includes(source.choice_response_mode) ? source.choice_response_mode : "optional_text";
      result.choices = (Array.isArray(source.choices) ? source.choices : []).map((choice, choiceIndex) => devSmokeAuthoredOutput(id, choice, choiceIndex, "choice"));
    } else if (source.route_control === "ai") {
      result.route_control = "ai";
      result.outcome_routes = (Array.isArray(source.outcome_routes) ? source.outcome_routes : []).map((route, routeIndex) => devSmokeAuthoredOutput(id, route, routeIndex, "route"));
    } else {
      result.next_objectives = (Array.isArray(source.next_objectives) ? source.next_objectives : []).map((output, outputIndex) => devSmokeAuthoredOutput(id, output, outputIndex, "next"));
    }
    const legacyCompletionInstruction = textSlot(source.completion_instruction, "");
    if (legacyCompletionInstruction) {
      const outputField = control === "choice" ? "choices" : source.route_control === "ai" ? "outcome_routes" : "next_objectives";
      for (const output of result[outputField] || []) if (!textSlot(output.completion_instruction, "")) output.completion_instruction = legacyCompletionInstruction;
    }
    for (const field of ["evaluate_ai_on_activation", "exclusive_group", "selectable", "locked_until_complete", "available_now", "blocked_reason", "notes", "completion_message", "travel_location_id", "travel_location_name"]) {
      if (Object.hasOwn(source, field) && source[field] !== undefined) result[field] = clone(source[field]);
    }
    if (Array.isArray(source.rewards)) result.rewards = clone(source.rewards);
    return result;
  }
  function devSmokeConnectAuthoredObjectives(objectives = [], sourceObjectives = [], options = {}) {
    const byId = new Map(objectives.map(objective => [objective.id, objective]));
    const incoming = new Set();
    const recordIncoming = () => {
      incoming.clear();
      for (const objective of objectives) {
        const field = objective.completion_control === "choice" ? "choices" : objective.route_control === "ai" ? "outcome_routes" : "next_objectives";
        const targetField = field === "next_objectives" ? "objective_id" : "next_objective_id";
        for (const output of objective[field] || []) if (!output?.ending_type && output?.[targetField]) incoming.add(output[targetField]);
        const rewardSources = [objective.rewards || [], ...(objective[field] || []).map(output => output?.rewards || [])];
        for (const rewards of rewardSources) for (const reward of rewards) if (reward?.type === "start_objective" && reward.objective_id) incoming.add(String(reward.objective_id));
      }
    };
    const addTransition = (sourceId, targetId, targetInputGroupId = "") => {
      const source = byId.get(sourceId);
      if (!source || !byId.has(targetId)) return;
      const field = source.completion_control === "choice" ? "choices" : source.route_control === "ai" ? "outcome_routes" : "next_objectives";
      const targetField = field === "next_objectives" ? "objective_id" : "next_objective_id";
      const outputs = source[field] || (source[field] = []);
      if (outputs.length && field !== "next_objectives") {
        for (let index = 0; index < outputs.length; index++) {
          const output = outputs[index];
          if (output[targetField]) continue;
          output[targetField] = targetId;
          output.target_input_group_id = targetInputGroupId || `${targetId}--from--${sourceId}--${field}-${index + 1}`;
        }
        return;
      }
      outputs.push(devSmokeAuthoredOutput(sourceId, {
        objective_id: targetId,
        target_input_group_id: targetInputGroupId
      }, outputs.length, field === "next_objectives" ? "next" : field === "choices" ? "choice" : "route"));
    };
    recordIncoming();
    for (let index = 0; index < sourceObjectives.length; index++) {
      const target = objectives[index];
      const requiredIds = sourceObjectives[index]?.requires || [];
      const requiredInputGroupId = requiredIds.length ? `${target.id}--required-inputs` : "";
      for (const sourceId of requiredIds) addTransition(String(sourceId), target.id, requiredInputGroupId);
    }
    recordIncoming();
    const start = objectives.find(objective => objective.status === "active") || objectives[0];
    if (options.connectOrphans !== false) {
      for (let index = 0; index < objectives.length; index++) {
        const objective = objectives[index];
        if (objective === start || incoming.has(objective.id)) continue;
        const previous = objectives[index - 1] || start;
        addTransition(previous.id, objective.id);
        recordIncoming();
        if (!incoming.has(objective.id) && previous !== start) {
          addTransition(start.id, objective.id);
          recordIncoming();
        }
      }
    }
    for (const objective of objectives) {
      const field = objective.completion_control === "choice" ? "choices" : objective.route_control === "ai" ? "outcome_routes" : "next_objectives";
      if ((objective[field] || []).length) continue;
      objective[field] = [{
        id: `${objective.id}-ending`,
        completion_instruction: objective.completion_instruction || `Resolve ${objective.title || objective.id}.`,
        rewards: [],
        ending_type: "freeplay",
        ending_message: textSlot(objective.ending_message || objective.completion_message, "The synthetic smoke-test route is complete.")
      }];
    }
    return objectives;
  }
  function devSmokeObjective(id, title, overrides = {}) {
    const objective = {
      id,
      title,
      type: overrides.type || "story",
      status: overrides.status || "future",
      summary: overrides.summary || `${title} for a fake smoke-test story.`,
      while_active_guidance: overrides.while_active_guidance || `Keep the fake smoke-test scene focused on ${title}.`,
      completion_control: overrides.completion_control || "player",
      completion_criteria: overrides.completion_criteria || `Complete ${title}.`,
      completion_instruction: overrides.completion_instruction || `Resolve ${title}.`,
      requires: Array.isArray(overrides.requires) ? overrides.requires : [],
      rewards: Array.isArray(overrides.rewards) ? overrides.rewards : [],
      choices: Array.isArray(overrides.choices) ? overrides.choices : undefined,
      next_objectives: Array.isArray(overrides.next_objectives) ? overrides.next_objectives : undefined,
      exclusive_group: overrides.exclusive_group || "",
      selectable: overrides.selectable,
      completion_message: overrides.completion_message || "",
      kind: overrides.kind
    };
    const endingType = ["freeplay", "ending", "game_over"].includes(overrides.ending_type) ? overrides.ending_type : "";
    if (endingType) {
      const field = objective.completion_control === "choice" ? "choices" : objective.route_control === "ai" ? "outcome_routes" : "next_objectives";
      const rows = Array.isArray(objective[field]) ? objective[field] : [];
      if (!rows.length) objective[field] = [{
        id: `${id}-ending`,
        completion_instruction: objective.completion_instruction,
        rewards: [],
        ending_type: endingType,
        ending_message: overrides.ending_message || ""
      }];
    }
    return objective;
  }
  function devSmokeStoryRecord(overrides = {}) {
    const title = overrides.title || "Smoke Fixture Story";
    const runtimePlayer = overrides.player || devSmokeRuntimeCharacter("Smoke Player", {
      gender: "female",
      role: "fake smoke-test player"
    });
    const sourceObjectives = (overrides.objectives || [devSmokeObjective("smoke-objective", "Smoke Objective", {
      status: "active"
    })]).map(clone);
    const objectives = devSmokeConnectAuthoredObjectives(sourceObjectives.map(devSmokeAuthoredObjective), sourceObjectives);
    const player = devSmokeEmbeddedCharacterDefinition(runtimePlayer.name, runtimePlayer);
    const characters = Object.fromEntries(Object.entries(overrides.characters || {}).map(([key, character]) => [key, devSmokeEmbeddedCharacterDefinition(character?.name || key, character)]));
    const npcDirectory = clone(overrides.npc_directory || {
      locations: {
        "smoke-fixture-room": {
          label: "Smoke Fixture Room",
          characters: {}
        }
      }
    });
    for (const location of Object.values(npcDirectory.locations || {})) {
      for (const [key, npc] of Object.entries(location.characters || {})) {
        if (!npc?.full_character) continue;
        const fullCharacter = devSmokeEmbeddedCharacterDefinition(npc.full_character.name || npc.name || key, npc.full_character);
        location.characters[key] = {
          name: textSlot(npc.name, fullCharacter.name || key),
          age: Number.isFinite(npc.age) ? npc.age : fullCharacter.age,
          gender: textSlot(npc.gender, fullCharacter.gender),
          role: textSlot(npc.role, fullCharacter.role),
          relationship: textSlot(npc.relationship, fullCharacter.starting_relationship_to_player),
          note: textSlot(npc.note, "Fake smoke-test NPC."),
          inspected: true,
          full_character: fullCharacter
        };
      }
    }
    const futureCast = clone(overrides.future_cast || {
      enabled: false,
      items: {}
    });
    futureCast.enabled = futureCast.enabled === true || Object.keys(futureCast.items || {}).length > 0;
    futureCast.items ||= {};
    for (const [id, entry] of Object.entries(futureCast.items)) {
      delete entry.profile_images;
      delete entry.images;
      entry.id = id;
      entry.scene_presence = ["nearby", "none"].includes(entry.scene_presence) ? entry.scene_presence : "none";
      if (entry.full_character) entry.full_character = devSmokeEmbeddedCharacterDefinition(entry.full_character.name || entry.name || id, entry.full_character);else if (!entry.animal_definition) entry.full_character = devSmokeEmbeddedCharacterDefinition(entry.name || id, devSmokeRuntimeCharacter(entry.name || id, {
        gender: entry.gender || "female",
        role: entry.role || "fake future-cast character"
      }));
    }
    const locationId = textSlot(overrides.npc_location_id || overrides.location?.npc_location_id, "smoke-fixture-room");
    const state = {
      meta: {
        app: "EmberAdventures",
        genres: overrides.genres || ["fantasy"],
        story_guidance: overrides.story_guidance || "Fake smoke fixture story guidance.",
        story_source: {
          mode: "original",
          title,
          description: overrides.description || "A fake smoke fixture story.",
          modifications: []
        },
        default_image_model: selectedImageModel(overrides.default_image_model || app.settings?.imageModel)
      },
      player,
      players: (overrides.players || []).map(option => devSmokeEmbeddedCharacterDefinition(option.name, option)),
      characters,
      future_cast: futureCast,
      location: {
        universe: "Smoke Fixture Universe",
        world: "Smoke Fixture World",
        continent: "Smoke Fixture Continent",
        region: "Smoke Fixture Region",
        settlement_type: "test settlement",
        settlement_name: "Smoke Fixture Settlement",
        district: "Smoke Fixture District",
        specific_place: "Smoke Fixture Room",
        npc_location_id: locationId,
        ...(overrides.location || {})
      },
      npc_directory: npcDirectory,
      scene: {
        summary: overrides.scene_summary || "A fake smoke fixture scene.",
        party_members_present: overrides.party_members_present || Object.keys(characters),
        image_characters: overrides.image_characters || [],
        npcs_present: overrides.npcs_present || [],
        image_action: overrides.image_action || "standing in a fake smoke fixture scene"
      },
      story_rules: overrides.story_rules || [],
      story_inventory: {
        items: [],
        ...(overrides.story_inventory || {})
      },
      world_flags: overrides.world_flags || {},
      world_map: overrides.world_map || {
        current_location_id: locationId,
        focus_location_id: locationId,
        travel_history: [locationId],
        locations: {
          [locationId]: {
            id: locationId,
            name: "Smoke Fixture Room",
            type: "place",
            scale: "site",
            parent_id: "",
            x: 0,
            y: 0,
            discovered: true,
            travel_enabled: true,
            summary: "A clearly fake room for smoke tests.",
            detail: {},
            npcs: overrides.npcs_present || [],
            connections: []
          }
        }
      },
      objectives: {
        active_id: overrides.active_id || "smoke-objective",
        no_current: false,
        items: objectives
      },
      time: {
        year: 1,
        month: 1,
        day: 1,
        hour: 12,
        minute: 0
      },
      story_memory: {
        world_notes: [],
        unresolved_threads: [],
        relationship_notes: [],
        rules_and_constraints: [],
        ai_private_notes: []
      },
      recent_changes: [],
      story_clock: {
        elapsed_minutes: 0,
        label: "Day 1, 12:00 PM"
      },
      story_pacing: {
        mode: "player_controlled",
        pending_event_id: "",
        timeline: {}
      },
      timed_events: {}
    };
    const now = new Date().toISOString();
    return validatedStoryTemplateRecord({
      id: overrides.id || `smoke-fixture-story-${Date.now()}`,
      title,
      description: overrides.description || "A fake smoke fixture story.",
      source: textSlot(overrides.source, "Original"),
      creation_tool: "debug harness",
      genres: overrides.genres || ["fantasy"],
      createdAt: now,
      updatedAt: now,
      allow_any_player: overrides.allow_any_player === true,
      any_player_starting_state: clone(overrides.any_player_starting_state || {}),
      app: "EmberAdventures",
      templateType: "story",
      default_image_model: selectedImageModel(overrides.default_image_model || app.settings?.imageModel),
      title_card_subjects: overrides.title_card_subjects || [title],
      title_card_image: overrides.title_card_image === undefined ? {
        id: `${objectiveIdFromTitle(title, "story")}-title-card`,
        title: `${title} title card`,
        prompt: `Smoke title card for ${title}.`,
        negativePrompt: "text, logo, watermark",
        seed: 0,
        model: selectedImageModel(app.settings?.imageModel),
        source: "hosted",
        url: devSmokePublicImageUrl("story-title-card", title),
        hosted_url: devSmokePublicImageUrl("story-title-card", title),
        html: "",
        favorite: false
      } : overrides.title_card_image,
      state,
      messages: overrides.messages || [{
        role: "assistant",
        speaker: "Narrator",
        text: overrides.opening_text || "The fake smoke fixture begins.",
        at: new Date().toISOString()
      }]
    });
  }
  function devSmokePlayerSelectTemplate({
    id = "smoke-fixture-player-select-story",
    title = "Smoke Fixture Player Select Story",
    optionNames = ["Smoke Option One", "Smoke Option Two", "Smoke Option Three", "Smoke Option Four"]
  } = {}) {
    const players = optionNames.map((name, index) => devSmokeRuntimeCharacter(name, {
      gender: index === 0 ? "male" : "female",
      role: `fake player option ${index + 1}`,
      seed: 0,
      profile_image_id: `${objectiveIdFromTitle(name)}-select-profile`,
      profile_images: [{
        id: `${objectiveIdFromTitle(name)}-select-profile`,
        male: index === 0,
        html: '<img alt="Smoke profile" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=">',
        favorite: true,
        profile: true,
        seed: 0
      }]
    }));
    return devSmokeStoryRecord({
      id,
      title,
      description: "A fake smoke fixture with four player-select options.",
      player: players[0],
      players,
      active_id: "choose-smoke-route",
      objectives: [devSmokeObjective("choose-smoke-route", "Choose the Smoke Route", {
        status: "active",
        summary: "Start the fake player-select story.",
        ending_type: "freeplay",
        ending_message: "The selected smoke-test character begins open-ended play."
      })],
      opening_text: 'The fake route waits for |[player_name]|. (|[player_name]|) "Ready."'
    });
  }
  function devSmokeObjectiveChainTemplate() {
    const objectives = [devSmokeObjective("choose-tessas-first-retort", "Choose the First Fake Retort", {
      status: "active",
      summary: "Begin the fake objective chain.",
      next_objectives: [{
        objective_id: "force-the-contract-onto-the-table"
      }]
    }), devSmokeObjective("force-the-contract-onto-the-table", "Force the Fake Contract", {
      status: "future",
      requires: ["choose-tessas-first-retort"],
      next_objectives: [{
        objective_id: "fake-chain-follow-up"
      }]
    }), devSmokeObjective("fake-chain-follow-up", "Finish the Fake Chain", {
      status: "future",
      requires: ["force-the-contract-onto-the-table"],
      completion_message: "The fake objective chain is complete."
    }), devSmokeObjective("fake-side-objective", "Optional Fake Side Objective", {
      type: "side",
      status: "queued",
      summary: "A side objective for left-panel grouping."
    })];
    return devSmokeStoryRecord({
      id: "smoke-fixture-objective-chain-story",
      title: "Smoke Fixture Objective Chain",
      player: devSmokeRuntimeCharacter("Smoke Chain Tester", {
        gender: "female",
        role: "fake chain tester"
      }),
      characters: {
        "Smoke Chain Ally": devSmokeRuntimeCharacter("Smoke Chain Ally", {
          gender: "female",
          role: "fake party ally"
        })
      },
      npc_directory: {
        locations: {
          "smoke-fixture-room": {
            label: "Smoke Fixture Room",
            characters: {
              "Smoke Chain NPC": {
                name: "Smoke Chain NPC",
                inspected: true,
                full_character: devSmokeRuntimeCharacter("Smoke Chain NPC", {
                  gender: "female",
                  role: "fake local npc"
                })
              }
            }
          }
        }
      },
      npcs_present: ["Smoke Chain NPC"],
      objectives,
      active_id: "choose-tessas-first-retort",
      opening_text: "A fake objective-chain smoke story begins."
    });
  }
  function devSmokeEnsembleReplacementTemplate() {
    const futureCharacter = devSmokeRuntimeCharacter("Smoke Future Ally", {
      gender: "female",
      role: "fake future ally",
      id: "smoke-future-ally"
    });
    const chainIds = ["leave-the-barn", "prepare-the-vale-trip", "recognize-the-need-for-sherry", "meet-sherry", "defeat-the-bandits", "defeat-the-bandit-leader", "fake-main-07", "fake-main-08", "fake-main-09", "fake-main-10", "fake-main-11", "fake-main-12", "fake-main-13", "fake-main-14", "fake-main-15"];
    const titles = {
      "leave-the-barn": "Leave the Fake Barn",
      "prepare-the-vale-trip": "Prepare the Fake Vale Trip",
      "recognize-the-need-for-sherry": "Recognize the Need for a Fake Ally",
      "meet-sherry": "Meet the Fake Ally",
      "defeat-the-bandits": "Defeat the Fake Bandits",
      "defeat-the-bandit-leader": "Defeat the Fake Bandit Leader"
    };
    const objectives = chainIds.map((id, index) => devSmokeObjective(id, titles[id] || `Fake Main Objective ${index + 1}`, {
      status: index === 0 ? "active" : "future",
      requires: [],
      next_objectives: index < chainIds.length - 1 ? [{
        id: `${id}--continue`,
        objective_id: chainIds[index + 1],
        target_input_group_id: `${chainIds[index + 1]}--input`,
        completion_instruction: `Continue into ${titles[chainIds[index + 1]] || `Fake Main Objective ${index + 2}`}.`
      }] : [],
      completion_control: id === "defeat-the-bandits" || id === "defeat-the-bandit-leader" ? "ai" : "player",
      rewards: id === "meet-sherry" ? [{
        type: "introduce_future_character",
        character_id: "smoke-future-ally",
        npc_location_id: "smoke-fixture-room",
        scene_presence: "nearby",
        reason: "Introduce the fake future ally for the smoke objective."
      }] : [],
      completion_message: index === chainIds.length - 1 ? "The fake objective graph is complete." : "",
      ending_type: index === chainIds.length - 1 ? "freeplay" : undefined,
      ending_message: index === chainIds.length - 1 ? "The fake objective graph enters open-ended play." : undefined
    }));
    objectives.push(devSmokeObjective("fake-side-favor", "Fake Optional Favor", {
      type: "side",
      status: "queued",
      summary: "A fake optional side objective."
    }));
    const player = devSmokeRuntimeCharacter("Smoke Objective Tester", {
      gender: "female",
      role: "fake objective tester"
    });
    const localProfileUrl = devSmokeOnePixelDataUrl();
    const localNonMaleProfile = profileImageSlotFromExactInput({
      ...devSmokeDefaultProfileImage("Smoke Objective Tester", false),
      url: localProfileUrl,
      source: "smoke local profile",
      prompt: "Smoke Objective Tester profile image.",
      male: false
    });
    const localMaleProfile = profileImageSlotFromExactInput({
      ...devSmokeDefaultProfileImage("Smoke Objective Tester Male", true),
      url: localProfileUrl,
      source: "smoke local profile",
      prompt: "Smoke Objective Tester male profile image.",
      male: true
    });
    // This startup fixture verifies that a supplied portrait is copied
    // immediately; keep it local so it does not depend on example.com.
    player.default_profile_image = clone(localNonMaleProfile);
    player.profile_image_presentations = {
      male: localMaleProfile,
      non_male: localNonMaleProfile
    };
    return devSmokeStoryRecord({
      id: "smoke-fixture-objective-graph-story",
      title: "Smoke Fixture Objective Chain",
      player,
      objectives,
      active_id: "leave-the-barn",
      future_cast: {
        items: {
          "smoke-future-ally": {
            id: "smoke-future-ally",
            name: "Smoke Future Ally",
            status: "future",
            full_character: devSmokeEmbeddedCharacterDefinition("Smoke Future Ally", futureCharacter)
          }
        }
      },
      opening_text: "Smoke Objective Tester wakes in a fake barn for a synthetic objective graph."
    });
  }
  
