import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Anim, Buddy, Draft, Mood, Stats, Style } from '../types'
import {
  ACHIEVEMENTS,
  EMPTY_STATS,
  bump,
  isNight,
  itemLabel,
  itemsOf,
  newlyEarned,
  progress,
  unlockedBy,
  unlockedItems,
} from './achievements'
import type { Achievement, Item } from './achievements'
import { ANIMS, ANIM_NAMES, TICK_MS, isAnim } from './animations'
import {
  MAX_BUDDIES,
  MAX_NAME,
  cleanActiveId,
  cleanEarned,
  cleanName,
  cleanRoster,
  cleanStats,
  isColor,
  isKind,
} from './data'
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
import { ACCESSORIES, DEFAULT_STYLE, EYE_STYLES, PATTERNS, isAccessory, isEyeStyle, isPattern } from './style'

const STUDIO = 'buddy-studio'
const BRAIN_EVERY_MS = 10_000
const LINE_MS = 7000
/** Least time between two small remarks, by chattiness; big moments skip it. */
const LINE_COOLDOWN_MS: Record<Chattiness, number> = { silent: Infinity, quiet: 90_000, normal: 25_000, chaotic: 6000 }
const BIG_MOMENTS: readonly BuddyEvent[] = ['hello', 'error', 'success', 'done', 'poke']
/** A turn this long counts as a big job when it finishes. */
const LONG_TURN_MS = 45_000
const PRESETS = COLORS.map(c => c.value)

const REST: Mood = { anim: null, until: 0, since: 0, line: null, lineUntil: 0, isThought: false }

const draft = atom({ plugin: 'pixel-buddies', key: 'draft' } as const, {
  name: '',
  kind: 'crab',
  color: '#F07858',
  archetype: 'auto',
  seed: 0,
  style: DEFAULT_STYLE,
  preview: 'idle',
})
const roster = atom({ plugin: 'pixel-buddies', key: 'roster' } as const, [])
const activeId = atom({ plugin: 'pixel-buddies', key: 'activeId' } as const, null)
const isHidden = atom({ plugin: 'pixel-buddies', key: 'isHidden' } as const, false)
const mood = atom({ plugin: 'pixel-buddies', key: 'mood' } as const, REST)
const isAsleep = atom({ plugin: 'pixel-buddies', key: 'isAsleep' } as const, false)
const stats = atom({ plugin: 'pixel-buddies', key: 'stats' } as const, EMPTY_STATS)
const earned = atom({ plugin: 'pixel-buddies', key: 'earned' } as const, [])

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
/** Stats changed since they were last written to the store. */
let isStatsDirty = false

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

