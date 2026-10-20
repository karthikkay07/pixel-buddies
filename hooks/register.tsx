import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { ActState, Anim, Archetype, Buddy, Draft, Journey, Mood, Run, Stats, StoryId, Style } from '../types'
import {
  CHAPTER_REWARDS,
  MILESTONES,
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
import { ACTS, DOING, WORK_PROP, actById, pickNext, restMs, walkClip, walkTarget } from './acts'
import { cardFileName, cardSvg } from './card'
import { birthdayAge, dayOf, seasonOf } from './seasons'
import type { SceneRef } from './scenery'
import {
  STORIES,
  bar,
  currentRun,
  fillStory,
  isFinished,
  nextChapter,
  pauseJourney,
  piecesBuilt,
  resumeJourney,
  runProgress,
  storyOf,
  suggestedStory,
  switchStory,
} from './story'
import { ANIMS, ANIM_NAMES, TICK_MS, clipOf, isAnim } from './animations'
import type { Clip } from './animations'
import { propFrames } from './props'
import {
  MAX_BUDDIES,
  MAX_NAME,
  cleanActiveId,
  cleanEarned,
  cleanName,
  cleanRoster,
  cleanStats,
  cleanJourneys,
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
const STORY = 'buddy-story'
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
const act = atom({ plugin: 'pixel-buddies', key: 'act' } as const, null)
const stats = atom({ plugin: 'pixel-buddies', key: 'stats' } as const, EMPTY_STATS)
const earned = atom({ plugin: 'pixel-buddies', key: 'earned' } as const, [])
const journeys = atom({ plugin: 'pixel-buddies', key: 'journeys' } as const, {})
const storyView = atom({ plugin: 'pixel-buddies', key: 'storyView' } as const, 'story')

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
/** Where the buddy stands on its stage, from the middle; it moves by walking. */
let homeX = 0
let recentActs: string[] = []
let nextActTimer: { cancel: () => void } | null = null
/** An act to do next instead of picking one (a birthday cake). */
let forcedAct: string | null = null

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)] ?? (list[0] as T)
}

function dots(n: number): string {
  return '●'.repeat(n) + '○'.repeat(5 - n)
}

/** A clip moved to where the buddy stands. */
function at(clip: Clip, x: number): Clip {
  if (x === 0) return clip
  return { ...clip, key: `${clip.key}@${x}`, pose: t => {
    const p = clip.pose(t)
    return { ...p, dx: p.dx + x }
  } }
}

/** Typing along while Claude works, with this personality's own prop. */
function workClip(archetype: Archetype): Clip {
  const typing = clipOf('typing')
  const kind = WORK_PROP[archetype]
  const frames = propFrames(kind)
  return {
    key: `work:${archetype}`,
    label: 'Working',
    length: typing.length * frames,
    pose: t => ({ ...typing.pose(t % typing.length), prop: { kind, frame: Math.floor(t / 2) % frames } }),
  }
}

/** Walking from one side to the other and back, for the studio preview. */
function patrolClip(): Clip {
  const there = walkClip(-6, 6)
  const back = walkClip(6, -6)
  return { key: 'patrol', label: 'Walk', length: there.length + back.length, pose: t => (t < there.length ? there.pose(t) : back.pose(t - there.length)) }
}

/** A studio preview: an animation, an act, a walk, or working. */
function previewClip(id: string, archetype: Archetype): Clip {
  if (isAnim(id)) return clipOf(id)
  if (id === 'walk') return patrolClip()
  if (id === 'work') return workClip(archetype)
  return actById(id) ?? clipOf('idle')
}

type Showing = { clip: Clip; since: number; status: string }

