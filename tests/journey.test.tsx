import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

const PANE = (requestId: string, title: string) =>
  ({
    component: 'Pane',
    requestId,
    props: { title, isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
  }) as const
const STORY = PANE('buddy-story', 'Stories')
const STUDIO = PANE('buddy-studio', 'Buddy studio')

const BOLT = { id: 'a', name: 'Captain Bolt', kind: 'crab', color: '#F07858', archetype: 'auto', seed: 0 }
const BIT = { id: 'b', name: 'Bit', kind: 'robot', color: '#4FA3E0', archetype: 'auto', seed: 0 }

type Journeys = Record<string, { current: string | null; runs: Record<string, { chapter: number; banked: number }> }>

/** The engine around the mod, on a given day, recording what it saves, shows and writes. */
function world(on: On, now: number, saved: Record<string, unknown>) {
  const toasts: string[] = []
  const files: Record<string, string> = {}
  on('store.get', ($, e) => ({ value: saved[e.key] }))
  on('store.set', ($, e) => {
    saved[e.key] = e.value
    return { value: undefined }
  })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('fs.write', ($, e) => {
    files[e.path] = e.text
    return { value: undefined }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/work' }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  const clock = mock.clock(on, { now })
  return { toasts, files, clock }
}

const SEPTEMBER = new Date(2026, 8, 14, 12, 0).getTime()

async function prompts($: Engine, n: number) {
  for (let i = 0; i < n; i++) await $.prompt.submit({ text: `task ${i}`, wait: false, origin: { kind: 'composer' } } as never)
}

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 80, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

async function band($: Engine) {
  const ui = await $.ui.mount({ plugin: 'pixel-buddies', surface: 'desktop', ...BAND })
  const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text).join(' | ')
  const svg = await ui.find({ type: 'Svg' })
  await ui.unmount()
  return { texts, alt: String(svg?.props.alt ?? '') }
}

test('a buddy with no story starts the one that suits it, and can switch', { options: { sleepAfterMinutes: 0 } }, async ($, on) => {
  const saved: Record<string, unknown> = { roster: [BOLT], activeId: 'a' }
  const { toasts, clock } = world(on, SEPTEMBER, saved)
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await clock.advance(7000)
  // A pirate sets sail on the pirate story, in one toast.
  expect(toasts).toContain(
    '🏴‍☠️ Captain Bolt is starting The Sunken Repo! Chapter 1: Washed ashore. Quest: Send 5 prompts. Pick another story anytime: /buddy story',
  )
  expect((saved.journeys as Journeys).a?.current).toBe('repo')
  // The band shows the story too.
  expect((await band($)).texts).toContain('🏴‍☠️ Ch. 1 Washed ashore · ░░░░░░░░░░ 0/5')

  // Switching: the picker lists every story, the suggestion marked.
  expect((await $.command.run({ command: 'buddy', args: 'story', ...RUN })).text).toBe('The Sunken Repo opened.')
  const ui = await $.ui.mount({ plugin: 'pixel-buddies', surface: 'desktop', ...STORY })
  expect(await ui.find({ type: 'Text', text: /Chapter 1 of 8: Washed ashore/ })).toBeDefined()
  await ui.press({ key: 'switch' })
  for (const id of ['pixels', 'voyager', 'king', 'garden', 'repo']) expect(await ui.find({ key: `pick-${id}` })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Chapter 1 of 8 · ✨ suits Captain Bolt/ })).toBeDefined()
  await ui.press({ key: 'pick-garden' })
  expect((saved.journeys as Journeys).a?.current).toBe('garden')
  await ui.unmount()
})

test('the buddy acts its story out on the stage', { options: { chattiness: 'silent', sleepAfterMinutes: 0 } }, async ($, on) => {
  const saved: Record<string, unknown> = {
    roster: [BIT],
    activeId: 'b',
    journeys: { b: { current: 'voyager', runs: { voyager: { chapter: 3, banked: 0, from: null, isTold: true } } } },
  }
  const { clock } = world(on, SEPTEMBER, saved)
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  const seen = new Set<string>()
  for (let s = 0; s < 180; s++) {
    await clock.advance(1000)
    seen.add((await band($)).alt.replace('Bit the robot, ', ''))
  }
  const all = [...seen].join(' | ')
  // Working on the next piece (the nose cone), walking to it, visiting what was built, or stargazing.
  // (This session is a new day, so the quest already reads 1 of 2.)
  expect(all).toContain('working on the nose cone (1/2)')
  expect(/off to work on the nose cone|admiring the|going to look at the|stargazing/.test(all)).toBe(true)
})

test('finishing a chapter: the buddy celebrates at the new piece', { options: { chattiness: 'silent', sleepAfterMinutes: 0 } }, async ($, on) => {
  const saved: Record<string, unknown> = {
    roster: [BOLT],
    activeId: 'a',
    journeys: { a: { current: 'repo', runs: { repo: { chapter: 1, banked: 1, from: null, isTold: true } } } },
  }
  const { toasts, clock } = world(on, SEPTEMBER, saved)
  // Chapter 2 of The Sunken Repo: 2 more sessions for the palm tree; this one makes 2.
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  expect(toasts.some(t => t.startsWith('🏴‍☠️ The Sunken Repo, chapter 2 complete: Shade. Palm tree rebuilt!'))).toBe(true)
  const seen = new Set<string>()
  for (let s = 0; s < 8; s++) {
    seen.add((await band($)).alt)
    await clock.advance(1000)
  }
  expect(/running to see the new palm tree|celebrating the new palm tree/.test([...seen].join(' | '))).toBe(true)
})

