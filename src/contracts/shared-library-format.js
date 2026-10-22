"use strict";

const EmberSharedLibraryFormat = (() => {
    const omittedFields = new Set([
        "nsfw", "loli", "kink_tags", "excluded_kink_tags", "kink_preferences", "ick_limits",
        "is_spicy", "allow_spicy", "adult_warning_accepted", "nsfw_has_ever_been_enabled",
        "nsfw_known_facts", "starting_nsfw_known_facts", "arousal", "starting_arousal",
        "penis_size", "spicy_mode", "intimacy_level", "sex_position", "ai_sex_position",
        "sex_acts", "spicy_clothing_restore", "manual_clothing_off", "spicySyncStatus",
        "spicyClothingSyncStatus", "nsfwMode", "forceSfw", "fallback_gender",
    ]);
    const plain = value => value !== null && typeof value === "object" && !Array.isArray(value);
    const definition = value => plain(value) && typeof value.name === "string" && (
        plain(value.appearance) && Array.isArray(value.outfits) ||
        typeof value.physical_description === "string" && typeof value.species === "string"
    );
    const story = value => plain(value) && plain(value.state) && typeof value.title === "string";
    const specialGender = value => value === "futanari" || value === "futa";

    function toLite(payload) {
        if (!plain(payload))
            throw new Error("Shared library payload must be an object.");

        if (Array.isArray(payload.characters)) {
            const result = structuredClone(payload);
            result.characters = payload.characters.map(record => toLite(record));
            return result;
        }

        const principal = payload.storyTemplate || payload.character_definition || payload;
        if (!plain(principal))
            throw new Error("Shared definition must be an object.");

        if (principal.lite === true)
            return structuredClone(payload);

        if (Object.hasOwn(principal, "lite"))
            throw new Error("A Lite definition marker must be exactly true.");

        if (principal.nsfw !== false)
            throw new Error("Only a shared definition explicitly classified SFW can be imported.");

        const names = new Map();
        const sourceCharacters = new Map();
        const index = value => {
            if (!value || typeof value !== "object") return;
            if (definition(value)) {
                if (typeof value.id === "string") sourceCharacters.set(value.id, value);
                sourceCharacters.set(value.name, value);
            }
            for (const child of Object.values(value)) index(child);
        };
        index(payload);

        const convert = (value, path) => {
            if (Array.isArray(value))
                return value.map((entry, index) => convert(entry, `${path}.${index}`));

            if (!plain(value)) return value;
            if (value.nsfw === true || value.loli === true)
                throw new Error(`${path} is not classified for the shared SFW library.`);

            const source = {...value};
            if (definition(source) && specialGender(source.gender)) {
                const fallback = source.fallback_gender;
                if (fallback !== "male" && fallback !== "female")
                    throw new Error(`${path}.fallback_gender must be exactly male or female.`);

                if (fallback === "male") {
                    if (typeof source.fallback_name !== "string" || !source.fallback_name.trim())
                        throw new Error(`${path}.fallback_name is required for the male presentation.`);

                    if (!Array.isArray(source.fallback_outfits) || !source.fallback_outfits.length)
                        throw new Error(`${path}.fallback_outfits are required for the male presentation.`);

                    if (!source.fallback_outfits.some(outfit => outfit.id === source.fallback_starting_outfit_id))
                        throw new Error(`${path}.fallback_starting_outfit_id must reference an alternate outfit.`);

                    const canonicalName = source.name;
                    const canonicalOutfits = source.outfits;
                    const canonicalStartingId = source.starting_outfit_id;
                    source.name = source.fallback_name;
                    source.fallback_name = canonicalName;
                    source.outfits = source.fallback_outfits;
                    source.fallback_outfits = canonicalOutfits;
                    source.starting_outfit_id = source.fallback_starting_outfit_id;
                    source.fallback_starting_outfit_id = canonicalStartingId;
                    if (plain(source.profile_image_presentations?.male))
                        source.default_profile_image = source.profile_image_presentations.male;
                    names.set(canonicalName, source.name);
                }
                source.gender = fallback;
            }
            else if (specialGender(source.gender)) {
                const character = source.full_character || sourceCharacters.get(source.id) || sourceCharacters.get(source.name);
                const fallback = character?.fallback_gender;
                if (fallback !== "male" && fallback !== "female")
                    throw new Error(`${path} needs its authoritative character's required fallback_gender.`);

                source.gender = fallback;
            }

            if (definition(source)) {
                for (const [field, startingField] of [["outfits", "starting_outfit_id"], ["fallback_outfits", "fallback_starting_outfit_id"]]) {
                    if (!Array.isArray(source[field])) continue;
                    const excluded = source[field].filter(outfit => outfit?.nsfw === true);
                    if (excluded.some(outfit => outfit.id === source[startingField]))
                        throw new Error(`${path}.${startingField} selects an outfit outside the shared SFW library.`);

                    source[field] = source[field].filter(outfit => outfit?.nsfw !== true);
                }
            }

            const projected = {};
            for (const [key, child] of Object.entries(source)) {
                if (omittedFields.has(key)) continue;
                projected[key] = convert(
                        Array.isArray(child) && ["profile_images", "profile_images_list", "images", "title_card_images"].includes(key)
                            ? child.filter(image => image?.nsfw !== true && image?.nsfwMode !== true)
                            : child,
                        `${path}.${key}`,
                    );
            }
            if (definition(source) || story(source)) projected.lite = true;
            return projected;
        };
        const converted = convert(payload, "$shared");
        const identityFields = new Set(["id", "character_id", "definition_id", "creator_id", "revision_id"]);
        const references = (value, key = "") => {
            if (typeof value === "string")
                return identityFields.has(key) || key === "fallback_name" ? value : names.get(value) || value;

            if (Array.isArray(value)) return value.map(entry => references(entry, key));
            if (!plain(value)) return value;
            const result = {};
            for (const [childKey, child] of Object.entries(value)) {
                const namedCharacter = plain(child) && (definition(child) || plain(child.full_character));
                const nextKey = namedCharacter && names.has(childKey) ? names.get(childKey) : childKey;
                if (Object.hasOwn(result, nextKey))
                    throw new Error(`Shared presentation creates a duplicate character key ${nextKey}.`);

                result[nextKey] = references(child, childKey);
            }
            return result;
        };
        return references(converted);
    }

    function metadataToLite(value) {
        if (!plain(value) || value.nsfw !== false || value.loli !== false)
            throw new Error("Shared library metadata must be explicitly classified SFW.");

        const result = structuredClone(value);
        if (specialGender(result.gender)) {
            if (result.fallback_gender !== "male" && result.fallback_gender !== "female")
                throw new Error("Shared character metadata requires an authored fallback_gender.");

            result.gender = result.fallback_gender;
            const name = result.gender === "male" ? result.male_name : result.non_male_name;
            if (typeof name !== "string" || !name.trim())
                throw new Error("Shared character metadata requires the selected presentation name.");

            result.name = name;
            result.image_url = result.gender === "male" ? result.male_image_url : result.non_male_image_url;
        }

        for (const field of omittedFields) delete result[field];
        return result;
    }
    function searchScope() {
        return {required_kink_tags:[], excluded_kink_tags:[], include_sfw:true, include_nsfw:false, include_loli:false};
    }
    function queryScope() {
        return "nsfw=eq.false&loli=eq.false";
    }
    function publicationScope() {
        return {kink_tags:[], nsfw:false, loli:false};
    }
    function reportReasons(reasons) {
        return reasons.map(reason => reason === "inappropriate_content" ? "contains_nsfw" : reason);
    }

    return Object.freeze({toLite, metadataToLite, searchScope, queryScope, publicationScope, reportReasons});
})();

if (typeof module !== "undefined" && module.exports)
    module.exports = EmberSharedLibraryFormat;
