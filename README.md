<p align="center">
  <img src="assets/hero.svg" alt="Four pixel buddies: a coral crab, a blue blob, a green robot and a purple ghost, bobbing and blinking" width="696">
</p>

<h1 align="center">Pixel Buddies</h1>

<p align="center">
  Design a tiny animated pixel-art companion that lives above your prompt in Claude Code.<br>
  Pick a type, a colour and a name. It keeps you company and reacts while Claude works.
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#development">Development</a> ·
  <a href="CHANGELOG.md">Changelog</a>
</p>

---

## Features

- **Buddy studio:** run `/buddy` to open a panel where you choose a **type**, a **colour** and a **name**, with a live animated preview.
- **Lives above your prompt:** your buddy sits in the band right above the input box. It bobs and blinks while idle.
- **Reacts to Claude:** while Claude is working, your buddy bobs twice as fast and its status changes ("is cheering Claude on", "is taking notes", …).
- **A whole roster:** save several buddies, switch between them and delete old ones. They're remembered across sessions.
- **Real pixel art everywhere:** half-block cells repainted at 4 fps in the terminal, and a self-animating SVG in the Claude desktop app.
- **Private and offline:** no network calls and no model calls. Everything stays on your machine.

### The cast

| Type | | Colours |
|---|---|---|
| Crab, Blob, Robot, Ghost | <img src="assets/sprite-sheet.png" alt="Sprite sheet: each type in four colours, eyes open and mid-blink" width="220"> | Coral, Sky, Mint, Sunny, Grape, Rose, Slate |

## Install

You need a build of [Claude Code](https://claude.com/claude-code) that supports mods (function-hook plugins). Pixel Buddies is tested on **2.1.295**. Mods are an early-access feature, so if `/plugin install` doesn't recognise the `--marketplace` flag, update Claude Code first.

From the prompt of a Claude Code terminal session, run:

```
/plugin install pixel-buddies --marketplace karthikkay07/pixel-buddies
```

1. Answer **`y`** to *Add marketplace?* (source `github:karthikkay07/pixel-buddies`).
2. Choose a scope. **User** (the default) turns Pixel Buddies on in every session.
3. You'll see `Installed pixel-buddies. Plugin is now active.` and a "No buddy yet. **Make one**" line above your prompt.

> **Claude desktop app:** `/plugin install` runs in a terminal session. Once it's installed at the user scope, Pixel Buddies also loads in the desktop app's Code tab and draws there as an animated SVG.

### Update

```bash
claude plugin update pixel-buddies
```

Then run `/reload-plugins` in any open session, or start a new one.

### Uninstall

```bash
claude plugin uninstall pixel-buddies
```

## Usage

| Command | What it does |
|---|---|
| `/buddy` | Opens the **Buddy studio** panel |
| `/buddy hide` | Hides your buddy (it's remembered) |
| `/buddy show` | Brings it back |

### In the studio

| Control | Key | Action |
|---|---|---|
| **Type** picker | arrows + Enter | Crab, Blob, Robot or Ghost |
| **Colour** picker | arrows + Enter | Seven colours |
| **Name** field | type, Enter to save | Up to 24 characters. Left empty, a cute name is picked for you. |
| **Save buddy / Save changes** | `s` | Saves and makes it your active buddy |
| **Save as new** | `n` | Keeps the current buddy and adds this design as a new one |
| **Surprise me** | `r` | Random type, colour and name |
| **Use / Delete** | — | Manage your roster at the bottom of the panel |

Press **Esc** to close the studio. Once a buddy exists, the studio opens on that buddy, so tweaking it is a single save.

## How it works

Pixel Buddies is a **mod**: a single TypeScript hooks module that Claude Code loads in its own sandbox. It has no DOM, no Node and no network access.

| Piece | Mod API |
|---|---|
| `/buddy` command | `$.command.register` + a `command.run` hook |
| Studio panel | `$.ui.open` + a `ui.render` hook for `Pane`, using `Select`, `Input` and `Button` elements |
| Buddy above the prompt | a `ui.render` hook for `AbovePrompt`; `e.props.isWorking` drives the "Claude is working" mood |
| Terminal animation | a `Raster` element, repainted in place by `$.ui.blit` on a 250 ms `$.clock.every` timer |
| Desktop animation | an `Svg` element with SMIL `<animateTransform>` (bob) and `<animate>` (blink), with no timers |
| Saved buddies | `$.store` (a JSON file in your Claude Code config directory) |
| Live UI state | `atom` / `read` / `update` over `$.state`, so a change redraws whatever reads it |

Sprites are 12×12 strings in [`hooks/sprites.ts`](hooks/sprites.ts). Each letter is a role (`B` body, `D` shade, `L` highlight, `E` eye, `W` eye shine, `K` ink), so one drawing works in every colour. Shade and highlight are mixed from the body colour.

## Development

```bash
git clone https://github.com/karthikkay07/pixel-buddies
cd pixel-buddies
claude --plugin-dir .
```

The `--plugin-dir` flag hot-reloads the mod every time you save a file.

```bash
claude plugin validate .
```

```bash
claude plugin test .
```

`validate` checks the manifest, the marketplace file and the hooks module the way the engine will load them. `test` runs [`tests/buddy.test.tsx`](tests/buddy.test.tsx), which checks the sprite data, the frame logic, and a full studio-to-band flow on both the `terminal` and `desktop` surfaces.

For editor type-checking, load the mod once (Claude Code writes its typings to `.claude-plugin/types/`), then run `tsc -p .`.

### Add a new buddy type

1. Draw a 12×12 sprite in `SPRITES` in `hooks/sprites.ts`, using the letters above.
2. Add it to `KINDS` there and to `BuddyKind` in `types/index.d.ts`.
3. Run `claude plugin test .`. The sprite test checks its size and letters.

### Layout

```
.claude-plugin/
  plugin.json        manifest
  marketplace.json   makes this repo installable with /plugin install
hooks/
  hooks.json         points at register.tsx
  register.tsx       commands, studio pane, band, timers
  sprites.ts         pixel data, palette, frames, Raster and SVG encoders
types/index.d.ts     the mod's $.state contract
tests/               claude plugin test suite
assets/              README images
```

## Roadmap

- More types (cat, dragon, cactus) and a custom hex colour
- Reactions to tool results (a happy hop on success, a wobble on errors)
- Optional sound effects
- AI-written backstories for your buddy

Issues and pull requests are welcome.

## License

[MIT](LICENSE) © karthikkay07. Pixel Buddies is an independent community project and isn't affiliated with Anthropic.
