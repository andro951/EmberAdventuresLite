Create content for EmberAdventuresLite, a family-friendly fantasy storytelling game. Keep descriptions, outfits, illustrations, dialogue, and relationships suitable for general audiences. Use adventure, mystery, friendship, humor, and optional gentle romance. Avoid graphic violence. Ask what the player wants before drafting. Deliver an importable JSON file, not JavaScript. Preserve exact field names, types, and nesting from the reference. Unknown fields are rejected. Do not invent engine features or use another product's schema. Validate in the game's editor before treating a file as ready.

All humanoid outfits and embedded starting clothing must cover the torso and legs with opaque garments. Keep shoulders and the chest covered. Use full-length trousers or ankle-length skirts with no revealing openings. Apply this to every alternate presentation, starting pose, custom image instruction, and story reward that changes clothing. Delete questionable outfit variants rather than retaining them as optional choices. Ordinary friendship and gentle romance are welcome; personalities must not revolve around sexual submission or ownership.

Story authoring

Use the story-template envelope below. Keep characters separate from the story progression graph. Every referenced character, outfit, item, node, output, shop, and job id must resolve. Story guidance should establish tone, setting, pacing, and the narrator's role. Character poses describe only their own body and objects; scene.image_action describes interactions between characters.

The progression graph controls story beats, branches, choices, requirements, rewards, and endings. An objective title is player-facing prose. Provide meaningful outcomes and a path forward for each branch, avoiding impossible conditions and unintended completion loops. Track durable events in structured story memory. Use actual list fields for list-item rewards. Keep player eligibility and the initial player state consistent with allow_any_player. The built-in story editor can add shops, jobs, map locations, travel, and advanced graph nodes using the exact supported schema; export that result as the reference for these features instead of inventing their JSON.

Test a fresh start, every branch, rewards, save/reload, and completion. Check that the opening includes intended cast members and locations. Do not claim a story has been tested merely because its JSON parses. Images may be generated in game; empty image URLs are intentional.

Reference JSON:

{
  "app": "EmberAdventures",
  "exportType": "story-template",
  "storyTemplate": {
    "id": "lantern-road",
    "title": "The Lantern Road",
    "description": "Help the village courier carry a lantern through the fog.",
    "source": "Original",
    "creation_tool": "EmberAdventuresLite",
    "genres": [
      "fantasy"
    ],
    "createdAt": "2026-09-18T03:49:28.290Z",
    "updatedAt": "2026-09-18T03:49:28.290Z",
    "allow_any_player": false,
    "any_player_starting_state": {},
    "app": "EmberAdventures",
    "templateType": "story",
    "default_image_model": "fantasy-rpg",
    "title_card_subjects": [
      "The Lantern Road"
    ],
    "title_card_image": {
      "id": "the-lantern-road-title-card",
      "title": "The Lantern Road title card",
      "prompt": "Example title card for The Lantern Road.",
      "negativePrompt": "text, logo, watermark",
      "seed": 0,
      "model": "fantasy-rpg",
      "source": "hosted",
      "url": "",
      "hosted_url": "",
      "html": "",
      "favorite": false
    },
    "state": {
      "meta": {
        "app": "EmberAdventures",
        "genres": [
          "fantasy"
        ],
        "story_guidance": "Tell a family-friendly adventure about delivering a lantern through a mysterious forest.",
        "story_source": {
          "mode": "original",
          "title": "The Lantern Road",
          "description": "Help the village courier carry a lantern through the fog.",
          "modifications": []
        },
        "default_image_model": "fantasy-rpg"
      },
      "player": {
        "version": 1,
        "id": "character-village-courier",
        "name": "Village Courier",
        "source": "Player",
        "creation_tool": "EmberAdventures (Perchance)",
        "can_die": true,
        "romanceable": true,
        "gender": "female",
        "fallback_name": "Village Courier Alternate",
        "fallback_outfits": [
          {
            "id": "fallback-default",
            "name": "Alternate Default Outfit",
            "clothing": {
              "shirt": "plain alternate shirt",
              "pants": "plain alternate trousers",
              "feet": "plain alternate shoes"
            }
          }
        ],
        "fallback_starting_outfit_id": "fallback-default",
        "age": 28,
        "role": "fake example-test player",
        "personality_description": "Village Courier is a distinct adult character whose deeper personality should remain consistent across scenes.",
        "speech_style": "Direct example-test dialogue.",
        "boldness": 5,
        "starting_relationship_to_player": "example-test acquaintance",
        "starting_trust": 0,
        "starting_attraction": 0,
        "starting_affection": 0,
        "starting_state_of_mind": "focused",
        "starting_physical_state": "healthy",
        "starting_pose": "standing",
        "appearance": {
          "species": "human",
          "height": 10,
          "body_description": "A sturdy, athletic build.",

          "skin_color": "",
          "eye_color": "",
          "hair_color": "",
          "hair_length": "",
          "hair_type": "",
          "extra_description": "",
          "extra_description_lower_body": "",
          "nonhuman_lower_body": false
        },
        "outfits": [
          {
            "id": "default",
            "name": "Default",
            "clothing": {
              "shirt": "plain example-test tunic",
              "pants": "plain example-test trousers",
              "feet": "plain example-test boots"
            }
          }
        ],
        "starting_outfit_id": "default",
        "starting_held_items": {
          "right_hand": null,
          "left_hand": null
        },
        "starting_inventory": [],
        "starting_known_facts": [
          "Village Courier is an adult character."
        ],
        "default_seed": 0,
        "image_prompt_config": {
          "seed_enabled": true,
          "seed": 0,
          "style": "high detail fantasy RPG character art, cinematic lighting",
          "profile_style": "",
          "negative": "",
          "negative_prompt": ""
        },
        "default_profile_image": {
          "url": "",
          "local_image_id": "",
          "source": "hosted",
          "seed": 0,
          "prompt": "Example profile image for Village Courier.",
          "negative_prompt": "",
          "note": "Example profile image fixture.",
          "male": false
        },
        "profile_image_presentations": {
          "male": {
            "url": "",
            "local_image_id": "",
            "source": "hosted",
            "prompt": "Example profile image for Village Courier Male.",
            "seed": 0,
            "negative_prompt": "",
            "note": "Example profile image fixture.",
            "male": true
          },
          "non_male": {
            "url": "",
            "local_image_id": "",
            "source": "hosted",
            "prompt": "Example profile image for Village Courier Non-Male.",
            "seed": 0,
            "negative_prompt": "",
            "note": "Example profile image fixture.",
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
        "voice": null,
        "created_at": "2026-09-18T03:49:28.288Z",
        "updated_at": "2026-09-18T03:49:28.288Z"
      },
      "players": [],
      "characters": {},
      "future_cast": {
        "enabled": false,
        "items": {}
      },
      "location": {
        "universe": "Example Fixture Universe",
        "world": "Example Fixture World",
        "continent": "Example Fixture Continent",
        "region": "Example Fixture Region",
        "settlement_type": "test settlement",
        "settlement_name": "Example Fixture Settlement",
        "district": "Example Fixture District",
        "specific_place": "Example Fixture Room",
        "npc_location_id": "example-fixture-room"
      },
      "npc_directory": {
        "locations": {
          "example-fixture-room": {
            "label": "Example Fixture Room",
            "characters": {}
          }
        }
      },
      "scene": {
        "summary": "A quiet village road at dusk.",
        "party_members_present": [],
        "image_characters": [],
        "npcs_present": [],
        "image_action": "standing beside a wooden signpost"
      },
      "story_rules": [],
      "story_inventory": {
        "items": []
      },
      "world_flags": {},
      "world_map": {
        "current_location_id": "example-fixture-room",
        "focus_location_id": "example-fixture-room",
        "travel_history": [
          "example-fixture-room"
        ],
        "locations": {
          "example-fixture-room": {
            "id": "example-fixture-room",
            "name": "Example Fixture Room",
            "type": "place",
            "scale": "site",
            "parent_id": "",
            "x": 0,
            "y": 0,
            "discovered": true,
            "travel_enabled": true,
            "summary": "A clearly fake room for example tests.",
            "detail": {},
            "npcs": [],
            "connections": []
          }
        }
      },
      "objectives": {
        "active_id": "example-objective",
        "no_current": false,
        "items": [
          {
            "id": "example-objective",
            "title": "Example Objective",
            "type": "story",
            "status": "active",
            "summary": "Example Objective for a fake example-test story.",
            "while_active_guidance": "Keep the fake example-test scene focused on Example Objective.",
            "completion_control": "player",
            "completion_criteria": "Complete Example Objective.",
            "next_objectives": [
              {
                "id": "example-objective-ending",
                "completion_instruction": "Resolve Example Objective.",
                "rewards": [],
                "ending_type": "freeplay",
                "ending_message": ""
              }
            ],
            "exclusive_group": "",
            "completion_message": "",
            "rewards": []
          }
        ]
      },
      "time": {
        "year": 1,
        "month": 1,
        "day": 1,
        "hour": 12,
        "minute": 0
      },
      "story_memory": {
        "world_notes": [],
        "unresolved_threads": [],
        "relationship_notes": [],
        "rules_and_constraints": [],
        "ai_private_notes": []
      },
      "recent_changes": [],
      "story_clock": {
        "elapsed_minutes": 0,
        "label": "Day 1, 12:00 PM"
      },
      "story_pacing": {
        "mode": "player_controlled",
        "pending_event_id": "",
        "timeline": {}
      },
      "timed_events": {}
    },
    "messages": [
      {
        "role": "assistant",
        "speaker": "Narrator",
        "text": "The village bell rings as you reach the lantern-lit road.",
        "at": "2026-09-18T03:49:28.290Z"
      }
    ]
  },
  "exportedAt": "2026-09-18T03:49:28.298Z"
}