/** What the buddy plays now: a reaction, then working, sleeping, an act, and resting last. */
function showing(m: Mood, asleep: boolean, a: ActState | null, now: number, archetype: Archetype): Showing {
  if (m.anim && now < m.until) return { clip: at(clipOf(m.anim), homeX), since: m.since, status: STATUS[m.anim] }
  if (isWorking) return { clip: at(workClip(archetype), homeX), since: 0, status: STATUS.typing }
  if (asleep) return { clip: at(clipOf('sleeping'), homeX), since: 0, status: STATUS.sleeping }
  if (a && now < a.until) {
    if (a.id === 'walk') return { clip: walkClip(a.from, a.to), since: a.since, status: DOING.walk ?? STATUS.idle }
    const found = actById(a.id)
    if (found) return { clip: at(found, homeX), since: a.since, status: DOING[found.id] ?? STATUS.idle }
  }
  return { clip: at(clipOf('idle'), homeX), since: 0, status: STATUS.idle }
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
  // Now and then a thought is about the story's quest instead.
  if (event === 'thought' && r.line !== null && Math.random() < 0.3) {
    const cur = currentRun((await read($, journeys))[buddy.id])
    const chapter = cur ? storyOf(cur.id).chapters[cur.run.chapter] : undefined
    if (cur && chapter) {
      const q = runProgress(cur.id, cur.run, await read($, stats))
      r.line = fillStory(chapter.hint, buddy.name, q.need - q.value)
    }
  }
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

/**
 * Counts one of something, awards whatever it completes, and moves the story
 * on. `quiet` records the awards without a toast of their own, for the story
 * to announce with its own.
 */
async function count($: EngineInterface, stat: keyof Omit<Stats, 'lastDay'> | null, quiet = false): Promise<Achievement[]> {
  const now = await $.clock.now()
  const next = await update($, stats, s => bump(s, stat, now))
  isStatsDirty = true
  const fresh = newlyEarned(next, await read($, earned))
  if (fresh.length > 0) await award($, fresh, quiet)
  await advanceStory($)
  return fresh
}

/** What some awards unlocked, in words: "Spots pattern", "Space helmet". */
function rewardsOf(list: readonly Achievement[]): string {
  return list.flatMap(a => a.rewards.map(r => itemLabel(r, KINDS))).join(', ')
}

/** The scene behind a buddy: its current story's, as far as it has been rebuilt. */
function sceneOf(journey: Journey | undefined): SceneRef | null {
  const cur = currentRun(journey)
  return cur ? { story: cur.id, pieces: piecesBuilt(cur.id, cur.run.chapter) } : null
}

async function saveJourneys($: EngineInterface) {
  await $.store.set('journeys', await read($, journeys))
}

/** The active buddy and the story it is playing, if any. */
async function activeRun($: EngineInterface): Promise<{ buddy: Buddy; id: StoryId; run: Run } | null> {
  const buddy = await activeBuddy($)
  if (!buddy) return null
  const cur = currentRun((await read($, journeys))[buddy.id])
  return cur ? { buddy, ...cur } : null
}

async function setRun($: EngineInterface, buddyId: string, id: StoryId, run: Run) {
  await update($, journeys, all => {
    const j = all[buddyId] ?? { current: null, runs: {} }
    return { ...all, [buddyId]: { ...j, runs: { ...j.runs, [id]: run } } }
  })
}

/** Makes another buddy the active one: its story picks up, the old one's is set aside. */
async function switchActive($: EngineInterface, id: string | null) {
  const before = await read($, activeId)
  const st = await read($, stats)
  await update($, journeys, all => {
    const next = { ...all }
    const old = before ? next[before] : undefined
    if (before && old) next[before] = pauseJourney(old, st)
    const now = id ? next[id] : undefined
    if (id && now) next[id] = resumeJourney(now, st)
    return next
  })
  await update($, activeId, () => id)
  await saveJourneys($)
}

/** Starts (or goes back to) a story for the active buddy. */
async function pickStory($: EngineInterface, id: StoryId) {
  const buddy = await activeBuddy($)
  if (!buddy) return
  const st = await read($, stats)
  await update($, journeys, all => ({ ...all, [buddy.id]: switchStory(all[buddy.id] ?? { current: null, runs: {} }, id, st) }))
  await saveJourneys($)
  await update($, storyView, () => 'story')
  await tellChapter($)
}

/** Ends the chapter whose quest is done: the scene grows, the buddy celebrates, and the next chapter is told soon after. */
async function advanceStory($: EngineInterface) {
  const a = await activeRun($)
  if (!a) return
  const def = storyOf(a.id)
  const chapter = def.chapters[a.run.chapter]
  const st = await read($, stats)
  if (!chapter || !runProgress(a.id, a.run, st).isDone) return
  const next = nextChapter(a.run, st)
  await setRun($, a.buddy.id, a.id, next)
  await saveJourneys($)
  const unlocked = await count($, 'chaptersDone', true)
  if (!(await read($, isHidden))) {
    await show($, 'celebrate', 4500, level === 'silent' ? null : fillStory(chapter.ending, a.buddy.name), false)
  }
  if (isFinished(a.id, next)) {
    const trophy = await count($, def.finishStat, true)
    const won = [...unlocked, ...trophy]
    const shelf = trophy[0] ? ` 🏆 ${trophy[0].title}` : ''
    $.ui.toast(
      `${def.emoji} You and ${a.buddy.name} finished ${def.title}!${shelf}${won.length > 0 ? ` · unlocked: ${rewardsOf(won)}` : ''}. Pick your next adventure in /buddy story.`,
      { timeoutMs: 12_000 },
    )
  } else {
    $.ui.toast(
      `${def.emoji} ${def.title}, chapter ${a.run.chapter + 1} complete: ${chapter.title}.${chapter.piece ? ` ${chapter.piece} rebuilt!` : ''}${unlocked.length > 0 ? ` 🎁 ${rewardsOf(unlocked)} unlocked!` : ''} /buddy story`,
      { timeoutMs: 9000 },
    )
    $.clock.after(12_000, () => void tellChapter($))
  }
}

/** Announces the active buddy's chapter once it has begun; or, with no story yet, suggests picking one (once a day). */
async function tellChapter($: EngineInterface) {
  const buddy = await activeBuddy($)
  if (!buddy) return
  const a = await activeRun($)
  if (!a) {
    const today = dayOf(await $.clock.now())
    if ((await $.store.get('pickNudge')) === `${buddy.id}:${today}`) return
    await $.store.set('pickNudge', `${buddy.id}:${today}`)
    $.ui.toast(`📖 Choose an adventure for ${buddy.name}: /buddy story`, { timeoutMs: 9000 })
    return
  }
  const def = storyOf(a.id)
  const chapter = def.chapters[a.run.chapter]
  if (!chapter || a.run.isTold) return
  await setRun($, a.buddy.id, a.id, { ...a.run, isTold: true })
  await saveJourneys($)
  $.ui.toast(`${def.emoji} ${def.title}, chapter ${a.run.chapter + 1}: ${chapter.title}. Quest: ${chapter.quest.goal}. /buddy story`, { timeoutMs: 9000 })
}

/** A birthday, once on the day: a toast, a happy hop, and cake next. */
async function celebrateBirthday($: EngineInterface) {
  const buddy = await activeBuddy($)
  if (!buddy) return
  const now = await $.clock.now()
  const age = birthdayAge(buddy.born, now)
  const today = dayOf(now)
  if (age === 0 || (await $.store.get('birthdayShown')) === `${buddy.id}:${today}`) return
  await $.store.set('birthdayShown', `${buddy.id}:${today}`)
  $.ui.toast(`🎂 It's ${buddy.name}'s birthday! ${age} year${age === 1 ? '' : 's'} together today.`, { timeoutMs: 9000 })
  forcedAct = 'cake'
  await show($, 'happy', 3000, level === 'silent' ? null : `It's my birthday! I'm ${age} today!`, false)
}

async function award($: EngineInterface, list: readonly Achievement[], quiet = false) {
  await update($, earned, e => [...e, ...list.map(a => a.id)])
  isStatsDirty = true
  await flushStats($)
  if (quiet) return
  for (const a of list) {
    const rewards = a.rewards.map(r => itemLabel(r, KINDS)).join(' and ')
    $.ui.toast(
      a.kind === 'milestone' ? `🏆 ${a.title}: ${rewards} unlocked! Try it in /buddy` : `🎁 Story reward: ${rewards} unlocked! Try it in /buddy`,
      { timeoutMs: 8000 },
    )
  }
  const last = list[list.length - 1]
  if (last && last.kind === 'milestone' && (await activeBuddy($)) && !(await read($, isHidden))) {
    const rewards = last.rewards.map(r => itemLabel(r, KINDS)).join(' and ')
    // A silent buddy celebrates without a word; the toast says what was earned.
    await show($, 'celebrate', 4000, level === 'silent' ? null : `We earned “${last.title}”! ${rewards} unlocked!`, false)
  }
}

/** Waits a while (longer for a calm buddy), then does something. */
async function scheduleAct($: EngineInterface, ms?: number) {
  nextActTimer?.cancel()
  const buddy = await activeBuddy($)
  const wait = ms ?? restMs(buddy ? personalityOf(buddy).energy : 3)
  nextActTimer = $.clock.after(wait, () => void startAct($))
}

/** Starts the next act or walk, if the buddy is free to; otherwise tries again soon. */
async function startAct($: EngineInterface) {
  const buddy = await activeBuddy($)
  const now = await $.clock.now()
  const m = await read($, mood)
  const isBusy = !buddy || isWorking || (m.anim !== null && now < m.until) || (await read($, isHidden)) || (await read($, isAsleep))
  if (!buddy || isBusy) {
    await scheduleAct($, 5000)
    return
  }
  const p = personalityOf(buddy)
  const forced = forcedAct ? actById(forcedAct) : undefined
  forcedAct = null
  const next = forced
    ? { kind: 'act' as const, act: forced }
    : pickNext(
        p.archetype,
        p.energy,
        {
          hour: new Date(now).getHours(),
          sinceErrorMs: now - lastErrorAt,
          kind: buddy.kind,
          season: seasonOf(now),
          isBirthday: birthdayAge(buddy.born, now) > 0,
        },
        recentActs,
      )
  let state: ActState
  if (next.kind === 'walk') {
    const to = walkTarget(homeX)
    const clip = walkClip(homeX, to)
    state = { id: 'walk', since: tick, until: now + clip.length * TICK_MS, from: homeX, to }
  } else {
    state = { id: next.act.id, since: tick, until: now + next.act.length * TICK_MS, from: homeX, to: homeX }
  }
  recentActs = [...recentActs, state.id].slice(-4)
  await update($, act, () => state)
  $.clock.after(state.until - now + 20, () => void endAct($, state))
}

async function endAct($: EngineInterface, done: ActState) {
  const current = await read($, act)
  if (current !== null && current.since === done.since && current.id === done.id) {
    homeX = done.to
    await update($, act, () => null)
  }
  await scheduleAct($)
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
      const now2 = showing(m, await read($, isAsleep), await read($, act), now, personalityOf(buddy).archetype)
      const scene = sceneOf((await read($, journeys))[buddy.id])
      const shown = await $.ui.blit({ requestId: bandSite, key: 'band-sprite', cells: rasterCells(buddy, now2.clip, tick - now2.since, scene) })
      // Not mounted any more: stop painting until the band draws it again.
      if (shown.deny) bandSite = null
    }
  }
  if (isStudioOnTerminal) {
    const d = await read($, draft)
    const archetype = personalityOf({ name: cleanName(d.name) || 'Buddy', archetype: d.archetype, seed: d.seed }).archetype
    const shown = await $.ui.blit({ requestId: STUDIO, key: 'preview', cells: rasterCells(d, previewClip(d.preview, archetype), tick) })
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
  const today = dayOf(await $.clock.now())
  const saved = cleanRoster(await $.store.get('roster'), today)
  const savedActive = cleanActiveId(await $.store.get('activeId'), saved)
  const savedHidden = (await $.store.get('isHidden')) === true
  const savedStats = cleanStats(await $.store.get('stats'), saved)
  const savedEarned = cleanEarned(await $.store.get('earned'))
  await update($, roster, () => saved)
  await update($, activeId, () => savedActive)
  await update($, isHidden, () => savedHidden)
  await update($, stats, () => savedStats)
  await update($, earned, () => savedEarned)
  // Only the active buddy's story counts what happens; every other one waits.
  const loaded = cleanJourneys(await $.store.get('journeys'), saved)
  for (const b of saved) {
    const j = loaded[b.id]
    if (j) loaded[b.id] = b.id === savedActive ? resumeJourney(j, savedStats) : pauseJourney(j, savedStats)
  }
  await update($, journeys, () => loaded)
  // Buddies from before 0.5 now have a birthday; keep it.
  await persist($)
  await saveJourneys($)
  lastActivity = await $.clock.now()

  await $.command.register({
    name: 'buddy',
    description: 'Pixel Buddies: open the studio, or /buddy story | card | poke | achievements | hide | show',
  })

  $.clock.every(TICK_MS, () => void paint($))
  $.clock.every(BRAIN_EVERY_MS, () => void brain($))
  await scheduleAct($, 4000)
  $.clock.after(6000, () => void tellChapter($))
}

