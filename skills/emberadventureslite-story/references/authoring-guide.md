# Authoring guide

Adapted from the original authoring skill. The bundled Lite field contract and
SKILL.md own exact schemas and release behavior; these copied design principles
cover creative quality and continuity. Creator preferences and explicit task
authorization take precedence over optional examples.

## Original Story Design

Start from the requested premise and a playable local problem. Build the story framework before writing long narration. Give important cast members personal motives and limitations; do not introduce a whole world history before the player can act. Scale the objective graph to the requested length.

## Spoiler And Visibility Rules

Do not expose future party members, NPCs, villains, locations, factions,
relationships, betrayals, bosses, twists, objective rewards, or planned story
events in the opening scene unless they are present, known, and actionable at
that moment.

Use hidden objectives and `future_cast` for full-story knowledge. Before
finalizing, run a hidden-future visibility pass over:

- opening messages;
- story description;
- visible objective titles/summaries;
- map summaries/details;
- current NPC fields;
- party member fields visible in library/editor UIs;
- story metadata visible in public/library cards.

Visible text should contain only what the protagonist/player could reasonably
know at the starting point. Future names, future party roles, locked locations,
hidden rewards, required relationship outcomes, future villains, and major twists
belong in hidden future cast/objectives/rewards until play reaches them.

If a present NPC has a real stored name that the player should not know yet,
store the real name in `npc_directory` for voice/state stability, but add
`player_known_name: false` and a concise `player_facing_label` such as
`damaged robot torso`, `masked prisoner`, or `unknown knight`. Until the reveal,
opening text, visible objective titles/summaries, and auto-player-facing
summaries should use the label/role/pronouns, not the hidden real name. Hidden
speaker tags may still use the stored name only to route voices, but the visible
prose must establish what the player actually knows.

## Opening Rules

The first assistant message should be vivid and immediately playable, not a lore
dump. It should normally introduce only:

- the immediate sensory situation;
- one present NPC max, unless a second person is essential and actionable;
- one visible problem;
- one concrete player action.

The opening may establish unavoidable starting circumstances, but it must
preserve player agency. Do not write the player as already having made a
meaningful choice, agreed to a relationship, submitted, attacked, flirted,
forgiven someone, accepted a job, or committed to a moral path unless that is
the explicit requested starting premise.

Use grounded, actionable details before abstract setting mechanics. Avoid
front-loading councils, prophecies, cosmic systems, charters, political
contracts, or hidden frameworks unless that concept is the single visible
problem the player can act on immediately.

End on an in-world situation or action opportunity, not a meta prompt. Never end
the opening with `What do you do?`, `How do you respond?`, `What happens next?`,
or another question that merely reminds the player that the game is interactive.

For surprise, danger, first-contact, or mystery openings, write the opening
objective and early completion instructions so an automatic player turn reacts
believably from limited knowledge. Do not encourage perfect diagnosis, instant
technical solutions, hidden-name usage, or optimal plot advancement unless the
player has already visibly earned that knowledge.

## Story Memory Rules

Use the `state.story_memory` section in the bundled story-contract.md. It defines the only
supported memory buckets and the boundary between memory, rules, objectives, and
creator/process notes.

## Choose Scene Mode Intentionally

Normal EmberAdventuresLite stories may move in and out of two complementary modes.

- **Authored scene sequence:** Use a tight chain of linked objectives when the
  story needs deliberate pacing, a sequence of reveals, political procedure,
  investigation, training, negotiation, romance development, an emotional
  confrontation, a social ritual, a trial, a mission briefing, or any scene
  where each response should establish the next beat. A tight chain is not
  limited to the opening. Enter it whenever the author needs to tell a
  particular sequence of scenes, then return to broader player control when
  that sequence has delivered its purpose.
- **Open objective:** Use a larger objective when the player should control the
  method, order, tone, or amount of engagement: explore a city, earn access to
  a faction, investigate a mystery, prepare for a journey, pursue optional
  relationships, or solve a problem by any plausible approach. Do not create
  artificial micro-objectives merely to force the player through an otherwise
  open situation.

