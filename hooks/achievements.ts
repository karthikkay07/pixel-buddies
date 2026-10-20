import type { Look, Stats } from '../types'
import { seasonOf } from './seasons'
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
  /**
   * A milestone is a trophy on the shelf; a chapter reward is a piece of the
   * wardrobe that comes with finishing story chapters (any story, any buddy).
   */
  kind: 'milestone' | 'chapter'
}

const milestone = (id: string, title: string, goal: string, stat: Achievement['stat'], target: number, rewards: readonly Item[]): Achievement => ({
  id,
  title,
  goal,
  stat,
  target,
  rewards,
  kind: 'milestone',
})

const chapters = (n: number, rewards: readonly Item[]): Achievement => ({
  id: `chapters-${n}`,
  title: 'Story reward',
  goal: `Finish ${n} story chapter${n === 1 ? '' : 's'}`,
  stat: 'chaptersDone',
  target: n,
  rewards,
  kind: 'chapter',
})

export const ACHIEVEMENTS: readonly Achievement[] = [
  // The trophy shelf: real milestones.
  milestone('first-buddy', 'Hello, friend', 'Make your first buddy', 'buddiesMade', 1, ['eyes:dots', 'pattern:belly']),
  milestone('week', 'A week together', 'Use Claude Code on 7 different days', 'days', 7, ['accessory:scarf']),
  milestone('month', 'A month together', 'Use Claude Code on 30 different days', 'days', 30, ['color:custom']),
  milestone('night-owl', 'Night owl', 'Send 10 prompts between midnight and 5 am', 'nightPrompts', 10, ['eyes:sleepy', 'accessory:beanie']),
  milestone('spooky', 'Spooky season', 'Use Claude Code during Halloween (15 Oct to 2 Nov)', 'halloweenDays', 1, ['accessory:witch']),
  milestone('frosty', 'Frosty', 'Use Claude Code in winter (1 Dec to 6 Jan)', 'winterDays', 1, ['accessory:santa']),
  milestone('story-pixels', 'Home again', 'Finish The Lost Pixels', 'storyPixels', 1, ['accessory:star']),
  milestone('story-voyager', 'Liftoff!', 'Finish Star Voyager', 'storyVoyager', 1, ['accessory:astronaut']),
  milestone('story-king', 'Hero of the Realm', 'Finish The Bug King', 'storyKing', 1, ['accessory:knight']),
  milestone('story-garden', 'Green fingers', 'Finish Code Garden', 'storyGarden', 1, ['accessory:wreath']),
  milestone('story-repo', 'Treasure hunter', 'Finish The Sunken Repo', 'storyRepo', 1, ['accessory:tricorn']),
  // The wardrobe, a piece at a time as the stories go on.
  chapters(1, ['pattern:spots']),
  chapters(2, ['eyes:big']),
  chapters(3, ['accessory:party']),
  chapters(4, ['kind:cat']),
  chapters(6, ['pattern:stripes']),
  chapters(8, ['accessory:bow']),
  chapters(10, ['eyes:love']),
  chapters(12, ['kind:dragon']),
  chapters(14, ['eyes:angry']),
  chapters(16, ['pattern:gradient']),
  chapters(18, ['accessory:crown']),
  chapters(20, ['kind:cactus', 'accessory:flower']),
  chapters(24, ['accessory:headphones']),
  chapters(28, ['accessory:shades']),
]

export const MILESTONES = ACHIEVEMENTS.filter(a => a.kind === 'milestone')
export const CHAPTER_REWARDS = ACHIEVEMENTS.filter(a => a.kind === 'chapter')

/**
 * Achievements from before 0.5, no longer awarded: whoever earned one keeps
 * what it unlocked.
 */
export const LEGACY_REWARDS: Readonly<Record<string, readonly Item[]>> = {
  chatterbox: ['pattern:spots'],
  'green-light': ['accessory:party'],
  'best-friends': ['eyes:love'],
  collector: ['accessory:bow'],
  regular: ['kind:cat'],
  cosy: ['accessory:scarf'],
  'bounce-back': ['eyes:angry'],
  'deep-thinker': ['eyes:big'],
  'hard-worker': ['accessory:headphones'],
  marathon: ['pattern:stripes'],
  artist: ['color:custom'],
  'green-thumb': ['kind:cactus', 'accessory:flower'],
  devoted: ['kind:dragon', 'pattern:gradient'],
  champion: ['accessory:crown'],
  'cool-customer': ['accessory:shades'],
}

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
  halloweenDays: 0,
  winterDays: 0,
  storyPixels: 0,
  storyVoyager: 0,
  storyKing: 0,
  storyGarden: 0,
  storyRepo: 0,
  chaptersDone: 0,
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
  for (const id of earned) for (const r of LEGACY_REWARDS[id] ?? []) items.add(r)
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
    // A new day in a season counts toward that season's achievement.
    const season = seasonOf(now)
    if (season === 'halloween') next.halloweenDays = stats.halloweenDays + 1
    if (season === 'winter') next.winterDays = stats.winterDays + 1
  }
  return next
}

export function isNight(now: number): boolean {
  return new Date(now).getHours() < 5
}
