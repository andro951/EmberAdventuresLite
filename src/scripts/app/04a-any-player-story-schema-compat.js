
        // Character-attached stories follow the current Story skill contract:
        // arbitrary-player stories may omit a fallback player/player list, and
        // several state fields are optional when the runtime does not need them.
        // Keep the canonical validator strict for malformed values that are
        // present; only suppress "missing" errors for fields the authored schema
        // explicitly permits authors to omit. This does not mutate or repair the
        // imported definition.
        const strictValidateStoryDefinitionForAnyPlayerSchemaCompat =
            validateStoryDefinition;

        function storyDefinitionOmittedOptionalFieldError(
            template = {},
            error = {},
        ) {
            if (!isPlainObject(template)) return false;
            const state = isPlainObject(template.state) ? template.state : {};
            const path = String(error?.path || "");

            if (
                path === "storyTemplate.any_player_starting_state" &&
                !Object.hasOwn(template, "any_player_starting_state")
            )
                return true;

            if (
                path === "state.players" &&
                !Object.hasOwn(state, "players")
            )
                return true;

            if (
                path === "state.story_inventory" &&
                !Object.hasOwn(state, "story_inventory")
            )
                return true;

            if (
                path === "state.player" &&
                !Object.hasOwn(state, "player") &&
                template.allow_any_player === true &&
                (
                    !Object.hasOwn(state, "players") ||
                    (Array.isArray(state.players) && state.players.length === 0)
                )
            )
                return true;

            return false;
        }

        validateStoryDefinition = function (template = {}) {
            const result = strictValidateStoryDefinitionForAnyPlayerSchemaCompat(
                template,
            );
            const errors = (result.errors || []).filter(
                (error) =>
                    !storyDefinitionOmittedOptionalFieldError(template, error),
            );
            return validationResult(errors, result.warnings || []);
        };
