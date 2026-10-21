function updateObjectiveRuntimeLookupStatus(state = app.state, objectiveId = "", status = "hidden") {
    const id = String(objectiveId || "").trim();
    const cached = app.objectiveRuntimeLookup;
    const items = Array.isArray(state?.objectives?.items) ? state.objectives.items : [];
    if (!id || cached?.state !== state || cached.items !== items) return false;
    const complete = objectiveCompletionStatus(status);
    if (complete) cached.completedIds.add(id);else cached.completedIds.delete(id);
    const objective = cached.byId.get(id) || objectiveDefinitionById(id);
    const group = objectiveExclusiveGroup(objective || {});
    if (group) {
      if (!cached.completedIdsByExclusiveGroup.has(group)) cached.completedIdsByExclusiveGroup.set(group, new Set());
      const completedInGroup = cached.completedIdsByExclusiveGroup.get(group);
      if (complete) completedInGroup.add(id);else completedInGroup.delete(id);
      if (!completedInGroup.size) cached.completedIdsByExclusiveGroup.delete(group);
    }
    return true;
  }
  function applyScopedNpcCharacterPatch(state, options = {}) {
    const currentNpc = state.npc_directory?.locations?.[options.npcLocationId]?.characters?.[options.npcKey];
    if (!currentNpc?.full_character) throw new Error(`NPC state target disappeared before apply: ${options.npcLocationId}/${options.npcKey}.`);
    const npc = clone(currentNpc);
    npc.full_character = mergeCharacterPatch(npc.full_character, options.patch, {
      characterName: options.characterName,
      state
    });
    npc.relationship = textSlot(npc.full_character.relationship_to_player, npc.relationship || "unknown");
    state.npc_directory.locations[options.npcLocationId].characters[options.npcKey] = npc;
    const changedRoots = state.__runtimePatchRoots || [];
    if (!changedRoots.includes("npc_directory")) changedRoots.push("npc_directory");
    const changedNpcKeys = state.__runtimePatchNpcKeys || [];
    const npcRecordId = runtimeNpcRecordId(options.npcLocationId, options.npcKey);
    if (!changedNpcKeys.includes(npcRecordId)) changedNpcKeys.push(npcRecordId);
    return npc.full_character;
  }
  function assertObjectiveRuntimeControls(objectives = null) {
    if (!isPlainObject(objectives) || !Array.isArray(objectives.items)) throw new Error("Runtime objective state is invalid. Load or create the save through the story-definition worker.");
    const approvedFields = new Set(["active_id", "focus_id", "no_current", "items", "completion_message", "completed_main_message", "pending_completion_message", "pending_choice", "pending_reward_choices", "progress_notes", "exclusive_group_choices", "suggestions"]);
    const unknown = Object.keys(objectives).find(field => !approvedFields.has(field));
    if (unknown) throw new Error(`Runtime objectives.${unknown} is not an approved field.`);
    if (typeof objectives.active_id !== "string") throw new Error("Runtime objectives.active_id must be exact text.");
    if (typeof objectives.no_current !== "boolean") throw new Error("Runtime objectives.no_current must be true or false.");
    const optionalTextFields = ["focus_id", "completion_message", "completed_main_message"];
    for (const field of optionalTextFields) if (Object.hasOwn(objectives, field) && typeof objectives[field] !== "string") throw new Error(`Runtime objectives.${field} must be exact text.`);
    for (const field of ["pending_reward_choices", "suggestions"]) if (Object.hasOwn(objectives, field) && !Array.isArray(objectives[field])) throw new Error(`Runtime objectives.${field} must be an array.`);
    for (const field of ["progress_notes", "exclusive_group_choices"]) if (Object.hasOwn(objectives, field) && !isPlainObject(objectives[field])) throw new Error(`Runtime objectives.${field} must be an object.`);
    for (const field of ["pending_choice", "pending_completion_message"]) if (Object.hasOwn(objectives, field) && objectives[field] !== null && !isPlainObject(objectives[field])) throw new Error(`Runtime objectives.${field} must be an object or null.`);
    return objectives;
  }
  function objectiveIsSide(objective) {
    return objective?.type === "side";
  }
  function objectiveLockedUntilComplete(objective = {}) {
    return objective.locked_until_complete === true;
  }
  function objectiveIsTimeLocked(objective = {}) {
    return objective.locked_until_complete === true;
  }
  function currentTimeLockedObjective(state = app.state) {
    const locked = currentLockedObjective(state);
    return locked && objectiveIsTimeLocked(locked) ? locked : null;
  }
  function currentLockedObjective(state = app.state) {
    const items = state?.objectives?.items || [];
    const selected = selectedObjectiveRuntime(state).objective;
    const statusCache = new Map();
    if (selected && !objectiveIsComplete(selected, state, statusCache) && objectiveLockedUntilComplete(selected)) return selected;
    for (const objective of items) {
      if (!objectiveIsComplete(objective, state, statusCache) && objectiveLockedUntilComplete(objective) && objectiveCanBeSelected(objective, state, statusCache)) return objective;
    }
    return null;
  }
  function selectedObjectiveSwitchBlocked(state = app.state) {
    return !!currentLockedObjective(state);
  }
  function objectiveRequiredIds(objective = {}, state = app.state) {
    const authoredRequiredIds = Array.isArray(objective.requires) ? objective.requires.map(id => String(id || "")).filter(Boolean) : [];
    const groups = objectiveRuntimeLookup(state).incomingInputGroupsByTargetId.get(String(objective.id || ""));
    return [...new Set([...authoredRequiredIds, ...[...(groups?.values() || [])].flatMap(edges => edges.map(edge => String(edge.sourceId || "")))])].filter(Boolean);
  }
  function objectiveNextOptions(objective = {}) {
    return Array.isArray(objective.next_objectives) ? objective.next_objectives : [];
  }
  function objectiveTransitionOutputId(objective = {}, transition = {}, index = 0) {
    return textSlot(transition.id, "");
  }
  function objectiveOutputTransitions(objective = {}) {
    if (objectiveCompletionControl(objective) === "choice") return objectiveDirectChoiceOptions(objective).map(choice => ({
      ...choice,
      output_id: choice.id,
      objective_id: choice.next_objective_id
    }));
    if (objectiveUsesAiOutcomeRouting(objective)) return objectiveOutcomeRoutes(objective).map(route => ({
      ...route,
      output_id: route.id,
      objective_id: route.next_objective_id
    }));
    return objectiveNextOptions(objective).map((option, index) => ({
      ...option,
      output_id: objectiveTransitionOutputId(objective, option, index)
    }));
  }
  function objectiveOutputEndingType(output = {}) {
    const endingType = textSlot(output?.ending_type, "");
    return ["freeplay", "ending", "game_over"].includes(endingType) ? endingType : "";
  }
  function objectiveOutputIsEnding(output = {}) {
    return !!objectiveOutputEndingType(output);
  }
  function objectiveSelectedOutput(objective = {}, state = app.state) {
    const objectiveId = String(objective.id || "");
    const selectedId = String(app.objectiveRuntime?.selectedOutputById?.[objectiveId] || "");
    if (!selectedId) return null;
    return objectiveOutputTransitions(objective).find(transition => String(transition.output_id || transition.id || "") === selectedId) || null;
  }
  function objectiveOutputCompletionInstruction(objective = {}, state = app.state) {
    return textSlot(objectiveSelectedOutput(objective, state)?.completion_instruction || objective.completion_instruction, "");
  }
  function objectiveRouteControl(objective = {}) {
    return objective.route_control === "ai" ? "ai" : "";
  }
  function objectiveOutcomeRoutes(objective = {}) {
    return Array.isArray(objective.outcome_routes) ? objective.outcome_routes : [];
  }
  function objectiveRouteDefaultMode(route = {}) {
    if (route.default_mode === "only_if_no_other_eligible") return "only_if_no_other_eligible";
    return "always_eligible";
  }
  function objectiveUsesAiOutcomeRouting(objective = {}) {
    return objectiveRouteControl(objective) === "ai" && objectiveOutcomeRoutes(objective).length > 0;
  }
  function objectiveOutcomeRoute(objective = {}, routeId = "") {
    const id = String(routeId || "").trim();
    return objectiveOutcomeRoutes(objective).find(route => route.id === id) || null;
  }
  function eligibleObjectiveOutcomeRoutes(objective = {}, state = app.state) {
    const routes = objectiveOutcomeRoutes(objective);
    const eligible = routes.filter(route => requirementsMet(route.requirements, state));
    const normal = eligible.filter(route => !route.fallback || route.default_mode !== "only_if_no_other_eligible");
    if (normal.length) return normal;
    return eligible.filter(route => route.fallback);
  }
  function eligibleObjectiveOutcomeRoute(objective = {}, routeId = "", state = app.state) {
    const id = String(routeId || "").trim();
    return eligibleObjectiveOutcomeRoutes(objective, state).find(route => route.id === id) || null;
  }
  function defaultObjectiveOutcomeRoute(objective = {}, state = app.state) {
    return eligibleObjectiveOutcomeRoutes(objective, state).find(route => route.fallback) || null;
  }
  function objectiveOutcomeFallbackRoute(objective = {}) {
    return objectiveOutcomeRoutes(objective).find(route => route.fallback) || null;
  }
  function objectiveOutcomeRouteValidationErrors(objectives = []) {
    if (!Array.isArray(objectives)) return [];
    const objectiveIds = new Set(objectives.filter(isPlainObject).map(objective => textSlot(objective.id, "")).filter(Boolean));
    const errors = [];
    for (const [objectiveIndex, objective] of objectives.entries()) {
      if (!isPlainObject(objective) || objectiveRouteControl(objective) !== "ai") continue;
      const path = `objectives.items.${objectiveIndex}`;
      const rawRoutes = objective.outcome_routes;
      if (!Array.isArray(rawRoutes) || !rawRoutes.length) {
        errors.push(validationError(`${path}.outcome_routes`, "required", "AI outcome routing requires at least one outcome route."));
        continue;
      }
      if (objectiveNextOptions(objective).length) errors.push(validationError(`${path}.next_objectives`, "conflict", "AI-routed objectives cannot also use next_objectives."));
      const routeIds = new Set();
      let fallbackCount = 0;
      let defaultWithoutRequirements = 0;
      for (const [routeIndex, route] of rawRoutes.entries()) {
        const routePath = `${path}.outcome_routes.${routeIndex}`;
        if (!isPlainObject(route)) {
          errors.push(validationError(routePath, "type", "Outcome route must be an object."));
          continue;
        }
        const routeId = typeof route.id === "string" ? route.id : "";
        if (!routeId) errors.push(validationError(`${routePath}.id`, "required", "Outcome route id is required."));else if (routeIds.has(routeId)) errors.push(validationError(`${routePath}.id`, "duplicate", `Outcome route id \"${routeId}\" is duplicated.`));
        routeIds.add(routeId);
        if (typeof route.criteria !== "string" || !route.criteria.trim()) errors.push(validationError(`${routePath}.criteria`, "required", "Private outcome criteria are required."));
        const isDefaultRoute = route.fallback === true;
        if (isDefaultRoute) {
          fallbackCount++;
          if (!Array.isArray(route.requirements) || !route.requirements.length) defaultWithoutRequirements++;
        }
        const defaultMode = route.default_mode || "";
        if (defaultMode && !["always_eligible", "only_if_no_other_eligible"].includes(defaultMode)) errors.push(validationError(`${routePath}.default_mode`, "value", "Outcome route default_mode must be always_eligible or only_if_no_other_eligible."));
        const nextId = route.next_objective_id || "";
        if (nextId && !objectiveIds.has(nextId)) errors.push(validationError(`${routePath}.next_objective_id`, "reference", `Outcome route target \"${nextId}\" does not exist.`));
        if (!nextId && !objectiveOutputEndingType(route)) errors.push(validationError(`${routePath}.next_objective_id`, "required", "Outcome route needs a next objective or ending_type."));
      }
      if (fallbackCount !== 1) errors.push(validationError(`${path}.outcome_routes`, "fallback", "AI outcome routing requires exactly one fallback/default route."));
      if (fallbackCount === 1 && defaultWithoutRequirements !== 1) errors.push(validationError(`${path}.outcome_routes`, "fallback", "AI outcome routing fallback/default route must have no requirements so a completed objective always has a valid route."));
    }
    return errors;
  }
  function objectiveChoiceValidationErrors(objectives = []) {
    if (!Array.isArray(objectives)) return [];
    const objectiveIds = new Set(objectives.filter(isPlainObject).map(objective => textSlot(objective.id, "")).filter(Boolean));
    const errors = [];
    for (const [objectiveIndex, objective] of objectives.entries()) {
      if (!isPlainObject(objective) || objectiveCompletionControl(objective) !== "choice") continue;
      const path = `objectives.items.${objectiveIndex}`;
      const choices = Array.isArray(objective.choices) ? objective.choices : [];
      if (!choices.length) {
        errors.push(validationError(`${path}.choices`, "required", "Direct choice objectives require at least one choice option."));
        continue;
      }
      const responseMode = objectiveChoiceResponseMode(objective);
      const rawResponseMode = objective.choice_response_mode || "";
      if (rawResponseMode && !["optional_text", "exact_text"].includes(rawResponseMode)) errors.push(validationError(`${path}.choice_response_mode`, "value", "choice_response_mode must be optional_text or exact_text."));
      let unlockedChoiceCount = 0;
      let directTargetCount = 0;
      for (const [choiceIndex, choice] of choices.entries()) {
        const choicePath = `${path}.choices.${choiceIndex}`;
        if (!isPlainObject(choice)) {
          errors.push(validationError(choicePath, "type", "Choice option must be an object."));
          continue;
        }
        if (typeof choice.id !== "string" || !choice.id.trim()) errors.push(validationError(`${choicePath}.id`, "required", "Choice option id is required."));
        if (typeof choice.title !== "string" || !choice.title.trim()) errors.push(validationError(`${choicePath}.title`, "required", "Choice option title is required."));
        if (responseMode === "exact_text" && (typeof choice.player_text !== "string" || !choice.player_text.trim())) errors.push(validationError(`${choicePath}.player_text`, "required", "Every exact-text choice requires player_text."));
        if (!Array.isArray(choice.requirements) || !choice.requirements.length) unlockedChoiceCount++;
        const targetId = choice.next_objective_id || "";
        if (targetId) {
          directTargetCount++;
          if (!objectiveIds.has(targetId)) errors.push(validationError(`${choicePath}.next_objective_id`, "reference", `Choice option target "${targetId}" does not exist.`));
        } else if (objectiveOutputIsEnding(choice)) directTargetCount++;
      }
      if (!unlockedChoiceCount) errors.push(validationError(`${path}.choices`, "requirements", "Direct choice objectives need at least one no-requirements option so the player cannot be trapped with only locked choices."));
      if (directTargetCount !== choices.length) errors.push(validationError(`${path}.choices`, "routing", "Every non-ending choice option needs its exact next_objective_id."));
    }
    return errors;
  }
  function objectiveRequirementValidationErrors(objectives = []) {
    if (!Array.isArray(objectives)) return [];
    const errors = [];
    const objectiveIds = new Set(objectives.filter(isPlainObject).map(objective => textSlot(objective.id, "")).filter(Boolean));
    const allowedTypes = new Set(["currency", "story_inventory", "story_rule", "known_fact", "durable_known_fact", "party_member", "character_alive", "character_dead", "objective_complete", "objective_not_complete"]);
    const allowedOperators = new Set(["truthy", "falsy", "includes", "not_includes", ">", ">=", "<", "<=", "!=", "=="]);
    const typedRequirementFields = {
      currency: ["type", "id", "op", "value"],
      story_inventory: ["type", "id", "op", "value"],
      story_rule: ["type", "id"],
      known_fact: ["type", "target", "id"],
      durable_known_fact: ["type", "target", "id"],
      party_member: ["type", "target"],
      character_alive: ["type", "target"],
      character_dead: ["type", "target"],
      objective_complete: ["type", "id"],
      objective_not_complete: ["type", "id"]
    };
    const validateList = (requirements, path) => {
      if (requirements == null) return;
      if (!Array.isArray(requirements)) {
        errors.push(validationError(path, "type", "Objective requirements must be an array."));
        return;
      }
      for (const [index, requirement] of requirements.entries()) {
        const requirementPath = `${path}.${index}`;
        if (!isPlainObject(requirement)) {
          errors.push(validationError(requirementPath, "type", "Requirement must be an object using exact canonical fields."));
          continue;
        }
        const authoredType = Object.hasOwn(requirement, "type") ? requirement.type : "";
        if (authoredType && !allowedTypes.has(authoredType)) {
          errors.push(validationError(`${requirementPath}.type`, "value", `Unsupported objective requirement type "${authoredType}".`));
          continue;
        }
        const allowedFields = authoredType ? typedRequirementFields[authoredType] : ["path", "op", "value"];
        errors.push(...exactObjectFieldValidationErrors(requirement, allowedFields, requirementPath));
        if (!authoredType && (typeof requirement.path !== "string" || !requirement.path.trim())) {
          errors.push(validationError(`${requirementPath}.path`, "required", "Path requirements need a non-empty path."));
        }
        const usesOperator = !authoredType || ["currency", "story_inventory"].includes(authoredType);
        if (["currency", "story_inventory", "story_rule", "objective_complete", "objective_not_complete"].includes(authoredType) && (typeof requirement.id !== "string" || !requirement.id.trim())) errors.push(validationError(`${requirementPath}.id`, "required", `${authoredType} requirements need a non-empty id.`));
        if (usesOperator && !allowedOperators.has(requirement.op)) errors.push(validationError(`${requirementPath}.op`, "value", `Unsupported objective requirement operator "${String(requirement.op)}".`));
        if (usesOperator && !["truthy", "falsy"].includes(requirement.op) && !Object.hasOwn(requirement, "value")) errors.push(validationError(`${requirementPath}.value`, "required", `${requirement.op} requirements need a value.`));
        if (["objective_complete", "objective_not_complete"].includes(authoredType) && !objectiveIds.has(String(requirement.id || ""))) errors.push(validationError(`${requirementPath}.id`, "reference", `Objective requirement references missing objective "${requirement.id || ""}".`));
        if (authoredType === "story_rule" && (typeof requirement.id !== "string" || !requirement.id.trim())) errors.push(validationError(`${requirementPath}.id`, "required", "Story-rule requirements need a rule id."));
        if (["known_fact", "durable_known_fact"].includes(authoredType) && (typeof requirement.id !== "string" || !requirement.id.trim() || typeof requirement.target !== "string" || !requirement.target.trim())) errors.push(validationError(requirementPath, "required", "Known-fact requirements need both a target and fact id."));
        if (["party_member", "character_alive", "character_dead"].includes(authoredType) && (typeof requirement.target !== "string" || !requirement.target.trim())) errors.push(validationError(`${requirementPath}.target`, "required", `${authoredType} requirements need a character target.`));
        if (!authoredType && String(requirement.path || "").split(".").some(part => ["__proto__", "prototype", "constructor"].includes(part))) errors.push(validationError(`${requirementPath}.path`, "unsafe", "Objective requirement paths cannot use prototype keys."));
      }
    };
    for (const [objectiveIndex, objective] of objectives.entries()) {
      if (!isPlainObject(objective)) continue;
      const path = `objectives.items.${objectiveIndex}`;
      validateList(objective.completion_requirements, `${path}.completion_requirements`);
      const choices = Array.isArray(objective.choices) ? objective.choices : [];
      choices.forEach((choice, choiceIndex) => validateList(choice?.requirements, `${path}.choices.${choiceIndex}.requirements`));
      const outputs = Array.isArray(objective.next_objectives) ? objective.next_objectives : [];
      outputs.forEach((output, outputIndex) => validateList(output?.requirements, `${path}.next_objectives.${outputIndex}.requirements`));
      const routes = Array.isArray(objective.outcome_routes) ? objective.outcome_routes : [];
      routes.forEach((route, routeIndex) => validateList(route?.requirements, `${path}.outcome_routes.${routeIndex}.requirements`));
    }
    return errors;
  }
  function supportedObjectiveRewardTypes() {
    return new Set(["introduce_future_character", "make_future_character_recruitable", "promote_future_character_to_party", "replace_character_definition", "remove_character_shop_listing", "add_item", "grant_item", "add_story_item", "adjust_story_inventory", "advance_time", "unlock_location", "add_story_rule", "remove_story_rule", "set_state_field", "modify_integer", "modify_number", "adjust_relationship", "grant_outfit", "equip_outfit", "delete_outfit", "delete_all_outfits", "add_state_list_item", "remove_state_list_item", "kill_character", "generate_profile_image", "generate_solo_normal_image", "generate_story_image", "start_objective", "complete_objective", "complete_generated_job", "apply_reward_bundle", "apply_reward_template"]);
  }
  const OBJECTIVE_REWARD_FIELDS_BY_TYPE = Object.freeze({
    introduce_future_character: ["type", "character_id", "npc_location_id", "scene_presence", "reason", "note", "recruitable", "status", "npc_location_label"],
    make_future_character_recruitable: ["type", "character_id"],
    promote_future_character_to_party: ["type", "character_id"],
    replace_character_definition: ["type", "target_character_id", "source_future_character_id", "reason"],
    remove_character_shop_listing: ["type", "shop_id", "character_id"],
    add_item: ["type", "item", "target"],
    grant_item: ["type", "item", "target"],
    add_story_item: ["type", "item"],
    adjust_story_inventory: ["type", "field_path", "operation", "amount"],
    advance_time: ["type", "hours", "minutes", "reason"],
    unlock_location: ["type", "location_id"],
    add_story_rule: ["type", "rule_id", "text"],
    remove_story_rule: ["type", "rule_id"],
    set_state_field: ["type", "character_id", "target", "field_path", "value", "create_path"],
    modify_integer: ["type", "operation", "character_id", "field_path", "value", "value_character_id", "value_path"],
    modify_number: ["type", "operation", "character_id", "field_path", "value", "value_character_id", "value_path", "value_expression"],
    adjust_relationship: ["type", "target", "stats", "preset", "amount"],
    grant_outfit: ["type", "character_id", "outfit", "male_outfit", "non_male_outfit", "equip"],
    equip_outfit: ["type", "character_id", "outfit_id"],
    delete_outfit: ["type", "character_id", "outfit_id"],
    delete_all_outfits: ["type", "character_id"],
    add_state_list_item: ["type", "character_id", "target", "field_path", "value"],
    remove_state_list_item: ["type", "character_id", "target", "field_path", "value", "match"],
    kill_character: ["type", "target", "reason", "ignore_can_die", "killed_by_player", "killed_by"],
    generate_profile_image: ["type", "target", "reason", "image"],
    generate_solo_normal_image: ["type", "target", "reason", "outfit_id", "description", "background", "image"],
    generate_story_image: ["type", "id", "title", "prompt", "negative_prompt", "image"],
    start_objective: ["type", "objective_id"],
    complete_objective: ["type", "objective_id"],
    complete_generated_job: ["type", "job_id", "offer_id"],
    apply_reward_bundle: ["type", "bundle_id"],
    apply_reward_template: ["type", "template_id", "arguments"]
  });
  const OBJECTIVE_REWARD_REQUIRED_FIELDS_BY_TYPE = Object.freeze({
    introduce_future_character: ["character_id", "npc_location_id", "scene_presence", "reason"],
    make_future_character_recruitable: ["character_id"],
    promote_future_character_to_party: ["character_id"],
    replace_character_definition: ["target_character_id", "source_future_character_id", "reason"],
    remove_character_shop_listing: ["shop_id", "character_id"],
    add_item: ["item", "target"],
    grant_item: ["item", "target"],
    add_story_item: ["item"],
    adjust_story_inventory: ["field_path", "operation", "amount"],
    advance_time: ["reason"],
    unlock_location: ["location_id"],
    add_story_rule: ["rule_id", "text"],
    remove_story_rule: ["rule_id"],
    set_state_field: ["field_path", "value"],
    modify_integer: ["operation", "field_path"],
    modify_number: ["operation", "field_path"],
    adjust_relationship: ["target"],
    grant_outfit: ["character_id"],
    equip_outfit: ["character_id", "outfit_id"],
    delete_outfit: ["character_id", "outfit_id"],
    delete_all_outfits: ["character_id"],
    add_state_list_item: ["field_path", "value"],
    remove_state_list_item: ["field_path"],
    kill_character: ["target"],
    generate_profile_image: ["target", "reason"],
    generate_solo_normal_image: ["target", "reason"],
    generate_story_image: ["id", "title"],
    start_objective: ["objective_id"],
    complete_objective: ["objective_id"],
    complete_generated_job: ["job_id"],
    apply_reward_bundle: ["bundle_id"],
    apply_reward_template: ["template_id", "arguments"]
  });
  function exactObjectiveRewardValidationErrors(reward, path) {
    if (typeof reward === "string") return reward.trim() ? [] : [validationError(path, "required", "Reward bundle id cannot be blank.")];
    if (!isPlainObject(reward)) return [validationError(path, "type", "Reward must be an exact reward object or a non-empty reward bundle id.")];
    if (typeof reward.type !== "string" || !reward.type) return [validationError(`${path}.type`, "required", "Reward type is required and case-sensitive.")];
    const fields = OBJECTIVE_REWARD_FIELDS_BY_TYPE[reward.type];
    if (!fields) return [validationError(`${path}.type`, "enum", `Unsupported objective reward type: ${reward.type}`)];
    const errors = exactObjectFieldValidationErrors(reward, fields, path);
    for (const field of OBJECTIVE_REWARD_REQUIRED_FIELDS_BY_TYPE[reward.type] || []) {
      if (!Object.hasOwn(reward, field)) errors.push(validationError(`${path}.${field}`, "required", `${path}.${field} is required.`));
    }
    for (const field of ["character_id", "npc_location_id", "scene_presence", "reason", "shop_id", "target", "operation", "location_id", "rule_id", "text", "outfit_id", "objective_id", "job_id", "bundle_id", "template_id", "id", "title", "target_character_id", "source_future_character_id"]) {
      if (Object.hasOwn(reward, field) && (typeof reward[field] !== "string" || !reward[field])) errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be non-empty text.`));
    }
    for (const field of ["description", "background"]) if (Object.hasOwn(reward, field) && typeof reward[field] !== "string") errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be text when present.`));
    if (Object.hasOwn(reward, "field_path")) errors.push(...rewardPathValidationErrors(reward.field_path, `${path}.field_path`));
    if (Object.hasOwn(reward, "create_path") && typeof reward.create_path !== "boolean") errors.push(validationError(`${path}.create_path`, "type", `${path}.create_path must be true or false.`));
    if (reward.type === "adjust_story_inventory") {
      if (!["add", "subtract", "multiply", "divide", "set"].includes(reward.operation)) errors.push(validationError(`${path}.operation`, "value", "adjust_story_inventory.operation must be add, subtract, multiply, divide, or set."));
      if (typeof reward.amount !== "number" || !Number.isFinite(reward.amount)) errors.push(validationError(`${path}.amount`, "type", "adjust_story_inventory.amount must be a finite number."));
    }
    if (reward.type === "advance_time") {
      if (reward.hours == null && reward.minutes == null) errors.push(validationError(path, "required", "advance_time requires hours or minutes."));
      for (const field of ["hours", "minutes"]) if (Object.hasOwn(reward, field) && (!Number.isSafeInteger(reward[field]) || reward[field] < 0)) errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be a non-negative whole number.`));
    }
    if (reward.type === "introduce_future_character" && !["active", "nearby", "none"].includes(reward.scene_presence)) errors.push(validationError(`${path}.scene_presence`, "enum", `${path}.scene_presence must be active, nearby, or none.`));
    if (["add_item", "grant_item"].includes(reward.type)) errors.push(...rewardInventoryItemValidationErrors(reward.item, `${path}.item`));
    if (reward.type === "adjust_relationship") {
      if (!Object.hasOwn(reward, "stats") && !Object.hasOwn(reward, "preset")) errors.push(validationError(path, "required", "adjust_relationship requires stats or preset."));
      if (Object.hasOwn(reward, "stats")) {
        errors.push(...exactObjectFieldValidationErrors(reward.stats, ["trust", "attraction", "affection"], `${path}.stats`));
        if (!isPlainObject(reward.stats) || !Object.keys(reward.stats).length) errors.push(validationError(`${path}.stats`, "required", `${path}.stats must contain at least one relationship change.`));
        for (const [field, value] of Object.entries(isPlainObject(reward.stats) ? reward.stats : {})) if (typeof value !== "number" || !Number.isFinite(value)) errors.push(validationError(`${path}.stats.${field}`, "type", `${path}.stats.${field} must be a finite number.`));
      }
      if (Object.hasOwn(reward, "preset") && !["all"].includes(reward.preset)) {}
      if (Object.hasOwn(reward, "preset") && (typeof reward.amount !== "number" || !Number.isFinite(reward.amount))) errors.push(validationError(`${path}.amount`, "type", `${path}.amount must be a finite number when preset is present.`));
      if (!Object.hasOwn(reward, "preset") && Object.hasOwn(reward, "amount")) errors.push(validationError(`${path}.amount`, "dependency", `${path}.amount requires preset.`));
    }
    if (reward.type === "apply_reward_template" && !isPlainObject(reward.arguments)) errors.push(validationError(`${path}.arguments`, "type", `${path}.arguments must be an object.`));
    return errors;
  }
  const STORY_INVENTORY_ITEM_FIELDS = Object.freeze(["id", "name", "type", "quantity", "value", "sellable", "quest_item", "description", "image_prompt", "image_id", "image"]);
  const REWARD_INVENTORY_ITEM_FIELDS = Object.freeze(["id", "name", "type", "slot", "quantity", "value", "sellable", "quest_item", "description", "image_id"]);
  function rewardInventoryItemValidationErrors(item, path) {
    const errors = exactObjectFieldValidationErrors(item, REWARD_INVENTORY_ITEM_FIELDS, path);
    if (!isPlainObject(item)) return errors;
    errors.push(...requiredExactFieldsValidationErrors(item, REWARD_INVENTORY_ITEM_FIELDS, path));
    for (const field of ["id", "name", "type", "description", "image_id"]) if (typeof item[field] !== "string") errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be text.`));
    if (item.slot !== null && typeof item.slot !== "string") errors.push(validationError(`${path}.slot`, "type", `${path}.slot must be text or null.`));
    for (const field of ["quantity", "value"]) if (!Number.isSafeInteger(item[field])) errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be a safe integer.`));
    for (const field of ["sellable", "quest_item"]) if (typeof item[field] !== "boolean") errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be true or false.`));
    return errors;
  }
  function storyInventoryItemValidationErrors(item, path) {
    const errors = exactObjectFieldValidationErrors(item, STORY_INVENTORY_ITEM_FIELDS, path);
    if (!isPlainObject(item)) return errors;
    errors.push(...requiredExactFieldsValidationErrors(item, STORY_INVENTORY_ITEM_FIELDS.filter(field => field !== "image"), path));
    for (const field of ["id", "name", "type", "description", "image_prompt", "image_id"]) if (typeof item[field] !== "string") errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be text.`));
    for (const field of ["quantity", "value"]) if (!Number.isSafeInteger(item[field])) errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be a safe integer.`));
    for (const field of ["sellable", "quest_item"]) if (typeof item[field] !== "boolean") errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be true or false.`));
    if (typeof item.id === "string" && !item.id) errors.push(validationError(`${path}.id`, "required", `${path}.id is required.`));
    if (typeof item.name === "string" && !item.name) errors.push(validationError(`${path}.name`, "required", `${path}.name is required.`));
    if (Object.hasOwn(item, "image")) {
      const image = item.image;
      const runtimeImage = isPlainObject(image) && Object.keys(image).some(field => ["hosted_url", "local_image_id", "html"].includes(field));
      if (!runtimeImage) errors.push(...authoredStoryImageValidationErrors(image, `${path}.image`));else {
        errors.push(...exactObjectFieldValidationErrors(image, RUNTIME_STORY_IMAGE_SLOT_FIELDS, `${path}.image`), ...requiredExactFieldsValidationErrors(image, RUNTIME_STORY_IMAGE_SLOT_FIELDS.filter(field => field !== "title"), `${path}.image`));
        for (const field of RUNTIME_STORY_IMAGE_SLOT_FIELDS.filter(field => !["seed", "favorite"].includes(field))) if (Object.hasOwn(image, field) && typeof image[field] !== "string") errors.push(validationError(`${path}.image.${field}`, "type", `${path}.image.${field} must be text.`));
        if (image.seed !== null && typeof image.seed !== "string" && (typeof image.seed !== "number" || !Number.isFinite(image.seed))) errors.push(validationError(`${path}.image.seed`, "type", `${path}.image.seed must be text, a finite number, or null.`));
        if (typeof image.favorite !== "boolean") errors.push(validationError(`${path}.image.favorite`, "type", `${path}.image.favorite must be true or false.`));
      }
    }
    return errors;
  }
  function compiledObjectiveReward(reward) {
    if (typeof reward === "string") return {
      type: "apply_reward_bundle",
      bundle_id: reward
    };
    return reward;
  }
  function objectiveRewardDefinitionOnlyPathPart(path = []) {
    return path.find(part => {
      const key = String(part || "").trim();
      return key === "durable_known_facts" || key === "players" || key.startsWith("starting_") || key.startsWith("default_");
    });
  }
  function objectiveMutationPath(path = []) {
    const parts = Array.isArray(path) ? path.map(part => String(part || "").trim()).filter(Boolean) : [];
    if (parts[0] === "objectives") return parts;
    if (parts[0] === "state" && parts[1] === "objectives") return parts.slice(1);
    return [];
  }
  function objectiveRewardApprovedStatePathError(path = [], {
    targetedCharacter = false
  } = {}) {
    const parts = Array.isArray(path) ? path.map(part => String(part || "").trim()).filter(Boolean) : [];
    if (!parts.length) return "Objective reward path is required.";
    if (targetedCharacter) {
      const allowedCharacterFields = new Set(["age", "appearance", "attraction", "boldness", "can_die", "clothing", "held_items", "inventory", "known_facts", "personality_description", "physical_state", "pose", "relationship_to_player", "role", "speech_style", "state_of_mind", "stats", "trust", "affection"]);
      if (allowedCharacterFields.has(parts[0])) return "";
      return `Character reward path "${parts.join(".")}" is not an approved mutable runtime field.`;
    }
    const root = parts[0];
    const field = parts[1] || "";
    if (root === "scene" && field === "speak_targets") return "Story rewards cannot update manual speaking targets. Speaking targets are controlled by the player's current UI action.";
    if (root === "story_inventory" || root === "world_flags" || root === "progression") return "";
    if (root === "story_memory" && ["relationship_notes", "rules_and_constraints", "unresolved_threads", "world_notes"].includes(field)) return "";
    if (root === "player" && ["appearance", "can_die", "clothing", "held_items", "inventory", "known_facts", "physical_state", "pose", "role", "state_of_mind", "stats"].includes(field)) return "";
    if (root === "scene" && ["image_characters", "npcs_present", "party_members_present", "summary"].includes(field)) return "";
    if (root === "location" && ["continent", "district", "npc_location_id", "region", "settlement_name", "settlement_type", "specific_place", "universe", "world"].includes(field)) return "";
    if (root === "world_map" && ["current_location_id", "focus_location_id", "travel_history"].includes(field)) return "";
    if (root === "story_shops" && parts.length === 3 && parts[2] === "unlocked") return "";
    if (root === "future_cast" && parts[1] === "items" && parts.length === 4 && ["location_hint", "relationship", "status"].includes(parts[3])) return "";
    return `Story reward path "${parts.join(".")}" is not an approved mutable runtime field. Use a dedicated reward type or add the runtime field to the engine allowlist.`;
  }
  function objectiveRewardStatePathValidationErrors(reward, rewardPath, template) {
    const types = new Set(["set_state_field", "modify_integer", "modify_number", "add_state_list_item", "remove_state_list_item"]);
    if (!types.has(reward.type)) return [];
    const path = objectiveRewardPath(reward);
    const targetName = textSlot(reward.target || reward.character, "");
    const targetsCharacter = !!targetName || !!textSlot(reward.character_id, "");
    const declaredPathKey = targetName ? "field_path" : Array.isArray(reward.path) || Object.hasOwn(reward, "path") ? "path" : "field_path";
    if (!path.length) return [validationError(`${rewardPath}.${declaredPathKey}`, "required", "Objective reward path must be a non-empty array.")];
    if (objectiveMutationPath(path).length) return [validationError(`${rewardPath}.${declaredPathKey}`, "immutable_objectives", "Story rewards cannot mutate the objectives state tree. Author objective definitions in state.objectives.items and use start_objective or complete_objective for runtime objective transitions.")];
    const definitionOnlyPart = objectiveRewardDefinitionOnlyPathPart(path);
    if (definitionOnlyPart) return [validationError(`${rewardPath}.${Array.isArray(reward.field_path) ? "field_path" : "path"}`, "definition_field", `Objective rewards cannot update definition-only field "${definitionOnlyPart}". Use the corresponding runtime field instead.`)];
    const approvedPathError = objectiveRewardApprovedStatePathError(path, {
      targetedCharacter: targetsCharacter
    });
    if (approvedPathError) return [validationError(`${rewardPath}.${declaredPathKey}`, "unapproved_state_path", approvedPathError)];
    if (!["add_state_list_item", "remove_state_list_item"].includes(reward.type)) return [];
    if (["known_facts", "inventory"].includes(path.at(-1))) {
      const runtimeField = path.at(-1);
      const directPlayerPath = !targetName && path.length === 2 && path[0] === "player";
      const targetedCharacterPath = !!targetName && path.length === 1 && !!storyRewardCharacterTarget(template?.state || {}, reward)?.entity;
      if (directPlayerPath || targetedCharacterPath) return [];
      return [validationError(`${rewardPath}.${Array.isArray(reward.field_path) ? "field_path" : "path"}`, "list_target", `${runtimeField} list rewards must target player.${runtimeField} or a resolved character's ${runtimeField} field.`)];
    }
    try {
      const target = objectiveRewardTargetAndPath(template?.state || {}, reward);
      assertRewardPathExists(target.root, target.path, reward);
      if (!Array.isArray(getPathValue(target.root, target.path))) return [validationError(`${rewardPath}.${Array.isArray(reward.field_path) ? "field_path" : "path"}`, "list_target", `List reward target must resolve to an existing list: ${target.label}.`)];
    } catch (error) {
      return [validationError(`${rewardPath}.${Array.isArray(reward.field_path) ? "field_path" : "path"}`, "list_target", error.message)];
    }
    return [];
  }
  function outfitDefinitionValidationErrors(outfit, path, label = "Granted outfit") {
    const errors = [];
    if (!isPlainObject(outfit)) return [validationError(path, "required", `${label} must be an outfit object.`)];
    errors.push(...exactObjectFieldValidationErrors(outfit, ["id", "name", "contexts", "formality", "revealing", "clothing", "image"], path), ...requiredExactFieldsValidationErrors(outfit, ["id", "name", "clothing"], path));
    if (!textSlot(outfit.id, "")) errors.push(validationError(`${path}.id`, "required", `${label} id is required.`));
    if (!textSlot(outfit.name, "")) errors.push(validationError(`${path}.name`, "required", `${label} name is required.`));
    if (Object.hasOwn(outfit, "contexts") && (!Array.isArray(outfit.contexts) || outfit.contexts.some(context => typeof context !== "string" || !context.trim()))) errors.push(validationError(`${path}.contexts`, "type", `${label} contexts must contain only non-empty text.`));
    for (const field of ["formality", "revealing"]) if (Object.hasOwn(outfit, field) && !Number.isFinite(outfit[field])) errors.push(validationError(`${path}.${field}`, "type", `${label} ${field} must be a finite number.`));
    if (!isPlainObject(outfit.clothing)) errors.push(validationError(`${path}.clothing`, "required", `${label} clothing must be an object.`));else {
      if (!Object.keys(outfit.clothing).length) errors.push(validationError(`${path}.clothing`, "required", `${label} clothing must include at least one canonical slot.`));
      const invalidSlots = Object.keys(outfit.clothing).filter(slot => !validClothingSlots().includes(slot));
      if (invalidSlots.length) errors.push(validationError(`${path}.clothing`, "slots", `${label} uses invalid clothing slots: ${invalidSlots.join(", ")}.`));
      for (const [slot, description] of Object.entries(outfit.clothing)) if (description !== null && typeof description !== "string") errors.push(validationError(`${path}.clothing.${slot}`, "type", `${label} clothing values must be text or null.`));
    }
    errors.push(...authoredStoryImageValidationErrors(outfit.image, `${path}.image`));
    return errors;
  }
  const AUTHORED_STORY_IMAGE_FIELDS = Object.freeze(["id", "title", "prompt", "negative_prompt", "seed", "model", "source", "url", "favorite"]);
  function authoredStoryImageValidationErrors(value, path) {
    if (value == null) return [];
    if (!isPlainObject(value)) return [validationError(path, "type", "Authored image metadata must be an object.")];
    const errors = exactObjectFieldValidationErrors(value, AUTHORED_STORY_IMAGE_FIELDS, path);
    for (const field of ["id", "title", "prompt", "negative_prompt", "model", "source", "url"]) if (Object.hasOwn(value, field) && typeof value[field] !== "string") errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be text.`));
    if (Object.hasOwn(value, "seed") && typeof value.seed !== "string" && (typeof value.seed !== "number" || !Number.isFinite(value.seed))) errors.push(validationError(`${path}.seed`, "type", `${path}.seed must be text or a finite number.`));
    if (Object.hasOwn(value, "favorite") && typeof value.favorite !== "boolean") errors.push(validationError(`${path}.favorite`, "type", `${path}.favorite must be true or false.`));
    const url = typeof value.url === "string" ? value.url : "";
    if (url && !trustedStoredImageSrc(url)) errors.push(validationError(`${path}.url`, "image_url", "Hosted image URL must be an HTTPS/HTTP image URL supported by EmberAdventures."));
    if (value.source === "placeholder") errors.push(validationError(`${path}.source`, "placeholder", "Placeholder images are not valid authored story images."));
    return errors;
  }
  function storyAuthoredAssetImageValidationErrors(template = {}) {
    const errors = [];
    const state = template.state || {};
    errors.push(...authoredStoryTitleCardImageValidationErrors(template.title_card_image, "title_card_image"));
    const inventory = state.story_inventory;
    for (const [index, item] of (Array.isArray(inventory?.items) ? inventory.items : []).entries()) errors.push(...authoredStoryImageValidationErrors(item?.image, `story_inventory.items.${index}.image`));
    const shops = state.story_shops || {};
    for (const [shopId, shop] of Object.entries(shops)) {
      const type = shop?.type;
      for (const [index, listing] of (Array.isArray(shop?.items) ? shop.items : []).entries()) {
        const base = `story_shops.${shopId}.items.${index}`;
        if (type === "general") errors.push(...authoredStoryImageValidationErrors((listing?.item || listing)?.image, `${base}${listing?.item ? ".item" : ""}.image`));
        if (type === "clothing") errors.push(...authoredStoryImageValidationErrors((listing?.outfit || listing)?.image, `${base}${listing?.outfit ? ".outfit" : ""}.image`));
        if (type === "job") for (const [rewardIndex, item] of (Array.isArray(listing?.reward_items) ? listing.reward_items : []).entries()) errors.push(...authoredStoryImageValidationErrors(item?.image, `${base}.reward_items.${rewardIndex}.image`));
      }
    }
    for (const entry of storyDefinitionCharacterEntries(template)) {
      for (const field of ["outfits", "fallback_outfits"]) for (const [index, outfit] of (Array.isArray(entry.character?.[field]) ? entry.character[field] : []).entries()) errors.push(...authoredStoryImageValidationErrors(outfit?.image, `${entry.path}.${field}.${index}.image`));
    }
    return errors;
  }
  function authoredStoryTitleCardImageValidationErrors(value, path) {
    if (!isPlainObject(value)) return [];
    const errors = [];
    for (const field of ["id", "title", "prompt", "negativePrompt", "model", "source", "url", "hosted_url", "html"]) if (typeof value[field] !== "string") errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be text.`));
    if (typeof value.seed !== "string" && (typeof value.seed !== "number" || !Number.isFinite(value.seed))) errors.push(validationError(`${path}.seed`, "type", `${path}.seed must be text or a finite number.`));
    if (typeof value.favorite !== "boolean") errors.push(validationError(`${path}.favorite`, "type", `${path}.favorite must be true or false.`));
    for (const field of ["url", "hosted_url"]) if (value[field] && !trustedStoredImageSrc(value[field])) errors.push(validationError(`${path}.${field}`, "image_url", "Hosted image URL must be an HTTPS/HTTP image URL supported by EmberAdventures."));
    if (value.source === "placeholder") errors.push(validationError(`${path}.source`, "placeholder", "Placeholder images are not valid authored story images."));
    return errors;
  }
  function objectiveValidationExpandedRewards(rewards = [], bundles = {}, templates = {}, bundleTrail = [], templateTrail = []) {
    const expanded = [];
    for (const rawReward of Array.isArray(rewards) ? rewards : []) {
      const reward = compiledObjectiveReward(rawReward);
      if (reward.type === "apply_reward_bundle") {
        const bundleId = reward.bundle_id;
        if (!bundleId || bundleTrail.includes(bundleId) || !Array.isArray(bundles[bundleId])) continue;
        expanded.push(...objectiveValidationExpandedRewards(bundles[bundleId], bundles, templates, [...bundleTrail, bundleId], templateTrail));
        continue;
      }
      if (reward.type === "apply_reward_template") {
        const templateId = reward.template_id;
        if (!templateId || templateTrail.includes(templateId) || !isPlainObject(templates[templateId])) continue;
        try {
          expanded.push(...objectiveValidationExpandedRewards(instantiateRewardTemplate(templateId, templates[templateId], reward.arguments), bundles, templates, bundleTrail, [...templateTrail, templateId]));
        } catch {}
        continue;
      }
      expanded.push(reward);
    }
    return expanded;
  }
  function objectiveRequiredOutfitPresentationKeys(objective = {}, bundles = {}, templates = {}) {
    const rewardLists = [objective.rewards];
    for (const route of Array.isArray(objective.outcome_routes) ? objective.outcome_routes : []) rewardLists.push(route?.rewards);
    for (const choice of Array.isArray(objective.choices) ? objective.choices : []) rewardLists.push(choice?.rewards);
    const rewards = rewardLists.flatMap(list => objectiveValidationExpandedRewards(list, bundles, templates));
    return new Set(rewards.filter(reward => reward.type === "equip_outfit").map(reward => `${textSlot(reward.character_id, "")}::${textSlot(reward.outfit_id, "")}`).filter(key => key !== "::"));
  }
  function objectiveRewardValidationErrors(objectives = [], rewardBundles = {}, template = {}) {
    if (!Array.isArray(objectives)) return [];
    const bundles = isPlainObject(rewardBundles) ? rewardBundles : {};
    const bundleIds = new Set(Object.keys(bundles));
    const rawTemplates = template.state?.reward_templates || {};
    const rewardTemplates = isPlainObject(rawTemplates) ? rawTemplates : {};
    const templateIds = new Set(Object.keys(rewardTemplates));
    const supportedTypes = supportedObjectiveRewardTypes();
    const objectiveIds = new Set(objectives.filter(isPlainObject).map(objective => textSlot(objective.id, "")).filter(Boolean));
    const characterIds = new Set(storyDefinitionCharacterEntries(template).flatMap(entry => [characterDefinitionStableId(entry), textSlot(entry.character?.id, ""), textSlot(entry.character?.character_id, ""), textSlot(entry.character?.definition_id, "")]).filter(Boolean));
    const errors = rewardTemplateSchemaValidationErrors(rawTemplates);
    const separatelyMaterializedFutureCharacterPaths = new Map();
    const replacementSourcePaths = new Map();
    const rememberCharacterUse = (uses, characterId, path) => {
      if (!characterId) return;
      if (!uses.has(characterId)) uses.set(characterId, new Set());
      uses.get(characterId).add(path);
    };
    if (!isPlainObject(rewardBundles)) errors.push(validationError("state.reward_bundles", "type", "state.reward_bundles must be an object keyed by exact bundle id."));
    for (const [bundleId, rewards] of Object.entries(bundles)) {
      if (!bundleId || !/^[a-z0-9][a-z0-9_-]*$/.test(bundleId)) errors.push(validationError(`state.reward_bundles.${bundleId}`, "id", "Reward bundle keys must be non-empty stable lowercase ids."));
      if (!Array.isArray(rewards) || !rewards.length) errors.push(validationError(`state.reward_bundles.${bundleId}`, "type", "Every reward bundle must be a non-empty reward array."));
    }
    const checkCharacterReferences = (reward, rewardPath) => {
      const references = [];
      for (const key of ["character_id", "value_character_id"]) if (textSlot(reward[key], "")) references.push({
        key,
        id: textSlot(reward[key], "")
      });
      const addOperandReference = (operand, keyPath) => {
        if (isPlainObject(operand) && textSlot(operand.character_id, "")) references.push({
          key: `${keyPath}.character_id`,
          id: textSlot(operand.character_id, "")
        });
      };
      if (isPlainObject(reward.value_expression)) {
        addOperandReference(reward.value_expression.initial, "value_expression.initial");
        const operations = Array.isArray(reward.value_expression.operations) ? reward.value_expression.operations : [];
        for (const [index, step] of operations.entries()) addOperandReference(step?.operand, `value_expression.operations.${index}.operand`);
      }
      for (const reference of references) {
        if (reference.id === "__template_validation_character__") continue;
        if (!characterIds.has(reference.id)) errors.push(validationError(`${rewardPath}.${reference.key}`, "reference", `Character id "${reference.id}" does not exist in this story definition.`));
      }
    };
    const checkRewards = (rewards, path, bundleTrail = [], templateTrail = [], requiredOutfitPresentationKeys = new Set()) => {
      for (const [rewardIndex, rawReward] of (Array.isArray(rewards) ? rewards : []).entries()) {
        const rewardPath = `${path}.${rewardIndex}`;
        const exactErrors = exactObjectiveRewardValidationErrors(rawReward, rewardPath);
        errors.push(...exactErrors);
        if (exactErrors.length) continue;
        const reward = compiledObjectiveReward(rawReward);
        if (!supportedTypes.has(reward.type)) {
          errors.push(validationError(`${rewardPath}.type`, "enum", `Unsupported objective reward type: ${reward.type}`));
          continue;
        }
        if (reward.type === "start_objective") {
          if (isPlainObject(reward.objective)) errors.push(validationError(`${rewardPath}.objective`, "unsupported", "Inline start_objective.objective definitions are not supported. Author the objective and reference objective_id."));
          const targetObjectiveId = textSlot(reward.objective_id, "");
          if (!targetObjectiveId) errors.push(validationError(`${rewardPath}.objective_id`, "required", "start_objective requires objective_id."));else if (!objectiveIds.has(targetObjectiveId)) errors.push(validationError(`${rewardPath}.objective_id`, "reference", `start_objective references missing objective "${targetObjectiveId}".`));
        }
        if (reward.type === "introduce_future_character") {
          rememberCharacterUse(separatelyMaterializedFutureCharacterPaths, textSlot(reward.character_id, ""), rewardPath);
          const npcLocationId = textSlot(reward.npc_location_id, "");
          if (!isNpcLocationId(npcLocationId)) errors.push(validationError(`${rewardPath}.npc_location_id`, "required", "introduce_future_character requires npc_location_id: a stable NPC directory location id."));
        }
        if (reward.type === "promote_future_character_to_party") rememberCharacterUse(separatelyMaterializedFutureCharacterPaths, textSlot(reward.character_id, ""), rewardPath);
        if (reward.type === "replace_character_definition") {
          const targetCharacterId = textSlot(reward.target_character_id, "");
          const sourceFutureCharacterId = textSlot(reward.source_future_character_id, "");
          rememberCharacterUse(replacementSourcePaths, sourceFutureCharacterId, rewardPath);
          const characterIds = new Set(storyDefinitionCharacterEntries(template).map(entry => textSlot(entry.character?.id, "")).filter(Boolean));
          const source = template.state?.future_cast?.items?.[sourceFutureCharacterId];
          if (!characterIds.has(targetCharacterId)) errors.push(validationError(`${rewardPath}.target_character_id`, "reference", `replace_character_definition references missing target character "${targetCharacterId}".`));
          if (!isPlainObject(source)) errors.push(validationError(`${rewardPath}.source_future_character_id`, "reference", `replace_character_definition references missing future-cast source "${sourceFutureCharacterId}".`));
          if (targetCharacterId && targetCharacterId === sourceFutureCharacterId) errors.push(validationError(`${rewardPath}.source_future_character_id`, "identity", "replace_character_definition source and target ids must be different."));
        }
        if (reward.type === "remove_character_shop_listing") {
          const shopId = textSlot(reward.shop_id, "");
          const characterId = textSlot(reward.character_id, "");
          const shop = template.state?.story_shops?.[shopId];
          if (!shopId) errors.push(validationError(`${rewardPath}.shop_id`, "required", "remove_character_shop_listing requires shop_id."));else if (!isPlainObject(shop) || shop.type !== "character") errors.push(validationError(`${rewardPath}.shop_id`, "reference", `remove_character_shop_listing references missing character shop "${shopId}".`));
          if (!characterId) errors.push(validationError(`${rewardPath}.character_id`, "required", "remove_character_shop_listing requires character_id."));else if (isPlainObject(shop) && !(Array.isArray(shop.items) ? shop.items : []).some(item => textSlot(item?.character_id, "") === characterId)) errors.push(validationError(`${rewardPath}.character_id`, "reference", `Character shop "${shopId}" has no listing for "${characterId}".`));
        }
        errors.push(...objectiveRewardStatePathValidationErrors(reward, rewardPath, template));
        if (reward.type === "add_story_item") {
          const item = reward.item;
          errors.push(...storyInventoryItemValidationErrors(item, `${rewardPath}.item`));
          errors.push(...authoredStoryImageValidationErrors(item?.image, `${rewardPath}.item.image`));
        }
        if (["generate_profile_image", "generate_solo_normal_image", "generate_story_image"].includes(reward.type)) {
          errors.push(...authoredStoryImageValidationErrors(reward.image, `${rewardPath}.image`));
          if (reward.type === "generate_story_image" && !textSlot(reward.prompt || reward.image?.prompt, "") && !authoredStoryImageSlotHasReference(runtimeStoryImageSlotFromExactInput(reward.image))) errors.push(validationError(`${rewardPath}.image`, "required", "generate_story_image requires a prompt or authored image reference."));
        }
        if (reward.type === "modify_integer") errors.push(...modifyIntegerRewardValidationErrors(reward, rewardPath));
        if (reward.type === "modify_number") errors.push(...modifyNumberRewardValidationErrors(reward, rewardPath));
        if (["modify_integer", "modify_number"].includes(reward.type)) checkCharacterReferences(reward, rewardPath);
        if (["grant_outfit", "equip_outfit", "delete_outfit", "delete_all_outfits"].includes(reward.type)) {
          checkCharacterReferences(reward, rewardPath);
          if (!textSlot(reward.character_id, "")) errors.push(validationError(`${rewardPath}.character_id`, "required", `${reward.type} requires a stable character_id.`));
        }
        if (reward.type === "grant_outfit") {
          const universal = reward.outfit;
          const male = reward.male_outfit;
          const nonMale = reward.non_male_outfit;
          const hasUniversal = isPlainObject(universal);
          const hasMale = isPlainObject(male);
          const hasNonMale = isPlainObject(nonMale);
          if (universal != null && (male != null || nonMale != null)) errors.push(validationError(rewardPath, "exclusive", "grant_outfit must use one universal outfit or gender-conditional male_outfit/non_male_outfit fields, not both forms."));
          if (!hasUniversal && !hasMale && !hasNonMale) errors.push(validationError(rewardPath, "required", "grant_outfit requires outfit, male_outfit, or non_male_outfit."));
          if (hasUniversal) errors.push(...outfitDefinitionValidationErrors(universal, `${rewardPath}.outfit`));
          if (hasMale) errors.push(...outfitDefinitionValidationErrors(male, `${rewardPath}.male_outfit`, "Male granted outfit"));
          if (hasNonMale) errors.push(...outfitDefinitionValidationErrors(nonMale, `${rewardPath}.non_male_outfit`, "Non-male granted outfit"));
          if (hasMale && hasNonMale && textSlot(male.id, "") !== textSlot(nonMale.id, "")) errors.push(validationError(rewardPath, "presentation_id", "male_outfit and non_male_outfit must use the same stable outfit id."));
          if (reward.equip != null && typeof reward.equip !== "boolean") errors.push(validationError(`${rewardPath}.equip`, "type", "grant_outfit equip must be true or false."));
          const presentationOutfitIds = [textSlot(male?.id, ""), textSlot(nonMale?.id, "")].filter(Boolean);
          const equippedBySibling = presentationOutfitIds.some(outfitId => requiredOutfitPresentationKeys.has(`${textSlot(reward.character_id, "")}::${outfitId}`));
          if (!hasUniversal && (reward.equip === true || equippedBySibling) && (!hasMale || !hasNonMale)) errors.push(validationError(rewardPath, "presentations", "An equipped gender-conditional grant_outfit requires both male_outfit and non_male_outfit."));
        }
        if (reward.type === "equip_outfit" && !textSlot(reward.outfit_id, "")) errors.push(validationError(`${rewardPath}.outfit_id`, "required", "equip_outfit requires outfit_id."));
        if (reward.type === "apply_reward_template") {
          const templateId = reward.template_id;
          if (!templateId) {
            errors.push(validationError(`${rewardPath}.template_id`, "required", "Reward template reference needs template_id."));
            continue;
          }
          if (!templateIds.has(templateId)) {
            errors.push(validationError(`${rewardPath}.template_id`, "reference", `Reward template "${templateId}" does not exist.`));
            continue;
          }
          if (templateTrail.includes(templateId)) {
            errors.push(validationError(`${rewardPath}.template_id`, "cycle", `Reward template cycle detected: ${[...templateTrail, templateId].join(" -> ")}.`));
            continue;
          }
          try {
            const instantiated = instantiateRewardTemplate(templateId, rewardTemplates[templateId], reward.arguments);
            checkRewards(instantiated, `${rewardPath}.template`, bundleTrail, [...templateTrail, templateId], requiredOutfitPresentationKeys);
          } catch (error) {
            errors.push(validationError(`${rewardPath}.arguments`, "arguments", error.message));
          }
          continue;
        }
        if (reward.type !== "apply_reward_bundle") continue;
        const bundleId = reward.bundle_id;
        if (!bundleId) {
          errors.push(validationError(`${rewardPath}.bundle_id`, "required", "Reward bundle reference needs bundle_id."));
          continue;
        }
        if (!bundleIds.has(bundleId)) {
          errors.push(validationError(`${rewardPath}.bundle_id`, "reference", `Reward bundle "${bundleId}" does not exist.`));
          continue;
        }
        if (bundleTrail.includes(bundleId)) {
          errors.push(validationError(`${rewardPath}.bundle_id`, "cycle", `Reward bundle cycle detected: ${[...bundleTrail, bundleId].join(" -> ")}.`));
          continue;
        }
        checkRewards(bundles[bundleId], `${rewardPath}.bundle`, [...bundleTrail, bundleId], templateTrail, requiredOutfitPresentationKeys);
      }
    };
    for (const [bundleId, rewards] of Object.entries(bundles)) checkRewards(rewards, `reward_bundles.${bundleId}`);
    for (const [templateId, rewardTemplate] of Object.entries(rewardTemplates)) {
      const argumentsMap = Object.fromEntries(Object.entries(rewardTemplate.parameters || {}).map(([name, definition]) => [name, definition.type === "character_id" ? "__template_validation_character__" : ["stats", "template_validation_value"]]));
      try {
        checkRewards(instantiateRewardTemplate(templateId, rewardTemplate, argumentsMap), `reward_templates.${templateId}.rewards`, [], [templateId]);
      } catch (error) {
        errors.push(validationError(`reward_templates.${templateId}`, "arguments", error.message));
      }
    }
    for (const [objectiveIndex, objective] of objectives.entries()) {
      if (!isPlainObject(objective)) continue;
      const path = textSlot(objective.__validation_path, `objectives.items.${objectiveIndex}`);
      const requiredOutfitPresentationKeys = objectiveRequiredOutfitPresentationKeys(objective, bundles, rewardTemplates);
      checkRewards(objective.rewards, `${path}.rewards`, [], [], requiredOutfitPresentationKeys);
      const outputs = Array.isArray(objective.next_objectives) ? objective.next_objectives : [];
      for (const [outputIndex, output] of outputs.entries()) {
        if (isPlainObject(output)) checkRewards(output.rewards, `${path}.next_objectives.${outputIndex}.rewards`, [], [], requiredOutfitPresentationKeys);
      }
      const routes = Array.isArray(objective.outcome_routes) ? objective.outcome_routes : [];
      for (const [routeIndex, route] of routes.entries()) {
        if (isPlainObject(route)) checkRewards(route.rewards, `${path}.outcome_routes.${routeIndex}.rewards`, [], [], requiredOutfitPresentationKeys);
      }
      const choices = Array.isArray(objective.choices) ? objective.choices : [];
      for (const [choiceIndex, choice] of choices.entries()) {
        if (isPlainObject(choice)) checkRewards(choice.rewards, `${path}.choices.${choiceIndex}.rewards`, [], [], requiredOutfitPresentationKeys);
      }
      if (objectiveCompletionControl(objective) !== "reward_only") continue;
      const hasRewards = extractObjectiveRewards(objective.rewards).length > 0 || objectiveOutputTransitions(objective).some(transition => extractObjectiveRewards(transition.rewards).length > 0);
      if (!hasRewards) errors.push(validationError(`${path}.rewards`, "required", "Reward-only objectives need at least one reward or reward bundle reference."));
      const hasOutgoing = objectiveNextOptions(objective).length || objectiveOutcomeRoutes(objective).length;
      const id = textSlot(objective.id, "");
      const hasDependents = !!id && objectives.some(item => item !== objective && objectiveRequiredIds(item).includes(id));
      if (!hasOutgoing && !hasDependents) errors.push(validationError(`${path}.next_objectives`, "required", "Reward-only objectives need a next objective, outcome route, or dependent objective."));
    }
    for (const [characterId, replacementPaths] of replacementSourcePaths) {
      const introductionPaths = separatelyMaterializedFutureCharacterPaths.get(characterId);
      if (!introductionPaths?.size) continue;
      for (const replacementPath of replacementPaths) errors.push(validationError(`${replacementPath}.source_future_character_id`, "exclusive", `Replacement source "${characterId}" is also introduced or promoted as a separate character at ${[...introductionPaths].join(", ")}. A replacement source must only be consumed by replace_character_definition.`));
    }
    return errors;
  }
  function rewardPathValidationErrors(path, rootPath = "reward.field_path") {
    const errors = [];
    if (!Array.isArray(path) || !path.length) return [validationError(rootPath, "required", "Integer reward paths must be non-empty arrays.")];
    const forbidden = new Set(["__proto__", "prototype", "constructor"]);
    path.forEach((part, index) => {
      if (typeof part !== "string" || !part.trim()) errors.push(validationError(`${rootPath}.${index}`, "type", "Integer reward path parts must be non-empty strings."));else if (forbidden.has(part)) errors.push(validationError(`${rootPath}.${index}`, "unsafe", `Integer reward paths cannot contain "${part}".`));
    });
    return errors;
  }
  function modifyIntegerRewardValidationErrors(reward = {}, rootPath = "reward") {
    const errors = [];
    const operation = reward.operation;
    if (!["add", "subtract", "multiply", "divide"].includes(operation)) errors.push(validationError(`${rootPath}.operation`, "enum", "modify_integer operation must be add, subtract, multiply, or divide."));
    errors.push(...rewardPathValidationErrors(reward.field_path, `${rootPath}.field_path`));
    const hasLiteral = Object.hasOwn(reward, "value");
    const hasReference = Object.hasOwn(reward, "value_path");
    if (hasLiteral === hasReference) errors.push(validationError(rootPath, "operand", "modify_integer requires exactly one of value or value_path."));
    if (hasLiteral && !Number.isSafeInteger(reward.value)) errors.push(validationError(`${rootPath}.value`, "integer", "modify_integer literal values must be safe integers."));
    if (operation === "divide" && hasLiteral && reward.value === 0) errors.push(validationError(`${rootPath}.value`, "divide_by_zero", "A hardcoded divide-by-zero reward is invalid."));
    if (hasReference) errors.push(...rewardPathValidationErrors(reward.value_path, `${rootPath}.value_path`));
    if (Object.hasOwn(reward, "value_character_id") && !hasReference) errors.push(validationError(`${rootPath}.value_character_id`, "dependency", "value_character_id requires value_path."));
    for (const key of ["character_id", "value_character_id"]) {
      if (Object.hasOwn(reward, key) && !textSlot(reward[key], "")) errors.push(validationError(`${rootPath}.${key}`, "required", `${key} must be a non-empty character id when provided.`));
    }
    return errors;
  }
  function numberOperandValidationErrors(operand, rootPath = "reward.operand") {
    if (typeof operand === "number") return Number.isFinite(operand) ? [] : [validationError(rootPath, "number", "Numeric operands must be finite numbers.")];
    if (!isPlainObject(operand)) return [validationError(rootPath, "type", "Numeric operands must be a number or an object containing value or path.")];
    const errors = exactObjectFieldValidationErrors(operand, ["value", "path", "character_id"], rootPath);
    const hasLiteral = Object.hasOwn(operand, "value");
    const hasReference = Object.hasOwn(operand, "path");
    if (hasLiteral === hasReference) errors.push(validationError(rootPath, "operand", "Numeric operand objects require exactly one of value or path."));
    if (hasLiteral && !Number.isFinite(operand.value)) errors.push(validationError(`${rootPath}.value`, "number", "Numeric operand literal values must be finite numbers."));
    if (hasReference) errors.push(...rewardPathValidationErrors(operand.path, `${rootPath}.path`));
    if (Object.hasOwn(operand, "character_id") && !hasReference) errors.push(validationError(`${rootPath}.character_id`, "dependency", "Numeric operand character_id requires path."));
    if (Object.hasOwn(operand, "character_id") && !textSlot(operand.character_id, "")) errors.push(validationError(`${rootPath}.character_id`, "required", "Numeric operand character_id must be non-empty when provided."));
    return errors;
  }
  function numericExpressionValidationErrors(expression, rootPath = "reward.value_expression") {
    if (!isPlainObject(expression)) return [validationError(rootPath, "type", "value_expression must be an object with initial and operations.")];
    const errors = exactObjectFieldValidationErrors(expression, ["initial", "operations"], rootPath);
    if (!Object.hasOwn(expression, "initial")) errors.push(validationError(`${rootPath}.initial`, "required", `${rootPath}.initial is required.`));
    if (!Object.hasOwn(expression, "operations")) errors.push(validationError(`${rootPath}.operations`, "required", `${rootPath}.operations is required.`));
    errors.push(...numberOperandValidationErrors(expression.initial, `${rootPath}.initial`));
    if (!Array.isArray(expression.operations)) errors.push(validationError(`${rootPath}.operations`, "type", "Numeric expression operations must be an array."));
    for (const [index, step] of (Array.isArray(expression.operations) ? expression.operations : []).entries()) {
      const path = `${rootPath}.operations.${index}`;
      if (!isPlainObject(step)) {
        errors.push(validationError(path, "type", "Expression operation must be an object."));
        continue;
      }
      errors.push(...exactObjectFieldValidationErrors(step, ["operation", "operand"], path));
      if (!Object.hasOwn(step, "operation")) errors.push(validationError(`${path}.operation`, "required", `${path}.operation is required.`));
      if (!Object.hasOwn(step, "operand")) errors.push(validationError(`${path}.operand`, "required", `${path}.operand is required.`));
      const operation = step.operation;
      if (!["add", "subtract", "multiply", "divide"].includes(operation)) errors.push(validationError(`${path}.operation`, "enum", "Expression operation must be add, subtract, multiply, or divide."));
      errors.push(...numberOperandValidationErrors(step.operand, `${path}.operand`));
      const literal = typeof step.operand === "number" ? step.operand : isPlainObject(step.operand) && Object.hasOwn(step.operand, "value") ? step.operand.value : null;
      if (operation === "divide" && literal === 0) errors.push(validationError(`${path}.operand`, "divide_by_zero", "A hardcoded divide-by-zero expression is invalid."));
    }
    return errors;
  }
  function literalNumericOperandValue(operand) {
    if (typeof operand === "number") return rationalFromNumber(operand);
    if (isPlainObject(operand) && Object.hasOwn(operand, "value") && Number.isFinite(operand.value)) return rationalFromNumber(operand.value);
    return null;
  }
  function literalNumericExpressionValue(expression = {}) {
    let value = literalNumericOperandValue(expression.initial);
    if (!value || !Array.isArray(expression.operations)) return null;
    for (const step of expression.operations) {
      const operand = literalNumericOperandValue(step?.operand);
      if (!operand) return null;
      if (step.operation === "divide" && operand.numerator === 0n) return null;
      value = applyRationalOperation(value, operand, step.operation);
    }
    return value;
  }
  function modifyNumberRewardValidationErrors(reward = {}, rootPath = "reward") {
    const errors = [];
    const operation = reward.operation;
    if (!["add", "subtract", "multiply", "divide"].includes(operation)) errors.push(validationError(`${rootPath}.operation`, "enum", "modify_number operation must be add, subtract, multiply, or divide."));
    errors.push(...rewardPathValidationErrors(reward.field_path, `${rootPath}.field_path`));
    const hasLiteral = Object.hasOwn(reward, "value");
    const hasReference = Object.hasOwn(reward, "value_path");
    const hasExpression = Object.hasOwn(reward, "value_expression");
    if ([hasLiteral, hasReference, hasExpression].filter(Boolean).length !== 1) errors.push(validationError(rootPath, "operand", "modify_number requires exactly one of value, value_path, or value_expression."));
    if (hasLiteral && !Number.isFinite(reward.value)) errors.push(validationError(`${rootPath}.value`, "number", "modify_number literal values must be finite numbers."));
    if (hasReference) errors.push(...rewardPathValidationErrors(reward.value_path, `${rootPath}.value_path`));
    if (hasExpression) errors.push(...numericExpressionValidationErrors(reward.value_expression, `${rootPath}.value_expression`));
    if (operation === "divide" && hasLiteral && reward.value === 0) errors.push(validationError(`${rootPath}.value`, "divide_by_zero", "A hardcoded divide-by-zero reward is invalid."));
    if (operation === "divide" && hasExpression) {
      const literalExpression = literalNumericExpressionValue(reward.value_expression);
      if (literalExpression?.numerator === 0n) errors.push(validationError(`${rootPath}.value_expression`, "divide_by_zero", "A hardcoded divide-by-zero reward is invalid."));
    }
    if (Object.hasOwn(reward, "value_character_id") && !hasReference) errors.push(validationError(`${rootPath}.value_character_id`, "dependency", "value_character_id requires value_path."));
    for (const key of ["character_id", "value_character_id"]) {
      if (Object.hasOwn(reward, key) && !textSlot(reward[key], "")) errors.push(validationError(`${rootPath}.${key}`, "required", `${key} must be a non-empty character id when provided.`));
    }
    return errors;
  }
  function matchingObjectiveNextTransition(objective = {}, state = app.state) {
    const items = state?.objectives?.items || [];
    const options = objectiveNextOptions(objective);
    const ordered = [...options.map((option, index) => ({
      option,
      index
    })).filter(entry => !entry.option.fallback), ...options.map((option, index) => ({
      option,
      index
    })).filter(entry => entry.option.fallback)];
    for (const {
      option,
      index
    } of ordered) {
      if (!option.fallback && !requirementsMet(option.requirements || [], state)) continue;
      if (objectiveOutputIsEnding(option)) return {
        option: {
          ...option,
          output_id: objectiveTransitionOutputId(objective, option, index)
        },
        target: null
      };
      const target = items.find(item => String(item.id || "") === String(option.objective_id));
      if (target && !objectiveIsComplete(target) && !objectiveBlockedByExclusiveGroup(target, state)) return {
        option: {
          ...option,
          output_id: objectiveTransitionOutputId(objective, option, index)
        },
        target
      };
    }
    return null;
  }
  function objectiveTransitionDiagnostic(objective = {}, state = app.state, context = {}) {
    const lookup = objectiveRuntimeLookup(state);
    const stateItems = Array.isArray(state?.objectives?.items) ? state.objectives.items : [];
    const completed = completedObjectiveIds(state);
    const transitions = objectiveOutputTransitions(objective);
    const postCompletionRoutes = objectiveNextOptions(objective);
    const transitionRows = transitions.map(transition => {
      const targetId = String(transition.objective_id || transition.next_objective_id || "");
      const target = lookup.byId.get(targetId) || null;
      const inputGroups = lookup.incomingInputGroupsByTargetId.get(targetId);
      return {
        outputId: String(transition.output_id || transition.id || ""),
        targetId,
        fallback: transition.fallback === true,
        transitionRequirements: storyRequirementResults(transition.requirements || [], state),
        targetInStateItems: stateItems.some(item => String(item?.id || "") === targetId),
        targetInRuntimeLookup: !!target,
        targetStatus: target ? effectiveObjectiveStatus(target, state) : "",
        targetComplete: target ? objectiveIsComplete(target, state) : false,
        targetExclusiveBlocked: target ? objectiveBlockedByExclusiveGroup(target, state) : false,
        missingRequiredObjectiveIds: target ? objectiveRequiredIds(target).filter(id => !completed.has(String(id))) : [],
        inputGroups: inputGroups ? [...inputGroups.entries()].map(([groupId, edges]) => ({
          groupId,
          edges: edges.map(edge => {
            const sourceId = String(edge.sourceId || "");
            const selectedOutputId = String(app.objectiveRuntime?.selectedOutputById?.[sourceId] || "");
            return {
              sourceId,
              outputId: String(edge.outputId || ""),
              sourceComplete: completed.has(sourceId),
              selectedOutputId,
              selectedOutputMatches: !selectedOutputId || selectedOutputId === String(edge.outputId || "")
            };
          })
        })) : [],
        prerequisitesMet: target ? objectivePrerequisitesMet(target, state) : false,
        completionRequirements: target ? storyRequirementResults(objectiveCompletionRequirements(target), state) : []
      };
    });
    return {
      objectiveId: String(objective.id || ""),
      objectiveTitle: String(objective.title || ""),
      objectiveStatus: effectiveObjectiveStatus(objective, state),
      authoredNextObjectives: clone(transitions),
      authoredPostCompletionRoutes: clone(postCompletionRoutes),
      transitions: transitionRows,
      storyDefinitionDependentIds: [...(app.storyDefinition?.objectiveDependentsById?.[String(objective.id || "")] || [])],
      runtimeDefinitionDependentIds: [...(app.runtimeDefinitions?.objectiveDependentsById?.[String(objective.id || "")] || [])],
      selectedStandardOutputId: String(context.selectedStandardTransition?.option?.output_id || ""),
      selectedStandardTargetId: String(context.selectedStandardTransition?.target?.id || ""),
      selectedOutputId: String(context.selectedOutputId || ""),
      conditionalNextId: String(context.conditionalNext?.id || ""),
      selectableDependentIds: (context.dependents || []).map(item => String(item?.id || "")),
      expectsContinuation: postCompletionRoutes.length > 0 || transitionRows.some(row => !!row.targetId) || !!app.storyDefinition?.objectiveDependentsById?.[String(objective.id || "")]?.length || !!app.runtimeDefinitions?.objectiveDependentsById?.[String(objective.id || "")]?.length
    };
  }
  function matchingObjectiveNextOption(objective = {}, state = app.state) {
    const match = matchingObjectiveNextTransition(objective, state);
    if (!match || !match.target) return null;
    return objectivePrerequisitesMet(match.target, state) ? match.target : null;
  }
  function objectiveExplicitlySelectable(objective = {}) {
    if (objective.selectable === true) return true;
    return /^(selectable|choice|branch)$/i.test(String(objective.visibility || ""));
  }
  function objectiveExclusiveGroup(objective = {}) {
    return textSlot(objective.exclusive_group, "");
  }
  function objectiveExclusiveChoices(state = app.state) {
    state.objectives ||= {
      active_id: "",
      focus_id: "",
      items: []
    };
    state.objectives.exclusive_group_choices = isPlainObject(state.objectives.exclusive_group_choices) ? state.objectives.exclusive_group_choices : {};
    return state.objectives.exclusive_group_choices;
  }
  function repairAiObjectiveExclusiveChoices(choices = {}) {
    if (!isPlainObject(choices)) return {};
    const out = {};
    for (const [group, objectiveId] of Object.entries(choices)) {
      const cleanGroup = textSlot(group, "");
      const cleanId = textSlot(objectiveId, "");
      if (cleanGroup && cleanId) out[cleanGroup] = cleanId;
    }
    return out;
  }
  function objectiveExclusiveChosenId(group = "", state = app.state) {
    const key = String(group || "").trim();
    if (!key) return "";
    const choices = state?.objectives?.exclusive_group_choices;
    return isPlainObject(choices) ? String(choices[key] || "") : "";
  }
  function chooseObjectiveExclusiveBranch(objective = {}, state = app.state) {
    const group = objectiveExclusiveGroup(objective);
    const id = String(objective?.id || "").trim();
    if (!group || !id) return false;
    const choices = objectiveExclusiveChoices(state);
    if (String(choices[group] || "") === id) return false;
    choices[group] = id;
    return true;
  }
  function recordedObjectiveStatus(idOrObjective, state = app.state) {
    const supplied = typeof idOrObjective === "object" ? idOrObjective : null;
    const id = String(typeof idOrObjective === "string" ? idOrObjective : supplied?.id || "");
    if (!id) return "hidden";
    const explicit = state === app.state ? explicitObjectiveRuntimeStatus(id) : undefined;
    if (explicit != null) return String(explicit);
    const runtimeView = supplied || (state?.objectives?.items || []).find(item => String(item?.id || "") === id);
    if (runtimeView && Object.prototype.hasOwnProperty.call(runtimeView, "status")) return String(runtimeView.status || "hidden");
    const definition = objectiveDefinitionById(id);
    return String(definition?.initialStatus || definition?.status || "hidden");
  }
  function objectiveBlockedByExclusiveGroup(objective = {}, state = app.state) {
    const group = objectiveExclusiveGroup(objective);
    if (!group) return false;
    // An exclusive group is blocked only by a branch that was actually
    // completed. Resolving siblings' effective status here recursively
    // walks prerequisite graphs and can overflow on large stories.
    if (objectiveCompletionStatus(recordedObjectiveStatus(objective, state))) return false;
    const chosenId = objectiveExclusiveChosenId(group, state);
    if (chosenId && String(objective.id || "") !== chosenId) return true;
    const completedInGroup = objectiveRuntimeLookup(state).completedIdsByExclusiveGroup.get(group);
    if (!completedInGroup?.size) return false;
    return completedInGroup.size > 1 || !completedInGroup.has(String(objective.id || ""));
  }
  function objectivePrerequisitesMet(objective = {}, state = app.state) {
    const lookup = objectiveRuntimeLookup(state);
    const authoredRequiredIds = Array.isArray(objective.requires) ? objective.requires.map(String) : [];
    if (authoredRequiredIds.some(id => !lookup.completedIds.has(id))) return false;
    const groups = lookup.incomingInputGroupsByTargetId.get(String(objective.id || ""));
    if (!groups?.size) return true;
    const completed = lookup.completedIds;
    return [...groups.values()].some(edges => {
      const edgesBySourceId = new Map();
      for (const edge of edges) {
        const sourceId = String(edge.sourceId || "");
        if (!edgesBySourceId.has(sourceId)) edgesBySourceId.set(sourceId, []);
        edgesBySourceId.get(sourceId).push(edge);
      }
      return [...edgesBySourceId.entries()].every(([sourceId, sourceEdges]) => {
        if (!completed.has(sourceId)) return false;
        const source = lookup.byId.get(sourceId);
        const selected = String(source?.selected_output_id || app.objectiveRuntime?.selectedOutputById?.[sourceId] || source?.selected_outcome_id || app.objectiveRuntime?.selectedOutcomeById?.[sourceId] || source?.selected_choice_id || app.objectiveRuntime?.selectedChoiceById?.[sourceId] || "");
        if (selected) return sourceEdges.some(edge => String(edge.outputId) === "*" || selected === String(edge.outputId));
        if (sourceEdges.some(edge => String(edge.outputId) === "*")) return true;
        const transitions = objectiveOutputTransitions(source || {});
        return transitions.length === 1 && sourceEdges.some(edge => String(transitions[0].output_id || transitions[0].id) === String(edge.outputId));
      });
    });
  }
  function objectiveCompletionRequirements(objective = {}) {
    return Array.isArray(objective.completion_requirements) ? objective.completion_requirements : [];
  }
  function objectiveCompletionRequirementsMet(objective = {}, state = app.state) {
    return requirementsMet(objectiveCompletionRequirements(objective), state);
  }
  function objectiveCompletionRequirementsText(objective = {}, state = app.state) {
    const missing = storyRequirementResults(objectiveCompletionRequirements(objective), state).filter(item => !item.met);
    if (!missing.length) return "";
    return `Completion requirements not met: ${missing.map(item => item.label).join("; ")}`;
  }
  function objectiveMissingPrerequisites(objective = {}, state = app.state) {
    const completed = completedObjectiveIds(state);
    return objectiveRequiredIds(objective).filter(id => !completed.has(String(id)));
  }
  function objectiveMissingPrerequisitesText(objective = {}, state = app.state) {
    const missing = objectiveMissingPrerequisites(objective, state);
    if (!missing.length) return "";
    const byId = objectiveRuntimeLookup(state).byId;
    const labels = missing.map(id => {
      const item = byId.get(String(id));
      return item?.title || id;
    });
    return `Requires: ${labels.join(", ")}`;
  }
  function objectiveAutoCompletesWhenReady(objective = {}) {
    return objectiveCompletionControl(objective) === "reward_only" && objective.requirement_check_only === true;
  }
  function objectiveCompletionMessage(objective = {}) {
    return textSlot(objective.completion_message, "");
  }
  function objectiveIsDirectChoice(objective = {}) {
    if (!objective || objectiveIsComplete(objective)) return false;
    return objectiveCompletionControl(objective) === "choice";
  }
  function pendingObjectiveChoiceCandidates(state = app.state) {
    const choice = state?.objectives?.pending_choice;
    const ids = Array.isArray(choice?.objective_ids) ? choice.objective_ids : [];
    return ids.map(id => (state?.objectives?.items || []).find(item => String(item.id) === String(id))).filter(item => item && objectiveCanBeSelected(item, state));
  }
  function pendingObjectiveChoiceIsDirect(state = app.state) {
    const choices = pendingObjectiveChoiceCandidates(state);
    return !!choices.length && choices.every(item => objectiveIsDirectChoice(item));
  }
  function objectiveDirectChoiceOptions(objective = {}) {
    const options = Array.isArray(objective?.choices) ? objective.choices : [];
    return options.map((choice, index) => {
      if (!isPlainObject(choice)) return null;
      const id = String(choice.id || "");
      if (!id) return null;
      return {
        ...clone(choice),
        id,
        title: choice.title,
        summary: choice.summary || "",
        status: "active",
        completion_control: "choice",
        type: "choice",
        direct_choice_option: true,
        parent_objective_id: objective.id,
        parent_objective_title: objective.title || objective.id || "",
        choice_response_mode: objectiveChoiceResponseMode(objective),
        completion_requirements: clone(objective.completion_requirements || []),
        player_text: choice.player_text || ""
      };
    }).filter(Boolean);
  }
  function currentDirectChoiceCandidates(state = app.state) {
    const pending = pendingObjectiveChoiceCandidates(state);
    if (pending.length && pending.every(item => objectiveIsDirectChoice(item))) return pending;
    const current = currentObjectiveTarget(state);
    if (!current || !objectiveIsDirectChoice(current)) return [];
    const ownedChoices = objectiveDirectChoiceOptions(current).filter(choice => choice.available_now !== false);
    if (ownedChoices.length) return ownedChoices;
    const group = objectiveExclusiveGroup(current);
    if (!group) return [current];
    return (state.objectives?.items || []).filter(item => item && objectiveIsDirectChoice(item) && objectiveExclusiveGroup(item) === group && objectiveCanBeSelected(item, state));
  }
  function directObjectiveChoiceIsWaiting(state = app.state) {
    return currentDirectChoiceCandidates(state).length > 0;
  }
  function autoModeCompletesObjectivesEnabled() {
    return app.settings?.autoModeCompletesObjectives !== false;
  }
  function directObjectiveChoiceIsSelectable(choice = {}, state = app.state) {
    return !directObjectiveChoiceRequirementResults(choice, state).some(item => !item.met);
  }
  function directObjectiveChoiceRewardTargetsPlayer(reward = {}) {
    const playerName = String(app.state?.player?.name || "").toLowerCase();
    const target = String(reward.target || reward.character || reward.name || reward.entity || "").trim().toLowerCase();
    return !target || target === "player" || playerName && target === playerName;
  }
  function directObjectiveChoiceLooksFatal(choice = {}) {
    const rewards = Array.isArray(choice.rewards) ? choice.rewards : [];
    for (const reward of rewards) {
      if (!isPlainObject(reward)) continue;
      const type = String(reward.type || "").trim();
      if (type === "kill_character" && directObjectiveChoiceRewardTargetsPlayer(reward)) return true;
      if (type === "set_state_field") {
        const path = Array.isArray(reward.field_path) ? reward.field_path.map(String) : [];
        const pathText = path.join(".").toLowerCase();
        if (pathText === "meta.game_over" && reward.value === true) return true;
      }
    }
    return false;
  }
  function autoDirectObjectiveChoicePromptChoices(choices = []) {
    return choices.map((choice, index) => ({
      id: choice.id,
      title: choice.title || choice.id,
      summary: choice.summary || "",
      player_text: choice.choice_response_mode === "exact_text" ? choice.player_text || "" : "",
      requirements: directObjectiveChoiceRequirementResults(choice).map(item => ({
        label: item.label,
        met: !!item.met
      })),
      available: directObjectiveChoiceIsSelectable(choice),
      order: index + 1
    }));
  }
  function buildAutoDirectObjectiveChoicePrompt(choices = []) {
    const playerName = playerNameForPrompt();
    const stateContext = compactJson(buildAutoPlayerTurnStateContext());
    const syncedChatContext = promptStateSyncRangeText(syncedConversationContextForPrompt(6), app.state) || "#";
    const unsyncedChatContext = promptStateSyncRangeText(pendingStateSyncMessages(), app.state) || "#";
    const choiceContext = compactJson(autoDirectObjectiveChoicePromptChoices(choices));
    const currentJobText = currentJobPromptContext(app.state);
    return withUniversalAiPromptContext(`You are playing EmberAdventures for the player in automatic mode.
Choose which direct story choice ${playerName} should select now.

Use the same judgment as the auto-player turn:
- Use ${playerName}'s saved personality, known facts, relationships, current state, and user guidance.
- Only use what ${playerName} could reasonably know from visible chat, current senses, established facts, and player-accessible state.
- Do not use hidden outcomes, objective rewards, future story spoilers, or diagnostic details.
- Pick a selectable choice that feels believable for ${playerName}, not just the most optimal plot route.
- Avoid major irreversible choices, killing, selling, betrayal, rescue, romance, or branch-ending decisions unless visible context clearly points there.
- If one option is a cautious/reversible continuation and another is reckless or fatal-looking, favor the cautious continuation unless ${playerName}'s personality or recent visible context strongly supports the risk.

Return ONLY compact JSON:
{"id":"choice_id","text":""}

Rules:
- id must exactly match one available choice id.
- For a choice with non-empty player_text, return text="" because EmberAdventures submits that exact authored text.
- Otherwise, text is optional spoken player wording. Use "" unless a short natural player line is clearly useful.
- If text is used, write only the words ${playerName} says, without surrounding quotation marks. Never write narrator prose or player actions. EmberAdventures adds the dialogue quotation marks after parsing the JSON.

AVAILABLE CHOICES:
${choiceContext}

STATE ACCESSIBLE TO THE PLAYER:
${stateContext}

${currentJobText ? `${currentJobText}\n\n` : ""}CHAT ALREADY INCLUDED IN STATE, PROVIDED ONLY FOR CONVERSATION CONTEXT:
${syncedChatContext}

CHAT SINCE STATE WAS LAST UPDATED:
${unsyncedChatContext}`, {
      includeStoryRules: false
    });
  }
  async function chooseAutoDirectObjectiveChoiceWithAi(choices = []) {
    const available = choices.filter(choice => directObjectiveChoiceIsSelectable(choice));
    if (!available.length) throw new Error("No selectable auto objective choice was available.");
    const raw = await aiText(buildAutoDirectObjectiveChoicePrompt(choices), {
      label: "auto objective choice",
      process: "auto objective",
      type: "objective",
      throttleKey: "auto-objective-choice",
      stopSequences: ["\n\n"]
    });
    const data = parseJsonObject(raw) || parsePartialTopLevelJsonObject(raw) || {};
    const selectedId = String(data.id || data.choice_id || data.choice || "").trim();
    const objective = available.find(choice => String(choice.id) === selectedId);
    if (!objective) {
      stateTrace("auto direct objective choice AI invalid", {
        label: "objective",
        raw,
        selectedId,
        available: available.map(choice => choice.id),
        summary: "AI returned an invalid direct choice id; auto mode will retry."
      });
      throw new Error(selectedId ? `AI returned invalid choice id: ${selectedId}` : "AI did not return a choice id.");
    }
    const responseText = objective.choice_response_mode === "exact_text" ? textSlot(objective.player_text, "") : formatAutoGeneratedChoiceDialogue(data.text || data.message || "");
    stateTrace("auto direct objective choice AI selected", {
      label: "objective",
      choice: objective.id,
      choiceTitle: objective.title || objective.id,
      responseText,
      summary: "AI selected the direct objective choice for auto mode."
    });
    return {
      objective,
      responseText
    };
  }
  async function runAutoDirectObjectiveChoiceUntilSelected(choiceKey, reason = "auto") {
    let attempt = 0;
    while (app.settings.autoVisualNovel && autoModeCompletesObjectivesEnabled() && directObjectiveChoiceIsWaiting(app.state) && directObjectiveChoiceAutoOpenKey(app.state) === choiceKey && !gameIsOver()) {
      attempt += 1;
      const choices = currentDirectChoiceCandidates(app.state);
      try {
        const {
          objective,
          responseText
        } = await chooseAutoDirectObjectiveChoiceWithAi(choices);
        return submitDirectObjectiveChoice(objective.id, {
          responseText,
          closeModal: false,
          autoMode: true
        });
      } catch (err) {
        stateTrace("auto direct objective choice retry", {
          label: "objective",
          reason,
          attempt,
          error: err?.message || String(err),
          choices: choices.map(choice => choice.id),
          summary: "Auto mode failed to get a valid AI choice and will retry."
        });
        setTurnStage("objective", `Choosing story path... retry ${attempt + 1}`);
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    }
    return false;
  }
  function beginAutoDirectObjectiveChoice(reason = "auto") {
    if (!app.settings.autoVisualNovel) return false;
    if (!autoModeCompletesObjectivesEnabled()) return false;
    if (!directObjectiveChoiceIsWaiting(app.state)) return false;
    if (app.autoDirectObjectiveChoiceInProgress) return true;
    if (mainModalOpen()) return false;
    const initialChoices = currentDirectChoiceCandidates(app.state);
    if (!initialChoices.some(choice => directObjectiveChoiceIsSelectable(choice))) return false;
    const choiceKey = directObjectiveChoiceAutoOpenKey(app.state);
    if (!choiceKey) return false;
    app.autoDirectObjectiveChoiceInProgress = true;
    setTurnStage("objective", "Choosing story path...");
    stateTrace("auto direct objective choice started", {
      label: "objective",
      reason,
      choices: initialChoices.map(item => ({
        id: item.id,
        title: item.title || item.id,
        selectable: directObjectiveChoiceIsSelectable(item),
        fatal: directObjectiveChoiceLooksFatal(item)
      })),
      summary: "Auto mode is asking AI to select a direct choice objective."
    });
    runAutoDirectObjectiveChoiceUntilSelected(choiceKey, reason).catch(err => {
      stateTrace("auto direct objective choice failed", {
        label: "objective",
        error: err?.message || String(err),
        summary: err?.message || String(err)
      });
      addMessage("system", "Auto objective choice failed: " + (err?.message || err));
      setTurnStage("error", "Auto objective choice failed");
      render();
    }).finally(() => {
      app.autoDirectObjectiveChoiceInProgress = false;
      const shouldResumeAuto = app.settings.autoVisualNovel && !gameIsOver() && app.turnStage !== "error" && !mainModalOpen();
      stateTrace("auto direct objective choice finished", {
        label: "objective",
        reason,
        resumeAuto: shouldResumeAuto,
        summary: shouldResumeAuto ? "Auto mode is continuing after the direct objective choice finished." : "Auto mode will not continue after the direct objective choice finished."
      });
      if (shouldResumeAuto) maybeEnqueueAutoVisualNovelTurn("direct objective choice finished");
    });
    return true;
  }
  async function confirmDirectObjectiveChoice(objectiveId) {
    return submitDirectObjectiveChoice(objectiveId, {
      responseText: $("directObjectiveChoiceText")?.value || "",
      closeModal: true,
      autoMode: false
    });
  }
  function directObjectiveChoiceAutoOpenKey(state = app.state) {
    const choices = currentDirectChoiceCandidates(state);
    if (!choices.length) return "";
    const ids = choices.map(item => String(item.id || "")).sort().join("|");
    return [app.currentGameSaveId || app.activeSaveId || "unsaved", state?.objectives?.active_id || "", state?.objectives?.focus_id || "", ids].join("::");
  }
  function cancelDirectObjectiveChoiceAutoOpen() {
    if (app.directObjectiveChoiceAutoOpenTimer) clearTimeout(app.directObjectiveChoiceAutoOpenTimer);
    app.directObjectiveChoiceAutoOpenTimer = null;
    app.directObjectiveChoiceAutoOpenReadingMessageId = "";
  }
  function scheduleDirectObjectiveChoiceAutoOpen(reason = "direct choice", readingMessageId = app.activeVoiceMessageId) {
    if (!directObjectiveChoiceIsWaiting(app.state)) return false;
    if (beginAutoDirectObjectiveChoice(reason)) return true;
    if (readingMessageId == null || readingMessageId === "") return false;
    const readingMessage = findEntryById(readingMessageId);
    if (readingMessage?.role !== "assistant") return false;
    const key = directObjectiveChoiceAutoOpenKey(app.state);
    if (!key || app.directObjectiveChoiceAutoOpenKey === key) return false;
    app.directObjectiveChoiceAutoOpenKey = key;
    cancelDirectObjectiveChoiceAutoOpen();
    app.directObjectiveChoiceAutoOpenReadingMessageId = String(readingMessageId);
    stateTrace("direct objective choice auto-open armed", {
      label: "objective",
      reason,
      readingMessageId: String(readingMessageId),
      choices: currentDirectChoiceCandidates(app.state).map(item => item.id),
      summary: "Waiting for active screen-reader playback to finish before opening the choice menu."
    });
    return true;
  }
  function finishDirectObjectiveChoiceAutoOpenAfterReading(messageId) {
    const readingMessageId = String(app.directObjectiveChoiceAutoOpenReadingMessageId || "");
    if (!readingMessageId || readingMessageId !== String(messageId || "")) return false;
    const key = app.directObjectiveChoiceAutoOpenKey;
    app.directObjectiveChoiceAutoOpenReadingMessageId = "";
    if (app.directObjectiveChoiceAutoOpenTimer) clearTimeout(app.directObjectiveChoiceAutoOpenTimer);
    app.directObjectiveChoiceAutoOpenTimer = setTimeout(() => {
      app.directObjectiveChoiceAutoOpenTimer = null;
      if (!directObjectiveChoiceIsWaiting(app.state)) return;
      if (app.mainMenuOpen || !app.state?.meta?.setup_complete) return;
      if (mainModalOpen()) return;
      if (directObjectiveChoiceAutoOpenKey(app.state) !== key) return;
      cancelDirectObjectiveChoiceAutoOpen();
      openDirectObjectiveChoiceModal();
      stateTrace("direct objective choice auto-opened", {
        label: "objective",
        reason: "screen reader finished",
        choices: currentDirectChoiceCandidates(app.state).map(item => item.id),
        summary: "Opened direct objective choice menu for the newly active choice set."
      });
    }, 1000);
    return true;
  }
  function objectiveDependentsOf(objectiveId, state = app.state) {
    const id = String(objectiveId || "");
    if (!id) return [];
    const byId = objectiveRuntimeLookup(state).byId;
    ensureRuntimeJobObjectiveIndexes(app.runtimeDefinitions);
    const dependentIds = new Set(app.storyDefinition?.objectiveDependentsById?.[id] || []);
    for (const dependentId of app.runtimeDefinitions?.objectiveDependentsById?.[id] || []) dependentIds.add(dependentId);
    const statusCache = new Map();
    return [...dependentIds].map(dependentId => byId.get(String(dependentId))).filter(item => item && !objectiveIsComplete(item, state, statusCache));
  }
  function selectableObjectiveDependentsOf(objectiveId, state = app.state) {
    return objectiveDependentsOf(objectiveId, state).filter(item => objectiveCanBeSelected(item, state) && !objectiveAutoCompletesWhenReady(item));
  }
  function clearObjectiveChoiceState(state = app.state) {
    if (!state?.objectives) return;
    delete state.objectives.pending_choice;
  }
  function objectiveCanBeShown(objective = {}, state = app.state, resolvedStatusCache = null) {
    if (!objective || objectiveIsComplete(objective, state, resolvedStatusCache)) return false;
    if (objectiveBlockedByExclusiveGroup(objective, state)) return false;
    if (!objectivePrerequisitesMet(objective, state)) return false;
    return !/^(hidden|locked|future)$/i.test(effectiveObjectiveStatus(objective, state, resolvedStatusCache));
  }
  function objectiveCanBeSelected(objective = {}, state = app.state, resolvedStatusCache = null) {
    if (!objectiveCanBeShown(objective, state, resolvedStatusCache)) return false;
    return objective.available_now !== false && objectiveCompletionRequirementsMet(objective, state);
  }
  function updateObjectivePrerequisiteLockEntry(objective, state = app.state) {
    if (!objective || objectiveIsComplete(objective, state)) return [];
    captureObjectiveMutationEntry(state, objective);
    const required = objectiveRequiredIds(objective);
    const incomingGroups = objectiveRuntimeLookup(state).incomingInputGroupsByTargetId.get(String(objective.id || ""));
    if (objectiveBlockedByExclusiveGroup(objective, state)) {
      objective.available_now = false;
      setObjectiveRuntimeStatus(state, objective, "hidden");
      objective.blocked_reason = `Another path in ${objectiveExclusiveGroup(objective)} has already been chosen.`;
      return [];
    }
    if (!required.length && !incomingGroups?.size) return [];
    if (objectivePrerequisitesMet(objective, state)) {
      objective.available_now = true;
      if (/^(hidden|locked|future)$/i.test(effectiveObjectiveStatus(objective, state))) setObjectiveRuntimeStatus(state, objective, "queued");
      if (/^Requires:/i.test(String(objective.blocked_reason || ""))) objective.blocked_reason = "";
    } else {
      objective.available_now = false;
      setObjectiveRuntimeStatus(state, objective, "hidden");
      objective.blocked_reason = objectiveMissingPrerequisitesText(objective, state);
    }
    return [];
  }
  function objectiveIdsAffectedByRuntimeChange(objectiveIds = [], state = app.state) {
    const affected = new Set();
    for (const id of new Set((objectiveIds || []).map(String).filter(Boolean))) {
      for (const dependent of objectiveDependentsOf(id, state)) {
        const dependentId = String(dependent?.id || "");
        if (dependentId) affected.add(dependentId);
      }
      const objective = objectiveRuntimeLookup(state).byId.get(id);
      const group = objectiveExclusiveGroup(objective || authoredObjectiveDefinition(id) || {});
      if (group) {
        const authoredIds = app.storyDefinition?.objectiveIdsByExclusiveGroup?.[group] || [];
        for (const siblingId of authoredIds) affected.add(String(siblingId));
        ensureRuntimeJobObjectiveIndexes(app.runtimeDefinitions);
        for (const siblingId of app.runtimeDefinitions?.objectiveIdsByExclusiveGroup?.[group] || []) affected.add(String(siblingId));
      }
    }
    return affected;
  }
  function updateObjectivePrerequisiteLocks(state = app.state, changedObjectiveIds = null) {
    const items = state?.objectives?.items || [];
    if (!Array.isArray(changedObjectiveIds) || !changedObjectiveIds.length) return state;
    const byId = objectiveRuntimeLookup(state).byId;
    const queue = [...objectiveIdsAffectedByRuntimeChange(changedObjectiveIds, state)];
    const queued = new Set(queue);
    let guard = 0;
    while (queue.length) {
      app.performanceMetrics ||= {};
      app.performanceMetrics.objectiveDependencyVisits = Number(app.performanceMetrics.objectiveDependencyVisits || 0) + 1;
      if (++guard > items.length + 32) throw new Error("Objective dependency update exceeded its bounded traversal.");
      const id = queue.shift();
      queued.delete(id);
      const autoCompleted = updateObjectivePrerequisiteLockEntry(byId.get(id), state);
      for (const completedId of autoCompleted) {
        for (const affectedId of objectiveIdsAffectedByRuntimeChange([completedId], state)) {
          if (!queued.has(affectedId)) {
            queued.add(affectedId);
            queue.push(affectedId);
          }
        }
      }
    }
    return state;
  }
  function mainStoryObjectives(state = app.state) {
    return (state?.objectives?.items || []).filter(objective => !objectiveIsSide(objective));
  }
  function allMainStoryObjectivesComplete(items = app.state.objectives?.items || []) {
    const statusCache = new Map();
    let hasMainObjective = false;
    for (const objective of items) {
      if (objectiveIsSide(objective)) continue;
      hasMainObjective = true;
      if (!objectiveIsComplete(objective, app.state, statusCache)) return false;
    }
    return hasMainObjective;
  }
  function objectiveCanBeAddedByAi(objective, existingItems) {
    if (!objective?.id) return false;
    if (objectiveIsSide(objective)) return true;
    return allMainStoryObjectivesComplete(existingItems);
  }
  function completedObjectiveIds(state = app.state) {
    return objectiveRuntimeLookup(state).completedIds;
  }
  function objectiveDebugSnapshot(state = app.state) {
    return (state?.objectives?.items || []).map(objective => ({
      id: objective?.id || "",
      title: objective?.title || "",
      type: objective?.type || "",
      status: effectiveObjectiveStatus(objective, state),
      requires: objectiveRequiredIds(objective)
    }));
  }
  function objectiveDebugDelta(beforeState, afterState) {
    const before = new Map(objectiveDebugSnapshot(beforeState).map(objective => [objective.id, objective]));
    return objectiveDebugSnapshot(afterState).map(after => {
      const prior = before.get(after.id);
      if (!prior) return {
        id: after.id,
        change: "added",
        after
      };
      const changes = {};
      if (prior.status !== after.status) changes.status = {
        before: prior.status,
        after: after.status
      };
      return Object.keys(changes).length ? {
        id: after.id,
        title: after.title,
        type: after.type,
        changes
      } : null;
    }).filter(Boolean);
  }
  function completeTravelObjectivesForCurrentLocation(state = app.state) {
    const currentId = String(state.world_map?.current_location_id || "");
    const currentNode = currentId ? state.world_map?.locations?.[currentId] : null;
    const names = new Set([currentId, currentNode?.name, state.location?.specific_place, state.location?.district, state.location?.settlement_name, state.location?.region, state.location?.world].map(value => String(value || "").trim().toLowerCase()).filter(Boolean));
    let changed = false;
    const completedTravelObjectiveIds = [];
    for (const objective of state.objectives?.items || []) {
      if (objectiveIsComplete(objective)) continue;
      if (String(objective.type || "").toLowerCase() !== "travel") continue;
      const targetId = String(objective.travel_location_id || "").toLowerCase();
      const targetName = String(objective.travel_location_name || objective.location_name || objective.summary || objective.title || "").trim().toLowerCase();
      if (targetId && names.has(targetId) || targetName && names.has(targetName)) {
        troubleshootingLog("travel objective completion", {
          objectiveId: objective.id,
          title: objective.title,
          currentId,
          names: [...names],
          targetId,
          targetName
        });
        setObjectiveRuntimeStatus(state, objective, "complete");
        completedTravelObjectiveIds.push(String(objective.id || ""));
        changed = true;
        noteRewardChange(state, `Travel objective completed: ${objective.title || targetName}.`);
      }
    }
    if (changed) updateObjectivePrerequisiteLocks(state, completedTravelObjectiveIds);
    if (changed) troubleshootingLog("travel objective completion delta", () => ({
      completedObjectiveIds: completedTravelObjectiveIds
    }));
    return changed;
  }
  function applyObjectiveProgressRewards(beforeState, afterState, source, options = {}) {
    troubleshootingLog("objective reward pass start", () => ({
      source,
      silentGameMessage: !!options.silentGameMessage,
      preExistingDelta: objectiveDebugDelta(beforeState, afterState)
    }));
    completeTravelObjectivesForCurrentLocation(afterState);
    const previousRewardMessageBuffer = app.objectiveRewardMessageBuffer;
    const previousUnlockGreetingBuffer = app.objectiveUnlockGreetingBuffer;
    if (options.silentGameMessage) app.objectiveRewardMessageBuffer = [];
    app.objectiveUnlockGreetingBuffer = [];
    let completedRewardApplied = false;
    let timedEventsApplied = false;
    let storyTimelineApplied = false;
    let rewardOnlyApplied = false;
    let rewardMessages = [];
    let unlockGreetings = [];
    try {
      completedRewardApplied = applyCompletedObjectiveRewards(beforeState, afterState, source);
      timedEventsApplied = processTimedEvents(afterState, source);
      storyTimelineApplied = processStoryTimeline(afterState, source);
      if (!options.skipRewardOnlyResolve) rewardOnlyApplied = resolveReadyRewardOnlyObjectives(afterState, source, {
        silentGameMessage: options.silentGameMessage
      });
      rewardMessages = Array.isArray(app.objectiveRewardMessageBuffer) ? [...app.objectiveRewardMessageBuffer] : [];
      unlockGreetings = Array.isArray(app.objectiveUnlockGreetingBuffer) ? [...app.objectiveUnlockGreetingBuffer] : [];
    } finally {
      app.objectiveRewardMessageBuffer = previousRewardMessageBuffer;
      app.objectiveUnlockGreetingBuffer = previousUnlockGreetingBuffer;
    }
    syncObjectiveRuntimeControls(afterState);
    troubleshootingLog("objective reward pass computed", () => ({
      source,
      totalDelta: objectiveDebugDelta(beforeState, afterState),
      completedRewardApplied,
      timedEventsApplied,
      storyTimelineApplied,
      rewardOnlyApplied
    }));
    return completedRewardApplied || timedEventsApplied || storyTimelineApplied || rewardOnlyApplied ? {
      applied: true,
      message: "",
      completedRewardApplied,
      timedEventsApplied,
      storyTimelineApplied,
      rewardOnlyApplied,
      rewardMessages,
      unlockGreetings
    } : null;
  }
  function objectiveIsRewardOnly(objective = {}) {
    return objectiveCompletionControl(objective) === "reward_only";
  }
  function resolveReadyRewardOnlyObjectives(state = app.state, source = "reward-only objective", options = {}) {
    state.objectives ||= {
      active_id: "",
      items: []
    };
    let changed = false;
    const queued = new Set();
    const queue = [];
    const enqueue = objective => {
      const id = String(objective?.id || "");
      if (!id || queued.has(id) || !objectiveIsRewardOnly(objective) || objectiveIsComplete(objective) || !objectiveCanBeSelected(objective, state)) return;
      queued.add(id);
      queue.push(objective);
    };
    const initial = state.objectives.items || [];
    const activeId = String(state.objectives.active_id || "");
    const focusId = String(state.objectives.focus_id || "");
    enqueue(initial.find(item => String(item?.id || "") === activeId));
    enqueue(initial.find(item => String(item?.id || "") === focusId));
    for (const objective of initial) enqueue(objective);
    while (queue.length) {
      const objective = queue.shift();
      queued.delete(String(objective?.id || ""));
      if (objectiveIsComplete(objective) || !objectiveCanBeSelected(objective, state)) continue;
      const beforeCompletion = clone(state);
      const completed = completeCurrentObjective(state, objective.id);
      if (!completed) continue;
      applyObjectiveProgressRewards(beforeCompletion, state, `${source}: reward-only`, {
        silentGameMessage: options.silentGameMessage,
        skipRewardOnlyResolve: true
      });
      changed = true;
      for (const dependent of objectiveDependentsOf(objective.id, state)) enqueue(dependent);
    }
    return changed;
  }
  function flushObjectiveUnlockGreetings(rewardResult = null) {
    const greetings = Array.isArray(rewardResult?.unlockGreetings) ? rewardResult.unlockGreetings : [];
    for (const greeting of greetings) {
      if (!greeting?.text || !greeting?.speaker) continue;
      addObjectiveUnlockGreetingMessage(greeting);
    }
  }
  function addObjectiveUnlockGreetingMessage(greeting = {}) {
    const speaker = sanitizeSpeakerMetadataName(greeting.speaker);
    const text = textSlot(greeting.text, "");
    if (!speaker || !text) return null;
    // Objective reward greetings are story dialogue, not system/reward text.
    // Keep them immediately after the objective-complete message as normal
    // assistant chat from the unlocked NPC, and read them with that voice.
    const message = addMessage("assistant", text, speaker, {
      gameMessageType: "unlock_greeting"
    });
    render();
    if (app.settings.autoVoice && !voiceIsPaused()) readMessage(message.id, {
      appendIfBusy: true,
      sequence: false
    });
    return message;
  }
  function rewardStateRootFromFieldPath(reward = {}) {
    if (reward.character_id || reward.target || reward.character || reward.name) return "characters";
    const path = objectiveRewardPath(reward);
    return path.length ? String(path[0] || "") : "";
  }
  function canonicalRewardSceneListValue(state, path = [], value) {
    if (path[0] !== "scene" || !["party_members_present", "npcs_present", "image_characters"].includes(path[1]) || typeof value !== "string") return value;
    return resolveEntityName(value, state, value) || value;
  }
  function canonicalRewardSceneList(state, path = [], value) {
    if (!Array.isArray(value)) return value;
    return value.map(item => canonicalRewardSceneListValue(state, path, item));
  }
  function objectiveRewardTouchedRoots(reward = {}) {
    const type = String(reward?.type || "").trim();
    const path = objectiveRewardPath(reward);
    const roots = new Set(["recent_changes"]);
    const add = (...values) => values.filter(Boolean).forEach(value => roots.add(value));
    switch (type) {
      case "introduce_future_character":
        add("future_cast", "npc_directory", "scene", "objectives", "images");
        break;
      case "make_future_character_recruitable":
        add("future_cast", "npc_directory");
        break;
      case "promote_future_character_to_party":
        add("future_cast", "npc_directory", "characters", "scene", "objectives", "images");
        break;
      case "replace_character_definition":
        add("future_cast", "player", "characters", "npc_directory", "scene", "images");
        break;
      case "remove_character_shop_listing":
        add("story_shops");
        break;
      case "add_item":
      case "grant_item":
      case "grant_outfit":
      case "equip_outfit":
      case "delete_outfit":
      case "delete_all_outfits":
      case "adjust_relationship":
      case "kill_character":
        add("player", "characters", "npc_directory", "scene");
        break;
      case "add_story_item":
      case "adjust_story_inventory":
        add("story_inventory");
        break;
      case "advance_time":
        add("story_clock", "timed_events", "story_pacing");
        break;
      case "unlock_location":
        add("world_map", "location");
        break;
      case "add_story_rule":
      case "remove_story_rule":
        add("story_rules");
        break;
      case "set_state_field":
      case "modify_integer":
      case "modify_number":
      case "add_state_list_item":
      case "remove_state_list_item":
        add(rewardStateRootFromFieldPath(reward));
        if (path[0] === "scene" && ["party_members_present", "npcs_present", "image_characters"].includes(path[1])) add("characters", "npc_directory");
        if (reward.character_id || reward.target || reward.character || reward.name) add("player", "characters", "npc_directory");
        break;
      case "start_objective":
      case "complete_objective":
        add("objectives");
        break;
      case "complete_generated_job":
        add("active_generated_jobs", "story_shops", "location", "scene", "story_inventory", "objectives", "story_job_offers", "story_job_offer_history");
        break;
      case "generate_profile_image":
        add("player", "characters", "npc_directory");
        break;
      case "generate_solo_normal_image":
      case "generate_story_image":
        add("images");
        break;
    }
    return roots;
  }
  function rewardApplicationRoots(applications = []) {
    const roots = new Set();
    for (const application of applications) {
      for (const rootName of objectiveRewardTouchedRoots(application.reward)) roots.add(rootName);
    }
    return roots;
  }
  function cloneStateRoots(state, roots = new Set()) {
    const snapshot = new Map();
    captureStateRoots(state, snapshot, roots);
    return snapshot;
  }
  function captureStateRoots(state, snapshot = new Map(), roots = new Set()) {
    for (const rootName of roots) {
      if (snapshot.has(rootName)) continue;
      const exists = Object.prototype.hasOwnProperty.call(state || {}, rootName);
      snapshot.set(rootName, {
        exists,
        value: exists ? runtimeSaveCloneValue(state[rootName]) : undefined
      });
    }
    return snapshot;
  }
  function stateDraftForRoots(state, roots = new Set()) {
    const draft = {
      ...runtimeSaveUnwrap(state || {})
    };
    for (const rootName of roots) draft[rootName] = runtimeSaveCloneValue(runtimeSaveUnwrap(state?.[rootName]));
    return draft;
  }
  function restoreStateRoots(state, snapshot = new Map()) {
    for (const [rootName, entry] of snapshot) {
      if (entry.exists) state[rootName] = runtimeSaveCloneValue(entry.value);else delete state[rootName];
    }
  }
  function captureRewardTransactionInfrastructure(invocationIds = []) {
    const operationLengths = {};
    const operationIndexes = {};
    for (const [kind, operations] of Object.entries(runtimeSaveMutationTracker.operations)) {
      operationLengths[kind] = operations.length;
      operationIndexes[kind] = new Map(runtimeSaveMutationTracker.operationIndexByKind[kind]);
    }
    const rewardInvocationBefore = new Map();
    const applied = app.rewardRuntime?.appliedInvocationIds || {};
    for (const rawId of invocationIds || []) {
      const id = String(rawId || "");
      if (!id || rewardInvocationBefore.has(id)) continue;
      const existed = Object.prototype.hasOwnProperty.call(applied, id);
      rewardInvocationBefore.set(id, {
        existed,
        value: existed ? runtimeSaveCloneValue(applied[id]) : undefined
      });
    }
    return {
      dirtyRecords: new Map(runtimeAggregateDirtyTracker.records),
      dirtyMessages: new Map(runtimeAggregateDirtyTracker.messages),
      dirtySnapshots: new Map(runtimeAggregateDirtyTracker.snapshots),
      dirtyImages: new Map(runtimeAggregateDirtyTracker.images),
      baselineRequired: runtimeAggregateDirtyTracker.baselineRequired,
      operationLengths,
      operationIndexes,
      snapshotOperationLength: runtimeSaveMutationTracker.snapshotStateOperations.length,
      snapshotBeforeByPath: new Map(runtimeSaveMutationTracker.snapshotBeforeByPath),
      rewardInvocationBefore,
      // These are bounded mutable aggregates that reward handlers may
      // update directly. Objective entries are handled by the dedicated
      // affected-entry objective transaction, and immutable runtime
      // definitions are never copied into reward rollback state.
      jobRuntime: runtimeSaveCloneValue(app.jobRuntime),
      storyRulesRuntime: runtimeSaveCloneValue(app.storyRulesRuntime),
      runtimeDefinitionKeys: {
        jobs: new Set(Object.keys(app.runtimeDefinitions?.jobsById || {})),
        characters: new Set(Object.keys(app.runtimeDefinitions?.charactersById || {})),
        locations: new Set(Object.keys(app.runtimeDefinitions?.locationsById || {}))
      },
      rewardMessageLength: Array.isArray(app.objectiveRewardMessageBuffer) ? app.objectiveRewardMessageBuffer.length : null,
      unlockGreetingLength: Array.isArray(app.objectiveUnlockGreetingBuffer) ? app.objectiveUnlockGreetingBuffer.length : null
    };
  }
  function restoreRewardTransactionInfrastructure(snapshot = {}) {
    runtimeAggregateDirtyTracker.records = new Map(snapshot.dirtyRecords || []);
    runtimeAggregateDirtyTracker.messages = new Map(snapshot.dirtyMessages || []);
    runtimeAggregateDirtyTracker.snapshots = new Map(snapshot.dirtySnapshots || []);
    runtimeAggregateDirtyTracker.images = new Map(snapshot.dirtyImages || []);
    runtimeAggregateDirtyTracker.baselineRequired = snapshot.baselineRequired === true;
    for (const [kind, length] of Object.entries(snapshot.operationLengths || {})) {
      runtimeSaveMutationTracker.operations[kind].length = length;
      runtimeSaveMutationTracker.operationIndexByKind[kind] = new Map(snapshot.operationIndexes?.[kind] || []);
    }
    runtimeSaveMutationTracker.snapshotStateOperations.length = Number(snapshot.snapshotOperationLength) || 0;
    runtimeSaveMutationTracker.snapshotBeforeByPath = new Map(snapshot.snapshotBeforeByPath || []);
    app.rewardRuntime ||= {
      appliedInvocationIds: {}
    };
    app.rewardRuntime.appliedInvocationIds ||= {};
    for (const [id, entry] of snapshot.rewardInvocationBefore || []) {
      if (entry?.existed) app.rewardRuntime.appliedInvocationIds[id] = runtimeSaveCloneValue(entry.value);else delete app.rewardRuntime.appliedInvocationIds[id];
    }
    app.jobRuntime = runtimeSaveCloneValue(snapshot.jobRuntime) || {
      activeJobsById: {},
      runtimeByJobId: {}
    };
    app.storyRulesRuntime = runtimeSaveCloneValue(snapshot.storyRulesRuntime) || {
      added: [],
      removedKeys: []
    };
    app.runtimeDefinitions ||= {
      jobsById: {},
      charactersById: {},
      locationsById: {}
    };
    for (const [bucket, property] of [["jobs", "jobsById"], ["characters", "charactersById"], ["locations", "locationsById"]]) {
      const retained = snapshot.runtimeDefinitionKeys?.[bucket] || new Set();
      for (const id of Object.keys(app.runtimeDefinitions[property] || {})) {
        if (!retained.has(id)) delete app.runtimeDefinitions[property][id];
      }
    }
    if (snapshot.rewardMessageLength != null && Array.isArray(app.objectiveRewardMessageBuffer)) app.objectiveRewardMessageBuffer.length = snapshot.rewardMessageLength;
    if (snapshot.unlockGreetingLength != null && Array.isArray(app.objectiveUnlockGreetingBuffer)) app.objectiveUnlockGreetingBuffer.length = snapshot.unlockGreetingLength;
  }
  function captureRewardTransactionInvocationIds(snapshot = {}, invocationIds = []) {
    snapshot.rewardInvocationBefore ||= new Map();
    const applied = app.rewardRuntime?.appliedInvocationIds || {};
    for (const rawId of invocationIds || []) {
      const id = String(rawId || "");
      if (!id || snapshot.rewardInvocationBefore.has(id)) continue;
      const existed = Object.prototype.hasOwnProperty.call(applied, id);
      snapshot.rewardInvocationBefore.set(id, {
        existed,
        value: existed ? runtimeSaveCloneValue(applied[id]) : undefined
      });
    }
  }
  function rewardInvocationIdForSite({
    sourceType = "reward",
    sourceId = "source",
    siteId = "default",
    entry = {},
    rewardIndex = 0
  } = {}) {
    // Reward entry positions are generated internally. A legacy/expanded
    // bundle may contain punctuation-only path fragments, which are not a
    // user-facing validation error and must not strand an interaction in a
    // Choice Failed modal. Preserve uniqueness with a stable hash instead.
    const invocationPart = (value, fallback) => {
      try {
        return safeRuntimeIdPart(value);
      } catch {
        const raw = String(value ?? "");
        return `${fallback}-${stableStringHash(raw || fallback)}`;
      }
    };
    const sourcePart = `${invocationPart(sourceType, "reward")}-${invocationPart(sourceId, "source")}`;
    // A site can deliberately contain `--` segments (for example a shop
    // listing plus its purchase number). Preserve those structural
    // separators while sanitizing each authored component.
    const sitePart = String(siteId || "default").split("--").filter(Boolean).map((part, index) => invocationPart(part, `site-${index}`)).join("--") || "default";
    const positionParts = [entry.invocationPosition?.slotId ?? entry.invocationPosition?.slotIndex ?? rewardIndex ?? "0"].filter(part => part != null && String(part).trim() !== "");
    const position = (positionParts.length ? positionParts : [rewardIndex ?? "0"]).map((part, index) => invocationPart(part, `position-${index}`)).join("--");
    return `${sourcePart}--site-${sitePart}--reward-${position}`;
  }
  function objectiveRewardInvocationId(objective = {}, entry = {}) {
    return rewardInvocationIdForSite({
      sourceType: "objective",
      sourceId: objective.id || "objective",
      siteId: entry.routeId ? `route-${entry.routeId}` : "route-default",
      entry,
      rewardIndex: entry.rewardIndex
    });
  }
  function rewardApplicationGroupsForEntries({
    state = app.state,
    objective = {},
    entries = [],
    sourceType = "reward",
    sourceId = "source",
    siteId = "default"
  } = {}) {
    app.rewardRuntime ||= {
      appliedInvocationIds: {}
    };
    app.rewardRuntime.appliedInvocationIds ||= {};
    const groups = new Map();
    for (const [index, entry] of entries.entries()) {
      const invocationId = rewardInvocationIdForSite({
        sourceType,
        sourceId,
        siteId,
        entry,
        rewardIndex: index
      });
      if (app.rewardRuntime.appliedInvocationIds[invocationId]) continue;
      const group = groups.get(invocationId) || {
        invocationId,
        objective,
        sourceType,
        sourceId: String(sourceId || ""),
        applications: []
      };
      group.applications.push({
        objective,
        reward: entry.reward,
        invocationId,
        rewardIndex: index,
        rewardPath: entry.rewardPath || `reward:${index}`,
        routeId: entry.routeId || ""
      });
      groups.set(invocationId, group);
    }
    return groups;
  }
  function applyRewardApplicationGroupsAtomically(state, groups = new Map(), source = "reward", options = {}) {
    const activeGroups = [...groups.values()].filter(group => Array.isArray(group.applications) && group.applications.length);
    const applications = activeGroups.flatMap(group => group.applications);
    if (!applications.length && typeof options.applyBaseEffects !== "function") return false;
    const roots = rewardApplicationRoots(applications);
    roots.delete("objectives");
    for (const rootName of options.extraRoots || []) roots.add(rootName);
    const draft = stateDraftForRoots(state, roots);
    if (typeof options.prepareDraft === "function") options.prepareDraft(draft);
    if (applications.length) preflightObjectiveRewardApplications(draft, applications, source, {
      reportFailure: options.reportFailure !== false
    });
    const existingTransaction = app.activeRewardApplicationTransaction;
    const ownsTransaction = !existingTransaction || existingTransaction.state !== state;
    const rewardTransaction = ownsTransaction ? {
      state,
      stateBackup: cloneStateRoots(state, roots),
      infrastructureBackup: captureRewardTransactionInfrastructure(activeGroups.map(group => group.invocationId)),
      clothingImageTargets: new Set()
    } : existingTransaction;
    if (ownsTransaction) app.activeRewardApplicationTransaction = rewardTransaction;else {
      captureStateRoots(state, rewardTransaction.stateBackup, roots);
      captureRewardTransactionInvocationIds(rewardTransaction.infrastructureBackup, activeGroups.map(group => group.invocationId));
    }
    const objectiveTransaction = beginObjectiveMutationTransaction(state, `${source}: reward objective runtime`);
    try {
      let any = false;
      const applyRewardGroups = () => {
        for (const group of activeGroups) {
          for (const application of group.applications) {
            if (applyObjectiveReward(state, application.objective, application.reward, source)) any = true;
          }
          app.rewardRuntime.appliedInvocationIds[group.invocationId] = {
            appliedAt: new Date().toISOString(),
            sourceType: String(group.sourceType || "reward"),
            sourceId: String(group.sourceId || "")
          };
        }
      };
      if (options.applyRewardsBeforeBaseEffects === true) {
        applyRewardGroups();
        if (typeof options.applyBaseEffects === "function") options.applyBaseEffects(state);
      } else {
        if (typeof options.applyBaseEffects === "function") options.applyBaseEffects(state);
        applyRewardGroups();
      }
      if (activeGroups.length) {
        markRuntimeRecordDirty("reward-runtime", "current");
        bumpDomainRevision("rewards");
      }
      finishObjectiveMutationTransaction(objectiveTransaction, true);
      if (ownsTransaction) for (const targetName of rewardTransaction.clothingImageTargets) queueOneOffCharacterImage(targetName, `${targetName} reward clothing changed`, {
        kind: "clothing",
        immediate: true
      });
      return any || options.baseEffectsCountAsApplied === true;
    } catch (error) {
      finishObjectiveMutationTransaction(objectiveTransaction, false);
      if (ownsTransaction) {
        restoreStateRoots(state, rewardTransaction.stateBackup);
        restoreRewardTransactionInfrastructure(rewardTransaction.infrastructureBackup);
        rebuildGeneratedJobObjectiveViews(state);
      }
      if (!applications.length) throw error;
      throw reportObjectiveRewardApplicationFailure(error, applications.find(application => String(error?.message || "").includes(application.rewardPath)) || applications[0], source, {
        reportFailure: options.reportFailure !== false
      });
    } finally {
      if (ownsTransaction && app.activeRewardApplicationTransaction === rewardTransaction) app.activeRewardApplicationTransaction = null;
    }
  }
  function reportObjectiveRewardApplicationFailure(error, application, source, options = {}) {
    const objective = application?.objective || {};
    const reward = application?.reward || {};
    const objectiveLabel = textSlot(objective.title || objective.id, "unknown objective");
    const failure = error?.objectiveRewardFailure ? error : new Error(`Objective "${objectiveLabel}" reward ${Number(application?.rewardIndex || 0) + 1} (${reward.type || "unknown"}) failed: ${error?.message || String(error)}`);
    failure.objectiveRewardFailure = true;
    failure.objectiveRewardDetails ||= {
      objectiveId: objective.id || "",
      objectiveTitle: objective.title || "",
      rewardIndex: application?.rewardIndex ?? -1,
      rewardPath: application?.rewardPath || "",
      rewardType: reward.type || "",
      statePath: objectiveRewardPath(reward).join("."),
      source
    };
    if (options.reportFailure !== false) reportObjectiveRewardFailure(failure, {
      source
    });
    return failure;
  }
  function preflightObjectiveRewardApplications(state, applications = [], source = "objective", options = {}) {
    if (!applications.length) return true;
    const roots = rewardApplicationRoots(applications);
    const draft = stateDraftForRoots(state, roots);
    const previousPreflight = app.objectiveRewardPreflightActive;
    const previousRewardMessageBuffer = app.objectiveRewardMessageBuffer;
    const previousUnlockGreetingBuffer = app.objectiveUnlockGreetingBuffer;
    app.objectiveRewardPreflightActive = true;
    app.objectiveRewardMessageBuffer = [];
    app.objectiveUnlockGreetingBuffer = [];
    try {
      for (const application of applications) {
        try {
          applyObjectiveReward(draft, application.objective, application.reward, `${source}: preflight`);
        } catch (error) {
          throw reportObjectiveRewardApplicationFailure(error, application, source, {
            reportFailure: options.reportFailure !== false
          });
        }
      }
    } finally {
      app.objectiveRewardPreflightActive = previousPreflight;
      app.objectiveRewardMessageBuffer = previousRewardMessageBuffer;
      app.objectiveUnlockGreetingBuffer = previousUnlockGreetingBuffer;
    }
    return true;
  }
  function objectiveRewardApplicationGroups(objective = {}, state = app.state) {
    const groups = new Map();
    const rewardEntries = objectiveRewardsForApplication(objective, state);
    for (const [index, entry] of rewardEntries.entries()) {
      const invocationId = objectiveRewardInvocationId(objective, {
        ...entry,
        rewardIndex: index
      });
      if (app.rewardRuntime?.appliedInvocationIds?.[invocationId]) continue;
      const group = groups.get(invocationId) || {
        invocationId,
        objective,
        sourceType: "objective",
        sourceId: String(objective.id || ""),
        applications: []
      };
      group.applications.push({
        objective,
        reward: entry.reward,
        invocationId,
        rewardIndex: index,
        rewardPath: entry.rewardPath || `reward:${index}`,
        routeId: entry.routeId || ""
      });
      groups.set(invocationId, group);
    }
    return groups;
  }
  function applyCompletedObjectiveRewards(beforeState, afterState, source) {
    afterState.objectives ||= {
      active_id: "",
      items: []
    };
    app.rewardRuntime ||= {
      appliedInvocationIds: {}
    };
    app.rewardRuntime.appliedInvocationIds ||= {};
    const groups = new Map();
    for (const objective of (afterState.objectives.items || []).filter(objectiveIsComplete)) {
      for (const [invocationId, group] of objectiveRewardApplicationGroups(objective, afterState)) groups.set(invocationId, group);
    }
    const applied = applyRewardApplicationGroupsAtomically(afterState, groups, source);
    if (applied) {
      updateObjectivePrerequisiteLocks(afterState, [...new Set([...groups.values()].map(group => String(group.objective?.id || "")))].filter(Boolean));
    }
    return applied;
  }
  function objectiveRewardsForApplication(objective = {}, state = app.state) {
    const entries = objectiveRewardEntriesForList(objective.rewards, state, "", "objective");
    const selectedChoiceId = String(objective.selected_choice_id || objective.selectedChoiceId || "");
    const selectedChoice = (Array.isArray(objective.choices) ? objective.choices : []).find(choice => String(choice?.id || "") === selectedChoiceId);
    if (selectedChoice) {
      entries.push(...objectiveRewardEntriesForList(selectedChoice.rewards, state, selectedChoiceId, `choice:${selectedChoiceId}`));
    }
    const selectedRoute = objectiveOutcomeRoute(objective, objective.selected_outcome_id);
    if (selectedRoute) {
      entries.push(...objectiveRewardEntriesForList(selectedRoute.rewards, state, selectedRoute.id, `outcome:${selectedRoute.id}`));
    }
    const selectedOutput = objectiveSelectedOutput(objective, state);
    if (selectedOutput && String(selectedOutput.id || selectedOutput.output_id || "") !== String(selectedChoiceId || "") && String(selectedOutput.id || selectedOutput.output_id || "") !== String(selectedRoute?.id || "")) {
      entries.push(...objectiveRewardEntriesForList(selectedOutput.rewards, state, selectedOutput.id, `output:${selectedOutput.id}`));
    }
    return entries;
  }
  function objectiveRewardEntriesForList(rewards = [], state = app.state, routeId = "", pathPrefix = "reward", trail = [], outerPosition = null, childPath = []) {
    const out = [];
    for (const [index, rawReward] of (Array.isArray(rewards) ? rewards : []).entries()) {
      const reward = compiledObjectiveReward(rawReward);
      const invocationPosition = outerPosition || {
        routeId,
        slotId: textSlot(rawReward?.id, "") || String(index),
        slotIndex: index,
        rewardPath: `${pathPrefix}:${index}`
      };
      if (reward.type === "apply_reward_bundle") {
        const bundleId = reward.bundle_id;
        const trailId = `bundle:${bundleId}`;
        if (!bundleId) throw new Error("Objective reward bundle reference is missing bundle_id.");
        if (trail.includes(trailId)) throw new Error(`Objective reward bundle cycle detected: ${[...trail, trailId].join(" -> ")}`);
        const bundleRewards = state?.reward_bundles?.[bundleId];
        if (!Array.isArray(bundleRewards)) throw new Error(`Objective reward bundle was not found: ${bundleId}`);
        out.push(...objectiveRewardEntriesForList(bundleRewards, state, routeId, `${pathPrefix}:${index}:bundle:${bundleId}`, [...trail, trailId], invocationPosition, [...childPath, `bundle-${bundleId}`]));
        continue;
      }
      if (reward.type === "apply_reward_template") {
        const templateId = reward.template_id;
        const trailId = `template:${templateId}`;
        if (!templateId) throw new Error("Objective reward template reference is missing template_id.");
        if (trail.includes(trailId)) throw new Error(`Objective reward template cycle detected: ${[...trail, trailId].join(" -> ")}`);
        const template = state?.reward_templates?.[templateId];
        if (!isPlainObject(template)) throw new Error(`Objective reward template was not found: ${templateId}`);
        const instantiated = instantiateRewardTemplate(templateId, template, reward.arguments);
        out.push(...objectiveRewardEntriesForList(instantiated, state, routeId, `${pathPrefix}:${index}:template:${templateId}:${stableStringHash(JSON.stringify(reward.arguments || {}))}`, [...trail, trailId], invocationPosition, [...childPath, `template-${templateId}`]));
        continue;
      }
      out.push({
        reward,
        routeId,
        rewardPath: `${pathPrefix}:${index}`,
        invocationPosition,
        childPosition: [...childPath, index]
      });
    }
    return out;
  }
  function objectiveRewardId(objective, reward, index) {
    if (reward?.id) return String(reward.id);
    const subject = reward?.outfit?.id || reward?.male_outfit?.id || reward?.non_male_outfit?.id || reward?.outfit_id || reward?.character_id || reward?.item || reward?.ability || "reward";
    return `${objective?.id || "objective"}:${reward?.type || "reward"}:${subject}:${index}`;
  }
  function applyObjectiveReward(state, objective, reward, source = "objective") {
    if (!isPlainObject(reward)) throw new Error("Objective reward must be an object.");
    const type = String(reward.type || "").trim();
    if (!type) throw new Error("Objective reward type is required.");
    const definitionOnlyPart = objectiveRewardDefinitionOnlyPathPart(objectiveRewardPath(reward));
    if (definitionOnlyPart) throw new Error(`Objective rewards cannot update definition-only field "${definitionOnlyPart}". Use the corresponding runtime field instead.`);
    switch (type) {
      case "introduce_future_character":
        return introduceFutureCharacterFromReward(state, reward, objective);
      case "make_future_character_recruitable":
        return setFutureCharacterStatusFromReward(state, reward, "recruitable", objective);
      case "promote_future_character_to_party":
        return promoteFutureCharacterReward(state, reward, objective);
      case "replace_character_definition":
        return replaceCharacterDefinitionReward(state, reward, objective);
      case "remove_character_shop_listing":
        return removeCharacterShopListingReward(state, reward, objective);
      case "add_item":
      case "grant_item":
        return grantItemReward(state, reward, objective);
      case "add_story_item":
        return addStoryInventoryItemReward(state, reward, objective);
      case "adjust_story_inventory":
        return adjustStoryInventoryReward(state, reward, objective);
      case "advance_time":
        return advanceTimeReward(state, reward, objective);
      case "unlock_location":
        return unlockLocationReward(state, reward, objective);
      case "add_story_rule":
        return addStoryRuleReward(state, reward, objective);
      case "remove_story_rule":
        return removeStoryRuleReward(state, reward, objective);
      case "set_state_field":
        return setStateFieldReward(state, reward, objective);
      case "modify_integer":
        return modifyIntegerReward(state, reward, objective);
      case "modify_number":
        return modifyNumberReward(state, reward, objective);
      case "adjust_relationship":
        return adjustRelationshipReward(state, reward, objective);
      case "grant_outfit":
        return grantOutfitReward(state, reward, objective);
      case "equip_outfit":
        return equipOutfitReward(state, reward, objective);
      case "delete_outfit":
        return deleteOutfitReward(state, reward, objective);
      case "delete_all_outfits":
        return deleteAllOutfitsReward(state, reward, objective);
      case "add_state_list_item":
        return addStateListItemReward(state, reward, objective);
      case "remove_state_list_item":
        return removeStateListItemReward(state, reward, objective);
      case "kill_character":
        return killCharacterReward(state, reward, objective);
      case "generate_profile_image":
        return generateProfileImageReward(state, reward, objective);
      case "generate_solo_normal_image":
        return generateSoloNormalImageReward(state, reward, objective);
      case "generate_story_image":
        return generateStoryImageReward(state, reward, objective);
      case "start_objective":
        return startObjectiveReward(state, reward, objective);
      case "complete_objective":
        return completeObjectiveReward(state, reward, objective);
      case "complete_generated_job":
        return completeGeneratedJobReward(state, reward, objective);
      default:
        throw new Error(`Unsupported objective reward type: ${type}`);
    }
  }
  function rewardLabel(objective, text) {
    return `${text} (${objective?.title || objective?.id || "objective reward"})`;
  }
  function noteRewardChange(state, text) {
    state.recent_changes = [text, ...(Array.isArray(state.recent_changes) ? state.recent_changes : [])].slice(0, 8);
    if (app.objectiveRewardPreflightActive) return;
    if (Array.isArray(app.objectiveRewardMessageBuffer)) {
      app.objectiveRewardMessageBuffer.push(text);
    } else {
      addGameMessage(text, "Game");
    }
    log("Objective reward", text, {
      type: "state",
      level: "message"
    });
  }
  function storyClockElapsedMinutes(state = app.state) {
    return requireExactRuntimeStoryClock(state.story_clock).elapsed_minutes;
  }
  function requireExactRuntimeStoryClock(clock) {
    const errors = [...exactObjectFieldValidationErrors(clock, STORY_CLOCK_FIELDS, "state.story_clock"), ...requiredExactFieldsValidationErrors(clock, STORY_CLOCK_FIELDS, "state.story_clock")];
    if (isPlainObject(clock)) {
      if (!Number.isSafeInteger(clock.elapsed_minutes) || clock.elapsed_minutes < 0) errors.push(validationError("state.story_clock.elapsed_minutes", "type", "state.story_clock.elapsed_minutes must be a non-negative safe integer."));
      if (typeof clock.label !== "string") errors.push(validationError("state.story_clock.label", "type", "state.story_clock.label must be text."));
    }
    if (errors.length) throw new Error(validationErrorsText({
      errors
    }));
    return clock;
  }
  function requireExactRuntimeStoryPacing(pacing) {
    const errors = [...exactObjectFieldValidationErrors(pacing, STORY_PACING_FIELDS, "state.story_pacing"), ...requiredExactFieldsValidationErrors(pacing, STORY_PACING_FIELDS, "state.story_pacing")];
    if (isPlainObject(pacing)) {
      if (!["player_controlled", "time_controlled"].includes(pacing.mode)) errors.push(validationError("state.story_pacing.mode", "enum", "state.story_pacing.mode must be exactly player_controlled or time_controlled."));
      if (typeof pacing.pending_event_id !== "string") errors.push(validationError("state.story_pacing.pending_event_id", "type", "state.story_pacing.pending_event_id must be text."));
      if (!isPlainObject(pacing.timeline)) errors.push(validationError("state.story_pacing.timeline", "type", "state.story_pacing.timeline must be an object."));
    }
    if (errors.length) throw new Error(validationErrorsText({
      errors
    }));
    return pacing;
  }
  function exactRuntimeStoryRules(rules) {
    if (!Array.isArray(rules)) throw new Error("state.story_rules must be an array.");
    const errors = [];
    rules.forEach((rule, index) => {
      const path = `state.story_rules.${index}`;
      errors.push(...exactObjectFieldValidationErrors(rule, STORY_RULE_FIELDS, path), ...requiredExactFieldsValidationErrors(rule, STORY_RULE_FIELDS, path));
      if (!isPlainObject(rule)) return;
      errors.push(...requiredExactTextValidationErrors(rule.id, `${path}.id`), ...requiredExactTextValidationErrors(rule.text, `${path}.text`));
    });
    if (errors.length) throw new Error(validationErrorsText({
      errors
    }));
    return rules;
  }
  function storyClockLabel(clock = {}) {
    const minutes = Math.max(0, Math.floor(Number(clock.elapsed_minutes || 0) || 0));
    const day = Math.floor(minutes / 1440) + 1;
    const dayMinute = minutes % 1440;
    const hour24 = Math.floor(dayMinute / 60);
    const minute = dayMinute % 60;
    const hour12 = (hour24 + 11) % 12 + 1;
    const suffix = hour24 >= 12 ? "PM" : "AM";
    return `Day ${day}, ${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
  }
  function setStoryClockElapsedMinutes(state, minutes) {
    requireExactRuntimeStoryClock(state.story_clock);
    if (!Number.isSafeInteger(minutes) || minutes < 0) throw new Error("Story-clock minutes must be a non-negative safe integer.");
    state.story_clock.elapsed_minutes = minutes;
    state.story_clock.label = storyClockLabel(state.story_clock);
    return state.story_clock;
  }
  function advanceStoryTime(state, minutes, reason = "") {
    const amount = Math.max(0, Math.floor(Number(minutes || 0) || 0));
    if (!amount) return false;
    const clock = setStoryClockElapsedMinutes(state, storyClockElapsedMinutes(state) + amount);
    const hours = Math.floor(amount / 60);
    const mins = amount % 60;
    const duration = [hours ? `${hours} hour${hours === 1 ? "" : "s"}` : "", mins ? `${mins} minute${mins === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ");
    noteRewardChange(state, reason ? `Time advanced ${duration}: ${reason}. Current time: ${clock.label}.` : `Time advanced ${duration}. Current time: ${clock.label}.`);
    return true;
  }
  function advanceTimeReward(state, reward, objective) {
    if (reward.hours != null && !Number.isSafeInteger(reward.hours) || reward.minutes != null && !Number.isSafeInteger(reward.minutes)) throw new Error("advance_time hours and minutes must be whole numbers.");
    const minutes = (reward.hours || 0) * 60 + (reward.minutes || 0);
    if (!minutes) return false;
    const locked = currentTimeLockedObjective(state);
    if (locked && String(locked.id || "") !== String(objective?.id || "")) {
      noteRewardChange(state, `Time did not advance because ${locked.title || locked.id} is a time-locked story event.`);
      return false;
    }
    return advanceStoryTime(state, minutes, reward.reason);
  }
  function timedEventTriggerIsMet(event = {}, state = app.state) {
    if (event.trigger?.immediately === true) return true;
    const objectiveId = textSlot(event.trigger?.objective_id, "");
    if (!objectiveId) return false;
    return completedObjectiveIds(state).has(objectiveId);
  }
  function timedEventCancelIsMet(event = {}, state = app.state) {
    const objectiveId = textSlot(event.cancel_objective_id, "");
    return !!objectiveId && completedObjectiveIds(state).has(objectiveId);
  }
  function timedEventNoticeText(event = {}, stage = null) {
    return textSlot(stage?.message || event.message, stage ? `${event.title || event.id} has advanced.` : `${event.title || event.id} has reached its deadline.`);
  }
  function timedEventShouldShowNotice(event = {}, stage = null) {
    return repairAiTimedEventVisibility(stage?.visibility || event.visibility) !== "hidden";
  }
  function applyTimedEventRewards(state, event = {}, rewards = [], label = "", invocationSite = "deadline") {
    const objective = {
      id: `timed-event:${event.id}`,
      title: label || event.title || event.id
    };
    const entries = objectiveRewardEntriesForList(rewards, state, "", `timed-event:${event.id}:${invocationSite}`);
    const groups = rewardApplicationGroupsForEntries({
      state,
      objective,
      entries,
      sourceType: "timed-event",
      sourceId: event.id || "event",
      siteId: invocationSite
    });
    return applyRewardApplicationGroupsAtomically(state, groups, "timed_event");
  }
  function startReadyTimedEvents(state = app.state) {
    let changed = false;
    const now = storyClockElapsedMinutes(state);
    for (const event of Object.values(state.timed_events || {})) {
      if (!event || event.status !== "waiting") continue;
      if (!timedEventTriggerIsMet(event, state)) continue;
      event.status = "active";
      event.start_elapsed_minutes = now;
      event.applied_stage_ids ||= [];
      changed = true;
    }
    return changed;
  }
  function processTimedEvents(state = app.state, source = "timed events") {
    let any = startReadyTimedEvents(state);
    const now = storyClockElapsedMinutes(state);
    for (const event of Object.values(state.timed_events || {})) {
      if (!event || event.status !== "active") continue;
      if (timedEventCancelIsMet(event, state)) {
        event.status = "cancelled";
        any = true;
        continue;
      }
      const start = Math.max(0, Number(event.start_elapsed_minutes || 0) || 0);
      const elapsed = Math.max(0, now - start);
      event.applied_stage_ids ||= [];
      const appliedStages = new Set(event.applied_stage_ids);
      for (const stage of event.stages || []) {
        if (!stage?.id || appliedStages.has(stage.id)) continue;
        if (elapsed < Number(stage.after_minutes || 0)) continue;
        if (timedEventShouldShowNotice(event, stage)) addGameMessage(timedEventNoticeText(event, stage), "Game", {
          gameMessageType: "timed_event",
          autoRead: true
        });
        if (applyTimedEventRewards(state, event, stage.rewards, `${event.title}: ${stage.id}`, `stage-${stage.id}`)) any = true;
        event.applied_stage_ids.push(stage.id);
        appliedStages.add(stage.id);
        any = true;
      }
      if (!event.time_limit_minutes || elapsed < event.time_limit_minutes) continue;
      if (timedEventShouldShowNotice(event)) addGameMessage(timedEventNoticeText(event), "Game", {
        gameMessageType: "timed_event",
        autoRead: true
      });
      if (applyTimedEventRewards(state, event, event.rewards, event.title, "deadline")) any = true;
      event.status = "complete";
      any = true;
    }
    if (any) {
      reconcileStoryRuntimeState(state, `timed events: ${source}`);
      scheduleActiveGameSave();
    }
    return any;
  }
  function timelineEventTriggerIsMet(event = {}, state = app.state) {
    const objectiveId = textSlot(event.trigger?.objective_id, "");
    if (objectiveId && !completedObjectiveIds(state).has(objectiveId)) return false;
    const at = event.trigger?.at_elapsed_minutes;
    if (at == null) return !!objectiveId;
    return storyClockElapsedMinutes(state) >= Math.max(0, Math.floor(Number(at) || 0));
  }
  function timelineEventPromptTitle(event = {}) {
    return event.prompt?.title || event.title || "Story Event";
  }
  function timelineEventPromptMessage(event = {}) {
    return event.prompt?.message || `The next main story event is ready: ${event.title || event.id}.`;
  }
  function timelineEventObjectiveId(event = {}) {
    return textSlot(event.accept?.objective_id || event.objective_id, "");
  }
  function timelineEventObjective(state = app.state, event = {}) {
    const id = timelineEventObjectiveId(event);
    if (!id) return null;
    return (state.objectives?.items || []).find(objective => String(objective.id || "") === String(id)) || null;
  }
  function activeTimelineEventForObjective(state = app.state, objectiveId = "") {
    const id = String(objectiveId || "");
    if (!id) return null;
    return Object.values(state.story_pacing?.timeline || {}).find(event => event?.status === "active" && String(timelineEventObjectiveId(event) || "") === id) || null;
  }
  function applyTimelineEventRewards(state, event = {}, rewards = [], label = "", invocationSite = "accept") {
    const objective = {
      id: `timeline-event:${event.id}`,
      title: label || event.title || event.id
    };
    const entries = objectiveRewardEntriesForList(rewards, state, "", `timeline-event:${event.id}:${invocationSite}`);
    const groups = rewardApplicationGroupsForEntries({
      state,
      objective,
      entries,
      sourceType: "timeline-event",
      sourceId: event.id || "event",
      siteId: invocationSite
    });
    return applyRewardApplicationGroupsAtomically(state, groups, "story_timeline");
  }
  function markTimelineObjectiveLocked(state, event = {}) {
    const objective = timelineEventObjective(state, event);
    if (!objective) return false;
    objective.locked_until_complete = true;
    objective.available_now = true;
    objective.blocked_reason = "";
    if (!objectiveIsComplete(objective)) setObjectiveRuntimeStatus(state, objective, "active");
    if (objectiveIsSide(objective)) {
      state.objectives.focus_id = objective.id;
    } else {
      state.objectives.active_id = objective.id;
      state.objectives.focus_id = "";
    }
    state.objectives.no_current = false;
    clearObjectiveChoiceState(state);
    return true;
  }
  function moveStateToTimelineLocation(state, locationId = "") {
    const id = textSlot(locationId, "");
    const node = id ? state.world_map?.locations?.[id] : null;
    if (!node) return false;
    state.world_map.current_location_id = node.id;
    state.world_map.focus_location_id = node.parent_id || node.id;
    state.world_map.travel_history = [node.id, ...(state.world_map.travel_history || []).filter(item => item !== node.id)];
    state.location = locationDetailFromMapNode(node);
    state.scene ||= {};
    state.scene.summary = `The scene shifts to ${node.name}.`;
    pruneSceneForLocationChange(state);
    replaceSceneNpcPresence(state, [...(state.scene?.npcs_present || []), ...(Array.isArray(node.npcs) ? node.npcs : [])], "timeline travel scene NPC additions");
    noteRewardChange(state, `Traveled to ${node.name}.`);
    assertRuntimeLocationState(state);
    return true;
  }
  function startTimelineEventInState(state, event = {}) {
    event.status = "active";
    state.story_pacing.pending_event_id = "";
    let applied = false;
    const locationId = event.accept?.travel_to_location_id || event.location_id;
    if (locationId && moveStateToTimelineLocation(state, locationId)) applied = true;
    if (applyTimelineEventRewards(state, event, event.accept?.rewards || [], event.title, "accept")) applied = true;
    if (markTimelineObjectiveLocked(state, event)) applied = true;
    return applied || true;
  }
  function acceptTimelineEvent(eventId, options = {}) {
    requireExactRuntimeStoryPacing(app.state.story_pacing);
    const event = app.state.story_pacing.timeline?.[eventId];
    if (!event || !["ready", "waiting"].includes(event.status)) return false;
    if (!timelineEventTriggerIsMet(event, app.state) && options.force !== true) return false;
    const conflict = currentTimeLockedObjective(app.state);
    if (conflict) {
      showNotice("Story Event Locked", `Finish ${conflict.title || conflict.id} before starting another timed event.`);
      return false;
    }
    const applied = startTimelineEventInState(app.state, event);
    reconcileStoryRuntimeState(app.state, `story timeline accepted: ${event.id}`);
    scheduleActiveGameSave();
    if (options.renderAfter !== false) render();
    return applied || true;
  }
  function declineTimelineEvent(eventId, options = {}) {
    requireExactRuntimeStoryPacing(app.state.story_pacing);
    const event = app.state.story_pacing.timeline?.[eventId];
    if (!event || event.status !== "ready") return false;
    event.status = "declined";
    app.state.story_pacing.pending_event_id = "";
    if (event.decline?.message) addGameMessage(event.decline.message, "Game", {
      gameMessageType: "timeline_event",
      autoRead: true
    });
    applyTimelineEventRewards(app.state, event, event.decline?.rewards || [], event.title, "decline");
    reconcileStoryRuntimeState(app.state, `story timeline declined: ${event.id}`);
    scheduleActiveGameSave();
    if (options.renderAfter !== false) render();
    return true;
  }
  function missTimelineEventDueToConflict(state, event = {}, conflict = {}) {
    event.status = "missed";
    if (state.story_pacing?.pending_event_id === event.id) state.story_pacing.pending_event_id = "";
    const message = event.missed_due_to_conflict?.message || `${event.title || event.id} happened while ${conflict.title || conflict.id} demanded your attention.`;
    addGameMessage(message, "Game", {
      gameMessageType: "timeline_event",
      autoRead: true
    });
    applyTimelineEventRewards(state, event, event.missed_due_to_conflict?.rewards || [], `${event.title}: missed`, "missed");
    return true;
  }
  function processStoryTimeline(state = app.state, source = "story timeline") {
    requireExactRuntimeStoryPacing(state.story_pacing);
    if (state.story_pacing.mode !== "time_controlled") return false;
    let any = false;
    for (const event of Object.values(state.story_pacing.timeline || {})) {
      if (!event || event.status !== "active") continue;
      const objective = timelineEventObjective(state, event);
      if (!objective || !objectiveIsComplete(objective)) continue;
      event.status = "complete";
      if (state.story_pacing.pending_event_id === event.id) state.story_pacing.pending_event_id = "";
      any = true;
    }
    const conflict = currentTimeLockedObjective(state);
    const conflictEvent = conflict ? activeTimelineEventForObjective(state, conflict.id) : null;
    for (const event of Object.values(state.story_pacing.timeline || {})) {
      if (!event || !["waiting", "ready"].includes(event.status)) continue;
      if (!timelineEventTriggerIsMet(event, state)) continue;
      if (conflict && String(conflictEvent?.id || "") !== String(event.id)) {
        if (missTimelineEventDueToConflict(state, event, conflict)) any = true;
        continue;
      }
      if (event.auto_start) {
        if (startTimelineEventInState(state, event)) any = true;
        continue;
      }
      if (event.status !== "ready") {
        event.status = "ready";
        any = true;
      }
      state.story_pacing.pending_event_id = event.id;
    }
    if (any) {
      reconcileStoryRuntimeState(state, `story timeline: ${source}`);
      scheduleActiveGameSave();
    }
    return any;
  }
  function nextWaitingTimelineEvent(state = app.state) {
    requireExactRuntimeStoryPacing(state.story_pacing);
    if (state.story_pacing.mode !== "time_controlled") return null;
    const now = storyClockElapsedMinutes(state);
    return Object.values(state.story_pacing.timeline || {}).filter(event => {
      if (!event || event.status !== "waiting") return false;
      const at = event.trigger?.at_elapsed_minutes;
      if (at == null) return false;
      const objectiveId = textSlot(event.trigger?.objective_id, "");
      return !objectiveId || completedObjectiveIds(state).has(objectiveId);
    }).sort((a, b) => Number(a.trigger.at_elapsed_minutes) - Number(b.trigger.at_elapsed_minutes)).find(event => Number(event.trigger.at_elapsed_minutes) > now) || null;
  }
  function readyStoryTimelineEvent(state = app.state) {
    requireExactRuntimeStoryPacing(state.story_pacing);
    const pendingId = textSlot(state.story_pacing.pending_event_id, "");
    if (pendingId && state.story_pacing.timeline?.[pendingId]?.status === "ready") return state.story_pacing.timeline[pendingId];
    return Object.values(state.story_pacing.timeline || {}).find(event => event?.status === "ready") || null;
  }
  function timelineDurationText(minutes = 0) {
    const amount = Math.max(0, Math.floor(Number(minutes || 0) || 0));
    const days = Math.floor(amount / 1440);
    const hours = Math.floor(amount % 1440 / 60);
    const mins = amount % 60;
    return [days ? `${days} day${days === 1 ? "" : "s"}` : "", hours ? `${hours} hour${hours === 1 ? "" : "s"}` : "", mins ? `${mins} minute${mins === 1 ? "" : "s"}` : ""].filter(Boolean).join(", ") || "no time";
  }
  async function waitForStoryTimelineEvent(eventId = "") {
    requireExactRuntimeStoryPacing(app.state.story_pacing);
    const event = app.state.story_pacing.timeline?.[eventId] || nextWaitingTimelineEvent(app.state);
    if (!event) return false;
    const target = Number(event.trigger?.at_elapsed_minutes);
    if (!Number.isFinite(target)) return false;
    const now = storyClockElapsedMinutes(app.state);
    const minutes = Math.max(0, Math.floor(target - now));
    const accepted = await showConfirm("Wait for Story Event?", `Wait ${timelineDurationText(minutes)} for ${event.title || event.id} to begin? That time could be spent on side objectives, shops, jobs, or exploration.`, {
      confirmText: "Wait",
      cancelText: "Cancel"
    });
    if (!accepted) return false;
    advanceStoryTime(app.state, minutes, `waiting for ${event.title || event.id}`);
    processStoryTimeline(app.state, "wait for event");
    scheduleActiveGameSave();
    render();
    return true;
  }
  async function openStoryTimelineEventPrompt(eventId = "") {
    requireExactRuntimeStoryPacing(app.state.story_pacing);
    const event = app.state.story_pacing.timeline?.[eventId || app.state.story_pacing.pending_event_id];
    if (!event || event.status !== "ready") return false;
    const accepted = await showConfirm(timelineEventPromptTitle(event), timelineEventPromptMessage(event), {
      confirmText: event.prompt?.accept_label || "Start Event",
      cancelText: event.prompt?.decline_label || "Skip"
    });
    if (accepted) return acceptTimelineEvent(event.id);
    return declineTimelineEvent(event.id);
  }
  function declineTimelineEventFromUi() {
    const event = readyStoryTimelineEvent(app.state);
    if (!event) return false;
    return declineTimelineEvent(event.id);
  }
  function queueProfileImageForObjectiveIntroducedCharacter(state, name) {
    // Objective rewards create predefined future-cast NPCs directly in
    // npc_directory, so they bypass the normal scene-addition diff that
    // queues portraits for newly visible characters. Keep this bridge
    // narrow: only the active runtime state may enqueue, and only when
    // the introduced character still lacks a usable profile image.
    if (state !== app.state || stateIsNotActiveGameContext()) return false;
    return queueProfileImageIfMissing(name, "objective introduced character");
  }
  function futureCastItems(state = app.state) {
    state.future_cast ||= {
      enabled: true,
      items: {}
    };
    state.future_cast.items ||= {};
    return state.future_cast.items;
  }
  function futureCharacterIdFromReward(reward) {
    return String(reward.character_id || reward.future_character_id || reward.id || reward.name || "").trim();
  }
  function futureCharacterEntry(state, reward) {
    const id = futureCharacterIdFromReward(reward);
    if (!id) return null;
    const items = futureCastItems(state);
    return items[id] || items[objectiveIdFromTitle(id, id)] || null;
  }
  function introducedFutureCastEntryByName(state = app.state, name = "") {
    const wanted = normalizeNameForMatch(name);
    if (!wanted) return null;
    return Object.values(state?.future_cast?.items || {}).find(entry => {
      if (!entry || String(entry.status || "locked") === "locked") return false;
      return normalizeNameForMatch(entry.name) === wanted || normalizeNameForMatch(entry.full_character?.name) === wanted;
    }) || null;
  }
  function futureCharacterFullCharacter(entry, fallbackName = "", state = app.state) {
    if (isPlainObject(entry?.animal_definition)) {
      const animal = materializeAnimalDefinitionForRuntimeFields(entry.animal_definition, entry?.name || fallbackName);
      resolveActiveProfileImageReference(animal);
      return applyStoryDefaultImageModelToCharacter(animal, state);
    }
    const full = isPlainObject(entry?.full_character) ? clone(entry.full_character) : blankCharacterTemplate(entry?.name || fallbackName);
    full.age = exactStoryCharacterAge(full.age ?? entry?.age, `future cast ${entry?.name || fallbackName || "character"}.age`);
    full.gender = canonicalCharacterGenderValue(textSlot(full.gender || entry?.gender, "unspecified"));
    full.role = textSlot(full.role || entry?.role || entry?.role, "local adult");
    if (entry?.can_die != null) full.can_die = entry.can_die === true;
    full.personality_description ||= textSlot(entry?.personality_description, `${entry?.name || fallbackName || "This character"} has a stable personality set by the story template.`);
    full.speech_style ||= textSlot(entry?.speech_style || entry?.dialogue_style, "");
    if (Array.isArray(entry?.profile_images)) {
      full.profile_images = entry.profile_images.map(image => ({
        ...image,
        favorite: image.favorite === true
      }));
    }
    if (Array.isArray(entry?.profile_images_list)) {
      full.profile_images_list = entry.profile_images_list.map(image => ({
        ...image,
        favorite: image.favorite === true
      }));
    }
    resolveActiveProfileImageReference(full);
    const name = entry?.name || fallbackName;
    const runtimeInput = Object.hasOwn(full, "clothing") || Object.hasOwn(full, "active_outfit_id") ? full : materializeCharacterDefinitionForRuntime(full, name);
    const runtime = materializeCharacterForRuntime(runtimeInput, name, { embeddedStory: true });
    runtime.relationship_to_player = textSlot(runtime.relationship_to_player) || textSlot(full.starting_relationship_to_player || entry?.relationship, "");
    if (!runtime.relationship_to_player) throw new Error(`Future character ${name || full.id || "unknown"} requires a relationship to the player before runtime materialization.`);
    return applyStoryDefaultImageModelToCharacter(runtime, state);
  }
  function introduceFutureCharacterFromReward(state, reward, objective) {
    const entry = futureCharacterEntry(state, reward);
    if (!entry) throw new Error(`Objective reward future character not found: ${futureCharacterIdFromReward(reward) || "unknown"}`);
    const id = futureCharacterIdFromReward(reward);
    const name = textSlot(entry.name || reward.name || id, "");
    if (!name) throw new Error(`Objective reward future character has no name: ${id}`);
    if (isPlayerEntityName(name, state)) throw new Error(`Objective reward cannot introduce player as NPC: ${name}`);
    if (state.characters?.[name]) throw new Error(`Objective reward cannot introduce existing party member: ${name}`);
    const locationId = requireNpcLocationId(state, textSlot(reward.npc_location_id || entry.npc_location_id, ""), `Objective reward introduce_future_character for ${name}`);
    const location = ensureNpcDirectoryLocation(state, locationId, textSlot(reward.npc_location_label || entry.location_label, currentSettlementName(state)));
    const locationLabel = location.label;
    const full = futureCharacterFullCharacter(entry, name, state);
    const npcs = location.characters;
    npcs[name] = {
      ...(npcs[name] || {}),
      name,
      id: full.id,
      gender: full.gender || entry.gender || "unspecified",
      age: isAnimalEntity(full) ? full.age : exactStoryCharacterAge(full.age ?? entry.age, `introduced future NPC ${name}.age`),
      role: textSlot(entry.role || full.role, "local"),
      relationship: textSlot(entry.relationship || full.relationship_to_player, "unknown"),
      trust: full.trust,
      attraction: full.attraction,
      affection: full.affection,
      state_of_mind: full.state_of_mind,
      physical_state: full.physical_state,
      pose: full.pose,
      note: textSlot(reward.note || entry.note || entry.summary, `Unlocked by objective: ${objective?.title || "story progress"}.`),
      inspected: true,
      can_die: full.can_die === true,
      recruitable: reward.recruitable === true || entry.status === "recruitable",
      future_character_id: id,
      full_character: full
    };
    synchronizeRuntimeNpcIdentity(npcs[name], name);
    entry.status = reward.status || "introduced";
    entry.unlocked_by = objective?.id || "";
    entry.last_triggered_reason = reward.reason || objective?.title || "";
    applyFutureCharacterImagesToGallery(state, entry, name);
    queueFutureCharacterUnlockGreeting(entry, reward, objective, {
      name,
      locationLabel
    });
    state.scene ||= {};
    const presence = reward.scene_presence;
    if (presence === "active") {
      replaceSceneNpcPresence(state, [...(state.scene.npcs_present || []), name], "future character introduced");
    }
    noteRewardChange(state, rewardLabel(objective, `${name} was introduced at ${locationLabel}.`));
    startCharacterStoryObjectiveIfPresent(state, entry, {
      sourceId: id,
      sourceTitle: name
    });
    queueProfileImageForObjectiveIntroducedCharacter(state, name);
    return true;
  }
  function queueFutureCharacterUnlockGreeting(entry, reward, objective, context = {}) {
    if (stateIsNotActiveGameContext()) return;
    const name = context.name || entry?.name || reward?.name || "the new character";
    const greeting = textSlot(entry?.greeting || entry?.on_unlock?.greeting, "");
    if (!greeting) return;
    if (Array.isArray(app.objectiveUnlockGreetingBuffer)) {
      app.objectiveUnlockGreetingBuffer.push({
        speaker: name,
        text: greeting
      });
      return;
    }
    addObjectiveUnlockGreetingMessage({
      speaker: name,
      text: greeting
    });
  }
  function stateIsNotActiveGameContext() {
    return !app?.state?.meta?.setup_complete;
  }
  function setFutureCharacterStatusFromReward(state, reward, status, objective) {
    const entry = futureCharacterEntry(state, reward);
    if (!entry) throw new Error(`Objective reward future character not found: ${futureCharacterIdFromReward(reward) || "unknown"}`);
    entry.status = reward.status || status;
    const npc = getNpcEntryFromState(state, entry.name || reward.name);
    if (npc) npc.recruitable = true;
    noteRewardChange(state, rewardLabel(objective, `${entry.name || reward.name} is now ${entry.status}.`));
    return true;
  }
  function promoteFutureCharacterReward(state, reward, objective) {
    const entry = futureCharacterEntry(state, reward);
    if (!entry) throw new Error(`Objective reward future character not found: ${futureCharacterIdFromReward(reward) || "unknown"}`);
    const name = entry.name || reward.name || futureCharacterIdFromReward(reward);
    if (!name) throw new Error("Objective reward promote_future_character_to_party target has no name.");
    // Promotion rewards are intentionally idempotent. Story objectives may
    // repeat them across converging routes or after a character joined by
    // another path. The existing party record is authoritative, so mark
    // this reward as handled without changing presence, portraits, or notes.
    if (state.characters?.[name]) return true;
    state.characters ||= {};
    const promoted = futureCharacterFullCharacter(entry, name, state);
    const existingNpc = getNpcEntryFromState(state, name);
    // Promotion can happen after an objective-introduction reward in the
    // same pass. Preserve the NPC portrait placeholder/real portrait so
    // the party card does not lose the image generation already queued.
    if (existingNpc?.full_character && !localActiveProfileImage(promoted) && (localActiveProfileImage(existingNpc.full_character) || activeProfileImage(existingNpc.full_character))) {
      promoted.profile_images = clone(existingNpc.full_character.profile_images || []);
      promoted.profile_image_id = existingNpc.full_character.profile_image_id || "";
    }
    state.characters[name] = promoted;
    state.scene ||= {};
    state.scene.party_members_present = [...new Set([...(state.scene.party_members_present || []), name])];
    entry.status = "joined";
    noteRewardChange(state, rewardLabel(objective, `${name} joined the party.`));
    queueProfileImageForObjectiveIntroducedCharacter(state, name);
    return true;
  }
  function runtimeCharacterOwnerById(state, characterId) {
    if (textSlot(state.player?.id, "") === characterId) return {
      kind: "player",
      entity: state.player,
      name: state.player.name || "Player"
    };
    for (const [name, entity] of Object.entries(state.characters || {})) if (textSlot(entity?.id, "") === characterId) return {
      kind: "party",
      entity,
      name
    };
    for (const location of Object.values(state.npc_directory?.locations || {})) {
      for (const [key, npc] of Object.entries(location?.characters || {})) {
        const entity = npc?.full_character || npc?.animal_definition;
        if (textSlot(entity?.id || npc?.id, "") === characterId) return {
          kind: "npc",
          entity,
          npc,
          key,
          name: npc?.name || key
        };
      }
    }
    return null;
  }
  function replaceSceneCharacterName(state, oldName, newName) {
    if (!oldName || !newName || oldName === newName) return;
    for (const field of ["party_members_present", "npcs_present", "image_characters", "speak_targets"]) if (Array.isArray(state.scene?.[field])) state.scene[field] = state.scene[field].map(name => name === oldName ? newName : name);
  }
  function replaceCharacterDefinitionReward(state, reward, objective) {
    const targetCharacterId = textSlot(reward.target_character_id, "");
    const sourceFutureCharacterId = textSlot(reward.source_future_character_id, "");
    const owner = runtimeCharacterOwnerById(state, targetCharacterId);
    if (!owner) throw new Error(`Objective replace_character_definition target is not materialized: ${targetCharacterId}`);
    const source = state.future_cast?.items?.[sourceFutureCharacterId];
    if (!isPlainObject(source)) throw new Error(`Objective replace_character_definition source future character not found: ${sourceFutureCharacterId}`);
    if (source.status === "consumed_as_replacement") throw new Error(`Objective replace_character_definition source was already consumed: ${sourceFutureCharacterId}`);
    const old = owner.entity;
    const replacement = futureCharacterFullCharacter(source, source.name, state);
    replacement.id = targetCharacterId;
    replacement.relationship_to_player = old.relationship_to_player;
    replacement.trust = old.trust;
    replacement.affection = old.affection;
    replacement.attraction = old.attraction;
    replacement.known_facts = [...new Set([...(Array.isArray(old.known_facts) ? old.known_facts : []), ...(Array.isArray(replacement.known_facts) ? replacement.known_facts : [])])];
    if (String(old.physical_state || "").toLowerCase() === "dead") {
      replacement.physical_state = "dead";
      replacement.state_of_mind = "dead";
      replacement.pose = "dead";
      replacement.death_note = old.death_note || "";
    }
    if (Array.isArray(old.profile_images) && old.profile_images.length) replacement.profile_images = clone(old.profile_images);
    replacement.profile_image_id = "";
    const oldName = owner.name;
    const newName = textSlot(replacement.name, oldName);
    if (owner.kind === "player") state.player = replacement;else if (owner.kind === "party") {
      delete state.characters[oldName];
      state.characters[newName] = replacement;
    } else {
      owner.npc.name = newName;
      owner.npc.id = replacement.id;
      owner.npc.gender = replacement.gender;
      owner.npc.age = replacement.age;
      owner.npc.role = replacement.role;
      owner.npc.relationship = replacement.relationship_to_player;
      owner.npc.full_character = replacement;
      synchronizeRuntimeNpcIdentity(owner.npc, newName);
      delete owner.npc.animal_definition;
    }
    replaceSceneCharacterName(state, oldName, newName);
    source.status = "consumed_as_replacement";
    source.unlocked_by = objective?.id || "";
    source.last_triggered_reason = reward.reason;
    noteRewardChange(state, rewardLabel(objective, `${oldName} changed into ${newName}.`));
    queueProfileImageForObjectiveIntroducedCharacter(state, newName);
    return true;
  }
  function removeCharacterShopListingReward(state, reward, objective) {
    const shopId = textSlot(reward.shop_id, "");
    const characterId = textSlot(reward.character_id, "");
    const shop = state.story_shops?.[shopId];
    if (!shop || String(shop.type || "").trim().toLowerCase() !== "character") throw new Error(`Objective reward character shop not found: ${shopId || "unknown"}`);
    const item = (shop.items || []).find(candidate => String(candidate?.character_id || "") === characterId);
    if (!item) throw new Error(`Objective reward character shop listing not found: ${shopId}/${characterId || "unknown"}`);
    if (item.removed === true) return true;
    item.removed = true;
    noteRewardChange(state, rewardLabel(objective, `${humanizeIdentifierLabel(characterId)} was removed from ${shop.title || shopId}.`));
    return true;
  }
  function rewardTargetKey(reward) {
    return String(reward.target || reward.owner || "player").toLowerCase();
  }
  function partyRewardChoice(state, reward, objective, rewardKind) {
    state.objectives ||= {};
    state.objectives.pending_reward_choices ||= [];
    const choice = {
      id: reward.id || `${objective?.id || "objective"}-${Date.now()}`,
      objective_id: objective?.id || "",
      kind: rewardKind,
      reward: clone(reward),
      choices: ["Player", ...Object.keys(state.characters || {})],
      created_at: new Date().toISOString()
    };
    state.objectives.pending_reward_choices.push(choice);
    noteRewardChange(state, rewardLabel(objective, `${rewardKind === "item" ? "Item" : "Ability"} reward is waiting for party assignment.`));
    return true;
  }
  function grantItemReward(state, reward, objective) {
    const item = textSlot(reward.item || reward.name || reward.title, "");
    if (!item) return false;
    const target = rewardTargetKey(reward);
    if (target === "party_choice" || target === "choose") return partyRewardChoice(state, reward, objective, "item");
    if (target === "party" && !reward.character) return partyRewardChoice(state, reward, objective, "item");
    const owner = target === "party" ? reward.character : "Player";
    const entity = owner && owner !== "Player" ? state.characters?.[owner] : state.player;
    if (!entity) return false;
    entity.inventory = [...new Set([...(entity.inventory || []), item])];
    noteRewardChange(state, rewardLabel(objective, `${owner || "Player"} received ${item}.`));
    return true;
  }
  function ensureStoryInventory(state = app.state) {
    if (!isPlainObject(state.story_inventory) || !Array.isArray(state.story_inventory.items)) throw new Error("Runtime story_inventory must be a validated object with an items array.");
    return state.story_inventory;
  }
  function storyInventoryPathValue(state = app.state, pathText = "") {
    const path = exactStoryPathText(pathText);
    return path.split(".").reduce((value, key) => value?.[key], state);
  }
  function exactStoryPathText(pathText, path = "story path") {
    if (typeof pathText !== "string" || !pathText || pathText !== pathText.trim()) throw new Error(`${path} must be nonblank text without leading or trailing whitespace.`);
    if (!pathText.includes(".")) throw new Error(`${path} must be a complete dotted state path.`);
    return pathText;
  }
  function repairAiStoryPathText(pathText = "") {
    const path = String(pathText || "").trim();
    if (!path) return "";
    return path.includes(".") ? path : `story_inventory.${path}`;
  }
  function exactStoryInventoryItemId(itemId, path = "story inventory item id") {
    if (typeof itemId !== "string" || !itemId || itemId !== itemId.trim()) throw new Error(`${path} must be nonblank text without leading or trailing whitespace.`);
    if (itemId.includes(".")) throw new Error(`${path} must be an item id, not a state path.`);
    return itemId;
  }
  function setStoryInventoryPathValue(state = app.state, pathText = "", value) {
    const path = exactStoryPathText(pathText).split(".");
    if (path[0] === "story_inventory") ensureStoryInventory(state);
    setPathValue(state, path, value);
    return true;
  }
  function adjustStoryInventoryItemValue(state, itemId, delta) {
    const id = exactStoryInventoryItemId(itemId);
    if (typeof delta !== "number" || !Number.isFinite(delta)) throw new Error("story inventory adjustment must be a finite number.");
    const path = `story_inventory.${id}`;
    const current = storyInventoryPathValue(state, path);
    if (typeof current !== "number" || !Number.isFinite(current)) throw new Error(`${path} must be a finite number.`);
    const next = Math.max(0, Math.floor(current + delta));
    setStoryInventoryPathValue(state, path, next);
    if (id === "adventurer_xp") updateStoryAdventurerRank(state);
    return next;
  }
  function updateStoryAdventurerRank(state = app.state) {
    const inventory = ensureStoryInventory(state);
    const xp = Math.max(0, Number(inventory.adventurer_xp || 0));
    const thresholds = [0, 2, 5, 8, 11, 15, 20, 26];
    let rank = 0;
    for (let i = 0; i < thresholds.length; i += 1) {
      if (xp >= thresholds[i]) rank = i;
    }
    inventory.adventurer_rank = Math.max(Number(inventory.adventurer_rank || 0), rank);
    return inventory.adventurer_rank;
  }
  function storyRequirementResults(requirements = [], state = app.state) {
    return (Array.isArray(requirements) ? requirements : []).map(requirement => {
      const left = structuredStoryRequirementValue(requirement, state);
      const met = evaluateStructuredRequirementValue(left, requirement.op, requirement.value);
      return {
        ...requirement,
        label: storyRequirementLabel(requirement),
        current: left,
        met
      };
    });
  }
  function structuredStoryRequirementValue(requirement = {}, state = app.state) {
    const type = requirement.type || "";
    if (type === "currency" || type === "story_inventory") return directObjectiveChoiceRequirementValue(`story_inventory.${requirement.id}`, state);
    if (type === "story_rule") return storyRuleRequirementValue(state, requirement.id);
    if (type === "known_fact" || type === "durable_known_fact") return knownFactRequirementValue(state, requirement.target, requirement.id);
    if (type === "party_member") return partyMemberRequirementValue(state, requirement.target);
    if (type === "character_alive") return characterAliveRequirementValue(state, requirement.target);
    if (type === "character_dead") return !characterAliveRequirementValue(state, requirement.target);
    if (type === "objective_complete") return completedObjectiveIds(state).has(String(requirement.id || ""));
    if (type === "objective_not_complete") return !completedObjectiveIds(state).has(String(requirement.id || ""));
    return directObjectiveChoiceRequirementValue(requirement.path, state);
  }
  function storyRuleRequirementValue(state = app.state, ruleId = "") {
    const id = String(ruleId || "").trim();
    if (!id) return false;
    return exactRuntimeStoryRules(state?.story_rules).some(rule => rule.id === id || rule.text === id);
  }
  function storyRequirementEntity(state = app.state, target = "") {
    const name = String(target || "").trim();
    if (!name) return null;
    if (/^player$/i.test(name)) return state?.player || null;
    if (String(state?.player?.name || "").toLowerCase() === name.toLowerCase()) return state.player;
    if (state?.characters?.[name]) return state.characters[name];
    const npc = getNpcEntryFromState(state, name);
    if (npc?.full_character) return npc.full_character;
    if (npc) return npc;
    const future = state?.future_cast?.items?.[name];
    if (future?.full_character) return future.full_character;
    if (future) return future;
    return null;
  }
  function knownFactRequirementValue(state = app.state, target = "", factId = "") {
    const id = String(factId || "").trim();
    const entity = storyRequirementEntity(state, target);
    if (!entity || !id) return false;
    return knownFactCollectionHasId(entity.known_facts, id);
  }
  function knownFactCollectionHasId(collection, id = "") {
    const wanted = String(id || "").trim();
    if (!wanted) return false;
    if (Array.isArray(collection)) return collection.some(item => {
      if (isPlainObject(item)) return [item.id, item.key, item.name, item.fact_id, item.fact].map(value => String(value || "").trim()).includes(wanted);
      return String(item || "").trim() === wanted;
    });
    if (isPlainObject(collection)) {
      if (Object.prototype.hasOwnProperty.call(collection, wanted)) return !!collection[wanted];
      return Object.values(collection).some(item => isPlainObject(item) ? [item.id, item.key, item.name, item.fact_id, item.fact].map(value => String(value || "").trim()).includes(wanted) : String(item || "").trim() === wanted);
    }
    return false;
  }
  function partyMemberRequirementValue(state = app.state, target = "") {
    const entity = storyRequirementEntity(state, target);
    if (!entity) return false;
    const name = String(entity.name || target || "").trim();
    return !!state?.characters?.[name] || String(state?.player?.name || "") === name;
  }
  function characterAliveRequirementValue(state = app.state, target = "") {
    const entity = storyRequirementEntity(state, target);
    if (!entity) return false;
    return entity.alive !== false && !deathStateLooksDead(entityDeathState(entity));
  }
  function evaluateStructuredRequirementValue(left, op = "truthy", right) {
    switch (String(op || "truthy")) {
      case "truthy":
        return !!left;
      case "falsy":
        return !left;
      case "includes":
        return Array.isArray(left) ? left.includes(right) : String(left ?? "").includes(String(right ?? ""));
      case "not_includes":
        return Array.isArray(left) ? !left.includes(right) : !String(left ?? "").includes(String(right ?? ""));
      default:
        return compareRequirementValues(left, op, right);
    }
  }
  function storyRequirementLabel(requirement = {}) {
    const type = requirement.type || "";
    if (type === "currency" || type === "story_inventory") return `${requirement.id} ${requirement.op} ${String(requirement.value ?? "")}`;
    if (type === "story_rule") return `Story rule: ${String(requirement.id || "")}`;
    if (type === "known_fact" || type === "durable_known_fact") return `Known fact: ${String(requirement.target || "target")} / ${String(requirement.id || "")}`;
    if (type === "party_member") return `Party member: ${String(requirement.target || "")}`;
    if (type === "character_alive") return `Alive: ${String(requirement.target || "")}`;
    if (type === "character_dead") return `Dead: ${String(requirement.target || "")}`;
    if (type === "objective_complete") return `Objective complete: ${objectiveDefinitionById(requirement.id)?.title || storyBuilderObjectiveDisplay(requirement.id)}`;
    if (type === "objective_not_complete") return `Objective not complete: ${objectiveDefinitionById(requirement.id)?.title || storyBuilderObjectiveDisplay(requirement.id)}`;
    const path = String(requirement.path || "").replace(/^story_inventory\./, "");
    const op = String(requirement.op || "truthy");
    if (op === "truthy" || op === "falsy") return `${path} ${op}`;
    return `${path} ${op} ${String(requirement.value ?? "")}`;
  }
  function requirementsMet(requirements = [], state = app.state) {
    return storyRequirementResults(requirements, state).every(item => item.met);
  }
  function addStoryInventoryItem(state = app.state, item = {}) {
    const validationErrors = storyInventoryItemValidationErrors(item, "story inventory item");
    if (validationErrors.length) throw new Error(validationErrorsText(validationResult(validationErrors)));
    const inventory = ensureStoryInventory(state);
    const existing = inventory.items.find(entry => entry.id === item.id);
    if (existing) {
      existing.quantity = Math.max(1, existing.quantity + item.quantity);
      existing.value = Math.max(existing.value, item.value);
      existing.sellable = existing.sellable && item.sellable;
      existing.quest_item = existing.quest_item || item.quest_item;
      return true;
    }
    inventory.items.push(clone(item));
    return true;
  }
  function addStoryInventoryItemReward(state, reward, objective) {
    const item = reward.item;
    if (!addStoryInventoryItem(state, item)) return false;
    const name = item.name;
    noteRewardChange(state, rewardLabel(objective, `${name} added to story inventory.`));
    return true;
  }
  function adjustStoryInventoryReward(state, reward, objective) {
    const path = reward.field_path;
    const amount = reward.amount;
    if (!Number.isFinite(amount) || amount === 0) return false;
    const parts = assertSafeRewardPath(path, "adjust_story_inventory.field_path");
    if (parts.length !== 2 || parts[0] !== "story_inventory" || parts[1] === "items") throw new Error("adjust_story_inventory.field_path must target one top-level numeric story_inventory field.");
    const current = existingNumberAtPath(state, parts, parts.join("."));
    const operation = reward.operation;
    let next;
    if (operation === "add") next = current + amount;else if (operation === "subtract") next = current - amount;else if (operation === "multiply") next = current * amount;else if (operation === "divide") {
      if (amount === 0) throw new Error("adjust_story_inventory cannot divide by zero.");
      next = current / amount;
    } else if (operation === "set") next = amount;else throw new Error("adjust_story_inventory.operation must be add, subtract, multiply, divide, or set.");
    if (!Number.isFinite(next)) throw new Error("adjust_story_inventory result must be finite.");
    setPathValue(state, parts, next);
    const label = parts[1];
    noteRewardChange(state, rewardLabel(objective, `${label} is now ${next}.`));
    return true;
  }
  function unlockLocationReward(state, reward, objective) {
    const id = reward.location_id;
    if (!id) return false;
    state.world_map ||= {};
    state.world_map.locations ||= {};
    let node = state.world_map.locations[id];
    if (!node && app.storyDefinition?.locationDefinitionsById?.[id]) {
      node = clone(app.storyDefinition.locationDefinitionsById[id]);
      state.world_map.locations[id] = node;
    }
    if (!node) throw new Error(`unlock_location references missing location: ${id}. ` + `Runtime locations: ${Object.keys(state.world_map.locations).join(", ") || "none"}. ` + `Authored locations: ${Object.keys(app.storyDefinition?.locationDefinitionsById || {}).join(", ") || "none"}.`);
    node.discovered = true;
    node.travel_enabled = true;
    noteRewardChange(state, rewardLabel(objective, `${node.name || id} was unlocked.`));
    return true;
  }
  function objectiveRewardPath(reward = {}) {
    const path = Array.isArray(reward.path) ? reward.path : Array.isArray(reward.field_path) ? reward.field_path : [];
    return path.map(part => String(part));
  }
  function runtimeCharacterEntries(state = app.state) {
    const entries = [];
    const seen = new Map();
    const add = (entity, fallbackIds = [], context = "character") => {
      if (!isPlainObject(entity)) return;
      const ids = [entity.id, entity.character_id, entity.definition_id, entity.future_character_id, ...(Array.isArray(fallbackIds) ? fallbackIds : [fallbackIds])].map(id => textSlot(id, "")).filter(Boolean);
      if (seen.has(entity)) {
        const existing = seen.get(entity);
        existing.ids = [...new Set([...existing.ids, ...ids])];
        return;
      }
      const entry = {
        entity,
        ids: [...new Set(ids)],
        context
      };
      seen.set(entity, entry);
      entries.push(entry);
    };
    const addWrapped = (value, fallbackIds = [], context = "character") => {
      if (!isPlainObject(value)) return;
      const entity = value.full_character || value.character || value.npc?.full_character || (looksLikeCharacterObject(value.npc) ? value.npc : null) || (looksLikeCharacterObject(value) ? value : null);
      add(entity, [value.id, value.character_id, value.future_character_id, value.definition_id, ...(Array.isArray(fallbackIds) ? fallbackIds : [fallbackIds])], context);
    };
    add(state.player, ["player", state.player_id], "player");
    if (Array.isArray(state.players)) state.players.forEach((player, index) => add(player, [`player-${index + 1}`], `players.${index}`));else if (Array.isArray(state.players?.options)) state.players.options.forEach((player, index) => add(player, [`player-${index + 1}`], `players.options.${index}`));else Object.entries(state.players || {}).forEach(([id, player]) => add(player, [id], `players.${id}`));
    Object.entries(state.characters || {}).forEach(([id, character]) => add(character, [id], `characters.${id}`));
    for (const [locationId, location] of Object.entries(state.npc_directory?.locations || {})) {
      for (const collectionName of ["characters", "npcs"]) {
        Object.entries(location?.[collectionName] || {}).forEach(([id, npc]) => addWrapped(npc, [id], `npc_directory.locations.${locationId}.${collectionName}.${id}`));
      }
    }
    Object.entries(state.future_cast?.items || {}).forEach(([id, entry]) => addWrapped(entry, [id], `future_cast.items.${id}`));
    Object.entries(state.story_shops || {}).forEach(([shopId, shop]) => {
      addWrapped(shop?.owner, [shop?.owner_npc_id], `story_shops.${shopId}.owner`);
      (Array.isArray(shop?.items) ? shop.items : []).forEach((item, index) => addWrapped(item, [item?.character_id], `story_shops.${shopId}.items.${index}`));
    });
    for (const [collectionName, collection] of [["generated_jobs", state.generated_jobs], ["job_board", state.job_board]]) {
      const items = Array.isArray(collection) ? collection : Array.isArray(collection?.items) ? collection.items : [];
      items.forEach((item, index) => addWrapped(item, [item?.character_id], `${collectionName}.items.${index}`));
    }
    return entries;
  }
  function resolveRuntimeCharacterById(state, characterId = "") {
    const wanted = textSlot(characterId, "");
    if (!wanted) return null;
    return runtimeCharacterEntries(state).find(entry => entry.ids.includes(wanted)) || null;
  }
  function assertSafeRewardPath(path = [], label = "reward path") {
    const errors = rewardPathValidationErrors(path, label);
    if (errors.length) throw new Error(errors[0].message);
    return path.map(part => String(part));
  }
  function existingIntegerAtPath(root, path = [], label = "reward path") {
    if (!hasPathValue(root, path)) throw new Error(`Objective integer reward path does not exist: ${label}`);
    const value = getPathValue(root, path);
    if (!Number.isSafeInteger(value)) throw new Error(`Objective integer reward value is not a safe integer: ${label}`);
    return value;
  }
  function integerRewardRootAndPath(state, reward = {}, prefix = "") {
    const characterId = textSlot(reward[`${prefix}character_id`], "");
    const pathKey = prefix ? `${prefix}path` : "field_path";
    const path = assertSafeRewardPath(reward[pathKey], `modify_integer.${pathKey}`);
    if (!characterId) return {
      root: state,
      path,
      label: path.join(".")
    };
    const character = resolveRuntimeCharacterById(state, characterId);
    if (!character) throw new Error(`Objective integer reward character not found: ${characterId}`);
    return {
      root: character.entity,
      path,
      label: `${characterId}.${path.join(".")}`
    };
  }
  function addSafeIntegers(left, right) {
    if (right > 0 && left > Number.MAX_SAFE_INTEGER - right) return {
      value: Number.MAX_SAFE_INTEGER,
      clamped: true
    };
    if (right < 0 && left < Number.MIN_SAFE_INTEGER - right) return {
      value: Number.MIN_SAFE_INTEGER,
      clamped: true
    };
    return {
      value: left + right,
      clamped: false
    };
  }
  function subtractSafeIntegers(left, right) {
    if (right < 0 && left > Number.MAX_SAFE_INTEGER + right) return {
      value: Number.MAX_SAFE_INTEGER,
      clamped: true
    };
    if (right > 0 && left < Number.MIN_SAFE_INTEGER + right) return {
      value: Number.MIN_SAFE_INTEGER,
      clamped: true
    };
    return {
      value: left - right,
      clamped: false
    };
  }
  function multiplySafeIntegers(left, right) {
    if (left === 0 || right === 0) return {
      value: 0,
      clamped: false
    };
    const resultIsNegative = left < 0 !== right < 0;
    const absoluteLeft = Math.abs(left);
    const absoluteRight = Math.abs(right);
    const maximumSafeLeft = Math.floor(Number.MAX_SAFE_INTEGER / absoluteRight);
    if (absoluteLeft > maximumSafeLeft) return {
      value: resultIsNegative ? Number.MIN_SAFE_INTEGER : Number.MAX_SAFE_INTEGER,
      clamped: true
    };
    return {
      value: left * right,
      clamped: false
    };
  }
  function divideSafeIntegers(left, right, rightIsReferenced) {
    if (right === 0) {
      if (!rightIsReferenced) throw new Error("A hardcoded divide-by-zero reward is invalid.");
      return {
        value: Number.MAX_SAFE_INTEGER,
        clamped: true
      };
    }
    const result = BigInt(left) / BigInt(right);
    if (result > BigInt(Number.MAX_SAFE_INTEGER)) return {
      value: Number.MAX_SAFE_INTEGER,
      clamped: true
    };
    if (result < BigInt(Number.MIN_SAFE_INTEGER)) return {
      value: Number.MIN_SAFE_INTEGER,
      clamped: true
    };
    return {
      value: Number(result),
      clamped: false
    };
  }
  function modifyIntegerReward(state, reward, objective) {
    const validationErrors = modifyIntegerRewardValidationErrors(reward);
    if (validationErrors.length) throw new Error(validationErrors[0].message);
    const target = integerRewardRootAndPath(state, reward);
    const left = existingIntegerAtPath(target.root, target.path, target.label);
    const rightIsReferenced = Object.hasOwn(reward, "value_path");
    let right = reward.value;
    if (rightIsReferenced) {
      const source = integerRewardRootAndPath(state, reward, "value_");
      right = existingIntegerAtPath(source.root, source.path, source.label);
    }
    const operation = textSlot(reward.operation, "").toLowerCase();
    const operations = {
      add: addSafeIntegers,
      subtract: subtractSafeIntegers,
      multiply: multiplySafeIntegers,
      divide: (a, b) => divideSafeIntegers(a, b, rightIsReferenced)
    };
    const operationResult = operations[operation](left, right);
    setPathValue(target.root, target.path, operationResult.value);
    if (operationResult.clamped) log("Objective integer reward clamped", `${target.label}: ${left} ${operation} ${right} was clamped to ${operationResult.value}.`, {
      type: "state",
      level: "warning"
    });
    noteRewardChange(state, rewardLabel(objective, `Integer updated: ${target.label} is now ${operationResult.value}.`));
    return true;
  }
  function absoluteBigInt(value) {
    return value < 0n ? -value : value;
  }
  function greatestCommonBigInt(left, right) {
    let a = absoluteBigInt(left);
    let b = absoluteBigInt(right);
    while (b !== 0n) {
      const next = a % b;
      a = b;
      b = next;
    }
    return a || 1n;
  }
  function normalizeRational(numerator, denominator = 1n) {
    if (denominator === 0n) throw new Error("Numeric expression divided by zero.");
    let top = BigInt(numerator);
    let bottom = BigInt(denominator);
    if (bottom < 0n) {
      top = -top;
      bottom = -bottom;
    }
    const divisor = greatestCommonBigInt(top, bottom);
    return {
      numerator: top / divisor,
      denominator: bottom / divisor
    };
  }
  function decimalScaleBigInt(places = 0) {
    return 10n ** BigInt(Math.max(0, Math.floor(Number(places) || 0)));
  }
  function rationalFromNumber(value) {
    if (!Number.isFinite(value)) throw new Error("Numeric values must be finite.");
    const source = String(value).toLowerCase();
    const match = source.match(/^([+-]?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/);
    if (!match) throw new Error(`Numeric value could not be parsed: ${source}`);
    const sign = match[1] === "-" ? -1n : 1n;
    const fractional = match[3] || "";
    const exponent = Number(match[4] || 0);
    let numerator = BigInt(`${match[2]}${fractional}` || "0") * sign;
    let scale = fractional.length - exponent;
    if (scale < 0) {
      numerator *= decimalScaleBigInt(-scale);
      scale = 0;
    }
    return normalizeRational(numerator, decimalScaleBigInt(scale));
  }
  function applyRationalOperation(left, right, operation) {
    switch (String(operation || "").toLowerCase()) {
      case "add":
        return normalizeRational(left.numerator * right.denominator + right.numerator * left.denominator, left.denominator * right.denominator);
      case "subtract":
        return normalizeRational(left.numerator * right.denominator - right.numerator * left.denominator, left.denominator * right.denominator);
      case "multiply":
        return normalizeRational(left.numerator * right.numerator, left.denominator * right.denominator);
      case "divide":
        if (right.numerator === 0n) throw new Error("Numeric expression divided by zero.");
        return normalizeRational(left.numerator * right.denominator, left.denominator * right.numerator);
      default:
        throw new Error(`Unsupported numeric operation: ${operation}`);
    }
  }
  function numericRootAndPath(state, characterId, path, label) {
    const safePath = assertSafeRewardPath(path, label);
    if (!textSlot(characterId, "")) return {
      root: state,
      path: safePath,
      label: safePath.join(".")
    };
    const character = resolveRuntimeCharacterById(state, characterId);
    if (!character) throw new Error(`Objective numeric reward character not found: ${characterId}`);
    return {
      root: character.entity,
      path: safePath,
      label: `${characterId}.${safePath.join(".")}`
    };
  }
  function existingNumberAtPath(root, path = [], label = "reward path") {
    if (!hasPathValue(root, path)) throw new Error(`Objective numeric reward path does not exist: ${label}`);
    const value = getPathValue(root, path);
    if (!Number.isFinite(value)) throw new Error(`Objective numeric reward value is not finite: ${label}`);
    return value;
  }
  function numericOperandRuntimeValue(state, operand, label) {
    if (typeof operand === "number") return {
      value: rationalFromNumber(operand),
      referenced: false
    };
    if (!isPlainObject(operand)) throw new Error(`${label} is not a numeric operand.`);
    if (Object.hasOwn(operand, "value")) return {
      value: rationalFromNumber(operand.value),
      referenced: false
    };
    const source = numericRootAndPath(state, operand.character_id, operand.path, label);
    return {
      value: rationalFromNumber(existingNumberAtPath(source.root, source.path, source.label)),
      referenced: true
    };
  }
  function evaluateNumericExpression(state, expression = {}, label = "value_expression") {
    let current = numericOperandRuntimeValue(state, expression.initial, `${label}.initial`);
    let clamped = false;
    for (const [index, step] of expression.operations.entries()) {
      const operand = numericOperandRuntimeValue(state, step.operand, `${label}.operations.${index}.operand`);
      if (textSlot(step.operation, "").toLowerCase() === "divide" && operand.value.numerator === 0n) {
        if (!operand.referenced) throw new Error("A hardcoded divide-by-zero expression is invalid.");
        current = {
          value: normalizeRational(BigInt(Number.MAX_SAFE_INTEGER)),
          referenced: true
        };
        clamped = true;
        continue;
      }
      current = {
        value: applyRationalOperation(current.value, operand.value, step.operation),
        referenced: current.referenced || operand.referenced
      };
    }
    return {
      ...current,
      clamped
    };
  }
  function numericRewardOperand(state, reward = {}) {
    if (Object.hasOwn(reward, "value")) return {
      value: rationalFromNumber(reward.value),
      referenced: false,
      clamped: false
    };
    if (Object.hasOwn(reward, "value_path")) {
      const source = numericRootAndPath(state, reward.value_character_id, reward.value_path, "modify_number.value_path");
      return {
        value: rationalFromNumber(existingNumberAtPath(source.root, source.path, source.label)),
        referenced: true,
        clamped: false
      };
    }
    return evaluateNumericExpression(state, reward.value_expression, "modify_number.value_expression");
  }
  function numericDestinationPrecision(state, target, reward = {}) {
    const precision = numericPrecisionMaps(state.numeric_precision);
    const path = target.path;
    if (path.length >= 2 && path[path.length - 2] === "stats") return precision.character_stats[path[path.length - 1]] || 0;
    if (!textSlot(reward.character_id, "") && path[0] === "story_inventory") return precision.story_inventory[path[1]] || 0;
    return 0;
  }
  function quantizeRational(value, places = 0) {
    const scale = decimalScaleBigInt(places);
    const scaledNumerator = value.numerator * scale;
    let rounded = scaledNumerator / value.denominator;
    const remainder = scaledNumerator % value.denominator;
    if (absoluteBigInt(remainder) * 2n >= value.denominator) rounded += scaledNumerator < 0n ? -1n : 1n;
    const maximum = BigInt(Number.MAX_SAFE_INTEGER);
    let clamped = false;
    if (rounded > maximum) {
      rounded = maximum;
      clamped = true;
    } else if (rounded < -maximum) {
      rounded = -maximum;
      clamped = true;
    }
    return {
      value: Number(rounded) / Number(scale),
      scaledInteger: rounded,
      clamped
    };
  }
  function modifyNumberReward(state, reward, objective) {
    const validationErrors = modifyNumberRewardValidationErrors(reward);
    if (validationErrors.length) throw new Error(validationErrors[0].message);
    const target = numericRootAndPath(state, reward.character_id, reward.field_path, "modify_number.field_path");
    const leftNumber = existingNumberAtPath(target.root, target.path, target.label);
    const left = rationalFromNumber(leftNumber);
    const right = numericRewardOperand(state, reward);
    let result;
    let runtimeClamp = right.clamped;
    const operation = textSlot(reward.operation, "").toLowerCase();
    if (operation === "divide" && right.value.numerator === 0n) {
      if (!right.referenced) throw new Error("A hardcoded divide-by-zero reward is invalid.");
      result = normalizeRational(BigInt(Number.MAX_SAFE_INTEGER));
      runtimeClamp = true;
    } else {
      result = applyRationalOperation(left, right.value, operation);
    }
    const places = numericDestinationPrecision(state, target, reward);
    const quantized = quantizeRational(result, places);
    setPathValue(target.root, target.path, quantized.value);
    if ((runtimeClamp || quantized.clamped) && !app.objectiveRewardPreflightActive) log("Objective numeric reward clamped", `${target.label} ${operation} result was clamped to ${quantized.value}.`, {
      type: "state",
      level: "warning"
    });
    noteRewardChange(state, rewardLabel(objective, `Number updated: ${target.label} is now ${quantized.value}.`));
    return true;
  }
  function objectiveRewardTargetAndPath(state, reward = {}) {
    const targetName = textSlot(reward.target || reward.character, "");
    if (targetName && Array.isArray(reward.field_path)) {
      const target = storyRewardCharacterTarget(state, {
        ...reward,
        target: targetName
      });
      if (!target?.entity) throw new Error(`Objective reward target not found: ${targetName}`);
      return {
        root: target.entity,
        path: reward.field_path.map(part => String(part)),
        label: `${target.name}.${reward.field_path.join(".")}`
      };
    }
    const path = objectiveRewardPath(reward);
    return {
      root: state,
      path,
      label: path.join(".")
    };
  }
  function assertRewardPathExists(state, path = [], reward = {}) {
    if (!path.length) throw new Error("Objective reward path is required.");
    if (reward.create_path === true) return;
    let cursor = state;
    for (let i = 0; i < path.length - 1; i++) {
      cursor = cursor?.[path[i]];
      if (cursor == null) throw new Error(`Objective reward path does not exist: ${path.join(".")}`);
    }
  }
  function setStateFieldReward(state, reward, objective) {
    const target = objectiveRewardTargetAndPath(state, reward);
    assertRewardPathExists(target.root, target.path, reward);
    setPathValue(target.root, target.path, canonicalRewardSceneList(state, target.path, clone(reward.value)));
    noteRewardChange(state, rewardLabel(objective, `Story state updated: ${target.label}.`));
    return true;
  }
  function relationshipRewardStats(reward = {}) {
    const preset = reward.preset || "";
    const amount = reward.amount ?? 1;
    const out = {};
    if (preset === "all" || false) {
      out.trust = amount;
      out.attraction = amount;
      out.affection = amount;
    }
    if (isPlainObject(reward.stats)) {
      for (const key of ["trust", "attraction", "affection"]) {
        if (reward.stats[key] != null) out[key] = Number(reward.stats[key]);
      }
    }
    return Object.fromEntries(Object.entries(out).filter(([, value]) => Number.isFinite(value) && value !== 0));
  }
  function relationshipRewardTargets(state, reward = {}) {
    const raw = reward.target;
    const key = raw.toLowerCase();
    const targets = [];
    const add = (name, entity, mirror = null) => {
      if (!name || !entity) return;
      if (isPlayerEntityName(name, state)) return;
      if (targets.some(item => item.name === name)) return;
      targets.push({
        name,
        entity,
        mirror
      });
    };
    const addParty = names => {
      for (const name of names || []) {
        const entity = state.characters?.[name];
        if (entity) add(name, entity);
      }
    };
    const addNpcs = names => {
      for (const name of names || []) {
        const found = findNpcEntryInState(state, name);
        const entity = found?.npc?.full_character || found?.npc;
        if (entity) add(found.npc?.name || found.key || name, entity, found?.npc || null);
      }
    };
    if (["all_present", "present", "scene"].includes(key)) {
      addParty(state.scene?.party_members_present || []);
      addNpcs(state.scene?.npcs_present || []);
      return targets;
    }
    if (["all_party_present", "party_present"].includes(key)) {
      addParty(state.scene?.party_members_present || []);
      return targets;
    }
    if (["all_npcs_present", "npcs_present"].includes(key)) {
      addNpcs(state.scene?.npcs_present || []);
      return targets;
    }
    const target = storyRewardCharacterTarget(state, reward);
    if (target?.entity) add(target.name, target.entity, target.npc || null);
    return targets;
  }
  function adjustRelationshipReward(state, reward, objective) {
    const stats = relationshipRewardStats(reward);
    if (!Object.keys(stats).length) throw new Error("Objective adjust_relationship reward requires stats, preset, or stat deltas.");
    const targets = relationshipRewardTargets(state, reward);
    if (!targets.length) throw new Error(`Objective adjust_relationship reward target not found: ${reward.target || "unknown"}`);
    for (const target of targets) {
      for (const [key, delta] of Object.entries(stats)) {
        target.entity[key] = clamp10(exactState10(target.entity[key], `reward target ${target.name || "unknown"}.${key}`) + delta);
        if (target.mirror && false) {}
      }
    }
    noteRewardChange(state, rewardLabel(objective, `Relationship updated: ${targets.map(item => item.name).join(", ")}.`));
    return true;
  }
  function outfitRewardCharacterTarget(state, reward = {}) {
    const characterId = textSlot(reward.character_id, "");
    if (characterId) {
      const resolved = resolveRuntimeCharacterById(state, characterId);
      if (!resolved) throw new Error(`Objective outfit reward character not found: ${characterId}`);
      return {
        ...resolved,
        name: textSlot(resolved.entity?.name, characterId)
      };
    }
    const target = storyRewardCharacterTarget(state, reward);
    if (!target?.entity) throw new Error(`Objective outfit reward character not found: ${textSlot(reward.target || reward.character || reward.name, "unknown")}`);
    return target;
  }
  function grantOutfitReward(state, reward, objective) {
    const target = outfitRewardCharacterTarget(state, reward);
    const malePresentation = normalizedCharacterGender(target.entity?.gender) === "male";
    const rawOutfit = reward.outfit || (malePresentation ? reward.male_outfit : reward.non_male_outfit);
    if (!rawOutfit) {
      if (reward.equip === true) reportOutfitEquipWarning({
        objective,
        reward,
        targetName: target.name,
        outfitId: reward.male_outfit?.id || reward.non_male_outfit?.id || "",
        reason: `No ${malePresentation ? "male" : "non-male"} outfit presentation was provided.`
      });
      return false;
    }
    if (!isPlainObject(rawOutfit)) throw new Error("Objective grant_outfit reward requires an outfit object.");
    if (!textSlot(rawOutfit.id, "") || !textSlot(rawOutfit.name, "")) throw new Error("Objective grant_outfit reward requires explicit outfit id and name.");
    if (!isPlainObject(rawOutfit.clothing)) throw new Error("Objective grant_outfit reward clothing must be an object.");
    const clothingSlots = Object.keys(rawOutfit.clothing);
    if (!clothingSlots.length) throw new Error("Objective grant_outfit reward clothing must include at least one canonical slot.");
    const invalidSlots = clothingSlots.filter(slot => !validClothingSlots().includes(slot));
    if (invalidSlots.length) throw new Error(`Objective grant_outfit reward uses invalid clothing slots: ${invalidSlots.join(", ")}.`);
    const outfit = exactOutfitRecord(rawOutfit);
    if (!outfit) throw new Error("Objective grant_outfit reward requires an outfit with id, name, and clothing.");
    const outfits = exactEntityOutfits(target.entity);
    const existing = outfits.find(item => item.id === outfit.id);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(outfit)) throw new Error(`Objective grant_outfit reward conflicts with existing outfit id: ${outfit.id}`);
    } else {
      outfits.push(outfit);
    }
    const equipped = reward.equip === true ? applyOutfitToEntity(target.entity, outfit.id, {
      characterName: target.name,
      state
    }) : false;
    if (equipped) deferRewardClothingImage(state, target.name);
    if (reward.equip === true && !equipped) reportOutfitEquipWarning({
      objective,
      reward,
      targetName: target.name,
      outfitId: outfit.id,
      reason: "The granted outfit could not be equipped."
    });
    noteRewardChange(state, rewardLabel(objective, equipped ? `${target.name} received and equipped ${outfit.name}.` : `${target.name} received ${outfit.name}.`));
    return !existing || reward.equip === true;
  }
  function reportOutfitEquipWarning({
    objective = {},
    reward = {},
    targetName = "",
    outfitId = "",
    reason = ""
  } = {}) {
    if (app.objectiveRewardPreflightActive) return false;
    const objectiveLabel = textSlot(objective.title || objective.id, "unknown objective");
    const targetLabel = textSlot(targetName || reward.character_id, "unknown character");
    const outfitLabel = textSlot(outfitId || reward.outfit_id, "unknown outfit");
    reportAppIssue(new Error(`Objective "${objectiveLabel}" tried to equip outfit "${outfitLabel}" on ${targetLabel}, but it could not be equipped. ${reason}`.trim()), {
      severity: "warning",
      title: "Outfit Equip Failed",
      context: "objective reward",
      type: "state",
      forcePopup: true,
      allowExportBoth: true,
      details: {
        objectiveId: objective.id || "",
        objectiveTitle: objective.title || "",
        characterId: reward.character_id || "",
        targetName: targetLabel,
        outfitId: outfitLabel,
        reason
      }
    });
    return false;
  }
  function equipOutfitReward(state, reward, objective) {
    const outfitId = textSlot(reward.outfit_id, "");
    let target = null;
    try {
      target = outfitRewardCharacterTarget(state, reward);
    } catch (error) {
      reportOutfitEquipWarning({
        objective,
        reward,
        outfitId,
        reason: error?.message || String(error)
      });
      return false;
    }
    if (!outfitId || !applyOutfitToEntity(target.entity, outfitId, {
      characterName: target.name,
      state
    })) {
      reportOutfitEquipWarning({
        objective,
        reward,
        targetName: target.name,
        outfitId,
        reason: outfitId ? "The character does not own that outfit." : "No outfit id was provided."
      });
      return false;
    }
    const outfit = target.entity.outfits.find(item => item.id === target.entity.active_outfit_id);
    deferRewardClothingImage(state, target.name);
    noteRewardChange(state, rewardLabel(objective, `${target.name} equipped ${outfit?.name || outfitId}.`));
    return true;
  }
  function clearEntityActiveOutfit(entity) {
    if (!isPlainObject(entity)) return;
    entity.active_outfit_id = "";
    entity.clothing = blankClothingTemplate();
  }
  function deleteOutfitReward(state, reward, objective) {
    const target = outfitRewardCharacterTarget(state, reward);
    const outfitId = textSlot(reward.outfit_id, "");
    if (!outfitId) throw new Error("Objective delete_outfit reward requires outfit_id.");
    const outfits = exactEntityOutfits(target.entity);
    const index = outfits.findIndex(outfit => outfit.id === outfitId || outfit.name.toLowerCase() === outfitId.toLowerCase());
    if (index < 0) return false;
    const [deleted] = outfits.splice(index, 1);
    if (target.entity.active_outfit_id === deleted.id) {
      clearEntityActiveOutfit(target.entity);
      deferRewardClothingImage(state, target.name);
    }
    noteRewardChange(state, rewardLabel(objective, `${target.name} permanently lost ${deleted.name}.`));
    return true;
  }
  function deleteAllOutfitsReward(state, reward, objective) {
    const target = outfitRewardCharacterTarget(state, reward);
    const outfits = exactEntityOutfits(target.entity);
    const hadOutfits = outfits.length > 0;
    const hadActiveOutfit = !!textSlot(target.entity.active_outfit_id, "");
    const hadClothing = validClothingSlots().some(slot => clothingItemText(target.entity.clothing?.[slot]));
    target.entity.outfits = [];
    clearEntityActiveOutfit(target.entity);
    if (!hadOutfits && !hadActiveOutfit && !hadClothing) return false;
    if (hadActiveOutfit || hadClothing) deferRewardClothingImage(state, target.name);
    noteRewardChange(state, rewardLabel(objective, `${target.name}'s saved outfits were permanently removed.`));
    return true;
  }
  function deferRewardClothingImage(state, targetName = "") {
    if (app.objectiveRewardPreflightActive || state !== app.state || !textSlot(targetName, "")) return false;
    const transaction = app.activeRewardApplicationTransaction;
    if (transaction?.state === state) {
      transaction.clothingImageTargets ||= new Set();
      transaction.clothingImageTargets.add(targetName);
      return true;
    }
    queueOneOffCharacterImage(targetName, `${targetName} reward clothing changed`, {
      kind: "clothing",
      immediate: true
    });
    return true;
  }
  function addStateListItemReward(state, reward, objective) {
    const target = objectiveRewardTargetAndPath(state, reward);
    assertRewardPathExists(target.root, target.path, reward);
    const list = getPathValue(target.root, target.path);
    if (!Array.isArray(list)) throw new Error(`Objective reward target is not a list: ${target.label}`);
    const value = canonicalRewardSceneListValue(state, target.path, clone(reward.value ?? reward.item));
    if (value == null || value === "") throw new Error(`Objective reward list value is required: ${target.label}`);
    if (!list.some(item => JSON.stringify(item) === JSON.stringify(value))) list.push(value);
    noteRewardChange(state, rewardLabel(objective, `Story list updated: ${target.label}.`));
    return true;
  }
  function removeStateListItemReward(state, reward, objective) {
    const target = objectiveRewardTargetAndPath(state, reward);
    assertRewardPathExists(target.root, target.path, reward);
    const list = getPathValue(target.root, target.path);
    if (!Array.isArray(list)) throw new Error(`Objective reward target is not a list: ${target.label}`);
    const match = isPlainObject(reward.match) ? reward.match : null;
    const rawValue = reward.value ?? reward.item;
    const value = rawValue === undefined ? undefined : canonicalRewardSceneListValue(state, target.path, clone(rawValue));
    if ((value == null || value === "") && !match) throw new Error(`Objective reward remove_state_list_item requires value/item or match: ${target.label}`);
    const matches = item => {
      if (match) {
        return Object.entries(match).every(([key, expected]) => JSON.stringify(item?.[key]) === JSON.stringify(expected));
      }
      return JSON.stringify(item) === JSON.stringify(value);
    };
    const before = list.length;
    for (let i = list.length - 1; i >= 0; i--) {
      if (matches(list[i])) list.splice(i, 1);
    }
    if (list.length === before) return false;
    noteRewardChange(state, rewardLabel(objective, `Story list item removed: ${target.label}.`));
    return true;
  }
  function addStoryRuleReward(state, reward, objective) {
    const text = reward.text;
    if (!text) throw new Error("Objective add_story_rule reward requires text.");
    if (!Array.isArray(state.story_rules)) throw new Error("Runtime story_rules must be a validated array.");
    const existing = state.story_rules.find(rule => rule?.id === reward.rule_id);
    if (existing) {
      if (existing.text !== text) throw new Error(`Story rule id conflicts with existing rule: ${reward.rule_id}`);
      return false;
    }
    state.story_rules.push({
      id: reward.rule_id,
      text
    });
    if (state === app.state) {
      app.storyRulesRuntime = storyRulesRuntimeFromState(state, app.storyDefinition);
      markRuntimeRecordDirty("story-rules-runtime", "current");
      bumpDomainRevision("story-rules");
    }
    noteRewardChange(state, rewardLabel(objective, "Story rule added."));
    return true;
  }
  function removeStoryRuleReward(state, reward, objective) {
    const id = reward.rule_id;
    if (!id) throw new Error("Objective remove_story_rule reward requires rule_id.");
    if (!Array.isArray(state.story_rules)) throw new Error("Runtime story_rules must be a validated array.");
    const before = state.story_rules;
    state.story_rules = before.filter(rule => {
      if (id && rule.id === id) return false;
      return true;
    });
    if (state.story_rules.length === before.length) return false;
    if (state === app.state) {
      app.storyRulesRuntime = storyRulesRuntimeFromState(state, app.storyDefinition);
      markRuntimeRecordDirty("story-rules-runtime", "current");
      bumpDomainRevision("story-rules");
    }
    noteRewardChange(state, rewardLabel(objective, "Story rule removed."));
    return true;
  }
  function storyRewardCharacterTarget(state, reward = {}) {
    const requestedName = textSlot(reward.target || reward.character || reward.name, "");
    const name = resolveEntityName(requestedName, state, requestedName);
    if (!name) return null;
    if (isPlayerEntityName(name, state)) {
      return {
        kind: "player",
        name: "Player",
        entity: state.player
      };
    }
    if (state.characters?.[name]) {
      return {
        kind: "party",
        name,
        entity: state.characters[name]
      };
    }
    const found = findNpcEntryInState(state, name);
    if (found?.npc) {
      return {
        kind: "npc",
        name: found.npc.name || found.key,
        npc: found.npc,
        entity: found.npc.full_character || found.npc,
        locationLabel: found.locationLabel,
        key: found.key
      };
    }
    return null;
  }
  function characterCanDie(target) {
    const entity = target?.entity || target?.npc;
    return entity?.can_die !== false && target?.npc?.can_die !== false;
  }
  function markStoryCharacterDead(state, target, reward = {}) {
    const note = textSlot(reward.reason, "Died during the story.");
    const killer = textSlot(reward.killed_by, "");
    if (target.kind === "npc") {
      target.npc.status = "dead";
      target.npc.relationship = "dead";
      target.npc.death_note = note;
      if (killer) target.npc.killed_by = killer;
      if (reward.killed_by_player != null) target.npc.killed_by_player = reward.killed_by_player === true;
      if (target.npc.full_character) {
        target.npc.full_character.physical_state = "dead";
        target.npc.full_character.state_of_mind = "dead";
        target.npc.full_character.pose = "dead";
      }
    } else {
      target.entity.physical_state = "dead";
      target.entity.state_of_mind = "dead";
      target.entity.pose = "dead";
      target.entity.death_note = note;
    }
    state.scene ||= {};
    for (const key of ["party_members_present", "npcs_present", "image_characters"]) {
      if (Array.isArray(state.scene[key])) state.scene[key] = state.scene[key].filter(name => String(name) !== String(target.name));
    }
  }
  function killCharacterReward(state, reward, objective) {
    const target = storyRewardCharacterTarget(state, reward);
    if (!target) throw new Error(`Objective kill_character reward target not found: ${textSlot(reward.target || reward.character || reward.name, "unknown")}`);
    if (reward.ignore_can_die !== true && !characterCanDie(target)) {
      if (!app.objectiveRewardPreflightActive) log("Death blocked", `${target.name} could not be killed because can_die is false.`, {
        type: "state",
        level: "message"
      });
      return true;
    }
    markStoryCharacterDead(state, target, reward);
    noteRewardChange(state, rewardLabel(objective, `${target.name} died.`));
    return true;
  }
  function objectiveRewardAuthoredImageSlot(reward = {}) {
    return runtimeStoryImageSlotFromExactInput(reward.image, {
      image_prompt: reward.prompt || reward.image_prompt || reward.positive_prompt || reward.positivePrompt,
      negative_prompt: reward.negative_prompt || reward.negativePrompt,
      image_id: reward.local_image_id,
      seed: reward.seed,
      model: reward.model
    });
  }
  function authoredNormalImageHtml(slot = null) {
    const direct = authoredStoryImageSlotHtml(slot);
    if (direct) return direct;
    const localId = textSlot(slot?.local_image_id, "");
    if (!localId) return "";
    const local = (app.images || []).find(image => String(image.id) === localId);
    return local ? renderImageRecordHtml(local) : "";
  }
  function createAuthoredNormalRewardImage(reward, objective, options = {}) {
    const slot = objectiveRewardAuthoredImageSlot(reward);
    const html = authoredNormalImageHtml(slot);
    if (!html) return null;
    const rewardId = textSlot(options.rewardId || storyImageRewardId(reward, objective), "");
    const existing = rewardId ? (app.images || []).find(image => String(image.storyImageRewardId || "") === rewardId) : null;
    if (existing && !existing.error) return existing;
    return createNormalImageRequest({
      title: textSlot(reward.title || options.title || objective?.title, "Story Image"),
      reason: reward.reason || objective?.title || "story progression",
      model: selectedImageModel(slot?.model || activeNormalImageModel()),
      seed: slot?.seed ?? reward.seed ?? 0,
      prompt: textSlot(slot?.prompt, ""),
      negativePrompt: textSlot(slot?.negative_prompt, ""),
      html,
      hosted_url: authoredStoryImageSlotUrl(slot),
      pending: false,
      targets: Array.isArray(options.targets) ? options.targets : [],
      promptType: textSlot(options.promptType, "authored story image"),
      storyImageRewardId: rewardId,
      hideFromChat: options.hideFromChat === true
    }, {
      startRequest: false
    });
  }
  function rememberAuthoredProfileRewardImage(target, reward, objective) {
    const slot = objectiveRewardAuthoredImageSlot(reward);
    if (!slot) return null;
    const localId = textSlot(slot.local_image_id, "");
    const local = localId ? profileImageByStoreId(localId) : null;
    const html = authoredStoryImageSlotHtml(slot) || profileImageRealHtml(local?.html || "");
    if (!html) return null;
    const rewardId = textSlot(slot.id || localId || `${storyImageRewardId(reward, objective)}:profile:${target.name}`, "");
    return rememberProfileImage(target.name, {
      ...(local || {}),
      id: rewardId,
      source: textSlot(slot.source, "story"),
      model: slot.model || local?.model || resolvedProfileImageModel(target),
      seed: slot.seed ?? local?.seed ?? 0,
      prompt: slot.prompt || local?.prompt || "",
      negativePrompt: slot.negative_prompt || local?.negativePrompt || "",
      html,
      hosted_url: authoredStoryImageSlotUrl(slot) || local?.hosted_url || "",
      male: profileImageMalePresentation(target),
      pending: false,
      error: ""
    }, {
      setActive: true,
      save: true
    });
  }
  function generateProfileImageReward(state, reward, objective) {
    const target = storyRewardCharacterTarget(state, reward);
    if (!target) throw new Error(`Objective generate_profile_image reward target not found: ${textSlot(reward.target || reward.character || reward.name, "unknown")}`);
    if (state !== app.state || stateIsNotActiveGameContext()) return false;
    if (rememberAuthoredProfileRewardImage(target, reward, objective)) {
      noteRewardChange(state, rewardLabel(objective, `${target.name} profile image selected.`));
      return true;
    }
    queueProfileImage(target.name, {
      reason: reward.reason || objective?.title || "story progression",
      manual: false,
      ignoreAutoImages: true
    });
    noteRewardChange(state, rewardLabel(objective, `${target.name} profile image queued.`));
    return true;
  }
  function generateSoloNormalImageReward(state, reward, objective) {
    const target = storyRewardCharacterTarget(state, reward);
    if (!target) throw new Error(`Objective generate_solo_normal_image reward target not found: ${textSlot(reward.target || reward.character || reward.name, "unknown")}`);
    if (state !== app.state || stateIsNotActiveGameContext()) return false;
    if (createAuthoredNormalRewardImage(reward, objective, {
      rewardId: `${storyImageRewardId(reward, objective)}:solo:${textSlot(target.id || target.name, target.name)}`,
      title: target.name,
      targets: [target.name],
      promptType: "authored solo character image"
    })) {
      noteRewardChange(state, rewardLabel(objective, `${target.name} solo image added.`));
      return true;
    }
    const outfitId = textSlot(reward.outfit_id, "");
    const outfit = outfitId ? (target.entity?.outfits || []).find(entry => entry?.id === outfitId) : null;
    if (outfitId && !outfit) throw new Error(`Objective generate_solo_normal_image reward outfit not found for ${target.name}: ${outfitId}`);
    const allowedOutfit = outfit;
    queueOneOffCharacterImage(target.name, reward.reason || objective?.title || "story progression", {
      ...(allowedOutfit ? {
        clothingOverrides: {
          [target.name]: exactClothingSlots(allowedOutfit.clothing || {})
        },
        heldItemsOverrides: {
          [target.name]: allowedOutfit.held_items || {}
        }
      } : {}),
      ...(Object.hasOwn(reward, "description") ? {
        descriptionOverride: reward.description
      } : {}),
      ...(Object.hasOwn(reward, "background") ? {
        backgroundOverride: reward.background
      } : {})
    });
    noteRewardChange(state, rewardLabel(objective, `${target.name} solo image queued.`));
    return true;
  }
  function storyImageRewardId(reward, objective) {
    return textSlot(reward.id || reward.image_id || reward.key || `${objective?.id || "objective"}:story-image`, "");
  }
  function generateStoryImageReward(state, reward, objective) {
    const authoredImage = objectiveRewardAuthoredImageSlot(reward);
    const rawPrompt = textSlot(authoredImage?.prompt || reward.prompt || reward.positive_prompt || reward.positivePrompt, "");
    if (!rawPrompt && !authoredStoryImageSlotHasReference(authoredImage)) throw new Error("Objective generate_story_image reward requires a prompt or authored image reference.");
    if (state !== app.state || stateIsNotActiveGameContext()) return false;
    const id = storyImageRewardId(reward, objective);
    const existing = id ? (app.images || []).find(image => String(image.storyImageRewardId || "") === String(id)) : null;
    if (existing && !existing.error) return true;
    if (createAuthoredNormalRewardImage(reward, objective, {
      rewardId: id,
      promptType: "authored objective story image"
    })) {
      noteRewardChange(state, rewardLabel(objective, `${textSlot(reward.title || reward.name, "Story")} image revealed.`));
      return true;
    }
    const model = selectedImageModel(authoredImage?.model || activeNormalImageModel());
    const safePrompt = sanitizeFamilyFriendlyImagePrompt(rawPrompt, {});
    const negativePrompt = joinPromptParts([textSlot(authoredImage?.negative_prompt || reward.negative_prompt || reward.negativePrompt, ""), buildImageSafetyNegativePrompt()]);
    const styled = applyImageArtStyle(safePrompt, negativePrompt, model);
    const title = textSlot(reward.title || reward.name || objective?.title || "Story Image", "Story Image");
    const seed = (authoredImage?.seed ?? reward.seed) == null || (authoredImage?.seed ?? reward.seed) === "" ? "random" : exactProfileImageSeed(authoredImage?.seed ?? reward.seed, "objective reward image seed");
    const reason = reward.reason || objective?.title || "story progression";
    const record = createNormalImageRequest({
      title,
      reason,
      model,
      seed,
      prompt: styled.prompt,
      negativePrompt: styled.negativePrompt,
      html: imageLoadingHtml("Story image generation in progress"),
      pending: true,
      targets: [],
      promptType: "objective story image",
      storyImageRewardId: id
    });
    noteRewardChange(state, rewardLabel(objective, `${title} image revealed.`));
    log("Story image requested", styled.prompt, {
      type: "image",
      level: "message",
      details: {
        id,
        title,
        reason,
        negativePrompt: styled.negativePrompt
      }
    });
    return true;
  }
  function startObjectiveReward(state, reward, objective) {
    if (isPlainObject(reward.objective)) throw new Error("Inline start_objective.objective definitions are not supported. Author the objective and reference objective_id.");
    state.objectives ||= {
      active_id: "",
      items: []
    };
    const existingId = textSlot(reward.objective_id || reward.id, "");
    if (!existingId) throw new Error("start_objective reward requires objective_id.");
    const existing = (state.objectives.items || []).find(item => String(item.id) === String(existingId));
    if (!existing) throw new Error(`start_objective references missing authored/runtime job objective: ${existingId}`);
    existing.available_now = true;
    existing.blocked_reason = "";
    if (!objectiveIsComplete(existing)) setObjectiveRuntimeStatus(state, existing, "active");
    existing.available_now = true;
    if (!objectiveIsComplete(existing)) setObjectiveRuntimeStatus(state, existing, "active");
    if (reward.activate !== false) {
      if (objectiveIsSide(existing)) {
        state.objectives.focus_id = existing.id;
      } else {
        state.objectives.active_id = existing.id;
        state.objectives.focus_id = "";
      }
      state.objectives.no_current = false;
      clearObjectiveChoiceState(state);
      syncObjectiveRuntimeControls(state);
    }
    noteRewardChange(state, rewardLabel(objective, `Objective started: ${existing.title}.`));
    return true;
  }
  function characterStoryObjectiveId(source = {}) {
    return typeof source?.on_purchase_objective === "string" ? source.on_purchase_objective : "";
  }
  function startCharacterStoryObjectiveIfPresent(state, source, context = {}) {
    const objectiveId = characterStoryObjectiveId(source);
    if (!objectiveId) return false;
    const started = startObjectiveReward(state, {
      objective_id: objectiveId,
      activate: false
    }, {
      id: context.sourceId || "character-story",
      title: context.sourceTitle || "character story"
    });
    if (!started) return false;
    if (selectedObjectiveSwitchBlocked(state)) return true;
    const objective = (state.objectives?.items || []).find(item => String(item.id) === String(objectiveId));
    if (!objective || !objectiveCanBeSelected(objective, state)) return true;
    if (objectiveIsSide(objective)) {
      state.objectives.focus_id = objective.id;
    } else {
      state.objectives.active_id = objective.id;
      state.objectives.focus_id = "";
    }
    state.objectives.no_current = false;
    clearObjectiveChoiceState(state);
    return true;
  }
  function completeObjectiveReward(state, reward, objective) {
    const id = textSlot(reward.objective_id || reward.id, "");
    const target = (state.objectives?.items || []).find(item => item.id === id);
    if (!target) return false;
    setObjectiveRuntimeStatus(state, target, "complete");
    updateObjectivePrerequisiteLocks(state, [target.id]);
    noteRewardChange(state, rewardLabel(objective, `Objective completed: ${target.title}.`));
    return true;
  }
  const GENERATED_JOB_LIBRARY = (() => {
    const boardLocations = ["old market lane", "riverside storehouse", "south slum alley", "collapsed guild cellar", "abandoned bathhouse", "moonlit canal bridge", "border farmstead", "burned shrine room"];
    const clients = ["baker", "healer", "innkeeper", "merchant", "guard clerk", "bathhouse owner", "scrap dealer"];
    const base = [["cellar_pest_cleanup", "Cellar Pest Cleanup", 0, "Clear out {threat} troubling {client}'s {place}."], ["missing_delivery", "Missing Delivery", 0, "Recover a lost parcel before {client}'s buyer walks away."], ["night_watch", "Night Watch", 0, "Watch {place} through a dangerous night."], ["scrap_recovery", "Scrap Recovery", 0, "Recover useful salvage from {place}."], ["bathhouse_towel_thief", "Bathhouse Towel Thief", 0, "Catch the thief causing chaos at {place}."], ["escort_client", "Escort Client", 1, "Escort {client} safely through {place}."], ["problem_customer", "Problem Customer", 1, "Remove a dangerous customer without wrecking {place}."], ["recover_stolen_tools", "Recover Stolen Tools", 1, "Track down stolen tools taken from {client}."], ["cursed_item_retrieval", "Cursed Item Retrieval", 2, "Retrieve a cursed item before it changes hands."], ["rival_adventurer", "Rival Adventurer Trouble", 2, "Stop a rival adventurer from ruining {client}'s contract."], ["protect_witness", "Protect a Witness", 2, "Keep a witness alive until they reach the guild."], ["bounty_hunt", "Bounty Hunt", 3, "Hunt a named target hiding near {place}."], ["noble_blackmail", "Noble Blackmail Job", 3, "Recover blackmail material before a noble pays someone worse."], ["guard_vault", "Guard the Guild Vault", 3, "Defend the guild vault during a suspicious transfer."], ["forbidden_ruin", "Forbidden Ruin Expedition", 4, "Explore a forbidden ruin for a rare guild prize."], ["guild_hall_siege", "Guild Hall Siege", 4, "Help stop an emergency attack on the guild hall."]];
    const threats = ["mold imps", "gutter goblins", "glass rats", "pink slimes", "contract thieves", "hungry mimics", "territorial harpies", "masked debt collectors"];
    const variants = ["quiet", "messy", "urgent", "funny"];
    const jobs = [];
    for (const [id, title, rank, summary] of base) {
      for (const variant of variants) {
        const index = jobs.length + 1;
        jobs.push({
          id: `${id}_${variant}`,
          title: `${title}${variant === "quiet" ? "" : `: ${variant[0].toUpperCase()}${variant.slice(1)}`}`,
          rank,
          genres: ["fantasy"],
          summary,
          local_pools: {
            place: boardLocations,
            client: clients,
            threat: threats
          },
          reward_coins: 25 + rank * 55 + index % 4 * 10,
          reward_xp: Math.max(1, rank || 1),
          rare: rank >= 4
        });
      }
    }
    const genreProfiles = [["anime"], ["fantasy"], ["sci-fi"], ["modern"], ["historical"], ["romance"], ["adventure"], ["action"], ["comedy"], ["drama"], ["mystery"], ["thriller"], ["horror"], ["dark"], ["cozy"], ["slice of life"], ["superpower"], ["isekai"], ["school"], ["workplace"], ["political"], ["war"], ["crime"], ["mythology"], ["supernatural"], ["post-apocalyptic"], ["western"], ["cyberpunk"], ["steampunk"], ["ensemble"], ["fantasy", "romance"], ["fantasy", "adventure"], ["fantasy", "dark"], ["sci-fi", "cyberpunk"], ["modern", "crime"], ["historical", "political"], ["school", "slice of life"], ["supernatural", "mystery"], ["horror", "thriller"], ["cozy", "comedy"], ["isekai", "ensemble"]];
    const genreFlavor = {
      anime: "Expect heightened reactions and character drama.",
      fantasy: "The trail may involve guild magic, old ruins, local monsters, or minor powers.",
      "sci-fi": "The trail may involve technology, stations, labs, ships, or synthetic life.",
      modern: "The problem stays grounded in contemporary streets, businesses, and private lives.",
      historical: "Local custom, rank, old law, travel limits, or period trade may matter.",
      romance: "Attraction, jealousy, trust, or emotional risk may complicate the job.",
      adventure: "Travel, discovery, risk, and a clear payoff are expected.",
      action: "Physical danger, pursuit, or a decisive confrontation may be involved.",
      comedy: "The complication is awkward, playful, or absurd.",
      drama: "A hard personal choice or emotional fallout sits near the center of the job.",
      mystery: "Clues, lies, missing details, or hidden motives matter.",
      thriller: "Pressure, suspicion, and consequences shape the job.",
      horror: "Fear, dread, isolation, or monster threat may be involved.",
      dark: "Exploitation, moral cost, coercion, or ugly survival may be involved.",
      cozy: "The stakes are local, personal, warm, and recoverable.",
      "slice of life": "The conflict is intimate, social, and rooted in daily routines.",
      superpower: "Powers, secret identities, civilians, or collateral damage may matter.",
      isekai: "Unfamiliar-world rules, guild rank, odd customs, or skill systems may matter.",
      school: "Students, clubs, teachers, exams, dorms, or campus secrets may matter.",
      workplace: "Workplace politics, clients, bosses, coworkers, or contracts may matter.",
      political: "Alliances, reputation, leverage, or public consequences may matter.",
      war: "Shortages, deserters, refugees, enemy movement, or battlefield choices may matter.",
      crime: "Criminals, debt, blackmail, contraband, witnesses, or dirty bargains may matter.",
      mythology: "Gods, omens, relics, monsters, vows, or ancient rules may matter.",
      supernatural: "Spirits, curses, omens, forbidden places, or occult rules may matter.",
      "post-apocalyptic": "Scarcity, scavenging, ruined shelter, or dangerous survivors may matter.",
      western: "Frontier law, dusty travel, grudges, outlaws, ranches, or saloons may matter.",
      cyberpunk: "Neon backrooms, hacked systems, corpo pressure, or street clinics may matter.",
      steampunk: "Brass machinery, airships, boilers, inventors, or smoky industry may matter.",
      ensemble: "Multiple companions, rivalry, jealousy, group trust, or shared history may matter."
    };
    const jobTitleWords = (text = "") => String(text || "").split(/\s+/).filter(Boolean).map(word => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`).join(" ");
    const genericFrames = [["missing_person", "Find a missing person tied to {place}.", "client"], ["protect_witness", "Protect {client} until the next bell.", "witness"], ["recover_item", "Recover {object} from {place}.", "client"], ["stop_blackmail", "Stop a blackmail exchange involving {client}.", "rival"], ["quiet_delivery", "Deliver {object} without drawing attention.", "courier"], ["ambush_cleanup", "Clear an ambush site near {place}.", "guard"], ["monster_problem", "Handle {threat} before they spill into town.", "hunter"], ["social_dispute", "Resolve a tense dispute for {client}.", "mediator"], ["guard_shift", "Work a dangerous guard shift at {place}.", "guard"], ["rival_challenge", "Answer a rival's public challenge.", "rival"], ["lost_map", "Recover a map fragment from {place}.", "scholar"], ["sabotage_probe", "Find who sabotaged {client}'s work.", "investigator"], ["rescue_captive", "Rescue someone held near {place}.", "rescuer"], ["escort_home", "Escort {client} through hostile streets.", "escort"], ["debt_pressure", "Handle a debt collector threatening {client}.", "collector"], ["forbidden_room", "Investigate a room everyone avoids.", "caretaker"], ["public_scandal", "Contain a scandal before it spreads.", "fixer"], ["supply_run", "Secure scarce supplies from {place}.", "supplier"], ["haunted_signal", "Trace a strange signal or omen.", "occultist"], ["tournament_bout", "Enter a small local contest.", "sponsor"], ["bodyguard_date", "Bodyguard {client} during a private meeting.", "client"], ["companion_trial", "Help a potential companion prove herself.", "candidate"], ["secret_auction", "Interrupt a secret auction.", "auctioneer"], ["field_hunt", "Hunt a dangerous target outside town.", "hunter"], ["memory_theft", "Recover stolen memories or records.", "archivist"], ["faction_message", "Carry a message between hostile factions.", "envoy"], ["ritual_watch", "Guard a ritual until dawn.", "ritualist"], ["train_recruit", "Train a nervous recruit through one real danger.", "recruit"], ["heist_counter", "Stop a planned theft without starting a riot.", "guard"], ["duel_proxy", "Fight or negotiate as someone's proxy.", "sponsor"], ["market_beast", "Capture a runaway market creature.", "handler"], ["hidden_cache", "Find a cache before a rival crew does.", "scavenger"], ["bad_contract", "Break a contract that is ruining {client}.", "contract holder"], ["safehouse_visit", "Check a safehouse that went silent.", "handler"], ["festival_trouble", "Handle trouble during a public festival.", "organizer"], ["private_lesson", "Attend a private lesson that may turn dangerous.", "tutor"], ["rank_test", "Complete a guild rank test.", "examiner"], ["boss_marker", "Mark a powerful target for a later hunt.", "scout"], ["peace_talk", "Keep a fragile peace talk from collapsing.", "negotiator"], ["poisoned_goods", "Find who poisoned a shipment.", "merchant"], ["stolen_pet", "Find a beloved creature stolen from {client}.", "owner"], ["forged_pass", "Expose or obtain a forged pass.", "clerk"]];
    const objects = ["sealed package", "ledger", "mana core", "evidence pouch", "medicine case", "odd relic", "key ring", "broken charm"];
    const moods = [["Quiet", 0], ["Tangled", 0], ["Urgent", 1], ["Strange", 0], ["Grim", 1], ["High-Stakes", 2]];
    for (const genres of genreProfiles) {
      const primary = genres[0];
      for (const [frameId, summary, role] of genericFrames) {
        for (const [mood, rankBonus] of moods) {
          const index = jobs.length + 1;
          const rank = Math.min(5, Math.max(0, (index + genres.length + rankBonus) % 5));
          const flavor = genres.map(genre => genreFlavor[genre] || "").filter(Boolean).join(" ");
          jobs.push({
            id: `generic_${objectiveIdFromTitle([...genres, frameId, mood].join("-"), "job")}`,
            title: `${mood} ${jobTitleWords(frameId.replace(/_/g, " "))}`,
            rank,
            genres,
            summary: flavor ? `${summary} ${flavor}` : summary,
            local_pools: {
              place: boardLocations,
              client: clients,
              threat: threats,
              object: objects
            },
            reward_coins: 30 + rank * 60 + index % 5 * 15,
            reward_xp: Math.max(1, rank + 1),
            rare: rank >= 4 || primary === "ensemble" && false,
            romanceable: genres.includes("romance") || genres.includes("ensemble"),
            role
          });
        }
      }
    }
    return jobs;
  })();
  function generatedJobEligibleTemplates(board = {}, state = app.state) {
    const rank = Number(ensureStoryInventory(state).adventurer_rank || 0);
    const storyGenres = new Set(approvedGenreList(state?.meta?.genres || state?.meta?.genre || []));
    const activeTemplateIds = new Set(Object.values(state.active_generated_jobs || {}).map(job => job.template_id));
    return GENERATED_JOB_LIBRARY.filter(template => {
      if (activeTemplateIds.has(template.id)) return false;
      if ((template.genres || []).some(genre => !storyGenres.has(genre))) return false;
      if (template.rank > rank + 1) return false;
      if (template.rare && Math.random() > 0.25) return false;
      return true;
    });
  }
  function storyJobItemMatchesGenres(item = {}, state = app.state) {
    const required = approvedGenreList(item.genres || []);
    if (!required.length) return true;
    const storyGenres = new Set(approvedGenreList(state?.meta?.genres || state?.meta?.genre || []));
    return required.every(genre => storyGenres.has(genre));
  }
  function storyJobOffersForBoard(board = {}, state = app.state) {
    return (board.items || []).filter(item => item?.id && item.completed !== true && item.accepted !== true && storyJobItemMatchesGenres(item, state) && void 0 !== true).map(item => ({
      source: "story",
      story_job_id: item.id,
      offer_id: `story-job-${item.id}`,
      template_id: "",
      title: item.title || item.id,
      rank: item.rank || 0,
      romanceable: item.romanceable === true,
      genres: approvedGenreList(item.genres || []),
      summary: item.summary || item.title || item.id,
      reward_coins: item.reward_coins || 0,
      reward_xp: item.reward_xp || 0,
      reward_items: clone(item.reward_items || []),
      requirements: clone(item.requirements || []),
      locked: item.locked === true,
      unlock_reason: item.unlock_reason || "",
      client_npc_id: item.client_npc_id || "",
      start_location: clone(item.start_location || {}),
      completion_criteria: item.completion_criteria || "",
      completion_instruction: item.completion_instruction || ""
    }));
  }
  function fillGeneratedJobTemplate(template, board = {}, state = app.state) {
    const pick = (items, fallback = "") => Array.isArray(items) && items.length ? items[Math.floor(Math.random() * items.length)] : fallback;
    const filled = {};
    for (const [key, values] of Object.entries(template.local_pools || {})) {
      filled[key] = pick(values, key);
    }
    const title = template.title;
    const summary = String(template.summary || title).replace(/\{(\w+)\}/g, (_, key) => String(filled[key] || key));
    return {
      offer_id: `job-offer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      template_id: template.id,
      title,
      rank: template.rank,
      romanceable: template.romanceable === true,
      genres: approvedGenreList(template.genres || []),
      summary,
      reward_coins: template.reward_coins,
      reward_xp: template.reward_xp,
      filled_values: filled,
      accepted: false
    };
  }
  function ensureJobOffersForBoard(boardId, options = {}) {
    const board = storyShopById(boardId);
    if (!board || board.type !== "job") return [];
    if (!isPlainObject(app.state.story_job_offers)) throw new Error("state.story_job_offers must be an object.");
    const storyOffers = storyJobOffersForBoard(board, app.state);
    if (!options.force && app.state.story_job_offers[board.id]?.length) return [...storyOffers, ...app.state.story_job_offers[board.id]];
    const eligible = board.generic_jobs_enabled === false ? [] : generatedJobEligibleTemplates(board, app.state);
    const count = Math.max(1, Number(board.visible_count || 5));
    const offers = [];
    const used = new Set();
    while (offers.length < count && used.size < eligible.length) {
      const template = eligible[Math.floor(Math.random() * eligible.length)];
      if (!template || used.has(template.id)) continue;
      used.add(template.id);
      offers.push(fillGeneratedJobTemplate(template, board, app.state));
    }
    app.state.story_job_offers[board.id] = offers;
    return [...storyOffers, ...offers];
  }
  function clearAllGeneratedJobOffers(state = app.state) {
    state.story_job_offers = {};
  }
  function generatedJobObjectiveIds(jobId = "") {
    const id = safeRuntimeIdPart(jobId);
    return [generatedJobObjectiveId(id, "start"), generatedJobObjectiveId(id, "handle"), generatedJobObjectiveId(id, "turn-in")];
  }
  function generatedNpcNameForRole(role = "", seed = "") {
    const first = ["Mara", "Tessa", "Bonny", "Lina", "Kara", "Vera", "Sera", "Davin", "Galen", "Tobin", "Rusk", "Milo"];
    const last = ["Vale", "Cross", "Hale", "Morrow", "Kest", "Venn", "Black", "Sol", "Reed", "Ash"];
    const hash = Number(stableStringHash(`${role}|${seed}`));
    return `${first[hash % first.length]} ${last[Math.floor(hash / first.length) % last.length]}`;
  }
  function generatedNpcRoleDetails(role = "") {
    const cleanRole = textSlot(role, "client");
    return {
      role: cleanRole,
      personality_description: `A grounded ${cleanRole} with a concrete problem, practical worries, and enough personality to carry a short job scene.`,
      speech_style: "Speaks plainly with a practical local cadence, giving useful details without becoming a narrator.",
      note: `Generated recurring ${cleanRole} for story jobs.`
    };
  }
  function ensureGeneratedRoleNpc(role = "client", context = {}) {
    if (!isPlainObject(app.state.story_generated_npc_pool)) throw new Error("state.story_generated_npc_pool must be an object.");
    const boardId = textSlot(context.boardId, "board");
    const key = `${boardId}:${objectiveIdFromTitle(role, "role")}`;
    const existing = app.state.story_generated_npc_pool[key];
    if (existing?.name) {
      const existingNpc = getNpcEntryFromState(app.state, existing.name);
      if (existingNpc && !npcIsDead(existingNpc)) return {
        name: existing.name,
        npc: existingNpc,
        poolKey: key
      };
    }
    const details = generatedNpcRoleDetails(role);
    const romanceable = context.romanceable !== false;
    let name = generatedNpcNameForRole(role, boardId);
    const taken = new Set([app.state.player?.name, ...Object.keys(app.state.characters || {}), ...Object.values(app.state.npc_directory?.locations || {}).flatMap(location => Object.keys(location?.characters || {}))].map(item => normalizeNameForMatch(item)));
    let suffix = 2;
    while (taken.has(normalizeNameForMatch(name))) {
      name = `${generatedNpcNameForRole(role, `${boardId}:${suffix}`)} ${suffix}`;
      suffix += 1;
    }
    const full = {
      ...blankCharacterTemplate(name),
      name,
      age: 22 + Number(stableStringHash(name)) % 24,
      romanceable,
      gender: deterministicGeneratedCharacterGender(`${boardId}:${role}`, romanceable),
      fallback_name: generatedNpcNameForRole(role, `${boardId}:fallback`),
      role: details.role,
      personality_description: details.personality_description,
      speech_style: details.speech_style,
      can_die: true
    };
    const canonicalMale = normalizedCharacterGender(full.gender) === "male";
    const canonicalOutfit = generatedNpcRoleOutfit(role, canonicalMale);
    const fallbackOutfit = generatedNpcRoleOutfit(role, !canonicalMale);
    full.outfits = [canonicalOutfit];
    full.starting_outfit_id = canonicalOutfit.id;
    full.active_outfit_id = canonicalOutfit.id;
    full.clothing = clone(canonicalOutfit.clothing);
    full.fallback_outfits = [fallbackOutfit];
    full.fallback_starting_outfit_id = fallbackOutfit.id;
    adaptRuntimeCharacterGender(full, `${boardId}:${role}`);
    name = full.name;
    suffix = 2;
    while (taken.has(normalizeNameForMatch(name))) {
      name = `${full.name} ${suffix}`;
      suffix += 1;
    }
    full.name = name;
    const locationId = requireNpcLocationId(app.state, textSlot(context.npc_location_id, ""), "Generated job NPC");
    const location = ensureNpcDirectoryLocation(app.state, locationId, textSlot(context.locationLabel, currentSettlementName()));
    const locationLabel = location.label;
    const fullCharacter = materializeCharacterForRuntime(full, name);
    const definitionId = ensureRuntimeCharacterDefinition(fullCharacter, name);
    fullCharacter.id = definitionId;
    fullCharacter.definition_id = definitionId;
    const npc = {
      name,
      definition_id: definitionId,
      gender: fullCharacter.gender,
      age: fullCharacter.age,
      role: fullCharacter.role,
      relationship: "job contact",
      note: details.note,
      inspected: true,
      can_die: true,
      generated_job_role: role,
      full_character: fullCharacter
    };
    location.characters[name] = npc;
    app.state.story_generated_npc_pool[key] = {
      npc_id: definitionId,
      definition_id: definitionId,
      name,
      npc_location_id: locationId,
      location: locationLabel,
      role,
      created_at: new Date().toISOString()
    };
    return {
      name,
      npc,
      poolKey: key
    };
  }
  function acceptGeneratedJob(boardId, offerId) {
    const board = storyShopById(boardId);
    const offers = ensureJobOffersForBoard(boardId);
    const offer = offers.find(item => String(item.offer_id) === String(offerId));
    if (!board || !offer) return showNotice("Job Unavailable", "That job is no longer available.");
    if (!isPlainObject(app.state.active_generated_jobs)) throw new Error("state.active_generated_jobs must be an object.");
    if (Object.values(app.state.active_generated_jobs).some(job => job.template_id === offer.template_id && job.status === "active")) {
      return showNotice("Already Accepted", "That job is already active.");
    }
    const jobId = assertGeneratedIdAvailable(generatedPersistentId("job-instance"), "generated job");
    const ids = generatedJobObjectiveIds(jobId);
    assertGeneratedJobObjectiveIdsAvailable(jobId, ids, app.state);
    const locationName = offer.filled_values.place || board.location?.specific_place || board.title;
    const client = ensureGeneratedRoleNpc(offer.filled_values.client || "client", {
      boardId: board.id,
      npc_location_id: currentNpcLocationId(),
      locationLabel: locationName,
      romanceable: offer.romanceable === true
    });
    offer.filled_values.client_npc_id = client?.poolKey || "";
    offer.filled_values.client_name = client?.name || "";
    const objectives = [{
      id: ids[0],
      title: `Start Job: ${offer.title}`,
      type: "side",
      status: "queued",
      summary: `Begin ${offer.title}.`,
      completion_control: "choice",
      completion_criteria: "Choose when to start this job.",
      choices: [{
        id: `${ids[0]}-go`,
        title: "Start Job",
        summary: `Travel to ${locationName} and begin the job.`,
        rewards: [{
          type: "set_state_field",
          field_path: ["location"],
          value: {
            ...(app.state.location || {}),
            ...(board.location || {}),
            specific_place: locationName
          },
          create_path: true
        }, ...(client?.name ? [{
          type: "set_state_field",
          field_path: ["scene", "npcs_present"],
          value: [client.name],
          create_path: true
        }] : []), {
          type: "start_objective",
          objective_id: ids[1]
        }]
      }],
      generated_job_id: jobId,
      rewards: []
    }, {
      id: ids[1],
      title: offer.title,
      type: "side",
      status: "hidden",
      summary: offer.summary,
      completion_control: "ai",
      completion_criteria: "Complete the generated job's main conflict.",
      completion_instruction: "Resolve the job and make it clear the player can turn it in.",
      requires: [ids[0]],
      rewards: [{
        type: "start_objective",
        objective_id: ids[2]
      }],
      generated_job_id: jobId
    }, {
      id: ids[2],
      title: `Turn In: ${offer.title}`,
      type: "side",
      status: "hidden",
      summary: `Return to ${board.title} and claim the reward.`,
      completion_control: "choice",
      completion_criteria: "Choose when to turn in this generated job.",
      choices: [{
        id: `${ids[2]}-confirm`,
        title: "Turn In Quest",
        summary: "Return to the board and claim the reward.",
        rewards: [{
          type: "complete_generated_job",
          job_id: jobId
        }]
      }],
      generated_job_id: jobId,
      rewards: []
    }];
    app.state.active_generated_jobs[jobId] = registerGeneratedJobRuntime({
      id: jobId,
      template_id: offer.template_id,
      board_id: board.id,
      offer_id: offer.offer_id,
      title: offer.title,
      filled_values: offer.filled_values,
      objective_ids: ids,
      objectives: objectives.map((entry, index) => objectiveDefinitionFromRuntimeObjective(entry, index)),
      rewards: {
        coins: offer.reward_coins,
        adventurer_xp: offer.reward_xp
      },
      status: "active",
      accepted_at: new Date().toISOString()
    });
    registerObjectiveRuntimeEntries(objectives, app.state);
    materializeGeneratedJobObjectiveView(jobId, app.state);
    app.state.objectives.focus_id = ids[0];
    app.state.story_job_offers[board.id] = offers.filter(item => item.offer_id !== offer.offer_id);
    markRuntimeRecordDirty("job-runtime", "current");
    app.state.recent_changes = [`Accepted job: ${offer.title}.`, ...(app.state.recent_changes || [])].slice(0, 8);
    scheduleActiveGameSave();
    render();
    openStoryShopModal(board.id);
    if (client?.name) {
      const profileEntityBeforeQueue = profileEntity(client.name);
      const queuedProfile = queueProfileImageIfMissing(client.name, "generated job NPC", {
        allowImportSkipped: true,
        allowDuringSmoke: true,
        allowRuntimeProfileGeneration: true,
        skipDefault: true
      });
      devTestLog("Accepted generated job profile request", {
        name: client.name,
        queuedProfile,
        hasEntity: !!profileEntityBeforeQueue,
        autoSkip: profileEntityBeforeQueue?.profile_image_auto_skip,
        activeProfile: activeProfileImage(profileEntityBeforeQueue),
        gameRuntimeGeneration: app.gameRuntimeGeneration
      });
    }
    return true;
  }
  function acceptStoryJob(boardId, storyJobId) {
    const board = storyShopById(boardId);
    const item = board?.items?.find(entry => String(entry.id) === String(storyJobId));
    if (!board || board.type !== "job" || !item) return showNotice("Job Unavailable", "That story job is not available.");
    if (item.accepted || item.completed) return showNotice("Already Accepted", "That story job is already active or complete.");
    if (!storyJobItemMatchesGenres(item, app.state)) return showNotice("Job Unavailable", "That job does not fit this story's genres.");
    if (item.locked || !requirementsMet(item.requirements || [], app.state)) return showNotice("Requirements Not Met", "You do not meet the requirements for that job.");
    if (!isPlainObject(app.state.active_generated_jobs)) throw new Error("state.active_generated_jobs must be an object.");
    if (Object.values(app.state.active_generated_jobs).some(job => job.source === "story" && job.story_job_id === item.id && job.status === "active")) {
      return showNotice("Already Accepted", "That story job is already active.");
    }
    const jobId = assertGeneratedIdAvailable(generatedPersistentId("story-job-instance"), "generated story job");
    const ids = generatedJobObjectiveIds(jobId);
    assertGeneratedJobObjectiveIdsAvailable(jobId, ids, app.state);
    const startLocation = Object.keys(item.start_location || {}).length ? item.start_location : board.location || {};
    const locationName = startLocation.specific_place || startLocation.district || startLocation.settlement_name || board.title;
    let clientName = "";
    if (item.client_npc_id) {
      const client = ensureFutureCastNpcInDirectory(item.client_npc_id, storyShopNpcLocationId(board), {
        reason: "story job client",
        note: `Client for ${item.title}.`,
        location_label: locationName
      });
      clientName = client?.name || "";
    }
    const objectives = [{
      id: ids[0],
      title: `Start Job: ${item.title}`,
      type: "side",
      status: "queued",
      summary: `Begin ${item.title}.`,
      completion_control: "choice",
      completion_criteria: "Choose when to start this story job.",
      choices: [{
        id: `${ids[0]}-go`,
        title: "Start Job",
        summary: `Travel to ${locationName} and begin the job.`,
        rewards: [{
          type: "set_state_field",
          field_path: ["location"],
          value: {
            ...(app.state.location || {}),
            ...startLocation,
            specific_place: locationName
          },
          create_path: true
        }, ...(clientName ? [{
          type: "set_state_field",
          field_path: ["scene", "npcs_present"],
          value: [clientName],
          create_path: true
        }] : []), {
          type: "start_objective",
          objective_id: ids[1]
        }]
      }],
      generated_job_id: jobId,
      rewards: []
    }, {
      id: ids[1],
      title: item.title,
      type: "side",
      status: "hidden",
      summary: item.summary,
      completion_control: "ai",
      completion_criteria: item.completion_criteria || "Complete this story job's main conflict.",
      completion_instruction: item.completion_instruction || "Resolve the story job and make it clear the player can turn it in.",
      requires: [ids[0]],
      rewards: [{
        type: "start_objective",
        objective_id: ids[2]
      }],
      generated_job_id: jobId
    }];
    item.accepted = true;
    app.state.active_generated_jobs[jobId] = registerGeneratedJobRuntime({
      id: jobId,
      source: "story",
      story_job_id: item.id,
      template_id: "",
      board_id: board.id,
      offer_id: `story-job-${item.id}`,
      title: item.title,
      filled_values: {
        client_name: clientName,
        place: locationName
      },
      objective_ids: ids,
      objectives: objectives.map((entry, index) => objectiveDefinitionFromRuntimeObjective(entry, index)),
      rewards: {
        coins: item.reward_coins,
        adventurer_xp: item.reward_xp,
        items: clone(item.reward_items || [])
      },
      status: "active",
      accepted_at: new Date().toISOString()
    });
    registerObjectiveRuntimeEntries(objectives, app.state);
    materializeGeneratedJobObjectiveView(jobId, app.state);
    app.state.objectives.focus_id = ids[0];
    markRuntimeRecordDirty("job-runtime", "current");
    app.state.recent_changes = [`Accepted story job: ${item.title}.`, ...(app.state.recent_changes || [])].slice(0, 8);
    scheduleActiveGameSave();
    render();
    openStoryShopModal(board.id);
    return true;
  }
  function completeGeneratedJobReward(state, reward, objective) {
    const jobId = textSlot(reward.job_id || objective?.generated_job_id, "");
    const job = state.active_generated_jobs?.[jobId];
    if (!job) return false;
    const board = state.story_shops?.[job.board_id] || {};
    const location = board.location || {};
    state.location = {
      ...(state.location || {}),
      ...location
    };
    state.scene ||= {};
    replaceSceneNpcPresence(state, [], "generated job completed");
    const ownerName = resolveStoryShopOwnerName(board, state);
    if (ownerName) replaceSceneNpcPresence(state, [ownerName], "generated job board owner placed in scene");
    adjustStoryInventoryItemValue(state, "coins", Number(job.rewards?.coins || 0));
    adjustStoryInventoryItemValue(state, "adventurer_xp", Number(job.rewards?.adventurer_xp || 0));
    for (const item of job.rewards?.items || []) addStoryInventoryItem(state, item);
    const ids = new Set(job.objective_ids || []);
    removeGeneratedJobObjectiveViewEntries(ids, state);
    if (ids.has(String(state.objectives.active_id || ""))) state.objectives.active_id = "";
    if (ids.has(String(state.objectives.focus_id || ""))) state.objectives.focus_id = "";
    if (job.source === "story" && job.story_job_id && state.story_shops?.[job.board_id]?.items) {
      const item = state.story_shops[job.board_id].items.find(entry => String(entry.id) === String(job.story_job_id));
      if (item) {
        item.accepted = false;
        item.completed = true;
      }
    }
    delete state.active_generated_jobs[jobId];
    if (state === app.state) {
      delete app.jobRuntime.activeJobsById[jobId];
      delete app.jobRuntime.runtimeByJobId[jobId];
      markRuntimeRecordDirty("job-runtime", "current");
      bumpDomainRevision("jobs");
      removeObjectiveRuntimeEntries(ids, state);
    }
    clearAllGeneratedJobOffers(state);
    noteRewardChange(state, rewardLabel(objective, `Generated job completed: ${job.title}.`));
    return true;
  }
  function abandonGeneratedJob(jobId = "") {
    const job = app.state.active_generated_jobs?.[jobId];
    if (!job) return false;
    const ids = new Set(job.objective_ids || []);
    removeGeneratedJobObjectiveViewEntries(ids, app.state);
    if (job.source === "story" && job.story_job_id && app.state.story_shops?.[job.board_id]?.items) {
      const item = app.state.story_shops[job.board_id].items.find(entry => String(entry.id) === String(job.story_job_id));
      if (item && !item.completed) item.accepted = false;
    }
    delete app.state.active_generated_jobs[jobId];
    delete app.jobRuntime.activeJobsById[jobId];
    delete app.jobRuntime.runtimeByJobId[jobId];
    markRuntimeRecordDirty("job-runtime", "current");
    bumpDomainRevision("jobs");
    removeObjectiveRuntimeEntries(ids, app.state);
    app.state.recent_changes = [`Abandoned job: ${job.title}.`, ...(app.state.recent_changes || [])].slice(0, 8);
    scheduleActiveGameSave();
    render();
    openStoryInventoryModal();
    return true;
  }
  function grantXpReward(state, reward, objective, source) {
    return false;
  }
  function getNpcEntryFromState(state, name) {
    if (!name) return null;
    for (const location of Object.values(state.npc_directory?.locations || {})) {
      if (location?.characters?.[name]) return location.characters[name];
    }
    return null;
  }
  function findNpcEntryInState(state, name) {
    const wanted = String(name || "").trim();
    if (!wanted) return null;
    const normalizedWanted = normalizeNameForMatch(wanted);
    const locations = state?.npc_directory?.locations || {};
    for (const [locationId, location] of Object.entries(locations)) {
      const characters = location?.characters || {};
      if (Object.prototype.hasOwnProperty.call(characters, wanted)) return {
        locationId,
        locationLabel: textSlot(location?.label, locationId),
        key: wanted,
        npc: characters[wanted]
      };
      for (const [key, npc] of Object.entries(characters)) {
        if (normalizeNameForMatch(key) === normalizedWanted || normalizeNameForMatch(npc?.name) === normalizedWanted || normalizeNameForMatch(npc?.fallback_name) === normalizedWanted || normalizeNameForMatch(npc?.full_character?.name) === normalizedWanted || normalizeNameForMatch(npc?.full_character?.fallback_name) === normalizedWanted) return {
          locationId,
          locationLabel: textSlot(location?.label, locationId),
          key,
          npc
        };
      }
    }
    return null;
  }
  function isValidNearbyNpcName(name, state = app.state) {
    const resolved = resolveEntityName(name, state, "") || String(name || "").trim();
    if (!resolved) return false;
    if (isPlayerEntityName(resolved, state)) return false;
    if (isPartyCharacterName(resolved, state)) return false;
    const npc = getNpcEntryFromState(state, resolved);
    if (!npc) return false;
    return !isInvalidStoredNpcName(resolved, state, {
      allowFutureCast: npcIsFutureCastBacked(npc, state) || npcIsFutureCastBacked({
        ...npc,
        name: resolved
      }, state)
    });
  }
  function applyFutureCharacterImagesToGallery(state, entry, name) {
    const images = [...(entry?.on_unlock?.image ? [entry.on_unlock.image] : []), ...(Array.isArray(entry?.images) ? entry.images : [])];
    if (!images.length) return;
    app.images ||= [];
    for (const image of images) {
      const html = imageHtmlToString(image.html || image.dataUrl || (image.url ? `<img src="${escapeHtml(image.url)}" alt="${escapeHtml(name)} story image">` : ""));
      if (!html) continue;
      const id = String(image.id || `${name}-unlock-${normalizeNameForMatch(image.title || image.prompt || html).slice(0, 40)}`);
      if (app.images.some(existing => String(existing.id) === id || existing.reason === "future character reward" && existing.targets?.includes?.(name) && image.prompt && existing.prompt === String(image.prompt || ""))) continue;
      createNormalImageRequest({
        id,
        at: image.at || new Date().toISOString(),
        requestedAt: image.requestedAt || image.at || new Date().toISOString(),
        requestedAfterMessageId: image.requestedAfterMessageId || "",
        requestOrder: image.requestOrder,
        favorite: image.favorite === true,
        title: image.title || `${name} story image`,
        reason: image.reason || "future character reward",
        model: selectedImageModel(image.model),
        seed: exactProfileImageSeed(image.seed, "future character image seed"),
        prompt: String(image.prompt || ""),
        negativePrompt: String(image.negativePrompt || ""),
        html,
        pending: false,
        error: "",
        targets: [name],
        profile: false
      }, {
        startRequest: false
      });
    }
  }
  function isEmptyPatch(patch) {
    if (!isPlainObject(patch)) return false;
    return Object.keys(patch).length === 0;
  }
  function undoValuesEqual(a, b) {
    // State patch conflict filtering compares the restored backup value with
    // the live value before accepting automatic AI patch output.
    return JSON.stringify(a) === JSON.stringify(b);
  }
  function autoStatePatchPathAllowed(baseState, currentState, path) {
    return undoValuesEqual(getPathValue(currentState, path), getPathValue(baseState, path));
  }
  