function lockLabel(item: Item, unlocked: ReadonlySet<Item>, label: string): string {
  return unlocked.has(item) ? label : `🔒 ${label}`
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

async function flushStats($: EngineInterface) {
  if (!isStatsDirty) return
  isStatsDirty = false
  await $.store.set('stats', await read($, stats))
  await $.store.set('earned', await read($, earned))
}

/** Shows an animation and a line now, cleared again when they have run. */
async function show($: EngineInterface, anim: Anim | null, ms: number, line: string | null, isThought: boolean) {
  const now = await $.clock.now()
  if (line !== null) {
    lastLineAt = now
    recentLines = [...recentLines, line].slice(-12)
  }
  await update($, mood, m => ({
    anim: anim ?? m.anim,
    until: anim ? now + ms : m.until,
    since: anim ? tick : m.since,
    line: line ?? m.line,
    lineUntil: line !== null ? now + LINE_MS : m.lineUntil,
    isThought: line !== null ? isThought : m.isThought,
  }))
  $.clock.after(ms + 50, () => void expire($))
  if (line !== null) $.clock.after(LINE_MS + 50, () => void expire($))
}

/** Plays a reaction to an event: an animation, and a line if the buddy feels like talking. */
async function trigger($: EngineInterface, event: BuddyEvent, tool?: string) {
  const buddy = await activeBuddy($)
  if (!buddy || (await read($, isHidden))) return
  const now = await $.clock.now()
  const r = react(event, personalityOf(buddy), level, { name: buddy.name, tool, time: clockTime(now) }, recentLines)
  const isBig = BIG_MOMENTS.includes(event)
  const line = r.line !== null && (isBig || now - lastLineAt >= LINE_COOLDOWN_MS[level]) ? r.line : null
  if (!r.anim && line === null) return
  if (line !== null && r.isThought) await count($, 'thoughts')
  await show($, r.anim, r.ms, line, r.isThought)
}

async function expire($: EngineInterface) {
  const now = await $.clock.now()
  await update($, mood, m => ({
    ...m,
    anim: m.anim && now >= m.until ? null : m.anim,
    line: m.line && now >= m.lineUntil ? null : m.line,
  }))
}

/** Counts one of something toward the achievements, and awards any it completes. */
async function count($: EngineInterface, stat: keyof Omit<Stats, 'lastDay'> | null) {
  const now = await $.clock.now()
  const next = await update($, stats, s => bump(s, stat, now))
  isStatsDirty = true
  const fresh = newlyEarned(next, await read($, earned))
  if (fresh.length > 0) await award($, fresh)
}

async function award($: EngineInterface, list: readonly Achievement[]) {
  await update($, earned, e => [...e, ...list.map(a => a.id)])
  isStatsDirty = true
  await flushStats($)
  for (const a of list) {
    const rewards = a.rewards.map(r => itemLabel(r, KINDS)).join(' and ')
    $.ui.toast(`🏆 ${a.title}: ${rewards} unlocked! Try it in /buddy`, { timeoutMs: 8000 })
  }
  const last = list[list.length - 1]
  if (last && (await activeBuddy($)) && !(await read($, isHidden))) {
    const rewards = last.rewards.map(r => itemLabel(r, KINDS)).join(' and ')
    // A silent buddy celebrates without a word; the toast says what was earned.
    await show($, 'celebrate', 4000, level === 'silent' ? null : `We earned “${last.title}”! ${rewards} unlocked!`, false)
  }
}

/** Anything the person or Claude does: it keeps the buddy awake, or wakes it. */
async function activity($: EngineInterface) {
  lastActivity = await $.clock.now()
  if (await read($, isAsleep)) {
    await update($, isAsleep, () => false)
    await trigger($, 'wake')
  }
}

/** Every few seconds: save stats, doze off when idle long enough, or maybe think out loud. */
async function brain($: EngineInterface) {
  await flushStats($)
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
      const shown = await $.ui.blit({ requestId: bandSite, key: 'band-sprite', cells: rasterCells(buddy, anim, frame) })
      // Not mounted any more: stop painting until the band draws it again.
      if (shown.deny) bandSite = null
    }
  }
  if (isStudioOnTerminal) {
    const d = await read($, draft)
    const shown = await $.ui.blit({ requestId: STUDIO, key: 'preview', cells: rasterCells(d, d.preview, tick) })
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
  const savedStats = cleanStats(await $.store.get('stats'), saved)
  const savedEarned = cleanEarned(await $.store.get('earned'))
  await update($, roster, () => saved)
  await update($, activeId, () => savedActive)
  await update($, isHidden, () => savedHidden)
  await update($, stats, () => savedStats)
  await update($, earned, () => savedEarned)
  lastActivity = await $.clock.now()

  await $.command.register({
    name: 'buddy',
    description: 'Pixel Buddies: open the studio, or /buddy poke | achievements | hide | show',
  })

  $.clock.every(TICK_MS, () => void paint($))
  $.clock.every(BRAIN_EVERY_MS, () => void brain($))
}

async function openStudio($: EngineInterface) {
  const current = await activeBuddy($)
  const next: Draft = current
    ? { ...current, preview: 'idle' }
    : { name: pick(NAMES), kind: pick(KINDS.slice(0, 4)).value, color: pick(COLORS).value, archetype: 'auto', seed: 0, style: DEFAULT_STYLE, preview: 'idle' }
  await update($, draft, () => next)
  await $.ui.open({ id: STUDIO, title: 'Buddy studio', focus: true, closeOnEscape: true })
}

