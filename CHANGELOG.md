# Changelog

## 0.4.0 — 2026-10-19

Buddies have a life of their own.

- **Behaviour engine:** between moments, your buddy does things on its own. It rests, picks an act, plays it, and rests again: about every 10 s for an energetic buddy and every 40 s for a calm one. The choice depends on personality, time of day (morning stretches, late-night yawns) and recent errors (the grump sulks), and it never repeats the last few.
- **Wandering:** buddies walk around a wider stage (40 columns in the terminal), facing the way they go, and stay where they stop.
- **10 universal acts:** look around, turn around, stretch, yawn, shiver, sneeze, scratch, sit, lie down, chase a fly.
- **24 personality acts with props:**
  - pom-poms, jumping jacks and a flag
  - coffee, foot tapping and a rain cloud
  - meditating, a book and pondering
  - juggling, spinning and a tiny fire
  - cocoa, a pillow nap and nodding off
  - a laptop, a cube and a light-bulb idea
  - a telescope, a treasure map and a parrot
  - a quill, a rose and the moon
- **Working props:** while Claude works, your buddy works too, with its personality's prop.
- **Richer poses:** facing direction, squash and stretch (sitting, lying), where the pupils look, held props, and a "?" effect.
- The band says what your buddy is up to ("is reading a treasure map").
- The studio preview can play any reaction, act, walking or working.
- Smaller desktop SVGs: each distinct picture is drawn once and moved with `<use>`, so a walk is two pictures however far it goes.
- 54 tests across 8 suites (up from 43).

## 0.3.0 — 2026-10-19

Dress up your buddy, and earn it.

- **Achievements:** 17 achievements earned from real use (prompts, tools run, tests and builds passed, errors survived, long jobs, active days, sessions, pokes, thoughts heard, buddies made, late-night prompts). Earning one shows a toast and your buddy celebrates. `/buddy achievements` and the studio show your progress.
- **Unlockable wardrobe:**
  - 3 new types: Cat, Dragon, Cactus
  - 5 eye styles: Dots, Big & shiny, Sleepy, Angry, Love
  - 4 patterns: Spots, Stripes, Belly, Gradient
  - 8 accessories: Crown, Party hat, Beanie, Bow, Flower, Headphones, Shades, Scarf
  - any custom hex colour
- **Try before you earn:** locked items show a 🔒 in the studio and can be previewed, but saving them tells you how to unlock them.
- Accessories sit at anchors read from each sprite (eyes, head top, mouth), so every type wears every accessory.
- The canvas is two pixels taller to fit hats (9 terminal rows).
- Only counts are stored, locally. Buddies made before 0.3 count toward *Hello, friend* and *Collector*, and get the default style.
- A silent buddy celebrates achievements without speaking.
- 43 tests across 7 suites (up from 29).

## 0.2.0 — 2026-10-19

Buddies come alive.

- **Personalities:** 8 archetypes (cheerleader, grump, philosopher, chaos gremlin, sleepy, nerd, pirate, poet), each with energy, chattiness, traits and about 25 lines of its own. *Auto* reads the personality from the name ("Captain Bolt" is a pirate) and the same name always gives the same buddy. Reroll it, or pick one yourself in the studio.
- **Reactions:** your buddy waves hello, perks up at prompts, bobs along while Claude works, celebrates passing tests and builds, wobbles at errors, and hops after long jobs.
- **Random thoughts** between tasks, paced by the buddy's personality and your chattiness setting, without repeating recent lines.
- **Sleep:** dozes off after a while without activity (Zzz) and wakes up when you're back.
- **9 animations** with expressions (happy, wide, sad and closed eyes; open and flat mouths) and floating effects: hearts, sparkles, sweat drops, Zzz, !, thinking dots and music notes. The studio can preview each one.
- **Speech and thought bubbles** beside the buddy, with its archetype next to its name.
- **Settings:** `chattiness` (silent, quiet, normal, chaotic; default normal) and `sleepAfterMinutes` (default 10).
- `/buddy poke`.
- Smoother animation: 8 frames a second in the terminal. On the desktop, each animation plays as one self-animating SVG.
- The prompt and tool-call hooks have pass-through fallbacks, so a buddy can never block your work.
- Buddies saved by 0.1 upgrade automatically and get a personality read from their name.
- 29 tests (up from 10), including integration tests on a mock clock.

## 0.1.1 — 2026-10-19

- Saved buddies are checked when they load. Anything corrupted, hand-edited or from a future version (an unknown type, a bad colour, a missing name, a duplicate id) is dropped instead of breaking the band. A missing active buddy falls back to the first one.
- Names are stripped of control characters, and the roster is capped at 50 buddies.
- New tests cover restoring at session start, `/buddy hide` and `show`, switching, "Save as new", deleting, and the store checks (10 tests in all).
- CI runs `claude plugin validate` and `claude plugin test` on Ubuntu and Windows for every push and pull request.

## 0.1.0 — 2026-10-19

First release.

- `/buddy` opens the Buddy studio: pick a type (crab, blob, robot, ghost), one of seven colours and a name, with a live animated preview.
- Your buddy lives in the band above the prompt. It bobs and blinks while idle, bobs faster while Claude is working, and its status line changes with Claude's state.
- Keep several buddies, switch between them, and delete the ones you don't want. They're saved across sessions.
- `/buddy hide` and `/buddy show`.
- Pixel art is drawn with half-block cells in the terminal and as animated SVG in the desktop app.