A strong story alternates deliberately. A broad objective can lead into a
political hearing; the hearing can use a tight sequence of authored objectives;
after the decision and consequences, the story can return to a broad objective.
Freeform relationship time can lead into a tightly authored confession,
argument, invitation, boundary, or shared crisis, then return to free play.

## Required Objective-Handoff Pass

For every objective in an authored scene sequence, validate this handoff:

`previous completion criteria -> previous completion instruction -> current
scene -> next title -> next summary`

Before writing or revising Objective N, inspect Objective N-1 and answer:

1. What exact player action or world result completes Objective N-1?
2. What does its one-time completion response show?
3. Where is the player after that response?
4. Who is physically present, and who is only known or expected elsewhere?
5. What does the player know, and what remains hidden?
6. What immediate action, choice, conversation, or freedom is now available?
7. Does Objective N's title clearly ask for that action?
8. Does Objective N's summary describe that exact live situation and why the
   action matters now?
9. Does Objective N-1's completion instruction stop before doing Objective N
   for the player?
10. Is Objective N's title still a pending action at activation, rather than a
    state or event Objective N-1 has already established? Reject it if its
    title would already be true as soon as the previous completion response
    ends.

Do this pass for each handoff in a tight sequence. For a broad/open objective,
validate only that its starting situation and completion criteria leave room for
multiple credible player approaches.

When the user builds objectives incrementally, begin the response by restating
the previous approved objective's completion condition and output instruction
before proposing the next objective. Do not jump ahead into unapproved future
content. Preserve stable ids and unrelated story data.

## Output Instructions Are One-Time Handoffs

An output's `completion_instruction` directs the immediate narrator response
when that result resolves. It is not permanent scene guidance, durable memory,
a replacement for deterministic rewards, or permission to complete the next
objective automatically.

Use it to do only the work needed to hand the story forward:

- show the immediate consequence;
- reveal one relevant fact;
- visibly introduce someone whose definition has been unlocked or made current;
- move the scene or advance time;
- establish the next actionable situation.

Then stop. An output instruction should hand the scene to the next objective,
not consume the next objective's playable content. A travel objective normally
establishes the destination and the next interaction; it does not perform the
entire conversation, lesson, negotiation, or conflict waiting there.

Do not use an output instruction as a container for authored exposition that
the player must receive. If a character must communicate particular facts,
terms, motives, warnings, findings, or a reveal, enable Dialogue on that output
and place the required wording in `dialogue_lines`. The instruction may direct
the delivery's tone, reaction, movement, or immediate consequence, but it must
not be the only place a required explanation lives.

## Objective Summaries Describe The Live Situation

An objective summary is player-facing. It describes the immediate situation and
why the requested action is relevant now. Include current pressure, useful
context, available freedom, and who or what is waiting when that information
helps the player decide what to do. If an objective has a `summary` field, do
not leave it blank. The player usually opens the summary because they want help,
so give a minor non-spoilery hint about how to approach or complete the
objective: likely person, place, action, resource, topic, or constraint. It must
add meaningful context beyond the title without exposing hidden future outcomes,
route labels, endings, betrayals, or unearned consequences.

## One Objective, One Completion Beat

Every objective must require only one simple event, action, decision, result, or
scene-ending condition to complete. An objective is not a checklist. Do not put
an entire conversation, investigation, lesson, trip, relationship change, or
scene plan into one `completion_criteria`.

Treat these as strong warning signs that the objective is doing too much:

- the completion criterion contains a list of things that must all happen;
- the criterion joins separate required beats with `and`, `then`, `after`, or
  similar sequencing language;
- the title or summary names several distinct actions;
- completion requires the player to ask several questions, visit several
  places, receive several explanations, make several decisions, or produce
  several unrelated results;
- the narrator would need to track a hidden checklist before it could return
  yes.

