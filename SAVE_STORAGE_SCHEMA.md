# EmberAdventuresLite storage schema

Generated from the executable contract built from `SAVE_STORAGE_SCHEMA_JSON.txt`. That source and the canonical validators own exact shapes; this document is a field/index inventory, not a separate validator.

Database: `EmberAdventuresLiteRuntimeV2`. Stores: 77.

Definitions carry `lite: true`; mutable runtime records keep only the documented Lite fields. Story and character bodies, compiled graphs, shared assets, profiles, and save records retain separate ownership.

## storyDefinitions

Key: `["storyId","revisionId"]`.

Indexes: `byTitle`: `"title"`; `byCreatorId`: `"creator_id"`; `byGenre`: `"genres"`.

| Field | Type | Required |
| --- | --- | --- |
| `lite` | boolean | yes |
| `storyId` | string | yes |
| `revisionId` | string | yes |
| `contentHash` | string | yes |
| `title` | string | yes |
| `description` | string | no |
| `source` | string | yes |
| `creator` | string | no |
| `creator_id` | string | no |
| `creation_tool` | string | yes |
| `genres` | array | yes |
| `createdAt` | string | yes |
| `updatedAt` | string | yes |
| `allow_any_player` | boolean | no |
| `any_player_starting_state` | object | yes |
| `state` | object | yes |
| `messages` | array | yes |
| `default_image_model` | string | yes |
| `editor_data` | object | yes |
| `title_card_subjects` | array | yes |
| `title_card_image` | object | yes |

## compiledStoryIndexes

Key: `["storyId","revisionId"]`.

Indexes: none.

| Field | Type | Required |
| --- | --- | --- |
| `storyId` | string FK | yes |
| `revisionId` | string FK | yes |
| `compilerVersion` | number | yes |
| `definitionContentHash` | string | yes |
| `startingObjectiveId` | string FK | yes |
| `objectiveIndexById` | structured immutable value | yes |
| `incomingObjectiveIdsByObjectiveId` | structured immutable value | yes |
| `incomingTransitionGroupsByObjectiveId` | structured immutable value | yes |
| `outgoingObjectiveIdsByObjectiveId` | structured immutable value | yes |
| `requirementDependentsByKey` | structured immutable value | yes |
| `characterById` | structured immutable value | yes |
| `locationById` | structured immutable value | yes |
| `shopById` | structured immutable value | yes |
| `rewardBundleById` | structured immutable value | yes |

## storyLibraryEntries

Key: `"storyId"`.

Indexes: `byRevision`: `["storyId","revisionId"]`; `byTitle`: `"title"`; `byCreatorId`: `"creatorId"`; `byGenre`: `"genres"`.

| Field | Type | Required |
| --- | --- | --- |
| `storyId` | string | yes |
| `revisionId` | string FK | yes |
| `title` | string | yes |
| `description` | string | no |
| `source` | string | yes |
| `creation_tool` | string | no |
| `creator` | string | no |
| `creatorId` | string | no |
| `genres` | array | yes |

## authoredCharacterDefinitions

Key: `["characterId","revisionId"]`.

Indexes: `byName`: `"name"`; `byCreatorId`: `"creator_id"`; `byGenre`: `"genres"`.

