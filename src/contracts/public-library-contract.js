const SUPABASE_PUBLIC_SEARCH_ROW_FIELDS = Object.freeze([
    "id", "type", "definition_id", "title", "description", "name",
    "creator", "creator_id", "creation_tool", "source", "genres",
    "kink_tags", "nsfw", "loli", "rating_total", "rating_count",
    "rating_average", "created_at", "updated_at", "player_select",
    "player_option_count", "main_objective_count", "side_objective_count",
    "future_character_count", "starting_party_member_count",
    "starting_npc_count", "gender", "fallback_gender", "male_name",
    "non_male_name", "male_image_url", "non_male_image_url", "age",
    "species", "role", "voice_gender", "current_version_id",
    "payload_url", "payload_sha256", "payload_size_bytes", "image_url",
    "user_rating", "ordering_value",
]);

const SUPABASE_PUBLIC_ITEM_ROW_FIELDS = Object.freeze([
    "id", "owner_user_id", "type", "definition_id", "slug", "title", "description",
    "name", "male_name", "non_male_name", "male_image_url",
    "non_male_image_url", "creator", "creator_id", "source", "creation_tool",
    "genres", "kink_tags", "nsfw", "loli", "current_version_id",
    "visibility", "rating_count", "rating_average", "player_select",
    "player_option_count", "main_objective_count", "side_objective_count",
    "future_character_count", "starting_party_member_count",
    "starting_npc_count", "gender", "fallback_gender", "age", "species",
    "role", "voice_gender", "hidden_reason", "updated_at",
]);

const SUPABASE_PUBLIC_VERSION_ROW_FIELDS = Object.freeze([
    "id", "item_id", "version_number", "payload_url", "payload_sha256",
    "payload_size_bytes", "image_url", "metadata_snapshot", "change_summary",
    "created_at",
]);

const SUPABASE_PUBLIC_VERSION_METADATA_FIELDS = Object.freeze([
    "type", "definition_id", "slug", "title", "description", "name",
    "male_name", "non_male_name", "male_image_url", "non_male_image_url",
    "creator", "creator_id", "source", "creation_tool", "genres", "kink_tags",
    "nsfw", "loli", "player_select", "player_option_count",
    "main_objective_count", "side_objective_count", "future_character_count",
    "starting_party_member_count", "starting_npc_count", "gender",
    "fallback_gender", "age", "species", "role", "voice_gender", "updated_at",
]);

const SUPABASE_PUBLIC_UPLOADER_POLICY_ROW_FIELDS = Object.freeze([
    "story_cap", "character_cap", "banned", "ban_reason",
]);

function validateSupabasePublicUploaderPolicyRow(row, path = "public_uploader_policy_row") {
    if (row == null || typeof row !== "object" || Array.isArray(row))
        throw new Error(`${path} must be an object.`);
    const allowed = new Set(SUPABASE_PUBLIC_UPLOADER_POLICY_ROW_FIELDS);
    for (const field of Object.keys(row))
        if (!allowed.has(field))
            throw new Error(`${path}.${field} is not an approved field.`);
    for (const field of SUPABASE_PUBLIC_UPLOADER_POLICY_ROW_FIELDS)
        if (!Object.hasOwn(row, field))
            throw new Error(`${path}.${field} is required.`);
    for (const field of ["story_cap", "character_cap"])
        if (!Number.isSafeInteger(row[field]) || row[field] < 0)
            throw new Error(`${path}.${field} must be a nonnegative safe integer.`);
    if (typeof row.banned !== "boolean")
        throw new Error(`${path}.banned must be true or false.`);
    if (row.ban_reason !== null && typeof row.ban_reason !== "string")
        throw new Error(`${path}.ban_reason must be text or null.`);
    return row;
}