When any warning sign appears, assume the objective is wrong and restructure it
unless every clause is merely another equivalent way to prove the same single
completion beat. An `or` list may describe equivalent evidence for one result;
it must not disguise several separate tasks.

Use one of these three normal structures when a scene needs many things:

1. **Sequential objective chain.** Create a chain in which each objective waits
   for one simple thing, completes, and hands off to the next objective. Use
   this for authored explanations, investigations with ordered discoveries,
   rituals, training, multi-stage travel, or any scene where several distinct
   beats must reliably occur.
2. **Open-ended scene with one player-controlled exit.** Put the optional
   topics, interactions, activities, and opportunities in the player-facing
   summary, but give the objective one unmistakable completion action such as
   leaving the room, going to sleep, ending the date, departing the camp, or
   explicitly concluding the meeting. Use this mainly for flexible,
   non-critical play such as dinner conversation, downtime, casual dates,
   socializing, or exploration where the listed activities do not all need to
   happen. Suggested content is not a hidden completion checklist.
3. **Objective tree.** Branch into separate objectives when different player
   actions, discoveries, choices, or outcomes should cause different events.
   Branches may converge on a later shared objective or remain permanently
   separate when the consequences should persist.

Do not solve an overloaded objective by making its criterion vaguer. Split the
required beats, make optional material genuinely optional behind one clear exit,
or model the alternatives as branches. During the final objective audit, inspect
every criterion containing a list or `and` statement and either restructure it
or confirm that it expresses only one completion beat.

## Persistence And Knowledge

Anything later play must reliably know must be persisted in the correct
supported structure. Opening prose and completion instructions establish a
moment; they are not durable memory by themselves.

- Use a state field for an exact supported mechanical value.
- Use a story rule for a current hard runtime constraint or mechanic the
  narrator must obey, not ordinary lore or biography.
- Use story memory/world notes for durable continuity or lore when it does not
  need deterministic mechanical enforcement.
- Use a character/NPC field for identity, ability, durable facts, and other
  facts belonging to that person.
- Use an `adjust_relationship` reward for a persistent social change.
- Use location/map rewards and fields for discovery, availability, and travel.
- Use inventory fields and supported inventory rewards for controlled resources.

Do not invent undocumented nested state paths merely because a generic patch
could write them. Model a custom mechanic only in a documented supported
location. If the normal story schema lacks a suitable supported location,
identify that as an app/schema decision instead of silently inventing a new
persistent shape.

For every important reveal, maintain a knowledge partition: what the player
knows; what each present companion knows; what natives, officials, specialists,
and antagonists know; what is common knowledge; and who learns what during this
scene. Do not make all present characters react as though they share the same
information.

Narrate unfamiliar worlds through the player's knowledge lens. Distinguish what
the player directly perceives, what they can reasonably compare to familiar
media/history, what has been explicitly explained, and what remains unknown.
Do not turn author knowledge into player knowledge.

## Character Introduction And Map Timing

A visible introduction in an output `completion_instruction` is not a
substitute for a usable character definition. Predefine recurring or important
later characters in `future_cast` with full data. On the output where they
visibly arrive, use the applicable introduction/promotion/state rewards so
their identity, availability, and scene presence persist. Do not store a
character's identity only as a story rule.

Distinguish map existence, discovery, travel availability, current location, and
focus location. A location may exist in the template but remain hidden or
unavailable. Unlock it no later than the first objective where the player may
reasonably visit or use it. For a travel handoff, validate applicable updates to
current location, focus location, location detail, discovery/travel availability,
travel history, and valid map connections. Prefer a meaningful hierarchy such
as world -> region -> settlement -> district/building -> room/site rather than
using an unrelated room as the parent of every room in a building.

## Adjacent-Title Rhythm

Read objective titles in sequence as well as individually. Improve repetitive
adjacent title shapes when a clearer natural verb exists, but preserve clarity
and stable ids. Repetition is a soft quality concern, not a reason to replace
the clearest player-facing title.
