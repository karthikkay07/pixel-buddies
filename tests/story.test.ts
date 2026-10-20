import { expect, test } from 'claude-code/testing'

import { ACTS, pickNext } from '../hooks/acts'
import { EMPTY_STATS } from '../hooks/achievements'
import { cardFileName, cardSvg, daysTogether } from '../hooks/card'
import { cleanStory } from '../hooks/data'
import { PIECE_COUNT, sceneGrid } from '../hooks/scenery'
import { birthdayAge, dayOf, seasonOf } from '../hooks/seasons'
import { CANVAS_H, CANVAS_W } from '../hooks/sprites'
import { DEFAULT_STYLE } from '../hooks/style'
import { CHAPTERS, bar, fillStory, isFinished, piecesBuilt, questProgress } from '../hooks/story'

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0).getTime()

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

test('every chapter has a quest, a hint and an ending, and every piece of home comes back once', async () => {
  expect(CHAPTERS.length).toBe(8)
  for (const c of CHAPTERS) {
    expect(c.title.length > 0 && c.opening.includes('{name}')).toBe(true)
    expect(c.quest.need > 0 && c.quest.stat in EMPTY_STATS).toBe(true)
    expect(c.hint.includes('{left}')).toBe(true)
    expect(c.ending.length > 0).toBe(true)
  }
  expect(CHAPTERS.filter(c => c.piece !== null).length).toBe(PIECE_COUNT)
  // The last chapter is the cliffhanger: it brings nothing back.
  expect(CHAPTERS[CHAPTERS.length - 1]?.piece).toBe(null)
})

test('a quest counts from where its chapter began', async () => {
  const start = { ...EMPTY_STATS, prompts: 10 }
  const story = { chapter: 0, start, isTold: true }
  expect(questProgress(story, { ...start, prompts: 12 })).toEqual({ value: 2, need: 5, isDone: false })
  expect(questProgress(story, { ...start, prompts: 40 })).toEqual({ value: 5, need: 5, isDone: true })
  expect(questProgress({ ...story, chapter: 99 }, start).isDone).toBe(false)
  expect(isFinished({ ...story, chapter: CHAPTERS.length })).toBe(true)
})

test('home grows with the chapters done', async () => {
  expect(piecesBuilt(0)).toBe(0)
  expect(piecesBuilt(1)).toBe(1)
  expect(piecesBuilt(7)).toBe(7)
  expect(piecesBuilt(8)).toBe(7)
  let before = ''
  for (let n = 0; n <= PIECE_COUNT; n++) {
    const grid = sceneGrid(n, CANVAS_W, CANVAS_H)
    expect(grid.length).toBe(CANVAS_H)
    expect(grid.every(row => row.length === CANVAS_W)).toBe(true)
    // Each piece changes the scene (a door is drawn on the walls, so not every piece adds pixels).
    const now = JSON.stringify(grid)
    expect(now !== before).toBe(true)
    before = now
  }
})

test('story text fills in the buddy and what is left, and a bar shows progress', async () => {
  expect(fillStory('{name} needs {left} more', 'Mochi', 3)).toBe('Mochi needs 3 more')
  expect(bar(3, 5)).toBe('██████░░░░ 3/5')
  expect(bar(0, 2)).toBe('░░░░░░░░░░ 0/2')
})

test('a stored story is checked like everything else', async () => {
  const stats = { ...EMPTY_STATS, prompts: 7 }
  expect(cleanStory(undefined, stats, 8)).toEqual({ chapter: 0, start: stats, isTold: false })
  expect(cleanStory({ chapter: 3, start: { prompts: 2 }, isTold: true }, stats, 8)).toEqual({ chapter: 3, start: { ...EMPTY_STATS, prompts: 2 }, isTold: true })
  expect(cleanStory({ chapter: 99 }, stats, 8).chapter).toBe(8)
  expect(cleanStory({ chapter: -2 }, stats, 8).chapter).toBe(0)
})

test('seasons come round each year', async () => {
  expect(seasonOf(at(2026, 10, 14))).toBe(null)
  expect(seasonOf(at(2026, 10, 15))).toBe('halloween')
  expect(seasonOf(at(2026, 10, 31))).toBe('halloween')
  expect(seasonOf(at(2026, 11, 2))).toBe('halloween')
  expect(seasonOf(at(2026, 11, 3))).toBe(null)
  expect(seasonOf(at(2026, 12, 1))).toBe('winter')
  expect(seasonOf(at(2027, 1, 6))).toBe('winter')
  expect(seasonOf(at(2027, 1, 7))).toBe(null)
})

test('a birthday is the same day in a later year', async () => {
  expect(birthdayAge('2026-10-20', at(2027, 10, 20))).toBe(1)
  expect(birthdayAge('2025-10-20', at(2027, 10, 20))).toBe(2)
  expect(birthdayAge('2026-10-20', at(2026, 10, 20))).toBe(0)
  expect(birthdayAge('2026-10-20', at(2027, 10, 21))).toBe(0)
  expect(birthdayAge('', at(2027, 10, 20))).toBe(0)
  expect(dayOf(at(2026, 3, 4))).toBe('2026-03-04')
})

test('quirks are for their type, seasonal acts for their season, cake for a birthday', async () => {
  const pick = (ctx: Parameters<typeof pickNext>[2]) => {
    const random = seeded(9)
    const ids = new Set<string>()
    for (let i = 0; i < 1500; i++) {
      const next = pickNext('nerd', 3, ctx, [], random)
      if (next.kind === 'act') ids.add(next.act.id)
    }
    return ids
  }
  const plain = pick({ hour: 14, sinceErrorMs: Infinity, kind: 'cat', season: null, isBirthday: false })
  expect(plain.has('groom') && plain.has('tail')).toBe(true)
  expect(plain.has('smoke') || plain.has('pumpkin') || plain.has('cake')).toBe(false)
  const spooky = pick({ hour: 14, sinceErrorMs: Infinity, kind: 'dragon', season: 'halloween', isBirthday: true })
  expect(spooky.has('smoke') && spooky.has('pumpkin') && spooky.has('cake')).toBe(true)
  expect(spooky.has('snow') || spooky.has('groom')).toBe(false)
  for (const a of ACTS.filter(x => x.kinds || x.season || x.birthday)) expect(a.length > 0).toBe(true)
})

test('a card is a self-contained SVG, safe whatever the name', async () => {
  const buddy = { id: 'a', name: 'Bolt <&> "Cap"', kind: 'dragon' as const, color: '#E86A9A', archetype: 'pirate' as const, seed: 0, style: DEFAULT_STYLE, born: '2026-10-01' }
  const svg = cardSvg(buddy, { ...EMPTY_STATS, prompts: 12, wins: 3 }, ['first-buddy'], { chapter: 2, start: EMPTY_STATS, isTold: true }, '2026-10-20')
  expect(svg.startsWith('<svg') && svg.endsWith('</svg>')).toBe(true)
  expect(svg.includes('Bolt &lt;&amp;&gt; &quot;Cap&quot;')).toBe(true)
  expect(svg.includes('<&>')).toBe(false)
  expect(svg.includes('Day 20 together')).toBe(true)
  expect(svg.includes('Chapter 3: Map fragments')).toBe(true)
  expect(svg.includes('1/19 achievements')).toBe(true)
  expect(cardFileName('Captain Bolt!')).toBe('pixel-buddy-captain-bolt.svg')
  expect(cardFileName('🦀')).toBe('pixel-buddy-buddy.svg')
  expect(daysTogether('2026-10-20', '2026-10-20')).toBe(1)
  expect(daysTogether('bad', '2026-10-20')).toBe(1)
})