function validateSupabasePublicSearchRow(row, path = "public_search_row") {
    if (row == null || typeof row !== "object" || Array.isArray(row))
        throw new Error(`${path} must be an object.`);
    const allowed = new Set(SUPABASE_PUBLIC_SEARCH_ROW_FIELDS);
    for (const field of Object.keys(row))
        if (!allowed.has(field))
            throw new Error(`${path}.${field} is not an approved field.`);
    for (const field of SUPABASE_PUBLIC_SEARCH_ROW_FIELDS)
        if (!Object.hasOwn(row, field))
            throw new Error(`${path}.${field} is required.`);
    for (const field of [
        "id", "type", "definition_id", "creator", "creator_id",
        "creation_tool", "created_at", "updated_at",
        "current_version_id", "payload_url", "ordering_value",
    ])
        if (typeof row[field] !== "string" || !row[field])
            throw new Error(`${path}.${field} must be non-empty text.`);
    if (typeof row.source !== "string")
        throw new Error(`${path}.source must be text.`);
    for (const field of ["genres", "kink_tags"])
        if (!Array.isArray(row[field]) || row[field].some((value) => typeof value !== "string"))
            throw new Error(`${path}.${field} must be an array of text values.`);
    for (const field of ["nsfw", "loli", "player_select"])
        if (typeof row[field] !== "boolean")
            throw new Error(`${path}.${field} must be true or false.`);
    for (const field of [
        "rating_total", "rating_count", "rating_average", "player_option_count",
        "main_objective_count", "side_objective_count", "future_character_count",
        "starting_party_member_count", "starting_npc_count",
    ])
        if (typeof row[field] !== "number" || !Number.isFinite(row[field]))
            throw new Error(`${path}.${field} must be a finite number.`);
    if (row.type !== "story" && row.type !== "character")
        throw new Error(`${path}.type must be exactly "story" or "character".`);
    if (row.type === "story" && (typeof row.title !== "string" || !row.title))
        throw new Error(`${path}.title is required for a story row.`);
    if (row.type === "character" && (typeof row.name !== "string" || !row.name))
        throw new Error(`${path}.name is required for a character row.`);
    for (const field of [
        "title", "description", "name", "fallback_gender", "male_name",
        "non_male_name", "male_image_url", "non_male_image_url", "species",
        "role", "voice_gender", "payload_sha256", "image_url",
    ])
        if (row[field] !== null && typeof row[field] !== "string")
            throw new Error(`${path}.${field} must be text or null.`);
    for (const field of ["age", "payload_size_bytes", "user_rating"])
        if (row[field] !== null && (typeof row[field] !== "number" || !Number.isFinite(row[field])))
            throw new Error(`${path}.${field} must be a finite number or null.`);
    return row;
}

function validateSupabasePublicItemRow(row, path = "public_item_row") {
    if (row == null || typeof row !== "object" || Array.isArray(row))
        throw new Error(`${path} must be an object.`);
    const allowed = new Set(SUPABASE_PUBLIC_ITEM_ROW_FIELDS);
    for (const field of Object.keys(row))
        if (!allowed.has(field))
            throw new Error(`${path}.${field} is not an approved field.`);
    for (const field of SUPABASE_PUBLIC_ITEM_ROW_FIELDS)
        if (!Object.hasOwn(row, field))
            throw new Error(`${path}.${field} is required.`);
    for (const field of [
        "id", "owner_user_id", "type", "definition_id", "slug", "creator", "creator_id",
        "creation_tool", "visibility", "updated_at",
    ])
        if (typeof row[field] !== "string" || !row[field])
            throw new Error(`${path}.${field} must be non-empty text.`);
    if (typeof row.source !== "string")
        throw new Error(`${path}.source must be text.`);
    if (row.type !== "story" && row.type !== "character")
        throw new Error(`${path}.type must be exactly "story" or "character".`);
    if (row.type === "story" && (typeof row.title !== "string" || !row.title))
        throw new Error(`${path}.title is required for a story row.`);
    if (row.type === "character" && (typeof row.name !== "string" || !row.name))
        throw new Error(`${path}.name is required for a character row.`);
    for (const field of ["genres", "kink_tags"])
        if (!Array.isArray(row[field]) || row[field].some((value) => typeof value !== "string"))
            throw new Error(`${path}.${field} must be an array of text values.`);
    for (const field of ["nsfw", "loli", "player_select"])
        if (typeof row[field] !== "boolean")
            throw new Error(`${path}.${field} must be true or false.`);
    if (
        typeof row.rating_average !== "number" ||
        !Number.isFinite(row.rating_average) ||
        row.rating_average < 0 ||
        row.rating_average > 10
    )
        throw new Error(`${path}.rating_average must be a finite number from 0 through 10.`);
    for (const field of [
        "rating_count", "player_option_count", "main_objective_count",
        "side_objective_count", "future_character_count",
        "starting_party_member_count", "starting_npc_count",
    ])
        if (!Number.isSafeInteger(row[field]) || row[field] < 0)
            throw new Error(`${path}.${field} must be a nonnegative safe integer.`);
    for (const field of [
        "title", "description", "name", "male_name", "non_male_name",
        "male_image_url", "non_male_image_url", "gender", "fallback_gender",
        "species", "role", "voice_gender", "hidden_reason", "current_version_id",
    ])
        if (row[field] !== null && typeof row[field] !== "string")
            throw new Error(`${path}.${field} must be text or null.`);
    if (row.age !== null && (!Number.isSafeInteger(row.age) || row.age < 0))
        throw new Error(`${path}.age must be a nonnegative safe integer or null.`);
    return row;
}

