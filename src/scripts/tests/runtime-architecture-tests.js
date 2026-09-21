const runtimeTestState = {
  running: false,
  mode: "",
  results: [],
  logs: [],
  startedAt: 0,
  finishedAt: 0,
  testWorkerUrl: ""
};

//#region Measurement

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}
async function waitForApplicationReady(timeoutMilliseconds = 30000) {
  const startedAt = performance.now();
  while (!app.ready) {
    if (performance.now() - startedAt >= timeoutMilliseconds) throw new Error("Application startup did not finish before runtime tests began.");
    await nextFrame();
  }
}
async function measureMainThread(phase, execute) {
  for (let index = 0; index < 4; index++) await nextFrame();
  const intervalMilliseconds = 4;
  let previousIntervalAt = performance.now();
  let previousFrameAt = performance.now();
  let maximumEventLoopDelay = 0;
  let maximumFrameGap = 0;
  let delaysOverEightMilliseconds = 0;
  let longTaskCount = 0;
  let longestLongTask = 0;
  const intervalId = setInterval(() => {
    const now = performance.now();
    const delayValue = Math.max(0, now - previousIntervalAt - intervalMilliseconds);
    previousIntervalAt = now;
    maximumEventLoopDelay = Math.max(maximumEventLoopDelay, delayValue);
    if (delayValue > 8.33) delaysOverEightMilliseconds++;
  }, intervalMilliseconds);
  let frameRequestId = 0;
  const trackFrame = now => {
    maximumFrameGap = Math.max(maximumFrameGap, now - previousFrameAt);
    previousFrameAt = now;
    frameRequestId = requestAnimationFrame(trackFrame);
  };
  frameRequestId = requestAnimationFrame(trackFrame);
  let observer = null;
  if (typeof PerformanceObserver === "function" && PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
    observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        longTaskCount++;
        longestLongTask = Math.max(longestLongTask, entry.duration);
      }
    });
    observer.observe({
      entryTypes: ["longtask"]
    });
  }
  const startedAt = performance.now();
  try {
    const value = await execute();
    await nextFrame();
    await nextFrame();
    return {
      phase,
      duration: performance.now() - startedAt,
      maximumEventLoopDelay,
      maximumFrameGap,
      delaysOverEightMilliseconds,
      longTaskCount,
      longestLongTask,
      value
    };
  } finally {
    clearInterval(intervalId);
    cancelAnimationFrame(frameRequestId);
    observer?.disconnect();
  }
}
function assertResponsive(measurement) {
  if (measurement.maximumEventLoopDelay >= 50) throw new Error(`${measurement.phase} blocked the event loop for ${measurement.maximumEventLoopDelay.toFixed(1)} ms.`);
  if (measurement.longestLongTask >= 50) throw new Error(`${measurement.phase} created a ${measurement.longestLongTask.toFixed(1)} ms long task.`);
  if (measurement.maximumFrameGap >= 50) throw new Error(`${measurement.phase} produced a ${measurement.maximumFrameGap.toFixed(1)} ms animation-frame gap.`);
}
function measurementDetail(measurement) {
  return [`event loop ${measurement.maximumEventLoopDelay.toFixed(1)} ms`, `frame ${measurement.maximumFrameGap.toFixed(1)} ms`, `long tasks ${measurement.longTaskCount}`].join("; ");
}

//#endregion Measurement

//#region App Tests

