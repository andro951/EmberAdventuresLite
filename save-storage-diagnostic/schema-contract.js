"use strict";

self.EmberStorageSchema = {
    "databaseName": "EmberAdventuresLitePersistenceDiagnostic",
    "version": 1,
    "source": "SAVE_STORAGE_SCHEMA_JSON.txt",
    "stores": {
        "storyDefinitions": {
            "keyPath": [
                "storyId",
                "revisionId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byTitle",
                    "keyPath": "title",
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byCreatorId",
                    "keyPath": "creator_id",
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byGenre",
                    "keyPath": "genres",
                    "unique": false,
                    "multiEntry": true
                }
            ],
            "fields": {
                "lite": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": true,
                    "description": "true - Identifies the authored Lite story format. - boolean (required)"
                },
                "storyId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "the-inspector",
                    "description": "the-inspector - Stable authored story ID. - string (required)"
                },
                "revisionId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "revision-2026-08-04",
                    "description": "revision-2026-08-04 - Immutable definition revision identity. - string (required)"
                },
                "contentHash": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "7f3c9a21dbe54870",
                    "description": "7f3c9a21dbe54870 - Verifies that this immutable story revision has not changed or collided with different content. - string (required)"
                },
                "title": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "The Inspector",
                    "description": "The Inspector - Player-facing title. - string (required)"
                },
                "description": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Begin a healthier second life as the federal inspector of licensed craft guilds. Travel with an arachne assistant through a vast federation of species-shaped cities, solve local safety, labor, identity, and licensing conflicts, and choose which professional, romantic, or household relationships become part of your future.",
                    "description": "Begin a healthier second life as the federal inspector of licensed craft guilds. Travel with an arachne assistant through a vast federation of species-shaped cities, solve local safety, labor, identity, and licensing conflicts, and choose which professional, romantic, or household relationships become part of your future. - Player-facing description. - string"
                },
                "source": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Original",
                    "description": "Original - Authored source label. - string (required)"
                },
                "creator": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Isaac",
                    "description": "Isaac - Searchable public creator display name. - string"
                },
                "creator_id": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "creator-isaac",
                    "description": "creator-isaac - Stable searchable creator identity. - string"
                },
                "creation_tool": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "EmberAdventures Story Skill",
                    "description": "EmberAdventures Story Skill - Tool and model used to create the definition. - string (required)"
                },
                "genres": {
                    "required": true,
                    "kind": "array",
                    "typeSpec": "array",
                    "example": [
                        "fantasy",
                        "isekai",
                        "workplace",
                        "comedy",
                        "romance",
                        "fantasy",
                        "slice of life",
                        "adventure"
                    ],
                    "description": [
                        "fantasy - The 0 at this definition path. - string (required)",
                        "isekai - The 1 at this definition path. - string (required)",
                        "workplace - The 2 at this definition path. - string (required)",
                        "comedy - The 3 at this definition path. - string (required)",
                        "romance - The 4 at this definition path. - string (required)",
                        "fantasy - The 5 at this definition path. - string (required)",
                        "slice of life - The 6 at this definition path. - string (required)",
                        "adventure - The 7 at this definition path. - string (required)"
                    ]
                },
                "createdAt": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "2026-07-24T00:44:27Z",
                    "description": "2026-07-24T00:44:27Z - Original definition creation time. - string (required)"
                },
                "updatedAt": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "2026-07-30T00:16:43.220Z",
                    "description": "2026-07-30T00:16:43.220Z - Most recent definition update time. - string (required)"
                },
                "allow_any_player": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": true,
                    "description": "true - The allow any player at this definition path. - boolean"
                },
                "any_player_starting_state": {
                    "required": true,
                    "kind": "object",
                    "typeSpec": "object",
                    "example": {
                        "role": "Inspector candidate",
                        "starting_known_facts_to_add": [
                            "The selected library character has died prematurely and awakened before |[character:caelira-vey]| with an offered healthy adult reincarnation and optional federal appointment.",
                            "No existing identity, gender, anatomy, appearance, species, orientation, or personality is overwritten by the premise."
                        ],
                        "starting_inventory": [],
                        "stats": {},
                        "starting_state_of_mind": "alert after an unexpected reincarnation",
                        "starting_physical_state": "healthy adult reincarnated body compatible with the selected identity",
                        "starting_pose": "seated or standing in |[character:caelira-vey]|'s divine receiving room",
                        "male_outfits": [
                            {
                                "id": "inspector-travel",
                                "name": "Inspector Travel Uniform",
                                "clothing": {
                                    "undershirt": "soft charcoal cotton undershirt",
                                    "shirt": "tailored charcoal button-front shirt with violet piping",
                                    "coat": "violet-black federal inspector travel coat with a small gold insignia",
                                    "underwear": "charcoal boxer briefs",
                                    "pants": "dark tailored travel trousers",
                                    "socks": "dark wool socks",
                                    "feet": "polished black leather travel boots",
                                    "leftHand": null,
                                    "rightHand": null
                                }
                            }
                        ],
                        "male_starting_outfit_id": "inspector-travel",
                        "non_male_outfits": [
                            {
                                "id": "inspector-travel",
                                "name": "Inspector Travel Uniform",
                                "clothing": {
                                    "bra": "supportive charcoal bra",
                                    "undershirt": "soft charcoal cotton camisole",
                                    "shirt": "tailored charcoal blouse with violet piping",
                                    "coat": "violet-black federal inspector travel coat with a small gold insignia",
                                    "underwear": "charcoal fitted underwear",
                                    "pants": "dark tailored travel trousers",
                                    "socks": "dark wool socks",
                                    "feet": "polished black leather travel boots",
                                    "leftHand": null,
                                    "rightHand": null
                                }
                            }
                        ],
                        "non_male_starting_outfit_id": "inspector-travel"
                    },
                    "description": {
                        "role": "Inspector candidate - Durable character role. - string (required)",
                        "starting_known_facts_to_add": [
                            "The selected library character has died prematurely and awakened before |[character:caelira-vey]| with an offered healthy adult reincarnation and optional federal appointment. - The 0 at this definition path. - string (required)",
                            "No existing identity, gender, anatomy, appearance, species, orientation, or personality is overwritten by the premise. - The 1 at this definition path. - string (required)"
                        ],
                        "starting_inventory": [],
                        "stats": {},
                        "starting_state_of_mind": "alert after an unexpected reincarnation - Mental state copied into runtime when play begins. - string (required)",
                        "starting_physical_state": "healthy adult reincarnated body compatible with the selected identity - Physical state copied into runtime when play begins. - string (required)",
                        "starting_pose": "seated or standing in |[character:caelira-vey]|'s divine receiving room - Pose copied into runtime when play begins. - string (required)",
                        "male_outfits": [
                            {
                                "id": "inspector-travel - Stable identifier within its owning definition. - string (required)",
                                "name": "Inspector Travel Uniform - Player-facing character name. - string (required)",
                                "clothing": {
                                    "undershirt": "soft charcoal cotton undershirt - The undershirt at this definition path. - string (required)",
                                    "shirt": "tailored charcoal button-front shirt with violet piping - The shirt at this definition path. - string (required)",
                                    "coat": "violet-black federal inspector travel coat with a small gold insignia - The coat at this definition path. - string (required)",
                                    "underwear": "charcoal boxer briefs - The underwear at this definition path. - string (required)",
                                    "pants": "dark tailored travel trousers - The pants at this definition path. - string (required)",
                                    "socks": "dark wool socks - The socks at this definition path. - string (required)",
                                    "feet": "polished black leather travel boots - The feet at this definition path. - string (required)",
                                    "leftHand": "null - Exact authored hand-item description when occupied. - string/null (required)",
                                    "rightHand": "null - Exact authored hand-item description when occupied. - string/null (required)"
                                }
                            }
                        ],
                        "male_starting_outfit_id": "inspector-travel - The male starting outfit id at this definition path. - string (required)",
                        "non_male_outfits": [
                            {
                                "id": "inspector-travel - Stable identifier within its owning definition. - string (required)",
                                "name": "Inspector Travel Uniform - Player-facing character name. - string (required)",
                                "clothing": {
                                    "bra": "supportive charcoal bra - The bra at this definition path. - string (required)",
                                    "undershirt": "soft charcoal cotton camisole - The undershirt at this definition path. - string (required)",
                                    "shirt": "tailored charcoal blouse with violet piping - The shirt at this definition path. - string (required)",
                                    "coat": "violet-black federal inspector travel coat with a small gold insignia - The coat at this definition path. - string (required)",
                                    "underwear": "charcoal fitted underwear - The underwear at this definition path. - string (required)",
                                    "pants": "dark tailored travel trousers - The pants at this definition path. - string (required)",
                                    "socks": "dark wool socks - The socks at this definition path. - string (required)",
                                    "feet": "polished black leather travel boots - The feet at this definition path. - string (required)",
                                    "leftHand": "null - Exact authored hand-item description when occupied. - string/null (required)",
                                    "rightHand": "null - Exact authored hand-item description when occupied. - string/null (required)"
                                }
                            }
                        ],
                        "non_male_starting_outfit_id": "inspector-travel - The non male starting outfit id at this definition path. - string (required)"
                    }
                },
                "state": {
                    "required": true,
                    "kind": "object",
                    "typeSpec": "object",
                    "example": {
                        "meta": {
                            "story_guidance": "",
                            "story_source": {
                                "mode": "original",
                                "title": "The Inspector",
                                "description": "Original fantasy inspection journey across twenty-two species-shaped cities.",
                                "modifications": ""
                            }
                        },
                        "starting_location_id": "loc-divine-receiving-room",
                        "world_map": {
                            "locations": {
                                "loc-federal-office": {
                                    "name": "Example",
                                    "type": "place",
                                    "scale": "site",
                                    "parent_id": null,
                                    "x": 50,
                                    "y": 15,
                                    "discovered": false,
                                    "travel_enabled": false,
                                    "summary": "The professional office coordinating the Grand Harmonization Circuit.",
                                    "connections": [
                                        "loc-divine-receiving-room",
                                        "loc-city-hearthcross"
                                    ]
                                }
                            }
                        },
                        "time": {
                            "year": 1,
                            "month": 1,
                            "day": 1,
                            "hour": 9,
                            "minute": 0,
                            "elapsed_minutes": 0
                        },
                        "scene": {
                            "summary": "The player awakens in a goddess's elegant office-garden and is invited to question an honest offer of reincarnation, one supernatural gift, and an unusual government appointment.",
                            "party_members_present": [],
                            "image_characters": [
                                "player"
                            ],
                            "npcs_present": [
                                "caelira-vey"
                            ],
                            "image_action": "the newly reincarnated player seated in an elegant office-garden beneath an impossible open sky"
                        },
                        "player": {
                            "lite": true,
                            "version": 1,
                            "id": "mara-quinn",
                            "name": "Mara Quinn",
                            "source": "Player",
                            "creation_tool": "ChatGPT GPT-5.6 Thinking (high reasoning)",
                            "can_die": false,
                            "romanceable": false,
                            "gender": "female",
                            "fallback_name": "Marek Quinn",
                            "fallback_outfits": [
                                {
                                    "id": "inspector-travel",
                                    "name": "Inspector Travel Uniform",
                                    "clothing": {
                                        "undershirt": "soft deep-teal cotton undershirt",
                                        "shirt": "tailored violet-black inspector shirt with subtle gold piping",
                                        "coat": "fitted black travel coat bearing a small federal inspector insignia",
                                        "underwear": "deep-teal boxer briefs",
                                        "pants": "dark tailored travel trousers",
                                        "socks": "dark wool socks",
                                        "feet": "well-kept black leather ankle boots",
                                        "leftHand": null,
                                        "rightHand": null
                                    }
                                }
                            ],
                            "fallback_starting_outfit_id": "inspector-travel",
                            "age": 26,
                            "role": "Federal inspector",
                            "personality_description": "Curious, direct, and socially capable without being pushy. Meets strange people with an open mind, while the player decides priorities, attraction, and moral boundaries.",
                            "speech_style": "Warm, clear, and quick to ask the question everyone else avoids.",
                            "boldness": 6,
                            "starting_relationship_to_player": "self",
                            "starting_trust": 10,
                            "starting_attraction": 0,
                            "starting_affection": 0,
                            "starting_state_of_mind": "alert after an unexpected reincarnation",
                            "starting_physical_state": "healthy adult body provided by |[character:caelira-vey]|",
                            "starting_pose": "standing in the divine receiving room",
                            "appearance": {
                                "species": "Human",
                                "height": 10,
                                "shoulder_width": 10,
                                "chest": 13,
                                "upper_body_build": 8,
                                "midsection_build": 8,
                                "hip_width": 10,
                                "butt_build": 8,
                                "lower_body_build": 8,
                                "arm_length": 10,
                                "leg_length": 10,
                                "skin_color": "medium olive skin",
                                "eye_color": "green",
                                "hair_color": "auburn",
                                "hair_length": "shoulder length",
                                "hair_type": "wavy",
                                "extra_description": "A curvy, fit adult with bright green eyes, an expressive face, and an easy, grounded manner.",
                                "extra_description_lower_body": "",
                                "nonhuman_lower_body": false
                            },
                            "outfits": [
                                {
                                    "id": "inspector-travel",
                                    "name": "Inspector Travel Uniform",
                                    "clothing": {
                                        "bra": "deep teal supportive bra",
                                        "shirt": "tailored violet-black inspector blouse with subtle gold piping",
                                        "coat": "fitted black travel coat bearing a small federal inspector insignia",
                                        "underwear": "deep teal fitted underwear",
                                        "skirt": "opaque ankle-length travel skirt without openings",
                                        "legwear": "opaque black tights",
                                        "feet": "well-kept black leather ankle boots",
                                        "leftHand": null,
                                        "rightHand": null
                                    }
                                }
                            ],
                            "starting_outfit_id": "inspector-travel",
                            "starting_inventory": [],
                            "starting_known_facts": [
                                "The player died prematurely and is being offered a healthy adult reincarnated body.",
                                "The player has not yet accepted the inspector appointment or selected a supernatural gift."
                            ],
                            "stats": {},
                            "created_at": "2026-07-25T00:00:00Z",
                            "updated_at": "2026-07-26T00:00:00.000Z",
                            "default_seed": 20260723,
                            "image_prompt_config": {
                                "seed_enabled": true,
                                "seed": 20260723,
                                "style": "",
                                "profile_style": "",
                                "negative": "",
                                "negative_prompt": ""
                            },
                            "default_profile_image": {
                                "url": "",
                                "local_image_id": "",
                                "source": "none",
                                "seed": null,
                                "prompt": "",
                                "negative_prompt": "",
                                "note": "",
                                "male": false
                            },
                            "profile_image_presentations": {
                                "male": {
                                    "url": "",
                                    "local_image_id": "",
                                    "source": "none",
                                    "seed": null,
                                    "prompt": "",
                                    "negative_prompt": "",
                                    "note": "",
                                    "male": true
                                },
                                "non_male": {
                                    "url": "",
                                    "local_image_id": "",
                                    "source": "none",
                                    "seed": null,
                                    "prompt": "",
                                    "negative_prompt": "",
                                    "note": "",
                                    "male": false
                                }
                            },
                            "profile_images": {
                                "active_image_id": "",
                                "image_ids": []
                            },
                            "images": {
                                "active_image_id": "",
                                "image_ids": []
                            },
                            "voice": null
                        },
                        "players": [
                            {
                                "lite": true,
                                "version": 1,
                                "id": "mara-quinn",
                                "name": "Mara Quinn",
                                "source": "Player",
                                "creation_tool": "ChatGPT GPT-5.6 Thinking (high reasoning)",
                                "can_die": false,
                                "romanceable": false,
                                "gender": "female",
                                "fallback_name": "Marek Quinn",
                                "fallback_outfits": [
                                    {
                                        "id": "inspector-travel",
                                        "name": "Inspector Travel Uniform",
                                        "clothing": {
                                            "undershirt": "soft deep-teal cotton undershirt",
                                            "shirt": "tailored violet-black inspector shirt with subtle gold piping",
                                            "coat": "fitted black travel coat bearing a small federal inspector insignia",
                                            "underwear": "deep-teal boxer briefs",
                                            "pants": "dark tailored travel trousers",
                                            "socks": "dark wool socks",
                                            "feet": "well-kept black leather ankle boots",
                                            "leftHand": null,
                                            "rightHand": null
                                        }
                                    }
                                ],
                                "fallback_starting_outfit_id": "inspector-travel",
                                "age": 26,
                                "role": "Federal inspector",
                                "personality_description": "Curious, direct, and socially capable without being pushy. Meets strange people with an open mind, while the player decides priorities, attraction, and moral boundaries.",
                                "speech_style": "Warm, clear, and quick to ask the question everyone else avoids.",
                                "boldness": 6,
                                "starting_relationship_to_player": "self",
                                "starting_trust": 10,
                                "starting_attraction": 0,
                                "starting_affection": 0,
                                "starting_state_of_mind": "alert after an unexpected reincarnation",
                                "starting_physical_state": "healthy adult body provided by |[character:caelira-vey]|",
                                "starting_pose": "standing in the divine receiving room",
                                "appearance": {
                                    "species": "Human",
                                    "height": 10,
                                    "shoulder_width": 10,
                                    "chest": 13,
                                    "upper_body_build": 8,
                                    "midsection_build": 8,
                                    "hip_width": 10,
                                    "butt_build": 8,
                                    "lower_body_build": 8,
                                    "arm_length": 10,
                                    "leg_length": 10,
                                    "skin_color": "medium olive skin",
                                    "eye_color": "green",
                                    "hair_color": "auburn",
                                    "hair_length": "shoulder length",
                                    "hair_type": "wavy",
                                    "extra_description": "A curvy, fit adult with bright green eyes, an expressive face, and an easy, grounded manner.",
                                    "extra_description_lower_body": "",
                                    "nonhuman_lower_body": false
                                },
                                "outfits": [
                                    {
                                        "id": "inspector-travel",
                                        "name": "Inspector Travel Uniform",
                                        "clothing": {
                                            "bra": "deep teal supportive bra",
                                            "shirt": "tailored violet-black inspector blouse with subtle gold piping",
                                            "coat": "fitted black travel coat bearing a small federal inspector insignia",
                                            "underwear": "deep teal fitted underwear",
                                            "skirt": "opaque ankle-length travel skirt without openings",
                                            "legwear": "opaque black tights",
                                            "feet": "well-kept black leather ankle boots",
                                            "leftHand": null,
                                            "rightHand": null
                                        }
                                    }
                                ],
                                "starting_outfit_id": "inspector-travel",
                                "starting_inventory": [],
                                "starting_known_facts": [
                                    "The player died prematurely and is being offered a healthy adult reincarnated body.",
                                    "The player has not yet accepted the inspector appointment or selected a supernatural gift."
                                ],
                                "stats": {},
                                "created_at": "2026-07-25T00:00:00Z",
                                "updated_at": "2026-07-26T00:00:00.000Z",
                                "default_seed": 20260723,
                                "image_prompt_config": {
                                    "seed_enabled": true,
                                    "seed": 20260723,
                                    "style": "",
                                    "profile_style": "",
                                    "negative": "",
                                    "negative_prompt": ""
                                },
                                "default_profile_image": {
                                    "url": "",
                                    "local_image_id": "",
                                    "source": "none",
                                    "seed": null,
                                    "prompt": "",
                                    "negative_prompt": "",
                                    "note": "",
                                    "male": false
                                },
                                "profile_image_presentations": {
                                    "male": {
                                        "url": "",
                                        "local_image_id": "",
                                        "source": "none",
                                        "seed": null,
                                        "prompt": "",
                                        "negative_prompt": "",
                                        "note": "",
                                        "male": true
                                    },
                                    "non_male": {
                                        "url": "",
                                        "local_image_id": "",
                                        "source": "none",
                                        "seed": null,
                                        "prompt": "",
                                        "negative_prompt": "",
                                        "note": "",
                                        "male": false
                                    }
                                },
                                "profile_images": {
                                    "active_image_id": "",
                                    "image_ids": []
                                },
                                "images": {
                                    "active_image_id": "",
                                    "image_ids": []
                                },
                                "voice": null
                            }
                        ],
                        "characters": {
                            "vessa-threadwell": "{ Vessa Threadwell uses the complete character_definition structure shown in the characterDefinition group }"
                        },
                        "npc_directory": {
                            "locations": {
                                "loc-federal-office": {
                                    "label": "Federal Inspection Office",
                                    "characters": {
                                        "vessa-threadwell": {
                                            "name": "Vessa Threadwell",
                                            "player_known_name": true,
                                            "player_facing_label": "Vessa Threadwell",
                                            "full_character": "{ Vessa Threadwell uses the complete character_definition structure shown in the characterDefinition group }"
                                        }
                                    }
                                }
                            }
                        },
                        "world_flags": {
                            "tone": "warm bureaucratic fantasy with thoughtful choices and consequential inspections"
                        },
                        "story_inventory": {
                            "coins": 120,
                            "cities_completed": 0,
                            "worker_advocacy": 0,
                            "items": [
                                {
                                    "id": "federal-writ",
                                    "name": "Federal Inspector Writ",
                                    "type": "quest",
                                    "quantity": 1,
                                    "value": 0,
                                    "sellable": false,
                                    "quest_item": true,
                                    "description": "Proof of the player's federal appointment.",
                                    "image": {
                                        "url": "https://example.invalid/federal-writ.png",
                                        "title": "Federal Inspector Writ"
                                    }
                                }
                            ]
                        },
                        "numeric_precision": {
                            "story_inventory": {
                                "inspection_score": 2
                            },
                            "character_stats": {
                                "case_efficiency": 2
                            }
                        },
                        "objectives": {
                            "starting_objective_id": "accept-inspector-appointment",
                            "items": [
                                {
                                    "id": "travel-hearthcross",
                                    "title": "Travel to Hearthcross",
                                    "type": "story",
                                    "summary": "Travel to Hearthcross with Vessa when ready.",
                                    "while_active_guidance": "Allow questions and preparation, but do not narrate arrival until the player commits to travel.",
                                    "completion_control": "player",
                                    "completion_requirements": [],
                                    "completion_criteria": "Complete when the player clearly commits to traveling to Hearthcross.",
                                    "selectable": true,
                                    "locked_until_complete": false,
                                    "next_objectives": [
                                        {
                                            "id": "travel-hearthcross-output",
                                            "objective_id": "arrive-hearthcross",
                                            "target_input_group_id": "arrive-hearthcross-input-1",
                                            "completion_instruction": "Narrate the journey with Vessa and establish arrival in Hearthcross.",
                                            "dialogue_lines": [
                                                "(Vessa Threadwell) \"I have the Hearthcross files ready.\""
                                            ],
                                            "requirements": [],
                                            "rewards": [
                                                {
                                                    "type": "unlock_location",
                                                    "location_id": "loc-city-hearthcross"
                                                }
                                            ],
                                            "travel_location_id": "loc-city-hearthcross"
                                        }
                                    ]
                                },
                                {
                                    "id": "accept-inspector-appointment",
                                    "title": "Decide Whether to Become the Inspector",
                                    "type": "story",
                                    "summary": "Accept, negotiate, or decline the federal appointment.",
                                    "while_active_guidance": "Preserve the player choice and do not imply the appointment has already been accepted.",
                                    "completion_control": "choice",
                                    "choice_response_mode": "optional_text",
                                    "selectable": true,
                                    "locked_until_complete": true,
                                    "choices": [
                                        {
                                            "id": "accept-job",
                                            "title": "Accept the Appointment",
                                            "summary": "Begin the new life as a federal inspector.",
                                            "player_text": "I accept the appointment.",
                                            "next_objective_id": "meet-vessa",
                                            "target_input_group_id": "meet-vessa-input-1",
                                            "completion_instruction": "Acknowledge the acceptance and introduce Vessa as the assigned assistant.",
                                            "dialogue_lines": [
                                                "(Vessa Threadwell) \"Inspector. I am Vessa Threadwell, your assigned assistant.\""
                                            ],
                                            "requirements": [],
                                            "effects": [],
                                            "rewards": [
                                                {
                                                    "type": "introduce_future_character",
                                                    "character_id": "vessa-threadwell",
                                                    "location_id": "loc-federal-office"
                                                }
                                            ]
                                        }
                                    ]
                                },
                                {
                                    "id": "judge-hearthcross-inspection",
                                    "title": "Conclude the Hearthcross Inspection",
                                    "type": "story",
                                    "summary": "Reach a defensible conclusion after examining the establishment.",
                                    "while_active_guidance": "Let the evidence and the player's approach determine Vessa's recommendation.",
                                    "completion_control": "ai",
                                    "evaluate_ai_on_activation": true,
                                    "completion_requirements": [
                                        {
                                            "path": "story_inventory.cities_completed",
                                            "op": ">=",
                                            "value": 1
                                        }
                                    ],
                                    "completion_criteria": "Complete when the inspection has reached a clear supported conclusion.",
                                    "route_control": "ai",
                                    "outcome_routes": [
                                        {
                                            "id": "worker-protection-route",
                                            "criteria": "Choose when the player prioritizes worker safety and credible testimony.",
                                            "next_objective_id": "travel-goldmeadow",
                                            "target_input_group_id": "travel-goldmeadow-input-1",
                                            "completion_instruction": "Have Vessa record a worker-protective ruling.",
                                            "requirements": [
                                                {
                                                    "path": "story_inventory.worker_advocacy",
                                                    "op": ">=",
                                                    "value": 1
                                                }
                                            ],
                                            "dialogue_lines": [],
                                            "rewards": [
                                                {
                                                    "type": "adjust_relationship",
                                                    "target": "Vessa Threadwell",
                                                    "stats": {
                                                        "trust": 1,
                                                        "affection": 1
                                                    }
                                                }
                                            ]
                                        },
                                        {
                                            "id": "neutral-route",
                                            "criteria": "Use when no stronger route clearly applies.",
                                            "fallback": true,
                                            "next_objective_id": "travel-goldmeadow",
                                            "target_input_group_id": "travel-goldmeadow-input-2",
                                            "completion_instruction": "Have Vessa record a cautious neutral ruling.",
                                            "requirements": [],
                                            "dialogue_lines": [],
                                            "rewards": []
                                        }
                                    ]
                                },
                                {
                                    "id": "hearthcross-route-convergence",
                                    "title": "Record the Hearthcross Outcome",
                                    "type": "story",
                                    "summary": "Record the completed inspection outcome.",
                                    "while_active_guidance": "This deterministic transition records the result without narration.",
                                    "completion_control": "reward_only",
                                    "requirement_check_only": true,
                                    "completion_requirements": [
                                        {
                                            "type": "objective_complete",
                                            "objective_id": "judge-hearthcross-inspection"
                                        }
                                    ],
                                    "selectable": false,
                                    "next_objectives": [
                                        {
                                            "id": "convergence-output",
                                            "objective_id": "travel-goldmeadow",
                                            "target_input_group_id": "travel-goldmeadow-input-1",
                                            "completion_instruction": "Carry the recorded outcome forward without adding a new scene.",
                                            "requirements": [],
                                            "rewards": [
                                                {
                                                    "type": "adjust_story_inventory",
                                                    "field": "cities_completed",
                                                    "amount": 1
                                                }
                                            ]
                                        }
                                    ]
                                },
                                {
                                    "id": "finish-inspection-circuit",
                                    "title": "Complete the Inspection Circuit",
                                    "type": "story",
                                    "summary": "Conclude the final federal inspection.",
                                    "while_active_guidance": "Resolve the final consequences from the player's accumulated decisions.",
                                    "completion_control": "ai",
                                    "completion_criteria": "Complete when the final inspection and its immediate consequences are resolved.",
                                    "next_objectives": [
                                        {
                                            "id": "finish-inspection-circuit-ending",
                                            "completion_instruction": "Close the inspection circuit and present its final consequences.",
                                            "rewards": [],
                                            "ending_type": "ending",
                                            "ending_message": "The Inspector's first circuit is complete."
                                        }
                                    ],
                                    "rewards": []
                                }
                            ]
                        },
                        "future_cast": {
                            "enabled": true,
                            "items": {
                                "vessa-threadwell": {
                                    "id": "vessa-threadwell",
                                    "name": "Vessa Threadwell",
                                    "initial_status": "locked",
                                    "canonical_order": 1,
                                    "introduce_as": "npc",
                                    "can_die": false,
                                    "location_hint": "Divine receiving room after the player accepts the appointment",
                                    "scene_presence": "nearby",
                                    "role": "Federal inspection assistant",
                                    "relationship": "not yet met",
                                    "note": "Central assistant and relationship anchor.",
                                    "personality_description": "Intelligent, formal, observant, and professionally firm.",
                                    "greeting": "A precise arachne assistant arrives with the inspection itinerary and tries not to stare at the reincarnated inspector.",
                                    "full_character": "{ Vessa Threadwell uses the complete character_definition structure shown in the characterDefinition group }",
                                    "meet_condition": "Accept the federal inspection appointment.",
                                    "join_condition": "Begins as traveling assistant; romance remains optional.",
                                    "on_unlock": {
                                        "greeting": "Introduce Vessa as the player's newly assigned professional assistant without presuming attraction."
                                    },
                                    "location_id": "loc-federal-office"
                                }
                            }
                        },
                        "timed_events": {
                            "inspection-reminder": {
                                "id": "inspection-reminder",
                                "title": "Inspection Reminder",
                                "trigger": {
                                    "objective_id": "accept-inspector-appointment"
                                },
                                "time_limit_minutes": 720,
                                "cancel_objective_id": "complete-hearthcross-inspection",
                                "stages": [
                                    {
                                        "id": "warning-1",
                                        "after_minutes": 480,
                                        "message": "The Hearthcross inspection deadline is approaching.",
                                        "rewards": []
                                    }
                                ],
                                "rewards": [
                                    {
                                        "type": "add_story_rule",
                                        "rule_id": "inspection-deadline-near",
                                        "text": "The Hearthcross inspection deadline is approaching."
                                    }
                                ]
                            }
                        },
                        "story_rules": [
                            "Inspectors must respect professional boundaries."
                        ],
                        "story_memory": {
                            "world_notes": [
                                "The federal circuit begins in Hearthcross."
                            ],
                            "unresolved_threads": [
                                "Vessa has not yet explained her private reasons for joining the Inspectorate."
                            ],
                            "relationship_notes": [],
                            "rules_and_constraints": [],
                            "ai_private_notes": []
                        },
                        "recent_changes": [],
                        "reward_bundles": {
                            "introduce-vessa": {
                                "rewards": [
                                    {
                                        "type": "introduce_future_character",
                                        "character_id": "vessa-threadwell",
                                        "location_id": "loc-federal-office"
                                    }
                                ]
                            },
                            "reward-hearthcross-trust": {
                                "rewards": [
                                    {
                                        "type": "adjust_relationship",
                                        "target": "Vessa Threadwell",
                                        "stats": {
                                            "trust": 1,
                                            "affection": 1
                                        }
                                    }
                                ]
                            }
                        },
                        "reward_templates": {
                            "adjust-character-trust": {
                                "parameters": {
                                    "character_id": {
                                        "type": "character_id"
                                    },
                                    "stat_path": {
                                        "type": "path"
                                    }
                                },
                                "rewards": [
                                    {
                                        "type": "modify_number",
                                        "operation": "add",
                                        "character_id": {
                                            "parameter": "character_id"
                                        },
                                        "field_path": {
                                            "parameter": "stat_path"
                                        },
                                        "value": 1
                                    }
                                ]
                            }
                        },
                        "character_shop_cost_templates": {
                            "inspection-contract": {
                                "type": "stat",
                                "costs": [
                                    {
                                        "label": "Required Rank",
                                        "available_expression": {
                                            "initial": {
                                                "path": [
                                                    "story_inventory",
                                                    "cities_completed"
                                                ]
                                            }
                                        },
                                        "op": ">=",
                                        "required_stat": "required_rank"
                                    }
                                ],
                                "effects": [
                                    {
                                        "label": "Inspection credit",
                                        "operation": "add",
                                        "field_path": [
                                            "story_inventory",
                                            "coins"
                                        ],
                                        "value_stat": "contract_bonus"
                                    }
                                ]
                            }
                        },
                        "story_shops": {
                            "federal-supply-office": {
                                "id": "federal-supply-office",
                                "title": "Federal Supply Office",
                                "type": "general",
                                "subtype": "General Store",
                                "description": "Official inspection supplies.",
                                "unlocked": true,
                                "currency": "coins",
                                "location_id": "loc-federal-office",
                                "owner_npc_id": "vessa-threadwell",
                                "markup": 1.2,
                                "buying": {
                                    "enabled": true,
                                    "quest_items_rejected": true
                                },
                                "items": [
                                    {
                                        "id": "inspection-ledger",
                                        "quantity": 1,
                                        "item": {
                                            "id": "inspection-ledger",
                                            "name": "Inspection Ledger",
                                            "type": "tool",
                                            "quantity": 1,
                                            "value": 20,
                                            "sellable": true,
                                            "quest_item": false,
                                            "description": "A durable field ledger.",
                                            "image": {
                                                "url": "https://example.invalid/ledger.png",
                                                "title": "Inspection Ledger"
                                            }
                                        },
                                        "requirements": [],
                                        "rewards": []
                                    }
                                ]
                            },
                            "assistant-services": {
                                "id": "assistant-services",
                                "title": "Assistant Services",
                                "type": "character",
                                "subtype": "Professional Services",
                                "description": "Book a specialist for one inspection scene.",
                                "unlocked": true,
                                "currency": "coins",
                                "location_id": "loc-federal-office",
                                "purchase_verb": "Book",
                                "purchase_completed_verb": "booked",
                                "purchase_mode": "service",
                                "repeatable": true,
                                "post_purchase_presence": "current_scene",
                                "items": [
                                    {
                                        "id": "book-vessa",
                                        "character_id": "vessa-threadwell",
                                        "price": 25,
                                        "locked": false,
                                        "requirements": [],
                                        "unlock_reason": "Available after accepting the appointment.",
                                        "on_purchase_objective": "meet-vessa",
                                        "purchase_opening": {
                                            "dialogue": "\"Thank you for booking me. Please, follow me.\"",
                                            "guidance": "Acknowledge the payment, stay in character, and begin the booked service naturally."
                                        }
                                    }
                                ]
                            },
                            "silkrest-outfitter": {
                                "id": "silkrest-outfitter",
                                "title": "Silkrest Outfitter",
                                "type": "clothing",
                                "subtype": "Outfitter",
                                "description": "Arachne-tailored formalwear.",
                                "unlocked": false,
                                "currency": "coins",
                                "location_id": "loc-inn-silkrest-the-gilded-web",
                                "items": [
                                    {
                                        "id": "vessa-confidence-outfit",
                                        "title": "Silkrest Confidence Outfit",
                                        "price": 80,
                                        "requirements": [],
                                        "outfit": {
                                            "id": "silkrest-confidence",
                                            "name": "Silkrest Confidence Outfit",
                                            "clothing": {
                                                "bra": "supportive underlayer suited to the character's body and the outfit design",
                                                "undershirt": "soft species-safe inner layer where anatomically useful",
                                                "shirt": "an elegant copper-and-violet arachne-tailored blouse and draped harness that displays |[character_possessive_pronoun:vessa-threadwell]| upper body attractively while preserving professional dignity",
                                                "pants": "the public outfit's skirt, hip straps, drapes, trousers, or lower-body adaptation",
                                                "underwear": "comfortable species-safe underwear beneath the public look",
                                                "feet": "footwear or protective limb coverings appropriate to species anatomy",
                                                "other_accessory": "inn, city, and species-themed accessories integrated with the public outfit",
                                                "leftHand": null,
                                                "rightHand": null
                                            }
                                        }
                                    }
                                ]
                            },
                            "hearthcross-job-board": {
                                "id": "hearthcross-job-board",
                                "title": "Hearthcross Job Board",
                                "type": "job",
                                "subtype": "Job Board",
                                "description": "Federal and local inspection work.",
                                "unlocked": true,
                                "currency": "coins",
                                "location_id": "loc-federal-office",
                                "visible_count": 3,
                                "generic_jobs_enabled": true,
                                "items": [
                                    {
                                        "id": "audit-hearthcross-ledgers",
                                        "title": "Audit the Hearthcross Ledgers",
                                        "summary": "Compare establishment ledgers against federal filings.",
                                        "genres": [
                                            "fantasy"
                                        ],
                                        "rank": 1,
                                        "requirements": [],
                                        "reward_coins": 40,
                                        "reward_xp": 10,
                                        "reward_items": [],
                                        "client_npc_id": "vessa-threadwell",
                                        "start_location": {
                                            "world": "Elyndar",
                                            "region": "Hearthcross Province",
                                            "settlement_name": "Hearthcross",
                                            "district": "Federal Quarter",
                                            "specific_place": "Federal Inspection Office"
                                        },
                                        "completion_criteria": "Complete when the player finishes checking the ledgers.",
                                        "completion_instruction": "Have Vessa confirm the audit findings and prepare the payment."
                                    }
                                ]
                            }
                        },
                        "story_job_offers": {},
                        "story_job_offer_history": {},
                        "active_generated_jobs": {},
                        "story_generated_npc_pool": {}
                    },
                    "description": {
                        "meta": {
                            "story_guidance": "empty string - Durable hidden guidance for narration throughout the story. - string (required)",
                            "story_source": {
                                "mode": "original - The mode at this definition path. - string (required)",
                                "title": "The Inspector - Player-facing title. - string (required)",
                                "description": "Original fantasy inspection journey across twenty-two species-shaped cities. - Player-facing description. - string",
                                "modifications": "empty string - The modifications at this definition path. - string (required)"
                            }
                        },
                        "starting_location_id": "loc-divine-receiving-room - Initial current location resolved through world_map.locations. - string FK (required)",
                        "world_map": {
                            "locations": {
                                "loc-federal-office": {
                                    "name": "Example - string (required)",
                                    "type": "place - The type at this definition path. - string (required)",
                                    "scale": "site - The scale at this definition path. - string (required)",
                                    "parent_id": "null - Root locations use null; every other location references its parent key. - string FK/null (required)",
                                    "x": "50 - The x at this definition path. - integer (required)",
                                    "y": "15 - The y at this definition path. - integer (required)",
                                    "discovered": "false - The discovered at this definition path. - boolean (required)",
                                    "travel_enabled": "false - The travel enabled at this definition path. - boolean (required)",
                                    "summary": "The professional office coordinating the Grand Harmonization Circuit. - The summary at this definition path. - string",
                                    "connections": [
                                        "loc-divine-receiving-room - The 0 at this definition path. - string (required)",
                                        "loc-city-hearthcross - The 1 at this definition path. - string (required)"
                                    ]
                                }
                            }
                        },
                        "time": {
                            "year": "1 - The year at this definition path. - integer (required)",
                            "month": "1 - The month at this definition path. - integer (required)",
                            "day": "1 - The day at this definition path. - integer (required)",
                            "hour": "9 - The hour at this definition path. - integer (required)",
                            "minute": "0 - The minute at this definition path. - integer (required)",
                            "elapsed_minutes": "0 - Minutes elapsed since this game began; the canonical duration counter used by time requirements and timed events. - integer (required)"
                        },
                        "scene": {
                            "summary": "The player awakens in a goddess's elegant office-garden and is invited to question an honest offer of reincarnation, one supernatural gift, and an unusual government appointment. - The summary at this definition path. - string",
                            "party_members_present": [],
                            "image_characters": [
                                "player - Initial-scene player sentinel resolved to saveHeaders.playerCharacterId during save creation. - string (required)"
                            ],
                            "npcs_present": [
                                "caelira-vey - Stable initial-scene character id resolved by compiledStoryIndexes.characterById. - string FK (required)"
                            ],
                            "image_action": "the newly reincarnated player seated in an elegant office-garden beneath an impossible open sky - The image action at this definition path. - string (required)"
                        },
                        "player": {
                            "lite": "true - Identifies the authored Lite character format. - boolean (required)",
                            "version": "1 - Positive whole-number character definition version; current humanoid definitions use the exact 0-20 appearance shape. - integer (required)",
                            "id": "mara-quinn - Stable identifier within its owning definition. - string (required)",
                            "name": "Mara Quinn - Player-facing character name. - string (required)",
                            "source": "Player - Authored source label. - string (required)",
                            "creation_tool": "ChatGPT GPT-5.6 Thinking (high reasoning) - Tool and model used to create the definition. - string (required)",
                            "can_die": "false - Whether normal gameplay may kill the character. - boolean (required)",
                            "romanceable": "false - Whether attraction preferences may adapt this character presentation. - boolean (required)",
                            "gender": "female - Canonical gender presentation. - string (required)",
                            "fallback_name": "Marek Quinn - Alternate-presentation name. - string (required)",
                            "fallback_outfits": [
                                {
                                    "id": "inspector-travel - Stable identifier within its owning definition. - string (required)",
                                    "name": "Inspector Travel Uniform - Player-facing character name. - string (required)",
                                    "clothing": {
                                        "undershirt": "soft deep-teal cotton undershirt - The undershirt at this definition path. - string (required)",
                                        "shirt": "tailored violet-black inspector shirt with subtle gold piping - The shirt at this definition path. - string (required)",
                                        "coat": "fitted black travel coat bearing a small federal inspector insignia - The coat at this definition path. - string (required)",
                                        "underwear": "deep-teal boxer briefs - The underwear at this definition path. - string (required)",
                                        "pants": "dark tailored travel trousers - The pants at this definition path. - string (required)",
                                        "socks": "dark wool socks - The socks at this definition path. - string (required)",
                                        "feet": "well-kept black leather ankle boots - The feet at this definition path. - string (required)",
                                        "leftHand": "null - Exact authored hand-item description when occupied. - string/null (required)",
                                        "rightHand": "null - Exact authored hand-item description when occupied. - string/null (required)"
                                    }
                                }
                            ],
                            "fallback_starting_outfit_id": "inspector-travel - Starting outfit for the alternate presentation. - string (required)",
                            "age": "26 - Character age. - integer (required)",
                            "role": "Federal inspector - Durable character role. - string (required)",
                            "personality_description": "Curious, direct, and socially capable without being pushy. Meets strange people with an open mind, while the player decides priorities, attraction, and moral boundaries. - Durable personality and behavioral guidance. - string (required)",
                            "speech_style": "Warm, clear, and quick to ask the question everyone else avoids. - Durable dialogue style. - string (required)",
                            "boldness": "6 - Base behavioral boldness from 0 through 10. - integer (required)",
                            "starting_relationship_to_player": "self - Relationship copied into runtime when play begins. - string (required)",
                            "starting_trust": "10 - Trust copied into runtime when play begins. - integer (required)",
                            "starting_attraction": "0 - Attraction copied into runtime when play begins. - integer (required)",
                            "starting_affection": "0 - Affection copied into runtime when play begins. - integer (required)",
                            "starting_state_of_mind": "alert after an unexpected reincarnation - Mental state copied into runtime when play begins. - string (required)",
                            "starting_physical_state": "healthy adult body provided by |[character:caelira-vey]| - Physical state copied into runtime when play begins. - string (required)",
                            "starting_pose": "standing in the divine receiving room - Pose copied into runtime when play begins. - string (required)",
                            "appearance": {
                                "species": "Human - The complete species identity, including any meaningful subtype or qualifier, at this definition path. - string (required)",
                                "height": "10 - The height at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                                "shoulder_width": "10 - The shoulder width at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                                "chest": "13 - The chest at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                                "upper_body_build": "8 - The upper body build at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                                "midsection_build": "8 - The midsection build at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                                "hip_width": "10 - The hip width at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                                "butt_build": "8 - The butt build at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                                "lower_body_build": "8 - The lower body build at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                                "arm_length": "10 - The arm length at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                                "leg_length": "10 - The leg length at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                                "skin_color": "medium olive skin - The skin color at this definition path. - string (required)",
                                "eye_color": "green - The eye color at this definition path. - string (required)",
                                "hair_color": "auburn - The hair color at this definition path. - string (required)",
                                "hair_length": "shoulder length - The hair length at this definition path. - string (required)",
                                "hair_type": "wavy - The hair type at this definition path. - string (required)",
                                "extra_description": "A curvy, fit adult with bright green eyes, an expressive face, and an easy, grounded manner. - The extra description at this definition path. - string",
                                "extra_description_lower_body": "empty string - The extra description lower body at this definition path. - string",
                                "nonhuman_lower_body": "false - The nonhuman lower body at this definition path. - boolean (required)"
                            },
                            "outfits": [
                                {
                                    "id": "inspector-travel - Stable identifier within its owning definition. - string (required)",
                                    "name": "Inspector Travel Uniform - Player-facing character name. - string (required)",
                                    "clothing": {
                                        "bra": "deep teal supportive bra - The bra at this definition path. - string (required)",
                                        "shirt": "tailored violet-black inspector blouse with subtle gold piping - The shirt at this definition path. - string (required)",
                                        "coat": "fitted black travel coat bearing a small federal inspector insignia - The coat at this definition path. - string (required)",
                                        "underwear": "deep teal fitted underwear - The underwear at this definition path. - string (required)",
                                        "skirt": "opaque ankle-length travel skirt without openings - The skirt at this definition path. - string (required)",
                                        "legwear": "opaque black tights - The legwear at this definition path. - string (required)",
                                        "feet": "well-kept black leather ankle boots - The feet at this definition path. - string (required)",
                                        "leftHand": "null - Exact authored hand-item description when occupied. - string/null (required)",
                                        "rightHand": "null - Exact authored hand-item description when occupied. - string/null (required)"
                                    }
                                }
                            ],
                            "starting_outfit_id": "inspector-travel - Outfit copied into mutable clothing when play begins. - string (required)",
                            "starting_inventory": [],
                            "starting_known_facts": [
                                "The player died prematurely and is being offered a healthy adult reincarnated body. - The 0 at this definition path. - string (required)",
                                "The player has not yet accepted the inspector appointment or selected a supernatural gift. - The 1 at this definition path. - string (required)"
                            ],
                            "stats": {},
                            "created_at": "2026-07-25T00:00:00Z - Original character creation time. - string (required)",
                            "updated_at": "2026-07-26T00:00:00.000Z - Most recent definition update time. - string (required)",
                            "default_seed": "20260723 - Default image-generation seed. - integer (required)",
                            "image_prompt_config": {
                                "seed_enabled": "true - The seed enabled at this definition path. - boolean (required)",
                                "seed": "20260723 - The seed at this definition path. - integer (required)",
                                "style": "empty string - The style at this definition path. - string (required)",
                                "profile_style": "empty string - The profile style at this definition path. - string (required)",
                                "negative": "empty string - The negative at this definition path. - string (required)",
                                "negative_prompt": "empty string - The negative prompt at this definition path. - string (required)"
                            },
                            "default_profile_image": {
                                "url": "empty string - The url at this definition path. - string (required)",
                                "local_image_id": "empty string - The local image id at this definition path. - string (required)",
                                "source": "none - Authored source label. - string (required)",
                                "seed": "null - The seed at this definition path. - number|string|null (required)",
                                "prompt": "empty string - The prompt at this definition path. - string (required)",
                                "negative_prompt": "empty string - The negative prompt at this definition path. - string (required)",
                                "note": "empty string - The note at this definition path. - string (required)",
                                "male": "false - The male at this definition path. - boolean (required)"
                            },
                            "profile_image_presentations": {
                                "male": {
                                    "url": "empty string - The url at this definition path. - string (required)",
                                    "local_image_id": "empty string - The local image id at this definition path. - string (required)",
                                    "source": "none - Authored source label. - string (required)",
                                    "seed": "null - The seed at this definition path. - number|string|null (required)",
                                    "prompt": "empty string - The prompt at this definition path. - string (required)",
                                    "negative_prompt": "empty string - The negative prompt at this definition path. - string (required)",
                                    "note": "empty string - The note at this definition path. - string (required)",
                                    "male": "true - The male at this definition path. - boolean (required)"
                                },
                                "non_male": {
                                    "url": "empty string - The url at this definition path. - string (required)",
                                    "local_image_id": "empty string - The local image id at this definition path. - string (required)",
                                    "source": "none - Authored source label. - string (required)",
                                    "seed": "null - The seed at this definition path. - number|string|null (required)",
                                    "prompt": "empty string - The prompt at this definition path. - string (required)",
                                    "negative_prompt": "empty string - The negative prompt at this definition path. - string (required)",
                                    "note": "empty string - The note at this definition path. - string (required)",
                                    "male": "false - The male at this definition path. - boolean (required)"
                                }
                            },
                            "profile_images": {
                                "active_image_id": "empty string - The active image id at this definition path. - string (required)",
                                "image_ids": []
                            },
                            "images": {
                                "active_image_id": "empty string - The active image id at this definition path. - string (required)",
                                "image_ids": []
                            },
                            "voice": "null - Runtime-populated voice assignment. - number|string|null (required)"
                        },
                        "players": [
                            {
                                "lite": "true - Identifies the authored Lite character format. - boolean (required)",
                                "version": "1 - Positive whole-number character definition version; current humanoid definitions use the exact 0-20 appearance shape. - integer (required)",
                                "id": "mara-quinn - Stable identifier within its owning definition. - string (required)",
                                "name": "Mara Quinn - Player-facing character name. - string (required)",
                                "source": "Player - Authored source label. - string (required)",
                                "creation_tool": "ChatGPT GPT-5.6 Thinking (high reasoning) - Tool and model used to create the definition. - string (required)",
                                "can_die": "false - Whether normal gameplay may kill the character. - boolean (required)",
                                "romanceable": "false - Whether attraction preferences may adapt this character presentation. - boolean (required)",
                                "gender": "female - Canonical gender presentation. - string (required)",
                                "fallback_name": "Marek Quinn - Alternate-presentation name. - string (required)",
                                "fallback_outfits": [
                                    {
                                        "id": "inspector-travel - Stable identifier within its owning definition. - string (required)",
                                        "name": "Inspector Travel Uniform - Player-facing character name. - string (required)",
                                        "clothing": {
                                            "undershirt": "soft deep-teal cotton undershirt - The undershirt at this definition path. - string (required)",
                                            "shirt": "tailored violet-black inspector shirt with subtle gold piping - The shirt at this definition path. - string (required)",
                                            "coat": "fitted black travel coat bearing a small federal inspector insignia - The coat at this definition path. - string (required)",
                                            "underwear": "deep-teal boxer briefs - The underwear at this definition path. - string (required)",
                                            "pants": "dark tailored travel trousers - The pants at this definition path. - string (required)",
                                            "socks": "dark wool socks - The socks at this definition path. - string (required)",
                                            "feet": "well-kept black leather ankle boots - The feet at this definition path. - string (required)",
                                            "leftHand": "null - Exact authored hand-item description when occupied. - string/null (required)",
                                            "rightHand": "null - Exact authored hand-item description when occupied. - string/null (required)"
                                        }
                                    }
                                ],
                                "fallback_starting_outfit_id": "inspector-travel - Starting outfit for the alternate presentation. - string (required)",
                                "age": "26 - Character age. - integer (required)",
                                "role": "Federal inspector - Durable character role. - string (required)",
                                "personality_description": "Curious, direct, and socially capable without being pushy. Meets strange people with an open mind, while the player decides priorities, attraction, and moral boundaries. - Durable personality and behavioral guidance. - string (required)",
                                "speech_style": "Warm, clear, and quick to ask the question everyone else avoids. - Durable dialogue style. - string (required)",
                                "boldness": "6 - Base behavioral boldness from 0 through 10. - integer (required)",
                                "starting_relationship_to_player": "self - Relationship copied into runtime when play begins. - string (required)",
                                "starting_trust": "10 - Trust copied into runtime when play begins. - integer (required)",
                                "starting_attraction": "0 - Attraction copied into runtime when play begins. - integer (required)",
                                "starting_affection": "0 - Affection copied into runtime when play begins. - integer (required)",
                                "starting_state_of_mind": "alert after an unexpected reincarnation - Mental state copied into runtime when play begins. - string (required)",
                                "starting_physical_state": "healthy adult body provided by |[character:caelira-vey]| - Physical state copied into runtime when play begins. - string (required)",
                                "starting_pose": "standing in the divine receiving room - Pose copied into runtime when play begins. - string (required)",
                                "appearance": {
                                    "species": "Human - The complete species identity, including any meaningful subtype or qualifier, at this definition path. - string (required)",
                                    "height": "10 - The height at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                                    "shoulder_width": "10 - The shoulder width at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                                    "chest": "13 - The chest at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                                    "upper_body_build": "8 - The upper body build at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                                    "midsection_build": "8 - The midsection build at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                                    "hip_width": "10 - The hip width at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                                    "butt_build": "8 - The butt build at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                                    "lower_body_build": "8 - The lower body build at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                                    "arm_length": "10 - The arm length at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                                    "leg_length": "10 - The leg length at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                                    "skin_color": "medium olive skin - The skin color at this definition path. - string (required)",
                                    "eye_color": "green - The eye color at this definition path. - string (required)",
                                    "hair_color": "auburn - The hair color at this definition path. - string (required)",
                                    "hair_length": "shoulder length - The hair length at this definition path. - string (required)",
                                    "hair_type": "wavy - The hair type at this definition path. - string (required)",
                                    "extra_description": "A curvy, fit adult with bright green eyes, an expressive face, and an easy, grounded manner. - The extra description at this definition path. - string",
                                    "extra_description_lower_body": "empty string - The extra description lower body at this definition path. - string",
                                    "nonhuman_lower_body": "false - The nonhuman lower body at this definition path. - boolean (required)"
                                },
                                "outfits": [
                                    {
                                        "id": "inspector-travel - Stable identifier within its owning definition. - string (required)",
                                        "name": "Inspector Travel Uniform - Player-facing character name. - string (required)",
                                        "clothing": {
                                            "bra": "deep teal supportive bra - The bra at this definition path. - string (required)",
                                            "shirt": "tailored violet-black inspector blouse with subtle gold piping - The shirt at this definition path. - string (required)",
                                            "coat": "fitted black travel coat bearing a small federal inspector insignia - The coat at this definition path. - string (required)",
                                            "underwear": "deep teal fitted underwear - The underwear at this definition path. - string (required)",
                                            "skirt": "opaque ankle-length travel skirt without openings - The skirt at this definition path. - string (required)",
                                            "legwear": "opaque black tights - The legwear at this definition path. - string (required)",
                                            "feet": "well-kept black leather ankle boots - The feet at this definition path. - string (required)",
                                            "leftHand": "null - Exact authored hand-item description when occupied. - string/null (required)",
                                            "rightHand": "null - Exact authored hand-item description when occupied. - string/null (required)"
                                        }
                                    }
                                ],
                                "starting_outfit_id": "inspector-travel - Outfit copied into mutable clothing when play begins. - string (required)",
                                "starting_inventory": [],
                                "starting_known_facts": [
                                    "The player died prematurely and is being offered a healthy adult reincarnated body. - The 0 at this definition path. - string (required)",
                                    "The player has not yet accepted the inspector appointment or selected a supernatural gift. - The 1 at this definition path. - string (required)"
                                ],
                                "stats": {},
                                "created_at": "2026-07-25T00:00:00Z - Original character creation time. - string (required)",
                                "updated_at": "2026-07-26T00:00:00.000Z - Most recent definition update time. - string (required)",
                                "default_seed": "20260723 - Default image-generation seed. - integer (required)",
                                "image_prompt_config": {
                                    "seed_enabled": "true - The seed enabled at this definition path. - boolean (required)",
                                    "seed": "20260723 - The seed at this definition path. - integer (required)",
                                    "style": "empty string - The style at this definition path. - string (required)",
                                    "profile_style": "empty string - The profile style at this definition path. - string (required)",
                                    "negative": "empty string - The negative at this definition path. - string (required)",
                                    "negative_prompt": "empty string - The negative prompt at this definition path. - string (required)"
                                },
                                "default_profile_image": {
                                    "url": "empty string - The url at this definition path. - string (required)",
                                    "local_image_id": "empty string - The local image id at this definition path. - string (required)",
                                    "source": "none - Authored source label. - string (required)",
                                    "seed": "null - The seed at this definition path. - number|string|null (required)",
                                    "prompt": "empty string - The prompt at this definition path. - string (required)",
                                    "negative_prompt": "empty string - The negative prompt at this definition path. - string (required)",
                                    "note": "empty string - The note at this definition path. - string (required)",
                                    "male": "false - The male at this definition path. - boolean (required)"
                                },
                                "profile_image_presentations": {
                                    "male": {
                                        "url": "empty string - The url at this definition path. - string (required)",
                                        "local_image_id": "empty string - The local image id at this definition path. - string (required)",
                                        "source": "none - Authored source label. - string (required)",
                                        "seed": "null - The seed at this definition path. - number|string|null (required)",
                                        "prompt": "empty string - The prompt at this definition path. - string (required)",
                                        "negative_prompt": "empty string - The negative prompt at this definition path. - string (required)",
                                        "note": "empty string - The note at this definition path. - string (required)",
                                        "male": "true - The male at this definition path. - boolean (required)"
                                    },
                                    "non_male": {
                                        "url": "empty string - The url at this definition path. - string (required)",
                                        "local_image_id": "empty string - The local image id at this definition path. - string (required)",
                                        "source": "none - Authored source label. - string (required)",
                                        "seed": "null - The seed at this definition path. - number|string|null (required)",
                                        "prompt": "empty string - The prompt at this definition path. - string (required)",
                                        "negative_prompt": "empty string - The negative prompt at this definition path. - string (required)",
                                        "note": "empty string - The note at this definition path. - string (required)",
                                        "male": "false - The male at this definition path. - boolean (required)"
                                    }
                                },
                                "profile_images": {
                                    "active_image_id": "empty string - The active image id at this definition path. - string (required)",
                                    "image_ids": []
                                },
                                "images": {
                                    "active_image_id": "empty string - The active image id at this definition path. - string (required)",
                                    "image_ids": []
                                },
                                "voice": "null - Runtime-populated voice assignment. - number|string|null (required)"
                            }
                        ],
                        "characters": {
                            "vessa-threadwell": "{ Vessa Threadwell uses the complete character_definition structure shown in the characterDefinition group } - The vessa threadwell at this definition path. - string (required)"
                        },
                        "npc_directory": {
                            "locations": {
                                "loc-federal-office": {
                                    "label": "Federal Inspection Office - The label at this definition path. - string (required)",
                                    "characters": {
                                        "vessa-threadwell": {
                                            "name": "Vessa Threadwell - Player-facing character name. - string (required)",
                                            "player_known_name": "true - The player known name at this definition path. - boolean (required)",
                                            "player_facing_label": "Vessa Threadwell - The player facing label at this definition path. - string (required)",
                                            "full_character": "{ Vessa Threadwell uses the complete character_definition structure shown in the characterDefinition group } - The full character at this definition path. - string (required)"
                                        }
                                    }
                                }
                            }
                        },
                        "world_flags": {
                            "tone": "warm bureaucratic fantasy with thoughtful choices and consequential inspections - The tone at this definition path. - string (required)"
                        },
                        "story_inventory": {
                            "coins": "120 - The coins at this definition path. - integer (required)",
                            "cities_completed": "0 - The cities completed at this definition path. - integer (required)",
                            "worker_advocacy": "0 - The worker advocacy at this definition path. - integer (required)",
                            "items": [
                                {
                                    "id": "federal-writ - Stable identifier within its owning definition. - string (required)",
                                    "name": "Federal Inspector Writ - Player-facing character name. - string (required)",
                                    "type": "quest - The type at this definition path. - string (required)",
                                    "quantity": "1 - The quantity at this definition path. - integer",
                                    "value": "0 - The value at this definition path. - integer (required)",
                                    "sellable": "false - The sellable at this definition path. - boolean (required)",
                                    "quest_item": "true - The quest item at this definition path. - boolean (required)",
                                    "description": "Proof of the player's federal appointment. - Player-facing description. - string",
                                    "image": {
                                        "url": "https://example.invalid/federal-writ.png - The url at this definition path. - string (required)",
                                        "title": "Federal Inspector Writ - Player-facing title. - string (required)"
                                    }
                                }
                            ]
                        },
                        "numeric_precision": {
                            "story_inventory": {
                                "inspection_score": "2 - The inspection score at this definition path. - integer (required)"
                            },
                            "character_stats": {
                                "case_efficiency": "2 - The case efficiency at this definition path. - integer (required)"
                            }
                        },
                        "objectives": {
                            "starting_objective_id": "accept-inspector-appointment - The objective active when a new save begins. Objective definitions never store runtime active, hidden, complete, or no-current state. - string FK (required)",
                            "items": [
                                {
                                    "id": "travel-hearthcross - Stable identifier within its owning definition. - string (required)",
                                    "title": "Travel to Hearthcross - Player-facing title. - string (required)",
                                    "type": "story - The type at this definition path. - string (required)",
                                    "summary": "Travel to Hearthcross with Vessa when ready. - The summary at this definition path. - string",
                                    "while_active_guidance": "Allow questions and preparation, but do not narrate arrival until the player commits to travel. - Required hidden AI guidance used while this objective is active. - string (required)",
                                    "completion_control": "player - Determines whether completion is checked from player action, AI scene resolution, a direct choice, or deterministic requirements. - string (required)",
                                    "completion_requirements": [],
                                    "completion_criteria": "Complete when the player clearly commits to traveling to Hearthcross. - One private observable condition that completes the objective. - string (required)",
                                    "selectable": "true - The selectable at this definition path. - boolean (required)",
                                    "locked_until_complete": "false - The locked until complete at this definition path. - boolean (required)",
                                    "next_objectives": [
                                        {
                                            "id": "travel-hearthcross-output - Stable identifier within its owning definition. - string (required)",
                                            "objective_id": "arrive-hearthcross - The objective id at this definition path. - string (required)",
                                            "target_input_group_id": "arrive-hearthcross-input-1 - Destination input group receiving this transition. - string (required)",
                                            "completion_instruction": "Narrate the journey with Vessa and establish arrival in Hearthcross. - Hidden narrator guidance applied when this output resolves. - string (required)",
                                            "dialogue_lines": [
                                                "(Vessa Threadwell) \"I have the Hearthcross files ready.\" - The 0 at this definition path. - string (required)"
                                            ],
                                            "requirements": [],
                                            "rewards": [
                                                {
                                                    "type": "unlock_location - The type at this definition path. - string (required)",
                                                    "location_id": "loc-city-hearthcross - The location id at this definition path. - string (required)"
                                                }
                                            ],
                                            "travel_location_id": "loc-city-hearthcross - The travel location id at this definition path. - string"
                                        }
                                    ]
                                },
                                {
                                    "id": "accept-inspector-appointment - Stable identifier within its owning definition. - string (required)",
                                    "title": "Decide Whether to Become the Inspector - Player-facing title. - string (required)",
                                    "type": "story - The type at this definition path. - string (required)",
                                    "summary": "Accept, negotiate, or decline the federal appointment. - The summary at this definition path. - string",
                                    "while_active_guidance": "Preserve the player choice and do not imply the appointment has already been accepted. - Required hidden AI guidance used while this objective is active. - string (required)",
                                    "completion_control": "choice - Determines whether completion is checked from player action, AI scene resolution, a direct choice, or deterministic requirements. - string (required)",
                                    "choice_response_mode": "optional_text - The choice response mode at this definition path. - string (required)",
                                    "selectable": "true - The selectable at this definition path. - boolean (required)",
                                    "locked_until_complete": "true - The locked until complete at this definition path. - boolean (required)",
                                    "choices": [
                                        {
                                            "id": "accept-job - Stable identifier within its owning definition. - string (required)",
                                            "title": "Accept the Appointment - Player-facing title. - string (required)",
                                            "summary": "Begin the new life as a federal inspector. - The summary at this definition path. - string",
                                            "player_text": "I accept the appointment. - The player text at this definition path. - string (required)",
                                            "next_objective_id": "meet-vessa - The next objective id at this definition path. - string (required)",
                                            "target_input_group_id": "meet-vessa-input-1 - Destination input group receiving this transition. - string (required)",
                                            "completion_instruction": "Acknowledge the acceptance and introduce Vessa as the assigned assistant. - Hidden narrator guidance applied when this output resolves. - string (required)",
                                            "dialogue_lines": [
                                                "(Vessa Threadwell) \"Inspector. I am Vessa Threadwell, your assigned assistant.\" - The 0 at this definition path. - string (required)"
                                            ],
                                            "requirements": [],
                                            "effects": [],
                                            "rewards": [
                                                {
                                                    "type": "introduce_future_character - The type at this definition path. - string (required)",
                                                    "character_id": "vessa-threadwell - The character id at this definition path. - string (required)",
                                                    "location_id": "loc-federal-office - Location referenced by this reward. - string FK (required)"
                                                }
                                            ]
                                        }
                                    ]
                                },
                                {
                                    "id": "judge-hearthcross-inspection - Stable identifier within its owning definition. - string (required)",
                                    "title": "Conclude the Hearthcross Inspection - Player-facing title. - string (required)",
                                    "type": "story - The type at this definition path. - string (required)",
                                    "summary": "Reach a defensible conclusion after examining the establishment. - The summary at this definition path. - string",
                                    "while_active_guidance": "Let the evidence and the player's approach determine Vessa's recommendation. - Required hidden AI guidance used while this objective is active. - string (required)",
                                    "completion_control": "ai - Determines whether completion is checked from player action, AI scene resolution, a direct choice, or deterministic requirements. - string (required)",
                                    "evaluate_ai_on_activation": "true - Requests one AI completion decision immediately when the objective activates. - boolean",
                                    "completion_requirements": [
                                        {
                                            "path": "story_inventory.cities_completed - The path at this definition path. - string (required)",
                                            "op": ">= - The op at this definition path. - string (required)",
                                            "value": "1 - The value at this definition path. - integer (required)"
                                        }
                                    ],
                                    "completion_criteria": "Complete when the inspection has reached a clear supported conclusion. - One private observable condition that completes the objective. - string (required)",
                                    "route_control": "ai - The route control at this definition path. - string",
                                    "outcome_routes": [
                                        {
                                            "id": "worker-protection-route - Stable identifier within its owning definition. - string (required)",
                                            "criteria": "Choose when the player prioritizes worker safety and credible testimony. - The criteria at this definition path. - string (required)",
                                            "next_objective_id": "travel-goldmeadow - The next objective id at this definition path. - string (required)",
                                            "target_input_group_id": "travel-goldmeadow-input-1 - Destination input group receiving this transition. - string (required)",
                                            "completion_instruction": "Have Vessa record a worker-protective ruling. - Hidden narrator guidance applied when this output resolves. - string (required)",
                                            "requirements": [
                                                {
                                                    "path": "story_inventory.worker_advocacy - The path at this definition path. - string (required)",
                                                    "op": ">= - The op at this definition path. - string (required)",
                                                    "value": "1 - The value at this definition path. - integer (required)"
                                                }
                                            ],
                                            "dialogue_lines": [],
                                            "rewards": [
                                                {
                                                    "type": "adjust_relationship - The type at this definition path. - string (required)",
                                                    "target": "Vessa Threadwell - The target at this definition path. - string (required)",
                                                    "stats": {
                                                        "trust": "1 - The trust at this definition path. - integer (required)",
                                                        "affection": "1 - The affection at this definition path. - integer (required)"
                                                    }
                                                }
                                            ]
                                        },
                                        {
                                            "id": "neutral-route - Stable identifier within its owning definition. - string (required)",
                                            "criteria": "Use when no stronger route clearly applies. - The criteria at this definition path. - string (required)",
                                            "fallback": "true - The fallback at this definition path. - boolean (required)",
                                            "next_objective_id": "travel-goldmeadow - The next objective id at this definition path. - string (required)",
                                            "target_input_group_id": "travel-goldmeadow-input-2 - Destination input group receiving this transition. - string (required)",
                                            "completion_instruction": "Have Vessa record a cautious neutral ruling. - Hidden narrator guidance applied when this output resolves. - string (required)",
                                            "requirements": [],
                                            "dialogue_lines": [],
                                            "rewards": []
                                        }
                                    ]
                                },
                                {
                                    "id": "hearthcross-route-convergence - Stable identifier within its owning definition. - string (required)",
                                    "title": "Record the Hearthcross Outcome - Player-facing title. - string (required)",
                                    "type": "story - The type at this definition path. - string (required)",
                                    "summary": "Record the completed inspection outcome. - The summary at this definition path. - string",
                                    "while_active_guidance": "This deterministic transition records the result without narration. - Required hidden AI guidance used while this objective is active. - string (required)",
                                    "completion_control": "reward_only - Determines whether completion is checked from player action, AI scene resolution, a direct choice, or deterministic requirements. - string (required)",
                                    "requirement_check_only": "true - Makes an AI-controlled node a deterministic no-AI automatic transition. - boolean",
                                    "completion_requirements": [
                                        {
                                            "type": "objective_complete - The type at this definition path. - string (required)",
                                            "objective_id": "judge-hearthcross-inspection - The objective id at this definition path. - string (required)"
                                        }
                                    ],
                                    "selectable": "false - The selectable at this definition path. - boolean (required)",
                                    "next_objectives": [
                                        {
                                            "id": "convergence-output - Stable identifier within its owning definition. - string (required)",
                                            "objective_id": "travel-goldmeadow - The objective id at this definition path. - string (required)",
                                            "target_input_group_id": "travel-goldmeadow-input-1 - Destination input group receiving this transition. - string (required)",
                                            "completion_instruction": "Carry the recorded outcome forward without adding a new scene. - Hidden narrator guidance applied when this output resolves. - string (required)",
                                            "requirements": [],
                                            "rewards": [
                                                {
                                                    "type": "adjust_story_inventory - The type at this definition path. - string (required)",
                                                    "field": "cities_completed - The field at this definition path. - string (required)",
                                                    "amount": "1 - The amount at this definition path. - integer (required)"
                                                }
                                            ]
                                        }
                                    ]
                                },
                                {
                                    "id": "finish-inspection-circuit - Stable identifier within its owning definition. - string (required)",
                                    "title": "Complete the Inspection Circuit - Player-facing title. - string (required)",
                                    "type": "story - The type at this definition path. - string (required)",
                                    "summary": "Conclude the final federal inspection. - The summary at this definition path. - string",
                                    "while_active_guidance": "Resolve the final consequences from the player's accumulated decisions. - Required hidden AI guidance used while this objective is active. - string (required)",
                                    "completion_control": "ai - Determines whether completion is checked from player action, AI scene resolution, a direct choice, or deterministic requirements. - string (required)",
                                    "completion_criteria": "Complete when the final inspection and its immediate consequences are resolved. - One private observable condition that completes the objective. - string (required)",
                                    "next_objectives": [
                                        {
                                            "id": "finish-inspection-circuit-ending - Stable identifier within its owning definition. - string (required)",
                                            "completion_instruction": "Close the inspection circuit and present its final consequences. - Hidden narrator guidance applied when this output resolves. - string (required)",
                                            "rewards": [],
                                            "ending_type": "ending - Optional output ending behavior. - freeplay | ending | game_over",
                                            "ending_message": "The Inspector's first circuit is complete. - Optional message shown for this ending. - string"
                                        }
                                    ],
                                    "rewards": []
                                }
                            ]
                        },
                        "future_cast": {
                            "enabled": "true - The enabled at this definition path. - boolean (required)",
                            "items": {
                                "vessa-threadwell": {
                                    "id": "vessa-threadwell - Stable identifier within its owning definition. - string (required)",
                                    "name": "Vessa Threadwell - Player-facing character name. - string (required)",
                                    "initial_status": "locked - Immutable starting future-cast status copied into runtime only when a new save is created. - string (required)",
                                    "canonical_order": "1 - The canonical order at this definition path. - integer (required)",
                                    "introduce_as": "npc - The introduce as at this definition path. - string (required)",
                                    "can_die": "false - Whether normal gameplay may kill the character. - boolean (required)",
                                    "location_hint": "Divine receiving room after the player accepts the appointment - The location hint at this definition path. - string (required)",
                                    "scene_presence": "nearby - The scene presence at this definition path. - string (required)",
                                    "role": "Federal inspection assistant - Durable character role. - string (required)",
                                    "relationship": "not yet met - The relationship at this definition path. - string (required)",
                                    "note": "Central assistant and relationship anchor. - The note at this definition path. - string (required)",
                                    "personality_description": "Intelligent, formal, observant, and professionally firm. - Durable personality and behavioral guidance. - string (required)",
                                    "greeting": "A precise arachne assistant arrives with the inspection itinerary and tries not to stare at the reincarnated inspector. - The greeting at this definition path. - string (required)",
                                    "full_character": "{ Vessa Threadwell uses the complete character_definition structure shown in the characterDefinition group } - The full character at this definition path. - string (required)",
                                    "meet_condition": "Accept the federal inspection appointment. - The meet condition at this definition path. - string (required)",
                                    "join_condition": "Begins as traveling assistant; romance remains optional. - The join condition at this definition path. - string (required)",
                                    "on_unlock": {
                                        "greeting": "Introduce Vessa as the player's newly assigned professional assistant without presuming attraction. - The greeting at this definition path. - string (required)"
                                    },
                                    "location_id": "loc-federal-office - Location associated with this future character. - string FK (required)"
                                }
                            }
                        },
                        "timed_events": {
                            "inspection-reminder": {
                                "id": "inspection-reminder - Stable identifier within its owning definition. - string (required)",
                                "title": "Inspection Reminder - Player-facing title. - string (required)",
                                "trigger": {
                                    "objective_id": "accept-inspector-appointment - Objective whose completion starts this timed event. - string FK (required)"
                                },
                                "time_limit_minutes": "720 - Minutes after this event starts before its deadline rewards apply. - integer (required)",
                                "cancel_objective_id": "complete-hearthcross-inspection - Completing this objective cancels the event before its deadline. - string FK",
                                "stages": [
                                    {
                                        "id": "warning-1 - Stable stage identifier within this timed event. - string (required)",
                                        "after_minutes": "480 - Minutes after the event starts before this stage applies. - integer (required)",
                                        "message": "The Hearthcross inspection deadline is approaching. - Player-facing stage message. - string",
                                        "rewards": []
                                    }
                                ],
                                "rewards": [
                                    {
                                        "type": "add_story_rule - The type at this definition path. - string (required)",
                                        "rule_id": "inspection-deadline-near - The rule id at this definition path. - string (required)",
                                        "text": "The Hearthcross inspection deadline is approaching. - The text at this definition path. - string (required)"
                                    }
                                ]
                            }
                        },
                        "story_rules": [
                            "Inspectors must respect professional boundaries. - The 0 at this definition path. - string (required)"
                        ],
                        "story_memory": {
                            "world_notes": [
                                "The federal circuit begins in Hearthcross. - The 0 at this definition path. - string (required)"
                            ],
                            "unresolved_threads": [
                                "Vessa has not yet explained her private reasons for joining the Inspectorate. - The 0 at this definition path. - string (required)"
                            ],
                            "relationship_notes": [],
                            "rules_and_constraints": [],
                            "ai_private_notes": []
                        },
                        "recent_changes": [],
                        "reward_bundles": {
                            "introduce-vessa": {
                                "rewards": [
                                    {
                                        "type": "introduce_future_character - The type at this definition path. - string (required)",
                                        "character_id": "vessa-threadwell - The character id at this definition path. - string (required)",
                                        "location_id": "loc-federal-office - Location referenced by this reward. - string FK (required)"
                                    }
                                ]
                            },
                            "reward-hearthcross-trust": {
                                "rewards": [
                                    {
                                        "type": "adjust_relationship - The type at this definition path. - string (required)",
                                        "target": "Vessa Threadwell - The target at this definition path. - string (required)",
                                        "stats": {
                                            "trust": "1 - The trust at this definition path. - integer (required)",
                                            "affection": "1 - The affection at this definition path. - integer (required)"
                                        }
                                    }
                                ]
                            }
                        },
                        "reward_templates": {
                            "adjust-character-trust": {
                                "parameters": {
                                    "character_id": {
                                        "type": "character_id - The type at this definition path. - string (required)"
                                    },
                                    "stat_path": {
                                        "type": "path - The type at this definition path. - string (required)"
                                    }
                                },
                                "rewards": [
                                    {
                                        "type": "modify_number - The type at this definition path. - string (required)",
                                        "operation": "add - The operation at this definition path. - string (required)",
                                        "character_id": {
                                            "parameter": "character_id - The parameter at this definition path. - string (required)"
                                        },
                                        "field_path": {
                                            "parameter": "stat_path - The parameter at this definition path. - string (required)"
                                        },
                                        "value": "1 - The value at this definition path. - integer (required)"
                                    }
                                ]
                            }
                        },
                        "character_shop_cost_templates": {
                            "inspection-contract": {
                                "type": "stat - The type at this definition path. - string (required)",
                                "costs": [
                                    {
                                        "label": "Required Rank - The label at this definition path. - string (required)",
                                        "available_expression": {
                                            "initial": {
                                                "path": [
                                                    "story_inventory - The 0 at this definition path. - string (required)",
                                                    "cities_completed - The 1 at this definition path. - string (required)"
                                                ]
                                            }
                                        },
                                        "op": ">= - The op at this definition path. - string (required)",
                                        "required_stat": "required_rank - The required stat at this definition path. - string (required)"
                                    }
                                ],
                                "effects": [
                                    {
                                        "label": "Inspection credit - The label at this definition path. - string (required)",
                                        "operation": "add - The operation at this definition path. - string (required)",
                                        "field_path": [
                                            "story_inventory - The 0 at this definition path. - string (required)",
                                            "coins - The 1 at this definition path. - string (required)"
                                        ],
                                        "value_stat": "contract_bonus - The value stat at this definition path. - string (required)"
                                    }
                                ]
                            }
                        },
                        "story_shops": {
                            "federal-supply-office": {
                                "id": "federal-supply-office - Stable identifier within its owning definition. - string (required)",
                                "title": "Federal Supply Office - Player-facing title. - string (required)",
                                "type": "general - The type at this definition path. - string (required)",
                                "subtype": "General Store - The subtype at this definition path. - string (required)",
                                "description": "Official inspection supplies. - Player-facing description. - string",
                                "unlocked": "true - The unlocked at this definition path. - boolean (required)",
                                "currency": "coins - The currency at this definition path. - string (required)",
                                "location_id": "loc-federal-office - Location containing this shop. - string FK (required)",
                                "owner_npc_id": "vessa-threadwell - The owner npc id at this definition path. - string",
                                "markup": "1.2 - The markup at this definition path. - number (required)",
                                "buying": {
                                    "enabled": "true - The enabled at this definition path. - boolean (required)",
                                    "quest_items_rejected": "true - The quest items rejected at this definition path. - boolean (required)"
                                },
                                "items": [
                                    {
                                        "id": "inspection-ledger - Stable identifier within its owning definition. - string (required)",
                                        "quantity": "1 - The quantity at this definition path. - integer",
                                        "item": {
                                            "id": "inspection-ledger - Stable identifier within its owning definition. - string (required)",
                                            "name": "Inspection Ledger - Player-facing character name. - string (required)",
                                            "type": "tool - The type at this definition path. - string (required)",
                                            "quantity": "1 - The quantity at this definition path. - integer",
                                            "value": "20 - The value at this definition path. - integer (required)",
                                            "sellable": "true - The sellable at this definition path. - boolean (required)",
                                            "quest_item": "false - The quest item at this definition path. - boolean (required)",
                                            "description": "A durable field ledger. - Player-facing description. - string",
                                            "image": {
                                                "url": "https://example.invalid/ledger.png - The url at this definition path. - string (required)",
                                                "title": "Inspection Ledger - Player-facing title. - string (required)"
                                            }
                                        },
                                        "requirements": [],
                                        "rewards": []
                                    }
                                ]
                            },
                            "assistant-services": {
                                "id": "assistant-services - Stable identifier within its owning definition. - string (required)",
                                "title": "Assistant Services - Player-facing title. - string (required)",
                                "type": "character - The type at this definition path. - string (required)",
                                "subtype": "Professional Services - The subtype at this definition path. - string (required)",
                                "description": "Book a specialist for one inspection scene. - Player-facing description. - string",
                                "unlocked": "true - The unlocked at this definition path. - boolean (required)",
                                "currency": "coins - The currency at this definition path. - string (required)",
                                "location_id": "loc-federal-office - Location containing this shop. - string FK (required)",
                                "purchase_verb": "Book - The purchase verb at this definition path. - string (required)",
                                "purchase_completed_verb": "booked - The purchase completed verb at this definition path. - string (required)",
                                "purchase_mode": "service - The purchase mode at this definition path. - string (required)",
                                "repeatable": "true - The repeatable at this definition path. - boolean (required)",
                                "post_purchase_presence": "current_scene - The post purchase presence at this definition path. - string (required)",
                                "items": [
                                    {
                                        "id": "book-vessa - Stable identifier within its owning definition. - string (required)",
                                        "character_id": "vessa-threadwell - The character id at this definition path. - string (required)",
                                        "price": "25 - The price at this definition path. - integer (required)",
                                        "locked": "false - The locked at this definition path. - boolean (required)",
                                        "requirements": [],
                                        "unlock_reason": "Available after accepting the appointment. - The unlock reason at this definition path. - string",
                                        "on_purchase_objective": "meet-vessa - The on purchase objective at this definition path. - string",
                                        "purchase_opening": {
                                            "dialogue": "\"Thank you for booking me. Please, follow me.\" - Authored opening dialogue shown immediately after a service booking. - string (required for service)",
                                            "guidance": "Acknowledge the payment, stay in character, and begin the booked service naturally. - Hidden guidance for the next AI scene reply. - string"
                                        }
                                    }
                                ]
                            },
                            "silkrest-outfitter": {
                                "id": "silkrest-outfitter - Stable identifier within its owning definition. - string (required)",
                                "title": "Silkrest Outfitter - Player-facing title. - string (required)",
                                "type": "clothing - The type at this definition path. - string (required)",
                                "subtype": "Outfitter - The subtype at this definition path. - string (required)",
                                "description": "Arachne-tailored formalwear. - Player-facing description. - string",
                                "unlocked": "false - The unlocked at this definition path. - boolean (required)",
                                "currency": "coins - The currency at this definition path. - string (required)",
                                "location_id": "loc-inn-silkrest-the-gilded-web - Location containing this shop. - string FK (required)",
                                "items": [
                                    {
                                        "id": "vessa-confidence-outfit - Stable identifier within its owning definition. - string (required)",
                                        "title": "Silkrest Confidence Outfit - Player-facing title. - string (required)",
                                        "price": "80 - The price at this definition path. - integer (required)",
                                        "requirements": [],
                                        "outfit": {
                                            "id": "silkrest-confidence - Stable identifier within its owning definition. - string (required)",
                                            "name": "Silkrest Confidence Outfit - Player-facing character name. - string (required)",
                                            "clothing": {
                                                "bra": "supportive underlayer suited to the character's body and the outfit design - The bra at this definition path. - string (required)",
                                                "undershirt": "soft species-safe inner layer where anatomically useful - The undershirt at this definition path. - string (required)",
                                                "shirt": "an elegant copper-and-violet arachne-tailored blouse and draped harness that displays |[character_possessive_pronoun:vessa-threadwell]| upper body attractively while preserving professional dignity - The shirt at this definition path. - string (required)",
                                                "pants": "the public outfit's skirt, hip straps, drapes, trousers, or lower-body adaptation - The pants at this definition path. - string (required)",
                                                "underwear": "comfortable species-safe underwear beneath the public look - The underwear at this definition path. - string (required)",
                                                "feet": "footwear or protective limb coverings appropriate to species anatomy - The feet at this definition path. - string (required)",
                                                "other_accessory": "inn, city, and species-themed accessories integrated with the public outfit - The other accessory at this definition path. - string (required)",
                                                "leftHand": "null - Exact authored hand-item description when occupied. - string/null (required)",
                                                "rightHand": "null - Exact authored hand-item description when occupied. - string/null (required)"
                                            }
                                        }
                                    }
                                ]
                            },
                            "hearthcross-job-board": {
                                "id": "hearthcross-job-board - Stable identifier within its owning definition. - string (required)",
                                "title": "Hearthcross Job Board - Player-facing title. - string (required)",
                                "type": "job - The type at this definition path. - string (required)",
                                "subtype": "Job Board - The subtype at this definition path. - string (required)",
                                "description": "Federal and local inspection work. - Player-facing description. - string",
                                "unlocked": "true - The unlocked at this definition path. - boolean (required)",
                                "currency": "coins - The currency at this definition path. - string (required)",
                                "location_id": "loc-federal-office - Location containing this job board. - string FK (required)",
                                "visible_count": "3 - The visible count at this definition path. - integer (required)",
                                "generic_jobs_enabled": "true - The generic jobs enabled at this definition path. - boolean (required)",
                                "items": [
                                    {
                                        "id": "audit-hearthcross-ledgers - Stable identifier within its owning definition. - string (required)",
                                        "title": "Audit the Hearthcross Ledgers - Player-facing title. - string (required)",
                                        "summary": "Compare establishment ledgers against federal filings. - The summary at this definition path. - string",
                                        "genres": [
                                            "fantasy - The 0 at this definition path. - string (required)"
                                        ],
                                        "rank": "1 - The rank at this definition path. - integer",
                                        "requirements": [],
                                        "reward_coins": "40 - The reward coins at this definition path. - integer (required)",
                                        "reward_xp": "10 - The reward xp at this definition path. - integer (required)",
                                        "reward_items": [],
                                        "client_npc_id": "vessa-threadwell - The client npc id at this definition path. - string",
                                        "start_location": {
                                            "world": "Elyndar - The world at this definition path. - string (required)",
                                            "region": "Hearthcross Province - The region at this definition path. - string (required)",
                                            "settlement_name": "Hearthcross - The settlement name at this definition path. - string (required)",
                                            "district": "Federal Quarter - The district at this definition path. - string (required)",
                                            "specific_place": "Federal Inspection Office - The specific place at this definition path. - string (required)"
                                        },
                                        "completion_criteria": "Complete when the player finishes checking the ledgers. - One private observable condition that completes the objective. - string (required)",
                                        "completion_instruction": "Have Vessa confirm the audit findings and prepare the payment. - Hidden narrator guidance applied when this output resolves. - string (required)"
                                    }
                                ]
                            }
                        },
                        "story_job_offers": {},
                        "story_job_offer_history": {},
                        "active_generated_jobs": {},
                        "story_generated_npc_pool": {}
                    }
                },
                "messages": {
                    "required": true,
                    "kind": "array",
                    "typeSpec": "array",
                    "example": [
                        {
                            "role": "assistant",
                            "speaker": "Narrator",
                            "text": "Caelira Vey offers the player a second life and a federal inspector appointment."
                        }
                    ],
                    "description": [
                        {
                            "role": "assistant - Durable character role. - string (required)",
                            "speaker": "Narrator - The speaker at this definition path. - string (required)",
                            "text": "Caelira Vey offers the player a second life and a federal inspector appointment. - The text at this definition path. - string (required)"
                        }
                    ]
                },
                "default_image_model": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "",
                    "description": "empty string - The default image model at this definition path. - string (required)"
                },
                "editor_data": {
                    "required": true,
                    "kind": "object",
                    "typeSpec": "object",
                    "example": {
                        "story_tree": {
                            "positions": {
                                "travel-hearthcross": {
                                    "x": 80,
                                    "y": 80
                                }
                            },
                            "viewport": {
                                "x": 0,
                                "y": 0,
                                "zoom": 1
                            }
                        }
                    },
                    "description": {
                        "story_tree": {
                            "positions": {
                                "travel-hearthcross": {
                                    "x": "80 - The x at this definition path. - integer (required)",
                                    "y": "80 - The y at this definition path. - integer (required)"
                                }
                            },
                            "viewport": {
                                "x": "0 - The x at this definition path. - integer (required)",
                                "y": "0 - The y at this definition path. - integer (required)",
                                "zoom": "1 - The zoom at this definition path. - integer (required)"
                            }
                        }
                    }
                },
                "title_card_subjects": {
                    "required": true,
                    "kind": "array",
                    "typeSpec": "array",
                    "example": [
                        "Vessa Threadwell",
                        "Federal Inspection Office"
                    ],
                    "description": [
                        "Vessa Threadwell - The 0 at this definition path. - string (required)",
                        "Federal Inspection Office - The 1 at this definition path. - string (required)"
                    ]
                },
                "title_card_image": {
                    "required": true,
                    "kind": "object",
                    "typeSpec": "object",
                    "example": {
                        "id": "the-inspector-title",
                        "title": "The Inspector",
                        "prompt": "Vessa and the inspector preparing to depart the federal office.",
                        "negativePrompt": "text, watermark",
                        "seed": 20260723,
                        "model": "perchance",
                        "source": "hosted",
                        "url": "https://example.invalid/the-inspector-title.png",
                        "hosted_url": "https://example.invalid/the-inspector-title.png",
                        "html": "",
                        "favorite": true,
                        "upload_attestation_classification": "Example",
                        "upload_attested_by": "creator-user-id",
                        "upload_attested_at": "2026-08-31T00:00:00.000Z",
                        "upload_attestation_policy_version": 1
                    },
                    "description": {
                        "id": "the-inspector-title - Stable identifier within its owning definition. - string (required)",
                        "title": "The Inspector - Player-facing title. - string (required)",
                        "prompt": "Vessa and the inspector preparing to depart the federal office. - The prompt at this definition path. - string (required)",
                        "negativePrompt": "text, watermark - The negative prompt at this definition path. - string (required)",
                        "seed": "20260723 - The seed at this definition path. - integer (required)",
                        "model": "perchance - The model at this definition path. - string (required)",
                        "source": "hosted - Authored source label. - string (required)",
                        "url": "https://example.invalid/the-inspector-title.png - The url at this definition path. - string (required)",
                        "hosted_url": "https://example.invalid/the-inspector-title.png - The hosted url at this definition path. - string (required)",
                        "html": "empty string - The html at this definition path. - string (required)",
                        "favorite": "true - The favorite at this definition path. - boolean (required)",
                        "upload_attestation_classification": "Example - string",
                        "upload_attested_by": "creator-user-id - User/profile identity that made the upload declaration. - string",
                        "upload_attested_at": "2026-08-31T00:00:00.000Z - Time of the upload declaration. - string",
                        "upload_attestation_policy_version": "1 - integer"
                    }
                }
            }
        },
        "compiledStoryIndexes": {
            "keyPath": [
                "storyId",
                "revisionId"
            ],
            "autoIncrement": false,
            "indexes": [],
            "fields": {
                "storyId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "the-inspector",
                    "description": "the-inspector - Links to storyDefinitions.storyId. - string FK (required)"
                },
                "revisionId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "revision-2026-08-04",
                    "description": "revision-2026-08-04 - Links to the exact immutable story revision. - string FK (required)"
                },
                "compilerVersion": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 1,
                    "description": "1 - Compiler contract used to create these indexes. - number (required)"
                },
                "definitionContentHash": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "7f3c9a21dbe54870",
                    "description": "7f3c9a21dbe54870 - Must match storyDefinitions.contentHash before the indexes may be used. - string (required)"
                },
                "startingObjectiveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "accept-inspector-appointment",
                    "description": "accept-inspector-appointment - Resolved starting objective. - string FK (required)"
                },
                "objectiveIndexById": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "structured immutable value",
                    "example": {},
                    "description": "{ travel-hearthcross: 0 } - Direct index into storyDefinitions.state.objectives.items without duplicating objective definitions. - structured immutable value (required)"
                },
                "incomingObjectiveIdsByObjectiveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "structured immutable value",
                    "example": {},
                    "description": "{ arrive-hearthcross: [travel-hearthcross] } - Indexed incoming objective links. - structured immutable value (required)"
                },
                "incomingTransitionGroupsByObjectiveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "structured immutable value",
                    "example": {},
                    "description": "{ arrive-hearthcross: { arrive-hearthcross-input-1: [{ sourceObjectiveId: travel-hearthcross, outputId: travel-hearthcross-output }] } } - Compiled OR groups of AND transition requirements used to activate destination objectives without scanning the objective tree. - structured immutable value (required)"
                },
                "outgoingObjectiveIdsByObjectiveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "structured immutable value",
                    "example": {},
                    "description": "{ travel-hearthcross: [arrive-hearthcross] } - Indexed outgoing objective links. - structured immutable value (required)"
                },
                "requirementDependentsByKey": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "structured immutable value",
                    "example": {},
                    "description": "{ objective:travel-hearthcross: [arrive-hearthcross], story_inventory:cities_completed: [judge-hearthcross-inspection] } - Objectives reevaluated when a dependency changes. - structured immutable value (required)"
                },
                "characterById": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "structured immutable value",
                    "example": {},
                    "description": "{ vessa-threadwell: { immutable character locator } } - Direct authored character and future-cast resolver index. - structured immutable value (required)"
                },
                "locationById": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "structured immutable value",
                    "example": {},
                    "description": "{ loc-city-hearthcross: { immutable location locator } } - Direct authored location resolver index. - structured immutable value (required)"
                },
                "shopById": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "structured immutable value",
                    "example": {},
                    "description": "{ field-supplies: { immutable shop locator } } - Direct authored shop resolver index. - structured immutable value (required)"
                },
                "rewardBundleById": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "structured immutable value",
                    "example": {},
                    "description": "{ introduce-vessa: { immutable reward bundle locator } } - Direct reusable reward-bundle resolver index. - structured immutable value (required)"
                }
            }
        },
        "storyLibraryEntries": {
            "keyPath": "storyId",
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byRevision",
                    "keyPath": [
                        "storyId",
                        "revisionId"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byTitle",
                    "keyPath": "title",
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byCreatorId",
                    "keyPath": "creatorId",
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byGenre",
                    "keyPath": "genres",
                    "unique": false,
                    "multiEntry": true
                }
            ],
            "fields": {
                "storyId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "the-inspector",
                    "description": "the-inspector - Stable library identity. - string (required)"
                },
                "revisionId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "revision-2026-08-04",
                    "description": "revision-2026-08-04 - Currently selected immutable local revision. - string FK (required)"
                },
                "title": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "The Inspector",
                    "description": "The Inspector - Player-facing library-card title. - string (required)"
                },
                "description": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Begin a healthier second life as a federal inspector.",
                    "description": "Begin a healthier second life as a federal inspector. - Bounded player-facing library-card description. - string"
                },
                "source": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Original",
                    "description": "Original - Authored source label used by library filters. - string (required)"
                },
                "creation_tool": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "EmberAdventures Story Skill",
                    "description": "EmberAdventures Story Skill - Tool used to create the story. - string"
                },
                "creator": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Isaac",
                    "description": "Isaac - Searchable creator display name. - string"
                },
                "creatorId": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "creator-isaac",
                    "description": "creator-isaac - Stable searchable creator identity. - string"
                },
                "genres": {
                    "required": true,
                    "kind": "array",
                    "typeSpec": "array",
                    "example": [
                        "fantasy"
                    ],
                    "description": [
                        "fantasy - Searchable story genre. - string (required)"
                    ]
                }
            }
        },
        "authoredCharacterDefinitions": {
            "keyPath": [
                "characterId",
                "revisionId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byName",
                    "keyPath": "name",
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byCreatorId",
                    "keyPath": "creator_id",
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byGenre",
                    "keyPath": "genres",
                    "unique": false,
                    "multiEntry": true
                }
            ],
            "fields": {
                "lite": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": true,
                    "description": "true - Identifies the authored Lite character format. - boolean (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Stable authored character ID. - string (required)"
                },
                "revisionId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "revision-2026-08-04",
                    "description": "revision-2026-08-04 - Immutable character revision identity. - string (required)"
                },
                "contentHash": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "c8142d90a76134be",
                    "description": "c8142d90a76134be - Verifies that this immutable character revision has not changed or collided with different content. - string (required)"
                },
                "name": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Vessa Threadwell",
                    "description": "Vessa Threadwell - Player-facing character name. - string (required)"
                },
                "fallback_name": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Dorian Ves Threadwell",
                    "description": "Dorian Ves Threadwell - Alternate-presentation name. - string (required)"
                },
                "source": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Original",
                    "description": "Original - Authored source label. - string (required)"
                },
                "creator": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Isaac",
                    "description": "Isaac - Searchable public creator display name. - string"
                },
                "creator_id": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "creator-isaac",
                    "description": "creator-isaac - Stable searchable creator identity. - string"
                },
                "creation_tool": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "EmberAdventures Character Skill",
                    "description": "EmberAdventures Character Skill - Tool and model used to create the definition. - string (required)"
                },
                "default_image_background": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "softly painted observatory interior",
                    "description": "softly painted observatory interior - Optional standalone-character visual environment guidance used only when no explicit image, scene, or location background exists. - string"
                },
                "genres": {
                    "required": true,
                    "kind": "array",
                    "typeSpec": "array",
                    "example": [
                        "fantasy",
                        "romance",
                        "adventure"
                    ],
                    "description": [
                        "fantasy - The 0 at this definition path. - string (required)",
                        "romance - The 1 at this definition path. - string (required)",
                        "adventure - The 2 at this definition path. - string (required)"
                    ]
                },
                "gender": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "female",
                    "description": "female - Canonical gender presentation. - string (required)"
                },
                "role": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Federal inspection assistant",
                    "description": "Federal inspection assistant - Durable character role. - string (required)"
                },
                "created_at": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "2026-07-24T00:44:27Z",
                    "description": "2026-07-24T00:44:27Z - Original character creation time. - string (required)"
                },
                "updated_at": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "2026-07-26T00:00:00.000Z",
                    "description": "2026-07-26T00:00:00.000Z - Most recent definition update time. - string (required)"
                },
                "version": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "integer",
                    "example": 1,
                    "description": "1 - Positive whole-number character definition version; current humanoid definitions use the exact 0-20 appearance shape. - integer (required)"
                },
                "can_die": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": false,
                    "description": "false - Whether normal gameplay may kill the character. - boolean (required)"
                },
                "romanceable": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": true,
                    "description": "true - Whether attraction preferences may adapt this character presentation. - boolean (required)"
                },
                "fallback_outfits": {
                    "required": true,
                    "kind": "array",
                    "typeSpec": "array",
                    "example": [
                        {
                            "id": "federal-public",
                            "name": "Federal Inspectorate Uniform",
                            "clothing": {
                                "undershirt": "soft species-safe inner layer where anatomically useful",
                                "shirt": "high-collared federal blouse, fitted waistcoat, modest underlayers, long side drapes adapted around |[character_possessive_pronoun:vessa-threadwell]| body junction, gloves, official satchel harness, and polished leg guards",
                                "pants": "species-safe trousers, hip drapes, straps, or lower-body adaptation matching the public design",
                                "underwear": "comfortable fitted underwear beneath the public look",
                                "feet": "footwear or protective limb coverings appropriate to species anatomy",
                                "other_accessory": "the same inn, city, and species-themed status details as the canonical public look",
                                "leftHand": null,
                                "rightHand": null
                            }
                        },
                        {
                            "id": "silkrest-confidence",
                            "name": "Silkrest Confidence Outfit",
                            "clothing": {
                                "undershirt": "soft species-safe inner layer where anatomically useful",
                                "shirt": "an elegant copper-and-violet arachne-tailored blouse and draped harness that displays |[character_possessive_pronoun:vessa-threadwell]| upper body attractively while preserving professional dignity",
                                "pants": "species-safe trousers, hip drapes, straps, or lower-body adaptation matching the public design",
                                "underwear": "comfortable fitted underwear beneath the public look",
                                "feet": "footwear or protective limb coverings appropriate to species anatomy",
                                "other_accessory": "the same inn, city, and species-themed status details as the canonical public look",
                                "leftHand": null,
                                "rightHand": null
                            }
                        },
                        {
                            "id": "private-silk",
                            "name": "Private Silk Outfit",
                            "clothing": {
                                "undershirt": "a plain copper-black woven undershirt",
                                "underwear": "plain cotton undergarments",
                                "other_accessory": "the same palette, jewelry, chains, fasteners, and body accents as the canonical private look",
                                "legwear": "species-safe stockings, straps, or limb adornments when anatomically applicable",
                                "leftHand": null,
                                "rightHand": null
                            }
                        }
                    ],
                    "description": [
                        {
                            "id": "federal-public - Stable identifier within its owning definition. - string (required)",
                            "name": "Federal Inspectorate Uniform - Player-facing character name. - string (required)",
                            "clothing": {
                                "undershirt": "soft species-safe inner layer where anatomically useful - The undershirt at this definition path. - string (required)",
                                "shirt": "high-collared federal blouse, fitted waistcoat, modest underlayers, long side drapes adapted around |[character_possessive_pronoun:vessa-threadwell]| body junction, gloves, official satchel harness, and polished leg guards - The shirt at this definition path. - string (required)",
                                "pants": "species-safe trousers, hip drapes, straps, or lower-body adaptation matching the public design - The pants at this definition path. - string (required)",
                                "underwear": "comfortable fitted underwear beneath the public look - The underwear at this definition path. - string (required)",
                                "feet": "footwear or protective limb coverings appropriate to species anatomy - The feet at this definition path. - string (required)",
                                "other_accessory": "the same inn, city, and species-themed status details as the canonical public look - The other accessory at this definition path. - string (required)",
                                "leftHand": "null - Exact authored hand-item description when occupied. - string/null (required)",
                                "rightHand": "null - Exact authored hand-item description when occupied. - string/null (required)"
                            }
                        },
                        {
                            "id": "silkrest-confidence - Stable identifier within its owning definition. - string (required)",
                            "name": "Silkrest Confidence Outfit - Player-facing character name. - string (required)",
                            "clothing": {
                                "undershirt": "soft species-safe inner layer where anatomically useful - The undershirt at this definition path. - string (required)",
                                "shirt": "an elegant copper-and-violet arachne-tailored blouse and draped harness that displays |[character_possessive_pronoun:vessa-threadwell]| upper body attractively while preserving professional dignity - The shirt at this definition path. - string (required)",
                                "pants": "species-safe trousers, hip drapes, straps, or lower-body adaptation matching the public design - The pants at this definition path. - string (required)",
                                "underwear": "comfortable fitted underwear beneath the public look - The underwear at this definition path. - string (required)",
                                "feet": "footwear or protective limb coverings appropriate to species anatomy - The feet at this definition path. - string (required)",
                                "other_accessory": "the same inn, city, and species-themed status details as the canonical public look - The other accessory at this definition path. - string (required)",
                                "leftHand": "null - Exact authored hand-item description when occupied. - string/null (required)",
                                "rightHand": "null - Exact authored hand-item description when occupied. - string/null (required)"
                            }
                        },
                        {
                            "id": "private-silk - Stable identifier within its owning definition. - string (required)",
                            "name": "Private Silk Outfit - Player-facing character name. - string (required)",
                            "clothing": {
                                "undershirt": "a plain copper-black woven undershirt - The undershirt at this definition path. - string (required)",
                                "underwear": "plain cotton undergarments - The underwear at this definition path. - string (required)",
                                "other_accessory": "the same palette, jewelry, chains, fasteners, and body accents as the canonical private look - The other accessory at this definition path. - string (required)",
                                "legwear": "species-safe stockings, straps, or limb adornments when anatomically applicable - The legwear at this definition path. - string (required)",
                                "leftHand": "null - Exact authored hand-item description when occupied. - string/null (required)",
                                "rightHand": "null - Exact authored hand-item description when occupied. - string/null (required)"
                            }
                        }
                    ]
                },
                "fallback_starting_outfit_id": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "federal-public",
                    "description": "federal-public - Starting outfit for the alternate presentation. - string (required)"
                },
                "age": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "integer",
                    "example": 27,
                    "description": "27 - Character age. - integer (required)"
                },
                "personality_description": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Intelligent, formal, observant, and professionally firm.",
                    "description": "Intelligent, formal, observant, and professionally firm. - Durable personality and behavioral guidance. - string (required)"
                },
                "speech_style": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Precise, formal, softly corrective, and increasingly candid as trust grows.",
                    "description": "Precise, formal, softly corrective, and increasingly candid as trust grows. - Durable dialogue style. - string (required)"
                },
                "boldness": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "integer",
                    "example": 4,
                    "description": "4 - Base behavioral boldness from 0 through 10. - integer (required)"
                },
                "starting_relationship_to_player": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "newly assigned coworker",
                    "description": "newly assigned coworker - Relationship copied into runtime when play begins. - string (required)"
                },
                "starting_trust": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "integer",
                    "example": 2,
                    "description": "2 - Trust copied into runtime when play begins. - integer (required)"
                },
                "starting_attraction": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "integer",
                    "example": 0,
                    "description": "0 - Attraction copied into runtime when play begins. - integer (required)"
                },
                "starting_affection": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "integer",
                    "example": 0,
                    "description": "0 - Affection copied into runtime when play begins. - integer (required)"
                },
                "starting_state_of_mind": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "professionally composed",
                    "description": "professionally composed - Mental state copied into runtime when play begins. - string (required)"
                },
                "starting_physical_state": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "healthy adult",
                    "description": "healthy adult - Physical state copied into runtime when play begins. - string (required)"
                },
                "starting_pose": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "standing attentively",
                    "description": "standing attentively - Pose copied into runtime when play begins. - string (required)"
                },
                "appearance": {
                    "required": true,
                    "kind": "object",
                    "typeSpec": "object",
                    "example": {
                        "species": "Arachne",
                        "height": 10,
                        "shoulder_width": 10,
                        "chest": 13,
                        "upper_body_build": 8,
                        "midsection_build": 8,
                        "hip_width": 10,
                        "butt_build": 8,
                        "lower_body_build": 8,
                        "arm_length": 10,
                        "leg_length": 10,
                        "skin_color": "warm brown skin with copper abdominal markings",
                        "eye_color": "amber",
                        "hair_color": "chestnut",
                        "hair_length": "waist length",
                        "hair_type": "soft waves",
                        "extra_description": "Adult arachne with a curvy humanlike upper body, large dark-umber spider lower body, warm copper abdominal markings, long chestnut hair, amber eyes, several smaller eyes at |[character_possessive_pronoun:vessa-threadwell]| temples, fine sensory hairs, dexterous spinnerets, and graceful carefully controlled legs.",
                        "extra_description_lower_body": "Arachne-specific nonhuman lower body and anatomy as described in the character design.",
                        "nonhuman_lower_body": true
                    },
                    "description": {
                        "species": "Arachne - The complete species identity, including any meaningful subtype or qualifier, at this definition path. - string (required)",
                        "height": "10 - The height at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                        "shoulder_width": "10 - The shoulder width at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                        "chest": "13 - The chest at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                        "upper_body_build": "8 - The upper body build at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                        "midsection_build": "8 - The midsection build at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                        "hip_width": "10 - The hip width at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                        "butt_build": "8 - The butt build at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                        "lower_body_build": "8 - The lower body build at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                        "arm_length": "10 - The arm length at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                        "leg_length": "10 - The leg length at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)",
                        "skin_color": "warm brown skin with copper abdominal markings - The skin color at this definition path. - string (required)",
                        "eye_color": "amber - The eye color at this definition path. - string (required)",
                        "hair_color": "chestnut - The hair color at this definition path. - string (required)",
                        "hair_length": "waist length - The hair length at this definition path. - string (required)",
                        "hair_type": "soft waves - The hair type at this definition path. - string (required)",
                        "extra_description": "Adult arachne with a curvy humanlike upper body, large dark-umber spider lower body, warm copper abdominal markings, long chestnut hair, amber eyes, several smaller eyes at |[character_possessive_pronoun:vessa-threadwell]| temples, fine sensory hairs, dexterous spinnerets, and graceful carefully controlled legs. - The extra description at this definition path. - string",
                        "extra_description_lower_body": "Arachne-specific nonhuman lower body and anatomy as described in the character design. - The extra description lower body at this definition path. - string",
                        "nonhuman_lower_body": "true - The nonhuman lower body at this definition path. - boolean (required)"
                    }
                },
                "outfits": {
                    "required": true,
                    "kind": "array",
                    "typeSpec": "array",
                    "example": [
                        {
                            "id": "federal-public",
                            "name": "Federal Inspectorate Uniform",
                            "clothing": {
                                "bra": "supportive underlayer suited to the character's body and the outfit design",
                                "undershirt": "soft species-safe inner layer where anatomically useful",
                                "shirt": "high-collared federal blouse, fitted waistcoat, modest underlayers, long side drapes adapted around |[character_possessive_pronoun:vessa-threadwell]| body junction, gloves, official satchel harness, and polished leg guards",
                                "pants": "the public outfit's skirt, hip straps, drapes, trousers, or lower-body adaptation",
                                "underwear": "comfortable species-safe underwear beneath the public look",
                                "feet": "footwear or protective limb coverings appropriate to species anatomy",
                                "other_accessory": "inn, city, and species-themed accessories integrated with the public outfit",
                                "leftHand": null,
                                "rightHand": null
                            }
                        },
                        {
                            "id": "silkrest-confidence",
                            "name": "Silkrest Confidence Outfit",
                            "clothing": {
                                "bra": "supportive underlayer suited to the character's body and the outfit design",
                                "undershirt": "soft species-safe inner layer where anatomically useful",
                                "shirt": "an elegant copper-and-violet arachne-tailored blouse and draped harness that displays |[character_possessive_pronoun:vessa-threadwell]| upper body attractively while preserving professional dignity",
                                "pants": "the public outfit's skirt, hip straps, drapes, trousers, or lower-body adaptation",
                                "underwear": "comfortable species-safe underwear beneath the public look",
                                "feet": "footwear or protective limb coverings appropriate to species anatomy",
                                "other_accessory": "inn, city, and species-themed accessories integrated with the public outfit",
                                "leftHand": null,
                                "rightHand": null
                            }
                        },
                        {
                            "id": "private-silk",
                            "name": "Private Silk Outfit",
                            "clothing": {
                                "bra": "a plain copper-black woven undershirt",
                                "underwear": "plain black linen briefs",
                                "other_accessory": "the outfit-specific jewelry, chains, fasteners, and body accents described in the design",
                                "legwear": "species-safe stockings, straps, or leg adornments when anatomically applicable",
                                "leftHand": null,
                                "rightHand": null
                            }
                        }
                    ],
                    "description": [
                        {
                            "id": "federal-public - Stable identifier within its owning definition. - string (required)",
                            "name": "Federal Inspectorate Uniform - Player-facing character name. - string (required)",
                            "clothing": {
                                "bra": "supportive underlayer suited to the character's body and the outfit design - The bra at this definition path. - string (required)",
                                "undershirt": "soft species-safe inner layer where anatomically useful - The undershirt at this definition path. - string (required)",
                                "shirt": "high-collared federal blouse, fitted waistcoat, modest underlayers, long side drapes adapted around |[character_possessive_pronoun:vessa-threadwell]| body junction, gloves, official satchel harness, and polished leg guards - The shirt at this definition path. - string (required)",
                                "pants": "the public outfit's skirt, hip straps, drapes, trousers, or lower-body adaptation - The pants at this definition path. - string (required)",
                                "underwear": "comfortable species-safe underwear beneath the public look - The underwear at this definition path. - string (required)",
                                "feet": "footwear or protective limb coverings appropriate to species anatomy - The feet at this definition path. - string (required)",
                                "other_accessory": "inn, city, and species-themed accessories integrated with the public outfit - The other accessory at this definition path. - string (required)",
                                "leftHand": "null - Exact authored hand-item description when occupied. - string/null (required)",
                                "rightHand": "null - Exact authored hand-item description when occupied. - string/null (required)"
                            }
                        },
                        {
                            "id": "silkrest-confidence - Stable identifier within its owning definition. - string (required)",
                            "name": "Silkrest Confidence Outfit - Player-facing character name. - string (required)",
                            "clothing": {
                                "bra": "supportive underlayer suited to the character's body and the outfit design - The bra at this definition path. - string (required)",
                                "undershirt": "soft species-safe inner layer where anatomically useful - The undershirt at this definition path. - string (required)",
                                "shirt": "an elegant copper-and-violet arachne-tailored blouse and draped harness that displays |[character_possessive_pronoun:vessa-threadwell]| upper body attractively while preserving professional dignity - The shirt at this definition path. - string (required)",
                                "pants": "the public outfit's skirt, hip straps, drapes, trousers, or lower-body adaptation - The pants at this definition path. - string (required)",
                                "underwear": "comfortable species-safe underwear beneath the public look - The underwear at this definition path. - string (required)",
                                "feet": "footwear or protective limb coverings appropriate to species anatomy - The feet at this definition path. - string (required)",
                                "other_accessory": "inn, city, and species-themed accessories integrated with the public outfit - The other accessory at this definition path. - string (required)",
                                "leftHand": "null - Exact authored hand-item description when occupied. - string/null (required)",
                                "rightHand": "null - Exact authored hand-item description when occupied. - string/null (required)"
                            }
                        },
                        {
                            "id": "private-silk - Stable identifier within its owning definition. - string (required)",
                            "name": "Private Silk Outfit - Player-facing character name. - string (required)",
                            "clothing": {
                                "bra": "a plain copper-black woven undershirt - The bra at this definition path. - string (required)",
                                "underwear": "plain black linen briefs - The underwear at this definition path. - string (required)",
                                "other_accessory": "the outfit-specific jewelry, chains, fasteners, and body accents described in the design - The other accessory at this definition path. - string (required)",
                                "legwear": "species-safe stockings, straps, or leg adornments when anatomically applicable - The legwear at this definition path. - string (required)",
                                "leftHand": "null - Exact authored hand-item description when occupied. - string/null (required)",
                                "rightHand": "null - Exact authored hand-item description when occupied. - string/null (required)"
                            }
                        }
                    ]
                },
                "starting_outfit_id": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "federal-public",
                    "description": "federal-public - Outfit copied into mutable clothing when play begins. - string (required)"
                },
                "starting_inventory": {
                    "required": false,
                    "kind": "array",
                    "typeSpec": "array",
                    "example": [],
                    "description": []
                },
                "starting_known_facts": {
                    "required": true,
                    "kind": "array",
                    "typeSpec": "array",
                    "example": [
                        "Vessa is the player's assigned assistant and the central emotional relationship throughout all twenty-two cities.",
                        "|[character_pronoun_cap:vessa-threadwell]| has Weaver's Fever, causing frequent cycles, excess silk, scent sensitivity, insomnia, intrusive fantasies, clinginess, involuntary web-building, and possible feral escalation if neglected.",
                        "The fever is treatable by the local healer.",
                        "|[character_pronoun_cap:vessa-threadwell]| entered regulation to protect workers and because precision felt safer than emotional exposure.",
                        "Silkrest is |[character_possessive_pronoun:vessa-threadwell]| first major turning point because |[character_pronoun:vessa-threadwell]| sees arachne treated as respected and desirable.",
                        "If accepted, |[character_pronoun:vessa-threadwell]| becomes the first acknowledged household partner and participates in later relationship and household decisions.",
                        "|[character_pronoun_cap:vessa-threadwell]| may have independent friendships, attractions, boundaries, jealousy, and private needs rather than functioning only as administrator.",
                        "By the final cities |[character_pronoun:vessa-threadwell]| can ask directly for affection and wear clothing |[character_pronoun:vessa-threadwell]| genuinely enjoys."
                    ],
                    "description": [
                        "Vessa is the player's assigned assistant and the central emotional relationship throughout all twenty-two cities. - The 0 at this definition path. - string (required)",
                        "|[character_pronoun_cap:vessa-threadwell]| has Weaver's Fever, causing frequent cycles, excess silk, scent sensitivity, insomnia, intrusive fantasies, clinginess, involuntary web-building, and possible feral escalation if neglected. - The 1 at this definition path. - string (required)",
                        "The fever is treatable by the local healer. - The 2 at this definition path. - string (required)",
                        "|[character_pronoun_cap:vessa-threadwell]| entered regulation to protect workers and because precision felt safer than emotional exposure. - The 3 at this definition path. - string (required)",
                        "Silkrest is |[character_possessive_pronoun:vessa-threadwell]| first major turning point because |[character_pronoun:vessa-threadwell]| sees arachne treated as respected and desirable. - The 4 at this definition path. - string (required)",
                        "If accepted, |[character_pronoun:vessa-threadwell]| becomes the first acknowledged household partner and participates in later relationship and household decisions. - The 5 at this definition path. - string (required)",
                        "|[character_pronoun_cap:vessa-threadwell]| may have independent friendships, attractions, boundaries, jealousy, and private needs rather than functioning only as administrator. - The 6 at this definition path. - string (required)",
                        "By the final cities |[character_pronoun:vessa-threadwell]| can ask directly for affection and wear clothing |[character_pronoun:vessa-threadwell]| genuinely enjoys. - The 7 at this definition path. - string (required)"
                    ]
                },
                "default_seed": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "integer",
                    "example": 20260723,
                    "description": "20260723 - Default image-generation seed. - integer (required)"
                },
                "image_prompt_config": {
                    "required": true,
                    "kind": "object",
                    "typeSpec": "object",
                    "example": {
                        "seed_enabled": true,
                        "seed": 20260723,
                        "style": "",
                        "profile_style": "",
                        "negative": "",
                        "negative_prompt": ""
                    },
                    "description": {
                        "seed_enabled": "true - The seed enabled at this definition path. - boolean (required)",
                        "seed": "20260723 - The seed at this definition path. - integer (required)",
                        "style": "empty string - The style at this definition path. - string (required)",
                        "profile_style": "empty string - The profile style at this definition path. - string (required)",
                        "negative": "empty string - The negative at this definition path. - string (required)",
                        "negative_prompt": "empty string - The negative prompt at this definition path. - string (required)"
                    }
                },
                "default_profile_image": {
                    "required": true,
                    "kind": "object",
                    "typeSpec": "object",
                    "example": {
                        "url": "",
                        "local_image_id": "",
                        "source": "none",
                        "seed": null,
                        "prompt": "",
                        "negative_prompt": "",
                        "note": "",
                        "male": false
                    },
                    "description": {
                        "url": "empty string - The url at this definition path. - string (required)",
                        "local_image_id": "empty string - The local image id at this definition path. - string (required)",
                        "source": "none - Authored source label. - string (required)",
                        "seed": "null - The seed at this definition path. - number|string|null (required)",
                        "prompt": "empty string - The prompt at this definition path. - string (required)",
                        "negative_prompt": "empty string - The negative prompt at this definition path. - string (required)",
                        "note": "empty string - The note at this definition path. - string (required)",
                        "male": "false - The male at this definition path. - boolean (required)"
                    }
                },
                "profile_image_presentations": {
                    "required": true,
                    "kind": "object",
                    "typeSpec": "object",
                    "example": {
                        "male": {
                            "url": "",
                            "local_image_id": "",
                            "source": "none",
                            "seed": null,
                            "prompt": "",
                            "negative_prompt": "",
                            "note": "",
                            "male": true
                        },
                        "non_male": {
                            "url": "",
                            "local_image_id": "",
                            "source": "none",
                            "seed": null,
                            "prompt": "",
                            "negative_prompt": "",
                            "note": "",
                            "male": false
                        }
                    },
                    "description": {
                        "male": {
                            "url": "empty string - The url at this definition path. - string (required)",
                            "local_image_id": "empty string - The local image id at this definition path. - string (required)",
                            "source": "none - Authored source label. - string (required)",
                            "seed": "null - The seed at this definition path. - number|string|null (required)",
                            "prompt": "empty string - The prompt at this definition path. - string (required)",
                            "negative_prompt": "empty string - The negative prompt at this definition path. - string (required)",
                            "note": "empty string - The note at this definition path. - string (required)",
                            "male": "true - The male at this definition path. - boolean (required)"
                        },
                        "non_male": {
                            "url": "empty string - The url at this definition path. - string (required)",
                            "local_image_id": "empty string - The local image id at this definition path. - string (required)",
                            "source": "none - Authored source label. - string (required)",
                            "seed": "null - The seed at this definition path. - number|string|null (required)",
                            "prompt": "empty string - The prompt at this definition path. - string (required)",
                            "negative_prompt": "empty string - The negative prompt at this definition path. - string (required)",
                            "note": "empty string - The note at this definition path. - string (required)",
                            "male": "false - The male at this definition path. - boolean (required)"
                        }
                    }
                },
                "profile_images": {
                    "required": true,
                    "kind": "object",
                    "typeSpec": "object",
                    "example": {
                        "active_image_id": "",
                        "image_ids": []
                    },
                    "description": {
                        "active_image_id": "empty string - The active image id at this definition path. - string (required)",
                        "image_ids": []
                    }
                },
                "images": {
                    "required": true,
                    "kind": "object",
                    "typeSpec": "object",
                    "example": {
                        "active_image_id": "",
                        "image_ids": []
                    },
                    "description": {
                        "active_image_id": "empty string - The active image id at this definition path. - string (required)",
                        "image_ids": []
                    }
                },
                "voice": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number|string|null",
                    "example": null,
                    "description": "null - Runtime-populated voice assignment. - number|string|null (required)"
                }
            }
        },
        "characterLibraryEntries": {
            "keyPath": "characterId",
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byRevision",
                    "keyPath": [
                        "characterId",
                        "revisionId"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byName",
                    "keyPath": "name",
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byCreatorId",
                    "keyPath": "creatorId",
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byGenre",
                    "keyPath": "genres",
                    "unique": false,
                    "multiEntry": true
                }
            ],
            "fields": {
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Stable library character identity. - string (required)"
                },
                "revisionId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "revision-2026-08-04",
                    "description": "revision-2026-08-04 - Currently selected immutable local revision. - string FK (required)"
                },
                "name": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Vessa Threadwell",
                    "description": "Vessa Threadwell - Player-facing library-card name. - string (required)"
                },
                "fallbackName": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Dorian Ves Threadwell",
                    "description": "Dorian Ves Threadwell - Alternate-presentation display name. - string (required)"
                },
                "role": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Federal inspection assistant",
                    "description": "Federal inspection assistant - Bounded player-facing role summary. - string (required)"
                },
                "source": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Original",
                    "description": "Original - Authored source label used by library filters. - string (required)"
                },
                "creation_tool": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "EmberAdventures Character Skill",
                    "description": "EmberAdventures Character Skill - Tool used to create the character. - string"
                },
                "creator": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Isaac",
                    "description": "Isaac - Searchable creator display name. - string"
                },
                "creatorId": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "creator-isaac",
                    "description": "creator-isaac - Stable searchable creator identity. - string"
                },
                "genres": {
                    "required": true,
                    "kind": "array",
                    "typeSpec": "array",
                    "example": [
                        "fantasy"
                    ],
                    "description": [
                        "fantasy - Searchable character genre. - string (required)"
                    ]
                },
                "gender": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "female",
                    "description": "female - Canonical character presentation used by library filters. - string (required)"
                }
            }
        },
        "assetBlobs": {
            "keyPath": "imageId",
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byContentHash",
                    "keyPath": "contentHash",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "imageId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "1785358068234.9626",
                    "description": "1785358068234.9626 - Same globally unique imageId used by the owning image record. - string (required)"
                },
                "blob": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "Blob",
                    "example": {
                        "diagnosticBlob": true
                    },
                    "description": "<PNG Blob for Vessa Threadwell> - Actual image binary. - Blob (required)"
                },
                "mimeType": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "image/png",
                    "description": "image/png - Blob MIME type. - string (required)"
                },
                "byteLength": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 428391,
                    "description": "428391 - Stored size. - number (required)"
                },
                "contentHash": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "95c0e3b71f6a4283",
                    "description": "95c0e3b71f6a4283 - Identifies duplicate binary content and verifies the stored image. - string (required)"
                }
            }
        },
        "characterProfileImages": {
            "keyPath": "imageId",
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byCharacter",
                    "keyPath": "characterId",
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byCharacterPresentation",
                    "keyPath": [
                        "characterId",
                        "presentation"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byFavorite",
                    "keyPath": "favorite",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "imageId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "1785358068234.9626",
                    "description": "1785358068234.9626 - Stable profile-image identity. - string (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Character whose references share this profile image. - string FK (required)"
                },
                "presentation": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "male | non_male",
                    "example": "non_male",
                    "description": "non_male - Gender presentation for which the image was authored or generated. - male | non_male (required)"
                },
                "favorite": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": false,
                    "description": "false - Whether the player marked this image as a favorite. - boolean (required)"
                },
                "createdAt": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "2026-07-23T14:17:48.234Z",
                    "description": "2026-07-23T14:17:48.234Z - Time this profile image record was created. - string"
                },
                "source": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "generated",
                    "description": "generated - Exact image origin used to distinguish generated images from hosted or imported images. - string"
                },
                "model": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "game-art-icon",
                    "description": "game-art-icon - Image model used to generate the image. - string"
                },
                "seed": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "number|string|null",
                    "example": 20260723,
                    "description": "20260723 - Generation seed. - number|string|null"
                },
                "prompt": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Vessa Threadwell portrait.",
                    "description": "Vessa Threadwell portrait. - Exact generation prompt. - string"
                },
                "negativePrompt": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "text, watermark",
                    "description": "text, watermark - Exact negative generation prompt. - string"
                },
                "url": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "https://example.invalid/vessa-profile.png",
                    "description": "https://example.invalid/vessa-profile.png - Hosted image URL when present; otherwise a same-imageId record exists in assetBlobs. - string"
                }
            }
        },
        "characterProfileImageSelections": {
            "keyPath": [
                "characterId",
                "presentation"
            ],
            "autoIncrement": false,
            "indexes": [],
            "fields": {
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Character whose selected profile image is stored. - string FK (required)"
                },
                "presentation": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "male | non_male",
                    "example": "non_male",
                    "description": "non_male - Gender presentation whose selection is stored. - male | non_male (required)"
                },
                "imageId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "1785358068234.9626",
                    "description": "1785358068234.9626 - Selected characterProfileImages image. - string FK/null (required)"
                }
            }
        },
        "characterImages": {
            "keyPath": "imageId",
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byCharacter",
                    "keyPath": "characterId",
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byCharacterPresentation",
                    "keyPath": [
                        "characterId",
                        "presentation"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byFavorite",
                    "keyPath": "favorite",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "imageId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "1785358068234.9731",
                    "description": "1785358068234.9731 - Stable normal-size character-image identity. - string (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Character whose references share this solo-character image. - string FK (required)"
                },
                "presentation": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "male | non_male",
                    "example": "non_male",
                    "description": "non_male - Finalized presentation for which this solo-character image is valid. - male | non_male (required)"
                },
                "favorite": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": false,
                    "description": "false - Whether the player marked this image as a favorite. - boolean (required)"
                },
                "model": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "game-art",
                    "description": "game-art - Image model used to generate the image. - string"
                },
                "seed": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "number|string|null",
                    "example": 20260724,
                    "description": "20260724 - Generation seed. - number|string|null"
                },
                "prompt": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Vessa Threadwell reviewing an inspection itinerary.",
                    "description": "Vessa Threadwell reviewing an inspection itinerary. - Exact generation prompt. - string"
                },
                "negativePrompt": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "text, watermark",
                    "description": "text, watermark - Exact negative generation prompt. - string"
                },
                "url": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "https://example.invalid/vessa-character.png",
                    "description": "https://example.invalid/vessa-character.png - Hosted image URL when present; otherwise a same-imageId record exists in assetBlobs. - string"
                }
            }
        },
        "storyItemImages": {
            "keyPath": "imageId",
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byStory",
                    "keyPath": "storyId",
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byStoryItem",
                    "keyPath": [
                        "storyId",
                        "itemId"
                    ],
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "storyId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "the-inspector",
                    "description": "the-inspector - Story whose item instances share this image. - string FK (required)"
                },
                "itemId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "federal-inspector-badge",
                    "description": "federal-inspector-badge - Stable authored story-item identity. - string (required)"
                },
                "imageId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "story-item-federal-inspector-badge-1",
                    "description": "story-item-federal-inspector-badge-1 - Stable item-image identity. - string (required)"
                },
                "model": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "game-art-icon",
                    "description": "game-art-icon - Image model used to generate the image. - string"
                },
                "seed": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "number|string|null",
                    "example": 20260725,
                    "description": "20260725 - Generation seed. - number|string|null"
                },
                "prompt": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "A polished Federal Inspectorate badge.",
                    "description": "A polished Federal Inspectorate badge. - Exact generation prompt. - string"
                },
                "negativePrompt": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "text, watermark",
                    "description": "text, watermark - Exact negative generation prompt. - string"
                },
                "url": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "https://example.invalid/federal-inspector-badge.png",
                    "description": "https://example.invalid/federal-inspector-badge.png - Hosted image URL when present; otherwise a same-imageId record exists in assetBlobs. - string"
                }
            }
        },
        "storyItemImageSelections": {
            "keyPath": [
                "storyId",
                "itemId"
            ],
            "autoIncrement": false,
            "indexes": [],
            "fields": {
                "storyId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "the-inspector",
                    "description": "the-inspector - Story owning the authored item identity. - string FK (required)"
                },
                "itemId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "federal-inspector-badge",
                    "description": "federal-inspector-badge - Stable authored item identity. - string (required)"
                },
                "imageId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "story-item-federal-inspector-badge-1",
                    "description": "story-item-federal-inspector-badge-1 - Selected storyItemImages image. - string FK/null (required)"
                }
            }
        },
        "storyOutfitImages": {
            "keyPath": "imageId",
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byStory",
                    "keyPath": "storyId",
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byStoryOutfit",
                    "keyPath": [
                        "storyId",
                        "characterId",
                        "outfitId"
                    ],
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "storyId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "the-inspector",
                    "description": "the-inspector - Story whose outfit instances share this image. - string FK (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Character definition owning the outfit id. - string FK (required)"
                },
                "outfitId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "federal-public",
                    "description": "federal-public - Stable authored story-outfit identity. - string (required)"
                },
                "imageId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "story-outfit-federal-public-1",
                    "description": "story-outfit-federal-public-1 - Stable outfit-image identity. - string (required)"
                },
                "model": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "game-art-icon",
                    "description": "game-art-icon - Image model used to generate the image. - string"
                },
                "seed": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "number|string|null",
                    "example": 20260726,
                    "description": "20260726 - Generation seed. - number|string|null"
                },
                "prompt": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "A formal Federal Inspectorate uniform.",
                    "description": "A formal Federal Inspectorate uniform. - Exact generation prompt. - string"
                },
                "negativePrompt": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "text, watermark",
                    "description": "text, watermark - Exact negative generation prompt. - string"
                },
                "url": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "https://example.invalid/federal-public-outfit.png",
                    "description": "https://example.invalid/federal-public-outfit.png - Hosted image URL when present; otherwise a same-imageId record exists in assetBlobs. - string"
                }
            }
        },
        "storyOutfitImageSelections": {
            "keyPath": [
                "storyId",
                "characterId",
                "outfitId"
            ],
            "autoIncrement": false,
            "indexes": [],
            "fields": {
                "storyId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "the-inspector",
                    "description": "the-inspector - Story owning the authored outfit identity. - string FK (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Character definition owning the outfit id. - string FK (required)"
                },
                "outfitId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "federal-public",
                    "description": "federal-public - Stable authored outfit identity. - string (required)"
                },
                "imageId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "story-outfit-federal-public-1",
                    "description": "story-outfit-federal-public-1 - Selected storyOutfitImages image. - string FK/null (required)"
                }
            }
        },
        "storyTitleImages": {
            "keyPath": "imageId",
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byStory",
                    "keyPath": "storyId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "storyId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "the-inspector",
                    "description": "the-inspector - Story whose library entry uses this title image. - string FK (required)"
                },
                "storyTitle": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "The Inspector",
                    "description": "The Inspector - Story title retained so orphaned images can reconnect after deleting and reimporting the same story under a new local id. - string"
                },
                "imageId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "story-title-the-inspector-1",
                    "description": "story-title-the-inspector-1 - Stable story-title-image identity. - string (required)"
                },
                "source": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "generated",
                    "description": "generated - Exact image origin used to distinguish generated images from hosted or imported images. - string"
                },
                "model": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "game-art",
                    "description": "game-art - Image model used to generate the image. - string"
                },
                "seed": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "number|string|null",
                    "example": 20260727,
                    "description": "20260727 - Generation seed. - number|string|null"
                },
                "prompt": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "The Inspector story title image.",
                    "description": "The Inspector story title image. - Exact generation prompt. - string"
                },
                "negativePrompt": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "text, watermark",
                    "description": "text, watermark - Exact negative generation prompt. - string"
                },
                "favorite": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": false,
                    "description": "false - Whether the player marked this image as a favorite. - boolean"
                },
                "upload_attestation_classification": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Example",
                    "description": "Example - string"
                },
                "upload_attested_by": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "profile-or-account-id",
                    "description": "profile-or-account-id - User identity that made the title-card classification declaration. - string"
                },
                "upload_attested_at": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "2026-08-31T12:00:00.000Z",
                    "description": "2026-08-31T12:00:00.000Z - Time the title-card classification was declared. - string"
                },
                "upload_attestation_policy_version": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "integer",
                    "example": 1,
                    "description": "1 - integer"
                },
                "url": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "https://example.invalid/the-inspector-title.png",
                    "description": "https://example.invalid/the-inspector-title.png - Hosted image URL when present; otherwise a same-imageId record exists in assetBlobs. - string"
                }
            }
        },
        "storyTitleImageSelections": {
            "keyPath": "storyId",
            "autoIncrement": false,
            "indexes": [],
            "fields": {
                "storyId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "the-inspector",
                    "description": "the-inspector - Story whose local library title-image selection is stored. - string FK (required)"
                },
                "imageId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "story-title-the-inspector-1",
                    "description": "story-title-the-inspector-1 - Selected storyTitleImages image. - string FK/null (required)"
                }
            }
        },
        "storyRewardImages": {
            "keyPath": "imageId",
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byStory",
                    "keyPath": "storyId",
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byStoryReward",
                    "keyPath": [
                        "storyId",
                        "rewardImageId"
                    ],
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "storyId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "the-inspector",
                    "description": "the-inspector - Story whose save instances share this authored reward image. - string FK (required)"
                },
                "rewardImageId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "appointment-accepted",
                    "description": "appointment-accepted - Stable authored reward-image identity. - string (required)"
                },
                "imageId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "story-reward-appointment-accepted-1",
                    "description": "story-reward-appointment-accepted-1 - Stable stored image identity. - string (required)"
                },
                "title": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "The Inspector's Appointment",
                    "description": "The Inspector's Appointment - Reward-image display title. - string"
                },
                "model": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "game-art",
                    "description": "game-art - Image model used to generate the image. - string"
                },
                "seed": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "number|string|null",
                    "example": 20260728,
                    "description": "20260728 - Generation seed. - number|string|null"
                },
                "prompt": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Vessa presents the new Inspector with the official appointment.",
                    "description": "Vessa presents the new Inspector with the official appointment. - Exact generation prompt. - string"
                },
                "negativePrompt": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "text, watermark",
                    "description": "text, watermark - Exact negative generation prompt. - string"
                },
                "url": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "https://example.invalid/appointment-accepted.png",
                    "description": "https://example.invalid/appointment-accepted.png - Hosted image URL when present; otherwise a same-imageId record exists in assetBlobs. - string"
                }
            }
        },
        "saveHeaders": {
            "keyPath": "saveId",
            "autoIncrement": true,
            "indexes": [
                {
                    "name": "byStoryRevision",
                    "keyPath": [
                        "storyId",
                        "revisionId"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byCreatedAt",
                    "keyPath": "createdAt",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 27,
                    "description": "27 - Stable numeric save identity. - number (required)"
                },
                "storyId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "the-inspector",
                    "description": "the-inspector - Links to storyDefinitions.storyId. - string FK (required)"
                },
                "revisionId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "revision-2026-08-04",
                    "description": "revision-2026-08-04 - Links to the immutable story revision used by this save. - string FK (required)"
                },
                "playerCharacterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "silas-dorne-4a82f11c",
                    "description": "silas-dorne-4a82f11c - Identifies exactly one saveCharacterDefinitions record as the player. - string FK (required)"
                },
                "displayName": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "The Inspector",
                    "description": "The Inspector - Player-editable Load Adventure name. - string (required)"
                },
                "storyGuidance": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Keep the inspection premise focused on local people and practical consequences.",
                    "description": "Keep the inspection premise focused on local people and practical consequences. - Player-editable AI guidance for this save. - string"
                },
                "titleImageId": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "1785358068234.9626",
                    "description": "1785358068234.9626 - Optional shared image used by generated saves in Load Adventure. - string FK"
                },
                "createdAt": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 1785870000000,
                    "description": "1785870000000 - Save creation time. - number (required)"
                }
            }
        },
        "saveCommitState": {
            "keyPath": "saveId",
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byTime",
                    "keyPath": "time",
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "sesNum": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 12,
                    "description": "12 - Increments for each user-level open/play session. - number (required)"
                },
                "comId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 49,
                    "description": "49 - Last atomically committed change in this session. - number (required)"
                },
                "isOpen": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": true,
                    "description": "true - Whether the current persistence session is open. - boolean (required)"
                },
                "time": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 1785870123456,
                    "description": "1785870123456 - Last successful commit time and Load Adventure ordering value. - number (required)"
                }
            }
        },
        "saveCharacterDefinitions": {
            "keyPath": [
                "saveId",
                "characterId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Unique finalized runtime character identity; use a stable readable id with a deterministic hash suffix so same-name characters cannot collide. - string (required)"
                },
                "definitionType": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "humanoid | animal",
                    "example": "humanoid",
                    "description": "humanoid - Distinguishes normal humanoid character records from lean animal records. - humanoid | animal (required)"
                },
                "name": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Vessa Threadwell",
                    "description": "Vessa Threadwell - Finalized in-game name. - string (required)"
                },
                "species": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Arachne",
                    "description": "Arachne - Finalized species for either a humanoid or animal definition. - string (required)"
                },
                "physicalDescription": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "",
                    "description": " - Complete physical description for an animal definition; empty for humanoid definitions stored in characterAppearance. - string (required)"
                },
                "canDie": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": false,
                    "description": "false - Exact finalized character can_die value. - boolean (required)"
                },
                "age": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 27,
                    "description": "27 - Finalized character age. - number (required)"
                },
                "gender": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "female",
                    "description": "female - Finalized character gender. - string (required)"
                },
                "personalityDescription": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Intelligent, formal, observant, and professionally firm.",
                    "description": "Intelligent, formal, observant, and professionally firm. - Durable personality_description. - string (required)"
                },
                "speechStyle": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Precise, formal, softly corrective, and increasingly candid as trust grows.",
                    "description": "Precise, formal, softly corrective, and increasingly candid as trust grows. - Current speech_style. - string (required)"
                },
                "boldness": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number/string",
                    "example": 4,
                    "description": "4 - Current numeric or descriptive character boldness. - number/string (required)"
                }
            }
        },
        "characterAppearance": {
            "keyPath": [
                "saveId",
                "characterId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Links to saveCharacterDefinitions. - string FK (required)"
                },
                "species": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Arachne",
                    "description": "Arachne - Current appearance.species, including any meaningful subtype or qualifier. - string (required)"
                },
                "height": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number/string",
                    "example": 10,
                    "description": "10 - Current appearance.height, whole number from 0 through 20 or a non-empty custom description. - number/string (required)"
                },
                "shoulderWidth": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number/string",
                    "example": 10,
                    "description": "10 - Current appearance.shoulder_width, whole number from 0 through 20 or a non-empty custom description. - number/string (required)"
                },
                "chest": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number/string",
                    "example": 13,
                    "description": "13 - The chest at this definition path; whole number from 0 through 20 or a non-empty custom description. - number/string (required)"
                },
                "upperBodyBuild": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number/string",
                    "example": 8,
                    "description": "8 - Current appearance.upper_body_build, whole number from 0 through 20 or a non-empty custom description. - number/string (required)"
                },
                "midsectionBuild": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number/string",
                    "example": 8,
                    "description": "8 - Current appearance.midsection_build, whole number from 0 through 20 or a non-empty custom description. - number/string (required)"
                },
                "hipWidth": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number/string",
                    "example": 10,
                    "description": "10 - Current appearance.hip_width, whole number from 0 through 20 or a non-empty custom description. - number/string (required)"
                },
                "buttBuild": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number/string",
                    "example": 8,
                    "description": "8 - Current appearance.butt_build, whole number from 0 through 20 or a non-empty custom description. - number/string (required)"
                },
                "lowerBodyBuild": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number/string",
                    "example": 8,
                    "description": "8 - Current appearance.lower_body_build, whole number from 0 through 20 or a non-empty custom description. - number/string (required)"
                },
                "armLength": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number/string",
                    "example": 10,
                    "description": "10 - Current appearance.arm_length, whole number from 0 through 20 or a non-empty custom description. - number/string (required)"
                },
                "legLength": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number/string",
                    "example": 10,
                    "description": "10 - Current appearance.leg_length, whole number from 0 through 20 or a non-empty custom description. - number/string (required)"
                },
                "skinColor": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "warm brown skin with copper abdominal markings",
                    "description": "warm brown skin with copper abdominal markings - Current appearance.skin_color. - string (required)"
                },
                "eyeColor": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "amber",
                    "description": "amber - Current appearance.eye_color. - string (required)"
                },
                "hairColor": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "chestnut",
                    "description": "chestnut - Current appearance.hair_color. - string (required)"
                },
                "hairLength": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "waist length",
                    "description": "waist length - Current appearance.hair_length. - string (required)"
                },
                "hairType": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "soft waves",
                    "description": "soft waves - Current appearance.hair_type. - string (required)"
                },
                "extraDescription": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Adult arachne with a curvy humanlike upper body, large dark-umber spider lower body, warm copper abdominal markings, long chestnut hair, amber eyes, several smaller eyes at her temples, fine sensory hairs, dexterous spinnerets, and graceful carefully controlled legs.",
                    "description": "Adult arachne with a curvy humanlike upper body, large dark-umber spider lower body, warm copper abdominal markings, long chestnut hair, amber eyes, several smaller eyes at her temples, fine sensory hairs, dexterous spinnerets, and graceful carefully controlled legs. - Current appearance.extra_description. - string"
                },
                "extraDescriptionLowerBody": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Arachne-specific nonhuman lower body and anatomy as described in the character design.",
                    "description": "Arachne-specific nonhuman lower body and anatomy as described in the character design. - Current appearance.extra_description_lower_body. - string"
                },
                "maleOnlyExtraDescription": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string/null",
                    "example": "short neatly trimmed beard",
                    "description": "short neatly trimmed beard - Current appearance.male_only_extra_description when the active presentation is male; optional text or null. - string/null"
                },
                "nonMaleOnlyExtraDescription": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string/null",
                    "example": "clean-shaven face",
                    "description": "clean-shaven face - Current appearance.non_male_only_extra_description when the active presentation is non-male; optional text or null. - string/null"
                },
                "nonhumanLowerBody": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": true,
                    "description": "true - Current appearance.nonhuman_lower_body. - boolean (required)"
                }
            }
        },
        "characterSettings": {
            "keyPath": [
                "saveId",
                "characterId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Links to saveCharacterDefinitions. - string FK (required)"
                },
                "voice": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Google UK English Female",
                    "description": "Google UK English Female - Current saved voice assignment. - string"
                },
                "imageSeedEnabled": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": true,
                    "description": "true - Whether normal images use this character's fixed seed. - boolean (required)"
                },
                "imageSeed": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 20260723,
                    "description": "20260723 - Fixed image seed retained even while fixed-seed use is disabled. - number (required)"
                },
                "profileModelOverride": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "",
                    "description": " - Character-specific profile-image model override; empty uses the current default. - string"
                }
            }
        },
        "characterDurableState": {
            "keyPath": [
                "saveId",
                "characterId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Links to saveCharacterDefinitions. - string FK (required)"
                },
                "role": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Federal inspection assistant",
                    "description": "Federal inspection assistant - Current durable character role. - string (required)"
                },
                "relationshipToPlayer": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "newly assigned coworker",
                    "description": "newly assigned coworker - Current descriptive relationship to the player. - string (required)"
                },
                "activeOutfitId": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string/null",
                    "example": "federal-public",
                    "description": "federal-public - Current active outfit preset; equippedItems remains authoritative for what is actually equipped. - string/null"
                }
            }
        },
        "characterRelationshipStats": {
            "keyPath": [
                "saveId",
                "characterId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Character whose numerical relationship state is stored. - string FK (required)"
                },
                "trust": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 5,
                    "description": "5 - Current trust in the player from 0 through 10. - number (required)"
                },
                "attraction": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 1,
                    "description": "1 - Current attraction to the player from 0 through 10. - number (required)"
                },
                "affection": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 1,
                    "description": "1 - Current affection for the player from 0 through 10. - number (required)"
                }
            }
        },
        "characterStats": {
            "keyPath": [
                "saveId",
                "characterId",
                "statId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Links to saveCharacterDefinitions. - string FK (required)"
                },
                "statId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "inspection",
                    "description": "inspection - Story-defined stat key. - string (required)"
                },
                "value": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number/string/boolean/null",
                    "example": 6.5,
                    "description": "6.5 - Current stat value. Numeric precision is resolved from the immutable story definition. - number/string/boolean/null (required)"
                }
            }
        },
        "characterFacts": {
            "keyPath": [
                "saveId",
                "characterId",
                "factId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byCharacterSequence",
                    "keyPath": [
                        "saveId",
                        "characterId",
                        "sequence"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Links to saveCharacterDefinitions. - string FK (required)"
                },
                "factId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "fact-17",
                    "description": "fact-17 - Storage identity for one current known_facts entry. - string (required)"
                },
                "sequence": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 2,
                    "description": "2 - Stable insertion sequence for prompt order; it is never renumbered after deletion. - number (required)"
                },
                "text": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Vessa is the player's assigned assistant.",
                    "description": "Vessa is the player's assigned assistant. - Exact known fact text. - string (required)"
                }
            }
        },
        "characterSceneState": {
            "keyPath": [
                "saveId",
                "characterId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Links to saveCharacterDefinitions. - string FK (required)"
                },
                "stateOfMind": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "focused",
                    "description": "focused - Current state_of_mind. - string (required)"
                },
                "physicalState": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "flushed",
                    "description": "flushed - Current physical_state. - string (required)"
                },
                "pose": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "touching herself",
                    "description": "touching herself - Current pose. - string (required)"
                }
            }
        },
        "partyMembers": {
            "keyPath": [
                "saveId",
                "characterId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Character currently recruited into the player's party. - string FK (required)"
                }
            }
        },
        "items": {
            "keyPath": [
                "saveId",
                "itemId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byCharacter",
                    "keyPath": [
                        "saveId",
                        "characterId"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byCharacterSlot",
                    "keyPath": [
                        "saveId",
                        "characterId",
                        "slot"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "itemId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "vessa-federal-blouse-81c2",
                    "description": "vessa-federal-blouse-81c2 - Stable identity for this item. - string (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Character who owns the item. - string FK (required)"
                },
                "name": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Federal Inspectorate Blouse",
                    "description": "Federal Inspectorate Blouse - Player-facing inventory name. - string (required)"
                },
                "type": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "clothing",
                    "description": "clothing - Story-defined item category used by inventory, shops, and rewards. - string (required)"
                },
                "slot": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "clothing slot | hand | null",
                    "example": "shirt",
                    "description": "shirt - Compatible equipment slot; hand permits either hand and null means non-equippable. - clothing slot | hand | null (required)"
                },
                "quantity": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 1,
                    "description": "1 - Current stack quantity; non-stackable items always use 1. - number (required)"
                },
                "inventorySequence": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 1,
                    "description": "1 - Original or current inventory display order when the item came from an ordered inventory list. - number"
                },
                "value": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 35,
                    "description": "35 - Current per-item currency value. - number (required)"
                },
                "sellable": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": true,
                    "description": "true - Whether a shop may buy this item. - boolean (required)"
                },
                "questItem": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": false,
                    "description": "false - Whether normal sale or deletion is prohibited. - boolean (required)"
                },
                "description": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "high-collared federal blouse",
                    "description": "high-collared federal blouse - Inventory and image-prompt description. - string (required)"
                },
                "imageId": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "story-item-vessa-federal-blouse-1",
                    "description": "story-item-vessa-federal-blouse-1 - Selected storyItemImages record when the item has an authored image. - string FK/null"
                }
            }
        },
        "characterOutfits": {
            "keyPath": [
                "saveId",
                "characterId",
                "outfitId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Links to saveCharacterDefinitions. - string FK (required)"
                },
                "outfitId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "federal-public",
                    "description": "federal-public - Exact outfit.id. - string (required)"
                },
                "name": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Federal Inspectorate Uniform",
                    "description": "Federal Inspectorate Uniform - Exact outfit.name. - string (required)"
                },
                "formality": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 0,
                    "description": "0 - Exact outfit.formality. - number (required)"
                },
                "origin": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "",
                    "description": " - Exact outfit.origin. - string (required)"
                },
                "memory": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "",
                    "description": " - Exact outfit.memory. - string (required)"
                },
                "sourceShopId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "",
                    "description": " - Exact outfit.source_shop_id. - string (required)"
                },
                "sourceOutfitId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "",
                    "description": " - Exact outfit.source_outfit_id. - string (required)"
                },
                "imagePrompt": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "",
                    "description": " - Exact outfit.image_prompt. - string (required)"
                },
                "imageId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "",
                    "description": " - Exact outfit.image_id. - string (required)"
                },
                "contexts": {
                    "required": false,
                    "kind": "array",
                    "typeSpec": "array",
                    "example": [
                        "work"
                    ],
                    "description": [
                        "work - One exact outfit.contexts value. - string"
                    ]
                },
                "hat": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item assigned to the outfit's hat slot. - string FK/null (required)"
                },
                "hairAccessory": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item assigned to the outfit's hair_accessory slot. - string FK/null (required)"
                },
                "face": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item assigned to the outfit's face slot. - string FK/null (required)"
                },
                "ears": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item assigned to the outfit's ears slot. - string FK/null (required)"
                },
                "neck": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item assigned to the outfit's neck slot. - string FK/null (required)"
                },
                "shoulders": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item assigned to the outfit's shoulders slot. - string FK/null (required)"
                },
                "bra": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "vessa-supportive-underlayer-f482",
                    "description": "vessa-supportive-underlayer-f482 - Clothing item assigned to the outfit's bra slot. - string FK/null (required)"
                },
                "undershirt": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "vessa-soft-inner-layer-c173",
                    "description": "vessa-soft-inner-layer-c173 - Clothing item assigned to the outfit's undershirt slot. - string FK/null (required)"
                },
                "shirt": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "vessa-federal-blouse-81c2",
                    "description": "vessa-federal-blouse-81c2 - Clothing item assigned to the outfit's shirt slot. - string FK/null (required)"
                },
                "overShirt": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item assigned to the outfit's over_shirt slot. - string FK/null (required)"
                },
                "coat": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item assigned to the outfit's coat slot. - string FK/null (required)"
                },
                "back": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item assigned to the outfit's back slot. - string FK/null (required)"
                },
                "hands": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item assigned to the outfit's hands slot. - string FK/null (required)"
                },
                "rightWrist": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item assigned to the outfit's right_wrist slot. - string FK/null (required)"
                },
                "leftWrist": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item assigned to the outfit's left_wrist slot. - string FK/null (required)"
                },
                "rightFingers": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item assigned to the outfit's right_fingers slot. - string FK/null (required)"
                },
                "leftFingers": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item assigned to the outfit's left_fingers slot. - string FK/null (required)"
                },
                "waist": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item assigned to the outfit's waist slot. - string FK/null (required)"
                },
                "beltAccessory": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item assigned to the outfit's belt_accessory slot. - string FK/null (required)"
                },
                "underwear": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "vessa-comfortable-underwear-a614",
                    "description": "vessa-comfortable-underwear-a614 - Clothing item assigned to the outfit's underwear slot. - string FK/null (required)"
                },
                "pants": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "vessa-species-safe-trousers-912e",
                    "description": "vessa-species-safe-trousers-912e - Clothing item assigned to the outfit's pants slot. - string FK/null (required)"
                },
                "skirt": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item assigned to the outfit's skirt slot. - string FK/null (required)"
                },
                "legwear": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item assigned to the outfit's legwear slot. - string FK/null (required)"
                },
                "socks": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item assigned to the outfit's socks slot. - string FK/null (required)"
                },
                "feet": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "vessa-polished-leg-guards-37ab",
                    "description": "vessa-polished-leg-guards-37ab - Item assigned to the outfit's feet slot. - string FK/null (required)"
                },
                "otherAccessory": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "vessa-official-satchel-harness-45d9",
                    "description": "vessa-official-satchel-harness-45d9 - Item assigned to the outfit's other_accessory slot. - string FK/null (required)"
                },
                "leftHand": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Hand item assigned to the outfit's left hand. - string FK/null (required)"
                },
                "rightHand": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "vessa-leather-itinerary-64b1",
                    "description": "vessa-leather-itinerary-64b1 - Hand item assigned to the outfit's right hand. - string FK/null (required)"
                }
            }
        },
        "equippedItems": {
            "keyPath": [
                "saveId",
                "characterId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Links to saveCharacterDefinitions. - string FK (required)"
                },
                "hat": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item currently equipped in the hat slot. - string FK/null (required)"
                },
                "hairAccessory": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item currently equipped in the hair_accessory slot. - string FK/null (required)"
                },
                "face": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item currently equipped in the face slot. - string FK/null (required)"
                },
                "ears": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item currently equipped in the ears slot. - string FK/null (required)"
                },
                "neck": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item currently equipped in the neck slot. - string FK/null (required)"
                },
                "shoulders": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item currently equipped in the shoulders slot. - string FK/null (required)"
                },
                "bra": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item currently equipped in the bra slot. - string FK/null (required)"
                },
                "undershirt": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item currently equipped in the undershirt slot. - string FK/null (required)"
                },
                "shirt": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "vessa-federal-blouse-81c2",
                    "description": "vessa-federal-blouse-81c2 - Clothing item currently equipped in the shirt slot. - string FK/null (required)"
                },
                "overShirt": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item currently equipped in the over_shirt slot. - string FK/null (required)"
                },
                "coat": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item currently equipped in the coat slot. - string FK/null (required)"
                },
                "back": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item currently equipped in the back slot. - string FK/null (required)"
                },
                "hands": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item currently equipped in the hands slot. - string FK/null (required)"
                },
                "rightWrist": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item currently equipped in the right_wrist slot. - string FK/null (required)"
                },
                "leftWrist": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item currently equipped in the left_wrist slot. - string FK/null (required)"
                },
                "rightFingers": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item currently equipped in the right_fingers slot. - string FK/null (required)"
                },
                "leftFingers": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item currently equipped in the left_fingers slot. - string FK/null (required)"
                },
                "waist": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item currently equipped in the waist slot. - string FK/null (required)"
                },
                "beltAccessory": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item currently equipped in the belt_accessory slot. - string FK/null (required)"
                },
                "underwear": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "vessa-comfortable-underwear-a614",
                    "description": "vessa-comfortable-underwear-a614 - Clothing item currently equipped in the underwear slot. - string FK/null (required)"
                },
                "pants": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "vessa-species-safe-trousers-912e",
                    "description": "vessa-species-safe-trousers-912e - Clothing item currently equipped in the pants slot. - string FK/null (required)"
                },
                "skirt": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item currently equipped in the skirt slot. - string FK/null (required)"
                },
                "legwear": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item currently equipped in the legwear slot. - string FK/null (required)"
                },
                "socks": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Clothing item currently equipped in the socks slot. - string FK/null (required)"
                },
                "feet": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "vessa-polished-leg-guards-37ab",
                    "description": "vessa-polished-leg-guards-37ab - Item currently equipped in the feet slot. - string FK/null (required)"
                },
                "otherAccessory": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "vessa-official-satchel-harness-45d9",
                    "description": "vessa-official-satchel-harness-45d9 - Item currently equipped in the other_accessory slot. - string FK/null (required)"
                },
                "leftHand": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Hand item currently equipped in the left hand. - string FK/null (required)"
                },
                "rightHand": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "vessa-leather-itinerary-64b1",
                    "description": "vessa-leather-itinerary-64b1 - Hand item currently equipped in the right hand. - string FK/null (required)"
                }
            }
        },
        "temporaryRemovedItems": {
            "keyPath": [
                "saveId",
                "characterId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Character whose temporarily removed items are stored. - string FK (required)"
                },
                "hat": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the hat slot. - string FK/null (required)"
                },
                "hairAccessory": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the hair_accessory slot. - string FK/null (required)"
                },
                "face": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the face slot. - string FK/null (required)"
                },
                "ears": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the ears slot. - string FK/null (required)"
                },
                "neck": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the neck slot. - string FK/null (required)"
                },
                "shoulders": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the shoulders slot. - string FK/null (required)"
                },
                "bra": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "vessa-supportive-underlayer-f482",
                    "description": "vessa-supportive-underlayer-f482 - Temporarily removed item from the bra slot. - string FK/null (required)"
                },
                "undershirt": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the undershirt slot. - string FK/null (required)"
                },
                "shirt": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the shirt slot. - string FK/null (required)"
                },
                "overShirt": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the over_shirt slot. - string FK/null (required)"
                },
                "coat": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the coat slot. - string FK/null (required)"
                },
                "back": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the back slot. - string FK/null (required)"
                },
                "hands": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the hands slot. - string FK/null (required)"
                },
                "rightWrist": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the right_wrist slot. - string FK/null (required)"
                },
                "leftWrist": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the left_wrist slot. - string FK/null (required)"
                },
                "rightFingers": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the right_fingers slot. - string FK/null (required)"
                },
                "leftFingers": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the left_fingers slot. - string FK/null (required)"
                },
                "waist": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the waist slot. - string FK/null (required)"
                },
                "beltAccessory": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the belt_accessory slot. - string FK/null (required)"
                },
                "underwear": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the underwear slot. - string FK/null (required)"
                },
                "pants": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the pants slot. - string FK/null (required)"
                },
                "skirt": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the skirt slot. - string FK/null (required)"
                },
                "legwear": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the legwear slot. - string FK/null (required)"
                },
                "socks": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the socks slot. - string FK/null (required)"
                },
                "feet": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the feet slot. - string FK/null (required)"
                },
                "otherAccessory": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed item from the other_accessory slot. - string FK/null (required)"
                },
                "leftHand": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed hand item from the left hand. - string FK/null (required)"
                },
                "rightHand": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": null,
                    "description": "null - Temporarily removed hand item from the right hand. - string FK/null (required)"
                }
            }
        },
        "sceneRuntime": {
            "keyPath": "saveId",
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "summary": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Silas cuddles with Vessa in the Ivory Suite.",
                    "description": "Silas cuddles with Vessa in the Ivory Suite. - Exact scene.summary. - string (required)"
                },
                "imageAction": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "cuddling and drifting off to sleep",
                    "description": "cuddling and drifting off to sleep - Exact scene.image_action. - string (required)"
                }
            }
        },
        "sceneMembers": {
            "keyPath": [
                "saveId",
                "characterId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Character currently present in the scene; party or NPC status is resolved from its authoritative membership records. - string FK (required)"
                }
            }
        },
        "sceneImageTargets": {
            "keyPath": [
                "saveId",
                "characterId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Resolved identity from scene.image_characters. - string FK (required)"
                }
            }
        },
        "worldValues": {
            "keyPath": [
                "saveId",
                "fieldId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "fieldId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "magic_level",
                    "description": "magic_level - Exact top-level key from state.world. - string (required)"
                },
                "value": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "bounded value",
                    "example": "high",
                    "description": "high - Exact state.world field value. - bounded value (required)"
                }
            }
        },
        "currentLocation": {
            "keyPath": "saveId",
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "locationId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "loc-inn-hearthcross-the-hearth-pack",
                    "description": "loc-inn-hearthcross-the-hearth-pack - Player's current location. - string FK (required)"
                }
            }
        },
        "runtimeLocationDefinitions": {
            "keyPath": [
                "saveId",
                "locationId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "locationId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "loc-private-receiving-room",
                    "description": "loc-private-receiving-room - Exact generated location.id. - string (required)"
                },
                "name": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Private Receiving Room",
                    "description": "Private Receiving Room - Exact generated location.name. - string (required)"
                },
                "type": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "place",
                    "description": "place - Exact generated location.type. - string (required)"
                },
                "scale": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "site",
                    "description": "site - Exact generated location.scale. - string (required)"
                },
                "parentId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "loc-divine-receiving-room",
                    "description": "loc-divine-receiving-room - Parent authored or runtime location; null is required for a root location. - string FK/null (required)"
                },
                "x": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 58,
                    "description": "58 - Exact generated location.x. - number (required)"
                },
                "y": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 78,
                    "description": "78 - Exact generated location.y. - number (required)"
                },
                "summary": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "A private divine office.",
                    "description": "A private divine office. - Exact generated location.summary. - string (required)"
                }
            }
        },
        "locationRuntime": {
            "keyPath": [
                "saveId",
                "locationId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "locationId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "loc-hearthcross",
                    "description": "loc-hearthcross - Links to an authored or runtime location definition. - string FK (required)"
                },
                "discovered": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": true,
                    "description": "true - Current discovery override. - boolean"
                },
                "travelEnabled": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": true,
                    "description": "true - Current travel-enabled override. - boolean"
                }
            }
        },
        "locationConnections": {
            "keyPath": [
                "saveId",
                "fromLocationId",
                "toLocationId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byDestination",
                    "keyPath": [
                        "saveId",
                        "toLocationId"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "fromLocationId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "loc-hearthcross",
                    "description": "loc-hearthcross - Source location. - string FK (required)"
                },
                "toLocationId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "loc-federal-office",
                    "description": "loc-federal-office - Authored connection being overridden. - string FK (required)"
                },
                "present": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": false,
                    "description": "false - Whether the connection exists in current runtime; false records an authored connection removal. - boolean (required)"
                }
            }
        },
        "gameTime": {
            "keyPath": "saveId",
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "year": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 1,
                    "description": "1 - Exact state.time.year. - number (required)"
                },
                "month": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 1,
                    "description": "1 - Exact state.time.month. - number (required)"
                },
                "day": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 1,
                    "description": "1 - Exact state.time.day. - number (required)"
                },
                "hour": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 12,
                    "description": "12 - Exact state.time.hour. - number (required)"
                },
                "minute": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 0,
                    "description": "0 - Exact state.time.minute. - number (required)"
                },
                "elapsedMinutes": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 720,
                    "description": "720 - Exact state.time.elapsed_minutes; canonical minutes elapsed since this game began. - number (required)"
                }
            }
        },
        "timedEventRuntime": {
            "keyPath": [
                "saveId",
                "timedEventId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "timedEventId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "first-frost",
                    "description": "first-frost - Links to the immutable timed-event definition. - string FK (required)"
                },
                "status": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "waiting | active | ready | complete | cancelled | declined | missed",
                    "example": "waiting",
                    "description": "waiting - Exact current timed event status. - waiting | active | ready | complete | cancelled | declined | missed (required)"
                },
                "startElapsedMinutes": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number/null",
                    "example": 720,
                    "description": "720 - Exact current start_elapsed_minutes. - number/null (required)"
                }
            }
        },
        "timedEventAppliedStages": {
            "keyPath": [
                "saveId",
                "timedEventId",
                "stageId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "timedEventId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "first-frost",
                    "description": "first-frost - Links to timedEventRuntime. - string FK (required)"
                },
                "stageId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "warning-1",
                    "description": "warning-1 - Exact current applied_stage_ids entry. - string (required)"
                }
            }
        },
        "storyValues": {
            "keyPath": [
                "saveId",
                "root",
                "pathKey"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "root": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "story_inventory",
                    "description": "story_inventory - Exact flexible-state root such as story_inventory, world_flags, or progression. - string (required)"
                },
                "pathKey": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "hearth_pack_first_lead",
                    "description": "hearth_pack_first_lead - Exact canonical path beneath the root. - string (required)"
                },
                "value": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number/string/boolean/null",
                    "example": "worker",
                    "description": "worker - Exact scalar current value. Numeric precision is resolved from the immutable story definition. - number/string/boolean/null (required)"
                }
            }
        },
        "storyListItems": {
            "keyPath": [
                "saveId",
                "root",
                "listPathKey",
                "itemKey"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byListSequence",
                    "keyPath": [
                        "saveId",
                        "root",
                        "listPathKey",
                        "sequence"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "root": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "story_inventory",
                    "description": "story_inventory - Exact flexible-state root. - string (required)"
                },
                "listPathKey": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "gella_traits_absorbed",
                    "description": "gella_traits_absorbed - Exact canonical list path beneath the root. - string (required)"
                },
                "itemKey": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "fnv1a-stone-skin",
                    "description": "fnv1a-stone-skin - Deterministic key from the canonical value; idempotent story lists do not preserve duplicate values. - string (required)"
                },
                "sequence": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "number/null",
                    "example": 2,
                    "description": "2 - Stable insertion sequence used only when this list path is explicitly declared ordered; it is never renumbered. - number/null"
                },
                "value": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "bounded value",
                    "example": "stone skin",
                    "description": "stone skin - Exact list item value. - bounded value (required)"
                }
            }
        },
        "storyMapEntries": {
            "keyPath": [
                "saveId",
                "root",
                "mapPathKey",
                "entryKey"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "root": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "world_flags",
                    "description": "world_flags - Exact flexible-state root. - string (required)"
                },
                "mapPathKey": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "city_inspections",
                    "description": "city_inspections - Exact canonical map path beneath the root. - string (required)"
                },
                "entryKey": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "hearthcross",
                    "description": "hearthcross - Exact current map key. - string (required)"
                },
                "value": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "bounded value",
                    "example": "complete",
                    "description": "complete - Exact current map value. - bounded value (required)"
                }
            }
        },
        "storyMemoryNotes": {
            "keyPath": [
                "saveId",
                "category",
                "noteId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byCategorySequence",
                    "keyPath": [
                        "saveId",
                        "category",
                        "sequence"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "category": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "world_notes | unresolved_threads | relationship_notes | rules_and_constraints | ai_private_notes",
                    "example": "world_notes",
                    "description": "world_notes - Exact story_memory category key. - world_notes | unresolved_threads | relationship_notes | rules_and_constraints | ai_private_notes (required)"
                },
                "noteId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "memory-note-3",
                    "description": "memory-note-3 - Storage identity for one exact note entry. - string (required)"
                },
                "sequence": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 1,
                    "description": "1 - Stable insertion sequence used for display and prompt order; it is never renumbered. - number (required)"
                },
                "text": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "The circuit includes twenty-two cities.",
                    "description": "The circuit includes twenty-two cities. - Exact note text. - string (required)"
                }
            }
        },
        "recentChanges": {
            "keyPath": [
                "saveId",
                "changeRecordId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySequence",
                    "keyPath": [
                        "saveId",
                        "sequence"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "changeRecordId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "recent-change-8",
                    "description": "recent-change-8 - Storage identity for one current recent_changes entry. - string (required)"
                },
                "sequence": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 1,
                    "description": "1 - Stable insertion sequence used for recency order; it is never renumbered. - number (required)"
                },
                "text": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Silas completed the Hearth Pack inspection.",
                    "description": "Silas completed the Hearth Pack inspection. - Exact recent change text. - string (required)"
                }
            }
        },
        "storyRuleAdds": {
            "keyPath": [
                "saveId",
                "ruleId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "ruleId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "player-is-inspector",
                    "description": "player-is-inspector - Stable added rule id. - string (required)"
                },
                "text": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "The player holds a legitimate federal inspector appointment.",
                    "description": "The player holds a legitimate federal inspector appointment. - Exact added rule text. - string (required)"
                }
            }
        },
        "storyRuleRemovals": {
            "keyPath": [
                "saveId",
                "ruleId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "ruleId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "respect-local-laws",
                    "description": "respect-local-laws - Stable id of the immutable authored rule suppressed for this save. - string FK (required)"
                }
            }
        },
        "objectiveControl": {
            "keyPath": "saveId",
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "activeMainObjectiveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "inspect-hearthcross-the-velvet-paw",
                    "description": "inspect-hearthcross-the-velvet-paw - Active main objective; null during an ending, game over, freeplay with no main objective, or an unresolved route transition. - string FK/null (required)"
                },
                "focusedSideObjectiveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "worker-fenna-dawnwhisper-aftermath",
                    "description": "worker-fenna-dawnwhisper-aftermath - Focused side objective; null when none is focused. - string FK/null (required)"
                }
            }
        },
        "pendingObjectiveRouteChoices": {
            "keyPath": [
                "saveId",
                "choiceId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "choiceId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "objective-route-choice-8",
                    "description": "objective-route-choice-8 - Stable pending route-choice identity. - string (required)"
                },
                "reason": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "multiple_main_dependents",
                    "description": "multiple_main_dependents - Why deterministic routing could not select one objective. - string (required)"
                },
                "completedObjectiveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "route-start",
                    "description": "route-start - Objective whose completion created this pending route choice. - string FK (required)"
                }
            }
        },
        "pendingObjectiveRouteOptions": {
            "keyPath": [
                "saveId",
                "choiceId",
                "objectiveId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "choiceId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "objective-route-choice-8",
                    "description": "objective-route-choice-8 - Links to pendingObjectiveRouteChoices. - string FK (required)"
                },
                "objectiveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "inspect-hearthcross-the-velvet-paw",
                    "description": "inspect-hearthcross-the-velvet-paw - One eligible destination objective. - string FK (required)"
                }
            }
        },
        "objectiveRuntime": {
            "keyPath": [
                "saveId",
                "objectiveId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byStatus",
                    "keyPath": [
                        "saveId",
                        "status"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "objectiveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "inspect-hearthcross-the-velvet-paw",
                    "description": "inspect-hearthcross-the-velvet-paw - Links to an immutable authored or generated-job objective. - string FK (required)"
                },
                "status": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "active | hidden | locked | future | queued | complete",
                    "example": "active",
                    "description": "active - Sparse override used only when derived graph state is insufficient. - active | hidden | locked | future | queued | complete"
                },
                "selectedOutputId": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "Example",
                    "description": "Example - string FK/null"
                },
                "selectedOutputMessageId": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "104",
                    "description": "104 - Message whose resolution selected the output. - string FK/null"
                },
                "activationAiCheckAttempted": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": true,
                    "description": "true - Exact sparse activationAiCheckAttemptedById value. - boolean"
                },
                "activationNumber": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 2,
                    "description": "2 - Exact sparse activationNumberById value. - number"
                }
            }
        },
        "objectiveProgressNotes": {
            "keyPath": [
                "saveId",
                "objectiveId",
                "noteId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byObjectiveSequence",
                    "keyPath": [
                        "saveId",
                        "objectiveId",
                        "sequence"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "objectiveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "inspect-hearthcross-the-velvet-paw",
                    "description": "inspect-hearthcross-the-velvet-paw - Links to objectiveRuntime or its immutable definition. - string FK (required)"
                },
                "noteId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "objective-note-2",
                    "description": "objective-note-2 - Storage identity for one exact progress_notes entry. - string (required)"
                },
                "sequence": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 1,
                    "description": "1 - Stable insertion sequence used for progress-note order; it is never renumbered. - number (required)"
                },
                "text": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Maelin invited Silas into the main lounge.",
                    "description": "Maelin invited Silas into the main lounge. - Exact progress note text. - string (required)"
                }
            }
        },
        "objectiveExclusiveGroupChoices": {
            "keyPath": [
                "saveId",
                "groupId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "groupId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "hearth-pack-first-lead",
                    "description": "hearth-pack-first-lead - Exact exclusive_group_choices key. - string (required)"
                },
                "selectedObjectiveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "choose-hearth-pack-first-lead",
                    "description": "choose-hearth-pack-first-lead - Exact selected objective id. - string FK (required)"
                }
            }
        },
        "pendingRewardChoices": {
            "keyPath": [
                "saveId",
                "choiceId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "choiceId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "reward-choice-4",
                    "description": "reward-choice-4 - Exact pending reward choice id. - string (required)"
                },
                "objectiveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "choose-one-gift",
                    "description": "choose-one-gift - Exact objective_id. - string FK (required)"
                },
                "kind": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "item",
                    "description": "item - Exact reward choice kind. - string (required)"
                },
                "reward": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "structured value",
                    "example": {},
                    "description": "{ type: grant_item, item: crystal compass } - Exact bounded reward invocation awaiting a target. - structured value (required)"
                }
            }
        },
        "pendingRewardChoiceOptions": {
            "keyPath": [
                "saveId",
                "choiceId",
                "characterId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "choiceId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "reward-choice-4",
                    "description": "reward-choice-4 - Links to pendingRewardChoices. - string FK (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Eligible player or party character target. - string FK (required)"
                }
            }
        },
        "rewardInvocations": {
            "keyPath": [
                "saveId",
                "invocationId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "invocationId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "objective-meet-vessa--reward-0",
                    "description": "objective-meet-vessa--reward-0 - Exact idempotency key. - string (required)"
                },
                "appliedAt": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "2026-08-04T12:00:00.000Z",
                    "description": "2026-08-04T12:00:00.000Z - Exact appliedAt value. - string (required)"
                },
                "sourceType": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "objective",
                    "description": "objective - Exact sourceType value. - string (required)"
                },
                "sourceId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "meet-vessa",
                    "description": "meet-vessa - Exact sourceId value. - string (required)"
                }
            }
        },
        "futureCharacters": {
            "keyPath": [
                "saveId",
                "characterId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byStatus",
                    "keyPath": [
                        "saveId",
                        "status"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "fenna-dawnwhisper-f3917a42",
                    "description": "fenna-dawnwhisper-f3917a42 - Links to the immutable future-cast and character definitions. - string FK (required)"
                },
                "status": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "introduced",
                    "description": "introduced - Sparse runtime future-cast status override. - string"
                },
                "unlockedBy": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "inspect-hearthcross-the-velvet-paw",
                    "description": "inspect-hearthcross-the-velvet-paw - Objective or source that unlocked the character. - string"
                },
                "lastTriggeredReason": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "objective reward",
                    "description": "objective reward - Most recent runtime trigger reason. - string"
                },
                "locationId": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "loc-inn-hearthcross-the-velvet-paw",
                    "description": "loc-inn-hearthcross-the-velvet-paw - Sparse runtime location override when different from the immutable definition. - string FK/null"
                }
            }
        },
        "npcShells": {
            "keyPath": [
                "saveId",
                "characterId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byLocation",
                    "keyPath": [
                        "saveId",
                        "locationId"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byStatus",
                    "keyPath": [
                        "saveId",
                        "status"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "locationId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "loc-inn-hearthcross-the-velvet-paw",
                    "description": "loc-inn-hearthcross-the-velvet-paw - NPC's current authored or runtime location. - string FK (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "fenna-dawnwhisper-f3917a42",
                    "description": "fenna-dawnwhisper-f3917a42 - Stable character identity; links to a finalized definition when one exists. - string FK (required)"
                },
                "name": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Fenna Dawnwhisper",
                    "description": "Fenna Dawnwhisper - Lightweight shell name retained only while no finalized character definition exists. - string"
                },
                "playerKnownName": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": true,
                    "description": "true - Exact player_known_name. - boolean"
                },
                "playerFacingLabel": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Fenna",
                    "description": "Fenna - Exact player_facing_label. - string"
                },
                "gender": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "female",
                    "description": "female - Lightweight shell gender retained only while no finalized character definition exists. - string"
                },
                "age": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 24,
                    "description": "24 - Lightweight shell age retained only while no finalized character definition exists. - number"
                },
                "role": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "licensed worker",
                    "description": "licensed worker - Lightweight shell role retained only while no finalized character definition exists. - string"
                },
                "relationshipToPlayer": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "new acquaintance",
                    "description": "new acquaintance - Lightweight relationship retained only while no characterDurableState record exists. - string"
                },
                "note": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Responds strongly to patient treatment.",
                    "description": "Responds strongly to patient treatment. - Lightweight shell note retained only while no finalized character definition exists. - string"
                },
                "personalityDescription": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Warm, guarded, and observant.",
                    "description": "Warm, guarded, and observant. - Lightweight shell personality retained only while no finalized character definition exists. - string"
                },
                "greeting": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Welcome to The Velvet Paw.",
                    "description": "Welcome to The Velvet Paw. - Lightweight shell greeting retained only while no finalized character definition exists. - string"
                },
                "currentAppearance": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "wearing a work apron and watching the entrance",
                    "description": "wearing a work apron and watching the entrance - Temporary visible shell condition before inspection. - string"
                },
                "canDie": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": false,
                    "description": "false - Safety authority until a finalized saveCharacterDefinitions record exists; finalized character data takes precedence. - boolean (required)"
                },
                "recruitable": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": false,
                    "description": "false - Whether this NPC may be promoted to the party. - boolean (required)"
                },
                "everInvited": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": false,
                    "description": "false - Whether the player has ever invited this NPC to the party. - boolean (required)"
                },
                "futureCharacterId": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string FK/null",
                    "example": "fenna-dawnwhisper",
                    "description": "fenna-dawnwhisper - Links this shell to immutable future-cast data when applicable. - string FK/null"
                },
                "status": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "alive | dead",
                    "example": "alive",
                    "description": "alive - Current NPC life status. - alive | dead (required)"
                },
                "deathNote": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "",
                    "description": " - Required nonempty explanation when status is dead. - string"
                },
                "killedBy": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "",
                    "description": " - Resolved killer name or identity when known. - string"
                },
                "killedByPlayer": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": false,
                    "description": "false - Whether the player directly caused this death. - boolean (required)"
                },
                "inspected": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": false,
                    "description": "false - Whether this shell has been inspected and finalized into complete save character records. - boolean (required)"
                }
            }
        },
        "generatedNpcPoolEntries": {
            "keyPath": [
                "saveId",
                "poolEntryId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byCharacter",
                    "keyPath": [
                        "saveId",
                        "characterId"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "poolEntryId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "hearthcross-worker-1",
                    "description": "hearthcross-worker-1 - Exact story_generated_npc_pool key. - string (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "generated-npc-fenna-helper-31ad92f0",
                    "description": "generated-npc-fenna-helper-31ad92f0 - Links to the generated character definition and NPC shell. - string FK (required)"
                }
            }
        },
        "temporarySpeakers": {
            "keyPath": [
                "saveId",
                "temporarySpeakerId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byFirstSeenMessage",
                    "keyPath": [
                        "saveId",
                        "firstSeenMessageId"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "temporarySpeakerId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "temporary-speaker-director-vellis-104",
                    "description": "temporary-speaker-director-vellis-104 - Stable save-local speaker identity. - string (required)"
                },
                "name": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Director Vellis",
                    "description": "Director Vellis - Exact displayed temporary-speaker name. - string (required)"
                },
                "gender": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "male | female | neutral",
                    "example": "female",
                    "description": "female - Exact temporary-speaker gender. - male | female | neutral (required)"
                },
                "voice": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Google UK English Female",
                    "description": "Google UK English Female - Exact persisted voice assignment. - string (required)"
                },
                "firstSeenMessageId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string/number/null",
                    "example": "104",
                    "description": "104 - Exact first_seen_message_id. - string/number/null (required)"
                }
            }
        },
        "messages": {
            "keyPath": [
                "saveId",
                "messageId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySequence",
                    "keyPath": [
                        "saveId",
                        "sequence"
                    ],
                    "unique": true,
                    "multiEntry": false
                },
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "messageId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "104",
                    "description": "104 - Exact message id. - string (required)"
                },
                "sequence": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 104,
                    "description": "104 - Exact entryId ordering value. - number (required)"
                },
                "role": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "assistant",
                    "description": "assistant - Exact message.role. - string (required)"
                },
                "speaker": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Vessa Threadwell",
                    "description": "Vessa Threadwell - Exact message.speaker. - string (required)"
                },
                "text": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Vessa opens the itinerary and begins her report.",
                    "description": "Vessa opens the itinerary and begins her report. - Final persisted message text; streaming text remains in memory until the message finishes. - string (required)"
                },
                "detail": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "normal",
                    "description": "normal - Exact message.detail. - string (required)"
                },
                "at": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "2026-08-04T12:00:00.000Z",
                    "description": "2026-08-04T12:00:00.000Z - Exact message.at. - string (required)"
                },
                "stateSyncStatus": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "complete",
                    "description": "complete - Exact message.stateSyncStatus. - string"
                },
                "autoTurn": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": false,
                    "description": "false - Exact message.autoTurn. - boolean"
                },
                "autoRead": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": true,
                    "description": "true - Exact message.autoRead. - boolean"
                },
                "replySource": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "player-message",
                    "description": "player-message - Exact message.replySource. - string"
                },
                "generationStopped": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": false,
                    "description": "false - Whether the player stopped this assistant response and kept its partial text. - boolean"
                },
                "objectiveComplete": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": true,
                    "description": "true - Exact message.objectiveComplete. - boolean"
                },
                "choiceObjectiveId": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "accept-inspector-appointment",
                    "description": "accept-inspector-appointment - Exact message.choiceObjectiveId. - string FK"
                },
                "choiceSnapshotId": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "12",
                    "description": "12 - Exact message.choiceSnapshotId. - string FK"
                },
                "stateBackupId": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "11",
                    "description": "11 - Exact message.stateBackupId. - string FK"
                }
            }
        },
        "messageRelations": {
            "keyPath": [
                "saveId",
                "messageId",
                "relatedMessageId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byRelatedMessage",
                    "keyPath": [
                        "saveId",
                        "relatedMessageId"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "messageId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "104",
                    "description": "104 - Links to messages. - string FK (required)"
                },
                "relatedMessageId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "103",
                    "description": "103 - Exact relatedMessageIds value. - string FK (required)"
                }
            }
        },
        "messageVoiceData": {
            "keyPath": [
                "saveId",
                "messageId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "messageId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "104",
                    "description": "104 - Links to messages. - string FK (required)"
                },
                "voiceMeta": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "structured value",
                    "example": {},
                    "description": "{ narrator: Narrator, speakers: [Vessa Threadwell] } - Exact bounded message.voiceMeta value. - structured value"
                },
                "voiceText": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Vessa opens the itinerary and begins her report.",
                    "description": "Vessa opens the itinerary and begins her report. - Exact tagged or normalized playback text when it differs from visible message text. Speaker lists are derived from voiceMeta and voiceText. - string"
                }
            }
        },
        "storyImages": {
            "keyPath": [
                "saveId",
                "imageId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byRequestOrder",
                    "keyPath": [
                        "saveId",
                        "requestOrder"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byStatus",
                    "keyPath": [
                        "saveId",
                        "status"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byRequestedAfterMessage",
                    "keyPath": [
                        "saveId",
                        "requestedAfterMessageId"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Save whose playthrough created and owns this image. - number FK (required)"
                },
                "imageId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "1785358068234.9626",
                    "description": "1785358068234.9626 - Exact image id. - string (required)"
                },
                "at": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "2026-08-04T12:00:00.000Z",
                    "description": "2026-08-04T12:00:00.000Z - Exact image.at. - string (required)"
                },
                "favorite": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": false,
                    "description": "false - Exact image.favorite. - boolean (required)"
                },
                "title": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Hearthcross Inspection",
                    "description": "Hearthcross Inspection - Exact story-image title. - string"
                },
                "reason": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Opening inspection scene",
                    "description": "Opening inspection scene - Exact story-image generation reason. - string"
                },
                "model": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "game-art",
                    "description": "game-art - Exact image.model. - string (required)"
                },
                "seed": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "number/string/null",
                    "example": 20260723,
                    "description": "20260723 - Exact image.seed. - number/string/null"
                },
                "prompt": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Silas and Vessa begin the Hearthcross inspection circuit.",
                    "description": "Silas and Vessa begin the Hearthcross inspection circuit. - Exact image.prompt. - string (required)"
                },
                "negativePrompt": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "text, watermark",
                    "description": "text, watermark - Exact image.negativePrompt. - string (required)"
                },
                "requestOrder": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 14,
                    "description": "14 - Exact image.requestOrder. - number"
                },
                "requestedAfterMessageId": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "103",
                    "description": "103 - Exact image.requestedAfterMessageId. - string FK"
                },
                "status": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "queued | generating | ready",
                    "example": "ready",
                    "description": "ready - Durable request state. Loaded queued or generating requests restart as queued; failures are not persisted. - queued | generating | ready (required)"
                },
                "hideFromChat": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": false,
                    "description": "false - Exact image.hideFromChat. - boolean"
                },
                "promptType": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "story",
                    "description": "story - Exact story-image prompt type. - string"
                },
                "url": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "https://example.invalid/inspection-scene.png",
                    "description": "https://example.invalid/inspection-scene.png - Hosted image URL when present; otherwise a same-imageId record exists in assetBlobs. - string"
                }
            }
        },
        "storyImageTargets": {
            "keyPath": [
                "saveId",
                "imageId",
                "characterId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byCharacter",
                    "keyPath": [
                        "saveId",
                        "characterId"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "imageId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "42",
                    "description": "42 - Links to storyImages. - string FK (required)"
                },
                "characterId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "vessa-threadwell-c8142d90",
                    "description": "vessa-threadwell-c8142d90 - Resolved target character identity. - string FK (required)"
                }
            }
        },
        "snapshots": {
            "keyPath": [
                "saveId",
                "snapshotId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byCreatedAt",
                    "keyPath": [
                        "saveId",
                        "createdAt"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byMessageBoundary",
                    "keyPath": [
                        "saveId",
                        "messageBoundaryId"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "snapshotId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "12",
                    "description": "12 - Exact snapshot id. - string (required)"
                },
                "createdAt": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "2026-08-04T11:59:58.000Z",
                    "description": "2026-08-04T11:59:58.000Z - Exact snapshot.createdAt/at. - string (required)"
                },
                "completedAt": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "2026-08-04T12:00:03.000Z",
                    "description": "2026-08-04T12:00:03.000Z - Time the complete turn finished committing; absent means startup must roll the snapshot back. - string"
                },
                "reason": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Before accepting the inspector appointment",
                    "description": "Before accepting the inspector appointment - Exact snapshot.reason. - string (required)"
                },
                "type": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "choice",
                    "description": "choice - Exact snapshot.type when present. - string"
                },
                "messageBoundaryId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "104",
                    "description": "104 - Exact snapshot.messageBoundaryId. - string FK (required)"
                },
                "startMessageId": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "101",
                    "description": "101 - Exact snapshot.startMessageId when present. - string FK"
                },
                "objectiveId": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "travel-hearthcross",
                    "description": "travel-hearthcross - Exact snapshot.objectiveId when present. - string FK"
                },
                "parentObjectiveId": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "accept-inspector-appointment",
                    "description": "accept-inspector-appointment - Exact snapshot.parentObjectiveId when present. - string FK"
                }
            }
        },
        "snapshotRelatedMessages": {
            "keyPath": [
                "saveId",
                "snapshotId",
                "messageId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byMessage",
                    "keyPath": [
                        "saveId",
                        "messageId"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "snapshotId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "12",
                    "description": "12 - Links to snapshots. - string FK (required)"
                },
                "messageId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "104",
                    "description": "104 - Message associated with this backup or rollback operation. - string FK (required)"
                }
            }
        },
        "snapshotReverseOperations": {
            "keyPath": [
                "saveId",
                "snapshotId",
                "operationIndex"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "snapshotId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "12",
                    "description": "12 - Links to snapshots. - string FK (required)"
                },
                "operationIndex": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 1,
                    "description": "1 - Stable reverse-operation execution order within the snapshot. - number (required)"
                },
                "targetStore": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "messages",
                    "description": "messages - Exact whitelisted mutable object-store name. - string (required)"
                },
                "targetKey": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "structured key",
                    "example": "[27, 104]",
                    "description": "[27, 104] - Complete IndexedDB key for the target record, including saveId. - structured key (required)"
                },
                "operation": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "put | delete",
                    "example": "put",
                    "description": "put - Reverse operation to apply. - put | delete (required)"
                },
                "previousRecord": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "bounded record/null",
                    "example": {},
                    "description": "{ saveId: 27, messageId: 104, text: previous text } - Complete prior normalized record for put; null for delete. Blobs and immutable definitions are never stored here. - bounded record/null"
                }
            }
        },
        "shopRuntime": {
            "keyPath": [
                "saveId",
                "shopId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "shopId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "shop-silkrest-gilded-web",
                    "description": "shop-silkrest-gilded-web - Links to an immutable story shop definition. - string FK (required)"
                },
                "unlocked": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": true,
                    "description": "true - Exact current shop.unlocked override. - boolean (required)"
                }
            }
        },
        "shopItemRuntime": {
            "keyPath": [
                "saveId",
                "shopId",
                "itemId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "shopId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "shop-silkrest-gilded-web",
                    "description": "shop-silkrest-gilded-web - Links to an immutable story shop definition. - string FK (required)"
                },
                "itemId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "vessa-private-silk",
                    "description": "vessa-private-silk - Exact immutable shop item id or character_id. - string FK (required)"
                },
                "quantity": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "number/null",
                    "example": 1,
                    "description": "1 - Exact current quantity when applicable. - number/null"
                },
                "purchaseCount": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 1,
                    "description": "1 - Exact current purchase_count when applicable. - number"
                },
                "removed": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": false,
                    "description": "false - Exact current removed when applicable. - boolean"
                },
                "locked": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": false,
                    "description": "false - Exact current locked. - boolean"
                },
                "accepted": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": false,
                    "description": "false - Exact current accepted for story jobs. - boolean"
                },
                "completed": {
                    "required": false,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": false,
                    "description": "false - Exact current completed for story jobs. - boolean"
                }
            }
        },
        "runtimeJobDefinitions": {
            "keyPath": [
                "saveId",
                "jobId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "jobId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "job-inspect-hearthcross",
                    "description": "job-inspect-hearthcross - Exact generated job id. - string (required)"
                },
                "definition": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "structured immutable value",
                    "example": {},
                    "description": "{ id: job-inspect-hearthcross, title: Inspect Hearthcross, objectives: [...] } - Exact validated generated job fields excluding runtime status/progress/current/completed/accepted fields. - structured immutable value (required)"
                },
                "compiledIndexes": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "structured immutable value",
                    "example": {},
                    "description": "{ objectiveIndexById, incoming/outgoing links, requirementDependentsByKey } - Derived immutable indexes built once with the generated job. - structured immutable value (required)"
                }
            }
        },
        "generatedJobRuntime": {
            "keyPath": [
                "saveId",
                "jobId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byStatus",
                    "keyPath": [
                        "saveId",
                        "status"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "jobId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "job-inspect-hearthcross",
                    "description": "job-inspect-hearthcross - Links to runtimeJobDefinitions. - string FK (required)"
                },
                "status": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "active",
                    "description": "active - Exact current job.status. - string (required)"
                },
                "currentStepId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string/null",
                    "example": "interview-proprietor",
                    "description": "interview-proprietor - Current generated-job step; null when the job is complete, failed, or has no active step. - string/null (required)"
                }
            }
        },
        "generatedJobProgressValues": {
            "keyPath": [
                "saveId",
                "jobId",
                "pathKey"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "jobId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "job-inspect-hearthcross",
                    "description": "job-inspect-hearthcross - Links to generatedJobRuntime. - string FK (required)"
                },
                "pathKey": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "inspections_complete",
                    "description": "inspections_complete - Canonical progress path beneath this generated job. - string (required)"
                },
                "value": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number/string/boolean/null",
                    "example": 1,
                    "description": "1 - Exact scalar progress value. - number/string/boolean/null (required)"
                }
            }
        },
        "generatedJobCompletedSteps": {
            "keyPath": [
                "saveId",
                "jobId",
                "stepId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "jobId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "job-inspect-hearthcross",
                    "description": "job-inspect-hearthcross - Links to generatedJobRuntime. - string FK (required)"
                },
                "stepId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "interview-proprietor",
                    "description": "interview-proprietor - Exact completed_step_ids/completedStepIds value. - string (required)"
                }
            }
        },
        "storyJobOffers": {
            "keyPath": [
                "saveId",
                "boardId",
                "offerId"
            ],
            "autoIncrement": false,
            "indexes": [
                {
                    "name": "byBoard",
                    "keyPath": [
                        "saveId",
                        "boardId"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "byAccepted",
                    "keyPath": [
                        "saveId",
                        "accepted"
                    ],
                    "unique": false,
                    "multiEntry": false
                },
                {
                    "name": "bySave",
                    "keyPath": "saveId",
                    "unique": false,
                    "multiEntry": false
                }
            ],
            "fields": {
                "saveId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number FK",
                    "example": 27,
                    "description": "27 - Links to saveHeaders. - number FK (required)"
                },
                "boardId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "job-board-hearthcross",
                    "description": "job-board-hearthcross - Exact story_job_offers board key. - string FK (required)"
                },
                "offerId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "offer-hearthcross-inspection",
                    "description": "offer-hearthcross-inspection - Exact offer_id. - string (required)"
                },
                "templateId": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string FK",
                    "example": "inspection-template",
                    "description": "inspection-template - Exact template_id. - string FK (required)"
                },
                "title": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Inspect a Hearthcross Establishment",
                    "description": "Inspect a Hearthcross Establishment - Exact title. - string (required)"
                },
                "rank": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 1,
                    "description": "1 - Exact rank. - number (required)"
                },
                "romanceable": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": false,
                    "description": "false - Exact romanceable. - boolean (required)"
                },
                "genres": {
                    "required": false,
                    "kind": "array",
                    "typeSpec": "array",
                    "example": [
                        "inspection"
                    ],
                    "description": [
                        "inspection - Exact offer genre. - string"
                    ]
                },
                "summary": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "string",
                    "example": "Inspect one licensed establishment.",
                    "description": "Inspect one licensed establishment. - Exact summary. - string (required)"
                },
                "rewardCoins": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 50,
                    "description": "50 - Exact reward_coins. - number (required)"
                },
                "rewardXp": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "number",
                    "example": 10,
                    "description": "10 - Exact reward_xp. - number (required)"
                },
                "filledValues": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "structured value",
                    "example": {},
                    "description": "{ establishment: The Velvet Paw } - Exact filled_values object. - structured value (required)"
                },
                "accepted": {
                    "required": true,
                    "kind": "scalar",
                    "typeSpec": "boolean",
                    "example": false,
                    "description": "false - Exact accepted. - boolean (required)"
                }
            }
        }
    }
};