| Field | Type | Required |
| --- | --- | --- |
| `lite` | boolean | yes |
| `characterId` | string | yes |
| `revisionId` | string | yes |
| `contentHash` | string | yes |
| `name` | string | yes |
| `fallback_name` | string | yes |
| `source` | string | yes |
| `creator` | string | no |
| `creator_id` | string | no |
| `creation_tool` | string | yes |
| `default_image_background` | string | no |
| `genres` | array | yes |
| `gender` | string | yes |
| `role` | string | yes |
| `created_at` | string | yes |
| `updated_at` | string | yes |
| `version` | integer | yes |
| `can_die` | boolean | yes |
| `romanceable` | boolean | yes |
| `fallback_outfits` | array | yes |
| `fallback_starting_outfit_id` | string | yes |
| `age` | integer | yes |
| `personality_description` | string | yes |
| `speech_style` | string | yes |
| `boldness` | integer | yes |
| `starting_relationship_to_player` | string | yes |
| `starting_trust` | integer | yes |
| `starting_attraction` | integer | yes |
| `starting_affection` | integer | yes |
| `starting_state_of_mind` | string | yes |
| `starting_physical_state` | string | yes |
| `starting_pose` | string | yes |
| `appearance` | object | yes |
| `outfits` | array | yes |
| `starting_outfit_id` | string | yes |
| `starting_inventory` | array | no |
| `starting_known_facts` | array | yes |
| `default_seed` | integer | yes |
| `image_prompt_config` | object | yes |
| `default_profile_image` | object | yes |
| `profile_image_presentations` | object | yes |
| `profile_images` | object | yes |
| `images` | object | yes |
| `voice` | number\|string\|null | yes |

## characterLibraryEntries

Key: `"characterId"`.

Indexes: `byRevision`: `["characterId","revisionId"]`; `byName`: `"name"`; `byCreatorId`: `"creatorId"`; `byGenre`: `"genres"`.

| Field | Type | Required |
| --- | --- | --- |
| `characterId` | string | yes |
| `revisionId` | string FK | yes |
| `name` | string | yes |
| `fallbackName` | string | yes |
| `role` | string | yes |
| `source` | string | yes |
| `creation_tool` | string | no |
| `creator` | string | no |
| `creatorId` | string | no |
| `genres` | array | yes |
| `gender` | string | yes |

## assetBlobs

Key: `"imageId"`.

Indexes: `byContentHash`: `"contentHash"`.

| Field | Type | Required |
| --- | --- | --- |
| `imageId` | string | yes |
| `blob` | Blob | yes |
| `mimeType` | string | yes |
| `byteLength` | number | yes |
| `contentHash` | string | yes |

## characterProfileImages

Key: `"imageId"`.

Indexes: `byCharacter`: `"characterId"`; `byCharacterPresentation`: `["characterId","presentation"]`; `byFavorite`: `"favorite"`.

| Field | Type | Required |
| --- | --- | --- |
| `imageId` | string | yes |
| `characterId` | string FK | yes |
| `presentation` | male \| non_male | yes |
| `favorite` | boolean | yes |
| `createdAt` | string | no |
| `source` | string | no |
| `model` | string | no |
| `seed` | number\|string\|null | no |
| `prompt` | string | no |
| `negativePrompt` | string | no |
| `url` | string | no |

## characterProfileImageSelections

Key: `["characterId","presentation"]`.

Indexes: none.

| Field | Type | Required |
| --- | --- | --- |
| `characterId` | string FK | yes |
| `presentation` | male \| non_male | yes |
| `imageId` | string FK/null | yes |

## characterImages

Key: `"imageId"`.

Indexes: `byCharacter`: `"characterId"`; `byCharacterPresentation`: `["characterId","presentation"]`; `byFavorite`: `"favorite"`.

| Field | Type | Required |
| --- | --- | --- |
| `imageId` | string | yes |
| `characterId` | string FK | yes |
| `presentation` | male \| non_male | yes |
| `favorite` | boolean | yes |
| `model` | string | no |
| `seed` | number\|string\|null | no |
| `prompt` | string | no |
| `negativePrompt` | string | no |
| `url` | string | no |

## storyItemImages

Key: `"imageId"`.

Indexes: `byStory`: `"storyId"`; `byStoryItem`: `["storyId","itemId"]`.

| Field | Type | Required |
| --- | --- | --- |
| `storyId` | string FK | yes |
| `itemId` | string | yes |
| `imageId` | string | yes |
| `model` | string | no |
| `seed` | number\|string\|null | no |
| `prompt` | string | no |
| `negativePrompt` | string | no |
| `url` | string | no |

## storyItemImageSelections

Key: `["storyId","itemId"]`.