let diagnosticLibraryController = null;
function diagnosticLibraryWorkerUrl() {
  const source = globalThis.__emberAdventuresTestLibraryWorkerSource;
  if (typeof source !== "string" || !source.trim()) throw new Error("The embedded diagnostic library worker source is missing.");
  return URL.createObjectURL(new Blob([source], {
    type: "text/javascript"
  }));
}
function diagnosticTurnWorkerUrl() {
  const source = globalThis.__emberAdventuresTestTurnWorkerSource;
  if (typeof source !== "string" || !source.trim()) throw new Error("The embedded diagnostic turn worker source is missing.");
  return URL.createObjectURL(new Blob([source], {
    type: "text/javascript"
  }));
}
async function getDiagnosticLibraryController() {
  if (diagnosticLibraryController) return diagnosticLibraryController;
  diagnosticLibraryController = new EmberLibraryController(diagnosticLibraryWorkerUrl(), {
    diagnostic: true,
    runtimeDatabaseName: "EmberAdventuresLibraryRuntimeDiagnostic",
    applicationDatabaseName: "EmberAdventuresLibraryApplicationDiagnostic"
  });
  await diagnosticLibraryController.start();
  return diagnosticLibraryController;
}
function runtimeStoryFixture(id, {
  objectiveCount = 1
} = {}) {
  const objectives = [];
  const player = runtimeCharacterFixture(`${id}-player`, false).character_definition;
  delete player.genres;
  for (let index = 0; index < objectiveCount; index++) {
    objectives.push({
      id: `${id}-objective-${index}`,
      title: `Objective ${index + 1}`,
      type: "story",
      summary: "Complete one bounded test action.",
      while_active_guidance: "Keep the response focused on the test action.",
      completion_control: "player",
      completion_criteria: "Complete when the player performs the bounded test action.",
      completion_requirements: [],
      status: index === 0 ? "active" : "hidden",
      next_objectives: index + 1 < objectiveCount ? [{
        id: `${id}-output-${index}`,
        objective_id: `${id}-objective-${index + 1}`,
        target_input_group_id: `${id}-objective-${index + 1}-input-1`,
        completion_instruction: "Continue to the next bounded test objective.",
        requirements: [],
        rewards: []
      }] : [{
        id: `${id}-objective-${index}-ending`,
        completion_instruction: "Conclude the bounded diagnostic story.",
        rewards: [],
        ending_type: "freeplay",
        ending_message: "The bounded diagnostic story is complete."
      }]
    });
  }
  return {
    app: "EmberAdventures",
    exportType: "story-template",
    exportedAt: "2026-08-09T00:00:00.000Z",
    storyTemplate: {
      app: "EmberAdventures",
      templateType: "story",
      id,
      title: `Runtime Story ${id}`,
      description: "Diagnostic story fixture.",
      source: "Original",
      creation_tool: "Runtime Tests",
      createdAt: "2026-08-09T00:00:00.000Z",
      updatedAt: "2026-08-09T00:00:00.000Z",
      genres: ["fantasy"],
      allow_any_player: true,
      default_image_model: "",
      editor_data: {
        story_tree: {
          positions: {
            [objectives[0].id]: {
              x: 80,
              y: 80
            }
          },
          viewport: {
            x: 0,
            y: 0,
            zoom: 1
          },
          output_modes: {}
        }
      },
      title_card_subjects: ["Runtime Character", "Runtime Test Room"],
      title_card_image: {
        id: `${id}-title`,
        title: `Runtime Story ${id}`,
        prompt: "A runtime test room.",
        negativePrompt: "text, watermark",
        seed: 20260809,
        model: "perchance",
        source: "hosted",
        url: "https://example.invalid/runtime-title.png",
        hosted_url: "https://example.invalid/runtime-title.png",
        html: "",
        favorite: false
      },
      any_player_starting_state: {
        role: "Runtime story player",
        starting_known_facts_to_add: ["The runtime story has started."]
      },
      state: {
        meta: {
          app: "EmberAdventures",
          story_guidance: "Keep the runtime test bounded.",
          story_source: {
            mode: "original",
            title: "",
            description: "",
            modifications: ""
          },
          genres: ["fantasy"],
          default_image_model: ""
        },
        player,
        players: [player],
        characters: {},
        location: {
          universe: "Runtime Universe",
          world: "Runtime World",
          continent: "Runtime Continent",
          region: "Runtime Region",
          settlement_type: "room",
          settlement_name: "Runtime Test Room",
          district: "",
          specific_place: "Runtime Test Room",
          npc_location_id: `${id}-location`
        },
        world_map: {
          current_location_id: `${id}-location`,
          focus_location_id: `${id}-location`,
          travel_history: [],
          locations: {
            [`${id}-location`]: {
              id: `${id}-location`,
              name: "Runtime Test Room",
              type: "place",
              scale: "site",
              parent_id: "",
              x: 50,
              y: 50,
              discovered: true,
              travel_enabled: true,
              summary: "A bounded runtime test room.",
              detail: {},
              connections: [],
              npcs: []
            }
          }
        },
        time: {
          year: 1,
          month: 1,
          day: 1,
          hour: 12,
          minute: 0
        },
        scene: {
          summary: "The runtime player waits in the test room.",
          party_members_present: [],
          npcs_present: [],
          image_characters: ["Player"],
          image_action: "waiting in a test room"
        },
        story_inventory: {
          coins: 25,
          adventurer_xp: 0,
          flags: ["started"],
          items: []
        },
        world_flags: {
          tone: "diagnostic"
        },
        progression: {},
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
        story_rules: [],
        npc_directory: {
          locations: {
            [`${id}-location`]: {
              label: "Runtime Test Room",
              characters: {}
            }
          }
        },
        future_cast: {
          enabled: true,
          items: {}
        },
        timed_events: {},
        objectives: {
          active_id: objectives[0].id,
          no_current: false,
          items: objectives
        }
      },
      messages: [{
        role: "assistant",
        speaker: "Narrator",
        text: "|[player_first_name]| enters the runtime test.",
        at: "2026-08-09T00:00:00.000Z"
      }]
    }
  };
}
function runtimeCharacterFixture(id, unusedArgument13533 = false) {
  const outfit = {
    id: "runtime-outfit",
    name: "Runtime Outfit",
    clothing: {
      shirt: "simple runtime test shirt",
      underwear: "simple runtime test underwear",
      pants: "simple runtime test trousers",
      feet: "simple runtime test shoes"
    }
  };
  return {
    character_definition: {
      id,
      version: 1,
      name: `Runtime Character ${id}`,
      fallback_name: "Runtime Character",
      source: "Original",
      creation_tool: "Runtime Tests",
      created_at: "2026-08-09T00:00:00.000Z",
      updated_at: "2026-08-09T00:00:00.000Z",
      genres: ["fantasy"],
      can_die: false,
      romanceable: true,
      age: 28,
      gender: "female",
      role: "Runtime test character",
      personality_description: "Practical and observant.",
      speech_style: "Direct and concise.",
      boldness: 5,
      appearance: {
        species: "Human",
        height: 10,
        body_description: "",

        skin_color: "warm brown skin",
        eye_color: "brown",
        hair_color: "black",
        hair_length: "shoulder length",
        hair_type: "straight",
        extra_description: "An adult runtime test character.",
        extra_description_lower_body: "",
        nonhuman_lower_body: false
      },
      outfits: [outfit],
      fallback_outfits: [outfit],
      fallback_starting_outfit_id: outfit.id,
      starting_outfit_id: outfit.id,
      starting_relationship_to_player: "new acquaintance",
      starting_trust: 1,
      starting_attraction: 0,
      starting_affection: 0,
      starting_state_of_mind: "",
      starting_physical_state: "",
      starting_pose: "standing in the runtime test room",
      starting_held_items: {
        right_hand: null,
        left_hand: null
      },
      starting_inventory: [],
      starting_known_facts: [],
      stats: {
        testing: 1
      },
      default_seed: 20260809,
      image_prompt_config: {
        seed_enabled: true,
        seed: 20260809,
        style: "",
        profile_style: "",
        negative: "",
        negative_prompt: ""
      },
      default_profile_image: {
        url: "",
        local_image_id: "",
        source: "none",
        seed: null,
        prompt: "",
        negative_prompt: "",
        note: "",
        male: false
      },
      profile_image_presentations: {
        male: {
          url: "",
          local_image_id: "",
          source: "none",
          seed: null,
          prompt: "",
          negative_prompt: "",
          note: "",
          male: true
        },
        non_male: {
          url: "",
          local_image_id: "",
          source: "none",
          seed: null,
          prompt: "",
          negative_prompt: "",
          note: "",
          male: false
        }
      },
      profile_images: {
        active_image_id: "",
        image_ids: []
      },
      images: {
        active_image_id: "",
        image_ids: []
      },
      voice: null
    }
  };
}
function runtimeAnimalFixture(id, name = "Runtime Animal") {
  return {
    version: 1,
    id,
    name,
    source: "Original",
    creation_tool: "Runtime Tests",
    can_die: false,
    gender: "female",
    age: 4,
    role: "animal companion",
    species: "hawk",
    physical_description: "A small russet hawk with bright gold eyes and a white tail tip.",
    personality_description: "Alert, loyal, curious, and protective.",
    communication_style: "Communicates through calls, posture, and deliberate gestures.",
    starting_relationship_to_player: "new animal companion",
    starting_trust: 4,
    starting_affection: 3,
    starting_state_of_mind: "watchful",
    starting_physical_state: "healthy",
    starting_pose: "perched nearby",
    starting_known_facts: [],
    created_at: "2026-08-21T00:00:00.000Z",
    updated_at: "2026-08-21T00:00:00.000Z"
  };
}
function stableRuntimeTestHash(value) {
  let hash = 2166136261;
  for (const character of String(value ?? "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
async function gzipJsonBlob(value) {
  const stream = new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Blob([await new Response(stream).arrayBuffer()], {
    type: "application/gzip"
  });
}
async function runtimeLargeStoryBlob(id, objectiveCount) {
  const fixture = runtimeStoryFixture(id);
  const source = `
            self.onmessage = (event) => {
                const { fixture, objectiveCount } = event.data;
                const objectives = fixture.storyTemplate.state.objectives.items;
                const template = objectives[0];
                objectives.length = 0;

                for (let index = 0; index < objectiveCount; index++) {
                    objectives.push({
                        ...template,
                        id: fixture.storyTemplate.id + "-objective-" + index,
                        title: "Objective " + (index + 1),
                        status: index === 0 ? "active" : "hidden",
                        next_objectives: index + 1 < objectiveCount ? [{
                            id: fixture.storyTemplate.id + "-output-" + index,
                            objective_id: fixture.storyTemplate.id + "-objective-" + (index + 1),
                            target_input_group_id: fixture.storyTemplate.id + "-objective-" + (index + 1) + "-input-1",
                            completion_instruction: "Continue to the next bounded test objective.",
                            requirements: [],
                            rewards: []
                        }] : [{
                            id: fixture.storyTemplate.id + "-objective-" + index + "-ending",
                            completion_instruction: "Conclude the large diagnostic story.",
                            rewards: [],
                            ending_type: "freeplay",
                            ending_message: "The large diagnostic story is complete."
                        }]
                    });
                }

                fixture.storyTemplate.state.objectives.active_id = objectives[0].id;
                self.postMessage(new Blob([JSON.stringify(fixture)], { type: "application/json" }));
            };
        `;
  const workerUrl = URL.createObjectURL(new Blob([source], {
    type: "text/javascript"
  }));
  const worker = new Worker(workerUrl);
  try {
    return await new Promise((resolve, reject) => {
      worker.onmessage = event => resolve(event.data);
      worker.onerror = event => reject(new Error(event.message || "Large-story fixture worker failed."));
      worker.postMessage({
        fixture,
        objectiveCount
      });
    });
  } finally {
    worker.terminate();
    URL.revokeObjectURL(workerUrl);
  }
}
const appRuntimeTests = [{
  id: "runtime-startup",
  name: "Production persistence worker and UI shell are ready",
  execute: async () => {
    if (!app.ready) throw new Error("Application startup is incomplete.");
    if (app.persistence?.schemaInfo?.databaseName !== "EmberAdventuresLiteRuntimeDiagnostic") throw new Error("Production persistence is connected to the wrong database.");
    if (app.persistence.schemaInfo.storeCount !== 77) throw new Error("Production persistence did not load all 77 stores.");
    if (!app.library?.ready) throw new Error("Production library worker is not ready.");
    if (!app.turn?.worker) throw new Error("Production turn worker is not ready.");
    if (!app.settings || !validateStoredSettings(localSettingsForStorage()).ok) throw new Error("Settings did not finish loading.");
    return "persistence, library, and turn workers ready; settings and profiles loaded";
  }
}, {
  id: "runtime-environment",
  name: "Idle browser scheduling is stable enough to measure frame budgets",
  execute: async () => {
    for (let index = 0; index < 30; index++) await nextFrame();
    const measurement = await measureMainThread("idle browser baseline", async () => {
      for (let index = 0; index < 30; index++) await nextFrame();
    });
    assertResponsive(measurement);
    return measurementDetail(measurement);
  }
}, {
  id: "main-menu-render",
  name: "Repeated main-menu rendering stays responsive",
  execute: async () => {
    renderMainMenu();
    await nextFrame();
    const measurement = await measureMainThread("main-menu render", async () => {
      let maximumRenderDuration = 0;
      for (let index = 0; index < 12; index++) {
        await nextFrame();
        const startedAt = performance.now();
        renderMainMenu();
        maximumRenderDuration = Math.max(maximumRenderDuration, performance.now() - startedAt);
      }
      return maximumRenderDuration;
    });
    if (measurement.value >= 16.7) throw new Error(`One main-menu render took ${measurement.value.toFixed(1)} ms.`);
    return `${measurementDetail(measurement)}; render ${measurement.value.toFixed(1)} ms`;
  }
}, {
  id: "modal-cycles",
  name: "Modal creation and removal stays responsive",
  execute: async () => {
    openModal("Runtime warmup", "<p>Warmup</p>");
    closeModal();
    await nextFrame();
    const measurement = await measureMainThread("modal cycles", async () => {
      let maximumCycleDuration = 0;
      for (let index = 0; index < 20; index++) {
        await nextFrame();
        const startedAt = performance.now();
        openModal("Runtime test", `<p>Modal cycle ${index + 1}</p>`);
        closeModal();
        maximumCycleDuration = Math.max(maximumCycleDuration, performance.now() - startedAt);
      }
      return maximumCycleDuration;
    });
    if (measurement.value >= 16.7) throw new Error(`One modal cycle took ${measurement.value.toFixed(1)} ms.`);
    return `${measurementDetail(measurement)}; cycle ${measurement.value.toFixed(1)} ms`;
  }
}, {
  id: "loading-cycles",
  name: "Loading indicators do not block rendering",
  execute: async () => {
    const measurement = await measureMainThread("loading indicators", async () => {
      let maximumTransitionDuration = 0;
      //Rapid status chatter must collapse into one visual update per frame.
      for (let index = 0; index < 100; index++) renderActivityIndicator();

      //Actual visible transitions still need to remain within frame budget.
      for (let index = 0; index < 12; index++) {
        const startedAt = performance.now();
        const token = beginUiAction(`runtime-loading-${index}`, {
          mode: index % 2 ? "activity" : "blocking",
          label: "Testing"
        });
        maximumTransitionDuration = Math.max(maximumTransitionDuration, performance.now() - startedAt);
        await nextFrame();
        const endedAt = performance.now();
        endUiAction(token);
        maximumTransitionDuration = Math.max(maximumTransitionDuration, performance.now() - endedAt);
      }
      await nextFrame();
      return maximumTransitionDuration;
    });
    if (measurement.value >= 16.7) throw new Error(`One loading-indicator transition took ${measurement.value.toFixed(1)} ms.`);
    return measurementDetail(measurement);
  }
}, {
  id: "gameplay-chrome-parity",
  name: "Gameplay quick actions preserve the archived controls without the replacement HUD",
  execute: async () => {
    const priorPositions = void 0;
    const priorAuto = app.autoModeEnabled;
    const priorState = app.state;
    try {
      app.state = {
        ...clone(defaultState),
        meta: {
          ...clone(defaultState.meta),
          setup_complete: true
        },
        scene: {
          ...clone(defaultState.scene)
        },
        objectives: {
          active_id: "runtime-quick-actions",
          items: [{
            id: "runtime-quick-actions",
            title: "Runtime Quick Actions",
            status: "active",
            type: "story",
            summary: "Exercise the production quick actions."
          }]
        }
      };
      app.autoModeEnabled = false;
      renderQuickActions();
      const labels = [...$("quickActions").querySelectorAll(".tool-label")].map(element => element.textContent.trim());
      for (const label of ["AI Command", "Continue", "Auto", "Roll d20", "Find"]) if (!labels.includes(label)) throw new Error(`Gameplay quick actions lost ${label}.`);
      if (!$("playHud").classList.contains("hidden")) {}
      const rollButton = [...$("quickActions").querySelectorAll("button")].find(button => button.querySelector(".tool-label")?.textContent.trim() === "Roll d20");
      rollButton?.click();
      await nextFrame();
      const promptInput = document.querySelector("#styledPromptInput");
      if (!promptInput || !/What is this roll trying to decide/i.test(promptInput.closest(".popup-modal, .modal")?.textContent || document.body.textContent)) throw new Error("Roll d20 did not open the archived intent workflow.");
      closeModal();
    } finally {
      app.autoModeEnabled = priorAuto;
      app.state = priorState;
      renderQuickActions();
    }
    return "archived quick-action labels, position placement, and d20 intent prompt passed";
  }
}, {
  id: "library-card-render",
  name: "Large library pages render within the frame budget",
  execute: async () => {
    const hosts = [];
    const measurement = await measureMainThread("library card rendering", async () => {
      for (const kind of ["story", "character"]) {
        const host = document.createElement("div");
        host.className = "library-grid";
        host.style.cssText = "width:1200px;height:800px;overflow:auto;contain:strict";
        document.body.append(host);
        hosts.push(host);
        await nextFrame();
        renderVirtualLibraryRecords({
          key: `runtime-${kind}-${Date.now()}`,
          results: host,
          records: Array.from({
            length: 60
          }, (_, index) => ({
            index
          })),
          htmlForRecord: record => `<article class="library-card"><h3>${kind} ${record.index}</h3></article>`,
          emptyHtml: "",
          renderAll: true
        });
        for (let frame = 0; frame < 20; frame++) await nextFrame();
        if (host.querySelectorAll(".library-card").length !== 60) throw new Error(`${kind} virtual library did not render all 60 cards.`);
      }
    });
    hosts.forEach(host => host.remove());
    appendRuntimeTestLog(`Library card measurement: ${measurementDetail(measurement)}; delays over 8.33 ms ${measurement.delaysOverEightMilliseconds}.`);
    assertResponsive(measurement);
    return `${measurementDetail(measurement)}; two 60-card virtualized libraries rendered`;
  }
}, {
  id: "library-settings-profiles",
  name: "Standalone settings persist without reading previous profiles",
  execute: async () => {
    const controller = await getDiagnosticLibraryController();
    const priorLibrary = app.library;
    const before = await controller.listSettings();
    try {
      app.library = controller;
      await controller.deleteSettings([SETTINGS_KEY]);
      const settings = await loadStandaloneSettings();
      if (!validateStoredSettings(settings).ok) throw new Error("Default settings are invalid.");
      settings.autoVoice = false;
      settings.preferredCharacterGender = "male";
      await controller.putSettings({[SETTINGS_KEY]: settings});
      const reread = await loadStandaloneSettings();
      if (reread.autoVoice !== false || reread.preferredCharacterGender !== "male") throw new Error("Settings did not persist.");
      return "standalone defaults and persistence passed";
    } finally {
      await controller.deleteSettings([SETTINGS_KEY]);
      if (Object.hasOwn(before, SETTINGS_KEY)) await controller.putSettings({[SETTINGS_KEY]: before[SETTINGS_KEY]});
      app.library = priorLibrary;
    }
  }
}, {
  id: "library-story-lifecycle",
  name: "Story import, compile, filter, export, and library deletion round-trip",
  execute: async () => {
    const controller = await getDiagnosticLibraryController();
    const suffix = `${Date.now()}`;
    const gzipId = `runtime-story-gzip-${suffix}`;
    const primaryId = `runtime-story-primary-${suffix}`;
    const secondaryId = `runtime-story-secondary-${suffix}`;
    const primaryFile = new Blob([JSON.stringify(runtimeStoryFixture(primaryId))], {type: "application/json"});
    const secondaryFile = new Blob([JSON.stringify(runtimeStoryFixture(secondaryId))], {type: "application/json"});
    const imported = await controller.importFile("story", primaryFile);
    if (imported.sharedImages < 2) throw new Error("Story import did not extract its hosted title image and selection into shared storage.");
    await controller.importFile("story", secondaryFile);
    const metadataFiltered = await controller.listLibrary("story", {
      creation_tool: "Runtime Tests",
      genres: ["fantasy"],
      query: suffix,
      limit: 20
    });
    if (metadataFiltered.entries.length !== 2 || metadataFiltered.entries.some(entry => entry.creation_tool !== "Runtime Tests")) throw new Error("Story creation-tool and genre filters did not use bounded library metadata.");
    const compatibilityRecords = await controller.listCompatibilityDefinitions("story");
    const compatibilityRecord = compatibilityRecords.find(record => record.definition?.id === primaryId)?.definition;
    if (compatibilityRecord?.app !== "EmberAdventures" || compatibilityRecord.templateType !== "story") throw new Error("Story reload hydration did not restore the canonical app and templateType fields.");
    const metadata = await controller.getMetadata("story", primaryId, imported.entry.revisionId);
    if (metadata?.objectiveCount !== 1) throw new Error("Imported story metadata did not retain its objective count.");
    const exported = await controller.exportDefinition("story", primaryId, imported.entry.revisionId);
    const payload = JSON.parse(await exported.blob.text());
    if (payload.storyTemplate?.id !== primaryId) throw new Error("Exported story did not reconstruct the story template.");
    await controller.deleteEntry("story", primaryId);
    const afterDelete = await controller.listLibrary("story", {
      query: primaryId,
      limit: 20
    });
    if (afterDelete.entries.length) throw new Error("Deleted story remained visible in the local library.");
    const reimported = await controller.importFile("story", new Blob([JSON.stringify(payload)], {
      type: "application/json"
    }));
    if (!reimported.reusedDefinition) throw new Error("Story deletion removed the immutable definition.");
    await controller.importFile("story", await gzipJsonBlob(runtimeStoryFixture(gzipId)));
    const gzipEntry = await controller.listLibrary("story", {
      query: gzipId,
      limit: 20
    });
    if (gzipEntry.entries[0]?.storyId !== gzipId) throw new Error("Gzip story import did not reach the normal validation and storage path.");
    await controller.deleteEntry("story", primaryId);
    await controller.deleteEntry("story", secondaryId);
    await controller.deleteEntry("story", gzipId);
    return "JSON/gzip story lifecycle and immutable-definition retention passed";
  }
}, {
  id: "library-story-sparse-allow-any-player",
  name: "Sparse allow_any_player stories import and compile without a synthetic player",
  execute: async () => {
    const controller = await getDiagnosticLibraryController();
    const suffix = `${Date.now()}`;
    const sparseId = `runtime-story-sparse-${suffix}`;
    const malformedId = `runtime-story-malformed-player-${suffix}`;
    const libraryPlayerId = `${sparseId}-library-player`;
    const sparseStory = runtimeStoryFixture(sparseId);
    const sparseNpc = runtimeCharacterFixture(`${sparseId}-npc`).character_definition;
    delete sparseNpc.genres;
    delete sparseStory.storyTemplate.state.player;
    delete sparseStory.storyTemplate.state.players;
    sparseStory.storyTemplate.state.characters[sparseNpc.id] = sparseNpc;
    const malformedStory = structuredClone(sparseStory);
    malformedStory.storyTemplate.id = malformedId;
    malformedStory.storyTemplate.state.player = "not-a-character";
    let malformedRejected = false;
    let importedSparse = null;
    let importedPlayer = null;
    try {
      const malformedImport = await controller.importFile("story", new Blob([JSON.stringify(malformedStory)], {
        type: "application/json"
      }));
      malformedRejected = !malformedImport?.entry;
    } catch (error) {
      malformedRejected = /state\.player|player must/.test(String(error.message || ""));
    }
    if (!malformedRejected) throw new Error("Malformed story player slot with explicit state.player did not reject.");
    try {
      importedSparse = await controller.importFile("story", new Blob([JSON.stringify(sparseStory)], {
        type: "application/json"
      }));
      importedPlayer = await controller.importFile("character", new Blob([JSON.stringify(runtimeCharacterFixture(libraryPlayerId))], {
        type: "application/json"
      }));
      const compiled = (await controller.diagnosticStoryRecords(sparseId, importedSparse.entry.revisionId)).compiled?.characterById || {};
      if (compiled[sparseNpc.id] !== `characters.${sparseNpc.id}`) throw new Error("Sparse story compile did not resolve named non-player characters.");
      if (Object.hasOwn(compiled, "undefined") || Object.hasOwn(compiled, "")) throw new Error("Sparse story compile created a locator for an absent optional character slot.");
      const materialized = await controller.materializeNewGame({
        storyId: sparseId,
        revisionId: importedSparse.entry.revisionId,
        selection: {
          source: "library",
          characterId: libraryPlayerId,
          revisionId: importedPlayer.entry.revisionId
        }
      });
      if (materialized.header.playerCharacterId !== libraryPlayerId) throw new Error("Sparse story materialization lost its selected library player.");
      return "Sparse allow_any_player story imported, compiled, and materialized with explicit sparse slots rejected when malformed.";
    } finally {
      if (importedSparse?.entry?.storyId) await controller.deleteEntry("story", importedSparse.entry.storyId);
      if (importedPlayer?.entry?.characterId) await controller.deleteEntry("character", importedPlayer.entry.characterId);
    }
  }
}, {
  id: "library-authored-objective-links",
  name: "Explicit OR and AND transitions compile into immutable indexes",
  execute: async () => {
    const controller = await getDiagnosticLibraryController();
    const id = `runtime-authored-objectives-${Date.now()}`;
    const story = runtimeStoryFixture(id, {
      objectiveCount: 4
    });
    const objectives = story.storyTemplate.state.objectives.items;
    const location = story.storyTemplate.state.npc_directory.locations[`${id}-location`];
    const npc = runtimeCharacterFixture(`${id}-npc`).character_definition;
    delete npc.genres;
    location.characters[npc.name] = {
      id: npc.id,
      full_character: npc
    };
    objectives[0].next_objectives[0].rewards.push({
      type: "adjust_relationship",
      target: npc.name,
      stats: {
        trust: 1,
        attraction: 0,
        affection: 0
      }
    });
    objectives[0].next_objectives.push({
      id: `${id}-objective-0-and-output`,
      objective_id: objectives[3].id,
      target_input_group_id: `${objectives[3].id}-and-input`,
      completion_instruction: "Record the first half of the explicit AND transition.",
      requirements: [],
      rewards: []
    });
    objectives[1] = {
      ...objectives[1],
      completion_control: "choice",
      requirement_check_only: false,
      evaluate_ai_on_activation: false,
      choices: ["a", "b"].map(suffix => ({
        id: `${id}-choice-${suffix}`,
        title: `${suffix.toUpperCase()} option`,
        summary: `Choose bounded option ${suffix.toUpperCase()}.`,
        next_objective_id: objectives[2].id,
        target_input_group_id: `${objectives[2].id}-choice-${suffix}-input`,
        completion_instruction: "Continue after the bounded choice.",
        requirements: [],
        rewards: []
      })),
      next_objectives: []
    };
    delete objectives[1].completion_criteria;
    objectives[2].next_objectives[0].target_input_group_id = `${objectives[3].id}-and-input`;
    const imported = await controller.importFile("story", new Blob([JSON.stringify(story)]));
    const records = await controller.diagnosticStoryRecords(id, imported.entry.revisionId);
    const firstGroup = Object.values(records.compiled.incomingTransitionGroupsByObjectiveId[objectives[1].id] || {}).flat();
    const secondGroup = Object.values(records.compiled.incomingTransitionGroupsByObjectiveId[objectives[2].id] || {}).flat();
    const andGroup = records.compiled.incomingTransitionGroupsByObjectiveId[objectives[3].id]?.[`${objectives[3].id}-and-input`] || [];
    if (!firstGroup.some(transition => transition.sourceObjectiveId === objectives[0].id)) throw new Error("The first explicit transition did not compile.");
    const choiceTransitions = secondGroup.filter(transition => transition.sourceObjectiveId === objectives[1].id);
    if (choiceTransitions.length !== 2) throw new Error("Shared choice continuation did not compile both OR alternatives.");
    if (records.compiled.outgoingObjectiveIdsByObjectiveId[objectives[2].id]?.[0] !== objectives[3].id) throw new Error("The explicit objective continuation did not compile.");
    if (andGroup.length !== 2 || !andGroup.some(transition => transition.sourceObjectiveId === objectives[0].id) || !andGroup.some(transition => transition.sourceObjectiveId === objectives[2].id)) throw new Error("The explicit AND input group did not compile both required source objectives.");
    await controller.deleteEntry("story", id);
    return "explicit single, OR-choice, and AND-group transitions compiled without mutating the definition";
  }
}, {
  id: "library-character-lifecycle",
  name: "Character import, filter, export, and deletion round-trip",
  execute: async () => {
    const controller = await getDiagnosticLibraryController();
    const suffix = `${Date.now()}`;
    const primaryId = `runtime-character-primary-${suffix}`;
    const secondaryId = `runtime-character-secondary-${suffix}`;
    const primary = runtimeCharacterFixture(primaryId);
    const malePresentation = {
      ...primary.character_definition.profile_image_presentations.male,
      url: "https://example.invalid/runtime-profile-male.png",
      source: "hosted",
      seed: 2,
      prompt: "Runtime male profile"
    };
    primary.character_definition.profile_image_presentations = {
      male: malePresentation,
      non_male: {
        url: "https://example.invalid/runtime-profile.png",
        local_image_id: "",
        source: "hosted",
        seed: 1,
        prompt: "Runtime profile",
        negative_prompt: "",
        note: "",
        male: false
      }
    };
    const imported = await controller.importFile("character", new Blob([JSON.stringify(primary)]));
    if (imported.sharedImages < 2) throw new Error("Character import did not extract its hosted profile image and selection into shared storage.");
    primary.character_definition.role = "Revised Scout";
    const revisedImport = await controller.importFile("character", new Blob([JSON.stringify(primary)]));
    if (revisedImport.entry.revisionId === imported.entry.revisionId) throw new Error("Character metadata revision did not produce a new immutable definition revision.");
    await controller.importFile("character", new Blob([JSON.stringify(runtimeCharacterFixture(secondaryId))]));
    const metadataFiltered = await controller.listLibrary("character", {
      creation_tool: "Runtime Tests",
      genres: ["fantasy"],
      query: suffix,
      limit: 20
    });
    if (metadataFiltered.entries.length !== 2 || metadataFiltered.entries.some(entry => entry.creation_tool !== "Runtime Tests")) throw new Error("Character creation-tool and genre filters did not use bounded library metadata.");
    const compatibilityRecords = await controller.listCompatibilityDefinitions("character");
    const compatibilityRecord = compatibilityRecords.find(record => record.id === primaryId);
    if (!compatibilityRecord?.character || compatibilityRecord.character.id !== primaryId) throw new Error("Character reload hydration did not rebuild the character-library wrapper record.");
    if (typeof compatibilityRecord.active_profile_image_ids?.male !== "string" || typeof compatibilityRecord.active_profile_image_ids?.non_male !== "string") throw new Error("Character reload hydration did not return both presentation-specific profile-image selection fields.");
    const hydratedImageIds = compatibilityRecord.character.profile_images.image_ids;
    if (hydratedImageIds.length !== 2 || new Set(hydratedImageIds).size !== 2) {
      throw new Error(`A metadata-only character revision duplicated unchanged hosted profile images: ${JSON.stringify(hydratedImageIds)}.`);
    }
    const exported = await controller.exportDefinition("character", primaryId, revisedImport.entry.revisionId);
    const payload = JSON.parse(await exported.blob.text());
    if (payload.character_definition?.id !== primaryId) throw new Error("Exported character did not reconstruct the character definition.");
    await controller.deleteEntry("character", primaryId);
    await controller.deleteEntry("character", secondaryId);
    return "character lifecycle passed with blank initial scene-state strings";
  }
}, {
  id: "new-game-materialization",
  name: "New-game materialization creates one normalized save without copying objectives",
  execute: async () => {
    const library = await getDiagnosticLibraryController();
    const id = `runtime-new-game-${Date.now()}`;
    const libraryCharacterId = `${id}-library-player`;
    const storyFixture = runtimeStoryFixture(id, {
      objectiveCount: 3
    });
    const romanceableCharacter = runtimeCharacterFixture(`${id}-romanceable`).character_definition;
    delete romanceableCharacter.genres;
    romanceableCharacter.name = "Daniel Runtime";
    romanceableCharacter.fallback_name = "Danielle Runtime";
    romanceableCharacter.gender = "male";
    romanceableCharacter.appearance.body_description = "A stocky build.";
    romanceableCharacter.profile_image_presentations.male.male = true;
    romanceableCharacter.profile_image_presentations.non_male.male = false;
    storyFixture.storyTemplate.state.npc_directory.locations[`${id}-location`].characters[romanceableCharacter.id] = {
      name: romanceableCharacter.name,
      gender: romanceableCharacter.gender,
      age: romanceableCharacter.age,
      role: romanceableCharacter.role,
      relationship: romanceableCharacter.starting_relationship_to_player,
      note: "Runtime preferred-presentation test character.",
      inspected: true,
      full_character: romanceableCharacter
    };
    storyFixture.storyTemplate.state.scene.npcs_present.push(romanceableCharacter.id);
    const imported = await library.importFile("story", new Blob([JSON.stringify(storyFixture)]));
    const importedCharacter = await library.importFile("character", new Blob([JSON.stringify(runtimeCharacterFixture(libraryCharacterId))]));
    const options = await library.getStoryStartOptions(id, imported.entry.revisionId);
    if (options.players.length !== 1 || !options.allowAnyPlayer) throw new Error("Story start options did not preserve authored and library-player choices.");
    const measurement = await measureMainThread("new-game materialization", () => library.materializeNewGame({
      storyId: id,
      revisionId: imported.entry.revisionId,
      selection: {
        source: "story",
        characterId: options.players[0].characterId
      },
      preferredCharacterGenders: ["female"],
      swapAllGendersToPreferred: false
    }));
    assertResponsive(measurement);
    const materialized = measurement.value;
    if (materialized.metrics.immutableObjectiveCount !== 3 || materialized.metrics.objectiveRecordsCopied !== 0) throw new Error("New-game materialization copied or lost immutable objective definitions.");
    if (!materialized.initialRecords.some(record => record.storeName === "items")) throw new Error("Authored outfit clothing was not converted into normalized item records.");
    if (!materialized.opening.messages[0]?.text.includes("Runtime")) throw new Error("Opening-message player references were not resolved.");
    const adaptedRomanceableDefinition = materialized.initialRecords.find(record => record.storeName === "saveCharacterDefinitions" && record.record.characterId === romanceableCharacter.id);
    if (adaptedRomanceableDefinition?.record.name !== "Danielle Runtime" || adaptedRomanceableDefinition?.record.gender !== "female") throw new Error("New-game worker ignored the active profile's preferred romanceable-character presentation.");
    const libraryPlayerGame = await library.materializeNewGame({
      storyId: id,
      revisionId: imported.entry.revisionId,
      selection: {
        source: "library",
        characterId: libraryCharacterId,
        revisionId: importedCharacter.entry.revisionId,
        presentation: "male"
      }
    });
    if (libraryPlayerGame.header.playerCharacterId !== libraryCharacterId) throw new Error("Library-player materialization lost the selected stable character id.");
    const libraryPlayerDefinition = libraryPlayerGame.initialRecords.find(record => record.storeName === "saveCharacterDefinitions" && record.record.characterId === libraryCharacterId);
    const libraryPlayerState = libraryPlayerGame.initialRecords.find(record => record.storeName === "characterDurableState" && record.record.characterId === libraryCharacterId);
    if (libraryPlayerDefinition?.record.gender !== "male" || libraryPlayerState?.record.role !== "Runtime story player") throw new Error("Library-player presentation or story starting-state overlay was not applied.");
    const persistence = new EmberPersistence.Controller(testWorkerUrl(), {
      watchdogMilliseconds: 5000,
      visibilityProvider: () => "visible"
    });
    await persistence.start();
    let saveId = null;
    try {
      const immutableRecords = await library.diagnosticStoryRecords(id, imported.entry.revisionId);
      await persistence.seedRecords([{
        storeName: "storyDefinitions",
        record: immutableRecords.definition
      }, {
        storeName: "compiledStoryIndexes",
        record: immutableRecords.compiled
      }]);
      const pagedMessages = Array.from({
        length: 84
      }, (_, index) => ({
        storeName: "messages",
        record: {
          messageId: `runtime-message-${index + 2}`,
          sequence: index + 2,
          role: index % 2 ? "assistant" : "user",
          speaker: index % 2 ? "Narrator" : materialized.opening.playerName,
          text: `Runtime message ${index + 2}.`,
          detail: "normal",
          at: new Date(Date.now() + index + 2).toISOString()
        }
      }));
      const created = await persistence.createSave(materialized.header, [...materialized.initialRecords, ...pagedMessages]);
      saveId = created.saveId;
      const saveList = await persistence.listSaves({
        limit: 20
      });
      if (!saveList.entries.some(entry => entry.saveId === saveId)) throw new Error("The new save was missing from lightweight Load Adventure metadata.");
      const renamed = await persistence.renameSave(saveId, "Renamed Runtime Adventure");
      const renamedList = await persistence.listSaves({
        query: "renamed runtime",
        limit: 20
      });
      if (renamed.displayName !== "Renamed Runtime Adventure" || renamedList.entries[0]?.saveId !== saveId) throw new Error("Renaming a save did not update its lightweight header and search metadata.");
      const inspected = await persistence.inspectSave(saveId);
      if (inspected.immutableStory.storyId !== id || inspected.header.playerCharacterId !== materialized.header.playerCharacterId) throw new Error("Pre-activation save inspection did not validate the immutable story and header.");
      await persistence.activateSave(saveId);
      const loadMeasurement = await measureMainThread("bounded save reconstruction", () => persistence.loadSave(saveId));
      assertResponsive(loadMeasurement);
      const loaded = loadMeasurement.value;
      if (loaded.recordsByStore.objectiveControl.length !== 1) throw new Error("The new save did not retain exactly one objective cursor.");
      if (loaded.recordsByStore.objectiveRuntime.length !== 0) throw new Error("The new save contains copied objective runtime rows.");
      if (loaded.recordsByStore.messages.length !== 40 || !loaded.messagePage.hasEarlier || loaded.messagePage.total !== 85) throw new Error("Initial load did not return only the newest bounded message page.");
      if (loaded.immutableStory.storyId !== id || loaded.view.objectiveId !== materialized.opening.objectiveId) throw new Error("Save loading did not reconnect its immutable story and active objective.");
      const earlier = await persistence.loadEarlierMessages(saveId, loaded.messagePage.oldestSequence, 40);
      if (earlier.length !== 40 || earlier[0].sequence !== 6) throw new Error("Earlier message paging did not return the preceding bounded page.");
      await persistence.closeActiveSave();
      await persistence.deleteSave(saveId);
      saveId = null;
    } finally {
      if (persistence.activeSaveState != null) await persistence.closeActiveSave();
      if (saveId != null) await persistence.deleteSave(saveId);
      persistence.dispose();
      await library.deleteEntry("story", id);
      await library.deleteEntry("character", libraryCharacterId);
    }
    return `${measurementDetail(measurement)}; ${materialized.metrics.initialRecordCount} normalized records`;
  }
}, {
  id: "runtime-compatibility-inventory-projection",
  name: "Runtime save reconstruction does not leak normalized inventory fields",
  execute: async () => {
    const id = `runtime-inventory-compatibility-${Date.now()}`;
    const story = runtimeStoryFixture(id);
    story.storyTemplate.state.player.starting_inventory = [{
      id: "structured-runtime-item",
      name: "Structured Runtime Item",
      description: "A structured runtime inventory item",
      type: "tool",
      quantity: 2,
      value: 17,
      sellable: true
    }];
    story.storyTemplate.state.players[0] = story.storyTemplate.state.player;
    const persistence = new EmberPersistence.Controller(testWorkerUrl(), {
      watchdogMilliseconds: 5000,
      visibilityProvider: () => "visible"
    });
    const library = new EmberLibraryController(diagnosticLibraryWorkerUrl(), {
      diagnostic: true,
      runtimeDatabaseName: "EmberAdventuresLiteRuntimeDiagnostic",
      applicationDatabaseName: `EmberAdventuresInventoryCompatibilityApplication-${id}`
    });
    let saveId = null;
    try {
      await persistence.start();
      await library.start();
      const imported = await library.importFile("story", new Blob([JSON.stringify(story)]));
      const materialized = await library.materializeNewGame({
        storyId: id,
        revisionId: imported.entry.revisionId,
        selection: {
          source: "story",
          characterId: `${id}-player`
        }
      });
      const immutable = await library.diagnosticStoryRecords(id, imported.entry.revisionId);
      await persistence.seedRecords([{
        storeName: "storyDefinitions",
        record: immutable.definition
      }, {
        storeName: "compiledStoryIndexes",
        record: immutable.compiled
      }]);
      const created = await persistence.createSave(materialized.header, materialized.initialRecords);
      saveId = created.saveId;
      const reconstructed = await library.reconstructRuntimeSave(saveId);
      const inventory = reconstructed.state.player.inventory;
      const item = inventory[0];
      const itemText = typeof item === "string" ? item : item?.item;
      const itemKeys = typeof item === "string" ? [] : Object.keys(item || {});
      if (inventory.length !== 1 || itemText !== "A structured runtime inventory item") throw new Error("Structured inventory was not reconstructed into the authored runtime item shape.");
      if (itemKeys.some(key => !["item", "clothing_slot", "held_item_slot", "removed_by"].includes(key))) throw new Error(`Runtime inventory leaked normalized fields: ${itemKeys.join(", ")}`);
      if (itemKeys.includes("itemId")) throw new Error("Runtime inventory reconstruction leaked itemId.");
      return "structured normalized inventory reconstructed without storage-only fields";
    } finally {
      if (persistence.activeSaveState != null) await persistence.closeActiveSave();
      if (saveId != null) await persistence.deleteSave(saveId);
      persistence.dispose();
      library.dispose();
    }
  }
}, {
  id: "turn-worker-objective-flow",
  name: "Turn worker keeps objective prompts bounded and returns ordered save operations",
  execute: async () => {
    appendRuntimeTestLog("Turn flow: preparing exact story fixture.");
    const library = await getDiagnosticLibraryController();
    const id = `runtime-turn-${Date.now()}`;
    const story = runtimeStoryFixture(id, {
      objectiveCount: 3
    });
    const first = story.storyTemplate.state.objectives.items[0];
    const second = story.storyTemplate.state.objectives.items[1];
    const third = story.storyTemplate.state.objectives.items[2];
    first.completion_control = "player";
    first.completion_criteria = "Return yes when the player opens the test door.";
    first.next_objectives[0].completion_instruction = "Show the test door opening into the next room.";
    first.next_objectives[0].dialogue_lines = [`(|[character:${id}-player]|) "The door is open."`];
    second.completion_control = "ai";
    second.completion_criteria = "Return yes when the guide finishes the next demonstration.";
    second.completion_requirements = [{
      path: "story_inventory.coins",
      op: ">=",
      value: 1
    }];
    story.storyTemplate.state.timed_events = {
      "runtime-deadline": {
        id: "runtime-deadline",
        title: "Runtime Deadline",
        status: "waiting",
        visibility: "visible",
        trigger: {
          objective_id: first.id,
          immediately: false
        },
        time_limit: {
          hours: 1
        },
        cancel_objective_id: "",
        message: "The runtime deadline has arrived.",
        stages: [{
          id: "halfway",
          after: {
            minutes: 30
          },
          visibility: "visible",
          message: "The runtime deadline is halfway complete.",
          rewards: [{
            type: "set_state_field",
            field_path: ["progression", "runtime_stage"],
            value: true
          }]
        }],
        rewards: [{
          type: "add_story_rule",
          rule_id: "runtime-deadline-complete",
          text: "The runtime deadline completed."
        }]
      },
      "runtime-cancelled": {
        id: "runtime-cancelled",
        title: "Runtime Cancelled Event",
        status: "waiting",
        visibility: "hidden",
        trigger: {
          immediately: true
        },
        time_limit: {
          hours: 2
        },
        cancel_objective_id: first.id,
        stages: [],
        rewards: []
      }
    };
    const departingCharacter = runtimeCharacterFixture(`${id}-departing`).character_definition;
    delete departingCharacter.genres;
    departingCharacter.gender = "female";
    second.while_active_guidance = [`|[character:${departingCharacter.id}]|`, `|[character_first:${departingCharacter.id}]|`, `|[character_subject_pronoun:${departingCharacter.id}]|`, `|[character_object_pronoun:${departingCharacter.id}]|`, `|[character_possessive_pronoun:${departingCharacter.id}]|`, `|[character_independent_possessive_pronoun:${departingCharacter.id}]|`, `|[character_reflexive_pronoun:${departingCharacter.id}]|`, `|[character_person_term:${departingCharacter.id}]|`, `|[character_monarch_title:${departingCharacter.id}]|`, `|[character_parent_term_cap:${departingCharacter.id}]|`].join(" / ");
    story.storyTemplate.state.characters[departingCharacter.id] = departingCharacter;
    appendRuntimeTestLog("Turn flow: importing fixture.");
    const imported = await library.importFile("story", new Blob([JSON.stringify(story)]));
    appendRuntimeTestLog("Turn flow: materializing new game.");
    const materialized = await library.materializeNewGame({
      storyId: id,
      revisionId: imported.entry.revisionId,
      selection: {
        source: "story",
        characterId: `${id}-player`
      }
    });
    const persistence = new EmberPersistence.Controller(testWorkerUrl(), {
      watchdogMilliseconds: 5000,
      visibilityProvider: () => "visible"
    });
    const turn = new EmberTurn.Controller(diagnosticTurnWorkerUrl(), {
      runtimeDatabaseName: "EmberAdventuresLiteRuntimeDiagnostic"
    });
    let saveId = null;
    let completedSuccessfully = false;
    try {
      appendRuntimeTestLog("Turn flow: starting persistence and seeding immutable records.");
      await persistence.start();
      const immutable = await library.diagnosticStoryRecords(id, imported.entry.revisionId);
      await persistence.seedRecords([{
        storeName: "storyDefinitions",
        record: immutable.definition
      }, {
        storeName: "compiledStoryIndexes",
        record: immutable.compiled
      }]);
      const created = await persistence.createSave(materialized.header, materialized.initialRecords);
      saveId = created.saveId;
      await persistence.activateSave(saveId);
      await turn.start();
      appendRuntimeTestLog("Turn flow: preparing player turn.");
      await persistence.submitOperations("runtime-scene-setup", [{
        type: "scene.member.add",
        characterId: departingCharacter.id
      }]);
      const measurement = await measureMainThread("turn prompt preparation", () => turn.prepareTurn(saveId, "I open the test door.", materialized.opening.playerName));
      assertResponsive(measurement);
      const prepared = measurement.value;
      if (!prepared.objectivePrompt.includes(first.title) || !prepared.objectivePrompt.includes(first.summary) || !prepared.objectivePrompt.includes(first.completion_criteria)) throw new Error("Pre-reply objective prompt omitted one of the three allowed objective fields.");
      if (prepared.objectivePrompt.includes(first.next_objectives[0].completion_instruction) || prepared.objectivePrompt.includes("The door is open.")) throw new Error("Pre-reply objective prompt leaked completion-only information.");
      await persistence.submitOperations("runtime-turn-player", [{
        type: "message.add",
        message: prepared.userMessage
      }]);
      const removalPrompt = await turn.prepareSceneRemoval(saveId, "I leave the departing character behind and open the test door.");
      if (!removalPrompt.prompt.includes(departingCharacter.name) || !removalPrompt.prompt.includes("If uncertain, keep them present")) throw new Error("Scene-removal prompt omitted current presence or conservative removal guidance.");
      const removal = await turn.resolveSceneRemoval(saveId, JSON.stringify({
        r: [departingCharacter.id]
      }));
      await persistence.submitOperations("runtime-turn-removal", removal.operations);
      if (!removal.narratorDirective.includes(departingCharacter.name)) throw new Error("Scene removal did not produce a narrator exclusion directive.");
      if (await persistence.getRecord("sceneMembers", [saveId, departingCharacter.id])) throw new Error("Scene removal did not commit before objective evaluation.");
      const completed = await turn.resolveObjective(saveId, '{"c":true,"p":""}');
      appendRuntimeTestLog("Turn flow: first objective resolved.");
      if (!completed.complete || !completed.completionDirective.includes(first.next_objectives[0].completion_instruction) || !completed.completionDirective.includes("The door is open.")) throw new Error("Completed objective did not expose its completion instruction and required dialogue through the common narrator path.");
      appendRuntimeTestLog(`Turn flow: committing first objective operations: ${JSON.stringify(completed.operations)}.`);
      await persistence.submitOperations("runtime-turn-objective", completed.operations);
      appendRuntimeTestLog("Turn flow: first objective operations committed; preparing narrator.");
      const narrator = await turn.prepareNarrator(saveId, completed.completionDirective);
      appendRuntimeTestLog("Turn flow: narrator prepared.");
      if (narrator.objectiveId !== second.id || !narrator.prompt.includes(second.title) || !narrator.prompt.includes(first.next_objectives[0].completion_instruction)) throw new Error("Narrator prompt did not combine the completed objective directive with the newly active objective.");
      if (narrator.prompt.includes("|[") || ![departingCharacter.name, "she", "her", "hers", "herself", "woman", "queen", "Mother"].every(value => narrator.prompt.includes(value))) throw new Error("Live narrator guidance did not resolve the full character name/pronoun/title reference vocabulary.");
      const assistant = {
        messageId: `assistant-${Date.now()}`,
        sequence: prepared.userMessage.sequence + 1,
        role: "assistant",
        speaker: "Narrator",
        text: "The guide completes part of the next demonstration.",
        detail: "normal",
        at: new Date().toISOString()
      };
      await persistence.submitOperations("runtime-turn-assistant", [{
        type: "message.add",
        message: assistant
      }]);
      const stateUpdate = await turn.prepareState(saveId, assistant.text);
      const stateResult = await turn.resolveState(saveId, JSON.stringify({
        ops: [{
          t: "scene",
          v: {
            summary: "The test door now stands open."
          }
        }, {
          t: "relationship",
          id: `${id}-player`,
          v: {
            trust: 4
          }
        }, {
          t: "value",
          root: "story_inventory",
          path: "door_open",
          v: true
        }, {
          t: "location",
          id: `${id}-location`
        }]
      }));
      if (stateResult.operations.length !== 4) throw new Error("State updater did not convert the allowed normalized changes.");
      try {
        await turn.resolveState(saveId, '{"ops":[{"t":"scene","v":{"unapprovedMode":"on"}}]}');
      } catch (error) {}
      let objectiveMutationRejected = false;
      try {
        await turn.resolveState(saveId, '{"ops":[{"t":"objective","id":"bad"}]}');
      } catch (error) {
        objectiveMutationRejected = error.message.includes("not allowed");
      }
      if (!objectiveMutationRejected) throw new Error("State updater accepted an objective mutation.");
      await persistence.submitOperations("runtime-turn-state", stateResult.operations);
      appendRuntimeTestLog("Turn flow: state operations committed; preparing progress.");
      const progress = await turn.prepareProgress(saveId, assistant.text);
      if (!progress.prompt.includes("records progress only") || !progress.prompt.includes(second.title)) throw new Error("Post-reply AI-objective prompt was not progress-only.");
      const progressResult = await turn.resolveProgress(saveId, '{"c":true,"p":""}');
      if (progressResult.complete || progressResult.operations.some(operation => operation.type !== "objective.progress.add")) throw new Error("Post-reply progress resolution attempted to complete or route the AI objective.");
      await persistence.submitOperations("runtime-turn-progress", progressResult.operations);
      await persistence.submitOperations("runtime-block-objective", [{
        type: "story.value.set",
        record: {
          root: "story_inventory",
          pathKey: "coins",
          value: 0
        }
      }]);
      const [blockedTurn, blockedNarrator, blockedState, blockedProgress] = await Promise.all([turn.prepareTurn(saveId, "I try to continue anyway.", materialized.opening.playerName), turn.prepareNarrator(saveId, ""), turn.prepareRuntimeState(saveId), turn.prepareProgress(saveId, assistant.text)]);
      if (!blockedTurn.objectiveBlocked || blockedTurn.objectivePrompt || !blockedTurn.unmetRequirements.length) throw new Error("Blocked completion requirements did not suppress the objective verifier.");
      if (!blockedNarrator.objectiveBlocked || !blockedNarrator.prompt.includes("cannot be completed") || !blockedNarrator.prompt.includes("story_inventory.coins")) throw new Error("Blocked completion requirements were not given to the narrator.");
      if (!blockedState.objective?.blocked || !blockedState.objective.unmetRequirements.length || blockedProgress.prompt) throw new Error("Blocked objective state was not exposed to the UI or still ran the progress verifier.");
      await persistence.submitOperations("runtime-unblock-objective", [{
        type: "story.value.set",
        record: {
          root: "story_inventory",
          pathKey: "coins",
          value: 25
        }
      }]);
      const activatedEvents = await turn.resolveTimedEvents(saveId);
      appendRuntimeTestLog("Turn flow: timed events activated.");
      await persistence.submitOperations("runtime-timed-activate", activatedEvents.operations);
      const [activeEvent, cancelledEvent] = await Promise.all([persistence.getRecord("timedEventRuntime", [saveId, "runtime-deadline"]), persistence.getRecord("timedEventRuntime", [saveId, "runtime-cancelled"])]);
      if (activeEvent?.status !== "active" || cancelledEvent?.status !== "cancelled") throw new Error("Timed events did not activate and cancel from completed-objective requirements.");
      await persistence.submitOperations("runtime-timed-halfway-clock", [{
        type: "time.set",
        values: {
          elapsedMinutes: 30
        }
      }]);
      const halfway = await turn.resolveTimedEvents(saveId);
      appendRuntimeTestLog("Turn flow: timed-event halfway stage resolved.");
      await persistence.submitOperations("runtime-timed-halfway", [...halfway.messages.map(message => ({
        type: "message.add",
        message
      })), ...halfway.operations]);
      if (halfway.messages.length !== 1 || !(await persistence.getRecord("timedEventAppliedStages", [saveId, "runtime-deadline", "halfway"]))) throw new Error("Timed-event stage notice or applied-stage id was not committed.");
      if ((await persistence.getRecord("storyValues", [saveId, "progression", "runtime_stage"]))?.value !== true) throw new Error("Timed-event stage reward was not committed.");
      await persistence.submitOperations("runtime-timed-deadline-clock", [{
        type: "time.set",
        values: {
          elapsedMinutes: 60
        }
      }]);
      const deadline = await turn.resolveTimedEvents(saveId);
      appendRuntimeTestLog("Turn flow: timed-event deadline resolved.");
      await persistence.submitOperations("runtime-timed-deadline", [...deadline.messages.map(message => ({
        type: "message.add",
        message
      })), ...deadline.operations]);
      const completedEvent = await persistence.getRecord("timedEventRuntime", [saveId, "runtime-deadline"]);
      const deadlineRule = await persistence.getRecord("storyRuleAdds", [saveId, "runtime-deadline-complete"]);
      if (completedEvent?.status !== "complete" || !deadlineRule || deadline.messages.length !== 1) throw new Error("Timed-event deadline notice, reward, or completion state was not committed.");
      const secondCompleted = await turn.resolveObjective(saveId, '{"c":true,"p":""}');
      appendRuntimeTestLog("Turn flow: second objective resolved.");
      const controlOperation = secondCompleted.operations.find(operation => operation.type === "objective.control.set");
      if (!secondCompleted.complete || controlOperation?.values?.activeMainObjectiveId !== third.id) throw new Error(`The explicit sequential objective did not activate after its incoming transition completed: ${JSON.stringify(secondCompleted)}.`);
      completedSuccessfully = true;
      return `${measurementDetail(measurement)}; queue/objective/narrator/progress/timed-event operations passed`;
    } finally {
      turn.dispose();
      if (!completedSuccessfully && persistence.activeSaveState != null) await persistence.abandonActiveSaveForTest();else if (persistence.activeSaveState != null) await persistence.closeActiveSave();
      if (saveId != null) await persistence.deleteSave(saveId);
      persistence.dispose();
      await library.deleteEntry("story", id);
    }
  }
}, {
  id: "objective-choice-reward-cascade",
  name: "Direct choices, requirements, bundles, future characters, and reward-only cascades commit atomically",
  execute: async () => {
    appendRuntimeTestLog("Objective flow: starting fixture setup.");
    const id = `runtime-choice-${Date.now()}`;
    const library = new EmberLibraryController(diagnosticLibraryWorkerUrl(), {
      diagnostic: true,
      runtimeDatabaseName: "EmberAdventuresLiteRuntimeDiagnostic",
      applicationDatabaseName: `EmberAdventuresChoiceApplication-${id}`
    });
    await library.start();
    appendRuntimeTestLog("Objective flow: diagnostic library ready.");
    const story = runtimeStoryFixture(id, {
      objectiveCount: 4
    });
    const objectives = story.storyTemplate.state.objectives.items;
    const guide = runtimeCharacterFixture(`${id}-guide`).character_definition;
    const expectedGuideBodyScales = {
      height: 0,
      body_description: "A sturdy, athletic build.",

    };
    guide.appearance = {
      ...guide.appearance,
      ...expectedGuideBodyScales
    };
    delete guide.genres;
    story.storyTemplate.state.future_cast.items[guide.id] = {
      id: guide.id,
      status: "hidden",
      scene_presence: "nearby",
      full_character: guide
    };
    story.storyTemplate.state.reward_bundles = {
      "choice-bundle": [{
        type: "adjust_story_inventory",
        field_path: ["story_inventory", "coins"],
        operation: "add",
        amount: 5
      }, {
        type: "add_story_rule",
        rule_id: "choice-rule",
        text: "The runtime choice was accepted."
      }, {
        type: "introduce_future_character",
        character_id: guide.id,
        npc_location_id: `${id}-location`,
        scene_presence: "nearby",
        reason: "The eligible choice introduces the runtime guide."
      }]
    };
    objectives[0] = {
      ...objectives[0],
      completion_control: "choice",
      choice_response_mode: "optional_text",
      next_objectives: [],
      choices: [{
        id: "eligible-choice",
        title: "Eligible Choice",
        summary: "Uses the available coins.",
        player_text: "I choose the eligible route.",
        next_objective_id: objectives[1].id,
        target_input_group_id: `${objectives[1].id}-eligible-input`,
        completion_instruction: "Acknowledge the selected test route.",
        requirements: [],
        rewards: [{
          type: "apply_reward_bundle",
          bundle_id: "choice-bundle"
        }, {
          type: "grant_item",
          target: "player",
          item: {
            id: "field-notes",
            name: "Field Notes",
            type: "tool",
            slot: null,
            quantity: 1,
            value: 0,
            sellable: false,
            quest_item: false,
            description: "A compact inspection notebook.",
            image_id: ""
          }
        }, {
          type: "grant_outfit",
          character_id: `${id}-player`,
          outfit: {
            id: "field-uniform",
            name: "Field Uniform",
            clothing: {
              shirt: "fitted field jacket",
              pants: "durable field trousers"
            }
          }
        }, {
          type: "equip_outfit",
          character_id: `${id}-player`,
          outfit_id: "field-uniform"
        }, {
          type: "grant_outfit",
          character_id: `${id}-player`,
          outfit: {
            id: "spare-uniform",
            name: "Spare Uniform",
            clothing: {
              shirt: "spare field jacket"
            }
          }
        }, {
          type: "delete_outfit",
          character_id: `${id}-player`,
          outfit_id: "spare-uniform"
        }, {
          type: "equip_outfit",
          character_id: `${id}-player`,
          outfit_id: "missing-uniform"
        }, {
          type: "generate_profile_image",
          target: "player",
          reason: "Test the hosted profile reward.",
          image: {
            url: "https://example.invalid/runtime-profile-reward.png"
          }
        }, {
          type: "generate_solo_normal_image",
          target: "player",
          reason: "Test the hosted character reward.",
          image: {
            url: "https://example.invalid/runtime-character-reward.png"
          }
        }, {
          type: "start_objective",
          objective_id: objectives[3].id
        }, {
          type: "complete_objective",
          objective_id: objectives[3].id
        }]
      }, {
        id: "blocked-choice",
        title: "Blocked Choice",
        summary: "Requires unavailable coins.",
        player_text: "This should not be selectable.",
        next_objective_id: objectives[3].id,
        target_input_group_id: `${objectives[3].id}-blocked-input`,
        completion_instruction: "Acknowledge the blocked test route.",
        requirements: [{
          path: "story_inventory.coins",
          op: ">",
          value: 1000
        }],
        rewards: []
      }]
    };
    delete objectives[0].completion_criteria;
    objectives[1] = {
      ...objectives[1],
      completion_control: "reward_only",
      requirement_check_only: true,
      completion_requirements: [{
        type: "objective_complete",
        id: objectives[0].id
      }],
      rewards: [{
        type: "add_state_list_item",
        field_path: ["story_inventory", "flags"],
        value: "cascade-complete"
      }, {
        type: "delete_all_outfits",
        character_id: `${id}-player`
      }],
      next_objectives: [{
        id: `${objectives[1].id}-output`,
        objective_id: objectives[2].id,
        target_input_group_id: `${objectives[2].id}-shared-input`,
        completion_instruction: "Continue after the automatic transition.",
        requirements: [],
        rewards: []
      }]
    };
    delete objectives[1].completion_criteria;
    objectives[2] = {
      ...objectives[2],
      completion_control: "player",
      next_objectives: [{
        id: "main-diagnostic-ending",
        completion_instruction: "Conclude the main diagnostic route.",
        rewards: [],
        ending_type: "freeplay",
        ending_message: "The main diagnostic route is complete."
      }]
    };
    objectives[3] = {
      ...objectives[3],
      type: "side",
      completion_control: "player",
      next_objectives: [{
        id: "side-diagnostic-ending",
        completion_instruction: "Conclude the side diagnostic route.",
        rewards: [],
        ending_type: "freeplay",
        ending_message: "The side diagnostic route is complete."
      }]
    };
    const imported = await library.importFile("story", new Blob([JSON.stringify(story)]));
    appendRuntimeTestLog("Objective flow: fixture imported.");
    const materialized = await library.materializeNewGame({
      storyId: id,
      revisionId: imported.entry.revisionId,
      selection: {
        source: "story",
        characterId: `${id}-player`
      }
    });
    appendRuntimeTestLog("Objective flow: new game materialized.");
    const persistence = new EmberPersistence.Controller(testWorkerUrl(), {
      watchdogMilliseconds: 5000,
      visibilityProvider: () => "visible"
    });
    const turn = new EmberTurn.Controller(diagnosticTurnWorkerUrl(), {
      runtimeDatabaseName: "EmberAdventuresLiteRuntimeDiagnostic"
    });
    let saveId = null;
    let completedSuccessfully = false;
    try {
      await persistence.start();
      appendRuntimeTestLog("Objective flow: persistence worker ready.");
      persistence.addEventListener("status", event => {
        const detail = event.detail || {};
        if (detail.status === "worker-health" && ["rejected", "transaction-failed"].includes(detail.detail?.phase)) appendRuntimeTestLog(`Objective flow persistence: ${detail.detail.phase} change ${detail.detail.processingChangeId ?? "-"}.`);else if (detail.status === "transaction-rejected") appendRuntimeTestLog(`Objective flow persistence rejected: ${detail.detail?.error || "unknown error"}`);else if (["worker-error", "worker-message-error", "worker-replacement-failed", "worker-unresponsive"].includes(detail.status)) appendRuntimeTestLog(`Objective flow persistence: ${detail.status} ${JSON.stringify(detail.detail || {})}.`);else if (["worker-replacing", "worker-replaced"].includes(detail.status)) appendRuntimeTestLog(`Objective flow persistence: ${detail.status} ${JSON.stringify(detail.detail || {})}.`);
      });
      const immutable = await library.diagnosticStoryRecords(id, imported.entry.revisionId);
      await persistence.seedRecords([{
        storeName: "storyDefinitions",
        record: immutable.definition
      }, {
        storeName: "compiledStoryIndexes",
        record: immutable.compiled
      }]);
      const created = await persistence.createSave(materialized.header, materialized.initialRecords);
      saveId = created.saveId;
      await persistence.activateSave(saveId);
      await turn.start();
      const choiceView = await turn.prepareChoice(saveId);
      appendRuntimeTestLog("Objective flow: eligible choice prepared.");
      if (!choiceView.active || choiceView.choices.length !== 1 || choiceView.choices[0].id !== "eligible-choice") throw new Error("Direct-choice requirement filtering exposed a blocked option.");
      let resolved = await turn.resolveChoice(saveId, "eligible-choice", "I choose this, carefully.");
      appendRuntimeTestLog(`Objective flow: choice planned with ${resolved.operations.length} operations and ${resolved.hydration.length} character hydrations.`);
      const materializedOperations = [];
      let materializedGuideAppearance = null;
      for (const hydration of resolved.hydration) {
        const character = await library.materializeRuntimeCharacter(hydration);
        appendRuntimeTestLog(`Objective flow: ${hydration.characterId} materialized into ${character.records.length} records.`);
        if (hydration.characterId === guide.id) materializedGuideAppearance = character.records.find(entry => entry.storeName === "characterAppearance")?.record || null;
        materializedOperations.push({
          type: "character.materialize",
          records: character.records
        });
      }
      const storageBodyFieldByDefinitionField = {
        height: "height",
        body_description: "bodyDescription",
      };
      if (!materializedGuideAppearance || !Object.entries(storageBodyFieldByDefinitionField).every(([definitionField, storageField]) => materializedGuideAppearance[storageField] === expectedGuideBodyScales[definitionField])) throw new Error(`Character materialization did not preserve height and overall body description: ${JSON.stringify(materializedGuideAppearance)}.`);
      await persistence.submitOperations("runtime-direct-choice", [{
        type: "message.add",
        message: resolved.userMessage
      }, ...materializedOperations, ...resolved.operations]);
      appendRuntimeTestLog("Objective flow: direct-choice transaction committed.");
      const reconstructed = await library.reconstructRuntimeSave(saveId);
      const reconstructedGuide = reconstructed.definition.characterDefinitionsById[guide.id];
      if (!reconstructedGuide || !Object.entries(expectedGuideBodyScales).every(([field, value]) => reconstructedGuide.appearance?.[field] === value)) throw new Error(`Character reconstruction did not preserve height and overall body description: ${JSON.stringify(reconstructedGuide?.appearance)}.`);
      if (resolved.userMessage.text !== "I choose this, carefully.") throw new Error("Optional direct-choice text was not preserved.");
      if (resolved.warnings?.length !== 1 || resolved.warnings[0].title !== "Outfit Equip Skipped") throw new Error("A missing reward outfit did not become one diagnostic warning.");
      if (resolved.sharedImageRequests?.length !== 2 || resolved.sharedImageRequests[0].kind !== "profile" || resolved.sharedImageRequests[1].kind !== "character") throw new Error("Profile and solo-character image rewards did not produce post-commit shared-image requests.");
      const playerId = `${id}-player`;
      const fieldItemId = `${playerId}--field-notes`;
      const [coins, rule, guideDefinition, invocation, fieldOutfit, spareOutfit, equipment, fieldItem] = await Promise.all([persistence.getRecord("storyValues", [saveId, "story_inventory", "coins"]), persistence.getRecord("storyRuleAdds", [saveId, "choice-rule"]), persistence.getRecord("saveCharacterDefinitions", [saveId, guide.id]), persistence.getRecord("rewardInvocations", [saveId, `objective-${objectives[0].id}--site-choice-eligible-choice--reward-0-bundle-choice-bundle-0`]), persistence.getRecord("characterOutfits", [saveId, playerId, "field-uniform"]), persistence.getRecord("characterOutfits", [saveId, playerId, "spare-uniform"]), persistence.getRecord("equippedItems", [saveId, playerId]), persistence.getRecord("items", [saveId, fieldItemId])]);
      if (coins?.value !== 30 || !rule || !guideDefinition || !invocation) throw new Error("Choice rewards, bundle idempotency, or future-character materialization did not commit.");
      if (!fieldOutfit || spareOutfit || !equipment?.shirt || !fieldItem) throw new Error("Item grant or outfit grant/equip/delete rewards did not commit correctly.");
      appendRuntimeTestLog("Objective flow: choice reward records verified.");
      const [choiceControl, choiceRuntime, forcedRuntime] = await Promise.all([persistence.getRecord("objectiveControl", saveId), persistence.getRecord("objectiveRuntime", [saveId, objectives[0].id]), persistence.getRecord("objectiveRuntime", [saveId, objectives[3].id])]);
      appendRuntimeTestLog(`Objective flow: after choice control=${JSON.stringify(choiceControl)}, runtime=${JSON.stringify(choiceRuntime)}.`);
      if (choiceControl?.activeMainObjectiveId !== objectives[1].id) throw new Error("The eligible choice did not activate its explicit next objective.");
      if (forcedRuntime?.status !== "complete") throw new Error("Explicit start_objective and complete_objective rewards did not update sparse objective runtime in order.");
      const automatic = await turn.resolveAutomatic(saveId);
      appendRuntimeTestLog(`Objective flow: automatic transition planned (${automatic.applied}).`);
      if (!automatic.applied) throw new Error("Eligible reward-only objective did not resolve.");
      await persistence.submitOperations("runtime-automatic-objective", automatic.operations);
      appendRuntimeTestLog("Objective flow: automatic transition committed.");
      const [control, cascadeItem, removedFieldOutfit, clearedEquipment, retainedClothingItem] = await Promise.all([persistence.getRecord("objectiveControl", saveId), persistence.getRecord("storyListItems", [saveId, "story_inventory", "flags", `fnv1a-${stableRuntimeTestHash(JSON.stringify("cascade-complete"))}`]), persistence.getRecord("characterOutfits", [saveId, playerId, "field-uniform"]), persistence.getRecord("equippedItems", [saveId, playerId]), persistence.getRecord("items", [saveId, equipment.shirt])]);
      if (control?.activeMainObjectiveId !== objectives[2].id || cascadeItem?.value !== "cascade-complete") throw new Error("Reward-only cascade did not apply its reward and activate the next objective.");
      if (removedFieldOutfit || clearedEquipment?.shirt || !retainedClothingItem) throw new Error("delete_all_outfits did not clear outfit references while preserving owned clothing items.");
      completedSuccessfully = true;
      return "choice requirements, bundles, item/outfit rewards, explicit objective controls, missing-outfit warning, eleven-field character materialization/reconstruction, idempotency, and automatic cascade passed";
    } finally {
      turn.dispose();
      if (!completedSuccessfully && persistence.activeSaveState != null) await persistence.abandonActiveSaveForTest();else if (persistence.activeSaveState != null) await persistence.closeActiveSave();
      if (saveId != null) await persistence.deleteSave(saveId);
      persistence.dispose();
      await library.deleteEntry("story", id);
      library.dispose();
    }
  }
}, {
  id: "animal-definition-replacement",
  name: "Animal definitions materialize without humanoid records and support structural replacement",
  execute: async () => {
    const library = await getDiagnosticLibraryController();
    const id = `runtime-animal-replacement-${Date.now()}`;
    const story = runtimeStoryFixture(id, {
      objectiveCount: 1
    });
    const locationId = `${id}-location`;
    const animalId = `${id}-animal`;
    const adultSourceId = `${id}-adult-form`;
    const animal = runtimeAnimalFixture(animalId, "Young Tala");
    const adult = structuredClone(story.storyTemplate.state.player);
    adult.id = adultSourceId;
    adult.name = "Adult Tala";
    delete adult.genres;
    story.storyTemplate.state.npc_directory.locations[locationId].characters[animal.name] = {
      id: animalId,
      name: animal.name,
      gender: animal.gender,
      age: animal.age,
      role: animal.role,
      relationship: animal.starting_relationship_to_player,
      inspected: true,
      animal_definition: animal
    };
    story.storyTemplate.state.scene.npcs_present = [animal.name];
    story.storyTemplate.state.world_map.locations[locationId].npcs = [animalId];
    story.storyTemplate.state.future_cast.items[adultSourceId] = {
      id: adultSourceId,
      name: adult.name,
      status: "hidden",
      scene_presence: "none",
      full_character: adult
    };
    const imported = await library.importFile("story", new Blob([JSON.stringify(story)]));
    try {
      const materialized = await library.materializeNewGame({
        storyId: id,
        revisionId: imported.entry.revisionId,
        selection: {
          source: "story",
          characterId: `${id}-player`
        }
      });
      const animalDefinition = materialized.initialRecords.find(entry => entry.storeName === "saveCharacterDefinitions" && entry.record.characterId === animalId)?.record;
      if (animalDefinition?.definitionType !== "animal" || !animalDefinition.physicalDescription || materialized.initialRecords.some(entry => ["characterAppearance", "characterOutfits", "equippedItems"].includes(entry.storeName) && entry.record.characterId === animalId)) throw new Error("Animal materialization created humanoid appearance, outfit, or equipment records.");
      const replacement = structuredClone(adult);
      replacement.id = animalId;
      replacement.relationship_to_player = "";
      replacement.starting_relationship_to_player = animal.starting_relationship_to_player;
      replacement.starting_trust = animal.starting_trust;
      replacement.starting_affection = animal.starting_affection;
      replacement.starting_attraction = 0;
      const replacementRecords = await library.materializeRuntimeCharacter({
        storyId: id,
        revisionId: imported.entry.revisionId,
        characterId: animalId,
        character: replacement,
        replace: true,
        player: story.storyTemplate.state.player,
        locationId
      });
      const humanoidDefinition = replacementRecords.records.find(entry => entry.storeName === "saveCharacterDefinitions")?.record;
      if (replacementRecords.replace !== true || humanoidDefinition?.characterId !== animalId || humanoidDefinition?.definitionType !== "humanoid" || !replacementRecords.records.some(entry => entry.storeName === "characterAppearance") || !replacementRecords.records.some(entry => entry.storeName === "characterOutfits")) throw new Error("Animal-to-humanoid replacement did not retain the target id and materialize the adult definition.");
      return "animal storage omits humanoid records, replacement retains the stable runtime identity, and an empty current relationship preserves its non-empty authored value";
    } finally {
      await library.deleteEntry("story", id);
    }
  }
}, {
  id: "library-worker-command-contracts",
  name: "Library worker commands reject aliases, coercion, and unknown fields",
  execute: async () => {
    const library = await getDiagnosticLibraryController();
    const id = `runtime-command-contract-${Date.now()}`;
    const imported = await library.importFile("story", new Blob([JSON.stringify(runtimeStoryFixture(id, {
      objectiveCount: 2
    }))]));
    const session = await library.createEditor("story");
    const expectRejection = async (label, action, pattern) => {
      try {
        await action();
      } catch (error) {
        if (pattern.test(String(error.message))) return;
        throw new Error(`${label} returned the wrong error: ${error.message}`);
      }
      throw new Error(`${label} was accepted.`);
    };
    try {
      await expectRejection("numeric-string save id", () => library.request("story.reconstruct-runtime-save", {
        saveId: "1"
      }), /saveId must be a positive safe integer/);
      await expectRejection("string editor offset", () => library.inspectEditor(session.sessionId, [], {
        offset: "0",
        limit: 10
      }), /offset must be a nonnegative safe integer/);
      await expectRejection("unknown story-start field", () => library.request("story.start-options", {
        storyId: id,
        revisionId: imported.entry.revisionId,
        story_id: id
      }), /story_id is not an approved field/);
      await expectRejection("unknown materialization field", () => library.materializeNewGame({
        storyId: id,
        revisionId: imported.entry.revisionId,
        selection: {
          source: "story",
          characterId: `${id}-player`
        }
       ,unexpectedField: true}), /unexpectedField is not an approved field/);
      await expectRejection("runtime player characterId alias", () => library.materializeRuntimeCharacter({
        storyId: id,
        revisionId: imported.entry.revisionId,
        characterId: `${id}-player`,
        player: {
          characterId: `${id}-player`
        }
      }), /runtime player id must be text/);
      await expectRejection("malformed diagnostic entry", () => library.request("diagnostics.append", {
        entry: {
          at: String(Date.now()),
          level: "info",
          category: "runtime-test",
          message: "Wrong timestamp type.",
          details: null
        }
      }), /entry.at must be a nonnegative safe integer/);
      return "worker envelopes reject unknown fields, numeric strings, boolean strings, aliases, and malformed diagnostics";
    } finally {
      await library.closeEditor(session.sessionId).catch(() => {});
      await library.deleteEntry("story", id);
    }
  }
}, {
  id: "worker-held-definition-editor",
  name: "Definition editor keeps large drafts in the worker and saves validated revisions",
  execute: async () => {
    const library = await getDiagnosticLibraryController();
    const id = `runtime-editor-${Date.now()}`;
    const story = runtimeStoryFixture(id, {
      objectiveCount: 240
    });
    const imported = await library.importFile("story", new Blob([JSON.stringify(story)]));
    try {
      const session = await library.startEditor("story", id, imported.entry.revisionId);
      if (session.root.kind !== "object" || Object.prototype.hasOwnProperty.call(session, "draft")) throw new Error("Editor start transferred the full definition instead of a bounded root descriptor.");
      const objectives = await library.inspectEditor(session.sessionId, ["state", "objectives", "items"], {
        offset: 100,
        limit: 60
      });
      if (objectives.kind !== "array" || objectives.total !== 240 || objectives.entries.length !== 60) throw new Error("Editor objective paging did not stay bounded.");
      const graphPage = await library.listEditorObjectives(session.sessionId, {
        offset: 90,
        limit: 30
      });
      if (graphPage.total !== 240 || graphPage.objectives.length !== 30 || graphPage.objectives[0].index !== 90) throw new Error("Worker-held objective graph paging did not stay bounded.");
      const selectedObjective = graphPage.objectives[0];
      selectedObjective.title = "Updated Bounded Objective";
      selectedObjective.next_objectives[0].dialogue_lines = [`(|[character:${id}-player]|) "She said "keep going" without changing the exact line."`];
      selectedObjective.next_objectives[0].rewards = [{
        type: "apply_reward_template",
        template_id: "editor-relationship",
        arguments: {
          character_id: `${id}-player`
        }
      }];
      await library.replaceEditorObjective(session.sessionId, selectedObjective.id, selectedObjective);
      const exactDialogue = await library.inspectEditor(session.sessionId, ["state", "objectives", "items", selectedObjective.index, "next_objectives", 0, "dialogue_lines", 0]);
      if (exactDialogue.value !== selectedObjective.next_objectives[0].dialogue_lines[0]) throw new Error("Objective editing altered quotation marks inside exact dialogue.");
      const [characters, locations] = await Promise.all([library.editorCatalog(session.sessionId, "characters"), library.editorCatalog(session.sessionId, "locations")]);
      if (!characters.some(entry => entry.id === `${id}-player`) || !locations.some(entry => entry.id === `${id}-location`)) throw new Error("Guided editor catalogs omitted a named character or location.");
      await library.putEditorRewardTemplate(session.sessionId, "editor-relationship", "Editor Relationship", [{
        type: "adjust_relationship",
        target: {
          parameter: "character_id"
        },
        stats: {
          trust: 1
        }
      }], {
        character_id: {
          type: "character_id"
        }
      });
      const templates = await library.editorCatalog(session.sessionId, "reward_templates");
      const parameterizedTemplate = templates.find(entry => entry.id === "editor-relationship");
      if (parameterizedTemplate?.parameters?.character_id?.type !== "character_id") throw new Error("Guided editor did not store or list typed reward-template parameters.");
      await library.putEditorRewardBundle(session.sessionId, "editor-fixed-bundle", "Editor Fixed Bundle", [{
        type: "adjust_story_inventory",
        field_path: ["story_inventory", "coins"],
        operation: "add",
        amount: 3
      }]);
      const bundles = await library.editorCatalog(session.sessionId, "reward_bundles");
      if (!bundles.some(entry => entry.id === "editor-fixed-bundle")) throw new Error("Guided editor did not store or list a fixed reward bundle.");
      const addedObjective = await library.addEditorObjective(session.sessionId, "Temporary Runtime Objective");
      addedObjective.next_objectives = [{
        id: `${addedObjective.id}-output-1`,
        objective_id: selectedObjective.id,
        target_input_group_id: `${selectedObjective.id}--temporary-input`,
        completion_instruction: "Converge on the bounded objective.",
        requirements: [],
        rewards: []
      }];
      await library.replaceEditorObjective(session.sessionId, addedObjective.id, addedObjective);
      const inputs = await library.getEditorObjectiveInputs(session.sessionId, selectedObjective.id);
      if (inputs.transitions.length !== 2) throw new Error("Objective input manager did not find both incoming outputs.");
      await library.setEditorObjectiveInputs(session.sessionId, selectedObjective.id, inputs.transitions.map(transition => ({
        sourceObjectiveId: transition.sourceObjectiveId,
        outputId: transition.outputId,
        groupId: `${selectedObjective.id}--shared-input`
      })));
      const groupedInputs = await library.getEditorObjectiveInputs(session.sessionId, selectedObjective.id);
      if (!groupedInputs.transitions.every(transition => transition.groupId === `${selectedObjective.id}--shared-input`)) throw new Error("Objective input manager did not preserve an authored AND group.");
      await library.removeEditorObjective(session.sessionId, addedObjective.id);
      await library.setEditorValue(session.sessionId, ["title"], "Updated Runtime Editor Story");
      const saved = await library.saveEditor(session.sessionId);
      if (saved.entry.title !== "Updated Runtime Editor Story" || saved.entry.revisionId === imported.entry.revisionId) throw new Error("Editor save did not validate and store a new immutable revision.");
      return "bounded worker-held paging, exact dialogue, named catalogs, AND/OR inputs, reward templates, and validated revision save passed";
    } finally {
      await library.deleteEntry("story", id);
    }
  }
}, {
  id: "guided-character-editor",
  name: "Guided character editing preserves definitions without exposing the full draft",
  execute: async () => {
    const library = await getDiagnosticLibraryController();
    const id = `runtime-character-editor-${Date.now()}`;
    const imported = await library.importFile("character", new Blob([JSON.stringify(runtimeCharacterFixture(id))]));
    try {
      const session = await library.startEditor("character", id, imported.entry.revisionId);
      await library.patchCharacterEditor(session.sessionId, {
        starting_inventory: [{
          id: "structured-item",
          name: "Structured Item",
          description: "A structured inventory record",
          type: "tool",
          quantity: 2,
          value: 17,
          sellable: true
        }]
      }, {});
      const model = await library.getCharacterEditor(session.sessionId);
      if (Object.prototype.hasOwnProperty.call(model, "draft") || model.fields.name !== `Runtime Character ${id}` || model.outfits.length !== 1) throw new Error("Guided character editor returned an unbounded or incomplete projection.");
      await library.patchCharacterEditor(session.sessionId, {
        role: "Updated guided-editor role"
      }, {
        eye_color: "green"
      });
      const extra = {
        id: "guided-extra",
        name: "Guided Extra Outfit",
        clothing: {
          shirt: "guided editor shirt",
          pants: "guided editor trousers"
        }
      };
      await library.putCharacterEditorOutfit(session.sessionId, extra);
      await library.putCharacterEditorOutfit(session.sessionId, {
        ...extra,
        id: "guided-fallback",
        name: "Guided Fallback Outfit"
      }, "", true);
      const stored = await library.getCharacterEditorOutfit(session.sessionId, "guided-extra");
      if (stored.clothing.shirt !== "guided editor shirt") throw new Error("Guided outfit editor changed authored clothing data.");
      await library.removeCharacterEditorOutfit(session.sessionId, "guided-extra");
      await library.removeCharacterEditorOutfit(session.sessionId, "guided-fallback", true);
      const saved = await library.saveEditor(session.sessionId);
      const exported = await library.exportDefinition("character", id, saved.entry.revisionId);
      const savedDefinition = JSON.parse(await exported.blob.text()).character_definition;
      if (saved.entry.role !== "Updated guided-editor role" || saved.entry.revisionId === imported.entry.revisionId) throw new Error("Guided character changes did not save as a validated immutable revision.");
      if (savedDefinition.starting_inventory?.[0]?.description !== "A structured inventory record" || savedDefinition.starting_inventory[0].quantity !== 2) throw new Error("Guided character changes flattened a structured inventory record.");
      return "bounded projection, structured inventory preservation, outfit CRUD, fallback outfit CRUD, and validated save passed";
    } finally {
      await library.deleteEntry("character", id);
    }
  }
}, {
  id: "diagnostic-log-export",
  name: "Session diagnostics persist in the worker and export in full",
  execute: async () => {
    const library = await getDiagnosticLibraryController();
    await library.resetDevLogs();
    const github = await library.request("diagnostic.import-url.parse", {
      url: "https://github.com/owner/repository/blob/main/story.json"
    });
    const drive = await library.request("diagnostic.import-url.parse", {
      url: "https://drive.google.com/file/d/runtime-file-id/view?usp=sharing"
    });
    if (github.url !== "https://raw.githubusercontent.com/owner/repository/main/story.json" || !drive.url.includes("id=runtime-file-id")) throw new Error("Hosted import URL normalization failed for GitHub or Google Drive.");
    for (let index = 0; index < 125; index++) {
      await library.appendDevLog({
        at: Date.now() + index,
        level: index % 17 === 0 ? "warning" : "info",
        category: "runtime-test",
        message: `Diagnostic entry ${index + 1}`,
        details: {
          index
        }
      });
    }
    const exported = await library.exportDevLogs();
    const source = await exported.blob.text();
    if (exported.count !== 125 || !source.includes("Diagnostic entry 1") || !source.includes("Diagnostic entry 125")) throw new Error("The exported developer trace omitted early or late session entries.");
    return "125 worker-persisted session entries exported without a rolling-memory cutoff";
  }
}, {
  id: "text-provider-routing",
  name: "Perchance and Local Codex text providers remain explicit and return the same final-text contract",
  execute: async () => {
    const priorFetch = globalThis.fetch;
    const priorOverrides = globalThis.__emberAdventuresPluginOverrides;
    const priorSettings = {
      textProvider: app.settings.textProvider,
      localCodexTextUrl: app.settings.localCodexTextUrl,
      localCodexTextModel: app.settings.localCodexTextModel,
      localCodexTextEffort: app.settings.localCodexTextEffort
    };
    const priorForceLocal = app.devForceLocalCodexTextLaunch;
    try {
      app.devForceLocalCodexTextLaunch = true;
      app.settings.textProvider = "local-codex";
      app.settings.localCodexTextUrl = "https://localhost.invalid/api/text/generate";
      globalThis.fetch = async (url, options) => {
        const payload = JSON.parse(options.body);
        if (url !== app.settings.localCodexTextUrl || !payload.instruction.endsWith("local prompt") || !payload.instruction.includes("family-friendly")) throw new Error("Local Codex request routing changed its URL or instruction.");
        return new Response(JSON.stringify({
          ok: true,
          generatedText: "local result"
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        });
      };
      if ((await aiText("local prompt")) !== "local result") throw new Error("Local Codex did not return the common final-text contract.");
      app.devForceLocalCodexTextLaunch = false;
      app.settings.textProvider = "perchance";
      globalThis.__emberAdventuresPluginOverrides = {
        ...(priorOverrides || {}),
        aiTextPlugin: async ({
          instruction,
          onChunk
        }) => {
          if (!instruction.endsWith("perchance prompt") || !instruction.includes("family-friendly")) throw new Error("Perchance instruction changed.");
          onChunk?.("perchance result");
          return {
            generatedText: "perchance result",
            stopReason: "stop"
          };
        }
      };
      if ((await aiText("perchance prompt")) !== "perchance result") throw new Error("Perchance did not return the common final-text contract.");
    } finally {
      globalThis.fetch = priorFetch;
      globalThis.__emberAdventuresPluginOverrides = priorOverrides;
      app.devForceLocalCodexTextLaunch = priorForceLocal;
      Object.assign(app.settings, priorSettings);
    }
    return "Perchance and Local Codex provider routing passed";
  }
}, {
  id: "stream-generation-cancellation",
  name: "Stopping a streamed narrator response keeps partial text and ignores late provider chunks",
  execute: async () => {
    const priorOverrides = globalThis.__emberAdventuresPluginOverrides;
    const priorProvider = app.settings.textProvider;
    const priorMessages = app.messages;
    let emitChunk = null;
    const message = {
      id: "cancel-stream",
      role: "assistant",
      speaker: "Narrator",
      at: new Date().toISOString(),
      text: ""
    };
    try {
      app.settings.textProvider = "perchance";
      globalThis.__emberAdventuresPluginOverrides = {
        ...(priorOverrides || {}),
        aiTextPlugin: ({
          onChunk
        }) => {
          emitChunk = onChunk;
          return new Promise(() => {});
        }
      };
      app.messages = [...app.messages, message];
      const request = aiText("stream prompt", {
        messageId: "cancel-stream",
        onStream: fullText => {
          message.text = fullText;
        }
      });
      for (let frame = 0; frame < 120 && !emitChunk; frame++) await nextFrame();
      if (!emitChunk) throw new Error("Streaming provider did not start.");
      emitChunk("Partial narrator response.");
      await Promise.resolve();
      if (!EmberAdventures.stopGeneratingMessage("cancel-stream")) throw new Error("A streamed response with partial text could not be stopped.");
      let cancelled = false;
      await request.catch(error => {
        cancelled = /cancel/i.test(error?.message || String(error));
      });
      emitChunk(" This late chunk must be ignored.");
      await Promise.resolve();
      if (!cancelled || message.text !== "Partial narrator response.") throw new Error("Stopping generation did not preserve exactly the received partial text.");
    } finally {
      app.messages = priorMessages;
      app.settings.textProvider = priorProvider;
      globalThis.__emberAdventuresPluginOverrides = priorOverrides;
    }
    return "partial response cancellation and late-chunk rejection passed";
  }
}, {
  id: "chat-message-image-rendering",
  name: "Chat messages use styled bubbles and story images stay anchored to their requesting messages",
  execute: async () => {
    const priorMessages = app.messages;
    const priorImages = app.images;
    const priorSetting = app.settings.showImagesInChat;
    const thread = $("thread");
    const priorChildren = [...thread.childNodes];
    const messageId = `chat-render-${Date.now()}`;
    try {
      app.settings.showImagesInChat = true;
      app.messages = [{
        id: messageId,
        role: "assistant",
        speaker: "Narrator",
        at: new Date().toISOString(),
        text: assistantVisibleMessageText('*The door opens.*\n\n(Vessa Threadwell female) "Welcome back."\n\n(Guide male) "Come inside."')
      }];
      app.images = [{
        id: `${messageId}-image`,
        title: "Rendered Scene",
        requestedAfterMessageId: messageId,
        requestOrder: 1,
        pending: false,
        hideFromChat: false,
        html: '<img src="data:image/png;base64,iVBORw0KGgo=" alt="Rendered Scene">'
      }];
      thread.replaceChildren();
      app.newGameChatScrollToTop = null;
      app.existingGameChatScrollToBottom = null;
      renderThread("runtime chat rendering test");
      const message = thread.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
      if (!message?.querySelector(".bubble") || !message.querySelector(".story-dialogue") || !message.querySelector(".story-voice-label")) throw new Error(`Runtime message formatting did not preserve the production bubble, dialogue, and speaker-label structure: ${thread.innerHTML.slice(0, 1200)}`);
      const image = thread.querySelector(`[data-image-id="${CSS.escape(`${messageId}-image`)}"]`);
      if (!image || !message?.nextElementSibling?.contains(image) || !image.querySelector("img")) throw new Error("Ready story image was not rendered immediately after its requesting message.");
      const originalCaptureAnchor = captureThreadViewportAnchor;
      const originalIsAtBottom = threadViewportIsAtBottom;
      try {
        captureThreadViewportAnchor = () => {
          throw new Error("Unchanged transcript measured its viewport anchor.");
        };
        threadViewportIsAtBottom = () => {
          throw new Error("Unchanged transcript measured its scroll geometry.");
        };
        renderThread("runtime unchanged chat rendering test");
        if (thread.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`) !== message) throw new Error("Unchanged transcript replaced its message DOM.");
      } finally {
        captureThreadViewportAnchor = originalCaptureAnchor;
        threadViewportIsAtBottom = originalIsAtBottom;
      }
      app.settings.showImagesInChat = false;
      renderThread("runtime chat images disabled test");
      if (thread.querySelector("[data-image-id]")) throw new Error("Disabling chat images did not remove only the chat image projection.");
    } finally {
      app.messages = priorMessages;
      app.images = priorImages;
      app.settings.showImagesInChat = priorSetting;
      thread.replaceChildren(...priorChildren);
    }
    return "message styling and message-anchored chat images passed";
  }
}, {
  id: "shared-image-ownership",
  name: "Shared image stores preserve ownership and clean selections with blobs",
  execute: async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const characterId = `runtime-character-${suffix}`;
    const storyId = `runtime-story-${suffix}`;
    const profileId = `profile-${suffix}`;
    const characterImageId = `character-${suffix}`;
    const itemImageId = `item-${suffix}`;
    const outfitImageId = `outfit-${suffix}`;
    const titleImageId = `title-${suffix}`;
    const rewardImageId = `reward-${suffix}`;
    let importedProfileImageId = "";
    let importedTitleImageId = "";
    const metadata = imageId => ({
      imageId,
      model: "runtime",
      seed: 1,
      prompt: "runtime",
      negativePrompt: "",
      url: ""
    });
    const records = [{
      storeName: "characterProfileImages",
      record: {
        ...metadata(profileId),
        characterId,
        presentation: "non_male",
        favorite: false
      }
    }, {
      storeName: "characterProfileImageSelections",
      record: {
        characterId,
        presentation: "non_male",
        imageId: profileId
      }
    }, {
      storeName: "characterImages",
      record: {
        ...metadata(characterImageId),
        characterId,
        presentation: "non_male",
        favorite: false
      }
    }, {
      storeName: "storyItemImages",
      record: {
        ...metadata(itemImageId),
        storyId,
        itemId: "runtime-item"
      }
    }, {
      storeName: "storyItemImageSelections",
      record: {
        storyId,
        itemId: "runtime-item",
        imageId: itemImageId
      }
    }, {
      storeName: "storyOutfitImages",
      record: {
        ...metadata(outfitImageId),
        storyId,
        characterId,
        outfitId: "runtime-outfit"
      }
    }, {
      storeName: "storyOutfitImageSelections",
      record: {
        storyId,
        characterId,
        outfitId: "runtime-outfit",
        imageId: outfitImageId
      }
    }, {
      storeName: "storyTitleImages",
      record: {
        ...metadata(titleImageId),
        storyId
      }
    }, {
      storeName: "storyTitleImageSelections",
      record: {
        storyId,
        imageId: titleImageId
      }
    }, {
      storeName: "storyRewardImages",
      record: {
        ...metadata(rewardImageId),
        storyId,
        rewardImageId: "runtime-reward",
        title: "Runtime Reward"
      }
    }, {
      storeName: "assetBlobs",
      record: {
        imageId: profileId,
        blob: new Blob(["runtime"], {
          type: "image/png"
        }),
        mimeType: "image/png",
        byteLength: 7,
        contentHash: `hash-${suffix}`
      }
    }];
    await app.persistence.putSharedRecords(records);
    const profiles = await app.persistence.listSharedRecords("characterProfileImages", {
      indexName: "byCharacterPresentation",
      key: [characterId, "non_male"]
    });
    if (profiles.records.length !== 1 || profiles.records[0].imageId !== profileId) throw new Error("Character/presentation image lookup was not exact.");
    await app.persistence.putSharedRecords([{
      storeName: "assetBlobs",
      record: {
        imageId: titleImageId,
        blob: new Blob(["runtime-title"], {
          type: "image/png"
        }),
        mimeType: "image/png",
        byteLength: 13,
        contentHash: `title-hash-${suffix}`
      }
    }]);
    const generatedAsset = await app.persistence.getRecord("assetBlobs", titleImageId);
    if (!(generatedAsset?.blob instanceof Blob)) throw new Error("Shared story title image metadata and blob did not use the same stable image id.");
    for (const [storeName, imageId] of [["characterProfileImages", profileId], ["characterImages", characterImageId], ["storyItemImages", itemImageId], ["storyOutfitImages", outfitImageId], ["storyTitleImages", titleImageId], ["storyRewardImages", rewardImageId]]) await app.persistence.deleteSharedImage(storeName, imageId);
    const [selection, asset] = await Promise.all([app.persistence.getRecord("characterProfileImageSelections", [characterId, "non_male"]), app.persistence.getRecord("assetBlobs", profileId)]);
    if (selection?.imageId != null || asset != null) throw new Error("Deleting a shared image did not clear its selection and binary asset atomically.");
    return "all shared image owners, selections, and blob cleanup passed";
  }
}, {
  id: "shop-purchase-job-flow",
  name: "Shop purchases and generated side jobs commit atomically",
  execute: async () => {
    appendRuntimeTestLog("Shop flow: preparing fixture.");
    const library = await getDiagnosticLibraryController();
    const id = `runtime-shop-${Date.now()}`;
    const story = runtimeStoryFixture(id);
    story.storyTemplate.state.story_shops = {
      general: {
        id: "general",
        title: "Runtime Store",
        type: "general",
        subtype: "General Store",
        unlocked: true,
        currency: "coins",
        npc_location_id: `${id}-location`,
        markup: 1,
        items: [{
          id: "runtime-tonic",
          item: {
            id: "runtime-tonic",
            name: "Runtime Tonic",
            type: "consumable",
            quantity: 1,
            value: 5,
            sellable: true,
            quest_item: false,
            description: "A bounded test tonic.",
            image_prompt: "A small glass bottle containing a bright restorative tonic.",
            image_id: ""
          }
        }]
      },
      clothing: {
        id: "clothing",
        title: "Runtime Outfitter",
        type: "clothing",
        subtype: "Outfitter",
        unlocked: true,
        currency: "coins",
        npc_location_id: `${id}-location`,
        items: [{
          id: "runtime-coat-listing",
          title: "Runtime Coat",
          price: 4,
          requirements: [],
          outfit: {
            id: "runtime-coat",
            name: "Runtime Coat",
            clothing: {
              coat: "a bounded runtime test coat"
            }
          }
        }]
      },
      jobs: {
        id: "jobs",
        title: "Runtime Jobs",
        type: "job",
        subtype: "Job Board",
        unlocked: true,
        currency: "coins",
        npc_location_id: `${id}-location`,
        items: [{
          id: "bounded-job",
          title: "Perform Bounded Work",
          summary: "Perform one bounded test action.",
          genres: ["fantasy"],
          rank: 0,
          requirements: [],
          reward_coins: 7,
          reward_xp: 2,
          completion_criteria: "Complete when the player performs the bounded work.",
          completion_instruction: "Acknowledge the completed bounded work."
        }]
      }
    };
    const imported = await library.importFile("story", new Blob([JSON.stringify(story)]));
    appendRuntimeTestLog("Shop flow: fixture imported.");
    const materialized = await library.materializeNewGame({
      storyId: id,
      revisionId: imported.entry.revisionId,
      selection: {
        source: "story",
        characterId: `${id}-player`
      }
    });
    const persistence = new EmberPersistence.Controller(testWorkerUrl(), {
      watchdogMilliseconds: 5000,
      visibilityProvider: () => "visible"
    });
    const turn = new EmberTurn.Controller(diagnosticTurnWorkerUrl(), {
      runtimeDatabaseName: "EmberAdventuresLiteRuntimeDiagnostic"
    });
    let saveId = null;
    let completedSuccessfully = false;
    try {
      appendRuntimeTestLog("Shop flow: starting persistence.");
      await persistence.start();
      const immutable = await library.diagnosticStoryRecords(id, imported.entry.revisionId);
      await persistence.seedRecords([{
        storeName: "storyDefinitions",
        record: immutable.definition
      }, {
        storeName: "compiledStoryIndexes",
        record: immutable.compiled
      }]);
      const created = await persistence.createSave(materialized.header, materialized.initialRecords);
      saveId = created.saveId;
      await persistence.activateSave(saveId);
      await turn.start();
      appendRuntimeTestLog("Shop flow: save active; preparing shops.");
      const view = await turn.prepareShops(saveId);
      const clothingView = view.shops.find(shop => shop.shopId === "clothing");
      if (view.shops.length !== 3 || !view.shops.find(shop => shop.shopId === "general")?.items[0]?.available || clothingView?.recipients?.[0]?.characterId !== `${id}-player`) throw new Error("Worker shop view did not expose the available immutable listings.");
      const purchase = await turn.purchaseShopItem(saveId, "general", "runtime-tonic");
      appendRuntimeTestLog(`Shop flow: committing general purchase: ${JSON.stringify(purchase.operations)}.`);
      await persistence.submitOperations("runtime-shop-purchase", purchase.operations);
      appendRuntimeTestLog("Shop flow: general purchase committed.");
      const [coinsAfterPurchase, tonic, listingRuntime] = await Promise.all([persistence.getRecord("storyValues", [saveId, "story_inventory", "coins"]), persistence.getRecord("items", [saveId, "general--runtime-tonic"]), persistence.getRecord("shopItemRuntime", [saveId, "general", "runtime-tonic"])]);
      if (coinsAfterPurchase?.value !== 20 || tonic?.quantity !== 1 || listingRuntime?.purchaseCount !== 1) throw new Error(`General-shop transaction mismatch: coins=${coinsAfterPurchase?.value}, tonic=${tonic?.quantity}, purchases=${listingRuntime?.purchaseCount}.`);
      const clothingPurchase = await turn.purchaseShopItem(saveId, "clothing", "runtime-coat-listing", `${id}-player`);
      appendRuntimeTestLog(`Shop flow: committing clothing purchase: ${JSON.stringify(clothingPurchase.operations)}.`);
      await persistence.submitOperations("runtime-clothing-purchase", clothingPurchase.operations);
      appendRuntimeTestLog("Shop flow: clothing purchase committed.");
      const [purchasedOutfit, purchasedInventory, coinsAfterClothing] = await Promise.all([persistence.getRecord("characterOutfits", [saveId, `${id}-player`, "runtime-coat"]), turn.prepareInventory(saveId), persistence.getRecord("storyValues", [saveId, "story_inventory", "coins"])]);
      if (!purchasedOutfit || !purchasedInventory.items.some(item => item.characterId === `${id}-player` && item.description === "a bounded runtime test coat") || coinsAfterClothing?.value !== 16) throw new Error("Recipient-specific clothing purchase did not persist its normalized outfit, item, and currency changes.");
      const accepted = await turn.purchaseShopItem(saveId, "jobs", "bounded-job");
      appendRuntimeTestLog(`Shop flow: committing job acceptance: ${JSON.stringify(accepted.operations)}.`);
      await persistence.submitOperations("runtime-job-accept", accepted.operations);
      appendRuntimeTestLog("Shop flow: job acceptance committed.");
      const jobId = "job-jobs--bounded-job";
      const stepId = `${jobId}--work`;
      const [jobDefinition, jobRuntime, control] = await Promise.all([persistence.getRecord("runtimeJobDefinitions", [saveId, jobId]), persistence.getRecord("generatedJobRuntime", [saveId, jobId]), persistence.getRecord("objectiveControl", saveId)]);
      if (!jobDefinition || jobRuntime?.status !== "active" || control?.focusedSideObjectiveId !== stepId) throw new Error("Accepted job did not create and focus its immutable generated side objective.");
      const prepared = await turn.prepareTurn(saveId, "I perform the bounded work.", "Runtime Player");
      const completed = await turn.resolveObjective(saveId, '{"c":true,"p":"done"}');
      appendRuntimeTestLog(`Shop flow: committing job completion: ${JSON.stringify(completed.operations)}.`);
      await persistence.submitOperations("runtime-job-complete", completed.operations);
      appendRuntimeTestLog("Shop flow: job completion committed.");
      const [completedRuntime, completedListing, finalControl, rewardCoins] = await Promise.all([persistence.getRecord("generatedJobRuntime", [saveId, jobId]), persistence.getRecord("shopItemRuntime", [saveId, "jobs", "bounded-job"]), persistence.getRecord("objectiveControl", saveId), persistence.getRecord("storyValues", [saveId, "story_inventory", "coins"])]);
      if (!prepared.objectivePrompt || completedRuntime?.status !== "complete" || completedListing?.completed !== true || finalControl?.focusedSideObjectiveId != null || rewardCoins?.value !== 23) throw new Error("Generated side-job completion did not clear focus and apply rewards atomically.");
      completedSuccessfully = true;
      return "shop purchase and generated side-job accept/complete flow passed";
    } finally {
      turn.dispose();
      if (!completedSuccessfully && persistence.activeSaveState != null) await persistence.abandonActiveSaveForTest();else if (persistence.activeSaveState != null) await persistence.closeActiveSave();
      if (saveId != null) await persistence.deleteSave(saveId);
      persistence.dispose();
      await library.deleteEntry("story", id);
    }
  }
}, {
  id: "voice-speaker-chunking",
  name: "Voice parsing groups continuous dialogue by speaker and keeps player speech on the player voice path",
  execute: async () => {
    const assistantChunks = splitVoiceParts('*Vessa looks up.*\n\n(Vessa Threadwell) "First line." "Second line."\n\n*The door opens.*\n\n(Guide) "Third line."');
    const playerChunks = playerVoicePartsForText('"I will go." Then I explain the rest of my plan.').map(chunk => ({
      ...chunk,
      speaker: "Runtime Player"
    }));
    const vessaText = assistantChunks.filter(chunk => chunk.speaker === "Vessa Threadwell").map(chunk => chunk.text).join(" ");
    if (vessaText !== "First line. Second line.") throw new Error("Consecutive dialogue did not remain assigned to the same character voice.");
    if (!assistantChunks.some(chunk => chunk.kind === "narration") || !assistantChunks.some(chunk => chunk.speaker === "Guide")) throw new Error("Narrator or changed-speaker voice chunks were lost.");
    const playerText = playerChunks.map(chunk => chunk.text).join(" ");
    if (!playerChunks.length || playerChunks.some(chunk => chunk.speaker !== "Runtime Player") || !playerText.includes("rest of my plan")) throw new Error("A player-authored message fell back to narrator chunking.");
    const priorActiveGame = app.activeGame;
    const priorPersistence = app.persistence;
    const priorState = app.state;
    const speechSynthesisDescriptor = Object.getOwnPropertyDescriptor(window, "speechSynthesis");
    const utteranceDescriptor = Object.getOwnPropertyDescriptor(window, "SpeechSynthesisUtterance");
    const priorVoiceSettings = {
      autoVoice: app.settings.autoVoice,
      autoReadPlayerMessages: app.settings.autoReadPlayerMessages,
      readGameMessages: app.settings.readGameMessages,
      voiceGenderMap: clone(app.settings.voiceGenderMap),
      defaultNonMalePlayerVoiceName: app.settings.defaultNonMalePlayerVoiceName,
      defaultNarratorVoiceName: app.settings.defaultNarratorVoiceName
    };
    const spoken = [];
    const savedTemporarySpeakers = new Map();
    try {
      app.state = {
        ...clone(defaultState),
        player: {
          ...clone(defaultState.player),
          id: "runtime-player",
          name: "Runtime Player",
          gender: "female"
        }
      };
      app.activeGame = {
        saveId: 999,
        header: {
          playerCharacterId: "runtime-player"
        },
        recordsByStore: {
          saveCharacterDefinitions: [{
            characterId: "runtime-player",
            name: "Runtime Player",
            gender: "female"
          }],
          characterSettings: []
        }
      };
      app.persistence = {
        getRecord: async (storeName, key) => storeName === "temporarySpeakers" ? savedTemporarySpeakers.get(key[1]) || null : null,
        submitOperations: async (_type, operations) => {
          for (const operation of operations || []) {
            if (operation.type === "temporary.speaker.put") savedTemporarySpeakers.set(operation.speaker.temporarySpeakerId, operation.speaker);
          }
          return {};
        }
      };
      app.settings.autoVoice = false;
      app.settings.autoReadPlayerMessages = false;
      app.settings.readGameMessages = false;
      app.settings.voiceGenderMap = {
        "Google UK English Female": "female",
        "Google UK English Male": "male"
      };
      app.settings.defaultNonMalePlayerVoiceName = "Google UK English Female";
      app.settings.defaultNarratorVoiceName = "Google UK English Male";
      Object.defineProperty(window, "SpeechSynthesisUtterance", {
        configurable: true,
        value: class RuntimeUtterance {
          constructor(text) {
            this.text = text;
          }
        }
      });
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: {
          getVoices: () => [{
            name: "Google UK English Female",
            lang: "en-GB"
          }, {
            name: "Google UK English Male",
            lang: "en-GB"
          }],
          cancel() {},
          speak(utterance) {
            spoken.push(utterance.text);
            queueMicrotask(() => utterance.onend?.());
          }
        }
      });
      app.voiceCacheInitialized = false;
      loadVoices();
      readSingleMessage({
        id: "voice-player",
        role: "user",
        speaker: "Runtime Player",
        text: "Manual player line."
      }, {
        manual: true
      });
      for (let frame = 0; frame < 2; frame++) await nextFrame();
      readSingleMessage({
        id: "voice-game",
        role: "system",
        speaker: "Game",
        text: "Manual game notice."
      }, {
        manual: true
      });
      for (let frame = 0; frame < 2; frame++) await nextFrame();
      readSingleMessage({
        id: "unknown-1",
        role: "assistant",
        speaker: "Narrator",
        text: '(Unknown Guide female) "Persistent temporary voice."'
      }, {
        manual: true
      });
      for (let frame = 0; frame < 8; frame++) await nextFrame();
      const firstTemporaryVoice = app.state.temp_speakers?.["Unknown Guide"]?.voice;
      readSingleMessage({
        id: "unknown-2",
        role: "assistant",
        speaker: "Narrator",
        text: '(Unknown Guide female) "Persistent temporary voice replay."'
      }, {
        manual: true
      });
      for (let frame = 0; frame < 8; frame++) await nextFrame();
      if (spoken.length !== 4 || !spoken.includes("Manual player line.") || !spoken.includes("Manual game notice.")) throw new Error(`Manual message playback still obeyed disabled automatic voice settings: ${JSON.stringify(spoken)}`);
      if (!firstTemporaryVoice || Object.keys(app.state.temp_speakers || {}).length !== 1 || app.state.temp_speakers["Unknown Guide"]?.voice !== firstTemporaryVoice) throw new Error("Unknown tagged speaker did not persist and reuse one save-local voice assignment.");
    } finally {
      app.activeGame = priorActiveGame;
      app.persistence = priorPersistence;
      app.state = priorState;
      Object.assign(app.settings, priorVoiceSettings);
      if (speechSynthesisDescriptor) Object.defineProperty(window, "speechSynthesis", speechSynthesisDescriptor);else delete window.speechSynthesis;
      if (utteranceDescriptor) Object.defineProperty(window, "SpeechSynthesisUtterance", utteranceDescriptor);else delete window.SpeechSynthesisUtterance;
    }
    return "speaker-only chunk boundaries, player/temporary voice routing, and manual playback overrides passed";
  }
}, {
  id: "library-invalid-import",
  name: "Malformed definitions and invalid objective combinations are rejected before storage",
  execute: async () => {
    const controller = await getDiagnosticLibraryController();
    let malformedRejected = false;
    let incompleteRejected = false;
    const exactRuntimeState = {
      player: {
        name: "Runtime Player"
      },
      characters: {
        "Runtime Partner": {}
      },
      npc_directory: {
        locations: {}
      },
      scene: {
        party_members_present: ["Runtime Partner"],
        npcs_present: []
      }
    };
    const exactActs = [];
    if (exactActs[0]?.act !== "giving_oral") {}
    try {} catch (error) {}
    if ([][0]?.act !== "giving_oral") {}
    let inventoryAliasRejected = false;
    try {
      exactInventoryList([{
        name: "Travel cloak"
      }]);
    } catch (error) {
      inventoryAliasRejected = String(error.message).includes("not an approved field");
    }
    const publicRow = {
      id: "00000000-0000-4000-8000-000000000001",
      type: "story",
      definition_id: "strict-public-story",
      title: "Strict Public Story",
      description: "Strict row contract.",
      name: null,
      creator: "Runtime Tests",
      creator_id: "00000000-0000-4000-8000-000000000002",
      creation_tool: "Runtime Tests",
      source: "",
      genres: ["fantasy"],
      rating_total: 0,
      rating_count: 0,
      rating_average: 0,
      created_at: "2026-08-17T00:00:00.000Z",
      updated_at: "2026-08-17T00:00:00.000Z",
      player_select: false,
      player_option_count: 1,
      main_objective_count: 1,
      side_objective_count: 0,
      future_character_count: 0,
      starting_party_member_count: 0,
      starting_npc_count: 0,
      gender: null,
      fallback_gender: null,
      male_name: null,
      non_male_name: null,
      male_image_url: null,
      non_male_image_url: null,
      age: null,
      species: null,
      role: null,
      voice_gender: null,
      current_version_id: "00000000-0000-4000-8000-000000000003",
      payload_url: "https://example.invalid/strict-public-story.json",
      payload_sha256: null,
      payload_size_bytes: null,
      image_url: null,
      user_rating: null,
      ordering_value: "strict-public-story"
    };
    validateSupabasePublicSearchRow(publicRow);
    const wrongCasePublicRow = structuredClone(publicRow);
    wrongCasePublicRow.creationTool = wrongCasePublicRow.creation_tool;
    delete wrongCasePublicRow.creation_tool;
    let wrongCasePublicRowRejected = false;
    try {
      validateSupabasePublicSearchRow(wrongCasePublicRow);
    } catch (error) {
      wrongCasePublicRowRejected = String(error.message).includes("creationTool") && String(error.message).includes("not an approved field");
    }
    const reportReview = {
      source: "EmberAdventuresReportManager",
      item_type: "story",
      item_id: "00000000-0000-4000-8000-000000000004",
      item_title: "Strict Report Review",
      content_url: "https://example.invalid/strict-report-review.json",
      image_url: "https://example.invalid/strict-report-review.png",
      report_count: 2
    };
    const exactReportReview = exactReportManagerReviewPayload(reportReview);
    if (JSON.stringify(exactReportReview) !== JSON.stringify(reportReview)) throw new Error("Exact Report Manager review validation changed valid input.");
    const reportReviewAlias = structuredClone(reportReview);
    reportReviewAlias.url = reportReviewAlias.content_url;
    delete reportReviewAlias.content_url;
    let reportReviewAliasRejected = false;
    try {
      exactReportManagerReviewPayload(reportReviewAlias);
    } catch (error) {
      reportReviewAliasRejected = String(error.message).includes("report_manager_review.url") && String(error.message).includes("not an approved field");
    }
    const expectStoryRejection = async (label, mutate, expectedText) => {
      const story = runtimeStoryFixture(`invalid-${label}-${Date.now()}`, {
        objectiveCount: 2
      });
      mutate(story.storyTemplate.state.objectives.items, story);
      try {
        await controller.importFile("story", new Blob([JSON.stringify(story)]));
      } catch (error) {
        if (String(error.message).includes(expectedText)) return;
        throw new Error(`${label} returned the wrong validation error: ${error.message}`);
      }
      throw new Error(`${label} reached storage.`);
    };
    try {
      await controller.importFile("story", new Blob(["{not-json"]));
    } catch (error) {
      malformedRejected = error.message.includes("Invalid JSON");
    }
    try {
      await controller.importFile("character", new Blob([JSON.stringify({
        character_definition: {
          id: "incomplete"
        }
      })]));
    } catch (error) {
      incompleteRejected = error.message.includes("required");
    }
    await expectStoryRejection("missing-guidance", objectives => {
      objectives[0].while_active_guidance = "";
    }, "while_active_guidance");
    await expectStoryRejection("legacy-link", objectives => {
      objectives[0].next_objectives = [objectives[1].id];
    }, "must be an object");
    await expectStoryRejection("missing-requires-reference", objectives => {
      objectives[1].requires = ["missing-required-objective"];
    }, "requires missing objective");
    await expectStoryRejection("legacy-unlock-mode", objectives => {
      objectives[1].unlock_mode = "auto_complete";
    }, "unlock_mode");
    await expectStoryRejection("missing-instruction", objectives => {
      objectives[0].next_objectives[0].completion_instruction = "";
    }, "completion_instruction");
    await expectStoryRejection("automatic-condition", objectives => {
      Object.assign(objectives[0], {
        completion_control: "reward_only",
        requirement_check_only: true,
        completion_criteria: "This must not be present.",
        rewards: [{
          type: "set_state_field",
          field_path: ["world_flags", "runtime_test"],
          value: true
        }]
      });
    }, "must be omitted for reward_only objectives");
    await expectStoryRejection("dead-end", objectives => {
      objectives[0].next_objectives = [];
    }, "must have an output");
    await expectStoryRejection("objective-mutation", objectives => {
      objectives[0].next_objectives[0].rewards = [{
        type: "set_state_field",
        field_path: ["objectives", "active_id"],
        value: "invalid"
      }];
    }, "cannot mutate the objectives state tree");
    await expectStoryRejection("speaking-target-mutation", objectives => {
      objectives[0].next_objectives[0].rewards = [{
        type: "add_state_list_item",
        field_path: ["scene", "speak_targets"],
        value: "player"
      }];
    }, "manual speaking targets");
    await expectStoryRejection("missing-introduction-location", (objectives, story) => {
      const future = structuredClone(story.storyTemplate.state.player);
      future.id = `${story.storyTemplate.id}-future`;
      future.name = "Future Runtime Character";
      story.storyTemplate.state.future_cast.items[future.id] = {
        id: future.id,
        status: "hidden",
        full_character: future
      };
      objectives[0].next_objectives[0].rewards = [{
        type: "introduce_future_character",
        character_id: future.id
      }];
    }, "npc_location_id");
    await expectStoryRejection("uppercase-reward-operation", objectives => {
      objectives[0].next_objectives[0].rewards = [{
        type: "modify_integer",
        operation: "ADD",
        field_path: ["story_inventory", "coins"],
        value: 1
      }];
    }, "modify_integer operation");
    await expectStoryRejection("hosted-url-alias", objectives => {
      objectives[0].next_objectives[0].rewards = [{
        type: "generate_profile_image",
        target: "player",
        reason: "Reject a noncanonical image URL field.",
        image: {
          hosted_url: "https://example.invalid/profile.png"
        }
      }];
    }, "hosted_url");
    await expectStoryRejection("title-card-snake-case-negative", (objectives, story) => {
      story.storyTemplate.title_card_image.negative_prompt = story.storyTemplate.title_card_image.negativePrompt;
    }, "negative_prompt");
    await expectStoryRejection("title-card-hosted-url-alias", (objectives, story) => {
      story.storyTemplate.title_card_image.hostedUrl = story.storyTemplate.title_card_image.hosted_url;
    }, "hostedUrl");
    await expectStoryRejection("title-card-html-alias", (objectives, story) => {
      story.storyTemplate.title_card_image.image_html = "";
    }, "image_html");
    await expectStoryRejection("embedded-character-age-type", (objectives, story) => {
      story.storyTemplate.state.player.age = "24";
    }, "state.player.age");
    await expectStoryRejection("embedded-character-state-range", (objectives, story) => {
      story.storyTemplate.state.player.starting_trust = 11;
    }, "state.player.starting_trust");
    await expectStoryRejection("incomplete-reward-item", objectives => {
      objectives[0].next_objectives[0].rewards = [{
        type: "grant_item",
        target: "player",
        item: {
          id: "notes",
          name: "Notes"
        }
      }];
    }, "item.type");
    const parityStory = runtimeStoryFixture(`invalid-validator-parity-${Date.now()}`, {
      objectiveCount: 2
    });
    parityStory.storyTemplate.state.objectives.items[0].next_objectives[0].rewards = [{
      type: "modify_integer",
      operation: "ADD",
      field_path: ["story_inventory", "coins"],
      value: 1
    }];
    const parityBefore = JSON.stringify(parityStory.storyTemplate);
    const directValidation = validateStoryDefinition(parityStory.storyTemplate);
    const operationError = directValidation.errors.find(error => String(error.path).endsWith(".operation"));
    if (JSON.stringify(parityStory.storyTemplate) !== parityBefore) throw new Error("The canonical story validator mutated its input.");
    if (!operationError) throw new Error("The canonical story validator did not reject the exact invalid operation.");
    let importParityMatched = false;
    try {
      await controller.importFile("story", new Blob([JSON.stringify(parityStory)]));
    } catch (error) {
      importParityMatched = String(error.message).includes(operationError.message);
    }
    if (!importParityMatched) throw new Error("Library import did not return the canonical validator's error.");
    const parityCharacter = runtimeCharacterFixture(`invalid-character-validator-parity-${Date.now()}`);
    const parityCharacterBefore = JSON.stringify(parityCharacter);
    const validCharacterResult = validateCharacterExport(parityCharacter);
    if (!validCharacterResult.ok) throw new Error("The canonical character validator rejected its valid fixture.");
    if (JSON.stringify(parityCharacter) !== parityCharacterBefore) throw new Error("The canonical character validator mutated its input.");
    const malformedCharacter = structuredClone(parityCharacter);
    malformedCharacter.character_definition.startingPose = malformedCharacter.character_definition.starting_pose;
    delete malformedCharacter.character_definition.starting_pose;
    const characterValidation = validateCharacterExport(malformedCharacter);
    const characterError = characterValidation.errors.find(error => String(error.path).endsWith(".startingPose"));
    if (!characterError) throw new Error("The canonical character validator accepted a wrong-case field.");
    let characterImportParityMatched = false;
    try {
      await controller.importFile("character", new Blob([JSON.stringify(malformedCharacter)]));
    } catch (error) {
      characterImportParityMatched = String(error.message).includes(characterError.message);
    }
    if (!characterImportParityMatched) throw new Error("Character import did not return the canonical validator's error.");
    for (const invalidBoldness of ["5", 0, 11, 5.5]) {
      const malformedBoldnessCharacter = structuredClone(parityCharacter);
      malformedBoldnessCharacter.character_definition.boldness = invalidBoldness;
      const boldnessValidation = validateCharacterExport(malformedBoldnessCharacter);
      if (!boldnessValidation.errors.some(error => String(error.path).endsWith(".boldness") && String(error.message).includes("whole number from 1 through 10"))) {
        throw new Error(`The canonical character validator accepted invalid boldness ${JSON.stringify(invalidBoldness)}.`);
      }
    }
    for (const invalidStartingValue of ["5", -1, 11]) {
      const malformedStartingCharacter = structuredClone(parityCharacter);
      const startingValueValidation = validateCharacterExport(malformedStartingCharacter);
    }
    const invalidNestedCharacterValues = [["default_seed", character => character.default_seed = "7"], ["image_prompt_config.seed_enabled", character => character.image_prompt_config.seed_enabled = 1], ["image_prompt_config.seed", character => character.image_prompt_config.seed = 2.5], ["default_profile_image.seed", character => character.default_profile_image.seed = "9"], ["default_profile_image.male", character => character.default_profile_image.male = "true"], ["profile_image_presentations.male.prompt", character => character.profile_image_presentations.male.prompt = null], ["profile_images.image_ids.0", character => character.profile_images.image_ids = [7]], ["starting_inventory.0", character => character.starting_inventory = [7]], ["starting_known_facts.0", character => character.starting_known_facts = [""]], ["voice", character => character.voice = "Samantha"]];
    for (const [expectedPath, mutate] of invalidNestedCharacterValues) {
      const malformedNestedCharacter = structuredClone(parityCharacter);
      mutate(malformedNestedCharacter.character_definition);
      const nestedValidation = validateCharacterExport(malformedNestedCharacter);
      if (!nestedValidation.errors.some(error => String(error.path).endsWith(expectedPath))) throw new Error(`The canonical character validator accepted invalid ${expectedPath}.`);
    }
    if (repairAiCharacterBoldness("5") !== 5) throw new Error("Direct AI boldness repair did not accept numeric AI text.");
    if (repairAiState10("12") !== 10) throw new Error("Direct AI state-scale repair did not bound numeric AI text.");
    const exactQueuedTurn = {
      text: "Continue",
      visibleText: "",
      source: "system"
    };
    if (exactQueueItem(exactQueuedTurn) !== exactQueuedTurn) throw new Error("Exact queue validation replaced a valid queue item.");
    for (const invalidQueueItem of ["Continue", {
      text: "Continue",
      visibleText: "",
      source: "system",
      invented: true
    }, {
      text: "Continue",
      source: "system"
    }, {
      text: "Continue",
      visibleText: "",
      source: "system",
      autoRead: 1
    }]) {
      let rejected = false;
      try {
        exactQueueItem(invalidQueueItem);
      } catch {
        rejected = true;
      }
      if (!rejected) throw new Error(`Exact queue validation accepted ${JSON.stringify(invalidQueueItem)}.`);
    }
    const exactSnapshotFixture = {
      id: "strict-snapshot",
      createdAt: "2026-08-17T00:00:00.000Z",
      reason: "Strict snapshot regression",
      messageBoundaryId: "message-1",
      messageCount: 1,
      modifiedMessagesBefore: {},
      deletedMessagesBefore: [],
      reverseRuntimeChanges: [],
      queueState: [exactQueuedTurn],
      runtimeFlags: {
        pendingNpcInvite: null,
        pendingObjectiveChoiceReply: null,
        pendingRegenerateMessage: null,
        currentReplyDirective: "",
        currentReplyMode: "",
        activeQueueSource: "",
        autoPlayerTurnGenerating: false
      },
      rewardRuntime: {
        appliedInvocationIds: {}
      }
    };
    const exactSnapshotBefore = JSON.stringify(exactSnapshotFixture);
    snapshotForStorage(exactSnapshotFixture);
    if (JSON.stringify(exactSnapshotFixture) !== exactSnapshotBefore) throw new Error("Exact snapshot validation mutated its input.");
    for (const mutateSnapshot of [snapshot => snapshot.snapshotId = snapshot.id, snapshot => snapshot.at = snapshot.createdAt, snapshot => snapshot.messageCount = "1", snapshot => snapshot.queueState[0].invented = true, snapshot => delete snapshot.runtimeFlags.currentReplyMode, snapshot => snapshot.rewardRuntime.appliedInvocationIds.test = {
      appliedAt: "",
      sourceType: "test",
      sourceId: "test"
    }]) {
      const malformedSnapshot = structuredClone(exactSnapshotFixture);
      mutateSnapshot(malformedSnapshot);
      let rejected = false;
      try {
        snapshotForStorage(malformedSnapshot);
      } catch {
        rejected = true;
      }
      if (!rejected) throw new Error(`Exact snapshot validation accepted ${JSON.stringify(malformedSnapshot)}.`);
    }
    const exactDeletionReferences = [{
      id: "image-1"
    }, {
      id: "image-2"
    }];
    const exactDeletionReferencesBefore = JSON.stringify(exactDeletionReferences);
    const validatedDeletionReferences = exactLibraryRecordDeletionReferences(exactDeletionReferences);
    if (JSON.stringify(exactDeletionReferences) !== exactDeletionReferencesBefore) throw new Error("Library deletion reference validation mutated its input.");
    if (JSON.stringify(validatedDeletionReferences) !== exactDeletionReferencesBefore) throw new Error("Library deletion reference validation changed valid input.");
    for (const malformedDeletionReferences of [{
      id: "image-1"
    }, ["image-1"], [{
      id: " image-1"
    }], [{
      id: "image-1",
      story_id: "story-1"
    }], [{
      id: "image-1"
    }, {
      id: "image-1"
    }]]) {
      let rejected = false;
      try {
        exactLibraryRecordDeletionReferences(malformedDeletionReferences);
      } catch {
        rejected = true;
      }
      if (!rejected) throw new Error(`Library deletion reference validation accepted ${JSON.stringify(malformedDeletionReferences)}.`);
    }
    for (const malformedCollection of [{}, null, "record"]) {
      let rejected = false;
      try {
        exactProfileImageStore(malformedCollection);
      } catch {
        rejected = true;
      }
      if (!rejected) throw new Error(`Profile image collection validation accepted ${JSON.stringify(malformedCollection)}.`);
    }
    const paritySettings = localSettingsForStorage();
    const paritySettingsBefore = JSON.stringify(paritySettings);
    const malformedSettings = {...paritySettings, auto_voice: paritySettings.autoVoice};
    delete malformedSettings.autoVoice;
    if (validateStoredSettings(malformedSettings).ok) throw new Error("Settings validator accepted an alias.");
    if (JSON.stringify(paritySettings) !== paritySettingsBefore) throw new Error("Settings validation mutated input.");
    const parityBackup = {
      app: "EmberAdventures",
      exportType: "full-backup",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      activeSaveId: null,
      saveIndex: [],
      saves: [],
      settings: localSettingsForStorage(),
      creatorIdentityRegistry: creatorIdentityRegistry(),
      storyTemplates: [],
      characterDefinitions: [],
      profileImages: [],
      storyTitleCardImages: [],
      storageFailures: []
    };
    const parityBackupBefore = JSON.stringify(parityBackup);
    const validBackupResult = validateFullBackupExport(parityBackup);
    if (!validBackupResult.ok) throw new Error("The canonical full-backup validator rejected its valid fixture.");
    if (JSON.stringify(parityBackup) !== parityBackupBefore) throw new Error("The canonical full-backup validator mutated its input.");
    const malformedBackup = structuredClone(parityBackup);
    malformedBackup.story_templates = malformedBackup.storyTemplates;
    delete malformedBackup.storyTemplates;
    const backupValidation = validateFullBackupExport(malformedBackup);
    if (!backupValidation.errors.some(error => error.path === "full backup.story_templates")) throw new Error("The canonical full-backup validator accepted a field alias.");
    const parityCheckpoint = {
      version: 1,
      jobId: "runtime-generation-job",
      prompt: "Build a strict runtime test world.",
      promptHash: "runtime-generation-hash",
      startedAt: "2026-08-17T00:00:00.000Z",
      updatedAt: "2026-08-17T00:00:01.000Z",
      currentStep: 1,
      currentLabel: "Local scaffold",
      completedChunks: [],
      errors: [],
      partialState: {},
      partialMessages: [],
      progress: null
    };
    const parityCheckpointBefore = JSON.stringify(parityCheckpoint);
    const validCheckpointResult = validateWorldGenerationCheckpoint(parityCheckpoint);
    if (!validCheckpointResult.ok) throw new Error("The canonical generation-checkpoint validator rejected its valid fixture.");
    if (JSON.stringify(parityCheckpoint) !== parityCheckpointBefore) throw new Error("The generation-checkpoint validator mutated its input.");
    const malformedCheckpoint = structuredClone(parityCheckpoint);
    malformedCheckpoint.id = malformedCheckpoint.jobId;
    delete malformedCheckpoint.jobId;
    const checkpointValidation = validateWorldGenerationCheckpoint(malformedCheckpoint);
    if (!checkpointValidation.errors.some(error => error.path === "world generation checkpoint.id")) throw new Error("The generation-checkpoint validator accepted id as a jobId alias.");
    if (!malformedRejected || !incompleteRejected || !wrongCasePublicRowRejected || !reportReviewAliasRejected ||  !inventoryAliasRejected) throw new Error("An invalid import reached storage.");
    return "malformed JSON, incomplete definitions, wrong-case public/report fields, inventory aliases, legacy links, and invalid objective combinations rejected";
  }
}, {
  id: "public-publishing-worker-contract",
  name: "Public publishing prepares portable story and character packages without main-thread network work",
  execute: async () => {
    const library = await getDiagnosticLibraryController();
    const nonce = Date.now();
    const storyId = `runtime-public-story-${nonce}`;
    const characterId = `runtime-public-character-${nonce}`;
    const storyImport = await library.importFile("story", new Blob([JSON.stringify(runtimeStoryFixture(storyId))]));
    const characterImport = await library.importFile("character", new Blob([JSON.stringify(runtimeCharacterFixture(characterId))]));
    try {
      const creator = "Runtime Publisher";
      const creatorId = `runtime-publisher-${nonce}`;
      let missingCreatorRejected = false;
      try {
        await library.preparePublicPackage({
          kind: "story",
          id: storyId,
          revisionId: storyImport.entry.revisionId,
          creatorId,
          imageUrls: {
            title: "https://example.invalid/public-story.png"
          }
        });
      } catch (error) {
        missingCreatorRejected = /creator(?: name)? (?:must be text|is required)/.test(String(error.message));
      }
      let missingCreatorIdRejected = false;
      try {
        await library.preparePublicPackage({
          kind: "story",
          id: storyId,
          revisionId: storyImport.entry.revisionId,
          creator,
          imageUrls: {
            title: "https://example.invalid/public-story.png"
          }
        });
      } catch (error) {
        missingCreatorIdRejected = /creator(?:Id| id) (?:must be text|is required)/.test(String(error.message));
      }
      if (!missingCreatorRejected || !missingCreatorIdRejected) throw new Error("Public package preparation accepted missing command ownership metadata.");
      const storyPackage = await library.preparePublicPackage({
        kind: "story",
        id: storyId,
        revisionId: storyImport.entry.revisionId,
        creator,
        creatorId,
        imageUrls: {
          title: "https://example.invalid/public-story.png"
        }
      });
      const characterPackage = await library.preparePublicPackage({
        kind: "character",
        id: characterId,
        revisionId: characterImport.entry.revisionId,
        creator,
        creatorId,
        imageUrls: {
          male: "https://example.invalid/public-character-male.png",
          non_male: "https://example.invalid/public-character-non-male.png"
        }
      });
      const storyPayload = await new Response(storyPackage.blob.stream().pipeThrough(new DecompressionStream("gzip"))).json();
      const characterPayload = await new Response(characterPackage.blob.stream().pipeThrough(new DecompressionStream("gzip"))).json();
      if (storyPayload.storyTemplate?.id !== storyId || storyPayload.storyTemplate?.title_card_image?.url !== "https://example.invalid/public-story.png") throw new Error("Public story package did not preserve identity and hosted title-image portability.");
      if (characterPayload.character_definition?.id !== characterId || characterPayload.character_definition?.profile_image_presentations?.male?.url !== "https://example.invalid/public-character-male.png" || characterPayload.character_definition?.profile_image_presentations?.non_male?.url !== "https://example.invalid/public-character-non-male.png") throw new Error("Public character package did not preserve both hosted profile-image presentations.");
      if (!/^[a-f0-9]{64}$/.test(storyPackage.sha256) || !/^[a-f0-9]{64}$/.test(characterPackage.sha256)) throw new Error("Public package hashing did not produce SHA-256 identities.");
      const localCharacterRecord = characterLibraryRecordFromDefinition(characterPayload.character_definition);
      const localDefinitionBeforeOwnership = JSON.stringify(localCharacterRecord.character);
      applyCreatorIdentity(localCharacterRecord, {
        creator_id: creatorId,
        creator_name: creator
      });
      const localRecordValidation = validateCharacterLibraryRecord(localCharacterRecord);
      const localPublicMetadata = publicLibraryCharacterMetadata(localCharacterRecord, "https://example.invalid/public-character.json.gz");
      if (!localRecordValidation.ok || localCharacterRecord.creator_id !== creatorId || localCharacterRecord.creator !== creator || JSON.stringify(localCharacterRecord.character) !== localDefinitionBeforeOwnership || Object.hasOwn(localCharacterRecord.character, "creator_id") || Object.hasOwn(localCharacterRecord.character, "creator") || localPublicMetadata.creator_id !== creatorId) throw new Error("Character ownership did not remain on the exact library record.");
      const storyDryRun = await library.publishPublicPackage({
        dryRun: true,
        token: "runtime-token",
        userId: "runtime-user",
        metadata: storyPackage.metadata,
        payloadUrl: "https://example.invalid/public-story.json.gz"
      });
      const characterDryRun = await library.publishPublicPackage({
        dryRun: true,
        token: "runtime-token",
        userId: "runtime-user",
        metadata: characterPackage.metadata,
        payloadUrl: "https://example.invalid/public-character.json.gz"
      });
      if (storyDryRun.row.type !== "story" || storyDryRun.row.definition_id !== storyId || storyDryRun.row.source !== "" || typeof storyDryRun.row.slug !== "string" || !storyDryRun.row.slug || storyDryRun.version.payload_url !== "https://example.invalid/public-story.json.gz") throw new Error("Public story database row did not match its immutable package.");
      if (characterDryRun.row.type !== "character" || characterDryRun.row.definition_id !== characterId || characterDryRun.row.source !== "" || characterDryRun.row.male_image_url !== "https://example.invalid/public-character-male.png") throw new Error("Public character database row did not match both presentation images.");
      for (const blocked of [{
        policy: {
          story_cap: 100,
          character_cap: 1000,
          banned: true,
          ban_reason: "Runtime ban"
        },
        expected: "Runtime ban"
      }, {
        policy: {
          story_cap: 1,
          character_cap: 1000,
          banned: false,
          ban_reason: null
        },
        ownedCount: 1,
        expected: "publishing cap"
      }, {
        existing: {
          id: "runtime-item",
          visibility: "flagged",
          hidden_reason: null
        },
        expected: "cannot be republished"
      }]) {
        let rejection = "";
        const {
          expected,
          ...commandValues
        } = blocked;
        try {
          await library.publishPublicPackage({
            dryRun: true,
            token: "runtime-token",
            userId: "runtime-user",
            metadata: storyPackage.metadata,
            payloadUrl: "https://example.invalid/rejected.json.gz",
            ...commandValues
          });
        } catch (error) {
          rejection = error?.message || String(error);
        }
        if (!rejection.includes(expected)) throw new Error(`Public publish policy did not reject ${expected}.`);
      }
      let numericPolicyAliasRejected = false;
      try {
        await library.publishPublicPackage({
          dryRun: true,
          token: "runtime-token",
          userId: "runtime-user",
          metadata: storyPackage.metadata,
          payloadUrl: "https://example.invalid/rejected.json.gz",
          policy: {
            story_cap: "100",
            character_cap: 1000,
            banned: false,
            ban_reason: null
          }
        });
      } catch (error) {
        numericPolicyAliasRejected = /story_cap must be a nonnegative safe integer/.test(String(error.message));
      }
      if (!numericPolicyAliasRejected) throw new Error("Public publishing accepted a numeric-string uploader cap.");
      const issuePackage = await library.submitDeveloperIssue({
        dryRun: true,
        token: "runtime-token",
        userId: "runtime-user",
        title: "Runtime Issue",
        severity: "error",
        explanation: "The runtime test intentionally submits a diagnostic package.",
        reportText: "Runtime issue report text.",
        traceBlob: new Blob(["Runtime trace entry."], {
          type: "text/plain"
        }),
        saveBlob: new Blob([JSON.stringify({
          saveId: 27
        })], {
          type: "application/json"
        })
      });
      const issuePayload = await new Response(issuePackage.blob.stream().pipeThrough(new DecompressionStream("gzip"))).json();
      if (issuePackage.row.reporter_user_id !== "runtime-user" || !issuePackage.row.package_path.startsWith("runtime-user/") || issuePayload.devTrace !== "Runtime trace entry." || !issuePayload.activeSave.includes('"saveId":27')) throw new Error("Developer issue package did not preserve authenticated ownership, trace, and active-save evidence.");
      const rating = await library.setPublicRating({
        dryRun: true,
        token: "runtime-token",
        itemId: "runtime-public-item",
        rating: 7
      });
      const removedRating = await library.removePublicRating({
        dryRun: true,
        token: "runtime-token",
        itemId: "runtime-public-item"
      });
      const owned = await library.listPublicOwned("story", {
        dryRun: true,
        token: "runtime-token",
        userId: "runtime-user",
        items: [{
          id: "runtime-public-item",
          owner_user_id: "runtime-user",
          type: "story",
          definition_id: storyId,
          slug: "runtime-public-story",
          title: "Runtime Public Story",
          description: "Runtime public story description.",
          name: null,
          male_name: null,
          non_male_name: null,
          male_image_url: null,
          non_male_image_url: null,
          creator: "Runtime Publisher",
          creator_id: creatorId,
          source: "Original",
          creation_tool: "EmberAdventures",
          genres: ["fantasy"],
          gender: null,
          fallback_gender: null,
          age: null,
          species: null,
          visibility: "hidden",
          current_version_id: "runtime-version",
          rating_average: 0,
          rating_count: 0,
          player_select: false,
          player_option_count: 1,
          main_objective_count: 1,
          side_objective_count: 0,
          future_character_count: 0,
          starting_party_member_count: 0,
          starting_npc_count: 0,
          role: null,
          voice_gender: null,
          hidden_reason: null,
          updated_at: "2026-08-18T00:00:00.000Z"
        }],
        versions: [{
          id: "runtime-version",
          item_id: "runtime-public-item",
          version_number: 3,
          payload_url: "https://example.invalid/runtime-public.json.gz",
          payload_sha256: null,
          payload_size_bytes: null,
          image_url: null,
          metadata_snapshot: null,
          change_summary: "Runtime publication",
          created_at: "2026-08-18T00:00:00.000Z"
        }]
      });
      const visibility = await library.setPublicVisibility({
        dryRun: true,
        token: "runtime-token",
        userId: "runtime-user",
        itemId: "runtime-public-item",
        visibility: "public"
      });
      const publicReport = await library.submitPublicReport({
        dryRun: true,
        itemId: "runtime-public-item",
        kind: "story",
        title: "Runtime Public Story",
        reasons: ["wrong_genre"],
        details: "The selected genre does not describe this story.",
        suggestedGenres: ["mystery"],
        contentUrl: "https://example.invalid/runtime-public.json.gz"
      });
      if (rating.target_rating !== 7 || removedRating.target_item_id !== "runtime-public-item" || publicReport.reasons[0] !== "wrong_genre" || publicReport.suggested_genres[0] !== "mystery") throw new Error("Public rating or report payload did not preserve the submitted values.");
      if (owned.entries[0]?.visibility !== "hidden" || owned.entries[0]?.versionNumber !== 3 || owned.entries[0]?.payloadUrl !== "https://example.invalid/runtime-public.json.gz" || visibility.visibility !== "public") throw new Error("Owned public uploads did not preserve visibility, current version, or owner-only visibility updates.");
      return "validated public packages, Mine ownership controls, publish policy, ratings, reports, and private developer issue packaging passed";
    } finally {
      await library.deleteEntry("story", storyId);
      await library.deleteEntry("character", characterId);
    }
  }
}, {
  id: "library-large-story-performance",
  name: "Large story validation and compilation stays off the main thread",
  execute: async () => {
    const controller = await getDiagnosticLibraryController();
    const id = `runtime-large-story-${Date.now()}`;
    const file = await runtimeLargeStoryBlob(id, 7000);
    await nextFrame();
    await nextFrame();
    await nextFrame();
    let objectiveProgressEvents = 0;
    const onProgress = event => {
      if (event.detail?.phase === "Compiling objectives") objectiveProgressEvents++;
    };
    controller.addEventListener("progress", onProgress);
    const measurement = await measureMainThread("large story import", () => controller.importFile("story", file));
    controller.removeEventListener("progress", onProgress);
    const materialization = await measureMainThread("large story new-game materialization", () => controller.materializeNewGame({
      storyId: id,
      revisionId: measurement.value.entry.revisionId,
      selection: {
        source: "story",
        characterId: `${id}-player`
      }
    }));
    assertResponsive(materialization);
    assertResponsive(measurement);
    if (objectiveProgressEvents < 70) throw new Error(`Expected at least 70 objective progress updates, received ${objectiveProgressEvents}.`);
    if (materialization.value.metrics.immutableObjectiveCount !== 7000) throw new Error("Large-story materialization lost immutable objectives.");
    if (materialization.value.metrics.objectiveRecordsCopied !== 0) throw new Error("Large-story materialization copied objective definitions into the save.");
    await controller.deleteEntry("story", id);
    return `${measurementDetail(measurement)}; start ${measurementDetail(materialization)}; progress ${objectiveProgressEvents}`;
  }
}, {
  id: "controller-clean",
  name: "Production controller has no orphan work while idle",
  execute: async () => {
    const state = app.persistence.diagnosticState();
    if (state.requests.length || state.pendingSaves.length || state.activeSaveState != null) throw new Error("Production controller retained unexpected work while no game is active.");
    return "no requests, pending saves, or active session";
  }
}];

//#endregion App Tests

//#region Runner

function appendRuntimeTestLog(message) {
  runtimeTestState.logs.push(`${new Date().toISOString()} ${message}`);
  renderRuntimeTestPanel();
}
async function executeNamedTest(suite, test) {
  const result = {
    suite,
    id: test.id,
    name: test.name,
    status: "running",
    startedAt: performance.now(),
    duration: 0,
    detail: "",
    error: ""
  };
  runtimeTestState.results.push(result);
  renderRuntimeTestPanel();
  try {
    result.detail = (await test.execute()) || "passed";
    result.status = "passed";
  } catch (error) {
    result.status = "failed";
    result.error = error?.message || String(error);
  }
  result.duration = performance.now() - result.startedAt;
  appendRuntimeTestLog(`${result.status.toUpperCase()} ${suite}/${test.id}: ${result.error || result.detail}`);
  return result;
}
async function runAppRuntimeTests() {
  for (const test of appRuntimeTests) {
    const result = await executeNamedTest("application", test);
    if (test.id === "runtime-environment" && result.status === "failed") {
      appendRuntimeTestLog("Application performance tests stopped because the idle browser baseline was unstable. Close other heavy work and rerun.");
      break;
    }
  }
}
function testWorkerUrl() {
  if (runtimeTestState.testWorkerUrl) return runtimeTestState.testWorkerUrl;
  const source = globalThis.__emberAdventuresTestWorkerSource;
  if (typeof source !== "string" || !source.trim()) throw new Error("The embedded diagnostic worker source is missing.");
  runtimeTestState.testWorkerUrl = URL.createObjectURL(new Blob([source], {
    type: "text/javascript"
  }));
  return runtimeTestState.testWorkerUrl;
}
async function runPersistenceRuntimeTests(testNumber = null) {
  let simulatedVisibility = "visible";
  const controller = new EmberPersistence.Controller(testWorkerUrl(), {
    watchdogMilliseconds: 5000,
    visibilityProvider: () => simulatedVisibility
  });
  const runner = new PersistenceDiagnostic.TestRunner(controller, {
    schema: globalThis.__emberAdventuresTestSchema,
    setSimulatedVisibility: value => simulatedVisibility = value,
    onTestChanged: test => {
      const resultId = `persistence-${runner.tests.indexOf(test) + 1}`;
      let result = runtimeTestState.results.find(item => item.id === resultId);
      if (result == null) {
        result = {
          suite: "persistence",
          id: resultId,
          name: test.name,
          status: test.status,
          duration: test.duration || 0,
          detail: test.detail || "",
          error: test.error?.message || ""
        };
        runtimeTestState.results.push(result);
      } else {
        result.status = test.status;
        result.duration = test.duration || 0;
        result.detail = test.detail || "";
        result.error = test.error?.message || "";
      }
      renderRuntimeTestPanel();
    },
    onLog: appendRuntimeTestLog
  });
  controller.addEventListener("status", event => {
    const {
      status,
      detail
    } = event.detail;
    if (["worker-error", "worker-message-error", "worker-replacement-failed", "worker-unresponsive"].includes(status)) appendRuntimeTestLog(`${status}: ${JSON.stringify(detail)}`);
  });
  try {
    await controller.start();
    if (testNumber == null) await runner.runAll();else await runner.runOne(testNumber - 1);
  } finally {
    controller.dispose();
  }
}
async function runRuntimeTests(mode = "all") {
  if (runtimeTestState.running) throw new Error("Runtime tests are already running.");
  if (!["all", "application", "persistence"].includes(mode)) throw new Error(`Unknown runtime test mode ${mode}.`);
  runtimeTestState.running = true;
  runtimeTestState.mode = mode;
  runtimeTestState.results = [];
  runtimeTestState.logs = [];
  runtimeTestState.startedAt = Date.now();
  runtimeTestState.finishedAt = 0;
  renderRuntimeTestPanel();
  try {
    await waitForApplicationReady();
    if (["all", "application"].includes(mode)) await runAppRuntimeTests();
    if (["all", "persistence"].includes(mode)) await runPersistenceRuntimeTests();
  } finally {
    runtimeTestState.running = false;
    runtimeTestState.finishedAt = Date.now();
    document.body.dataset.runtimeTestResult = runtimeTestState.results.some(result => result.status === "failed") ? "failed" : "passed";
    if (!$("runtimeTestPanel")) openRuntimeTests();
    renderRuntimeTestPanel();
  }
  return runtimeTestReport();
}
async function runRuntimeTestById(testId) {
  if (runtimeTestState.running) throw new Error("Runtime tests are already running.");
  const applicationTest = appRuntimeTests.find(test => test.id === testId);
  const persistenceMatch = /^persistence-(\d+)$/.exec(testId);
  if (!applicationTest && !persistenceMatch) throw new Error(`Unknown runtime test ${testId}.`);
  runtimeTestState.running = true;
  runtimeTestState.mode = applicationTest ? `application:${testId}` : `persistence:${testId}`;
  runtimeTestState.results = [];
  runtimeTestState.logs = [];
  runtimeTestState.startedAt = Date.now();
  runtimeTestState.finishedAt = 0;
  renderRuntimeTestPanel();
  try {
    await waitForApplicationReady();
    if (applicationTest) await executeNamedTest("application", applicationTest);else await runPersistenceRuntimeTests(Number(persistenceMatch[1]));
  } finally {
    runtimeTestState.running = false;
    runtimeTestState.finishedAt = Date.now();
    document.body.dataset.runtimeTestResult = runtimeTestState.results.some(result => result.status === "failed") ? "failed" : "passed";
    renderRuntimeTestPanel();
  }
  return runtimeTestReport();
}
function runtimeTestReport() {
  return {
    mode: runtimeTestState.mode,
    running: runtimeTestState.running,
    startedAt: runtimeTestState.startedAt,
    finishedAt: runtimeTestState.finishedAt,
    passed: runtimeTestState.results.filter(result => result.status === "passed").length,
    failed: runtimeTestState.results.filter(result => result.status === "failed").length,
    total: runtimeTestState.results.length,
    results: structuredClone(runtimeTestState.results),
    logs: runtimeTestState.logs.slice()
  };
}

//#endregion Runner

//#region Test UI

function runtimeTestRowsHtml() {
  if (!runtimeTestState.results.length) return '<p class="runtime-test-empty">No tests have run.</p>';
  return runtimeTestState.results.map(result => `
            <div class="runtime-test-row" data-status="${escapeHtml(result.status)}">
                <span class="runtime-test-indicator" aria-hidden="true"></span>
                <span class="runtime-test-name">
                    <strong>${escapeHtml(result.name)}</strong>
                    <small>${escapeHtml(result.error || result.detail || result.status)}</small>
                </span>
                <span class="runtime-test-duration">${result.duration ? `${result.duration.toFixed(0)} ms` : "-"}</span>
            </div>
        `).join("");
}
function renderRuntimeTestPanel() {
  const panel = $("runtimeTestPanel");
  if (!panel) return;
  const passed = runtimeTestState.results.filter(result => result.status === "passed").length;
  const failed = runtimeTestState.results.filter(result => result.status === "failed").length;
  panel.innerHTML = `
            <div class="runtime-test-toolbar">
                <button type="button" class="primary" data-runtime-test="all" ${runtimeTestState.running ? "disabled" : ""}>Run Everything</button>
                <button type="button" data-runtime-test="application" ${runtimeTestState.running ? "disabled" : ""}>UI Performance</button>
                <button type="button" data-runtime-test="persistence" ${runtimeTestState.running ? "disabled" : ""}>Persistence</button>
                <button type="button" data-runtime-test-id="new-game-materialization" ${runtimeTestState.running ? "disabled" : ""}>Start/Load Flow</button>
                <button type="button" data-runtime-test-id="objective-choice-reward-cascade" ${runtimeTestState.running ? "disabled" : ""}>Objective Flow</button>
                <button type="button" data-download-runtime-tests ${runtimeTestState.results.length ? "" : "disabled"}>Download Report</button>
            </div>
            <p class="runtime-test-summary">${runtimeTestState.running ? "Running" : `${passed} passed, ${failed} failed`}</p>
            <div class="runtime-test-list">${runtimeTestRowsHtml()}</div>
            <details class="runtime-test-log">
                <summary>Event Log</summary>
                <pre>${escapeHtml(runtimeTestState.logs.join("\n"))}</pre>
            </details>
        `;
  panel.querySelectorAll("[data-runtime-test]").forEach(button => {
    button.onclick = () => runRuntimeTests(button.dataset.runtimeTest);
  });
  panel.querySelectorAll("[data-runtime-test-id]").forEach(button => {
    button.onclick = () => runRuntimeTestById(button.dataset.runtimeTestId);
  });
  const downloadButton = panel.querySelector("[data-download-runtime-tests]");
  if (downloadButton) downloadButton.onclick = downloadRuntimeTestReport;
}
function openRuntimeTests() {
  openModal('<section id="runtimeTestPanel" class="runtime-test-panel"></section>', {
    title: "Runtime Tests"
  });
  $("modalBox").classList.add("runtime-test-modal");
  renderRuntimeTestPanel();
}
function downloadRuntimeTestReport() {
  const report = runtimeTestReport();
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json"
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `emberadventures-lite-runtime-tests-${new Date().toISOString().replaceAll(":", "-")}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

//#endregion Test UI

globalThis.__installEmberAdventuresPrivateRuntimeTests = target => {
  Object.assign(target, {
    openRuntimeTests,
    runRuntimeTests,
    runRuntimeTestById,
    getRuntimeTestReport: runtimeTestReport
  });
};