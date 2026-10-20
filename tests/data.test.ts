import { expect, test } from 'claude-code/testing'

import { EMPTY_STATS } from '../hooks/achievements'
import { MAX_BUDDIES, cleanActiveId, cleanEarned, cleanName, cleanRoster, cleanStats, cleanStyle, isColor } from '../hooks/data'
import { DEFAULT_STYLE } from '../hooks/style'

const ok = { id: 'a', name: 'Alpha', kind: 'crab', color: '#f07858' }

test('a whole roster survives, with colours normalised', async () => {
  const full = { ...ok, archetype: 'pirate', seed: 4, style: { eyes: 'love', pattern: 'spots', accessory: 'crown' }, born: '2026-10-19' }
  expect(cleanRoster([full])).toEqual([{ ...full, color: '#F07858' }])
})

test('buddies saved by 0.1 upgrade to a personality read from the name', async () => {
  expect(cleanRoster([ok], '2026-10-20')).toEqual([{ ...ok, color: '#F07858', archetype: 'auto', seed: 0, style: DEFAULT_STYLE, born: '2026-10-20' }])
})

test('bad personality fields fall back instead of dropping the buddy', async () => {
  for (const [archetype, seed] of [['dragon', -1], [42, 1.5], [null, 'x'], ['poet', 5_000_000]] as const) {
    const [b] = cleanRoster([{ ...ok, archetype, seed }])
    expect(b?.archetype).toBe(archetype === 'poet' ? 'poet' : 'auto')
    expect(b?.seed).toBe(0)
  }
})

test('anything broken in the store is dropped, never drawn', async () => {
  expect(cleanRoster(undefined)).toEqual([])
  expect(cleanRoster('nope')).toEqual([])
  expect(cleanRoster({ 0: ok })).toEqual([])
  const roster = cleanRoster([
    null,
    'junk',
    42,
    { ...ok, id: 'k', kind: 'unicorn' },
    { ...ok, id: 'c', color: 'red' },
    { ...ok, id: 'c2', color: '#12345' },
    { ...ok, id: '' },
    { ...ok, id: 7 },
    { ...ok, id: 'n', name: '   ' },
    { ...ok, id: 'n2', name: 99 },
    ok,
    { ...ok, name: 'Duplicate id' },
  ])
  expect(roster.map(b => b.id)).toEqual(['a'])
})

test('names are trimmed, capped and stripped of control characters', async () => {
  expect(cleanName('  Pixel  ')).toBe('Pixel')
  expect(cleanName('Bad\u0007Name\n')).toBe('BadName')
  expect(cleanName('x'.repeat(40)).length).toBe(24)
  expect(cleanName(undefined)).toBe('')
})

test('the roster is capped', async () => {
  const many = Array.from({ length: MAX_BUDDIES + 10 }, (_, i) => ({ ...ok, id: `b${i}` }))
  expect(cleanRoster(many).length).toBe(MAX_BUDDIES)
})

test('the active id falls back to the first buddy, or none', async () => {
  const roster = cleanRoster([ok, { ...ok, id: 'b' }])
  expect(cleanActiveId('b', roster)).toBe('b')
  expect(cleanActiveId('gone', roster)).toBe('a')
  expect(cleanActiveId(3, roster)).toBe('a')
  expect(cleanActiveId('a', [])).toBe(null)
})

test('colours must be six-digit hex', async () => {
  expect(isColor('#3CC48C')).toBe(true)
  expect(isColor('#3cc48c')).toBe(true)
  expect(isColor('3CC48C')).toBe(false)
  expect(isColor('#3CC')).toBe(false)
  expect(isColor('url(x)')).toBe(false)
})

test('a style keeps its good parts and defaults the rest', async () => {
  expect(cleanStyle(undefined)).toEqual(DEFAULT_STYLE)
  expect(cleanStyle({ eyes: 'love', pattern: 'plaid', accessory: 'crown' })).toEqual({ eyes: 'love', pattern: 'plain', accessory: 'crown' })
  expect(cleanStyle('crown')).toEqual(DEFAULT_STYLE)
})

test('stats are whole counts, and buddies made before 0.3 count', async () => {
  const roster = cleanRoster([ok, { ...ok, id: 'b' }])
  expect(cleanStats(undefined, roster)).toEqual({ ...EMPTY_STATS, buddiesMade: 2 })
  const stats = cleanStats({ prompts: 12, wins: -3, pokes: 2.5, errors: '9', days: 4, lastDay: '2026-10-19', extra: 1 }, roster)
  expect(stats).toEqual({ ...EMPTY_STATS, prompts: 12, days: 4, lastDay: '2026-10-19' })
  expect(cleanStats({ lastDay: 'yesterday' }, []).lastDay).toBe('')
})

test('earned achievements are known ids, each once', async () => {
  expect(cleanEarned(['champion', 'champion', 'made-up', 7, 'regular'])).toEqual(['champion', 'regular'])
  expect(cleanEarned('champion')).toEqual([])
})