async function openStudio($: EngineInterface) {
  const current = await activeBuddy($)
  const next: Draft = current
    ? { name: current.name, kind: current.kind, color: current.color, archetype: current.archetype, seed: current.seed, style: current.style, preview: 'idle' }
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
  const born = !isAdding && current ? current.born : dayOf(await $.clock.now())
  const buddy: Buddy = { id, name, kind: d.kind, color: d.color, archetype: d.archetype, seed: d.seed, style: d.style, born }
  await update($, roster, list =>
    list.some(b => b.id === id) ? list.map(b => (b.id === id ? buddy : b)) : [...list, buddy],
  )
  await switchActive($, id)
  await update($, isHidden, () => false)
  await update($, isAsleep, () => false)
  await persist($)
  $.ui.toast(`${name} the ${personalityOf(buddy).label.toLowerCase()} ${d.kind} is ready.`)
  await trigger($, 'hello')
  if (isAdding) await count($, 'buddiesMade')
}

async function useBuddy($: EngineInterface, b: Buddy) {
  await switchActive($, b.id)
  await update($, draft, d => ({ ...d, name: b.name, kind: b.kind, color: b.color, archetype: b.archetype, seed: b.seed, style: b.style }))
  await update($, mood, () => REST)
  await persist($)
  await trigger($, 'hello')
}

