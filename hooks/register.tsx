import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Anim, Buddy, Draft, Mood } from '../types'
import { ANIMS, ANIM_NAMES, TICK_MS, isAnim } from './animations'
import { MAX_BUDDIES, MAX_NAME, cleanActiveId, cleanName, cleanRoster, isKind } from './data'
import {
  ARCHETYPES,
  ARCHETYPE_NAMES,
  CHATTINESS,
  STATUS,
  classifyToolResult,
  fill,
  isArchetype,
  personalityOf,
  react,
  thoughtChance,
} from './personality'
import type { BuddyEvent, Chattiness } from './personality'
import { CANVAS_H, CANVAS_W, COLORS, KINDS, NAMES, rasterCells, svgSource } from './sprites'

const STUDIO = 'buddy-studio'
const BRAIN_EVERY_MS = 10_000
const LINE_MS = 7000
/** Least time between two small remarks, by chattiness; big moments skip it. */
const LINE_COOLDOWN_MS: Record<Chattiness, number> = { silent: Infinity, quiet: 90_000, normal: 25_000, chaotic: 6000 }
const BIG_MOMENTS: readonly BuddyEvent[] = ['hello', 'error', 'success', 'done', 'poke']
/** A turn this long counts as a big job when it finishes. */
const LONG_TURN_MS = 45_000

const REST: Mood = { anim: null, until: 0, since: 0, line: null, lineUntil: 0, isThought: false }

const draft = atom({ plugin: 'pixel-buddies', key: 'draft' } as const, {
  name: '',
  kind: 'crab',
  color: '#F07858',
  archetype: 'auto',
  seed: 0,
  preview: 'idle',
})
const roster = atom({ plugin: 'pixel-buddies', key: 'roster' } as const, [])
const activeId = atom({ plugin: 'pixel-buddies', key: 'activeId' } as const, null)
const isHidden = atom({ plugin: 'pixel-buddies', key: 'isHidden' } as const, false)
const mood = atom({ plugin: 'pixel-buddies', key: 'mood' } as const, REST)
const isAsleep = atom({ plugin: 'pixel-buddies', key: 'isAsleep' } as const, false)

// Settings, from the plugin's options (/config).
let level: Chattiness = 'normal'
let sleepAfterMs = 10 * 60_000

// Where a terminal drew each Raster last, so the timer repaints it in place.
let bandSite: string | null = null
let isStudioOnTerminal = false
let isWorking = false
let tick = 0
let lastActivity = 0
let lastLineAt = -Infinity
let lastErrorAt = -Infinity
let turnStartedAt = 0
let recentLines: string[] = []

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)] ?? (list[0] as T)
}

function dots(n: number): string {
  return '●'.repeat(n) + '○'.repeat(5 - n)
}

/** What the buddy is playing now: a reaction, else its resting state. */
function currentAnim(m: Mood, asleep: boolean, now: number): Anim {
  if (m.anim && now < m.until) return m.anim
  return asleep ? 'sleeping' : isWorking ? 'typing' : 'idle'
}

