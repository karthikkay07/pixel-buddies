import { expect, test } from 'claude-code/testing'

import {
  ARCHETYPES,
  ARCHETYPE_NAMES,
  archetypeFor,
  classifyToolResult,
  fill,
  linesFor,
  personalityOf,
  react,
  thoughtChance,
} from '../hooks/personality'
import type { BuddyEvent } from '../hooks/personality'

const EVENTS: BuddyEvent[] = ['hello', 'prompt', 'working', 'error', 'success', 'done', 'thought', 'sleep', 'wake', 'poke']
const always = () => 0
const never = () => 0.999

test('every archetype has something to say for every event', async () => {
  for (const a of ARCHETYPE_NAMES) {
    for (const ev of EVENTS) {
      const lines = linesFor(a, ev)
      expect(lines.length > 0).toBe(true)
      for (const line of lines) {
        expect(line.trim().length > 0).toBe(true)
        // Short enough to read at a glance beside the buddy.
        expect(line.length <= 90).toBe(true)
        expect(/\{(?!name\}|tool\}|time\})/.test(line)).toBe(false)
      }
    }
    expect(ARCHETYPES[a].traits.length).toBe(3)
  }
})

test('a name always gives the same personality', async () => {
  for (const name of ['Pixel', 'Mochi', 'Zig', 'Bob', 'Sir Reginald', 'x']) {
    expect(archetypeFor(name, 0)).toBe(archetypeFor(name, 0))
    expect(personalityOf({ name, archetype: 'auto', seed: 3 })).toEqual(personalityOf({ name, archetype: 'auto', seed: 3 }))
  }
})

test('names that suggest a personality get it', async () => {
  expect(archetypeFor('Captain Bolt', 0)).toBe('pirate')
  expect(archetypeFor('Sleepy Mochi', 0)).toBe('sleepy')
  expect(archetypeFor('Grumpy', 0)).toBe('grump')
  expect(archetypeFor('Chaos Muffin', 0)).toBe('gremlin')
  expect(archetypeFor('Sprocket', 0)).toBe('nerd')
  expect(archetypeFor('Willow', 0)).toBe('poet')
})

test('rerolling moves through the archetypes', async () => {
  const seen = new Set(Array.from({ length: 40 }, (_, seed) => archetypeFor('Pixel', seed + 1)))
  expect(seen.size >= 6).toBe(true)
})

test('a chosen archetype wins over the name', async () => {
  expect(personalityOf({ name: 'Captain Bolt', archetype: 'poet', seed: 0 }).archetype).toBe('poet')
})

test('energy and chattiness stay between 1 and 5', async () => {
  for (const a of ARCHETYPE_NAMES) {
    for (const name of ['A', 'Bb', 'Ccc', 'Dddd']) {
      const p = personalityOf({ name, archetype: a, seed: 0 })
      expect(p.energy >= 1 && p.energy <= 5).toBe(true)
      expect(p.chattiness >= 1 && p.chattiness <= 5).toBe(true)
    }
  }
})

test('silent buddies only animate', async () => {
  const p = personalityOf({ name: 'Pixel', archetype: 'gremlin', seed: 0 })
  for (const ev of EVENTS) expect(react(ev, p, 'silent', { name: 'Pixel' }, [], always).line).toBe(null)
  expect(react('success', p, 'silent', { name: 'Pixel' }, [], always).anim).toBe('celebrate')
})

test('quiet buddies speak only at big moments', async () => {
  const p = personalityOf({ name: 'Pixel', archetype: 'cheerleader', seed: 0 })
  expect(react('prompt', p, 'quiet', { name: 'Pixel' }, [], always).line).toBe(null)
  expect(react('working', p, 'quiet', { name: 'Pixel' }, [], always).line).toBe(null)
  expect(react('success', p, 'quiet', { name: 'Pixel' }, [], always).line).not.toBe(null)
  expect(react('hello', p, 'quiet', { name: 'Pixel' }, [], never).line).not.toBe(null)
})

test('reactions pick the right animation and fill in the details', async () => {
  const p = personalityOf({ name: 'Bolt', archetype: 'pirate', seed: 0 })
  const r = react('error', p, 'normal', { name: 'Bolt', tool: 'Bash' }, [], always)
  expect(r.anim).toBe('sad')
  expect(r.ms > 0).toBe(true)
  expect(r.line !== null && !r.line.includes('{')).toBe(true)
  expect(react('thought', p, 'normal', { name: 'Bolt' }, [], always).isThought).toBe(true)
  expect(react('thought', p, 'normal', { name: 'Bolt' }, [], always).anim).toBe('thinking')
  expect(fill('{name} ran {tool} at {time}', { name: 'Bolt', tool: 'Grep', time: '09:30' })).toBe('Bolt ran Grep at 09:30')
})

test('recent lines are not repeated while fresh ones remain', async () => {
  const p = personalityOf({ name: 'Bolt', archetype: 'pirate', seed: 0 })
  const all = linesFor('pirate', 'success').map(l => fill(l, { name: 'Bolt' }))
  const recent = all.slice(0, -1)
  for (let i = 0; i < 10; i++) {
    expect(react('success', p, 'normal', { name: 'Bolt' }, recent, Math.random).line).toBe(all[all.length - 1] ?? null)
  }
})

test('chattier settings and personalities think more often', async () => {
  const chatty = personalityOf({ name: 'A', archetype: 'gremlin', seed: 0 })
  const calm = personalityOf({ name: 'A', archetype: 'sleepy', seed: 0 })
  expect(thoughtChance('silent', chatty, 10)).toBe(0)
  expect(thoughtChance('chaotic', chatty, 10) > thoughtChance('normal', chatty, 10)).toBe(true)
  expect(thoughtChance('normal', chatty, 10) > thoughtChance('quiet', chatty, 10)).toBe(true)
  expect(thoughtChance('normal', chatty, 10) > thoughtChance('normal', calm, 10)).toBe(true)
})

test('tool results are read as wins and failures', async () => {
  expect(classifyToolResult('Edit', true, 'boom')).toBe('error')
  expect(classifyToolResult('Bash', false, 'Tests: 42 passed, 42 total')).toBe('success')
  expect(classifyToolResult('Bash', false, ' 10 pass\n 0 fail')).toBe('success')
  expect(classifyToolResult('Bash', false, '3 passed, 1 failed')).toBe(null)
  expect(classifyToolResult('Bash', false, 'BUILD SUCCESSFUL in 3s')).toBe('success')
  expect(classifyToolResult('Bash', false, 'hello world')).toBe(null)
  expect(classifyToolResult('Read', false, '5 passed')).toBe(null)
  expect(classifyToolResult('Bash', false, undefined)).toBe(null)
})