function validateSupabasePublicVersionRow(row, path = "public_version_row") {
    if (row == null || typeof row !== "object" || Array.isArray(row))
        throw new Error(`${path} must be an object.`);
    const allowed = new Set(SUPABASE_PUBLIC_VERSION_ROW_FIELDS);
    for (const field of Object.keys(row))
        if (!allowed.has(field))
            throw new Error(`${path}.${field} is not an approved field.`);
    for (const field of SUPABASE_PUBLIC_VERSION_ROW_FIELDS)
        if (!Object.hasOwn(row, field))
            throw new Error(`${path}.${field} is required.`);
    for (const field of ["id", "item_id", "payload_url", "change_summary", "created_at"])
        if (typeof row[field] !== "string" || !row[field])
            throw new Error(`${path}.${field} must be non-empty text.`);
    if (!Number.isSafeInteger(row.version_number) || row.version_number < 1)
        throw new Error(`${path}.version_number must be a positive safe integer.`);
    for (const field of ["payload_sha256", "image_url"])
        if (row[field] !== null && typeof row[field] !== "string")
            throw new Error(`${path}.${field} must be text or null.`);
    if (row.metadata_snapshot !== null)
        validateSupabasePublicVersionMetadataSnapshot(
            row.metadata_snapshot,
            `${path}.metadata_snapshot`,
        );
    if (
        row.payload_size_bytes !== null &&
        (!Number.isSafeInteger(row.payload_size_bytes) || row.payload_size_bytes < 0)
    )
        throw new Error(`${path}.payload_size_bytes must be a nonnegative safe integer or null.`);
    return row;
}

function validateSupabasePublicVersionMetadataSnapshot(
    snapshot,
    path = "public_version_metadata_snapshot",
) {
    if (snapshot == null || typeof snapshot !== "object" || Array.isArray(snapshot))
        throw new Error(`${path} must be an object.`);
    const allowed = new Set(SUPABASE_PUBLIC_VERSION_METADATA_FIELDS);
    for (const field of Object.keys(snapshot))
        if (!allowed.has(field))
            throw new Error(`${path}.${field} is not an approved field.`);
    for (const field of SUPABASE_PUBLIC_VERSION_METADATA_FIELDS)
        if (!Object.hasOwn(snapshot, field))
            throw new Error(`${path}.${field} is required.`);
    const item = {
        id: "00000000-0000-4000-8000-000000000001",
        owner_user_id: "00000000-0000-4000-8000-000000000002",
        current_version_id: null,
        visibility: "public",
        rating_count: 0,
        rating_average: 0,
        hidden_reason: null,
        ...snapshot,
    };
    validateSupabasePublicItemRow(item, path);
    return snapshot;
}
