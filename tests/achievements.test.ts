import { expect, test } from 'claude-code/testing'

import {
  ACHIEVEMENTS,
  CHAPTER_REWARDS,
  EMPTY_STATS,
  LEGACY_REWARDS,
  MILESTONES,
  FREE,
  bump,
  dayOf,
  isNight,
  itemLabel,
  itemsOf,
  newlyEarned,
  progress,
  unlockedBy,
  unlockedItems,
} from '../hooks/achievements'
import type { Item } from '../hooks/achievements'
import { COLORS, KINDS, SPRITES } from '../hooks/sprites'
import { ACCESSORIES, DEFAULT_STYLE, EYE_STYLES, PATTERNS, accessoryDabs, anchorsOf } from '../hooks/style'

const ALL_ITEMS: Item[] = [
  ...KINDS.map(k => `kind:${k.value}` as Item),
  ...EYE_STYLES.map(e => `eyes:${e.value}` as Item),
  ...PATTERNS.map(p => `pattern:${p.value}` as Item),
  ...ACCESSORIES.map(a => `accessory:${a.value}` as Item),
  'color:custom',
]
const PRESETS = COLORS.map(c => c.value)

test('everything is either free or earned by exactly one achievement', async () => {
  for (const item of ALL_ITEMS) {
    const by = ACHIEVEMENTS.filter(a => a.rewards.includes(item))
    expect(FREE.has(item) ? by.length === 0 : by.length === 1).toBe(true)
  }
  // And every reward is something that exists.
  for (const a of ACHIEVEMENTS) for (const r of a.rewards) expect(ALL_ITEMS.includes(r)).toBe(true)
})

test('achievement ids are unique and every goal is reachable', async () => {
  expect(new Set(ACHIEVEMENTS.map(a => a.id)).size).toBe(ACHIEVEMENTS.length)
  for (const a of ACHIEVEMENTS) {
    expect(a.target > 0).toBe(true)
    expect(a.stat in EMPTY_STATS).toBe(true)
  }
})

test('a short shelf of milestones, and the wardrobe as story rewards', async () => {
  expect(MILESTONES.length).toBe(11)
  // Story rewards come in order, each a step further on.
  const targets = CHAPTER_REWARDS.map(a => a.target)
  expect(targets.every((t, i) => i === 0 || t > (targets[i - 1] ?? 0))).toBe(true)
  expect(CHAPTER_REWARDS.every(a => a.stat === 'chaptersDone')).toBe(true)
})

test('progress counts up to the target and no further', async () => {
  const week = ACHIEVEMENTS.find(a => a.id === 'week')!
  expect(progress({ ...EMPTY_STATS, days: 3 }, week)).toEqual({ value: 3, isDone: false })
  expect(progress({ ...EMPTY_STATS, days: 99 }, week)).toEqual({ value: 7, isDone: true })
})

test('only new achievements are earned, in list order', async () => {
  const stats = { ...EMPTY_STATS, nightPrompts: 10, chaptersDone: 3 }
  expect(newlyEarned(stats, []).map(a => a.id)).toEqual(['night-owl', 'chapters-1', 'chapters-2', 'chapters-3'])
  expect(newlyEarned(stats, ['night-owl', 'chapters-1']).map(a => a.id)).toEqual(['chapters-2', 'chapters-3'])
  expect(newlyEarned(EMPTY_STATS, [])).toEqual([])
})

test('earning unlocks the rewards, and what older versions unlocked stays unlocked', async () => {
  const items = unlockedItems(['chapters-18', 'week'])
  expect(items.has('accessory:crown')).toBe(true)
  expect(items.has('accessory:scarf')).toBe(true)
  expect(items.has('kind:crab')).toBe(true)
  expect(items.has('kind:dragon')).toBe(false)
  expect(unlockedBy('accessory:crown')?.id).toBe('chapters-18')
  expect(unlockedBy('kind:crab')).toBe(undefined)
  // Achievements from before 0.5 are no longer awarded, but keep their rewards.
  const old = unlockedItems(['best-friends', 'devoted'])
  expect(old.has('eyes:love') && old.has('kind:dragon') && old.has('pattern:gradient')).toBe(true)
  for (const id of Object.keys(LEGACY_REWARDS)) expect(ACHIEVEMENTS.some(a => a.id === id)).toBe(false)
})

test('a look lists what it uses, custom colours included', async () => {
  const look = { kind: 'dragon' as const, color: '#123456', style: { eyes: 'love' as const, pattern: 'plain' as const, accessory: 'crown' as const } }
  expect(itemsOf(look, PRESETS)).toEqual(['kind:dragon', 'eyes:love', 'pattern:plain', 'accessory:crown', 'color:custom'])
  expect(itemsOf({ ...look, color: '#f07858' }, PRESETS).includes('color:custom')).toBe(false)
  expect(itemLabel('accessory:party', KINDS)).toBe('Party hat')
  expect(itemLabel('eyes:big', KINDS)).toBe('Big & shiny eyes')
  expect(itemLabel('kind:cactus', KINDS)).toBe('Cactus')
  expect(itemLabel('color:custom', KINDS)).toBe('Custom colour')
})

test('days count once each, in local time', async () => {
  const morning = new Date(2026, 9, 19, 9, 0).getTime()
  const evening = new Date(2026, 9, 19, 21, 0).getTime()
  const tomorrow = new Date(2026, 9, 20, 1, 0).getTime()
  let s = bump(EMPTY_STATS, 'prompts', morning)
  s = bump(s, 'prompts', evening)
  expect(s.days).toBe(1)
  expect(s.prompts).toBe(2)
  s = bump(s, null, tomorrow)
  expect(s.days).toBe(2)
  expect(s.lastDay).toBe(dayOf(tomorrow))
  expect(isNight(tomorrow)).toBe(true)
  expect(isNight(evening)).toBe(false)
})

test('every type has eyes, a mouth and room for a hat', async () => {
  for (const { value } of KINDS) {
    const a = anchorsOf(SPRITES[value])
    expect(a.left.length > 0 && a.right.length > 0).toBe(true)
    expect(a.mouthY > a.eyeTop).toBe(true)
    // Five rows above the sprite fit the tallest hat (the party hat, four rows).
    for (const acc of ACCESSORIES) {
      for (const d of accessoryDabs(acc.value, a)) {
        expect(d.y >= -5 && d.y < 12).toBe(true)
        expect(d.x >= -2 && d.x < 17).toBe(true)
      }
    }
  }
  expect(accessoryDabs('none', anchorsOf(SPRITES.crab))).toEqual([])
  expect(DEFAULT_STYLE).toEqual({ eyes: 'classic', pattern: 'plain', accessory: 'none' })
})
