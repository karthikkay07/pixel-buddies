import { expect, test } from 'claude-code/testing'

import { MAX_BUDDIES, cleanActiveId, cleanName, cleanRoster, isColor } from '../hooks/data'

const ok = { id: 'a', name: 'Alpha', kind: 'crab', color: '#f07858' }

test('a whole roster survives, with colours normalised', async () => {
  const full = { ...ok, archetype: 'pirate', seed: 4 }
  expect(cleanRoster([full])).toEqual([{ ...full, color: '#F07858' }])
})

test('buddies saved by 0.1 upgrade to a personality read from the name', async () => {
  expect(cleanRoster([ok])).toEqual([{ ...ok, color: '#F07858', archetype: 'auto', seed: 0 }])
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
    { ...ok, id: 'k', kind: 'dragon' },
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