async function saveDraft($: EngineInterface, asNew: boolean) {
  const d = await read($, draft)
  // Locked things can be tried on in the studio, not kept.
  const unlocked = unlockedItems(await read($, earned))
  const locked = itemsOf(d, PRESETS).filter(i => !unlocked.has(i))
  const first = locked[0]
  if (first) {
    const by = unlockedBy(first)
    const p = by ? progress(await read($, stats), by) : null
    $.ui.toast(
      `🔒 ${itemLabel(first, KINDS)} is locked. ${by ? `${by.goal} to unlock it (${p?.value ?? 0}/${by.target}).` : ''}`.trim(),
      { timeoutMs: 8000 },
    )
    return
  }
  const name = cleanName(d.name) || pick(NAMES)
  const current = await activeBuddy($)
  const isAdding = asNew || !current
  if (isAdding && (await read($, roster)).length >= MAX_BUDDIES) {
    $.ui.toast(`You have ${MAX_BUDDIES} buddies already. Delete one to make room.`)
    return
  }
  const id = !isAdding && current ? current.id : `b${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
  const buddy: Buddy = { id, name, kind: d.kind, color: d.color, archetype: d.archetype, seed: d.seed, style: d.style }
  await update($, roster, list =>
    list.some(b => b.id === id) ? list.map(b => (b.id === id ? buddy : b)) : [...list, buddy],
  )
  await update($, activeId, () => id)
  await update($, isHidden, () => false)
  await update($, isAsleep, () => false)
  await persist($)
  $.ui.toast(`${name} the ${personalityOf(buddy).label.toLowerCase()} ${d.kind} is ready.`)
  await trigger($, 'hello')
  if (isAdding) await count($, 'buddiesMade')
}

async function useBuddy($: EngineInterface, b: Buddy) {
  await update($, activeId, () => b.id)
  await update($, draft, d => ({ ...d, ...b }))
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

async function setStyle($: EngineInterface, change: Partial<Style>) {
  await update($, draft, d => ({ ...d, style: { ...d.style, ...change } }))
}

async function surprise($: EngineInterface) {
  const unlocked = unlockedItems(await read($, earned))
  const open = <T extends string>(group: string, list: readonly { value: T }[]) =>
    list.filter(o => unlocked.has(`${group}:${o.value}` as Item)).map(o => o.value)
  await update($, draft, x => ({
    ...x,
    name: pick(NAMES),
    kind: pick(open('kind', KINDS)),
    color: pick(COLORS).value,
    archetype: 'auto' as const,
    seed: Math.floor(Math.random() * 1000),
    style: { eyes: pick(open('eyes', EYE_STYLES)), pattern: pick(open('pattern', PATTERNS)), accessory: pick(open('accessory', ACCESSORIES)) },
  }))
}

async function setCustomColor($: EngineInterface, text: string) {
  const hex = text.trim().startsWith('#') ? text.trim() : `#${text.trim()}`
  if (!isColor(hex)) {
    $.ui.toast('Use a colour like #FF8800.')
    return
  }
  await update($, draft, d => ({ ...d, color: hex.toUpperCase() }))
}

async function achievementsText($: EngineInterface): Promise<string> {
  const s = await read($, stats)
  const e = await read($, earned)
  const lines = ACHIEVEMENTS.map(a => {
    const p = progress(s, a)
    const rewards = a.rewards.map(r => itemLabel(r, KINDS)).join(', ')
    return e.includes(a.id) ? `🏆 ${a.title}: ${rewards}` : `🔒 ${a.title} (${p.value}/${a.target}): ${a.goal}, unlocks ${rewards}`
  })
  return [`Achievements: ${e.length}/${ACHIEVEMENTS.length}`, ...lines].join('\n')
}

