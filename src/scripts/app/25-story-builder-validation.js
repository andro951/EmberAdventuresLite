function storyBuilderValidationChecks(draft, validation = validateStoryDefinition(draft)) {
    const objectives = storyBuilderObjectiveList(draft);
    return validation.errors.map(error => {
      const objectiveIndex = Number(String(error.path || "").match(/(?:state\.)?objectives\.items\.(\d+)/)?.[1]);
      return {
        ok: false,
        label: error.message,
        objectiveId: Number.isInteger(objectiveIndex) ? String(objectives[objectiveIndex]?.id || "") : "",
        field: String(error.path || "").split(".").at(-1) || "",
        path: error.path,
        code: error.code
      };
    });
  }
  function storyBuilderValidationWarningIds(draft = app.storyBuilder?.draft) {
    const warnings = new Set();
    for (const check of storyBuilderValidationChecks(draft)) {
      if (!check.ok && check.objectiveId) warnings.add(String(check.objectiveId));
    }
    return warnings;
  }
  function renderOnboardingStep() {
    const draft = app.onboardingDraft;
    const step = normalizeOnboardingStep(draft?.step ?? 6, 1);
    if (draft) draft.step = step;
    const steps = {
      1: false,
      2: false,
      4: [],
      5: renderOnboardingPreferences,
      6: renderOnboardingStory,
      7: renderOnboardingPlayer,
      8: renderOnboardingCast
    };
    const renderer = steps[String(step)] || renderOnboardingStory;
    openModal(`
                ${renderOnboardingProgress(step)}
                <div class="onboarding-layout">
                    <div>${renderer()}</div>
                </div>
            `, {
      setupBlackout: true,
      hideClose: true,
      scrollKey: `setup:${onboardingProgressKey(step)}`
    });
    bindOnboardingStep();
  }
  function onboardingFlowItems() {
    return [["story_library", "Story Library"], ["story", "Story Setup"], ["player", "Player Character"], ["cast", "Starting Cast"], ["guidance", "Story Guidance"]];
  }
  function onboardingProgressKey(step) {
    if (step === "story_library" || step === "guidance") return step;
    const number = Number(step);
    if (number === 6) return "story";
    if (number === 7) return "player";
    if (number === 8) return "cast";
    return "story";
  }
  function normalizeOnboardingStep(step, direction = 1) {
    return Math.max(6, Math.min(8, Number(step) || 6));
  }
  function onboardingProgressStep(step) {
    const items = onboardingFlowItems();
    const key = onboardingProgressKey(step);
    const index = Math.max(0, items.findIndex(([itemKey]) => itemKey === key));
    return {
      index: index < 0 ? 0 : index,
      total: items.length,
      label: items[index]?.[1] || "Setup"
    };
  }
  function renderOnboardingProgress(step) {
    const progress = onboardingProgressStep(step);
    const percent = Math.round((progress.index + 1) / progress.total * 100);
    return `
                <div class="onboarding-progress">
                    <div class="onboarding-progress-title">Step ${progress.index + 1} of ${progress.total}: ${escapeHtml(progress.label)}</div>
                    <div class="onboarding-progress-bar">
                        <div class="onboarding-progress-fill" style="width: ${percent}%"></div>
                    </div>
                </div>
            `;
  }
  function onboardingButtons({
    back = true,
    next = true,
    finish = false
  } = {}) {
    return `
                <div class="row" style="margin-top: .8rem">
                    ${back ? `<button id="onboardingBackBtn">Back</button>` : ""}
                    ${next ? `<button class="primary" id="onboardingNextBtn">Next</button>` : ""}
                    ${finish ? `<button class="primary" id="generateWorldBtn">Generate Story</button>` : ""}
                </div>
            `;
  }
  function entertainmentPreferenceOptions() {
    return ["anime", "fantasy", "sci-fi", "modern", "historical", "romance", "adventure", "action", "comedy", "drama", "mystery", "thriller", "horror", "dark", "cozy", "slice of life", "superpower", "isekai", "school", "workplace", "political", "war", "crime", "mythology", "supernatural", "post-apocalyptic", "western", "cyberpunk", "steampunk", "ensemble"];
  }
  function renderOnboardingPreferences() {
    return renderOnboardingStory();
  }
  function renderOnboardingStory() {
    const draft = app.onboardingDraft;
    const readiness = storySetupReadiness();
    const castLookupRaw = draft.cast_lookup_raw || "";
    const castLookupRawCard = draft.cast_lookup_checking || castLookupRaw || draft.cast_lookup_parse_failed ? `<div class="stat-card" style="margin-top:.75rem">
                    <div class="character-name">Finding Starting Cast</div>
                    <p class="hint" id="castLookupStreamStatus">Received ${(draft.cast_lookup_received_chars || castLookupRaw.length || 0).toLocaleString()} characters.</p>
                    <pre id="castLookupStreamText" class="json-view" style="white-space:pre-wrap; max-height:16rem; overflow:auto">${escapeHtml(castLookupRaw || "Waiting for AI response...")}</pre>
                </div>` : "";
    return `
                <h2>Story Setup</h2>
                <p class="hint">Describe the original story you want EmberAdventures to create. Source-based stories are allowed locally from story files, but generated source/canon adaptations cannot be published publicly.</p>
                <label style="margin-top: .75rem">Story Description
                    <textarea id="storyDescription" rows="6" placeholder="Describe an original story premise, starting situation, tone, and player role...">${escapeHtml(draft.story_description)}</textarea>
                </label>
                <label style="margin-top: .75rem">Modifications
                    <textarea id="storyModifications" rows="5" placeholder="Optional changes, twists, tone shifts, player role, or crossover details...">${escapeHtml(draft.story_modifications)}</textarea>
                </label>
                <div class="row" style="margin-top: .55rem">
                    <div id="storyValidationIndicator" class="stat-card" style="flex: 1 1 18rem; margin: 0; border-color: ${readiness.ready ? "var(--green)" : "var(--red)"}; background: ${readiness.ready ? "#10251a" : "#2a1116"}">
                        <div class="character-name">
                            <span>${readiness.ready ? "&#10003;" : "&#10005;"} Story ${readiness.ready ? "ready" : "not ready"}</span>
                        </div>
                        <p class="hint" style="margin-bottom: 0">${escapeHtml(readiness.message)}</p>
                    </div>
                </div>
                ${castLookupRawCard}
                ${onboardingButtons()}
            `;
  }
  function updateStoryLookupStreamingCard(text = "") {
    const draft = app.onboardingDraft;
    if (draft) {
      draft.story_lookup_raw = String(text || "");
      draft.story_lookup_received_chars = draft.story_lookup_raw.length;
    }
    const status = $("storyLookupStreamStatus");
    if (status) status.textContent = `Received ${String(text || "").length.toLocaleString()} characters.`;
    const target = $("storyLookupStreamText");
    if (!target) return;
    target.textContent = String(text || "") || "Waiting for AI response...";
    target.scrollTop = target.scrollHeight;
  }
  function updateCastLookupStreamingCard(text = "") {
    const draft = app.onboardingDraft;
    if (draft) {
      draft.cast_lookup_raw = String(text || "");
      draft.cast_lookup_received_chars = draft.cast_lookup_raw.length;
    }
    const status = $("castLookupStreamStatus");
    if (status) status.textContent = `Received ${String(text || "").length.toLocaleString()} characters.`;
    const target = $("castLookupStreamText");
    if (!target) return;
    target.textContent = String(text || "") || "Waiting for AI response...";
    target.scrollTop = target.scrollHeight;
  }
  function storySetupReadiness() {
    const draft = app.onboardingDraft || {};
    const description = ($("storyDescription")?.value ?? draft.story_description ?? "").trim();
    if (description) {
      return {
        ready: true,
        message: "Using Story Description for an original story. Next is available."
      };
    }
    return {
      ready: false,
      message: "Write a Story Description."
    };
  }
  function updateStoryValidationIndicator() {
    const el = $("storyValidationIndicator");
    if (!el) return;
    const readiness = storySetupReadiness();
    el.style.borderColor = readiness.ready ? "var(--green)" : "var(--red)";
    el.style.background = readiness.ready ? "#10251a" : "#2a1116";
    el.innerHTML = `
                <div class="character-name">
                    <span>${readiness.ready ? "&#10003;" : "&#10005;"} Story ${readiness.ready ? "ready" : "not ready"}</span>
                </div>
                <p class="hint" style="margin-bottom: 0">${escapeHtml(readiness.message)}</p>
            `;
  }
  function clearStoryLookupDetails(draft) {
    if (!draft) return;
    draft.story_confirmed = false;
    draft.story_lookup_title = "";
    draft.story_lookup_summary = "";
    draft.story_lookup_modifications = "";
    draft.story_lookup_checking = false;
    draft.story_lookup_raw = "";
    draft.story_lookup_parse_failed = false;
    draft.cast_lookup_checking = false;
    draft.cast_lookup_raw = "";
    draft.cast_lookup_parse_failed = false;
    draft.cast_prefilled_from = "";
  }
  function renderOnboardingPlayer() {
    const p = app.onboardingDraft.player;
    return `
                <h2>Player Character</h2>
                <div class="grid2">
                    <label>Name <input id="onboardingPlayerName" value="${escapeHtml(p.name)}"></label>
                    <label>Age <input id="onboardingPlayerAge" type="number" min="18" value="${escapeHtml(p.age)}"></label>
                    <label>Gender <input id="onboardingPlayerGender" value="${escapeHtml(p.gender)}"></label>
                    <label>Role <input id="onboardingPlayerRole" value="${escapeHtml(p.role)}"></label>
                </div>
                <p class="hint">The player can be present in scenes and selected as an image subject, with the same visual structure used by other characters.</p>
                ${onboardingButtons()}
            `;
  }
  function renderOnboardingCast() {
    return `
                <h2>Starting Cast</h2>
                <p class="hint">Describe the kinds of adult companions, rivals, allies, or romance candidates you want. You can edit them after generation.</p>
                <label for="startingCastPolicy">Opening party</label>
                <select id="startingCastPolicy">
                    <option value="generated" ${app.onboardingDraft.starting_cast_policy !== "solo" ? "selected" : ""}>Generate a starting cast</option>
                    <option value="solo" ${app.onboardingDraft.starting_cast_policy === "solo" ? "selected" : ""}>Start alone</option>
                </select>
                <textarea id="castNotes" rows="8" placeholder="A demon noble, a saintess, a knight captain, a dragon princess...">${escapeHtml(app.onboardingDraft.cast_notes || "")}</textarea>
                ${onboardingButtons()}
            `;
  }
  function radioRow(name, value, label, selected) {
    return `
                <label class="check-row">
                    <input type="radio" name="${name}" value="${value}" ${selected === value ? "checked" : ""}>
                    <span>${escapeHtml(label)}</span>
                </label>
            `;
  }
  function bindOnboardingStep() {
    const draft = app.onboardingDraft;
    if (!draft) return;
    ["storyDescription", "storyModifications"].forEach(id => {
      if ($(id)) $(id).oninput = updateStoryValidationIndicator;
    });
    if ($("onboardingBackBtn")) $("onboardingBackBtn").onclick = () => {
      collectOnboardingStep({
        validate: false
      });
      if (draft.step === 6) {
        app.onboardingDraft = null;
        openStoryTemplateLibrary({skipBack: true});
        return;
      }
      draft.step = normalizeOnboardingStep(draft.step - 1, -1);
      renderOnboardingStep();
    };
    if ($("onboardingNextBtn")) $("onboardingNextBtn").onclick = async () => {
      if (!collectOnboardingStep()) return;
      if (draft.step === 8) {
        const setupPrompt = onboardingSetupPrompt();
        openWorldGenerationModal(setupPrompt);
        return;
      }
      draft.step = normalizeOnboardingStep(draft.step + 1, 1);
      renderOnboardingStep();
    };
    if ($("generateWorldBtn")) $("generateWorldBtn").onclick = () => {
      if (!collectOnboardingStep()) return;
      const setupPrompt = onboardingSetupPrompt();
      openWorldGenerationModal(setupPrompt);
    };
  }
  function collectOnboardingStep({
    validate = true
  } = {}) {
    const draft = app.onboardingDraft;
    if (!draft) return true;
    if ($("storyDescription")) {
      const previousModifications = draft.story_modifications || "";
      draft.story_title = "";
      draft.story_description = $("storyDescription")?.value.trim() || "";
      draft.story_modifications = $("storyModifications")?.value.trim() || "";
      draft.story_mode = "original";
      if (draft.story_modifications !== previousModifications) {
        clearStoryLookupDetails(draft);
        draft.player_prefilled_from = "";
        draft.cast_prefilled_from = "";
      }
      if (validate && !draft.story_description) {
        showNotice("Story Required", "Describe an original Story Description.");
        return false;
      }
    }
    if ($("onboardingPlayerName")) {
      const playerName = $("onboardingPlayerName").value.trim();
      const playerAge = Number($("onboardingPlayerAge").value);
      if (validate && !playerName) {
        showNotice("Player Name Required", "Enter the player's name before continuing.");
        return false;
      }
      if (validate && (!Number.isFinite(playerAge) || playerAge < 18)) {
        showNotice("Player Age Required", "Enter a specific adult age for the player before continuing.");
        return false;
      }
      draft.player = {
        name: playerName,
        age: Number.isFinite(playerAge) ? Math.max(18, playerAge) : "",
        gender: $("onboardingPlayerGender").value.trim(),
        role: $("onboardingPlayerRole").value.trim() || "commoner"
      };
    }
    if ($("castNotes")) draft.cast_notes = $("castNotes").value.trim();
    if ($("startingCastPolicy")) draft.starting_cast_policy = $("startingCastPolicy").value === "solo" ? "solo" : "generated";
    return true;
  }
  async function summarizeExistingStoryForOnboarding() {
    const draft = app.onboardingDraft;
    if (!draft?.story_title) return false;
    draft.story_lookup_checking = true;
    draft.story_lookup_raw = "";
    draft.story_lookup_received_chars = 0;
    draft.story_lookup_parse_failed = false;
    draft.story_lookup_summary = "";
    draft.story_confirmed = false;
    renderOnboardingStep();
    setStatus("Checking story...");
    startWorldGenerationHeartbeat("Checking existing story", 1, 3, `Waiting for AI story identification response for "${draft.story_title}".`);
    if ($("checkStoryBtn")) {
      $("checkStoryBtn").disabled = true;
      $("checkStoryBtn").textContent = "Checking...";
    }
    try {
      const genreList = entertainmentPreferenceOptions().join(", ");
      const prompt = `Identify this existing story for a state-tracked RPG adaptation.
Use general public knowledge. If the title is ambiguous, say what story you think it is.
Output ONLY valid JSON. No markdown.

Return exactly this shape:
{
  "identified_title": "title and franchise if needed",
  "genres": ["pick one or more simple tags from: ${genreList}"],
  "summary": "two concise paragraphs to describe the story",
  "protagonist": {
    "full_name": "protagonist full name",
    "age": 0,
    "gender": "protagonist gender",
    "role": "protagonist role at the start, or the durable role that best fits the whole story"
  }
}

Rules:
- Do not return future story events, opening scene plans, later relationship details, or late-story spoilers.
- The protagonist must be the playable main character at the very beginning of the story.
- If the protagonist's canon age is unknown or under 18, estimate a specific adult adaptation age that is at least 18.
- The age must be a number, not text.
- Replace the example age 0 with an intentional adult age that fits the protagonist. Do not default to 25 unless that is specifically appropriate.
- Pick one or more general genres from the provided list.
- Use simple tags. Do not invent compound genres such as dark romance, dark fantasy, cozy adventure, or mystery thriller; combine the simple tags instead.
- Keep sexual content out of this lookup summary; this is only story identification and protagonist setup.

TITLE:
${draft.story_title}

USER MODIFICATIONS:
${draft.story_modifications || "none"}`;
      let raw = "";
      let data = null;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        raw = await aiText(prompt, {
          label: "story lookup summary",
          // Check Story can take long enough that a static button looks
          // broken. Keep streaming the JSON text into the setup card;
          // the plugin-frame settle/retry path handles iframe races.
          onStream: streamed => {
            updateStoryLookupStreamingCard(streamed);
          }
        });
        data = parseJsonObject(raw);
        if (data) break;
        if (attempt < 2) {
          log("Story lookup retry", "Story lookup returned empty or invalid JSON. Retrying once.", {
            type: "system",
            level: "warn"
          });
          updateWorldGenerationStatus("Checking existing story", 1, 3, "Story lookup returned an empty or invalid response. Retrying once.");
        }
      }
      draft.story_lookup_raw = raw;
      updateStoryLookupStreamingCard(raw);
      updateWorldGenerationStatus("Checking existing story", 2, 3, "Story identification response received. Parsing summary and protagonist details.");
      if (!data) {
        draft.story_lookup_checking = false;
        draft.story_lookup_parse_failed = true;
        draft.story_lookup_title = draft.story_title;
        draft.story_lookup_modifications = draft.story_modifications || "";
        draft.story_lookup_summary = "Story check finished, but the response could not be parsed as JSON.";
        renderOnboardingStep();
        setStatus("Ready");
        stopWorldGenerationHeartbeat();
        return false;
      }
      const summary = String(data.summary || data.confirmation_summary || data.identified_title || raw || "").trim();
      draft.story_lookup_title = draft.story_title;
      draft.story_lookup_modifications = draft.story_modifications || "";
      draft.story_lookup_summary = summary;
      draft.story_lookup_genres = repairAiEntertainmentPreferences(data.genres || data.genre || []);
      if (data.protagonist) {
        applyStoryPlayerPrefill({
          name: data.protagonist.full_name || data.protagonist.name,
          gender: data.protagonist.gender,
          age: data.protagonist.age,
          role: data.protagonist.role
        }, {
          markComplete: true
        });
      }
      draft.story_confirmed = false;
      draft.story_lookup_checking = false;
      draft.story_lookup_raw = "";
      draft.story_lookup_parse_failed = false;
      renderOnboardingStep();
      setStatus("Ready");
      stopWorldGenerationHeartbeat();
      return true;
    } catch (err) {
      draft.story_lookup_checking = false;
      if (draft.story_lookup_raw) draft.story_lookup_parse_failed = true;
      showNotice("Story Check Failed", "Story check failed: " + (err.message || err));
      setStatus("Ready");
      stopWorldGenerationHeartbeat();
      return false;
    } finally {
      if ($("checkStoryBtn")) {
        $("checkStoryBtn").disabled = false;
        $("checkStoryBtn").textContent = "Check Story";
      }
    }
  }
  async function prefillPlayerFromExistingStory() {
    const draft = app.onboardingDraft;
    if (!draft?.story_title || !draft.story_confirmed) return false;
    if (draft.cast_prefilled_from === draft.story_title) return true;
    setStatus("Finding story cast...");
    draft.cast_lookup_checking = true;
    draft.cast_lookup_raw = "";
    draft.cast_lookup_received_chars = 0;
    draft.cast_lookup_parse_failed = false;
    renderOnboardingStep();
    updateWorldGenerationStatus("Finding story cast", 3, 3, `Waiting for AI starting-party prefill for "${draft.story_title}".`);
    const prompt = `For this existing story, identify a list of party members who are in the player's party at the very beginning of the story.
Include only party members that the player of this story should have control of.
Output ONLY valid JSON. No markdown.

Return exactly this shape:
{
  "starting_party": [
    {
      "name": "party member name",
      "gender": "gender",
      "age": 0,
      "role": "short role",
      "importance": "why they matter"
    }
  ]
}

Rules:
- The protagonist is the player character, not a party member. Do not include the protagonist in starting_party.
- Include only party members who are already with, controlled by, or directly commanded by the player at the first playable moment.
- Do not include later companions, future recruits, recurring NPCs, love interests, enemies, or people who meet the protagonist later.
- If the protagonist starts alone, return an empty starting_party array.
- If a party member's age is unknown or canonically under 18, estimate a specific adult adaptation age that is at least 18.
- Every age must be a number and at least 18.
- Replace the example age 0 with intentional, varied adult ages. Do not reuse one fallback age across the starting party.
- Keep roles short and useful for RPG character setup.
- Do not include duplicate variants of the same person.

STORY TITLE:
${draft.story_title}

CONFIRMED SUMMARY:
${draft.story_lookup_summary || ""}

PLAYER CHARACTER:
${prettyJson({
      name: draft.player?.name || "",
      age: draft.player?.age || "",
      gender: draft.player?.gender || "",
      role: draft.player?.role || ""
    })}

USER MODIFICATIONS:
${draft.story_modifications || "none"}`;
    try {
      const raw = await aiText(prompt, {
        label: "story starting party prefill",
        // Starting-cast lookup is also a long JSON setup call. Stream
        // visible progress here so users know the AI is still working.
        onStream: streamed => {
          updateCastLookupStreamingCard(streamed);
        }
      });
      draft.cast_lookup_raw = raw;
      updateCastLookupStreamingCard(raw);
      updateWorldGenerationStatus("Finding story cast", 3, 3, "Story starting-party response received. Applying starting cast fields.");
      const data = parseJsonObject(raw);
      if (!data) throw new Error("story starting party prefill returned invalid JSON");
      const startingParty = Array.isArray(data.starting_party) ? data.starting_party : Array.isArray(data.cast) ? data.cast : [];
      if (draft.cast_prefilled_from !== draft.story_title) {
        const castLines = startingParty.map(character => {
          const parts = [character.name, character.gender, character.age ? `age ${Math.max(18, Number(character.age) || 18)}` : "", character.role, character.importance].map(part => String(part || "").trim()).filter(Boolean);
          return parts.join(" - ");
        }).filter(Boolean);
        if (castLines.length) draft.cast_notes = [`Starting party from ${draft.story_title}:`, ...castLines].join("\n");else draft.cast_notes = "Start solo with no party members.";
        draft.starting_cast_policy = castLines.length ? "generated" : "solo";
        draft.cast_prefilled_from = draft.story_title;
      }
      log("Story starting party prefilled", [`${draft.player.name}, ${draft.player.gender}, age ${draft.player.age}, ${draft.player.role}`, draft.cast_notes ? `Cast suggestions: ${draft.cast_notes.split("\n").length - 1}` : "Cast suggestions: none"].join("\n"), {
        type: "system",
        level: "message"
      });
      draft.cast_lookup_checking = false;
      draft.cast_lookup_raw = "";
      draft.cast_lookup_parse_failed = false;
      return true;
    } catch (err) {
      draft.cast_lookup_checking = false;
      if (draft.cast_lookup_raw) draft.cast_lookup_parse_failed = true;
      log("Story starting party prefill failed", err.message || err, {
        type: "system",
        level: "error"
      });
      return false;
    } finally {
      setStatus("Ready");
    }
  }
  function applyStoryPlayerPrefill(player = {}, options = {}) {
    const draft = app.onboardingDraft;
    if (!draft) return false;
    const name = String(player.name || "").trim();
    const gender = String(player.gender || "").trim();
    const rawAge = Number(player.age);

    const age = rawAge;
    const role = String(player.role || "").trim();
    const usable = name && gender && Number.isFinite(age) && age >= 18 && role;
    if (!usable) return false;
    draft.player = {
      ...(draft.player || {}),
      name,
      gender,
      age: Math.max(18, age),
      role
    };
    if (options.markComplete !== false) draft.player_prefilled_from = draft.story_title;
    return true;
  }
  const ENTERTAINMENT_INSPIRATIONS = {
    anime: ["Frieren: Beyond Journey's End", "Fullmetal Alchemist: Brotherhood", "Cowboy Bebop", "Neon Genesis Evangelion", "Attack on Titan", "Jujutsu Kaisen", "Demon Slayer", "Chainsaw Man", "Hunter x Hunter", "One Piece", "Naruto", "Bleach", "Dragon Ball Z", "Death Note", "Code Geass", "Steins;Gate", "Violet Evergarden", "Mob Psycho 100", "Made in Abyss", "Puella Magi Madoka Magica", "Re:Zero", "Mushoku Tensei", "Konosuba", "Overlord", "That Time I Got Reincarnated as a Slime", "Ascendance of a Bookworm", "The Twelve Kingdoms", "Fate/Zero", "Fate/stay night", "Monogatari", "Ghost in the Shell: Stand Alone Complex", "Psycho-Pass", "Black Lagoon", "Samurai Champloo", "Vinland Saga", "Berserk", "Claymore", "Inuyasha", "Yona of the Dawn", "The Ancient Magus' Bride", "Apothecary Diaries", "Dungeon Meshi", "Delicious in Dungeon", "Sailor Moon", "Revolutionary Girl Utena", "Cardcaptor Sakura", "Fruits Basket", "Kaguya-sama: Love is War", "Toradora", "Your Name", "A Silent Voice", "Princess Mononoke", "Spirited Away", "Howl's Moving Castle", "Nausicaa of the Valley of the Wind", "Gurren Lagann", "Kill la Kill", "Cyberpunk: Edgerunners", "Trigun", "The Rising of the Shield Hero", "Kamasame Kiss", "Maid Sama", "Romantic Killer", "Let's Play", "Solo Leveling", "Moriarti the Patriot", "The Ice Guy and his Cool Female Colleague", "Welcome to Demon School", "Tomo-chan is a girl", "Soul Eater", "The Demon Prince of Momochi House", "Kakuryio - Bead and Breakfast for Spirits", "May I ask for One Final Thing", "Marriage Toxin", "Witch Watch", "I'll become a Villainess who goes down in History", "Zenshu", "Fire Force"],
    superpowers: ["Batman", "Superman", "Wonder Woman", "Spider-Man", "X-Men", "Avengers", "Justice League", "Teen Titans", "Doom Patrol", "Watchmen", "Invincible", "The Boys", "My Hero Academia", "One-Punch Man", "Mob Psycho 100", "Static Shock", "Young Justice", "Batman Beyond", "The Dark Knight", "Spider-Man 2", "Into the Spider-Verse", "Across the Spider-Verse", "Black Panther", "Captain America: The Winter Soldier", "Guardians of the Galaxy", "Deadpool", "Logan", "Daredevil", "Jessica Jones", "The Umbrella Academy", "The Incredibles", "Big Hero 6", "Kick-Ass", "Hellboy", "Spawn", "Worm", "Supergirl", "The Flash", "Green Lantern", "Moon Knight", "Ms. Marvel", "She-Hulk", "Hawkeye", "Doctor Strange", "Fantastic Four", "The Authority", "Planetary", "Astro City", "Irredeemable", "Radiant Black", "Saga", "Gotham City Sirens"],
    scifi: ["Dune", "Dune: Part Two", "Foundation", "The Expanse", "Mass Effect", "Star Wars", "Star Trek: The Next Generation", "Star Trek: Deep Space Nine", "Battlestar Galactica", "Babylon 5", "Firefly", "Blade Runner", "Blade Runner 2049", "Alien", "Aliens", "Terminator 2", "The Matrix", "Ghost in the Shell", "Cyberpunk 2077", "Neuromancer", "Snow Crash", "Altered Carbon", "The Left Hand of Darkness", "Hyperion", "The Culture", "Children of Time", "Project Hail Mary", "The Martian", "Arrival", "Annihilation", "Interstellar", "Edge of Tomorrow", "District 9", "Pacific Rim", "Halo", "Destiny", "Warhammer 40,000", "EVE Online", "No Man's Sky", "Stellaris", "Outer Wilds", "Control", "Prey", "Deus Ex", "System Shock", "Nier: Automata", "13 Sentinels: Aegis Rim", "Andor", "Severance", "Black Mirror", "Silo", "Scavengers Reign"],
    games: ["Baldur's Gate 3", "The Witcher 3", "Elden Ring", "Dark Souls", "Bloodborne", "Sekiro", "The Legend of Zelda: Ocarina of Time", "The Legend of Zelda: Breath of the Wild", "The Legend of Zelda: Tears of the Kingdom", "Final Fantasy VII", "Final Fantasy XIV", "Final Fantasy XVI", "Persona 5 Royal", "Fire Emblem: Three Houses", "Dragon Age: Origins", "Dragon Age: Inquisition", "Mass Effect 2", "Mass Effect 3", "Cyberpunk 2077", "The Elder Scrolls V: Skyrim", "Morrowind", "Fallout: New Vegas", "Disco Elysium", "Planescape: Torment", "Pillars of Eternity", "Pathfinder: Wrath of the Righteous", "Divinity: Original Sin 2", "Hades", "Hades II", "Hollow Knight", "Celeste", "Undertale", "Omori", "Chrono Trigger", "EarthBound", "Xenogears", "Xenoblade Chronicles", "Nier: Automata", "Kingdom Hearts", "Metal Gear Solid", "Resident Evil 4", "Silent Hill 2", "Bioshock", "Half-Life 2", "Portal 2", "The Last of Us", "God of War", "Red Dead Redemption 2", "Grand Theft Auto V", "Minecraft", "Terraria", "Stardew Valley", "Animal Crossing", "Monster Hunter World", "Yakuza: Like a Dragon", "Like a Dragon: Infinite Wealth", "Tactics Ogre", "Triangle Strategy", "Octopath Traveler II"],
    horror: ["Sinners", "Weapons", "Get Out", "Us", "Nope", "The Babadook", "Hereditary", "Midsommar", "The Witch", "The Lighthouse", "It Follows", "Talk to Me", "Barbarian", "X", "Pearl", "Maxxxine", "The Substance", "Longlegs", "The Conjuring", "Insidious", "Sinister", "The Ring", "Ringu", "Ju-On", "A Tale of Two Sisters", "Train to Busan", "Let the Right One In", "The Descent", "28 Days Later", "Dawn of the Dead", "Night of the Living Dead", "Halloween", "A Nightmare on Elm Street", "Scream", "Saw", "Hellraiser", "Candyman", "The Thing", "Alien", "Event Horizon", "Annihilation", "Silent Hill 2", "Resident Evil", "Dead Space", "Alan Wake", "Control", "SOMA", "Amnesia: The Dark Descent", "Outlast", "Until Dawn", "The Quarry", "World of Horror", "Junji Ito", "Uzumaki", "House of Leaves", "The Haunting of Hill House", "Midnight Mass"],
    comedy: ["Konosuba", "The Disastrous Life of Saiki K.", "Gintama", "Kaguya-sama: Love is War", "Spy x Family", "Dungeon Meshi", "Discworld", "Good Omens", "The Hitchhiker's Guide to the Galaxy", "The Princess Bride", "Monty Python and the Holy Grail", "What We Do in the Shadows", "Our Flag Means Death", "The Good Place", "Brooklyn Nine-Nine", "Parks and Recreation", "Community", "Arrested Development", "30 Rock", "Veep", "Futurama", "Rick and Morty", "Solar Opposites", "Bojack Horseman", "Adventure Time", "Gravity Falls", "The Owl House", "Amphibia", "The Venture Bros.", "Harley Quinn", "Deadpool", "Guardians of the Galaxy", "Thor: Ragnarok", "Scott Pilgrim", "Shaun of the Dead", "Hot Fuzz", "Everything Everywhere All at Once", "Knives Out", "Glass Onion", "Stardew Valley", "Hades", "Undertale", "Portal 2", "Yakuza: Like a Dragon"],
    fantasy: ["The Lord of the Rings", "The Hobbit", "The Silmarillion", "A Song of Ice and Fire", "Game of Thrones", "House of the Dragon", "The Witcher", "The Wheel of Time", "The Stormlight Archive", "Mistborn", "The Kingkiller Chronicle", "Earthsea", "The Broken Earth", "The First Law", "Discworld", "Malazan Book of the Fallen", "The Black Company", "The Priory of the Orange Tree", "The Poppy War", "The Green Bone Saga", "The Locked Tomb", "The Goblin Emperor", "Jonathan Strange & Mr Norrell", "His Dark Materials", "Narnia", "Harry Potter", "Percy Jackson", "The Magicians", "Baldur's Gate 3", "Dungeons & Dragons", "Dragonlance", "Forgotten Realms", "Critical Role", "Elden Ring", "Dark Souls", "Bloodborne", "Dragon Age", "Final Fantasy XIV", "Fire Emblem", "The Legend of Zelda", "Avatar: The Last Airbender", "Frieren", "Delicious in Dungeon", "Berserk", "Claymore", "Yona of the Dawn", "The Ancient Magus' Bride", "Princess Mononoke", "Pan's Labyrinth"],
    mystery_thriller: ["Sherlock Holmes", "Agatha Christie's Poirot", "Miss Marple", "Knives Out", "Glass Onion", "Only Murders in the Building", "True Detective", "Twin Peaks", "The X-Files", "Mindhunter", "Hannibal", "Se7en", "Zodiac", "Gone Girl", "The Girl with the Dragon Tattoo", "Death Note", "Monster", "Pluto", "Psycho-Pass", "Steins;Gate", "Danganronpa", "Zero Escape", "Ace Attorney", "Professor Layton", "Disco Elysium", "Return of the Obra Dinn", "Outer Wilds", "Control", "Alan Wake", "The Sinner", "Broadchurch", "Mare of Easttown", "Sharp Objects", "The Night Of", "Fargo", "The Prestige", "Memento", "Oldboy", "Memories of Murder", "Parasite"]
  };
  function categoriesFromPreferences(prefs = []) {
    const map = {
      anime: ["anime"],
      isekai: ["anime", "fantasy"],
      fantasy: ["fantasy"],
      mythology: ["fantasy"],
      supernatural: ["fantasy", "horror"],
      "sci-fi": ["scifi"],
      cyberpunk: ["scifi"],
      steampunk: ["scifi", "fantasy"],
      "post-apocalyptic": ["scifi", "horror"],
      superpower: ["superpowers"],
      romance: [],
      ensemble: ["anime"],
      horror: ["horror"],
      dark: ["horror"],
      mystery: ["mystery_thriller"],
      thriller: ["mystery_thriller"],
      crime: ["mystery_thriller"],
      comedy: ["comedy"],
      cozy: ["comedy", "fantasy"],
      "slice of life": ["comedy", "anime"],
      modern: ["mystery_thriller"],
      historical: ["fantasy"],
      adventure: ["fantasy", "games"],
      action: ["games", "superpowers"],
      drama: ["mystery_thriller"],
      school: ["anime", "comedy"],
      workplace: ["comedy"],
      political: ["mystery_thriller", "fantasy"],
      war: ["fantasy", "scifi"],
      western: ["mystery_thriller", "fantasy"],
      survival: ["horror", "scifi"]
    };
    const categories = exactEntertainmentPreferences(prefs).flatMap(pref => map[pref] || []);
    return [...new Set(categories.length ? categories : ["fantasy", "anime", "games"])];
  }
  function randomStoryOptions() {
    const draft = app.onboardingDraft || {};
    const categories = categoriesFromPreferences([...exactEntertainmentPreferences(draft.player_preferences || []), ""]);
    const pool = [...new Set(categories.flatMap(category => ENTERTAINMENT_INSPIRATIONS[category] || []))];
    return [...pool].sort(() => Math.random() - 0.5).slice(0, 10);
  }
  function onboardingStorySourcePrompt(draft = {}) {
    if (!draft.story_title) return "Original story";
    return [`Use existing story: ${draft.story_title}`, "Existing-story rule: start the playable game at the very beginning of the story.", "Opening scene rule: location, scene, first objective, character state, and player role must match the beginning before later canon developments.", "Progression rule: use later canon only for future objective hooks.", `Story lookup summary: ${draft.story_lookup_summary || "not summarized"}`].filter(Boolean).join("\n");
  }
  function onboardingSetupPrompt() {
    const draft = app.onboardingDraft || {};
    const source = onboardingStorySourcePrompt(draft);
    const soloOpening = startingCastPolicyIsSolo(draft);
    return [`Genres: ${exactEntertainmentPreferences(draft.player_preferences || []).join(", ")}`, source, `Story description: ${draft.story_description || ""}`, `Modifications: ${draft.story_modifications || ""}`, `Main character setup: ${prettyJson(draft.player || {})}`, `Cast notes: ${draft.cast_notes || ""}`, soloOpening ? "Starting Cast rule: The player explicitly wants no generated starting party. The opening must begin with only the player as a party/active/image character. Do not create companions, party members, romance candidates, active characters, image characters, or nearby character companions during setup. Future NPCs may exist only when discovered later in play." : ""].join("\n");
  }
  function applyOnboardingDraftToState(state) {
    const draft = app.onboardingDraft;
    if (!draft) return;
    state.meta.genres = repairAiEntertainmentPreferences(draft.story_lookup_genres?.length ? draft.story_lookup_genres : draft.player_preferences);
    delete state.meta.genre;
    delete state.meta.player_preferences;
    state.meta.story_source = {
      mode: draft.story_title ? "existing" : "original",
      title: draft.story_title || "",
      description: draft.story_description || "",
      modifications: draft.story_modifications || ""
    };
    state.meta.story_guidance = String(draft.story_guidance || "").trim();
    state.meta.starting_cast_policy = startingCastPolicyIsSolo(draft) ? "solo" : "generated";
    state.player = {
      ...state.player,
      ...draft.player,
      gender: draft.player?.gender?.trim() || "unspecified"
    };
    {
      state.world_flags.tone = "state-aware fantasy RPG adventure without explicit sexual content";
    }
  }
  function setGenerateWorldButtonLabel(text, disabled = true) {
    const button = $("generateWorldBtn");
    if (!button) return;
    button.disabled = !!disabled;
    button.textContent = text;
  }
  function playWorldGenerationCompleteSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const start = ctx.currentTime + 0.02;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, start);
      master.gain.exponentialRampToValueAtTime(0.16, start + 0.03);
      master.gain.exponentialRampToValueAtTime(0.0001, start + 1.35);
      master.connect(ctx.destination);
      const notes = [{
        freq: 392.0,
        at: 0,
        dur: 0.18
      }, {
        freq: 493.88,
        at: 0.16,
        dur: 0.18
      }, {
        freq: 587.33,
        at: 0.32,
        dur: 0.22
      }, {
        freq: 783.99,
        at: 0.54,
        dur: 0.34
      }, {
        freq: 987.77,
        at: 0.82,
        dur: 0.38
      }];
      notes.forEach((note, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = index < 3 ? "triangle" : "sine";
        osc.frequency.setValueAtTime(note.freq, start + note.at);
        gain.gain.setValueAtTime(0.0001, start + note.at);
        gain.gain.exponentialRampToValueAtTime(index < 3 ? 0.12 : 0.09, start + note.at + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + note.at + note.dur);
        osc.connect(gain);
        gain.connect(master);
        osc.start(start + note.at);
        osc.stop(start + note.at + note.dur + 0.04);
      });
      setTimeout(() => ctx.close?.(), 1700);
    } catch (err) {
      log("Completion sound failed", err.message || err, {
        type: "system",
        level: "error"
      });
    }
  }
  function worldGenerationStepLabels(total = 10) {
    const labels = ["Local scaffold", "World and map", "Starting cast", "Progression", "Finalize state", "Opening scene", "Ready"];
    const safeTotal = Math.max(1, Number(total) || labels.length);
    return Array.from({
      length: safeTotal
    }, (_, index) => labels[index] || `Step ${index + 1}`);
  }
  function openWorldGenerationModal(setupPrompt = "") {
    loadVoices();
    app.worldGenerationLoadingActive = true;
    app.worldGenerationStarted = false;
    app.worldGenerationPanel = "guidance";
    app.pendingWorldGenerationPrompt = setupPrompt;
    openModal(`
                <h2>Story Guidance</h2>
                ${renderOnboardingProgress("guidance")}
                <div id="worldGenerationControls"></div>
            `, {
      setupBlackout: !!app.onboardingDraft,
      hideClose: !!app.onboardingDraft,
      scrollKey: app.onboardingDraft ? "setup:guidance" : "story_guidance"
    });
    renderWorldGenerationControls("guidance");
  }
  function renderWorldGenerationDashboard() {
    const box = $("modalBox");
    if (!box) return;
    const setupBlackout = !!app.onboardingDraft;
    rememberModalScrollPosition(box);
    const closeButton = setupBlackout ? "" : `<button type="button" class="modal-close" title="Close" onclick="EmberAdventures.closeModal()">&times;</button>`;
    box.innerHTML = closeButton + `
                <h2>Creating New Story</h2>
                <div class="world-generation-workspace">
                    <details class="world-generation-progress" open>
                        <summary>Generation Progress</summary>
                        <div id="worldGenerationStatus" class="exact-send-notice" style="display:block"></div>
                    </details>
                    <div id="worldGenerationControls"></div>
                </div>
            `;
    restoreModalScrollPosition(box, setupBlackout ? "setup:generation_dashboard" : "generation_dashboard");
    updateModalBackdropMode(setupBlackout);
    $("modal")?.classList.add("open");
  }
  function worldGenerationVoicePickerHtml({
    id,
    label,
    selected = "",
    gender = "",
    searchLabel = "Search voices"
  }) {
    return `
                <label class="voice-picker">
                    ${escapeHtml(label)}
                    <input id="${id}Search" placeholder="${escapeHtml(searchLabel)}">
                    <div class="select-stepper">
                        <select id="${id}">${characterVoiceOptions(selected, gender)}</select>
                        <button type="button" id="${id}Prev" title="Previous voice">&#9650;</button>
                        <button type="button" id="${id}Next" title="Next voice">&#9660;</button>
                        <button type="button" id="${id}Test" title="Test selected voice">Test</button>
                    </div>
                </label>
            `;
  }
  function bindWorldGenerationVoicePicker({
    id,
    selected = "",
    gender = "",
    slot = "Narrator",
    sample = "",
    onCommit
  }) {
    bindVoiceCycler({
      selectId: id,
      searchId: `${id}Search`,
      prevId: `${id}Prev`,
      nextId: `${id}Next`,
      testId: `${id}Test`,
      slot,
      sample,
      selected,
      gender
    });
    const select = $(id);
    if (!select) return;
    select.addEventListener("emberadventures-lite-setting-commit", () => {
      onCommit?.(select.value);
      scheduleActiveGameSave();
    });
  }
  function renderWorldGenerationControls(panel = app.worldGenerationPanel || "guidance") {
    const container = $("worldGenerationControls");
    if (!container) return;
    app.worldGenerationPanel = panel;
    const started = !!app.worldGenerationStarted;
    const hasPlayer = started && !!app.state?.player;
    const characterNames = started ? Object.keys(app.state?.characters || {}) : [];
    const tabs = [["guidance", "Guidance", true], ["settings", "Voice Settings", true], ["player", "Player Voice", hasPlayer], ["characters", `Character Voices${characterNames.length ? ` (${characterNames.length})` : ""}`, characterNames.length > 0]];
    if (!started) {
      app.worldGenerationPanel = "guidance";
      container.innerHTML = `
                    <div class="world-generation-panel">${worldGenerationGuidancePanelHtml(false)}</div>
                `;
      bindWorldGenerationPanel("guidance");
      return;
    }
    if (!tabs.some(([id,, enabled]) => id === panel && enabled)) panel = tabs.find(([,, enabled]) => enabled)?.[0] || "guidance";
    app.worldGenerationPanel = panel;
    const tabHtml = tabs.map(([id, label, enabled]) => `<button type="button" class="tool-button ${panel === id ? "active" : ""}" ${enabled ? "" : "disabled"} data-world-generation-panel="${id}">${escapeHtml(label)}</button>`).join("");
    container.innerHTML = `
                <div class="world-generation-tabs">${tabHtml}</div>
                <div class="world-generation-panel">${worldGenerationPanelHtml(panel, {
      started,
      hasPlayer,
      characterNames
    })}</div>
            `;
    container.querySelectorAll("[data-world-generation-panel]").forEach(button => {
      button.onclick = () => renderWorldGenerationControls(button.dataset.worldGenerationPanel);
    });
    bindWorldGenerationPanel(panel);
  }
  function worldGenerationPanelHtml(panel, context = {}) {
    if (panel === "settings") return worldGenerationSettingsPanelHtml();
    if (panel === "player") return worldGenerationPlayerPanelHtml();
    if (panel === "characters") return worldGenerationCharactersPanelHtml(context.characterNames || []);
    return worldGenerationGuidancePanelHtml(context.started);
  }
  function worldGenerationGuidancePanelHtml(started = false) {
    const guidance = app.onboardingDraft ? app.onboardingDraft.story_guidance || "" : app.state?.meta?.story_guidance || "";
    return `
                <h3>Story Guidance</h3>
                ${worldGenerationCheckpointBannerHtml()}
                <p class="hint">Optional instructions included in AI prompts for this world. Examples: slower pacing, more tactical choices, stronger romance buildup, fewer interruptions, more character banter, or a specific writing style.</p>
                <textarea id="worldGenerationGuidance" rows="8" placeholder="Optional. Example: Keep the story RPG-first, make choices meaningful, and let romance build through recurring character moments.">${escapeHtml(guidance)}</textarea>
                ${started ? `<p class="hint">Changes made here after generation starts apply to future AI prompts after the world is created.</p>` : ""}
                <div class="row" style="margin-top:.75rem">
                    ${started ? `` : `<button type="button" id="worldGenerationBackBtn">Back</button><button class="primary" id="startWorldGenerationBtn">Generate Story</button>`}
                </div>
            `;
  }
  function worldGenerationSettingsPanelHtml() {
    const narratorOptions = visibleVoices(app.settings.narratorVoiceName).map(v => `<option value="${escapeHtml(v.name)}" ${v.name === app.settings.narratorVoiceName ? "selected" : ""}>${escapeHtml(v.name)} (${escapeHtml(v.lang)})</option>`).join("");
    return `
                <h3>Voice Settings</h3>
                <p class="hint">These are safe to change while the story is being created. They affect reading aloud, not world generation. Browsers only expose voices already available to that browser or operating system; EmberAdventures cannot force a browser to download missing voices.</p>
                <div class="grid2">
                    <label class="check-row"><input id="autoVoice" type="checkbox" ${app.settings.autoVoice ? "checked" : ""}> <span>Auto voice</span></label>
                    <label class="check-row"><input id="autoReadPlayerMessages" type="checkbox" ${app.settings.autoReadPlayerMessages ? "checked" : ""}> <span>Auto-read player messages</span></label>
                    <label class="check-row"><input id="showNonEnglishVoices" type="checkbox" ${app.settings.showNonEnglishVoices ? "checked" : ""}> <span>Show non-English voices</span></label>
                    <label class="voice-picker">
                        Narrator voice
                        <input id="narratorVoiceSearch" placeholder="Search voices">
                        <div class="select-stepper">
                            <select id="narratorVoiceName">${narratorOptions}</select>
                            <button type="button" id="narratorVoicePrev" title="Previous voice">&#9650;</button>
                            <button type="button" id="narratorVoiceNext" title="Next voice">&#9660;</button>
                            <button type="button" id="narratorVoiceTest" title="Test selected narrator voice">Test</button>
                        </div>
                    </label>
                    <label class="voice-picker">
                        Default main character male voice
                        <input id="defaultMalePlayerVoiceSearch" placeholder="Search male player voices">
                        <div class="select-stepper">
                            <select id="defaultMalePlayerVoiceName">${defaultPlayerVoiceOptions(app.settings.defaultMalePlayerVoiceName, "male")}</select>
                            <button type="button" id="defaultMalePlayerVoicePrev" title="Previous voice">&#9650;</button>
                            <button type="button" id="defaultMalePlayerVoiceNext" title="Next voice">&#9660;</button>
                            <button type="button" id="defaultMalePlayerVoiceTest" title="Test selected male player voice">Test</button>
                        </div>
                    </label>
                    <label class="voice-picker">
                        Default main character non-male voice
                        <input id="defaultNonMalePlayerVoiceSearch" placeholder="Search non-male player voices">
                        <div class="select-stepper">
                            <select id="defaultNonMalePlayerVoiceName">${defaultPlayerVoiceOptions(app.settings.defaultNonMalePlayerVoiceName, "female")}</select>
                            <button type="button" id="defaultNonMalePlayerVoicePrev" title="Previous voice">&#9650;</button>
                            <button type="button" id="defaultNonMalePlayerVoiceNext" title="Next voice">&#9660;</button>
                            <button type="button" id="defaultNonMalePlayerVoiceTest" title="Test selected non-male player voice">Test</button>
                        </div>
                    </label>
                </div>
            `;
  }
  function worldGenerationPlayerPanelHtml() {
    const player = app.state?.player || {};
    if (!app.worldGenerationStarted || !player) return `<p class="hint">Player voice unlocks after the local scaffold is created.</p>`;
    return `
                <h3>Player Voice</h3>
                <div class="world-generation-card">
                    <strong>${escapeHtml(player.name || "Player")}</strong>
                    <span class="hint">${escapeHtml([player.gender, player.role].filter(Boolean).join(" / ") || "Player character")}</span>
                    ${worldGenerationVoicePickerHtml({
      id: "worldGenPlayerVoice",
      label: "Player voice",
      selected: player.voice || defaultPlayerVoiceForGender(player.gender, ""),
      gender: normalizedCharacterGender(player.gender) === "male" ? "male" : "female",
      searchLabel: "Search player voices"
    })}
                </div>
            `;
  }
  function worldGenerationCharactersPanelHtml(characterNames = []) {
    if (!characterNames.length) return `<p class="hint">Character voices unlock after starting cast generation creates characters.</p>`;
    return `
                <h3>Character Voices</h3>
                <div class="stack">
                    ${characterNames.map((name, index) => {
      const character = app.state.characters[name] || {};
      return `
                                <div class="world-generation-card">
                                    <strong>${escapeHtml(name)}</strong>
                                    <span class="hint">${escapeHtml([character.gender, character.role].filter(Boolean).join(" / ") || "Character")}</span>
                                    ${worldGenerationVoicePickerHtml({
        id: `worldGenCharacterVoice${index}`,
        label: "Character voice",
        selected: character.voice || "",
        gender: normalizedCharacterGender(character.gender) === "male" ? "male" : "female",
        searchLabel: "Search character voices"
      })}
                                </div>
                            `;
    }).join("")}
                </div>
            `;
  }
  function bindWorldGenerationPanel(panel) {
    const guidance = $("worldGenerationGuidance");
    if (guidance) {
      guidance.onblur = () => {
        const value = guidance.value.trim();
        if (app.onboardingDraft) app.onboardingDraft.story_guidance = value;
        if (app.worldGenerationStarted) {
          app.state.meta ||= {};
          app.state.meta.story_guidance = value;
        }
        scheduleActiveGameSave();
      };
    }
    if ($("startWorldGenerationBtn")) $("startWorldGenerationBtn").onclick = () => {
      if (activeWorldGenerationJob()) {
        renderWorldGenerationDashboard();
        renderWorldGenerationControls(app.worldGenerationPanel || "settings");
        return;
      }
      guidance?.onblur?.();
      $("startWorldGenerationBtn").disabled = true;
      $("startWorldGenerationBtn").textContent = "Starting...";
      generateWorld(app.pendingWorldGenerationPrompt || "");
    };
    if ($("resumeWorldGenerationCheckpointBtn")) $("resumeWorldGenerationCheckpointBtn").onclick = () => resumeWorldGenerationCheckpoint();
    if ($("exportWorldGenerationCheckpointBtn")) $("exportWorldGenerationCheckpointBtn").onclick = () => exportWorldGenerationCheckpoint();
    if ($("discardWorldGenerationCheckpointBtn")) $("discardWorldGenerationCheckpointBtn").onclick = () => discardWorldGenerationCheckpoint();
    if ($("worldGenerationBackBtn")) $("worldGenerationBackBtn").onclick = () => {
      guidance?.onblur?.();
      app.pendingWorldGenerationPrompt = "";
      app.worldGenerationLoadingActive = false;
      app.worldGenerationStarted = false;
      if (app.onboardingDraft) {
        app.onboardingDraft.step = 8;
        renderOnboardingStep();
      } else {
        openStoryTemplateLibrary();
      }
    };
    if (panel === "settings") {
      bindVoicePreviewControls();
      bindSettingsAutoSave();
    }
    if (panel === "player") {
      const player = app.state?.player || {};
      bindWorldGenerationVoicePicker({
        id: "worldGenPlayerVoice",
        slot: "Default male player voice",
        sample: characterVoicePreviewText(player.name || "Player"),
        selected: player.voice || defaultPlayerVoiceForGender(player.gender, ""),
        gender: normalizedCharacterGender(player.gender) === "male" ? "male" : "female",
        onCommit: value => {
          app.state.player.voice = value;
        }
      });
    }
    if (panel === "characters") {
      Object.keys(app.state?.characters || {}).forEach((name, index) => {
        const character = app.state.characters[name];
        bindWorldGenerationVoicePicker({
          id: `worldGenCharacterVoice${index}`,
          slot: normalizedCharacterGender(character.gender) === "male" ? "Masculine Lead" : "Feminine Lead",
          sample: characterVoicePreviewText(name),
          selected: character.voice || "",
          gender: normalizedCharacterGender(character.gender) === "male" ? "male" : "female",
          onCommit: value => {
            app.state.characters[name].voice = value;
          }
        });
      });
    }
  }
  function newWorldGenerationJob(prompt = "") {
    const id = `worldgen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      id,
      promptHash: simpleTextHash(prompt),
      prompt: String(prompt || ""),
      startedAt: new Date().toISOString(),
      active: true,
      committed: false,
      status: "running"
    };
  }
  function simpleTextHash(text = "") {
    let hash = 0;
    const input = String(text || "");
    for (let index = 0; index < input.length; index++) {
      hash = Math.imul(31, hash) + input.charCodeAt(index) | 0;
    }
    return Math.abs(hash).toString(36);
  }
  function activeWorldGenerationJob() {
    const job = app.worldGenerationJob;
    return job && job.active && !job.committed ? job : null;
  }
  function worldGenerationJobIsCurrent(jobOrId) {
    const id = typeof jobOrId === "string" ? jobOrId : jobOrId?.id;
    return !!id && String(app.worldGenerationJob?.id || "") === String(id);
  }
  function worldGenerationJobCanContinue(jobOrId) {
    return worldGenerationJobIsCurrent(jobOrId) && app.worldGenerationJob?.active !== false;
  }
  function markWorldGenerationJobFailed(job, message = "") {
    if (!worldGenerationJobIsCurrent(job)) return;
    app.worldGenerationJob.active = false;
    app.worldGenerationJob.status = "failed";
    app.worldGenerationJob.error = String(message || "");
  }
  function markWorldGenerationJobCommitted(job) {
    if (!worldGenerationJobIsCurrent(job)) return false;
    if (app.worldGenerationJob.committed) return false;
    app.worldGenerationJob.committed = true;
    app.worldGenerationJob.active = false;
    app.worldGenerationJob.status = "committed";
    return true;
  }
  function stopIfStaleWorldGenerationJob(job) {
    return !worldGenerationJobCanContinue(job);
  }
  function validatedWorldGenerationCompletedChunks(checkpoint = {}) {
    const completed = new Set((Array.isArray(checkpoint.completedChunks) ? checkpoint.completedChunks : []).map(item => String(item || "").trim()).filter(Boolean));
    const state = checkpoint.partialState || {};
    const messages = Array.isArray(checkpoint.partialMessages) ? checkpoint.partialMessages : [];
    const hasObjective = !!currentObjectiveTarget(state);
    const hasOpeningMessage = messages.some(message => message?.role === "assistant" && !message.temporary && String(message.text || "").trim());
    const rules = [["local_scaffold", () => !!state.player], ["world", () => !!(state.location || state.world_map)], ["cast", () => !!state.player], ["objectives", () => hasObjective], ["finalized_state", () => !!state.meta?.setup_complete && hasObjective], ["opening_message", () => hasOpeningMessage]];
    for (const [chunk, valid] of rules) {
      if (completed.has(chunk) && !valid()) completed.delete(chunk);
    }
    return [...completed];
  }
  const WORLD_GENERATION_CHECKPOINT_FIELDS = Object.freeze(["version", "jobId", "prompt", "promptHash", "startedAt", "updatedAt", "currentStep", "currentLabel", "completedChunks", "errors", "partialState", "partialMessages", "progress"]);
  function validateWorldGenerationCheckpoint(checkpoint) {
    const errors = [...exactObjectFieldValidationErrors(checkpoint, WORLD_GENERATION_CHECKPOINT_FIELDS, "world generation checkpoint"), ...requiredExactFieldsValidationErrors(checkpoint, WORLD_GENERATION_CHECKPOINT_FIELDS, "world generation checkpoint")];
    if (!isPlainObject(checkpoint)) return validationResult(errors);
    if (checkpoint.version !== 1) errors.push(validationError("version", "value", "Checkpoint version must be exactly 1."));
    for (const field of ["jobId", "prompt", "promptHash", "startedAt", "updatedAt", "currentLabel"]) {
      if (typeof checkpoint[field] !== "string") errors.push(validationError(field, "type", `${field} must be text.`));
    }
    if (!Number.isSafeInteger(checkpoint.currentStep) || checkpoint.currentStep < 1) errors.push(validationError("currentStep", "type", "currentStep must be a positive safe integer."));
    if (!Array.isArray(checkpoint.completedChunks) || checkpoint.completedChunks.some(value => typeof value !== "string" || !value)) errors.push(validationError("completedChunks", "type", "completedChunks must be an array of non-empty strings."));else if (new Set(checkpoint.completedChunks).size !== checkpoint.completedChunks.length) errors.push(validationError("completedChunks", "duplicate", "completedChunks cannot contain duplicates."));
    if (!Array.isArray(checkpoint.errors)) errors.push(validationError("errors", "type", "errors must be an array."));else {
      checkpoint.errors.forEach((entry, index) => {
        const path = `errors.${index}`;
        errors.push(...exactObjectFieldValidationErrors(entry, ["at", "message", "label"], path), ...requiredExactFieldsValidationErrors(entry, ["at", "message", "label"], path));
        for (const field of ["at", "message", "label"]) if (typeof entry?.[field] !== "string") errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be text.`));
      });
    }
    if (checkpoint.partialState !== null && !isPlainObject(checkpoint.partialState)) errors.push(validationError("partialState", "type", "partialState must be an object or null."));
    if (!Array.isArray(checkpoint.partialMessages) || checkpoint.partialMessages.some(value => !isPlainObject(value))) errors.push(validationError("partialMessages", "type", "partialMessages must be an array of message objects."));
    if (checkpoint.progress !== null && !isPlainObject(checkpoint.progress)) errors.push(validationError("progress", "type", "progress must be an object or null."));
    if (Array.isArray(checkpoint.completedChunks) && validatedWorldGenerationCompletedChunks(checkpoint).length !== checkpoint.completedChunks.length) errors.push(validationError("completedChunks", "state", "completedChunks claims work missing from the checkpoint state."));
    return validationResult(errors);
  }
  function exactWorldGenerationCheckpoint(checkpoint) {
    if (checkpoint == null) return null;
    const validation = validateWorldGenerationCheckpoint(checkpoint);
    if (!validation.ok) throw new Error(validationErrorsText(validation));
    return clone(checkpoint);
  }
  function worldGenerationCheckpointLabel(checkpoint = app.worldGenerationCheckpoint) {
    const exact = exactWorldGenerationCheckpoint(checkpoint);
    if (!exact) return "No saved generation draft";
    const count = exact.completedChunks.length;
    const step = exact.currentStep;
    const label = exact.currentLabel || "partial draft";
    return `${label}; step ${step}/10; ${count} completed chunk${count === 1 ? "" : "s"}`;
  }
  async function writeWorldGenerationCheckpoint(checkpoint) {
    const exact = exactWorldGenerationCheckpoint(checkpoint);
    if (!exact) return false;
    app.worldGenerationCheckpoint = exact;
    const saved = await awaitLargeStorageSet(WORLD_GENERATION_CHECKPOINT_KEY, exact, {
      json: true
    });
    if (!saved) log("Story draft checkpoint failed", "The partial story-generation draft could not be saved to large storage.", {
      type: "state",
      level: "error"
    });
    return saved;
  }
  async function clearWorldGenerationCheckpoint() {
    app.worldGenerationCheckpoint = null;
    app.work.scheduleMaintenance("clear-world-generation-checkpoint", "Clear story draft checkpoint", () => largeStorageRemove(WORLD_GENERATION_CHECKPOINT_KEY));
    return true;
  }
  async function checkpointWorldGeneration(job, updates = {}) {
    if (!worldGenerationJobIsCurrent(job)) return false;
    const previous = exactWorldGenerationCheckpoint(app.worldGenerationCheckpoint);
    const completed = new Set(previous?.completedChunks || []);
    for (const chunk of updates.completedChunks || []) {
      if (chunk) completed.add(String(chunk));
    }
    if (updates.completedChunk) completed.add(String(updates.completedChunk));
    const errors = [...(previous?.errors || []), ...(updates.error ? [{
      at: new Date().toISOString(),
      message: String(updates.error || ""),
      label: updates.currentLabel || previous?.currentLabel || ""
    }] : [])].slice(-8);
    return writeWorldGenerationCheckpoint({
      ...previous,
      version: 1,
      jobId: job.id,
      prompt: job.prompt,
      promptHash: job.promptHash,
      startedAt: job.startedAt,
      updatedAt: new Date().toISOString(),
      currentStep: updates.currentStep ?? app.worldGenerationProgress?.step ?? previous?.currentStep ?? 1,
      currentLabel: updates.currentLabel ?? app.worldGenerationProgress?.stage ?? previous?.currentLabel ?? "",
      completedChunks: [...completed],
      errors,
      // SANITIZE KEEP (boundary): persisted world-generation checkpoint stores a normalized partial generated state.
      // SANITIZE TEST: Existing AI/story-generation traces cover this boundary broadly; add a focused regression before splitting it.
      partialState: repairAiGeneratedState(clone(updates.state || app.state)),
      partialMessages: (updates.messages || app.messages || []).filter(message => message?.role !== "log").slice(-12).map(compactMessageForStorage),
      progress: clone(app.worldGenerationProgress || previous?.progress || null)
    });
  }
  function worldGenerationCheckpointBannerHtml() {
    const checkpoint = exactWorldGenerationCheckpoint(app.worldGenerationCheckpoint);
    if (!checkpoint || activeWorldGenerationJob()) return "";
    return `
                <div class="exact-send-notice" style="display:block;margin-bottom:.75rem">
                    <strong>Saved partial story draft</strong>
                    <div class="hint">${escapeHtml(worldGenerationCheckpointLabel(checkpoint))}</div>
                    <div class="row" style="margin-top:.5rem">
                        <button type="button" id="resumeWorldGenerationCheckpointBtn" class="primary">Resume</button>
                        <button type="button" id="exportWorldGenerationCheckpointBtn">Export Partial</button>
                        <button type="button" id="discardWorldGenerationCheckpointBtn" class="danger">Discard</button>
                    </div>
                </div>
            `;
  }
  async function resumeWorldGenerationCheckpoint() {
    const checkpoint = exactWorldGenerationCheckpoint(app.worldGenerationCheckpoint);
    if (!checkpoint) {
      showNotice("No Draft", "No saved story generation draft was found.");
      return;
    }
    if (!$("modalBox")) openWorldGenerationModal(checkpoint.prompt);
    await generateWorld(checkpoint.prompt, {
      resumeCheckpoint: checkpoint
    });
  }
  async function discardWorldGenerationCheckpoint() {
    await clearWorldGenerationCheckpoint();
    renderWorldGenerationControls(app.worldGenerationPanel || "guidance");
  }
  function exportWorldGenerationCheckpoint() {
    const checkpoint = exactWorldGenerationCheckpoint(app.worldGenerationCheckpoint);
    if (!checkpoint) {
      showNotice("No Draft", "No saved story generation draft was found.");
      return;
    }
    downloadJsonPayload(checkpoint, `emberadventures-lite-world-generation-draft-${safeArchiveFileName(checkpoint.promptHash || checkpoint.jobId || "draft")}.json`);
  }
  async function commitGeneratedWorld(job) {
    // Generated-game commit assumes generation already claimed a fresh
    // active saveId and cleared previous game-owned runtime arrays.
    if (!worldGenerationJobCanContinue(job)) return false;
    if (!markWorldGenerationJobCommitted(job)) return false;
    app.state.meta ||= {};
    app.state.meta.save_id ||= activeSaveId();
    stampRuntimeSaveOwnership(activeSaveId());
    app.state.meta.generation_job_id = job.id;
    app.state.meta.setup_complete = true;
    resetLeftPanelForNewGame();
    app.onboardingDraft = null;
    app.enforceSoloOpening = false;
    app.worldGenerationLoadingActive = false;
    app.worldGenerationStarted = false;
    app.pendingWorldGenerationPrompt = "";
    app.busy = false;
    scheduleActiveGameSave();
    await saveGeneratedGame("new game created");
    await saveStoryTemplateFromCurrent("generated story template");
    await clearWorldGenerationCheckpoint();
    return true;
  }
  async function generateWorld(setupPrompt = "", options = {}) {
    // New generation creates a fresh active saveId before any opening
    // message exists, so old same-story chat cannot attach to the run.
    const resumeCheckpoint = exactWorldGenerationCheckpoint(options.resumeCheckpoint);
    const prompt = String(resumeCheckpoint?.prompt || setupPrompt || "").trim() || $("worldPrompt")?.value?.trim() || "";
    if (!prompt) return;
    const existingJob = activeWorldGenerationJob();
    if (existingJob && !resumeCheckpoint) {
      renderWorldGenerationDashboard();
      renderWorldGenerationControls(app.worldGenerationPanel || "settings");
      updateWorldGenerationStatus(app.worldGenerationProgress?.stage || "Creating New Story", app.worldGenerationProgress?.step || 1, app.worldGenerationProgress?.total || 10, "Story generation is already running. Reusing the active job.", {
        jobId: existingJob.id,
        status: "current"
      });
      return;
    }
    cancelAllGameProcesses("generating new game");
    const job = newWorldGenerationJob(prompt);
    const generatedSaveId = newSaveId("save");
    setActiveSaveId(generatedSaveId);
    app.messages = [];
    app.images = [];
    app.profileImages = exactProfileImageStore(await loadPerRecordLibrary(PROFILE_IMAGE_KEY, []));
    app.snapshots = [];
    await persistActiveSavePointer();
    if (resumeCheckpoint?.jobId) job.resumedFrom = resumeCheckpoint.jobId;
    app.worldGenerationJob = job;
    app.worldGenerationStarted = true;
    app.worldGenerationPanel = "settings";
    renderWorldGenerationDashboard();
    renderWorldGenerationControls(app.worldGenerationPanel || "settings");
    setGenerateWorldButtonLabel("Building scaffold...");
    startWorldGenerationHeartbeat("Starting world setup", 1, 10, "Preparing scaffold and saving the first checkpoint.", job.id);
    let state = null;
    try {
      app.enforceSoloOpening = startingCastPolicyIsSolo();
      const completedChunks = new Set(resumeCheckpoint?.completedChunks || []);
      const chunkDone = label => completedChunks.has(label);
      const checkpointChunk = async (label, step, currentLabel, stateOverride = state) => {
        completedChunks.add(label);
        await checkpointWorldGeneration(job, {
          completedChunks: [...completedChunks],
          currentStep: step,
          currentLabel,
          state: stateOverride,
          messages: app.messages
        });
      };
      state = resumeCheckpoint?.partialState
      // SANITIZE KEEP (boundary): resumed new-story generation imports partial generated state from checkpoint storage.
      // SANITIZE TEST: Existing AI/story-generation traces cover this boundary broadly; add a focused regression before splitting it.
      ? repairAiGeneratedState(clone(resumeCheckpoint.partialState)) : buildWorldScaffold(prompt);
      if (resumeCheckpoint?.partialMessages?.length) app.messages = resumeCheckpoint.partialMessages.map(clone);
      if (!resumeCheckpoint?.partialState) applyOnboardingDraftToState(state);
      state.meta ||= {};
      state.meta.save_id = generatedSaveId;
      app.state = state;
      stampRuntimeSaveOwnership(generatedSaveId);
      if (resumeCheckpoint) ensureProfileImagesForAll("resumed world generation draft");
      if (!chunkDone("local_scaffold")) {
        queueProfileImagesForNames(["Player"], "world generation player ready");
        await checkpointChunk("local_scaffold", 1, "Local scaffold");
      }
      renderWorldGenerationControls(app.worldGenerationPanel || "settings");
      app.busy = true;
      setStatus("Building adventure state...");
      updateWorldGenerationStatus("Building adventure state", 1, 10, "Creating local scaffold before AI requests. Player profile image has been queued in the background.", {
        jobId: job.id
      });
      renderPlayHud();
      const applyChunk = chunk => {
        if (stopIfStaleWorldGenerationJob(job)) return;
        if (chunk && typeof chunk === "object") state = mergeWorldChunk(state, chunk);
      };
      setGenerateWorldButtonLabel("Building world...");
      updateWorldGenerationStatus("Building world and map", 2, 10, "Waiting for AI world/location/map response.", {
        jobId: job.id
      });
      if (!chunkDone("world")) {
        applyChunk(await buildWorldChunk(prompt));
        await checkpointChunk("world", 2, "Building world and map");
      }
      if (stopIfStaleWorldGenerationJob(job)) return;
      setGenerateWorldButtonLabel("Building cast...");
      updateWorldGenerationStatus("Building cast", 3, 10, "Planning starting cast and generating character details if needed.", {
        jobId: job.id
      });
      if (!chunkDone("cast")) {
        applyChunk(await buildCastChunk(prompt));
        await checkpointChunk("cast", 3, "Building cast");
      }
      if (stopIfStaleWorldGenerationJob(job)) return;
      app.state = state;
      queueProfileImagesForNames(Object.keys(state.characters || {}), "world generation cast ready");
      renderWorldGenerationControls(app.worldGenerationPanel || "characters");
      setGenerateWorldButtonLabel("Building objectives...");
      updateWorldGenerationStatus("Building objectives", 4, 10, `Waiting for AI player setup/objective response. ${Object.keys(state.characters || {}).length} cast profile image(s) queued in the background.`, {
        jobId: job.id
      });
      if (!chunkDone("objectives")) {
        applyChunk(await buildProgressionChunk(prompt));
        await checkpointChunk("objectives", 4, "Building objectives");
      }
      if (stopIfStaleWorldGenerationJob(job)) return;
      if (!chunkDone("finalized_state")) {
        if (startingCastPolicyIsSolo()) {
          state = forceSoloOpeningState(state, "The hero begins without generated starting party members.");
        }
        updateWorldGenerationStatus("Finalizing game state", 8, 10, "Sanitizing state and checking for single-value slot repairs.", {
          jobId: job.id
        });
        state = await repairSingleValueCommaSlots(state, "world generation", prompt);
        if (stopIfStaleWorldGenerationJob(job)) return;
        state = preserveGeneratedProfileImages(state);
        // SANITIZE KEEP (boundary): new-story world generation output is AI-generated full state.
        // SANITIZE TEST: Existing AI/story-generation traces cover this boundary broadly; add a focused regression before splitting it.
        state = repairAiGeneratedState(state);
        state = preserveGeneratedProfileImages(state);
        if (startingCastPolicyIsSolo()) {
          // SANITIZE KEEP (boundary): solo-opening enforcement rewrites generated setup state before it becomes runtime state.
          // SANITIZE TEST: Existing broad boundary coverage applies; add a focused regression before narrowing this call.
          state = repairAiGeneratedState(forceSoloOpeningState(state, "The hero begins without generated starting party members."));
          state = preserveGeneratedProfileImages(state);
        }
        state.meta.setup_complete = true;
        state.meta.generation_job_id = job.id;
        state.meta.save_id = generatedSaveId;
        state = preserveGeneratedProfileImages(state);
        app.state = state;
        app.messages = [];
        await checkpointChunk("finalized_state", 8, "Finalizing game state");
      } else {
        app.state = state;
      }
      let openingMessage = chunkDone("opening_message") && app.messages.find(message => message?.role === "assistant" && !message.temporary && String(message.text || "").trim()) || null;
      let opening = String(openingMessage?.text || "");
      if (!chunkDone("opening_message") || !openingMessage) {
        const openingNotice = addMessage("system", "Adventure state created. Opening scene incoming...", "", {
          temporary: true
        });
        setStatus("Writing opening scene...");
        updateWorldGenerationStatus("Writing opening scene", 9, 10, "Waiting for AI opening narration response.", {
          jobId: job.id
        });
        removeMessageById(openingNotice.id);
        openingMessage = addMessage("assistant", "", "Narrator", {
          streaming: true,
          saveId: generatedSaveId
        });
        renderThread();
        renderPlayHud();
        const openingPromise = generateOpeningScene(openingMessage.id);
        scheduleActiveGameSave();
        opening = await openingPromise;
        if (stopIfStaleWorldGenerationJob(job)) return;
        openingMessage = app.messages.find(message => String(message.id) === String(openingMessage.id));
        if (openingMessage) {
          openingMessage.saveId = generatedSaveId;
          openingMessage.text = sanitizeDisplayMessageText("assistant", opening);
          openingMessage.streaming = false;
          scheduleActiveGameSave();
          renderThread();
          renderPlayHud();
        }
        await checkpointChunk("opening_message", 9, "Writing opening scene");
      }
      // New story creation must not run a state check after the opening
      // narration. The opening narration is baseline setup text generated
      // from the newly created state, not a player/AI turn that changes
      // state. The first state update is after the player's first actual
      // action.
      if (openingMessage) {
        openingMessage.saveId = generatedSaveId;
        openingMessage.stateSyncStatus = "synced";
        scheduleActiveGameSave();
      }
      if (startingCastPolicyIsSolo()) {
        // SANITIZE KEEP (boundary): final solo-opening cleanup still belongs to new-game generation boundary.
        // SANITIZE TEST: Existing broad boundary coverage applies; add a focused regression before narrowing this call.
        app.state = repairAiGeneratedState(forceSoloOpeningState(app.state, "Solo opening rules removed generated starting party members.", {
          preserveSceneNpcs: true
        }));
        state = app.state;
      }
      // New-game exports should not start with runtime delta notes.
      // Opening narration is baseline setup, and later state updates
      // should begin from the player's first real action.
      app.state.recent_changes = [];
      state = app.state;
      queueOpeningSceneImage();
      ensureProfileImagesForAll("world generation");
      updateWorldGenerationStatus("Ready for player input", 10, 10, "World, objectives, and background image/profile tasks are queued.", {
        jobId: job.id,
        status: "done",
        stepProgress: 1
      });
      setStatus("Ready");
      playWorldGenerationCompleteSound();
      if (!(await commitGeneratedWorld(job))) return;
      flushScheduledSaveAll("new game created");
      await flushLargeSaves();
      app.mainMenuOpen = false;
      render();
      const openingHelpShown = showPlayerInputHelpOnce(openingMessage?.id, {
        force: true
      });
      if (!openingHelpShown) closeModal();
      $("input").focus?.();
      scheduleActiveGameSave();
      flushScheduledSaveAll("opening message saved");
      await flushLargeSaves();
      setTimeout(() => {
        if (!openingHelpShown && app.settings.autoVoice) readMessage(openingMessage?.id, {
          sequence: false
        });
      }, 0);
    } catch (err) {
      await checkpointWorldGeneration(job, {
        currentStep: app.worldGenerationProgress?.step || 1,
        currentLabel: app.worldGenerationProgress?.stage || "Story generation failed",
        state: state || app.state,
        messages: app.messages,
        error: err.message || String(err)
      });
      markWorldGenerationJobFailed(job, err.message || String(err));
      app.worldGenerationStarted = false;
      app.worldGenerationLoadingActive = false;
      app.busy = false;
      updateWorldGenerationStatus("Story generation failed", app.worldGenerationProgress?.step || 1, app.worldGenerationProgress?.total || 10, err.message || String(err), {
        jobId: job.id,
        status: "failed"
      });
      setStatus("Story generation failed");
      renderWorldGenerationControls("guidance");
    } finally {
      if (worldGenerationJobIsCurrent(job)) stopWorldGenerationHeartbeat();
      if (worldGenerationJobIsCurrent(job)) {
        app.busy = false;
        app.enforceSoloOpening = false;
        app.preserveSoloOpeningSceneNpcs = false;
      }
    }
  }
  function countFilledGenerationLeaves(value) {
    if (value == null || value === "") return 0;
    if (Array.isArray(value)) return value.reduce((sum, item) => sum + countFilledGenerationLeaves(item), 0);
    if (typeof value === "object") return Object.values(value).reduce((sum, item) => sum + countFilledGenerationLeaves(item), 0);
    return 1;
  }
  function countLikelyGenerationValues(text) {
    const raw = String(text || "");
    if (!raw.trim()) return 0;
    const jsonPairs = raw.match(/"[^"]+"\s*:/g) || [];
    const compactPairs = raw.match(/^[A-Za-z0-9_.-]+\s*=/gm) || [];
    return jsonPairs.length + compactPairs.length;
  }
  function clampGenerationNumber(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.max(min, Math.min(max, number));
  }
  function worldGenerationExpectation(step = 1, label = "") {
    const name = String(label || "").toLowerCase();
    if (step === 1) return {
      type: "fixed",
      label: "Local setup",
      value: 1
    };
    if (step === 2) return {
      type: "chars",
      label: "Expected world/map size",
      value: 1500,
      note: "100% is expected size; actual may be bigger or smaller."
    };
    if (step === 3) {
      if (/cast plan/.test(name)) return {
        type: "chars",
        label: "Expected cast plan size",
        value: 1200
      };
      return {
        type: "chars",
        label: "Expected character size",
        value: 2800
      };
    }
    if (step === 4) return {
      type: "values",
      label: "Progression values",
      value: 40
    };
    if (step === 5) return {
      type: "values",
      label: "Objective values",
      value: 40
    };
    if (step === 6) return {
      type: "values",
      label: "Story memory values",
      value: 40
    };
    if (step === 7) return {
      type: "chars",
      label: "Expected repair size",
      value: 1400
    };
    if (step === 8) return {
      type: "values",
      label: "Finalize values",
      value: 16
    };
    if (step === 9) return {
      type: "chars",
      label: "Expected opening size",
      value: 4500,
      note: "100% is expected size; actual may be bigger or smaller."
    };
    if (step === 10) return {
      type: "chars",
      label: "Expected state-check size",
      value: 2600
    };
    return {
      type: "chars",
      label: "Expected response size",
      value: 2500
    };
  }
  function worldGenerationStepProgress({
    step = 1,
    label = "",
    outputChars = 0,
    streamedValues = 0,
    filledValues = null,
    fallback = 0
  } = {}) {
    const expectation = worldGenerationExpectation(step, label);
    if (expectation.type === "fixed") return clampGenerationNumber(fallback, 0, 1);
    if (expectation.type === "values") {
      const count = filledValues != null ? Number(filledValues) || 0 : Number(streamedValues) || 0;
      return clampGenerationNumber(count / Math.max(1, expectation.value), 0, 0.98);
    }
    return clampGenerationNumber(Number(outputChars || 0) / Math.max(1, expectation.value), 0, 0.98);
  }
  function worldGenerationMetricText(info = {}) {
    const expectation = worldGenerationExpectation(info.step, info.label || info.stage);
    const attemptText = info.attempt ? `Attempt ${info.attempt}/${info.attemptsTotal || 3}` : "";
    const responseText = info.outputChars != null ? `Response ${Number(info.outputChars || 0).toLocaleString()} chars` : "";
    if (expectation.type === "values") {
      const count = info.filledValues != null ? Number(info.filledValues || 0) : Number(info.streamedValues || 0);
      return [attemptText, `${count.toLocaleString()}/${expectation.value.toLocaleString()} values`].filter(Boolean).join(" | ");
    }
    return [attemptText, responseText].filter(Boolean).join(" | ");
  }
  async function aiJsonChunk(instruction, label = "chunk", progress = {}) {
    let lastError = "";
    const step = progress.step || app.worldGenerationProgress?.step || 1;
    const total = progress.total || app.worldGenerationProgress?.total || 10;
    const stage = progress.stage || `Generating ${label}`;
    const startedAt = Date.now();
    const jobId = progress.jobId || app.worldGenerationJob?.id || "";
    let activeAttempt = 0;
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (jobId && !worldGenerationJobCanContinue(jobId)) return null;
      activeAttempt = attempt;
      try {
        const prompt = attempt === 1 ? instruction : `${instruction}\n\nPrevious attempt failed: ${lastError || "invalid JSON"}. Return a smaller valid JSON object for this same request.`;
        updateWorldGenerationStatus(stage, step, total, `${label}: starting attempt ${attempt}/3.${lastError ? ` Previous issue: ${lastError}` : ""}`, {
          status: "waiting",
          stepProgress: attempt === 1 ? 0.02 : 0.04,
          attempt,
          attemptsTotal: 3,
          promptChars: prompt.length,
          outputChars: 0,
          streamedValues: 0,
          label,
          stageStartedAt: startedAt,
          jobId
        });
        let lastStreamUpdate = 0;
        const raw = await aiText(prompt, {
          startWith: "{",
          hideStartWith: false,
          label: `${label} attempt ${attempt}`,
          onQueueStatus: queue => {
            if (jobId && !worldGenerationJobCanContinue(jobId)) return;
            if (activeAttempt !== attempt) return;
            const position = Number(queue?.position || 0);
            const waited = Number(queue?.waitedMs || 0);
            const detail = position > 0 ? `${label}: queued behind another AI call.` : `${label}: sent to Perchance. Waited ${waited.toLocaleString()}ms in queue.`;
            updateWorldGenerationStatus(stage, step, total, detail, {
              status: position > 0 ? "queued" : "sent",
              stepProgress: position > 0 ? 0.14 : 0.18,
              attempt,
              attemptsTotal: 3,
              promptChars: prompt.length,
              outputChars: 0,
              streamedValues: 0,
              label,
              stageStartedAt: startedAt,
              jobId
            });
          },
          onPluginStart: () => {
            if (jobId && !worldGenerationJobCanContinue(jobId)) return;
            if (activeAttempt !== attempt) return;
            updateWorldGenerationStatus(stage, step, total, `${label}: waiting for first streamed chunk.`, {
              status: "sent",
              stepProgress: 0.06,
              attempt,
              attemptsTotal: 3,
              promptChars: prompt.length,
              outputChars: 0,
              streamedValues: 0,
              label,
              stageStartedAt: startedAt,
              jobId
            });
          },
          onStream: streamed => {
            if (jobId && !worldGenerationJobCanContinue(jobId)) return;
            if (activeAttempt !== attempt) return;
            const now = Date.now();
            if (now - lastStreamUpdate < 250) return;
            lastStreamUpdate = now;
            const outputChars = String(streamed || "").length;
            const streamedValues = countLikelyGenerationValues(streamed);
            updateWorldGenerationStatus(stage, step, total, `${label}: receiving response.`, {
              status: "streaming",
              stepProgress: worldGenerationStepProgress({
                step,
                label,
                outputChars,
                streamedValues,
                fallback: 0.1
              }),
              attempt,
              attemptsTotal: 3,
              promptChars: prompt.length,
              outputChars,
              streamedValues,
              label,
              stageStartedAt: startedAt,
              jobId
            });
          }
        });
        if (jobId && !worldGenerationJobCanContinue(jobId)) return null;
        const rawLength = String(raw || "").length;
        const rawValues = countLikelyGenerationValues(raw);
        updateWorldGenerationStatus(stage, step, total, `${label}: response received. Parsing.`, {
          status: "parsing",
          stepProgress: Math.max(0.62, worldGenerationStepProgress({
            step,
            label,
            outputChars: rawLength,
            streamedValues: rawValues
          })),
          attempt,
          attemptsTotal: 3,
          promptChars: prompt.length,
          outputChars: rawLength,
          streamedValues: rawValues,
          label,
          stageStartedAt: startedAt,
          jobId
        });
        const parsed = parseJsonObject(raw);
        if (!parsed) throw new Error("invalid JSON");
        const filledLeaves = countFilledGenerationLeaves(parsed);
        updateWorldGenerationStatus(stage, step, total, `${label}: valid response parsed.`, {
          status: "parsed",
          stepProgress: Math.max(0.92, worldGenerationStepProgress({
            step,
            label,
            outputChars: rawLength,
            streamedValues: rawValues,
            filledValues: filledLeaves
          })),
          attempt,
          attemptsTotal: 3,
          promptChars: prompt.length,
          outputChars: rawLength,
          filledValues: filledLeaves,
          streamedValues: rawValues,
          label,
          stageStartedAt: startedAt,
          jobId
        });
        return parsed;
      } catch (err) {
        if (jobId && !worldGenerationJobCanContinue(jobId)) return null;
        lastError = err.message || String(err);
        updateWorldGenerationStatus(stage, step, total, `Repair/retry needed for ${label}. Attempt ${attempt}/3 failed: ${lastError}`, {
          status: "repair",
          stepProgress: Math.max(0.08, worldGenerationStepProgress({
            step,
            label,
            fallback: 0.08
          })),
          attempt,
          attemptsTotal: 3,
          repairAttempt: attempt,
          repairTotal: 3,
          repairsRemaining: Math.max(0, 3 - attempt),
          label,
          stageStartedAt: startedAt,
          jobId
        });
        log(`World ${label} failed`, `Attempt ${attempt}: ${lastError}`, {
          type: "state",
          level: "error"
        });
      }
    }
    updateWorldGenerationStatus(stage, step, total, `AI did not return valid ${label} JSON after 3 attempts. Continuing with fallback/defaults for this section.`, {
      status: "fallback",
      stepProgress: 1,
      attempt: 3,
      attemptsTotal: 3,
      repairAttempt: 3,
      repairTotal: 3,
      repairsRemaining: 0,
      label,
      jobId
    });
    return null;
  }
  function startWorldGenerationHeartbeat(stage = "Building world", step = 1, total = 1, detail = "", jobId = activeWorldGenerationJob()?.id || "") {
    stopWorldGenerationHeartbeat();
    app.worldGenerationStartedAt = Date.now();
    app.worldGenerationProgress = {
      stage,
      step,
      total,
      detail,
      stepProgress: 0,
      stepDetails: {},
      jobId
    };
    updateWorldGenerationStatus(stage, step, total, detail, {
      jobId
    });
    app.worldGenerationHeartbeatTimer = setInterval(() => {
      if (jobId && !worldGenerationJobCanContinue(jobId)) {
        stopWorldGenerationHeartbeat();
        return;
      }
      const progress = app.worldGenerationProgress || {
        stage,
        step,
        total,
        detail
      };
      updateWorldGenerationStatus(progress.stage, progress.step, progress.total, progress.detail, {
        heartbeat: true,
        jobId
      });
    }, 1000);
  }
  function generationProgressSummaryHtml(progress) {
    const metric = worldGenerationMetricText(progress || {});
    const expectation = worldGenerationExpectation(progress?.step, progress?.label || progress?.stage);
    const note = expectation.note ? `<div class="generation-progress-note">${escapeHtml(expectation.note)}</div>` : "";
    const repair = progress?.repairAttempt != null ? `<div class="generation-progress-note">Repair ${escapeHtml(progress.repairAttempt)}/${escapeHtml(progress.repairTotal || 3)}; ${escapeHtml(progress.repairsRemaining ?? 0)} remaining.</div>` : "";
    return metric || note || repair ? `<div class="generation-progress-metrics">${escapeHtml(metric)}${repair}${note}</div>` : "";
  }
  function generationCheckDetailHtml(info) {
    if (!info?.detail && info?.progress == null) return "";
    const metric = worldGenerationMetricText({
      ...info,
      label: info.metricLabel || info.label
    });
    const percent = Math.round(clampGenerationNumber(info.progress ?? 0, 0, 1) * 100);
    return `
                ${metric ? `<div class="generation-check-detail">${escapeHtml(metric)}</div>` : ""}
                <div class="generation-check-mini-bar">
                    <div class="generation-check-mini-fill" style="width:${percent}%"></div>
                </div>
            `;
  }
  function updateWorldGenerationStatus(stage = "Building world", step = 1, total = 1, detail = "", extras = {}) {
    const jobId = extras.jobId || app.worldGenerationProgress?.jobId || "";
    if (jobId && !worldGenerationJobIsCurrent(jobId)) return;
    const previous = app.worldGenerationProgress || {};
    const elapsed = Math.max(0, Math.floor((Date.now() - (app.worldGenerationStartedAt || Date.now())) / 1000));
    const safeTotal = Math.max(1, Number(total) || 1);
    const safeStep = Math.max(1, Math.min(safeTotal, Number(step) || 1));
    const preserveActiveMetrics = !!extras.heartbeat || previous.step === safeStep && previous.stage === stage;
    const previousStepProgress = previous.step === safeStep && previous.stepProgress != null ? previous.stepProgress : 0;
    const stepProgress = extras.stepProgress != null ? clampGenerationNumber(extras.stepProgress, 0, 1) : clampGenerationNumber(previousStepProgress, 0, 1);
    const rawTotalProgress = clampGenerationNumber((safeStep - 1 + stepProgress) / safeTotal, 0, 1);
    const previousTotalProgress = clampGenerationNumber(previous.totalProgress ?? previous.displayTotalProgress ?? 0, 0, 1);
    const totalProgress = Math.max(rawTotalProgress, previousTotalProgress);
    const percent = Math.round(totalProgress * 100);
    const stepDetails = {
      ...(previous.stepDetails || {})
    };
    for (let itemStep = 1; itemStep < safeStep; itemStep++) {
      stepDetails[itemStep] = {
        ...(stepDetails[itemStep] || {}),
        progress: 1,
        status: "done"
      };
    }
    const existingStepInfo = stepDetails[safeStep] || {};
    const previousStepInfo = preserveActiveMetrics || existingStepInfo.stage === stage ? existingStepInfo : {};
    stepDetails[safeStep] = {
      ...previousStepInfo,
      label: worldGenerationStepLabels(safeTotal)[safeStep - 1],
      metricLabel: extras.label ?? previousStepInfo.metricLabel,
      stage,
      detail,
      status: extras.status || previousStepInfo.status || "current",
      progress: stepProgress,
      attempt: extras.attempt ?? previousStepInfo.attempt,
      attemptsTotal: extras.attemptsTotal ?? previousStepInfo.attemptsTotal,
      repairAttempt: extras.repairAttempt ?? previousStepInfo.repairAttempt,
      repairTotal: extras.repairTotal ?? previousStepInfo.repairTotal,
      repairsRemaining: extras.repairsRemaining ?? previousStepInfo.repairsRemaining,
      promptChars: extras.promptChars ?? previousStepInfo.promptChars,
      outputChars: extras.outputChars ?? previousStepInfo.outputChars,
      streamedValues: extras.streamedValues ?? previousStepInfo.streamedValues,
      filledValues: extras.filledValues ?? previousStepInfo.filledValues,
      step: safeStep
    };
    app.worldGenerationProgress = {
      ...previous,
      stage,
      step: safeStep,
      total: safeTotal,
      detail,
      stepProgress,
      rawTotalProgress,
      totalProgress,
      stepDetails,
      status: extras.status || previous.status || "current",
      jobId,
      label: extras.label ?? (preserveActiveMetrics ? previous.label : undefined),
      attempt: extras.attempt ?? (preserveActiveMetrics ? previous.attempt : undefined),
      attemptsTotal: extras.attemptsTotal ?? (preserveActiveMetrics ? previous.attemptsTotal : undefined),
      repairAttempt: extras.repairAttempt ?? (preserveActiveMetrics ? previous.repairAttempt : undefined),
      repairTotal: extras.repairTotal ?? (preserveActiveMetrics ? previous.repairTotal : undefined),
      repairsRemaining: extras.repairsRemaining ?? (preserveActiveMetrics ? previous.repairsRemaining : undefined),
      promptChars: extras.promptChars ?? (preserveActiveMetrics ? previous.promptChars : undefined),
      outputChars: extras.outputChars ?? (preserveActiveMetrics ? previous.outputChars : undefined),
      streamedValues: extras.streamedValues ?? (preserveActiveMetrics ? previous.streamedValues : undefined),
      filledValues: extras.filledValues ?? (preserveActiveMetrics ? previous.filledValues : undefined)
    };
    const message = `${stage}. This may take a few minutes. Still working (${elapsed}s)`;
    const el = $("worldGenerationStatus");
    if (el) {
      const checklist = worldGenerationStepLabels(safeTotal).map((label, index) => {
        const itemStep = index + 1;
        const info = stepDetails[itemStep] || {};
        const status = itemStep < safeStep ? "done" : itemStep === safeStep ? "current" : "pending";
        const icon = status === "done" ? "&#10003;" : status === "current" ? "&#9679;" : "&#9675;";
        return `
                            <div class="generation-check ${status}">
                                <span>${icon}</span>
                                <span class="generation-check-text">
                                    <span class="generation-check-label">${escapeHtml(label)}</span>
                                    ${generationCheckDetailHtml({
          ...info,
          progress: status === "done" ? 1 : status === "current" ? stepProgress : info.progress || 0
        })}
                                </span>
                            </div>
                        `;
      }).join("");
      el.style.display = "block";
      el.innerHTML = `
                    <div class="generation-progress">
                        <div class="generation-progress-title"><span style="color:var(--gold)">&#9679;</span> ${escapeHtml(stage)}<span class="dots"></span></div>
                        <div class="generation-progress-bar">
                            <div class="generation-progress-fill" style="width:${percent}%"></div>
                        </div>
                        <div class="generation-progress-meta">Step ${safeStep} of ${safeTotal} / ${percent}% total / ${elapsed}s elapsed</div>
                        ${detail ? `<div class="generation-progress-detail">${safeStep === 2 ? "" : escapeHtml(detail)}${generationProgressSummaryHtml(app.worldGenerationProgress)}</div>` : ""}
                        <div class="generation-checklist">${checklist}</div>
                    </div>
                `;
    }
    setStatus(message);
  }
  function stopWorldGenerationHeartbeat() {
    if (!app.worldGenerationHeartbeatTimer) return;
    clearInterval(app.worldGenerationHeartbeatTimer);
    app.worldGenerationHeartbeatTimer = null;
  }
  async function buildWorldChunk(prompt) {
    const playerName = playerNameForPrompt();
    const openingPrompt = `OPENING BUILD RULES:
- If this setup uses an existing story, build the current location, current scene, immediate objective, and opening character states from the very beginning of that story.
- Do not start after later canon powerups, relationships, reveals, villains, party members, endings, or time skips.
- Future story events belong in future objectives only, not in the opening scene.
- Follow player modifications only when they do not contradict the instruction to begin at the story start.

PREMISE AND ONBOARDING:
${prompt}`;
    const objectiveGenerationPrompt = `Output ONLY JSON for objectives with keys active_id, items, and optional reward_bundles, reward_templates, and numeric_precision.

Each objective item must use the guided objective contract:
- id, title, type ("story" or "side"), status, summary, completion_control, and output data.
- title names one actionable objective. summary is player-facing context or a hint. while_active_guidance is required non-empty hidden AI-only guidance for every objective, including deterministic requirement-check-only nodes.
- completion_control is "player" or "ai". A Player Choice uses completion_control="choice", choices, and choice_response_mode="optional_text" or "exact_dialogue". Exact Dialogue requires player_text on every choice.
- A normal objective has one simple completion_criteria. Do not combine requirements with lists or "and". Split multiple beats into sequential objectives, an open-ended scene with one player-controlled exit, or a branch.
- completion_requirements are structured state requirements that must be met before the visible objective can complete.
- AI Auto Complete is completion_control="ai" plus evaluate_ai_on_activation=true. Requirement Check Only is completion_control="reward_only" plus requirement_check_only=true; it has no completion_criteria and makes no AI call.

Outputs are stored in exactly one collection:
- Normal Player/AI objectives use next_objectives.
- Player Choice objectives use choices.
- AI objectives with multiple hidden outcome routes use route_control="ai" and outcome_routes.
- Every output has a stable id, requirements, rewards, completion_instruction, dialogue_lines, travel_location_id, a destination objective id, and target_input_group_id where applicable.
- Omit disabled optional fields instead of writing placeholder values.
- Ordered deterministic outputs are priority order. The first eligible output is used. Put one explicit fallback:true output last when fallback behavior is required.
- requirements on player-visible choices remain visible; outcome-route requirements and criteria are private AI routing information.
- dialogue_lines contain exact authored speaker-tagged lines. completion_instruction is ordinary completion-story guidance and remains separate.
- A normal output links to one next objective. An ending output omits the next objective and sets ending_type to exactly "freeplay", "ending", or "game_over". Ending data belongs to that output, never to the objective itself.
- Incoming transitions assigned to one target_input_group_id require every distinct source objective (AND). Multiple accepted outputs from the same source objective are alternatives (OR). Different input-group IDs are also OR alternatives. Do not duplicate these graph links in requires.

Include exactly one opening active main objective. Other nodes start hidden. Use type="side" only for meaningful optional objectives. Do not write runtime status fields beyond the authored starting status, objective steps, old planning helpers, or mutable objective-progress data.

Use rewards for deterministic state changes. Use reward_bundles for fixed repeated reward groups and apply_reward_bundle to invoke them. Use typed reward_templates only for parameterized repeated behavior, with declared character_id/path parameters, exact {"parameter":"name"} placeholders, and apply_reward_template calls. Never duplicate a reusable reward group inline.

Allowed reward types include introduce_future_character, remove_character_shop_listing, unlock_location, add_item, add_story_item, adjust_story_inventory, complete_generated_job, start_objective, add_story_rule, remove_story_rule, set_state_field, modify_integer, modify_number, adjust_relationship, grant_outfit, equip_outfit, delete_outfit, delete_all_outfits, add_state_list_item, remove_state_list_item, kill_character, generate_profile_image, generate_solo_normal_image, generate_story_image, apply_reward_bundle, and apply_reward_template. Do not invent reward types.

grant_outfit targets a stable character_id and may use one universal outfit or male_outfit/non_male_outfit. An equipped grant, or a grant paired with equip_outfit on the same output, requires both gender presentations. modify_integer uses safe integer math. modify_number may use literal/reference operands or value_expression, with only the final assignment rounded by numeric_precision.

Setup:
${progressionPrompt}`;
    const whole = await aiJsonChunk(`Create ONLY a small JSON object with optional keys: location, scene, world_map, world_flags. No markdown. ${familyFriendlyContentInstruction()} Tailor it to the opening setup below.
If you include scene.party_members_present, include only known non-player characters physically present; never include Player, "${playerName}", protagonist, hero, unknown placeholders, or role labels.
If you include scene.image_characters, use ["Player"] by default for the opening solo player image, even when NPCs or party members are present. Include other names only when a group opening image is deliberately needed.
Do not include scene.objective, scene.immediate_objective, immediate_goals, future_hooks, or other old planning helpers. The objective system is the only story planner.
If you include world_map, create a compact clickable map with current_location_id and locations. Include the opening location plus 3 to 8 nearby or parent locations that make sense for the universe. Location nodes need id, name, type, scale, parent_id, x, y, discovered, travel_enabled, summary, detail, connections.\n${openingPrompt}`, "world chunk", {
      stage: "Building world and map",
      step: 2,
      total: 10
    });
    if (whole) return whole;
    const chunk = {};
    chunk.location = (await aiJsonChunk(`Output ONLY JSON for an RPG location object with keys universe, world, continent, region, settlement_type, settlement_name, district, specific_place. Use the opening location for existing stories. Setup:\n${openingPrompt}`, "location", {
      stage: "Building fallback location",
      step: 2,
      total: 10
    })) || undefined;
    chunk.scene = (await aiJsonChunk(`Output ONLY JSON for an opening scene object with keys summary, party_members_present, image_characters, npcs_present, image_action. The selected opening goal belongs in objectives, not scene. party_members_present are known non-player characters physically present and may be empty. Never include "${playerName}", Player, protagonist, hero, unknown placeholders, or role labels in party_members_present. image_characters should normally be ["Player"] for the opening solo player image, even when NPCs or party members are present; include other names only when a group opening image is deliberately needed. image_action must be one short visual phrase, 2 to 8 words, no commas, no full sentence. The scene must be the first playable moment of an existing story. Setup:\n${openingPrompt}`, "scene", {
      stage: "Building fallback scene",
      step: 2,
      total: 10
    })) || undefined;
    chunk.world_flags = (await aiJsonChunk(`Output ONLY JSON for world_flags with keys magic_level, tone, premise. Setup:\n${openingPrompt}`, "world flags", {
      stage: "Building fallback world flags",
      step: 2,
      total: 10
    })) || undefined;
    chunk.world_map = (await aiJsonChunk(`Output ONLY JSON for world_map with keys current_location_id, focus_location_id, travel_history, locations. Build a clickable map for the opening area and its parent areas. The map must work for any universe: planets, regions, towns, buildings, rooms, ships, schools, dungeons, or virtual zones. Each locations entry needs id, name, type, scale, parent_id, x, y, discovered, travel_enabled, summary, detail, connections. Setup:\n${openingPrompt}`, "world map", {
      stage: "Building fallback world map",
      step: 2,
      total: 10
    })) || undefined;
    return chunk;
  }
  function normalizedCastNotes(castNotes) {
    return String(castNotes || "").trim();
  }
  function startingCastPolicyIsSolo(draft = app.onboardingDraft || {}) {
    return draft?.starting_cast_policy === "solo";
  }
  function forceSoloOpeningState(state, reason = "The hero begins alone.", options = {}) {
    state.characters = {};
    state.scene ||= {};
    state.meta ||= {};
    state.meta.starting_cast_policy = "solo";
    if (options.preserveSceneNpcs) {
      state.scene.party_members_present = [...new Set(state.scene.party_members_present || ["Player"])];
      if (!state.scene.party_members_present.length) state.scene.party_members_present = ["Player"];
      state.scene.image_characters = [...new Set(state.scene.image_characters || state.scene.party_members_present || ["Player"])];
      replaceSceneNpcPresence(state, [...new Set(state.scene.npcs_present || [])].filter(name => name && name !== "Player"), "solo opening setup");
    } else {
      state.scene.party_members_present = ["Player"];
      state.scene.image_characters = ["Player"];
      replaceSceneNpcPresence(state, [], "solo opening setup");
    }
    state.scene.current_speaker = "";
    if (!options.preserveSceneNpcs) state.scene.image_focus = "Player";
    return state;
  }
  async function buildCastChunk(prompt) {
    const castNotes = normalizedCastNotes(app.onboardingDraft?.cast_notes);
    const existingStoryCastRule = app.onboardingDraft?.story_title ? `EXISTING STORY CAST RULES:
- The game starts at the canon beginning.
- Starting Cast notes may include later cast suggestions; do not make a later character present at the opening unless the user explicitly asks for that change.
- Only include characters who should plausibly be present, nearby, or immediately relevant at the beginning.
- If the protagonist begins alone in the source story or the user asked to begin alone, return {"characters":[]} exactly.` : "";
    const playerNames = playerDuplicateNames({
      player: app.onboardingDraft?.player || app.state.player
    });
    if (startingCastPolicyIsSolo()) {
      updateWorldGenerationStatus("Building cast", 3, 10, castNotes ? "Starting cast skipped because notes request solo/no party." : "Starting cast skipped because Starting Cast is blank.");
      log("Starting cast skipped", castNotes ? "The Starting Cast notes asked for the main character to begin alone." : "The Starting Cast notes were blank.", {
        type: "state",
        level: "message"
      });
      return {
        characters: [],
        scene: {
          party_members_present: ["Player"],
          image_characters: ["Player"],
          npcs_present: []
        },
        recent_changes: []
      };
    }
    const castPlan = await aiJsonChunk(`Create ONLY JSON like:
{
  "characters": [
    {
      "name": "",
      "description": ""
    }
  ]
}
This is only a cast planning pass. Do not create full character stats yet.
Use the player's Starting Cast notes as the highest priority.
If the notes ask for none, no companions, no party, or the main character to be alone, return this exactly:
{
  "characters": []
}
If the notes name specific characters or types, include only those requested or clearly implied.
Every character must be distinct. Do not include both a first-name-only version and a full-name version of the same person.
Do not include the player as a character.
${existingStoryCastRule}

PREMISE AND ONBOARDING:
${prompt}

STARTING CAST NOTES:
${castNotes || "(blank)"}`, "cast plan", {
      stage: "Building cast plan",
      step: 3,
      total: 10
    });
    const seeds = uniqueGeneratedCharacters((castPlan?.characters || []).filter(isPlainObject).map(item => ({
      name: textSlot(item.name, ""),
      description: textSlot(item.description, "")
    })).filter(item => item.name), playerNames).slice(0, 5);
    if (!seeds.length) {
      return {
        characters: [],
        scene: {
          party_members_present: ["Player"],
          image_characters: ["Player"],
          npcs_present: []
        }
      };
    }
    const characters = [];
    const seenNames = [...playerNames];
    for (const [index, seed] of seeds.entries()) {
      updateWorldGenerationStatus("Building cast", 3, 10, `Generating character detail ${index + 1}/${seeds.length}: ${seed.name}.`);
      const full = await aiJsonChunk(`Create ONE unique adult character for EmberAdventures.
Output ONLY JSON in this exact shape:
{
  "name": "",
  "gender": "female",
  "age": 0,
  "role": "",
  "relationship_to_player": "",
  "personality_description": "",
  "speech_style": "",
  "boldness": 5,
  "appearance": "",
  "appearance_stats": {
    "height": 10,
    "body_description": "",

    "extra_description_lower_body": "",
    "nonhuman_lower_body": false
  },
  "outfit": "",
  "hook": ""
}
Rules:
- Use this planned character: ${prettyJson(seed)}
- Replace the example age 0 with one specific adult age, 18 or older, that fits this character. Across a generated cast, vary ages by role, maturity, species, and story position instead of clustering everyone at one default age.
- Do not copy names, outfits, jobs, horns, tails, species, clothing, or appearance from sample characters unless the plan explicitly asks for them.
- appearance_stats.height accepts a whole number from 0 to 20 or a custom height description. appearance_stats.body_description is text describing overall build and proportions.
- appearance_stats.extra_description_lower_body is only for concrete durable details below the humanoid waist. Set appearance_stats.nonhuman_lower_body to true only when the character replaces normal humanoid hips/legs with a distinct nonhuman lower body. When true, write the complete replacement body there and do not repeat the overall body description.
- ${generatedBodyDescriptionRuleText("appearance_stats.body_description")}
- Give them a distinct first name and last name unless the source story canonically uses only one name.
- Do not create the player as a character.
- personality_description is durable identity and behavior style, not current mood. Write 1 to 3 concise sentences.
- speech_style is durable dialogue guidance. Write 1 concise sentence about how this character usually speaks.
- boldness may be an integer from 1 to 10 or a clear descriptive phrase matching this character's personality_description. Numeric values outside 1 to 10 are invalid. Numeric 1 is very reserved. Numeric 10 uses maximum social initiative while respecting refusals and personal boundaries.
${existingStoryCastRule}

PREMISE AND ONBOARDING:
${prompt}

STARTING CAST NOTES:
${castNotes || "(blank)"}`, `character detail ${seed.name}`, {
        stage: `Generating character ${index + 1}/${seeds.length}`,
        step: 3,
        total: 10
      });
      const item = full?.name ? full : {
        ...seed,
        ...full
      };
      const extracted = extractWorldCharacterSeed(item);
      if (!extracted) continue;
      const duplicate = findDuplicateCharacterName(extracted.name, seenNames);
      if (duplicate) {
        log("Duplicate character rejected", `${extracted.name} looks too similar to ${duplicate}.`, {
          type: "state",
          level: "message"
        });
        continue;
      }
      seenNames.push(extracted.name);
      const generatedCharacter = {
        ...extracted,
        appearance_stats: repairAiGeneratedAppearanceStats(item.appearance_stats)
      };

      characters.push(generatedCharacter);
    }
    if (!characters.length) {
      return {
        characters: [],
        scene: {
          party_members_present: ["Player"],
          image_characters: ["Player"],
          npcs_present: []
        }
      };
    }
    return {
      characters
    };
  }
  async function buildProgressionChunk(prompt) {
    const progressionPrompt = `PLAYER AND OBJECTIVE BUILD RULES:
- If this setup uses an existing story, the game starts at the canon beginning.
- objectives must contain the earliest playable objective. Do not use old planning helpers.
- Objectives are the only story planner. Do not include old planning systems.
- Before drafting objectives, decide whether this premise should be a Telltale-style branching story with direct choices and multiple endings, or a simpler linear/mostly-linear story.
- Use Telltale-style branching when the premise focuses on moral choices, romance gates, faction paths, survival/death branches, mutually exclusive endings, player-defined laws, bargains, or permanent relationship consequences.
- Use a simpler linear/mostly-linear chain when the premise is mainly a guided adventure, source retelling, slice-of-life loop, sandbox opener, or relationship story where forced branches would feel fake.
- Future events should be marked as future, hidden, scheduled, or locked unless they are the opening milestone.
- Follow the source story as closely as player modifications allow.
- Do not make later canon already happened in the starting state.
- Hidden AI-adjudicated branching may use route_control="ai" and outcome_routes on a completed objective. Each outcome route has id, criteria, optional hard eligibility requirements, optional rewards, and either next_objective_id plus target_input_group_id or ending_type set to exactly "freeplay", "ending", or "game_over". An ending route omits next_objective_id and target_input_group_id. Include exactly one no-requirements fallback route. Only eligible routes are shown to the verifier; use criteria for softer behavior judgments. Use hidden outcome routing for consequences the player should discover through play, not for a visible decision that belongs in choices. Do not combine outcome_routes with next_objectives on the same objective.

PREMISE AND ONBOARDING:
${prompt}`;
    // The previous all-in-one player/objectives chunk asked for player,
    // objectives, future cast, and story memory in one
    // response. It repeatedly produced oversized/incomplete JSON and
    // leaked old planning helpers. Keep generation split into small
    // focused chunks so failures stay local and objectives remain the
    // only story planner.
    const chunk = {};
    chunk.player = (await aiJsonChunk(`Output ONLY JSON for player-definition fields: role, personality_description, speech_style, starting_inventory, starting_known_facts.
personality_description is durable identity, not current mood.
speech_style is durable dialogue guidance, not voice metadata.
Use the player's beginning-of-story role and starter state.
Keep starting_inventory to 0-6 concrete starting items and starting_known_facts to 0-8 beginning facts. Do not output runtime inventory or known_facts fields in a reusable story definition.
Setup:\n${progressionPrompt}`, "player setup", {
      stage: "Building fallback player setup",
      step: 4,
      total: 10
    })) || undefined;
    chunk.objectives = (await aiJsonChunk(objectiveGenerationPrompt, "objectives", {
      stage: "Building fallback objectives",
      step: 4,
      total: 10
    })) || undefined;
    // New game files should start with no runtime recent_changes. The
    // opening narration is already baked into the starting state and must
    // not be treated as a state-update delta.
    chunk.recent_changes = [];
    return chunk;
  }
  function buildWorldScaffold(prompt) {
    const state = clone(defaultState);
    state.meta.setup_complete = true;
    state.meta.genres = ["game"];
    state.meta.story_source ||= clone(defaultState.meta.story_source);
    state.location = {
      universe: "",
      world: "",
      continent: "",
      region: "",
      settlement_type: "",
      settlement_name: "",
      district: "",
      specific_place: ""
    };
    state.world_map = {
      current_location_id: "",
      focus_location_id: "",
      travel_history: [],
      locations: {}
    };
    state.time = {
      year: 1,
      month: 1,
      day: 1,
      hour: 9,
      minute: 0
    };
    state.player = {
      ...clone(defaultState.player),
      name: "Player",
      age: fallbackAdultAgeForContext(prompt, "world scaffold player"),
      gender: "",
      role: "new protagonist",
      personality_description: "A grounded, adaptable protagonist whose personality is defined by player choices.",
      voice: "Narrator",
      inventory: [],
      known_facts: []
    };
    state.scene = {
      summary: worldScaffoldSceneSummary(prompt),
      party_members_present: ["Player"],
      image_characters: ["Player"],
      npcs_present: [],
      image_action: ""
    };
    state.world_flags = {
      magic_level: "",
      tone: "Family-friendly story-driven adventure",
      premise: prompt
    };
    state.progression = {};
    state.objectives = {
      active_id: "opening-objective",
      focus_id: "",
      items: [{
        id: "opening-objective",
        title: "Opening Objective",
        type: "story",
        status: "active",
        summary: "Choose what to do first.",
        notes: [],
        rewards: [],
        travel_location_id: "",
        travel_location_name: ""
      }]
    };
    state.characters = {};
    state.npc_directory = {
      locations: {}
    };
    state.future_cast = {
      enabled: true,
      items: {}
    };
    state.story_rules = [];
    state.story_memory = clone(defaultState.story_memory);
    state.recent_changes = [];
    return reconcileStoryRuntimeState(state, "world scaffold");
  }
  function worldScaffoldSceneSummary(prompt = "") {
    const draft = app.onboardingDraft || {};
    const sourceTitle = String(draft.story_title || "").trim();
    const description = String(draft.story_description || "").trim();
    if (description) return description;
    if (sourceTitle) return `${sourceTitle} begins at its first playable moment.`;
    return "A new fantasy RPG adventure begins.";
  }
  function blankAppearanceTemplate() {
    return {
      species: "human",
      height: 10,
      body_description: "",

      skin_color: "",
      eye_color: "",
      hair_color: "",
      hair_length: "",
      hair_type: "",
      extra_description: "",
      extra_description_lower_body: "",
      nonhuman_lower_body: false
    };
  }
  function blankClothingTemplate() {
    return {
      hat: null,
      hair_accessory: null,
      face: null,
      ears: null,
      neck: null,
      shoulders: null,
      bra: null,
      undershirt: null,
      shirt: null,
      over_shirt: null,
      coat: null,
      back: null,
      hands: null,
      right_wrist: null,
      left_wrist: null,
      right_fingers: null,
      left_fingers: null,
      waist: null,
      belt_accessory: null,
      underwear: null,
      pants: null,
      skirt: null,
      legwear: null,
      socks: null,
      feet: null,
      other_accessory: null
    };
  }
  function blankCharacterTemplate(name = "") {
    const characterName = textSlot(name, "Character");
    return {
      version: 1,
      source: null,
      creator: null,
      creation_tool: null,
      can_die: false,
      romanceable: true,
      genres: [],
      gender: "unspecified",
      age: fallbackAdultAgeForContext(name, "blank character"),
      role: "adult character",
      voice: "",
      personality_description: name ? `${name} is a distinct adult character whose deeper personality should remain consistent across scenes.` : "A distinct adult character whose deeper personality should remain consistent across scenes.",
      speech_style: "",
      relationship_to_player: "unknown",
      trust: 0,
      attraction: 0,
      affection: 0,
      boldness: rollCharacterBoldness(),
      state_of_mind: "neutral",
      physical_state: "normal",
      pose: "standing",
      appearance: blankAppearanceTemplate(),
      outfits: [{
        id: "default",
        name: "Default Outfit",
        clothing: {
          shirt: "plain shirt",
          pants: "plain trousers",
          feet: "plain shoes"
        }
      }],
      active_outfit_id: "default",
      fallback_name: `${characterName} Alternate`,
      fallback_outfits: [{
        id: "fallback-default",
        name: "Alternate Default Outfit",
        clothing: {
          shirt: "plain alternate shirt",
          pants: "plain alternate trousers",
          feet: "plain alternate shoes"
        }
      }],
      fallback_starting_outfit_id: "fallback-default",
      held_items: {
        right_hand: null,
        left_hand: null
      },
      inventory: [],
      known_facts: name ? [`${name} is an adult character.`] : [],
      default_seed: 0,
      image: {
        seed_enabled: true,
        seed: Math.floor(Math.random() * 999999999),
        style: "high detail fantasy RPG character art, cinematic lighting, tasteful composition",
        profile_style: "",
        negative: ""
      },
      image_prompt_config: {
        seed_enabled: true,
        seed: 0,
        style: "high detail fantasy RPG character art, cinematic lighting, tasteful composition",
        profile_style: "",
        negative: "",
        negative_prompt: ""
      },
      default_profile_image: emptyProfileImageSlot(false),
      profile_image_presentations: {
        male: emptyProfileImageSlot(true),
        non_male: emptyProfileImageSlot(false)
      },
      profile_images: [],
      profile_image_id: "",
      images: []
    };
  }
  function materializeCharacterVoiceForRuntime(value) {
    if (!isPlainObject(value)) return value;
    // Immutable definitions store voice guidance separately from the
    // runtime Microsoft voice. Only an exact preferred voice name may
    // become runtime `voice`; gender_bucket is used by normal voice
    // selection and should not be shown as a literal voice name.
    return textSlot(value.preferred_voice_name, "");
  }
  function profileImageSlotFromExactInput(value) {
    if (!isPlainObject(value)) throw new Error("Profile image slot must be an object.");
    const fields = ["url", "local_image_id", "source", "seed", "prompt", "negative_prompt", "note", "male"];
    const errors = [...exactObjectFieldValidationErrors(value, fields, "profile image slot"), ...requiredExactFieldsValidationErrors(value, fields.filter(field => true), "profile image slot")];
    if (errors.length) throw new Error(validationErrorsText(validationResult(errors)));
    return clone(value);
  }
  function emptyProfileImageSlot(male) {
    return {
      url: "",
      local_image_id: "",
      source: "none",
      seed: null,
      prompt: "",
      negative_prompt: "",
      note: "",
      male
    };
  }
  function imagePromptConfigFromExactInput(value) {
    if (!isPlainObject(value)) throw new Error("image_prompt_config must be an object.");
    return clone(value);
  }
  function repairAiImagePromptConfig(value, defaultSeed = 0) {
    const image = isPlainObject(value) ? {
      ...value
    } : {};
    image.seed_enabled = image.seed_enabled !== false;
    image.seed = repairAiProfileImageSeed(image.seed, repairAiProfileImageSeed(defaultSeed, 0));
    image.style = textSlot(image.style, "");
    image.profile_style = textSlot(image.profile_style, "");
    image.negative = textSlot(image.negative, "");
    image.negative_prompt = textSlot(image.negative_prompt, "");
    return image;
  }
  function materializeCharacterDefinitionForRuntimeFields(character, fallbackName = "", options = {}) {
    const input = clone(character || {});
    if (!isPlainObject(input)) return input;
    // Definition-to-runtime boundary: immutable character definitions
    // use starting_* and default_* fields. Runtime systems still use
    // current relationship, clothing, inventory, image, and voice slots.
    if (input.voice && isPlainObject(input.voice)) input.voice = materializeCharacterVoiceForRuntime(input.voice);
    if (!Object.hasOwn(input, "relationship_to_player")) input.relationship_to_player = input.starting_relationship_to_player;
    for (const [runtimeKey, definitionKey] of [["trust", "starting_trust"], ["attraction", "starting_attraction"], ["affection", "starting_affection"], ["state_of_mind", "starting_state_of_mind"], ["physical_state", "starting_physical_state"], ["pose", "starting_pose"]]) {
      if (!Object.hasOwn(input, runtimeKey)) input[runtimeKey] = input[definitionKey];
    }
    const inventorySource = options.preferStartingInventory === true || !Object.hasOwn(input, "inventory") ? input.starting_inventory : input.inventory;
    input.inventory = repairAiInventoryList(Array.isArray(inventorySource) ? inventorySource : []);
    if (!Object.hasOwn(input, "known_facts")) input.known_facts = input.starting_known_facts;
    {}
    if (!Object.hasOwn(input, "held_items")) input.held_items = input.starting_held_items;
    if (!Object.hasOwn(input, "active_outfit_id") && input.starting_outfit_id) input.active_outfit_id = textSlot(input.starting_outfit_id, "");
    if (!isPlainObject(input.clothing) && Array.isArray(input.outfits)) {
      const startingOutfitId = Object.hasOwn(input, "active_outfit_id") ? input.active_outfit_id : input.starting_outfit_id;
      const startingOutfit = input.outfits.find(outfit => outfit?.id === startingOutfitId);
      if (!isPlainObject(startingOutfit?.clothing)) throw new Error(`Character starting outfit ${startingOutfitId} does not exist.`);
      input.clothing = clone(startingOutfit.clothing);
    }
    if (!Object.hasOwn(input, "image")) input.image = imagePromptConfigFromExactInput(input.image_prompt_config);
    if (input.default_profile_image != null) input.default_profile_image = profileImageSlotFromExactInput(input.default_profile_image);
    for (const definitionField of ["starting_relationship_to_player", "starting_trust", "starting_attraction", "starting_affection", "starting_state_of_mind", "starting_physical_state", "starting_pose", "starting_inventory", "starting_known_facts", "starting_held_items", "starting_outfit_id", "chat_story", "chat_opening_message", "chat_starting_location", "chat_story_template", "catalog_hook"]) delete input[definitionField];
    return input;
  }
  function isAnimalEntity(entity = {}) {
    return entity?.definition_type === "animal" || Object.hasOwn(entity || {}, "physical_description") && !Object.hasOwn(entity || {}, "appearance");
  }
  function materializeAnimalDefinitionForRuntimeFields(animal = {}, fallbackName = "") {
    const input = clone(animal || {});
    if (!isPlainObject(input)) return input;
    input.definition_type = "animal";
    input.name = textSlot(input.name, fallbackName);
    input.speech_style = textSlot(input.communication_style, "");
    input.relationship_to_player = textSlot(input.starting_relationship_to_player, "unknown");
    input.trust = input.starting_trust;
    input.affection = input.starting_affection;
    input.attraction = 0;
    input.romanceable = false;
    input.state_of_mind = input.starting_state_of_mind;
    input.physical_state = input.starting_physical_state;
    input.pose = input.starting_pose;
    input.known_facts = clone(input.starting_known_facts);
    input.voice = materializeCharacterVoiceForRuntime(input.voice ?? null);
    input.image = isPlainObject(input.image_prompt_config) ? imagePromptConfigFromExactInput(input.image_prompt_config) : {
      seed_enabled: true,
      seed: Number(stableStringHash(`animal-image:${input.id || input.name}`)),
      style: "",
      profile_style: "",
      negative: "",
      negative_prompt: ""
    };
    if (input.default_profile_image != null) input.default_profile_image = profileImageSlotFromExactInput(input.default_profile_image);
    for (const field of ["starting_relationship_to_player", "starting_trust", "starting_affection", "starting_state_of_mind", "starting_physical_state", "starting_pose", "starting_known_facts", "inventory", "outfits", "active_outfit_id", "clothing", "held_items"]) delete input[field];
    return input;
  }
  function characterDefinitionRuntimeClothingError(character = {}, path = "character") {
    if (!isPlainObject(character) || !Object.hasOwn(character, "clothing")) return null;
    return validationError(`${path}.clothing`, "runtime-only", "clothing is runtime-only. Character definitions must use outfits and starting_outfit_id.");
  }
  function selectedCharacterDefinitionOutfit(character = {}, fallbackName = "") {
    const name = textSlot(character?.name, fallbackName || "Character");
    const outfits = Array.isArray(character?.outfits) ? character.outfits : [];
    const outfitId = textSlot(character?.starting_outfit_id || character?.active_outfit_id, "");
    if (!outfitId) throw new Error(`${name} requires starting_outfit_id before becoming a runtime character.`);
    let outfit = outfits.find(item => item?.id === outfitId);
    if (!isPlainObject(outfit)) throw new Error(`${name} starting outfit "${outfitId}" does not exist.`);

    if (!isPlainObject(outfit.clothing)) throw new Error(`${name} starting outfit "${outfitId}" requires clothing slots.`);
    return outfit;
  }
  function materializeCharacterDefinitionForRuntime(character = {}, fallbackName = "", options = {}) {
    const source = clone(character || {});
    if (!isPlainObject(source)) return source;
    const clothingError = characterDefinitionRuntimeClothingError(source, fallbackName || source.name || "character");
    if (clothingError) throw new Error(clothingError.message);
    const selectedOutfit = selectedCharacterDefinitionOutfit(source, fallbackName);
    const runtime = materializeCharacterDefinitionForRuntimeFields(source, fallbackName, options);
    runtime.active_outfit_id = textSlot(selectedOutfit.id, "");
    runtime.clothing = exactClothingSlots(clone(selectedOutfit.clothing));
    return runtime;
  }
  function materializeStoryDefinitionCharactersForRuntime(state = {}) {
    if (!isPlainObject(state)) return state;
    if (isPlainObject(state.player)) state.player = materializeCharacterDefinitionForRuntime(state.player, state.player.name || "Player");
    for (const [name, character] of Object.entries(state.characters || {})) {
      if (!isPlainObject(character)) continue;
      state.characters[name] = isAnimalEntity(character) ? materializeAnimalDefinitionForRuntimeFields(character, name) : materializeCharacterDefinitionForRuntime(character, name);
    }
    for (const location of Object.values(state.npc_directory?.locations || {})) {
      for (const collectionName of ["characters", "npcs"]) {
        for (const [name, npc] of Object.entries(location?.[collectionName] || {})) {
          if (isPlainObject(npc?.full_character)) {
            npc.full_character = materializeCharacterDefinitionForRuntime(npc.full_character, npc.name || name);
          } else if (isPlainObject(npc?.animal_definition)) {
            npc.animal_definition = materializeAnimalDefinitionForRuntimeFields(npc.animal_definition, npc.name || name);
          } else if (looksLikeCharacterObject(npc)) {
            location[collectionName][name] = materializeCharacterDefinitionForRuntime(npc, npc.name || name);
          }
        }
      }
    }
    return state;
  }
  function projectCharacterDefinitionFields(character) {
    if (!isPlainObject(character)) return character;
    const projected = {};
    for (const field of CHARACTER_DEFINITION_FIELDS) {
      if (Object.hasOwn(character, field) && character[field] !== undefined) projected[field] = clone(character[field]);
    }
    return projected;
  }
  function addImmutableDefinitionFields(character) {
    if (!isPlainObject(character)) return character;
    return clone(character);
  }
  function removeRuntimeClothingFromCharacterDefinition(character = {}) {
    if (!isPlainObject(character)) return character;
    // Definitions describe saved outfits. The current clothing slots are
    // materialized only on the live runtime entity.
    delete character.clothing;
    return character;
  }
  function addImmutableDefinitionFieldsToState(state) {
    if (!isPlainObject(state)) return state;
    const prepareDefinition = (character, fallbackName, options = {}) => {
      let definition = standaloneCharacterStoryProjection(character);
      if (!validateCharacterDefinition(definition, "story embedded character", {
        embedded: true
      }).ok) {
        try {
          definition = runtimeCharacterDefinitionRecord(textSlot(character?.name, fallbackName), character, null, options).character;
        } catch (err) {
          throw new Error(`${fallbackName} could not be projected to a story-embedded character definition: ${err?.message || err}`);
        }
      }
      definition = standaloneCharacterStoryProjection(definition);
      removeRuntimeClothingFromCharacterDefinition(definition);
      const validation = validateCharacterDefinition(definition, "story embedded character", {
        embedded: true
      });
      if (!validation.ok) throw new Error(`${fallbackName} is not a valid story-embedded character definition:\n${validationErrorsText(validation)}`);
      return definition;
    };
    if (isPlainObject(state.player)) state.player = prepareDefinition(state.player, "Player", {
      player: true
    });
    if (Array.isArray(state.players)) {
      // Optional story-template character select: these are reusable
      // player definitions, not live runtime state. Starting a game
      // must choose one and copy it into state.player.
      state.players = state.players.filter(isPlainObject).map((player, index) => prepareDefinition(player, player.name || `Player ${index + 1}`, {
        player: true
      }));
    }
    for (const [name, character] of Object.entries(state.characters || {})) {
      if (isPlainObject(character)) state.characters[name] = prepareDefinition(character, name);
    }
    for (const location of Object.values(state.npc_directory?.locations || {})) {
      for (const [name, npc] of Object.entries(location?.characters || {})) {
        if (isPlainObject(npc?.full_character)) npc.full_character = prepareDefinition(npc.full_character, npc.name || name);
      }
    }
    for (const [id, entry] of Object.entries(state.future_cast?.items || {})) {
      if (isPlainObject(entry?.full_character)) entry.full_character = prepareDefinition(entry.full_character, entry.name || id);
    }
    return state;
  }
  function makeWorldCharacter(name, age, gender, role, relationship, mind, speechStyle, outfit, fact) {
    const base = blankCharacterTemplate(name);
    base.gender = canonicalCharacterGenderValue(gender);
    base.age = age;
    base.role = role;
    base.personality_description = mind || base.personality_description;
    base.speech_style = textSlot(speechStyle, "");
    base.relationship_to_player = relationship;
    base.trust = 2;
    base.attraction = 1.5;
    base.affection = 1;
    base.boldness = rollCharacterBoldness();
    base.state_of_mind = "neutral";
    base.physical_state = "healthy";
    base.pose = "watching the hero carefully";
    base.clothing = {
      ...base.clothing,
      shirt: outfit,
      pants: null,
      underwear: null,
      bra: null,
      feet: "travel boots"
    };
    base.held_items = {
      right_hand: null,
      left_hand: null
    };
    base.inventory = [];
    base.known_facts = [fact];
    base.image = {
      seed_enabled: true,
      seed: Math.floor(Math.random() * 999999999),
      style: "high detail isekai fantasy RPG character art, cinematic lighting, tasteful composition",
      negative: ""
    };
    base.default_seed = 0;
    base.image_prompt_config = {
      seed_enabled: true,
      seed: 0,
      style: base.image.style,
      negative: base.image.negative,
      negative_prompt: ""
    };
    applyStoryDefaultImageModelToCharacter(base, app.state, {
      force: true
    });
    base.default_profile_image = emptyProfileImageSlot(false);
    return addImmutableDefinitionFields(base, name);
  }
  function textSlot(value, fallback = "") {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return fallback;
  }
  function humanizeIdentifierLabel(value, fallback = "") {
    const text = textSlot(value, fallback).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    return text.replace(/\b[a-z]/g, letter => letter.toUpperCase());
  }
  function entityMetadataSlot(value) {
    const clean = textSlot(value, "");
    return clean || null;
  }
  function entitySourceSlot(value) {
    return entityMetadataSlot(value);
  }
  function storySourceIsOriginal(value) {
    const clean = textSlot(value, "").toLowerCase();
    return clean === "player" || clean === "original";
  }
  function storySourceDisplayLabel(value, fallback = "Original") {
    const clean = entitySourceSlot(value);
    if (!clean) return fallback;
    return storySourceIsOriginal(clean) ? "Original" : clean;
  }
  function entityCreatorSlot(value) {
    return entityMetadataSlot(value);
  }
  function formatCreationToolMetadata(value = {}) {
    if (!isPlainObject(value)) return entityMetadataSlot(value);
    const tool = entityMetadataSlot(value.tool || value.name);
    const model = entityMetadataSlot(value.model || value.model_version || value.version);
    const intelligence = entityMetadataSlot(value.intelligence || value.intelligence_level || value.reasoning_effort || value.effort);
    if (!tool) return null;
    const base = [tool, model].filter(Boolean).join(" ");
    return intelligence ? `${base} (${intelligence})` : base;
  }
  function entityCreationToolSlot(value) {
    return formatCreationToolMetadata(value);
  }
  function numberSlot(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  function stringListSlot(value, fallback = []) {
    if (!Array.isArray(value)) return fallback;
    return value.map(x => textSlot(x)).filter(Boolean);
  }
  function publicTagListSlot(...values) {
    return [...new Set(values.flatMap(value => Array.isArray(value) ? value : String(value || "").split(/[,\n]/).map(item => item.trim())).map(value => textSlot(value).toLowerCase()).filter(Boolean))];
  }
  function pickNumberSlots(source, keys) {
    if (!isPlainObject(source)) return {};
    const out = {};
    for (const key of keys) {
      if (source[key] == null) continue;
      out[key] = numberSlot(source[key], 0);
    }
    return out;
  }
  function pickTextSlots(source, keys) {
    if (!isPlainObject(source)) return {};
    const out = {};
    for (const key of keys) {
      if (source[key] == null) continue;
      const value = textSlot(source[key]);
      if (value) out[key] = value;
    }
    return out;
  }
  function validClothingSlots() {
    return Object.keys(blankClothingTemplate());
  }
  function exactClothingSlots(source, keys = validClothingSlots()) {
    if (!isPlainObject(source)) return {};
    const out = {};
    const unknownFields = Object.keys(source).filter(key => !validClothingSlots().includes(key));
    if (unknownFields.length) throw new Error(`Unknown clothing field${unknownFields.length === 1 ? "" : "s"}: ${unknownFields.join(", ")}.`);
    for (const key of keys) {
      if (!validClothingSlots().includes(key)) continue;
      if (!(key in source)) continue;
      out[key] = exactClothingSlotValue(source[key]);
    }
    return out;
  }
  function completeClothingSlotsForEditor(source = {}) {
    return {
      ...blankClothingTemplate(),
      ...exactClothingSlots(source || {})
    };
  }
  function repairAiClothingAliases(source) {
    if (!isPlainObject(source)) return {};
    const out = {
      ...source
    };
    const aliases = {
      hair: "hair_accessory",
      corset: "shirt",
      bodice: "shirt",
      blouse: "shirt",
      tunic: "shirt",
      top: "shirt",
      vest: "over_shirt",
      shawl: "shoulders",
      cloak: "coat",
      mantle: "shoulders",
      belt: "waist",
      sash: "waist",
      harness: "waist",
      stockings: "legwear",
      tights: "legwear",
      leggings: "pants",
      boots: "feet",
      shoes: "feet",
      jewelry: "other_accessory",
      accessory: "other_accessory"
    };
    for (const [from, to] of Object.entries(aliases)) {
      if (!(from in out) || from in blankClothingTemplate()) continue;
      if (!(to in out) || out[to] == null || out[to] === "") out[to] = out[from];
      delete out[from];
    }
    return out;
  }
  function exactClothingSlotValue(value) {
    if (value == null) return null;
    if (typeof value !== "string") throw new Error("Clothing slot values must be text or null.");
    return value;
  }
  function extractLocation(source) {
    const out = pickTextSlots(source, ["npc_location_id", "universe", "world", "continent", "region", "settlement_type", "settlement_name", "district", "specific_place"]);
    // World-generation chunks often describe the current location as a
    // generic map node with {id,name,type,scale}. Treat that name as the
    // current specific place so map normalization does not drift to a
    // connected undiscovered node.
    if (!out.specific_place && source?.name) out.specific_place = textSlot(source.name, "");
    return out;
  }
  function safeMapId(value, fallback = "location") {
    const raw = String(value || fallback || "location").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const id = raw || "location";
    return id.startsWith("loc-") ? id : `loc-${id}`;
  }
  function uniqueMapId(baseId, locations) {
    let id = safeMapId(baseId);
    let index = 2;
    while (locations?.[id]) {
      id = `${safeMapId(baseId)}-${index}`;
      index += 1;
    }
    return id;
  }
  function clampMapPercent(value, fallback) {
    const number = Number(value);
    return Math.max(5, Math.min(95, Number.isFinite(number) ? number : fallback));
  }
  function detailForMapLevel(location, level) {
    const detail = {};
    for (const key of ["universe", "world", "continent", "region", "settlement_type", "settlement_name", "district", "specific_place"]) {
      if (location?.[key]) detail[key] = location[key];
      if (level === "world" && key === "world" || level === "continent" && key === "continent" || level === "region" && key === "region" || level === "settlement" && key === "settlement_name" || level === "district" && key === "district" || level === "place" && key === "specific_place") break;
    }
    return detail;
  }
  function mapLocationIdFromDetail(detail) {
    const parts = [detail?.world, detail?.continent, detail?.region, detail?.settlement_name, detail?.district, detail?.specific_place].filter(Boolean);
    return safeMapId(parts.join("-") || "current-location");
  }
  function mapNodeMatchesLocation(node, location) {
    const detail = node?.detail || {};
    const nodeLocationValue = key => {
      const direct = textSlot(detail[key], "");
      if (direct) return direct;
      if (key === "specific_place") return node?.name || "";
      if (key === "district" && node?.scale === "district") return node.name;
      if (key === "settlement_name" && node?.scale === "settlement") return node.name;
      if (key === "region" && node?.scale === "region") return node.name;
      if (key === "continent" && node?.scale === "continent") return node.name;
      if (key === "world" && node?.scale === "planet") return node.name;
      return "";
    };
    for (const key of ["specific_place", "district", "settlement_name", "region", "continent", "world"]) {
      if (!location?.[key]) continue;
      return normalizeNameForMatch(nodeLocationValue(key)) === normalizeNameForMatch(location[key]);
    }
    return true;
  }
  function mapChainFromLocation(location) {
    const steps = [{
      level: "world",
      name: location?.world,
      type: "world",
      scale: "planet",
      x: 50,
      y: 16
    }, {
      level: "continent",
      name: location?.continent,
      type: "continent",
      scale: "continent",
      x: 47,
      y: 31
    }, {
      level: "region",
      name: location?.region,
      type: "region",
      scale: "region",
      x: 43,
      y: 46
    }, {
      level: "settlement",
      name: location?.settlement_name,
      type: location?.settlement_type || "settlement",
      scale: "settlement",
      x: 53,
      y: 58
    }, {
      level: "district",
      name: location?.district,
      type: "district",
      scale: "district",
      x: 50,
      y: 69
    }, {
      level: "place",
      name: location?.specific_place,
      type: "place",
      scale: "site",
      x: 58,
      y: 78
    }].filter(step => step.name);
    let parentId = "";
    return steps.map(step => {
      const detail = detailForMapLevel(location, step.level);
      const id = mapLocationIdFromDetail(detail);
      const node = {
        id,
        name: textSlot(step.name, "Location"),
        type: step.type,
        scale: step.scale,
        parent_id: parentId,
        x: step.x,
        y: step.y,
        discovered: true,
        travel_enabled: step.level !== "world",
        summary: "",
        detail,
        connections: parentId ? [parentId] : [],
        npcs: []
      };
      parentId = id;
      return node;
    });
  }
  function extractMapNode(id, source) {
    if (!isPlainObject(source)) return null;
    const nodeId = safeMapId(source.id || id || source.name);
    const detail = extractLocation(source.detail || source.location || {});
    return {
      id: nodeId,
      name: textSlot(source.name, "") || textSlot(detail.specific_place, "") || textSlot(detail.district, "") || textSlot(detail.settlement_name, "") || textSlot(detail.region, "") || textSlot(detail.world, "") || nodeId.replace(/^loc-/, "").replace(/-/g, " "),
      type: textSlot(source.type, "place"),
      scale: textSlot(source.scale, "site"),
      parent_id: source.parent_id ? safeMapId(source.parent_id) : "",
      x: clampMapPercent(source.x, 50),
      y: clampMapPercent(source.y, 50),
      discovered: source.discovered !== false,
      travel_enabled: source.travel_enabled !== false,
      summary: textSlot(source.summary, ""),
      detail,
      connections: stringListSlot(source.connections, []).map(value => safeMapId(value)).filter(Boolean),
      npcs: stringListSlot(source.npcs, [])
    };
  }
  function extractWorldMap(source, state = app.state) {
    const input = isPlainObject(source) ? source : {};
    const locations = {};
    for (const [id, node] of Object.entries(input.locations || {})) {
      const clean = extractMapNode(id, node);
      if (clean) locations[clean.id] = clean;
    }
    const chain = mapChainFromLocation(state.location || {});
    for (let i = 0; i < chain.length; i++) {
      const node = chain[i];
      locations[node.id] = {
        ...node,
        ...(locations[node.id] || {}),
        detail: {
          ...node.detail,
          ...(locations[node.id]?.detail || {})
        },
        discovered: true
      };
      if (i > 0) {
        const parent = chain[i - 1];
        const currentConnections = new Set(locations[node.id].connections || []);
        currentConnections.add(parent.id);
        locations[node.id].connections = [...currentConnections];
        const parentConnections = new Set(locations[parent.id]?.connections || []);
        parentConnections.add(node.id);
        locations[parent.id].connections = [...parentConnections];
      }
    }
    const fallbackCurrent = chain[chain.length - 1]?.id || Object.keys(locations)[0] || "loc-current-location";
    const requestedCurrent = input.current_location_id ? safeMapId(input.current_location_id) : "";
    let current = requestedCurrent || fallbackCurrent;
    if (!locations[current]) current = fallbackCurrent;
    if (requestedCurrent && fallbackCurrent && requestedCurrent !== fallbackCurrent && locations[fallbackCurrent] && !mapNodeMatchesLocation(locations[requestedCurrent], state.location)) current = fallbackCurrent;
    let focus = safeMapId(input.focus_location_id || locations[current]?.parent_id || current);
    if (!locations[focus]) focus = locations[current]?.parent_id || current;
    const travelHistory = stringListSlot(input.travel_history, []).map(id => safeMapId(id)).filter(id => locations[id]);
    if (!travelHistory.includes(current)) travelHistory.unshift(current);
    for (const node of Object.values(locations)) {
      if (!Array.isArray(node.npcs)) node.npcs = [];
    }
    return {
      current_location_id: current,
      focus_location_id: focus,
      travel_history: travelHistory,
      locations
    };
  }
  function mergeWorldMap(baseMap, patch, state = app.state) {
    const merged = {
      ...(isPlainObject(baseMap) ? baseMap : {}),
      ...(isPlainObject(patch) ? patch : {}),
      locations: {
        ...(baseMap?.locations || {})
      }
    };
    for (const [id, nodePatch] of Object.entries(patch?.locations || {})) {
      const cleanId = safeMapId(nodePatch?.id || id);
      merged.locations[cleanId] = {
        ...(baseMap?.locations?.[cleanId] || {}),
        ...(isPlainObject(nodePatch) ? nodePatch : {}),
        id: cleanId,
        detail: {
          ...(baseMap?.locations?.[cleanId]?.detail || {}),
          ...(nodePatch?.detail || nodePatch?.location || {})
        }
      };
    }
    return extractWorldMap(merged, state);
  }
  function compactWorldMapForPrompt(map, limit = 10, state = app.state) {
    const clean = extractWorldMap(map || {}, state);
    // Prompt boundary rule: graph neighbors can include locked future
    // locations. Runtime AI prompts may see only the current/focus node
    // and places already discovered or travel-enabled.
    const ids = mapVisibleLocationIds(clean.current_location_id, limit, clean).filter(id => {
      const node = clean.locations[id] || {};
      return id === clean.current_location_id || id === clean.focus_location_id || node.discovered !== false || node.travel_enabled !== false;
    });
    return {
      current_location_id: clean.current_location_id,
      current_location: clean.locations[clean.current_location_id]?.name || "",
      focus_location_id: clean.focus_location_id,
      visible_locations: ids.map(id => {
        const node = clean.locations[id] || {};
        return {
          id: node.id,
          name: node.name,
          type: node.type,
          scale: node.scale,
          parent_id: node.parent_id,
          discovered: node.discovered !== false,
          travel_enabled: node.travel_enabled !== false,
          summary: node.summary,
          connections: (node.connections || []).slice(0, 8)
        };
      })
    };
  }
  function extractScene(source) {
    if (!isPlainObject(source)) return {};
    const out = pickTextSlots(source, ["summary", "image_action"]);
    if (out.image_action) out.image_action = cleanImageAction(out.image_action);
    if (Array.isArray(source.party_members_present)) out.party_members_present = stringListSlot(source.party_members_present, []);
    if (Array.isArray(source.image_characters)) out.image_characters = stringListSlot(source.image_characters, []);
    if (Array.isArray(source.npcs_present)) out.npcs_present = stringListSlot(source.npcs_present, []);
    if (isPlainObject(void 0)) {}
    if (isPlainObject(source.manual_clothing_off)) out.manual_clothing_off = clone(source.manual_clothing_off);
    return out;
  }

  // NPC directory buckets are keyed by an authored, stable identifier.
  // Their labels are display values and may contain runtime name tokens.
  const NPC_LOCATION_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,95}$/;
  function isNpcLocationId(value) {
    return NPC_LOCATION_ID_PATTERN.test(String(value || "").trim());
  }
  function currentNpcLocationId(state = app.state) {
    return textSlot(state?.location?.npc_location_id, "").trim();
  }
  function requireNpcLocationId(state = app.state, value = "", context = "NPC directory") {
    const id = textSlot(value || currentNpcLocationId(state), "").trim();
    if (!isNpcLocationId(id)) throw new Error(`${context} requires location.npc_location_id to be an authored stable id (lowercase letters, numbers, and hyphens).`);
    return id;
  }
  function npcLocationLabel(state = app.state, locationId = "") {
    const id = requireNpcLocationId(state, locationId);
    return textSlot(state?.npc_directory?.locations?.[id]?.label, id);
  }
  function ensureNpcDirectoryLocation(state = app.state, locationId = "", label = "") {
    const id = requireNpcLocationId(state, locationId);
    state.npc_directory ||= {
      locations: {}
    };
    state.npc_directory.locations ||= {};
    state.npc_directory.locations[id] ||= {
      label: textSlot(label, id),
      characters: {}
    };
    const location = state.npc_directory.locations[id];
    location.label = textSlot(location.label, textSlot(label, id));
    location.characters ||= {};
    return location;
  }
  function pruneUnsupportedSceneFields(scene) {
    if (!isPlainObject(scene)) return scene;
    const supported = new Set(["summary", "objective", "party_members_present", "image_characters", "npcs_present", "image_action", "manual_clothing_off"]);
    for (const key of Object.keys(scene)) {
      if (!supported.has(key)) delete scene[key];
    }
    return scene;
  }
  function extractWorldFlags(source) {
    if (!isPlainObject(source)) return {};
    const forbidden = new Set(["__proto__", "prototype", "constructor"]);
    return Object.fromEntries(Object.entries(source).filter(([key, value]) => !forbidden.has(key) && value !== undefined).map(([key, value]) => [key, clone(value)]));
  }
  function looksLikeCharacterObject(value) {
    if (!isPlainObject(value) || !textSlot(value.name, "")) return false;
    return ["appearance", "outfits", "clothing", "starting_outfit_id", "active_outfit_id", "image_prompt_config"].some(field => Object.hasOwn(value, field));
  }
  function extractPlayer(source, current = {}, options = {}) {
    if (!isPlainObject(source)) return {};
    const out = pickTextSlots(source, ["id", "name", "gender", "role", "voice", "speech_style", "description", "state_of_mind", "physical_state", "pose"]);
    if (options.allowMetadata) {
      out.source = entitySourceSlot(source.source);
      out.creator = entityCreatorSlot(source.creator);
      out.creation_tool = entityCreationToolSlot(source.creation_tool);
    }
    if (options.allowPersonalityDescription) {
      const personality = textSlot(source.personality_description || source.personality, "");
      if (personality) out.personality_description = personality;
    }
    if (source.age != null) out.age = repairAiAdultAge(source.age, source.name || current.name, source.role || current.role, "character patch");
    for (const key of ["trust", "attraction", "affection"]) {
      if (source[key] != null) out[key] = repairAiState10(source[key]);
    }
    if (typeof source.romanceable === "boolean") out.romanceable = source.romanceable;
    if (source.relationship_to_player != null) out.relationship_to_player = textSlot(source.relationship_to_player, "unknown");
    if (source.boldness != null) out.boldness = repairAiCharacterBoldness(source.boldness);
    if (Array.isArray(source.inventory)) out.inventory = exactInventoryList(source.inventory);
    if (Array.isArray(source.known_facts)) out.known_facts = stringListSlot(source.known_facts, current.known_facts || []);
    if (Array.isArray(source.limitations)) out.limitations = stringListSlot(source.limitations, current.limitations || []);
    if (isPlainObject(source.stats)) {
      const statsErrors = characterStatsValidationErrors(source, source.name || current.name || "player", {
        allowDecimals: true
      });
      if (statsErrors.length) throw new Error(statsErrors[0].message);
      out.stats = clone(source.stats);
    }
    if (isPlainObject(source.appearance)) out.appearance = source.appearance;
    if (isPlainObject(source.clothing)) out.clothing = exactClothingSlots(source.clothing);
    if (source.outfits != null) out.outfits = exactOutfitList(source.outfits);
    if (source.active_outfit_id != null) out.active_outfit_id = textSlot(source.active_outfit_id, "");
    if (source.fallback_name != null) out.fallback_name = textSlot(source.fallback_name, "");
    if (source.fallback_outfits != null) out.fallback_outfits = exactOutfitList(source.fallback_outfits);
    if (source.fallback_starting_outfit_id != null) out.fallback_starting_outfit_id = textSlot(source.fallback_starting_outfit_id, "");
    const selectedOutfit = selectedOutfitIdFromPatch(source);
    if (selectedOutfit) {
      const outfitDraft = {
        ...clone(current || {}),
        ...out,
        outfits: out.outfits != null ? out.outfits : exactOutfitList(current?.outfits || [])
      };
      if (applyOutfitToEntity(outfitDraft, selectedOutfit)) {
        out.clothing = outfitDraft.clothing;
        out.active_outfit_id = outfitDraft.active_outfit_id;
        if (out.outfits != null) out.outfits = outfitDraft.outfits;
      }
    }
    if (isPlainObject(source.held_items)) out.held_items = source.held_items;
    if (isPlainObject(source.image)) out.image = source.image;
    out.default_seed = repairAiProfileImageSeed(source.default_seed, 0);
    out.image_prompt_config = repairAiImagePromptConfig(source.image_prompt_config || source.image, out.default_seed);
    if (source.default_profile_image != null) out.default_profile_image = profileImageSlotFromExactInput(source.default_profile_image);
    if (Object.hasOwn(source, "default_image_background")) {
      if (typeof source.default_image_background !== "string" || !source.default_image_background.trim()) throw new Error("character.default_image_background must be non-empty text when present.");
      out.default_image_background = source.default_image_background.trim();
    }
    if (source.profile_image_presentations != null) out.profile_image_presentations = createProfileImagePresentations(source.profile_image_presentations);
    if (Array.isArray(source.profile_images)) out.profile_images = source.profile_images;
    if (source.profile_image_id != null) out.profile_image_id = source.profile_image_id;
    if (source.profile_images_list != null) out.profile_images_list = source.profile_images_list;
    if (source.can_die != null) out.can_die = source.can_die === true;
    return out;
  }
  function extractProgression(source) {
    return {};
  }
  function currentSettlementName(state = app.state) {
    const location = currentLocationDetail(state);
    return textSlot(location.specific_place, "") || textSlot(location.settlement_name, "") || textSlot(location.district, "") || textSlot(location.region, "") || "Unknown Place";
  }
  function extractNpcDirectory(source, state = app.state) {
    const input = isPlainObject(source) ? source : {};
    const locations = {};
    const acceptedNpcNames = [];
    for (const [key, value] of Object.entries(input.locations || {})) {
      if (!isPlainObject(value)) continue;
      const locationId = textSlot(key, "").trim();
      // Stories are authored against stable location ids. Do not turn
      // legacy display-name keys into ids at runtime.
      if (!isNpcLocationId(locationId)) continue;
      const label = textSlot(value.label, "");
      if (!label) continue;
      const characters = {};
      const rawCharacters = {
        ...(isPlainObject(value.characters) ? value.characters : {})
      };
      if (Array.isArray(value.npcs)) {
        for (const npc of value.npcs) {
          if (!isPlainObject(npc)) continue;
          const listName = textSlot(npc.name, "");
          if (listName) rawCharacters[listName] = npc;
        }
      }
      for (const [name, npc] of Object.entries(rawCharacters)) {
        if (!isPlainObject(npc)) continue;
        const npcName = textSlot(npc.name, name);
        if (isInvalidStoredNpcName(npcName, state, {
          allowFutureCast: npcIsFutureCastBacked({
            ...npc,
            name: npcName
          }, state)
        })) continue;
        const normalizedNpcName = normalizeNameForMatch(npcName);
        const exactDuplicateNpc = acceptedNpcNames.some(acceptedName => normalizeNameForMatch(acceptedName) === normalizedNpcName);
        if (exactDuplicateNpc) continue;
        let full = null;
        if (isPlainObject(npc.full_character)) {
          const repairedFullCharacter = clone(npc.full_character);
          if (typeof repairedFullCharacter.romanceable !== "boolean") {
            repairedFullCharacter.romanceable = typeof npc.romanceable === "boolean" ? npc.romanceable : true;
          }
          full = materializeCharacterForRuntime(repairedFullCharacter, npcName);
        }
        const npcAge = Math.max(18, repairAiAge(npc.age ?? full?.age, 25));
        const npcSource = entitySourceSlot(npc.source ?? full?.source);
        const npcCreator = entityCreatorSlot(npc.creator ?? full?.creator);
        const npcCreationTool = entityCreationToolSlot(npc.creation_tool ?? full?.creation_tool);
        if (full) full.source = entitySourceSlot(full.source ?? npcSource);
        if (full) full.creator = entityCreatorSlot(full.creator ?? npcCreator);
        if (full) full.creation_tool = entityCreationToolSlot(full.creation_tool ?? npcCreationTool);
        if (full) {}
        characters[npcName] = {
          name: npcName,
          source: npcSource,
          creator: npcCreator,
          creation_tool: npcCreationTool,
          gender: textSlot(npc.gender || full?.gender, "unspecified"),
          age: npcAge,
          role: textSlot(npc.role || full?.role, "local"),
          relationship: textSlot(npc.relationship || full?.relationship_to_player, ""),
          note: textSlot(npc.note, ""),
          ...(npc.player_known_name === false ? {
            player_known_name: false
          } : {}),
          ...(npc.name_known_to_player === false ? {
            name_known_to_player: false
          } : {}),
          ...(textSlot(npc.player_facing_label, "") ? {
            player_facing_label: textSlot(npc.player_facing_label, "")
          } : {}),
          ...(textSlot(npc.visible_label, "") ? {
            visible_label: textSlot(npc.visible_label, "")
          } : {}),
          ...(textSlot(npc.public_label, "") ? {
            public_label: textSlot(npc.public_label, "")
          } : {}),
          current_appearance: textSlot(npc.current_appearance || npc.currentAppearance, ""),
          inspected: !!npc.inspected || !!full,
          ever_invited: !!npc.ever_invited,
          status: textSlot(npc.status, "alive"),
          death_note: textSlot(npc.death_note, ""),
          killed_by: textSlot(npc.killed_by, ""),
          killed_by_player: !!npc.killed_by_player,
          kill_reward_applied: !!npc.kill_reward_applied,
          can_die: (npc.can_die ?? full?.can_die) === true,
          recruitable: !!npc.recruitable,
          future_character_id: textSlot(npc.future_character_id, ""),
          ...(full ? {} : {
            voice: textSlot(npc.voice, "") || app.state.temp_speakers?.[npcName]?.voice || randomVoiceForGender(npc.gender)
          }),
          full_character: full
        };
        acceptedNpcNames.push(npcName);
      }
      locations[locationId] = {
        label,
        characters
      };
    }
    return {
      locations
    };
  }
  function findNpcInDirectory(directory, name) {
    const wanted = normalizeNameForMatch(name);
    if (!wanted) return null;
    for (const [locationId, location] of Object.entries(directory?.locations || {})) {
      for (const [key, npc] of Object.entries(location?.characters || {})) {
        const npcName = npc?.name || key;
        const npcId = String(npc?.id || npc?.character_id || npc?.full_character?.id || "").trim();
        if (normalizeNameForMatch(npcName) === wanted || normalizeNameForMatch(npcId) === wanted) return {
          locationId,
          locationLabel: textSlot(location?.label, locationId),
          key,
          npc
        };
      }
    }
    return null;
  }
  function mergeNpcEntries(existing = {}, incoming = {}, name = "", options = {}) {
    if (!options.allowMetadata) {
      incoming = clone(incoming);
      delete incoming.source;
      delete incoming.creator;
      delete incoming.creation_tool;
      if (isPlainObject(incoming.full_character)) {
        incoming.full_character = {
          ...incoming.full_character
        };
        delete incoming.full_character.source;
        delete incoming.full_character.creator;
        delete incoming.full_character.creation_tool;
      }
    }
    const full = isPlainObject(incoming.full_character) ? incoming.full_character : isPlainObject(existing.full_character) ? existing.full_character : null;
    if (full && !options.allowMetadata) {
      full.source = entitySourceSlot(existing.full_character?.source ?? existing.source ?? full.source);
      full.creator = entityCreatorSlot(existing.full_character?.creator ?? existing.creator ?? full.creator);
      full.creation_tool = entityCreationToolSlot(existing.full_character?.creation_tool ?? existing.creation_tool ?? full.creation_tool);
    }
    let incomingStatus = textSlot(incoming.status, "");
    const existingStatus = textSlot(existing.status, "");
    let incomingKilledBy = textSlot(incoming.killed_by, "");
    const incomingHasKilledByPlayer = Object.prototype.hasOwnProperty.call(incoming, "killed_by_player");
    let incomingKilledByPlayer = !!incoming.killed_by_player;
    const existingDead = existingStatus.trim().toLowerCase() === "dead";
    const incomingDead = incomingStatus.trim().toLowerCase() === "dead";
    const source = options.source || "state patch";
    if (incomingDead && !existingDead && !npcDeathPatchAllowed(existing, incoming, source)) {
      incomingStatus = "";
      incomingKilledBy = "";
      incomingKilledByPlayer = false;
      recordDevTraceEntry({
        logType: "troubleshooting",
        type: "NPC death patch blocked",
        name: name || incoming.name || existing.name || "NPC",
        source,
        reason: npcDeathValidationReason(existing),
        before: npcDeathTraceFields(existing),
        incoming: npcDeathTraceFields(incoming)
      });
      troubleshootingLog("npc death patch blocked", {
        source,
        name: name || incoming.name || existing.name || "NPC",
        reason: npcDeathValidationReason(existing),
        before: npcDeathTraceFields(existing),
        incoming: npcDeathTraceFields(incoming)
      });
    }
    if (incomingKilledByPlayer && !explicitPlayerCausedDeathEvidence({
      killedBy: incomingKilledBy,
      state: app.state
    })) {
      incomingKilledByPlayer = false;
      if (!isPlayerEntityName(incomingKilledBy, app.state)) incomingKilledBy = "";
    }
    const mergedKilledByPlayer = incomingHasKilledByPlayer ? incomingKilledByPlayer : !!existing.killed_by_player;
    const merged = {
      ...existing,
      ...incoming,
      name: textSlot(incoming.name || existing.name || name, name),
      status: incomingStatus || existingStatus || "alive",
      killed_by: incomingKilledBy || textSlot(existing.killed_by, ""),
      killed_by_player: mergedKilledByPlayer,
      kill_reward_applied: !!(existing.kill_reward_applied || incoming.kill_reward_applied),
      full_character: full
    };
    synchronizeRuntimeNpcIdentity(merged, name);
    if (!npcIsDead(merged)) {
      merged.killed_by_player = false;
      merged.killed_by = "";
      merged.death_note = "";
    }
    if (full) delete merged.voice;else merged.voice ||= app.state.temp_speakers?.[merged.name]?.voice || randomVoiceForGender(merged.gender);
    if (full) merged.inspected = true;else merged.inspected = !!(existing.inspected || incoming.inspected);
    merged.ever_invited = !!(existing.ever_invited || incoming.ever_invited);
    if (existing.recruitable || incoming.recruitable) merged.recruitable = true;
    if (!merged.future_character_id && existing.future_character_id) merged.future_character_id = existing.future_character_id;
    traceNpcDeathFlagChange(existing, merged, {
      source,
      name: name || merged.name || incoming.name || existing.name || "NPC"
    });
    return merged;
  }
  function npcDeathValidationReason(npc = {}) {
    if (npc?.can_die === false || npc?.full_character?.can_die === false) return "NPC cannot die because can_die is false";
    return "NPC death requires status dead and a non-empty death_note";
  }
  function npcDeathPatchAllowed(existing = {}, incoming = {}, source = "state patch") {
    const canDie = existing.can_die !== false && existing.full_character?.can_die !== false && incoming.can_die !== false && incoming.full_character?.can_die !== false;
    const ok = canDie && String(incoming.status || "").trim().toLowerCase() === "dead" && !!textSlot(incoming.death_note, "");
    if (!ok) return false;
    troubleshootingLog("npc death patch allowed", {
      source,
      name: incoming.name || existing.name || "",
      status: incoming.status,
      deathNoteProvided: true
    });
    return true;
  }
  function explicitPlayerCausedDeathEvidence({
    killedBy = "",
    state = app.state
  } = {}) {
    return isPlayerEntityName(killedBy, state);
  }
  function npcDeathTraceFields(npc = {}) {
    return {
      status: textSlot(npc.status, ""),
      relationship: textSlot(npc.relationship, ""),
      death_note: textSlot(npc.death_note, ""),
      killed_by: textSlot(npc.killed_by, ""),
      killed_by_player: !!npc.killed_by_player,
      inspected: !!npc.inspected || !!npc.full_character,
      ever_invited: !!npc.ever_invited,
      kill_reward_applied: !!npc.kill_reward_applied
    };
  }
  function traceNpcDeathFlagChange(before = {}, after = {}, context = {}) {
    const beforeFields = npcDeathTraceFields(before);
    const afterFields = npcDeathTraceFields(after);
    if (JSON.stringify(beforeFields) === JSON.stringify(afterFields)) return;
    const entry = {
      at: new Date().toISOString(),
      type: "NPC death flags changed",
      source: context.source || "state patch",
      name: context.name || after.name || before.name || "NPC",
      before: beforeFields,
      after: afterFields
    };
    recordDevTraceEntry({
      logType: "troubleshooting",
      ...entry
    });
    troubleshootingLog("npc death flags changed", entry);
  }
  function mergeNpcDirectoryPatch(baseDirectory, patchDirectory, state = app.state, options = {}) {
    const base = extractNpcDirectory(baseDirectory, state);
    const patch = isPlainObject(patchDirectory) ? patchDirectory : {};
    const out = clone(base);
    for (const [rawLocationKey, rawLocation] of Object.entries(patch.locations || {})) {
      if (!isPlainObject(rawLocation)) continue;
      const locationId = textSlot(rawLocationKey, "").trim();
      if (!isNpcLocationId(locationId)) continue;
      const label = textSlot(rawLocation.label, "");
      if (!label) continue;
      out.locations ||= {};
      out.locations[locationId] ||= {
        label,
        characters: {}
      };
      const rawCharacters = {
        ...(isPlainObject(rawLocation.characters) ? rawLocation.characters : {})
      };
      if (Array.isArray(rawLocation.npcs)) {
        for (const npc of rawLocation.npcs) {
          if (!isPlainObject(npc)) continue;
          const listName = textSlot(npc.name, "");
          if (listName) rawCharacters[listName] = npc;
        }
      }
      for (const [rawName, rawNpc] of Object.entries(rawCharacters)) {
        if (!isPlainObject(rawNpc)) continue;
        const npcName = textSlot(rawNpc.name, rawName);
        if (isInvalidNpcName(npcName, state, {
          allowFutureCast: npcIsFutureCastBacked({
            ...rawNpc,
            name: npcName
          }, state)
        })) continue;
        const duplicateNpc = findDuplicateNpcName(npcName, {
          ...state,
          npc_directory: out
        });
        if (duplicateNpc) continue;
        const localExisting = out.locations[locationId].characters[npcName];
        const foundExisting = findNpcInDirectory(out, npcName);
        const existing = localExisting || foundExisting?.npc || null;
        if (foundExisting && foundExisting.locationId === locationId && foundExisting.key !== npcName) {
          delete out.locations[locationId].characters[foundExisting.key];
        }
        out.locations[locationId].characters[npcName] = mergeNpcEntries(existing || {}, rawNpc, npcName, options);
      }
    }
    return extractNpcDirectory(out, state);
  }
  function getNpcLocation(locationId = currentNpcLocationId()) {
    const id = textSlot(locationId, "").trim();
    if (!isNpcLocationId(id)) return null;
    return app.state.npc_directory?.locations?.[id] || null;
  }
  function getNpcEntry(name, locationId = currentNpcLocationId()) {
    const local = getNpcLocation(locationId)?.characters?.[name];
    if (local) return local;
    for (const location of Object.values(app.state.npc_directory?.locations || {})) {
      if (location?.characters?.[name]) return location.characters[name];
    }
    return null;
  }
  function synchronizeRuntimeNpcIdentity(npc = {}, fallbackName = "") {
    if (!isPlainObject(npc) || !isPlainObject(npc.full_character)) return npc;
    const fullCharacterId = textSlot(npc.full_character.id || npc.full_character.character_id, "");
    const shellId = textSlot(npc.id || npc.character_id, "");
    const id = fullCharacterId || shellId || assertGeneratedIdAvailable(generatedPersistentId(RUNTIME_DEFINITION_NAMESPACES.character.replace(/-$/, "")), `runtime NPC ${fallbackName || npc.name || "character"}`);
    npc.full_character.id = id;
    npc.id = id;
    return npc;
  }
  function ensureNpcEntry(name, hints = {}) {
    if (!name || isInvalidNpcName(name)) return null;
    const existing = findNpcEntryInState(app.state, name)?.npc;
    if (existing) {
      synchronizeRuntimeNpcIdentity(existing, name);
      if (!textSlot(existing.id, "")) existing.id = assertGeneratedIdAvailable(generatedPersistentId(RUNTIME_DEFINITION_NAMESPACES.character.replace(/-$/, "")), "existing AI speaker NPC");
      synchronizeRuntimeNpcIdentity(existing, name);
      discardRedundantTempSpeaker(name, existing.full_character || existing);
      return existing;
    }
    const location = ensureNpcDirectoryLocation(app.state, currentNpcLocationId(), currentSettlementName());
    const shellRomanceable = typeof hints.romanceable === "boolean" ? hints.romanceable : Number(stableStringHash(`npc-romanceable:${name}`)) % 5 !== 0;
    location.characters ||= {};
    location.characters[name] ||= {
      id: assertGeneratedIdAvailable(generatedPersistentId(RUNTIME_DEFINITION_NAMESPACES.character.replace(/-$/, "")), "new speaker NPC"),
      name,
      source: entitySourceSlot(hints.source),
      creator: entityCreatorSlot(hints.creator),
      creation_tool: entityCreationToolSlot(hints.creation_tool),
      romanceable: shellRomanceable,
      gender: hints.gender || deterministicGeneratedCharacterGender(`npc-shell:${name}`, shellRomanceable),
      age: repairAiAdultAge(hints.age, name, hints.role || hints.relationship || hints.note, "known NPC"),
      role: hints.role || "local",
      relationship: hints.relationship || "unknown",
      note: hints.note || "seen in the current scene",
      inspected: false,
      ever_invited: !!hints.ever_invited,
      status: hints.status || "alive",
      death_note: hints.death_note || "",
      killed_by: hints.killed_by || "",
      killed_by_player: !!hints.killed_by_player,
      kill_reward_applied: !!hints.kill_reward_applied,
      voice: hints.voice || app.state.temp_speakers?.[name]?.voice || randomVoiceForGender(hints.gender),
      full_character: null
    };
    adaptRuntimeCharacterGender(location.characters[name], `npc-shell:${name}`);
    if (!Number(location.characters[name].age)) location.characters[name].age = repairAiAdultAge(hints.age, name, hints.role || hints.relationship || hints.note, "known NPC missing age");
    if (hints.age != null) location.characters[name].age = repairAiAdultAge(hints.age, name, location.characters[name].age, "known NPC explicit age");
    app.state.scene ||= {};
    app.state.scene.npcs_present ||= [];
    if (!app.state.scene.npcs_present.includes(name)) app.state.scene.npcs_present.push(name);
    const created = location.characters[name];
    discardRedundantTempSpeaker(name, created.full_character || created);
    return created;
  }
  function ensureNpcFullCharacter(name, locationId = "") {
    const npc = getNpcEntry(name, locationId);
    if (!npc) return null;
    if (npc.full_character) return npc.full_character;
    const displayName = textSlot(npc.name, "") || textSlot(name, "") || "Local NPC";
    const partial = {
      ...blankCharacterTemplate(displayName),
      name: displayName,
      age: exactAdultAge(npc.age, `NPC ${displayName}.age`),
      gender: textSlot(npc.gender, "unspecified"),
      role: textSlot(npc.role || npc.role, "local adult"),
      relationship_to_player: textSlot(npc.relationship, "unknown"),
      personality_description: textSlot(npc.personality_description || npc.personality || npc.note, `${displayName} is a known adult NPC whose details can be refined by the player.`),
      physical_state: textSlot(npc.physical_state, "normal"),
      state_of_mind: textSlot(npc.state_of_mind, "neutral"),
      pose: textSlot(npc.pose, "standing"),
      known_facts: [...(npc.note ? [npc.note] : []), `${displayName} is a known adult NPC.`]
    };
    npc.full_character = applyStoryDefaultImageModelToCharacter(materializeCharacterForRuntime(partial, displayName), app.state, {
      force: true
    });
    synchronizeRuntimeNpcIdentity(npc, displayName);
    npc.inspected = true;
    npc.age = npc.full_character.age;
    npc.gender = npc.full_character.gender || npc.gender || "unspecified";
    npc.relationship = npc.full_character.relationship_to_player || npc.relationship || "unknown";
    npc.role = npc.full_character.role || npc.role || "local";
    return npc.full_character;
  }
  function namesFromSceneText(text = "") {
    const known = new Set([...Object.keys(app.state.characters || {}), ...Object.values(app.state.npc_directory?.locations || {}).flatMap(location => Object.keys(location.characters || {}))]);
    const found = [...known].filter(name => name !== "Player" && new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(text));
    return [...new Set(found)];
  }
  function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function ensureSceneNpcDefinitions(text = "") {
    const names = [...(app.state.scene?.party_members_present || []), ...(app.state.scene?.npcs_present || []), ...namesFromSceneText(text)];
    for (const name of [...new Set(names)]) {
      if (!name || name === "Player") continue;
      if (isInvalidNpcName(name)) continue;
      if (isPartyCharacterName(name)) continue;
      ensureNpcEntry(name);
    }
    replaceSceneNpcPresence(app.state, [...new Set(app.state.scene?.npcs_present || [])].filter(name => isValidNearbyNpcName(name)), "scene NPC definition validation");
  }
  function ensureRuntimeScene(state = app.state) {
    if (!state || typeof state !== "object") throw new Error("Runtime state is missing.");
    state.scene ||= {};
    state.scene.party_members_present ||= [];
    state.scene.npcs_present ||= [];
    state.scene.image_characters ||= [];
    pruneUnsupportedSceneFields(state.scene);
    return state.scene;
  }
  function sceneNameMatches(candidate, wanted) {
    const candidateText = String(candidate || "");
    const wantedText = String(wanted || "");
    return candidateText === wantedText || normalizeNameForMatch(candidateText) === normalizeNameForMatch(wantedText);
  }
  function logSceneNpcPresenceRemoval(before = [], after = [], reason = "scene update") {
    const beforeNames = Array.isArray(before) ? before : [];
    const afterNames = Array.isArray(after) ? after : [];
    const removed = beforeNames.filter(name => name && !afterNames.some(candidate => sceneNameMatches(candidate, name)));
    if (!removed.length) return [];
    log("NPC removed from scene", `${removed.join(", ")} removed from scene by ${reason}.`, {
      type: "state",
      level: "message",
      details: {
        reason,
        removed,
        before: beforeNames,
        after: afterNames
      }
    });
    return removed;
  }
  function replaceSceneNpcPresence(state, nextNames, reason = "scene update") {
    const scene = ensureRuntimeScene(state);
    const before = Array.isArray(scene.npcs_present) ? [...scene.npcs_present] : [];
    const after = Array.isArray(nextNames) ? [...new Set(nextNames.filter(Boolean).map(name => resolveEntityName(name, state, String(name || "").trim())).filter(Boolean))] : [];
    scene.npcs_present = after;
    logSceneNpcPresenceRemoval(before, after, reason);
    return after;
  }
  function addUniqueSceneName(scene, key, name) {
    const clean = String(name || "").trim();
    if (!clean) throw new Error(`Cannot add an empty name to scene.${key}.`);
    const list = Array.isArray(scene[key]) ? scene[key] : [];
    if (!list.some(item => sceneNameMatches(item, clean))) list.push(clean);
    scene[key] = list;
  }
  function removeSceneName(scene, key, name) {
    const clean = String(name || "").trim();
    if (!clean) throw new Error(`Cannot remove an empty name from scene.${key}.`);
    const before = Array.isArray(scene[key]) ? [...scene[key]] : [];
    scene[key] = before.filter(item => !sceneNameMatches(item, clean));
    if (key === "npcs_present") logSceneNpcPresenceRemoval(before, scene[key], "explicit scene NPC removal");
  }
  function addPartyMemberToScene(state, name) {
    const clean = String(name || "").trim();
    if (!clean) throw new Error("Party member name is required.");
    if (!state?.characters?.[clean]) throw new Error(`Party member not found: ${clean}`);
    const scene = ensureRuntimeScene(state);
    removeSceneName(scene, "npcs_present", clean);
    addUniqueSceneName(scene, "party_members_present", clean);
    return true;
  }
  function removePartyMemberFromScene(state, name) {
    const clean = String(name || "").trim();
    if (!clean) throw new Error("Party member name is required.");
    const scene = ensureRuntimeScene(state);
    removeSceneName(scene, "party_members_present", clean);
    removeSceneName(scene, "image_characters", clean);
    return true;
  }
  function addNpcToSceneCommand(state, name) {
    const clean = String(name || "").trim();
    if (!clean) throw new Error("NPC name is required.");
    const npc = getNpcEntry(clean);
    if (!npc) throw new Error(`NPC not found: ${clean}`);
    if (npcIsDead(npc)) throw new Error(`NPC is dead: ${clean}`);
    if (state?.characters?.[clean]) throw new Error(`${clean} is a party member, not an NPC.`);
    ensureNpcEntry(clean, npc);
    const scene = ensureRuntimeScene(state);
    removeSceneName(scene, "party_members_present", clean);
    addUniqueSceneName(scene, "npcs_present", clean);
    return true;
  }
  function removeNpcFromSceneCommand(state, name) {
    const clean = String(name || "").trim();
    if (!clean) throw new Error("NPC name is required.");
    const scene = ensureRuntimeScene(state);
    removeSceneName(scene, "npcs_present", clean);
    removeSceneName(scene, "image_characters", clean);
    return true;
  }
  function removeNpcFromScene(name) {
    if (!name) return;
    const cleanName = String(name || "").trim();
    const scene = ensureRuntimeScene(app.state);
    const sceneNpcName = (scene.npcs_present || []).find(item => sceneNameMatches(item, cleanName));
    const exactPartyName = Object.keys(app.state.characters || {}).find(item => sceneNameMatches(item, cleanName));
    const removedName = sceneNpcName || exactPartyName || resolveEntityName(cleanName, app.state, cleanName) || cleanName;
    const isPartyCharacter = !!app.state.characters?.[removedName];
    if (isPartyCharacter) removePartyMemberFromScene(app.state, removedName);else removeNpcFromSceneCommand(app.state, removedName);
    scheduleActiveGameSave();
    refreshCharacterSurfaces(removedName, {
      reason: "character removed from scene"
    });
    if (!isPartyCharacter) cleanupRemovedCharacterReferences(removedName, "scene");
  }
  function addNpcToScene(name) {
    try {
      addNpcToSceneCommand(app.state, name);
    } catch (err) {
      reportAppIssue(err, {
        title: "Add NPC To Scene Failed",
        type: "system",
        context: `addNpcToScene:${name || ""}`
      });
      showNotice("Add NPC Failed", err.message || String(err));
      return;
    }
    scheduleActiveGameSave();
    queueProfileImageIfMissing(name, "entered scene");
    refreshCharacterSurfaces(name, {
      reason: "npc added to scene"
    });
  }
  function toggleNpcScenePresence(name) {
    if ((app.state.scene?.npcs_present || []).includes(name)) removeNpcFromScene(name);else addNpcToScene(name);
  }
  function recentNpcVisibleContextForPrompt(name, limit = 4) {
    const cleanName = String(name || "").trim();
    if (!cleanName) return [];
    const pattern = new RegExp(`\\b${escapeRegExp(cleanName)}\\b`, "i");
    return (app.messages || []).filter(message => isStoryMessageRole(message.role))
    // NPC inspection must anchor to what the player has actually seen.
    // Match both body text and message speaker, because a speaking NPC
    // may be represented by the chat header instead of repeating their
    // full name inside the visible text.
    .filter(message => pattern.test(message.text || "") || pattern.test(message.speaker || "")).slice(-limit).map(message => ({
      role: message.role,
      speaker: message.speaker || (message.role === "assistant" ? "Narrator" : playerNameForPrompt()),
      text: String(message.text || "").slice(0, 1200)
    }));
  }
  async function confirmNpcInspectionDurationNotice() {
    return await showConfirm("NPC Inspection Takes Time", aiCharacterDefinitionTimeWarningText("Inspecting an NPC"), {
      confirmText: "Inspect",
      cancelText: "Cancel"
    });
  }
  function aiCharacterDefinitionTimeWarningText(prefix = "Creating a character") {
    return `${prefix} creates a full character definition and usually takes 1 to 2 minutes. You can keep playing; messages typed while it is running will be queued.`;
  }
  async function inspectNpc(name) {
    const npc = ensureNpcEntry(name);
    if (!npc) return null;
    const inspectionKey = String(npc.name || name || "").trim();
    if (npcIsDead(npc)) {
      showNotice("NPC Dead", `${npc.name || name} is dead.`);
      return null;
    }
    if (npc.inspected && npc.full_character) {
      render();
      return npc.full_character;
    }
    if (app.npcInspectionInFlight.has(inspectionKey)) {
      // NPC inspection is single-flight per NPC. A second click while
      // the first AI detail request is queued/running must be rejected,
      // otherwise the later completion can visually overwrite/fail the card.
      showNotice("Inspection In Progress", `${npc.name || name} is already being inspected.`);
      return null;
    }
    if (!(await confirmNpcInspectionDurationNotice())) return null;
    app.npcInspectionInFlight.add(inspectionKey);
    try {
      app.busy = true;
      setTurnStage("working", `Generating character details for ${name}...`);
      renderThread();
      const instruction = buildGeneratedCharacterAiInstruction({
        mode: "inspect",
        name: npc.name || name,
        npc,
        promptText: [npc.name || name, npc.role ? `Role: ${npc.role}` : "", npc.gender ? `Gender: ${npc.gender}` : "", npc.note ? `Known note: ${npc.note}` : "", npc.current_appearance ? `Current appearance: ${npc.current_appearance}` : ""].filter(Boolean).join("\n")
      });
      const raw = await aiText(instruction, {
        startWith: "{",
        hideStartWith: false,
        label: "npc inspection",
        promptEditorReplay: {
          mode: "inspect",
          name: npc.name || name,
          npc: clone(npc),
          promptText: [npc.name || name, npc.role ? `Role: ${npc.role}` : "", npc.gender ? `Gender: ${npc.gender}` : "", npc.note ? `Known note: ${npc.note}` : "", npc.current_appearance ? `Current appearance: ${npc.current_appearance}` : ""].filter(Boolean).join("\n")
        }
      });
      let full = parseJsonObject(raw);
      if (!full) {
        full = parsePartialTopLevelJsonObject(raw);
        if (full) {
          log("NPC inspect partial JSON recovered", `${npc.name || name} inspection response was incomplete. Recovered completed top-level fields and filled missing fields with character defaults.`, {
            type: "system",
            level: "warn"
          });
        }
      }
      if (!full) throw new Error("Inspection returned invalid JSON");
      const liveNpc = ensureNpcEntry(inspectionKey) || npc;
      // Direct-tool rule: inspection AI can take a long time while
      // background state sync continues. Re-resolve the live NPC
      // record after the await so success writes to current state,
      // not to a stale object reference from before state replacement.
      liveNpc.full_character = finalizeGeneratedCharacterFromAiPayload({
        name: liveNpc.name || name,
        character: isPlainObject(full?.character) ? full.character : full
      }, liveNpc.name || name);
      liveNpc.full_character.name = liveNpc.name || name;
      liveNpc.full_character = addImmutableDefinitionFields(liveNpc.full_character, liveNpc.name || name);
      liveNpc.full_character.romanceable = liveNpc.romanceable === true;
      liveNpc.full_character.gender = liveNpc.gender || liveNpc.full_character.gender;
      if (liveNpc.role && (!liveNpc.full_character.role || liveNpc.full_character.role === "adult character")) liveNpc.full_character.role = textSlot(liveNpc.role, "local adult");
      ensureGeneratedCharacterFallbackPresentation(liveNpc.full_character, liveNpc.name || name);
      liveNpc.full_character.voice = generatedCharacterVoiceSlot(liveNpc.full_character);
      liveNpc.full_character = addImmutableDefinitionFields(liveNpc.full_character, liveNpc.name || name);
      if (liveNpc.age && !Number(full?.age ?? full?.character?.age)) liveNpc.full_character.age = exactAdultAge(liveNpc.age, `inspected NPC ${name}.age`);
      if (!liveNpc.full_character.default_profile_image) liveNpc.full_character.default_profile_image = emptyProfileImageSlot(normalizedCharacterGender(liveNpc.full_character.gender) === "male");
      liveNpc.full_character = materializeCharacterForRuntime(liveNpc.full_character, liveNpc.name || name, {
        allowMetadata: true
      });
      applyStoryDefaultImageModelToCharacter(liveNpc.full_character, app.state, {
        force: true
      });
      liveNpc.full_character = addImmutableDefinitionFields(liveNpc.full_character, liveNpc.name || name);
      carryNpcShellProfileImagesToInspectedCharacter(liveNpc, liveNpc.full_character, liveNpc.name || name);
      liveNpc.inspected = true;
      liveNpc.age = exactAdultAge(liveNpc.full_character.age, `inspected NPC ${name}.full_character.age`);
      liveNpc.gender = liveNpc.full_character.gender || liveNpc.gender || "unspecified";
      liveNpc.relationship = liveNpc.full_character.relationship_to_player || liveNpc.relationship || "unknown";
      liveNpc.role = liveNpc.role || liveNpc.full_character.role || "local";
      scheduleActiveGameSave();
      addGameMessage(`${liveNpc.name || name} has been inspected.`, "Game");
      queueMissingProfileImageAfterDefaultAttempt(name, "npc inspected", {
        force: true,
        skipDefault: true,
        allowImportSkipped: true,
        allowRuntimeProfileGeneration: true,
        allowDuringSmoke: true,
        source: "inspected NPC profile"
      });
      render();
      maybePromptSaveRuntimeCharacterToLibrary(liveNpc.name || name);
      setTurnStage("idle", "Ready");
      return liveNpc.full_character;
    } catch (err) {
      setTurnStage("error", "Inspection failed");
      log("NPC inspect failed", err?.stack || err?.message || err, {
        type: "system",
        level: "error"
      });
      if (devSmokeSuiteState()?.running) throw err;
      return null;
    } finally {
      app.npcInspectionInFlight.delete(inspectionKey);
      app.busy = false;
      if (app.turnStage !== "error") setTurnStage("idle", "Ready");
      render();
      if (app.queue.length) {
        // Direct-tool rule: Inspect NPC is not a story turn, but a
        // player can type while inspection is running. Once the
        // inspection releases app.busy, the queued story turn must
        // resume without waiting for another UI action.
        setTimeout(() => {
          if (!app.busy && app.queue.length) processQueue();
        }, 0);
      }
    }
  }
  function materializeCharacterForRuntime(character, name, options = {}) {
    const base = blankCharacterTemplate(name);
    const input = materializeCharacterDefinitionForRuntimeFields(character || {}, name, options);
    const statsErrors = characterStatsValidationErrors(input, name || "character", {
      allowDecimals: true
    });
    if (statsErrors.length) throw new Error(statsErrors[0].message);
    if (options.allowMetadata === false) {
      delete input.source;
      delete input.creator;
      delete input.creation_tool;
      delete input.genres;
    }
    const next = mergeCharacterPatch(base, input, {
      allowPersonalityDescription: true,
      characterName: name || input.name || "character"
    });
    if (Object.hasOwn(input, "active_outfit_id")) next.active_outfit_id = textSlot(input.active_outfit_id, "");
    if (Object.hasOwn(input, "starting_outfit_id")) next.starting_outfit_id = textSlot(input.starting_outfit_id, "");
    if (typeof input.romanceable !== "boolean") throw new Error("character.romanceable must be true or false.");
    next.romanceable = input.romanceable;
    for (const key of ["fallback_name", "fallback_gender", "fallback_starting_outfit_id"]) {
      const value = textSlot(input?.[key], "");
      if (value) next[key] = value;else delete next[key];
    }
    if (Array.isArray(input?.fallback_outfits) && input.fallback_outfits.length) next.fallback_outfits = exactOutfitList(input.fallback_outfits);else delete next.fallback_outfits;
    for (const key of ["id", "character_id", "definition_id", "future_character_id"]) {
      if (textSlot(input?.[key], "")) next[key] = textSlot(input[key], "");
    }
    for (const key of ["trust", "attraction", "affection"]) {
      if (input?.[key] != null) next[key] = input[key];
    }
    if (input?.boldness != null) next.boldness = input.boldness;
    next.name = input.name;
    if (isPlainObject(input?.image)) next.image = {
      ...(next.image || {}),
      ...input.image
    };
    if (Array.isArray(input?.profile_images)) next.profile_images = input.profile_images.map(image => ({
      ...image,
      ...clone(image)
    }));else if (isPlainObject(input?.profile_images)) {
      next.profile_images = input.profile_images.image_ids.map(id => profileStoreImageById(id)).filter(Boolean).map(clone);
      next.profile_image_id = next.profile_images.some(image => image.id === input.profile_images.active_image_id) ? input.profile_images.active_image_id : "";
    }
    if (input?.profile_image_id != null) next.profile_image_id = input.profile_image_id;
    if (input?.profile_images_list != null) next.profile_images_list = input.profile_images_list;
    next.default_seed = input.default_seed;
    next.image_prompt_config = imagePromptConfigFromExactInput(input.image_prompt_config);
    if (input?.default_profile_image != null) next.default_profile_image = profileImageSlotFromExactInput(input.default_profile_image);
    if (Object.hasOwn(input, "default_image_background")) {
      if (typeof input.default_image_background !== "string" || !input.default_image_background.trim()) throw new Error("character.default_image_background must be non-empty text when present.");
      next.default_image_background = input.default_image_background.trim();
    } else {
      delete next.default_image_background;
    }
    if (input?.profile_image_presentations != null) next.profile_image_presentations = clone(input.profile_image_presentations);
    if (!Number.isSafeInteger(next.age) || next.age < 18) throw new Error("character.age must be a whole number of at least 18.");
    next.source = input.source;
    next.creator = input.creator;
    next.creation_tool = input.creation_tool;
    next.genres = Array.isArray(input.genres) ? clone(input.genres) : [];
    if (isPlainObject(input?.stats)) next.stats = clone(input.stats);
    next.role = input.role;
    next.personality_description = input.personality_description;
    next.speech_style = input.speech_style;
    next.appearance = clone(input.appearance);
    if (!isPlainObject(next.clothing)) {
      const activeOutfitId = textSlot(next.active_outfit_id || next.starting_outfit_id, "");
      const activeOutfit = (next.outfits || []).find(outfit => outfit?.id === activeOutfitId) || next.outfits?.[0];
      if (!isPlainObject(activeOutfit?.clothing)) throw new Error(`${next.name || name || "Character"} requires an active outfit with clothing before becoming a runtime character.`);
      next.active_outfit_id = textSlot(activeOutfit.id, "");
      next.clothing = exactClothingSlots(clone(activeOutfit.clothing));
    }
    if (options.clampGeneratedChest) throw new Error("Generated character body values must be repaired before runtime materialization.");
    resolveActiveProfileImageReference(next);
    return next;
  }
  function finalizeRuntimePlayerAfterEditor(oldPlayerName = "") {
    const existingId = textSlot(app.state.player?.id, "");
    app.state.player = materializeCharacterForRuntime(app.state.player || {}, "Player", {
      allowMetadata: false
    });
    if (existingId && !textSlot(app.state.player.id, "")) app.state.player.id = existingId;
    app.state.player.name = textSlot(app.state.player.name, "Player") || "Player";
    syncPlayerVisualNameReferences(oldPlayerName, app.state.player.name);
    assertRuntimeSceneReferences(app.state);
    return app.state.player;
  }
  function finalizeRuntimePartyCharacterAfterEditor(name, draft = null) {
    const cleanName = String(name || "").trim();
    if (!cleanName) throw new Error("Character editor save requires a character name.");
    if (!app.state.characters?.[cleanName]) throw new Error(`Character not found for editor save: ${cleanName}`);
    const existingId = textSlot(app.state.characters[cleanName].id, "");
    const next = materializeCharacterForRuntime(draft || app.state.characters[cleanName], cleanName, {
      allowMetadata: false
    });
    if (existingId && !textSlot(next.id, "")) next.id = existingId;
    clearInvalidRuntimeProfileImagePointer(next);
    const validationState = {
      ...app.state,
      characters: {
        ...app.state.characters,
        [cleanName]: next
      }
    };
    assertRuntimeSceneReferences(validationState);
    app.state.characters[cleanName] = next;
    return app.state.characters[cleanName];
  }
  function finalizeRuntimeNpcAfterEditor(npc, name = "", directoryData = {}) {
    if (!npc || typeof npc !== "object") throw new Error(`NPC editor save requires an NPC record: ${name || "unknown"}`);
    const displayName = textSlot(directoryData.name, npc.name || name || "");
    if (displayName) npc.name = displayName;
    npc.full_character = materializeCharacterForRuntime(npc.full_character || blankCharacterTemplate(displayName || name || "NPC"), displayName || name || npc.name || "NPC", {
      allowMetadata: false
    });
    clearInvalidRuntimeProfileImagePointer(npc.full_character);
    synchronizeRuntimeNpcIdentity(npc, displayName || name || "NPC");
    npc.age = parseAdultAgeInput(directoryData.age ?? npc.full_character.age ?? npc.age, `NPC editor ${npc.name || name}.age`);
    npc.gender = textSlot(directoryData.gender) || npc.full_character.gender || npc.gender || "unspecified";
    npc.relationship = textSlot(directoryData.relationship) || npc.full_character.relationship_to_player || npc.relationship || "unknown";
    npc.role = textSlot(directoryData.role) || npc.full_character.role || npc.role || "local";
    npc.note = textSlot(directoryData.note, npc.note || "");
    npc.inspected = directoryData.inspected !== false;
    npc.status = textSlot(directoryData.status, npc.status || "alive");
    npc.death_note = textSlot(directoryData.death_note, npc.death_note || "");
    assertRuntimeSceneReferences(app.state);
    return npc;
  }
  function finalizeRuntimeAfterRewardApplication(state = app.state) {
    // Reward handlers own their exact NPC and scene mutations. Rebuilding
    // the complete NPC directory here makes every reward O(total NPCs)
    // and replaces unrelated runtime records.
    assertRuntimeObjectivesAndProgression(state);
    return state;
  }
  function inviteNpcDirective(name) {
    return `The player is inviting non-party NPC ${name} to join the party.
${name} must respond in-character in this reply.
If ${name} agrees to become a party member, include exactly this marker at the very end of the response: [INVITE_ACCEPTED: ${name}]
If ${name} refuses, delays, asks for conditions, or is interrupted before accepting, include exactly this marker at the very end of the response: [INVITE_DECLINED: ${name}]
Do not silently add ${name} to the party in state. The app handles party membership only after the explicit accepted marker.`;
  }
  async function inviteNpc(name) {
    if (app.state.characters?.[name]) {
      // Promoted objective/invite characters can leave a same-name NPC
      // shell behind for history. Inviting that shell must not silently
      // no-op after duplicate-name validation rejects it.
      showNotice("Already In Party", `${name} is already in the party.`);
      addGameMessage(`${name} is already in the party.`, "Game");
      return;
    }
    const npc = ensureNpcEntry(name);
    if (!npc) {
      showNotice("Invite Failed", `${name || "That NPC"} is not available to invite.`);
      addGameMessage(`${name || "That NPC"} is not available to invite.`, "Game");
      return;
    }
    if (npcIsDead(npc)) {
      showNotice("NPC Dead", `${npc.name || name} is dead and cannot be invited.`);
      addGameMessage(`${npc.name || name} is dead and cannot be invited.`, "Game");
      return;
    }
    if (!npc.inspected || !npc.full_character) {
      const full = await inspectNpc(name);
      if (full) return inviteNpc(name);
      return;
    }
    if (Object.keys(app.state.characters || {}).length >= 8) {
      showNotice("Party Full", "The party already has 8 characters. Remove someone before inviting another NPC.");
      addGameMessage(`${name} could not be invited because the party is full.`, "Game");
      return;
    }
    const message = await showPrompt(`Invite ${name}`, "You can write a normal message here as if you were writing it in the normal chat, but it will also include the invite.", "", {
      rows: 5,
      submitText: "Send Invite"
    });
    if (message == null) return;
    return submitNpcInvite(name, message);
  }
  function submitNpcInvite(name, message = "") {
    const targetName = resolveEntityName(name, app.state, String(name || "").trim());
    if (!targetName || isPlayerEntityName(targetName, app.state)) return false;
    const npc = ensureNpcEntry(targetName);
    if (npc) npc.ever_invited = true;
    app.pendingNpcInvite = {
      name: targetName,
      at: Date.now()
    };
    app.state.scene ||= {};
    app.state.scene.party_members_present = [...new Set([...(app.state.scene.party_members_present || []), targetName])];
    app.state.scene.npcs_present = [...new Set([...(app.state.scene.npcs_present || []), targetName])];
    scheduleActiveGameSave();
    render();
    const visibleText = String(message || "").trim() || `I invite ${targetName} to join my party.`;
    app.queue.push({
      text: visibleText,
      visibleText,
      skipUserStateCheck: false,
      commandOnly: false,
      source: "invite",
      speaker: app.state.player?.name || "Player",
      autoRead: !!app.settings.autoReadPlayerMessages,
      directive: inviteNpcDirective(targetName)
    });
    if (queueProcessingBlocked()) {
      setStatus(`Queued ${app.queue.length} message(s)`);
      render();
      return null;
    }
    processQueue();
    return null;
  }
  function npcCardHtml(name, npc, options = {}) {
    const character = npc?.full_character || null;
    if (!character) return "";
    const dead = npcIsDead(npc);
    const sceneCard = !!options.sceneCard;
    const adultMode = false;
    const showClothingControls = adultMode;
    const profile = activeProfileImage(character);
    const characterId = profileEntityCharacterId(character);
    const profilePending = profileImageRequestIsPending(name, character);
    const profileHtml = profile ? profileImageInnerHtml(profile) : profilePending ? imageLoadingHtml("") : "";
    const targetName = resolveEntityName(name, app.state, name);
    const isImageTarget = (app.state.scene?.image_characters || []).includes(targetName);
    const isPartyCharacter = !!app.state.characters?.[name];
    const isNearby = [...(app.state.scene?.npcs_present || []), ...(app.state.scene?.party_members_present || [])].includes(targetName);
    const age = Number(character.age || npc.age || 0);
    const presenceMode = options.presenceMode || "remove";
    const presenceButton = presenceMode === "none" ? "" : presenceMode === "toggle" ? `<button class="icon-button ${isNearby ? "party-on" : "party-off"}" title="${isNearby ? "Remove from scene" : "Add to scene"}" onclick="EmberAdventures.toggleNpcScenePresence(${htmlJsArg(name)})">&#128101;</button>` : `<button class="icon-button warn" title="Remove from scene" onclick="EmberAdventures.removeNpcFromScene(${htmlJsArg(name)})">X</button>`;
    return `
                <div class="character-card ${isNearby ? "active" : ""}" data-character-card data-character-name="${escapeHtml(name)}" ${characterId ? `data-character-id="${escapeHtml(characterId)}"` : ""} ${options.style ? `style="${escapeHtml(options.style)}"` : ""}>
                    <div class="character-name">
                        <span>${escapeHtml(name)}</span>
                        <span class="character-age">${dead ? "dead" : age ? age : "age ?"}</span>
                    </div>
                    <button class="profile-image-button" title="Open profile image picker" data-character-id="${escapeHtml(characterId)}" onclick="EmberAdventures.openProfileImageModal(${htmlJsArg(name)})">
                        ${profileHtml ? `<div class="profile-image-thumb-wrap" ${profile ? `data-profile-live-id="${escapeHtml(profile.id)}"` : ""}>${profileHtml}</div>` : `<div class="profile-image-placeholder" aria-label="No profile image"></div>`}
                    </button>
                    <div class="character-meta">${escapeHtml(character.role || npc.role || "local")}</div>
                    ${characterOutfitControlsHtml(name, character)}
                    ${app.settings.showAffectionStats !== false && !reducedUiEnabled() ? `<div class="meters love-stat-meters">
                        ${meter("trust", character.trust)}
                        ${meter("attraction", character.attraction)}
                        ${meter("affection", character.affection)}
                        ${""}
                    </div>` : ""}
                    <div class="icon-row">
                        ${presenceButton}
                        ${dead ? `<button class="icon-button" title="Restore NPC" onclick="EmberAdventures.restoreNpc(${htmlJsArg(name)}, ${htmlJsArg(options.locationId || "")})">&#8635;</button>` : ""}
                        ${dead ? "" : `<button class="icon-button ${isImageTarget ? "image-on" : "image-off"}" title="${isImageTarget ? "Remove from images" : isNearby ? "Include in images" : "Add to scene before including in images"}" data-character-action="image" data-character-name="${escapeHtml(targetName)}" ${!isNearby && !isImageTarget ? "disabled" : ""}>&#128247;</button>`}
                        <button class="icon-button" title="Edit NPC state" data-character-action="npc-edit" data-character-name="${escapeHtml(name)}" data-npc-location="${escapeHtml(options.locationId || "")}">&#9998;</button>
                        ${dead ? "" : `<button class="icon-button" title="NPC settings" onclick="EmberAdventures.openCharacterImageSettings(${htmlJsArg(name)})">&#9881;</button>
                        ${isPartyCharacter ? "" : `<button class="icon-button party-off" title="Invite to party" onclick="EmberAdventures.inviteNpc(${htmlJsArg(name)})">&#128233;</button>`}
                        ${sceneCard ? "" : `<button class="icon-button danger" title="Mark NPC dead" onclick="EmberAdventures.killNpc(${htmlJsArg(name)}, ${htmlJsArg(options.locationId || "")})">&#9760;</button>`}`}
                    </div>
                    ${""}
                </div>
            `;
  }
  function npcIsDead(npc = {}) {
    return String(npc?.status || "").trim().toLowerCase() === "dead";
  }
  function npcGenderLabel(npc = {}) {
    const gender = String(npc?.gender || npc?.full_character?.gender || "").trim();
    if (!gender) return "";
    if (/^(unknown|unspecified|null|blank|none|n\/a)$/i.test(gender)) return "";
    return gender;
  }
  function openNpcDetailModal(name) {
    const npc = getNpcEntry(name);
    if (!npc) return;
    const character = npc.full_character || null;
    openModal(`
                <h2>${escapeHtml(name)}</h2>
                <p class="hint">${escapeHtml(npc.gender || "unspecified")} / age ${escapeHtml(npc.age || character?.age || "adult")} / ${escapeHtml(npc.role || "local")} / ${escapeHtml(npc.relationship || "unknown")}</p>
                <p>${escapeHtml(npc.note || "")}</p>
                ${character ? npcCardHtml(name, npc, {
      style: "max-width: 34rem"
    }) : `<p class="hint">Not inspected yet.</p>`}
                <div class="row" style="margin-top: .8rem">
                    ${app.state.characters?.[name] ? "" : `<button class="good" onclick="EmberAdventures.inviteNpc(${htmlJsArg(name)})">Invite to Party</button>`}
                    <button onclick="EmberAdventures.openCharactersModal()">Characters</button>
                </div>
            `);
  }
  function shellNpcInputRow(id, label, value = "", multiline = false) {
    const safeId = escapeHtml(id);
    const safeValue = escapeHtml(value ?? "");
    const control = multiline ? `<textarea id="${safeId}" class="state-textarea" rows="2">${safeValue}</textarea>` : `<input id="${safeId}" value="${safeValue}" />`;
    return `
                <div class="friendly-field-row">
                    <label for="${safeId}">${escapeHtml(label)}</label>
                    ${control}
                </div>
            `;
  }
  function openNpcShellEditor(name, locationId = "") {
    const target = findNpcEntryExact(name, locationId) || (() => {
      const id = locationId || currentNpcLocationId();
      const npc = getNpcEntry(name, id);
      return npc ? {
        locationId: id,
        locationLabel: npcLocationLabel(app.state, id),
        key: name,
        npc
      } : null;
    })();
    if (!target?.npc) return;
    const npc = target.npc;
    const displayName = npc.name || target.key || name;
    openModal(`
                <div class="state-editor-tree" data-npc-shell-editor="1">
                    <p class="hint">This NPC has not been inspected yet. Editing these visible notes does not inspect the NPC or create a full character definition.</p>
                    ${shellNpcInputRow("npcShellName", "Name", displayName)}
                    ${shellNpcInputRow("npcShellGender", "Gender", npc.gender || "")}
                    ${shellNpcInputRow("npcShellAge", "Age", npc.age || "")}
                    ${shellNpcInputRow("npcShellRole", "Role", npc.role || "")}
                    ${shellNpcInputRow("npcShellRelationship", "Relationship", npc.relationship || "")}
                    ${shellNpcInputRow("npcShellStatus", "Status", npc.status || "alive")}
                    ${shellNpcInputRow("npcShellNote", "Note", npc.note || "", true)}
                    ${shellNpcInputRow("npcShellAppearance", "Current appearance", npc.current_appearance || "", true)}
                    ${shellNpcInputRow("npcShellDeathNote", "Death note", npc.death_note || "", true)}
                </div>
                <div class="row" style="margin-top: .8rem">
                    <button class="primary" onclick="EmberAdventures.saveNpcShellEditor(${htmlJsArg(target.key)}, ${htmlJsArg(target.locationId)})">Save</button>
                    <button onclick="EmberAdventures.closeModal()">Close</button>
                </div>
            `, {
      title: `Edit ${displayName}`
    });
    requestAnimationFrame(() => autosizeStateTextareas(document));
  }
  function saveNpcShellEditor(name, locationId = "") {
    const target = findNpcEntryExact(name, locationId);
    if (!target?.npc) return;
    const npc = target.npc;
    const oldKey = target.key;
    const oldName = npc.name || oldKey;
    const newName = textSlot($("npcShellName")?.value, oldName) || oldName;
    npc.name = newName;
    npc.gender = textSlot($("npcShellGender")?.value, npc.gender || "unspecified");
    npc.age = parseAdultAgeInput($("npcShellAge")?.value || npc.age, `NPC shell editor ${newName}.age`);
    npc.role = textSlot($("npcShellRole")?.value, npc.role || "local");
    npc.relationship = textSlot($("npcShellRelationship")?.value, npc.relationship || "unknown");
    npc.status = textSlot($("npcShellStatus")?.value, npc.status || "alive");
    npc.note = textSlot($("npcShellNote")?.value, "");
    npc.current_appearance = textSlot($("npcShellAppearance")?.value, "");
    npc.death_note = textSlot($("npcShellDeathNote")?.value, "");
    npc.inspected = false;
    delete npc.full_character;
    if (newName !== oldKey) {
      const location = app.state.npc_directory?.locations?.[target.locationId];
      if (location?.characters) {
        delete location.characters[oldKey];
        location.characters[newName] = npc;
      }
      app.state.scene ||= {};
      for (const listKey of ["npcs_present", "party_members_present", "image_characters"]) {
        replaceNameInArray(app.state.scene[listKey], oldKey, newName);
        replaceNameInArray(app.state.scene[listKey], oldName, newName);
      }
    }
    scheduleActiveGameSave();
    render();
    closeModal();
  }
  function editNpc(name, locationId = "") {
    const npc = getNpcEntry(name, locationId || currentNpcLocationId());
    if (!npc?.full_character) {
      openNpcShellEditor(name, locationId);
      return;
    }
    if (!npc?.full_character) return;
    let characterEditorBaseline = clone(npc.full_character);
    let directoryEditorBaseline = {
      name: npc.name || name,
      gender: npc.gender || npc.full_character.gender || "",
      age: npc.age || npc.full_character.age || "",
      role: npc.role || npc.full_character.role || "",
      relationship: npc.relationship || npc.full_character.relationship_to_player || "",
      note: npc.note || "",
      inspected: !!npc.inspected,
      status: npc.status || "alive",
      death_note: npc.death_note || ""
    };
    openModal(`
                <div id="npcFriendlyEditor" class="state-editor-tree" data-npc-name="${escapeHtml(name)}" data-npc-location="${escapeHtml(locationId || "")}">
                    ${buildCharacterDefinitionManagedEditor(npc.full_character, {
      entityLabel: name,
      npcDirectoryData: {
        name: npc.name || name,
        gender: npc.gender || npc.full_character.gender || "",
        age: npc.age || npc.full_character.age || "",
        role: npc.role || npc.full_character.role || "",
        relationship: npc.relationship || npc.full_character.relationship_to_player || "",
        note: npc.note || "",
        inspected: !!npc.inspected,
        status: npc.status || "alive",
        death_note: npc.death_note || ""
      }
    })}
                </div>
                <div class="row" style="margin-top: .8rem">
                    <button class="primary" onclick="EmberAdventures.generateDefaultProfileImageForCharacter(${htmlJsArg(name)})">Generate Default Image</button>
                    <button class="danger" onclick="EmberAdventures.deleteNpc(${htmlJsArg(name)}, ${htmlJsArg(locationId || "")})">Delete</button>
                    <button onclick="EmberAdventures.closeModal()">Close</button>
                </div>
            `, {
      title: `Edit ${name}`
    });
    bindStateEditorAutoSave("npcFriendlyEditor", () => {
      const currentNpc = getNpcEntry(name, locationId || currentNpcLocationId()) || npc;
      const beforeNpc = clone(currentNpc.full_character || npc.full_character || {});
      const nextDraft = readCharacterDefinitionManagedEditor(characterEditorBaseline, $("npcFriendlyEditor"));
      const draft = mergeEditorDraftChanges(characterEditorBaseline, currentNpc.full_character || npc.full_character, nextDraft);
      currentNpc.full_character = draft;
      const nextDirectoryDraft = readNpcDirectoryDataFromCharacterEditor($("npcFriendlyEditor"));
      const directoryData = mergeEditorDraftChanges(directoryEditorBaseline, {
        name: currentNpc.name || name,
        gender: currentNpc.gender || currentNpc.full_character.gender || "",
        age: currentNpc.age || currentNpc.full_character.age || "",
        role: currentNpc.role || currentNpc.full_character.role || "",
        relationship: currentNpc.relationship || currentNpc.full_character.relationship_to_player || "",
        note: currentNpc.note || "",
        inspected: !!currentNpc.inspected,
        status: currentNpc.status || "alive",
        death_note: currentNpc.death_note || ""
      }, nextDirectoryDraft);
      // SANITIZE REPLACED: NPC editor save validates only the edited
      // NPC shell/full-character pair and runtime NPC scene references.
      // SANITIZE TEST: Covered by runtime-narrow-sanitize-smoke and NPC editor/export smoke coverage.
      finalizeRuntimeNpcAfterEditor(currentNpc, name, directoryData);
      scheduleActiveGameSave();
      deferEditorProfileRefreshIfPromptInputsChanged(name, beforeNpc, currentNpc.full_character || draft, "NPC editor closed");
      characterEditorBaseline = clone(currentNpc.full_character || draft);
      directoryEditorBaseline = clone(directoryData);
    }, `edited NPC ${name}`, "NPC Autosave Failed");
  }
  function findNpcEntryExact(name, locationId = "") {
    const wanted = String(name || "").trim();
    if (!wanted) return null;
    const locations = app.state.npc_directory?.locations || {};
    const entries = locationId ? [[locationId, locations[locationId]]] : Object.entries(locations);
    for (const [id, location] of entries) {
      const characters = location?.characters || {};
      if (Object.prototype.hasOwnProperty.call(characters, wanted)) return {
        locationId: id,
        locationLabel: textSlot(location?.label, id),
        key: wanted,
        npc: characters[wanted]
      };
      for (const [key, npc] of Object.entries(characters)) {
        if (String(npc?.name || "") === wanted) return {
          locationId: id,
          locationLabel: textSlot(location?.label, id),
          key,
          npc
        };
      }
    }
    return null;
  }
  async function deleteNpc(name, locationId = "") {
    const target = findNpcEntryExact(name, locationId);
    if (!target) return;
    const displayName = target.npc?.name || target.key || name;
    if (!(await showConfirm("Delete NPC?", `Delete ${displayName} from known NPCs and remove that exact entry from the scene?`, {
      confirmText: "Delete",
      danger: true
    }))) return;
    const location = app.state.npc_directory?.locations?.[target.locationId];
    if (location?.characters) delete location.characters[target.key];
    app.state.scene ||= {};
    const exactNames = new Set([String(name || ""), String(target.key || ""), String(displayName || "")].filter(Boolean));
    for (const key of ["party_members_present", "image_characters", "npcs_present"]) {
      app.state.scene[key] = (app.state.scene[key] || []).filter(item => !exactNames.has(String(item || "")));
    }
    // SANITIZE REPLACED: deleting an NPC should only normalize NPC directory and scene/speak/image references.
    // SANITIZE TEST: Covered by runtime-narrow-sanitize-smoke for the relevant narrow validator; add a workflow-specific assertion if this call changes again.
    assertRuntimeNpcReferences(app.state);
    scheduleActiveGameSave();
    closeModal();
    render();
  }
  async function killNpc(name, locationId = "") {
    const target = findNpcEntryExact(name, locationId);
    if (!target) return;
    const displayName = target.npc?.name || target.key || name;
    if (app.state.characters?.[displayName] || app.state.characters?.[target.key]) {
      showNotice("Party Member", "Party members cannot be killed from the NPC directory.");
      return;
    }
    if (!(await showConfirm("Kill NPC?", `Mark ${displayName} as killed by the player, remove them from the current scene, and let the AI decide loot?`, {
      confirmText: "Mark Dead",
      danger: true
    }))) return;
    const deathNote = `Died during the story.`;
    target.npc.status = "dead";
    target.npc.relationship = "dead";
    target.npc.death_note = deathNote;
    target.npc.killed_by = app.state.player?.name || "Player";
    target.npc.killed_by_player = true;
    target.npc.kill_reward_applied = false;
    target.npc.note = target.npc.note ? `${target.npc.note} Dead.` : "Dead.";
    traceNpcDeathFlagChange({}, target.npc, {
      source: "manual kill",
      name: displayName
    });
    if (target.npc.full_character) {
      target.npc.full_character.physical_state = "dead";
      target.npc.full_character.state_of_mind = "dead";
      target.npc.full_character.pose = "dead";
    }
    app.state.scene ||= {};
    const exactNames = new Set([String(name || ""), String(target.key || ""), String(displayName || "")].filter(Boolean));
    for (const key of ["party_members_present", "image_characters", "npcs_present"]) {
      app.state.scene[key] = (app.state.scene[key] || []).filter(item => !exactNames.has(String(item || "")));
    }
    if (!app.state.scene.party_members_present?.length) app.state.scene.party_members_present = ["Player"];
    if (!app.state.scene.image_characters?.length) app.state.scene.image_characters = [app.state.scene.party_members_present[0] || "Player"];
    app.state.recent_changes = [`${displayName} was killed by ${app.state.player?.name || "the player"}.`, ...(app.state.recent_changes || [])].slice(0, 8);
    const killReward = await applyPlayerKillRewards(target.npc, {
      name: displayName,
      locationLabel: target.locationLabel
    });
    // SANITIZE REPLACED: marking NPC dead should only normalize NPC status, rewards, and scene references.
    // SANITIZE TEST: Covered by runtime-narrow-sanitize-smoke for the relevant narrow validator; add a workflow-specific assertion if this call changes again.
    assertRuntimeNpcReferences(app.state);
    assertRuntimeObjectivesAndProgression(app.state);
    addGameMessage(playerKillGameMessage(displayName, killReward), "Game");
    scheduleActiveGameSave();
    closeModal();
    render();
  }
  async function restoreNpc(name, locationId = "") {
    const target = findNpcEntryExact(name, locationId);
    if (!target) return;
    const displayName = target.npc?.name || target.key || name;
    if (!npcIsDead(target.npc)) return;
    if (!(await showConfirm("Restore NPC?", `Restore ${displayName} to alive status and clear death flags? Already-awarded kill rewards will stay marked as applied.`, {
      confirmText: "Restore"
    }))) return;
    const before = clone(target.npc);
    target.npc.status = "alive";
    target.npc.relationship = String(target.npc.relationship || "").trim().toLowerCase() === "dead" ? "unknown" : target.npc.relationship || "unknown";
    target.npc.death_note = "";
    target.npc.killed_by = "";
    target.npc.killed_by_player = false;
    if (target.npc.full_character) {
      if (String(target.npc.full_character.physical_state || "").trim().toLowerCase() === "dead") target.npc.full_character.physical_state = "";
      if (String(target.npc.full_character.state_of_mind || "").trim().toLowerCase() === "dead") target.npc.full_character.state_of_mind = "";
      if (String(target.npc.full_character.pose || "").trim().toLowerCase() === "dead") target.npc.full_character.pose = "";
    }
    app.state.recent_changes = [`${displayName} was restored to alive status.`, ...(app.state.recent_changes || [])].slice(0, 8);
    traceNpcDeathFlagChange(before, target.npc, {
      source: "manual restore",
      name: displayName
    });
    // SANITIZE REPLACED: restoring NPC should only normalize NPC status and scene references.
    // SANITIZE TEST: Covered by runtime-narrow-sanitize-smoke for the relevant narrow validator; add a workflow-specific assertion if this call changes again.
    assertRuntimeNpcReferences(app.state);
    scheduleActiveGameSave();
    closeModal();
    render();
  }
  function acceptObjectiveSuggestion(suggestionId) {
    app.state.objectives ||= {
      active_id: "",
      focus_id: "",
      items: [],
      suggestions: []
    };
    const suggestions = app.state.objectives.suggestions || [];
    const index = suggestions.findIndex(item => String(item.id) === String(suggestionId));
    if (index < 0) return;
    const suggestion = suggestions[index];
    const id = objectiveIdFromTitle(suggestion.title, suggestion.id || "side-objective");
    const objective = {
      id,
      title: suggestion.title || "Suggested objective",
      type: "side",
      status: "active",
      summary: suggestion.reason || suggestion.title || "",
      completion_control: "player",
      completion_criteria: suggestion.reason || suggestion.title || "",
      completion_instruction: "",
      requires: [],
      exclusive_group: "",
      selectable: false,
      available_now: true,
      blocked_reason: "",
      notes: [],
      rewards: [],
      travel_location_id: "",
      travel_location_name: ""
    };
    if (!(app.state.objectives.items || []).some(item => String(item.id) === id)) app.state.objectives.items.push(objective);
    app.state.objectives.focus_id = id;
    suggestions.splice(index, 1);
    reconcileStoryRuntimeState(app.state, "accepted objective suggestion");
    scheduleActiveGameSave();
    openObjectivePickerModal();
    render();
  }
  
