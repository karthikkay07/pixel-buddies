# Changelog

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
