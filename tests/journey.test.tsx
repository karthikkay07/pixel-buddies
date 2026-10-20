import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

const STORY = {
  component: 'Pane',
  requestId: 'buddy-story',
  props: { title: 'The Lost Pixels', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const BOLT = { id: 'a', name: 'Captain Bolt', kind: 'crab', color: '#F07858', archetype: 'auto', seed: 0 }

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

test('the story starts, its first quest is done by working, and home starts to grow', { options: { chattiness: 'normal', sleepAfterMinutes: 0 } }, async ($, on) => {
  const saved: Record<string, unknown> = { roster: [BOLT], activeId: 'a' }
  const { toasts, clock } = world(on, SEPTEMBER, saved)
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await clock.advance(7000)
  expect(toasts.some(t => t.startsWith('📖 Chapter 1: A pixel falls. Quest: Send 5 prompts'))).toBe(true)
  expect((saved.story as { isTold: boolean }).isTold).toBe(true)

  for (let i = 0; i < 5; i++) await $.prompt.submit({ text: `task ${i}`, wait: false, origin: { kind: 'composer' } } as never)
  expect((saved.story as { chapter: number }).chapter).toBe(1)
  expect(toasts.some(t => t.startsWith('📖 Chapter 1 complete: A pixel falls. The grass is back in Pixelia!'))).toBe(true)

  const ui = await $.ui.mount({ plugin: 'pixel-buddies', surface: 'desktop', ...STORY })
  expect(await ui.find({ type: 'Text', text: /Chapter 2 of 8: The first spark/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Home so far: Grass/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /░ 0\/2/ })).toBeDefined()
  await ui.unmount()
})

test('/buddy card saves an SVG to share', { options: { sleepAfterMinutes: 0 } }, async ($, on) => {
  const saved: Record<string, unknown> = { roster: [{ ...BOLT, born: '2026-09-01' }], activeId: 'a' }
  const { files } = world(on, SEPTEMBER, saved)
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  const text = (await $.command.run({ command: 'buddy', args: 'card', ...RUN })).text ?? ''
  expect(text).toContain('pixel-buddy-captain-bolt.svg')
  // Written next to where the session runs.
  const path = Object.keys(files).find(p => p.endsWith('pixel-buddy-captain-bolt.svg')) ?? ''
  const svg = files[path] ?? ''
  expect(svg.startsWith('<svg')).toBe(true)
  expect(svg).toContain('Captain Bolt')
  expect(svg).toContain('Day 14 together')
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