Indexes: none.

| Field | Type | Required |
| --- | --- | --- |
| `storyId` | string FK | yes |
| `itemId` | string | yes |
| `imageId` | string FK/null | yes |

## storyOutfitImages

Key: `"imageId"`.

Indexes: `byStory`: `"storyId"`; `byStoryOutfit`: `["storyId","characterId","outfitId"]`.

| Field | Type | Required |
| --- | --- | --- |
| `storyId` | string FK | yes |
| `characterId` | string FK | yes |
| `outfitId` | string | yes |
| `imageId` | string | yes |
| `model` | string | no |
| `seed` | number\|string\|null | no |
| `prompt` | string | no |
| `negativePrompt` | string | no |
| `url` | string | no |

## storyOutfitImageSelections

Key: `["storyId","characterId","outfitId"]`.

Indexes: none.

| Field | Type | Required |
| --- | --- | --- |
| `storyId` | string FK | yes |
| `characterId` | string FK | yes |
| `outfitId` | string | yes |
| `imageId` | string FK/null | yes |

## storyTitleImages

Key: `"imageId"`.

Indexes: `byStory`: `"storyId"`.

| Field | Type | Required |
| --- | --- | --- |
| `storyId` | string FK | yes |
| `storyTitle` | string | no |
| `imageId` | string | yes |
| `source` | string | no |
| `model` | string | no |
| `seed` | number\|string\|null | no |
| `prompt` | string | no |
| `negativePrompt` | string | no |
| `favorite` | boolean | no |
| `upload_attestation_classification` | string | no |
| `upload_attested_by` | string | no |
| `upload_attested_at` | string | no |
| `upload_attestation_policy_version` | integer | no |
| `url` | string | no |

## storyTitleImageSelections

Key: `"storyId"`.

Indexes: none.

| Field | Type | Required |
| --- | --- | --- |
| `storyId` | string FK | yes |
| `imageId` | string FK/null | yes |

## storyRewardImages

Key: `"imageId"`.

Indexes: `byStory`: `"storyId"`; `byStoryReward`: `["storyId","rewardImageId"]`.

| Field | Type | Required |
| --- | --- | --- |
| `storyId` | string FK | yes |
| `rewardImageId` | string | yes |
| `imageId` | string | yes |
| `title` | string | no |
| `model` | string | no |
| `seed` | number\|string\|null | no |
| `prompt` | string | no |
| `negativePrompt` | string | no |
| `url` | string | no |

## saveHeaders

Key: `"saveId"`.

Indexes: `byStoryRevision`: `["storyId","revisionId"]`; `byCreatedAt`: `"createdAt"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number | yes |
| `storyId` | string FK | yes |
| `revisionId` | string FK | yes |
| `playerCharacterId` | string FK | yes |
| `displayName` | string | yes |
| `storyGuidance` | string | no |
| `titleImageId` | string FK | no |
| `createdAt` | number | yes |

## saveCommitState

Key: `"saveId"`.

Indexes: `byTime`: `"time"`; `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `sesNum` | number | yes |
| `comId` | number | yes |
| `isOpen` | boolean | yes |
| `time` | number | yes |

## saveCharacterDefinitions