async function deleteBuddy($: EngineInterface, b: Buddy) {
  const current = await activeBuddy($)
  await update($, roster, all => all.filter(x => x.id !== b.id))
  if (b.id === current?.id) {
    const rest = await read($, roster)
    await switchActive($, rest[0]?.id ?? null)
    await update($, mood, () => REST)
  }
  // Its adventures go with it.
  await update($, journeys, all => {
    const next = { ...all }
    delete next[b.id]
    return next
  })
  await saveJourneys($)
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
  const shelf = MILESTONES.map(a => {
    const p = progress(s, a)
    const rewards = a.rewards.map(r => itemLabel(r, KINDS)).join(', ')
    return e.includes(a.id) ? `🏆 ${a.title}: ${rewards}` : `🔒 ${a.title} (${p.value}/${a.target}): ${a.goal}, unlocks ${rewards}`
  })
  const story = CHAPTER_REWARDS.map(a => {
    const rewards = a.rewards.map(r => itemLabel(r, KINDS)).join(', ')
    return `${e.includes(a.id) ? '🎁' : '🔒'} ${a.target} chapter${a.target === 1 ? '' : 's'}: ${rewards}`
  })
  return [
    `Achievements: ${MILESTONES.filter(a => e.includes(a.id)).length}/${MILESTONES.length}`,
    ...shelf,
    '',
    `Story rewards (${s.chaptersDone} chapter${s.chaptersDone === 1 ? '' : 's'} finished):`,
    ...story,
  ].join('\n')
}