test('each buddy keeps its own story, and only the active one counts', { options: { sleepAfterMinutes: 0 } }, async ($, on) => {
  const saved: Record<string, unknown> = { roster: [BOLT, BIT], activeId: 'a' }
  const { toasts } = world(on, SEPTEMBER, saved)
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })

  // Captain Bolt starts The Lost Pixels and gets 3 of 5 prompts in.
  await $.command.run({ command: 'buddy', args: 'story', ...RUN })
  let story = await $.ui.mount({ plugin: 'pixel-buddies', surface: 'desktop', ...STORY })
  await story.press({ key: 'pick-pixels' })
  await story.unmount()
  await prompts($, 3)

  // Switch to Bit, who starts Star Voyager and gets 4 in.
  await $.command.run({ command: 'buddy', args: '', ...RUN })
  const studio = await $.ui.mount({ plugin: 'pixel-buddies', surface: 'desktop', ...STUDIO })
  await studio.press({ key: 'use-b' })
  await studio.unmount()
  await $.command.run({ command: 'buddy', args: 'story', ...RUN })
  story = await $.ui.mount({ plugin: 'pixel-buddies', surface: 'desktop', ...STORY })
  await story.press({ key: 'pick-voyager' })
  await story.unmount()
  await prompts($, 4)
  let j = saved.journeys as Journeys
  expect(j.a?.runs.pixels).toEqual(expect.objectContaining({ chapter: 0, banked: 3 }))
  expect(j.b?.runs.voyager?.chapter).toBe(0)

  // Back to Captain Bolt: two more prompts finish its chapter; Bit's waits at 4 of 5.
  const back = await $.ui.mount({ plugin: 'pixel-buddies', surface: 'desktop', ...STUDIO })
  await back.press({ key: 'use-a' })
  await back.unmount()
  await prompts($, 2)
  j = saved.journeys as Journeys
  expect(j.a?.runs.pixels?.chapter).toBe(1)
  expect(j.b?.runs.voyager).toEqual(expect.objectContaining({ chapter: 0, banked: 4 }))
  expect(toasts.some(t => t.startsWith('🏠 The Lost Pixels, chapter 1 complete'))).toBe(true)
  expect(toasts.some(t => t.startsWith('🚀 Star Voyager, chapter 1 complete'))).toBe(false)
})

test('finishing a story earns its achievement and reward', { options: { sleepAfterMinutes: 0 } }, async ($, on) => {
  // Bit is on Star Voyager's last chapter (3 sessions), 2 already done.
  const saved: Record<string, unknown> = {
    roster: [BIT],
    activeId: 'b',
    journeys: { b: { current: 'voyager', runs: { voyager: { chapter: 7, banked: 2, from: null, isTold: true } } } },
  }
  const { toasts } = world(on, SEPTEMBER, saved)
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  expect((saved.journeys as Journeys).b?.runs.voyager?.chapter).toBe(8)
  expect(saved.earned).toContain('story-voyager')
  // One toast says it all: the story, the trophy, and what came with it.
  expect(toasts).toContain('🚀 You and Bit finished Star Voyager! 🏆 Liftoff! · unlocked: Spots pattern, Space helmet. Pick your next adventure in /buddy story.')
  expect(toasts.some(t => t.startsWith('🏆 Liftoff!:'))).toBe(false)
})

test('/buddy card saves an SVG to share', { options: { sleepAfterMinutes: 0 } }, async ($, on) => {
  const saved: Record<string, unknown> = {
    roster: [{ ...BOLT, born: '2026-09-01' }],
    activeId: 'a',
    journeys: { a: { current: 'king', runs: { king: { chapter: 3, banked: 0, from: null, isTold: true } } } },
  }
  const { files } = world(on, SEPTEMBER, saved)
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  const text = (await $.command.run({ command: 'buddy', args: 'card', ...RUN })).text ?? ''
  expect(text).toContain('pixel-buddy-captain-bolt.svg')
  // Written next to where the session runs.
  const path = Object.keys(files).find(p => p.endsWith('pixel-buddy-captain-bolt.svg')) ?? ''
  const svg = files[path] ?? ''
  expect(svg.startsWith('<svg')).toBe(true)
  expect(svg).toContain('Day 14 together')
  expect(svg).toContain('The Bug King, ch. 4: The riddle lock')
})

test('a birthday gets a toast, once on the day', { options: { sleepAfterMinutes: 0 } }, async ($, on) => {
  const saved: Record<string, unknown> = { roster: [{ ...BOLT, born: '2025-09-14' }], activeId: 'a' }
  const { toasts } = world(on, SEPTEMBER, saved)
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  expect(toasts).toContain("🎂 It's Captain Bolt's birthday! 1 year together today.")
  expect(saved.birthdayShown).toBe('a:2026-09-14')
})

test('Halloween brings the spooky achievement and its witch hat', { options: { sleepAfterMinutes: 0 } }, async ($, on) => {
  const saved: Record<string, unknown> = { roster: [BOLT], activeId: 'a' }
  const { toasts } = world(on, new Date(2026, 9, 31, 12, 0).getTime(), saved)
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  expect(saved.earned).toContain('spooky')
  expect(toasts).toContain('🏆 Spooky season: Witch hat unlocked! Try it in /buddy')
})

test('buddies from before 0.5 get a birthday from the day they are first seen', { options: { sleepAfterMinutes: 0 } }, async ($, on) => {
  const saved: Record<string, unknown> = { roster: [BOLT], activeId: 'a' }
  world(on, SEPTEMBER, saved)
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  expect((saved.roster as { born: string }[])[0]?.born).toBe('2026-09-14')
})
