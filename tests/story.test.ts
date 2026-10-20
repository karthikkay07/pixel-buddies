import { expect, test } from 'claude-code/testing'

import { ACTS, pickNext } from '../hooks/acts'
import { ACHIEVEMENTS, EMPTY_STATS, MILESTONES } from '../hooks/achievements'
import { cardFileName, cardSvg, daysTogether } from '../hooks/card'
import { cleanJourneys } from '../hooks/data'
import { ARCHETYPE_NAMES } from '../hooks/personality'
import { pieceCount, sceneGrid } from '../hooks/scenery'
import { birthdayAge, dayOf, seasonOf } from '../hooks/seasons'
import { CANVAS_H, CANVAS_W } from '../hooks/sprites'
import { ACCESSORIES, DEFAULT_STYLE } from '../hooks/style'
import {
  STORIES,
  bar,
  currentRun,
  fillStory,
  isFinished,
  newRun,
  nextChapter,
  pauseJourney,
  pauseRun,
  piecesBuilt,
  resumeJourney,
  resumeRun,
  runProgress,
  storyOf,
  suggestedStory,
  switchStory,
} from '../hooks/story'

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0).getTime()

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

test('five stories of eight chapters, each with its scene, finale and reward', async () => {
  expect(STORIES.length).toBe(5)
  expect(new Set(STORIES.map(s => s.id)).size).toBe(5)
  for (const def of STORIES) {
    expect(def.chapters.length).toBe(8)
    for (const c of def.chapters) {
      expect(c.title.length > 0 && c.ending.length > 0).toBe(true)
      expect(c.opening.includes('{name}') || c.ending.includes('{name}')).toBe(true)
      expect(c.quest.need > 0 && c.quest.stat in EMPTY_STATS).toBe(true)
      expect(c.hint.includes('{left}')).toBe(true)
    }
    // Every piece of the scene comes back exactly once, and the finale brings none.
    expect(def.chapters.filter(c => c.piece !== null).length).toBe(pieceCount(def.id))
    expect(def.chapters[7]?.piece).toBe(null)
    // Finishing it earns an achievement whose reward is a real accessory.
    const ach = ACHIEVEMENTS.find(a => a.stat === def.finishStat)
    expect(ach !== undefined && ach.target === 1).toBe(true)
    const reward = ach?.rewards[0] ?? ''
    expect(ACCESSORIES.some(a => `accessory:${a.value}` === reward)).toBe(true)
  }
})

test('every personality gets a story suggested, fitting where it can', async () => {
  for (const a of ARCHETYPE_NAMES) expect(STORIES.some(s => s.id === suggestedStory(a))).toBe(true)
  expect(suggestedStory('pirate')).toBe('repo')
  expect(suggestedStory('nerd')).toBe('voyager')
  expect(suggestedStory('grump')).toBe('king')
  expect(suggestedStory('sleepy')).toBe('garden')
})

test('a quest counts while its story is played, and keeps its place while paused', async () => {
  const s0 = { ...EMPTY_STATS, prompts: 10 }
  let run = newRun(s0)
  expect(runProgress('pixels', run, { ...s0, prompts: 12 })).toEqual({ value: 2, need: 5, isDone: false })
  // Paused at 2: what happens meanwhile doesn't count…
  run = pauseRun('pixels', run, { ...s0, prompts: 12 })
  expect(run).toEqual({ chapter: 0, banked: 2, from: null, isTold: false })
  expect(runProgress('pixels', run, { ...s0, prompts: 40 }).value).toBe(2)
  // …and once resumed, it counts on from 2.
  run = resumeRun(run, { ...s0, prompts: 40 })
  expect(runProgress('pixels', run, { ...s0, prompts: 43 })).toEqual({ value: 5, need: 5, isDone: true })
  const next = nextChapter(run, { ...s0, prompts: 43 })
  expect(next.chapter).toBe(1)
  expect(runProgress('pixels', next, { ...s0, prompts: 43 }).value).toBe(0)
  expect(isFinished('pixels', { ...next, chapter: 8 })).toBe(true)
})