Key: `["saveId","characterId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `characterId` | string | yes |
| `definitionType` | humanoid \| animal | yes |
| `name` | string | yes |
| `species` | string | yes |
| `physicalDescription` | string | yes |
| `canDie` | boolean | yes |
| `age` | number | yes |
| `gender` | string | yes |
| `personalityDescription` | string | yes |
| `speechStyle` | string | yes |
| `boldness` | number/string | yes |

## characterAppearance

Key: `["saveId","characterId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `characterId` | string FK | yes |
| `species` | string | yes |
| `height` | number/string | yes |
| `shoulderWidth` | number/string | yes |
| `chest` | number/string | yes |
| `upperBodyBuild` | number/string | yes |
| `midsectionBuild` | number/string | yes |
| `hipWidth` | number/string | yes |
| `buttBuild` | number/string | yes |
| `lowerBodyBuild` | number/string | yes |
| `armLength` | number/string | yes |
| `legLength` | number/string | yes |
| `skinColor` | string | yes |
| `eyeColor` | string | yes |
| `hairColor` | string | yes |
| `hairLength` | string | yes |
| `hairType` | string | yes |
| `extraDescription` | string | no |
| `extraDescriptionLowerBody` | string | no |
| `maleOnlyExtraDescription` | string/null | no |
| `nonMaleOnlyExtraDescription` | string/null | no |
| `nonhumanLowerBody` | boolean | yes |

## characterSettings

Key: `["saveId","characterId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `characterId` | string FK | yes |
| `voice` | string | no |
| `imageSeedEnabled` | boolean | yes |
| `imageSeed` | number | yes |
| `profileModelOverride` | string | no |

## characterDurableState

Key: `["saveId","characterId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `characterId` | string FK | yes |
| `role` | string | yes |
| `relationshipToPlayer` | string | yes |
| `activeOutfitId` | string/null | no |

## characterRelationshipStats

Key: `["saveId","characterId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `characterId` | string FK | yes |
| `trust` | number | yes |
| `attraction` | number | yes |
| `affection` | number | yes |

## characterStats

Key: `["saveId","characterId","statId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `characterId` | string FK | yes |
| `statId` | string | yes |
| `value` | number/string/boolean/null | yes |

## characterFacts

Key: `["saveId","characterId","factId"]`.

Indexes: `byCharacterSequence`: `["saveId","characterId","sequence"]`; `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `characterId` | string FK | yes |
| `factId` | string | yes |
| `sequence` | number | yes |
| `text` | string | yes |

## characterSceneState

Key: `["saveId","characterId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `characterId` | string FK | yes |
| `stateOfMind` | string | yes |
| `physicalState` | string | yes |
| `pose` | string | yes |

## partyMembers

Key: `["saveId","characterId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `characterId` | string FK | yes |

## items

Key: `["saveId","itemId"]`.

Indexes: `byCharacter`: `["saveId","characterId"]`; `byCharacterSlot`: `["saveId","characterId","slot"]`; `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `itemId` | string | yes |
| `characterId` | string FK | yes |
| `name` | string | yes |
| `type` | string | yes |
| `slot` | clothing slot \| hand \| null | yes |
| `quantity` | number | yes |
| `inventorySequence` | number | no |
| `value` | number | yes |
| `sellable` | boolean | yes |
| `questItem` | boolean | yes |
| `description` | string | yes |
| `imageId` | string FK/null | no |

## characterOutfits

Key: `["saveId","characterId","outfitId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `characterId` | string FK | yes |
| `outfitId` | string | yes |
| `name` | string | yes |
| `formality` | number | yes |
| `origin` | string | yes |
| `memory` | string | yes |
| `sourceShopId` | string | yes |
| `sourceOutfitId` | string | yes |
| `imagePrompt` | string | yes |
| `imageId` | string | yes |
| `contexts` | array | no |
| `hat` | string FK/null | yes |
| `hairAccessory` | string FK/null | yes |
| `face` | string FK/null | yes |
| `ears` | string FK/null | yes |
| `neck` | string FK/null | yes |
| `shoulders` | string FK/null | yes |
| `bra` | string FK/null | yes |
| `undershirt` | string FK/null | yes |
| `shirt` | string FK/null | yes |
| `overShirt` | string FK/null | yes |
| `coat` | string FK/null | yes |
| `back` | string FK/null | yes |
| `hands` | string FK/null | yes |
| `rightWrist` | string FK/null | yes |
| `leftWrist` | string FK/null | yes |
| `rightFingers` | string FK/null | yes |
| `leftFingers` | string FK/null | yes |
| `waist` | string FK/null | yes |
| `beltAccessory` | string FK/null | yes |
| `underwear` | string FK/null | yes |
| `pants` | string FK/null | yes |
| `skirt` | string FK/null | yes |
| `legwear` | string FK/null | yes |
| `socks` | string FK/null | yes |
| `feet` | string FK/null | yes |
| `otherAccessory` | string FK/null | yes |
| `leftHand` | string FK/null | yes |
| `rightHand` | string FK/null | yes |

## equippedItems

Key: `["saveId","characterId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `characterId` | string FK | yes |
| `hat` | string FK/null | yes |
| `hairAccessory` | string FK/null | yes |
| `face` | string FK/null | yes |
| `ears` | string FK/null | yes |
| `neck` | string FK/null | yes |
| `shoulders` | string FK/null | yes |
| `bra` | string FK/null | yes |
| `undershirt` | string FK/null | yes |
| `shirt` | string FK/null | yes |
| `overShirt` | string FK/null | yes |
| `coat` | string FK/null | yes |
| `back` | string FK/null | yes |
| `hands` | string FK/null | yes |
| `rightWrist` | string FK/null | yes |
| `leftWrist` | string FK/null | yes |
| `rightFingers` | string FK/null | yes |
| `leftFingers` | string FK/null | yes |
| `waist` | string FK/null | yes |
| `beltAccessory` | string FK/null | yes |
| `underwear` | string FK/null | yes |
| `pants` | string FK/null | yes |
| `skirt` | string FK/null | yes |
| `legwear` | string FK/null | yes |
| `socks` | string FK/null | yes |
| `feet` | string FK/null | yes |
| `otherAccessory` | string FK/null | yes |
| `leftHand` | string FK/null | yes |
| `rightHand` | string FK/null | yes |

## temporaryRemovedItems

Key: `["saveId","characterId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `characterId` | string FK | yes |
| `hat` | string FK/null | yes |
| `hairAccessory` | string FK/null | yes |
| `face` | string FK/null | yes |
| `ears` | string FK/null | yes |
| `neck` | string FK/null | yes |
| `shoulders` | string FK/null | yes |
| `bra` | string FK/null | yes |
| `undershirt` | string FK/null | yes |
| `shirt` | string FK/null | yes |
| `overShirt` | string FK/null | yes |
| `coat` | string FK/null | yes |
| `back` | string FK/null | yes |
| `hands` | string FK/null | yes |
| `rightWrist` | string FK/null | yes |
| `leftWrist` | string FK/null | yes |
| `rightFingers` | string FK/null | yes |
| `leftFingers` | string FK/null | yes |
| `waist` | string FK/null | yes |
| `beltAccessory` | string FK/null | yes |
| `underwear` | string FK/null | yes |
| `pants` | string FK/null | yes |
| `skirt` | string FK/null | yes |
| `legwear` | string FK/null | yes |
| `socks` | string FK/null | yes |
| `feet` | string FK/null | yes |
| `otherAccessory` | string FK/null | yes |
| `leftHand` | string FK/null | yes |
| `rightHand` | string FK/null | yes |

## sceneRuntime

Key: `"saveId"`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `summary` | string | yes |
| `imageAction` | string | yes |

## sceneMembers

Key: `["saveId","characterId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `characterId` | string FK | yes |

## sceneImageTargets

Key: `["saveId","characterId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `characterId` | string FK | yes |

## worldValues

Key: `["saveId","fieldId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `fieldId` | string | yes |
| `value` | bounded value | yes |

## currentLocation

Key: `"saveId"`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `locationId` | string FK | yes |

## runtimeLocationDefinitions

Key: `["saveId","locationId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `locationId` | string | yes |
| `name` | string | yes |
| `type` | string | yes |
| `scale` | string | yes |
| `parentId` | string FK/null | yes |
| `x` | number | yes |
| `y` | number | yes |
| `summary` | string | yes |

## locationRuntime

Key: `["saveId","locationId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `locationId` | string FK | yes |
| `discovered` | boolean | no |
| `travelEnabled` | boolean | no |

## locationConnections

Key: `["saveId","fromLocationId","toLocationId"]`.

Indexes: `byDestination`: `["saveId","toLocationId"]`; `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `fromLocationId` | string FK | yes |
| `toLocationId` | string FK | yes |
| `present` | boolean | yes |

## gameTime

Key: `"saveId"`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `year` | number | yes |
| `month` | number | yes |
| `day` | number | yes |
| `hour` | number | yes |
| `minute` | number | yes |
| `elapsedMinutes` | number | yes |

## timedEventRuntime

Key: `["saveId","timedEventId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `timedEventId` | string FK | yes |
| `status` | waiting \| active \| ready \| complete \| cancelled \| declined \| missed | yes |
| `startElapsedMinutes` | number/null | yes |

## timedEventAppliedStages

Key: `["saveId","timedEventId","stageId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `timedEventId` | string FK | yes |
| `stageId` | string | yes |

## storyValues

Key: `["saveId","root","pathKey"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `root` | string | yes |
| `pathKey` | string | yes |
| `value` | number/string/boolean/null | yes |

## storyListItems

Key: `["saveId","root","listPathKey","itemKey"]`.

Indexes: `byListSequence`: `["saveId","root","listPathKey","sequence"]`; `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `root` | string | yes |
| `listPathKey` | string | yes |
| `itemKey` | string | yes |
| `sequence` | number/null | no |
| `value` | bounded value | yes |

## storyMapEntries

Key: `["saveId","root","mapPathKey","entryKey"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `root` | string | yes |
| `mapPathKey` | string | yes |
| `entryKey` | string | yes |
| `value` | bounded value | yes |

## storyMemoryNotes

Key: `["saveId","category","noteId"]`.

Indexes: `byCategorySequence`: `["saveId","category","sequence"]`; `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `category` | world_notes \| unresolved_threads \| relationship_notes \| rules_and_constraints \| ai_private_notes | yes |
| `noteId` | string | yes |
| `sequence` | number | yes |
| `text` | string | yes |

## recentChanges

Key: `["saveId","changeRecordId"]`.

Indexes: `bySequence`: `["saveId","sequence"]`; `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `changeRecordId` | string | yes |
| `sequence` | number | yes |
| `text` | string | yes |

## storyRuleAdds

Key: `["saveId","ruleId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `ruleId` | string | yes |
| `text` | string | yes |

## storyRuleRemovals

Key: `["saveId","ruleId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `ruleId` | string FK | yes |

## objectiveControl

Key: `"saveId"`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `activeMainObjectiveId` | string FK/null | yes |
| `focusedSideObjectiveId` | string FK/null | yes |

## pendingObjectiveRouteChoices

Key: `["saveId","choiceId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `choiceId` | string | yes |
| `reason` | string | yes |
| `completedObjectiveId` | string FK | yes |

## pendingObjectiveRouteOptions

Key: `["saveId","choiceId","objectiveId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `choiceId` | string FK | yes |
| `objectiveId` | string FK | yes |

## objectiveRuntime

Key: `["saveId","objectiveId"]`.

Indexes: `byStatus`: `["saveId","status"]`; `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `objectiveId` | string FK | yes |
| `status` | active \| hidden \| locked \| future \| queued \| complete | no |
| `selectedOutputId` | string FK/null | no |
| `selectedOutputMessageId` | string FK/null | no |
| `activationAiCheckAttempted` | boolean | no |
| `activationNumber` | number | no |

## objectiveProgressNotes

Key: `["saveId","objectiveId","noteId"]`.

Indexes: `byObjectiveSequence`: `["saveId","objectiveId","sequence"]`; `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `objectiveId` | string FK | yes |
| `noteId` | string | yes |
| `sequence` | number | yes |
| `text` | string | yes |

## objectiveExclusiveGroupChoices

Key: `["saveId","groupId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `groupId` | string | yes |
| `selectedObjectiveId` | string FK | yes |

## pendingRewardChoices

Key: `["saveId","choiceId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `choiceId` | string | yes |
| `objectiveId` | string FK | yes |
| `kind` | string | yes |
| `reward` | structured value | yes |

## pendingRewardChoiceOptions

Key: `["saveId","choiceId","characterId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `choiceId` | string FK | yes |
| `characterId` | string FK | yes |

## rewardInvocations

Key: `["saveId","invocationId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `invocationId` | string | yes |
| `appliedAt` | string | yes |
| `sourceType` | string | yes |
| `sourceId` | string | yes |

## futureCharacters

Key: `["saveId","characterId"]`.

Indexes: `byStatus`: `["saveId","status"]`; `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `characterId` | string FK | yes |
| `status` | string | no |
| `unlockedBy` | string | no |
| `lastTriggeredReason` | string | no |
| `locationId` | string FK/null | no |

## npcShells

Key: `["saveId","characterId"]`.

Indexes: `byLocation`: `["saveId","locationId"]`; `byStatus`: `["saveId","status"]`; `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `locationId` | string FK | yes |
| `characterId` | string FK | yes |
| `name` | string | no |
| `playerKnownName` | boolean | no |
| `playerFacingLabel` | string | no |
| `gender` | string | no |
| `age` | number | no |
| `role` | string | no |
| `relationshipToPlayer` | string | no |
| `note` | string | no |
| `personalityDescription` | string | no |
| `greeting` | string | no |
| `currentAppearance` | string | no |
| `canDie` | boolean | yes |
| `recruitable` | boolean | yes |
| `everInvited` | boolean | yes |
| `futureCharacterId` | string FK/null | no |
| `status` | alive \| dead | yes |
| `deathNote` | string | no |
| `killedBy` | string | no |
| `killedByPlayer` | boolean | yes |
| `inspected` | boolean | yes |

## generatedNpcPoolEntries

Key: `["saveId","poolEntryId"]`.

Indexes: `byCharacter`: `["saveId","characterId"]`; `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `poolEntryId` | string | yes |
| `characterId` | string FK | yes |

## temporarySpeakers

Key: `["saveId","temporarySpeakerId"]`.

Indexes: `byFirstSeenMessage`: `["saveId","firstSeenMessageId"]`; `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `temporarySpeakerId` | string | yes |
| `name` | string | yes |
| `gender` | male \| female \| neutral | yes |
| `voice` | string | yes |
| `firstSeenMessageId` | string/number/null | yes |

## messages

Key: `["saveId","messageId"]`.

Indexes: `bySequence`: `["saveId","sequence"]`; `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `messageId` | string | yes |
| `sequence` | number | yes |
| `role` | string | yes |
| `speaker` | string | yes |
| `text` | string | yes |
| `detail` | string | yes |
| `at` | string | yes |
| `stateSyncStatus` | string | no |
| `autoTurn` | boolean | no |
| `autoRead` | boolean | no |
| `replySource` | string | no |
| `generationStopped` | boolean | no |
| `objectiveComplete` | boolean | no |
| `choiceObjectiveId` | string FK | no |
| `choiceSnapshotId` | string FK | no |
| `stateBackupId` | string FK | no |

## messageRelations

Key: `["saveId","messageId","relatedMessageId"]`.

Indexes: `byRelatedMessage`: `["saveId","relatedMessageId"]`; `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `messageId` | string FK | yes |
| `relatedMessageId` | string FK | yes |

## messageVoiceData

Key: `["saveId","messageId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `messageId` | string FK | yes |
| `voiceMeta` | structured value | no |
| `voiceText` | string | no |

## storyImages

Key: `["saveId","imageId"]`.

Indexes: `byRequestOrder`: `["saveId","requestOrder"]`; `byStatus`: `["saveId","status"]`; `byRequestedAfterMessage`: `["saveId","requestedAfterMessageId"]`; `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `imageId` | string | yes |
| `at` | string | yes |
| `favorite` | boolean | yes |
| `title` | string | no |
| `reason` | string | no |
| `model` | string | yes |
| `seed` | number/string/null | no |
| `prompt` | string | yes |
| `negativePrompt` | string | yes |
| `requestOrder` | number | no |
| `requestedAfterMessageId` | string FK | no |
| `status` | queued \| generating \| ready | yes |
| `hideFromChat` | boolean | no |
| `promptType` | string | no |
| `url` | string | no |

## storyImageTargets

Key: `["saveId","imageId","characterId"]`.

Indexes: `byCharacter`: `["saveId","characterId"]`; `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `imageId` | string FK | yes |
| `characterId` | string FK | yes |

## snapshots

Key: `["saveId","snapshotId"]`.

Indexes: `byCreatedAt`: `["saveId","createdAt"]`; `byMessageBoundary`: `["saveId","messageBoundaryId"]`; `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `snapshotId` | string | yes |
| `createdAt` | string | yes |
| `completedAt` | string | no |
| `reason` | string | yes |
| `type` | string | no |
| `messageBoundaryId` | string FK | yes |
| `startMessageId` | string FK | no |
| `objectiveId` | string FK | no |
| `parentObjectiveId` | string FK | no |

## snapshotRelatedMessages

Key: `["saveId","snapshotId","messageId"]`.

Indexes: `byMessage`: `["saveId","messageId"]`; `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `snapshotId` | string FK | yes |
| `messageId` | string FK | yes |

## snapshotReverseOperations

Key: `["saveId","snapshotId","operationIndex"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `snapshotId` | string FK | yes |
| `operationIndex` | number | yes |
| `targetStore` | string | yes |
| `targetKey` | structured key | yes |
| `operation` | put \| delete | yes |
| `previousRecord` | bounded record/null | no |

## shopRuntime

Key: `["saveId","shopId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `shopId` | string FK | yes |
| `unlocked` | boolean | yes |

## shopItemRuntime

Key: `["saveId","shopId","itemId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `shopId` | string FK | yes |
| `itemId` | string FK | yes |
| `quantity` | number/null | no |
| `purchaseCount` | number | no |
| `removed` | boolean | no |
| `locked` | boolean | no |
| `accepted` | boolean | no |
| `completed` | boolean | no |

## runtimeJobDefinitions

Key: `["saveId","jobId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `jobId` | string | yes |
| `definition` | structured immutable value | yes |
| `compiledIndexes` | structured immutable value | yes |

## generatedJobRuntime

Key: `["saveId","jobId"]`.

Indexes: `byStatus`: `["saveId","status"]`; `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `jobId` | string FK | yes |
| `status` | string | yes |
| `currentStepId` | string/null | yes |

## generatedJobProgressValues

Key: `["saveId","jobId","pathKey"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `jobId` | string FK | yes |
| `pathKey` | string | yes |
| `value` | number/string/boolean/null | yes |

## generatedJobCompletedSteps

Key: `["saveId","jobId","stepId"]`.

Indexes: `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `jobId` | string FK | yes |
| `stepId` | string | yes |

## storyJobOffers

Key: `["saveId","boardId","offerId"]`.

Indexes: `byBoard`: `["saveId","boardId"]`; `byAccepted`: `["saveId","accepted"]`; `bySave`: `"saveId"`.

| Field | Type | Required |
| --- | --- | --- |
| `saveId` | number FK | yes |
| `boardId` | string FK | yes |
| `offerId` | string | yes |
| `templateId` | string FK | yes |
| `title` | string | yes |
| `rank` | number | yes |
| `romanceable` | boolean | yes |
| `genres` | array | no |
| `summary` | string | yes |
| `rewardCoins` | number | yes |
| `rewardXp` | number | yes |
| `filledValues` | structured value | yes |
| `accepted` | boolean | yes |

Nested object/array fields use their exact documented subcontracts in `SAVE_STORAGE_SCHEMA_JSON.txt`. Unknown fields, wrong types, and missing required values are rejected. Shared-library transport metadata is converted at its explicit boundary and is not part of native runtime records.