function clockTime(now: number): string {
  const d = new Date(now)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function activeBuddy($: EngineInterface): Promise<Buddy | null> {
  const id = await read($, activeId)
  const list = await read($, roster)
  return list.find(b => b.id === id) ?? null
}

async function persist($: EngineInterface) {
  await $.store.set('roster', await read($, roster))
  await $.store.set('activeId', await read($, activeId))
  await $.store.set('isHidden', await read($, isHidden))
}

/** Plays a reaction to an event: an animation, and a line if the buddy feels like talking. */
async function trigger($: EngineInterface, event: BuddyEvent, tool?: string) {
  const buddy = await activeBuddy($)
  if (!buddy || (await read($, isHidden))) return
  const now = await $.clock.now()
  const personality = personalityOf(buddy)
  const r = react(event, personality, level, { name: buddy.name, tool, time: clockTime(now) }, recentLines)
  const isBig = BIG_MOMENTS.includes(event)
  const line = r.line !== null && (isBig || now - lastLineAt >= LINE_COOLDOWN_MS[level]) ? r.line : null
  if (!r.anim && line === null) return
  if (line !== null) {
    lastLineAt = now
    recentLines = [...recentLines, line].slice(-12)
  }
  await update($, mood, m => ({
    anim: r.anim ?? m.anim,
    until: r.anim ? now + r.ms : m.until,
    since: r.anim ? tick : m.since,
    line: line ?? m.line,
    lineUntil: line !== null ? now + LINE_MS : m.lineUntil,
    isThought: line !== null ? r.isThought : m.isThought,
  }))
  // Clear what has run its course, which redraws the band.
  $.clock.after(r.ms + 50, () => void expire($))
  if (line !== null) $.clock.after(LINE_MS + 50, () => void expire($))
}

async function expire($: EngineInterface) {
  const now = await $.clock.now()
  await update($, mood, m => ({
    ...m,
    anim: m.anim && now >= m.until ? null : m.anim,
    line: m.line && now >= m.lineUntil ? null : m.line,
  }))
}

/** Anything the person or Claude does: it keeps the buddy awake, or wakes it. */
async function activity($: EngineInterface) {
  lastActivity = await $.clock.now()
  if (await read($, isAsleep)) {
    await update($, isAsleep, () => false)
    await trigger($, 'wake')
  }
}

/** Every few seconds: doze off when idle long enough, or maybe think out loud. */
async function brain($: EngineInterface) {
  const buddy = await activeBuddy($)
  if (!buddy || isWorking || (await read($, isHidden)) || (await read($, isAsleep))) return
  const now = await $.clock.now()
  if (sleepAfterMs > 0 && now - lastActivity >= sleepAfterMs) {
    await update($, isAsleep, () => true)
    await trigger($, 'sleep')
    return
  }
  const m = await read($, mood)
  const isBusy = (m.anim !== null && now < m.until) || (m.line !== null && now < m.lineUntil)
  if (!isBusy && Math.random() < thoughtChance(level, personalityOf(buddy), BRAIN_EVERY_MS / 1000)) {
    await trigger($, 'thought')
  }
}

async function paint($: EngineInterface) {
  tick += 1
  if (bandSite !== null) {
    const buddy = await activeBuddy($)
    if (buddy) {
      const m = await read($, mood)
      const now = await $.clock.now()
      const anim = currentAnim(m, await read($, isAsleep), now)
      const frame = anim === m.anim ? tick - m.since : tick
      const shown = await $.ui.blit({
        requestId: bandSite,
        key: 'band-sprite',
        cells: rasterCells(buddy.kind, buddy.color, anim, frame),
      })
      // Not mounted any more: stop painting until the band draws it again.
      if (shown.deny) bandSite = null
    }
  }
  if (isStudioOnTerminal) {
    const d = await read($, draft)
    const shown = await $.ui.blit({
      requestId: STUDIO,
      key: 'preview',
      cells: rasterCells(d.kind, d.color, d.preview, tick),
    })
    if (shown.deny) isStudioOnTerminal = false
  }
}

// Set up once per load: at session start, or on the first draw when the mod
// is installed into a session that has already started.
let isStarted = false
async function start($: EngineInterface) {
  if (isStarted) return
  isStarted = true
  // Whatever the store holds is checked before anything draws it.
  const saved = cleanRoster(await $.store.get('roster'))
  const savedActive = cleanActiveId(await $.store.get('activeId'), saved)
  const savedHidden = (await $.store.get('isHidden')) === true
  await update($, roster, () => saved)
  await update($, activeId, () => savedActive)
  await update($, isHidden, () => savedHidden)
  lastActivity = await $.clock.now()

  await $.command.register({
    name: 'buddy',
    description: 'Pixel Buddies: open the studio, or /buddy poke | hide | show',
  })

  $.clock.every(TICK_MS, () => void paint($))
  $.clock.every(BRAIN_EVERY_MS, () => void brain($))
}

async function openStudio($: EngineInterface) {
  const current = await activeBuddy($)
  const next: Draft = current
    ? { name: current.name, kind: current.kind, color: current.color, archetype: current.archetype, seed: current.seed, preview: 'idle' }
    : { name: pick(NAMES), kind: pick(KINDS).value, color: pick(COLORS).value, archetype: 'auto', seed: 0, preview: 'idle' }
  await update($, draft, () => next)
  await $.ui.open({ id: STUDIO, title: 'Buddy studio', focus: true, closeOnEscape: true })
}

async function saveDraft($: EngineInterface, asNew: boolean) {
  const d = await read($, draft)
  const name = cleanName(d.name) || pick(NAMES)
  const current = await activeBuddy($)
  const isAdding = asNew || !current
  if (isAdding && (await read($, roster)).length >= MAX_BUDDIES) {
    $.ui.toast(`You have ${MAX_BUDDIES} buddies already. Delete one to make room.`)
    return
  }
  const id = !isAdding && current ? current.id : `b${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
  const buddy: Buddy = { id, name, kind: d.kind, color: d.color, archetype: d.archetype, seed: d.seed }
  await update($, roster, list =>
    list.some(b => b.id === id) ? list.map(b => (b.id === id ? buddy : b)) : [...list, buddy],
  )
  await update($, activeId, () => id)
  await update($, isHidden, () => false)
  await update($, isAsleep, () => false)
  await persist($)
  $.ui.toast(`${name} the ${personalityOf(buddy).label.toLowerCase()} ${d.kind} is ready.`)
  await trigger($, 'hello')
}

async function useBuddy($: EngineInterface, b: Buddy) {
  await update($, activeId, () => b.id)
  await update($, draft, d => ({ ...d, name: b.name, kind: b.kind, color: b.color, archetype: b.archetype, seed: b.seed }))
  await update($, mood, () => REST)
  await persist($)
  await trigger($, 'hello')
}

async function deleteBuddy($: EngineInterface, b: Buddy) {
  const current = await activeBuddy($)
  await update($, roster, all => all.filter(x => x.id !== b.id))
  if (b.id === current?.id) {
    const rest = await read($, roster)
    await update($, activeId, () => rest[0]?.id ?? null)
    await update($, mood, () => REST)
  }
  await persist($)
}

export const register: Register = (on, options) => {
  level = CHATTINESS.includes(options.chattiness as Chattiness) ? (options.chattiness as Chattiness) : 'normal'
  const minutes = Number(options.sleepAfterMinutes)
  sleepAfterMs = Number.isFinite(minutes) && minutes > 0 ? minutes * 60_000 : 0

  on('session.start', async ($, e, next) => {
    await start($)
    await trigger($, 'hello')
    return next(e)
  })

  on('command.run', { command: 'buddy' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'hide' || arg === 'show') {
      await update($, isHidden, () => arg === 'hide')
      await persist($)
      return { text: arg === 'hide' ? 'Buddy hidden. /buddy show brings it back.' : 'Buddy is back.' }
    }
    if (arg === 'poke') {
      const buddy = await activeBuddy($)
      if (!buddy) return { text: 'No buddy yet. /buddy makes one.' }
      await activity($)
      await trigger($, 'poke')
      return { text: `You poked ${buddy.name}.` }
    }
    await openStudio($)
    return { text: 'Buddy studio opened.' }
  })

  on('prompt.submit', async ($, e, next) => {
    try {
      turnStartedAt = await $.clock.now()
      await activity($)
      await trigger($, 'prompt')
    } catch {
      // A buddy never gets in the way of a prompt.
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    try {
      await activity($)
      await trigger($, 'working', e.tool)
    } catch {
      // Nor of a tool call.
    }
    const ran = await next(e)
    try {
      if (!('deny' in ran && ran.deny)) {
        const kind = classifyToolResult(e.tool, ran.isError === true, ran.text)
        const now = await $.clock.now()
        // One sad face per bad patch, not one per failing command.
        if (kind === 'error' && now - lastErrorAt > 20_000) {
          lastErrorAt = now
          await trigger($, 'error', e.tool)
        } else if (kind === 'success') {
          await trigger($, 'success', e.tool)
        }
      }
    } catch {
      // The result goes back untouched either way.
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    try {
      const now = await $.clock.now()
      if (e.reason === 'answer' && turnStartedAt > 0 && now - turnStartedAt >= LONG_TURN_MS) await trigger($, 'done')
      if (e.reason === 'error') await trigger($, 'error')
      lastActivity = now
    } catch {
      // Nothing to undo.
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!isStarted) {
      // Drawing is pure, so the first-draw start runs just after, off the draw.
      $.clock.after(0, () => void start($))
    }
    if (e.props.hasSurvey || (await read($, isHidden))) {
      bandSite = null
      return next(e)
    }
    const buddy = await activeBuddy($)
    const { Box, Text, Button } = $.ui.resolve(e)

    if (!buddy) {
      bandSite = null
      return (
        <Box>
          <Text dimColor>No buddy yet. </Text>
          <Button key="make" label="Make one" onPress={() => openStudio($)} />
        </Box>
      )
    }

    isWorking = e.props.isWorking
    const m = await read($, mood)
    const now = await $.clock.now()
    const anim = currentAnim(m, await read($, isAsleep), now)
    const line = m.line !== null && now < m.lineUntil ? m.line : null
    const personality = personalityOf(buddy)

    let sprite
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      bandSite = e.requestId
      sprite = (
        <Raster
          key="band-sprite"
          columns={CANVAS_W}
          rows={CANVAS_H / 2}
          cells={rasterCells(buddy.kind, buddy.color, anim, anim === m.anim ? tick - m.since : tick)}
        />
      )
    } else {
      bandSite = null
      const { Svg } = $.ui.resolve(e)
      sprite = (
        <Svg
          source={svgSource(buddy.kind, buddy.color, anim)}
          alt={`${buddy.name} the ${buddy.kind}, ${ANIMS[anim].label.toLowerCase()}`}
          width={76}
          height={64}
          isInteractive
        />
      )
    }

    return (
      <Box flexDirection="row" alignItems="center">
        {sprite}
        <Box flexDirection="column" marginLeft={2} flexShrink={1}>
          <Text>
            <Text bold color={buddy.color}>
              {buddy.name}
            </Text>
            <Text dimColor> · {personality.label}</Text>
          </Text>
          {line !== null ? (
            <Text italic={m.isThought} wrap="wrap">
              {m.isThought ? `💭 ${line}` : `“${line}”`}
            </Text>
          ) : (
            <Text dimColor>{STATUS[anim]}</Text>
          )}
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: STUDIO }, async ($, e) => {
    if (e.surface === 'mobile') {
      const { Text } = $.ui.resolve(e)
      return <Text dimColor>The buddy studio needs the terminal or desktop app.</Text>
    }
    const { Box, Text, Button, Input, Select } = $.ui.resolve(e)
    const d = await read($, draft)
    const list = await read($, roster)
    const current = await activeBuddy($)
    const personality = personalityOf({ name: cleanName(d.name) || 'Buddy', archetype: d.archetype, seed: d.seed })
    const greeting = ARCHETYPES[personality.archetype].lines.hello[0] ?? ''

    let preview
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      isStudioOnTerminal = true
      preview = (
        <Raster key="preview" columns={CANVAS_W} rows={CANVAS_H / 2} cells={rasterCells(d.kind, d.color, d.preview, tick)} />
      )
    } else {
      isStudioOnTerminal = false
      const { Svg } = $.ui.resolve(e)
      preview = (
        <Svg
          source={svgSource(d.kind, d.color, d.preview)}
          alt={`Preview of ${d.name || 'your buddy'}, ${ANIMS[d.preview].label.toLowerCase()}`}
          width={152}
          height={128}
          isInteractive
        />
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" alignItems="center">
          {preview}
          <Box flexDirection="column" marginLeft={2} flexShrink={1}>
            <Text bold color={d.color}>
              {cleanName(d.name) || 'Unnamed'}
            </Text>
            <Text>
              {personality.label}
              <Text dimColor>{d.archetype === 'auto' ? ' (from the name)' : ''}</Text>
            </Text>
            <Text dimColor>
              energy {dots(personality.energy)} · chatty {dots(personality.chattiness)}
            </Text>
            <Text dimColor wrap="wrap">
              {personality.traits.join(' · ')}
            </Text>
            <Text italic wrap="wrap">
              “{fill(greeting, { name: cleanName(d.name) || 'Buddy' })}”
            </Text>
          </Box>
        </Box>

        <Select
          key="kind"
          label="Type"
          options={KINDS}
          value={d.kind}
          autoFocus
          onSelect={(v: string) => isKind(v) && update($, draft, x => ({ ...x, kind: v }))}
        />
        <Select
          key="color"
          label="Colour"
          options={COLORS}
          value={d.color}
          onSelect={(v: string) => update($, draft, x => ({ ...x, color: v }))}
        />
        <Input
          key="name"
          label="Name"
          placeholder="Give it a name"
          value={d.name}
          submitLabel="save"
          onInput={(v: string) => update($, draft, x => ({ ...x, name: v.slice(0, MAX_NAME) }))}
          onSubmit={() => saveDraft($, false)}
        />
        <Box flexDirection="row" gap={2}>
          <Select
            key="archetype"
            label="Personality"
            options={[{ value: 'auto', label: 'Auto (from the name)' }, ...ARCHETYPE_NAMES.map(a => ({ value: a, label: ARCHETYPES[a].label }))]}
            value={d.archetype}
            onSelect={(v: string) =>
              update($, draft, x => ({ ...x, archetype: isArchetype(v) ? v : ('auto' as const) }))
            }
          />
          {d.archetype === 'auto' && (
            <Button key="reroll" label="Reroll" hotkey="p" onPress={() => update($, draft, x => ({ ...x, seed: x.seed + 1 }))} />
          )}
        </Box>
        <Select
          key="preview"
          label="Preview"
          options={ANIM_NAMES.map(a => ({ value: a, label: ANIMS[a].label }))}
          value={d.preview}
          onSelect={(v: string) => isAnim(v) && update($, draft, x => ({ ...x, preview: v }))}
        />

        <Box flexDirection="row" gap={2}>
          <Button key="save" label={current ? 'Save changes' : 'Save buddy'} hotkey="s" onPress={() => saveDraft($, false)} />
          {current && <Button key="new" label="Save as new" hotkey="n" onPress={() => saveDraft($, true)} />}
          <Button
            key="random"
            label="Surprise me"
            hotkey="r"
            onPress={() =>
              update($, draft, x => ({
                ...x,
                name: pick(NAMES),
                kind: pick(KINDS).value,
                color: pick(COLORS).value,
                archetype: 'auto' as const,
                seed: Math.floor(Math.random() * 1000),
              }))
            }
          />
        </Box>

        {list.length > 0 && (
          <Box flexDirection="column">
            <Text bold>Your buddies</Text>
            {list.map(b => (
              <Box key={`row-${b.id}`} flexDirection="row" gap={2}>
                <Text color={b.color}>
                  {b.id === current?.id ? '● ' : '  '}
                  {b.name}
                </Text>
                <Text dimColor>
                  {personalityOf(b).label.toLowerCase()} {b.kind}
                </Text>
                {b.id !== current?.id && <Button key={`use-${b.id}`} label="Use" onPress={() => useBuddy($, b)} />}
                <Button key={`del-${b.id}`} label="Delete" onPress={() => deleteBuddy($, b)} />
              </Box>
            ))}
          </Box>
        )}
      </Box>
    )
  })
}