export const register: Register = (on, options) => {
  level = CHATTINESS.includes(options.chattiness as Chattiness) ? (options.chattiness as Chattiness) : 'normal'
  const minutes = Number(options.sleepAfterMinutes)
  sleepAfterMs = Number.isFinite(minutes) && minutes > 0 ? minutes * 60_000 : 0

  on('session.start', async ($, e, next) => {
    await start($)
    await count($, 'sessions')
    await trigger($, 'hello')
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    try {
      await flushStats($)
    } catch {
      // Nothing to save it to; the next session counts on from what was saved.
    }
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
      await count($, 'pokes')
      return { text: `You poked ${buddy.name}.` }
    }
    if (arg === 'achievements' || arg === 'stats') {
      return { text: await achievementsText($) }
    }
    await openStudio($)
    return { text: 'Buddy studio opened.' }
  })

  on('prompt.submit', async ($, e, next) => {
    try {
      const now = await $.clock.now()
      turnStartedAt = now
      await activity($)
      await trigger($, 'prompt')
      await count($, 'prompts')
      if (isNight(now)) await count($, 'nightPrompts')
    } catch {
      // A buddy never gets in the way of a prompt.
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    try {
      await activity($)
      await trigger($, 'working', e.tool)
      await count($, 'toolCalls')
    } catch {
      // Nor of a tool call.
    }
    const ran = await next(e)
    try {
      if (!('deny' in ran && ran.deny)) {
        const kind = classifyToolResult(e.tool, ran.isError === true, ran.text)
        const now = await $.clock.now()
        if (kind === 'error') {
          await count($, 'errors')
          // One sad face per bad patch, not one per failing command.
          if (now - lastErrorAt > 20_000) {
            lastErrorAt = now
            await trigger($, 'error', e.tool)
          }
        } else if (kind === 'success') {
          await count($, 'wins')
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
      if (e.reason === 'answer' && turnStartedAt > 0 && now - turnStartedAt >= LONG_TURN_MS) {
        await trigger($, 'done')
        await count($, 'longTurns')
      }
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
          cells={rasterCells(buddy, anim, anim === m.anim ? tick - m.since : tick)}
        />
      )
    } else {
      bandSite = null
      const { Svg } = $.ui.resolve(e)
      sprite = (
        <Svg
          source={svgSource(buddy, anim)}
          alt={`${buddy.name} the ${buddy.kind}, ${ANIMS[anim].label.toLowerCase()}`}
          width={76}
          height={72}
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
    const s = await read($, stats)
    const got = await read($, earned)
    const unlocked = unlockedItems(got)
    const locked = itemsOf(d, PRESETS).filter(i => !unlocked.has(i))
    const personality = personalityOf({ name: cleanName(d.name) || 'Buddy', archetype: d.archetype, seed: d.seed })
    const greeting = ARCHETYPES[personality.archetype].lines.hello[0] ?? ''
    const isCustom = !PRESETS.includes(d.color)
    const colorOptions = [
      ...COLORS,
      ...(isCustom ? [{ value: d.color, label: lockLabel('color:custom', unlocked, `Custom ${d.color}`) }] : []),
    ]

    let preview
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      isStudioOnTerminal = true
      preview = <Raster key="preview" columns={CANVAS_W} rows={CANVAS_H / 2} cells={rasterCells(d, d.preview, tick)} />
    } else {
      isStudioOnTerminal = false
      const { Svg } = $.ui.resolve(e)
      preview = (
        <Svg
          source={svgSource(d, d.preview)}
          alt={`Preview of ${d.name || 'your buddy'}, ${ANIMS[d.preview].label.toLowerCase()}`}
          width={152}
          height={144}
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
            {locked.length > 0 && (
              <Text color="warning" wrap="wrap">
                🔒 Trying on {locked.map(i => itemLabel(i, KINDS)).join(', ')}. Earn {locked.length === 1 ? 'it' : 'them'} to save.
              </Text>
            )}
          </Box>
        </Box>

        <Select
          key="kind"
          label="Type"
          options={KINDS.map(k => ({ value: k.value, label: lockLabel(`kind:${k.value}`, unlocked, k.label) }))}
          value={d.kind}
          autoFocus
          onSelect={(v: string) => isKind(v) && update($, draft, x => ({ ...x, kind: v }))}
        />
        <Box flexDirection="row" gap={2}>
          <Select
            key="color"
            label="Colour"
            options={colorOptions}
            value={d.color}
            onSelect={(v: string) => update($, draft, x => ({ ...x, color: v }))}
          />
          <Input
            key="hex"
            label={lockLabel('color:custom', unlocked, 'Custom')}
            placeholder="#FF8800"
            submitLabel="apply"
            onSubmit={(v: string) => setCustomColor($, v)}
          />
        </Box>
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
            onSelect={(v: string) => update($, draft, x => ({ ...x, archetype: isArchetype(v) ? v : ('auto' as const) }))}
          />
          {d.archetype === 'auto' && (
            <Button key="reroll" label="Reroll" hotkey="p" onPress={() => update($, draft, x => ({ ...x, seed: x.seed + 1 }))} />
          )}
        </Box>
        <Box flexDirection="row" gap={2} flexWrap="wrap">
          <Select
            key="eyes"
            label="Eyes"
            options={EYE_STYLES.map(o => ({ value: o.value, label: lockLabel(`eyes:${o.value}`, unlocked, o.label) }))}
            value={d.style.eyes}
            onSelect={(v: string) => isEyeStyle(v) && setStyle($, { eyes: v })}
          />
          <Select
            key="pattern"
            label="Pattern"
            options={PATTERNS.map(o => ({ value: o.value, label: lockLabel(`pattern:${o.value}`, unlocked, o.label) }))}
            value={d.style.pattern}
            onSelect={(v: string) => isPattern(v) && setStyle($, { pattern: v })}
          />
          <Select
            key="accessory"
            label="Accessory"
            options={ACCESSORIES.map(o => ({ value: o.value, label: lockLabel(`accessory:${o.value}`, unlocked, o.label) }))}
            value={d.style.accessory}
            onSelect={(v: string) => isAccessory(v) && setStyle($, { accessory: v })}
          />
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
          <Button key="random" label="Surprise me" hotkey="r" onPress={() => surprise($)} />
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

        <Box flexDirection="column">
          <Text bold>
            Achievements <Text dimColor>{got.length}/{ACHIEVEMENTS.length}</Text>
          </Text>
          {ACHIEVEMENTS.map(a => {
            const p = progress(s, a)
            const rewards = a.rewards.map(r => itemLabel(r, KINDS)).join(', ')
            return got.includes(a.id) ? (
              <Text key={`ach-${a.id}`}>
                🏆 {a.title} <Text dimColor>· {rewards}</Text>
              </Text>
            ) : (
              <Text key={`ach-${a.id}`} dimColor>
                🔒 {a.title} {p.value}/{a.target} · {a.goal} → {rewards}
              </Text>
            )
          })}
        </Box>
      </Box>
    )
  })
}
