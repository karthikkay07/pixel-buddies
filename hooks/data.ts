import type { Buddy, BuddyKind, Journey, Run, Stats, StoryId, Style } from '../types'
import { ACHIEVEMENTS, EMPTY_STATS, LEGACY_REWARDS } from './achievements'
import { isArchetype } from './personality'
import { STORY_IDS, storyOf } from './story'
import { KINDS } from './sprites'
import { DEFAULT_STYLE, isAccessory, isEyeStyle, isPattern } from './style'

const DAY = /^\d{4}-\d{2}-\d{2}$/

export const MAX_NAME = 24
export const MAX_BUDDIES = 50

export function isKind(value: unknown): value is BuddyKind {
  return KINDS.some(k => k.value === value)
}

export function isColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
}

/** A name as shown: trimmed, control characters dropped, at most MAX_NAME long. */
export function cleanName(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NAME)
    : ''
}

/**
 * The roster as the store holds it, kept only where it is whole: anything
 * hand-edited, corrupted or written by a future version is dropped, never drawn.
 */
export function cleanRoster(value: unknown, today = ''): Buddy[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: Buddy[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue
    const { id, name, kind, color, archetype, seed, style, born } = item as Record<string, unknown>
    const clean = cleanName(name)
    if (typeof id !== 'string' || id === '' || seen.has(id)) continue
    if (!clean || !isKind(kind) || !isColor(color)) continue
    seen.add(id)
    // Buddies saved by 0.1 have no personality fields: they read theirs from the name.
    out.push({
      id,
      name: clean,
      kind,
      color: color.toUpperCase(),
      archetype: isArchetype(archetype) ? archetype : 'auto',
      seed: cleanSeed(seed),
      style: cleanStyle(style),
      // Buddies from before 0.5 have no birthday: they count from today.
      born: typeof born === 'string' && DAY.test(born) ? born : today,
    })
    if (out.length === MAX_BUDDIES) break
  }
  return out
}

/** The saved active id, if it still names a buddy; else the first, or none. */
export function cleanActiveId(value: unknown, roster: readonly Buddy[]): string | null {
  return roster.some(b => b.id === value) ? (value as string) : (roster[0]?.id ?? null)
}

export function cleanSeed(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 1_000_000 ? value : 0
}

/** A buddy's style, each part falling back to the default on its own. */
export function cleanStyle(value: unknown): Style {
  const v = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  return {
    eyes: isEyeStyle(v.eyes) ? v.eyes : DEFAULT_STYLE.eyes,
    pattern: isPattern(v.pattern) ? v.pattern : DEFAULT_STYLE.pattern,
    accessory: isAccessory(v.accessory) ? v.accessory : DEFAULT_STYLE.accessory,
  }
}

/**
 * Stats as stored: each count a whole number, or zero. With nothing stored
 * yet, the buddies already made count, so nobody who made one before 0.3 has
 * to do it again.
 */
export function cleanStats(value: unknown, roster: readonly Buddy[]): Stats {
  if (typeof value !== 'object' || value === null) return { ...EMPTY_STATS, buddiesMade: roster.length }
  const v = value as Record<string, unknown>
  const out: Stats = { ...EMPTY_STATS }
  for (const key of Object.keys(EMPTY_STATS) as (keyof Stats)[]) {
    if (key === 'lastDay') {
      out.lastDay = typeof v.lastDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.lastDay) ? v.lastDay : ''
    } else {
      const n = v[key]
      out[key] = typeof n === 'number' && Number.isInteger(n) && n >= 0 ? Math.min(n, 1e9) : 0
    }
  }
  return out
}

/** Earned achievement ids: known ones only, each once. */
export function cleanEarned(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  // Ids from before 0.5 stay, so what they unlocked stays unlocked.
  const known = new Set([...ACHIEVEMENTS.map(a => a.id), ...Object.keys(LEGACY_REWARDS)])
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && known.has(id)))]
}

function cleanRun(id: StoryId, value: unknown): Run | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  const chapters = storyOf(id).chapters.length
  const chapter = typeof v.chapter === 'number' && Number.isInteger(v.chapter) && v.chapter >= 0 ? Math.min(v.chapter, chapters) : 0
  const banked = typeof v.banked === 'number' && Number.isInteger(v.banked) && v.banked >= 0 ? Math.min(v.banked, 1e6) : 0
  const from = typeof v.from === 'object' && v.from !== null ? cleanStats(v.from, []) : null
  return { chapter, banked, from, isTold: v.isTold === true }
}

/**
 * Every buddy's adventures as stored, by buddy id, for the buddies still in
 * the roster: known stories only, each run within its story. A story being
 * played always has a run.
 */
export function cleanJourneys(value: unknown, roster: readonly Buddy[]): Record<string, Journey> {
  const out: Record<string, Journey> = {}
  const v = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  for (const buddy of roster) {
    const j = typeof v[buddy.id] === 'object' && v[buddy.id] !== null ? (v[buddy.id] as Record<string, unknown>) : {}
    const rawRuns = typeof j.runs === 'object' && j.runs !== null ? (j.runs as Record<string, unknown>) : {}
    const runs: Partial<Record<StoryId, Run>> = {}
    for (const id of STORY_IDS) {
      const run = cleanRun(id, rawRuns[id])
      if (run) runs[id] = run
    }
    const current = typeof j.current === 'string' && STORY_IDS.includes(j.current as StoryId) && runs[j.current as StoryId] ? (j.current as StoryId) : null
    out[buddy.id] = { current, runs }
  }
  return out
}
