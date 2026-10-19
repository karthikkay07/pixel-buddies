import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 80, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

/** The engine around the mod: a store holding one pirate, and the calls it makes. */
function world(on: On) {
  const saved: Record<string, unknown> = {
    roster: [{ id: 'a', name: 'Captain Bolt', kind: 'crab', color: '#F07858', archetype: 'auto', seed: 0 }],
    activeId: 'a',
  }
  on('store.get', ($, e) => ({ value: saved[e.key] }))
  on('store.set', ($, e) => {
    saved[e.key] = e.value
    return { value: undefined }
  })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  return mock.clock(on, { now: Date.UTC(2026, 9, 19, 10, 0) })
}

async function band($: Engine) {
  const ui = await $.ui.mount({ plugin: 'pixel-buddies', surface: 'desktop', ...BAND })
  const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text).join(' | ')
  const svg = await ui.find({ type: 'Svg' })
  await ui.unmount()
  return { texts, alt: String(svg?.props.alt ?? '') }
}

test('says hello, then settles down', { options: { chattiness: 'normal', sleepAfterMinutes: 0 } }, async ($, on) => {
  const clock = world(on)
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  let now = await band($)
  expect(now.texts).toContain('Captain Bolt')
  expect(now.texts).toContain('Pirate')
  expect(now.texts).toContain('“')
  expect(now.alt).toContain('wave')
  await clock.advance(8000)
  now = await band($)
  expect(now.texts).not.toContain('“')
  expect(now.alt).toContain('idle')
})

test('a poke always gets a reaction', { options: { chattiness: 'normal', sleepAfterMinutes: 0 } }, async ($, on) => {
  const clock = world(on)
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await clock.advance(8000)
  expect((await $.command.run({ command: 'buddy', args: 'poke', ...RUN })).text).toBe('You poked Captain Bolt.')
  const now = await band($)
  expect(now.alt).toContain('happy')
  expect(now.texts).toContain('“')
})

test('dozes off when idle and wakes up on activity', { options: { chattiness: 'normal', sleepAfterMinutes: 1 } }, async ($, on) => {
  const clock = world(on)
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await clock.advance(30_000)
  expect((await band($)).alt).not.toContain('sleeping')
  await clock.advance(45_000)
  expect((await band($)).alt).toContain('sleeping')
  await $.command.run({ command: 'buddy', args: 'poke', ...RUN })
  await clock.advance(10_000)
  expect((await band($)).alt).not.toContain('sleeping')
})

test('silent buddies animate but never speak', { options: { chattiness: 'silent', sleepAfterMinutes: 0 } }, async ($, on) => {
  const clock = world(on)
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  expect((await band($)).texts).not.toContain('“')
  await $.command.run({ command: 'buddy', args: 'poke', ...RUN })
  const now = await band($)
  expect(now.alt).toContain('happy')
  expect(now.texts).not.toContain('“')
  // Ten idle minutes of a silent buddy: no thoughts either.
  await clock.advance(600_000)
  expect((await band($)).texts).not.toContain('💭')
})
