import type { Look, Stats } from '../types'
import { ACCESSORIES, EYE_STYLES, PATTERNS } from './style'

/**
 * Something a look can use that may need unlocking: `kind:cat`, `eyes:love`,
 * `pattern:spots`, `accessory:crown`, or `color:custom` for any colour outside
 * the presets.
 */
export type Item = `kind:${string}` | `eyes:${string}` | `pattern:${string}` | `accessory:${string}` | 'color:custom'

/** Free from the start; everything else is earned. */
export const FREE: ReadonlySet<Item> = new Set<Item>([
  'kind:crab',
  'kind:blob',
  'kind:robot',
  'kind:ghost',
  'eyes:classic',
  'pattern:plain',
  'accessory:none',
])

export type Achievement = {
  id: string
  title: string
  /** What to do, with the target filled in. */
  goal: string
  stat: keyof Omit<Stats, 'lastDay'>
  target: number
  rewards: readonly Item[]
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'first-buddy', title: 'Hello, friend', goal: 'Make your first buddy', stat: 'buddiesMade', target: 1, rewards: ['eyes:dots', 'pattern:belly'] },
  { id: 'chatterbox', title: 'Chatterbox', goal: 'Send 25 prompts', stat: 'prompts', target: 25, rewards: ['pattern:spots'] },
  { id: 'green-light', title: 'Green light', goal: 'Pass tests or a build 3 times', stat: 'wins', target: 3, rewards: ['accessory:party'] },
  { id: 'best-friends', title: 'Best friends', goal: 'Poke your buddy 10 times', stat: 'pokes', target: 10, rewards: ['eyes:love'] },
  { id: 'collector', title: 'Collector', goal: 'Make 3 buddies', stat: 'buddiesMade', target: 3, rewards: ['accessory:bow'] },
  { id: 'regular', title: 'Regular', goal: 'Use Claude Code on 3 different days', stat: 'days', target: 3, rewards: ['kind:cat'] },
  { id: 'cosy', title: 'Cosy', goal: 'Start 10 sessions', stat: 'sessions', target: 10, rewards: ['accessory:scarf'] },
  { id: 'bounce-back', title: 'Bounce back', goal: 'Survive 10 errors', stat: 'errors', target: 10, rewards: ['eyes:angry'] },
  { id: 'deep-thinker', title: 'Deep thinker', goal: 'Hear 15 random thoughts', stat: 'thoughts', target: 15, rewards: ['eyes:big'] },
  { id: 'hard-worker', title: 'Hard worker', goal: 'Watch Claude run 100 tools', stat: 'toolCalls', target: 100, rewards: ['accessory:headphones'] },
  { id: 'marathon', title: 'Marathon', goal: 'Finish 5 long jobs (45 s or more)', stat: 'longTurns', target: 5, rewards: ['pattern:stripes'] },
  { id: 'artist', title: 'Artist', goal: 'Use Claude Code on 5 different days', stat: 'days', target: 5, rewards: ['color:custom'] },
  { id: 'night-owl', title: 'Night owl', goal: 'Send 10 prompts between midnight and 5 am', stat: 'nightPrompts', target: 10, rewards: ['eyes:sleepy', 'accessory:beanie'] },
  { id: 'green-thumb', title: 'Green thumb', goal: 'Send 100 prompts', stat: 'prompts', target: 100, rewards: ['kind:cactus', 'accessory:flower'] },
  { id: 'devoted', title: 'Devoted', goal: 'Use Claude Code on 7 different days', stat: 'days', target: 7, rewards: ['kind:dragon', 'pattern:gradient'] },
  { id: 'champion', title: 'Champion', goal: 'Pass tests or a build 25 times', stat: 'wins', target: 25, rewards: ['accessory:crown'] },
  { id: 'cool-customer', title: 'Cool customer', goal: 'Watch Claude run 500 tools', stat: 'toolCalls', target: 500, rewards: ['accessory:shades'] },
]

export const EMPTY_STATS: Stats = {
  prompts: 0,
  toolCalls: 0,
  wins: 0,
  errors: 0,
  longTurns: 0,
  pokes: 0,
  thoughts: 0,
  sessions: 0,
  buddiesMade: 0,
  nightPrompts: 0,
  days: 0,
  lastDay: '',
}

export function progress(stats: Stats, a: Achievement): { value: number; isDone: boolean } {
  const value = Math.min(stats[a.stat], a.target)
  return { value, isDone: value >= a.target }
}

/** Achievements the stats have reached that are not yet in `earned`, in list order. */
export function newlyEarned(stats: Stats, earned: readonly string[]): Achievement[] {
  return ACHIEVEMENTS.filter(a => !earned.includes(a.id) && progress(stats, a).isDone)
}

export function unlockedItems(earned: readonly string[]): Set<Item> {
  const items = new Set<Item>(FREE)
  for (const a of ACHIEVEMENTS) if (earned.includes(a.id)) for (const r of a.rewards) items.add(r)
  return items
}

/** The achievement that unlocks an item; undefined for a free one. */
export function unlockedBy(item: Item): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.rewards.includes(item))
}

/** The items a look uses, for checking it against what is unlocked. */
export function itemsOf(look: Look, presetColors: readonly string[]): Item[] {
  const items: Item[] = [
    `kind:${look.kind}`,
    `eyes:${look.style.eyes}`,
    `pattern:${look.style.pattern}`,
    `accessory:${look.style.accessory}`,
  ]
  if (!presetColors.includes(look.color.toUpperCase())) items.push('color:custom')
  return items
}

/** A reward as a person reads it: "Crown", "Cat", "Love eyes", "Custom colour". */
export function itemLabel(item: Item, kindLabels: readonly { value: string; label: string }[]): string {
  if (item === 'color:custom') return 'Custom colour'
  const [group, value] = item.split(':') as [string, string]
  const find = (list: readonly { value: string; label: string }[]) => list.find(o => o.value === value)?.label ?? value
  if (group === 'kind') return find(kindLabels)
  if (group === 'eyes') return `${find(EYE_STYLES)} eyes`
  if (group === 'pattern') return `${find(PATTERNS)} pattern`
  return find(ACCESSORIES)
}

/** Today in local time as YYYY-MM-DD. */
export function dayOf(now: number): string {
  const d = new Date(now)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The stats after some activity at `now`: a new day counts once. */
export function bump(stats: Stats, stat: keyof Omit<Stats, 'lastDay'> | null, now: number): Stats {
  const today = dayOf(now)
  const next = { ...stats }
  if (stat) next[stat] = stats[stat] + 1
  if (today !== stats.lastDay) {
    next.days = stats.days + 1
    next.lastDay = today
  }
  return next
}

export function isNight(now: number): boolean {
  return new Date(now).getHours() < 5
}