export const register: Register = (on, options) => {
  level = CHATTINESS.includes(options.chattiness as Chattiness) ? (options.chattiness as Chattiness) : 'normal'
  const minutes = Number(options.sleepAfterMinutes)
  sleepAfterMs = Number.isFinite(minutes) && minutes > 0 ? minutes * 60_000 : 0

  on('session.start', async ($, e, next) => {
    await start($)
    await count($, 'sessions')
    await trigger($, 'hello')
    await celebrateBirthday($)
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
    if (arg === 'story' || arg === 'stories') {
      const buddy = await activeBuddy($)
      if (!buddy) return { text: 'No buddy yet. /buddy makes one.' }
      const playing = await activeRun($)
      await update($, storyView, () => (playing ? 'story' : 'picker'))
      await $.ui.open({ id: STORY, title: 'Stories', focus: true, closeOnEscape: true })
      return { text: playing ? `${storyOf(playing.id).title} opened.` : `Choose an adventure for ${buddy.name}.` }
    }
    if (arg === 'card') {
      const buddy = await activeBuddy($)
      if (!buddy) return { text: 'No buddy yet. /buddy makes one.' }
      const file = cardFileName(buddy.name)
      const svg = cardSvg(buddy, await read($, stats), await read($, earned), (await read($, journeys))[buddy.id], dayOf(await $.clock.now()))
      try {
        await $.fs.write(file, svg)
      } catch (err) {
        return { text: `Couldn't save the card: ${err instanceof Error ? err.message : String(err)}` }
      }
      // Where it landed, in full when the working folder can be read.
      const cwd = await $.session.cwd().catch(() => '')
      const sep = cwd.includes('\\') ? '\\' : '/'
      const where = cwd ? `${cwd}${sep}${file}` : file
      return { text: `Saved ${buddy.name}'s card to ${where}\nShow it off in a README with: ![${buddy.name}](${file})` }
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
    const personality = personalityOf(buddy)
    const show = showing(m, await read($, isAsleep), await read($, act), now, personality.archetype)
    const scene = sceneOf((await read($, journeys))[buddy.id])
    const line = m.line !== null && now < m.lineUntil ? m.line : null

    let sprite
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      bandSite = e.requestId
      sprite = (
        <Raster
          key="band-sprite"
          columns={CANVAS_W}
          rows={CANVAS_H / 2}
          cells={rasterCells(buddy, show.clip, tick - show.since, scene)}
        />
      )
    } else {
      bandSite = null
      const { Svg } = $.ui.resolve(e)
      sprite = (
        <Svg
          source={svgSource(buddy, show.clip, 'f', scene)}
          alt={`${buddy.name} the ${buddy.kind}, ${show.status.replace(/^is /, '')}`}
          width={160}
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
            <Text dimColor>{show.status}</Text>
          )}
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: STORY }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const buddy = await activeBuddy($)
    if (!buddy) return <Text dimColor>Make a buddy first: /buddy</Text>
    const journey = (await read($, journeys))[buddy.id]
    const cur = currentRun(journey)
    const st = await read($, stats)
    const archetype = personalityOf(buddy).archetype

    if ((await read($, storyView)) === 'picker' || !cur) {
      const suggested = suggestedStory(archetype)
      return (
        <Box flexDirection="column" gap={1}>
          <Text bold>📖 Choose an adventure for {buddy.name}</Text>
          <Text dimColor wrap="wrap">
            Each story has 8 chapters with quests from your real work, and builds its own scene on {buddy.name}'s stage. Progress is kept for every story you start.
          </Text>
          {STORIES.map(def => {
            const run = journey?.runs[def.id]
            const state = !run ? 'Not started' : isFinished(def.id, run) ? '✓ Complete' : `Chapter ${run.chapter + 1} of ${def.chapters.length}`
            const isPlaying = cur?.id === def.id
            return (
              <Box key={`story-${def.id}`} flexDirection="column">
                <Text>
                  <Text bold>
                    {def.emoji} {def.title}
                  </Text>
                  <Text dimColor>
                    {' '}
                    · {state}
                    {def.id === suggested ? ` · ✨ suits ${buddy.name}` : ''}
                  </Text>
                </Text>
                <Text dimColor wrap="wrap">
                  {def.teaser}
                </Text>
                <Button key={`pick-${def.id}`} label={isPlaying ? 'Playing' : run ? 'Continue' : 'Start'} onPress={() => pickStory($, def.id)} />
              </Box>
            )
          })}
          {cur && <Button key="back" label="Back to the story" onPress={() => update($, storyView, () => 'story')} />}
        </Box>
      )
    }

    const def = storyOf(cur.id)
    const chapter = def.chapters[cur.run.chapter]
    const q = runProgress(cur.id, cur.run, st)
    const scene = sceneOf(journey)
    const built = def.chapters.slice(0, cur.run.chapter).flatMap(c => (c.piece ? [c.piece] : []))

    let stage = null
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      stage = <Raster key="story-stage" columns={CANVAS_W} rows={CANVAS_H / 2} cells={rasterCells(buddy, clipOf('idle'), 0, scene)} />
    } else {
      const { Svg } = $.ui.resolve(e)
      stage = <Svg source={svgSource(buddy, clipOf('idle'), 's', scene)} alt={`${buddy.name} in ${def.title}`} width={320} height={144} isInteractive />
    }

    return (
      <Box flexDirection="column" gap={1}>
        {stage}
        <Text bold>
          {def.emoji} {def.title}
        </Text>
        {chapter ? (
          <Box flexDirection="column">
            <Text bold color={buddy.color}>
              Chapter {cur.run.chapter + 1} of {def.chapters.length}: {chapter.title}
            </Text>
            <Text wrap="wrap">{fillStory(chapter.opening, buddy.name)}</Text>
            <Text> </Text>
            <Text>Quest: {chapter.quest.goal}</Text>
            <Text color="success">{bar(q.value, q.need)}</Text>
          </Box>
        ) : (
          <Text wrap="wrap">Story complete! {buddy.name} keeps this scene. Choose another adventure whenever you like.</Text>
        )}
        <Text dimColor>Rebuilt so far: {built.length > 0 ? built.join(', ') : 'nothing yet: finish the first quest'}</Text>
        {cur.run.chapter > 0 && (
          <Box flexDirection="column">
            <Text bold>So far</Text>
            {def.chapters.slice(0, cur.run.chapter).map((c, i) => (
              <Text key={`ch-${i}`} dimColor wrap="wrap">
                {i + 1}. {c.title}: {fillStory(c.ending, buddy.name)}
              </Text>
            ))}
          </Box>
        )}
        <Button key="switch" label="Choose another adventure" hotkey="c" onPress={() => update($, storyView, () => 'picker')} />
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
      preview = (
        <Raster key="preview" columns={CANVAS_W} rows={CANVAS_H / 2} cells={rasterCells(d, previewClip(d.preview, personality.archetype), tick)} />
      )
    } else {
      isStudioOnTerminal = false
      const { Svg } = $.ui.resolve(e)
      preview = (
        <Svg
          source={svgSource(d, previewClip(d.preview, personality.archetype))}
          alt={`Preview of ${d.name || 'your buddy'}, ${previewClip(d.preview, personality.archetype).label.toLowerCase()}`}
          width={320}
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
          options={[
            ...ANIM_NAMES.map(a => ({ value: a, label: ANIMS[a].label })),
            { value: 'work', label: 'Working' },
            { value: 'walk', label: 'Walk' },
            ...ACTS.filter(a => !a.who || a.who.includes(personality.archetype)).map(a => ({ value: a.id, label: a.label })),
          ]}
          value={d.preview}
          onSelect={(v: string) => update($, draft, x => ({ ...x, preview: v }))}
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
            Story rewards{' '}
            <Text dimColor>
              {CHAPTER_REWARDS.filter(a => got.includes(a.id)).length}/{CHAPTER_REWARDS.length} · {s.chaptersDone} chapter
              {s.chaptersDone === 1 ? '' : 's'} finished
            </Text>
          </Text>
          {(() => {
            const nextReward = CHAPTER_REWARDS.find(a => !got.includes(a.id))
            return nextReward ? (
              <Text dimColor>
                Next: {nextReward.rewards.map(r => itemLabel(r, KINDS)).join(', ')} at {nextReward.target} chapters. Play a story: /buddy story
              </Text>
            ) : (
              <Text dimColor>Every story reward unlocked!</Text>
            )
          })()}
        </Box>

        <Box flexDirection="column">
          <Text bold>
            Achievements <Text dimColor>{MILESTONES.filter(a => got.includes(a.id)).length}/{MILESTONES.length}</Text>
          </Text>
          {MILESTONES.map(a => {
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
