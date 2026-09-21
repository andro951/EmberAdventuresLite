async function devRunLibraryFirstFlowSmokeTest() {
    const profiles = devSettingsSnapshotForSmoke();
    const stories = clone(app.storyTemplates || []);
    const characters = clone(app.characterDefinitions || []);
    try {
      devResetForLiveTest("local-library-profile-smoke");
      devResetPreferenceSettingsForSmoke({});
      app.storyTemplates = [devSmokeStoryRecord({
        id: "smoke-local-story",
        title: "Local Library Story"
      })];
      app.characterDefinitions = validatedCharacterLibraryDefinitions([devSmokeCharacterRecord("Local Library Character", {
        record: {
          id: "smoke-local-character"
        }
      })]);
      openStoryTemplateLibrary();
      devAssert(!!$("modalBox")?.querySelector('[data-library-home][data-library-type="story"]'), "story library opens its full-screen unified surface");
      devAssert(unifiedLibraryTab() === "local" && /Local Library Story/.test($("modalBox").textContent), "story library displays local story definitions");
      openCharacterLibraryModal();
      devAssert(!!$("modalBox")?.querySelector('[data-library-home][data-library-type="character"]') && /Local Library Character/.test($("modalBox").textContent), "character library displays local definitions");
      const saveId = activeSaveId();
      const state = app.state;
      app.settings.preferredCharacterGender = "female";
      await saveSettingsNow("smoke presentation preference");
      devAssert(app.state === state && activeSaveId() === saveId, "changing preferences does not replace the current game or save");
      openCharacterLibraryModal();
      devAssert(/Local Library Character/.test($("modalBox").textContent), "local definitions remain available after switching profiles");
    } finally {
      app.storyTemplates = stories;
      app.characterDefinitions = characters;
      await devRestoreSettingsSnapshotForSmoke(profiles);
      closeModal();
    }
  }
  async function devRunCharacterStatsIntegerValidationSmokeTest() {
    devTestLog("Scenario start: character-stats-integer-validation-smoke");
    const customBoldness = "Reserved with strangers; confidently initiates familiar conversations.";
    const taggedCharacter = {
      name: "Template Smoke",
      gender: "female",
      boldness: "|[character_first]| speaks confidently.",
      appearance: {}
    };
    const expectedBoldness = displayRuntimeTemplateText(taggedCharacter.boldness, taggedCharacter);
    devAssert(!expectedBoldness.includes("|[") && characterBoldnessGuidanceText(taggedCharacter) === expectedBoldness, "custom boldness resolves character tags in prompt guidance");
    const taggedAppearance = "|[character_first]| has a compact frame.";
    taggedCharacter.appearance.body_description = taggedAppearance;
    const resolvedBody = displayRuntimeTemplateText(taggedAppearance, taggedCharacter);
    devAssert(!resolvedBody.includes("|[") && buildBodyStatPrompt(taggedCharacter.appearance, taggedCharacter).includes(resolvedBody) && buildProfileBodyPrompt(taggedCharacter).includes(resolvedBody), "body description tags resolve in scene and portrait prompts");
    devAssert(taggedCharacter.appearance.body_description === taggedAppearance, "prompt projection preserves authored body description tags");

    for (const slot of bodyStatKeys()) {
      devAssert(bodyStatPhrase(slot, taggedAppearance, {
        entity: taggedCharacter
      }) === displayRuntimeTemplateText(taggedAppearance, taggedCharacter), "custom appearance descriptions resolve tags for every scale field", {
        slot
      });
    }
    devAssert(taggedCharacter.boldness === "|[character_first]| speaks confidently.", "prompt tag replacement does not rewrite authored boldness");
    devAssert(exactCharacterBoldness(customBoldness) === customBoldness && repairAiCharacterBoldness(customBoldness) === customBoldness, "custom boldness survives authored validation and AI handling unchanged");
    for (const offset of [-4, 0, 5]) devAssert(characterBoldnessPhrase(calculatedCharacterBoldness({
      boldness: customBoldness
    }, offset)) === customBoldness, "custom boldness reaches guidance unchanged regardless of profile adjustment");
    for (const invalid of ["", "   ", "5", 0, 11, 2.5, null, {}]) devAssert(!validCharacterBoldness(invalid), "invalid boldness values are rejected", {
      invalid
    });
    for (const value of [1, 5, 10]) devAssert(exactCharacterBoldness(value) === value, "numeric boldness remains supported", {
      value
    });
    for (const value of [0, 10, 20, "About six feet tall"]) devAssert(parseBodyStatInput(String(value)) === value, "body size editor preserves numeric scales and custom descriptions", {
      value
    });
    const player = devSmokeRuntimeCharacter("Integer Smoke Player", {
      id: "integer-smoke-player",
      gender: "female",
      role: "fake integer validation player",
      stats: {
        strength: 7,
        debt: -3,
        capacity_cost: 0,
        growth_multiplier: 1
      }
    });
    const template = devSmokeStoryRecord({
      id: "integer-validation-story",
      title: "Synthetic Integer Validation Story",
      player,
      objectives: [devSmokeObjective("integer-smoke-objective", "Test integer reward validation", {
        status: "active",
        summary: "Use synthetic integer state.",
        completion_control: "player",
        ending_type: "freeplay",
        ending_message: "The integer validation smoke continues in freeplay.",
        rewards: [{
          type: "modify_integer",
          operation: "add",
          character_id: "integer-smoke-player",
          field_path: ["stats", "strength"],
          value: 2
        }]
      })],
      active_id: "integer-smoke-objective"
    });
    template.state.numeric_precision = {
      story_inventory: {
        pack_strength: 3
      },
      character_stats: {
        growth_multiplier: 3
      }
    };
    player.stats.growth_multiplier = 1.125;
    template.state.player.stats.growth_multiplier = 1.125;
    template.state.story_inventory.pack_strength = 0.125;
    template.state.reward_templates = {
      "increase-character-stat": {
        parameters: {
          character_id: {
            type: "character_id"
          },
          stat_path: {
            type: "path"
          }
        },
        rewards: [{
          type: "modify_number",
          operation: "add",
          character_id: {
            parameter: "character_id"
          },
          field_path: {
            parameter: "stat_path"
          },
          value: 0.125
        }]
      }
    };
    template.state.objectives.items[0].rewards.push({
      type: "apply_reward_template",
      template_id: "increase-character-stat",
      arguments: {
        character_id: "integer-smoke-player",
        stat_path: ["stats", "growth_multiplier"]
      }
    });
    const descriptiveTemplate = clone(template);
    descriptiveTemplate.state.player.boldness = customBoldness;
    descriptiveTemplate.state.player.appearance.height = "Towering with long proportions";
    const descriptiveRoundTrip = JSON.parse(JSON.stringify(descriptiveTemplate));
    const descriptiveResult = validateStoryDefinition(descriptiveRoundTrip);
    devAssert(descriptiveResult.ok && descriptiveRoundTrip.state.player.boldness === customBoldness && descriptiveRoundTrip.state.player.appearance.height === "Towering with long proportions", "story schema and JSON round trip preserve custom boldness and body size", descriptiveResult);
    const validResult = validateStoryDefinition(template);
    devAssert(!validResult.errors.some(error => String(error.path || "").includes("modify_integer")) && !validResult.errors.some(error => error.code === "precision" || error.code === "divide_by_zero"), "shared story validation accepts integer and declared decimal fields, integer math, and a typed reward template", validResult.errors);
    const divideByZero = clone(template);
    divideByZero.state.objectives.items[0].rewards[0] = {
      type: "modify_integer",
      operation: "divide",
      field_path: ["story_inventory", "coins"],
      value: 0
    };
    const divideResult = validateStoryDefinition(divideByZero);
    devAssert(divideResult.errors.some(error => error.code === "divide_by_zero"), "the shared import/publish story validator rejects hardcoded divide by zero", divideResult.errors);
    const invalidStats = clone(template);
    invalidStats.state.player.stats.strength = 1.5;
    const invalidStatsResult = validateStoryDefinition(invalidStats);
    devAssert(invalidStatsResult.errors.some(error => error.code === "precision" && String(error.path || "").endsWith("stats.strength")), "story validation rejects decimal character stats that are not declared", invalidStatsResult.errors);
    const excessPrecision = clone(template);
    excessPrecision.state.player.stats.growth_multiplier = 1.1255;
    const excessPrecisionResult = validateStoryDefinition(excessPrecision);
    devAssert(excessPrecisionResult.errors.some(error => error.code === "precision" && String(error.path || "").endsWith("stats.growth_multiplier")), "story validation rejects values beyond their declared decimal precision", excessPrecisionResult.errors);
    const invalidPrecisionMap = clone(template);
    invalidPrecisionMap.state.numeric_precision.character_stats.growth_multiplier = 7;
    const invalidPrecisionMapResult = validateStoryDefinition(invalidPrecisionMap);
    devAssert(invalidPrecisionMapResult.errors.some(error => error.code === "range" && String(error.path || "").includes("numeric_precision.character_stats")), "story validation rejects decimal precision outside one through six", invalidPrecisionMapResult.errors);
    const invalidOperand = clone(template);
    invalidOperand.state.objectives.items[0].rewards[0].value_path = ["story_inventory", "coins"];
    const invalidOperandResult = validateStoryDefinition(invalidOperand);
    devAssert(invalidOperandResult.errors.some(error => error.code === "operand"), "modify_integer validation requires exactly one literal or referenced operand", invalidOperandResult.errors);
    const unknownCharacter = clone(template);
    unknownCharacter.state.objectives.items[0].rewards[0].character_id = "missing-smoke-character";
    const unknownCharacterResult = validateStoryDefinition(unknownCharacter);
    devAssert(unknownCharacterResult.errors.some(error => error.code === "reference"), "story validation rejects unknown modify_integer character ids", unknownCharacterResult.errors);
    const unsafePath = clone(template);
    unsafePath.state.objectives.items[0].rewards[0].field_path = ["stats", "__proto__"];
    const unsafePathResult = validateStoryDefinition(unsafePath);
    devAssert(unsafePathResult.errors.some(error => error.code === "unsafe"), "story validation rejects unsafe prototype path parts", unsafePathResult.errors);
    const hardcodedExpressionZero = clone(template);
    hardcodedExpressionZero.state.objectives.items[0].rewards[0] = {
      type: "modify_number",
      operation: "divide",
      field_path: ["story_inventory", "pack_strength"],
      value_expression: {
        initial: 1,
        operations: [{
          operation: "subtract",
          operand: 1
        }]
      }
    };
    const hardcodedExpressionZeroResult = validateStoryDefinition(hardcodedExpressionZero);
    devAssert(hardcodedExpressionZeroResult.errors.some(error => error.code === "divide_by_zero"), "story validation rejects a literal expression that makes an outer divisor zero", hardcodedExpressionZeroResult.errors);
    const missingTemplateArgument = clone(template);
    missingTemplateArgument.state.objectives.items[0].rewards[1].arguments = {
      character_id: "integer-smoke-player"
    };
    const missingTemplateArgumentResult = validateStoryDefinition(missingTemplateArgument);
    devAssert(missingTemplateArgumentResult.errors.some(error => error.code === "arguments"), "story validation rejects missing reward-template arguments", missingTemplateArgumentResult.errors);
    const unknownTemplateArgument = clone(template);
    unknownTemplateArgument.state.objectives.items[0].rewards[1].arguments.extra = ["stats", "strength"];
    const unknownTemplateArgumentResult = validateStoryDefinition(unknownTemplateArgument);
    devAssert(unknownTemplateArgumentResult.errors.some(error => error.code === "arguments"), "story validation rejects unknown reward-template arguments", unknownTemplateArgumentResult.errors);
    const malformedExpression = clone(template);
    malformedExpression.state.objectives.items[0].rewards[0] = {
      type: "modify_number",
      operation: "add",
      field_path: ["story_inventory", "pack_strength"],
      value_expression: {
        initial: 1,
        operations: "multiply by two"
      }
    };
    const malformedExpressionResult = validateStoryDefinition(malformedExpression);
    devAssert(malformedExpressionResult.errors.some(error => error.code === "type" && String(error.path || "").includes("value_expression.operations")), "story validation rejects malformed numeric expressions", malformedExpressionResult.errors);
    const templateCycle = clone(template);
    templateCycle.state.reward_templates["increase-character-stat"].rewards = [{
      type: "apply_reward_template",
      template_id: "increase-character-stat",
      arguments: {
        character_id: {
          parameter: "character_id"
        },
        stat_path: {
          parameter: "stat_path"
        }
      }
    }];
    const templateCycleResult = validateStoryDefinition(templateCycle);
    devAssert(templateCycleResult.errors.some(error => error.code === "cycle"), "story validation rejects recursive reward templates", templateCycleResult.errors);
    const exported = storyDefinitionForExport(template).state.player;
    devAssert(exported.id === "integer-smoke-player" && exported.stats.strength === 7 && exported.stats.debt === -3 && exported.stats.growth_multiplier === 1.125, "story-embedded character id and numeric stats survive story definition export", exported);
    const exportedState = storyDefinitionForExport(template).state;
    devAssert(exportedState.numeric_precision.character_stats.growth_multiplier === 3 && exportedState.reward_templates["increase-character-stat"].rewards.length === 1, "numeric precision and reward templates survive story export cleaning", exportedState);
    devTestLog("Scenario complete: character-stats-integer-validation-smoke");
  }
  async function devRunReferenceIntegerRewardSmokeTest() {
    devTestLog("Scenario start: reference-integer-reward-smoke");
    const originalBuffer = app.objectiveRewardMessageBuffer;
    app.objectiveRewardMessageBuffer = [];
    try {
      const state = {
        player: {
          id: "reference-smoke-player",
          name: "Reference Smoke Player",
          stats: {
            strength: 4,
            capacity_cost: 4
          }
        },
        characters: {
          "Synthetic Party Member": {
            id: "reference-smoke-party",
            name: "Synthetic Party Member",
            stats: {
              strength: 10,
              capacity_cost: 5
            }
          }
        },
        npc_directory: {
          locations: {
            "Synthetic Test Room": {
              characters: {
                "Synthetic NPC": {
                  name: "Synthetic NPC",
                  future_character_id: "reference-smoke-npc",
                  full_character: {
                    name: "Synthetic NPC",
                    stats: {
                      capacity_cost: 3
                    }
                  }
                }
              }
            }
          }
        },
        future_cast: {
          items: {
            "reference-smoke-future": {
              id: "reference-smoke-future",
              full_character: {
                name: "Synthetic Future Character",
                stats: {
                  capacity_cost: 2,
                  training_bonus: 2
                }
              }
            }
          }
        },
        story_shops: {
          "reference-smoke-shop": {
            owner: {
              character_id: "reference-smoke-shop-owner",
              full_character: {
                name: "Synthetic Shop Owner",
                stats: {
                  capacity_cost: 1
                }
              }
            },
            items: []
          }
        },
        generated_jobs: [{
          character_id: "reference-smoke-job-character",
          full_character: {
            name: "Synthetic Job Character",
            stats: {
              capacity_cost: 1
            }
          }
        }],
        scene: {
          party_members_present: ["Synthetic Party Member"],
          npcs_present: []
        },
        numeric_precision: {
          story_inventory: {
            template_total: 2,
            share_multiplier: 1,
            chained_value: 4,
            operations_value: 3,
            positive_round: 2,
            negative_round: 2,
            decimal_zero_division: 2
          },
          character_stats: {
            growth_multiplier: 3
          }
        },
        story_inventory: {
          capacity_available: 20,
          signed_value: -7,
          divisor: 0,
          training_bonus: 3,
          overflow: Number.MAX_SAFE_INTEGER,
          underflow: Number.MIN_SAFE_INTEGER,
          template_total: 0,
          share_multiplier: 0.1,
          chained_value: 0,
          operations_value: 0,
          positive_round: 0,
          negative_round: 0,
          decimal_zero_division: 1
        },
        reward_templates: {
          "add-character-capacity-share": {
            parameters: {
              character_id: {
                type: "character_id"
              },
              stat_path: {
                type: "path"
              }
            },
            rewards: [{
              type: "modify_number",
              operation: "add",
              field_path: ["story_inventory", "template_total"],
              value_expression: {
                initial: {
                  character_id: {
                    parameter: "character_id"
                  },
                  path: {
                    parameter: "stat_path"
                  }
                },
                operations: [{
                  operation: "multiply",
                  operand: {
                    path: ["story_inventory", "share_multiplier"]
                  }
                }]
              }
            }]
          }
        },
        recent_changes: []
      };
      const objective = {
        id: "reference-smoke",
        title: "Reference Math"
      };
      const apply = reward => applyObjectiveReward(state, objective, {
        type: "modify_integer",
        ...reward
      });
      apply({
        operation: "subtract",
        field_path: ["story_inventory", "capacity_available"],
        value_character_id: "reference-smoke-player",
        value_path: ["stats", "capacity_cost"]
      });
      apply({
        operation: "subtract",
        field_path: ["story_inventory", "capacity_available"],
        value_character_id: "reference-smoke-party",
        value_path: ["stats", "capacity_cost"]
      });
      apply({
        operation: "subtract",
        field_path: ["story_inventory", "capacity_available"],
        value_character_id: "reference-smoke-npc",
        value_path: ["stats", "capacity_cost"]
      });
      apply({
        operation: "subtract",
        field_path: ["story_inventory", "capacity_available"],
        value_character_id: "reference-smoke-future",
        value_path: ["stats", "capacity_cost"]
      });
      apply({
        operation: "subtract",
        field_path: ["story_inventory", "capacity_available"],
        value_character_id: "reference-smoke-shop-owner",
        value_path: ["stats", "capacity_cost"]
      });
      apply({
        operation: "subtract",
        field_path: ["story_inventory", "capacity_available"],
        value_character_id: "reference-smoke-job-character",
        value_path: ["stats", "capacity_cost"]
      });
      apply({
        operation: "add",
        character_id: "reference-smoke-player",
        field_path: ["stats", "strength"],
        value_path: ["story_inventory", "training_bonus"]
      });
      apply({
        operation: "add",
        character_id: "reference-smoke-party",
        field_path: ["stats", "strength"],
        value_character_id: "reference-smoke-future",
        value_path: ["stats", "training_bonus"]
      });
      apply({
        operation: "multiply",
        character_id: "reference-smoke-party",
        field_path: ["stats", "strength"],
        value: 2
      });
      apply({
        operation: "divide",
        field_path: ["story_inventory", "signed_value"],
        value: 2
      });
      apply({
        operation: "divide",
        field_path: ["story_inventory", "capacity_available"],
        value_path: ["story_inventory", "divisor"]
      });
      apply({
        operation: "add",
        field_path: ["story_inventory", "overflow"],
        value: 1
      });
      apply({
        operation: "subtract",
        field_path: ["story_inventory", "underflow"],
        value: 1
      });
      const characterIds = ["reference-smoke-player", "reference-smoke-party", "reference-smoke-npc", "reference-smoke-future", "reference-smoke-shop-owner", "reference-smoke-job-character"];
      for (const characterId of characterIds) {
        for (const entry of objectiveRewardEntriesForList([{
          type: "apply_reward_template",
          template_id: "add-character-capacity-share",
          arguments: {
            character_id: characterId,
            stat_path: ["stats", "capacity_cost"]
          }
        }], state)) applyObjectiveReward(state, objective, entry.reward);
      }
      applyObjectiveReward(state, objective, {
        type: "modify_number",
        operation: "add",
        field_path: ["story_inventory", "chained_value"],
        value_expression: {
          initial: 1,
          operations: [{
            operation: "divide",
            operand: 3
          }, {
            operation: "multiply",
            operand: 3
          }]
        }
      });
      applyObjectiveReward(state, objective, {
        type: "modify_number",
        operation: "add",
        field_path: ["story_inventory", "positive_round"],
        value: 1.005
      });
      applyObjectiveReward(state, objective, {
        type: "modify_number",
        operation: "add",
        field_path: ["story_inventory", "operations_value"],
        value_expression: {
          initial: 10,
          operations: [{
            operation: "add",
            operand: 2
          }, {
            operation: "subtract",
            operand: 3
          }, {
            operation: "multiply",
            operand: 2
          }, {
            operation: "divide",
            operand: 3
          }]
        }
      });
      applyObjectiveReward(state, objective, {
        type: "modify_number",
        operation: "add",
        field_path: ["story_inventory", "negative_round"],
        value: -1.005
      });
      applyObjectiveReward(state, objective, {
        type: "modify_number",
        operation: "divide",
        field_path: ["story_inventory", "decimal_zero_division"],
        value_path: ["story_inventory", "divisor"]
      });
      devAssert(state.story_inventory.capacity_available === Number.MAX_SAFE_INTEGER && state.story_inventory.signed_value === -3 && state.story_inventory.overflow === Number.MAX_SAFE_INTEGER && state.story_inventory.underflow === Number.MIN_SAFE_INTEGER && state.story_inventory.template_total === 1.6 && state.story_inventory.chained_value === 1 && state.story_inventory.operations_value === 6 && state.story_inventory.positive_round === 1.01 && state.story_inventory.negative_round === -1.01 && state.story_inventory.decimal_zero_division === Number.MAX_SAFE_INTEGER / 100 && state.player.stats.strength === 7 && state.characters["Synthetic Party Member"].stats.strength === 24, "reference math resolves every character container, templates, exact chained decimals, final rounding, integer division, zero divisors, and clamps", state);
      let missingPathError = null;
      try {
        apply({
          operation: "add",
          field_path: ["story_inventory", "missing"],
          value: 1
        });
      } catch (error) {
        missingPathError = error;
      }
      devAssert(/does not exist/i.test(missingPathError?.message || ""), "modify_integer rejects a missing target path instead of creating or defaulting it", missingPathError?.message || "");
      const presentProjection = compactAvailableCharactersForPrompt(state);
      state.scene.party_members_present = [];
      const absentProjection = compactAvailableCharactersForPrompt(state);
      devAssert(presentProjection["Synthetic Party Member"]?.stats?.strength === 24 && !("stats" in absentProjection["Synthetic Party Member"]), "full present-character prompt data includes stats while reduced absent-character data omits them", {
        presentProjection,
        absentProjection
      });
      devAssert(/Stats:/.test(characterLibraryDefinitionInfoHtml(state.characters["Synthetic Party Member"], {})), "full character definition UI displays custom stats");
      devTestLog("Scenario complete: reference-integer-reward-smoke");
    } finally {
      app.objectiveRewardMessageBuffer = originalBuffer;
    }
  }
  async function devRunAiOutcomeRoutingSmokeTest() {
    devTestLog("Scenario start: ai-outcome-routing-smoke");
    const originalState = app.state;
    const originalAiText = aiText;
    try {
      const routedObjective = {
        id: "hidden-route-smoke",
        title: "Resolve the hidden outcome",
        type: "story",
        status: "active",
        summary: "Finish the private interaction.",
        completion_control: "ai",
        completion_criteria: "The interaction reached a clear result.",
        route_control: "ai",
        rewards: [{
          type: "add_story_rule",
          rule_id: "hidden-route-base-rule",
          text: "The hidden interaction resolved."
        }],
        outcome_routes: [{
          id: "showed-concern",
          criteria: "The player sincerely considered the other character's pain.",
          requirements: [{
            type: "known_fact",
            target: "Protected Smoke Ally",
            id: "route-smoke-trust-earned"
          }],
          rewards: [{
            type: "add_story_rule",
            rule_id: "hidden-route-concern-rule",
            text: "The player showed concern."
          }, {
            id: "hidden-route-forced-death",
            type: "kill_character",
            target: "Protected Smoke Ally",
            ignore_can_die: true
          }],
          next_objective_id: "concern-result"
        }, {
          id: "used-without-consideration",
          criteria: "The player treated the character as a disposable tool.",
          requirements: [{
            path: "story_inventory.flags.route_smoke_cruel_path",
            op: "==",
            value: true
          }],
          rewards: [],
          next_objective_id: "hostile-result"
        }, {
          id: "accepted-assistance",
          criteria: "The player accepted help without clear concern or cruelty.",
          requirements: [],
          rewards: [],
          next_objective_id: "neutral-result",
          fallback: true
        }]
      };
      const state = repairAiGeneratedState({
        ...clone(defaultState),
        meta: {
          ...clone(defaultState.meta || {}),
          setup_complete: true
        },
        player: {
          ...clone(defaultState.player || {}),
          name: "Route Smoke Player"
        },
        characters: {
          "Protected Smoke Ally": {
            ...clone(defaultState.player || {}),
            name: "Protected Smoke Ally",
            can_die: false,
            relationship_to_player: "deeply trusted ally",
            trust: 8,
            attraction: 3,
            affection: 7,
            known_facts: [{
              id: "route-smoke-trust-earned",
              text: "Protected Smoke Ally trusts the player enough for the concern route."
            }]
          }
        },
        scene: {
          ...clone(defaultState.scene || {}),
          party_members_present: ["Protected Smoke Ally"]
        },
        objectives: {
          active_id: routedObjective.id,
          items: [routedObjective, {
            id: "concern-result",
            title: "Concern result",
            type: "story",
            status: "hidden",
            summary: "Continue from concern.",
            completion_control: "player"
          }, {
            id: "hostile-result",
            title: "Hostile result",
            type: "story",
            status: "hidden",
            summary: "Continue from hostility.",
            completion_control: "player"
          }, {
            id: "neutral-result",
            title: "Neutral result",
            type: "story",
            status: "hidden",
            summary: "Continue from neutrality.",
            completion_control: "player"
          }]
        }
      });
      app.state = state;
      await devCompileCurrentStoryFixture("ai-outcome-routing-smoke");
      const normalized = extractObjectives(state.objectives, state);
      const normalizedRoute = normalized.items.find(objective => objective.id === routedObjective.id);
      devAssert(normalizedRoute?.route_control === "ai" && normalizedRoute.outcome_routes.length === 3, "hidden outcome schema survives objective normalization", normalizedRoute);
      const completionPrompt = buildObjectiveCompletionInstruction({
        source: "assistant",
        text: "The latest narrator response advanced the scene.",
        objective: normalizedRoute
      });
      devAssert(completionPrompt.includes("Plot-point readiness criteria:") && !completionPrompt.includes("HIDDEN OUTCOME ROUTING:") && !completionPrompt.includes("showed-concern"), "objective completion checks hide outcome routes until completion", completionPrompt);
      const routingPrompt = objectiveOutcomeRoutingInstruction(normalizedRoute);
      devAssert(routingPrompt.includes("showed-concern") && !routingPrompt.includes('"used-without-consideration","private_criteria"') && routingPrompt.includes("accepted-assistance") && routingPrompt.includes("Only listed routes are eligible") && routingPrompt.includes("INELIGIBLE ROUTE IDS OMITTED") && routingPrompt.includes('"relationship_to_player":"deeply trusted ally"') && routingPrompt.includes('"trust":8') && routingPrompt.includes('"attraction":3') && routingPrompt.includes('"affection":7'), "hidden outcome prompt lists only eligible routes and receives authoritative runtime relationship evidence", routingPrompt);
      devAssert(parseObjectiveCompletionResult('{"s":"c","o":"showed-concern"}').outcome_id === "showed-concern" && objectiveOutcomeFallbackRoute(normalizedRoute)?.id === "accepted-assistance", "compact completion JSON selects a route and has a deterministic malformed-response fallback");
      const judgeResponses = ['{"o":"not-an-authored-route"}', '{"o":"showed-concern"}'];
      aiText = async () => judgeResponses.shift() || '{"s":"n"}';
      const repairedDecision = await requestObjectiveOutcomeDecision(normalizedRoute, {
        objective: normalizedRoute,
        source: "smoke"
      });
      devAssert(repairedDecision.result.outcome_id === "showed-concern" && repairedDecision.attempts.length === 2, "invalid hidden route output retries once and accepts the repaired authored route", repairedDecision);
      aiText = async () => '{"o":"still-invalid"}';
      const fallbackDecision = await requestObjectiveOutcomeDecision(normalizedRoute, {
        objective: normalizedRoute,
        source: "smoke"
      });
      devAssert(fallbackDecision.result.outcome_id === "accepted-assistance" && fallbackDecision.result.used_outcome_fallback === true, "two invalid route ids use the authored fallback instead of leaving zero eligible routes", fallbackDecision);
      devAssert(!JSON.stringify(objectiveForCompletionPrompt(normalizedRoute)).includes("showed-concern") && !JSON.stringify(runtimeObjectiveForPrompt(normalizedRoute)).includes("showed-concern") && !objectiveIsDirectChoice(normalizedRoute), "hidden route metadata stays out of player-facing objective data and never opens a choice menu");
      const before = clone(state);
      const completed = applyObjectiveVerifierResult(state, routedObjective.id, {
        status: "objective_complete",
        outcome_id: "showed-concern"
      }, {
        messageId: "hidden-route-smoke-message"
      });
      const rewardResult = applyObjectiveProgressRewards(before, state, "ai outcome routing smoke", {
        silentGameMessage: true
      });
      const rulesAfterFirstPass = repairAiStoryRules(state.story_rules);
      const appliedAfterFirstPass = Object.keys(app.rewardRuntime?.appliedInvocationIds || {});
      applyObjectiveProgressRewards(state, state, "ai outcome routing smoke repeat", {
        silentGameMessage: true
      });
      devAssert(completed?.selected_outcome_id === "showed-concern" && completed.selected_outcome_message_id === "hidden-route-smoke-message" && state.objectives.active_id === "concern-result" && rulesAfterFirstPass.some(rule => rule.text === "The hidden interaction resolved.") && rulesAfterFirstPass.some(rule => rule.text === "The player showed concern.") && !rulesAfterFirstPass.some(rule => rule.text.includes("disposable")) && state.characters["Protected Smoke Ally"].physical_state === "dead" && rewardResult?.applied === true && JSON.stringify(Object.keys(app.rewardRuntime?.appliedInvocationIds || {})) === JSON.stringify(appliedAfterFirstPass), "selected outcome routes once, applies only base plus selected rewards once, and honors ignore_can_die", {
        completed,
        state,
        rewardResult
      });
      const reloaded = extractObjectives(clone(state.objectives), state);
      devAssert(reloaded.items.find(objective => objective.id === routedObjective.id)?.selected_outcome_id === "showed-concern" && !before.objectives.items.find(objective => objective.id === routedObjective.id)?.selected_outcome_id, "selected outcome survives save normalization while rollback state remains unselected", {
        reloaded,
        before
      });
      const hiddenDefaultObjective = {
        ...routedObjective,
        id: "hidden-default-route-smoke",
        outcome_routes: [{
          id: "specific-locked-route",
          criteria: "A specific locked route.",
          requirements: [{
            path: "story_inventory.flags.missing_hidden_default_flag",
            op: "==",
            value: true
          }],
          rewards: [],
          next_objective_id: "concern-result"
        }, {
          id: "neutral-default-route",
          criteria: "The default neutral route when no specific route is eligible.",
          requirements: [],
          rewards: [],
          next_objective_id: "neutral-result",
          default: true
        }]
      };
      const hiddenDefaultEligible = eligibleObjectiveOutcomeRoutes(hiddenDefaultObjective, state);
      devAssert(hiddenDefaultEligible.length === 1 && hiddenDefaultEligible[0].id === "neutral-default-route" && objectiveOutcomeRoutingInstruction(hiddenDefaultObjective).includes("neutral-default-route") && !objectiveOutcomeRoutingInstruction(hiddenDefaultObjective).includes('"specific-locked-route","private_criteria"'), "hidden default route is only exposed when no specific route is eligible", hiddenDefaultEligible);
      const hiddenDefaultState = clone(state);
      hiddenDefaultState.objectives.items.unshift(hiddenDefaultObjective);
      app.state = hiddenDefaultState;
      await devCompileCurrentStoryFixture("ai-outcome-routing-hidden-default-smoke");
      const defaultCompleted = applyObjectiveVerifierResult(hiddenDefaultState, hiddenDefaultObjective.id, {
        status: "objective_complete"
      });
      devAssert(defaultCompleted?.selected_outcome_id === "neutral-default-route", "single eligible hidden default route completes without asking the AI for a separate route id", defaultCompleted);
      const terminalOutputObjective = {
        ...routedObjective,
        id: "output-ending-contract-smoke",
        title: "Output ending contract",
        outcome_routes: [{
          id: "freeplay-ending",
          criteria: "The player continues beyond the story route.",
          requirements: [],
          rewards: [],
          ending_type: "freeplay"
        }, {
          id: "story-ending",
          criteria: "The story reaches its authored conclusion.",
          requirements: [],
          rewards: [],
          ending_type: "ending"
        }, {
          id: "game-over-ending",
          criteria: "The player reaches the fatal conclusion.",
          requirements: [],
          rewards: [],
          ending_type: "game_over",
          fallback: true
        }]
      };
      devAssert(objectiveOutcomeRouteValidationErrors([terminalOutputObjective]).length === 0, "output ending types validate without a destination objective", terminalOutputObjective.outcome_routes);
      const directEndingObjective = {
        id: "direct-output-ending-contract-smoke",
        title: "Direct output ending contract",
        completion_control: "ai",
        next_objectives: [{
          id: "direct-freeplay-ending",
          completion_instruction: "Continue in freeplay.",
          rewards: [],
          ending_type: "freeplay"
        }]
      };
      const directEndingSource = {
        id: "direct-output-ending-contract-source-smoke",
        title: "Direct output ending source",
        status: "active",
        completion_control: "ai",
        next_objectives: [{
          id: "direct-output-ending-source-output",
          objective_id: directEndingObjective.id,
          target_input_group_id: "direct-output-ending-contract-input",
          completion_instruction: "Continue to the direct output ending.",
          rewards: []
        }]
      };
      const directEndingErrors = objectiveTransitionContractValidationErrors([directEndingSource, directEndingObjective]);
      const choiceEndingErrors = objectiveChoiceValidationErrors([{
        id: "choice-output-ending-contract-smoke",
        title: "Choice output ending contract",
        completion_control: "choice",
        choices: [{
          id: "choice-story-ending",
          title: "End the story",
          requirements: [],
          rewards: [],
          ending_type: "ending"
        }]
      }]);
      devAssert(directEndingErrors.length === 0 && choiceEndingErrors.length === 0, "direct and choice output endings validate without destination objectives", {
        directEndingErrors,
        choiceEndingErrors
      });
      const legacyTerminalRoute = {
        ...terminalOutputObjective.outcome_routes[0],
        ending_type: undefined,
        terminal: true
      };
      delete legacyTerminalRoute.ending_type;
      devAssert(objectiveOutcomeRouteValidationErrors([{
        ...terminalOutputObjective,
        outcome_routes: [legacyTerminalRoute]
      }]).some(error => String(error.message || "").includes("ending_type")), "legacy terminal output data is rejected instead of treated as an ending");
      const terminalState = clone(hiddenDefaultState);
      terminalState.objectives.items.push(terminalOutputObjective);
      terminalState.objectives.active_id = terminalOutputObjective.id;
      terminalState.objectives.no_current = false;
      app.state = terminalState;
      await devCompileCurrentStoryFixture("ai-outcome-routing-ending-output-index-smoke");
      devAssert(app.storyDefinition?.objectiveOrder?.includes(terminalOutputObjective.id), "worker story index compilation retains the objective while skipping ending outputs without targets", {
        objectiveOrder: app.storyDefinition?.objectiveOrder,
        objectiveId: terminalOutputObjective.id
      });
      const freeplayCompleted = applyObjectiveVerifierResult(terminalState, terminalOutputObjective.id, {
        status: "objective_complete",
        outcome_id: "freeplay-ending"
      });
      devAssert(freeplayCompleted?.selected_outcome_id === "freeplay-ending" && terminalState.objectives.active_id === "" && terminalState.objectives.focus_id === "" && terminalState.objectives.no_current === true && terminalState.meta?.game_over !== true, "freeplay output ends the objective route without ending the game", {
        freeplayCompleted,
        objectives: terminalState.objectives
      });
      const invalidStory = {
        title: "Invalid route smoke",
        state: {
          objectives: {
            items: [{
              ...routedObjective,
              outcome_routes: [{
                ...routedObjective.outcome_routes[0],
                fallback: true
              }, {
                ...routedObjective.outcome_routes[0],
                fallback: true
              }]
            }]
          }
        }
      };
      const invalidRouteErrors = objectiveOutcomeRouteValidationErrors(invalidStory.state.objectives.items);
      devAssert(invalidRouteErrors.some(error => error.code === "duplicate") && invalidRouteErrors.some(error => error.code === "fallback"), "story validation rejects duplicate route ids and conflicting fallbacks", invalidRouteErrors);
      const invalidLockedOnlyChoices = objectiveChoiceValidationErrors([{
        id: "locked-choice-owner",
        title: "Locked Choice Owner",
        summary: "Choose a locked path.",
        completion_control: "choice",
        choices: [{
          id: "locked",
          title: "Locked",
          requirements: [{
            path: "story_inventory.flags.missing_choice_flag",
            op: "==",
            value: true
          }],
          rewards: [{
            type: "add_story_rule",
            text: "Locked path happened."
          }]
        }]
      }]);
      devAssert(invalidLockedOnlyChoices.some(error => error.code === "requirements"), "story validation rejects direct choice objectives with only locked choices", invalidLockedOnlyChoices);
      const validDirectChoice = {
        id: "visible-choice-owner",
        title: "Visible Choice Owner",
        summary: "Choose a path.",
        completion_control: "choice",
        choices: [{
          id: "locked-trust-path",
          title: "Use Earned Trust",
          requirements: [{
            type: "known_fact",
            target: "Protected Smoke Ally",
            id: "missing-trust-route"
          }],
          rewards: [{
            type: "add_story_rule",
            text: "Trust path chosen."
          }],
          ending_type: "freeplay"
        }, {
          id: "open-path",
          title: "Take the Open Path",
          requirements: [],
          rewards: [{
            type: "add_story_rule",
            text: "Open path chosen."
          }],
          ending_type: "freeplay"
        }]
      };
      const directChoices = objectiveDirectChoiceOptions(validDirectChoice);
      devAssert(directChoices.length === 2 && !directObjectiveChoiceIsSelectable(directChoices[0], state) && directObjectiveChoiceIsSelectable(directChoices[1], state) && objectiveChoiceValidationErrors([validDirectChoice]).length === 0, "direct player choice keeps locked options visible but requires at least one selectable path", directChoices.map(choice => ({
        id: choice.id,
        selectable: directObjectiveChoiceIsSelectable(choice, state),
        requirements: directObjectiveChoiceRequirementResults(choice, state)
      })));
      devTestLog("Scenario complete: ai-outcome-routing-smoke");
    } finally {
      aiText = originalAiText;
      app.state = originalState;
    }
  }
  async function devRunCharacterGenderAdaptationSmokeTest() {
    const originalPreferredGender = app.settings.preferredCharacterGender;
    const originalSwapAll = app.settings.swapAllGendersToPreferred;
    const originalState = app.state;
    const originalProfileImages = app.profileImages;
    const originalShowChoice = showChoice;
    const originalShowNotice = showNotice;
    try {
      app.profileImages = [];
      app.settings.preferredCharacterGender = "male";
      app.settings.swapAllGendersToPreferred = false;
      const fallbackOutfit = {
        id: "fallback",
        name: "Fallback Outfit",
        clothing: {
          shirt: "fake fallback shirt",
          pants: "fake fallback pants"
        }
      };
      const canonicalOutfit = {
        id: "canonical",
        name: "Canonical Outfit",
        clothing: {
          shirt: "fake canonical shirt",
          skirt: "fake canonical skirt"
        }
      };
      const state = {
        player: {
          ...devSmokeRuntimeCharacter("Fake Player", {
            gender: "female"
          }),
          id: "fake-player-id",
          name: "Fake Player",
          gender: "female",
          romanceable: true,
          fallback_name: "",
          fallback_outfits: [],
          fallback_starting_outfit_id: ""
        },
        characters: {
          "Fake Canonical": {
            ...devSmokeRuntimeCharacter("Fake Canonical", {
              gender: "female"
            }),
            id: "fake-canonical-id",
            name: "Fake Canonical",
            gender: "female",
            romanceable: true,
            fallback_name: "Fake Fallback",
            outfits: [canonicalOutfit],
            starting_outfit_id: "canonical",
            fallback_outfits: [fallbackOutfit],
            fallback_starting_outfit_id: "fallback",
            appearance: {
              ...blankAppearanceTemplate()
            }
          }
        },
        npc_directory: {
          locations: {}
        },
        future_cast: {
          items: {
            "fake-canonical-id": {
              id: "fake-canonical-id",
              character_definition_id: "fake-canonical-id"
            }
          }
        },
        scene: {
          party_members_present: ["fake-canonical-id"],
          image_characters: ["Fake Canonical"],
          npcs_present: []
        },
        objectives: {
          active_id: "fake-route-owner",
          items: [{
            id: "fake-route-owner",
            title: "Choose Fake Route",
            type: "story",
            status: "active",
            next_objectives: [{
              objective_id: "fake-authored-player-route",
              requirements: [{
                path: "player.id",
                op: "==",
                value: "fake-player-id"
              }]
            }, {
              objective_id: "fake-library-player-route",
              requirements: []
            }],
            rewards: [{
              type: "introduce_future_character",
              character_id: "fake-canonical-id"
            }]
          }, {
            id: "fake-authored-player-route",
            title: "Fake Authored Player Route",
            type: "story",
            status: "hidden"
          }, {
            id: "fake-library-player-route",
            title: "Fake Library Player Route",
            type: "story",
            status: "hidden"
          }]
        }
      };
      const adapted = materializeRuntimeSavePresentations(state);
      finalizeRuntimeCharacterNameKeys(adapted);
      const character = adapted.characters["Fake Fallback"];
      const routeOwner = adapted.objectives.items[0];
      devAssert(adapted.player.name === "Fake Player" && adapted.player.id === "fake-player-id" && character?.gender === "male" && character?.name === "Fake Fallback" && character?.id === "fake-canonical-id" && !Object.hasOwn(character, "fallback_name") && character?.outfits?.[0]?.id === "fallback" && adapted.future_cast.items["fake-canonical-id"]?.id === "fake-canonical-id" && adapted.future_cast.items["fake-canonical-id"]?.character_definition_id === "fake-canonical-id" && routeOwner.next_objectives[0]?.requirements[0]?.value === "fake-player-id" && routeOwner.rewards[0]?.character_id === "fake-canonical-id", `story startup materializes the selected presentation with its finalized display name; player=${adapted.player.name}/${adapted.player.id}; character=${character?.name}/${character?.gender}/${character?.id}; outfit=${character?.outfits?.[0]?.id}; future=${adapted.future_cast.items["fake-canonical-id"]?.id}/${adapted.future_cast.items["fake-canonical-id"]?.character_definition_id}; route=${routeOwner.next_objectives[0]?.requirements?.[0]?.value}; reward=${routeOwner.rewards[0]?.character_id}`, {
        adapted,
        character,
        routeOwner
      });
      app.state = adapted;
      devAssert(resolveEntityName("Fake Fallback", adapted, "") === "Fake Fallback" && resolveEntityName("Fake Canonical", adapted, "") === "" && !speakerExistsAsEntity("Fake Canonical") && adapted.scene.party_members_present[0] === "Fake Fallback" && adapted.scene.image_characters[0] === "Fake Fallback" && matchingObjectiveNextTransition(routeOwner, adapted)?.target?.id === "fake-authored-player-route", "runtime keeps only finalized display names after save creation");
      const authoredPlayerIds = Array.from({
        length: 10
      }, (_, index) => `fake-expedition-member-${index + 1}`);
      const branchOwner = {
        id: "fake-expedition-branch-owner",
        title: "Choose Fake Expedition Roster",
        type: "story",
        status: "active",
        next_objectives: [...authoredPlayerIds.map((id, index) => ({
          id: `fake-expedition-output-${index + 1}`,
          objective_id: `fake-expedition-route-${index + 1}`,
          requirements: [{
            path: "player.id",
            op: "==",
            value: id
          }]
        })), {
          id: "fake-expedition-library-output",
          objective_id: "fake-expedition-library-route",
          requirements: [],
          fallback: true
        }]
      };
      const branchTargets = [...authoredPlayerIds.map((id, index) => ({
        id: `fake-expedition-route-${index + 1}`,
        title: `Fake Expedition Route ${index + 1}`,
        type: "story",
        status: "hidden"
      })), {
        id: "fake-expedition-library-route",
        title: "Fake Expedition Library Route",
        type: "story",
        status: "hidden"
      }];
      for (const [index, playerId] of authoredPlayerIds.entries()) {
        const branchState = materializeRuntimeSavePresentations({
          player: {
            ...devSmokeRuntimeCharacter(`Fake Expedition Player ${index + 1}`, {
              gender: "female"
            }),
            id: playerId,
            name: `Fake Expedition Player ${index + 1}`,
            gender: "female",
            romanceable: false
          },
          characters: {},
          npc_directory: {
            locations: {}
          },
          future_cast: {
            items: {}
          },
          scene: {
            party_members_present: [],
            image_characters: [],
            npcs_present: []
          },
          objectives: {
            active_id: branchOwner.id,
            items: [clone(branchOwner), ...clone(branchTargets)]
          }
        });
        app.state = branchState;
        devAssert(matchingObjectiveNextTransition(branchState.objectives.items[0], branchState)?.target?.id === `fake-expedition-route-${index + 1}`, `authored player ${index + 1} selects only its matching expedition route: player=${branchState.player?.id}; requirement=${JSON.stringify(branchState.objectives.items[0]?.next_objectives?.[index] || null)}; transition=${JSON.stringify(matchingObjectiveNextTransition(branchState.objectives.items[0], branchState) || null)}`);
      }
      const libraryBranchState = materializeRuntimeSavePresentations({
        player: {
          ...devSmokeRuntimeCharacter("Fake Library Player", {
            gender: "female"
          }),
          id: "fake-library-player-id",
          name: "Fake Library Player",
          gender: "female",
          romanceable: false
        },
        characters: {},
        npc_directory: {
          locations: {}
        },
        future_cast: {
          items: {}
        },
        scene: {
          party_members_present: [],
          image_characters: [],
          npcs_present: []
        },
        objectives: {
          active_id: branchOwner.id,
          items: [clone(branchOwner), ...clone(branchTargets)]
        }
      });
      app.state = libraryBranchState;
      devAssert(matchingObjectiveNextTransition(libraryBranchState.objectives.items[0], libraryBranchState)?.target?.id === "fake-expedition-library-route", "a library player selects the expedition fallback route");
      const missingFallback = {
        ...blankCharacterTemplate("Fake Missing Fallback"),
        name: "Fake Missing Fallback",
        gender: "male",
        romanceable: true,
        outfits: [{
          id: "work",
          name: "Work",
          clothing: {
            shirt: "fake work shirt",
            pants: "fake work pants"
          }
        }],
        starting_outfit_id: "work",
        appearance: {
          ...blankAppearanceTemplate()
        }
      };
      delete missingFallback.fallback_name;
      delete missingFallback.fallback_outfits;
      delete missingFallback.fallback_starting_outfit_id;
      app.settings.preferredCharacterGender = "female";
      adaptRuntimeCharacterGender(missingFallback, "fake-missing-fallback");
      devAssert(missingFallback.gender === "female" && clothingItemText(missingFallback.clothing?.bra) === "bra" && clothingItemText(missingFallback.outfits?.[0]?.clothing?.bra) === "bra" && !clothingItemText(missingFallback.fallback_outfits?.[0]?.clothing?.bra), "missing non-male fallback outfits are synthesized with a generic bra while preserving the male outfit", missingFallback);
      app.settings.preferredCharacterGender = "male";
      const nonRomanceable = {
        ...blankCharacterTemplate("Fake Official"),
        name: "Fake Official",
        gender: "female",
        romanceable: false
      };
      adaptRuntimeCharacterGender(nonRomanceable, "fake-official");
      devAssert(nonRomanceable.gender === "female", "non-romanceable character remains canonical while swap-all is disabled");
      app.settings.swapAllGendersToPreferred = true;
      adaptRuntimeCharacterGender(nonRomanceable, "fake-official");
      devAssert(nonRomanceable.gender === "male", "swap-all profile setting adapts non-romanceable non-player characters");
      const romanceableCounts = {
        male: 0,
        female: 0
      };
      const nonRomanceableCounts = {
        male: 0,
        female: 0
      };
      for (let bucket = 0; bucket < 100; bucket += 1) {
        romanceableCounts[generatedCharacterGenderFromBucket(bucket, true)] += 1;
        nonRomanceableCounts[generatedCharacterGenderFromBucket(bucket, false)] += 1;
      }
      devAssert(romanceableCounts.male === 50 && romanceableCounts.female === 50 && nonRomanceableCounts.male === 50 && nonRomanceableCounts.female === 50, "generated gender policy uses exact 50/50 and 50/50 distributions");
      devAssert(normalizedCharacterGender("trans male") === "male" && normalizedCharacterGender("trans-male") === "male" && normalizedCharacterGender("male") === "male" && normalizedCharacterGender("female") === "female" && normalizedCharacterGender("non-binary") === "female" && normalizedCharacterGender("invented gender") === "female" && canonicalCharacterGenderValue("trans-male") === "male" && explicitFallbackGender("male") === "male" && explicitFallbackGender("female") === "female" && explicitFallbackGender("") === "" && explicitFallbackGender("non-binary") === "", "character mechanics use only male and female buckets with canonical trans-male aliases");
      devAssert(characterGenderAdaptationValidationErrors({
        gender: "female",
        romanceable: true,
        appearance: {},
        fallback_name: "Fake Complete",
        fallback_outfits: [fallbackOutfit],
        fallback_starting_outfit_id: "fallback"
      }).length === 0, "complete fallback presentation validates");
      const partialFallbackErrors = characterGenderAdaptationValidationErrors({
        gender: "female",
        romanceable: true,
        appearance: {},
        fallback_name: "Fake Partial"
      });
      const completeFallbackErrors = characterGenderAdaptationValidationErrors({
        gender: "female",
        romanceable: true,
        appearance: {},
        fallback_name: "Fake Complete",
        fallback_outfits: [fallbackOutfit],
        fallback_starting_outfit_id: "fallback"
      });
      devAssert(partialFallbackErrors.some(error => error.path.endsWith("fallback_outfits")) && partialFallbackErrors.some(error => error.path.endsWith("fallback_starting_outfit_id")) && !completeFallbackErrors.some(error => error.path.includes("fallback_")), "fallback presentation fields are required as a complete group", {
        partialFallbackErrors,
        completeFallbackErrors
      });
      const smokeProfileDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
      const smokeProfileHtml = `<img alt="Gender profile smoke" src="${smokeProfileDataUrl}">`;
      const femaleProfile = createProfileImageRecord({
        id: "gender-profile-female",
        character_id: "fake-profile-buckets",
        owner_name: "Fake Profile Buckets",
        male: false,
        html: smokeProfileHtml
      });
      const maleProfile = createProfileImageRecord({
        id: "gender-profile-male",
        character_id: "fake-profile-buckets",
        owner_name: "Fake Profile Buckets",
        male: true,
        html: smokeProfileHtml
      });
      app.profileImages = [maleProfile, femaleProfile];
      const profileCharacter = {
        ...blankCharacterTemplate("Fake Profile Buckets"),
        name: "Fake Profile Buckets",
        gender: "female",
        profile_images: [profileImageEntityRecord(maleProfile), profileImageEntityRecord(femaleProfile)],
        profile_image_id: femaleProfile.id
      };
      const femaleActiveProfile = activeProfileImage(profileCharacter);
      profileCharacter.gender = "male";
      profileCharacter.profile_image_id = maleProfile.id;
      const maleActiveProfile = activeProfileImage(profileCharacter);
      const missingMaleProfile = {
        ...blankCharacterTemplate("Fake Missing Profile Bucket"),
        name: "Fake Missing Profile Bucket",
        gender: "male",
        profile_images: [profileImageEntityRecord(femaleProfile)],
        profile_image_id: ""
      };
      const generatedIdCharacter = {
        ...blankCharacterTemplate("Fake Generated Profile Id"),
        id: "fake-generated-profile-id",
        name: "Fake Generated Profile Id",
        gender: "female",
        profile_images: [],
        profile_image_id: ""
      };
      app.profileEntityOverrides ||= {};
      app.profileEntityOverrides[generatedIdCharacter.name] = generatedIdCharacter;
      const generatedIdProfile = rememberProfileImage(generatedIdCharacter.name, {
        pending: true
      }, {
        setActive: false,
        save: false
      });
      devAssert(typeof generatedIdProfile?.id === "string" && !!generatedIdProfile.id && Number.isSafeInteger(generatedIdProfile.seed) && generatedIdProfile.seed >= 0, "automatic profile-image records receive non-empty text ids and valid integer seeds", {
        generatedId: generatedIdProfile?.id,
        seed: generatedIdProfile?.seed
      });
      app.profileImages = app.profileImages.filter(image => image.id !== generatedIdProfile?.id);
      delete app.profileEntityOverrides[generatedIdCharacter.name];
      devAssert(femaleActiveProfile?.id === femaleProfile.id && maleActiveProfile?.id === maleProfile.id && activeProfileImage(missingMaleProfile) === null, "profile images use explicit male/non-male buckets and never display an opposite-presentation fallback", {
        femaleActiveProfile,
        maleActiveProfile
      });
      devAssert(createProfileImageRecord({
        id: "explicit-male",
        character_id: "profile-presentation-smoke",
        male: true
      }).male === true && createProfileImageRecord({
        id: "explicit-non-male",
        character_id: "profile-presentation-smoke",
        male: false
      }).male === false && createProfileImageRecord({
        id: "missing-presentation",
        character_id: "profile-presentation-smoke"
      }).male === null && !/\bmale\s*:/.test(rememberImage.toString()), "only profile-image records carry male presentation metadata; normal image records do not");
      const publicReadyGeneratedRecord = devSmokeCharacterRecord("Fake Public Canonical", {
        character: {
          gender: "male",
          romanceable: true,
          appearance: {
            ...blankAppearanceTemplate()
          },
          outfits: [canonicalOutfit],
          active_outfit_id: "canonical",
          starting_outfit_id: "canonical",
          fallback_name: "Fake Public Fallback",
          fallback_outfits: [fallbackOutfit],
          fallback_starting_outfit_id: "fallback",
          default_profile_image: {
            ...emptyProfileImageSlot(true),
            url: "https://example.invalid/fake-public-male.png",
            male: true
          },
          profile_image_presentations: {
            male: {
              ...emptyProfileImageSlot(true),
              url: "https://example.invalid/fake-public-male.png",
              male: true
            },
            non_male: {
              ...emptyProfileImageSlot(false),
              url: "https://example.invalid/fake-public-non-male.png",
              male: false
            }
          }
        }
      });
      const publicReadyCharacter = {
        ...publicReadyGeneratedRecord.character,
        source: "Original"
      };
      const publicReadyRecord = characterLibraryRecordFromDefinition(publicReadyCharacter, {
        creator: publicReadyGeneratedRecord.creator,
        creator_id: publicReadyGeneratedRecord.creator_id
      });
      const incompletePresentationIssues = characterPresentationCompatibilityIssues({
        kind: "character",
        name: "Fake Incomplete Public",
        character: {
          ...publicReadyCharacter,
          name: "Fake Incomplete Public",
          fallback_name: "",
          fallback_outfits: [],
          fallback_starting_outfit_id: "",
          profile_image_presentations: createProfileImagePresentations(),
          default_profile_image: emptyProfileImageSlot(true)
        }
      });
      const incompletePublicPresentationIssues = characterPresentationCompatibilityIssues({
        kind: "character",
        name: "Fake Incomplete Public",
        character: {
          ...publicReadyCharacter,
          name: "Fake Incomplete Public",
          fallback_name: "",
          fallback_outfits: [],
          fallback_starting_outfit_id: "",
          profile_image_presentations: createProfileImagePresentations(),
          default_profile_image: emptyProfileImageSlot(true)
        }
      }, {
        requireProfileImages: true
      });
      const localMissingImagePresentationIssues = characterPresentationCompatibilityIssues({
        kind: "character",
        name: "Fake Local Missing Images",
        character: {
          ...publicReadyCharacter,
          name: "Fake Local Missing Images",
          profile_image_presentations: createProfileImagePresentations(),
          default_profile_image: emptyProfileImageSlot(true)
        }
      });
      const smokePlaceholderCharacter = {
        ...publicReadyCharacter,
        name: "Fake Smoke Placeholder Images",
        profile_image_presentations: {
          male: {
            ...emptyProfileImageSlot(true),
            url: smokeProfileDataUrl,
            source: "placeholder",
            male: true
          },
          non_male: {
            ...emptyProfileImageSlot(false),
            url: smokeProfileDataUrl,
            source: "placeholder",
            male: false
          }
        }
      };
      const activeSmokeTokenBeforePlaceholderCheck = app.activeSmokeScenarioToken;
      const suiteBeforePlaceholderCheck = devSmokeSuiteState().running;
      app.activeSmokeScenarioToken = null;
      devSmokeSuiteState().running = false;
      const livePlaceholderPresentationIssues = characterPresentationCompatibilityIssues({
        kind: "character",
        name: smokePlaceholderCharacter.name,
        character: smokePlaceholderCharacter
      });
      devSmokeSuiteState().running = suiteBeforePlaceholderCheck;
      app.activeSmokeScenarioToken = activeSmokeTokenBeforePlaceholderCheck;
      const smokePlaceholderPresentationIssues = characterPresentationCompatibilityIssues({
        kind: "character",
        name: smokePlaceholderCharacter.name,
        character: smokePlaceholderCharacter
      });
      const completePresentationIssues = characterPresentationCompatibilityIssues({
        kind: "character",
        name: publicReadyCharacter.name,
        character: publicReadyCharacter
      });
      const sanitizedPresentationIssues = characterPresentationCompatibilityIssues({
        kind: "character",
        name: publicReadyCharacter.name,
        character: materializeCharacterForRuntime(publicReadyCharacter, publicReadyCharacter.name)
      });
      const presentationNotices = [];
      showNotice = async (title, body) => {
        presentationNotices.push({
          title,
          body
        });
      };
      const blockedIncompleteImport = await confirmCharacterPresentationCompatibility([{
        kind: "character",
        character: {
          ...publicReadyCharacter,
          fallback_name: ""
        }
      }]);
      showNotice = originalShowNotice;
      const embeddedStoryPresentationIssues = storyCharacterPresentationCompatibilityIssues({
        title: "Fake Embedded Presentation Story",
        genres: ["fantasy"],
        state: {
          ...clone(defaultState),
          characters: {
            [publicReadyCharacter.name]: publicReadyCharacter,
            "Fake Incomplete Public": {
              ...publicReadyCharacter,
              name: "Fake Incomplete Public",
              fallback_name: ""
            }
          },
          objectives: {
            active_id: null,
            items: []
          }
        }
      });
      showChoice = originalShowChoice;
      devAssert(incompletePresentationIssues.some(issue => /alternate male\/non-male name/i.test(issue)) && !incompletePresentationIssues.some(issue => /profile image/i.test(issue)) && incompletePublicPresentationIssues.some(issue => /male profile image/i.test(issue)) && incompletePublicPresentationIssues.some(issue => /female profile image/i.test(issue)) && localMissingImagePresentationIssues.length === 0 && livePlaceholderPresentationIssues.some(issue => /placeholder image data/i.test(issue)) && smokePlaceholderPresentationIssues.length === 0 && completePresentationIssues.length === 0 && sanitizedPresentationIssues.length === 0 && blockedIncompleteImport === false && presentationNotices.some(notice => /Incomplete Gender Presentations/i.test(notice.title || "")) && embeddedStoryPresentationIssues.some(issue => /Fake Incomplete Public.*alternate male\/non-male name/i.test(issue)), `character and story imports block incomplete paired presentations while public-ready definitions pass; incomplete=${JSON.stringify(incompletePresentationIssues)}; public=${JSON.stringify(incompletePublicPresentationIssues)}; local=${JSON.stringify(localMissingImagePresentationIssues)}; livePlaceholder=${JSON.stringify(livePlaceholderPresentationIssues)}; smokePlaceholder=${JSON.stringify(smokePlaceholderPresentationIssues)}; complete=${JSON.stringify(completePresentationIssues)}; sanitized=${JSON.stringify(sanitizedPresentationIssues)}; blocked=${blockedIncompleteImport}; notices=${JSON.stringify(presentationNotices)}; embedded=${JSON.stringify(embeddedStoryPresentationIssues)}`, {
        incompletePresentationIssues,
        completePresentationIssues,
        sanitizedPresentationIssues,
        presentationNotices,
        embeddedStoryPresentationIssues,
        incompletePublicPresentationIssues,
        localMissingImagePresentationIssues,
        livePlaceholderPresentationIssues,
        smokePlaceholderPresentationIssues
      });
      app.settings.preferredCharacterGender = "female";
      const localProjectedCard = characterLibraryRecordHtml(publicReadyRecord);
      const publicMetadata = publicLibraryCharacterMetadata(publicReadyRecord, "pending");
      const publicProjectedCard = publicCharacterLibraryCardHtml({
        ...publicMetadata,
        id: "fake-public-projection",
        rating_count: 0
      });
      devAssert(/Fake Public Fallback/.test(localProjectedCard) && /fake-public-non-male\.png/.test(localProjectedCard) && /Fake Public Fallback/.test(publicProjectedCard) && /fake-public-non-male\.png/.test(publicProjectedCard) && publicMetadata.male_name === "Fake Public Canonical" && publicMetadata.non_male_name === "Fake Public Fallback" && publicMetadata.male_image_url.endsWith("fake-public-male.png") && publicMetadata.non_male_image_url.endsWith("fake-public-non-male.png") && publicLibraryPublishPolicyErrors(publicMetadata).length === 0, `local and public character cards project the profile-preferred name and profile image from indexed presentation metadata; local=${localProjectedCard}; public=${publicProjectedCard}; metadata=${JSON.stringify(publicMetadata)}; policy=${JSON.stringify(publicLibraryPublishPolicyErrors(publicMetadata))}`, {
        publicMetadata
      });
      const femaleCanonicalRecord = clone(publicReadyRecord);
      femaleCanonicalRecord.character = characterLibraryPresentation(publicReadyRecord.character, "fake-public-female-canonical", "female");
      app.settings.preferredCharacterGender = "male";
      const reverseProjectedCard = characterLibraryRecordHtml(femaleCanonicalRecord);
      devAssert(/Fake Public Canonical/.test(reverseProjectedCard) && /fake-public-male\.png/.test(reverseProjectedCard), `a female-canonical local card projects back to its male name and image for a male-only profile; card=${reverseProjectedCard}`, {
        reverseProjectedCard
      });
      const missingProfileMetadataCharacter = {
        ...blankCharacterTemplate("Fake Missing Profile Metadata"),
        ...devCompleteLibraryCharacterMetadata(),
        name: "Fake Missing Profile Metadata",
        gender: "female",
        romanceable: true,
        appearance: {
          ...blankAppearanceTemplate()
        },
        default_profile_image: {
          url: "https://example.invalid/fake-profile.png",
          local_image_id: "",
          source: "smoke",
          seed: 1,
          prompt: "fake profile prompt",
          negative_prompt: "",
          note: ""
        }
      };
      const missingProfileCharacterValidation = validateCharacterDefinition(missingProfileMetadataCharacter);
      const missingProfileStoryValidation = validateStoryDefinition({
        title: "Fake Missing Profile Metadata Story",
        genres: ["fantasy"],
        state: {
          ...clone(defaultState),
          characters: {
            [missingProfileMetadataCharacter.name]: missingProfileMetadataCharacter
          },
          objectives: {
            active_id: null,
            items: []
          }
        }
      });
      missingProfileMetadataCharacter.default_profile_image.male = false;
      devAssert(missingProfileCharacterValidation.errors.some(error => error.path.endsWith("default_profile_image.male")) && missingProfileStoryValidation.errors.some(error => error.path.endsWith("default_profile_image.male")) && !characterImagePromptValidationErrors(missingProfileMetadataCharacter).some(error => error.path.endsWith("default_profile_image.male")), `configured profile images require explicit presentation metadata in shared character-import and story-publish validation; character=${JSON.stringify(missingProfileCharacterValidation.errors)}; story=${JSON.stringify(missingProfileStoryValidation.errors)}`, {
        missingProfileCharacterValidation,
        missingProfileStoryValidation
      });
      devTestLog("Scenario complete: character-gender-adaptation-smoke");
    } finally {
      app.settings.preferredCharacterGender = originalPreferredGender;
      app.settings.swapAllGendersToPreferred = originalSwapAll;
      app.state = originalState;
      app.profileImages = originalProfileImages;
      showChoice = originalShowChoice;
      showNotice = originalShowNotice;
    }
  }
  async function devRunReverseDeltaSnapshotSmokeTest() {
    devTestLog("Scenario start: reverse-delta-snapshot-smoke");
    const saveSnapshot = devSaveLibrarySnapshotForSmoke();
    const smokeId = newSaveId("smoke-snapshot-delta");
    try {
      devResetForLiveTest("reverse-delta-snapshot-smoke");
      const state = clone(defaultState);
      state.meta = {
        ...clone(defaultState.meta || {}),
        setup_complete: true,
        story_source: {
          mode: "original",
          title: "Snapshot Delta Smoke"
        }
      };
      state.player = devSmokeRuntimeCharacter("Snapshot Smoke Player", {
        age: 30,
        gender: "male",
        state_of_mind: "before"
      });
      const messages = Array.from({
        length: 120
      }, (_, index) => ({
        id: index + 1,
        entryId: index + 1,
        role: index % 2 ? "assistant" : "user",
        text: `Snapshot message ${index + 1}`
      }));
      await createNewActiveSave("snapshot delta baseline", {
        saveId: smokeId,
        state,
        messages
      });
      const first = snapshotState("snapshot baseline");
      await flushRuntimeSaveProjections();
      updatePlayerRuntime(player => {
        player.state_of_mind = "after";
      });
      app.state.story_inventory.coins = 42;
      const second = snapshotState("snapshot after targeted changes");
      const compact = snapshotForStorage(second);
      const restored = applyReverseStatePatch(app.state, second.reverseRuntimeChanges);
      const currentMessages = [...app.messages];
      devAssert(!Object.prototype.hasOwnProperty.call(compact || {}, "messages") && compact.messageBoundaryId === String(currentMessages.at(-1)?.id || "") && compact.messageCount === currentMessages.length && Array.isArray(compact.reverseRuntimeChanges) && compact.reverseRuntimeChanges.length > 0 && restored.player.state_of_mind === "before" && Number(restored.story_inventory?.coins || 0) === 0, "snapshot stores a message boundary and targeted reverse runtime changes without copying transcript history", {
        compact,
        reverseCount: compact?.reverseRuntimeChanges?.length
      });
      const compactBytes = stableJsonString(compact).length;
      devAssert(compactBytes < stableJsonString(messages).length / 4, "snapshot size does not grow linearly with the full transcript", {
        compactBytes,
        transcriptBytes: stableJsonString(messages).length
      });
      await flushRuntimeSaveProjections();
      if (app.persistence.activeSnapshotId) await app.persistence.commitSnapshot(app.persistence.activeSnapshotId);
      const normalizedSaveId = Number(activeSaveId());
      const [messageCount, snapshotCount, reverseCount] = await Promise.all([app.persistence.countRecords("messages", normalizedSaveId), app.persistence.countRecords("snapshots", normalizedSaveId), app.persistence.countRecords("snapshotReverseOperations", normalizedSaveId)]);
      devAssert(snapshotCount === 2 && messageCount === messages.length && reverseCount > 0, `messages, snapshot metadata, and reverse operations persist in independent normalized stores (${messageCount} messages, ${snapshotCount} snapshots, ${reverseCount} reverse operations)`, {
        messageCount,
        snapshotCount,
        reverseCount
      });
      devTestLog("Scenario complete: reverse-delta-snapshot-smoke");
    } finally {
      await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
    }
  }
  async function devRunAiReplyTransactionSmokeTest() {
    devTestLog("Scenario start: ai-reply-transaction-smoke");
    const pluginOverrides = globalThis.__emberAdventuresPluginOverrides ||= {};
    const original = {
      state: clone(app.state),
      messages: clone(app.messages || []),
      queue: clone(app.queue || []),
      aiText,
      prepareAiTextPluginFrame,
      extractPostResponsePeopleMetadata,
      ensureSceneNpcDefinitions,
      readMessage,
      scheduleActiveGameSave,
      aiTextPlugin: pluginOverrides.aiTextPlugin,
      hadAiTextPlugin: Object.prototype.hasOwnProperty.call(pluginOverrides, "aiTextPlugin"),
      autoVoice: app.settings.autoVoice,
      stateCheckMode: app.settings.stateCheckMode,
      fetch: globalThis.fetch
    };
    try {
      prepareAiTextPluginFrame = async () => {};
      scheduleActiveGameSave = () => true;
      let providerAttempts = 0;
      const streamEvents = [];
      pluginOverrides.aiTextPlugin = async (options = {}) => {
        providerAttempts += 1;
        if (providerAttempts === 1) {
          options.onChunk?.({
            textChunk: "Fake failed partial"
          });
          return {
            generatedText: "Fake failed partial",
            stopReason: "error"
          };
        }
        options.onChunk?.({
          textChunk: "Fake completed response"
        });
        return {
          generatedText: "Fake completed response",
          stopReason: "natural"
        };
      };
      const retryResult = await runAiTextNow("Fake retry instruction", {
        label: "fake retry request",
        textProviderOverride: "perchance",
        onStream: (text, delta, done, options = {}) => streamEvents.push({
          text,
          delta,
          done,
          options
        })
      });
      devAssert(providerAttempts === 2 && retryResult === "Fake completed response" && streamEvents.some(event => event.options.reset === true) && !retryResult.includes("failed partial"), "an unsuccessful stop reason clears its partial draft and retries exactly once", {
        providerAttempts,
        retryResult,
        streamEvents
      });
      providerAttempts = 0;
      pluginOverrides.aiTextPlugin = async (options = {}) => {
        providerAttempts += 1;
        options.onChunk?.({
          textChunk: `Fake failed attempt ${providerAttempts}`
        });
        return {
          generatedText: `Fake failed attempt ${providerAttempts}`,
          stopReason: "error"
        };
      };
      let finalRetryError = "";
      try {
        await runAiTextNow("Fake exhausted retry instruction", {
          label: "fake exhausted retry request",
          textProviderOverride: "perchance",
          onStream: () => {}
        });
      } catch (err) {
        finalRetryError = err?.message || String(err);
      }
      devAssert(providerAttempts === 2 && /stopReason=error/.test(finalRetryError), "a provider failure is surfaced after exactly two total attempts", {
        providerAttempts,
        finalRetryError
      });
      let localProviderAttempts = 0;
      const localStreamEvents = [];
      globalThis.fetch = async () => {
        localProviderAttempts += 1;
        const successful = localProviderAttempts === 2;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            generatedText: successful ? "Fake local completed response" : "Fake local failed response",
            stopReason: successful ? "completed" : "error"
          })
        };
      };
      const localRetryResult = await runAiTextNow("Fake local retry instruction", {
        label: "fake local retry request",
        textProviderOverride: "local-codex",
        onStream: (text, delta, done, options = {}) => localStreamEvents.push({
          text,
          delta,
          done,
          options
        })
      });
      devAssert(localProviderAttempts === 2 && localRetryResult === "Fake local completed response" && localStreamEvents.some(event => event.options.reset === true), "the local Codex text provider also clears failed output and retries exactly once", {
        localProviderAttempts,
        localRetryResult,
        localStreamEvents
      });
      app.state = repairAiGeneratedState(clone(defaultState));
      app.state.location ||= {};
      app.state.location.settlement_name = "Fake Transaction Town";
      app.state.characters = {
        "Fake Canonical": {
          ...blankCharacterTemplate("Fake Displayed"),
          name: "Fake Displayed",
          fallback_name: "Fake Canonical"
        }
      };
      app.state.scene ||= {};
      app.state.scene.npcs_present = [];
      app.messages = [{
        id: "fake-player-kept",
        role: "user",
        speaker: "Player",
        text: "Fake player input that must survive.",
        at: new Date().toISOString()
      }, {
        id: "fake-failed-assistant",
        role: "assistant",
        speaker: "",
        text: "",
        at: new Date().toISOString()
      }];
      let metadataExtractions = 0;
      let voiceStarts = 0;
      let metadataStarted = false;
      let voiceStartedBeforeMetadata = false;
      const voiceReadEvents = [];
      extractPostResponsePeopleMetadata = async () => {
        metadataExtractions += 1;
        metadataStarted = true;
        return {};
      };
      readMessage = (id, options = {}) => {
        voiceStarts += 1;
        voiceStartedBeforeMetadata ||= !metadataStarted;
        voiceReadEvents.push({
          id,
          options: clone(options)
        });
        return true;
      };
      ensureSceneNpcDefinitions = () => {};
      aiText = async (instruction, options = {}) => {
        options.onStream?.("Fake visible partial", "Fake visible partial", false);
        throw new Error("Fake final provider failure");
      };
      let failed = false;
      try {
        await generateReply("fake-failed-assistant");
      } catch (err) {
        failed = /Fake final provider failure/.test(err.message || "");
      }
      devAssert(failed && !!findMessageById("fake-player-kept") && !findMessageById("fake-failed-assistant") && metadataExtractions === 0 && voiceStarts === 0 && !(app.state.scene.npcs_present || []).length, "a failed final reply removes its draft, preserves player input, and performs no metadata, voice, or scene work", {
        messages: app.messages,
        metadataExtractions,
        voiceStarts,
        scene: app.state.scene
      });
      const successDraft = addMessage("assistant", "", "");
      const successMessageId = successDraft.id;
      app.settings.autoVoice = true;
      // This scenario follows a failed reply in the same smoke. Clear
      // per-message voice guards so the success path tests its own
      // early voice start rather than inherited transient state.
      app.voicePaused = false;
      app.autoVoiceStartedMessageIds?.delete(String(successMessageId));
      app.streamedVoiceReplyIds?.delete(String(successMessageId));
      app.voiceMetadataPendingMessageIds?.delete(String(successMessageId));
      app.pendingVoiceDialogueParts?.delete(String(successMessageId));
      aiText = async (instruction, options = {}) => {
        options.onStream?.("Fake completed draft", "Fake completed draft", false);
        return `(Fake Servant) "Welcome to the fake hall."`;
      };
      extractPostResponsePeopleMetadata = async () => {
        metadataExtractions += 1;
        metadataStarted = true;
        return {
          speak: {
            fake_servant: "Fake Servant"
          },
          newSpeakers: {
            fake_servant: {
              name: "Fake Servant",
              full_name: "Fake Servant",
              gender: "female",
              age: 27,
              role: "servant",
              appearance: "fake appearance",
              personality: "fake personality"
            }
          }
        };
      };
      const completed = await generateReply(successMessageId);
      const completedMessage = findMessageById(successMessageId);
      devAssert(/Welcome to the fake hall/.test(completed) && metadataExtractions === 1 && !!getNpcEntry("Fake Servant") && app.state.scene.npcs_present.includes("Fake Servant") && completedMessage.voiceSpeakers.includes("Fake Servant") && voiceStarts === 1 && voiceStartedBeforeMetadata && voiceReadEvents[0]?.options?.gateDialogueUntilMetadata === true, "a completed reply starts reading before unknown-speaker metadata finishes, while gating only the unresolved quote", {
        completedMessage,
        scene: app.state.scene,
        metadataExtractions,
        voiceReadEvents
      });
      app.settings.stateCheckMode = "groups";
      await afterReplyEffects(completed, successMessageId);
      devAssert(voiceStarts === 1, "after-reply effects do not restart a reply that already began reading", {
        voiceStarts,
        voiceReadEvents
      });
      const knownVoiceMessage = addMessage("assistant", "", "Narrator");
      knownVoiceMessage.voiceText = '(Fake Displayed) "Known speakers read without metadata delay."';
      maybeStartAssistantAutoVoiceBeforeStateWork(knownVoiceMessage.id);
      const knownVoiceRead = voiceReadEvents.at(-1);
      devAssert(knownVoiceRead?.id === knownVoiceMessage.id && knownVoiceRead?.options?.gateDialogueUntilMetadata === false && !app.voiceMetadataPendingMessageIds.has(String(knownVoiceMessage.id)), "known speaker voices start immediately without a metadata gate", {
        knownVoiceMessage,
        knownVoiceRead,
        pendingMetadata: [...(app.voiceMetadataPendingMessageIds || [])]
      });
      devAssert(displayMessageSpeaker({
        role: "assistant",
        voiceSpeakers: ["Fake Canonical"]
      }) === "Fake Displayed" && promptEntityName("Fake Canonical") === "Fake Displayed" && /Fake Displayed/.test(renderInlineVoiceTagsForDisplay(`(Fake Canonical) "Fake first line."\n(Fake Servant) "Fake second line."`)), "speaker tags and prompt names resolve canonical or fallback names to the active presentation");
      devTestLog("Scenario complete: ai-reply-transaction-smoke");
    } finally {
      aiText = original.aiText;
      prepareAiTextPluginFrame = original.prepareAiTextPluginFrame;
      extractPostResponsePeopleMetadata = original.extractPostResponsePeopleMetadata;
      ensureSceneNpcDefinitions = original.ensureSceneNpcDefinitions;
      readMessage = original.readMessage;
      scheduleActiveGameSave = original.scheduleActiveGameSave;
      if (original.hadAiTextPlugin) pluginOverrides.aiTextPlugin = original.aiTextPlugin;else delete pluginOverrides.aiTextPlugin;
      app.settings.autoVoice = original.autoVoice;
      app.settings.stateCheckMode = original.stateCheckMode;
      globalThis.fetch = original.fetch;
      app.state = original.state;
      app.messages = original.messages;
      app.queue = original.queue;
      assertExactMessageStorage();
    }
  }
  async function devRunChatImageScrollStabilitySmokeTest() {
    devTestLog("Scenario start: chat-image-scroll-stability-smoke");
    const thread = $("thread");
    const appRoot = $("app");
    const original = {
      state: clone(app.state),
      messages: clone(app.messages || []),
      images: clone(app.images || []),
      showImagesInChat: app.settings.showImagesInChat,
      threadHtml: thread?.innerHTML || "",
      threadScrollTop: thread?.scrollTop || 0,
      threadStyleHeight: thread?.style.height || "",
      threadStyleMaxHeight: thread?.style.maxHeight || "",
      threadStyleOverflowY: thread?.style.overflowY || "",
      appRootStyle: appRoot?.getAttribute("style"),
      scheduleActiveGameSave,
      aiActive: app.aiActive,
      aiQueue: app.aiQueue,
      busy: app.busy,
      showAiStatusMessages: app.settings.showAiStatusMessages,
      reducedUi: app.settings.reducedUi,
      stateSync: {
        ...app.stateSync
      },
      newGameChatScrollToTop: app.newGameChatScrollToTop,
      existingGameChatScrollToBottom: app.existingGameChatScrollToBottom
    };
    try {
      scheduleActiveGameSave = () => true;
      app.settings.showImagesInChat = true;
      app.settings.showAiStatusMessages = true;
      app.settings.reducedUi = false;
      app.newGameChatScrollToTop = false;
      app.existingGameChatScrollToBottom = false;
      if (appRoot) {
        appRoot.style.display = "grid";
        appRoot.style.position = "fixed";
        appRoot.style.left = "-2000px";
        appRoot.style.top = "0";
        appRoot.style.width = "1200px";
        appRoot.style.height = "720px";
        appRoot.style.visibility = "hidden";
        appRoot.style.pointerEvents = "none";
      }
      if (thread) {
        thread.style.height = "260px";
        thread.style.maxHeight = "260px";
        thread.style.overflowY = "auto";
      }
      const setSmokeScrollTop = value => {
        thread.scrollTop = value;
        thread.dispatchEvent(new Event("scroll"));
      };
      app.state = repairAiGeneratedState(clone(defaultState));
      app.messages = Array.from({
        length: 32
      }, (_, index) => ({
        id: `fake-scroll-message-${index}`,
        role: index % 2 ? "assistant" : "user",
        speaker: index % 2 ? "Fake Speaker" : "Player",
        text: `Fake scroll message ${index}. ${"Long fake content. ".repeat(8)}`,
        at: new Date(Date.now() + index * 1000).toISOString()
      }));
      app.images = [{
        id: "fake-scroll-image",
        at: new Date().toISOString(),
        requestedAt: new Date().toISOString(),
        requestedAfterMessageId: "fake-scroll-message-14",
        prompt: "fake pending image prompt",
        negativePrompt: "",
        html: "",
        pending: true,
        error: "",
        targets: ["Player"]
      }];
      renderThread("chat image scroll stability smoke");
      const card = document.querySelector(`#thread .image-card[data-image-id="${cssEscape(imageDomId("fake-scroll-image"))}"]`);
      const renderTarget = card?.querySelector(".image-render");
      devAssert(!!card && !!renderTarget && getComputedStyle(renderTarget).aspectRatio === "2 / 3" && !!renderTarget.querySelector(".image-loading-block, .loading-spinner"), "pending chat images reserve a stable portrait frame and display a loading placeholder", {
        card: card?.outerHTML,
        aspectRatio: renderTarget && getComputedStyle(renderTarget).aspectRatio
      });
      for (const [index, title] of ["A", "B", "C"].entries()) createNormalImageRequest({
        id: `common-order-image-${title}`,
        title,
        reason: "common ordering smoke",
        prompt: `common ordering ${title}`,
        negativePrompt: "",
        html: `<img src="${devSmokeOnePixelDataUrl()}" alt="${title}">`,
        pending: false,
        targets: ["Player"],
        requestedAfterMessageId: "fake-scroll-message-14",
        requestOrder: 100 + index
      }, {
        startRequest: false
      });
      renderThread("common image ordering smoke");
      renderImagePanel("common image ordering smoke");
      const chatCommonOrder = [...document.querySelectorAll("#thread .image-card[data-image-id]")].map(node => node.dataset.imageId || "").filter(id => id.startsWith("common-order-image-"));
      const panelCommonOrder = [...document.querySelectorAll("#imagePanel .image-card[data-image-id]")].map(node => node.dataset.imageId || "").filter(id => id.startsWith("common-order-image-"));
      devAssert(JSON.stringify(chatCommonOrder) === JSON.stringify(["common-order-image-A", "common-order-image-B", "common-order-image-C"]) && JSON.stringify(panelCommonOrder) === JSON.stringify(["common-order-image-C", "common-order-image-B", "common-order-image-A"]), "common normal image requests render A-B-C in chat and newest-first C-B-A in the image panel", {
        chatCommonOrder,
        panelCommonOrder
      });
      const scrollFixture = document.querySelector(`#thread [data-message-id="fake-scroll-message-31"] .message-content`);
      if (scrollFixture) scrollFixture.style.minHeight = "1200px";
      const article = document.querySelector(`#thread [data-message-id="fake-scroll-message-10"]`);
      const assistantArticle = document.querySelector(`#thread [data-message-id="fake-scroll-message-11"]`);
      setSmokeScrollTop(Math.max(0, Math.floor(thread.scrollHeight / 3)));
      const scrollBeforeMessageUpdate = thread.scrollTop;
      updateMessage("fake-scroll-message-10", "Fake incrementally updated message.", {
        render: "message",
        save: false
      });
      devAssert(article === document.querySelector(`#thread [data-message-id="fake-scroll-message-10"]`) && thread.scrollTop === scrollBeforeMessageUpdate, "stream-style message updates keep the existing article DOM and preserve scroll position", {
        scrollBeforeMessageUpdate,
        scrollAfter: thread.scrollTop
      });
      const scrollBeforeVoiceChrome = thread.scrollTop;
      syncActiveVoiceMessageDom(null, "fake-scroll-message-11");
      devAssert(assistantArticle === document.querySelector(`#thread [data-message-id="fake-scroll-message-11"]`) && assistantArticle.classList.contains("voice-active") && !!assistantArticle.querySelector("[data-voice-stop-action]") && thread.scrollTop === scrollBeforeVoiceChrome, "voice start updates only the active message chrome without rebuilding or scrolling the transcript", {
        scrollBeforeVoiceChrome,
        scrollAfter: thread.scrollTop
      });
      syncActiveVoiceMessageDom("fake-scroll-message-11", null);
      devAssert(!assistantArticle.classList.contains("voice-active") && !assistantArticle.querySelector("[data-voice-stop-action]") && thread.scrollTop === scrollBeforeVoiceChrome, "voice completion removes only active message chrome without scrolling");
      app.busy = false;
      app.aiQueue = [];
      app.aiActive = {
        label: "fake background state check",
        logType: "state",
        streamedChars: 24,
        opts: {
          messageId: "fake-scroll-message-11",
          onStream: () => {}
        }
      };
      const scrollBeforeAiStatus = thread.scrollTop;
      syncThreadAiWorkingIndicator();
      syncMessageGenerationActions("fake-scroll-message-11");
      const liveAssistantArticle = document.querySelector(`#thread [data-message-id="fake-scroll-message-11"]`);
      devAssert(article === document.querySelector(`#thread [data-message-id="fake-scroll-message-10"]`) && thread.scrollTop === scrollBeforeAiStatus && !!liveAssistantArticle?.querySelector("[data-stop-generating-message]") && /fake background state check/i.test(thread.querySelector(":scope > .working-indicator")?.textContent || ""), "AI lifecycle status updates do not rebuild existing chat messages", {
        scrollBeforeAiStatus,
        scrollAfterAiStatus: thread.scrollTop,
        indicator: thread.querySelector(":scope > .working-indicator")?.outerHTML || ""
      });
      app.aiActive = null;
      syncMessageGenerationActions("fake-scroll-message-11");
      syncThreadAiWorkingIndicator();
      const finishedAssistantArticle = document.querySelector(`#thread [data-message-id="fake-scroll-message-11"]`);
      devAssert(!thread.querySelector(":scope > .working-indicator") && !finishedAssistantArticle?.querySelector("[data-stop-generating-message]"), "the in-place AI working and stop controls are removed after work finishes");
      app.stateSync = {
        ...app.stateSync,
        running: true,
        queued: false,
        status: "Updating scene",
        currentGroup: "scene",
        startMessageId: "fake-scroll-message-11"
      };
      renderThread("state indicator initial smoke");
      const stateArticleBefore = document.querySelector(`#thread [data-message-id="fake-scroll-message-11"]`);
      const stateIndicatorBefore = thread.querySelector(":scope > .state-sync-indicator");
      setSmokeScrollTop(310);
      const scrollBeforeStateProgress = thread.scrollTop;
      app.stateSync.status = "Updating characters";
      app.stateSync.currentGroup = "characters";
      renderThread("state indicator progress smoke");
      const stateArticleAfter = document.querySelector(`#thread [data-message-id="fake-scroll-message-11"]`);
      const stateIndicatorAfter = thread.querySelector(":scope > .state-sync-indicator");
      devAssert(stateArticleBefore === stateArticleAfter && stateIndicatorBefore === stateIndicatorAfter && /Updating characters/i.test(stateIndicatorAfter?.textContent || "") && scrollBeforeStateProgress > 0 && thread.scrollTop === scrollBeforeStateProgress, "state progress text updates in place without rebuilding messages or moving the viewport", {
        sameArticle: stateArticleBefore === stateArticleAfter,
        sameIndicator: stateIndicatorBefore === stateIndicatorAfter,
        indicator: stateIndicatorAfter?.outerHTML || "",
        scrollBeforeStateProgress,
        scrollTop: thread.scrollTop
      });
      app.stateSync.running = false;
      renderThread("state indicator removal smoke");
      devAssert(stateArticleAfter === document.querySelector(`#thread [data-message-id="fake-scroll-message-11"]`) && !thread.querySelector(":scope > .state-sync-indicator") && thread.scrollTop === scrollBeforeStateProgress, "finishing state progress removes only its indicator and preserves the viewport");
      setSmokeScrollTop(Math.max(0, Math.floor((thread.scrollHeight - thread.clientHeight) / 3)));
      const scrollBeforeImageLoad = thread.scrollTop;
      const testFrame = document.createElement("iframe");
      card.querySelector(".image-render").replaceChildren(testFrame);
      await waitForRenderedFrame();
      testFrame.dispatchEvent(new Event("load"));
      await waitForRenderedFrame();
      devAssert(thread.scrollHeight > thread.clientHeight && thread.scrollTop === scrollBeforeImageLoad, "an image load never pulls a reader who scrolled upward back to the bottom", {
        scrollBeforeImageLoad,
        scrollAfter: thread.scrollTop,
        scrollHeight: thread.scrollHeight,
        clientHeight: thread.clientHeight
      });
      setSmokeScrollTop(thread.scrollHeight);
      const scrollBeforeCompletedImage = thread.scrollTop;
      const originalCard = document.querySelector(`#thread .image-card[data-image-id="${cssEscape(imageDomId("fake-scroll-image"))}"]`);
      updateStoredImageHtml("fake-scroll-image", `<img src="${devSmokeOnePixelDataUrl()}" alt="Fake completed image">`, {
        pending: false
      });
      const updatedCard = document.querySelector(`#thread .image-card[data-image-id="${cssEscape(imageDomId("fake-scroll-image"))}"]`);
      devAssert(originalCard === updatedCard && !!updatedCard.querySelector(".image-render img") && thread.scrollTop === scrollBeforeCompletedImage, "finishing an image updates its existing card in place without changing scroll position", {
        card: updatedCard?.outerHTML,
        scrollBeforeCompletedImage,
        scrollAfterCompletedImage: thread.scrollTop
      });
      setSmokeScrollTop(250);
      app.newGameChatScrollToTop = false;
      app.existingGameChatScrollToBottom = true;
      renderThread("existing save one-shot scroll smoke");
      await waitForRenderedFrame();
      devAssert(thread.scrollHeight - thread.scrollTop - thread.clientHeight <= 2 && app.existingGameChatScrollToBottom === false, "loading an existing game scrolls the chat to the bottom exactly once", {
        scrollTop: thread.scrollTop,
        scrollHeight: thread.scrollHeight,
        existingGameChatScrollToBottom: app.existingGameChatScrollToBottom
      });
      setSmokeScrollTop(325);
      const scrollBeforeOrdinaryRender = thread.scrollTop;
      renderThread("ordinary render after existing save load");
      devAssert(Math.abs(thread.scrollTop - scrollBeforeOrdinaryRender) <= 1, "ordinary renders after the existing-save scroll preserve the reader position", {
        scrollBeforeOrdinaryRender,
        scrollTop: thread.scrollTop
      });
      setSmokeScrollTop(thread.scrollHeight);
      app.messages.push({
        id: "fake-scroll-message-bottom-append",
        role: "assistant",
        speaker: "Fake Speaker",
        text: `Bottom-pinned append. ${"More content. ".repeat(12)}`,
        at: new Date(Date.now() + 33000).toISOString()
      });
      renderThread("bottom-pinned message append smoke");
      await waitForRenderedFrame();
      devAssert(threadViewportIsAtBottom(thread), "adding a chat message keeps a reader at the bottom when they were already at the bottom", {
        scrollTop: thread.scrollTop,
        scrollHeight: thread.scrollHeight,
        clientHeight: thread.clientHeight
      });
      setSmokeScrollTop(Math.max(1, Math.floor(thread.scrollHeight / 3)));
      const scrollBeforeScrolledReaderAppend = thread.scrollTop;
      app.messages.push({
        id: "fake-scroll-message-scrolled-append",
        role: "assistant",
        speaker: "Fake Speaker",
        text: `Scrolled-reader append. ${"More content. ".repeat(12)}`,
        at: new Date(Date.now() + 34000).toISOString()
      });
      renderThread("scrolled-reader message append smoke");
      await waitForRenderedFrame();
      devAssert(Math.abs(thread.scrollTop - scrollBeforeScrolledReaderAppend) <= 1 && !threadViewportIsAtBottom(thread), "adding a chat message preserves position when the reader is above the bottom", {
        scrollBefore: scrollBeforeScrolledReaderAppend,
        scrollAfter: thread.scrollTop
      });
      devTestLog("Scenario complete: chat-image-scroll-stability-smoke");
    } finally {
      scheduleActiveGameSave = original.scheduleActiveGameSave;
      app.state = original.state;
      app.messages = original.messages;
      app.images = original.images;
      app.settings.showImagesInChat = original.showImagesInChat;
      app.settings.showAiStatusMessages = original.showAiStatusMessages;
      app.settings.reducedUi = original.reducedUi;
      app.aiActive = original.aiActive;
      app.aiQueue = original.aiQueue;
      app.busy = original.busy;
      app.stateSync = original.stateSync;
      app.newGameChatScrollToTop = original.newGameChatScrollToTop;
      app.existingGameChatScrollToBottom = original.existingGameChatScrollToBottom;
      if (thread) {
        thread.innerHTML = original.threadHtml;
        thread.style.height = original.threadStyleHeight;
        thread.style.maxHeight = original.threadStyleMaxHeight;
        thread.style.overflowY = original.threadStyleOverflowY;
        thread.scrollTop = original.threadScrollTop;
        activatePluginIframes(thread);
      }
      if (appRoot) {
        if (original.appRootStyle == null) appRoot.removeAttribute("style");else appRoot.setAttribute("style", original.appRootStyle);
      }
      assertExactMessageStorage();
    }
  }
  async function devRunRuntimePatchPersistenceMatrixSmokeTest() {
    devTestLog("Scenario start: runtime-patch-persistence-matrix-smoke");
    const saveSnapshot = devSaveLibrarySnapshotForSmoke();
    const smokeId = newSaveId("smoke-dirty-matrix");
    const expectedOnly = async (kind, recordId = "current") => {
      const keys = [...saveProjectionQueue.owners.keys()];
      const expected = runtimeDirtyKey(kind, recordId);
      devAssert(keys.length === 1 && keys[0] === expected, `mutation queues only normalized owner ${kind}/${recordId}; actual ${keys.join(", ") || "none"}`, {
        keys,
        expected
      });
      await flushRuntimeSaveProjections();
      devAssert(!saveProjectionQueue.owners.size && !saveProjectionQueue.collections.size, `normalized owner ${kind}/${recordId} commits before the next mutation`, {
        owners: [...saveProjectionQueue.owners.keys()],
        collections: [...saveProjectionQueue.collections.keys()],
        phase: saveProjectionQueue.phase
      });
    };
    try {
      devResetForLiveTest("runtime-patch-persistence-matrix-smoke");
      const state = clone(defaultState);
      state.meta = {
        ...clone(defaultState.meta || {}),
        setup_complete: true,
        story_source: {
          mode: "original",
          title: "Dirty Matrix Smoke"
        }
      };
      state.player = devSmokeRuntimeCharacter("Matrix Player", {
        gender: "male",
        role: "runtime persistence matrix tester"
      });
      state.characters = {
        "Matrix Ally": devSmokeRuntimeCharacter("Matrix Ally", {
          age: 30,
          gender: "female"
        })
      };
      const matrixNpc = devSmokeRuntimeCharacter("Matrix NPC", {
        age: 31,
        gender: "female",
        trust: 1,
        inventory: [{
          itemId: "matrix-field-note",
          item: "matrix field note"
        }]
      });
      matrixNpc.outfits.push({
        id: "field-kit",
        name: "Field Kit",
        clothing: {
          shirt: "reinforced smoke-test field jacket",
          pants: "reinforced smoke-test field trousers",
          feet: "reinforced smoke-test field boots"
        }
      });
      state.timed_events = {
        "matrix-event": {
          id: "matrix-event",
          status: "waiting",
          trigger: {
            immediately: true
          },
          applied_stage_ids: []
        }
      };
      state.story_shops = {
        "matrix-shop": {
          id: "matrix-shop",
          name: "Matrix Shop",
          npc_location_id: "matrix-square",
          unlocked: true
        }
      };
      state.npc_directory = {
        locations: {
          "matrix-square": {
            label: "Matrix Square",
            characters: {
              "Matrix NPC": {
                name: "Matrix NPC",
                age: 31,
                gender: "female",
                role: "witness",
                relationship: "neutral",
                inspected: true,
                full_character: matrixNpc
              }
            }
          }
        }
      };
      state.location = {
        ...clone(defaultState.location || {}),
        npc_location_id: "matrix-square",
        specific_place: "Matrix Square"
      };
      const defaultMapLocation = clone(Object.values(defaultState.world_map?.locations || {})[0] || {});
      state.world_map = {
        ...clone(defaultState.world_map || {}),
        current_location_id: "matrix-square",
        focus_location_id: "matrix-square",
        locations: {
          "matrix-square": {
            ...defaultMapLocation,
            id: "matrix-square",
            name: "Matrix Square"
          }
        }
      };
      state.scene = {
        ...clone(defaultState.scene || {}),
        party_members_present: ["Matrix Ally"],
        npcs_present: ["Matrix NPC"],
        image_characters: []
      };
      state.objectives = {
        active_id: "matrix-objective",
        focus_id: "",
        items: [devSmokeObjective("matrix-objective", "Matrix Objective", {
          status: "active",
          summary: "Exercise normalized record ownership.",
          ending_type: "freeplay",
          ending_message: "The persistence matrix continues in freeplay."
        })],
        progress_notes: {},
        pending_reward_choices: []
      };
      await createNewActiveSave("dirty matrix baseline", {
        saveId: smokeId,
        state
      });
      await loadSaveIntoRuntime(activeSaveId(), {
        showCompatibilityNotice: false
      });
      let reconstructedNpc = app.state.npc_directory.locations["matrix-square"]?.characters?.["Matrix NPC"]?.full_character;
      applyScopedNpcCharacterPatch(app.state, {
        characterName: "Matrix NPC",
        npcLocationId: "matrix-square",
        npcKey: "Matrix NPC",
        patch: {
          inventory: reconstructedNpc?.inventory || []
        }
      });
      reconstructedNpc = app.state.npc_directory.locations["matrix-square"]?.characters?.["Matrix NPC"]?.full_character;
      devAssert(reconstructedNpc?.inventory?.some(item => textSlot(item, "") === "matrix field note" || isPlainObject(item) && textSlot(item.item, "")), `NPC inventory reconstructs supported string/item records before structural persistence; actual=${JSON.stringify(reconstructedNpc?.inventory)}`, reconstructedNpc?.inventory);
      await flushRuntimeSaveProjections();
      saveProjectionQueue.owners.clear();
      const unchangedWorldMap = app.state.world_map;
      const targetedPatch = applyStatePatch(app.state, {
        scene: {
          summary: "targeted patch scene"
        }
      }, {
        currentState: app.state,
        targeted: true,
        source: "matrix smoke"
      });
      devAssert(targetedPatch !== app.state && targetedPatch.scene !== app.state.scene && targetedPatch.world_map === unchangedWorldMap && targetedPatch.__runtimePatchRoots.includes("scene"), "validated grouped patches clone only changed roots and retain structural sharing elsewhere", {
        roots: targetedPatch.__runtimePatchRoots
      });
      const loadedPlayerName = textSlot(app.state.player?.name, "Player");
      const playerThroughCharactersPatch = applyStatePatch(app.state, {
        characters: {
          [loadedPlayerName]: {
            role: "smoke player route"
          }
        }
      }, {
        currentState: app.state,
        targeted: true,
        source: "player-character smoke"
      });
      devAssert(playerThroughCharactersPatch.__runtimePatchRoots.includes("player") && !playerThroughCharactersPatch.__runtimePatchRoots.includes("characters") && playerThroughCharactersPatch.__runtimePatchCharacterKeys.length === 0, "player updates sent through characters stay owned by the player record", {
        roots: playerThroughCharactersPatch.__runtimePatchRoots,
        characterKeys: playerThroughCharactersPatch.__runtimePatchCharacterKeys
      });
      saveProjectionQueue.owners.clear();
      const worldMapPatch = applyStatePatch(app.state, {
        world_map: {
          current_location_id: "matrix-square",
          current_location: "Matrix Square",
          focus_location_id: "matrix-square"
        }
      }, {
        currentState: app.state,
        targeted: true,
        source: "map_npcs"
      });
      devAssert(worldMapPatch.__runtimePatchRoots.includes("world_map") && worldMapPatch.__runtimePatchLocationIds.length === 0, "targeted world-map control patches identify the bounded normalized map record", {
        roots: worldMapPatch.__runtimePatchRoots,
        locationIds: worldMapPatch.__runtimePatchLocationIds
      });
      app.state = worldMapPatch;
      {
        const queuedKeys = [...saveProjectionQueue.owners.keys()].sort();
        const expectedKeys = [runtimeDirtyKey("scene", "current"), runtimeDirtyKey("world-map", "current")].sort();
        devAssert(JSON.stringify(queuedKeys) === JSON.stringify(expectedKeys), "location-changing world-map patches queue the map and pruned scene owners", {
          queuedKeys,
          expectedKeys
        });
        await flushRuntimeSaveProjections();
      }
      const reconstructedWorldMap = await app.library.reconstructRuntimeSave(Number(activeSaveId()));
      devAssert(reconstructedWorldMap.state?.world_map?.current_location_id === "matrix-square" && reconstructedWorldMap.state?.world_map?.focus_location_id === "matrix-square", `grouped map/NPC state updates persist world-map location controls without an unowned root mutation; actual=${JSON.stringify(reconstructedWorldMap.state?.world_map)}`, reconstructedWorldMap.state?.world_map);
      saveProjectionQueue.owners.clear();
      const characterTargetedPatch = applyStatePatch(app.state, {
        party_members: {
          "Matrix Ally": {
            held_items: {
              right_hand: "itinerary folder"
            }
          }
        }
      }, {
        currentState: app.state,
        targeted: true,
        source: "character_body"
      });
      devAssert(characterTargetedPatch.__runtimePatchRoots.includes("characters") && characterTargetedPatch.__runtimePatchCharacterKeys.length === 1 && characterTargetedPatch.__runtimePatchCharacterKeys[0] === "Matrix Ally", "targeted character patches identify their normalized character record", {
        roots: characterTargetedPatch.__runtimePatchRoots,
        characterKeys: characterTargetedPatch.__runtimePatchCharacterKeys
      });
      app.state = characterTargetedPatch;
      devAssert(app.state.characters["Matrix Ally"]?.held_items?.right_hand === "itinerary folder", "grouped character-body patch applies the held-item update", app.state.characters["Matrix Ally"]?.held_items);
      await expectedOnly("character", "Matrix Ally");
      const groupedTargets = groupedStateWorkItems(app.state);
      devAssert(groupedTargets.some(item => item.groupId === "character_mind" && item.targetType === "npc" && item.npcLocationId === "matrix-square" && item.npcKey === "Matrix NPC") && !groupedTargets.some(item => item.targetType === "party" && !app.state.scene.party_members_present.includes(item.characterName)), "grouped state work targets present NPCs and excludes off-scene party members", groupedTargets);
      updatePlayerRuntime(player => {
        player.state_of_mind = "matrix";
      });
      await expectedOnly("player");
      updateSceneRuntime(scene => {
        scene.summary = "matrix scene";
      });
      await expectedOnly("scene");
      updateCharacterRuntime("Matrix Ally", character => {
        character.trust = 4;
      });
      await expectedOnly("character", "Matrix Ally");
      applyScopedNpcCharacterPatch(app.state, {
        characterName: "Matrix NPC",
        npcLocationId: "matrix-square",
        npcKey: "Matrix NPC",
        patch: {
          trust: 6,
          affection: 3
        }
      });
      await expectedOnly("npc", runtimeNpcRecordId("matrix-square", "Matrix NPC"));
      updateObjectiveRuntime("matrix-objective", (runtime, id) => {
        runtime.statusById[id] = "complete";
      });
      await expectedOnly("objective-runtime");
      updateRewardRuntime(runtime => {
        runtime.appliedInvocationIds["matrix-reward"] = {
          appliedAt: "now",
          sourceType: "smoke",
          sourceId: "matrix-reward-source"
        };
      }, "matrix-reward");
      await expectedOnly("reward-runtime");
      updateJobRuntime(runtime => {
        runtime.runtimeByJobId["matrix-job"] = {
          status: "active"
        };
      }, "matrix-job");
      await expectedOnly("job-runtime");
      updateInventoryRuntime(inventory => {
        inventory.coins = 9;
      });
      await expectedOnly("inventory");
      const timedEventStarted = startReadyTimedEvents(app.state);
      devAssert(timedEventStarted && app.state.timed_events["matrix-event"]?.status === "active", "starting a timed event mutates only its keyed runtime record", app.state.timed_events["matrix-event"]);
      await expectedOnly("timed-event", "matrix-event");
      updateTimedEventRuntime("matrix-event", event => {
        event.status = "complete";
      });
      await expectedOnly("timed-event", "matrix-event");
      updateShopRuntime("matrix-shop", shop => {
        shop.unlocked = false;
      });
      await expectedOnly("shop", "matrix-shop");
      updateStoryRulesRuntime(runtime => {
        runtime.added.push("Matrix runtime rule");
      });
      await expectedOnly("story-rules-runtime");
      const observationFailureCount = app.mutationObservation.failures.length;
      const observation = beginDomainMutation("matrix direct proxy observation", [{
        kind: "scene",
        recordId: "current"
      }]);
      app.state.scene.image_action = "matrix action";
      finishDomainMutation(observation);
      devAssert(app.mutationObservation.failures.length === observationFailureCount && saveProjectionQueue.owners.has(runtimeDirtyKey("scene", "current")), "proxy-observed direct mutation queues the expected normalized owner during observation mode", app.mutationObservation.completed.at(-1));
      await expectedOnly("scene");
      const message = addMessage("assistant", "Matrix message.", "Narrator");
      const messageId = String(message?.id ?? message?.entryId ?? "");
      devAssert(saveProjectionQueue.collections.get(`messages\u001f${messageId}`)?.operation === "put", "message mutation has independent normalized collection ownership", {
        messageId
      });
      await flushRuntimeSaveProjections();
      const normalizedSaveId = Number(activeSaveId());
      const [loaded, loadedRecords] = await Promise.all([app.library.reconstructRuntimeSave(normalizedSaveId), app.persistence.loadSave(normalizedSaveId, 200)]);
      const matrixRoundTripChecks = {
        player: loaded.state.player.state_of_mind === "matrix",
        scene: loaded.state.scene.summary === "matrix scene",
        party: loaded.state.characters["Matrix Ally"]?.trust === 4,
        npc: loaded.state.npc_directory.locations["matrix-square"]?.characters?.["Matrix NPC"]?.full_character?.trust === 3,
        inventory: loaded.state.story_inventory.coins === 9,
        timedEvent: loaded.state.timed_events["matrix-event"]?.status === "complete",
        shop: loaded.state.story_shops["matrix-shop"]?.unlocked === false,
        message: (loadedRecords.recordsByStore?.messages || []).some(entry => String(entry.messageId) === messageId)
      };
      devAssert(Object.values(matrixRoundTripChecks).every(Boolean) && loaded.state.player.state_of_mind === "matrix" && loaded.state.scene.summary === "matrix scene" && loaded.state.characters["Matrix Ally"]?.trust === 4 && loaded.state.npc_directory.locations["matrix-square"]?.characters?.["Matrix NPC"]?.full_character?.trust === 3 && loaded.state.story_inventory.coins === 9 && loaded.state.timed_events["matrix-event"]?.status === "complete" && loaded.state.story_shops["matrix-shop"]?.unlocked === false && (loadedRecords.recordsByStore?.messages || []).some(entry => String(entry.messageId) === messageId), `normalized mutation matrix round-trips through the new persistence model; failed checks: ${Object.entries(matrixRoundTripChecks).filter(([, passed]) => !passed).map(([name]) => name).join(", ") || "legacy composite only"}; npc trust ${loaded.state.npc_directory.locations["matrix-square"]?.characters?.["Matrix NPC"]?.full_character?.trust ?? "missing"}; shop unlocked ${String(loaded.state.story_shops["matrix-shop"]?.unlocked)}; message ids ${(loadedRecords.recordsByStore?.messages || []).map(entry => entry.messageId).join(", ") || "none"}; expected ${messageId}`, {
        loadedState: loaded.state,
        messageId,
        matrixRoundTripChecks
      });
      const npcRows = loaded.recordsByStore.npcShells || [];
      devAssert(npcRows.some(row => row.characterId === "smoke-character-matrix-npc"), "NPC persistence stores the NPC as an independently keyed normalized record", {
        npcRows
      });
      devTestLog("Scenario complete: runtime-patch-persistence-matrix-smoke");
    } finally {
      await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
    }
  }
  async function devRunGuidedObjectiveEditorMatrixSmokeTest() {
    devTestLog("Scenario start: guided-objective-editor-matrix-smoke");
    devResetForLiveTest("guided-objective-editor-matrix-smoke");
    const draft = devSmokeStoryRecord({
      id: "guided-objective-editor-matrix",
      title: "Guided Objective Matrix",
      active_id: "opening",
      objectives: [{
        id: "opening",
        title: "Open the Door",
        type: "story",
        status: "active",
        summary: "A sealed door blocks the player.",
        while_active_guidance: "Keep the fake passage scene focused on opening the sealed door.",
        completion_control: "player",
        completion_criteria: "Open the sealed door.",
        next_objectives: [{
          id: "opening-output",
          objective_id: "transition",
          target_input_group_id: "transition-input",
          requirements: [],
          completion_instruction: "Show the door opening.",
          rewards: []
        }]
      }, {
        id: "transition",
        title: "Apply the Passage",
        type: "story",
        status: "hidden",
        while_active_guidance: "Apply the fake deterministic passage transition without an AI call.",
        completion_control: "reward_only",
        requirement_check_only: true,
        completion_requirements: [{
          path: "story_inventory.door_open",
          op: "==",
          value: true
        }],
        next_objectives: [{
          id: "transition-output",
          objective_id: "ending",
          target_input_group_id: "ending-input",
          fallback: true,
          requirements: [],
          completion_instruction: "Carry the player through the doorway.",
          rewards: [{
            type: "add_story_rule",
            rule_id: "sealed-door-open",
            text: "The sealed door is open."
          }]
        }]
      }, {
        id: "ending",
        title: "Finish the Passage",
        type: "story",
        status: "hidden",
        summary: "The passage reaches its conclusion.",
        while_active_guidance: "Bring the fake passage scene to its authored conclusion.",
        completion_control: "ai",
        completion_criteria: "Finish the immediate passage scene.",
        next_objectives: [{
          id: "ending-output",
          completion_instruction: "Finish the immediate passage scene.",
          rewards: [],
          ending_type: "ending",
          ending_message: "The passage is complete."
        }]
      }]
    });
    draft.editor_data ||= {};
    draft.editor_data.story_tree ||= {};
    draft.editor_data.story_tree.output_modes = {
      opening: "one",
      transition: "multiple",
      ending: "one"
    };
    const originalBuilder = app.storyBuilder;
    try {
      app.storyBuilder = {
        templateId: draft.id,
        draft,
        selectedObjectiveId: "opening",
        dirty: false
      };
      const checks = storyBuilderValidationChecks(draft);
      const objectiveIssues = checks.filter(check => !check.ok && check.objectiveId);
      devAssert(!objectiveIssues.length, "guided objective matrix validates without legacy prerequisite fields", objectiveIssues);
      const externalEntryDraft = clone(draft);
      const externalObjective = (id, title) => ({
        id,
        title,
        type: "side",
        status: "hidden",
        summary: `${title} is activated outside the objective graph.`,
        while_active_guidance: `Resolve ${title} after its explicit external activation.`,
        completion_control: "player",
        completion_criteria: `Complete ${title}.`,
        next_objectives: [{
          id: `${id}-ending`,
          completion_instruction: `Complete ${title}.`,
          rewards: [],
          ending_type: "freeplay",
          ending_message: `${title} is complete.`
        }]
      });
      externalEntryDraft.state.objectives.items.push(externalObjective("reward-started", "Reward Started"), externalObjective("timed-started", "Timed Started"), externalObjective("purchase-started", "Purchase Started"), externalObjective("timeline-started", "Timeline Started"), externalObjective("externally-completed", "Externally Completed"), externalObjective("true-orphan", "True Orphan"));
      externalEntryDraft.state.objectives.items[0].rewards = [{
        type: "start_objective",
        objective_id: "reward-started"
      }];
      externalEntryDraft.state.timed_events = {
        "external-entry-event": {
          stages: [{
            rewards: [{
              type: "start_objective",
              objective_id: "timed-started"
            }]
          }]
        }
      };
      externalEntryDraft.state.future_cast = {
        items: {
          "external-entry-character": {
            on_purchase_objective: "purchase-started"
          }
        }
      };
      externalEntryDraft.state.story_pacing = {
        timeline: {
          "external-entry-timeline": {
            accept: {
              objective_id: "timeline-started"
            }
          }
        }
      };
      externalEntryDraft.state.reward_bundles = {
        "external-completion-bundle": [{
          type: "complete_objective",
          objective_id: "externally-completed"
        }]
      };
      const externalEntryErrors = objectiveTransitionContractValidationErrors(externalEntryDraft.state.objectives.items, externalEntryDraft).filter(error => error.code === "unreachable");
      devAssert(externalEntryErrors.length === 1 && /true-orphan/.test(externalEntryErrors[0].message) && !externalEntryErrors.some(error => /reward-started|timed-started|purchase-started|timeline-started|externally-completed/.test(error.message)), "objective reachability accepts supported external activation while rejecting a true orphan", externalEntryErrors);
      const missingGuidanceDraft = clone(draft);
      delete missingGuidanceDraft.state.objectives.items[0].while_active_guidance;
      const missingGuidanceValidation = validateStoryDefinition(missingGuidanceDraft);
      missingGuidanceDraft.state.objectives.items[0].while_active_guidance = "   ";
      const blankGuidanceValidation = validateStoryDefinition(missingGuidanceDraft);
      const builderMissingGuidance = storyBuilderValidationChecks(missingGuidanceDraft);
      devAssert(missingGuidanceValidation.errors.some(error => error.path === "state.objectives.items.0.while_active_guidance" && error.code === "required") && blankGuidanceValidation.errors.some(error => error.path === "state.objectives.items.0.while_active_guidance" && error.code === "required") && builderMissingGuidance.some(check => check.ok === false && check.objectiveId === "opening" && check.field === "while_active_guidance"), "story import and builder validation reject missing or blank while-active guidance", {
        importMissing: missingGuidanceValidation.errors,
        importBlank: blankGuidanceValidation.errors,
        builder: builderMissingGuidance.filter(check => check.ok === false)
      });
      const edges = storyBuilderRawGraphEdges(storyBuilderObjectiveList(draft));
      devAssert(edges.filter(edge => edge.kind === "next").length === 2 && edges.filter(edge => edge.kind === "terminal").length === 1 && edges.every(edge => edge.kind !== "requires"), "guided graph uses output links only, including output endings", edges);
      const transition = storyBuilderObjectiveById("transition", draft);
      devAssert(storyBuilderObjectiveAutoComplete(transition) && storyBuilderObjectiveRequirementCheckOnly(transition), "requirement-check-only is represented as AI auto-complete without an AI call", transition);
      const beforeFinalizeMode = storyBuilderObjectiveOutputMode(transition, draft);
      storyBuilderFinalizeObjectiveStructure(draft);
      devAssert(beforeFinalizeMode === "multiple" && storyBuilderObjectiveOutputMode(transition, draft) === "one", "explicit finalization changes Multiple with one output to One");
      const validationHtml = renderStoryBuilderValidationList([{
        ok: false,
        label: "Opening needs attention",
        objectiveId: "opening",
        field: "title"
      }]);
      devAssert(/storyBuilderOpenValidationIssue/.test(validationHtml), "validation issues are navigable buttons", validationHtml);
    } finally {
      app.storyBuilder = originalBuilder;
    }
    devTestLog("Scenario complete: guided-objective-editor-matrix-smoke");
  }
  async function devRunObjectiveOutputRuntimeSmokeTest() {
    devTestLog("Scenario start: objective-output-runtime-smoke");
    devResetForLiveTest("objective-output-runtime-smoke");
    const originalState = app.state;
    const originalDefinition = app.storyDefinition;
    const originalRuntime = app.objectiveRuntime;
    const originalLookup = app.objectiveRuntimeLookup;
    const originalRewardRuntime = app.rewardRuntime;
    const originalStoryRulesRuntime = app.storyRulesRuntime;
    const originalRuntimeStateReference = app.runtimeStateReference;
    let state = repairAiGeneratedState({
      ...clone(defaultState),
      story_inventory: {
        route: "first",
        permit: false
      },
      world_map: {
        current_location_id: "start",
        focus_location_id: "start",
        travel_history: ["start"],
        locations: {
          start: {
            id: "start",
            name: "Start",
            parent_id: "",
            npcs: []
          },
          destination: {
            id: "destination",
            name: "Destination",
            parent_id: "",
            npcs: []
          }
        }
      },
      objectives: {
        active_id: "route",
        focus_id: "",
        items: [{
          id: "route",
          title: "Choose the Route",
          status: "active",
          type: "story",
          summary: "Choose a valid route.",
          completion_control: "player",
          completion_criteria: "Choose the route.",
          next_objectives: [{
            id: "first-output",
            objective_id: "gated",
            target_input_group_id: "gated-input",
            requirements: [{
              path: "story_inventory.route",
              op: "==",
              value: "first"
            }],
            completion_instruction: "Use the first route.",
            travel_location_id: "destination",
            rewards: []
          }, {
            id: "fallback-output",
            objective_id: "fallback",
            target_input_group_id: "fallback-input",
            fallback: true,
            requirements: [],
            completion_instruction: "Use the fallback route.",
            rewards: []
          }],
          ending_type: "freeplay"
        }, {
          id: "gated",
          title: "Present the Permit",
          status: "hidden",
          type: "story",
          summary: "A permit is required.",
          completion_control: "player",
          completion_criteria: "Present the permit.",
          completion_requirements: [{
            path: "story_inventory.permit",
            op: "==",
            value: true
          }],
          next_objectives: [{
            id: "gated-ending",
            completion_instruction: "Present the permit.",
            rewards: [],
            ending_type: "freeplay",
            ending_message: "Freeplay begins."
          }]
        }, {
          id: "fallback",
          title: "Take the Other Road",
          status: "hidden",
          type: "story",
          summary: "The other road remains.",
          completion_control: "player",
          completion_criteria: "Take the other road.",
          next_objectives: [{
            id: "fallback-ending",
            completion_instruction: "Take the other road.",
            rewards: [],
            ending_type: "freeplay",
            ending_message: "Freeplay begins."
          }]
        }]
      }
    });
    try {
      const destinationId = Object.values(state.world_map?.locations || {}).find(location => String(location?.name || "") === "Destination")?.id || "destination";
      state.objectives.items[0].next_objectives[0].travel_location_id = destinationId;
      app.state = state;
      state = app.state;
      installImmutableStoryDefinitionFromState(state, {
        revisionId: "objective-output-runtime-smoke-definition"
      });
      app.objectiveRuntimeLookup = null;
      const route = objectiveRuntimeLookup(state).byId.get("route");
      const match = matchingObjectiveNextTransition(route, state);
      devAssert(match?.option?.output_id === "first-output", "deterministic outputs use the first eligible output", match);
      const completed = completeCurrentObjective(state, "route");
      devAssert(completed?.selected_output_id === "first-output" && state.world_map.current_location_id === destinationId, "selected output and travel are applied together", {
        completed,
        worldMap: state.world_map
      });
      const gated = objectiveRuntimeLookup(state).byId.get("gated");
      const gatedEligibility = {
        status: effectiveObjectiveStatus(gated, state),
        complete: objectiveIsComplete(gated, state),
        prerequisitesMet: objectivePrerequisitesMet(gated, state),
        requirementsMet: objectiveCompletionRequirementsMet(gated, state),
        shown: objectiveCanBeShown(gated, state),
        selectable: objectiveCanBeSelected(gated, state),
        requirementsText: objectiveCompletionRequirementsText(gated, state),
        selectedOutput: app.objectiveRuntime?.selectedOutputById?.route || "",
        activeId: state.objectives.active_id
      };
      devAssert(gatedEligibility.shown && !gatedEligibility.selectable && /Completion requirements not met/.test(gatedEligibility.requirementsText), "unmet completion requirements leave a node visible but unavailable", gatedEligibility);
      state.story_inventory.permit = true;
      devAssert(objectiveCanBeSelected(gated, state), "state changes make a completion-gated objective selectable");
      app.objectiveRuntime.activationAiCheckAttemptedById.gated = true;
      setObjectiveRuntimeStatus(state, gated, "complete");
      setObjectiveRuntimeStatus(state, gated, "active");
      devAssert(!app.objectiveRuntime.activationAiCheckAttemptedById.gated, "a new activation clears the once-per-activation AI-check marker");
    } finally {
      app.state = originalState;
      app.storyDefinition = originalDefinition;
      app.objectiveRuntime = originalRuntime;
      app.objectiveRuntimeLookup = originalLookup;
      app.rewardRuntime = originalRewardRuntime;
      app.storyRulesRuntime = originalStoryRulesRuntime;
      app.runtimeStateReference = originalRuntimeStateReference;
    }
    devTestLog("Scenario complete: objective-output-runtime-smoke");
  }
  async function devRunObjectiveRequirementRoutingSmokeTest() {
    devTestLog("Scenario start: objective-requirement-routing-smoke");
    devResetForLiveTest("objective-requirement-routing-smoke");
    const originalState = app.state;
    const originalDefinition = app.storyDefinition;
    const originalRuntime = app.objectiveRuntime;
    const originalLookup = app.objectiveRuntimeLookup;
    const originalRewardRuntime = app.rewardRuntime;
    const originalStoryRulesRuntime = app.storyRulesRuntime;
    const originalRuntimeStateReference = app.runtimeStateReference;
    const originalAiText = aiText;
    const objectives = [{
      id: "choose-first-lead",
      title: "Choose the First Lead",
      type: "story",
      status: "active",
      summary: "Choose which lead to investigate first.",
      while_active_guidance: "Wait for the player to choose one fake lead.",
      completion_control: "choice",
      choices: [{
        id: "choose-worker",
        title: "Speak With the Worker",
        requirements: [{
          path: "world_flags.permit_level",
          op: ">=",
          value: 1
        }],
        rewards: [{
          type: "set_state_field",
          field_path: ["world_flags", "selected_lead"],
          value: "worker"
        }],
        next_objective_id: "route-first-lead",
        target_input_group_id: "router-from-any-choice",
        completion_instruction: "Continue directly into the selected worker route."
      }, {
        id: "choose-security",
        title: "Question Security",
        requirements: [{
          type: "character_alive",
          target: "Player"
        }],
        rewards: [{
          type: "add_story_rule",
          rule_id: "security-lead-selected",
          text: "The security lead was selected."
        }],
        next_objective_id: "route-first-lead",
        target_input_group_id: "router-from-any-choice"
      }, {
        id: "choose-records",
        title: "Review the Records",
        rewards: [{
          type: "set_state_field",
          field_path: ["world_flags", "selected_lead"],
          value: "records"
        }],
        next_objective_id: "route-first-lead",
        target_input_group_id: "router-from-any-choice"
      }]
    }, {
      id: "route-first-lead",
      title: "Route the First Lead",
      type: "reward_only",
      status: "hidden",
      summary: "Route the selected lead deterministically.",
      while_active_guidance: "Resolve the fake selected lead without an AI call.",
      completion_control: "reward_only",
      requirement_check_only: true,
      next_objectives: [{
        id: "route-worker-output",
        objective_id: "worker-branch",
        target_input_group_id: "worker-branch-input",
        requirements: [{
          path: "world_flags.selected_lead",
          op: "==",
          value: "worker"
        }],
        rewards: [{
          type: "add_story_rule",
          rule_id: "worker-route-resolved",
          text: "The worker route resolved."
        }]
      }, {
        id: "route-security-output",
        objective_id: "security-branch",
        target_input_group_id: "security-branch-input",
        requirements: [{
          type: "story_rule",
          id: "security-lead-selected"
        }],
        rewards: [{
          type: "add_story_rule",
          rule_id: "security-route-resolved",
          text: "The security route resolved."
        }]
      }, {
        id: "route-records-output",
        objective_id: "records-branch",
        target_input_group_id: "records-branch-input",
        requirements: [{
          type: "known_fact",
          target: "Player",
          id: "records-available"
        }],
        rewards: [{
          type: "add_story_rule",
          rule_id: "records-route-resolved",
          text: "The records route resolved."
        }]
      }]
    }, ...["worker", "security", "records"].map(route => ({
      id: `${route}-branch`,
      title: `${route} Branch`,
      type: "story",
      status: "hidden",
      summary: `Continue the fake ${route} branch.`,
      while_active_guidance: `Continue only the fake ${route} branch.`,
      completion_control: "player",
      completion_criteria: `Complete the fake ${route} branch.`,
      completion_requirements: [{
        type: "objective_complete",
        id: "route-first-lead"
      }],
      next_objectives: [{
        id: `fake-${route}-ending`,
        completion_instruction: `Complete the fake ${route} branch.`,
        rewards: [],
        ending_type: "freeplay",
        ending_message: "The fake route is complete."
      }]
    }))];
    const story = devSmokeStoryRecord({
      id: "objective-requirement-routing",
      title: "Objective Requirement Routing",
      active_id: "choose-first-lead",
      objectives
    });
    story.state.world_flags.permit_level = 1;
    story.state.world_flags.selected_lead = "";
    story.state.player.starting_known_facts = ["records-available"];
    const validation = validateStoryDefinition(story);
    devAssert(validation.ok, `choice-to-requirement-router story validates: ${validation.errors.map(error => `${error.path}: ${error.message}`).join(" | ")}`, validation);
    const normalizedDirectChoiceStory = storyTemplateRecordFromPayload(storyExportPayloadFromDefinition(story));
    const normalizedDirectChoices = normalizedDirectChoiceStory.state.objectives.items[0].choices;
    devAssert(normalizedDirectChoices.length === 3 && normalizedDirectChoices.every(choice => choice.next_objective_id === "route-first-lead" && choice.target_input_group_id === "router-from-any-choice") && normalizedDirectChoices[0].completion_instruction === "Continue directly into the selected worker route.", "story import preserves same-source OR alternatives and exact output metadata", {
      normalizedDirectChoices
    });
    const workerPreparedParentOutputs = await storyImportWorkerRequest("prepare-story-import-payload", {
      payloads: [storyExportPayloadFromDefinition(story)]
    });
    const workerParentOutputFailures = workerPreparedParentOutputs.filter(item => item?.error);
    const workerParentOutputTokens = workerPreparedParentOutputs.map(item => item?.record?.token).filter(Boolean);
    if (workerParentOutputTokens.length) await storyImportWorkerRequest("discard-story-import", {
      tokens: workerParentOutputTokens
    });
    devAssert(workerPreparedParentOutputs.length === 1 && workerParentOutputFailures.length === 0 && workerParentOutputTokens.length === 1, "story import worker preserves exact direct choice targets", {
      workerPreparedParentOutputs
    });
    let aiCalls = 0;
    aiText = async () => {
      aiCalls++;
      throw new Error("Requirement-only routing must not make an AI call.");
    };
    try {
      const groupedInputState = {
        objectives: {
          items: [{
            id: "group-source-a",
            completion_control: "player",
            status: "complete",
            selected_output_id: "group-source-a-output",
            next_objectives: [{
              id: "group-source-a-output",
              objective_id: "group-target",
              target_input_group_id: "group-a-and-b"
            }]
          }, {
            id: "group-source-b",
            completion_control: "player",
            status: "hidden",
            selected_output_id: "group-source-b-output",
            next_objectives: [{
              id: "group-source-b-output",
              objective_id: "group-target",
              target_input_group_id: "group-a-and-b"
            }]
          }, {
            id: "group-source-c",
            completion_control: "choice",
            status: "complete",
            selected_output_id: "group-source-c-second",
            choices: [{
              id: "group-source-c-first",
              next_objective_id: "group-target",
              target_input_group_id: "group-c-alone"
            }, {
              id: "group-source-c-second",
              next_objective_id: "group-target",
              target_input_group_id: "group-c-alone"
            }]
          }, {
            id: "group-target",
            completion_control: "player",
            status: "hidden"
          }]
        }
      };
      const groupedTarget = groupedInputState.objectives.items[3];
      devAssert(objectivePrerequisitesMet(groupedTarget, groupedInputState), "an OR input group unlocks without completing sources from another input group", groupedInputState);
      groupedInputState.objectives.items[2].status = "hidden";
      app.objectiveRuntimeLookup = null;
      devAssert(!objectivePrerequisitesMet(groupedTarget, groupedInputState), "an incomplete AND input group does not unlock its target", groupedInputState);
      groupedInputState.objectives.items[1].status = "complete";
      app.objectiveRuntimeLookup = null;
      devAssert(objectivePrerequisitesMet(groupedTarget, groupedInputState), "every distinct source in one input group is required", groupedInputState);
      groupedInputState.objectives.items[0].selected_output_id = "different-output";
      app.objectiveRuntimeLookup = null;
      devAssert(!objectivePrerequisitesMet(groupedTarget, groupedInputState), "a completed source with a different selected output does not satisfy the input group", groupedInputState);
      for (const [choiceId, expectedBranch] of [["choose-worker", "worker-branch"], ["choose-security", "security-branch"], ["choose-records", "records-branch"]]) {
        app.state = repairAiGeneratedState(clone(story.state));
        await devCompileCurrentStoryFixture(`objective-requirement-routing-${choiceId}`);
        reconcileStoryRuntimeState(app.state, `objective requirement route ${choiceId}`);
        app.state.player.known_facts = clone(story.state.player.starting_known_facts);
        const result = completeDirectObjectiveChoice(choiceId);
        const branch = objectiveRuntimeLookup(app.state).byId.get(expectedBranch);
        const routeDetails = {
          choiceId,
          result,
          activeId: app.state.objectives.active_id,
          expectedBranch,
          branchStatus: effectiveObjectiveStatus(branch, app.state),
          branchSelectable: objectiveCanBeSelected(branch, app.state),
          objectives: app.state.objectives,
          storyInventory: app.state.story_inventory,
          worldFlags: app.state.world_flags,
          storyRules: app.state.story_rules
        };
        devAssert(!!result?.completed && objectiveIsComplete(objectiveRuntimeLookup(app.state).byId.get("choose-first-lead"), app.state) && objectiveIsComplete(objectiveRuntimeLookup(app.state).byId.get("route-first-lead"), app.state) && app.state.objectives.active_id === expectedBranch && effectiveObjectiveStatus(branch, app.state) === "active" && objectiveCanBeSelected(branch, app.state) && app.state.objectives.no_current !== true, `choice reward routes through requirements to ${expectedBranch}: ${JSON.stringify(routeDetails)}`, routeDetails);
      }
      devAssert(aiCalls === 0, "requirement-only routers complete every branch without AI", {
        aiCalls
      });
      const invalidRequirements = clone(story);
      invalidRequirements.state.objectives.items[0].completion_requirements = {
        path: "story_inventory.permit_level",
        op: ">=",
        value: 1
      };
      invalidRequirements.state.objectives.items[0].choices[0].requirements = [{
        type: "unsupported_requirement",
        target: "Player"
      }];
      invalidRequirements.state.objectives.items[1].next_objectives[0].requirements = [{
        type: "objective_complete",
        id: "missing-objective"
      }];
      const invalidRequirementErrors = objectiveRequirementValidationErrors(invalidRequirements.state.objectives.items);
      devAssert(invalidRequirementErrors.some(error => error.code === "type") && invalidRequirementErrors.some(error => error.code === "value" && /unsupported objective requirement type/i.test(error.message)) && invalidRequirementErrors.some(error => error.code === "reference" && /missing-objective/.test(error.message)), "completion, choice, and output requirement validation reject malformed definitions", invalidRequirementErrors);
      const targetlessChoice = clone(story.state.objectives.items[0]);
      targetlessChoice.choices.forEach(choice => {
        delete choice.next_objective_id;
        delete choice.target_input_group_id;
      });
      const targetlessErrors = objectiveChoiceValidationErrors([targetlessChoice]);
      devAssert(targetlessErrors.some(error => ["routing", "required"].includes(error.code) && /(next_objective_id|target_input_group_id|nonterminal choice objective)/i.test(`${error.path} ${error.message}`)), "import validation rejects a targetless nonterminal choice", targetlessErrors);
      app.state = repairAiGeneratedState(clone(story.state));
      app.state.objectives.active_id = "route-first-lead";
      app.state.objectives.items.find(objective => objective.id === "choose-first-lead").status = "complete";
      app.state.objectives.items.find(objective => objective.id === "route-first-lead").status = "active";
      app.state.story_inventory.selected_lead = "no-match";
      app.state.player.known_facts = [];
      app.state.story_rules = [];
      await devCompileCurrentStoryFixture("objective-requirement-routing-no-match");
      reconcileStoryRuntimeState(app.state, "objective requirement route no match");
      const beforeNoMatch = objectiveDebugStateProjection(app.state);
      let noMatchError = null;
      try {
        completeCurrentObjective(app.state, "route-first-lead");
      } catch (error) {
        noMatchError = error;
      }
      devAssert(/has no eligible output/i.test(String(noMatchError?.message || "")) && effectiveObjectiveStatus(objectiveRuntimeLookup(app.state).byId.get("route-first-lead"), app.state) === "active" && app.state.objectives.active_id === "route-first-lead" && app.state.objectives.no_current !== true && JSON.stringify(beforeNoMatch) === JSON.stringify(objectiveDebugStateProjection(app.state)), "an unmatched requirement router fails before mutating objective runtime", {
        error: String(noMatchError?.message || ""),
        before: beforeNoMatch,
        after: objectiveDebugStateProjection(app.state)
      });
      const transactionalNoMatchStory = clone(story);
      const transactionalChoice = transactionalNoMatchStory.state.objectives.items[0];
      transactionalChoice.choices = [{
        id: "choose-unmatched-marker",
        title: "Choose an Unmatched Marker",
        requirements: [],
        rewards: [{
          type: "set_state_field",
          field_path: ["story_inventory", "selected_lead"],
          value: "unmatched"
        }],
        next_objective_id: "route-first-lead",
        target_input_group_id: "router-from-unmatched-choice",
        completion_instruction: "Continue into the deterministic route check."
      }];
      transactionalChoice.next_objectives = [{
        id: "matched-only-output",
        objective_id: "worker-branch",
        requirements: [{
          path: "story_inventory.selected_lead",
          op: "==",
          value: "matched"
        }]
      }];
      const transactionalNoMatchValidation = validateStoryDefinition(transactionalNoMatchStory);
      devAssert(transactionalNoMatchValidation.ok, `a choice with requirement-routed outputs validates before runtime state is known: ${transactionalNoMatchValidation.errors.map(error => `${error.path}: ${error.message}`).join(" | ")}`, transactionalNoMatchValidation);
      app.state = repairAiGeneratedState(clone(transactionalNoMatchStory.state));
      await devCompileCurrentStoryFixture("objective-requirement-choice-transaction-rollback");
      reconcileStoryRuntimeState(app.state, "objective requirement choice transaction rollback");
      const beforeChoiceNoMatch = clone({
        selectedLead: app.state.story_inventory.selected_lead ?? null,
        appliedRewards: clone(app.rewardRuntime?.appliedInvocationIds || {}),
        objectiveRuntime: objectiveDebugStateProjection(app.state)
      });
      let choiceNoMatchError = null;
      try {
        completeDirectObjectiveChoice("choose-unmatched-marker", {
          reportFailure: false
        });
      } catch (error) {
        choiceNoMatchError = error;
      }
      const afterChoiceNoMatch = {
        selectedLead: app.state.story_inventory.selected_lead ?? null,
        appliedRewards: clone(app.rewardRuntime?.appliedInvocationIds || {}),
        objectiveRuntime: objectiveDebugStateProjection(app.state)
      };
      devAssert(/has no eligible output/i.test(String(choiceNoMatchError?.message || "")) && JSON.stringify(beforeChoiceNoMatch) === JSON.stringify(afterChoiceNoMatch), `a choice whose reward still matches no output rolls back rewards and objective runtime atomically: ${JSON.stringify({
        error: String(choiceNoMatchError?.message || ""),
        before: beforeChoiceNoMatch,
        after: afterChoiceNoMatch
      })}`, {
        error: String(choiceNoMatchError?.message || ""),
        before: beforeChoiceNoMatch,
        after: afterChoiceNoMatch
      });
    } finally {
      aiText = originalAiText;
      app.state = originalState;
      app.storyDefinition = originalDefinition;
      app.objectiveRuntime = originalRuntime;
      app.objectiveRuntimeLookup = originalLookup;
      app.rewardRuntime = originalRewardRuntime;
      app.storyRulesRuntime = originalStoryRulesRuntime;
      app.runtimeStateReference = originalRuntimeStateReference;
    }
    devTestLog("Scenario complete: objective-requirement-routing-smoke");
  }
  async function devRunReusableRewardBuilderSmokeTest() {
    devTestLog("Scenario start: reusable-reward-builder-smoke");
    devResetForLiveTest("reusable-reward-builder-smoke");
    const draft = devSmokeStoryRecord({
      id: "reusable-reward-builder",
      title: "Reusable Reward Builder"
    });
    draft.state.reward_bundles = {
      first_bundle: [{
        type: "add_story_rule",
        rule_id: "first-bundle-rule",
        text: "First bundle rule"
      }],
      second_bundle: [{
        type: "add_story_rule",
        rule_id: "second-bundle-rule",
        text: "Second bundle rule"
      }]
    };
    draft.state.reward_templates = {
      relationship_template: {
        parameters: {
          target: {
            type: "character_id"
          },
          destination: {
            type: "path"
          }
        },
        rewards: [{
          type: "set_state_field",
          character_id: {
            parameter: "target"
          },
          field_path: {
            parameter: "destination"
          },
          value: true
        }]
      }
    };
    draft.state.objectives.items[0].rewards = [{
      type: "apply_reward_bundle",
      bundle_id: "first_bundle"
    }, {
      type: "apply_reward_template",
      template_id: "relationship_template",
      arguments: {
        target: draft.state.player.id,
        destination: ["story_inventory", "template_result"]
      }
    }];
    const originalBuilder = app.storyBuilder;
    try {
      app.storyBuilder = {
        draft,
        selectedObjectiveId: draft.state.objectives.items[0].id,
        dirty: false
      };
      const bundleReferences = storyBuilderReusableRewardReferences("bundle", "first_bundle");
      devAssert(bundleReferences.length === 1, "fixed reward bundle dependencies are discoverable", bundleReferences);
      bundleReferences[0].reward.bundle_id = "second_bundle";
      devAssert(storyBuilderReusableRewardReferences("bundle", "first_bundle").length === 0 && storyBuilderReusableRewardReferences("bundle", "second_bundle").length === 1, "fixed reward bundle references can be replaced without editing JSON");
      const template = draft.state.reward_templates.relationship_template;
      template.parameters.character = template.parameters.target;
      delete template.parameters.target;
      template.rewards = storyBuilderReplaceTemplateParameterValue(template.rewards, "target", "character");
      const templateReference = storyBuilderReusableRewardReferences("template", "relationship_template")[0].reward;
      templateReference.arguments.character = templateReference.arguments.target;
      delete templateReference.arguments.target;
      devAssert(!rewardTemplateSchemaValidationErrors(draft.state.reward_templates).length, "typed template parameter renames preserve valid placeholders and arguments", draft.state.reward_templates);
      const conditionalOutfitErrors = objectiveRewardValidationErrors([{
        id: "outfit-preview",
        title: "Outfit Preview",
        completion_control: "player",
        rewards: [{
          type: "grant_outfit",
          character_id: draft.state.player.id,
          male_outfit: {
            id: "formal",
            name: "Formal",
            clothing: {
              shirt: "formal shirt"
            }
          },
          equip: false
        }]
      }], draft.state.reward_bundles, draft);
      devAssert(!conditionalOutfitErrors.length, "an unequipped gender-conditional outfit may provide one presentation", conditionalOutfitErrors);
      const equippedErrors = objectiveRewardValidationErrors([{
        id: "outfit-preview",
        title: "Outfit Preview",
        completion_control: "player",
        rewards: [{
          type: "grant_outfit",
          character_id: draft.state.player.id,
          male_outfit: {
            id: "formal",
            name: "Formal",
            clothing: {
              shirt: "formal shirt"
            }
          },
          equip: true
        }]
      }], draft.state.reward_bundles, draft);
      devAssert(equippedErrors.some(error => /requires both male_outfit and non_male_outfit/i.test(error.message)), "an equipped conditional outfit requires both presentations", equippedErrors);
    } finally {
      app.storyBuilder = originalBuilder;
    }
    devTestLog("Scenario complete: reusable-reward-builder-smoke");
  }
  async function devRunImageTimeoutRetrySmokeTest() {
    const scenarioId = "image-timeout-retry-smoke";
    devTestLog(`Scenario start: ${scenarioId}`);
    devResetForLiveTest(scenarioId);
    devResetPreferenceSettingsForSmoke({});
    const pluginOverrides = globalThis.__emberAdventuresPluginOverrides ||= {};
    const hadTextToImageOverride = Object.prototype.hasOwnProperty.call(pluginOverrides, "textToImagePlugin");
    const previousTextToImageOverride = pluginOverrides.textToImagePlugin;
    const onePixel = devSmokeOnePixelDataUrl();
    const profileName = "Timeout Profile Tester";
    const timeoutTraceSource = smokeDevTraceCaptureActive() ? app.smokeDevTraceCapture : app.devTrace || [];
    const timeoutTraceStart = timeoutTraceSource.length;
    app.issuePopupOpen = false;
    document.querySelectorAll(".popup-modal").forEach(node => node.remove());
    app.state.meta ||= {};
    app.state.meta.setup_complete = true;
    app.state.characters[profileName] = {
      ...blankCharacterTemplate(profileName),
      id: "timeout-profile-tester",
      name: profileName,
      gender: "female",
      profile_images: [],
      profile_image_id: ""
    };
    const successfulPlugin = () => ({
      iframeHtml: '<iframe data-src="about:blank#image-timeout-retry-success"></iframe>',
      onFinishPromise: Promise.resolve({
        dataUrl: onePixel
      })
    });
    try {
      let lowTimeoutRejected = false;
      let highTimeoutRejected = false;
      try {
        exactImageRequestTimeoutSeconds(1);
      } catch {
        lowTimeoutRejected = true;
      }
      try {
        exactImageRequestTimeoutSeconds(1000);
      } catch {
        highTimeoutRejected = true;
      }
      devAssert(defaultSettings.imageRequestTimeoutSeconds === 120 && lowTimeoutRejected && highTimeoutRejected && exactImageRequestTimeoutSeconds(120) === 120 && imageRequestTimeoutMs({
        timeoutMs: 35
      }) === 35, "image timeout setting defaults to 120 seconds and rejects out-of-range values", {
        defaultValue: defaultSettings.imageRequestTimeoutSeconds,
        lowTimeoutRejected,
        highTimeoutRejected
      });
      let pluginCallCount = 0;
      pluginOverrides.textToImagePlugin = () => {
        pluginCallCount++;
        if (pluginCallCount === 1) {
          return {
            iframeHtml: '<iframe data-src="about:blank#image-timeout-retry-stalled"></iframe>',
            onFinishPromise: new Promise(() => {})
          };
        }
        return successfulPlugin();
      };
      const normalRecord = createNormalImageRequest({
        title: "Timeout Scene",
        reason: "timeout smoke",
        model: selectedImageModel(),
        seed: 17,
        prompt: "single fantasy room used to test image timeout handling",
        negativePrompt: "text",
        html: imageLoadingHtml("Image generation in progress"),
        pending: true
      }, {
        startRequest: false
      });
      const normalPromise = startStoredImageRequest(normalRecord, {
        timeoutMs: 35
      });
      const normalHostKey = normalImageRequestIframeHostKey(normalRecord.id);
      const normalIframeHost = imageGenerationIframeHostMap()[normalHostKey]?.iframeEl;
      devAssert(!!normalIframeHost?.isConnected && normalIframeHost.style.position === "fixed" && normalIframeHost.style.opacity === "0" && normalIframeHost.getAttribute("loading") === "eager" && normalIframeHost.getAttribute("src") === "about:blank#image-timeout-retry-stalled" && !/<iframe\b/i.test(String(normalRecord.html || "")), "normal image generation eagerly activates an off-screen-independent hidden request host without putting the live iframe in the visible card", {
        normalHostKey,
        hostConnected: !!normalIframeHost?.isConnected,
        hostPosition: normalIframeHost?.style?.position || "",
        hostOpacity: normalIframeHost?.style?.opacity || "",
        hostLoading: normalIframeHost?.getAttribute?.("loading") || "",
        hostSrc: normalIframeHost?.getAttribute?.("src") || "",
        visibleHtml: normalRecord.html || ""
      });
      devAssert(queueProfileImage(profileName, {
        reason: "queued behind stalled normal image",
        force: true,
        allowDuringSmoke: true,
        timeoutMs: 250
      }), "profile image queues while a normal image request is active");
      await normalPromise;
      devAssert(!normalRecord.pending && /timed out/i.test(normalRecord.error || "") && !app.activeImageRequests.has(String(normalRecord.id)), "stalled normal image times out and releases the active request lock", normalRecord);
      devAssert(!imageGenerationIframeHostMap()[normalHostKey], "normal image request removes its hidden generation host after timeout", imageGenerationIframeHostMap());
      devAssert(/image-retry-button/i.test(imageCardHtml(normalRecord)) && /retryNormalImageRequest/i.test(imageCardHtml(normalRecord)), "failed normal image renders a Retry button inside its visible image frame", imageCardHtml(normalRecord));
      await devWaitFor(() => {
        const image = activeProfileImage(profileEntity(profileName));
        return !!image && !image.pending && !image.error && !!profileImageRealHtml(image.html);
      }, 3000, "profile queue to continue after normal image timeout");
      devAssert(pluginCallCount >= 2, "normal image timeout allows the waiting profile queue to continue", {
        pluginCallCount
      });
      await devWaitFor(() => !app.profileImageQueueRunning && !app.profileImageGenerating.size, 3000, "previous profile queue request to release its owner before direct generation");
      pluginOverrides.textToImagePlugin = () => ({
        iframeHtml: '<iframe data-src="about:blank#profile-timeout-retry-stalled"></iframe>',
        onFinishPromise: new Promise(() => {})
      });
      await generateProfileImage(profileName, {
        manual: true,
        randomSeed: true,
        reason: "profile timeout smoke",
        timeoutMs: 35
      });
      const failedProfile = profileImagesForEntity(profileEntity(profileName)).find(image => !image.pending && /timed out/i.test(image.error || ""));
      const failedProfileRenderedHtml = profileImageInnerHtml(failedProfile);
      devAssert(!!failedProfile && !failedProfile.pending && /timed out/i.test(failedProfile.error || "") && /image-retry-button/i.test(failedProfileRenderedHtml) && /retryProfileImageRequest/i.test(failedProfileRenderedHtml), "failed profile image renders a Retry control inside its visible image frame", {
        failedProfile,
        renderedHtml: profileImageInnerHtml(failedProfile)
      });
      const timeoutFailureLogs = timeoutTraceSource.slice(timeoutTraceStart).filter(entry => /^(?:Image failed|Profile image failed)$/i.test(String(entry.title || "")));
      devAssert(timeoutFailureLogs.some(entry => entry.title === "Image failed" && entry.logLevel === "message") && timeoutFailureLogs.some(entry => entry.title === "Profile image failed" && entry.logLevel === "message") && timeoutFailureLogs.every(entry => entry.logLevel === "message") && !/timed out/i.test(document.querySelector(".popup-modal")?.textContent || ""), "normal and profile image timeouts remain recoverable inline failures without warning/error issue popups", {
        timeoutFailureLogs,
        popupText: document.querySelector(".popup-modal")?.textContent || ""
      });
      pluginOverrides.textToImagePlugin = successfulPlugin;
      devAssert(retryProfileImageRequest(failedProfile.id), "profile image Retry reuses the failed request record", failedProfile);
      await devWaitFor(() => {
        const image = profileStoreImageById(failedProfile.id);
        return !!image && !image.pending && !image.error && !!profileImageRealHtml(image.html);
      }, 10000, "retried profile image to finish");
      await devWaitFor(() => !app.profileImageQueueRunning, 3000, "profile image queue to become idle after retry");
      devAssert(!app.profileImageQueueRunning, "profile image queue is idle after the retried image finishes", {
        queueRunning: app.profileImageQueueRunning,
        queue: app.profileImageQueue,
        queuedOwners: [...app.profileImageQueued],
        generatingOwners: [...app.profileImageGenerating]
      });
      normalRecord.pending = false;
      normalRecord.error = "saved normal failure";
      normalRecord.html = "";
      const storedProfile = profileStoreImageById(failedProfile.id);
      storedProfile.pending = false;
      storedProfile.error = "saved profile failure";
      storedProfile.html = "";
      const reset = resetFailedImageRequestsForLoadedSave();
      devAssert(reset.normalCount >= 1 && reset.profileCount >= 1 && normalRecord.pending && !normalRecord.error && storedProfile.pending && !storedProfile.error, "loading a save resets failed normal and profile requests to pending resume state", {
        reset,
        normalRecord,
        storedProfile
      });
      devTestLog(`Scenario complete: ${scenarioId}`);
    } finally {
      if (hadTextToImageOverride) pluginOverrides.textToImagePlugin = previousTextToImageOverride;else delete pluginOverrides.textToImagePlugin;
      app.activeImageRequests.clear();
      app.activeProfileImageRequests.clear();
      app.profileImageQueue.length = 0;
      app.profileImageQueued.clear();
      app.profileImageGenerating.clear();
      app.profileImageQueueRunning = false;
    }
  }
  function devSmokeScenarioRegistry() {
    return [{
      id: "tessa-objective-chain-smoke",
      run: devRunTessaObjectiveChainSmokeTest
    }, {
      id: "left-panel-group-tessa-smoke",
      run: devRunLeftPanelGroupTessaSmokeTest
    }, {
      id: "world-generation-progress-monotonic-smoke",
      run: devRunWorldGenerationProgressMonotonicSmokeTest
    }, {
      id: "runtime-narrow-sanitize-smoke",
      run: devRunRuntimeNarrowSanitizeSmokeTest
    }, {
      id: "story-economy-shops-jobs-smoke",
      allowSmokeImagePlugin: true,
      run: () => devWithDeterministicImagePlugin("story-economy-shops-jobs-smoke", devRunStoryEconomyShopsJobsSmokeTest)
    }, {
      id: "image-profile-ui",
      allowSmokeImagePlugin: true,
      run: () => devWithDeterministicImagePlugin("image-profile-ui", devRunImageAndProfileUiTest)
    }, {
      id: "manage-images-smoke",
      run: devRunManageImagesSmokeTest
    }, {
      id: "manage-characters-smoke",
      run: devRunManageCharactersSmokeTest
    }, {
      id: "main-menu-library-flow-smoke",
      run: devRunLibraryFirstFlowSmokeTest
    }, {
      id: "profile-category-ui",
      run: devRunProfileCategoryUiTest
    }, {
      id: "onboarding-character-settings-ui",
      run: devRunOnboardingCharacterSettingsUiTest
    }, {
      id: "story-template-start-ui",
      run: devRunStoryTemplateStartUiTest
    }, {
      id: "story-player-select-smoke",
      allowSmokeImagePlugin: true,
      run: () => devWithDeterministicImagePlugin("story-player-select-smoke", devRunStoryPlayerSelectSmokeTest)
    }, {
      id: "borderlands-player-select-smoke",
      run: devRunBorderlandsPlayerSelectSmokeTest
    }, {
      id: "saved-games-restore-ui",
      run: devRunSavedGamesRestoreUiTest
    }, {
      id: "save-storage-isolation-smoke",
      run: devRunSaveStorageIsolationSmokeTest
    }, {
      id: "worker-task-scheduling-smoke",
      run: devRunWorkerTaskSchedulingSmokeTest
    }, {
      id: "performance-rendering-smoke",
      run: devRunPerformanceRenderingSmokeTest
    }, {
      id: "scene-image-action-scope-smoke",
      run: devRunSceneImageActionScopeSmokeTest
    }, {
      id: "save-scheduler-timing-smoke",
      run: devRunSaveSchedulerTimingSmokeTest
    }, {
      id: "save-scheduler-actions-smoke",
      run: devRunSaveSchedulerActionsSmokeTest
    }, {
      id: "save-session-lifecycle-smoke",
      run: devRunSaveSessionLifecycleSmokeTest
    }, {
      id: "smoke-suite-runner-smoke",
      run: devRunSmokeSuiteRunnerSmokeTest
    }, {
      id: "state-conflict-guard",
      run: devRunStateConflictGuardTest
    }, {
      id: "toolbar-modals-smoke",
      run: devRunToolbarModalsSmokeTest
    }, {
      id: "quick-actions-smoke",
      run: devRunQuickActionsSmokeTest
    }, {
      id: "scene-character-controls-smoke",
      run: devRunSceneCharacterControlsSmokeTest
    }, {
      id: "state-editor-autosave-smoke",
      run: devRunStateEditorAutosaveSmokeTest
    }, {
      id: "settings-persistence-smoke",
      run: devRunSettingsPersistenceSmokeTest
    }, {
      id: "image-viewer-lab-smoke",
      run: devRunImageViewerLabSmokeTest
    }, {
      id: "story-surfaces-smoke",
      run: devRunStorySurfacesSmokeTest
    }, {
      id: "story-library-ui-smoke",
      allowSmokeImagePlugin: true,
      run: () => devWithDeterministicImagePlugin("story-library-ui-smoke", devRunStoryLibraryUiSmokeTest)
    }, {
      id: "character-library-cast-smoke",
      allowSmokeImagePlugin: true,
      run: devRunCharacterLibraryCastSmokeTest
    }, {
      id: "character-library-local-pagination-smoke",
      run: devRunCharacterLibraryLocalPaginationSmokeTest
    }, {
      id: "character-library-tab-switch-deferred-smoke",
      run: devRunCharacterLibraryTabSwitchDeferredSmokeTest
    }, {
      id: "ai-character-generation-contract-smoke",
      run: devRunAiCharacterGenerationContractSmokeTest
    }, {
      id: "manual-character-editor-smoke",
      run: devRunManualCharacterEditorSmokeTest
    }, {
      id: "prompt-editor-smoke",
      run: devRunPromptEditorSmokeTest
    }, {
      id: "release-polish-smoke",
      run: devRunReleasePolishSmokeTest
    }, {
      id: "prompt-guidance-devtools-smoke",
      run: devRunPromptGuidanceDevtoolsSmokeTest
    }, {
      id: "turn-source-parity-smoke",
      run: devRunTurnSourceParitySmokeTest
    }, {
      id: "continue-objective-control-smoke",
      run: devRunContinueObjectiveControlSmokeTest
    }, {
      id: "objective-completion-timing-smoke",
      run: devRunObjectiveCompletionTimingSmokeTest
    }, {
      id: "no-agency-retry-smoke",
      run: devRunNoAgencyRetrySmokeTest
    }, {
      id: "ai-priority-state-sync-smoke",
      run: devRunAiPriorityStateSyncSmokeTest
    }, {
      id: "ai-timing-log-smoke",
      run: devRunAiTimingLogSmokeTest
    }, {
      id: "local-codex-startup-blank-reply-smoke",
      run: devRunLocalCodexStartupBlankReplySmokeTest
    }, {
      id: "exact-objective-ai-timing-smoke",
      live: true,
      timeoutMs: 3 * 60 * 1000,
      run: devRunExactObjectiveAiTimingSmokeTest
    }, {
      id: "real-perchance-streaming-regenerate-smoke",
      live: true,
      timeoutMs: 5 * 60 * 1000,
      run: devRunRealPerchanceStreamingRegenerateSmokeTest
    }, {
      id: "find-character-turn-smoke",
      run: devRunFindCharacterTurnSmokeTest
    }, {
      id: "ai-command-direct-smoke",
      run: devRunAiCommandDirectSmokeTest
    }, {
      id: "inspect-npc-direct-smoke",
      allowSmokeImagePlugin: true,
      run: () => devWithDeterministicImagePlugin("inspect-npc-direct-smoke", devRunInspectNpcDirectSmokeTest)
    }, {
      id: "npc-inspect-invite-smoke",
      allowSmokeImagePlugin: true,
      timeoutMs: 6 * 60 * 1000,
      run: () => devWithDeterministicImagePlugin("npc-inspect-invite-smoke", devRunNpcInspectInviteSmokeTest)
    }, {
      id: "template-migration-smoke",
      run: devRunStoryTemplateMigrationSmokeTest
    }, {
      id: "immutable-definition-smoke",
      run: devRunImmutableDefinitionSmokeTest
    }, {
      id: "large-objective-runtime-smoke",
      run: devRunLargeObjectiveRuntimeSmokeTest
    }, {
      id: "story-template-import-export-smoke",
      run: devRunStoryTemplateImportExportSmokeTest
    }, {
      id: "canonical-story-state-preservation-smoke",
      run: devRunCanonicalStoryStatePreservationSmokeTest
    }, {
      id: "objective-rewards-smoke",
      run: devRunObjectiveRewardsSmokeTest
    }, {
      id: "story-timeline-pacing-smoke",
      run: devRunStoryTimelinePacingSmokeTest
    }, {
      id: "ai-outcome-routing-smoke",
      run: devRunAiOutcomeRoutingSmokeTest
    }, {
      id: "future-cast-unlock-discipline-smoke",
      run: devRunFutureCastUnlockDisciplineSmokeTest
    }, {
      id: "speaker-npc-repair-smoke",
      run: devRunSpeakerNpcRepairSmokeTest
    }, {
      id: "message-actions-smoke",
      run: devRunMessageActionsSmokeTest
    }, {
      id: "runtime-display-reference-map-smoke",
      run: devRunRuntimeDisplayReferenceMapSmokeTest
    }, {
      id: "voice-segment-smoke",
      run: devRunVoiceSegmentSmokeTest
    }, {
      id: "voice-gating-smoke",
      run: devRunVoiceGatingSmokeTest
    }, {
      id: "voice-browser-compatibility-smoke",
      run: devRunVoiceBrowserCompatibilitySmokeTest
    }, {
      id: "voice-resolution-smoke",
      run: devRunVoiceResolutionSmokeTest
    }, {
      id: "age-diversity-smoke",
      run: devRunAgeDiversitySmokeTest
    }, {
      id: "export-storage-smoke",
      run: devRunExportStorageSmokeTest
    }, {
      id: "character-editor-autosave-smoke",
      run: devRunCharacterEditorAutosaveSmokeTest
    }, {
      id: "future-character-prompt-smoke",
      run: devRunFutureCharacterPromptSmokeTest
    }, {
      id: "render-focus-preservation-smoke",
      run: devRunRenderFocusPreservationSmokeTest
    }, {
      id: "targeted-refresh-redraw-smoke",
      run: devRunTargetedRefreshRedrawSmokeTest
    }, {
      id: "character-import-export-smoke",
      run: devRunCharacterImportExportSmokeTest
    }, {
      id: "character-metadata-repair-import-smoke",
      run: devRunCharacterMetadataRepairImportSmokeTest
    }, {
      id: "character-profile-import-edge-smoke",
      run: devRunCharacterProfileImportEdgeSmokeTest
    }, {
      id: "character-card-action-refresh-smoke",
      run: devRunCharacterCardActionRefreshSmokeTest
    }, {
      id: "ensemble-story-start-smoke",
      run: devRunEnsembleStoryStartSmokeTest
    }, {
      id: "image-profile-isolation-smoke",
      run: devRunImageProfileIsolationSmokeTest
    }, {
      id: "profile-image-trigger-smoke",
      run: devRunProfileImageTriggerSmokeTest,
      allowSmokeImagePlugin: true
    }, {
      id: "profile-image-presentation-pointer-smoke",
      run: devRunProfileImagePresentationPointerSmokeTest,
      allowSmokeImagePlugin: true
    }, {
      id: "story-player-select-gender-profile-image-smoke",
      run: devRunStoryPlayerSelectGenderProfileImageSmokeTest,
      allowSmokeImagePlugin: true
    }, {
      id: "preferred-gender-scene-presence-smoke",
      run: devRunPreferredGenderScenePresenceSmokeTest
    }, {
      id: "profile-image-rules-smoke",
      allowSmokeImagePlugin: true,
      run: devRunProfileImageRulesSmokeTest
    }, {
      id: "image-mode-matrix-smoke",
      run: devRunImageModeMatrixSmokeTest
    }, {
      id: "profile-image-prompt-style-smoke",
      allowSmokeImagePlugin: true,
      run: devRunProfileImagePromptStyleSmokeTest
    }, {
      id: "profile-image-refresh-preserve-smoke",
      run: devRunProfileImageRefreshPreserveSmokeTest
    }, {
      id: "character-card-export-layout-smoke",
      run: devRunCharacterCardExportLayoutSmokeTest
    }, {
      id: "logging-settings-smoke",
      run: devRunLoggingSettingsSmokeTest
    }, {
      id: "npc-full-preservation-smoke",
      run: devRunNpcFullPreservationSmokeTest
    }, {
      id: "image-target-validation-smoke",
      run: devRunImageTargetValidationSmokeTest
    }, {
      id: "gender-adapted-scene-save-projection-smoke",
      run: devRunGenderAdaptedSceneSaveProjectionSmokeTest
    }, {
      id: "ensemble-objective-graph-smoke",
      run: devRunEnsembleObjectiveGraphSmokeTest
    }, {
      id: "ensemble-objective-schema-smoke",
      run: devRunEnsembleObjectiveSchemaSmokeTest
    }, {
      id: "story-files-schema-smoke",
      run: devRunStoryFilesSchemaSmokeTest
    }, {
      id: "venis-model-branch-smoke",
      run: devRunVenisModelBranchSmokeTest
    }, {
      id: "ensemble-objective-flow-report",
      run: devRunEnsembleObjectiveFlowReportSmokeTest
    }, {
      id: "map-travel-objective-smoke",
      run: devRunMapTravelObjectiveSmokeTest
    }, {
      id: "location-hydration-smoke",
      run: devRunLocationHydrationSmokeTest
    }, {
      id: "objective-picker-smoke",
      run: devRunObjectivePickerSmokeTest
    }, {
      id: "turn-scene-image-collector-smoke",
      run: devRunTurnSceneImageCollectorSmokeTest
    }, {
      id: "clothing-image-target-smoke",
      run: devRunClothingImageTargetSmokeTest
    }, {
      id: "outfit-swap-smoke",
      run: devRunOutfitSwapSmokeTest
    }, {
      id: "story-builder-edit-smoke",
      run: devRunStoryBuilderEditSmokeTest
    }, {
      id: "library-metadata-validation-smoke",
      run: devRunLibraryMetadataValidationSmokeTest
    }, {
      id: "json-editor-access-smoke",
      run: devRunJsonEditorAccessSmokeTest
    }, {
      id: "story-builder-metadata-smoke",
      run: devRunStoryBuilderMetadataSmokeTest
    }, {
      id: "real-perchance-image-generation-smoke",
      live: true,
      allowRealImages: true,
      timeoutMs: devRealPerchanceImageSmokeTimeoutMs({
        manualGeneratedImages: 2
      }),
      run: devRunRealPerchanceImageGenerationSmokeTest
    }, {
      id: "real-profile-start-player-smoke",
      allowSmokeImagePlugin: true,
      run: devRunRealProfileStartPlayerSmokeTest
    }, {
      id: "real-profile-start-character-smoke",
      allowSmokeImagePlugin: true,
      run: devRunRealProfileStartCharacterSmokeTest
    }, {
      id: "real-profile-start-npc-smoke",
      allowSmokeImagePlugin: true,
      run: devRunRealProfileStartNpcSmokeTest
    }, {
      id: "real-profile-manual-refresh-smoke",
      allowSmokeImagePlugin: true,
      run: devRunRealProfileManualRefreshSmokeTest
    }, {
      id: "real-profile-scene-entry-smoke",
      allowSmokeImagePlugin: true,
      run: devRunRealProfileSceneEntrySmokeTest
    }, {
      id: "real-profile-objective-reward-smoke",
      allowSmokeImagePlugin: true,
      run: devRunRealProfileObjectiveRewardSmokeTest
    }, {
      id: "real-profile-editor-refresh-smoke",
      allowSmokeImagePlugin: true,
      run: devRunRealProfileEditorRefreshSmokeTest
    }, {
      id: "real-profile-import-small-smoke",
      run: devRunRealProfileImportSmallSmokeTest
    }, {
      id: "real-maid-sama-start-images-smoke",
      allowSmokeImagePlugin: true,
      run: devRunRealMaidSamaStartImagesSmokeTest
    }, {
      id: "real-borderlands-player-select-images-smoke",
      allowSmokeImagePlugin: true,
      run: devRunRealBorderlandsPlayerSelectImagesSmokeTest
    }, {
      id: "simple-popup-key-close-smoke",
      run: devRunSimplePopupKeyCloseSmokeTest
    }, {
      id: "character-stats-integer-validation-smoke",
      run: devRunCharacterStatsIntegerValidationSmokeTest
    }, {
      id: "reference-integer-reward-smoke",
      run: devRunReferenceIntegerRewardSmokeTest
    }, {
      id: "character-gender-adaptation-smoke",
      run: devRunCharacterGenderAdaptationSmokeTest
    }, {
      id: "reverse-delta-snapshot-smoke",
      run: devRunReverseDeltaSnapshotSmokeTest
    }, {
      id: "ai-reply-transaction-smoke",
      run: devRunAiReplyTransactionSmokeTest
    }, {
      id: "chat-image-scroll-stability-smoke",
      run: devRunChatImageScrollStabilitySmokeTest
    }, {
      id: "runtime-patch-persistence-matrix-smoke",
      run: devRunRuntimePatchPersistenceMatrixSmokeTest
    }, {
      id: "player-select-scroll-image-smoke",
      run: devRunPlayerSelectScrollImageSmokeTest
    }, {
      id: "ui-action-loading-smoke",
      run: devRunUiActionLoadingSmokeTest
    }, {
      id: "guided-objective-editor-matrix-smoke",
      run: devRunGuidedObjectiveEditorMatrixSmokeTest
    }, {
      id: "objective-output-runtime-smoke",
      run: devRunObjectiveOutputRuntimeSmokeTest
    }, {
      id: "reusable-reward-builder-smoke",
      run: devRunReusableRewardBuilderSmokeTest
    }, {
      id: "batch-character-image-tool-smoke",
      run: devRunBatchCharacterImageToolSmokeCoverage
    }, {
      id: "image-timeout-retry-smoke",
      allowSmokeImagePlugin: true,
      run: devRunImageTimeoutRetrySmokeTest
    }, {
      id: "objective-requirement-routing-smoke",
      run: devRunObjectiveRequirementRoutingSmokeTest
    }].map((scenario, index) => ({
      ...scenario,
      number: index + 1
    }));
  }
  function devRunLiveTestScenario() {
    if (!EMBERADVENTURES_DEBUG_ALL_LOGS || !EMBERADVENTURES_DEBUG_TEST_SCENARIO) {
      return false;
    }
    if (app.liveTestStartedScenario === EMBERADVENTURES_DEBUG_TEST_SCENARIO && app.liveTestStartedRunId === EMBERADVENTURES_DEBUG_TEST_RUN_ID) {
      return false;
    }
    app.liveTestStartedScenario = EMBERADVENTURES_DEBUG_TEST_SCENARIO;
    app.liveTestStartedRunId = EMBERADVENTURES_DEBUG_TEST_RUN_ID;
    root.__emberAdventuresLiveTestScenario = EMBERADVENTURES_DEBUG_TEST_SCENARIO;
    setTimeout(async () => {
      await flushLargeSaves();
      const liveTestLibrarySnapshot = devFullLibrarySnapshotForSmoke();
      const liveTestPersistentSnapshot = await devPersistentStorageSnapshotForSmoke();
      try {
        if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "run-all-smokes") {
          await runAllDevSmokeScenarios();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "run-quick-smokes") {
          await runQuickDevSmokeScenarios();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "run-medium-smokes") {
          await runMediumDevSmokeScenarios();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "run-short-medium-smokes") {
          await runShortMediumDevSmokeScenarios();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "run-public-hosting-smokes") {
          await runPublicHostingSmokeScenarios();
        } else if (devSmokeScenariosForMode("all").some(scenario => scenario.id === EMBERADVENTURES_DEBUG_TEST_SCENARIO)) {
          // Smoke persistence rule: individual debug-URL smoke
          // runs must go through the suite wrapper so user
          // profiles, story templates, saved-game indexes, and
          // active-save pointers are restored after the test.
          await runDevSmokeScenarioById(EMBERADVENTURES_DEBUG_TEST_SCENARIO);
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "tessa-playtest-seed") {
          await devSeedTessaPlaytestData();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "tessa-objective-chain-smoke") {
          await devRunTessaObjectiveChainSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "left-panel-group-tessa-smoke") {
          await devRunLeftPanelGroupTessaSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO.startsWith("world-generation-progress-monotonic-smoke")) {
          await devRunWorldGenerationProgressMonotonicSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "runtime-narrow-sanitize-smoke") {
          await devRunRuntimeNarrowSanitizeSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "image-profile-ui") {
          await devRunImageAndProfileUiTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "real-perchance-image-generation-smoke") {
          await devRunRealPerchanceImageGenerationSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "profile-category-ui") {
          await devRunProfileCategoryUiTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "story-template-start-ui") {
          await devRunStoryTemplateStartUiTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "saved-games-restore-ui") {
          await devRunSavedGamesRestoreUiTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "save-storage-isolation-smoke") {
          await devRunSaveStorageIsolationSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "smoke-suite-runner-smoke") {
          await devRunSmokeSuiteRunnerSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "state-conflict-guard") {
          await devRunStateConflictGuardTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "toolbar-modals-smoke") {
          await devRunToolbarModalsSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "quick-actions-smoke") {
          await devRunQuickActionsSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "scene-character-controls-smoke") {
          await devRunSceneCharacterControlsSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "state-editor-autosave-smoke") {
          await devRunStateEditorAutosaveSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "settings-persistence-smoke") {
          await devRunSettingsPersistenceSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "image-viewer-lab-smoke") {
          await devRunImageViewerLabSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "story-surfaces-smoke") {
          await devRunStorySurfacesSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "character-library-cast-smoke") {
          await devRunCharacterLibraryCastSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "character-library-public-search-smoke") {
          await devRunCharacterLibraryPublicSearchSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "character-library-tab-switch-deferred-smoke") {
          await devRunCharacterLibraryTabSwitchDeferredSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "manual-character-editor-smoke") {
          await devRunManualCharacterEditorSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "prompt-guidance-devtools-smoke") {
          await devRunPromptGuidanceDevtoolsSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "turn-source-parity-smoke") {
          await devRunTurnSourceParitySmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "continue-objective-control-smoke") {
          await devRunContinueObjectiveControlSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "objective-completion-timing-smoke") {
          await devRunObjectiveCompletionTimingSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "no-agency-retry-smoke") {
          await devRunNoAgencyRetrySmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "ai-priority-state-sync-smoke") {
          await devRunAiPriorityStateSyncSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "ai-timing-log-smoke") {
          await devRunAiTimingLogSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "local-codex-startup-blank-reply-smoke") {
          await devRunLocalCodexStartupBlankReplySmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "exact-objective-ai-timing-smoke") {
          await devRunExactObjectiveAiTimingSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "find-character-turn-smoke") {
          await devRunFindCharacterTurnSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "ai-command-direct-smoke") {
          await devRunAiCommandDirectSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "inspect-npc-direct-smoke") {
          await devRunInspectNpcDirectSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "npc-inspect-invite-smoke") {
          await devRunNpcInspectInviteSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "template-migration-smoke") {
          await devRunStoryTemplateMigrationSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "immutable-definition-smoke") {
          await devRunImmutableDefinitionSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "story-template-import-export-smoke") {
          await devRunStoryTemplateImportExportSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "canonical-story-state-preservation-smoke") {
          await devRunCanonicalStoryStatePreservationSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "objective-rewards-smoke") {
          await devRunObjectiveRewardsSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "future-cast-unlock-discipline-smoke") {
          await devRunFutureCastUnlockDisciplineSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "speaker-npc-repair-smoke") {
          await devRunSpeakerNpcRepairSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "message-actions-smoke") {
          await devRunMessageActionsSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "voice-segment-smoke") {
          await devRunVoiceSegmentSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "voice-gating-smoke") {
          await devRunVoiceGatingSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "voice-resolution-smoke") {
          await devRunVoiceResolutionSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "age-diversity-smoke") {
          await devRunAgeDiversitySmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "export-storage-smoke") {
          await devRunExportStorageSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "character-editor-autosave-smoke") {
          await devRunCharacterEditorAutosaveSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "future-character-prompt-smoke") {
          await devRunFutureCharacterPromptSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "render-focus-preservation-smoke") {
          await devRunRenderFocusPreservationSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "character-import-export-smoke") {
          await devRunCharacterImportExportSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "character-metadata-repair-import-smoke") {
          await devRunCharacterMetadataRepairImportSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "character-profile-import-edge-smoke") {
          await devRunCharacterProfileImportEdgeSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "character-card-action-refresh-smoke") {
          await devRunCharacterCardActionRefreshSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "ensemble-story-start-smoke") {
          await devRunEnsembleStoryStartSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "image-profile-isolation-smoke") {
          await devRunImageProfileIsolationSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "profile-image-trigger-smoke") {
          await devRunProfileImageTriggerSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "profile-image-refresh-preserve-smoke") {
          await devRunProfileImageRefreshPreserveSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "character-card-export-layout-smoke") {
          await devRunCharacterCardExportLayoutSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "logging-settings-smoke") {
          await devRunLoggingSettingsSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "npc-full-preservation-smoke") {
          await devRunNpcFullPreservationSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "image-target-validation-smoke") {
          await devRunImageTargetValidationSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "ensemble-objective-graph-smoke") {
          await devRunEnsembleObjectiveGraphSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "ensemble-objective-schema-smoke") {
          await devRunEnsembleObjectiveSchemaSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "story-files-schema-smoke") {
          await devRunStoryFilesSchemaSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "ensemble-objective-flow-report") {
          await devRunEnsembleObjectiveFlowReportSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "map-travel-objective-smoke") {
          await devRunMapTravelObjectiveSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "location-hydration-smoke") {
          await devRunLocationHydrationSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "objective-picker-smoke") {
          await devRunObjectivePickerSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "clothing-image-target-smoke") {
          await devRunClothingImageTargetSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "outfit-swap-smoke") {
          await devRunOutfitSwapSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "story-builder-edit-smoke") {
          await devRunStoryBuilderEditSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "library-metadata-validation-smoke") {
          await devRunLibraryMetadataValidationSmokeTest();
        } else if (EMBERADVENTURES_DEBUG_TEST_SCENARIO === "image-timeout-retry-smoke") {
          await devRunImageTimeoutRetrySmokeTest();
        } else {
          devTestLog("No live test scenario matched", {
            scenario: EMBERADVENTURES_DEBUG_TEST_SCENARIO
          });
        }
      } catch (err) {
        devLog("live test scenario failed", {
          error: err.message || String(err)
        });
        showNotice("Live Test Failed", err.message || String(err));
      } finally {
        cleanupSmokeScenarioUi();
        await devRestoreFullLibrarySnapshotForSmoke(liveTestLibrarySnapshot, `live test ${EMBERADVENTURES_DEBUG_TEST_SCENARIO} restored`);
        await devRestorePersistentStorageSnapshotForSmoke(liveTestPersistentSnapshot);
      }
    }, 0);
    return true;
  }
  function openStoryBuilder(id) {
    const template = storyTemplateById(id);
    if (!template) return;
    app.storyBuilder = {
      templateId: id,
      panel: "tree",
      draft: validatedStoryTemplateRecord(clone(template)),
      selectedObjectiveId: "",
      pendingTreeConnection: null,
      pendingGraphLinkSourceId: "",
      navigationPanelOpen: false,
      mobileInspectorOpen: false,
      nodeListOpen: false,
      status: "Ready",
      aiOutput: "",
      pendingPatch: null,
      imageAutogenEnabled: true,
      imageAutogenTimer: null,
      imageGenerationActive: "",
      imageQueueStopAfterCurrent: false,
      imageFilter: "all",
      inspectorFocus: false,
      graphLayoutCache: null,
      graphLayoutRequest: null,
      undoStack: [],
      redoStack: [],
      autosaveTimer: null,
      saveRevision: 0,
      validationHadErrors: false,
      dirty: false
    };
    storyBuilderApplyDerivedObjectiveInitialState(app.storyBuilder.draft);
    app.storyBuilder.validationHadErrors = storyBuilderValidationChecks(app.storyBuilder.draft).some(check => !check.ok) || !validateStoryDefinition(app.storyBuilder.draft).ok;
    closeStoryLibraryPopups();
    closeModal();
    document.body.classList.add("story-builder-open");
    app.mobileDrawer = "";
    $("app")?.classList.remove("mobile-left-drawer-open", "mobile-right-drawer-open");
    renderStoryBuilder();
  }
  async function closeStoryBuilder() {
    if (app.storyBuilder?.dirty) {
      const choice = await confirmStoryBuilderUnsavedClose();
      if (choice === "cancel") return;
      if (choice === "save" && !(await saveStoryBuilderDraft(false, {
        finalizeStructure: true
      }))) return;
    }
    storyBuilderStopImageAutogen();
    app.storyBuilder = null;
    document.body.classList.remove("story-builder-open");
    const overlay = $("storyBuilderOverlay");
    if (overlay) {
      overlay.classList.add("hidden");
      overlay.innerHTML = "";
    }
    openStoryTemplateLibrary({
      skipBack: true
    });
  }
  async function startAiStoryCreationFromBuilder() {
    const builder = app.storyBuilder;
    if (!builder?.draft) return;
    saveStoryBuilderVisibleFields();
    const draft = validatedStoryTemplateRecord(clone(builder.draft));
    const player = materializeCharacterDefinitionForRuntimeFields(draft.state?.player || defaultState.player, draft.state?.player?.name || "Player");
    app.onboardingDraft = {
      step: 8,
      character_boldness_offset: clampBoldnessOffset(app.settings.characterBoldnessOffset),
      player_preferences: approvedGenreList(draft.genres || draft.state?.meta?.genres || []),
      story_lookup_genres: approvedGenreList(draft.genres || draft.state?.meta?.genres || []),
      story_mode: draft.source ? "existing" : "original",
      story_title: draft.source ? draft.title || "" : "",
      story_description: draft.description || draft.state?.meta?.story_source?.description || "",
      story_modifications: "",
      story_lookup_title: draft.source ? draft.title || "" : "",
      story_lookup_summary: draft.description || "",
      story_lookup_modifications: "",
      story_confirmed: !!draft.source,
      story_guidance: draft.state?.meta?.story_guidance || "",
      player: {
        name: player.name || "Player",
        age: repairAiAdultAge(player.age || 25, player.name, player.role, "AI story builder player"),
        gender: player.gender || "",
        role: player.role || "protagonist"
      },
      cast_notes: "Use the Story Builder draft as the starting intent. Preserve its genre, source, guidance, player, and opening cast direction where possible.",
      starting_cast_policy: "generated"
    };
    storyBuilderStopImageAutogen();
    app.storyBuilder = null;
    document.body.classList.remove("story-builder-open");
    const overlay = $("storyBuilderOverlay");
    if (overlay) {
      overlay.classList.add("hidden");
      overlay.innerHTML = "";
    }
    openWorldGenerationModal(onboardingSetupPrompt());
  }
  function confirmStoryBuilderUnsavedClose() {
    return new Promise(resolve => {
      const popup = openPopupModal(`
                    <h2>Unsaved Changes</h2>
                    <p class="hint">You have unsaved story-template changes. What do you want to do?</p>
                    <div class="row" style="margin-top:.8rem">
                        <button class="danger" id="storyBuilderDiscardBtn">Close without saving</button>
                        <button class="primary" id="storyBuilderSaveCloseBtn">Save and Close</button>
                        <button id="storyBuilderCancelCloseBtn">Cancel</button>
                    </div>
                `);
      popup.box.querySelector("#storyBuilderDiscardBtn").onclick = () => {
        popup.close();
        resolve("discard");
      };
      popup.box.querySelector("#storyBuilderSaveCloseBtn").onclick = () => {
        popup.close();
        resolve("save");
      };
      popup.box.querySelector("#storyBuilderCancelCloseBtn").onclick = () => {
        popup.close();
        resolve("cancel");
      };
    });
  }
  function storyBuilderPanels() {
    return [["tree", "Tree"], ["overview", "Overview"], ["cast", "Starting Cast"], ["future_cast", "Future Cast"], ["opening", "Opening & World"], ["systems", "Story Systems"], ["economy", "Shops & Jobs"], ["images", "Images"], ["state", "Advanced State"], ["imports", "Imports"], ["ai", "AI Composer"], ["validate", "Validation"]];
  }
  function setStoryBuilderPanel(panel) {
    if (saveStoryBuilderVisibleFields() === false) return;
    if (!app.storyBuilder) return;
    app.storyBuilder.panel = panel;
    app.storyBuilder.navigationPanelOpen = false;
    if (panel !== "tree") app.storyBuilder.mobileInspectorOpen = false;
    renderStoryBuilder();
  }
  function storyBuilderToggleNavigationPanel(forceOpen = null) {
    const builder = app.storyBuilder;
    const body = document.querySelector(".story-builder-body");
    if (!builder || !body) return false;
    const open = typeof forceOpen === "boolean" ? forceOpen : builder.navigationPanelOpen !== true;
    builder.navigationPanelOpen = open;
    if (open) builder.mobileInspectorOpen = false;
    body.classList.toggle("left-open", open);
    body.classList.toggle("right-open", builder.mobileInspectorOpen === true);
    return open;
  }
  function storyBuilderToggleDetailsPanel(forceOpen = null) {
    const builder = app.storyBuilder;
    const body = document.querySelector(".story-builder-body");
    if (!builder || !body || builder.panel !== "tree") return false;
    const open = typeof forceOpen === "boolean" ? forceOpen : builder.mobileInspectorOpen !== true;
    builder.mobileInspectorOpen = open;
    if (open) builder.navigationPanelOpen = false;
    body.classList.toggle("right-open", open);
    body.classList.toggle("left-open", builder.navigationPanelOpen === true);
    return open;
  }
  function storyBuilderCloseWorkspacePanels() {
    const builder = app.storyBuilder;
    const body = document.querySelector(".story-builder-body");
    if (!builder || !body) return false;
    builder.navigationPanelOpen = false;
    builder.mobileInspectorOpen = false;
    body.classList.remove("left-open", "right-open");
    return true;
  }
  function renderStoryBuilder() {
    const builder = app.storyBuilder;
    const overlay = $("storyBuilderOverlay");
    if (!builder || !overlay) return;
    const draft = builder.draft;
    const treePanel = builder.panel === "tree";
    overlay.classList.remove("hidden");
    document.body.classList.add("story-builder-open");
    $("app")?.classList.remove("mobile-left-drawer-open", "mobile-right-drawer-open");
    overlay.innerHTML = `
                <div class="story-builder-header">
                    <div class="story-builder-header-identity">
                        <input id="storyBuilderHeaderTitle" class="story-builder-header-title" type="text" aria-label="Story name" title="Edit story name" value="${escapeHtml(draft.title || "")}" placeholder="Untitled Story">
                        <div class="hint">Story template / ${escapeHtml(builder.status || "Ready")}</div>
                    </div>
                    <div class="row">
                        <button type="button" onclick="EmberAdventures.saveStoryBuilderDraft(true, { finalizeStructure: true })">Save</button>
                        <button class="blue" type="button" onclick="EmberAdventures.startAiStoryCreationFromBuilder()">Use AI to Create Story</button>
                        <button type="button" onclick="EmberAdventures.exportStoryBuilderDraft()">Export</button>
                        <button type="button" onclick="EmberAdventures.closeStoryBuilder()">Close</button>
                    </div>
                </div>
                <div class="story-builder-body ${treePanel ? "" : "no-details"} ${builder.navigationPanelOpen ? "left-open" : ""} ${treePanel && builder.mobileInspectorOpen ? "right-open" : ""}">
                    <div class="story-builder-workspace-scrim" onclick="EmberAdventures.storyBuilderCloseWorkspacePanels()"></div>
                    <aside class="story-builder-sidebar">
                        <div class="story-builder-panel-head">
                            <h2>Story Editor</h2>
                            <span class="spacer"></span>
                            <button type="button" class="story-builder-panel-collapse left" title="Hide story editor menu" aria-label="Hide story editor menu" onclick="EmberAdventures.storyBuilderToggleNavigationPanel(false)">&#10094;</button>
                        </div>
                        <div class="story-builder-panel-body">
                            <nav class="story-builder-nav" aria-label="Story editor sections">
                                ${storyBuilderPanels().map(([id, label]) => `<button type="button" class="${builder.panel === id ? "primary" : ""}" onclick="EmberAdventures.setStoryBuilderPanel(${htmlJsArg(id)})">${escapeHtml(label)}</button>`).join("")}
                            </nav>
                        </div>
                    </aside>
                    <main class="story-builder-main ${treePanel ? "tree" : ""}">${renderStoryBuilderPanel(builder.panel)}</main>
                    <button type="button" class="story-builder-edge-tab left" onclick="EmberAdventures.storyBuilderToggleNavigationPanel(true)">&#10095; Menu</button>
                    ${treePanel ? `<button type="button" class="story-builder-edge-tab right" onclick="EmberAdventures.storyBuilderToggleDetailsPanel(true)">&#10094; Node</button>` : ""}
                </div>
            `;
    appendAuthoringSkillLink(overlay.querySelector(".story-builder-header .row"), "story");
    bindStoryBuilderPanel();
    requestAnimationFrame(() => fitStoryBuilderGraphNodeTitles(overlay));
    storyBuilderEnsureImageAutogen();
  }
  function storyBuilderDefaultAnyPlayerStartingState() {
    const maleOutfit = {
      id: "story-male-default",
      name: "Story Default",
      clothing: completeClothingSlotsForEditor({
        shirt: "",
        pants: ""
      })
    };
    const nonMaleOutfit = {
      id: "story-non-male-default",
      name: "Story Default",
      clothing: completeClothingSlotsForEditor({
        shirt: "",
        pants: "",
        bra: "bra"
      })
    };
    return {
      role: "protagonist",
      starting_known_facts_to_add: [],
      starting_inventory: [],
      stats: {},
      starting_held_items: {
        right_hand: null,
        left_hand: null
      },
      starting_state_of_mind: "ready to begin",
      starting_physical_state: "healthy",
      starting_pose: "standing",
      male_outfits: [maleOutfit],
      male_starting_outfit_id: maleOutfit.id,
      non_male_outfits: [nonMaleOutfit],
      non_male_starting_outfit_id: nonMaleOutfit.id
    };
  }
  function storyBuilderStructuredPanelValue(panel, draft = app.storyBuilder?.draft) {
    if (!draft) return {};
    const state = draft.state || {};
    if (panel === "opening") return completeFriendlyStateEditorSchema({
      messages: clone(draft.messages || []),
      location: clone(state.location || {}),
      world_map: clone(state.world_map || {
        current_location_id: "",
        locations: {}
      }),
      time: clone(state.time || {}),
      scene: clone(state.scene || {}),
      npc_directory: clone(state.npc_directory || {
        locations: {}
      })
    });
    if (panel === "systems") return {
      story_inventory: clone(state.story_inventory || {
        items: []
      }),
      story_rules: clone(state.story_rules || []),
      story_memory: clone(state.story_memory || []),
      world_flags: clone(state.world_flags || {}),
      story_clock: clone(state.story_clock || {
        elapsed_minutes: 0
      }),
      story_pacing: clone(state.story_pacing || {}),
      timed_events: clone(state.timed_events || {}),
      reward_bundles: clone(state.reward_bundles || {}),
      reward_templates: clone(state.reward_templates || {}),
      numeric_precision: clone(state.numeric_precision || {})
    };
    if (panel === "economy") return {
      story_shops: clone(state.story_shops || {}),
      character_shop_cost_templates: clone(state.character_shop_cost_templates || {}),
      story_job_offers: clone(state.story_job_offers || {})
    };
    return {};
  }
  function storyBuilderApplyStructuredPanel(panel, value = {}) {
    const builder = app.storyBuilder;
    const draft = builder?.draft;
    if (!draft || !isPlainObject(value)) return false;
    draft.state ||= {};
    if (panel === "opening") {
      draft.messages = Array.isArray(value.messages) ? value.messages : [];
      for (const key of ["location", "world_map", "time", "scene", "npc_directory"]) draft.state[key] = clone(value[key] || {});
    } else if (panel === "systems") {
      for (const key of ["story_inventory", "story_rules", "story_memory", "world_flags", "story_clock", "story_pacing", "timed_events", "reward_bundles", "reward_templates", "numeric_precision"]) draft.state[key] = clone(value[key] || (key.endsWith("s") ? {} : {}));
    } else if (panel === "economy") {
      for (const key of ["story_shops", "character_shop_cost_templates", "story_job_offers"]) draft.state[key] = clone(value[key] || {});
    } else return false;
    draft.state = stripRuntimeTemplateFields(draft.state);
    builder.dirty = true;
    return true;
  }
  function renderStoryBuilderStructuredPanel(panel, draft) {
    const titles = {
      opening: "Opening, World, Scene, And Time",
      systems: "Story Systems",
      economy: "Shops, Job Boards, And Costs"
    };
    const actions = {
      opening: `
                    <button type="button" onclick="EmberAdventures.storyBuilderAddStructuredEntry('opening-message')">Add Opening Message</button>
                    <button type="button" onclick="EmberAdventures.storyBuilderAddStructuredEntry('location')">Add Location</button>`,
      systems: `
                    <button type="button" onclick="EmberAdventures.storyBuilderAddStructuredEntry('timed-event')">Add Timed Event</button>
                    <button type="button" onclick="EmberAdventures.openStoryBuilderReusableRewardsManager()">Reusable Rewards</button>`,
      economy: `
                    <button type="button" onclick="EmberAdventures.storyBuilderAddStructuredEntry('shop')">Add Shop</button>
                    <button type="button" onclick="EmberAdventures.storyBuilderAddStructuredEntry('job-board')">Add Job Board</button>
                    <button type="button" onclick="EmberAdventures.storyBuilderAddStructuredEntry('cost-template')">Add Cost Template</button>`
    };
    return `
                <section class="story-builder-section">
                    <div class="story-builder-section-header">
                        <div>
                            <h3>${escapeHtml(titles[panel] || "Story Data")}</h3>
                            <p class="hint">Use the controls below. Empty lists and values are preserved intentionally; no JSON authoring is required.</p>
                        </div>
                        <div class="row">${actions[panel] || ""}</div>
                    </div>
                    <div id="storyBuilderStructuredEditor" class="state-editor-tree" data-story-builder-structured-panel="${escapeHtml(panel)}">
                        ${buildFriendlyStateEditor(storyBuilderStructuredPanelValue(panel, draft), [], 0, {
      profile: "story_builder"
    })}
                    </div>
                </section>`;
  }
  async function storyBuilderAddStructuredEntry(kind = "") {
    const builder = app.storyBuilder;
    const draft = builder?.draft;
    if (!draft) return false;
    if (saveStoryBuilderVisibleFields() === false) return false;
    const label = kind.replace(/-/g, " ");
    const requested = await showPrompt(`Add ${label}`, kind === "opening-message" ? "Speaker name?" : "Stable id?", "", {
      rows: 2,
      submitText: "Add"
    });
    if (!requested) return false;
    const id = objectiveIdFromTitle(requested, `${kind}-${Date.now()}`);
    const state = draft.state;
    if (kind === "opening-message") {
      draft.messages ||= [];
      draft.messages.push({
        id: Date.now(),
        role: "assistant",
        speaker: requested,
        text: "",
        at: ""
      });
    } else if (kind === "location") {
      state.world_map ||= {
        current_location_id: id,
        locations: {}
      };
      state.world_map.locations ||= {};
      state.world_map.locations[id] = {
        id,
        name: requested,
        type: "location",
        scale: "local",
        discovered: true,
        travel_enabled: true,
        summary: "",
        detail: {},
        connections: [],
        npcs: []
      };
      state.npc_directory ||= {
        locations: {}
      };
      state.npc_directory.locations ||= {};
      state.npc_directory.locations[id] ||= {
        label: requested,
        characters: {}
      };
    } else if (kind === "timed-event") {
      state.timed_events ||= {};
      state.timed_events[id] = {
        id,
        title: requested,
        enabled: true,
        trigger: {
          elapsed_minutes: 0
        },
        rewards: []
      };
    } else if (kind === "reward-bundle") {
      state.reward_bundles ||= {};
      state.reward_bundles[id] = {
        id,
        title: requested,
        rewards: []
      };
    } else if (kind === "reward-template") {
      state.reward_templates ||= {};
      state.reward_templates[id] = {
        id,
        title: requested,
        parameters: [],
        rewards: []
      };
    } else if (kind === "shop" || kind === "job-board") {
      state.story_shops ||= {};
      state.story_shops[id] = {
        id,
        title: requested,
        type: kind === "job-board" ? "job" : "general",
        location: "",
        npc_location_id: currentNpcLocationId(state),
        unlocked: true,
        items: []
      };
    } else if (kind === "cost-template") {
      state.character_shop_cost_templates ||= {};
      state.character_shop_cost_templates[id] = {
        type: "stat",
        costs: [],
        effects: []
      };
    }
    builder.dirty = true;
    const saved = await saveStoryBuilderDraft(false, {
      collectVisible: false
    });
    renderStoryBuilder();
    return saved;
  }
  function renderStoryBuilderPanel(panel) {
    const builder = app.storyBuilder;
    const draft = builder?.draft;
    if (!draft) return "";
    if (panel === "tree") {
      return renderStoryBuilderTreePanel(draft);
    }
    if (panel === "overview") {
      const selectedGenres = approvedGenreList(draft.state?.meta?.genres || draft.genres || []);
      return `
                    <div class="story-builder-grid">
                        <section class="stat-card">
                            <h3>Story</h3>
                            <label>Name <input id="storyBuilderTitle" value="${escapeHtml(draft.title || "")}"></label>
                            <label>Description <textarea id="storyBuilderDescription" rows="4">${escapeHtml(draft.description || "")}</textarea></label>
                            
                            <label class="check-row"><input id="storyBuilderAllowAnyPlayer" type="checkbox" ${draft.allow_any_player === true ? "checked" : ""}> <span>Allow any Character Library character as Player</span></label>
                            <details class="state-branch" ${draft.allow_any_player === true ? "open" : ""}>
                                <summary>Character Library player starting overrides</summary>
                                <p class="hint">These story-owned values replace the selected library character's runtime starting data. Known facts are added. Empty inventory, stats, and held-item collections intentionally remove foreign story data.</p>
                                <div id="storyBuilderAnyPlayerEditor" class="state-editor-tree">
                                    ${buildFriendlyStateEditor(completeFriendlyStateEditorSchema({
        any_player_starting_state: clone(draft.any_player_starting_state || storyBuilderDefaultAnyPlayerStartingState())
      }), [], 0, {
        profile: "story_builder"
      })}
                                </div>
                            </details>
                            <label>Source <input id="storyBuilderSource" placeholder="Blank for original / made up" value="${escapeHtml(draft.source || "")}"></label>
                            <label>Created with <input id="storyBuilderCreationTool" placeholder="Codex 5.5 (Medium)" value="${escapeHtml(draft.creation_tool || "")}"></label>
                            <label>Default generated image style
                                <select id="storyBuilderDefaultImageModel">
                                    <option value ${draft.default_image_model ? "" : "selected"}>Use global default (${escapeHtml(imageModelLabel(app.settings.imageModel))})</option>
                                    ${imageModelOptions().map(model => `<option value="${escapeHtml(model.value)}" ${draft.default_image_model && selectedImageModel(draft.default_image_model) === model.value ? "selected" : ""}>${escapeHtml(model.label)}</option>`).join("")}
                                </select>
                            </label>
                            
                        </section>
                        <section class="stat-card">
                            <h3>Guidance</h3>
                            <label>Guidance <textarea id="storyBuilderGuidance" rows="7">${escapeHtml(draft.state?.meta?.story_guidance || "")}</textarea></label>
                            <p class="hint">This is template guidance. Player profile preferences and runtime flags are stored separately.</p>
                        </section>
                        <section class="stat-card">
                            <h3>Genres</h3>
                            <p class="hint">At least one approved genre is required before a story can be imported, shared, or published.</p>
                            <div class="grid3">
                                ${entertainmentPreferenceOptions().map(genre => `
                                        <label class="check-row">
                                            <input class="storyBuilderGenreCheck" type="checkbox" value="${escapeHtml(genre)}" ${selectedGenres.includes(genre) ? "checked" : ""}>
                                            <span>${escapeHtml(genre)}</span>
                                        </label>
                                    `).join("")}
                            </div>
                        </section>
                    </div>
                `;
    }
    if (panel === "cast") {
      return renderStoryBuilderCastPanel(draft);
    }
    if (["opening", "systems", "economy"].includes(panel)) {
      return renderStoryBuilderStructuredPanel(panel, draft);
    }
    if (panel === "state") {
      return `
                    <p class="hint">Structured template state editor. Profile-owned settings and runtime-only fields are hidden or stripped on save/export.</p>
                    <div id="storyBuilderStateEditor" class="state-editor-tree">${buildFriendlyStateEditor(draft.state, [], 0, {
        profile: "template"
      })}</div>
                `;
    }
    if (panel === "future_cast") {
      const entries = Object.entries(draft.state?.future_cast?.items || {});
      return `
                    <div class="row" style="margin-bottom:.8rem">
                        <button type="button" id="storyBuilderAddFutureCharacterBtn">Add Future Character</button>
                        <button type="button" id="storyBuilderGenerateFutureCharacterBtn">Generate Character With AI</button>
                    </div>
                    <div class="story-builder-grid">
                        ${entries.map(([id, entry]) => `
                                <section class="stat-card">
                                    <strong>${escapeHtml(entry.name || id)}</strong>
                                    <div class="hint">${escapeHtml(entry.status || "locked")} / ${escapeHtml(entry.location_hint || "no location")}</div>
                                    <label>Name <input data-future-id="${escapeHtml(id)}" data-future-field="name" value="${escapeHtml(entry.name || "")}"></label>
                                    <label>Status <input data-future-id="${escapeHtml(id)}" data-future-field="status" value="${escapeHtml(entry.status || "locked")}"></label>
                                    <label>Location hint <input data-future-id="${escapeHtml(id)}" data-future-field="location_hint" value="${escapeHtml(entry.location_hint || "")}"></label>
                                    <label>Unlock greeting <textarea rows="3" data-future-id="${escapeHtml(id)}" data-future-field="greeting">${escapeHtml(entry.greeting || entry.on_unlock?.greeting || "")}</textarea></label>
                                    <label>Unlock image prompt <textarea rows="3" data-future-id="${escapeHtml(id)}" data-future-field="on_unlock.image.prompt">${escapeHtml(entry.on_unlock?.image?.prompt || "")}</textarea></label>
                                    <details class="state-branch">
                                        <summary>Future-cast shell</summary>
                                        <div class="state-editor-tree" data-story-builder-future-shell="${escapeHtml(id)}">
                                            ${buildFriendlyStateEditor(storyBuilderFutureShellValue(entry), [], 0, {
        profile: "story_builder"
      })}
                                        </div>
                                    </details>
                                    <div class="row">
                                        <button type="button" onclick="EmberAdventures.storyBuilderEditCharacterDefinition('future', ${htmlJsArg(id)})">Full Definition</button>
                                        <button type="button" class="danger" onclick="EmberAdventures.storyBuilderDeleteFutureCharacter(${htmlJsArg(id)})">Delete</button>
                                    </div>
                                </section>
                            `).join("") || `<p class="hint">No future characters yet.</p>`}
                    </div>
                `;
    }
    if (panel === "objectives") return renderStoryBuilderTreePanel(draft);
    if (panel === "images") {
      return renderStoryBuilderImagesPanel(draft);
    }
    if (panel === "imports") {
      return `
                    <section class="stat-card">
                        <h3>Import Data</h3>
                        <p class="hint">Upload a story template, full state, future_cast, characters, objectives, world_map, images, or mixed JSON generated elsewhere. EmberAdventures will merge recognized sections into this template draft.</p>
                        <div class="row"><button type="button" id="storyBuilderImportBtn">Upload JSON Into Template</button></div>
                    </section>
                `;
    }
    if (panel === "ai") {
      return `
                    <section class="stat-card">
                        <h3>AI Composer</h3>
                        <p class="hint">Ask the AI to propose changes. Review and select each proposed change before applying it.</p>
                        <textarea id="storyBuilderAiRequest" rows="6" placeholder="Example: Add a future character unlocked after the Vale objective and add a side quest that introduces them."></textarea>
                        <div class="row" style="margin-top:.6rem">
                            <button class="primary" type="button" id="storyBuilderRunAiBtn">Run AI Update</button>
                            <button type="button" id="storyBuilderApplyPatchBtn" ${builder.pendingPatch ? "" : "disabled"}>Apply Patch</button>
                        </div>
                        <div class="story-builder-status" style="margin-top:.8rem">${escapeHtml(builder.status || "Ready")}</div>
                        ${renderStoryBuilderAiPatchReview(builder.pendingPatch)}
                    </section>
                `;
    }
    if (panel === "validate") {
      return renderStoryBuilderValidation();
    }
    return "";
  }
  function renderStoryBuilderCastPanel(draft) {
    const state = draft.state || {};
    const players = storyTemplatePlayerOptions(state);
    const playerList = players.length ? players.map(option => option.character) : [state.player || blankCharacterTemplate("Player")];
    const partyEntries = Object.entries(state.characters || {});
    const npcEntries = storyBuilderOpeningNpcEntries(state);
    return `
                <section class="story-builder-section">
                    <div class="story-builder-section-header">
                        <div>
                            <h3>Playable Characters</h3>
                            <p class="hint">If more than one player exists, the player chooses one before the opening message.</p>
                        </div>
                        <button type="button" onclick="EmberAdventures.storyBuilderAddPlayerOption()">Add Player Option</button>
                    </div>
                    <div class="story-builder-grid">
                        ${playerList.map((player, index) => storyBuilderCharacterCardHtml("player", index, player, {
      deleteText: playerList.length > 1 ? "Delete" : ""
    })).join("")}
                    </div>
                </section>
                <section class="story-builder-section">
                    <div class="story-builder-section-header">
                        <div>
                            <h3>Starting Party Members</h3>
                            <p class="hint">Party members here start in the party or as current companions. Do not put clerks, handlers, shopkeepers, or future unlocks here unless they start in the party.</p>
                        </div>
                        <button type="button" onclick="EmberAdventures.storyBuilderAddStartingCharacter()">Add Party Member</button>
                    </div>
                    <div class="story-builder-grid">
                        ${partyEntries.map(([key, character]) => storyBuilderCharacterCardHtml("character", key, character, {
      sceneControls: true,
      deleteText: "Delete"
    })).join("") || `<p class="hint">No starting party members.</p>`}
                    </div>
                </section>
                <section class="story-builder-section">
                    <div class="story-builder-section-header">
                        <div>
                            <h3>Opening NPCs</h3>
                            <p class="hint">NPCs physically present or known at the start. Inspected NPCs can have a full character definition; uninspected NPCs stay lightweight.</p>
                        </div>
                        <button type="button" onclick="EmberAdventures.storyBuilderAddOpeningNpc()">Add Opening NPC</button>
                    </div>
                    <div class="story-builder-grid">
                        ${npcEntries.map(entry => storyBuilderNpcCardHtml(entry)).join("") || `<p class="hint">No opening NPCs.</p>`}
                    </div>
                </section>
            `;
  }
  function storyBuilderCharacterCardHtml(kind, key, character = {}, options = {}) {
    const id = String(key);
    const name = textSlot(character.name, kind === "player" ? "Player" : id);
    const activeChecked = options.sceneControls && (app.storyBuilder?.draft?.state?.scene?.party_members_present || []).includes(name) ? "checked" : "";
    const imageChecked = options.sceneControls && (app.storyBuilder?.draft?.state?.scene?.image_characters || []).includes(name) ? "checked" : "";
    return `
                <section class="story-builder-compact-card">
                    <div class="story-builder-section-header">
                        <strong>${escapeHtml(name || "Unnamed")}</strong>
                        <div class="row">
                            <button type="button" onclick="EmberAdventures.storyBuilderEditCharacterDefinition(${htmlJsArg(kind)}, ${htmlJsArg(id)})">Full Definition</button>
                            ${options.deleteText ? `<button type="button" class="danger" onclick="EmberAdventures.storyBuilderDeleteCastEntry(${htmlJsArg(kind)}, ${htmlJsArg(id)})">${escapeHtml(options.deleteText)}</button>` : ""}
                        </div>
                    </div>
                    <label>Name <input data-story-cast-kind="${escapeHtml(kind)}" data-story-cast-key="${escapeHtml(id)}" data-story-cast-field="name" value="${escapeHtml(name || "")}"></label>
                    <label>Role <input data-story-cast-kind="${escapeHtml(kind)}" data-story-cast-key="${escapeHtml(id)}" data-story-cast-field="role" value="${escapeHtml(character.role || "")}"></label>
                    <div class="grid2">
                        <label>Gender <input data-story-cast-kind="${escapeHtml(kind)}" data-story-cast-key="${escapeHtml(id)}" data-story-cast-field="gender" value="${escapeHtml(character.gender || "")}"></label>
                        <label>Age <input type="number" min="18" data-story-cast-kind="${escapeHtml(kind)}" data-story-cast-key="${escapeHtml(id)}" data-story-cast-field="age" value="${escapeHtml(character.age || "")}"></label>
                    </div>
                    <label>Personality <textarea rows="3" data-story-cast-kind="${escapeHtml(kind)}" data-story-cast-key="${escapeHtml(id)}" data-story-cast-field="personality_description">${escapeHtml(character.personality_description || "")}</textarea></label>
                    <label>Speech Style <textarea rows="2" data-story-cast-kind="${escapeHtml(kind)}" data-story-cast-key="${escapeHtml(id)}" data-story-cast-field="speech_style">${escapeHtml(character.speech_style || "")}</textarea></label>
                    ${options.sceneControls ? `<div class="row">
                                <label class="check-row"><input type="checkbox" data-story-cast-kind="${escapeHtml(kind)}" data-story-cast-key="${escapeHtml(id)}" data-story-cast-field="scene.active" ${activeChecked}> <span>Starts in scene</span></label>
                                <label class="check-row"><input type="checkbox" data-story-cast-kind="${escapeHtml(kind)}" data-story-cast-key="${escapeHtml(id)}" data-story-cast-field="scene.image" ${imageChecked}> <span>Starts in images</span></label>
                            </div>` : ""}
                </section>
            `;
  }
  function storyBuilderOpeningNpcEntries(state) {
    const entries = [];
    for (const [locationId, location] of Object.entries(state.npc_directory?.locations || {})) {
      for (const [key, npc] of Object.entries(location?.characters || {})) {
        entries.push({
          locationId,
          locationLabel: textSlot(location?.label, locationId),
          key,
          npc
        });
      }
    }
    return entries;
  }
  function storyBuilderNpcCardHtml(entry) {
    const npc = entry.npc || {};
    const name = textSlot(npc.name, entry.key);
    const state = app.storyBuilder?.draft?.state || {};
    const activeChecked = (state.scene?.party_members_present || []).includes(name) ? "checked" : "";
    const imageChecked = (state.scene?.image_characters || []).includes(name) ? "checked" : "";
    const nearbyChecked = (state.scene?.npcs_present || []).includes(name) ? "checked" : "";
    return `
                <section class="story-builder-compact-card">
                    <div class="story-builder-section-header">
                        <strong>${escapeHtml(name || "Unnamed NPC")}</strong>
                        <div class="row">
                            <button type="button" onclick="EmberAdventures.storyBuilderEditCharacterDefinition('npc', ${htmlJsArg(`${entry.locationId}||${entry.key}`)})">Full Definition</button>
                            <button type="button" class="danger" onclick="EmberAdventures.storyBuilderDeleteCastEntry('npc', ${htmlJsArg(`${entry.locationId}||${entry.key}`)})">Delete</button>
                        </div>
                    </div>
                    <label>Name <input data-story-cast-kind="npc" data-story-cast-key="${escapeHtml(`${entry.locationId}||${entry.key}`)}" data-story-cast-field="name" value="${escapeHtml(name || "")}"></label>
                    <label>NPC location ID <input data-story-cast-kind="npc" data-story-cast-key="${escapeHtml(`${entry.locationId}||${entry.key}`)}" data-story-cast-field="locationId" value="${escapeHtml(entry.locationId || "")}"></label>
                    <div class="grid2">
                        <label>Role / job <input data-story-cast-kind="npc" data-story-cast-key="${escapeHtml(`${entry.locationId}||${entry.key}`)}" data-story-cast-field="role" value="${escapeHtml(npc.role || "")}"></label>
                        <label>Gender <input data-story-cast-kind="npc" data-story-cast-key="${escapeHtml(`${entry.locationId}||${entry.key}`)}" data-story-cast-field="gender" value="${escapeHtml(npc.gender || "")}"></label>
                    </div>
                    <label>Note <textarea rows="3" data-story-cast-kind="npc" data-story-cast-key="${escapeHtml(`${entry.locationId}||${entry.key}`)}" data-story-cast-field="note">${escapeHtml(npc.note || "")}</textarea></label>
                    <div class="row">
                        <label class="check-row"><input type="checkbox" data-story-cast-kind="npc" data-story-cast-key="${escapeHtml(`${entry.locationId}||${entry.key}`)}" data-story-cast-field="inspected" ${npc.inspected ? "checked" : ""}> <span>Inspected/full NPC</span></label>
                        <label class="check-row"><input type="checkbox" data-story-cast-kind="npc" data-story-cast-key="${escapeHtml(`${entry.locationId}||${entry.key}`)}" data-story-cast-field="scene.active" ${activeChecked}> <span>Active</span></label>
                        <label class="check-row"><input type="checkbox" data-story-cast-kind="npc" data-story-cast-key="${escapeHtml(`${entry.locationId}||${entry.key}`)}" data-story-cast-field="scene.nearby" ${nearbyChecked}> <span>Nearby</span></label>
                        <label class="check-row"><input type="checkbox" data-story-cast-kind="npc" data-story-cast-key="${escapeHtml(`${entry.locationId}||${entry.key}`)}" data-story-cast-field="scene.image" ${imageChecked}> <span>In images</span></label>
                    </div>
                </section>
            `;
  }
  function storyBuilderObjectiveList(draft = app.storyBuilder?.draft) {
    if (!draft) return [];
    draft.state ||= {};
    draft.state.objectives ||= {
      items: []
    };
    draft.state.objectives.items ||= [];
    return draft.state.objectives.items;
  }
  function storyBuilderStartingObjectiveId(draft = app.storyBuilder?.draft) {
    const objectiveState = draft?.state?.objectives || {};
    const objectives = storyBuilderObjectiveList(draft);
    const requestedId = String(objectiveState.active_id || "").trim();
    const requested = objectives.find(objective => String(objective?.id || "") === requestedId && !objectiveIsSide(objective));
    if (requested) return requestedId;
    return String(objectives.find(objective => !objectiveIsSide(objective))?.id || "");
  }
  function storyBuilderApplyDerivedObjectiveInitialState(draft = app.storyBuilder?.draft) {
    if (!draft) return "";
    const objectives = storyBuilderObjectiveList(draft);
    draft.state.objectives ||= {
      items: []
    };
    const startingId = storyBuilderStartingObjectiveId(draft);
    draft.state.objectives.active_id = startingId;
    for (const objective of objectives) {
      const starting = !!startingId && String(objective?.id || "") === startingId;
      objective.status = starting ? "active" : "hidden";
      objective.available_now = starting;
    }
    return startingId;
  }
  function storyBuilderObjectiveControlMode(objective = {}) {
    const control = objectiveCompletionControl(objective);
    return control === "ai" || control === "reward_only" ? "ai" : "player";
  }
  function storyBuilderObjectiveEditorType(objective = {}) {
    if (objectiveCompletionControl(objective) === "reward_only" || String(objective?.type || "").toLowerCase() === "reward_only") return "transition";
    if (objectiveUsesDialogueDelivery(objective)) return "dialogue";
    if (objectiveCompletionControl(objective) === "choice" || objectiveRouteControl(objective) === "ai") return "branch";
    return "standard";
  }
  function storyBuilderObjectiveById(id, draft = app.storyBuilder?.draft) {
    const targetId = String(id || "");
    return storyBuilderObjectiveList(draft).find(objective => String(objective.id || "") === targetId);
  }
  function storyBuilderTreeEditorData(draft = app.storyBuilder?.draft) {
    if (!draft) return {
      positions: {},
      viewport: {
        x: 0,
        y: 0,
        zoom: 1
      }
    };
    if (!isPlainObject(draft.editor_data)) draft.editor_data = {};
    if (!isPlainObject(draft.editor_data.story_tree)) draft.editor_data.story_tree = {};
    if (!isPlainObject(draft.editor_data.story_tree.positions)) draft.editor_data.story_tree.positions = {};
    if (!isPlainObject(draft.editor_data.story_tree.viewport)) draft.editor_data.story_tree.viewport = {
      x: 0,
      y: 0,
      zoom: 1
    };
    return draft.editor_data.story_tree;
  }
  function storyBuilderEnsureTreeLayout(draft = app.storyBuilder?.draft) {
    const tree = storyBuilderTreeEditorData(draft);
    tree.viewport.x = Number.isFinite(Number(tree.viewport.x)) ? Number(tree.viewport.x) : 0;
    tree.viewport.y = Number.isFinite(Number(tree.viewport.y)) ? Number(tree.viewport.y) : 0;
    tree.viewport.zoom = clamp(Number(tree.viewport.zoom) || 1, STORY_BUILDER_TREE_ZOOM_MIN, STORY_BUILDER_TREE_ZOOM_MAX);
    return tree;
  }
  function storyBuilderNodeClass(objective, selectedId, warnings = new Set()) {
    const classes = ["story-builder-graph-node"];
    if (objectiveIsSide(objective)) classes.push("side");
    if (objectiveCompletionControl(objective) === "choice") classes.push("choice");else if (objectiveCompletionControl(objective) === "ai") classes.push("ai");
    if (/^(hidden|locked|future)$/i.test(String(objective.status || ""))) classes.push("locked");
    if (objectiveIsComplete(objective)) classes.push("complete");
    if (String(objective.id || "") === String(selectedId || "")) classes.push("selected");
    if (warnings.has(String(objective.id || ""))) classes.push("warning");
    return classes.join(" ");
  }
  function storyBuilderObjectiveIcon(objective = {}) {
    if (objectiveCompletionControl(objective) === "choice") return "&#9672;";
    if (objectiveCompletionControl(objective) === "ai") return "&#9881;";
    if (objectiveIsSide(objective)) return "&#9734;";
    if (objectiveIsComplete(objective)) return "&#10003;";
    return "&#9679;";
  }
  function storyBuilderGraphBehaviorColor(objective = {}) {
    if (objectiveCompletionControl(objective) === "choice") return "#f0c66b";
    if (objectiveCompletionControl(objective) === "ai") return "#7db5ff";
    if (objectiveAutoCompletesWhenReady(objective)) return "#a47dff";
    return "#6fcf97";
  }
  function storyBuilderGraphFillColor(objective = {}, warnings = new Set()) {
    const id = String(objective.id || "");
    if (warnings.has(id)) return "#6f1d28";
    return objectiveIsSide(objective) ? "#4a4f59" : "#05080d";
  }
  
