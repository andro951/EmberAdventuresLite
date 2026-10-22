
        function isPlainObject(value) {
            return value && typeof value === "object" && !Array.isArray(value);
        }
        function repairAiStoryInventory(input = {}) {
            const source = isPlainObject(input) ? input : {};
            const out = {};
            for (const [key, value] of Object.entries(source)) {
                if (key === "items") continue;
                if (typeof value === "number") out[key] = Number.isFinite(value) ? value : 0;
                else if (typeof value === "boolean") out[key] = value;
                else if (Array.isArray(value)) out[key] = stringListSlot(value, []);
                else if (value != null && typeof value !== "object") out[key] = String(value);
            }
            out.coins = Math.max(0, Math.floor(Number(out.coins ?? source.coins ?? 0) || 0));
            out.adventurer_xp = Math.max(
                0,
                Math.floor(Number(out.adventurer_xp ?? source.adventurer_xp ?? 0) || 0),
            );
            out.adventurer_rank = Math.max(
                0,
                Math.floor(Number(out.adventurer_rank ?? source.adventurer_rank ?? 0) || 0),
            );
            out.items = Array.isArray(source.items)
                ? source.items.map(repairAiStoryInventoryItem).filter(Boolean)
                : [];
            return out;
        }

        function repairAiStoryInventoryItem(item = {}) {
            if (typeof item === "string") {
                const name = textSlot(item, "");
                if (!name) return null;
                return {
                    id: objectiveIdFromTitle(name, "story-item"),
                    name,
                    type: "loot",
                    quantity: 1,
                    value: 0,
                    sellable: true,
                    quest_item: false,
                    description: "",
                    image_prompt: "",
                    image_id: "",
                };
            }
            if (!isPlainObject(item)) return null;
            const name = textSlot(item.name || item.title || item.item, "");
            if (!name) return null;
            const quantity = Math.max(1, Math.floor(Number(item.quantity ?? item.count ?? 1) || 1));
            const image = runtimeStoryImageSlotFromExactInput(item.image, {
                image_prompt: item.image_prompt || item.prompt,
                image_id: item.image_id || item.local_image_id,
            });
            return {
                id:
                    textSlot(item.id, "") ||
                    `${objectiveIdFromTitle(name, "story-item")}-${stableStringHash(name)}`,
                name,
                type: textSlot(item.type, item.quest_item ? "quest" : "loot"),
                quantity,
                value: Math.max(0, Math.floor(Number(item.value ?? item.price ?? 0) || 0)),
                sellable: item.sellable !== false && item.quest_item !== true,
                quest_item: item.quest_item === true || String(item.type || "") === "quest",
                description: textSlot(item.description || item.summary || item.note, ""),
                image_prompt: textSlot(
                    item.image_prompt || item.prompt || image?.prompt,
                    "",
                ),
                image_id: textSlot(
                    item.image_id || item.local_image_id || image?.local_image_id,
                    "",
                ),
                ...(image ? { image } : {}),
            };
        }

        function repairAiStoryShops(input = {}) {
            const source = isPlainObject(input) ? input : {};
            const out = {};
            for (const [key, value] of Object.entries(source)) {
                if (!isPlainObject(value)) continue;
                const id = textSlot(value.id, key);
                if (!id) continue;
                const type = String(value.type || "character").toLowerCase().trim();
                if (!["character", "job", "general", "clothing"].includes(type)) continue;
                out[id] = {
                    id,
                    title: textSlot(value.title || value.name, id),
                    type,
                    subtype: textSlot(value.subtype || value.label, type === "job" ? "Job Board" : "Shop"),
                    description: textSlot(value.description || value.summary, ""),
                    unlocked: value.unlocked !== false,
                    currency: textSlot(value.currency, type === "job" ? "none" : "coins"),
                    ...(type === "character"
                        ? {
                              cost_template_id: textSlot(value.cost_template_id, ""),
                              purchase_verb: textSlot(value.purchase_verb, ""),
                               purchase_completed_verb: textSlot(
                                   value.purchase_completed_verb,
                                   "",
                               ),
                               purchase_mode: ["acquire", "service"].includes(
                                   String(value.purchase_mode || "").trim().toLowerCase(),
                               )
                                   ? String(value.purchase_mode).trim().toLowerCase()
                                   : "acquire",
                               repeatable: value.repeatable === true,
                               post_purchase_presence:
                                   String(value.post_purchase_presence || "current_scene") === "roster"
                                       ? "roster"
                                      : "current_scene",
                          }
                        : {}),
                    ...(type === "general"
                        ? {
                              markup: Number.isFinite(Number(value.markup))
                                  ? Math.max(1, Number(value.markup))
                                  : 2,
                              buying: {
                                  enabled: value.buying?.enabled !== false,
                                  quest_items_rejected:
                                      value.buying?.quest_items_rejected !== false,
                              },
                          }
                        : {}),
                    location: extractLocation(value.location || {}),
                    npc_location_id: textSlot(
                        value.npc_location_id || value.location?.npc_location_id,
                        "",
                    ),
                    owner_npc_id: textSlot(value.owner_npc_id || value.owner || value.owner_id, ""),
                    visible_count: Number.isFinite(Number(value.visible_count))
                        ? Number(value.visible_count)
                        : 5,
                    generic_jobs_enabled: value.generic_jobs_enabled !== false,
                    items: Array.isArray(value.items)
                        ? value.items.map((item) => repairAiStoryShopItem(item, type)).filter(Boolean)
                        : [],
                };
            }
            return out;
        }

        function repairAiStoryShopItem(item = {}, shopType = "character") {
            if (!isPlainObject(item)) return null;
            if (shopType === "job") {
                const id = textSlot(item.id || item.job_id || item.template_id, "");
                return {
                    id,
                    story_job_id: id,
                    template_id: textSlot(item.template_id, ""),
                    title: textSlot(item.title || item.name, id),
                    summary: textSlot(item.summary || item.description, ""),
                    rank: Math.max(0, Math.floor(Number(item.rank || 0) || 0)),
                    genres: approvedGenreList(item.genres || item.genre || []),
                    reward_coins: Math.max(0, Math.floor(Number(item.reward_coins ?? item.coins ?? 0) || 0)),
                    reward_xp: Math.max(0, Math.floor(Number(item.reward_xp ?? item.adventurer_xp ?? 0) || 0)),
                    reward_items: Array.isArray(item.reward_items)
                        ? item.reward_items.map(repairAiStoryInventoryItem).filter(Boolean)
                        : [],
                    client_npc_id: textSlot(item.client_npc_id || item.client || item.npc_id, ""),
                    start_location: extractLocation(item.start_location || item.location || {}),
                    locked: item.locked === true,
                    unlock_reason: textSlot(item.unlock_reason || item.locked_reason || item.reason, ""),
                    accepted: item.accepted === true,
                    completed: item.completed === true,
                    requirements: repairAiStructuredRequirements(item.requirements),
                    completion_criteria: textSlot(item.completion_criteria, ""),
                    completion_instruction: textSlot(item.completion_instruction, ""),
                };
            }
            if (shopType === "general") {
                const inventoryItem = repairAiStoryInventoryItem(item.item || item);
                if (!inventoryItem) return null;
                return {
                    id: textSlot(item.id, inventoryItem.id),
                    title: textSlot(item.title || item.name, inventoryItem.name),
                    summary: textSlot(item.summary || item.description, inventoryItem.description),
                    quantity: Number.isFinite(Number(item.quantity))
                        ? Math.max(0, Math.floor(Number(item.quantity)))
                        : null,
                    purchase_count: Math.max(
                        0,
                        Math.floor(Number(item.purchase_count || 0) || 0),
                    ),
                    locked: item.locked === true,
                    unlock_reason: textSlot(item.unlock_reason || item.locked_reason || item.reason, ""),
                    requirements: repairAiStructuredRequirements(item.requirements),
                    rewards: extractObjectiveRewards(item.rewards),
                    item: inventoryItem,
                };
            }
            if (shopType === "clothing") {
                const outfit = repairAiOutfitRecord(item.outfit || item, 0);
                if (!outfit) return null;
                const image = runtimeStoryImageSlotFromExactInput(
                    item.image || outfit.image,
                    {
                        image_prompt:
                            item.image_prompt ||
                            item.prompt ||
                            outfit.image_prompt,
                        image_id:
                            item.image_id ||
                            item.local_image_id ||
                            outfit.image_id,
                    },
                );
                return {
                    id: textSlot(item.id, outfit.id),
                    title: textSlot(item.title || item.name, outfit.name),
                    summary: textSlot(item.summary || item.description, ""),
                    price: Math.max(1, Math.floor(Number(item.price || 0) || 0)),
                    target: textSlot(item.target, "any"),
                    locked: item.locked === true,
                    unlock_reason: textSlot(item.unlock_reason || item.locked_reason || item.reason, ""),
                    requirements: repairAiStructuredRequirements(item.requirements),
                    outfit: {
                        ...outfit,
                        image_prompt: textSlot(
                            item.image_prompt || item.prompt || outfit.image_prompt,
                            "",
                        ),
                        image_id: textSlot(
                            item.image_id || item.local_image_id || outfit.image_id,
                            "",
                        ),
                        ...(image ? { image } : {}),
                    },
                };
            }
            const characterId = textSlot(item.character_id || item.future_character_id || item.id, "");
            if (!characterId) return null;
            return {
                 character_id: characterId,
                 price: Math.max(0, Math.floor(Number(item.price || 0) || 0)),
                 purchased: item.purchased === true,
                 purchase_count: Math.max(
                     0,
                     Math.floor(Number(item.purchase_count || 0) || 0),
                 ),
                 removed: item.removed === true,
                 purchase_mode: ["acquire", "service"].includes(
                     String(item.purchase_mode || "").trim().toLowerCase(),
                 )
                     ? String(item.purchase_mode).trim().toLowerCase()
                     : "",
                 repeatable:
                     typeof item.repeatable === "boolean"
                         ? item.repeatable
                         : null,
                 locked: item.locked === true,
                unlock_reason: textSlot(item.unlock_reason || item.locked_reason || item.reason, ""),
                requirements: repairAiStructuredRequirements(item.requirements),
                 on_purchase_objective: textSlot(
                     item.on_purchase_objective ||
                         item.purchase_story_objective ||
                        item.purchase_objective ||
                        item.purchase_story ||
                        item.character_story_objective ||
                        item.character_story ||
                         item.objective_id,
                     "",
                 ),
                 ...(isPlainObject(item.purchase_opening)
                     ? {
                           purchase_opening: {
                               dialogue: textSlot(item.purchase_opening.dialogue, ""),
                               guidance: textSlot(item.purchase_opening.guidance, ""),
                           },
                       }
                     : {}),
             };
        }

        function repairAiCharacterShopCostTemplates(input = {}) {
            const out = {};
            for (const [id, value] of Object.entries(isPlainObject(input) ? input : {})) {
                if (!isPlainObject(value)) continue;
                out[id] = {
                    type: textSlot(value.type, "").toLowerCase(),
                    costs: Array.isArray(value.costs)
                        ? value.costs.filter(isPlainObject).map((cost) => ({
                              label: textSlot(cost.label, ""),
                              available_expression: clone(cost.available_expression),
                              op: textSlot(cost.op, ">="),
                              required_stat: textSlot(cost.required_stat, ""),
                          }))
                        : [],
                    effects: Array.isArray(value.effects)
                        ? value.effects.filter(isPlainObject).map((effect) => ({
                              label: textSlot(effect.label, ""),
                              operation: textSlot(effect.operation, "").toLowerCase(),
                              field_path: Array.isArray(effect.field_path) ? effect.field_path.map(String) : [],
                              value_stat: textSlot(effect.value_stat, ""),
                          }))
                        : [],
                };
            }
            return out;
        }

        function repairAiStructuredRequirements(requirements = []) {
            return Array.isArray(requirements)
                ? requirements
                      .map((requirement) => {
                          if (typeof requirement === "string") {
                              const match = requirement.match(/^(.+?)\s*(>=|<=|!==|!=|===|==|=|>|<)\s*(.+)$/);
                              if (!match) return null;
                              return {
                                  path: match[1].trim(),
                                  op: match[2] === "=" ? "==" : match[2],
                                  value: parseRequirementLiteral(match[3].trim()),
                              };
                          }
                          if (!isPlainObject(requirement)) return null;
                          const type = textSlot(requirement.type, "").toLowerCase();
                          if (type) {
                              const normalized = {
                                  type,
                                  id: textSlot(
                                      requirement.id || requirement.rule_id ||
                                          requirement.fact_id || requirement.fact,
                                      "",
                                  ),
                                  target: textSlot(
                                      requirement.target ||
                                          requirement.character ||
                                          requirement.name,
                                      "",
                                  ),
                                  path: "",
                                  op: textSlot(requirement.op || requirement.operator, "truthy"),
                                  value: requirement.value,
                              };
                              if (type === "currency" || type === "story_inventory") {
                                  const currencyPath = textSlot(
                                      requirement.path ||
                                          requirement.field_path ||
                                          requirement.currency ||
                                          requirement.id,
                                      "",
                                  );
                                  if (!currencyPath) return null;
                                  return {
                                      path: repairAiStoryPathText(currencyPath),
                                      op: normalized.op,
                                      value: requirement.value,
                                  };
                              }
                              if (
                                  [
                                      "story_rule",
                                      "known_fact",
                                      "durable_known_fact",
                                      "party_member",
                                      "character_alive",
                                      "character_dead",
                                      "objective_complete",
                                      "objective_not_complete",
                                  ].includes(type)
                              )
                                  return normalized;
                          }
                          const path = Array.isArray(requirement.path)
                              ? requirement.path.join(".")
                              : textSlot(requirement.path || requirement.field_path, "");
                          const op = textSlot(requirement.op || requirement.operator, "truthy");
                          if (!path) return null;
                          return {
                              path,
                              op,
                              value: requirement.value,
                          };
                      })
                      .filter(Boolean)
                : [];
        }

        function parseRequirementLiteral(text = "") {
            const raw = String(text || "").replace(/^["']|["']$/g, "");
            if (/^-?\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
            if (/^(true|false)$/i.test(raw)) return /^true$/i.test(raw);
            return raw;
        }

        function repairAiStoryJobOffers(input = {}) {
            const source = isPlainObject(input) ? input : {};
            const out = {};
            for (const [boardId, offers] of Object.entries(source)) {
                if (!Array.isArray(offers)) continue;
                out[boardId] = offers
                    .map((offer) => (isPlainObject(offer) ? {
                        offer_id: textSlot(offer.offer_id || offer.id, ""),
                        template_id: textSlot(offer.template_id, ""),
                        title: textSlot(offer.title, ""),
                        rank: Math.max(0, Math.floor(Number(offer.rank || 0) || 0)),
                        romanceable: offer.romanceable === true,
                        genres: approvedGenreList(offer.genres || []),
                        summary: textSlot(offer.summary, ""),
                        reward_coins: Math.max(0, Math.floor(Number(offer.reward_coins || 0) || 0)),
                        reward_xp: Math.max(0, Math.floor(Number(offer.reward_xp || 0) || 0)),
                        filled_values: isPlainObject(offer.filled_values) ? clone(offer.filled_values) : {},
                        accepted: offer.accepted === true,
                    } : null))
                    .filter((offer) => offer?.offer_id && offer.template_id);
            }
            return out;
        }

        function repairAiStoryJobOfferHistory(input = {}) {
            const source = isPlainObject(input) ? input : {};
            const out = {};
            for (const [boardId, value] of Object.entries(source)) {
                out[boardId] = {
                    recent_template_ids: stringListSlot(value?.recent_template_ids, []),
                };
            }
            return out;
        }

        function repairAiActiveGeneratedJobs(input = {}) {
            const source = isPlainObject(input) ? input : {};
            const out = {};
            for (const [jobId, value] of Object.entries(source)) {
                if (!isPlainObject(value)) continue;
                out[jobId] = {
                    id: textSlot(value.id, jobId),
                    source: textSlot(value.source, "generated"),
                    story_job_id: textSlot(value.story_job_id || value.storyJobId, ""),
                    template_id: textSlot(value.template_id, ""),
                    board_id: textSlot(value.board_id, ""),
                    offer_id: textSlot(value.offer_id, ""),
                    title: textSlot(value.title, "Generated Job"),
                    filled_values: isPlainObject(value.filled_values) ? clone(value.filled_values) : {},
                    objective_ids: stringListSlot(value.objective_ids, []),
                    rewards: isPlainObject(value.rewards) ? clone(value.rewards) : {},
                    status: textSlot(value.status, "active"),
                    accepted_at: textSlot(value.accepted_at, ""),
                };
            }
            return out;
        }

        function repairAiStoryGeneratedNpcPool(input = {}) {
            const source = isPlainObject(input) ? input : {};
            const out = {};
            for (const [key, value] of Object.entries(source)) {
                if (!isPlainObject(value)) continue;
                const name = textSlot(value.name, "");
                if (!name) continue;
                out[key] = {
                    npc_id: textSlot(value.npc_id || value.id, objectiveIdFromTitle(name, "generated-npc")),
                    name,
                    location: textSlot(value.location, ""),
                    role: textSlot(value.role, ""),
                    created_at: textSlot(value.created_at, ""),
                };
            }
            return out;
        }

        function stableStringHash(text = "") {
            let hash = 2166136261;
            for (let i = 0; i < String(text).length; i += 1) {
                hash ^= String(text).charCodeAt(i);
                hash = Math.imul(hash, 16777619);
            }
            return String(Math.abs(hash >>> 0));
        }
        function clamp100(v) {
            if (typeof v !== "number" || !Number.isFinite(v))
                throw new Error("Percent calculation must be a finite number.");
            return Math.max(0, Math.min(100, v));
        }
        function strictFiniteNumber(value) {
            if (typeof value === "number") return Number.isFinite(value) ? value : null;
            if (typeof value !== "string") return null;
            const text = value.trim();
            if (!text || !/^-?(?:\d+\.?\d*|\.\d+)$/.test(text)) return null;
            const number = Number(text);
            return Number.isFinite(number) ? number : null;
        }
        function clamp10(v) {
            if (typeof v !== "number" || !Number.isFinite(v))
                throw new Error("State scale calculation must be a finite number.");
            return Math.max(0, Math.min(10, v));
        }
        function exactState10(v, path = "state scale") {
            if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 10)
                throw new Error(`${path} must be a finite number from 0 through 10.`);
            return v;
        }
        function repairAiState10(v, fallback = 0) {
            const numeric = typeof v === "number"
                ? v
                : typeof v === "string" && /^-?(?:\d+\.?\d*|\.\d+)$/.test(v.trim())
                  ? Number(v)
                  : fallback;
            return clamp10(Number.isFinite(numeric) ? numeric : fallback);
        }
        function parseState10Input(value, path = "state scale") {
            const parsed = typeof value === "number"
                ? value
                : typeof value === "string" && /^-?(?:\d+\.?\d*|\.\d+)$/.test(value.trim())
                  ? Number(value)
                  : Number.NaN;
            return exactState10(parsed, path);
        }
        function stateScaleToPercent(v) {
            return Math.round(exactState10(v) * 10);
        }
        function stateScaleFromPercent(v) {
            return Math.round(clamp100(v)) / 10;
        }
        function repairAiAge(value, fallback = 18) {
            const age = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
            return Math.max(
                0,
                Math.round(Number.isFinite(age) && age > 0 ? age : fallback),
            );
        }
        function fallbackAdultAgeForContext(...parts) {
            // Age fallback rule: AI examples and engine-created repair NPCs must not
            // all collapse to one "safe adult" age. Use a deterministic varied age
            // from stable context instead of a sticky literal such as 25.
            const seed = parts
                .flat()
                .map((part) => String(part || "").trim())
                .filter(Boolean)
                .join("|") || "emberadventures adult";
            let hash = 2166136261;
            for (let i = 0; i < seed.length; i += 1) {
                hash ^= seed.charCodeAt(i);
                hash = Math.imul(hash, 16777619);
            }
            return 22 + (Math.abs(hash) % 24);
        }
        function repairAiAdultAge(value, ...contextParts) {
            return Math.max(
                18,
                repairAiAge(value, fallbackAdultAgeForContext(...contextParts)),
            );
        }

        function exactAdultAge(value, path = "age") {
            if (!Number.isSafeInteger(value) || value < 18)
                throw new Error(`${path} must be a whole number of at least 18.`);
            return value;
        }

        function parseAdultAgeInput(value, path = "age") {
            const parsed = typeof value === "number"
                ? value
                : typeof value === "string" && /^\d+$/.test(value.trim())
                  ? Number(value)
                  : Number.NaN;
            return exactAdultAge(parsed, path);
        }
        function firstCharacterNameFromState(state) {
            return Object.keys(state.characters || {})[0] || "Narrator";
        }
        function firstCharacterName() {
            return firstCharacterNameFromState(app.state);
        }
        function allNpcNamesFromState(state = app.state) {
            return [
                ...new Set(
                    Object.values(state?.npc_directory?.locations || {}).flatMap(
                        (location) => Object.keys(location.characters || {}),
                    ),
                ),
            ];
        }
        function isPlayerEntityName(value, state = app.state) {
            const text = String(value || "").trim();
            if (!text) return false;
            const normalized = normalizeNameForMatch(text);
            const playerDisplayName = String(state?.player?.name || "").trim();
            const playerName = normalizeNameForMatch(playerDisplayName);
            return (
                normalized === "player" ||
                normalized === "main character" ||
                normalized === "protagonist" ||
                normalized === "hero" ||
                (!!playerName && normalized === playerName) ||
                !!findDuplicateCharacterName(text, [playerDisplayName])
            );
        }
        function reservedNpcNameStateLabelSet() {
            if (!reservedNpcNameStateLabelSet.value) {
                reservedNpcNameStateLabelSet.value = new Set(
                    [
                        "meta",
                        "location",
                        "world_map",
                        "npc_directory",
                        "time",
                        "scene",
                        "player",
                        "characters",
                        "world_flags",
                        "progression",
                        "objectives",
                        "story_memory",
                        "recent_changes",
                        "story_source",
                        "starting_cast_policy",
                        "player_preferences",
                        "party_members_present",
                        "image_characters",
                        "npcs_present",
                        "image_action",
                        "state",
                        "patch",
                        "value",
                        "values",
                    ].map(normalizeNameForMatch),
                );
            }
            return reservedNpcNameStateLabelSet.value;
        }
        function isReservedStateLabelName(value) {
            const text = String(value || "").trim();
            if (!text) return false;
            const normalized = normalizeNameForMatch(text);
            const reservedNpcNameStateLabels = reservedNpcNameStateLabelSet();
            if (reservedNpcNameStateLabels.has(normalized)) return true;
            const pathParts = text
                .split(/[/.\\|>]+/)
                .map(normalizeNameForMatch)
                .filter(Boolean);
            return pathParts.some((part) => reservedNpcNameStateLabels.has(part));
        }
        function isInvalidNpcName(value, state = app.state, options = {}) {
            return (
                isPlayerEntityName(value, state) ||
                isReservedStateLabelName(value) ||
                isPartyCharacterName(value, state) ||
                (!options.allowFutureCast && isFutureCastName(value, state)) ||
                !!findDuplicateNonNpcPersonName(value, state)
            );
        }
        function isInvalidStoredNpcName(value, state = app.state, options = {}) {
            const normalized = normalizeNameForMatch(value);
            if (!normalized || isReservedStateLabelName(value)) return true;
            if (
                [
                    "player",
                    "main character",
                    "protagonist",
                    "hero",
                    state?.player?.name,
                ]
                    .map(normalizeNameForMatch)
                    .filter(Boolean)
                    .includes(normalized)
            )
                return true;
            if (isPartyCharacterName(value, state)) return true;
            if (
                !options.allowFutureCast &&
                futureCastNamesFromState(state).some(
                    (name) => normalizeNameForMatch(name) === normalized,
                )
            )
                return true;
            return false;
        }
        function isInvalidGeneratedPersonName(value) {
            const text = String(value || "").trim();
            if (!text) return true;
            if (text.includes("_")) return true;
            if (!/[A-Z]/.test(text)) return true;
            if (/^[a-z]/.test(text)) return true;
            const words = text.split(/\s+/).filter(Boolean);
            if (words.length !== 2) return true;
            if (words.some((word) => !/^[A-Z][A-Za-z'-]*$/.test(word))) return true;
            if (words.some((word) => generatedPersonNameForbiddenWords().has(normalizeNameForMatch(word)))) return true;
            if (isUnknownPlaceholderPersonName(text)) return true;
            if (isGenericRoleName(text)) return true;
            return false;
        }

        function generatedPersonNameForbiddenWords() {
            if (!generatedPersonNameForbiddenWords.value) {
                // GENERATED_PERSON_NAME_FORBIDDEN_WORDS: generated NPC/speaker
                // names must be exactly two proper-name words, and neither word
                // may be a generic role, title, species, placeholder, or state label.
                generatedPersonNameForbiddenWords.value = new Set(
                    [
                        "able",
                        "acolyte",
                        "adult",
                        "adventurer",
                        "advisor",
                        "agent",
                        "alchemist",
                        "ally",
                        "ambusher",
                        "animal",
                        "apothecary",
                        "apprentice",
                        "archer",
                        "armorer",
                        "artisan",
                        "assassin",
                        "assistant",
                        "attacker",
                        "aunt",
                        "baker",
                        "bandit",
                        "barbarian",
                        "bard",
                        "barmaid",
                        "baron",
                        "baroness",
                        "bartender",
                        "beast",
                        "beastkin",
                        "beggar",
                        "berserker",
                        "blacksmith",
                        "boy",
                        "brother",
                        "brute",
                        "butcher",
                        "captain",
                        "caravaner",
                        "cashier",
                        "champion",
                        "character",
                        "child",
                        "citizen",
                        "civilian",
                        "clerk",
                        "coachman",
                        "commander",
                        "commoner",
                        "companion",
                        "cook",
                        "courier",
                        "courtier",
                        "creature",
                        "cultist",
                        "customer",
                        "dancer",
                        "dealer",
                        "demon",
                        "doctor",
                        "dragon",
                        "druid",
                        "duelist",
                        "dwarf",
                        "elder",
                        "elf",
                        "enemy",
                        "escort",
                        "farmer",
                        "fighter",
                        "foreman",
                        "friend",
                        "gatekeeper",
                        "giant",
                        "girl",
                        "goblin",
                        "guard",
                        "guardsman",
                        "guardswoman",
                        "guide",
                        "guild",
                        "healer",
                        "herbalist",
                        "hero",
                        "highwayman",
                        "human",
                        "hunter",
                        "innkeeper",
                        "inspector",
                        "jailer",
                        "kid",
                        "king",
                        "knight",
                        "laborer",
                        "lady",
                        "leader",
                        "lord",
                        "mage",
                        "maid",
                        "man",
                        "matron",
                        "medic",
                        "mercenary",
                        "merchant",
                        "messenger",
                        "monk",
                        "monster",
                        "mother",
                        "mugger",
                        "nameless",
                        "narrator",
                        "noble",
                        "nobleman",
                        "noblewoman",
                        "novice",
                        "nun",
                        "officer",
                        "ogre",
                        "orc",
                        "outlaw",
                        "patron",
                        "person",
                        "priest",
                        "priestess",
                        "prince",
                        "princess",
                        "prisoner",
                        "proprietor",
                        "queen",
                        "raider",
                        "ranger",
                        "receptionist",
                        "refugee",
                        "registrar",
                        "retainer",
                        "rider",
                        "rogue",
                        "runner",
                        "sage",
                        "scout",
                        "servant",
                        "shopgirl",
                        "shopkeeper",
                        "sister",
                        "slime",
                        "smith",
                        "soldier",
                        "speaker",
                        "spy",
                        "stranger",
                        "student",
                        "supplier",
                        "tailor",
                        "teacher",
                        "teen",
                        "teenager",
                        "thief",
                        "thug",
                        "townsman",
                        "townswoman",
                        "trainer",
                        "traveler",
                        "tutor",
                        "uncle",
                        "unknown",
                        "vendor",
                        "villager",
                        "waiter",
                        "waitress",
                        "warden",
                        "warrior",
                        "watcher",
                        "watchman",
                        "watchwoman",
                        "witch",
                        "wizard",
                        "woman",
                        "worker",
                        "youth",
                    ].map(normalizeNameForMatch),
                );
            }
            return generatedPersonNameForbiddenWords.value;
        }

        function isUnknownPlaceholderPersonName(value = "") {
            const normalized = String(value || "")
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9 ]+/g, " ")
                .replace(/\s+/g, " ")
                .trim();
            // Any generated NPC name containing "unknown" is a placeholder, not a
            // person. If an offscreen/unquoted person is not important enough for a
            // real proper name, do not persist them as an NPC; if they are important,
            // the metadata must name them.
            return (
                /\bunknown\b/i.test(normalized) ||
                /^(?:unnamed|unidentified|mysterious|nameless)\s+(?:person|woman|man|girl|boy|villager|guard|bandit|stranger|voice|shouter|speaker)$/i.test(normalized)
            );
        }

        function isInvalidGeneratedOneOffNpcName(value = "") {
            const normalized = String(value || "")
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9 ]+/g, " ")
                .replace(/\s+/g, " ")
                .trim();
            return /^(?:bandit|guard|villager|attacker|soldier|thief|raider|enemy|man|woman|boy|girl)\s+(?:#?\d+|one|two|three|four|five|six|seven|eight|nine|ten)$/i.test(normalized);
        }

        function sanitizeAiScenePresenceList(list, state = app.state) {
            const knownNames = [
                ...Object.keys(state?.characters || {}),
                ...allNpcNamesFromState(state),
            ];
            return [
                ...new Set(
                    (Array.isArray(list) ? list : [])
                        .map((name) => resolveEntityName(name, state, ""))
                        .filter((name) => {
                            // The player is tracked separately from scene NPC/party lists.
                            // AI patches must not put the player back into party_members_present,
                            // and unknown generated placeholder names are discarded. Known
                            // imported/story-authored names may be one-word or otherwise
                            // nonstandard; the first+last rule applies only to new AI names.
                            if (!name || isPlayerEntityName(name, state)) return false;
                            return knownNames.some(
                                (known) =>
                                    normalizeNameForMatch(known) ===
                                    normalizeNameForMatch(name),
                            );
                        }),
                ),
            ];
        }

        function imageEligibleEntityNames(state = app.state) {
            return [
                playerEntityDisplayName(state),
                ...Object.keys(state?.characters || {}),
                ...allNpcNamesFromState(state),
            ].filter(Boolean);
        }

        function repairAiImageTargetsForState(targets = [], state = app.state) {
            const eligible = imageEligibleEntityNames(state);
            const normalized = [];
            for (const target of Array.isArray(targets) ? targets : []) {
                const resolved = resolveEntityName(target, state, "");
                const rawName = resolved || String(target || "").trim();
                const name = isPlayerEntityName(rawName, state)
                    ? playerEntityDisplayName(state)
                    : rawName;
                const match = findDuplicateCharacterName(name, eligible) ||
                    (eligible.some((item) => normalizeNameForMatch(item) === normalizeNameForMatch(name))
                        ? name
                        : "");
                if (!match) continue;
                const finalName = isPlayerEntityName(match, state)
                    ? playerEntityDisplayName(state)
                    : match;
                if (!normalized.some((item) => normalizeNameForMatch(item) === normalizeNameForMatch(finalName)))
                    normalized.push(finalName);
            }
            return normalized;
        }

        function exactImageTargetsForState(targets, state = app.state, path = "scene.image_characters") {
            if (!Array.isArray(targets))
                throw new Error(`${path} must be an array.`);
            const eligible = new Set(imageEligibleEntityNames(state));
            const exact = [];
            for (let index = 0; index < targets.length; index++) {
                const target = targets[index];
                if (typeof target !== "string" || !target)
                    throw new Error(`${path}.${index} must be non-empty text.`);
                const canonicalTarget = target === "Player"
                    ? playerEntityDisplayName(state)
                    : target;
                if (!eligible.has(canonicalTarget))
                    throw new Error(
                        `${path}.${index} must exactly name an image-eligible character. ` +
                        `Received ${JSON.stringify(target)}; eligible names: ${JSON.stringify([...eligible])}.`,
                    );
                if (exact.includes(canonicalTarget))
                    throw new Error(`${path}.${index} duplicates ${canonicalTarget}.`);
                exact.push(canonicalTarget);
            }
            return exact;
        }

        function isGenericRoleName(value = "") {
            const text = String(value || "").trim().toLowerCase();
            if (!text) return true;
            if (/^the\s+/.test(text)) return true;
            const normalized = text.replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
            const words = normalized.split(/\s+/).filter(Boolean);
            const exact = new Set([
                "adventurer",
                "alchemist",
                "apprentice",
                "bandit",
                "bandit leader",
                "bandit scout",
                "beast girl",
                "guard",
                "gate guard",
                "girl",
                "boy",
                "woman",
                "man",
                "villager",
                "village guard",
                "merchant",
                "merchant girl",
                "merchant woman",
                "rider",
                "soldier",
                "prisoner",
                "noble",
                "stranger",
                "hooded stranger",
                "beastkin",
                "leader",
                "captain",
                "elder",
                "child",
                "teenager",
                "blacksmith",
                "innkeeper",
                "guard captain",
                "bandit captain",
                "mercenary",
                "mercenary woman",
                "mercenary man",
                "mercenary girl",
                "mercenary boy",
                "female mercenary",
                "male mercenary",
                "old man",
                "old woman",
                "young man",
                "young woman",
            ]);
            if (exact.has(normalized)) return true;
            const genericCore = new Set([
                "acolyte",
                "adventurer",
                "advisor",
                "alchemist",
                "ambusher",
                "apothecary",
                "apprentice",
                "archer",
                "armorer",
                "artisan",
                "assassin",
                "attacker",
                "barmaid",
                "bartender",
                "baker",
                "bandit",
                "bard",
                "baron",
                "baroness",
                "beggar",
                "beast",
                "beastkin",
                "berserker",
                "blacksmith",
                "brute",
                "butcher",
                "captain",
                "caravaner",
                "cashier",
                "child",
                "citizen",
                "clerk",
                "coachman",
                "commander",
                "companion",
                "cook",
                "courier",
                "courtier",
                "cultist",
                "customer",
                "dancer",
                "dealer",
                "demon",
                "doctor",
                "duelist",
                "dwarf",
                "elder",
                "elf",
                "enemy",
                "escort",
                "farmer",
                "fighter",
                "foreman",
                "gatekeeper",
                "giant",
                "girl",
                "goblin",
                "guard",
                "guardsman",
                "guardswoman",
                "guide",
                "healer",
                "herbalist",
                "hero",
                "highwayman",
                "hunter",
                "innkeeper",
                "inspector",
                "jailer",
                "knight",
                "laborer",
                "lady",
                "leader",
                "lord",
                "mage",
                "maid",
                "man",
                "matron",
                "medic",
                "mercenary",
                "merchant",
                "messenger",
                "monk",
                "monster",
                "mother",
                "mugger",
                "noble",
                "nobleman",
                "noblewoman",
                "novice",
                "nun",
                "officer",
                "ogre",
                "orc",
                "outlaw",
                "patron",
                "priest",
                "priestess",
                "prisoner",
                "proprietor",
                "raider",
                "ranger",
                "receptionist",
                "refugee",
                "registrar",
                "retainer",
                "rider",
                "rogue",
                "runner",
                "sage",
                "scout",
                "servant",
                "shopgirl",
                "shopkeeper",
                "slime",
                "smith",
                "soldier",
                "speaker",
                "spy",
                "stranger",
                "student",
                "supplier",
                "tailor",
                "teacher",
                "teenager",
                "thief",
                "thug",
                "townsman",
                "townswoman",
                "trainer",
                "traveler",
                "tutor",
                "vendor",
                "villager",
                "waiter",
                "waitress",
                "warrior",
                "watchman",
                "watchwoman",
                "witch",
                "wizard",
                "woman",
                "worker",
            ]);
            const genericModifiers = new Set([
                "adult",
                "angry",
                "armored",
                "armed",
                "attractive",
                "beastkin",
                "beautiful",
                "blonde",
                "burly",
                "city",
                "cloaked",
                "common",
                "curvy",
                "dark",
                "dark-skinned",
                "demon",
                "drunk",
                "dwarven",
                "eastern",
                "elf",
                "elven",
                "exhausted",
                "female",
                "foreign",
                "frontier",
                "friendly",
                "generic",
                "guild",
                "half",
                "hooded",
                "horned",
                "human",
                "important",
                "injured",
                "local",
                "male",
                "masked",
                "mysterious",
                "nameless",
                "nearby",
                "northern",
                "old",
                "orc",
                "orcish",
                "pretty",
                "random",
                "scarred",
                "scene",
                "short",
                "slime",
                "southern",
                "tall",
                "town",
                "traveling",
                "unnamed",
                "unknown",
                "veteran",
                "village",
                "wandering",
                "young",
            ]);
            if (words.length >= 2 && words.length <= 4) {
                const last = words[words.length - 1];
                if (
                    genericCore.has(last) &&
                    words.slice(0, -1).every((word) => genericCore.has(word) || genericModifiers.has(word))
                )
                    return true;
                if (
                    genericCore.has(words[0]) &&
                    words.slice(1).every((word) => genericCore.has(word) || genericModifiers.has(word))
                )
                    return true;
            }
            return false;
        }
        function isPartyCharacterName(value, state = app.state) {
            const normalized = normalizeNameForMatch(value);
            if (!normalized) return false;
            return Object.keys(state?.characters || {}).some(
                (name) => normalizeNameForMatch(name) === normalized,
            );
        }
        function personNameDuplicatePool(state = app.state, options = {}) {
            const includeNpcs = options.includeNpcs !== false;
            const includeFutureCast = options.includeFutureCast !== false;
            return [
                ...playerDuplicateNames(state),
                ...Object.keys(state?.characters || {}),
                ...(includeFutureCast ? futureCastNamesFromState(state) : []),
                ...(includeNpcs ? allNpcNamesFromState(state) : []),
            ].filter(Boolean);
        }
        function findDuplicateNonNpcPersonName(value, state = app.state) {
            return findDuplicateCharacterName(value, [
                ...playerDuplicateNames(state),
                ...Object.keys(state?.characters || {}),
            ]);
        }
        function findDuplicateNpcName(value, state = app.state) {
            const exact = normalizeNameForMatch(value);
            const duplicate = findDuplicateCharacterName(
                value,
                personNameDuplicatePool(state),
            );
            if (!duplicate) return "";
            return normalizeNameForMatch(duplicate) === exact ? "" : duplicate;
        }
        function futureCastNamesFromState(state = app.state) {
            return Object.values(state?.future_cast?.items || {})
                .flatMap((entry) => [
                    entry?.name,
                    entry?.full_character?.name,
                    entry?.id,
                ])
                .filter(Boolean);
        }
        function isFutureCastName(value, state = app.state) {
            return !!findDuplicateCharacterName(
                value,
                futureCastNamesFromState(state),
            );
        }

        function objectiveFutureRewardIds(state = app.state) {
            const ids = new Set();
            for (const objective of state?.objectives?.items || []) {
                for (const reward of objective?.rewards || []) {
                    if (!isPlainObject(reward)) continue;
                    if (!/future_character/i.test(String(reward.type || "")))
                        continue;
                    const id = String(
                        reward.character_id ||
                            reward.future_character_id ||
                            reward.id ||
                            reward.name ||
                            "",
                    ).trim();
                    if (id) {
                        ids.add(id);
                        ids.add(objectiveIdFromTitle(id, id));
                    }
                }
            }
            return ids;
        }

        function pruneRuntimeDuplicateFutureCast(state = app.state) {
            const items = state?.future_cast?.items;
            if (!isPlainObject(items)) return;
            const protectedIds = objectiveFutureRewardIds(state);
            const knownNames = [
                ...Object.keys(state.characters || {}),
                ...allNpcNamesFromState(state),
            ];
            for (const [id, entry] of Object.entries(items)) {
                const name = String(entry?.name || id || "").trim();
                if (!name) continue;
                // Rule: introduced future-cast entries are runtime identity links,
                // not disposable duplicates. They preserve full inspected NPC data
                // when lightweight state patches later mention that NPC by name.
                if (
                    entry?.unlocked_by ||
                    protectedIds.has(id) ||
                    String(entry?.status || "locked") !== "locked"
                )
                    continue;
                if (findDuplicateCharacterName(name, knownNames)) {
                    delete items[id];
                }
            }
        }

        function npcIsFutureCastBacked(npc = {}, state = app.state) {
            const id = String(npc?.future_character_id || "").trim();
            const items = state?.future_cast?.items || {};
            if (id && items[id]) return true;
            const name = String(npc?.name || "").trim();
            if (!name) return false;
            return Object.values(items).some(
                (entry) =>
                    normalizeNameForMatch(entry?.name) === normalizeNameForMatch(name) ||
                    normalizeNameForMatch(entry?.full_character?.name) ===
                        normalizeNameForMatch(name),
            );
        }
        function findNpcNameInState(value, state = app.state) {
            const text = String(value || "").trim();
            if (!text) return "";
            const normalizedText = normalizeNameForMatch(text);
            const sortedNames = allNpcNamesFromState(state).sort(
                (a, b) => b.length - a.length,
            );
            const exactName = sortedNames.find(
                (name) => normalizeNameForMatch(name) === normalizedText,
            );
            if (exactName) return exactName;
            for (const name of sortedNames) {
                const normalizedName = normalizeNameForMatch(name);
                if (normalizedText.includes(normalizedName)) return name;
            }
            return "";
        }
        function resolveEntityName(value, state, fallback = "") {
            const text = String(value || "").trim();
            const normalizedText = normalizeNameForMatch(text);
            const normalizedPlayerName = normalizeNameForMatch(state?.player?.name);
            if (
                ["player", "main character", "protagonist", "hero"].includes(
                    normalizedText,
                ) ||
                (!!normalizedPlayerName && normalizedText === normalizedPlayerName)
            )
                return "Player";
            const definitionName = resolveExactCharacterDefinitionName(text, state, "");
            if (definitionName) return definitionName;
            const exactCharacterName = Object.keys(state?.characters || {}).find(
                (name) => normalizeNameForMatch(name) === normalizedText,
            );
            if (exactCharacterName) return exactCharacterName;
            const exactNpcName = allNpcNamesFromState(state).find(
                (name) => normalizeNameForMatch(name) === normalizedText,
            );
            if (exactNpcName) return exactNpcName;
            if (isPlayerEntityName(text, state)) return "Player";
            return (
                resolveCharacterName(text, state, "") ||
                findNpcNameInState(text, state) ||
                fallback ||
                ""
            );
        }

        function resolveExactCharacterDefinitionName(value, state = app.state, fallback = "") {
            const wanted = normalizeNameForMatch(value);
            if (!wanted) return fallback;
            for (const [key, character] of Object.entries(state?.characters || {})) {
                if (
                    [character?.name, character?.fallback_name].some(
                        (name) => normalizeNameForMatch(name) === wanted,
                    )
                )
                    return key;
            }
            for (const location of Object.values(state?.npc_directory?.locations || {})) {
                for (const [key, npc] of Object.entries(location?.characters || {})) {
                    const character = npc?.full_character || npc;
                    if (
                        [npc?.name, character?.name, character?.fallback_name].some(
                            (name) => normalizeNameForMatch(name) === wanted,
                        )
                    )
                        return key;
                }
            }
            return fallback;
        }
        function resolveCharacterName(value, state, fallback = "") {
            const names = Object.keys(state?.characters || {});
            if (!names.length) return fallback || "";
            const text = String(value || "").trim();
            if (!text) return fallback || "";
            if (state.characters[text]) return text;

            const normalizedText = normalizeNameForMatch(text);
            for (const name of names) {
                if (normalizedText === normalizeNameForMatch(name)) return name;
            }

            return fallback || "";
        }

        function findDuplicateForNewNpcMetadata(name, existingOrPendingNames = []) {
            // New-NPC metadata must not create a second record for the player, an
            // existing character/NPC, or another NPC already queued in this same
            // extraction. First-name-only variants count as the same person, e.g.
            // "Roxanne" is a duplicate of "Roxanne Teller".
            return findDuplicateCharacterName(name, existingOrPendingNames);
        }

        function namePartsForDuplicateCheck(name) {
            return normalizeNameForMatch(name)
                .split(/\s+/)
                .filter((part) => part.length >= 2);
        }

        function findDuplicateCharacterName(name, existingNames) {
            const candidateParts = namePartsForDuplicateCheck(name);
            if (!candidateParts.length) return "";

            for (const existingName of existingNames || []) {
                const existingParts = namePartsForDuplicateCheck(existingName);
                if (!existingParts.length) continue;

                const sameFullName =
                    normalizeNameForMatch(name) ===
                    normalizeNameForMatch(existingName);
                const candidateFirst = candidateParts[0];
                const existingFirst = existingParts[0];
                const candidateLast = candidateParts[candidateParts.length - 1];
                const existingLast = existingParts[existingParts.length - 1];
                const sharesFirst = candidateFirst === existingFirst;
                const sharesLast =
                    candidateParts.length > 1 &&
                    existingParts.length > 1 &&
                    candidateLast === existingLast;
                const oneIsSingleName =
                    candidateParts.length === 1 || existingParts.length === 1;

                if (
                    sameFullName ||
                    (sharesFirst && (sharesLast || oneIsSingleName))
                )
                    return existingName;
            }

            return "";
        }

        function duplicateCandidateScore(name) {
            const parts = namePartsForDuplicateCheck(name);
            return parts.length * 10 + normalizeNameForMatch(name).length;
        }

        function playerDuplicateNames(state = app.state) {
            return [state?.player?.name].filter(
                (name) => name && normalizeNameForMatch(name) !== "player",
            );
        }

        function uniqueGeneratedCharacters(items, existingNames = []) {
            const accepted = [];
            const seen = [...existingNames];

            for (const item of items || []) {
                if (!item?.name) continue;
                if (
                    isInvalidGeneratedPersonName(item.name) ||
                    isReservedStateLabelName(item.name)
                ) {
                    log(
                        "Invalid character rejected",
                        `${item.name} is not a valid character name.`,
                        "state",
                    );
                    continue;
                }

                const duplicate = findDuplicateCharacterName(item.name, seen);
                if (duplicate) {
                    const acceptedIndex = accepted.findIndex(
                        (existing) => existing.name === duplicate,
                    );
                    const candidateIsBetter =
                        acceptedIndex >= 0 &&
                        duplicateCandidateScore(item.name) >
                            duplicateCandidateScore(duplicate);

                    if (candidateIsBetter) {
                        log(
                            "Duplicate character replaced",
                            `${duplicate} was replaced by the more specific name ${item.name}.`,
                            "state",
                        );
                        accepted[acceptedIndex] = item;
                        seen[seen.indexOf(duplicate)] = item.name;
                        continue;
                    }

                    log(
                        "Duplicate character rejected",
                        `${item.name} looks too similar to ${duplicate}.`,
                        "state",
                    );
                    continue;
                }

                accepted.push(item);
                seen.push(item.name);
            }

            return accepted;
        }

        function normalizeNameForMatch(value) {
            return String(value || "")
                .toLowerCase()
                .replace(/[\'?`?]s\b/g, "")
                .replace(/[^a-z0-9]+/g, " ")
                .trim();
        }
        function parseJsonObject(text) {
            for (const candidate of jsonObjectCandidates(text)) {
                const parsed = tryJson(candidate);
                if (parsed) return parsed;
            }
            return null;
        }

        function jsonObjectCandidates(text) {
            const raw = String(text || "").replace(/^\uFEFF/, "").trim();
            if (!raw) return [];
            const candidates = [];
            const add = (value) => {
                const clean = String(value || "").trim();
                if (clean && !candidates.includes(clean)) candidates.push(clean);
            };

            add(raw);
            const wholeFence = raw.match(/^```(?:json|javascript|js)?\s*([\s\S]*?)```\s*$/i);
            if (wholeFence) add(wholeFence[1]);

            const fencedBlocks = [];
            raw.replace(/```(?:json|javascript|js)?\s*([\s\S]*?)```/gi, (_, body) => {
                fencedBlocks.push(String(body || "").trim());
                return "";
            });
            for (const block of fencedBlocks) add(block);

            for (const block of fencedBlocks) {
                for (const slice of balancedJsonObjectSlices(block)) add(slice);
            }
            for (const slice of balancedJsonObjectSlices(raw)) add(slice);

            return candidates;
        }

        function balancedJsonObjectSlices(text) {
            const raw = String(text || "");
            const out = [];
            for (let start = raw.indexOf("{"); start >= 0; start = raw.indexOf("{", start + 1)) {
                let depth = 0;
                let inString = false;
                let escaped = false;
                for (let i = start; i < raw.length; i++) {
                    const ch = raw[i];
                    if (inString) {
                        if (escaped) escaped = false;
                        else if (ch === "\\") escaped = true;
                        else if (ch === '"') inString = false;
                        continue;
                    }
                    if (ch === '"') {
                        inString = true;
                        continue;
                    }
                    if (ch === "{") depth++;
                    else if (ch === "}") {
                        depth--;
                        if (depth === 0) {
                            const slice = raw.slice(start, i + 1).trim();
                            if (slice && !out.includes(slice)) out.push(slice);
                            break;
                        }
                        if (depth < 0) break;
                    }
                }
            }
            return out;
        }

        function parsePartialTopLevelJsonObject(text) {
            const raw = String(text || "")
                .trim()
                .replace(/^```(?:json)?/i, "")
                .replace(/```$/i, "")
                .trim();
            const direct = tryJson(raw);
            if (direct) return direct;
            const start = raw.indexOf("{");
            if (start < 0) return null;

            let inString = false;
            let escaped = false;
            const stack = [];
            let lastTopLevelComma = -1;

            for (let i = start; i < raw.length; i++) {
                const ch = raw[i];
                if (inString) {
                    if (escaped) {
                        escaped = false;
                    } else if (ch === "\\") {
                        escaped = true;
                    } else if (ch === '"') {
                        inString = false;
                    }
                    continue;
                }

                if (ch === '"') {
                    inString = true;
                    continue;
                }
                if (ch === "{" || ch === "[") {
                    stack.push(ch);
                    continue;
                }
                if (ch === "}" || ch === "]") {
                    const open = stack[stack.length - 1];
                    if ((ch === "}" && open !== "{") || (ch === "]" && open !== "["))
                        break;
                    stack.pop();
                    if (!stack.length) {
                        const complete = tryJson(raw.slice(start, i + 1));
                        if (complete) return complete;
                    }
                    continue;
                }
                if (ch === "," && stack.length === 1) {
                    lastTopLevelComma = i;
                }
            }

            if (lastTopLevelComma <= start) return null;
            const partial = raw.slice(start, lastTopLevelComma).replace(/,\s*$/, "") + "}";
            return tryJson(partial);
        }

        function tryJson(text) {
            try {
                const value = JSON.parse(
                    String(text || "").trim().replace(/,\s*([}\]])/g, "$1"),
                );
                return value &&
                    typeof value === "object" &&
                    !Array.isArray(value)
                    ? value
                    : null;
            } catch {
                return null;
            }
        }
        function updateModalBackdropMode(setupBlackout = false) {
            $("modal")?.classList.toggle(
                "setup-blackout",
                !!setupBlackout,
            );
        }

        function mainModalOpen() {
            return !!$("modal")?.classList.contains("open");
        }

        function openModal(html, options = {}) {
            let bodyHtml = String(html || "");
            let chromeTitle = options.title || "";
            if (!chromeTitle) {
                const headingMatch = bodyHtml.match(/^\s*<h([12])\b[^>]*>([\s\S]*?)<\/h\1>\s*/i);
                if (headingMatch) {
                    const temp = document.createElement("div");
                    temp.innerHTML = headingMatch[2] || "";
                    chromeTitle = temp.textContent?.trim() || "";
                    if (chromeTitle) bodyHtml = bodyHtml.slice(headingMatch[0].length);
                }
            }
            const closeButton = options.hideClose
                ? ""
                : `<button type="button" class="modal-close" title="Close" onclick="EmberAdventures.closeModal()">&times;</button>`;
            const chromeHeader = chromeTitle
                ? `<div class="modal-chrome-header"><div class="modal-chrome-title">${escapeHtml(chromeTitle)}</div>${closeButton}</div>`
                : closeButton;
            const box = $("modalBox");
            const inheritedCloseDestination = mainModalOpen()
                ? String(box?.dataset?.modalCloseDestination || "")
                : "";
            rememberModalScrollPosition(box);
            box.removeAttribute("data-image-viewer-modal");
            box.removeAttribute("data-profile-image-modal-box");
            box.removeAttribute("data-story-library-modal");
            box.removeAttribute("data-character-library-modal");
            box.removeAttribute("data-character-shop-modal");
            box.removeAttribute("data-fullscreen-list-modal");
            box.removeAttribute("data-smoke-suite-modal");
            box.removeAttribute("data-prompt-editor-modal");
            box.removeAttribute("data-player-select-modal");
            box.removeAttribute("data-player-select-return-to-main-menu");
            box.removeAttribute("data-story-start-loading-modal");

            box.removeAttribute("data-character-chat-opening-setup");
            box.removeAttribute("data-manage-images-modal");
            box.removeAttribute("data-manage-characters-modal");
            box.removeAttribute("data-batch-character-image-tool-modal");
            const closeDestination = Object.hasOwn(options, "closeDestination")
                ? String(options.closeDestination || "")
                : inheritedCloseDestination;
            if (closeDestination === "main-menu")
                box.dataset.modalCloseDestination = closeDestination;
            else
                box.removeAttribute("data-modal-close-destination");
            box.innerHTML = chromeHeader + bodyHtml;
            restoreModalScrollPosition(box, options.scrollKey);
            updateModalBackdropMode(!!options.setupBlackout);
            $("modal").classList.add("open");
            requestAnimationFrame(() => autosizeStateTextareas(box));
            setTimeout(() => autosizeStateTextareas(box), 0);
        }

        function modalScrollKeyFromBox(box) {
            if (!box) return "";
            return (
                box.dataset.modalScrollKey ||
                box.querySelector(".modal-chrome-title")?.textContent?.trim() ||
                box.querySelector("h2,h1")?.textContent?.trim() ||
                ""
            );
        }

        function modalScrollKeyFromContent(box, explicitKey = "") {
            return (
                String(explicitKey || "").trim() ||
                box?.querySelector(".modal-chrome-title")?.textContent?.trim() ||
                box?.querySelector("h2,h1")?.textContent?.trim() ||
                ""
            );
        }

        function rememberModalScrollPosition(box = $("modalBox")) {
            const key = modalScrollKeyFromBox(box);
            if (!box || !key) return;
            app.modalScrollPositions ||= {};
            app.modalScrollPositions[key] = box.scrollTop || 0;
        }

        function restoreModalScrollPosition(box = $("modalBox"), explicitKey = "") {
            if (!box) return;
            const key = modalScrollKeyFromContent(box, explicitKey);
            box.dataset.modalScrollKey = key;
            app.modalScrollPositions ||= {};
            box.scrollTop = key ? app.modalScrollPositions[key] || 0 : 0;
        }

        function clearSetupModalScrollPositions() {
            app.modalScrollPositions ||= {};
            for (const key of Object.keys(app.modalScrollPositions)) {
                if (String(key).startsWith("setup:"))
                    delete app.modalScrollPositions[key];
            }
            const box = $("modalBox");
            if (box?.dataset?.modalScrollKey?.startsWith("setup:")) {
                box.removeAttribute("data-modal-scroll-key");
                box.scrollTop = 0;
            }
        }

        function closeModal(options = {}) {
            if (mainModalOpen() && confirmManualCharacterDiscard($("modalBox"), () => closeModal(options))) return;
            rememberModalScrollPosition($("modalBox"));
            if ($("modalBox")?.matches?.("[data-batch-character-image-tool-modal='1']"))
                cancelBatchCharacterImageToolQueue();
            const closeDestination = options.ignoreCloseDestination
                ? ""
                : String($("modalBox")?.dataset?.modalCloseDestination || "");
            if ($("modalBox")?.matches?.("[data-player-select-modal='1']")) {
                clearTimeout(app.storyPlayerSelectScrollTimer);
                app.storyPlayerSelectScrollTimer = null;
                app.storyPlayerSelectScrollBusyUntil = 0;
                app.deferredStoryPlayerSelectProfileRenders?.clear?.();
            }
            const returnPlayerSelectToMainMenu =
                $("modalBox")?.matches?.(
                    "[data-player-select-modal='1'][data-player-select-return-to-main-menu='1']",
                ) && !!app.pendingStoryTemplateStart;
            if (app.unifiedLibraryResizeHandler)
                window.removeEventListener("resize", app.unifiedLibraryResizeHandler);
            app.unifiedLibraryResizeHandler = null;
            cancelAnimationFrame(app.unifiedLibraryResizeFrame || 0);
            app.unifiedLibraryResizeFrame = 0;
            flushOpenCharacterEditorBeforeClose();
            $("modal").classList.remove("open");
            $("modal").classList.remove("setup-blackout");
            $("modalBox")?.removeAttribute("data-image-viewer-modal");
            $("modalBox")?.removeAttribute("data-profile-image-modal-box");
            $("modalBox")?.removeAttribute("data-story-library-modal");
            $("modalBox")?.removeAttribute("data-character-shop-modal");
            $("modalBox")?.removeAttribute("data-story-shop-chat-modal");
            $("modalBox")?.removeAttribute("data-fullscreen-list-modal");
            $("modalBox")?.removeAttribute("data-smoke-suite-modal");
            $("modalBox")?.removeAttribute("data-player-select-modal");
            $("modalBox")?.removeAttribute("data-player-select-return-to-main-menu");
            $("modalBox")?.removeAttribute("data-story-start-loading-modal");
            $("modalBox")?.removeAttribute("data-character-chat-opening-setup");
            $("modalBox")?.removeAttribute("data-manage-images-modal");
            $("modalBox")?.removeAttribute("data-manage-characters-modal");
            $("modalBox")?.removeAttribute("data-modal-close-destination");
            $("modalBox")?.removeAttribute("data-modal-scroll-key");
            drainPendingEditorProfileRefreshes();
            const callback = app.modalCloseCallback;
            app.modalCloseCallback = null;
            if (typeof callback === "function") callback();

            if (returnPlayerSelectToMainMenu) {
                app.pendingStoryTemplateStart = null;
                app.mainMenuOpen = true;
                app.mainMenuExplicitlyOpened = true;
                render();
                return;
            }
            if (app.onboardingDraft) {
                renderMainMenu();
                return;
            }
            if (closeDestination === "main-menu" && !mainModalOpen()) {
                app.mainMenuOpen = true;
                app.mainMenuExplicitlyOpened = true;

                render();
                return;
            }
            refreshMainMenuIfVisible();
        }

        function flushOpenCharacterEditorBeforeClose() {
            const charTree = $("charFriendlyEditor");
            if (charTree?.dataset?.characterName) {
                if (flushStateEditorAutoSave("charFriendlyEditor", { remove: true })) return;
                flushOpenCharacterEditorForExport(charTree.dataset.characterName);
                return;
            }
            const npcTree = $("npcFriendlyEditor");
            if (npcTree?.dataset?.npcName) {
                if (flushStateEditorAutoSave("npcFriendlyEditor", { remove: true })) return;
                flushOpenCharacterEditorForExport(
                    npcTree.dataset.npcName,
                    npcTree.dataset.npcLocation || "",
                );
                return;
            }
            if ($("playerFriendlyEditor")) {
                if (flushStateEditorAutoSave("modalBox", { remove: true })) return;
                flushOpenCharacterEditorForExport("Player");
            }
        }

        function drainPendingEditorProfileRefreshes() {
            const pending = app.pendingEditorProfileRefreshes || {};
            const queued = Object.entries(pending);
            app.pendingEditorProfileRefreshes = {};
            for (const [targetName, targetReason] of queued) {
                queueProfileImageIfNeeded(targetName, targetReason || "editor closed");
            }
        }

        function deferEditorProfileRefresh(name, reason = "editor closed") {
            // Editor profile rule: autosaves should not regenerate portraits while
            // the user is still editing. If prompt-relevant fields changed, refresh
            // the active portrait once when the editor closes.
            name = String(name || "").trim();
            if (!name) return;
            app.pendingEditorProfileRefreshes ||= {};
            app.pendingEditorProfileRefreshes[name] = reason;
        }

        function deferEditorProfileRefreshIfPromptInputsChanged(
            name,
            beforeEntity,
            afterEntity,
            reason = "editor closed",
        ) {
            const beforeSignature = profileEditorRefreshSignature(name, beforeEntity);
            const afterSignature = profileEditorRefreshSignature(name, afterEntity);
            if (profileImagePromptSignaturesMatch(beforeSignature, afterSignature)) {
                return;
            }
            deferEditorProfileRefresh(name, reason);
        }

        function tempCloseOnboarding() {
            app.onboardingDraft = null;
            closeModal();
            scheduleActiveGameSave();
            render();
        }

        const CREATOR_IDENTITY_FIELDS = Object.freeze([
            "creator_id", "creator_name", "owner_user_id", "created_at", "updated_at",
        ]);
        const CREATOR_IDENTITY_REGISTRY_FIELDS = Object.freeze([
            "identities", "last_used_creator_id",
        ]);
        const OFFICIAL_CREATOR_NAME_RESERVATIONS = Object.freeze([
            Object.freeze({ comparisonKey: "emberadventures", canonicalName: "EmberAdventures" }),
            Object.freeze({ comparisonKey: "andro951", canonicalName: "andro951" }),
        ]);
        const OFFICIAL_EMBERADVENTURES_OWNER_USER_ID =
            "cc0511b3-6fab-4e17-9e96-a77fff5fd12e";
        const OFFICIAL_EMBERADVENTURES_OWNER_EMAIL = "andro951@gmail.com";

        function officialCreatorNameReservation(name = "") {
            //This comparison detects forbidden aliases. It never changes the
            //submitted creator name or accepts an alternate spelling.
            const comparisonKey = String(name || "")
                .trim()
                .toLowerCase()
                .replaceAll(" ", "");
            return (
                OFFICIAL_CREATOR_NAME_RESERVATIONS.find(
                    (reservation) => reservation.comparisonKey === comparisonKey,
                ) || null
            );
        }

        function creatorIdentityNameReservationError(name = "", user = null) {
            const submitted = String(name || "");
            const reservation = officialCreatorNameReservation(submitted);
            if (!reservation) return "";
            if (
                String(user?.id || "") !== OFFICIAL_EMBERADVENTURES_OWNER_USER_ID ||
                String(user?.email || "").toLowerCase() !==
                    OFFICIAL_EMBERADVENTURES_OWNER_EMAIL
            )
                return "This creator name is reserved by the creator of EmberAdventures.";
            if (submitted !== reservation.canonicalName)
                return `The official creator name must be exactly "${reservation.canonicalName}".`;
            return "";
        }

        function validateCreatorIdentity(value = {}, path = "creator_identity") {
            const errors = [
                ...exactObjectFieldValidationErrors(value, CREATOR_IDENTITY_FIELDS, path),
                ...requiredExactFieldsValidationErrors(value, CREATOR_IDENTITY_FIELDS, path),
            ];
            if (isPlainObject(value))
                for (const field of CREATOR_IDENTITY_FIELDS)
                    if (typeof value[field] !== "string" || (field !== "owner_user_id" && !value[field]))
                        errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be ${field === "owner_user_id" ? "text" : "non-empty text"}.`));
            return validationResult(errors);
        }

        function exactCreatorIdentity(value = {}, path = "creator_identity") {
            const validation = validateCreatorIdentity(value, path);
            if (!validation.ok) throw new Error(validationErrorsText(validation));
            return clone(value);
        }

        function createCreatorIdentityRecord({ creator_id, creator_name, owner_user_id = "", created_at, updated_at } = {}) {
            const now = new Date().toISOString();
            return exactCreatorIdentity({
                creator_id,
                creator_name,
                owner_user_id,
                created_at: created_at ?? now,
                updated_at: updated_at ?? now,
            });
        }

        function validateCreatorIdentityRegistry(value = {}) {
            const errors = [
                ...exactObjectFieldValidationErrors(value, CREATOR_IDENTITY_REGISTRY_FIELDS, "creator_identity_registry"),
                ...requiredExactFieldsValidationErrors(value, CREATOR_IDENTITY_REGISTRY_FIELDS, "creator_identity_registry"),
            ];
            if (!isPlainObject(value)) return validationResult(errors);
            if (!Array.isArray(value.identities))
                errors.push(validationError("creator_identity_registry.identities", "type", "creator_identity_registry.identities must be an array."));
            if (typeof value.last_used_creator_id !== "string")
                errors.push(validationError("creator_identity_registry.last_used_creator_id", "type", "creator_identity_registry.last_used_creator_id must be text."));
            const ids = new Set();
            for (const [index, identity] of (Array.isArray(value.identities) ? value.identities : []).entries()) {
                const validation = validateCreatorIdentity(identity, `creator_identity_registry.identities.${index}`);
                errors.push(...validation.errors);
                if (isPlainObject(identity) && ids.has(identity.creator_id))
                    errors.push(validationError(`creator_identity_registry.identities.${index}.creator_id`, "duplicate", `Duplicate creator identity ${identity.creator_id}.`));
                if (isPlainObject(identity)) ids.add(identity.creator_id);
            }
            if (value.last_used_creator_id && !ids.has(value.last_used_creator_id))
                errors.push(validationError("creator_identity_registry.last_used_creator_id", "reference", "last_used_creator_id must reference an identity in the registry."));
            return validationResult(errors);
        }

        function exactCreatorIdentityRegistry(value = {}) {
            const validation = validateCreatorIdentityRegistry(value);
            if (!validation.ok) throw new Error(validationErrorsText(validation));
            return clone(value);
        }

        function creatorIdentityRegistry() {
            const validation = validateCreatorIdentityRegistry(app.creatorIdentityRegistry);
            if (!validation.ok) throw new Error(validationErrorsText(validation));
            return app.creatorIdentityRegistry;
        }

        function creatorIdentities() {
            return creatorIdentityRegistry().identities;
        }

        function creatorIdentityById(id = "") {
            const wanted = textSlot(id, "");
            return creatorIdentities().find(
                (identity) => identity.creator_id === wanted,
            ) || null;
        }

        function selectedCreatorIdentity() {
            const registry = creatorIdentityRegistry();
            return creatorIdentityById(app.mineCreatorId || registry.last_used_creator_id) ||
                registry.identities[0] ||
                null;
        }

        function saveCreatorIdentityRegistry(reason = "creator identities changed") {
            const registry = creatorIdentityRegistry();
            largeSetStorageItem(
                CREATOR_IDENTITY_KEY,
                registry,
                { json: true },
            );
            log("Creator identities saved", reason, {
                type: "storage",
                level: "message",
                details: { count: registry.identities.length },
            });
            return registry;
        }

        function newCreatorIdentityId() {
            if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
            return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (value) => {
                const random = Math.floor(Math.random() * 16);
                return (value === "x" ? random : (random & 3) | 8).toString(16);
            });
        }

        function objectiveOutcomeRoutingInstruction(objective = {}) {
            if (!objectiveUsesAiOutcomeRouting(objective)) return "";
            const eligibleRoutes = eligibleObjectiveOutcomeRoutes(objective);
            const routes = eligibleRoutes.map((route) => ({
                id: route.id,
                private_criteria: route.criteria,
                eligibility_requirements: route.requirements,
                fallback_for_ambiguous_result: route.fallback,
                default_mode: route.default_mode,
            }));
            const omittedRouteIds = objectiveOutcomeRoutes(objective)
                .map((route) => route.id)
                .filter((id) => !eligibleRoutes.some((route) => route.id === id));
            const routeEvidence = objectiveOutcomeRoutes(objective).map((route) => ({
                id: route.id,
                currently_eligible: eligibleRoutes.some((eligible) => eligible.id === route.id),
                requirements: storyRequirementResults(route.requirements).map((item) => ({
                    label: item.label,
                    met: item.met,
                    current: item.current,
                })),
            }));
            const presentNames = new Set([
                ...(app.state.scene?.party_members_present || []),
                ...(app.state.scene?.npcs_present || []),
            ].map((name) => String(name || "")));
            const presentCharacters = {};
            for (const name of presentNames) {
                const character =
                    app.state.characters?.[name] ||
                    getNpcEntryFromState(app.state, name)?.full_character ||
                    getNpcEntryFromState(app.state, name);
                if (character)
                    presentCharacters[promptEntityName(name, app.state)] =
                        objectiveOutcomeEntityEvidence(character, name, app.state);
            }
            const evidenceState = {
                player: objectiveOutcomeEntityEvidence(app.state.player || {}, "Player", app.state),
                present_characters: presentCharacters,
                story_inventory: app.state.story_inventory || {},
                world_flags: app.state.world_flags || {},
            };
            return `
HIDDEN OUTCOME ROUTING:
- If and only if the objective is complete, choose the single route that best matches the full scene and return its id in "o".
- Only listed routes are eligible. Do not choose any route id not listed in ROUTES.
- Structured requirements are deterministic eligibility filters that already removed ineligible routes.
- Always choose the closest and best listed route. Use the fallback/default only when it is listed and the scene is genuinely ambiguous or no exact criterion matches.
- Do not reveal route ids, criteria, requirements, labels, or this classification process to the player.
ROUTES: ${JSON.stringify(routes)}
FILTERED ROUTE EVIDENCE: ${JSON.stringify(routeEvidence)}
INELIGIBLE ROUTE IDS OMITTED FROM ROUTES: ${JSON.stringify(omittedRouteIds)}
RELEVANT STATE EVIDENCE: ${JSON.stringify(evidenceState)}`;
        }

        function objectiveOutcomeEntityEvidence(character = {}, key = "", state = app.state) {
            const projected = runtimePromptEntityProjection(character, key, state);
            return {
                name: projected.name || "",
                role: projected.role || "",
                alive: projected.alive !== false,
                health: projected.health ?? projected.hp ?? null,
                injuries: projected.injuries || projected.physical_state || "",
                relationship: projected.relationship || projected.relationships || {},
                relationship_to_player: projected.relationship_to_player || "",
                trust: projected.trust ?? null,
                attraction: projected.attraction ?? null,
                affection: projected.affection ?? null,
                stats: isPlainObject(projected.stats) ? clone(projected.stats) : {},
                ...promptKnownFactFields(projected, 8),
                durable_hidden_facts: projected.durable_hidden_facts || {},
            };
        }

        function addCreatorIdentity(name = "", options = {}) {
            const creatorName = entityCreatorSlot(name);
            if (!creatorName) return null;
            const registry = creatorIdentityRegistry();
            const sameName = registry.identities.find(
                (identity) =>
                    identity.creator_name.toLowerCase() === creatorName.toLowerCase(),
            );
            if (sameName) {
                registry.last_used_creator_id = sameName.creator_id;
                app.mineCreatorId = sameName.creator_id;
                saveCreatorIdentityRegistry("existing creator selected");
                return sameName;
            }
            const now = new Date().toISOString();
            const identity = createCreatorIdentityRecord({
                creator_id: options.creator_id ?? newCreatorIdentityId(),
                creator_name: creatorName,
                owner_user_id: options.owner_user_id ?? "",
                created_at: options.created_at ?? now,
                updated_at: options.updated_at ?? now,
            });
            registry.identities.push(identity);
            registry.identities.sort((a, b) =>
                a.creator_name.localeCompare(b.creator_name),
            );
            registry.last_used_creator_id = identity.creator_id;
            app.mineCreatorId = identity.creator_id;
            saveCreatorIdentityRegistry("creator added");
            refreshMineCreatorIdentityControls();
            return identity;
        }

        async function createCreatorIdentity() {
            const name = await showPrompt(
                "New Creator",
                "Enter the public creator name or alias for your stories and characters.",
                "",
                { rows: 1, submitText: "Create" },
            );
            if (name == null) return null;
            const reservationError = creatorIdentityNameReservationError(
                name,
                supabaseSignedInUser(),
            );
            if (reservationError) {
                await showNotice("Creator Name Reserved", reservationError);
                return null;
            }
            const identity = addCreatorIdentity(name);
            if (!identity)
                await showNotice("Creator Required", "Enter a creator name or alias.");
            return identity;
        }

        function openManageCreatorNames() {
            openModal("", { title: "Manage Creator Names" });
            const box = $("modalBox");
            const note = document.createElement("p");
            note.textContent = "Delete removes a name from this browser only. Registered ownership and published content are unchanged. Importing a name does not transfer ownership.";
            const local = document.createElement("div");
            const load = document.createElement("button");
            load.type = "button";
            load.textContent = "Load Public Creator Names";
            const status = document.createElement("p");
            const remote = document.createElement("div");
            let publicNames = [];
            const render = () => {
                local.replaceChildren();
                remote.replaceChildren();
                const registry = creatorIdentityRegistry();
                const row = (identity, parent, imported) => {
                    const line = document.createElement("div");
                    const name = document.createElement("span");
                    name.textContent = `${identity.creator_name} (${identity.creator_id}) `;
                    const button = document.createElement("button");
                    button.type = "button";
                    button.textContent = imported ? "Import" : "Delete";
                    button.disabled = imported && registry.identities.some((item) => item.creator_id === identity.creator_id);
                    button.onclick = () => {
                        if (imported) {
                            if (!registry.identities.some((item) => item.creator_id === identity.creator_id))
                                registry.identities.push(exactCreatorIdentity(identity));
                        }
                        else {
                            registry.identities = registry.identities.filter((item) => item.creator_id !== identity.creator_id);
                            if (registry.last_used_creator_id === identity.creator_id) registry.last_used_creator_id = "";
                            if (app.mineCreatorId === identity.creator_id) app.mineCreatorId = "";
                        }
                        saveCreatorIdentityRegistry(imported ? "creator imported locally" : "creator removed locally");
                        render();
                    };
                    line.append(name, button);
                    parent.appendChild(line);
                };
                for (const identity of registry.identities) row(identity, local, false);
                for (const identity of publicNames) row(identity, remote, true);
            };
            load.onclick = async () => {
                load.disabled = true;
                status.textContent = "Loading creator names...";
                try {
                    const names = [];
                    let afterId = "00000000-0000-0000-0000-000000000000";
                    while (true) {
                        const rows = await publicLibraryFetch("/rest/v1/rpc/list_public_creator_names", {
                            method: "POST", body: { after_id: afterId },
                        });
                        if (!Array.isArray(rows)) throw new Error("Invalid public creator list.");
                        if (!rows.length) break;
                        const page = rows.map((item) => exactCreatorIdentity(item));
                        const nextId = page[page.length - 1].creator_id;
                        if (nextId <= afterId) throw new Error("Public creator paging did not advance.");
                        names.push(...page);
                        afterId = nextId;
                    }
                    publicNames = names;
                    render();
                    status.textContent = `${names.length} registered creator names. Already imported names cannot be imported again.`;
                } catch (err) {
                    log("Public creator names failed", err.message || String(err), { type: "system", level: "error" });
                    status.textContent = `Could not load creator names: ${err.message || String(err)}`;
                } finally {
                    load.disabled = false;
                }
            };
            box.append(note, local, load, status, remote);
            render();
        }

        function creatorIdentityOptionsHtml(selectedId = "") {
            return creatorIdentities()
                .map(
                    (identity) =>
                        `<option value="${escapeHtml(identity.creator_id)}" ${identity.creator_id === selectedId ? "selected" : ""}>${escapeHtml(identity.creator_name)}</option>`,
                )
                .join("");
        }

        function chooseCreatorIdentityForImport(label = "file", options = {}) {
            if (app.devCreatorIdentityImportSelection) {
                const selected = creatorIdentityById(app.devCreatorIdentityImportSelection);
                if (selected) return Promise.resolve(selected);
            }
            return new Promise((resolve) => {
                const plural = options.plural === true;
                const registry = creatorIdentityRegistry();
                const savingOverlay = document.getElementById("emberAdventuresSavingOverlay");
                const savingOverlayDisplay = savingOverlay?.style.display || "";
                if (savingOverlay) savingOverlay.style.display = "none";
                const restoreSavingOverlay = () => {
                    if (savingOverlay?.isConnected)
                        savingOverlay.style.display = savingOverlayDisplay;
                };
                const popup = openPopupModal(`
                    <h2>Who Made ${plural ? "These" : "This"}?</h2>
                    <p class="hint">${escapeHtml(label)} ${plural ? "do" : "does"} not identify a creator. Select the creator identity that should own ${plural ? "them" : "it"} in Mine.</p>
                    <div class="row">
                        <select id="creatorIdentityImportSelect" aria-label="Creator">
                            <option value="">Choose a creator...</option>
                            ${creatorIdentityOptionsHtml(registry.last_used_creator_id)}
                        </select>
                        <button type="button" id="creatorIdentityImportAddBtn" title="Create creator" aria-label="Create creator">+</button>
                    </div>
                    <div id="creatorIdentityImportError" class="hint" style="color:#ff9999; margin-top:.55rem"></div>
                    <div class="row" style="margin-top:.8rem">
                        <button type="button" class="primary" id="creatorIdentityImportConfirmBtn">${escapeHtml(options.confirmText || "Import")}</button>
                        <button type="button" id="creatorIdentityImportCancelBtn">Cancel</button>
                    </div>
                `);
                const select = popup.box.querySelector("#creatorIdentityImportSelect");
                const showError = (message) => {
                    const error = popup.box.querySelector("#creatorIdentityImportError");
                    if (error) error.textContent = message;
                };
                popup.box.querySelector("#creatorIdentityImportAddBtn").onclick = async () => {
                    const identity = await createCreatorIdentity();
                    if (!identity) return;
                    select.innerHTML = `<option value="">Choose a creator...</option>${creatorIdentityOptionsHtml(identity.creator_id)}`;
                    select.value = identity.creator_id;
                };
                popup.box.querySelector("#creatorIdentityImportConfirmBtn").onclick = () => {
                    const identity = creatorIdentityById(select.value);
                    if (!identity) {
                        showError("Select or create a creator.");
                        return;
                    }
                    registry.last_used_creator_id = identity.creator_id;
                    app.mineCreatorId = identity.creator_id;
                    saveCreatorIdentityRegistry("creator selected during import");
                    restoreSavingOverlay();
                    popup.close();
                    resolve(identity);
                };
                popup.box.querySelector("#creatorIdentityImportCancelBtn").onclick = () => {
                    restoreSavingOverlay();
                    popup.close();
                    resolve(null);
                };
            });
        }

        async function ensureLocalCreatorIdentity(target = {}, label = "This content", options = {}) {
            const existingId = definitionCreatorId(target);
            if (existingId) {
                const identity = creatorIdentityById(existingId) || {
                    creator_id: existingId,
                    creator_name: entityCreatorSlot(target.creator),
                };
                if (identity.creator_name) {
                    applyCreatorIdentity(target, identity);
                }
                return identity;
            }
            const identity = selectedCreatorIdentity() ||
                await chooseCreatorIdentityForImport(label, {
                    confirmText: options.confirmText || "Continue",
                });
            if (!identity) return null;
            applyCreatorIdentity(target, identity);
            return identity;
        }

        function applyCreatorIdentity(target = {}, identity = null) {
            if (!isPlainObject(target) || !identity) return target;
            if (isPlainObject(target.state) && !Object.hasOwn(target, "character")) {
                setStoryLibraryCreatorMetadata(target, identity);
                return target;
            }
            target.creator_id = identity.creator_id;
            target.creator = identity.creator_name;
            return target;
        }

        function storyLibraryCreatorMetadataMap() {
            if (!(app.storyLibraryCreatorMetadataById instanceof Map))
                app.storyLibraryCreatorMetadataById = new Map();
            return app.storyLibraryCreatorMetadataById;
        }

        function setStoryLibraryCreatorMetadata(record = {}, metadata = null) {
            const storyId = textSlot(record?.id || record, "");
            if (!storyId) throw new Error("Story library creator metadata requires a story ID.");
            storyLibraryCreatorMetadataMap().set(storyId, {
                creator_id: textSlot(metadata?.creator_id, ""),
                creator: textSlot(metadata?.creator_name ?? metadata?.creator, ""),
            });
            return record;
        }

        function storyLibraryCreatorMetadata(record = {}) {
            const storyId = textSlot(record?.id || record, "");
            return storyLibraryCreatorMetadataMap().get(storyId) || {
                creator_id: "",
                creator: "",
            };
        }

        function storyLibraryCreator(record = {}) {
            return storyLibraryCreatorMetadata(record).creator;
        }

        function definitionCreatorId(record = {}) {
            if (isPlainObject(record?.state) && !Object.hasOwn(record, "character"))
                return storyLibraryCreatorMetadata(record).creator_id;
            return textSlot(record.creator_id, "");
        }

        function characterRecordHasCreatorIdentity(record = {}) {
            return !!(
                textSlot(record.creator_id, "") &&
                entityCreatorSlot(record.creator)
            );
        }

        async function claimImportedStoriesWithoutCreator(records = []) {
            const missing = (records || []).filter(
                (record) => record && !definitionCreatorId(record),
            );
            if (!missing.length) return true;
            const plural = (records || []).filter(Boolean).length > 1;
            const identity = await chooseCreatorIdentityForImport(
                plural ? "These imported stories" : missing[0].title || "Imported story",
                { plural },
            );
            if (!identity) return false;
            for (const record of missing)
                applyCreatorIdentity(record, identity);
            return true;
        }

        function mineCreatorIdentityId() {
            return creatorIdentityById(app.mineCreatorId)?.creator_id || "";
        }

        function setMineCreatorIdentity(id = "") {
            const identity = creatorIdentityById(id);
            if (id && !identity) return;
            app.mineCreatorId = identity?.creator_id || "";
            renderCharacterLibraryOwnedPublicCharacters();
            refreshStoryLibraryActiveTabCards();
            refreshCharacterLibraryActiveTabCards();
            updateUnifiedLibraryResultLabel();
        }

        function refreshMineCreatorIdentityControls() {
            const selectedId = mineCreatorIdentityId();
            document.querySelectorAll("[data-mine-creator-select]").forEach((select) => {
                select.innerHTML = `<option value="">Any</option>${creatorIdentityOptionsHtml(selectedId)}`;
                select.value = selectedId;
            });
            if (unifiedLibraryTab() === "mine") {
                refreshStoryLibraryActiveTabCards();
                refreshCharacterLibraryActiveTabCards();
                updateUnifiedLibraryResultLabel();
            }
        }

        function characterSourceLabel(source) {
            return entitySourceSlot(source) || "Original / made up";
        }

        function characterCreatorLabel(creator) {
            return entityCreatorSlot(creator) || "";
        }

        function characterCreationToolLabel(creation_tool) {
            return entityCreationToolSlot(creation_tool) || "";
        }

        const CHARACTER_LIBRARY_RECORD_FIELDS = Object.freeze([
            "id", "name", "source", "creator", "creator_id", "creation_tool",
            "role", "character", "active_profile_image_ids",
            "public_library_item_id", "public_library_owner_user_id",
            "public_library_version_id", "preferred_voice_name", "created_at", "updated_at",
        ]);
        const CHARACTER_LIBRARY_RECORD_REQUIRED_FIELDS = Object.freeze(
            CHARACTER_LIBRARY_RECORD_FIELDS.filter(
                (field) => field !== "preferred_voice_name",
            ),
        );
        const CHARACTER_LIBRARY_ACTIVE_PROFILE_IMAGE_ID_FIELDS = Object.freeze([
            "male", "non_male",
        ]);

        function emptyCharacterLibraryActiveProfileImageIds() {
            return { male: "", non_male: "" };
        }

        function exactCharacterLibraryActiveProfileImageIds(value = {}) {
            const path = "character library active_profile_image_ids";
            const errors = [
                ...exactObjectFieldValidationErrors(
                    value,
                    CHARACTER_LIBRARY_ACTIVE_PROFILE_IMAGE_ID_FIELDS,
                    path,
                ),
                ...requiredExactFieldsValidationErrors(
                    value,
                    CHARACTER_LIBRARY_ACTIVE_PROFILE_IMAGE_ID_FIELDS,
                    path,
                ),
            ];
            if (isPlainObject(value))
                for (const field of CHARACTER_LIBRARY_ACTIVE_PROFILE_IMAGE_ID_FIELDS)
                    if (typeof value[field] !== "string")
                        errors.push(
                            validationError(
                                `${path}.${field}`,
                                "type",
                                `${path}.${field} must be text.`,
                            ),
                        );
            if (errors.length)
                throw new Error(validationErrorsText(validationResult(errors)));
            return clone(value);
        }

        function characterLibraryPresentationKeyForGender(gender = "") {
            return characterPresentationUsesMaleFields(gender) ? "male" : "non_male";
        }

        function characterLibraryActiveProfileImageId(record = {}, gender = "") {
            const ids = exactCharacterLibraryActiveProfileImageIds(
                record.active_profile_image_ids,
            );
            return ids[characterLibraryPresentationKeyForGender(gender)];
        }

        function validateCharacterLibraryRecord(record = {}, path = "character library record") {
            const errors = [
                ...exactObjectFieldValidationErrors(
                    record,
                    CHARACTER_LIBRARY_RECORD_FIELDS,
                    path,
                ),
                ...requiredExactFieldsValidationErrors(
                    record,
                    CHARACTER_LIBRARY_RECORD_REQUIRED_FIELDS,
                    path,
                ),
            ];
            if (!isPlainObject(record)) return validationResult(errors, []);
            for (const field of CHARACTER_LIBRARY_RECORD_FIELDS.filter(
                (field) =>
                    ![
                        "character", "active_profile_image_ids",
                    ].includes(field),
            )) {
                if (field === "preferred_voice_name" && !(field in record)) continue;
                if (typeof record[field] !== "string")
                    errors.push(
                        validationError(
                            `${path}.${field}`,
                            "type",
                            `${path}.${field} must be a string.`,
                        ),
                    );
            }
            for (const field of ["id", "name", "source", "creation_tool", "role", "created_at", "updated_at"]) {
                if (typeof record[field] !== "string" || !record[field].trim())
                    errors.push(
                        validationError(
                            `${path}.${field}`,
                            "required",
                            `${path}.${field} must be a nonblank string.`,
                        ),
                    );
            }
            if (isPlainObject(record.active_profile_image_ids)) {
                errors.push(
                    ...exactObjectFieldValidationErrors(
                        record.active_profile_image_ids,
                        CHARACTER_LIBRARY_ACTIVE_PROFILE_IMAGE_ID_FIELDS,
                        `${path}.active_profile_image_ids`,
                    ),
                    ...requiredExactFieldsValidationErrors(
                        record.active_profile_image_ids,
                        CHARACTER_LIBRARY_ACTIVE_PROFILE_IMAGE_ID_FIELDS,
                        `${path}.active_profile_image_ids`,
                    ),
                );
                for (const field of CHARACTER_LIBRARY_ACTIVE_PROFILE_IMAGE_ID_FIELDS)
                    if (typeof record.active_profile_image_ids[field] !== "string")
                        errors.push(
                            validationError(
                                `${path}.active_profile_image_ids.${field}`,
                                "type",
                                `${path}.active_profile_image_ids.${field} must be text.`,
                            ),
                        );
            }
            const definition = validateCharacterDefinition(record.character, `${path}.character`);
            errors.push(...definition.errors);
            for (const [field, characterField] of [
                ["id", "id"], ["name", "name"], ["source", "source"],
                ["creation_tool", "creation_tool"],
                ["role", "role"],
                ["created_at", "created_at"], ["updated_at", "updated_at"],
            ]) {
                if (record[field] !== record.character?.[characterField])
                    errors.push(
                        validationError(
                            `${path}.${field}`,
                            "mismatch",
                            `${path}.${field} must exactly match ${path}.character.${characterField}.`,
                        ),
                    );
            }
            return validationResult(errors, definition.warnings);
        }

        function assertValidCharacterLibraryRecord(record = {}, path = "character library record") {
            const result = validateCharacterLibraryRecord(record, path);
            if (!result.ok)
                throw new Error(`${path} is invalid:\n${validationErrorsText(result)}`);
            return record;
        }

        function characterLibraryRecordFromDefinition(characterDefinition = {}, options = {}) {
            assertValidCharacterDefinition(characterDefinition, "character library definition");
            const now = new Date().toISOString();
            const character = clone(characterDefinition);
            const record = {
                id: character.id,
                name: character.name,
                source: character.source,
                creator: options.creator || "",
                creator_id: options.creator_id || "",
                creation_tool: character.creation_tool,
                role: character.role,
                character,
                active_profile_image_ids: exactCharacterLibraryActiveProfileImageIds(
                    options.active_profile_image_ids ||
                        emptyCharacterLibraryActiveProfileImageIds(),
                ),
                public_library_item_id: options.public_library_item_id || "",
                public_library_owner_user_id: options.public_library_owner_user_id || "",
                public_library_version_id: options.public_library_version_id || "",
                preferred_voice_name: options.preferred_voice_name || "",
                created_at: character.created_at || now,
                updated_at: character.updated_at || now,
            };
            return assertValidCharacterLibraryRecord(record);
        }

        function validatedCharacterLibraryDefinitions(records = []) {
            if (!Array.isArray(records))
                throw new Error("Character library records must be an array.");
            const ids = new Set();
            return records.map((record, index) => {
                assertValidCharacterLibraryRecord(record, `character library records.${index}`);
                if (ids.has(record.id))
                    throw new Error(`character library records.${index}.id duplicates ${record.id}.`);
                ids.add(record.id);
                return clone(record);
            });
        }

        function closeImageLabSurface() {
            app.imageLabStoryTitleCardTarget = "";
            const popup = $("labGenerateBtn")?.closest?.(".popup-modal");
            if (popup) popup.remove();
            else closeModal();
        }

        function upsertCharacterLibraryDefinition(record = {}) {
            assertValidCharacterLibraryRecord(
                record,
                `upsert character ${record.name || "definition"}`,
            );
            const definitions = [
                ...(Array.isArray(app.characterDefinitions) ? app.characterDefinitions : []),
            ];
            const sameIndex = definitions.findIndex((item) => {
                if (record.id && item.id === record.id) return true;
                return (
                    normalizeNameForMatch(item.name) === normalizeNameForMatch(record.name) &&
                    String(item.source || "") === String(record.source || "") &&
                    String(item.creator_id || "") === String(record.creator_id || "")
                );
            });
            if (sameIndex >= 0) {
                const existing = definitions[sameIndex];
                if (
                    characterRecordHasCreatorIdentity(existing) &&
                    !characterRecordHasCreatorIdentity(record)
                ) {
                    record.creator_id = existing.creator_id;
                    record.creator = existing.creator;
                }
                record.id = definitions[sameIndex].id;
                const createdAt = definitions[sameIndex].created_at || record.created_at;
                record.created_at = createdAt;
                record.character.created_at = createdAt;
                definitions[sameIndex] = record;
            } else {
                definitions.push(record);
            }
            app.characterDefinitions = definitions;
            return record;
        }

        function upsertCharacterLibraryDefinitionsBatch(records = []) {
            if (!Array.isArray(records) || !records.length) return [];
            const validatedRecords = validatedCharacterLibraryDefinitions(records);
            const definitions = [...(Array.isArray(app.characterDefinitions) ? app.characterDefinitions : [])];
            const indexForRecord = (record) =>
                definitions.findIndex((item) => {
                    if (record.id && item.id === record.id) return true;
                    return (
                        normalizeNameForMatch(item.name) === normalizeNameForMatch(record.name) &&
                        String(item.source || "") === String(record.source || "") &&
                        String(item.creator_id || "") === String(record.creator_id || "")
                    );
                });
            const imported = [];
            for (const record of validatedRecords) {
                const sameIndex = indexForRecord(record);
                if (sameIndex >= 0) {
                    const existing = definitions[sameIndex];
                    if (
                        characterRecordHasCreatorIdentity(existing) &&
                        !characterRecordHasCreatorIdentity(record)
                    ) {
                        record.creator_id = existing.creator_id;
                        record.creator = existing.creator;
                    }
                    record.id = definitions[sameIndex].id;
                    const createdAt = definitions[sameIndex].created_at || record.created_at;
                    record.created_at = createdAt;
                    record.character.created_at = createdAt;
                    definitions[sameIndex] = record;
                } else {
                    definitions.push(record);
                }
                imported.push(record);
            }
            app.characterDefinitions = definitions;
            return imported
                .map((record) =>
                    (app.characterDefinitions || []).find(
                        (item) =>
                            item.id === record.id ||
                            normalizeNameForMatch(item.name) === normalizeNameForMatch(record.name),
                    ),
                )
                .filter(Boolean);
        }

        function characterLibraryRecords() {
            const definitions = Array.isArray(app.characterDefinitions)
                ? app.characterDefinitions
                : [];
            const cached = app.characterLibraryRecordsCache;
            if (
                cached?.source === definitions &&
                cached.length === definitions.length &&
                cached.records
            )
                return cached.records;
            const start = perfNow();
            const beforeCount = definitions.length;
            app.characterDefinitions = validatedCharacterLibraryDefinitions(definitions);
            const result = app.characterDefinitions.map((record) => ({
                ...record,
                kind: "definition",
                entity: record.character,
            }));
            app.characterLibraryRecordsCache = {
                source: app.characterDefinitions,
                length: app.characterDefinitions.length,
                records: result,
                byId: new Map(result.map((record) => [characterLibraryRecordId(record), record])),
            };
            const ms = perfNow() - start;
            if (ms >= 10)
                perfConsole(
                    "character library records",
                    {
                        ms: Math.round(ms),
                        beforeCount,
                        outputCount: result.length,
                    },
                    ms >= 75 ? "warn" : "log",
                );
            return result;
        }

        function characterLibraryRecordId(record = {}) {
            if (record.publicEntry) return `public|${encodeURIComponent(String(record.id || ""))}`;
            return `definition|${encodeURIComponent(String(record.id || record.name || ""))}`;
        }

        function characterLibraryRecordById(id = "") {
            const wanted = String(id || "");
            const records = characterLibraryRecords();
            return app.characterLibraryRecordsCache?.byId?.get(wanted) ||
                records.find((record) => characterLibraryRecordId(record) === wanted);
        }

        function storedCharacterLibraryRecord(record = {}) {
            const recordId = String(record?.id || "");
            const stored = (app.characterDefinitions || []).find(
                (item) => String(item?.id || "") === recordId,
            );
            if (!stored)
                throw new Error(`Character library record ${recordId || "(missing id)"} is not stored.`);
            return stored;
        }

        function characterLibraryRecordEntity(record = {}) {
            const entity = record?.character || record?.entity || null;
            return entity;
        }

        function characterLibraryProfileHandle(record = {}, presentationKey = "non_male") {
            const id = String(record?.id || "").trim();
            if (!id) return "";
            return `character-library|${encodeURIComponent(id)}|${presentationKey}`;
        }

        const characterPresentationOverrides = new Map();
        let characterPresentationOverridesLoaded = false;
        function loadCharacterPresentationOverrides() {
            if (characterPresentationOverridesLoaded) return;
            const stored = JSON.parse(localStorage.getItem("emberadventureslite-character-presentation-overrides") || "[]");
            if (!Array.isArray(stored) || stored.some((entry) => !Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string" || !["male", "female"].includes(entry[1])))
                throw new Error("Character presentation overrides are invalid.");
            for (const [key, value] of stored) characterPresentationOverrides.set(key, value);
            characterPresentationOverridesLoaded = true;
        }
        function saveCharacterPresentationOverrides() {
            localStorage.setItem("emberadventureslite-character-presentation-overrides", JSON.stringify([...characterPresentationOverrides]));
        }
        function characterPresentationOverrideKey(record = {}) {
            return String(record.definition_id || record.character?.id || record.id || record.name || "");
        }
        function characterPresentationOverride(record) {
            loadCharacterPresentationOverrides();
            return characterPresentationOverrides.get(characterPresentationOverrideKey(record)) || "";
        }

        function characterLibraryChosenEntity(record) {
            if (!record) return null;
            return characterLibraryPresentation(
                characterLibraryRecordEntity(record),
                characterLibraryRecordId(record),
                characterPresentationOverride(record),
                { allowNonRomanceable: !!characterPresentationOverride(record) },
            );
        }

        function queueMissingCharacterPresentationImage(record) {
            const localRecord = characterLibraryRecords().find((item) =>
                !item.publicEntry && characterPresentationOverrideKey(item) === characterPresentationOverrideKey(record),
            );
            if (!localRecord) return false;
            const registered = registerCharacterLibraryProfileEntity(localRecord);
            if (!registered?.entity || !registered.name) return false;
            const image = characterProfilePresentationCandidate(
                registered.entity,
                characterPresentationUsesMaleFields(registered.entity.gender),
            );
            if (image && (profileImageIsFinished(image) || isActiveProfileImageRecord(image))) return false;
            return queueProfileImage(registered.name, {
                reason: "character presentation selected",
                manual: true,
                allowImportSkipped: true,
                force: !!image,
            });
        }

        function refreshCharacterPresentationGridCards(record) {
            const key = characterPresentationOverrideKey(record);
            for (const card of document.querySelectorAll("[data-character-library-card][data-character-library-id]")) {
                const localRecord = characterLibraryRecordById(card.dataset.characterLibraryId);
                if (!localRecord || characterPresentationOverrideKey(localRecord) !== key) continue;
                const holder = document.createElement("div");
                holder.innerHTML = characterLibraryRecordHtml(localRecord);
                const parent = card.parentElement;
                card.replaceWith(holder.firstElementChild);
                scheduleAutosizeLibraryCardText(parent);
            }
        }

        function appendCharacterPresentationControl(container, record, refresh) {
            if (!container || !record || container.querySelector("[data-character-presentation-control]")) return;
            const controls = document.createElement("div");
            controls.dataset.characterPresentationControl = "1";
            controls.onclick = (event) => event.stopPropagation();
            controls.onkeydown = (event) => event.stopPropagation();
            const label = document.createElement("label");
            label.textContent = "Gender ";
            const select = document.createElement("select");
            for (const [value, text] of [["", "Profile Default"], ["female", "Female"], ["male", "Male"]]) {
                const option = document.createElement("option");
                option.value = value;
                option.textContent = text;
                select.append(option);
            }
            select.value = characterPresentationOverride(record);
            select.onchange = () => {
                if (select.value) characterPresentationOverrides.set(characterPresentationOverrideKey(record), select.value);
                else characterPresentationOverrides.delete(characterPresentationOverrideKey(record));
                saveCharacterPresentationOverrides();
                queueMissingCharacterPresentationImage(record);
                refresh();
                refreshCharacterPresentationGridCards(record);
            };
            label.append(select);
            const reset = document.createElement("button");
            reset.type = "button";
            reset.textContent = "Reset to Profile Default";
            reset.onclick = () => {
                characterPresentationOverrides.delete(characterPresentationOverrideKey(record));
                saveCharacterPresentationOverrides();
                queueMissingCharacterPresentationImage(record);
                refresh();
                refreshCharacterPresentationGridCards(record);
            };
            controls.append(label, reset);
            container.append(controls);
        }

        function characterLibraryPresentationContext(record = {}, requestedGender = "") {
            const canonicalEntity = characterLibraryRecordEntity(record);
            if (!canonicalEntity) return null;
            const entity = characterLibraryPresentation(
                canonicalEntity,
                record.id || record.name || canonicalEntity.name,
                characterPresentationOverride(record) || requestedGender,
                { allowNonRomanceable: !!characterPresentationOverride(record) },
            );
            const presentationKey = characterLibraryPresentationKeyForGender(entity.gender);
            const name = characterLibraryProfileHandle(record, presentationKey);
            const activeId = characterLibraryActiveProfileImageId(record, entity.gender);
            entity.profile_image_request_key = name;
            entity.default_profile_image = clone(
                profileImagePresentationSlot(
                    canonicalEntity,
                    presentationKey === "male",
                ),
            );
            entity.profile_image_id = activeId;
            return { record, canonicalEntity, entity, presentationKey, name };
        }

        function characterLibraryProfileName(record = {}, requestedGender = "") {
            return characterLibraryPresentationContext(
                record,
                requestedGender || characterLibraryRequestedPresentationGender(),
            )?.name || "";
        }

        function characterLibraryRecordForProfileName(name = "") {
            const wanted = String(name || "");
            if (!wanted) return null;
            return (app.characterDefinitions || []).find((record) =>
                CHARACTER_LIBRARY_ACTIVE_PROFILE_IMAGE_ID_FIELDS.some(
                    (presentationKey) =>
                        characterLibraryProfileHandle(record, presentationKey) === wanted,
                ),
            ) || null;
        }

        function characterLibraryPresentationKeyFromProfileName(record = {}, name = "") {
            const wanted = String(name || "");
            return CHARACTER_LIBRARY_ACTIVE_PROFILE_IMAGE_ID_FIELDS.find(
                (presentationKey) =>
                    characterLibraryProfileHandle(record, presentationKey) === wanted,
            ) || "";
        }

        function characterLibraryCardSize() {
            const value = String(app.settings?.characterLibraryCardSize || "large");
            return ["tiny", "small", "medium", "large", "huge"].includes(value) ? value : "large";
        }

        function characterLibrarySortValue(tab = characterLibraryActiveTab()) {
            const input = $(`characterLibrarySort-${tab}`);
            const value = String(input?.value || app.characterLibrarySorts?.[tab] || "name-az");
            return ["name-az", "name-za", "gender-az", "source-az"].includes(value)
                ? value
                : "name-az";
        }

        function characterLibrarySortRecords(records = [], tab = characterLibraryActiveTab()) {
            const sort = characterLibrarySortValue(tab);
            const text = (value) => String(value || "").toLowerCase();
            const entityFor = (record) => characterLibraryRecordEntity(record) || {};
            return [...records].sort((a, b) => {
                if (sort === "name-za")
                    return text(b.name).localeCompare(text(a.name));
                if (sort === "gender-az") {
                    const genderCompare = text(entityFor(a).gender).localeCompare(
                        text(entityFor(b).gender),
                    );
                    if (genderCompare) return genderCompare;
                } else if (sort === "source-az") {
                    const sourceCompare = text(a.source || entityFor(a).source).localeCompare(
                        text(b.source || entityFor(b).source),
                    );
                    if (sourceCompare) return sourceCompare;
                }
                return text(a.name).localeCompare(text(b.name));
            });
        }

        function characterLibrarySortPublicEntries(entries = [], tab = "public") {
            const sort = characterLibrarySortValue(tab);
            const text = (value) => String(value || "").toLowerCase();
            return [...entries].sort((a, b) => {
                if (sort === "name-za")
                    return text(b.name).localeCompare(text(a.name));
                if (sort === "gender-az") {
                    const genderCompare = text(a.gender).localeCompare(text(b.gender));
                    if (genderCompare) return genderCompare;
                } else if (sort === "source-az") {
                    const sourceCompare = text(a.source).localeCompare(text(b.source));
                    if (sourceCompare) return sourceCompare;
                }
                return text(a.name).localeCompare(text(b.name));
            });
        }

        function characterLibrarySortOptionsHtml(tab = "local") {
            const selected = app.characterLibrarySorts?.[tab] || (tab === "public" ? "highest-rated" : characterLibrarySortValue(tab));
            const option = (value, label) =>
                `<option value="${escapeHtml(value)}" ${selected === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
            return `
                <label>Sort by
                    <select id="characterLibrarySort-${escapeHtml(tab)}" data-character-library-sort="${escapeHtml(tab)}" onchange="EmberAdventures.setCharacterLibrarySort(${htmlJsArg(tab)}, this.value)">
                        ${tab === "public" ? `${option("highest-rated", "Highest Rated")}${option("newest", "Newest")}${option("oldest", "Oldest")}${option("updated", "Recently Updated")}` : ""}
                        ${option("name-az", "Name (A-Z)")}
                        ${option("name-za", "Name (Z-A)")}
                        ${tab === "public" ? "" : `${option("gender-az", "Gender (A-Z)")}${option("source-az", "Source (A-Z)")}`}
                    </select>
                </label>
            `;
        }

        function characterLibraryCardSizeOptionsHtml() {
            const columns = unifiedLibraryColumnCount("character");
            return `
                <label>Columns
                    <span class="library-column-stepper">
                        <input type="number" min="1" step="1" value="${columns}" data-library-columns-input="character" onchange="EmberAdventures.setUnifiedLibraryColumns(this.value)">
                        <button type="button" title="More columns" aria-label="More columns" onclick="EmberAdventures.stepUnifiedLibraryColumns(1)">&#9650;</button>
                        <button type="button" title="Fewer columns" aria-label="Fewer columns" onclick="EmberAdventures.stepUnifiedLibraryColumns(-1)">&#9660;</button>
                    </span>
                </label>
            `;
        }

        function characterLibraryGenderLabel(entity = {}, fallback = "") {
            return (
                textSlot(entity.gender, "") ||
                textSlot(entity.appearance?.gender, "") ||
                textSlot(fallback, "") ||
                "unknown"
            );
        }



        function characterLibraryDefinitionInfoHtml(character = {}, record = {}) {
            const genres = genreDisplayList(character.genres || record.genres || []);

            const isPublicHosted = !!record.supabase_item_id || !!record.publicEntryId;
            const info = [
                ...(isPublicHosted ? [] : [["Source", record.source || character.source || "unknown"]]),
                ["Creator", record.creator || character.creator || "unknown"],
                ["Gender", character.gender || record.gender || "unknown"],
                ["Age", character.age ?? record.age ?? "unknown"],
                ["Role", character.role || record.role || "unknown"],
                ["Genres", genres.join(", ") || "none"],
                ...(([])),
            ];
            const description =
                textSlot(
                    character.catalog_hook ||
                        record.catalog_hook ||
                        record.description ||
                        character.personality_description,
                    "",
                ) || "Character definition.";
            const stats = isPlainObject(character.stats)
                ? Object.entries(character.stats)
                : [];
            return `
                <div class="stack character-library-definition-info">
                    <p class="hint">${escapeRuntimeTemplateText(description, character)}</p>
                    ${info
                        .map(
                            ([label, value]) =>
                                `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value ?? "unknown"))}</div>`,
                        )
                        .join("")}
                    ${stats.length ? `<div><strong>Stats:</strong> ${stats.map(([key, value]) => `${escapeHtml(humanizeIdentifierLabel(key))}: ${escapeHtml(String(value))}`).join(", ")}</div>` : ""}
                </div>
            `;
        }

        function characterLibraryCardImageHtml({ html = "", imageUrl = "", alt = "Character", pending = false } = {}) {
            if (html) return html;
            if (imageUrl)
                return `<img class="profile-image-thumb" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(alt || "Character")}">`;
            if (pending) return imageLoadingHtml("");
            return "";
        }

        function characterLibraryRecordHtml(record, options = {}) {
            const start = perfNow();
            const source = characterSourceLabel(record.source);
            const creator = characterCreatorLabel(record.creator);
            const creation_tool = characterCreationToolLabel(record.creation_tool);
            const canonicalEntity = characterLibraryRecordEntity(record) || {};
            const registered = options.publicEntryId
                ? null
                : registerCharacterLibraryProfileEntity(record);
            const entity = registered?.entity || canonicalEntity;
            const genres = genreDisplayList([
                ...(Array.isArray(entity.genres) ? entity.genres : []),
            ]);



            const searchText = [
                record.name,
                canonicalEntity.name,
                canonicalEntity.fallback_name,
                record.kind,
                record.role,
                entity.gender,
                entity.appearance?.gender,
                entity.species,
                entity.appearance?.species,
                entity.species,
                source,
                creator,
                creation_tool,
                record.location_label,
                entity.catalog_hook,
                entity.personality_description,
                entity.relationship_to_player,
                ...genres,
            ]
                .filter(Boolean)
                .join(" ");
            const publicImageHtml = options.imageHtml || "";
            const profile = publicImageHtml
                ? null
                : characterProfilePresentationCandidate(
                      entity,
                      characterPresentationUsesMaleFields(entity.gender),
                  );
            const profileOwnerKey = registered
                ? profileImageOwnerKey(registered.name, registered.entity)
                : "";
            const profilePending = publicImageHtml
                ? false
                : app.profileImageGenerating?.has(profileOwnerKey) ||
                  app.profileImageQueued?.has(profileOwnerKey);
            const profileHtml = publicImageHtml || (profile
                ? (characterLibraryCardImageHtml({
                      html: profile.html ? profileImageInnerHtml(profile) : "",
                      imageUrl: profile.url || profile.hosted_url || "",
                      alt: entity.name || record.name || "Character",
                  }))
                : characterLibraryCardImageHtml({ pending: profilePending }));
            const title = entity.name || record.name || "Unnamed";
            const recordId = characterLibraryRecordId(record);
            const click = options.clickExpression || (options.publicEntryId
                ? options.owned
                    ? `EmberAdventures.openOwnedPublicLibraryVersionManager(${htmlJsArg(options.publicEntryId)})`
                    : `EmberAdventures.openPublicCharacterLibraryDetail(${htmlJsArg(options.publicEntryId)})`
                : `EmberAdventures.openCharacterLibraryDetail(${htmlJsArg(recordId)})`);
            const extraAttrs = options.publicEntryId
                ? ` data-public-character-card data-public-entry-id="${escapeHtml(options.publicEntryId)}"`
                : ` data-character-library-id="${escapeHtml(recordId)}" data-character-library-kind="${escapeHtml(record.kind)}" data-character-library-location="${escapeHtml(record.npc_location_id || "")}"`;
            const html = `
                <div class="character-card character-library-definition-card" role="button" tabindex="0" data-character-library-card data-library-filter-fields="${escapeHtml(JSON.stringify(libraryFilterFields(record, entity)))}" data-creator="${escapeHtml(record.creator || entity.creator || "")}" data-search="${escapeHtml(searchText)}"${extraAttrs} onclick="${click}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); ${click};}">
                    <div class="character-name">
                        <span data-library-fit-text>${escapeHtml(title)}</span>
                    </div>
                    <div class="profile-image-button character-library-definition-image" title="Open character definition">
                        ${
                            profileHtml
                                ? `<div class="profile-image-thumb-wrap" ${profile?.id ? `data-profile-live-id="${escapeHtml(profile.id)}"` : ""}>${profileHtml}</div>`
                                : `<div class="profile-image-placeholder" aria-label="No profile image"></div>`
                        }
                    </div>
                    <div class="character-library-card-meta">
                        <span data-library-fit-text>${escapeHtml(characterLibraryGenderLabel(entity))}</span>
                        ${""}
                    </div>
                    ${options.footerHtml || ""}
                </div>
            `;
            const ms = perfNow() - start;
            if (ms >= 15)
                perfConsole(
                    "character library record html slow",
                    {
                        ms: Math.round(ms),
                        name: title,
                        public: !!options.publicEntryId,
                        searchChars: searchText.length,
                        hasProfile: !!profile,
                        profilePending,
                    },
                    "warn",
                );
            return html;
        }

        function ownedPublicLibraryDetailActionsHtml(entry = {}) {
            const entryId = entry.supabase_item_id || entry.id || "";
            return `
                <button type="button" data-owned-public-detail-action="update" onclick="EmberAdventures.showPublicLibraryUpdateInstructions(${htmlJsArg(entryId)})">Update</button>
                <button type="button" data-owned-public-detail-action="manage" onclick="EmberAdventures.openOwnedPublicLibraryVersionManager(${htmlJsArg(entryId)}, this)">Manage</button>
            `;
        }

        function publicCharacterLibraryDetailActionsHtml(entry = {}, options = {}) {
            const importAction = options.versionId
                ? `EmberAdventures.importPublicLibraryEntryVersion(${htmlJsArg(entry.id)}, ${htmlJsArg(options.versionId)})`
                : `EmberAdventures.importPublicCharacterToLibrary(${htmlJsArg(entry.id)})`;
            return `
                <button class="primary" type="button" data-public-character-detail-action="import" onclick="${importAction}">Download / Import</button>
                ${entry.curated ? "" : `<button type="button" class="good" data-public-character-detail-action="rate" onclick="EmberAdventures.openRatePublicStoryModal(${htmlJsArg(entry.id)})">Rate</button>
                <button type="button" data-public-character-detail-action="versions" onclick="EmberAdventures.openPublicLibraryVersionHistoryModal(${htmlJsArg(entry.id)})">Versions</button>
                <button type="button" class="icon-button warn" data-public-character-detail-action="report" title="Report Character" onclick="EmberAdventures.openReportPublicCharacterModal(${htmlJsArg(entry.id)})">&#9888;</button>`}
            `;
        }

        function publicCharacterLibraryCardHtml(entry = {}, options = {}) {
            // Public search/featured cards belong to the Public filter panel even
            // while another library tab is active. Owned cards follow the active
            // profile and must not inherit an unrelated tab's explicit filter.
            const requestedGender = characterPresentationOverride(entry) || (options.owned
                ? ""
                : characterLibraryRequestedPresentationGender("public"));
            const targetGender = requestedGender || preferredGenderForRuntimeCharacter(
                    {
                        name: entry.name || "Unnamed",
                        gender: entry.gender || "",
                    },
                    entry.id || entry.name || "public-character",
                );
            const targetMale = characterPresentationUsesMaleFields(targetGender);
            const presentationName = targetMale
                ? entry.male_name || entry.name
                : entry.non_male_name || entry.name;
            const presentationImageUrl = targetMale
                ? entry.male_image_url || (entry.gender === "male" ? entry.image_url : "")
                : entry.non_male_image_url || (entry.gender !== "male" ? entry.image_url : "");
            const character = addImmutableDefinitionFields(
                {
                    name: presentationName || "Unnamed",
                    source: entry.source || "",
                    creator: entry.creator || "",
                    gender: targetGender || entry.gender || "",
                    romanceable: true,
                    species: entry.species || "",
                    role: entry.role || "",
                    genres: Array.isArray(entry.genres) ? entry.genres : [],
                },
                presentationName || "Unnamed",
            );
            const rating = entry.rating_count
                ? `<div class="public-library-card-rating"><span aria-hidden="true">&#9733;</span> ${escapeHtml(Number(entry.rating_average || 0).toFixed(1))}<small>(${escapeHtml(entry.rating_count)})</small></div>`
                : `<div class="public-library-card-rating unrated">Unrated</div>`;
            return characterLibraryRecordHtml(
                {
                    id: entry.id || "",
                    name: presentationName || "Unnamed",
                    source: entry.source || "",
                    creator: entry.creator || "",
                    creation_tool: entry.creation_tool || "",
                    role: entry.role || "",
                    genres: Array.isArray(entry.genres) ? entry.genres : [],
                    entity: character,
                },
                {
                    publicEntryId: entry.id || "",
                    owned: options.owned === true,
                    imageHtml: characterLibraryCardImageHtml({
                        imageUrl: presentationImageUrl || "",
                        alt: presentationName || "Public character",
                    }),
                    footerHtml: `${rating}${options.owned ? `<span class="owned-public-card-state ${String(entry.visibility || "public") === "hidden" ? "hidden" : "visible"}" aria-hidden="true"></span>` : ""}`,
                },
            );
        }

        function characterLibraryTabRecords(tab = "local") {
            const records = characterLibraryRecords();
            if (tab === "mine") {
                const creatorId = mineCreatorIdentityId();
                return creatorId
                    ? records.filter((record) => definitionCreatorId(record) === creatorId)
                    : records;
            }
            return records;
        }

        function characterLibraryFeaturedCharactersHtml() {
            return `
                <div class="character-library-story-rails" data-character-library-story-rails>
                    <details class="character-library-story-rail" open>
                        <summary>Featured Characters</summary>
                        <div class="character-library-story-rail-track" data-curated-character-rail="featured">
                            <div class="character-library-story-rail-card">
                                <strong>Loading featured characters...</strong>
                            </div>
                        </div>
                    </details>
                </div>
            `;
        }

        function signedInPublicLibraryCreatorName() {
            const user = supabaseSignedInUser?.() || {};
            return String(
                user.user_metadata?.user_name ||
                    user.user_metadata?.preferred_username ||
                    user.user_metadata?.name ||
                    user.email ||
                    "",
            ).trim();
        }

        function characterLibraryReadonlyFilterSummary(value = "") {
            const list = publicTagListSlot(value);
            return list.length ? list.join(", ") : "All";
        }

        function characterLibraryAdvancedFiltersHtml(tab = "local") {
            return `
                <details class="state-branch character-library-filter-dropdown" data-character-library-filters="${escapeHtml(tab)}">
                    <summary>Filter Options</summary>
                    <div class="state-children">
                        <div class="character-library-filter-grid">
                            <label>Gender
                                <input data-character-library-filter="gender" placeholder="female, male..." oninput="EmberAdventures.handleCharacterLibraryFilterInput()">
                                <div class="character-library-gender-picks">
                                    ${defaultCharacterGenderTags()
                                        .map(
                                            (tag) =>
                                                `<button type="button" onclick="EmberAdventures.setCharacterLibraryFilterValue('gender', ${htmlJsArg(tag)})">${escapeHtml(tag)}</button>`,
                                        )
                                        .join("")}
                                </div>
                            </label>
                            <label>Species
                                <input data-character-library-filter="species" placeholder="human, elf, slime..." oninput="EmberAdventures.handleCharacterLibraryFilterInput()">
                            </label>
                            <label>Role
                                <input data-character-library-filter="role" placeholder="merchant, companion, rival..." oninput="EmberAdventures.handleCharacterLibraryFilterInput()">
                            </label>
                        </div>
                        <div class="character-library-filter-box">
                            <div class="character-library-filter-box-head">
                                <div class="character-library-filter-box-title">Genres</div>
                                <button type="button" onclick="EmberAdventures.openCharacterLibraryFilterPicker('genres')">Choose Genres</button>
                            </div>
                            <div class="character-library-filter-list">
                                <input type="hidden" data-character-library-filter="genres" value="">
                                <div class="character-library-filter-summary" data-character-library-filter-summary="genres">All</div>
                            </div>
                        </div>
                    </div>
                </details>
            `;
        }

        function characterLibraryTabHtml(tab = "local", deferCards = false) {
            const start = perfNow();
            const isPublic = tab === "public";
            const isMine = tab === "mine";
            const recordsStart = perfNow();
            const records = isPublic || deferCards
                ? []
                : characterLibrarySortRecords(characterLibraryTabRecords(tab), tab);
            const recordsMs = perfNow() - recordsStart;
            const publicMineStart = perfNow();
            const publicMineEntries = isMine && !deferCards
                ? characterLibrarySortPublicEntries(
                      app.characterLibraryOwnedCharacterEntries || [],
                      "mine",
                  )
                : [];
            const publicMineMs = perfNow() - publicMineStart;
            const cardsStart = perfNow();
            const cards = records.map(characterLibraryRecordHtml).join("");
            const publishedCards = publicMineEntries
                .map((entry) => publicCharacterLibraryCardHtml(entry, { owned: true }))
                .join("");
            const cardsMs = perfNow() - cardsStart;
            const resultHtml = isPublic
                ? `<div class="character-library-empty-state">Loading highest-rated public characters...</div>`
                : cards ||
                  `<p class="hint">${
                      isMine
                          ? "No characters belong to the selected creator yet."
                          : "No matching characters available yet."
                  }</p>`;
            const initialCount = records.length;
            const html = `
                <section class="character-library-tab-panel character-library-hide-content-badges" data-character-library-tab-panel="${escapeHtml(tab)}" data-character-library-deferred="${deferCards ? "1" : "0"}" ${tab === "public" ? "" : "hidden"}>
                    <div class="character-library-search-row">
                        <div class="character-library-search-box">
                            <input id="characterLibrarySearch-${escapeHtml(tab)}" type="search" placeholder="Character name..." data-character-library-name-search="${escapeHtml(tab)}" oninput="EmberAdventures.handleCharacterLibraryFilterInput()" onkeydown="${isPublic ? "if(event.key==='Enter'){event.preventDefault(); EmberAdventures.runPublicCharacterSearch();}" : ""}">
                        </div>
                        <button type="button" class="character-library-filters-toggle" onclick="EmberAdventures.toggleCharacterLibraryFilters(${htmlJsArg(tab)})">&#9656; Filters</button>
                        ${isPublic ? `<button class="primary" type="button" id="characterLibraryPublicSearchBtn" disabled onclick="EmberAdventures.runPublicCharacterSearch()">Search</button>` : ""}
                    </div>
                    ${characterLibraryAdvancedFiltersHtml(tab)}
                    ${isPublic ? characterLibraryFeaturedCharactersHtml() : ""}
                    ${isPublic ? `<h3 class="character-library-community-heading">Community Characters</h3>` : ""}
                    <div class="character-library-count-sort-row">
                        <p class="character-library-count" id="characterLibrarySearchCount-${escapeHtml(tab)}">${isPublic ? "0 characters of 0 total" : libraryResultCountText(initialCount, initialCount, "character")}</p>
                        <div class="character-library-display-controls">
                            ${characterLibrarySortOptionsHtml(tab)}
                            ${characterLibraryCardSizeOptionsHtml()}
                        </div>
                    </div>
                    ${isPublic ? `<p class="character-library-search-hint" id="characterLibraryPublicSearchHint">Loading highest-rated public characters...</p>` : ""}
                    <div class="character-card-grid character-library-card-grid" data-character-library-results="${escapeHtml(tab)}">${resultHtml}</div>
                    ${isPublic ? `<div class="public-library-load-more-row"><button type="button" class="public-library-load-more" data-public-library-load-more="character" onclick="EmberAdventures.loadNextPublicLibraryPage('character')" hidden>Load More</button></div>` : ""}
                    ${isMine ? `<section class="library-published-section"><header><strong>Published</strong><button type="button" onclick="EmberAdventures.loadPublishedMineItems()">Load published characters</button></header><div class="character-card-grid character-library-card-grid" data-character-library-published-results="mine">${publishedCards || `<p class="hint">Load characters published by your signed-in account.</p>`}</div></section>` : ""}
                </section>
            `;
            perfConsole(
                "character library tab html",
                {
                    ms: Math.round(perfNow() - start),
                    tab,
                    recordCount: records.length,
                    publicMineCount: publicMineEntries.length,
                    recordsMs: Math.round(recordsMs),
                    publicMineMs: Math.round(publicMineMs),
                    cardsMs: Math.round(cardsMs),
                    htmlKb: perfKb(perfBytes(html)),
                },
                cardsMs >= 75 || recordsMs >= 75 ? "warn" : "log",
            );
            return html;
        }

        function openCharacterLibraryModalLegacy(options = {}) {
            const start = perfNow();
            const hideCurrentCast = !!options.fromMainMenu;
            app.characterLibraryLastFromMainMenu = hideCurrentCast;
            const htmlStart = perfNow();
            const html = `
                <div class="character-library-shell card-size-${escapeHtml(characterLibraryCardSize())}">
                    <div class="character-library-header">
                        <div class="character-library-title-block">
                            <div class="character-library-title-icon" aria-hidden="true">&#128214;</div>
                            <div class="character-library-title-text">
                                <h2>Character Library</h2>
                                <p>Reusable character definitions. Edits do not change active saves.</p>
                            </div>
                        </div>
                        <div class="character-library-header-actions">
                            <button class="primary" type="button" onclick="EmberAdventures.openCharacterGeneratorModal({library:true})"><span aria-hidden="true">+</span> Make Character With AI</button>
                            <button type="button" onclick="EmberAdventures.openManualCharacterCreateModal({library:true})"><span aria-hidden="true">+</span> Make Character Manually</button>
                            <button class="blue" type="button" onclick="EmberAdventures.importCharacterDefinitions()"><span aria-hidden="true">&#8679;</span> Import Character</button>
                            ${hideCurrentCast ? "" : `<button type="button" onclick="EmberAdventures.openCharactersModal()">Characters</button>`}
                        </div>
                    </div>
                    <div class="tab-row" data-character-library-tabs>
                        <button class="active" type="button" data-character-library-tab="public" onclick="EmberAdventures.switchCharacterLibraryTab('public')"><span aria-hidden="true">&#127760;</span> Public Characters</button>
                        <button type="button" data-character-library-tab="local" onclick="EmberAdventures.switchCharacterLibraryTab('local')"><span aria-hidden="true">&#128421;</span> Local Characters</button>
                        <button type="button" data-character-library-tab="mine" onclick="EmberAdventures.switchCharacterLibraryTab('mine')"><span aria-hidden="true">&#128100;</span> My Characters</button>
                    </div>
                    ${characterLibraryTabHtml("public")}
                    ${characterLibraryTabHtml("local")}
                    ${characterLibraryTabHtml("mine")}
                </div>
            `;
            const htmlMs = perfNow() - htmlStart;
            const openStart = perfNow();
            openModal(html);
            const openMs = perfNow() - openStart;
            const box = $("modalBox");
            if (box) {
                const setupStart = perfNow();
                box.setAttribute("data-fullscreen-list-modal", "1");
                box.setAttribute("data-character-library-modal", "1");
                box.dataset.characterLibraryHideCurrentCast = hideCurrentCast ? "1" : "0";
                const initialTab = options.tab || app.characterLibraryLastTab || rememberedCharacterLibraryTab("public");
                switchCharacterLibraryTab(initialTab);
                if (options.initialSearch)
                    setCharacterLibraryNameSearch(initialTab, options.initialSearch);
                initializeCharacterLibraryFilters(box);
                bindCharacterLibraryCardActions(box);
                bindCharacterLibraryInfiniteScroll(box);
                perfConsole(
                    "character library open modal",
                    {
                        ms: Math.round(perfNow() - start),
                        htmlMs: Math.round(htmlMs),
                        openMs: Math.round(openMs),
                        setupMs: Math.round(perfNow() - setupStart),
                        initialTab: options.tab || "public",
                        fromMainMenu: hideCurrentCast,
                    },
                    htmlMs >= 75 || openMs >= 75 ? "warn" : "log",
                );
            }
        }

        function initializeCharacterLibraryFilters(box = $("modalBox")) {
            box?.querySelectorAll?.("[data-character-library-tab-panel]").forEach(panel => {
                updateCharacterLibraryFilterSummary(panel, "genres");
                updateCharacterLibraryFilterToggle(panel.dataset.characterLibraryTabPanel || "");
            });
        }

        function bindCharacterLibraryInfiniteScroll(box = $("modalBox")) {
            if (!box) return;
            bindPublicLibraryScrollPagination(
                box,
                "character",
                () => characterLibraryActiveTab() === "public",
                () => runPublicCharacterSearchPage({ reset: false }),
            );
        }

        function bindCharacterLibraryCardActions(root = document) {
            root?.querySelectorAll?.("[data-character-library-action]").forEach((button) => {
                button.onclick = (event) => {
                    event?.preventDefault?.();
                    event?.stopPropagation?.();
                    const name = button.dataset.characterName;
                    const locationId = button.dataset.characterLocation || "";
                    const action = button.dataset.characterLibraryAction;
                    if (!name) return;
                    if (action === "profile") {
                        openProfileImageModal(name);
                    } else if (action === "player") {
                        openPlayerModal();
                    } else if (action === "npc-edit") {
                        editNpc(name, locationId);
                    } else if (action === "edit") {
                        editCharacter(name);
                    } else if (action === "settings") {
                        openCharacterImageSettings(name);
                    }
                };
            });
        }

        function characterPayloadForImportId(payload, definitionId = "") {
            if (!definitionId || !Array.isArray(payload?.characters)) return payload;
            const selected = payload.characters.find(record => record?.character_definition?.id === definitionId);
            if (!selected) throw new Error("Character " + definitionId + " is missing from its hosted payload.");
            return {...payload, characters:[selected]};
        }

        function publicCharacterPayloadRecordsForEntry(payload, entry = {}) {
            const definitionId = textSlot(entry.definition_id || entry.characterId, "");
            return characterImportRecordsFromExport(characterPayloadForImportId(payload, definitionId));
        }

        async function openPublicCharacterLibraryDetail(
            entryId = "",
            detailMode = "public",
            versionId = "",
        ) {
            if (detailMode === "mine" && !versionId)
                return openOwnedPublicLibraryVersionManager(entryId);
            const ownedVersionMode = !!String(versionId || "").trim();
            const ownedEntry = ownedPublicLibraryEntryById(entryId);
            let entry = publicLibraryEntryById(entryId) || ownedEntry;
            if (!entry) {
                showNotice("Public Character Not Found", "Run the public character search again and try this character once more.");
                return;
            }
            try {
                if (ownedVersionMode) {
                    if (!ownedEntry)
                        throw new Error("That owned public character was not found.");
                    const state = await fetchOwnedPublicLibraryVersionState(entryId);
                    applyOwnedPublicLibraryVersionState(state);
                    const version = state.versions.find(
                        (item) => String(item.id || "") === String(versionId),
                    );
                    if (!version?.payload_url)
                        throw new Error("That published version does not have a hosted payload.");
                    entry = {
                        ...clone(ownedEntry),
                        url: version.payload_url,
                        image_url: version.image_url || ownedEntry.image_url || "",
                        payload_sha256: version.payload_sha256,
                        payload_size_bytes: version.payload_size_bytes,
                    };
                }
                const payload = entry.curated
                    ? await fetchCuratedJsonPayload(curatedCharacterManifestEntry(entry))
                    : await fetchVerifiedPublicLibraryPayload(entry);
                const records = publicCharacterPayloadRecordsForEntry(payload, entry);
                const first = records[0] || {};
                const character = addImmutableDefinitionFields(
                    first.character_definition || first.character || first.npc?.full_character || {},
                    first.name || entry.name || "Public Character",
                );
                const projectedCharacter = characterLibraryPresentation(
                    character,
                    entry.id || character.name,
                    characterPresentationOverride(entry) || characterLibraryRequestedPresentationGender("public"),
                    { allowNonRomanceable: !!characterPresentationOverride(entry) },
                );
                const projectedMale = characterPresentationUsesMaleFields(
                    projectedCharacter.gender,
                );
                const projectedName = ownedVersionMode
                    ? projectedCharacter.name
                    : projectedMale
                      ? entry.male_name || projectedCharacter.name
                      : entry.non_male_name || projectedCharacter.name;
                const payloadProfileImage = ownedVersionMode
                    ? characterProfilePresentationCandidate(character, projectedMale)
                    : null;
                const projectedImageUrl = payloadProfileImage?.url ||
                    payloadProfileImage?.hosted_url ||
                    (projectedMale
                        ? entry.male_image_url || (entry.gender === "male" ? entry.image_url : "")
                        : entry.non_male_image_url || (entry.gender !== "male" ? entry.image_url : ""));
                app.characterLibraryPublicPayloads ||= {};
                app.characterLibraryPublicPayloads[entry.id] = {
                    identity: publicCharacterPayloadCacheIdentity(entry),
                    records: clone(records),
                };
                const popup = openCharacterLibraryLayer(`
                    <h2>${escapeHtml(projectedName || "Public Character")}</h2>
                    <div class="split-grid">
                        <div>
                            ${
                                projectedImageUrl
                                    ? `<div class="profile-image-button character-library-detail-image"><div class="profile-image-thumb-wrap"><img class="profile-image-thumb" src="${escapeHtml(projectedImageUrl)}" alt="${escapeHtml(projectedName || "Public character")}"></div></div>`
                                    : `<div class="profile-image-button character-library-detail-image"><div class="profile-image-placeholder" aria-label="No profile image"></div></div>`
                            }
                        </div>
                        ${characterLibraryDefinitionInfoHtml(projectedCharacter, entry)}
                    </div>
                    <div class="state-editor-tree character-library-readonly-definition">
                        ${buildCharacterDefinitionOnlyEditor(projectedCharacter, { readonly: true, rootOpen: false, entityLabel: projectedName || "Public Character" })}
                    </div>
                    <div class="row" style="margin-top:.8rem">
                        ${publicCharacterLibraryDetailActionsHtml(entry, { versionId })}
                        <button type="button" onclick="EmberAdventures.closeContainingPopup(this)">Back</button>
                    </div>
                `, {
                    title: "Public Character",
                    attr: "data-public-character-detail",
                });
                appendCharacterPresentationControl(popup.box, entry, () => {
                    closeContainingPopup(popup.box);
                    openPublicCharacterLibraryDetail(entryId, detailMode, versionId);
                });
                setTimeout(() => autosizeStateTextareas(popup.box), 0);
            } catch (err) {
                if (devSmokeSuiteState().running) throw err;
                openCharacterLibraryLayer(`
                    <h2>${escapeHtml(entry.name || "Public Character")}</h2>
                    <p class="hint">Unable to fetch the hosted character payload.</p>
                    <pre class="json-view">${escapeHtml(err.message || String(err))}</pre>
                    <div class="row" style="margin-top:.8rem">
                        <button type="button" onclick="EmberAdventures.closeContainingPopup(this)">Back</button>
                    </div>
                `, {
                    title: "Public Character",
                    attr: "data-public-character-detail",
                });
            }
        }

        async function importPublicCharacterToLibrary(entryId = "") {
            const entry = publicLibraryEntryById(entryId);
            if (!entry) {
                showNotice("Public Character Not Found", "Run the public character search again and try this character once more.");
                return;
            }
            const cachedPayload = app.characterLibraryPublicPayloads?.[entry.id];
            let records =
                cachedPayload?.identity === publicCharacterPayloadCacheIdentity(entry) &&
                Array.isArray(cachedPayload?.records)
                    ? clone(cachedPayload.records)
                    : null;
            if (!records) {
                if (!entry.url) {
                    showNotice("Public Character Missing Payload", "This public character does not have a downloadable payload URL.");
                    return;
                }
                const payload = entry.curated
                    ? await fetchCuratedJsonPayload(curatedCharacterManifestEntry(entry))
                    : await fetchVerifiedPublicLibraryPayload(entry);
                records = publicCharacterPayloadRecordsForEntry(payload, entry);
            }
            return await importCharacterDefinitionsFromRecords(
                records,
                characterLibraryMetadataFromPublicEntry(entry),
                { replaceMatchingDefinition: true },
            );
        }

        function publicCharacterPayloadCacheIdentity(entry = {}) {
            return [
                String(entry.id || ""),
                String(entry.url || ""),
                String(entry.payload_sha256 || ""),
                String(entry.supabase_current_version_id || entry.current_version_id || ""),
            ].join("\n");
        }

        function characterLibraryMetadataFromPublicEntry(entry = {}) {
            const metadata = {
                creator_id: entry.creator_id || "",
                creator: entry.creator || "",
            };
            const signedInUserId = String(supabaseSignedInUser?.()?.id || "").trim();
            const ownerUserId = String(entry.owner_user_id || "").trim();
            if (!signedInUserId || ownerUserId !== signedInUserId) return metadata;
            return {
                ...metadata,
                public_library_item_id: entry.supabase_item_id || entry.id || "",
                public_library_owner_user_id: ownerUserId,
                public_library_version_id: entry.supabase_current_version_id || "",
            };
        }

        function characterLibraryRecordHasPublishedEntry(record = {}) {
            if (String(record.public_library_item_id || "").trim()) return true;
            const signedInUserId = String(supabaseSignedInUser?.()?.id || "").trim();
            if (!signedInUserId) return false;
            const ownedEntries = [
                ...(app.characterLibraryOwnedCharacterEntries || []),
                ...(app.publicLibraryOwnedIndex?.items || []),
            ];
            return ownedEntries.some(
                (entry) =>
                    entry.type === "character" &&
                    String(entry.owner_user_id || "").trim() === signedInUserId &&
                    String(entry.creator_id || "").trim() ===
                        String(record.creator_id || "").trim() &&
                    String(entry.definition_id || "").trim() ===
                        String(record.id || "").trim(),
            );
        }

        async function openCharacterLibraryDetail(recordId = "") {
            return openCharacterLibraryDetailNow(recordId);
        }

        function openCharacterLibraryDetailNow(recordId = "") {
            const record = characterLibraryRecordById(recordId);
            if (!record) {
                showNotice("Character Not Found", "Refresh the Character Library and try again.");
                return;
            }
            const canonicalEntity = characterLibraryRecordEntity(record);
            if (!canonicalEntity) {
                showNotice("Character Not Found", "That character definition is not available.");
                return;
            }
            const registeredProfile = registerCharacterLibraryProfileEntity(record);
            const profileEntity = registeredProfile?.entity || clone(canonicalEntity);
            const profileName = registeredProfile?.name || "";
            const entity = profileEntity;
            const profile = characterProfilePresentationCandidate(
                profileEntity,
                characterPresentationUsesMaleFields(entity.gender),
            );
            const profileOwnerKey = registeredProfile
                ? profileImageOwnerKey(profileName, profileEntity)
                : "";
            const profilePending =
                app.profileImageGenerating?.has(profileOwnerKey) ||
                app.profileImageQueued?.has(profileOwnerKey);
            const profileHtml = profile
                ? (characterLibraryCardImageHtml({
                      html: profile.html ? profileImageInnerHtml(profile) : "",
                      imageUrl: profile.url || profile.hosted_url || "",
                      alt: entity.name || record.name || "Character",
                  }))
                : profilePending
                  ? imageLoadingHtml("")
                  : "";
            const title = entity.name || record.name || "Unnamed Character";
            const publishLabel = characterLibraryRecordHasPublishedEntry(record)
                ? "Update"
                : "Publish";
            const deleteButton =
                record.kind === "player"
                    ? `<button type="button" class="danger" disabled title="The active player cannot be deleted from the current local game.">Delete</button>`
                    : `<button type="button" class="danger" onclick="EmberAdventures.deleteCharacterLibraryDefinition(${htmlJsArg(recordId)})">Delete</button>`;
            //Returning from settings or editing replaces this character's prior detail layer.
            for (const detail of document.querySelectorAll(
                `[data-character-library-detail="${cssEscape(recordId)}"]`,
            )) {
                closeContainingPopup(detail);
            }

            const popup = openCharacterLibraryLayer(`
                <div data-character-library-detail="${escapeHtml(recordId)}">
                    <h2>${escapeHtml(title)}</h2>
                    <button type="button" class="profile-image-button character-library-detail-image" title="Open profile images" onclick="EmberAdventures.openCharacterLibraryImages(${htmlJsArg(recordId)})">
                        ${
                            profileHtml
                                ? `<div class="profile-image-thumb-wrap" ${profile?.id ? `data-profile-live-id="${escapeHtml(profile.id)}"` : ""}>${profileHtml}</div>`
                                : `<div class="profile-image-placeholder" aria-label="No profile image"></div>`
                        }
                    </button>
                    ${characterLibraryDefinitionInfoHtml(entity, record)}
                    <div class="row" style="margin-top:.85rem">
                        <button type="button" class="primary" onclick="EmberAdventures.openCharacterDefinitionChatPlayerPrompt(${htmlJsArg(recordId)})">Start Game</button>
                        <button type="button" class="icon-button" title="Edit definition" onclick="EmberAdventures.editCharacterLibraryDefinition(${htmlJsArg(recordId)})">&#9998;</button>
                        <button type="button" class="icon-button" title="Definition settings" onclick="EmberAdventures.openCharacterLibrarySettings(${htmlJsArg(recordId)})">&#9881;</button>
                        <button type="button" onclick="EmberAdventures.exportCharacterLibraryDefinition(${htmlJsArg(recordId)})">Export</button>
                        <button type="button" class="good" onclick="EmberAdventures.publishCharacterLibraryDefinition(${htmlJsArg(recordId)})">${publishLabel}</button>
                        ${deleteButton}
                        <button type="button" onclick="EmberAdventures.closeContainingPopup(this)">Back</button>
                    </div>
                </div>
            `, { title: "Character Definition", attr: "data-character-library-detail-modal" });
            appendCharacterPresentationControl(popup.box.querySelector("[data-character-library-detail]"), record, () => openCharacterLibraryDetailNow(recordId));
            const imageControls = document.createElement("button");
            imageControls.type = "button";
            imageControls.textContent = `Manage / Generate ${entity.gender === "male" ? "Male" : "Non-Male"} Image`;
            imageControls.onclick = () => openCharacterLibraryImages(recordId);
            popup.box.querySelector("[data-character-library-detail]").append(imageControls);
        }

        async function openCharacterLibraryImages(recordId = "") {
            const record = characterLibraryRecordById(recordId);
            if (!record) {
                showNotice("Character Not Found", "Refresh the Character Library and try again.");
                return;
            }
            const registered = registerCharacterLibraryProfileEntity(record);
            if (registered?.name) {
                await loadSharedCharacterImages(registered.entity?.id || record.id);
                openProfileImagePopupModal(registered.name);
            }
        }

        function registerCharacterLibraryProfileEntity(
            recordOrId = "",
            requestedGender = characterLibraryRequestedPresentationGender(),
        ) {
            const record =
                typeof recordOrId === "string"
                    ? characterLibraryRecordById(recordOrId)
                    : recordOrId;
            if (record?.publicEntry) return null;
            const context = characterLibraryPresentationContext(
                record,
                requestedGender,
            );
            if (!context?.name || !context.entity) return null;
            const { entity, name, presentationKey } = context;
            applyCharacterLibraryPreferredVoice(record, entity);
            if (clearInvalidRuntimeProfileImagePointer(entity))
                syncCharacterLibraryProfileSelection(name, "");
            resolveActiveProfileImageReference(entity);
            app.profileEntityOverrides ||= {};
            app.profileEntityOverrides[name] = entity;
            return { record, entity, name, presentationKey };
        }

        function applyCharacterLibraryPreferredVoice(record = {}, character = {}) {
            if (!isPlainObject(character)) return character;
            character.voice = {
                gender_bucket:
                    normalizedCharacterGender(character.gender) === "male"
                        ? "male"
                        : "non_male",
                preferred_voice_name: String(record.preferred_voice_name || "").trim(),
            };
            return character;
        }

        function syncCharacterLibraryProfileSeed(name = "", seed = 0) {
            const wanted = String(name || "");
            if (!wanted || !Array.isArray(app.characterDefinitions)) return false;
            const record = characterLibraryRecordForProfileName(wanted);
            if (!record?.character) return false;
            const cleanSeed = parseProfileImageSeedInput(
                seed,
                record.character.default_seed,
                "character library profile image seed",
            );
            if (
                record.character.default_seed === cleanSeed &&
                record.character.image_prompt_config?.seed === cleanSeed
            )
                return true;
            record.character.default_seed = cleanSeed;
            record.character.image_prompt_config = imagePromptConfigFromExactInput(
                {
                    ...(isPlainObject(record.character.image_prompt_config)
                        ? record.character.image_prompt_config
                        : {}),
                    seed: cleanSeed,
                },
                cleanSeed,
            );
            const now = new Date().toISOString();
            record.character.updated_at = now;
            record.updated_at = now;
            app.characterLibraryRecordsCache = null;
            saveCharacterLibraryRecordsNow(
                [record],
                "character library profile image seed changed",
            );
            return true;
        }

        function syncCharacterLibraryProfileSelection(name = "", imageId = "") {
            const wanted = String(name || "");
            if (!wanted || !Array.isArray(app.characterDefinitions)) return false;
            const record = characterLibraryRecordForProfileName(wanted);
            if (!record) return false;
            const image = imageId ? profileImageByStoreId(imageId) : null;
            const presentationKey = characterLibraryPresentationKeyFromProfileName(
                record,
                wanted,
            );
            if (
                image &&
                (image.male === true ? "male" : "non_male") !== presentationKey
            )
                throw new Error("Character Library profile selection presentation does not match its image.");
            const activeIds = exactCharacterLibraryActiveProfileImageIds(
                record.active_profile_image_ids,
            );
            activeIds[presentationKey] = String(imageId || "");
            record.active_profile_image_ids = activeIds;
            if (record.character) {
                if (image) {
                    const projected = characterLibraryPresentation(
                        record.character,
                        record.id || record.name,
                        image.male ? "male" : "female",
                    );
                    setLocalDefaultProfileImage(projected, imageId, image, {
                        keepUrl: true,
                        save: false,
                        setActive: false,
                    });
                    record.character.profile_image_presentations = clone(
                        projected.profile_image_presentations,
                    );
                    record.character.default_seed = projected.default_seed;
                    record.character.image_prompt_config = clone(
                        projected.image_prompt_config,
                    );
                }
                const canonicalPresentationKey =
                    characterLibraryPresentationKeyForGender(
                        record.character.gender,
                    );
                if (
                    image && canonicalPresentationKey === presentationKey
                )
                    record.character.default_profile_image = clone(
                        record.character.profile_image_presentations[presentationKey],
                    );
                const selectedImageIds = Object.values(activeIds).filter(Boolean);
                record.character.profile_images = {
                    active_image_id: activeIds[canonicalPresentationKey],
                    image_ids: selectedImageIds,
                };
                delete record.character.profile_image_id;
                delete record.character.profile_images_list;
                record.character.images = characterDefinitionImageOwnerSlot(
                    record.character.images,
                );
            }
            app.characterLibraryRecordsCache = null;
            if (record)
                saveCharacterLibraryRecordsNow(
                    [record],
                    "character library profile image selection",
                );
            return true;
        }

        function characterLibraryProfileImageMarkup(record = {}) {
            const registered = registerCharacterLibraryProfileEntity(record);
            const entity = registered?.entity || characterLibraryRecordEntity(record) || {};
            const profileName = registered?.name || "";
            const profile = characterProfilePresentationCandidate(
                entity,
                characterPresentationUsesMaleFields(entity.gender),
            );
            const profileOwnerKey = registered
                ? profileImageOwnerKey(profileName, entity)
                : "";
            const profilePending =
                app.profileImageGenerating?.has(profileOwnerKey) ||
                app.profileImageQueued?.has(profileOwnerKey);
            const profileHtml = profile
                ? (characterLibraryCardImageHtml({
                      html: profile.html ? profileImageInnerHtml(profile) : "",
                      imageUrl: profile.url || profile.hosted_url || "",
                      alt: entity.name || profileName || "Character",
                  }))
                : profilePending
                  ? imageLoadingHtml("")
                  : "";
            return profileHtml
                ? `<div class="profile-image-thumb-wrap" ${profile ? `data-profile-live-id="${escapeHtml(profile.id)}"` : ""}>${profileHtml}</div>`
                : `<div class="profile-image-placeholder" aria-label="No profile image"></div>`;
        }

        function refreshCharacterLibraryProfileSurfaces(name = "") {
            const wanted = String(name || "");
            if (!wanted) return;
            if (
                !document.querySelector(
                    "[data-character-library-id], [data-character-library-detail]",
                )
            )
                return;
            for (const record of characterLibraryRecords()) {
                if (characterLibraryProfileName(record) !== wanted) continue;
                const recordId = characterLibraryRecordId(record);
                const markup = characterLibraryProfileImageMarkup(record);
                document
                    .querySelectorAll(
                        `[data-character-library-id="${cssEscape(recordId)}"] .character-library-definition-image`,
                    )
                    .forEach((node) => {
                        node.innerHTML = markup;
                    });
                document
                    .querySelectorAll(
                        `[data-character-library-detail="${cssEscape(recordId)}"] .character-library-detail-image`,
                    )
                    .forEach((node) => {
                        node.innerHTML = markup;
                    });
                activatePluginIframes(document);
            }
        }

        function openCharacterLibrarySettings(recordId = "") {
            const record = characterLibraryRecordById(recordId);
            if (!record) {
                showNotice("Character Not Found", "Refresh the Character Library and try again.");
                return;
            }
            const character = characterLibraryRecordEntity(record) || {};
            loadVoices();
            const definitionProfileModel = profileDefinitionImageModel(character);
            const characterVoiceGender =
                normalizedCharacterGender(character.gender) === "male" ? "male" : "female";
            openCharacterLibraryLayer(`
                <h2>${escapeHtml(record.name || character.name || "Character")} Settings</h2>
                <div id="characterLibrarySettingsEditor" data-character-library-settings-id="${escapeHtml(recordId)}" class="stack">
                    <label>Preferred voice name
                        <select id="characterLibraryPreferredVoiceName">
                            ${characterVoiceOptions(
                                record.preferred_voice_name || "",
                                characterVoiceGender,
                                { allowAutomatic: true },
                            )}
                        </select>
                    </label>
                    <label>Default seed
                        <input id="characterLibraryDefaultSeed" type="number" min="0" step="1" value="${escapeHtml(character.default_seed ?? 0)}">
                    </label>
                    <label>Default profile image art style
                        <select id="characterLibraryDefaultProfileImageModel">${imageModelSelectOptionsHtml(definitionProfileModel)}</select>
                    </label>
                </div>
                <div class="row" style="margin-top:.8rem">
                    <button class="primary" type="button" onclick="EmberAdventures.saveCharacterLibrarySettings()">Save</button>
                    <button type="button" onclick="EmberAdventures.closeContainingPopup(this)">Back</button>
                </div>
            `, { title: "Character Definition Settings" });
            setTimeout(() => autosizeStateTextareas(document), 0);
        }

        function saveCharacterLibrarySettings() {
            const editor = $("characterLibrarySettingsEditor");
            const recordId = editor?.dataset.characterLibrarySettingsId || "";
            const record = characterLibraryRecordById(recordId);
            const character = clone(characterLibraryRecordEntity(record) || {});
            if (!record || !character) return;
            character.voice = null;
            const preferredVoiceName = String(
                $("characterLibraryPreferredVoiceName")?.value || "",
            ).trim();
            character.default_seed = parseProfileImageSeedInput(
                $("characterLibraryDefaultSeed")?.value,
                0,
                "character library default seed",
            );
            character.image_prompt_config = imagePromptConfigFromExactInput(
                {
                    ...(isPlainObject(character.image_prompt_config)
                        ? character.image_prompt_config
                        : {}),
                    profile_style: selectedProfileImageModel(
                        $("characterLibraryDefaultProfileImageModel")?.value ||
                            PROFILE_IMAGE_MODEL_DEFAULT,
                    ),
                },
                character.default_seed,
            );
            character.updated_at = new Date().toISOString();
            const updatedRecord = upsertCharacterLibraryDefinition({
                ...storedCharacterLibraryRecord(record),
                character,
                name: character.name || record.name,
                source: character.source,
                creation_tool: character.creation_tool,
                role: character.role,
                preferred_voice_name: preferredVoiceName,
                updated_at: character.updated_at,
            });
            if (updatedRecord)
                saveCharacterLibraryRecordsNow(
                    [updatedRecord],
                    "character library settings changed",
                );
            closeContainingPopup($("characterLibrarySettingsEditor"));
            openCharacterLibraryDetail(recordId);
        }

        function characterLibraryDefinitionExportRecord(recordId = "") {
            const record = characterLibraryRecordById(recordId);
            if (!record) return null;
            return characterDefinitionFileForExport(
                storedCharacterLibraryRecord(record),
            );
        }

        function repairAiFutureCastBackedNpcShells(state = app.state) {
            const items = state?.future_cast?.items || {};
            for (const location of Object.values(state?.npc_directory?.locations || {})) {
                for (const [name, npc] of Object.entries(location?.characters || {})) {
                    if (!isPlainObject(npc) || npc.full_character) continue;
                    const futureId = textSlot(npc.future_character_id, "");
                    const entry =
                        (futureId && items[futureId]) ||
                        Object.values(items).find(
                            (candidate) =>
                                normalizeNameForMatch(candidate?.name) ===
                                    normalizeNameForMatch(npc.name || name) ||
                                normalizeNameForMatch(candidate?.full_character?.name) ===
                                    normalizeNameForMatch(npc.name || name),
                        );
                    if (!isPlainObject(entry?.full_character)) continue;
                    const fullCharacter = materializeCharacterForRuntime(
                        entry.full_character,
                        entry.full_character.name || entry.name || npc.name || name,
                    );
                    npc.future_character_id = entry.id || futureId;
                    npc.name = fullCharacter.name;
                    npc.gender = fullCharacter.gender;
                    npc.age = fullCharacter.age;
                    npc.role = fullCharacter.role;
                    npc.relationship =
                        fullCharacter.relationship_to_player || npc.relationship || "unknown";
                    npc.inspected = true;
                    npc.full_character = fullCharacter;
                }
            }
        }

        function characterDefinitionImageOwnerSlot(value, activeId = "") {
            const imageIds = [];
            if (isPlainObject(value)) {
                for (const id of Array.isArray(value.image_ids) ? value.image_ids : []) {
                    const cleanId = String(id || "").trim();
                    if (cleanId && !imageIds.includes(cleanId)) imageIds.push(cleanId);
                }
                const existingActive = String(value.active_image_id || "").trim();
                if (existingActive && !imageIds.includes(existingActive))
                    imageIds.unshift(existingActive);
                if (!activeId) activeId = existingActive;
            }
            activeId = String(activeId || "").trim();
            if (activeId && !imageIds.includes(activeId))
                imageIds.unshift(activeId);
            return {
                active_image_id: activeId || imageIds[0] || "",
                image_ids: imageIds,
            };
        }

        function characterDefinitionOnlyFromEntity(entity = {}, name = "") {
            const runtimeSource = clone(entity || {});
            if (Array.isArray(runtimeSource.profile_images))
                resolveActiveProfileImageReference(runtimeSource);
            const activeProfileId = Array.isArray(runtimeSource.profile_images)
                ? String(runtimeSource.profile_image_id || "").trim()
                : String(
                      runtimeSource.profile_images?.active_image_id ||
                          runtimeSource.profile_image_id ||
                          "",
                  ).trim();
            const full = projectCharacterDefinitionFields(
                addImmutableDefinitionFields(
                    runtimeSource,
                    name || entity?.name || "",
                ),
            );
            removeRuntimeClothingFromCharacterDefinition(full);
            if (
                activeProfileId &&
                !defaultProfileLocalImageId(full) &&
                profileImageIsFinished(profileImageByStoreId(activeProfileId))
            ) {
                full.default_profile_image = profileImageSlotFromExactInput({
                    ...full.default_profile_image,
                    local_image_id: activeProfileId,
                });
            }
            for (const key of CHARACTER_GAME_MANAGED_EDITOR_KEYS) {
                delete full[key];
            }
            const profileImages = characterDefinitionImageOwnerSlot(
                full.profile_images,
                defaultProfileLocalImageId(full) || activeProfileId,
            );
            const normalImages = characterDefinitionImageOwnerSlot(full.images);
            delete full.active_outfit_id;
            delete full.image;
            delete full.profile_images_list;
            delete full.profile_image_id;
            full.profile_images = profileImages;
            full.images = normalImages;
            if (isPlainObject(full.voice)) {
                const preferred = textSlot(full.voice.preferred_voice_name, "");
                full.voice = {
                    ...full.voice,
                    preferred_voice_name: isCanonicalDefaultVoiceRequest(preferred)
                        ? ""
                        : preferred,
                };
            }
            return full;
        }

        function projectCharacterLibraryDefinitionProfileFields(record = {}) {
            if (!record?.character) return record;
            resolveActiveProfileImageReference(record.character);
            const activeProfileId = String(record.character.profile_image_id || "").trim();
            if (
                activeProfileId &&
                !defaultProfileLocalImageId(record.character) &&
                profileImageIsFinished(profileImageByStoreId(activeProfileId))
            ) {
                record.character.default_profile_image = profileImageSlotFromExactInput({
                    ...record.character.default_profile_image,
                    local_image_id: activeProfileId,
                });
            }
            record.character.profile_images = characterDefinitionImageOwnerSlot(
                null,
                defaultProfileLocalImageId(record.character) || activeProfileId,
            );
            delete record.character.profile_images_list;
            delete record.character.profile_image_id;
            record.character.images = characterDefinitionImageOwnerSlot(null);
            return record;
        }

        function exportCharacterLibraryDefinition(recordId = "") {
            const payload = characterLibraryDefinitionExportRecord(recordId);
            if (!payload) {
                showNotice("Export Failed", "That character definition is not available.");
                return;
            }
            downloadJsonPayload(
                payload,
                `emberadventureslite-character-${safeArchiveFileName(payload.character_definition.name)}.json`,
            );
        }

        function shareCharacterLibraryDefinition(recordId = "") {
            const displayedRecord = characterLibraryRecordById(recordId);
            if (!displayedRecord) {
                showNotice("Share Failed", "That character definition is not available.");
                return;
            }
            return shareCharacterRecords(
                [storedCharacterLibraryRecord(displayedRecord)],
                "character",
            );
        }

        async function publishCharacterLibraryDefinition(recordId = "", options = {}) {
            const storedRecord = characterLibraryRecordById(recordId);
            if (!storedRecord) {
                showNotice("Publish Failed", "That character definition is not available.");
                return;
            }
            if (!characterRecordHasCreatorIdentity(storedRecord)) {
                const creatorIdentity = await chooseCreatorIdentityForImport(
                    storedRecord.name || "This character",
                    { confirmText: "Save Creator" },
                );
                if (!creatorIdentity) return null;
                const ownedRecord = upsertCharacterLibraryDefinition({
                    ...storedCharacterLibraryRecord(storedRecord),
                    creator_id: creatorIdentity.creator_id,
                    creator: creatorIdentity.creator_name,
                });
                if (ownedRecord)
                    saveCharacterLibraryRecordsNow(
                        [ownedRecord],
                        "character creator identity assigned before publish",
                    );
                await showNotice(
                    "Creator Saved",
                    "The creator was assigned. Review the character and click Publish again to upload it.",
                );
                return null;
            }
            const displayedRecord = characterLibraryRecordById(recordId);
            if (!displayedRecord) {
                showNotice("Publish Failed", "That character definition is not available.");
                return;
            }
            const result = await publishCharacterRecordsToPublicIndex(
                [storedCharacterLibraryRecord(displayedRecord)],
                "character",
                options,
            );
            const published = result?.result?.results?.[0] || null;
            const item = published?.item || null;
            const version = published?.version || null;
            if (item?.id) {
                const localRecord = characterLibraryRecordById(recordId);
                const character = clone(characterLibraryRecordEntity(localRecord) || {});
                const signedInUserId = String(supabaseSignedInUser?.()?.id || "").trim();
                if (localRecord && character) {
                    character.updated_at = new Date().toISOString();
                    const updatedRecord = upsertCharacterLibraryDefinition({
                        ...storedCharacterLibraryRecord(localRecord),
                        character,
                        public_library_item_id: item.id || "",
                        public_library_owner_user_id: item.owner_user_id || signedInUserId || "",
                        public_library_version_id: version?.id || item.current_version_id || "",
                        updated_at: character.updated_at,
                    });
                    if (updatedRecord)
                        saveCharacterLibraryRecordsNow(
                            [updatedRecord],
                            "character public metadata changed",
                        );
                    if (!options.bulkUpload) {
                        refreshCharacterLibraryActiveTabCards();
                        filterCharacterLibraryModal();
                    }
                }
            }
            return result;
        }

        function editCharacterLibraryDefinition(recordId = "") {
            const record = characterLibraryRecordById(recordId);
            const entity = characterLibraryRecordEntity(record);
            if (!record || !entity) {
                showNotice("Character Not Found", "That character definition is not available.");
                return;
            }
            openCharacterLibraryLayer(`
                <div id="characterLibraryDefinitionEditor" class="state-editor-tree" data-character-library-edit-id="${escapeHtml(recordId)}">
                    ${buildCharacterDefinitionOnlyEditor(entity, { entityLabel: record.name || entity.name || "Character" })}
                </div>
                <div class="row" style="margin-top:.8rem">
                    <button type="button" class="primary" onclick="EmberAdventures.saveCharacterLibraryDefinitionEditor({close:true})">Save</button>
                    <button type="button" onclick="EmberAdventures.closeContainingPopup(this)">Back</button>
                </div>
            `, { title: `Edit ${record.name || entity.name || "Character"}` });
            appendAuthoringSkillLink($("characterLibraryDefinitionEditor"));
            bindStateEditorAutoSave(
                "characterLibraryDefinitionEditor",
                () => saveCharacterLibraryDefinitionEditor({ close: false }),
                "edited character definition",
                "Character Definition Autosave Failed",
            );
        }



        async function saveCharacterLibraryDefinitionEditor({ close = false } = {}) {
            const editor = $("characterLibraryDefinitionEditor");
            const recordId = editor?.dataset.characterLibraryEditId || "";
            const record = characterLibraryRecordById(recordId);
            const entity = characterLibraryRecordEntity(record);
            if (!editor || !record || !entity) return;
            const next = readCharacterDefinitionOnlyEditor(entity, editor);
            next.name = textSlot(next.name, entity.name || record.name || "Character") || entity.name || record.name || "Character";
            if (!textSlot(next.fallback_name, "") && textSlot(entity.fallback_name, ""))
                next.fallback_name = entity.fallback_name;
            if (
                (!Array.isArray(next.fallback_outfits) || !next.fallback_outfits.length) &&
                Array.isArray(entity.fallback_outfits) &&
                entity.fallback_outfits.length
            )
                next.fallback_outfits = clone(entity.fallback_outfits);
            if (
                !textSlot(next.fallback_starting_outfit_id, "") &&
                textSlot(entity.fallback_starting_outfit_id, "")
            )
                next.fallback_starting_outfit_id = entity.fallback_starting_outfit_id;
            if (
                (!next.profile_image_presentations ||
                    !characterProfilePresentationCandidate(next, true) ||
                    !characterProfilePresentationCandidate(next, false)) &&
                entity.profile_image_presentations
            )
                next.profile_image_presentations = createProfileImagePresentations({
                    ...entity.profile_image_presentations,
                    ...(next.profile_image_presentations || {}),
                });
            next.updated_at = new Date().toISOString();
            const updatedRecord = upsertCharacterLibraryDefinition({
                ...storedCharacterLibraryRecord(record),
                character: next,
                name: next.name,
                source: next.source,
                creation_tool: next.creation_tool,
                role: next.role,
                updated_at: next.updated_at,
            });
            if (updatedRecord)
                await saveCharacterLibraryRecordsNow(
                    [updatedRecord],
                    "character definition edited",
                );
            if (close) {
                const updated = characterLibraryRecords().find((item) => item.id === record.id);
                closeContainingPopup(editor);
                openCharacterLibraryDetail(characterLibraryRecordId(updated || record));
            }
        }

        function replaceNameInArray(list, oldName, newName) {
            if (!Array.isArray(list) || !oldName || !newName || oldName === newName) return;
            for (let i = 0; i < list.length; i++) {
                if (list[i] === oldName) list[i] = newName;
            }
        }

        async function deleteCharacterLibraryDefinition(recordId = "") {
            const record = characterLibraryRecordById(recordId);
            if (!record) return;
            const name = record.name || "this character";
            if (!(await showConfirm("Delete Character Definition", `Delete ${name} from the local character library?`, { confirmText: "Delete", danger: true })))
                return;
            const deleted = await app.work.enqueueOrdered(
                `library:${libraryRecordStorageType(CHARACTER_LIBRARY_KEY)}`,
                `delete character ${record.id}`,
                () => deletePerRecordLibraryRecords(
                    CHARACTER_LIBRARY_KEY,
                    [{ id: record.id }],
                ),
            );
            if (deleted === false) return;
            app.characterDefinitions = (app.characterDefinitions || []).filter(
                (item) => item.id !== record.id,
            );
            closeCharacterLibraryDefinitionLayers(recordId);
            refreshOpenCharacterLibraryAfterDefinitionDelete(record.id);
            if ($("modalBox")?.matches?.("[data-manage-characters-modal='1']"))
                renderManageCharactersModal();
        }

        function manageCharactersState() {
            app.manageCharacters ||= { selectedIds: new Set(), deleting: false };
            if (!(app.manageCharacters.selectedIds instanceof Set))
                app.manageCharacters.selectedIds = new Set(app.manageCharacters.selectedIds || []);
            return app.manageCharacters;
        }

        function applyCompactCharacterSelectionGridSize(grid = null) {
            if (!grid) return;
            grid.style.setProperty("--character-card-min", "138px");
        }

        function managedCharacterSelectionHtml(recordId = "") {
            const checked = manageCharactersState().selectedIds.has(recordId);
            return `
                <label class="manage-character-select" onclick="event.stopPropagation()" onkeydown="event.stopPropagation()">
                    <input type="checkbox" ${checked ? "checked" : ""} onchange="EmberAdventures.toggleManagedCharacterSelection(${htmlJsArg(recordId)}, this.checked)">
                    <span>Select</span>
                </label>
            `;
        }

        function curatedCharacterManifestEntry(value = {}) {
            if (typeof value === "string")
                return { url: value, characterId: "", creator: "", creatorId: "", revision: "", payloadSha256: "", payloadSizeBytes: 0 };
            return {
                url: String(value.url || "").trim(),
                characterId: String(value.characterId || value.character_id || "").trim(),
                creator: String(value.creator || "").trim(),
                creatorId: String(value.creatorId || value.creator_id || "").trim(),
                revision: String(value.revision || "").trim(),
                payloadSha256: String(value.payloadSha256 || value.payload_sha256 || "").trim(),
                payloadSizeBytes: Number(value.payloadSizeBytes || value.payload_size_bytes || 0),
            };
        }

        function curatedPayloadCacheKey(config = {}) {
            return [
                config.url || "",
                config.revision || "",
                config.payloadSha256 || "",
                config.payloadSizeBytes || 0,
            ].join("|");
        }

        async function curatedPublicCharacterEntry(manifestEntry = {}) {
            const config = curatedCharacterManifestEntry(manifestEntry);
            if (!config.url) throw new Error("Featured character URL is missing.");
            const cacheKey = [
                "character",
                curatedPayloadCacheKey(config),
                config.characterId,
                config.creator,
                config.creatorId,
            ].join("|");
            app.publicLibraryCuratedEntryCache ||= {};
            if (Object.hasOwn(app.publicLibraryCuratedEntryCache, cacheKey))
                return app.publicLibraryCuratedEntryCache[cacheKey];
            const payload = await fetchCuratedJsonPayload(config);
            const imports = characterImportRecordsFromExport(characterPayloadForImportId(payload, config.characterId));
            const imported = config.characterId
                ? imports.find((item) => String(item.character_definition?.id || "") === config.characterId)
                : imports[0];
            if (!imported)
                throw new Error(`Featured character ${config.characterId || "record"} is missing from its hosted payload.`);
            const record = characterLibraryRecordFromDefinition(
                imported.character_definition,
                { creator: config.creator, creator_id: config.creatorId },
            );
            const validation = validateCharacterLibraryRecord(record);
            if (!validation.ok)
                throw new Error(`Featured character is invalid: ${validationErrorsText(validation)}`);
            const metadata = publicLibraryCharacterMetadata(record, config.url);
            const entry = {
                ...metadata,
                id: `curated:featured:${record.id}`,
                definition_id: record.id,
                characterId: record.id,
                url: config.url,
                revision: config.revision,
                payload_sha256: config.payloadSha256,
                payload_size_bytes: config.payloadSizeBytes,
                curated: true,
            };
            app.publicLibraryCuratedEntryCache[cacheKey] = entry;
            return entry;
        }

        function curatedPublicEntryMatchesActiveProfile(entry = {}) {
            return Boolean(entry && entry.id);
        }

        async function loadCuratedPublicCharacterRail(root = $("modalBox")) {
            const track = root?.querySelector?.('[data-curated-character-rail="featured"]');
            if (!track) return;
            const manifest = featuredContentCharacterManifest();
            if (!manifest.length) {
                track.innerHTML = `<div class="character-library-story-rail-card"><strong>No featured characters are configured yet.</strong></div>`;
                return;
            }
            const settled = await Promise.allSettled(
                manifest.map((entry) => curatedPublicCharacterEntry(entry)),
            );
            const entries = [];
            const seen = new Set();
            for (const result of settled) {
                if (
                    result.status !== "fulfilled" ||
                    seen.has(result.value.id) ||
                    !curatedPublicEntryMatchesActiveProfile(result.value)
                )
                    continue;
                seen.add(result.value.id);
                entries.push(result.value);
            }
            app.publicLibraryCuratedEntries ||= {};
            for (const entry of entries) app.publicLibraryCuratedEntries[entry.id] = entry;
            const failures = settled.filter((result) => result.status === "rejected");
            track.innerHTML = [
                ...entries.map((entry) => `<div class="character-library-story-rail-card curated-character-card">${publicCharacterLibraryCardHtml(entry)}</div>`),
                ...failures.map((result) => `<div class="character-library-story-rail-card curated-story-error"><strong>Character unavailable</strong><span>${escapeHtml(result.reason?.message || String(result.reason || "Could not load character."))}</span><button type="button" onclick="EmberAdventures.reloadCuratedPublicCharacterRail()">Retry</button></div>`),
            ].join("") || `<div class="character-library-story-rail-card"><strong>No featured characters match the active profile.</strong></div>`;
        }

        function reloadCuratedPublicCharacterRail() {
            return loadCuratedPublicCharacterRail($("modalBox"));
        }

        function managedCharacterCardHtml(record = {}) {
            const recordId = characterLibraryRecordId(record);
            return characterLibraryRecordHtml(record, {
                clickExpression: `EmberAdventures.openManagedCharacterDetail(${htmlJsArg(recordId)})`,
                footerHtml: managedCharacterSelectionHtml(recordId),
            });
        }

        function updateManageCharactersSelectionUi() {
            const box = $("modalBox");
            if (!box?.matches?.("[data-manage-characters-modal='1']")) return;
            const count = manageCharactersState().selectedIds.size;
            const selectionButton = box.querySelector("[data-toggle-managed-characters]");
            if (selectionButton) {
                selectionButton.disabled = characterLibraryRecords().length < 1;
                selectionButton.textContent = count ? "Deselect All" : "Select All";
            }
            const button = box.querySelector("[data-delete-selected-characters]");
            if (button) {
                button.disabled = count < 1;
                button.textContent = count ? `Delete Selected (${count})` : "Delete Selected";
            }
        }

        function toggleManagedCharacterSelection(recordId = "", selected = false) {
            const state = manageCharactersState();
            if (selected) state.selectedIds.add(String(recordId || ""));
            else state.selectedIds.delete(String(recordId || ""));
            updateManageCharactersSelectionUi();
        }

        function toggleAllManagedCharacters() {
            const state = manageCharactersState();
            const recordIds = characterLibraryRecords().map(characterLibraryRecordId);
            const selectAll = state.selectedIds.size < 1;
            state.selectedIds = selectAll ? new Set(recordIds) : new Set();
            const box = $("modalBox");
            box
                ?.querySelectorAll?.(".manage-character-select input[type='checkbox']")
                .forEach((input) => {
                    input.checked = selectAll;
                });
            updateManageCharactersSelectionUi();
        }

        function renderManageCharactersModal() {
            const state = manageCharactersState();
            const records = characterLibraryRecords();
            const validIds = new Set(records.map(characterLibraryRecordId));
            state.selectedIds = new Set([...state.selectedIds].filter((recordId) => validIds.has(recordId)));
            const cards = records.length
                ? records.map(managedCharacterCardHtml).join("")
                : `<div class="manage-characters-empty"><strong>No local characters</strong><p>Imported characters will appear here.</p></div>`;
            openModal(`
                <div class="manage-characters-toolbar">
                    <p class="hint">${records.length} local character${records.length === 1 ? "" : "s"}. Select character definitions to delete.</p>
                    <button type="button" data-toggle-managed-characters onclick="EmberAdventures.toggleAllManagedCharacters()">Select All</button>
                    <button type="button" class="danger" data-delete-selected-characters onclick="EmberAdventures.deleteSelectedManagedCharacters()">Delete Selected</button>
                </div>
                <div class="character-library-grid card-size-medium manage-characters-grid">${cards}</div>
            `, { title: "Manage Characters", closeDestination: "main-menu", scrollKey: "manage-characters" });
            const box = $("modalBox");
            box?.setAttribute("data-fullscreen-list-modal", "1");
            box?.setAttribute("data-manage-characters-modal", "1");
            applyCompactCharacterSelectionGridSize(
                box?.querySelector?.(".manage-characters-grid"),
            );
            scheduleAutosizeLibraryCardText(box);
            updateManageCharactersSelectionUi();
        }

        function openManageCharactersModal() {
            const state = manageCharactersState();
            state.selectedIds.clear();
            renderManageCharactersModal();
        }

        function openManagedCharacterDetail(recordId = "") {
            return openCharacterLibraryDetailNow(recordId);
        }

        function confirmManagedCharacterDeletion(count = 0) {
            return new Promise((resolve) => {
                const popup = openPopupModal(`
                    <h2>Delete Characters</h2>
                    <p class="hint">Delete ${count} selected character${count === 1 ? "" : "s"} from the local character library?</p>
                    <label class="managed-character-image-delete-option">
                        <input type="checkbox" data-delete-character-images>
                        <span>Also delete character images</span>
                    </label>
                    <div class="row" style="margin-top:.8rem">
                        <button type="button" class="danger" id="confirmYesBtn">Delete</button>
                        <button type="button" id="confirmNoBtn">Cancel</button>
                    </div>
                `);
                popup.box.querySelector("#confirmYesBtn").onclick = () => {
                    const deleteImages = !!popup.box.querySelector("[data-delete-character-images]")?.checked;
                    popup.close();
                    resolve({ confirmed: true, deleteImages });
                };
                popup.box.querySelector("#confirmNoBtn").onclick = () => {
                    popup.close();
                    resolve({ confirmed: false, deleteImages: false });
                };
            });
        }

        function managedCharacterImageIds(record = {}) {
            const entity = characterLibraryRecordEntity(record);
            const imageIds = new Set();
            const add = (value) => {
                const imageId = String(value || "").trim();
                if (imageId) imageIds.add(imageId);
            };
            const addCollection = (value) => {
                if (Array.isArray(value)) {
                    for (const image of value) add(image?.id || image?.local_image_id);
                    return;
                }
                if (!isPlainObject(value)) return;
                add(value.active_image_id);
                for (const imageId of value.image_ids || []) add(imageId);
            };
            for (const presentation of ["male", "non_male"]) {
                add(record.active_profile_image_ids?.[presentation]);
                add(entity?.profile_image_presentations?.[presentation]?.local_image_id);
            }
            add(entity?.profile_image_id);
            add(entity?.default_profile_image?.local_image_id);
            addCollection(entity?.profile_images);
            addCollection(entity?.images);
            return imageIds;
        }

        async function deleteManagedCharacterImages(records = []) {
            await app.work.flush(
                `library:${libraryRecordStorageType(PROFILE_IMAGE_KEY)}`,
            );
            const characterIds = new Set();
            const imageIds = new Set();
            for (const record of records) {
                const entity = characterLibraryRecordEntity(record);
                for (const value of [record.id, entity?.id, entity?.character_id]) {
                    const id = String(value || "").trim();
                    if (id) characterIds.add(id);
                }
                for (const imageId of managedCharacterImageIds(record))
                    imageIds.add(imageId);
            }
            const catalog = await app.persistence.listManagedImages();
            const items = (catalog?.items || []).filter(
                (item) =>
                    (item.storeName === "characterProfileImages" || item.storeName === "characterImages") &&
                    (
                        characterIds.has(String(item.characterId || "")) ||
                        imageIds.has(String(item.imageId || ""))
                    ),
            );
            if (!items.length) return;
            removeManagedImagesFromRuntime(items);
            await app.persistence.deleteManagedImages(items.map(managedImageDeleteReference));
        }

        async function deleteSelectedManagedCharacters() {
            const state = manageCharactersState();
            if (state.deleting) return;
            const records = [...state.selectedIds].map(characterLibraryRecordById).filter(Boolean);
            if (!records.length) return;
            const decision = await confirmManagedCharacterDeletion(records.length);
            if (!decision.confirmed) return;
            state.deleting = true;
            try {
                if (decision.deleteImages) await deleteManagedCharacterImages(records);
                const ids = new Set(records.map((record) => String(record.id || "")));
                const deleted = await app.work.enqueueOrdered(
                    `library:${libraryRecordStorageType(CHARACTER_LIBRARY_KEY)}`,
                    `delete ${records.length} selected characters`,
                    () => deletePerRecordLibraryRecords(
                        CHARACTER_LIBRARY_KEY,
                        records.map((record) => ({ id: record.id })),
                    ),
                );
                if (deleted === false) return;
                app.characterDefinitions = (app.characterDefinitions || []).filter(
                    (record) => !ids.has(String(record.id || "")),
                );
                app.characterLibraryRecordsCache = null;
                state.selectedIds.clear();
                closeCharacterLibraryDefinitionLayers();
                renderManageCharactersModal();
            } catch (error) {
                showNotice("Delete Characters Failed", error?.message || String(error));
            } finally {
                state.deleting = false;
            }
        }

        function refreshOpenCharacterLibraryAfterDefinitionDelete(recordId = "") {
            const box = $("modalBox");
            if (!box?.matches?.("[data-character-library-modal='1']")) return;
            refreshCharacterLibraryActiveTabCards({ immediateSmall: true });
        }

        function nextVisualWorkFrame(callback) {
            if (typeof requestAnimationFrame === "function") {
                let settled = false;
                const channel = new MessageChannel();
                const finish = (timestamp) => {
                    if (settled) return;
                    settled = true;
                    channel.port1.close();
                    channel.port2.close();
                    callback(timestamp);
                };
                channel.port1.onmessage = () => finish(perfNow());
                channel.port2.postMessage(null);
                return requestAnimationFrame((timestamp) => finish(timestamp));
            }
            const channel = new MessageChannel();
            channel.port1.onmessage = () => {
                channel.port1.close();
                channel.port2.close();
                callback(perfNow());
            };
            channel.port2.postMessage(null);
            return channel;
        }

        function frameBudgetedFilterAndSort({ key, records, predicate, compare, onComplete }) {
            app.libraryWorkGenerations ||= {};
            const generation = (app.libraryWorkGenerations[key] || 0) + 1;
            app.libraryWorkGenerations[key] = generation;
            const source = Array.isArray(records) ? records : [];
            const filtered = [];
            let index = 0;
            const valid = () => app.libraryWorkGenerations[key] === generation;
            const filterFrame = () => {
                if (!valid()) return;
                const deadline = perfNow() + 4;
                while (index < source.length && perfNow() < deadline) {
                    const record = source[index++];
                    if (!predicate || predicate(record)) filtered.push(record);
                }
                if (index < source.length) return nextVisualWorkFrame(filterFrame);
                if (filtered.length < 2 || typeof compare !== "function") {
                    onComplete?.(filtered, generation);
                    return;
                }
                let input = filtered;
                let output = new Array(filtered.length);
                let width = 1;
                let left = 0;
                let merge = null;
                const sortFrame = () => {
                    if (!valid()) return;
                    const deadline = perfNow() + 4;
                    while (perfNow() < deadline) {
                        if (width >= input.length) {
                            onComplete?.(input, generation);
                            return;
                        }
                        if (!merge) {
                            if (left >= input.length) {
                                [input, output] = [output, input];
                                width *= 2;
                                left = 0;
                                continue;
                            }
                            merge = {
                                start: left,
                                middle: Math.min(left + width, input.length),
                                end: Math.min(left + width * 2, input.length),
                            };
                            merge.i = merge.start;
                            merge.j = merge.middle;
                            merge.k = merge.start;
                        }
                        while (merge.k < merge.end && perfNow() < deadline) {
                            const takeLeft =
                                merge.i < merge.middle &&
                                (merge.j >= merge.end || compare(input[merge.i], input[merge.j]) <= 0);
                            output[merge.k++] = takeLeft ? input[merge.i++] : input[merge.j++];
                        }
                        if (merge.k >= merge.end) {
                            left = merge.end;
                            merge = null;
                        }
                    }
                    nextVisualWorkFrame(sortFrame);
                };
                nextVisualWorkFrame(sortFrame);
            };
            nextVisualWorkFrame(filterFrame);
            return generation;
        }

        function virtualLibraryState(key = "") {
            app.virtualLibraryStates ||= new Map();
            if (!app.virtualLibraryStates.has(key))
                app.virtualLibraryStates.set(key, {
                    records: [],
                    rendered: 0,
                    batch: 120,
                    boundHosts: new WeakSet(),
                });
            return app.virtualLibraryStates.get(key);
        }

        function resetVirtualLibraryGestureState(key = "") {
            const state = app.virtualLibraryStates?.get(key);
            if (!state) return;
            state.bottomReached = false;
        }

        function renderVirtualLibraryRecords({ key, results, records, htmlForRecord, emptyHtml, bind, afterRender, immediate = false, renderAll = false }) {
            if (!results) return;
            const state = virtualLibraryState(key);
            state.generation = Number(state.generation || 0) + 1;
            const generation = state.generation;
            state.records = records;
            state.batch = Math.max(24, Math.min(48, Number(state.batch) || 48));
            state.loading = false;
            state.loadingPromise = null;
            state.bottomReached = false;
            state.rendered = renderAll
                ? records.length
                : Math.min(
                      records.length,
                      Math.max(state.batch, Number(state.requested || state.batch)),
                  );
            state.results = results;
            state.htmlForRecord = htmlForRecord;
            state.bind = bind;
            state.emptyHtml = emptyHtml;

            const updateMoreButton = () => {
                const button = state.moreButton;
                if (!button || !button.isConnected) return;
                const loading = state.loading === true;
                button.disabled = loading;
                button.setAttribute("aria-busy", loading ? "true" : "false");
                button.replaceChildren();
                if (loading) {
                    const spinner = document.createElement("span");
                    spinner.className = "loading-spinner";
                    spinner.setAttribute("aria-hidden", "true");
                    const label = document.createElement("span");
                    label.textContent = "Loading...";
                    button.append(spinner, label);
                    return;
                }
                button.textContent = `Load more (${records.length - state.rendered})`;
            };

            const finish = () => {
                if (state.generation !== generation || !results.isConnected) return;
                if (!records.length) {
                    state.moreButton?.remove();
                    state.moreButton = null;
                    results.innerHTML = emptyHtml;
                    afterRender?.({ key, results, records, rendered: 0, complete: true });
                    return;
                }
                if (state.rendered < records.length) {
                    if (!state.moreButton || !state.moreButton.isConnected) {
                        const button = document.createElement("button");
                        button.type = "button";
                        button.dataset.virtualLibraryMore = "1";
                        button.style.gridColumn = "1 / -1";
                        button.onclick = () => state.appendMore?.();
                        state.moreButton = button;
                        results.append(button);
                    }
                    updateMoreButton();
                }
                else {
                    state.moreButton?.remove();
                    state.moreButton = null;
                }
                afterRender?.({
                    key,
                    results,
                    records,
                    rendered: state.rendered,
                    complete: state.rendered >= records.length,
                });
            };

            if (immediate && records.length <= 12) {
                results.innerHTML = records.length
                    ? records.map((record) => String(htmlForRecord(record) || "")).join("")
                    : emptyHtml;
                for (const node of results.children) {
                    bind?.(node);
                    activatePluginIframes(node);
                    scheduleAutosizeLibraryCardText(node);
                }
                finish();
                return state;
            }

            const appendRange = (start, end, reset) =>
                new Promise((resolve, reject) => {
                    if (reset) results.replaceChildren();
                    let index = start;
                    const appendFrame = () => {
                        if (state.generation !== generation || !results.isConnected) {
                            resolve();
                            return;
                        }
                        try {
                            const deadline = perfNow() + 2;
                            const html = [];
                            while (
                                index < end &&
                                (!html.length || (html.length < 4 && perfNow() < deadline))
                            )
                                html.push(String(htmlForRecord(records[index++]) || "").trim());
                            const template = document.createElement("template");
                            template.innerHTML = html.join("");
                            const added = Array.from(template.content.children);
                            results.append(template.content);
                            for (const node of added) {
                                bind?.(node);
                                activatePluginIframes(node);
                                scheduleAutosizeLibraryCardText(node);
                            }
                            if (index < end) nextVisualWorkFrame(appendFrame);
                            else {
                                finish();
                                resolve();
                            }
                        } catch (error) {
                            reject(error);
                        }
                    };
                    nextVisualWorkFrame(appendFrame);
                });

            state.appendMore = () => {
                if (
                    state.generation !== generation ||
                    !results.isConnected ||
                    state.rendered >= state.records.length
                )
                    return Promise.resolve(null);
                if (state.loading) return state.loadingPromise || Promise.resolve(null);
                const start = state.rendered;
                state.rendered = Math.min(
                    state.records.length,
                    state.rendered + state.batch,
                );
                state.loading = true;
                state.bottomReached = false;
                updateMoreButton();
                const loadingPromise = appendRange(start, state.rendered, false);
                state.loadingPromise = loadingPromise.finally(() => {
                    if (state.generation !== generation) return;
                    state.loading = false;
                    state.loadingPromise = null;
                    updateMoreButton();
                });
                state.loadingPromise.catch(() => {});
                return state.loadingPromise;
            };

            appendRange(0, state.rendered, true);
            const scrollHost = $("modalBox") || results.closest(".library-results") || results.parentElement;
            bindVirtualLibraryScrollPagination(scrollHost, key);
            return state;
        }

        function refreshCharacterLibraryActiveTabCards(options = {}) {
            const tab = options.tab || characterLibraryActiveTab();
            if (tab === "public") return;
            const panel = document.querySelector(
                `[data-character-library-tab-panel="${cssEscape(tab)}"]`,
            );
            const results = panel?.querySelector?.(
                `[data-character-library-results="${cssEscape(tab)}"]`,
            );
            if (!panel || !results) return;
            if (tab === "mine") renderCharacterLibraryOwnedPublicCharacters();
            const query = panel.querySelector?.("[data-character-library-name-search]")?.value || "";
            const allRecords = characterLibraryTabRecords(tab);
            const criteria = characterLibraryFilterCriteria(panel, query);
            const count = $(`characterLibrarySearchCount-${tab}`);
            results.setAttribute("aria-busy", "true");
            if (count) count.textContent = `Filtering ${allRecords.length} character(s)...`;
            const complete = (records, immediate = false) => {
                if (
                    !results.isConnected ||
                    (options.allowHidden !== true && characterLibraryActiveTab() !== tab)
                )
                    return;
                results.removeAttribute("aria-busy");
                renderVirtualLibraryRecords({
                    key: `character:${tab}`,
                    results,
                    records,
                    htmlForRecord: characterLibraryRecordHtml,
                    emptyHtml: `<p class="hint">${tab === "mine" ? "No characters belong to the selected creator yet." : "No matching characters available yet."}</p>`,
                    bind: bindCharacterLibraryCardActions,
                    afterRender: () => queueFirstVisibleCharacterLibraryMissingProfile(),
                    immediate,
                });
                if (count) count.textContent = libraryResultCountText(records.length, allRecords.length, "character");
                "";
            };
            if (options.immediateSmall === true && allRecords.length <= 12) {
                const records = allRecords
                    .filter((record) => characterLibraryRecordMatchesCriteria(record, criteria))
                    .sort(characterLibraryRecordComparator(tab));
                complete(records, true);
                return;
            }
            frameBudgetedFilterAndSort({
                key: `character-filter:${tab}`,
                records: allRecords,
                predicate: (record) => characterLibraryRecordMatchesCriteria(record, criteria),
                compare: characterLibraryRecordComparator(tab),
                onComplete: (records) => complete(records, false),
            });
        }

        function renderCharacterLibraryOwnedPublicCharacters() {
            const results = document.querySelector(
                `[data-character-library-published-results="mine"]`,
            );
            if (!results) return false;
            const panel = results.closest("[data-character-library-tab-panel]");
            const criteria = characterLibraryFilterCriteria(panel);
            const creatorId = mineCreatorIdentityId();
            const allEntries = app.characterLibraryOwnedCharacterEntries || [];
            const entries = characterLibrarySortPublicEntries(
                allEntries.filter((entry) =>
                    (!creatorId || entry.creator_id === creatorId) &&
                    characterLibraryRecordMatchesCriteria({ ...entry, character: entry }, criteria),
                ),
                "mine",
            );
            results.innerHTML = entries.length
                ? entries
                      .map((entry) => publicCharacterLibraryCardHtml(entry, { owned: true }))
                      .join("")
                : `<p class="hint">No published characters found for this account.</p>`;
            let count = results.parentElement.querySelector("[data-published-character-count]");
            if (!count) {
                count = document.createElement("p");
                count.dataset.publishedCharacterCount = "1";
                results.before(count);
            }
            count.textContent = `${entries.length}/${allEntries.length} shown`;
            bindCharacterLibraryCardActions(results);
            scheduleAutosizeLibraryCardText(results);
            return true;
        }

        function closeCharacterLibraryDefinitionLayers(recordId = "") {
            const wanted = String(recordId || "");
            document.querySelectorAll("[data-character-library-layer='1']").forEach((box) => {
                const layerRecordId =
                    box.querySelector?.("[data-character-library-detail]")?.dataset.characterLibraryDetail ||
                    box.querySelector?.("[data-character-library-edit-id]")?.dataset.characterLibraryEditId ||
                    box.querySelector?.("[data-character-library-settings-id]")?.dataset.characterLibrarySettingsId ||
                    "";
                if (!wanted || layerRecordId === wanted) closeContainingPopup(box);
            });
        }

        function searchTokens(value = "") {
            return String(value || "")
                .toLowerCase()
                .split(/\s+/)
                .map((token) => token.trim())
                .filter(Boolean);
        }

        function matchesSearchTokens(text = "", tokens = []) {
            const haystack = String(text || "").toLowerCase();
            return tokens.every((token) => haystack.includes(token));
        }

        function characterLibraryActiveTab() {
            return (
                $("modalBox")?.querySelector?.("[data-library-home][data-library-type=\"character\"] [data-library-source].active")
                    ?.dataset.librarySource ||
                $("modalBox")?.querySelector?.("[data-character-library-tab].active")
                    ?.dataset.characterLibraryTab || "local"
            );
        }

        function rememberedCharacterLibraryTab(fallback = "public") {
            const active = characterLibraryActiveTab();
            return ["public", "local", "mine"].includes(active)
                ? active
                : ["public", "local", "mine"].includes(fallback)
                  ? fallback
                  : "public";
        }

        function scheduleCharacterLibraryTabWork(tab = characterLibraryActiveTab()) {
            clearTimeout(app.characterLibraryTabWorkTimer);
            const scheduledAt = perfNow();
            perfConsole("character library tab work scheduled", { tab });
            app.characterLibraryTabWorkTimer = setTimeout(() => {
                const start = perfNow();
                app.characterLibraryTabWorkTimer = null;
                if (characterLibraryActiveTab() !== tab) {
                    perfConsole("character library tab work skipped", {
                        tab,
                        activeTab: characterLibraryActiveTab(),
                        delayMs: Math.round(perfNow() - scheduledAt),
                    });
                    return;
                }
                const filterStart = perfNow();
                filterCharacterLibraryModal("", { queueMissing: false });
                const filterMs = perfNow() - filterStart;
                const queueStart = perfNow();
                queueFirstVisibleCharacterLibraryMissingProfile();
                const queueMs = perfNow() - queueStart;
                perfConsole(
                    "character library tab work finished",
                    {
                        ms: Math.round(perfNow() - start),
                        tab,
                        delayMs: Math.round(start - scheduledAt),
                        filterMs: Math.round(filterMs),
                        queueMs: Math.round(queueMs),
                    },
                    filterMs >= 75 || queueMs >= 75 ? "warn" : "log",
                );
            }, 0);
        }

        function switchCharacterLibraryTab(tab = "local") {
            const start = perfNow();
            const box = $("modalBox");
            if (!box) return;
            resetVirtualLibraryGestureState("character:local");
            resetVirtualLibraryGestureState("character:mine");
            app.characterLibraryLastTab = ["public", "local", "mine"].includes(tab)
                ? tab
                : "local";
            box.querySelectorAll("[data-character-library-tab]").forEach((button) => {
                button.classList.toggle("active", button.dataset.characterLibraryTab === tab);
            });
            box.querySelectorAll("[data-character-library-tab-panel]").forEach((panel) => {
                panel.hidden = panel.dataset.characterLibraryTabPanel !== tab;
            });
            const deferredPanel = box.querySelector(`[data-character-library-tab-panel="${cssEscape(tab)}"][data-character-library-deferred="1"]`);
            if (deferredPanel) {
                const template = document.createElement("template");
                template.innerHTML = characterLibraryTabHtml(tab);
                const readyPanel = template.content.firstElementChild;
                readyPanel.hidden = false;
                deferredPanel.replaceWith(readyPanel);
                bindCharacterLibraryCardActions(readyPanel);
            }

            updateCharacterLibraryFilterToggle(tab);
            scheduleCharacterLibraryTabWork(tab);
            scheduleAutosizeLibraryCardText(box);
            const panel = box.querySelector(
                `[data-character-library-tab-panel="${cssEscape(tab)}"]`,
            );
            perfConsole("character library switch tab", {
                ms: Math.round(perfNow() - start),
                tab,
                cards: panel?.querySelectorAll?.("[data-character-library-card]")?.length || 0,
            });
        }

        async function refreshCharacterLibraryOwnedPublicCharacters(options = {}) {
            const panel = document.querySelector(`[data-character-library-tab-panel="mine"]`);
            if (!panel || panel.hidden) return;
            const results = panel.querySelector(`[data-character-library-published-results="mine"]`);
            const count = $("characterLibrarySearchCount-mine");
            if (!supabaseSessionAccessToken()) {
                app.characterLibraryOwnedCharacterEntries = [];
                refreshCharacterLibraryActiveTabCards();
                return;
            }
            if (app.characterLibraryOwnedCharactersLoading) return;
            app.characterLibraryOwnedCharactersLoading = true;
            if (results && !results.querySelector("[data-character-library-card]")) {
                results.innerHTML = `<div class="character-library-empty-state">Loading your published characters...</div>`;
            }
            try {
                const ownedItems = [];
                const pageSize = 50;
                for (let page = 0; ; page += 1) {
                    const index = await fetchOwnedPublicLibraryIndex({
                        mode: "characters",
                        pageSize,
                        page,
                    });
                    ownedItems.push(
                        ...(index.items || []).filter(
                            (entry) =>
                                entry.type === "character" &&
                                publicLibraryRequiredText(entry.image_url),
                        ),
                    );
                    if ((index.items || []).length < pageSize) break;
                }
                app.characterLibraryOwnedCharacterEntries = ownedItems;
                app.publicLibraryLastIndex = mergePublicLibraryIndexItems(
                    app.publicLibraryLastIndex || publicLibraryEmptyIndex(),
                    app.characterLibraryOwnedCharacterEntries,
                );
                renderCharacterLibraryOwnedPublicCharacters();
                refreshCharacterLibraryActiveTabCards();
            } catch (err) {
                if (devSmokeSuiteState().running) throw err;
                if (results)
                    results.innerHTML = `<div class="character-library-empty-state">Could not load your published characters: ${escapeHtml(err.message || String(err))}</div>`;
                if (count) count.textContent = libraryResultCountText(0, 0, "character");
                log("My Characters public fetch failed", err.message || String(err), {
                    type: "system",
                    level: "warn",
                });
            } finally {
                app.characterLibraryOwnedCharactersLoading = false;
            }
        }

        function setCharacterLibraryNameSearch(tab = "local", value = "") {
            const input = $(`characterLibrarySearch-${tab}`);
            if (!input) return;
            input.value = value;
            handleCharacterLibraryFilterInput();
        }

        function setCharacterLibraryFilterValue(filter = "", value = "") {
            const tab = characterLibraryActiveTab();
            const panel = document.querySelector(
                `[data-character-library-tab-panel="${cssEscape(tab)}"]`,
            );
            const input = panel?.querySelector?.(`[data-character-library-filter="${cssEscape(filter)}"]`);
            if (!input) return;
            input.value = value;
            updateCharacterLibraryFilterSummary(panel, filter);
            handleCharacterLibraryFilterInput();
        }

        function setCharacterLibrarySort(tab = characterLibraryActiveTab(), value = "name-az") {
            const cleanTab = ["public", "local", "mine"].includes(tab) ? tab : characterLibraryActiveTab();
            const cleanValue = ["highest-rated", "newest", "oldest", "updated", "name-az", "name-za", "gender-az", "source-az"].includes(value)
                ? value
                : cleanTab === "public" ? "highest-rated" : "name-az";
            app.characterLibrarySorts ||= {};
            app.characterLibrarySorts[cleanTab] = cleanValue;
            if (cleanTab === "public") {
                runPublicCharacterSearch();
                return;
            }
            refreshCharacterLibraryActiveTabCards();
            queueFirstVisibleCharacterLibraryMissingProfile();
            saveSettingsNow("character library sort changed");
        }

        function setCharacterLibraryCardSize(value = "large") {
            const cleanValue = ["tiny", "small", "medium", "large", "huge"].includes(value)
                ? value
                : "large";
            app.settings ||= {};
            app.settings.characterLibraryCardSize = cleanValue;
            document.querySelectorAll(".character-library-shell, .library-home[data-library-type=\"character\"]").forEach((shell) => {
                shell.classList.remove(
                    "card-size-small",
                    "card-size-tiny",
                    "card-size-medium",
                    "card-size-large",
                    "card-size-huge",
                );
                shell.classList.add(`card-size-${cleanValue}`);
            });
            document.querySelectorAll("[data-character-library-card-size-select]").forEach((select) => {
                select.value = cleanValue;
            });
            updateUnifiedLibraryResponsiveSizing();
            scheduleAutosizeLibraryCardText($("modalBox"));
            saveSettingsNow("character library card size changed");
        }

        function updateCharacterLibraryFilterToggle(tab = characterLibraryActiveTab()) {
            const panel = document.querySelector(
                `[data-character-library-tab-panel="${cssEscape(tab)}"]`,
            );
            const details = panel?.querySelector?.("[data-character-library-filters]");
            const button = panel?.querySelector?.(".character-library-filters-toggle");
            if (!button) return;
            button.innerHTML = `${details?.open ? "&#9662;" : "&#9656;"} Filters`;
        }

        function toggleCharacterLibraryFilters(tab = characterLibraryActiveTab()) {
            const panel = document.querySelector(
                `[data-character-library-tab-panel="${cssEscape(tab)}"]`,
            );
            const details = panel?.querySelector?.("[data-character-library-filters]");
            if (!details) return;
            details.open = !details.open;
            updateCharacterLibraryFilterToggle(tab);
        }



        function characterLibraryFilterListValue(filter = "", tab = characterLibraryActiveTab()) {
            const panel = document.querySelector(
                `[data-character-library-tab-panel="${cssEscape(tab)}"]`,
            );
            const input = panel?.querySelector?.(`[data-character-library-filter="${cssEscape(filter)}"]`);
            return publicTagListSlot(input?.value || "");
        }

        function characterLibraryCombinedFilterValue(panel, filter = "") {
            const input = panel?.querySelector?.(`[data-character-library-filter="${cssEscape(filter)}"]`);
            const extra = panel?.querySelector?.(`[data-character-library-filter-extra="${cssEscape(filter)}"]`);
            const values = publicTagListSlot(input?.value || "", extra?.value || "");
            return values.join(", ");
        }

        function updateCharacterLibraryFilterSummary(panel, filter = "") {
            const summary = panel?.querySelector?.(
                `[data-character-library-filter-summary="${cssEscape(filter)}"]`,
            );
            if (!summary) return;
            const input = panel.querySelector?.(`[data-character-library-filter="${cssEscape(filter)}"]`);
            summary.textContent = characterLibraryReadonlyFilterSummary(input?.value || "");
        }

        function characterLibraryFilterPickerOptions() {
            return entertainmentPreferenceOptions();
        }

        function openLibraryGenrePicker(type = "story", editorOptions = null) {
            const character = type === "character";
            const tab = character ? characterLibraryActiveTab() : storyLibraryActiveTab();
            const selected = new Set(editorOptions?.selected || (character ? characterLibraryFilterListValue("genres", tab) : storyLibraryFilterListValue("genres", tab)));
            const popup = openPopupModal("");
            popup.box.setAttribute("data-character-library-picker-modal", "1");
            const choices = document.createElement("fieldset");
            choices.setAttribute("data-" + type + "-library-picker", "genres");
            choices.setAttribute("data-" + type + "-library-picker-tab", tab);
            if (editorOptions?.onApply) choices.onEditorApply = editorOptions.onApply;

            const legend = document.createElement("legend");
            legend.textContent = "Choose Genres";
            choices.append(legend);
            for (const genre of entertainmentPreferenceOptions()) {
                const button = document.createElement("button");
                button.type = "button";
                button.textContent = genre;
                button.setAttribute("data-" + type + "-library-picker-option", genre);
                button.classList.toggle("active", selected.has(genre));
                button.setAttribute("aria-pressed", String(selected.has(genre)));
                button.onclick = () => {
                    const active = button.classList.toggle("active");
                    button.setAttribute("aria-pressed", String(active));
                };
                choices.append(button);
            }

            const apply = document.createElement("button");
            apply.type = "button";
            apply.textContent = "Apply";
            apply.onclick = () => character ? saveCharacterLibraryFilterPicker("genres") : saveStoryLibraryFilterPicker("genres");
            const cancel = document.createElement("button");
            cancel.type = "button";
            cancel.textContent = "Cancel";
            cancel.onclick = () => popup.close();
            popup.box.append(choices, apply, cancel);
            return popup;
        }

        function openCharacterLibraryFilterPicker(kind = "genres", editorOptions = null) {
            return openLibraryGenrePicker("character", editorOptions);
        }

        function toggleCharacterLibraryFilterPickerOption(button) {
            button?.classList?.toggle("active");
        }

        function filterCharacterLibraryFilterPicker(query = "") {
            const tokens = searchTokens(query);
            document.querySelectorAll("[data-character-library-picker-option]").forEach((button) => {
                const show = matchesSearchTokens(button.textContent || "", tokens);
                button.hidden = !show;
            });
        }

        function saveCharacterLibraryFilterPicker(filter = "genres") {
            const picker = document.querySelector(`[data-character-library-picker="${cssEscape(filter)}"]`);
            const tab = picker?.dataset.characterLibraryPickerTab || characterLibraryActiveTab();
            const panel = document.querySelector(
                `[data-character-library-tab-panel="${cssEscape(tab)}"]`,
            );
            const input = panel?.querySelector?.(`[data-character-library-filter="${cssEscape(filter)}"]`);
            if (!input && !picker?.onEditorApply) return;
            const picked = [...(picker?.querySelectorAll?.("[data-character-library-picker-option].active") || [])]
                .map((button) => button.dataset.characterLibraryPickerOption)
                .filter(Boolean);
            const next =
                approvedGenreList(picked);
            if (picker.onEditorApply) {
                picker.onEditorApply(next);
                closeContainingPopup(picker);
                return;
            }
            input.value = next.join(", ");
            updateCharacterLibraryFilterSummary(panel, filter);
            closeContainingPopup(picker);
            handleCharacterLibraryFilterInput();
        }





        function characterLibraryFilterValues(tab = characterLibraryActiveTab()) {
            const panel = document.querySelector(
                `[data-character-library-tab-panel="${cssEscape(tab)}"]`,
            );
            const filters = {};
            if (!panel) return filters;
            const nameInput = panel.querySelector("[data-character-library-name-search]");
            filters.search = String(nameInput?.value || "").trim();
            const visibleFilterPanel = $("modalBox")?.querySelector?.(".library-filter-panel");
            const filterInputs = [
                ...panel.querySelectorAll("[data-character-library-filter]"),
                ...(visibleFilterPanel?.querySelectorAll?.("[data-public-library-filter]") || []),
            ];
            for (const input of filterInputs) {
                const key = input.dataset.characterLibraryFilter || input.dataset.publicLibraryFilter;
                if (!key) continue;
                if (input.type === "checkbox") {
                    if (input.checked) filters[key] = "true";
                    continue;
                }
                const value = String(input.value || "").trim();
                if (value) filters[key] = value;
            }
            for (const input of panel.querySelectorAll("[data-character-library-filter-extra]")) {
                const key = input.dataset.characterLibraryFilterExtra;
                const value = String(input.value || "").trim();
                if (!key || !value) continue;
                filters[key] = publicTagListSlot(filters[key] || "", value).join(", ");
            }
            return filters;
        }

        function characterLibraryFilterCriteria(panel, query = "") {
            const filters = characterLibraryFilterValues(
                panel?.dataset.characterLibraryTabPanel || characterLibraryActiveTab(),
            );
            filters.search = String(query || filters.search || "").trim();
            return {
                filters,
                searchTokens: searchTokens(filters.search),
            };
        }

        function libraryFilterFields(record = {}, entity = record) {
            return {
                creator: record.creator || entity.creator || "",
                source: record.source || entity.source || "",
                creation_tool: record.creation_tool || entity.creation_tool || "",
                species: entity.species || entity.appearance?.species || "",
                role: record.role || entity.role || "",
                gender: entity.gender || entity.appearance?.gender || "",
                genres: genreDisplayList([...(record.genres || []), ...(entity.genres || []), ...(entity.state?.meta?.genres || [])]),
            };
        }

        function libraryFieldMatchesFilter(fields, key, value) {
            if (key === "gender") return characterLibraryGenderMatches(fields.gender, value);
            if (key === "genres") {
                const tags = new Set(publicTagListSlot(fields.genres).map(tag => tag.toLowerCase()));
                return publicTagListSlot(value).every(tag => tags.has(tag.toLowerCase()));
            }

            return Object.hasOwn(fields, key) && matchesSearchTokens(fields[key], searchTokens(value));
        }

        function characterLibraryRecordMatchesCriteria(record = {}, criteria = {}) {
            const entity = characterLibraryRecordEntity(record) || {};
            const search = [record.name, entity.name, entity.fallback_name].filter(Boolean).join(" ");
            if (!matchesSearchTokens(search, criteria.searchTokens || [])) return false;

            const fields = libraryFilterFields(record, entity);
            for (const [key, value] of Object.entries(criteria.filters || {})) {
                if (!value || key === "search") continue;
                if (!libraryFieldMatchesFilter(fields, key, value)) return false;
            }

            return true;
        }

        function characterLibraryRecordComparator(tab = characterLibraryActiveTab()) {
            const sort = characterLibrarySortValue(tab);
            const text = (value) => String(value || "").toLowerCase();
            const entityFor = (record) => characterLibraryRecordEntity(record) || {};
            return (a, b) => {
                if (sort === "name-za") return text(b.name).localeCompare(text(a.name));
                if (sort === "gender-az") {
                    const value = text(entityFor(a).gender).localeCompare(text(entityFor(b).gender));
                    if (value) return value;
                } else if (sort === "source-az") {
                    const value = text(a.source || entityFor(a).source).localeCompare(text(b.source || entityFor(b).source));
                    if (value) return value;
                }
                return text(a.name).localeCompare(text(b.name));
            };
        }

        function characterLibraryPublicFiltersForSupabase(filters = {}) {
            return {genre:filters.genres || "", source:filters.source || "", creator:filters.creator || ""};
        }

        function handleCharacterLibraryFilterInput() {
            const tab = characterLibraryActiveTab();
            const panel = document.querySelector(
                `[data-character-library-tab-panel="${cssEscape(tab)}"]`,
            );
            if (tab === "public") {
                app.characterLibraryPublicCriteriaRevision =
                    (app.characterLibraryPublicCriteriaRevision || 0) + 1;
                app.characterLibraryPublicFiltersDirty = true;
                const button = $("characterLibraryPublicSearchBtn");
                const unifiedButton = $("modalBox")?.querySelector?.("[data-unified-library-public-search]");
                const hint = $("characterLibraryPublicSearchHint");
                if (button) button.disabled = false;
                if (unifiedButton) unifiedButton.disabled = false;
                if (hint) hint.textContent = "Filters changed. Press Search to query public characters.";
                const results = panel?.querySelector?.(
                    '[data-character-library-results="public"]',
                );
                const loaded = app.characterLibraryPublicSearch?.items || [];
                if (results && loaded.length) {
                    results.innerHTML = loaded.map(publicCharacterLibraryCardHtml).join("");
                    bindCharacterLibraryCardActions(results);
                    scheduleAutosizeLibraryCardText(results);
                }
                "";
                return;
            }
            if (tab === "mine") renderCharacterLibraryOwnedPublicCharacters();
            refreshCharacterLibraryActiveTabCards();
            filterCharacterLibraryModal();
        }

        function characterLibraryCardMatchesFilters(card, panel, nameQuery = "") {
            const fields = JSON.parse(card.dataset.libraryFilterFields);
            if (!matchesSearchTokens(card.querySelector?.(".character-name")?.textContent || "", searchTokens(nameQuery))) return false;

            for (const input of panel?.querySelectorAll?.("[data-character-library-filter], [data-character-library-filter-extra]") || []) {
                const key = input.dataset.characterLibraryFilter || input.dataset.characterLibraryFilterExtra;
                const value = String(input.value || "").trim();
                if (value && !libraryFieldMatchesFilter(fields, key, value)) return false;
            }

            return true;
        }

        function characterLibraryGenderMatches(text = "", query = "") {
            const wanted = String(query || "").trim().toLowerCase();
            if (!wanted) return true;
            const haystack = String(text || "").toLowerCase();
            const normalized = (value) => value.replace(/[^a-z0-9]+/g, " ").trim();
            const exactWanted = normalized(wanted);
            if (!exactWanted) return true;
            const parts = haystack
                .split(/[,;/|]+/)
                .map(normalized)
                .filter(Boolean);
            if (parts.includes(exactWanted)) return true;
            if (exactWanted === "male")
                return /\bmale\b/.test(haystack) && !/\bfemale\b/.test(haystack);
            if (exactWanted === "men")
                return /\bmen\b/.test(haystack) && !/\bwomen\b/.test(haystack);
            if (exactWanted === "man")
                return /\bman\b/.test(haystack) && !/\bwoman\b/.test(haystack);
            return haystack.includes(exactWanted);
        }

        function runPublicCharacterSearch() {
            app.characterLibraryPublicSearch ||= {};
            app.characterLibraryPublicSearch.skipCacheOnce = true;
            return runPublicCharacterSearchPage({ reset: true });
        }

        async function runPublicCharacterSearchPage({ reset = false } = {}) {
            const button = $("characterLibraryPublicSearchBtn");
            const hint = $("characterLibraryPublicSearchHint");
            const results = document.querySelector(`[data-character-library-results="public"]`);
            if (reset) app.characterLibraryPublicFiltersDirty = false;
            if (button) button.disabled = true;
            app.characterLibraryPublicSearch ||= {};
            const searchState = app.characterLibraryPublicSearch;
            if (reset)
                searchState.generation =
                    (searchState.generation || 0) + 1;
            const searchGeneration = searchState.generation || 0;
            const criteriaRevision = app.characterLibraryPublicCriteriaRevision || 0;
            if (reset) {
                app.characterLibraryPublicSearch.items = [];
                app.characterLibraryPublicSearch.hasNext = false;
                app.characterLibraryPublicSearch.paginationError = false;
                app.characterLibraryPublicSearch.filters = characterLibraryFilterValues("public");
                app.characterLibraryPublicSearch.total = Number.isSafeInteger(app.publicLibraryTotalItemCounts?.character)
                    ? app.publicLibraryTotalItemCounts.character
                    : Number.isSafeInteger(app.characterLibraryPublicSearch.total)
                      ? app.characterLibraryPublicSearch.total
                      : null;
                app.characterLibraryPublicSearch.cursor = null;
                if (results) results.innerHTML = `<div class="character-library-empty-state">Searching public characters...</div>`;
            } else if (app.characterLibraryPublicSearch.loading || !app.characterLibraryPublicSearch.hasNext) {
                return;
            }
            app.characterLibraryPublicSearch.paginationError = false;
            app.characterLibraryPublicSearch.loading = true;
            updatePublicLibraryLoadMoreButton("character");
            if (hint) hint.textContent = "Fetching public characters...";
            try {
                const totalPromise = reset || !Number.isSafeInteger(searchState.total)
                    ? refreshPublicLibraryTotalItemCount("character", searchState)
                    : Promise.resolve(searchState.total);
                const filters = searchState.filters || characterLibraryFilterValues("public");
                const cacheKey = publicLibrarySearchCacheKey(
                    "character",
                    filters,
                    app.characterLibrarySorts?.public || "highest-rated",
                );
                const body = {
                    item_type: "character",
                    search_text: filters.search || "",
                    creator_text: filters.creator || "",
                    creation_tool_text: filters.creation_tool || "",
                    required_genres: publicTagListSlot(filters.genres || []),
                    ...EmberSharedLibraryFormat.searchScope(),
                    sort_mode: app.characterLibrarySorts?.public || "highest-rated",
                    cursor_value: searchState.cursor?.value || null,
                    cursor_id: searchState.cursor?.id || null,
                    result_limit: publicLibrarySearchBatchSize() + 1,
                };
                const requested = body.result_limit - 1;
                await loadPublicLibrarySearchCache();
                const skipCache = !!searchState.skipCacheOnce;
                delete searchState.skipCacheOnce;
                const cachedEntry = reset && !skipCache ? publicLibrarySearchCache().entries[cacheKey] : null;
                const cached = cachedEntry && Date.now() - new Date(cachedEntry.savedAt || 0).getTime() < 10 * 60 * 1000
                    ? cachedEntry
                    : null;
                const rows = cached
                    ? []
                    : (await publicLibraryFetch("/rest/v1/rpc/search_public_library_items", { method: "POST", body })) || [];
                if (
                    app.characterLibraryPublicSearch !== searchState ||
                    searchGeneration !== searchState.generation ||
                    criteriaRevision !== (app.characterLibraryPublicCriteriaRevision || 0)
                )
                    return;
                const acceptedRows = rows.slice(0, requested);
                const items = cached
                    ? cached.items
                    : acceptedRows.map(publicLibraryRpcEntry).filter(Boolean);
                const byId = new Map((reset ? [] : searchState.items || []).map((item) => [item.id, item]));
                for (const item of items) byId.set(item.id, item);
                searchState.items = [...byId.values()];
                searchState.hasNext = cached ? !!cached.hasNext : rows.length > requested;
                const last = acceptedRows.at(-1);
                searchState.cursor = cached?.cursor || (last ? { value: last.ordering_value, id: last.id } : null);
                await totalPromise;
                if (!cached) {
                    publicLibrarySearchCache().entries[cacheKey] = {
                        items: searchState.items,
                        hasNext: searchState.hasNext,
                        cursor: searchState.cursor,
                        savedAt: new Date().toISOString(),
                    };
                    savePublicLibrarySearchCache();
                }
                app.publicLibraryLastIndex = mergePublicLibraryIndexItems(
                    app.publicLibraryLastIndex || publicLibraryEmptyIndex(),
                    searchState.items,
                );
                if (results) {
                    results.innerHTML = searchState.items.length
                        ? searchState.items.map(publicCharacterLibraryCardHtml).join("")
                        : `<div class="character-library-empty-state">No public characters matched that search.</div>`;
                    scheduleAutosizeLibraryCardText(results);
                }
                if (hint)
                    hint.textContent = searchState.hasNext
                        ? "Scroll down or use Load More for more public characters."
                        : `Loaded ${searchState.items.length} public character${searchState.items.length === 1 ? "" : "s"}.`;
                const count = $("characterLibrarySearchCount-public");
                if (count)
                    count.textContent = libraryResultCountText(
                        searchState.items.length,
                        searchState.total ?? searchState.items.length,
                        "character",
                    );
                updateUnifiedLibraryResultLabel();
            } catch (err) {
                if (app.characterLibraryPublicSearch !== searchState) return;
                app.characterLibraryPublicSearch.paginationError = !reset;
                log("Public character search failed", err?.message || String(err), {
                    type: "system",
                    level: "warn",
                    stack: err?.stack || "",
                });
                if (hint)
                    hint.textContent = reset
                        ? "Public character search failed."
                        : "Could not load more public characters.";
                if (reset && results)
                    results.innerHTML = `<div class="character-library-empty-state">${escapeHtml(err.message || String(err))}</div>`;
                if (devSmokeSuiteState()?.running) throw err;
            } finally {
                if (
                    app.characterLibraryPublicSearch === searchState &&
                    searchGeneration === searchState.generation
                )
                    searchState.loading = false;
                const panel = document.querySelector(`[data-character-library-tab-panel="public"]`);
                "";
                updatePublicLibraryLoadMoreButton("character");
            }
        }

        function filterCharacterLibraryModal(query = "", options = {}) {
            const start = perfNow();
            const tab = characterLibraryActiveTab();
            const panel = document.querySelector(
                `[data-character-library-tab-panel="${cssEscape(tab)}"]`,
            );
            if (!panel || tab === "public") return;
            const nameQuery =
                query ||
                panel.querySelector?.("[data-character-library-name-search]")?.value ||
                "";
            if (tab === "mine") renderCharacterLibraryOwnedPublicCharacters();
            let visible = 0;
            const cards = panel.querySelectorAll(`[data-character-library-results="${tab}"] [data-character-library-card]`);
            cards.forEach((card) => {
                const show = characterLibraryCardMatchesFilters(card, panel, nameQuery);
                card.style.display = show ? "" : "none";
                if (show) visible++;
            });
            const count = $(`characterLibrarySearchCount-${tab}`);
            const total = cards.length;
            if (count)
                count.textContent = libraryResultCountText(visible, total, "character");
            "";
            scheduleAutosizeLibraryCardText(panel);
            if (options.queueMissing !== false) queueFirstVisibleCharacterLibraryMissingProfile();
            const ms = perfNow() - start;
            perfConsole(
                "character library filter modal",
                {
                    ms: Math.round(ms),
                    tab,
                    total,
                    visible,
                    hasNameQuery: !!nameQuery,
                },
                ms >= 75 ? "warn" : "log",
            );
        }

        function queueFirstVisibleCharacterLibraryMissingProfile() {
            const start = perfNow();
            const tab = characterLibraryActiveTab();
            if (tab === "public") return false;
            if (
                (app.profileImageQueue?.length || 0) ||
                (app.profileImageQueued?.size || 0) ||
                (app.profileImageGenerating?.size || 0)
            )
                return false;
            const panel = document.querySelector(
                `[data-character-library-tab-panel="${cssEscape(tab)}"]`,
            );
            if (!panel || panel.hidden) return false;
            let scanned = 0;
            for (const card of panel.querySelectorAll("[data-character-library-card]")) {
                if (card.style.display === "none") continue;
                scanned++;
                const recordId = card.dataset.characterLibraryId || "";
                const record = characterLibraryRecordById(recordId);
                const registered = registerCharacterLibraryProfileEntity(record);
                if (!registered?.name || !registered.entity) continue;
                const ownerKey = profileImageOwnerKey(
                    registered.name,
                    registered.entity,
                );
                const repairedStaleRefs = clearMissingLocalProfileImageRefs(registered.entity);
                const active = activeProfileImage(registered.entity);
                const stalePending =
                    active?.pending &&
                    !isActiveProfileImageRecord(active) &&
                    !app.profileImageGenerating.has(ownerKey) &&
                    !app.profileImageQueued.has(ownerKey);
                if (
                    (active && !profileImageNeedsGeneration(active) && !stalePending) ||
                    app.profileImageQueued?.has(ownerKey) ||
                    app.profileImageGenerating?.has(ownerKey)
                )
                    continue;
                if (repairedStaleRefs)
                    saveProfileImagesNow("repaired character library image references");
                queueMissingProfileImageAfterDefaultAttempt(
                    registered.name,
                    "character library visible",
                    {
                        allowImportSkipped: true,
                        force: !!active || stalePending,
                        pendingImageId: stalePending ? active?.id || "" : "",
                    },
                );
                refreshCharacterLibraryProfileSurfaces(registered.name);
                perfConsole("character library queued missing profile", {
                    ms: Math.round(perfNow() - start),
                    tab,
                    scanned,
                    name: registered.name,
                    repairedStaleRefs,
                    stalePending,
                });
                return true;
            }
            const ms = perfNow() - start;
            perfConsole(
                "character library missing profile scan",
                {
                    ms: Math.round(ms),
                    tab,
                    scanned,
                    queued: false,
                },
                ms >= 75 ? "warn" : "log",
            );
            return false;
        }

        function openPopupModal(html) {
            const overlay = document.createElement("div");
            overlay.className = "modal popup-modal open";
            overlay.innerHTML = `<div class="modal-box">${html}</div>`;
            document.body.append(overlay);
            return {
                overlay,
                box: overlay.querySelector(".modal-box"),
                close() {
                    overlay.remove();
                },
            };
        }

        function closeContainingPopup(button) {
            const popup = button?.closest?.(".popup-modal");
            if (confirmManualCharacterDiscard(popup, () => popup.remove())) return;
            popup?.remove();
        }

        function closeStoryLibraryPopups() {
            document
                .querySelectorAll("[data-story-library-layer='1'], [data-story-library-detail-modal='1']")
                .forEach((box) => box.closest?.(".popup-modal")?.remove());
        }

        function openCharacterLibraryLayer(html, options = {}) {
            const title = options.title || "";
            const popup = openPopupModal(`
                <div class="modal-chrome-header">
                    <strong class="modal-chrome-title">${escapeHtml(title)}</strong>
                    <button type="button" class="modal-close" onclick="EmberAdventures.closeContainingPopup(this)">X</button>
                </div>
                ${html}
            `);
            popup.box.setAttribute("data-character-library-layer", "1");
            if (options.attr) popup.box.setAttribute(options.attr, "1");
            return popup;
        }

        function closeSimpleNoticePopupFromKey(event) {
            if (!event || (event.key !== "Escape" && event.key !== "Enter")) return false;
            const popup = [
                ...document.querySelectorAll(
                    ".popup-modal.open[data-simple-notice-popup='1']",
                ),
            ].at(-1);
            if (!popup) return false;
            event.preventDefault?.();
            event.stopPropagation?.();
            event.stopImmediatePropagation?.();
            popup.querySelector("#noticeOkBtn")?.click();
            return true;
        }

        function closeTopmostPopupFromEscape(event) {
            if (!event || event.key !== "Escape") return false;
            const popups = [...document.querySelectorAll(".popup-modal.open")];
            const popup = popups.at(-1);
            if (!popup) return false;
            event.preventDefault();
            event.stopPropagation();
            if (popup.querySelector("[data-ui-blocking-action]")) return true;
            if (popup.matches("[data-image-lab-popup='1']")) {
                closeImageLabSurface();
                return true;
            }
            const dismissButton =
                popup.querySelector("#confirmNoBtn") ||
                popup.querySelector("#promptCancelBtn") ||
                popup.querySelector("#noticeOkBtn") ||
                popup.querySelector(".modal-close");
            if (dismissButton) dismissButton.click();
            else popup.remove();
            return true;
        }

        function showNotice(title, message, buttonText = "OK") {
            return new Promise((resolve) => {
                const smokeSuite = app.devSmokeSuite;
                if (
                    smokeSuite?.running &&
                    smokeSuite?.suppressResultNotices &&
                    /^Live Test /i.test(String(title || ""))
                ) {
                    resolve(true);
                    return;
                }
                const importFailure = /\bimport failed\b/i.test(
                    String(title || ""),
                );
                const heading = importFailure
                    ? `
                        <div class="modal-chrome-header">
                            <strong class="modal-chrome-title">${escapeHtml(title || "Import Failed")}</strong>
                            <button type="button" class="modal-close" id="noticeCloseBtn" title="Close">X</button>
                        </div>
                    `
                    : `<h2>${escapeHtml(title || "Notice")}</h2>`;
                const copyButton = importFailure
                    ? `<button type="button" id="noticeCopyBtn">Copy</button>`
                    : "";
                const popup = openPopupModal(`
                    ${heading}
                    <p class="hint">${escapeHtml(message || "")}</p>
                    <div class="row" style="margin-top:.8rem">
                        ${copyButton}
                        <button class="primary" id="noticeOkBtn">${escapeHtml(buttonText)}</button>
                    </div>
                `);
                popup.overlay.dataset.simpleNoticePopup = "1";
                const closeNotice = () => {
                    popup.close();
                    resolve(true);
                };
                popup.box.querySelector("#noticeOkBtn").onclick = closeNotice;
                const closeButton = popup.box.querySelector("#noticeCloseBtn");
                if (closeButton) closeButton.onclick = closeNotice;
                const copyButtonElement = popup.box.querySelector("#noticeCopyBtn");
                if (copyButtonElement)
                    copyButtonElement.onclick = async () => {
                        const copied = await copyTextToClipboard(
                            `${title || "Import Failed"}\n${message || ""}`,
                        );
                        copyButtonElement.textContent = copied
                            ? "Copied"
                            : "Copy Failed";
                    };
            });
        }

        function showConfirm(title, message, options = {}) {
            const confirmText = options.confirmText || "OK";
            const cancelText = options.cancelText || "Cancel";
            const dangerClass = options.danger ? "danger" : "primary";
            const warningHtml = options.warningText
                ? `<div class="current-adventure-delete-warning">${escapeHtml(options.warningText)}</div>`
                : "";
            return new Promise((resolve) => {
                if (
                    app.devSmokeSuite?.running &&
                    !app.disableSmokeNpcInspectionAutoConfirm &&
                    /^NPC Inspection Takes Time$/i.test(String(title || ""))
                ) {
                    resolve(true);
                    return;
                }
                const popup = openPopupModal(`
                    <h2>${escapeHtml(title || "Confirm")}</h2>
                    <p class="hint">${escapeHtml(message || "")}</p>
                    ${warningHtml}
                    <div class="row" style="margin-top:.8rem">
                        <button class="${dangerClass}" id="confirmYesBtn">${escapeHtml(confirmText)}</button>
                        <button id="confirmNoBtn">${escapeHtml(cancelText)}</button>
                    </div>
                `);
                popup.box.querySelector("#confirmYesBtn").onclick = () => {
                    popup.close();
                    resolve(true);
                };
                popup.box.querySelector("#confirmNoBtn").onclick = () => {
                    popup.close();
                    resolve(false);
                };
            });
        }

        function showChoice(title, message, choices = []) {
            return new Promise((resolve) => {
                const safeChoices = choices.length
                    ? choices
                    : [{ value: "ok", label: "OK", className: "primary" }];
                const popup = openPopupModal(`
                    <h2>${escapeHtml(title || "Choose")}</h2>
                    <p class="hint">${escapeHtml(message || "")}</p>
                    <div class="row" style="margin-top:.8rem">
                        ${safeChoices
                            .map(
                                (choice, index) =>
                                    `<button class="${escapeHtml(choice.className || "")}" id="choiceBtn${index}">${escapeHtml(choice.label || choice.value || "OK")}</button>`,
                            )
                            .join("")}
                    </div>
                `);
                safeChoices.forEach((choice, index) => {
                    const button = popup.box.querySelector(`#choiceBtn${index}`);
                    if (!button) return;
                    button.onclick = () => {
                        popup.close();
                        resolve(choice.value ?? choice.label ?? index);
                    };
                });
            });
        }

        function showPrompt(title, message, defaultValue = "", options = {}) {
            return new Promise((resolve) => {
                const rows = Math.max(1, Number(options.rows || 5) || 5);
                const popup = openPopupModal(`
                    <h2>${escapeHtml(title || "Input")}</h2>
                    ${message ? `<p class="hint">${escapeHtml(message)}</p>` : ""}
                    <textarea id="styledPromptInput" rows="${rows}">${escapeHtml(defaultValue || "")}</textarea>
                    <div class="row" style="margin-top:.8rem">
                        <button class="primary" id="promptSubmitBtn">${escapeHtml(options.submitText || "Submit")}</button>
                        <button id="promptCancelBtn">${escapeHtml(options.cancelText || "Cancel")}</button>
                    </div>
                `);
                const input = popup.box.querySelector("#styledPromptInput");
                input?.focus?.();
                const submit = () => {
                    const value =
                        popup.box.querySelector("#styledPromptInput")?.value ?? "";
                    popup.close();
                    resolve(value);
                };
                const cancel = () => {
                    popup.close();
                    resolve(null);
                };
                popup.box.querySelector("#promptSubmitBtn").onclick = submit;
                popup.box.querySelector("#promptCancelBtn").onclick = cancel;
                input?.addEventListener?.("keydown", (event) => {
                    if (event.key === "Escape") {
                        event.preventDefault();
                        cancel();
                        return;
                    }
                    if (rows <= 1 && event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        submit();
                    }
                });
            });
        }
        async function openWorldModal(options = {}) {

            if (
                !options.skipConfirm &&
                app.state?.meta?.setup_complete &&
                !app.onboardingDraft
            ) {
                cancelAllGameProcesses("starting new game setup");
                saveCurrentGame("saved before new game");
                flushScheduledSaveAll("saved before new game");
                await flushLargeSaves();
                setActiveSaveId("");
                await persistActiveSavePointer();
            }
            beginNewAdventureStorySelection();
        }

        function beginNewAdventureStorySelection() {
            clearSetupModalScrollPositions();
            ensureDefaultUserProfile();
            app.mainMenuOpen = false;
            openUnifiedLibrary({type: "story", tab: "public", returnToMainMenuOnEscape: true});
        }

        function ensureDefaultUserProfile() {
            const active = activeUserProfile();
            if (active) return active;

            const existing = validatedUserProfiles(app.userProfiles)[0];
            if (existing) {
                applyUserProfile(existing);
                return existing;
            }

            return createUserProfileFromForm("Default", app.settings.preferredCharacterGender);
        }

        function createUserProfileFromForm(name, gender) {
            if (typeof name !== "string" || !name.trim())
                throw new Error("profile.name must be non-empty text.");

            const profile = makeUserProfileFromDraft({profile_name: name, character_boldness_offset: app.settings.characterBoldnessOffset});
            profile.settings = profileSettingsFromCurrent();
            profile.settings.preferredCharacterGender = exactPreferredCharacterGender(gender);
            app.userProfiles = validatedUserProfiles([...(app.userProfiles || []), profile]);
            applyUserProfile(profile);
            saveProfilesNow("profile created");
            return profile;
        }

        function openProfileCreationModal(options = {}) {
            clearSetupModalScrollPositions();
            closeLibraryProfileOverlay();
            const form = document.createElement("form");
            const nameLabel = document.createElement("label");
            nameLabel.textContent = "Profile name";
            const name = document.createElement("input");
            name.id = "profileName";
            name.required = true;
            nameLabel.append(name);
            const genderLabel = document.createElement("label");
            genderLabel.textContent = "Character presentation";
            const gender = document.createElement("select");
            gender.id = "profileCharacterPresentation";
            for (const [value, title] of [["", "Use each character's authored presentation"], ["female", "Prefer female characters"], ["male", "Prefer male characters"]]) {
                const option = document.createElement("option");
                option.value = value;
                option.textContent = title;
                gender.append(option);
            }

            gender.value = app.settings.preferredCharacterGender;
            genderLabel.append(gender);
            const explanation = document.createElement("p");
            explanation.textContent = "Your current voice, image, and storytelling settings will be saved with this profile. You can adjust them in Settings.";
            const errorText = document.createElement("p");
            errorText.setAttribute("role", "alert");
            const create = document.createElement("button");
            create.type = "submit";
            create.textContent = "Create Profile";
            form.append(nameLabel, genderLabel, explanation, errorText, create);
            form.onsubmit = event => {
                event.preventDefault();
                try { createUserProfileFromForm(name.value, gender.value); }
                catch (error) {
                    errorText.textContent = error.message;
                    log("Profile creation failed", error.message, {type: "system", level: "error"});
                    return;
                }

                closeModal();
                if (typeof options.onCreated === "function") { options.onCreated(); return; }
                if (options.after === "story_library") {
                    app.mainMenuOpen = false;
                    openUnifiedLibrary({type: "story", tab: "public", returnToMainMenuOnEscape: true});
                }
                else {
                    openMainMenuProfiles();
                }

                refreshMainMenuIfVisible();
            };
            openModal("", {title: "Create Profile"});
            $("modalBox").append(form);
            name.focus();
        }

        function beginOnboardingWorldSetup() {
    ensureDefaultUserProfile();
    clearSetupModalScrollPositions();
    app.onboardingDraft = {
        step:6,story_mode:"original",story_title:"",story_description:"",story_modifications:"",
        story_lookup_title:"",story_lookup_summary:"",story_lookup_modifications:"",story_confirmed:false,
        genres:[],character_boldness_offset:app.settings.characterBoldnessOffset,
        player:{name:"",age:"",gender:app.state.player?.gender === "unspecified" ? "" : app.state.player?.gender || "",role:app.state.player?.role || "commoner"},
        cast_notes:"",starting_cast_policy:"generated",
    };
    renderMainMenu();
    renderOnboardingStep();
}

        function storyLibraryCardSize() {
            const value = String(app.settings?.storyLibraryCardSize || app.settings?.characterLibraryCardSize || "large");
            return ["tiny", "small", "medium", "large", "huge"].includes(value) ? value : "large";
        }



        function storyTemplateImageMode(template = {}) {
            return ("SFW");
        }

        function storyTitleCardGeneratingMap() {
            if (app.storyTitleCardGenerating instanceof Map) return app.storyTitleCardGenerating;
            const previous = app.storyTitleCardGenerating;
            const map = new Map();
            if (previous instanceof Set) {
                previous.forEach((id) => map.set(id, 0));
            } else if (Array.isArray(previous)) {
                previous.forEach((id) => map.set(id, 0));
            }
            app.storyTitleCardGenerating = map;
            return map;
        }

        function storyTitleCardIdentityText(value = "") {
            return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
        }

        function storyTitleCardTitle(template = {}) {
            return String(template?.title || storyTemplateTitle(template?.state || {}) || "").trim();
        }

        function storyTitleCardSource(template = {}) {
            return storySourceDisplayLabel(template?.source || template?.state?.meta?.story_source?.title || "", "");
        }

        function storyTitleCardStableKey(template = {}) {
            const title = storyTitleCardIdentityText(storyTitleCardTitle(template));
            if (!title) return "";
            const source = storyTitleCardIdentityText(storyTitleCardSource(template));
            return source ? `story-title:${source}|${title}` : `story-title:${title}`;
        }

        function storyTitleCardStoreKey(templateOrId = "") {
            if (templateOrId && typeof templateOrId === "object") {
                const stableKey = storyTitleCardStableKey(templateOrId);
                if (stableKey) return stableKey;
                const id = String(templateOrId.id || "").trim();
                return id ? `story:${id}` : "";
            }
            const id = String(templateOrId || "").trim();
            return id ? `story:${id}` : "";
        }

        function storyTitleCardStoreKeys(template = {}) {
            const keys = new Set();
            const stableKey = storyTitleCardStableKey(template);
            if (stableKey) keys.add(stableKey);
            const title = storyTitleCardIdentityText(storyTitleCardTitle(template));
            if (title) keys.add(`story-title:${title}`);
            const source = storyTitleCardIdentityText(storyTitleCardSource(template));
            if (source && title) keys.add(`story-title:${source}|${title}`);
            const id = String(template?.id || "").trim();
            if (id) keys.add(`story:${id}`);
            return [...keys].filter(Boolean);
        }

        const STORY_TITLE_CARD_STORE_FIELDS = Object.freeze([
            "id", "at", "source", "reason", "title", "prompt", "negativePrompt",
            "seed", "model", "html", "url", "hosted_url", "favorite", "pending",
            "error", "smoke_test_artifact", "story_key",
            "story_id", "story_title", "story_source",
            "upload_attestation_classification", "upload_attested_by",
            "upload_attested_at", "upload_attestation_policy_version",
        ]);
        const STORY_TITLE_CARD_STORE_REQUIRED_FIELDS = Object.freeze(
            STORY_TITLE_CARD_STORE_FIELDS.filter(
                (field) =>
                    ![
                        "upload_attestation_classification",
                        "upload_attested_by",
                        "upload_attested_at",
                        "upload_attestation_policy_version",
                    ].includes(field),
            ),
        );

        function validateStoryTitleCardImageStore(images) {
            const errors = [];
            if (!Array.isArray(images)) {
                return {
                    ok: false,
                    errors: [validationError("storyTitleCardImages", "type", "storyTitleCardImages must be an array.")],
                };
            }

            const identities = new Set();
            images.forEach((image, index) => {
                const path = `storyTitleCardImages[${index}]`;
                errors.push(
                    ...exactObjectFieldValidationErrors(image, STORY_TITLE_CARD_STORE_FIELDS, path),
                    ...requiredExactFieldsValidationErrors(image, STORY_TITLE_CARD_STORE_REQUIRED_FIELDS, path),
                );
                if (!isPlainObject(image)) return;

                [
                    "id", "at", "source", "reason", "title", "prompt", "negativePrompt",
                    "model", "html", "url", "hosted_url", "error", "story_key",
                    "story_id", "story_title", "story_source",
                ].forEach((field) => {
                    if (typeof image[field] !== "string") {
                        errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be text.`));
                    }
                });
                for (const field of [
                    "upload_attestation_classification",
                    "upload_attested_by",
                    "upload_attested_at",
                ]) {
                    if (Object.hasOwn(image, field) && typeof image[field] !== "string")
                        errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be text when present.`));
                }
                if (
                    Object.hasOwn(image, "upload_attestation_policy_version") &&
                    (!Number.isSafeInteger(image.upload_attestation_policy_version) ||
                        image.upload_attestation_policy_version < 0)
                )
                    errors.push(validationError(`${path}.upload_attestation_policy_version`, "type", `${path}.upload_attestation_policy_version must be a non-negative safe integer when present.`));
                ["favorite", "pending", "smoke_test_artifact"].forEach((field) => {
                    if (typeof image[field] !== "boolean") {
                        errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be a boolean.`));
                    }
                });
                if (!String(image.id || "").trim())
                    errors.push(validationError(`${path}.id`, "required", `${path}.id is required.`));
                if (!String(image.story_key || "").trim())
                    errors.push(validationError(`${path}.story_key`, "required", `${path}.story_key is required.`));
                if (!String(image.story_id || "").trim())
                    errors.push(validationError(`${path}.story_id`, "required", `${path}.story_id is required.`));

                const identity = `${image.story_key}\u0000${image.id}`;
                if (identities.has(identity)) {
                    errors.push(validationError(path, "duplicate", `${path} duplicates story_key and id ${JSON.stringify(image.story_key)} / ${JSON.stringify(image.id)}.`));
                }
                identities.add(identity);
            });
            return { ok: errors.length === 0, errors };
        }

        function exactStoryTitleCardImageStore(images) {
            const validation = validateStoryTitleCardImageStore(images);
            if (!validation.ok) throw new Error(validationErrorsText(validation));
            return clone(images);
        }

        function storyTitleCardStoreImages(template = {}) {
            const keys = new Set(storyTitleCardStoreKeys(template));
            const wantedTitle = storyTitleCardIdentityText(storyTitleCardTitle(template));
            if (!keys.size && !wantedTitle) return [];
            const store = Array.isArray(app.storyTitleCardImages)
                ? app.storyTitleCardImages
                : [];
            return store.filter(
                (image) =>
                    keys.has(String(image.story_key)) ||
                    (wantedTitle &&
                        storyTitleCardIdentityText(image.story_title) === wantedTitle),
            );
        }

        function storyTitleCardOwnedImageRecord(template = {}, image = {}) {
            const key = storyTitleCardStoreKey(template);
            if (!key) return null;
            const record = createStoryTitleCardHistoryRecord(
                image,
                template.state,
                template,
            );
            if (!record) return null;
            return {
                ...record,
                story_key: key,
                story_id: String(template.id || ""),
                story_title: storyTitleCardTitle(template),
                story_source: storyTitleCardSource(template),
            };
        }

        function replaceStoryTitleCardStoreImages(template = {}, images = []) {
            const key = storyTitleCardStoreKey(template);
            if (!key) throw new Error("Story title-card image owner key is required.");
            if (!Array.isArray(images))
                throw new Error("Story title-card replacement images must be an array.");
            const keys = new Set(storyTitleCardStoreKeys(template));
            const wantedTitle = storyTitleCardIdentityText(storyTitleCardTitle(template));
            const normalized = images.map((image, index) => {
                const record = storyTitleCardOwnedImageRecord(template, image);
                if (!record)
                    throw new Error(`Story title-card replacement images.${index} is invalid.`);
                return record;
            });
            const seen = new Set();
            for (let index = 0; index < normalized.length; index++) {
                const id = normalized[index].id;
                if (seen.has(id))
                    throw new Error(`Story title-card replacement images.${index}.id duplicates ${id}.`);
                seen.add(id);
            }
            exactStoryTitleCardImageStore(normalized);
            app.storyTitleCardImages = [
                ...(app.storyTitleCardImages || []).filter(
                    (image) =>
                        !keys.has(String(image.story_key)) &&
                        !(
                            wantedTitle &&
                            storyTitleCardIdentityText(image.story_title) === wantedTitle
                        ),
                ),
                ...normalized,
            ];
        }

        function pruneStaleStoryTitleCardGeneration() {
            const map = storyTitleCardGeneratingMap();
            for (const [id, startedAt] of map.entries()) {
                if (!startedAt) {
                    map.delete(id);
                    log("Story title-card generation reset", `Cleared stale title-card generation state for ${id}.`, {
                        type: "image",
                    });
                }
            }
            return map;
        }

        function storyTitleCardIsGenerating(id = "") {
            return pruneStaleStoryTitleCardGeneration().has(id);
        }

        function markStoryTitleCardGenerating(id = "") {
            const key = String(id || "");
            const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            storyTitleCardGeneratingMap().set(key, Date.now());
            app.storyTitleCardGenerationTokens ||= {};
            app.storyTitleCardGenerationTokens[key] = token;
            return token;
        }

        function clearStoryTitleCardGenerating(id = "", token = "") {
            const key = String(id || "");
            if (token && app.storyTitleCardGenerationTokens?.[key] !== token) return false;
            storyTitleCardGeneratingMap().delete(key);
            if (app.storyTitleCardGenerationTokens) delete app.storyTitleCardGenerationTokens[key];
            return true;
        }

        function storyTitleCardGenerationToken(id = "") {
            return app.storyTitleCardGenerationTokens?.[String(id || "")] || "";
        }

        function storyTitleCardImageIframeHostKey(id = "") {
            return `story-title-card:${String(id || "")}`;
        }

        function cancelStoryTitleCardGeneration(id = "", reason = "cancelled") {
            const key = String(id || "");
            const wasGenerating = storyTitleCardIsGenerating(key);
            clearStoryTitleCardGenerating(key);
            if (app.storyTitleCardLiveHtmlCache) delete app.storyTitleCardLiveHtmlCache[key];
            removeImageGenerationIframeHost(storyTitleCardImageIframeHostKey(key), reason);
            if (wasGenerating) {
                log("Story title-card generation cancelled", `Cancelled active story title-card generation for ${key}.`, {
                    type: "image",
                    level: "message",
                    details: { storyId: key, reason },
                });
            }
            return wasGenerating;
        }

        function storyTitleCardPendingMarkup(id = "") {
            const cached = app.storyTitleCardLiveHtmlCache?.[String(id)] || "";
            if (cached) return cached;
            return `<div class="profile-image-loading">${loadingSpinnerHtml("Story title card generation in progress")}</div>`;
        }

        function storyTitleCardImages(template = {}) {
            if (!template) return [];
            return storyTitleCardStoreImages(template);
        }

        function storyTitleCardActiveId(template = {}) {
            if (template?.title_card_image?.source === "none") return "";
            const slot = createStoryTitleCardImageSlot(
                template.title_card_image,
                template.state,
                template,
            );
            return String(slot.id || "");
        }

        function storyTitleCardImageById(template = {}, imageId = "") {
            const wanted = String(imageId || "");
            if (!wanted) return null;
            return storyTitleCardImages(template).find(
                (image) => String(image.id) === wanted,
            ) || null;
        }

        function activeStoryTitleCardImage(template = {}) {
            const images = storyTitleCardImages(template);
            if (template?.title_card_image?.source === "none") return null;
            const activeId = storyTitleCardActiveId(template);
            return (
                images.find(
                    (image) =>
                        String(image.id) === activeId &&
                        profileImageIsFinished(image),
                ) ||
                images.find(profileImageIsFinished) ||
                images.find(
                    (image) =>
                        image.pending &&
                        !image.error &&
                        !storyTitleCardPendingImageIsStale(template, image),
                ) ||
                null
            );
        }

        function storyTitleCardHasPendingImage(template = {}) {
            return storyTitleCardImages(template).some(
                (image) =>
                    image?.pending &&
                    !image.error &&
                    !storyTitleCardPendingImageIsStale(template, image),
            );
        }

        function storyTitleCardPendingImageIsStale(template = {}, image = {}) {
            return !!(
                image?.pending &&
                !image.error &&
                image.id &&
                !storyTitleCardIsGenerating(template.id)
            );
        }

        function staleStoryTitleCardPendingImage(template = {}) {
            return storyTitleCardImages(template).find((image) =>
                storyTitleCardPendingImageIsStale(template, image),
            ) || null;
        }

        function pendingImageRecordHasNoFinishedImage(image = {}) {
            return !!(
                image?.pending &&
                !image.error &&
                !profileImageRealHtml(image.html || "") &&
                !textSlot(image.url || image.hosted_url, "")
            );
        }

        function cleanupStartupStaleStoryTitleCardRequests() {
            const removedIds = new Set();
            const changedTemplates = [];
            const beforeStoreCount = (app.storyTitleCardImages || []).length;
            app.storyTitleCardImages = (app.storyTitleCardImages || []).filter((image) => {
                if (!pendingImageRecordHasNoFinishedImage(image)) return true;
                removedIds.add(String(image.id || ""));
                return false;
            });
            let changed =
                removedIds.size > 0 ||
                (app.storyTitleCardImages || []).length !== beforeStoreCount;
            for (const template of app.storyTemplates || []) {
                if (!template || typeof template !== "object") continue;
                const activeId = storyTitleCardActiveId(template);
                const activeSlot = template.title_card_image || {};
                const activeSlotIsEmptyPending =
                    activeSlot?.pending && pendingImageRecordHasNoFinishedImage(activeSlot);
                if ((activeId && removedIds.has(activeId)) || activeSlotIsEmptyPending) {
                    template.title_card_image = emptyStoryTitleCardImageSlot();
                    changedTemplates.push(template);
                    changed = true;
                }
            }
            if (changed) {
                app.storyTitleCardImages = exactStoryTitleCardImageStore(app.storyTitleCardImages || []);
                saveStoryTitleImagesNow("startup stale story title-card cleanup");
                if (changedTemplates.length)
                    saveStoryTemplateRecordsNow(
                        changedTemplates,
                        "startup stale story title-card cleanup",
                    );
                log(
                    "Stale story title-card requests cleared",
                    `Removed ${removedIds.size} unfinished story title-card request${removedIds.size === 1 ? "" : "s"} left over from a previous session.`,
                    {
                        type: "image",
                        level: "message",
                        details: { removedIds: [...removedIds] },
                    },
                );
            }
            return { changed, removedCount: removedIds.size };
        }

        function collectCharacterLibraryProfileRefs() {
            const ownerNames = new Set();
            const ids = new Set();
            for (const record of app.characterDefinitions || []) {
                const character = record?.character || record?.character_definition || record?.entity || {};
                for (const value of [record?.name, character?.name]) {
                    const text = String(value || "").trim();
                    if (text) ownerNames.add(text);
                }
                for (const value of [
                    ...Object.values(record?.active_profile_image_ids || {}),
                    character?.profile_image_id,
                    character?.default_profile_image?.local_image_id,
                ]) {
                    const text = String(value || "").trim();
                    if (text) ids.add(text);
                }
                for (const image of Array.isArray(character?.profile_images)
                    ? character.profile_images
                    : []) {
                    const id = String(image?.id || image?.local_image_id || "").trim();
                    if (id) ids.add(id);
                }
            }
            return { ownerNames, ids };
        }

        function clearEntityProfileImageIds(entity = {}, removedIds = new Set()) {
            if (!entity || typeof entity !== "object") return false;
            let changed = false;
            if (Array.isArray(entity.profile_images)) {
                const next = entity.profile_images.filter((image) => {
                    const id = String(image?.id || image?.local_image_id || "").trim();
                    return !removedIds.has(id) && !pendingImageRecordHasNoFinishedImage(image);
                });
                if (next.length !== entity.profile_images.length) {
                    entity.profile_images = next;
                    changed = true;
                }
            }
            const activeId = String(entity.profile_image_id || "").trim();
            if (activeId && removedIds.has(activeId)) {
                entity.profile_image_id = "";
                changed = true;
            }
            const defaultId = defaultProfileLocalImageId(entity);
            if (defaultId && removedIds.has(defaultId)) {
                entity.default_profile_image = profileImageSlotFromExactInput({
                    ...(entity.default_profile_image || {}),
                    local_image_id: "",
                });
                changed = true;
            }
            return changed;
        }

        function cleanupStartupStaleCharacterLibraryProfileRequests() {
            const { ownerNames, ids } = collectCharacterLibraryProfileRefs();
            const removedIds = new Set();
            const beforeStoreCount = (app.profileImages || []).length;
            app.profileImages = (app.profileImages || []).filter((image) => {
                if (!pendingImageRecordHasNoFinishedImage(image)) return true;
                const id = String(image.id || "").trim();
                const owner = String(image.owner_name || "").trim();
                if (!ids.has(id) && !ownerNames.has(owner)) return true;
                if (id) removedIds.add(id);
                return false;
            });
            let changed =
                removedIds.size > 0 ||
                (app.profileImages || []).length !== beforeStoreCount;
            for (const record of app.characterDefinitions || []) {
                const character = record?.character || record?.character_definition || record?.entity;
                if (clearEntityProfileImageIds(character, removedIds)) changed = true;
                const activeIds = exactCharacterLibraryActiveProfileImageIds(
                    record.active_profile_image_ids,
                );
                for (const presentationKey of CHARACTER_LIBRARY_ACTIVE_PROFILE_IMAGE_ID_FIELDS) {
                    const activeId = String(activeIds[presentationKey] || "").trim();
                    if (!activeId || !removedIds.has(activeId)) continue;
                    activeIds[presentationKey] = "";
                    changed = true;
                }
                record.active_profile_image_ids = activeIds;
            }
            if (changed) {
                app.profileImages = exactProfileImageStore(app.profileImages || []);
                app.characterDefinitions = validatedCharacterLibraryDefinitions(app.characterDefinitions || []);
                saveProfileImagesNow("startup stale character profile cleanup");
                saveCharacterLibraryNow("startup stale character profile cleanup");
                log(
                    "Stale character profile requests cleared",
                    `Removed ${removedIds.size} unfinished character-library profile request${removedIds.size === 1 ? "" : "s"} left over from a previous session.`,
                    {
                        type: "image",
                        level: "message",
                        details: { removedIds: [...removedIds] },
                    },
                );
            }
            return { changed, removedCount: removedIds.size };
        }

        function cleanupStartupStaleLibraryImageRequests() {
            const story = cleanupStartupStaleStoryTitleCardRequests();
            const profiles = cleanupStartupStaleCharacterLibraryProfileRequests();
            return {
                changed: !!story.changed || !!profiles.changed,
                storyTitleCardRequestsRemoved: story.removedCount,
                characterProfileRequestsRemoved: profiles.removedCount,
            };
        }

        function setStoryTitleCardDefault(template = {}, imageId = "", image = null, options = {}) {
            const found = image || storyTitleCardImageById(template, imageId);
            if (!template || !found) return false;
            template.title_card_image = storyTitleCardImageSlotFromRecord(
                found,
                template.state,
                template,
            );
            template.updatedAt = new Date().toISOString();
            if (options.save !== false) saveStoryTitleCardChanges(template, []);
            return true;
        }

        function pruneStoryTitleCardImages(template = {}, downloadOld = false) {
            const images = storyTitleCardImages(template);
            const limit = profileImageHistoryLimit();
            const activeId = storyTitleCardActiveId(template);
            const protectedIds = new Set(
                images
                    .filter((image) => image.favorite || String(image.id) === activeId)
                    .map((image) => String(image.id)),
            );
            const eligible = images.filter(
                (image) => !protectedIds.has(String(image.id)),
            );
            if (eligible.length <= limit) return [];
            const excess = eligible.length - limit;
            const removed = eligible
                .slice()
                .sort(
                    (a, b) =>
                        (Date.parse(a.at || "") || 0) -
                        (Date.parse(b.at || "") || 0),
                )
                .slice(0, excess);
            const removedIds = new Set(removed.map((image) => String(image.id)));
            if (!removedIds.size) return [];
            replaceStoryTitleCardStoreImages(
                template,
                images.filter((image) => !removedIds.has(String(image.id))),
            );
            if (downloadOld) downloadStoryTitleCardArchive(template, removed);
            return removed;
        }

        function rememberStoryTitleCardImage(storyId = "", image = {}, options = {}) {
            const template = storyTemplateById(storyId);
            if (!template) return null;
            const record = createStoryTitleCardHistoryRecord(image, template.state, template);
            if (!record) return null;
            const nextImages = [
                record,
                ...storyTitleCardImages(template).filter((item) => item.id !== record.id),
            ];
            replaceStoryTitleCardStoreImages(template, nextImages);
            if (options.setActive !== false) {
                setStoryTitleCardDefault(template, record.id, record, { save: false });
            }
            const removedStoryImages = pruneStoryTitleCardImages(
                template,
                !!app.settings.downloadOldImagesBeforeDelete,
            );
            pruneGlobalReusableImageHistories(
                !!app.settings.downloadOldImagesBeforeDelete,
            );
            template.updatedAt = new Date().toISOString();
            saveStoryTitleCardChanges(template, removedStoryImages.length ? null : [record]);
            return storyTitleCardImageById(template, record.id);
        }

        async function copyStoryTitleCardDefaultImageIfAvailable(template = {}, reason = "story title-card default image") {
            if (!template) return false;
            let existingImages = storyTitleCardImages(template);
            let existingFinished = existingImages.find(profileImageIsFinished);
            if (!existingFinished && app.persistence?.started) {
                const storedImages = await loadPerRecordLibrary(
                    STORY_TITLE_CARD_IMAGE_KEY,
                    [],
                );
                const mergedImages = new Map();
                for (const image of [
                    ...(app.storyTitleCardImages || []),
                    ...(storedImages || []),
                ]) {
                    const identity = `${String(image?.story_key || "")}\u0000${String(image?.id || "")}`;
                    mergedImages.set(identity, image);
                }
                app.storyTitleCardImages = exactStoryTitleCardImageStore([
                    ...mergedImages.values(),
                ]);
                existingImages = storyTitleCardImages(template);
                existingFinished = existingImages.find(profileImageIsFinished);
            }
            if (existingFinished) {
                setStoryTitleCardDefault(template, existingFinished.id, existingFinished, {
                    save: false,
                });
                saveStoryTitleCardChanges(template, [existingFinished]);
                log(
                    "Story title-card image adopted",
                    `${template.title || "Story"} adopted an existing imported title-card image before generation fallback.`,
                    {
                        type: "image",
                        level: "message",
                        details: {
                            storyId: template.id || "",
                            imageId: existingFinished.id,
                            reason,
                        },
                    },
                );
                return true;
            }
            const slot = createStoryTitleCardImageSlot(
                template.title_card_image,
                template.state,
                template,
            );
            const url = textSlot(slot.url, "");
            const activeId = storyTitleCardActiveId(template);
            const active = activeId ? storyTitleCardImageById(template, activeId) : null;
            if (active && profileImageIsFinished(active)) return true;
            if (!url) return false;
            try {
                let html = "";
                if (/^data:image\//i.test(url)) {
                    html = `<img src="${escapeHtml(url)}" alt="${escapeHtml(template.title || "Story title card")}">`;
                } else {
                    try {
                        const response = await fetch(url, { cache: "force-cache" });
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                        const blob = await response.blob();
                        if (!String(blob.type || "").startsWith("image/"))
                            throw new Error("Story title-card URL did not return an image.");
                        const dataUrl = await dataUrlFromBlob(blob);
                        html = `<img src="${escapeHtml(dataUrl)}" alt="${escapeHtml(template.title || "Story title card")}">`;
                    } catch (err) {
                        const fallback = imageTagForStoredSrc(url);
                        if (!fallback) throw err;
                        html = fallback;
                        log(
                            "Story title-card hosted image fallback",
                            `${template.title || "Story"} title-card image could not be copied locally; using hosted URL fallback: ${err.message || err}`,
                            {
                                type: "image",
                                level: "warning",
                                details: { storyId: template.id || "", title: template.title || "", reason, url },
                            },
                        );
                    }
                }
                const imageId =
                    slot.id && slot.id !== "title-card-image"
                        ? slot.id
                        : `story-title-card-${template.id || Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                const record = createStoryTitleCardHistoryRecord(
                    {
                        id: imageId,
                        source: slot.source || "default",
                        reason,
                        title: slot.title,
                        prompt: slot.prompt || defaultStoryTitleCardPrompt(template.state, template),
                        negativePrompt: slot.negativePrompt || "",
                        seed: slot.seed,
                        model: slot.model,
                        html,
                        url,
                        hosted_url: /^https?:\/\//i.test(url) ? url : "",
                        favorite: false,
                    },
                    template.state,
                    template,
                );
                if (!record) return false;
                replaceStoryTitleCardStoreImages(template, [
                    record,
                    ...storyTitleCardImages(template),
                ]);
                setStoryTitleCardDefault(template, record.id, record, { save: false });
                saveStoryTitleCardChanges(template, [record]);
                log(
                    "Story title-card default image copied",
                    `${template.title || "Story"} title-card default image copied into local story image history.`,
                    {
                        type: "image",
                        level: "message",
                        details: {
                            storyId: template.id || "",
                            title: template.title || "",
                            reason,
                            imageId: record.id,
                            urlKind: /^data:image\//i.test(url)
                                ? "data-url"
                                : /^https?:\/\//i.test(url)
                                  ? "remote-url"
                                  : "other",
                        },
                    },
                );
                return true;
            } catch (err) {
                log(
                    "Story title-card default image failed",
                    `${template.title || "Story"} title-card default image could not be copied: ${err.message || err}`,
                    {
                        type: "image",
                        level: "error",
                        details: {
                            storyId: template.id || "",
                            title: template.title || "",
                            reason,
                            error: err?.message || String(err),
                            url,
                        },
                    },
                );
                return false;
            }
        }

        function storyTitleCardImportPreparationSet() {
            if (app.storyTitleCardImportPreparing instanceof Set)
                return app.storyTitleCardImportPreparing;
            app.storyTitleCardImportPreparing = new Set();
            return app.storyTitleCardImportPreparing;
        }

        function storyTitleCardImportIsPreparing(storyId = "") {
            return storyTitleCardImportPreparationSet().has(String(storyId || ""));
        }

        function prepareImportedStoryTitleCard(template = {}, reason = "story import") {
            const storyId = String(template?.id || "");
            if (!storyId) return Promise.resolve(false);
            storyTitleCardImportPreparationSet().add(storyId);
            return app.work.startBackground(
                `story-import-image:${storyId}`,
                `Prepare ${template.title || "story"} image`,
                async () => {
                    try {
                        const currentTemplate = storyTemplateById(storyId) || template;
                        const copied = await copyStoryTitleCardDefaultImageIfAvailable(
                            currentTemplate,
                            reason,
                        );
                        delete app.storyTitleCardImportErrors?.[storyId];
                        return copied;
                    } catch (error) {
                        app.storyTitleCardImportErrors ||= {};
                        app.storyTitleCardImportErrors[storyId] =
                            error?.message || String(error);
                        throw error;
                    } finally {
                        storyTitleCardImportPreparationSet().delete(storyId);
                        refreshStoryLibraryTitleCardSurfaces(storyId);
                        setTimeout(() => queueFirstVisibleStoryLibraryMissingTitleCard(), 0);
                    }
                },
            );
        }

        function saveStoryTitleCardChanges(template = null, imageRecords = null) {
            const storyRecord = template?.id
                ? (app.storyTemplates || []).find(
                    (item) => String(item.id || "") === String(template.id || ""),
                ) || template
                : null;
            const records = Array.isArray(imageRecords)
                ? imageRecords
                      .map((image) =>
                          storyTitleCardOwnedImageRecord(
                              storyRecord || template,
                              image,
                          ),
                      )
                      .filter(Boolean)
                : [...(app.storyTitleCardImages || [])];
            const replaceAllImages = !Array.isArray(imageRecords);
            const ownerKey = String(storyRecord?.id || template?.id || "library");
            if (records.length) exactStoryTitleCardImageStore(records);
            beginLibrarySaving("Saving story image...");
            const promise = app.work
                .enqueueOrdered(
                    `story-image-owner:${ownerKey}`,
                    `save story image owner ${ownerKey}`,
                    async () => {
                        if (storyRecord)
                            await savePerRecordLibraryRecords(
                                STORY_TEMPLATE_KEY,
                                [storyRecord],
                            );
                        else
                            await savePerRecordLibrary(
                                STORY_TEMPLATE_KEY,
                                app.storyTemplates || [],
                            );
                        if (records.length) {
                            if (replaceAllImages)
                                await savePerRecordLibrary(
                                    STORY_TITLE_CARD_IMAGE_KEY,
                                    records,
                                );
                            else
                                await savePerRecordLibraryRecords(
                                    STORY_TITLE_CARD_IMAGE_KEY,
                                    records,
                                );
                        }
                        return true;
                    },
                    { coalesce: true },
                )
                .finally(endLibrarySaving);
            trackLargeStoragePromise(`story-image-owner:${ownerKey}`, promise);
            return promise;
        }

        function storyTitleCardInnerHtml(image = {}) {
            {}
            const liveCachedHtml =
                image?.pending && image?.id
                    ? app.storyTitleCardLiveHtmlCache?.[String(image.id)] || ""
                    : "";
            const rendered = renderStoredImageHtml(
                profileImageRealHtml(image?.html) || liveCachedHtml,
            );
            if (rendered) return rendered.replace("<img ", '<img class="profile-image-thumb" ');
            if (image?.pending)
                return profileImageLoadingHtml(image.error || "Story title card generation in progress");
            return `<div class="profile-image-placeholder ${image.error ? "static" : ""}" aria-label="${escapeHtml(image.error || "No story title card")}"></div>`;
        }

        function storyTitleCardOptionHtml(storyId = "", image = {}, activeId = "", positionContext = profileImagePositionContext([image])) {
            const active = String(image.id) === String(activeId);
            const storyArg = htmlJsArg(storyId);
            const imageArg = htmlJsArg(image.id);

            const canPreview =
                profileImageRealHtml(image.html) &&
                !image.pending &&
                !image.error;
            return `
                <div class="image-card profile-option ${active ? "active" : ""}" data-story-title-card-image-id="${escapeHtml(image.id)}">
                    <div class="image-card-heading">
                        <strong class="image-card-title">${active ? "Active Story Image" : "Story Image"}</strong>
                        <span class="image-mode-row">

                            ${profileImagePositionBadgeHtml(image, positionContext, active)}
                        </span>
                    </div>
                    <div class="image-render profile-image-live ${canPreview ? "clickable-image-render" : ""}" data-story-title-card-live-id="${escapeHtml(image.id)}" ${canPreview ? `title="View full size" onclick="EmberAdventures.openStoryTitleCardPreview(${storyArg}, ${imageArg})"` : ""}>
                        ${storyTitleCardInnerHtml(image)}
                        ${canPreview ? `<button type="button" class="image-preview-hitbox" title="View full size" aria-label="View full size story image" onclick="event.stopPropagation(); EmberAdventures.openStoryTitleCardPreview(${storyArg}, ${imageArg})"></button>` : ""}
                    </div>
                    <div class="image-card-toolbar">
                        ${`<button ${active ? "disabled" : ""} data-story-title-card-action="select" data-story-title-card-id="${escapeHtml(image.id)}">${active ? "Active" : "Use this"}</button>`}
                        ${canPreview ? `<button class="icon-button" title="Download story image" onclick="EmberAdventures.downloadStoryTitleCardRecord(${storyArg}, ${imageArg})">&#11015;</button>` : ""}
                        ${`<button class="icon-button blue" title="Load in Image Lab" onclick="EmberAdventures.loadStoryTitleCardInLab(${storyArg}, ${imageArg})">&#128300;</button>`}
                        <button class="icon-button image-favorite-button ${image.favorite ? "speak-on" : "speak-off"}" title="${image.favorite ? "Unfavorite image" : "Favorite image"}" onclick="EmberAdventures.toggleStoryTitleCardFavorite(${storyArg}, ${imageArg})">${image.favorite ? "&#9733;" : "&#9734;"}</button>
                        <button class="icon-button danger" title="Delete image" onclick="EmberAdventures.deleteStoryTitleCardImage(${storyArg}, ${imageArg})">&#128465;</button>
                    </div>
                </div>
            `;
        }

        function storyTitleCardModalHtml(storyId = "") {
            const template = storyTemplateById(storyId);
            if (!template) return "";
            const images = storyTitleCardImages(template);
            const activeId = storyTitleCardActiveId(template);
            const positionContext = profileImagePositionContext(images);
            const gallery = images.length
                ? images
                      .map((image) =>
                          storyTitleCardOptionHtml(
                              storyId,
                              image,
                              activeId,
                              positionContext,
                          ),
                      )
                      .join("")
                : `<div class="hint">No story images yet. Generate one.</div>`;
            const imageMode = storyTemplateImageMode(template);
            const slot = createStoryTitleCardImageSlot(
                template.title_card_image,
                template.state,
                template,
            );
            const globalStoryModel = selectedImageModel(app.settings.imageModel);
            const storyModel = selectedImageModel(slot.model || app.settings.imageModel);
            const defaultSeed = exactProfileImageSeed(slot.seed, "story title image seed");
            const randomSeedEnabled = storyTitleCardRandomSeedEnabled(storyId);
            return `
                <div data-story-title-card-modal="${escapeHtml(storyId)}">
                    <h2>${escapeHtml(template.title || "Story")} Story Image</h2>
                    <p class="hint">Story images are stored on this story only. Up to ${escapeHtml(positionContext.limit)} are kept per story.</p>
                    <div class="profile-image-style-panel">
                        <div class="grid2">
                            <label>Global default style
                                <input value="${escapeHtml(imageModelLabel(globalStoryModel))}" readonly>
                            </label>
                            <label>Story image style
                                <select data-story-title-card-style="${escapeHtml(storyId)}">
                                    <option value="" ${slot.model ? "" : "selected"}>Use global default (${escapeHtml(imageModelLabel(globalStoryModel))})</option>
                                    ${imageModelOptions()
                                        .map(
                                            (model) =>
                                                `<option value="${escapeHtml(model.value)}" ${model.value === storyModel ? "selected" : ""}>${escapeHtml(model.label)}</option>`,
                                        )
                                        .join("")}
                                </select>
                            </label>
                        </div>
                    </div>
                    <div class="profile-image-seed-panel">
                        <label>Default seed
                            <input data-story-title-card-seed="${escapeHtml(storyId)}" type="number" min="0" max="999999999" step="1" value="${escapeHtml(defaultSeed)}" ${randomSeedEnabled ? "disabled" : ""}>
                        </label>
                        <label class="inline-check check-row">
                            <input data-story-title-card-random-seed="${escapeHtml(storyId)}" type="checkbox" ${randomSeedEnabled ? "checked" : ""}>
                            Randomize seed each image
                        </label>
                        <button type="button" data-story-title-card-action="random-seed">Generate new random seed</button>
                    </div>
                    <div class="row" style="margin-top:.65rem">
                        <button class="primary" data-story-title-card-action="generate">Generate new story image</button>
                        <button class="blue" type="button" data-story-title-card-action="upload">Upload image</button>
                        <button class="blue" type="button" onclick="EmberAdventures.openStoryTitleCardImageLab(${htmlJsArg(storyId)})">Image Lab</button>
                        <span class="image-mode-row">Generation mode ${""}</span>
                    </div>
                    <div class="profile-gallery story-title-card-gallery">${gallery}</div>
                </div>
            `;
        }

        function openStoryTitleCardImageModal(storyId = "") {
            const template = storyTemplateById(storyId);
            if (!template) return;
            const popup = openPopupModal(`
                <div class="modal-chrome-header">
                    <strong class="modal-chrome-title">${escapeHtml(template.title || "Story")} Story Image</strong>
                    <button type="button" class="modal-close" onclick="EmberAdventures.closeContainingPopup(this)">X</button>
                </div>
                ${storyTitleCardModalHtml(storyId)}
            `);
            popup.box.setAttribute("data-story-title-card-modal-box", "1");
            popup.box.setAttribute("data-fullscreen-list-modal", "1");
            bindStoryTitleCardModalControls(storyId, popup.box);
            scheduleProfileImageLoadingAutosize(popup.box);
            return popup;
        }

        function refreshOpenStoryTitleCardImageModal(storyId = "") {
            const modals = [...document.querySelectorAll("[data-story-title-card-modal]")].filter(
                (node) => node.dataset.storyTitleCardModal === String(storyId),
            );
            if (!modals.length) return;
            const template = storyTemplateById(storyId);
            if (!template) return;
            const slot = createStoryTitleCardImageSlot(
                template.title_card_image,
                template.state,
                template,
            );
            const images = storyTitleCardImages(template);
            const activeId = storyTitleCardActiveId(template);
            const positionContext = profileImagePositionContext(images);
            for (const modal of modals) {
                const gallery = modal.querySelector(".story-title-card-gallery");
                if (gallery) {
                    gallery.innerHTML =
                        images.length
                            ? images
                                  .map((image) =>
                                      storyTitleCardOptionHtml(
                                          storyId,
                                          image,
                                          activeId,
                                          positionContext,
                                      ),
                                  )
                                  .join("")
                            : `<div class="hint">No story images yet. Generate one.</div>`;
                    activatePluginIframes(gallery);
                }
                const generateButton = modal.querySelector("[data-story-title-card-action='generate']");
                if (generateButton) {
                    generateButton.disabled = false;
                    generateButton.textContent = "Generate new story image";
                }
                const seedInput = modal.querySelector("[data-story-title-card-seed]");
                if (seedInput && !seedInput.matches(":focus")) {
                    seedInput.value = String(exactProfileImageSeed(slot.seed, "story title image seed"));
                    seedInput.disabled = storyTitleCardRandomSeedEnabled(storyId);
                }
                bindStoryTitleCardModalControls(storyId, modal);
            }
            scheduleProfileImageLoadingAutosize(document);
        }

        function bindStoryTitleCardModalControls(storyId = "", root = document) {
            const styleSelect = root.querySelector?.("[data-story-title-card-style]");
            if (styleSelect && styleSelect.dataset.bound !== "1") {
                styleSelect.dataset.bound = "1";
                styleSelect.onchange = () => {
                    saveStoryTitleCardModel(storyId, styleSelect.value);
                };
            }
            const generateButton = root.querySelector?.("[data-story-title-card-action='generate']");
            if (generateButton) {
                generateButton.onclick = () => {
                    generateStoryTemplateTitleCardImage(
                        storyId,
                        storyTitleCardSeedOptionsFromModal(storyId, root),
                    );
                };
            }
            const seedInput = root.querySelector?.("[data-story-title-card-seed]");
            const randomSeedToggle = root.querySelector?.("[data-story-title-card-random-seed]");
            if (seedInput && seedInput.dataset.bound !== "1") {
                seedInput.dataset.bound = "1";
                seedInput.onblur = () => {
                    seedInput.value = String(saveStoryTitleCardDefaultSeed(storyId, seedInput.value));
                };
            }
            if (randomSeedToggle && randomSeedToggle.dataset.bound !== "1") {
                randomSeedToggle.dataset.bound = "1";
                randomSeedToggle.onchange = () => {
                    setStoryTitleCardRandomSeedEnabled(storyId, randomSeedToggle.checked);
                    if (seedInput) seedInput.disabled = randomSeedToggle.checked;
                };
            }
            const randomSeedButton = root.querySelector?.("[data-story-title-card-action='random-seed']");
            if (randomSeedButton && randomSeedButton.dataset.bound !== "1") {
                randomSeedButton.dataset.bound = "1";
                randomSeedButton.onclick = () => {
                    const seed = saveStoryTitleCardDefaultSeed(storyId, randomProfileImageSeed());
                    if (seedInput) {
                        seedInput.value = String(seed);
                        seedInput.disabled = false;
                    }
                    if (randomSeedToggle) randomSeedToggle.checked = false;
                    setStoryTitleCardRandomSeedEnabled(storyId, false);
                };
            }
            const uploadButton = root.querySelector?.("[data-story-title-card-action='upload']");
            if (uploadButton && uploadButton.dataset.bound !== "1") {
                uploadButton.dataset.bound = "1";
                uploadButton.onclick = () => uploadLocalStoryTitleCardImage(storyId);
            }
            root.querySelectorAll?.("[data-story-title-card-action]").forEach((button) => {
                if (
                    button.dataset.storyTitleCardAction === "generate" ||
                    button.dataset.storyTitleCardAction === "random-seed" ||
                    button.dataset.storyTitleCardAction === "upload"
                )
                    return;
                button.onclick = () => {
                    const id = button.dataset.storyTitleCardId;
                    if (button.dataset.storyTitleCardAction === "select")
                        selectStoryTitleCardImage(storyId, id);
                    if (button.dataset.storyTitleCardAction === "delete")
                        deleteStoryTitleCardImage(storyId, id);
                };
            });
        }

        function refreshStoryTitleCardSurfaces(storyId = "") {
            refreshStoryLibraryTitleCardSurfaces(storyId);
            refreshOpenStoryTitleCardImageModal(storyId);
        }

        function selectStoryTitleCardImage(storyId = "", imageId = "") {
            const template = storyTemplateById(storyId);
            const image = template ? storyTitleCardImageById(template, imageId) : null;
            if (!template || !image) return;
            {}
            setStoryTitleCardDefault(template, imageId, image, { save: false });
            saveStoryTitleCardChanges(template, []);
            refreshStoryTitleCardSurfaces(storyId);
        }

        function toggleStoryTitleCardFavorite(storyId = "", imageId = "") {
            const template = storyTemplateById(storyId);
            const image = template ? storyTitleCardImageById(template, imageId) : null;
            if (!template || !image) return;
            image.favorite = !image.favorite;
            if (storyTitleCardActiveId(template) === String(imageId)) {
                setStoryTitleCardDefault(template, imageId, image, { save: false });
            }
            saveStoryTitleCardChanges(template, [image]);
            refreshStoryTitleCardSurfaces(storyId);
        }

        async function deleteStoryTitleCardImage(storyId = "", imageId = "") {
            const template = storyTemplateById(storyId);
            if (!template) return;
            if (
                !(await showConfirm("Delete Story Image", "Delete this story image?", {
                    confirmText: "Delete",
                    danger: true,
                }))
            )
                return;
            const nextImages = storyTitleCardImages(template).filter(
                (image) => String(image.id) !== String(imageId),
            );
            if (storyTitleCardIsGenerating(storyId)) {
                cancelStoryTitleCardGeneration(storyId, `story title-card image deleted: ${imageId}`);
            }
            replaceStoryTitleCardStoreImages(template, nextImages);
            if (storyTitleCardActiveId(template) === String(imageId)) {
                template.title_card_image = emptyStoryTitleCardImageSlot();
            }
            saveStoryTitleCardChanges(template, null);
            refreshStoryTitleCardSurfaces(storyId);
        }

        function downloadStoryTitleCardRecord(storyId = "", imageId = "") {
            const template = storyTemplateById(storyId);
            const image = template ? storyTitleCardImageById(template, imageId) : null;
            if (!image) return;
            {}
            return downloadSingleImageRecord(
                image,
                `${template.title || "story"}-${image.source || "story-image"}`,
            );
        }

        function openStoryTitleCardPreview(storyId = "", imageId = "") {
            const template = storyTemplateById(storyId);
            const image = template ? storyTitleCardImageById(template, imageId) : null;
            if (!image) return;
            {}
            const html = renderStoredImageHtml(profileImageRealHtml(image.html));
            if (!html) return;
            openPopupModal(`
                <div class="modal-chrome-header">
                    <strong class="modal-chrome-title">${escapeHtml(template.title || "Story")} Story Image</strong>
                    <button type="button" class="modal-close" onclick="EmberAdventures.closeContainingPopup(this)">X</button>
                </div>
                <div class="image-viewer-full">${html}</div>
                <div class="row" style="margin-top:.75rem">
                    <button type="button" onclick="EmberAdventures.downloadStoryTitleCardRecord(${htmlJsArg(storyId)}, ${htmlJsArg(imageId)})">Download</button>
                    <button type="button" onclick="EmberAdventures.closeContainingPopup(this)">Close</button>
                </div>
            `);
        }

        function openStoryTitleCardImageLab(storyId = "") {
            const template = storyTemplateById(storyId);
            if (!template) return;
            const slot = createStoryTitleCardImageSlot(
                template.title_card_image,
                template.state,
                template,
            );
            openImageLabModal({
                title: `${template.title || "Story"} Story Image`,
                reason: "story title card",
                prompt: slot.prompt,
                negativePrompt: "",
                seed: exactProfileImageSeed(slot.seed, "story title image seed"),
                model: slot.model || app.settings.imageModel,
                storyTitleCardTarget: storyId,
                popup: true,
            });
        }

        function loadStoryTitleCardInLab(storyId = "", imageId = "") {
            const template = storyTemplateById(storyId);
            const image = template ? storyTitleCardImageById(template, imageId) : null;
            if (!template || !image) return;
            {}
            openImageLabModal({
                ...image,
                title: `${template.title || "Story"} Story Image`,
                reason: image.source || "story title card",
                storyTitleCardTarget: storyId,
                popup: true,
            });
        }

        function downloadStoryTitleCardArchive(template = {}, images = []) {
            const downloadableImages = (images || []).filter(
                (image) => true,
            );
            if (!downloadableImages.length) return false;
            const safeName = String(template.title || "story").replace(/[^a-z0-9]+/gi, "-");
            const archive = buildImageArchiveFiles({
                type: "old-story-title-card-images",
                story: template.title || "Story",
                images: downloadableImages,
            });
            const blob = makeZip(archive.files);
            const a = document.createElement("a");
            const stamp = new Date()
                .toISOString()
                .replace(/[:.]/g, "-")
                .slice(0, 19);
            a.href = URL.createObjectURL(blob);
            a.download = `emberadventureslite-story-images-${safeName}-${stamp}.zip`;
            a.click();
            URL.revokeObjectURL(a.href);
        }

        function storyTemplateTitleCardSrc(template = {}) {
            const slot = createStoryTitleCardImageSlot(
                template.title_card_image,
                template.state,
                template,
            );
            const slotSrc = slot.url || "";
            if (slotSrc) return slotSrc;
            const active = activeStoryTitleCardImage(template);
            if (active?.id && profileImageIsFinished(active)) {
                setStoryTitleCardDefault(template, active.id, active, { save: false });
                return (
                    imageSrcFromHtml(active.html || "") ||
                    extractImageSrc(active.html || "") ||
                    active.url ||
                    active.hosted_url ||
                    ""
                );
            }
            if (
                storyTitleCardActiveId(template) &&
                !slotSrc &&
                !active &&
                template?.title_card_image?.source !== "none"
            ) {
                template.title_card_image = emptyStoryTitleCardImageSlot();
            }
            return "";
        }

        function storyTitleCardFrameMarkup(innerHtml = "", title = "Story") {
            return `
                <div class="story-title-card-frame">
                    ${innerHtml}
                </div>
            `;
        }

        function storyTemplateTitleCardMarkup(template = {}, options = {}) {
            const slot = createStoryTitleCardImageSlot(
                template.title_card_image,
                template.state,
                template,
            );
            const alt = template.title || slot.title || "Story title card";
            const active = activeStoryTitleCardImage(template);
            {}
            const src = storyTemplateTitleCardSrc(template);
            const pending = !!options.pending;
            if (src)
                return storyTitleCardFrameMarkup(
                    `<div class="profile-image-thumb-wrap"><img class="profile-image-thumb" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"></div>`,
                    alt,
                );
            if (pending) return storyTitleCardPendingMarkup(template.id || slot.id);
            return `<div class="profile-image-placeholder" aria-label="No story title card"></div>`;
        }

        function storyTemplateDateTimeLabel(value = "", fallback = "Unknown") {
            const text = String(value || "").trim();
            if (!text) return fallback;
            const date = new Date(text);
            if (!Number.isFinite(date.getTime())) return text;
            return date.toLocaleString();
        }

        function storyLibrarySearchText(template = {}) {

            return [
                template.title,
                template.description,
                template.source,
                storySourceDisplayLabel(template.source),
                storyLibraryCreator(template),
                template.creation_tool,
                ...(template.genres || []),
            ]
                .filter(Boolean)
                .join(" ");
        }

        function storyLibraryRecordHtml(template = {}, options = {}) {


            const genres = genreDisplayList(template.genres || template.state?.meta?.genres || []);

            const meta = [
                genres[0] || "Story",
                storySourceDisplayLabel(template.source),
            ].filter(Boolean).join("  |  ");
            const click = options.clickExpression || (options.publicEntryId
                ? `EmberAdventures.openPublicStoryLibraryDetail(${htmlJsArg(options.publicEntryId)}, ${htmlJsArg(options.owned ? "mine" : "public")})`
                : `EmberAdventures.openStoryLibraryDetail(${htmlJsArg(template.id)})`);
            const imageClick = `event.stopPropagation(); ${click}`;
            const imageHtml = options.imageHtml || storyTemplateTitleCardMarkup(template, {
                pending: storyTitleCardIsGenerating(template.id),
            });
            return `
                <div class="character-card character-library-definition-card" role="button" tabindex="0" data-story-template-card data-story-library-card data-library-filter-fields="${escapeHtml(JSON.stringify(libraryFilterFields(template)))}" data-search="${escapeHtml(storyLibrarySearchText(template))}" data-story-library-id="${escapeHtml(template.id || "")}" onclick="${click}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); ${click};}">
                    <div class="character-name story-library-card-title"><span class="story-library-card-title-text">${escapeHtml(template.title || "Untitled Story")}</span></div>
                    <div class="profile-image-button character-library-definition-image story-library-title-card" title="${options.publicEntryId ? "Open public story" : "Open story definition"}" onclick="${imageClick}">
                        ${imageHtml}
                    </div>
                    <div class="character-library-card-meta">
                        <span data-library-fit-text>${escapeHtml(meta || "Story")}</span>
                        ${""}
                    </div>
                    ${options.footerHtml || ""}
                </div>
            `;
        }

        function publicStoryLibraryCardHtml(entry = {}, options = {}) {
            const imageUrl = textSlot(entry.image_url, "");
            const template = {
                id: entry.id || "",
                title: entry.name || entry.title || "Untitled Story",
                description: entry.description || "",
                source: entry.source || "",
                creation_tool: entry.creation_tool || "",
                genres: entry.genres || [],
            };
            const rating = entry.rating_count
                ? `<div class="public-library-card-rating" title="${escapeHtml(`${entry.rating_count} rating${entry.rating_count === 1 ? "" : "s"}`)}"><span aria-hidden="true">&#9733;</span> ${escapeHtml(Number(entry.rating_average || 0).toFixed(1))}<small>(${escapeHtml(entry.rating_count)})</small></div>`
                : `<div class="public-library-card-rating unrated">Unrated</div>`;
            return storyLibraryRecordHtml(template, {
                publicEntryId: entry.id || "",
                imageHtml: imageUrl
                    ? storyTitleCardFrameMarkup(
                          `<div class="profile-image-thumb-wrap"><img class="profile-image-thumb" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(template.title)}"></div>`,
                          template.title,
                      )
                    : `<div class="profile-image-placeholder" aria-label="No story title card"></div>`,
                footerHtml: `${rating}${options.owned ? `<span class="owned-public-card-state ${String(entry.visibility || "public") === "hidden" ? "hidden" : "visible"}" aria-hidden="true"></span>` : ""}`,
            });
        }

        function storyLibraryVisibleTemplates() {
            return Array.isArray(app.storyTemplates) ? app.storyTemplates : [];
        }

        function storyLibraryTabRecords(tab = "local") {
            const records = storyLibraryVisibleTemplates();
            if (tab === "mine") {
                const creatorId = mineCreatorIdentityId();
                return creatorId
                    ? records.filter((record) => definitionCreatorId(record) === creatorId)
                    : [];
            }
            return records;
        }

        function storyLibrarySortRecords(records = [], tab = storyLibraryActiveTab()) {
            const sort = app.storyLibrarySorts?.[tab] || "name-az";
            return [...records].sort((a, b) => {
                if (sort === "name-za") return String(b.title || "").localeCompare(String(a.title || ""));
                if (sort === "source-az") return String(a.source || "").localeCompare(String(b.source || "")) || String(a.title || "").localeCompare(String(b.title || ""));
                if (sort === "updated-new") return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
                return String(a.title || "").localeCompare(String(b.title || ""));
            });
        }

        function storyLibrarySortOptionsHtml(tab = "local") {
            const value = app.storyLibrarySorts?.[tab] || (tab === "public" ? "highest-rated" : "name-az");
            return `
                <label>Sort by
                    <select data-story-library-sort-select="${escapeHtml(tab)}" onchange="EmberAdventures.setStoryLibrarySort(${htmlJsArg(tab)}, this.value)">
                        ${tab === "public" ? `<option value="highest-rated" ${value === "highest-rated" ? "selected" : ""}>Highest Rated</option>
                        <option value="newest" ${value === "newest" ? "selected" : ""}>Newest</option>
                        <option value="oldest" ${value === "oldest" ? "selected" : ""}>Oldest</option>
                        <option value="updated" ${value === "updated" ? "selected" : ""}>Recently Updated</option>` : ""}
                        <option value="name-az" ${value === "name-az" ? "selected" : ""}>Name (A-Z)</option>
                        <option value="name-za" ${value === "name-za" ? "selected" : ""}>Name (Z-A)</option>
                        ${tab === "public" ? "" : `<option value="source-az" ${value === "source-az" ? "selected" : ""}>Source</option>
                        <option value="updated-new" ${value === "updated-new" ? "selected" : ""}>Recently Updated</option>`}
                    </select>
                </label>
            `;
        }

        function storyLibraryCardSizeOptionsHtml() {
            const columns = unifiedLibraryColumnCount("story");
            return `
                <label>Columns
                    <span class="library-column-stepper">
                        <input type="number" min="1" step="1" value="${columns}" data-library-columns-input="story" onchange="EmberAdventures.setUnifiedLibraryColumns(this.value)">
                        <button type="button" title="More columns" aria-label="More columns" onclick="EmberAdventures.stepUnifiedLibraryColumns(1)">&#9650;</button>
                        <button type="button" title="Fewer columns" aria-label="Fewer columns" onclick="EmberAdventures.stepUnifiedLibraryColumns(-1)">&#9660;</button>
                    </span>
                </label>
            `;
        }

        function storyLibraryPublicStoryRailsHtml() {
            return `
                <div class="character-library-story-rails" data-story-library-story-rails>
                    <details class="character-library-story-rail" open>
                        <summary>Featured Stories</summary>
                        <div class="character-library-story-rail-track" data-curated-story-rail="featured"><div class="character-library-story-rail-card"><strong>Loading featured stories...</strong></div></div>
                    </details>
                    <details class="character-library-story-rail">
                        <summary>Sandbox Stories</summary>
                        <div class="character-library-story-rail-track" data-curated-story-rail="sandbox"><div class="character-library-story-rail-card"><strong>Loading sandbox stories...</strong></div></div>
                    </details>
                </div>
            `;
        }

        function curatedStoryManifestEntry(value = {}) {
            if (typeof value === "string")
                return { url: value, storyId: "", revision: "", payloadSha256: "", payloadSizeBytes: 0 };
            return {
                url: String(value.url || "").trim(),
                storyId: String(value.storyId || value.story_id || "").trim(),
                revision: String(value.revision || "").trim(),
                payloadSha256: String(value.payloadSha256 || value.payload_sha256 || "").trim(),
                payloadSizeBytes: Number(value.payloadSizeBytes || value.payload_size_bytes || 0),
            };
        }

        async function fetchCuratedJsonPayload(config = {}) {
            if (!config.url) throw new Error("Curated story URL is missing.");
            const cacheKey = curatedPayloadCacheKey(config);
            app.publicLibraryCuratedPayloadCache ||= {};
            if (Object.hasOwn(app.publicLibraryCuratedPayloadCache, cacheKey))
                return app.publicLibraryCuratedPayloadCache[cacheKey];
            app.publicLibraryCuratedPayloadRequests ||= new Map();
            if (app.publicLibraryCuratedPayloadRequests.has(cacheKey))
                return app.publicLibraryCuratedPayloadRequests.get(cacheKey);
            const revision = config.revision
                ? `${config.url.includes("?") ? "&" : "?"}revision=${encodeURIComponent(config.revision)}`
                : "";
            const request = (async () => {
                const response = await fetchAfterResponseStart(`${config.url}${revision}`, { cache: "default" });
                if (!response.ok)
                    throw new Error(`Could not load curated content (${response.status}).`);
                const blob = await response.blob();
                if (config.payloadSizeBytes && blob.size !== config.payloadSizeBytes)
                    throw new Error(`Curated payload size mismatch. Expected ${config.payloadSizeBytes} bytes and received ${blob.size}.`);
                if (config.payloadSha256) {
                    const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
                    const actual = [...new Uint8Array(digest)]
                        .map((value) => value.toString(16).padStart(2, "0"))
                        .join("");
                    if (actual !== config.payloadSha256)
                        throw new Error("Curated payload hash verification failed.");
                }
                const payload = JSON.parse(await compressedJsonBlobText(blob, config.url));
                app.publicLibraryCuratedPayloadCache[cacheKey] = payload;
                return payload;
            })();
            app.publicLibraryCuratedPayloadRequests.set(cacheKey, request);
            const forgetRequest = () =>
                app.publicLibraryCuratedPayloadRequests.delete(cacheKey);
            request.then(forgetRequest, forgetRequest);
            return request;
        }

        async function fetchCuratedStoryPayload(manifestEntry = {}) {
            return fetchCuratedJsonPayload(curatedStoryManifestEntry(manifestEntry));
        }

        async function curatedPublicStoryEntry(manifestEntry = {}, group = "featured") {
            const config = curatedStoryManifestEntry(manifestEntry);
            const cacheKey = [
                "story",
                group,
                curatedPayloadCacheKey(config),
                config.storyId,
            ].join("|");
            app.publicLibraryCuratedEntryCache ||= {};
            if (Object.hasOwn(app.publicLibraryCuratedEntryCache, cacheKey))
                return app.publicLibraryCuratedEntryCache[cacheKey];
            const payload = await fetchCuratedStoryPayload(config);
            const template = storyTemplateRecordFromPayload(payload);
            const validation = validateStoryDefinition(template);
            if (!validation.ok)
                throw new Error(`Curated story is invalid: ${validationErrorsText(validation)}`);
            const templateId = String(template.id || "").trim();
            if (config.storyId && templateId !== config.storyId)
                throw new Error(`Expected story ${config.storyId}, but the hosted file contains ${templateId || "no story ID"}.`);
            const entry = {
                id: `curated:${group}:${templateId || safeUploadSlug(template.title || config.url)}`,
                type: "story-template",
                name: template.title || "Story",
                title: template.title || "Story",
                description: template.description || "",
                url: config.url,
                storyId: templateId,
                revision: config.revision,
                payload_sha256: config.payloadSha256,
                payload_size_bytes: config.payloadSizeBytes,
                image_url: storyTemplateTitleCardSrc(template),
                creator: template.creator || "EmberAdventures",
                creation_tool: template.creation_tool || "",
                source: template.source || "",
                genres: approvedGenreList(template.genres || template.state?.meta?.genres || []),
                curated: true,
            };
            app.publicLibraryCuratedEntryCache[cacheKey] = entry;
            return entry;
        }

        async function loadCuratedPublicStoryRails(root = $("modalBox")) {
            const groups = {
                featured: featuredContentStoryManifest("featured"),
                sandbox: featuredContentStoryManifest("sandbox"),
            };
            const seenAcrossRails = new Set();
            for (const [group, urls] of Object.entries(groups)) {
                const track = root?.querySelector?.(`[data-curated-story-rail="${group}"]`);
                if (!track) continue;
                if (!urls.length) {
                    track.innerHTML = `<div class="character-library-story-rail-card"><strong>No ${escapeHtml(group)} stories are configured yet.</strong></div>`;
                    continue;
                }
                const settled = await Promise.allSettled(urls.map((entry) => curatedPublicStoryEntry(entry, group)));
                const entries = [];
                for (const result of settled) {
                    if (
                        result.status !== "fulfilled" ||
                        seenAcrossRails.has(result.value.id) ||
                        !curatedPublicEntryMatchesActiveProfile(result.value)
                    )
                        continue;
                    seenAcrossRails.add(result.value.id);
                    entries.push(result.value);
                }
                app.publicLibraryCuratedEntries ||= {};
                for (const entry of entries) app.publicLibraryCuratedEntries[entry.id] = entry;
                const failures = settled.filter((result) => result.status === "rejected");
                track.innerHTML = [
                    ...entries.map((entry) => `<div class="character-library-story-rail-card curated-story-card">${publicStoryLibraryCardHtml(entry)}</div>`),
                    ...failures.map((result) => `<div class="character-library-story-rail-card curated-story-error"><strong>Story unavailable</strong><span>${escapeHtml(result.reason?.message || String(result.reason || "Could not load story."))}</span><button type="button" onclick="EmberAdventures.reloadCuratedPublicStoryRails()">Retry</button></div>`),
                ].join("") || `<div class="character-library-story-rail-card"><strong>No ${escapeHtml(group)} stories match the active profile.</strong></div>`;
            }
        }

        function reloadCuratedPublicStoryRails() {
            return loadCuratedPublicStoryRails($("modalBox"));
        }

        function storyLibraryReadonlyFilterSummary(value = "") {
            const list = publicTagListSlot(value);
            return list.length ? list.join(", ") : "All";
        }

        function storyLibraryAdvancedFiltersHtml(tab = "local") {
            return `
                <details class="state-branch character-library-filter-dropdown" data-story-library-filters="${escapeHtml(tab)}">
                    <summary>Filter Options</summary>
                    <div class="state-children">
                        <div class="character-library-filter-grid">
                            <label>Source
                                <input data-story-library-filter="source" placeholder="original, anime, game..." oninput="EmberAdventures.handleStoryLibraryFilterInput()">
                            </label>
                            <label>Creator
                                <input data-story-library-filter="creator" placeholder="creator name..." oninput="EmberAdventures.handleStoryLibraryFilterInput()">
                            </label>
                            <label>Creation tool
                                <input data-story-library-filter="creation_tool" placeholder="EmberAdventures Story Builder..." oninput="EmberAdventures.handleStoryLibraryFilterInput()">
                            </label>
                        </div>
                        <div class="character-library-filter-box">
                            <div class="character-library-filter-box-head">
                                <div class="character-library-filter-box-title">Genres</div>
                                <button type="button" onclick="EmberAdventures.openStoryLibraryFilterPicker('genres')">Choose Genres</button>
                            </div>
                            <div class="character-library-filter-list">
                                <input type="hidden" data-story-library-filter="genres" value="">
                                <div class="character-library-filter-summary" data-story-library-filter-summary="genres">All</div>
                            </div>
                        </div>
                    </div>
                </details>
            `;
        }

        function storyLibraryTabHtml(tab = "local") {
            const isPublic = tab === "public";
            const isMine = tab === "mine";
            const records = isPublic ? [] : storyLibrarySortRecords(storyLibraryTabRecords(tab), tab);
            const publicMineEntries = isMine
                ? storyLibrarySortPublicEntries(app.storyLibraryOwnedStoryEntries || [], "mine")
                : [];
            const cards = records.map(storyLibraryRecordHtml).join("");
            const publishedCards = publicMineEntries
                .map((entry) => publicStoryLibraryCardHtml(entry, { owned: true }))
                .join("");
            const resultHtml = isPublic
                ? `<div class="character-library-empty-state">Loading highest-rated public stories...</div>`
                : cards ||
                  `<p class="hint">${
                      isMine
                          ? "No stories belong to the selected creator yet."
                          : "No matching stories available yet."
                  }</p>`;
            const initialCount = records.length;
            return `
                <section class="character-library-tab-panel character-library-hide-content-badges" data-story-library-tab-panel="${escapeHtml(tab)}" ${tab === "public" ? "" : "hidden"}>
                    <div class="character-library-search-row">
                        <div class="character-library-search-box">
                            <input id="storyLibrarySearch-${escapeHtml(tab)}" type="search" placeholder="Story name..." data-story-library-name-search="${escapeHtml(tab)}" oninput="EmberAdventures.handleStoryLibraryFilterInput()" onkeydown="${isPublic ? "if(event.key==='Enter'){event.preventDefault(); EmberAdventures.runPublicStorySearch();}" : ""}">
                        </div>
                        <button type="button" class="character-library-filters-toggle" onclick="EmberAdventures.toggleStoryLibraryFilters(${htmlJsArg(tab)})">&#9656; Filters</button>
                        ${isPublic ? `<button class="primary" type="button" id="storyLibraryPublicSearchBtn" disabled onclick="EmberAdventures.runPublicStorySearch()">Search</button>` : ""}
                    </div>
                    ${storyLibraryAdvancedFiltersHtml(tab)}
                    ${isPublic ? storyLibraryPublicStoryRailsHtml() : ""}
                    <div class="character-library-count-sort-row">
                        <p class="character-library-count" id="storyLibrarySearchCount-${escapeHtml(tab)}">${isPublic ? "0 stories of 0 total" : libraryResultCountText(initialCount, initialCount, "story")}</p>
                        <div class="character-library-display-controls">
                            ${storyLibrarySortOptionsHtml(tab)}
                            ${storyLibraryCardSizeOptionsHtml()}
                        </div>
                    </div>
                    ${isPublic ? `<p class="character-library-search-hint" id="storyLibraryPublicSearchHint">Loading highest-rated public stories...</p>` : ""}
                    <div class="character-card-grid character-library-card-grid" data-story-library-results="${escapeHtml(tab)}">${resultHtml}</div>
                    ${isPublic ? `<div class="public-library-load-more-row"><button type="button" class="public-library-load-more" data-public-library-load-more="story" onclick="EmberAdventures.loadNextPublicLibraryPage('story')" hidden>Load More</button></div>` : ""}
                    ${isMine ? `<section class="library-published-section"><header><strong>Published</strong><button type="button" onclick="EmberAdventures.loadPublishedMineItems()">Load published stories</button></header><div class="character-card-grid character-library-card-grid" data-story-library-published-results="mine">${publishedCards || `<p class="hint">Load stories published by your signed-in account.</p>`}</div></section>` : ""}
                </section>
            `;
        }

        function openStoryTemplateLibraryLegacy(options = {}) {
            const inOnboarding = !!app.onboardingDraft;
            openModal(`
                <div class="character-library-shell card-size-${escapeHtml(storyLibraryCardSize())}">
                    <div class="character-library-header">
                        <div class="character-library-title-block">
                            <div class="character-library-title-icon" aria-hidden="true">&#128214;</div>
                            <div class="character-library-title-text">
                                <h2>Story Library</h2>
                                <p>Reusable story definitions. Edits do not change active saves.</p>
                            </div>
                        </div>
                        <div class="character-library-header-actions">
                            <button class="primary" type="button" onclick="EmberAdventures.openStoryCreationChoicePanel()"><span aria-hidden="true">+</span> Create Story</button>
                            <button class="blue" type="button" id="uploadStoryTemplateBtn"><span aria-hidden="true">&#8679;</span> Import Story</button>
                            ${inOnboarding ? `<button type="button" id="storyLibraryBackBtn">Back</button>` : ""}
                        </div>
                    </div>
                    ${inOnboarding ? renderOnboardingProgress("story_library") : ""}
                    <div class="tab-row" data-story-library-tabs>
                        <button class="active" type="button" data-story-library-tab="public" onclick="EmberAdventures.switchStoryLibraryTab('public')"><span aria-hidden="true">&#127760;</span> Public Stories</button>
                        <button type="button" data-story-library-tab="local" onclick="EmberAdventures.switchStoryLibraryTab('local')"><span aria-hidden="true">&#128421;</span> Local Stories</button>
                        <button type="button" data-story-library-tab="mine" onclick="EmberAdventures.switchStoryLibraryTab('mine')"><span aria-hidden="true">&#128100;</span> My Stories</button>
                    </div>
                    ${storyLibraryTabHtml("public")}
                    ${storyLibraryTabHtml("local")}
                    ${storyLibraryTabHtml("mine")}
                </div>
            `, {
                setupBlackout: inOnboarding,
                hideClose: inOnboarding,
                scrollKey: inOnboarding ? "setup:story_library" : "story_library",
            });
            const box = $("modalBox");
            if (box) {
                box.setAttribute("data-fullscreen-list-modal", "1");
                box.setAttribute("data-story-library-modal", "1");
                switchStoryLibraryTab(options.tab || app.storyLibraryLastTab || rememberedStoryLibraryTab("public"));
                initializeStoryLibraryFilters(box);
                bindStoryLibraryInfiniteScroll(box);
            }
            $("uploadStoryTemplateBtn").onclick = uploadStoryTemplate;
            if ($("storyLibraryBackBtn"))
                $("storyLibraryBackBtn").onclick = () => {
                    if (app.onboardingDraft) {
                        app.onboardingDraft.step = (app.userProfiles || []).length ? -2 : -1;
                        renderOnboardingStep();
                    } else {
                        closeModal();
                    }
                };
        }

        function unifiedLibraryType() {
            return $("modalBox")?.querySelector?.("[data-library-home]")?.dataset.libraryType || "story";
        }

        function unifiedLibraryTab() {
            return $("modalBox")?.querySelector?.("[data-library-source].active")?.dataset.librarySource || "public";
        }







        function refreshUnifiedLibraryAfterProfileChange() {
            const root = $("modalBox")?.querySelector?.("[data-library-home]");
            if (!root) return;
            const type = unifiedLibraryType();
            const tab = unifiedLibraryTab();
            const current = root.querySelector(".library-profile-button");
            if (current) current.replaceWith(unifiedLibraryProfileControl());
            if (type === "character") {
                renderCharacterLibraryOwnedPublicCharacters();
                loadCuratedPublicCharacterRail($("modalBox"));
                for (const localTab of ["local", "mine"])
                    refreshCharacterLibraryActiveTabCards({
                        tab: localTab,
                        allowHidden: true,
                        immediateSmall: true,
                    });
            } else {
                loadCuratedPublicStoryRails($("modalBox"));
                for (const localTab of ["local", "mine"])
                    refreshStoryLibraryActiveTabCards({
                        tab: localTab,
                        allowHidden: true,
                        immediateSmall: true,
                    });
            }
            fitUnifiedLibraryProfileButton(root);
            if (tab === "public") {
                if (type === "character") {
                    const panel = root.querySelector(
                        '[data-character-library-tab-panel="public"]',
                    );
                    const results = panel?.querySelector?.(
                        '[data-character-library-results="public"]',
                    );
                    const loaded = (app.characterLibraryPublicSearch?.items || []).filter(
                        curatedPublicEntryMatchesActiveProfile,
                    );
                    if (results) {
                        results.innerHTML = loaded.length
                            ? loaded.map(publicCharacterLibraryCardHtml).join("")
                            : '<div class="character-library-empty-state">No public characters matched that search.</div>';
                        bindCharacterLibraryCardActions(results);
                        scheduleAutosizeLibraryCardText(results);
                    }
                } else {
                    const panel = root.querySelector(
                        '[data-story-library-tab-panel="public"]',
                    );
                    const results = panel?.querySelector?.(
                        '[data-story-library-results="public"]',
                    );
                    const loaded = (app.storyLibraryPublicSearch?.items || []).filter(
                        curatedPublicEntryMatchesActiveProfile,
                    );
                    if (results) {
                        results.innerHTML = loaded.length
                            ? loaded.map(publicStoryLibraryCardHtml).join("")
                            : '<div class="character-library-empty-state">No public stories matched that search.</div>';
                        scheduleAutosizeLibraryCardText(results);
                    }
                }
            }
            updateUnifiedLibraryResultLabel();
            return null;
        }

        function unifiedLibraryCardSize(type = unifiedLibraryType()) {
            return type === "character" ? characterLibraryCardSize() : storyLibraryCardSize();
        }

        function unifiedLibraryViewportAspect() {
            const width = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
            const height = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
            return width / height;
        }

        function unifiedLibraryLegacyBaseColumns(type = unifiedLibraryType()) {
            const size = type === "character" ? characterLibraryCardSize() : storyLibraryCardSize();
            return { tiny: 10, small: 8, medium: 6, large: 4, huge: 2 }[size] || 6;
        }

        function unifiedLibraryColumnDensity(type = unifiedLibraryType()) {
            const key = type === "character" ? "characterLibraryColumnDensity" : "storyLibraryColumnDensity";
            const stored = Number(app.settings?.[key]);
            return Number.isFinite(stored) && stored > 0
                ? stored
                : unifiedLibraryLegacyBaseColumns(type);
        }

        function unifiedLibraryColumnCount(type = unifiedLibraryType(), aspect = unifiedLibraryViewportAspect()) {
            const maximum = Math.max(1, Math.floor(20 * aspect));
            return Math.min(maximum, Math.max(1, Math.round(unifiedLibraryColumnDensity(type) * aspect)));
        }

        function setUnifiedLibraryColumns(value) {
            const root = $("modalBox")?.querySelector?.("[data-library-home]");
            if (!root) return;
            const type = unifiedLibraryType();
            const aspect = unifiedLibraryViewportAspect();
            const maximum = Math.max(1, Math.floor(20 * aspect));
            const columns = Math.min(maximum, Math.max(1, Math.round(Number(value) || 1)));
            const densityKey = type === "character" ? "characterLibraryColumnDensity" : "storyLibraryColumnDensity";
            const columnsKey = type === "character" ? "characterLibraryColumns" : "storyLibraryColumns";
            app.settings[densityKey] = columns / aspect;
            app.settings[columnsKey] = columns;
            root.style.setProperty("--library-columns", String(columns));
            root.querySelectorAll(`[data-library-columns-input="${type}"]`).forEach((input) => { input.value = String(columns); });
            fitUnifiedLibraryHeaderBrand(root);
            fitUnifiedLibraryProfileButton(root);
            scheduleAutosizeLibraryCardText(root);
            saveSettingsNow(`${type} library columns changed`);
        }

        function stepUnifiedLibraryColumns(amount = 0) {
            const input = $("modalBox")?.querySelector?.(`[data-library-columns-input="${unifiedLibraryType()}"]`);
            const current = Math.max(1, Math.round(Number(input?.value) || unifiedLibraryColumnCount()));
            setUnifiedLibraryColumns(Math.max(1, current + Math.sign(Number(amount) || 0)));
        }

        function unifiedLibraryProfileControl() {
            const profile = activeUserProfile();
            const control = document.createElement("button");
            control.type = "button";
            control.className = "library-profile-button";
            control.title = profile?.name || "User Profiles";
            control.setAttribute("aria-label", `Profiles: ${profile?.name || "No profile"}`);
            control.setAttribute("onclick", "EmberAdventures.openMainMenuProfiles()");
            const name = document.createElement("strong");
            name.textContent = profile?.name || "No Profile";
            const label = document.createElement("small");
            label.textContent = "Preferences";
            control.append(name, label);
            return control;
        }

        function unifiedLibraryProfileHtml() {
            return unifiedLibraryProfileControl().outerHTML;
        }

        function unifiedLibraryAccountHtml() {
            const avatarUrl = publicAccountAvatarUrl();
            const label = supabaseSignedInUser?.() ? "Google account signed in" : "Google account";
            return `<button type="button" class="library-icon-button library-account-button" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" onclick="EmberAdventures.openPublicLibraryAccountModal()">${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="">` : "&#128100;"}</button>`;
        }

        function unifiedLibraryHeaderHtml(type = "story") {
            const character = type === "character";
            return `<header class="library-home-header">
                <div class="library-home-brand"><strong>Ember Adventures <em>Alpha</em></strong><span>AI RPG Stories</span></div>
                <nav class="library-kind-tabs" aria-label="Library type">
                    <button type="button" class="${character ? "" : "active"}" onclick="EmberAdventures.switchUnifiedLibraryType('story')">&#128214; Stories</button>
                    <button type="button" class="${character ? "active" : ""}" onclick="EmberAdventures.switchUnifiedLibraryType('character')">&#128100; Characters</button>
                </nav>
                <div class="library-header-actions ${character ? "character-actions" : "story-actions"}">
                    ${character
                        ? `<button type="button" class="library-icon-button library-create-action-button primary" title="Create character" aria-label="Create character" onclick="EmberAdventures.openCharacterCreationChoicePanel()"><span aria-hidden="true">+</span><span class="label">Create Character</span></button>`
                        : `<button type="button" class="library-icon-button library-create-action-button primary" title="Create story" aria-label="Create story" onclick="EmberAdventures.openStoryCreationChoicePanel()"><span aria-hidden="true">+</span><span class="label">Create Story</span></button>`}
                    <button type="button" class="library-icon-button blue" title="Import ${character ? "character" : "story"}" aria-label="Import ${character ? "character" : "story"}" onclick="${character ? "EmberAdventures.importCharacterDefinitions()" : "EmberAdventures.uploadStoryTemplate()"}">&#8679;</button>
                    ${unifiedLibraryAccountHtml()}
                    ${unifiedLibraryProfileHtml()}
                    <button type="button" class="library-icon-button" title="Settings" aria-label="Settings" onclick="EmberAdventures.openSettingsModal()">&#9881;</button>
                    <button type="button" class="library-icon-button primary" title="Main menu" aria-label="Main menu" onclick="EmberAdventures.openMainMenu()">&#8962;</button>
                </div>
            </header>`;
        }

        function unifiedLibraryToolbarHtml(type = "story", tab = "public") {
            const character = type === "character";
            const sort = character ? characterLibrarySortOptionsHtml(tab) : storyLibrarySortOptionsHtml(tab);
            const size = character ? characterLibraryCardSizeOptionsHtml() : storyLibraryCardSizeOptionsHtml();
            return `<div class="library-toolbar">
                <nav class="library-source-tabs" aria-label="Library source">
                    ${[["public","&#127760; Public"],["local","&#128193; Local"],["mine","&#128100; Mine"]].map(([value,label]) => `<button type="button" class="${tab === value ? "active" : ""}" data-library-source="${value}" onclick="EmberAdventures.switchUnifiedLibraryTab('${value}')">${label}</button>`).join("")}
                </nav>
                ${unifiedLibraryMineCreatorHtml(tab)}
                <input type="search" data-unified-library-search placeholder="Search ${character ? "characters" : "stories"}..." ${tab === "public" ? `onkeydown="if(event.key==='Enter'){event.preventDefault();EmberAdventures.runUnifiedLibraryPublicSearch();}"` : ""}>
                ${tab === "public" ? `<button type="button" class="primary library-public-search-button" data-unified-library-public-search disabled onclick="EmberAdventures.runUnifiedLibraryPublicSearch()">Search</button>` : ""}
                <button type="button" class="library-filter-toggle" onclick="EmberAdventures.toggleUnifiedLibraryFilters()"><span data-library-filter-arrow>&#9656;</span> Filters</button>
                ${sort}
                ${size}
            </div>`;
        }

        function unifiedLibraryMineCreatorHtml(tab = "public") {
            if (tab !== "mine") return "";
            const selectedId = mineCreatorIdentityId();
            return `<div class="library-mine-controls">
                <label>Creator
                    <select data-mine-creator-select onchange="EmberAdventures.setMineCreatorIdentity(this.value)">
                        <option value="">Any</option>${creatorIdentityOptionsHtml(selectedId)}
                    </select>
                </label>
            </div>`;
        }

        function unifiedLibraryFilterHtml(type = "story") {
            const noun = type === "character" ? "character" : "story";
            const publicTab = unifiedLibraryTab() === "public";
            return `<section class="library-filter-panel" aria-label="Filters">
                <div class="library-filter-grid">
                    ${publicTab ? "" : `<label>Source<input data-unified-library-text-filter="source" placeholder="Any source" oninput="EmberAdventures.setUnifiedLibraryTextFilter('source',this.value)"></label>`}
                    <label>Creator<input data-unified-library-text-filter="creator" placeholder="Any creator" oninput="EmberAdventures.setUnifiedLibraryTextFilter('creator',this.value)"></label>
                    <label>Creation tool<input data-unified-library-text-filter="creation_tool" placeholder="Any tool" oninput="EmberAdventures.setUnifiedLibraryTextFilter('creation_tool',this.value)"></label>
                    ${("")}
                    <label>Genres<button type="button" onclick="EmberAdventures.openUnifiedLibraryPicker('genres')">Choose genres</button></label>
                    ${("")}
                </div>
                <div class="library-filter-actions"><button type="button" onclick="EmberAdventures.clearUnifiedLibraryFilters()">Clear</button><button type="button" class="primary" onclick="EmberAdventures.toggleUnifiedLibraryFilters()">Apply</button></div>
            </section>`;
        }

        function openUnifiedLibrary(options = {}) {
            const type = options.type === "character" ? "character" : "story";
            const tab = ["public", "local", "mine"].includes(options.tab) ? options.tab : (type === "character" ? app.characterLibraryLastTab : app.storyLibraryLastTab) || "public";
            const panels = type === "character"
                ? characterLibraryTabHtml("public") + characterLibraryTabHtml("local", tab !== "local") + characterLibraryTabHtml("mine", tab !== "mine")
                : storyLibraryTabHtml("public") + storyLibraryTabHtml("local") + storyLibraryTabHtml("mine");
            const returnsToMainMenu =
                options.returnToMainMenuOnEscape === true ||
                options.fromMainMenu === true ||
                options.skipBack === true;
            openModal(`<main class="library-home card-size-${escapeHtml(unifiedLibraryCardSize(type))}" data-library-home data-library-type="${type}"${returnsToMainMenu ? ' data-library-return-to-main-menu="1"' : ""}>
                ${unifiedLibraryHeaderHtml(type)}
                ${unifiedLibraryToolbarHtml(type, tab)}
                ${unifiedLibraryFilterHtml(type)}
                <section class="library-results"><div class="library-results-summary"><span>${type === "character" ? "Characters" : "Stories"}</span><span data-library-result-label></span></div>${panels}</section>
            </main>`, {
                hideClose: true,
                scrollKey: `unified-library:${type}:${tab}`,
                ...(returnsToMainMenu ? { closeDestination: "main-menu" } : {}),
            });
            const box = $("modalBox");
            if (!box) return;
            box.setAttribute("data-fullscreen-list-modal", "1");
            box.setAttribute(type === "character" ? "data-character-library-modal" : "data-story-library-modal", "1");
            restoreUnifiedLibrarySearchState(type, tab, box);
            const unifiedSearch = box.querySelector("[data-unified-library-search]");
            unifiedSearch?.addEventListener("input", (event) => {
                handleUnifiedLibrarySearch(event.currentTarget?.value || "");
            });
            if (type === "character") {
                switchCharacterLibraryTab(tab);
                initializeCharacterLibraryFilters(box);
                bindCharacterLibraryCardActions(box);
                bindCharacterLibraryInfiniteScroll(box);
                loadCuratedPublicCharacterRail(box);
                if (tab === "public") runPublicCharacterSearchPage({ reset: true });
            } else {
                switchStoryLibraryTab(tab);
                initializeStoryLibraryFilters(box);
                bindStoryLibraryInfiniteScroll(box);
                loadCuratedPublicStoryRails(box);
                if (tab === "public") runPublicStorySearchPage({ reset: true });
            }
            updateUnifiedLibraryResultLabel();
            "";
            bindUnifiedLibraryResponsiveSizing();
        }

        function restoreUnifiedLibrarySearchState(type = "story", tab = "public", box = $("modalBox")) {
            if (!box || tab !== "public") return;
            const character = type === "character";
            const searchState = character
                ? app.characterLibraryPublicSearch
                : app.storyLibraryPublicSearch;
            const filters = searchState?.filters;
            if (!filters) return;
            const prefix = character ? "character" : "story";
            const panel = box.querySelector(`[data-${prefix}-library-tab-panel="public"]`);
            if (!panel) return;
            const search = String(filters.search || "");
            const unifiedSearch = box.querySelector("[data-unified-library-search]");
            const panelSearch = panel.querySelector(`[data-${prefix}-library-name-search="public"]`);
            if (unifiedSearch) unifiedSearch.value = search;
            if (panelSearch) panelSearch.value = search;
            for (const input of panel.querySelectorAll(`[data-${prefix}-library-filter]`)) {
                const key = input.dataset[`${prefix}LibraryFilter`];
                const filterKey = key;
                if (input.type === "checkbox") input.checked = filters[filterKey] === "true";
                else input.value = String(filters[filterKey] || "");
            }
            for (const key of ["source", "creator", "creation_tool"]) {
                const input = box.querySelector(`[data-unified-library-text-filter="${key}"]`);
                if (input) input.value = String(filters[key] || "");
            }
        }

        function openStoryTemplateLibrary(options = {}) { return openUnifiedLibrary({ ...options, type: "story" }); }
        function openCharacterLibraryModal(options = {}) { return openUnifiedLibrary({ ...options, type: "character" }); }

        function switchUnifiedLibraryType(type) {
            openUnifiedLibrary({
                type,
                tab: unifiedLibraryTab(),
                returnToMainMenuOnEscape:
                    $("modalBox")?.querySelector?.("[data-library-return-to-main-menu='1']") != null,
            });
        }

        function switchUnifiedLibraryTab(tab) {
            const type = unifiedLibraryType();
            openUnifiedLibrary({ type, tab });
        }

        function loadPublishedMineItems() {
            if (!supabaseSessionAccessToken()) {
                openPublicLibraryAccountModal();
                return Promise.resolve(null);
            }
            if (unifiedLibraryType() === "character")
                return refreshCharacterLibraryOwnedPublicCharacters({ force: true });
            return refreshStoryLibraryOwnedPublicStories({ force: true });
        }

        function toggleUnifiedLibraryFilters() {
            const root = $("modalBox")?.querySelector?.("[data-library-home]");
            if (!root) return;
            const open = root.classList.toggle("filters-open");
            const arrow = root.querySelector("[data-library-filter-arrow]");
            if (arrow) arrow.innerHTML = open ? "&#9662;" : "&#9656;";
        }

        function handleUnifiedLibrarySearch(value = "") {
            const type = unifiedLibraryType();
            const tab = unifiedLibraryTab();
            const selector = type === "character" ? `[data-character-library-name-search="${tab}"]` : `[data-story-library-name-search="${tab}"]`;
            const input = $("modalBox")?.querySelector?.(selector);
            if (input) input.value = value;
            if (type === "character") handleCharacterLibraryFilterInput();
            else handleStoryLibraryFilterInput();
            updateUnifiedLibraryResultLabel();
        }

        async function runUnifiedLibraryPublicSearch() {
            if (unifiedLibraryTab() !== "public") return;
            const button = $("modalBox")?.querySelector?.("[data-unified-library-public-search]");
            if (button) button.disabled = true;
            if (unifiedLibraryType() === "character") await runPublicCharacterSearch();
            else await runPublicStorySearch();
            updateUnifiedLibraryResultLabel();
        }

        function setUnifiedLibraryTextFilter(key, value) {
            const type = unifiedLibraryType();
            const prefix = type === "character" ? "character" : "story";
            const panel = $("modalBox")?.querySelector?.(`[data-${prefix}-library-tab-panel="${unifiedLibraryTab()}"]`);
            let input = panel?.querySelector?.(`[data-${prefix}-library-filter="${key}"]`);
            if (!input && panel && ["creator", "source", "creation_tool"].includes(key)) {
                input = document.createElement("input");
                input.type = "hidden";
                input.setAttribute(`data-${prefix}-library-filter`, key);
                panel.append(input);
            }

            if (input) input.value = value;
            if (type === "character") handleCharacterLibraryFilterInput();
            else handleStoryLibraryFilterInput();
            updateUnifiedLibraryResultLabel();
        }



        function toggleUnifiedLibraryContentFilter(mode) {
            const root = $("modalBox")?.querySelector?.("[data-library-home]");
            const buttons = [...(root?.querySelectorAll?.("[data-library-content]") || [])];
            const clicked = buttons.find((button) => button.dataset.libraryContent === mode);
            if (!clicked) return;
            const active = new Set(buttons.filter((button) => button.classList.contains("active")).map((button) => button.dataset.libraryContent));
            if (active.has(mode) && active.size === 1) return;
            if (active.has(mode)) active.delete(mode);
            else active.add(mode);
            const filter = active.size === 2 ? "both" : [...active][0] || "both";
            "";
        }



        function openUnifiedLibraryPicker(key) {
            if (unifiedLibraryType() === "character") openCharacterLibraryFilterPicker(key);
            else openStoryLibraryFilterPicker(key);
        }



















        function clearUnifiedLibraryFilters() {
            const root = $("modalBox");
            root?.querySelectorAll?.(".library-filter-panel input, [data-character-library-filter], [data-story-library-filter]").forEach(input => { input.value = ""; });
            for (const key of ["source", "creator", "creation_tool"]) setUnifiedLibraryTextFilter(key, "");
            const type = unifiedLibraryType();
            const tab = unifiedLibraryTab();
            const panel = root?.querySelector?.("[data-" + type + "-library-tab-panel='" + tab + "']");
            if (type === "character") {
                updateCharacterLibraryFilterSummary(panel, "genres");
                handleCharacterLibraryFilterInput();
            }
            else {
                updateStoryLibraryFilterSummary(panel, "genres");
                handleStoryLibraryFilterInput();
            }
        }

        function updateUnifiedLibraryResultLabel() {
            const root = $("modalBox");
            const type = unifiedLibraryType();
            const tab = unifiedLibraryTab();
            const label = root?.querySelector?.("[data-library-result-label]");
            const results = root?.querySelector?.(`[data-${type}-library-results="${tab}"]`);
            const cardSelector =
                type === "character"
                    ? "[data-character-library-card]"
                    : "[data-story-library-card]";
            const cards = [...(results?.querySelectorAll?.(cardSelector) || [])];
            const visible = cards.filter((card) => !card.hidden).length;
            const searchState = type === "character"
                ? app.characterLibraryPublicSearch
                : app.storyLibraryPublicSearch;
            const total = tab === "public" && Number.isSafeInteger(searchState?.total)
                ? searchState.total
                : cards.length;
            if (label) label.textContent = `${visible}/${total} shown`;
        }

        function updateUnifiedLibraryResponsiveSizing(root = $("modalBox")?.querySelector?.("[data-library-home]")) {
            if (!root) return;
            const width = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
            const height = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
            const type = root.dataset.libraryType === "character" ? "character" : "story";
            const columns = unifiedLibraryColumnCount(type, width / height);
            const columnsKey = type === "character" ? "characterLibraryColumns" : "storyLibraryColumns";
            const changed = Number(app.settings?.[columnsKey]) !== columns;
            app.settings[columnsKey] = columns;
            root.style.setProperty("--library-columns", String(columns));
            root.querySelectorAll(`[data-library-columns-input="${type}"]`).forEach((input) => { input.value = String(columns); });
            if (changed) {
                clearTimeout(app.unifiedLibraryColumnsSaveTimer);
                app.unifiedLibraryColumnsSaveTimer = setTimeout(() => {
                    app.unifiedLibraryColumnsSaveTimer = null;
                    saveSettingsNow(`${type} library columns adjusted for viewport`);
                }, 250);
            }
            fitUnifiedLibraryHeaderBrand(root);
            fitUnifiedLibraryProfileButton(root);
            scheduleAutosizeLibraryCardText(root);
        }

        function fitSingleLineLibraryText(line, available, maximum, minimum) {
            if (!line || available <= 0) return;
            // One canvas measurement avoids repeated style-write/layout-read loops.
            const canvas = fitSingleLineLibraryText.canvas ||
                (fitSingleLineLibraryText.canvas = document.createElement("canvas"));
            const context = canvas.getContext("2d");
            const style = getComputedStyle(line);
            if (!context) return;
            context.font = `${style.fontStyle} ${style.fontWeight} ${maximum}px ${style.fontFamily}`;
            const measured = context.measureText(line.textContent || "").width || available;
            const size = measured > available
                ? Math.max(minimum, maximum * available / measured)
                : maximum;
            line.style.fontSize = `${size}px`;
        }

        function fitUnifiedLibraryHeaderBrand(root = $("modalBox")?.querySelector?.("[data-library-home]")) {
            const brand = root?.querySelector?.(".library-home-brand");
            const title = brand?.querySelector?.("strong");
            if (!brand || !title) return;
            const actionSize = root.querySelector(".library-icon-button")?.clientWidth || 42;
            const maxSize = Math.min(29.6, actionSize * 0.705);
            const minSize = 0.5;
            const available = Math.max(1, brand.clientWidth);
            const key = `${available}|${actionSize}|${title.textContent || ""}`;
            if (brand.dataset.fitKey === key) return;
            brand.dataset.fitKey = key;
            fitSingleLineLibraryText(title, available, maxSize, minSize, 0.5);
        }

        function fitUnifiedLibraryProfileButton(root = $("modalBox")?.querySelector?.("[data-library-home]")) {
            const button = root?.querySelector?.(".library-profile-button");
            if (!button) return;
            button.querySelectorAll("strong,small").forEach((line) => {
                const available = Math.max(1, line.clientWidth);
                const key = `${available}|${line.textContent || ""}`;
                if (line.dataset.fitKey === key) return;
                line.dataset.fitKey = key;
                line.style.fontSize = "";
                const size = Number.parseFloat(getComputedStyle(line).fontSize) || 10;
                fitSingleLineLibraryText(line, available, size, 0.5, 0.25);
            });
        }

        function bindUnifiedLibraryResponsiveSizing() {
            const root = $("modalBox")?.querySelector?.("[data-library-home]");
            if (app.unifiedLibraryResizeHandler)
                window.removeEventListener("resize", app.unifiedLibraryResizeHandler);
            if (!root) return;
            updateUnifiedLibraryResponsiveSizing(root);
            requestAnimationFrame(() => {
                fitUnifiedLibraryHeaderBrand(root);
                fitUnifiedLibraryProfileButton(root);
            });
            app.unifiedLibraryResizeHandler = () => {
                cancelAnimationFrame(app.unifiedLibraryResizeFrame || 0);
                app.unifiedLibraryResizeFrame = requestAnimationFrame(() => {
                    if (root.isConnected) updateUnifiedLibraryResponsiveSizing(root);
                });
            };
            window.addEventListener("resize", app.unifiedLibraryResizeHandler, { passive: true });
        }

        function initializeStoryLibraryFilters(box = $("modalBox")) {
            box?.querySelectorAll?.("[data-story-library-tab-panel]").forEach(panel => {
                updateStoryLibraryFilterSummary(panel, "genres");
                updateStoryLibraryFilterToggle(panel.dataset.storyLibraryTabPanel || "");
            });
        }

        function bindStoryLibraryInfiniteScroll(box = $("modalBox")) {
            if (!box) return;
            bindPublicLibraryScrollPagination(
                box,
                "story",
                () => storyLibraryActiveTab() === "public",
                () => runPublicStorySearchPage({ reset: false }),
            );
        }

        function publicLibraryAtScrollBottom(box = $("modalBox")) {
            if (!box) return false;
            return box.scrollHeight - box.scrollTop - box.clientHeight <= 2;
        }

        function updatePublicLibraryLoadMoreButton(type = "story") {
            const character = type === "character";
            const searchState = character
                ? app.characterLibraryPublicSearch
                : app.storyLibraryPublicSearch;
            const button = $("modalBox")?.querySelector?.(
                `[data-public-library-load-more="${cssEscape(character ? "character" : "story")}"]`,
            );
            if (!button) return;
            const loading = searchState?.loading === true && searchState?.items?.length > 0;
            button.hidden = !searchState?.hasNext && !loading;
            button.disabled = loading;
            button.setAttribute("aria-busy", loading ? "true" : "false");
            button.innerHTML = loading
                ? `<span class="loading-spinner" aria-hidden="true"></span><span>Loading...</span>`
                : escapeHtml(searchState?.paginationError ? "Retry" : "Load More");
        }

        function bindLibraryDownwardInputHandlers(box, handlers = {}) {
            let previousScrollTop = box.scrollTop;
            let touchY = null;
            box.addEventListener("scroll", () => {
                const currentScrollTop = box.scrollTop;
                if (currentScrollTop > previousScrollTop)
                    handlers.onDownwardScroll?.();
                previousScrollTop = currentScrollTop;
            }, { passive: true });
            box.addEventListener("wheel", (event) => {
                if (event.deltaY > 0) handlers.onDownwardAttempt?.();
            }, { passive: true });
            box.addEventListener("keydown", (event) => {
                if (event.target?.matches?.("input, textarea, select, [contenteditable='true']"))
                    return;
                if (event.key === " " && event.target?.matches?.("button")) return;
                if (["ArrowDown", "PageDown", "End", " "].includes(event.key))
                    handlers.onDownwardAttempt?.();
            });
            box.addEventListener("touchstart", (event) => {
                touchY = event.touches?.[0]?.clientY ?? null;
            }, { passive: true });
            box.addEventListener("touchmove", (event) => {
                const currentY = event.touches?.[0]?.clientY ?? null;
                if (touchY !== null && currentY !== null && currentY < touchY)
                    handlers.onDownwardAttempt?.();
                touchY = currentY;
            }, { passive: true });
        }

        function bindVirtualLibraryScrollPagination(box, key) {
            if (!box) return;
            const state = virtualLibraryState(key);
            if (state.boundHosts.has(box)) return;
            state.boundHosts.add(box);
            bindLibraryDownwardInputHandlers(box, {
                onDownwardScroll: () => {
                    const currentState = virtualLibraryState(key);
                    if (
                        characterLibraryActiveTab() !== key.split(":")[1] ||
                        currentState.loading ||
                        currentState.rendered >= currentState.records.length
                    )
                        return;
                    if (publicLibraryAtScrollBottom(box)) currentState.bottomReached = true;
                },
                onDownwardAttempt: () => {
                    const currentState = virtualLibraryState(key);
                    if (
                        characterLibraryActiveTab() !== key.split(":")[1] ||
                        currentState.loading ||
                        currentState.rendered >= currentState.records.length
                    )
                        return;
                    if (!publicLibraryAtScrollBottom(box)) return;
                    if (!currentState.bottomReached) {
                        currentState.bottomReached = true;
                        return;
                    }
                    currentState.bottomReached = false;
                    currentState.appendMore?.();
                },
            });
        }

        function loadNextPublicLibraryPage(type = "story") {
            const character = type === "character";
            const searchState = character
                ? app.characterLibraryPublicSearch
                : app.storyLibraryPublicSearch;
            if (!searchState?.hasNext || searchState.loading) return Promise.resolve(null);
            searchState.paginationError = false;
            updatePublicLibraryLoadMoreButton(character ? "character" : "story");
            return character
                ? runPublicCharacterSearchPage({ reset: false })
                : runPublicStorySearchPage({ reset: false });
        }

        function bindPublicLibraryScrollPagination(box, type, isActive, loadNextPage) {
            const requestAtBottom = () => {
                if (!isActive() || !publicLibraryAtScrollBottom(box)) return;
                loadNextPage();
            };
            bindLibraryDownwardInputHandlers(box, {
                onDownwardScroll: requestAtBottom,
                onDownwardAttempt: requestAtBottom,
            });
        }

        function storyLibraryActiveTab() {
            return (
                $("modalBox")?.querySelector?.("[data-library-home][data-library-type=\"story\"] [data-library-source].active")
                    ?.dataset.librarySource ||
                $("modalBox")?.querySelector?.("[data-story-library-tab].active")
                    ?.dataset.storyLibraryTab || "public"
            );
        }

        function rememberedStoryLibraryTab(fallback = "public") {
            const active = storyLibraryActiveTab();
            return ["public", "local", "mine"].includes(active)
                ? active
                : ["public", "local", "mine"].includes(fallback)
                  ? fallback
                  : "public";
        }

        function switchStoryLibraryTab(tab = "public") {
            const box = $("modalBox");
            if (!box) return;
            app.storyLibraryLastTab = ["public", "local", "mine"].includes(tab)
                ? tab
                : "public";
            box.querySelectorAll("[data-story-library-tab]").forEach((button) => {
                button.classList.toggle("active", button.dataset.storyLibraryTab === tab);
            });
            box.querySelectorAll("[data-story-library-tab-panel]").forEach((panel) => {
                panel.hidden = panel.dataset.storyLibraryTabPanel !== tab;
            });
            updateStoryLibraryFilterToggle(tab);
            filterStoryTemplateLibraryModal();
            queueFirstVisibleStoryLibraryMissingTitleCard();
            scheduleAutosizeLibraryCardText(box);
        }

        async function refreshStoryLibraryOwnedPublicStories(options = {}) {
            const panel = document.querySelector(`[data-story-library-tab-panel="mine"]`);
            if (!panel || panel.hidden) return;
            const results = panel.querySelector(`[data-story-library-published-results="mine"]`);
            const count = $("storyLibrarySearchCount-mine");
            if (!supabaseSessionAccessToken()) {
                app.storyLibraryOwnedStoryEntries = [];
                refreshStoryLibraryActiveTabCards();
                return;
            }
            if (app.storyLibraryOwnedStoriesLoading) return;
            app.storyLibraryOwnedStoriesLoading = true;
            if (results && !results.querySelector("[data-story-library-card]")) {
                results.innerHTML = `<div class="character-library-empty-state">Loading your published stories...</div>`;
            }
            try {
                const ownedItems = [];
                const pageSize = 50;
                for (let page = 0; page < 20; page += 1) {
                    const index = await fetchOwnedPublicLibraryIndex({
                        mode: "stories",
                        pageSize,
                        page,
                    });
                    ownedItems.push(
                        ...(index.items || []).filter(
                            (entry) => entry.type === "story-template",
                        ),
                    );
                    if ((index.items || []).length < pageSize) break;
                }
                app.storyLibraryOwnedStoryEntries = ownedItems;
                app.publicLibraryLastIndex = mergePublicLibraryIndexItems(
                    app.publicLibraryLastIndex || publicLibraryEmptyIndex(),
                    app.storyLibraryOwnedStoryEntries,
                );
                if (results) {
                    results.innerHTML = storyLibrarySortPublicEntries(
                        app.storyLibraryOwnedStoryEntries,
                        "mine",
                    )
                        .map((entry) => publicStoryLibraryCardHtml(entry, { owned: true }))
                        .join("");
                }
                refreshStoryLibraryActiveTabCards();
            } catch (err) {
                if (devSmokeSuiteState().running) throw err;
                if (results)
                    results.innerHTML = `<div class="character-library-empty-state">Could not load your published stories: ${escapeHtml(err.message || String(err))}</div>`;
                if (count) count.textContent = libraryResultCountText(0, 0, "story");
                log("My Stories public fetch failed", err.message || String(err), {
                    type: "system",
                    level: "warn",
                });
            } finally {
                app.storyLibraryOwnedStoriesLoading = false;
            }
        }

        function updateStoryLibraryFilterToggle(tab = storyLibraryActiveTab()) {
            const panel = document.querySelector(
                `[data-story-library-tab-panel="${cssEscape(tab)}"]`,
            );
            const details = panel?.querySelector?.("[data-story-library-filters]");
            const button = panel?.querySelector?.(".character-library-filters-toggle");
            if (!button) return;
            button.innerHTML = `${details?.open ? "&#9662;" : "&#9656;"} Filters`;
        }

        function toggleStoryLibraryFilters(tab = storyLibraryActiveTab()) {
            const panel = document.querySelector(
                `[data-story-library-tab-panel="${cssEscape(tab)}"]`,
            );
            const details = panel?.querySelector?.("[data-story-library-filters]");
            if (!details) return;
            details.open = !details.open;
            updateStoryLibraryFilterToggle(tab);
        }



        function updateStoryLibraryFilterSummary(panel, filter = "") {
            const summary = panel?.querySelector?.(
                `[data-story-library-filter-summary="${cssEscape(filter)}"]`,
            );
            if (!summary) return;
            const input = panel.querySelector?.(`[data-story-library-filter="${cssEscape(filter)}"]`);
            summary.textContent = storyLibraryReadonlyFilterSummary(input?.value || "");
        }

        function storyLibraryFilterListValue(filter = "", tab = storyLibraryActiveTab()) {
            const panel = document.querySelector(
                `[data-story-library-tab-panel="${cssEscape(tab)}"]`,
            );
            const input = panel?.querySelector?.(`[data-story-library-filter="${cssEscape(filter)}"]`);
            return publicTagListSlot(input?.value || "");
        }

        function openStoryLibraryFilterPicker(kind = "genres") {
            return openLibraryGenrePicker("story");
        }

        function toggleStoryLibraryFilterPickerOption(button) {
            button?.classList?.toggle("active");
        }

        function filterStoryLibraryFilterPicker(query = "") {
            const tokens = searchTokens(query);
            document.querySelectorAll("[data-story-library-picker-option]").forEach((button) => {
                button.hidden = !matchesSearchTokens(button.textContent || "", tokens);
            });
        }

        function saveStoryLibraryFilterPicker(filter = "genres") {
            const picker = document.querySelector(`[data-story-library-picker="${cssEscape(filter)}"]`);
            const tab = picker?.dataset.storyLibraryPickerTab || storyLibraryActiveTab();
            const panel = document.querySelector(
                `[data-story-library-tab-panel="${cssEscape(tab)}"]`,
            );
            const input = panel?.querySelector?.(`[data-story-library-filter="${cssEscape(filter)}"]`);
            if (!input) return;
            const picked = [...(picker?.querySelectorAll?.("[data-story-library-picker-option].active") || [])]
                .map((button) => button.dataset.storyLibraryPickerOption)
                .filter(Boolean);
            input.value = (approvedGenreList(picked)).join(", ");
            updateStoryLibraryFilterSummary(panel, filter);
            closeContainingPopup(picker);
            handleStoryLibraryFilterInput();
        }





        function storyLibraryFilterValues(tab = storyLibraryActiveTab()) {
            const panel = document.querySelector(
                `[data-story-library-tab-panel="${cssEscape(tab)}"]`,
            );
            const filters = {};
            if (!panel) return filters;
            filters.search = String(panel.querySelector("[data-story-library-name-search]")?.value || "").trim();
            const visibleFilterPanel = $("modalBox")?.querySelector?.(".library-filter-panel");
            const filterInputs = [
                ...panel.querySelectorAll("[data-story-library-filter]"),
                ...(visibleFilterPanel?.querySelectorAll?.("[data-story-library-filter], [data-public-library-filter]") || []),
            ];
            for (const input of filterInputs) {
                const key = input.dataset.storyLibraryFilter || input.dataset.publicLibraryFilter;
                if (!key) continue;
                if (input.type === "checkbox") {
                    if (input.checked) filters[key] = "true";
                    continue;
                }
                const value = String(input.value || "").trim();
                if (value) filters[key] = value;
            }
            for (const input of panel.querySelectorAll("[data-story-library-filter-extra]")) {
                const key = input.dataset.storyLibraryFilterExtra;
                const value = String(input.value || "").trim();
                if (!key || !value) continue;
                filters[key] = publicTagListSlot(filters[key] || "", value).join(", ");
            }
            return filters;
        }

        function storyLibraryFilterCriteria(panel, query = "") {
            const filters = storyLibraryFilterValues(
                panel?.dataset.storyLibraryTabPanel || storyLibraryActiveTab(),
            );
            filters.search = String(query || filters.search || "").trim();
            return {
                filters,
                searchTokens: searchTokens(filters.search),
            };
        }

        function storyLibraryRecordMatchesCriteria(record = {}, criteria = {}) {
            const entity = record;
            const search = record.title || "";
            if (!matchesSearchTokens(search, criteria.searchTokens || [])) return false;

            const fields = libraryFilterFields(record, entity);
            for (const [key, value] of Object.entries(criteria.filters || {})) {
                if (!value || key === "search") continue;
                if (!libraryFieldMatchesFilter(fields, key, value)) return false;
            }

            return true;
        }

        function storyLibraryRecordComparator(tab = storyLibraryActiveTab()) {
            const sort = app.storyLibrarySorts?.[tab] || "name-az";
            return (a, b) => {
                if (sort === "name-za") return String(b.title || "").localeCompare(String(a.title || ""));
                if (sort === "source-az")
                    return String(a.source || "").localeCompare(String(b.source || "")) || String(a.title || "").localeCompare(String(b.title || ""));
                if (sort === "updated-new")
                    return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
                return String(a.title || "").localeCompare(String(b.title || ""));
            };
        }

        function storyLibraryPublicFiltersForSupabase(filters = {}) {
            return {genre:filters.genres || "", source:filters.source || "", creator:filters.creator || ""};
        }

        function handleStoryLibraryFilterInput() {
            const tab = storyLibraryActiveTab();
            const panel = document.querySelector(
                `[data-story-library-tab-panel="${cssEscape(tab)}"]`,
            );
            for (const filter of ["genres"])
                updateStoryLibraryFilterSummary(panel, filter);
            if (tab === "public") {
                app.storyLibraryPublicCriteriaRevision =
                    (app.storyLibraryPublicCriteriaRevision || 0) + 1;
                app.storyLibraryPublicFiltersDirty = true;
                const button = $("storyLibraryPublicSearchBtn");
                const unifiedButton = $("modalBox")?.querySelector?.("[data-unified-library-public-search]");
                const hint = $("storyLibraryPublicSearchHint");
                if (button) button.disabled = false;
                if (unifiedButton) unifiedButton.disabled = false;
                if (hint) hint.textContent = "Filters changed. Press Search to query public stories.";
                "";
                return;
            }
            filterStoryTemplateLibraryModal();
        }