test('switching stories pauses one and picks up the other where it was left', async () => {
  const s0 = { ...EMPTY_STATS }
  let j = switchStory({ current: null, runs: {} }, 'voyager', s0)
  expect(currentRun(j)?.id).toBe('voyager')
  j = switchStory(j, 'king', { ...s0, prompts: 3 })
  expect(j.runs.voyager).toEqual({ chapter: 0, banked: 3, from: null, isTold: false })
  expect(j.runs.king?.from?.prompts).toBe(3)
  j = switchStory(j, 'voyager', { ...s0, prompts: 9 })
  const voyager = j.runs.voyager
  expect(voyager ? runProgress('voyager', voyager, { ...s0, prompts: 10 }).value : -1).toBe(4)
  // A whole journey pauses and resumes with its buddy.
  const paused = pauseJourney(j, { ...s0, prompts: 10 })
  expect(paused.runs.voyager?.from).toBe(null)
  expect(resumeJourney(paused, { ...s0, prompts: 20 }).runs.voyager?.from?.prompts).toBe(20)
})

test('every scene grows piece by piece and stays on the stage', async () => {
  for (const def of STORIES) {
    let before = ''
    for (let n = 0; n <= pieceCount(def.id); n++) {
      const grid = sceneGrid({ story: def.id, pieces: n }, CANVAS_W, CANVAS_H)
      expect(grid.length === CANVAS_H && grid.every(row => row.length === CANVAS_W)).toBe(true)
      const now = JSON.stringify(grid)
      expect(now !== before).toBe(true)
      before = now
    }
    expect(piecesBuilt(def.id, 8)).toBe(pieceCount(def.id))
  }
  expect(sceneGrid(null, CANVAS_W, CANVAS_H).flat().every(c => c === null)).toBe(true)
})

test('stored journeys are checked like everything else', async () => {
  const roster = [{ id: 'a' }, { id: 'b' }] as never
  const journeys = cleanJourneys(
    {
      a: { current: 'king', runs: { king: { chapter: 99, banked: 2, from: { prompts: 4 }, isTold: true }, atlantis: { chapter: 1 } } },
      b: { current: 'garden', runs: {} },
      gone: { current: 'pixels', runs: { pixels: { chapter: 1 } } },
    },
    roster,
  )
  expect(Object.keys(journeys)).toEqual(['a', 'b'])
  expect(journeys.a?.current).toBe('king')
  expect(journeys.a?.runs.king).toEqual({ chapter: 8, banked: 2, from: { ...EMPTY_STATS, prompts: 4 }, isTold: true })
  expect(Object.keys(journeys.a?.runs ?? {})).toEqual(['king'])
  // A story being played always has a run.
  expect(journeys.b).toEqual({ current: null, runs: {} })
  expect(cleanJourneys('junk', roster)).toEqual({ a: { current: null, runs: {} }, b: { current: null, runs: {} } })
})

test('story text fills in the buddy and what is left, and a bar shows progress', async () => {
  expect(fillStory('{name} needs {left} more', 'Mochi', 3)).toBe('Mochi needs 3 more')
  expect(bar(3, 5)).toBe('██████░░░░ 3/5')
  expect(storyOf('repo').emoji).toBe('🏴‍☠️')
})

test('seasons come round each year', async () => {
  expect(seasonOf(at(2026, 10, 14))).toBe(null)
  expect(seasonOf(at(2026, 10, 15))).toBe('halloween')
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
  const journey = { current: 'repo' as const, runs: { repo: { chapter: 2, banked: 0, from: null, isTold: true } } }
  const svg = cardSvg(buddy, { ...EMPTY_STATS, prompts: 12, wins: 3 }, ['first-buddy'], journey, '2026-10-20')
  expect(svg.startsWith('<svg') && svg.endsWith('</svg>')).toBe(true)
  expect(svg.includes('Bolt &lt;&amp;&gt; &quot;Cap&quot;')).toBe(true)
  expect(svg.includes('<&>')).toBe(false)
  expect(svg.includes('Day 20 together')).toBe(true)
  expect(svg.includes('The Sunken Repo, ch. 3: Rough seas')).toBe(true)
  expect(svg.includes(`1/${MILESTONES.length} achievements`)).toBe(true)
  expect(cardSvg(buddy, EMPTY_STATS, [], undefined, '2026-10-20').includes('Choosing an adventure')).toBe(true)
  expect(cardFileName('Captain Bolt!')).toBe('pixel-buddy-captain-bolt.svg')
  expect(cardFileName('🦀')).toBe('pixel-buddy-buddy.svg')
  expect(daysTogether('2026-10-20', '2026-10-20')).toBe(1)
  expect(daysTogether('bad', '2026-10-20')).toBe(1)
})
