import { expect, test } from 'claude-code/testing'

import { ACTS, DOING, WANDER, WORK_PROP, actById, pickNext, restMs, walkClip, walkTarget } from '../hooks/acts'
import { clipPose } from '../hooks/animations'
import { ARCHETYPE_NAMES } from '../hooks/personality'
import { PROPS, propDabs, propFrames } from '../hooks/props'
import type { PropKind } from '../hooks/props'
import { CANVAS_H, CANVAS_W, KINDS, SPRITES, pixels, rasterCells, svgSource } from '../hooks/sprites'
import { DEFAULT_STYLE, anchorsOf } from '../hooks/style'

const BUSY = { eyes: 'angry', pattern: 'spots', accessory: 'headphones' } as const

/** A repeatable stand-in for Math.random. */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

test('every personality has three acts of its own, and everyone shares ten', async () => {
  expect(new Set(ACTS.map(a => a.id)).size).toBe(ACTS.length)
  // And the band can say what each one is doing.
  for (const a of ACTS) expect(typeof DOING[a.id]).toBe('string')
  expect(typeof DOING.walk).toBe('string')
  expect(ACTS.filter(a => !a.who).length).toBe(10)
  for (const archetype of ARCHETYPE_NAMES) {
    expect(ACTS.filter(a => a.who?.includes(archetype)).length).toBe(3)
  }
})

test('every act draws on every type, in the terminal and as a small SVG', async () => {
  for (const { value: kind } of KINDS) {
    for (const a of ACTS) {
      expect(rasterCells({ kind, color: '#4FA3E0', style: DEFAULT_STYLE }, a, 5).length).toBe(5760)
      const svg = svgSource({ kind, color: '#9B6BDB', style: BUSY }, a)
      expect(svg.length < 131072).toBe(true)
      for (let t = 0; t < a.length; t += 7) {
        const grid = pixels({ kind, color: '#F07858', style: BUSY }, clipPose(a, t))
        expect(grid.length).toBe(CANVAS_H)
        expect(grid.every(row => row.length === CANVAS_W)).toBe(true)
      }
    }
  }
})

test('every prop shows on every type, on the stage', async () => {
  for (const { value: kind } of KINDS) {
    const a = anchorsOf(SPRITES[kind])
    for (const prop of Object.keys(PROPS) as PropKind[]) {
      for (let f = 0; f < propFrames(prop); f++) {
        const dabs = propDabs(prop, f, a)
        expect(dabs.length > 0).toBe(true)
        // The stage has 5 rows above the sprite and 1 below; props stay within it.
        expect(dabs.every(d => d.y >= -5 && d.y <= 12)).toBe(true)
      }
    }
  }
})

test('a walk faces the way it goes and ends where it was headed', async () => {
  const right = walkClip(-4, 5)
  expect(clipPose(right, 0).dx).toBe(-4)
  expect(clipPose(right, right.length - 1).dx).toBe(5)
  expect(clipPose(right, 3).flip).toBe(false)
  const left = walkClip(5, -4)
  expect(clipPose(left, 3).flip).toBe(true)
  expect(clipPose(left, left.length - 1).dx).toBe(-4)
  // The SVG of a long walk is still small: two pictures, moved.
  const svg = svgSource({ kind: 'cat', color: '#F07858', style: BUSY }, walkClip(-WANDER, WANDER))
  expect((svg.match(/<g id=/g) ?? []).length <= 2).toBe(true)
})

test('walks go somewhere new, within the stage', async () => {
  const random = seeded(7)
  for (let i = 0; i < 200; i++) {
    const from = Math.round(random() * WANDER * 2) - WANDER
    const to = walkTarget(from, random)
    expect(Math.abs(to) <= WANDER).toBe(true)
    expect(Math.abs(to - from) >= 3).toBe(true)
  }
})

test('acts fit the personality, and the last few are not repeated', async () => {
  const random = seeded(3)
  const ctx = { hour: 14, sinceErrorMs: Infinity }
  for (let i = 0; i < 300; i++) {
    const next = pickNext('pirate', 3, ctx, ['look', 'telescope', 'walk'], random)
    expect(next.kind).toBe('act')
    if (next.kind === 'act') {
      expect(!next.act.who || next.act.who.includes('pirate')).toBe(true)
      expect(['look', 'telescope'].includes(next.act.id)).toBe(false)
    }
  }
})

function share(archetype: (typeof ARCHETYPE_NAMES)[number], energy: number, hour: number, sinceErrorMs: number, ids: string[]) {
  const random = seeded(11)
  let hits = 0
  for (let i = 0; i < 2000; i++) {
    const next = pickNext(archetype, energy, { hour, sinceErrorMs }, [], random)
    if ((next.kind === 'walk' && ids.includes('walk')) || (next.kind === 'act' && ids.includes(next.act.id))) hits++
  }
  return hits / 2000
}

test('energetic buddies walk more; nights bring yawns; grumps sulk after errors', async () => {
  expect(share('gremlin', 5, 14, Infinity, ['walk']) > share('sleepy', 1, 14, Infinity, ['walk'])).toBe(true)
  expect(share('nerd', 3, 23, Infinity, ['yawn', 'lie']) > share('nerd', 3, 14, Infinity, ['yawn', 'lie'])).toBe(true)
  expect(share('grump', 2, 14, 10_000, ['cloud']) > share('grump', 2, 14, Infinity, ['cloud']) * 2).toBe(true)
  // A personality's own acts make up a good share of what it does.
  expect(share('poet', 2, 14, Infinity, ['quill', 'rose', 'moon']) > 0.25).toBe(true)
})

test('calm buddies rest longer between acts', async () => {
  const mean = (energy: number) => {
    const random = seeded(5)
    let total = 0
    for (let i = 0; i < 500; i++) total += restMs(energy, random)
    return total / 500
  }
  expect(mean(1) > mean(5) * 2).toBe(true)
  expect(mean(5) > 4000).toBe(true)
})

test('every personality has something to hold while Claude works', async () => {
  for (const archetype of ARCHETYPE_NAMES) expect(WORK_PROP[archetype] in PROPS).toBe(true)
  expect(actById('juggle')?.label).toBe('Juggle')
  expect(actById('nope')).toBe(undefined)
})
