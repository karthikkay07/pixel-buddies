import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const STUDIO = {
  component: 'Pane',
  requestId: 'buddy-studio',
  props: { title: 'Buddy studio', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

type Saved = { name: string; style: { eyes: string; accessory: string } }[]

function world(on: On, saved: Record<string, unknown>, toasts: string[]) {
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
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  return mock.clock(on, { now: new Date(2026, 8, 14, 12, 0).getTime() })
}

const PIRATE = { id: 'a', name: 'Captain Bolt', kind: 'crab', color: '#F07858', archetype: 'auto', seed: 0 }

test('locked things can be tried on but not saved', { options: { sleepAfterMinutes: 0 } }, async ($, on) => {
  const saved: Record<string, unknown> = { roster: [PIRATE], activeId: 'a' }
  const toasts: string[] = []
  world(on, saved, toasts)
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'buddy', args: '', ...RUN })
  const studio = await $.ui.mount({ plugin: 'pixel-buddies', surface: 'desktop', ...STUDIO })

  const accessory = await studio.find({ key: 'accessory' })
  const options = accessory?.props.options as { value: string; label: string }[]
  expect(options.find(o => o.value === 'crown')?.label).toBe('🔒 Crown')
  expect(options.find(o => o.value === 'none')?.label).toBe('None')

  await studio.select({ key: 'accessory', value: 'crown' })
  expect(await studio.find({ type: 'Text', text: /Trying on Crown/ })).toBeDefined()
  await studio.press({ key: 'save' })
  expect(toasts.some(t => t.startsWith('🔒 Crown is locked. Pass tests or a build 25 times to unlock it (0/25).'))).toBe(true)
  expect((saved.roster as Saved)[0]?.style.accessory).toBe('none')
  await studio.unmount()
})

test('earning an achievement unlocks its reward', { options: { sleepAfterMinutes: 0 } }, async ($, on) => {
  const saved: Record<string, unknown> = { roster: [PIRATE], activeId: 'a' }
  const toasts: string[] = []
  const clock = world(on, saved, toasts)
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  // Made before stats existed: the buddy counts, so the first achievement is earned at once.
  expect(saved.earned).toEqual(['first-buddy'])

  for (let i = 0; i < 10; i++) await $.command.run({ command: 'buddy', args: 'poke', ...RUN })
  await clock.advance(10_000)
  expect(saved.earned).toEqual(['first-buddy', 'best-friends'])
  expect(toasts).toContain('🏆 Best friends: Love eyes unlocked! Try it in /buddy')
  expect((saved.stats as { pokes: number }).pokes).toBe(10)

  await $.command.run({ command: 'buddy', args: '', ...RUN })
  const studio = await $.ui.mount({ plugin: 'pixel-buddies', surface: 'desktop', ...STUDIO })
  await studio.select({ key: 'eyes', value: 'love' })
  await studio.press({ key: 'save' })
  await studio.unmount()
  expect((saved.roster as Saved)[0]?.style.eyes).toBe('love')

  const text = (await $.command.run({ command: 'buddy', args: 'achievements', ...RUN })).text ?? ''
  expect(text.startsWith('Achievements: 2/19')).toBe(true)
  expect(text).toContain('🏆 Best friends: Love eyes')
  expect(text).toContain('🔒 Champion (0/25)')
})

test('custom colours need the Artist achievement', { options: { sleepAfterMinutes: 0 } }, async ($, on) => {
  const saved: Record<string, unknown> = {
    roster: [PIRATE],
    activeId: 'a',
    stats: { days: 5, lastDay: '2026-09-14', buddiesMade: 1 },
    earned: ['first-buddy', 'regular', 'artist'],
  }
  const toasts: string[] = []
  world(on, saved, toasts)
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'buddy', args: '', ...RUN })
  const studio = await $.ui.mount({ plugin: 'pixel-buddies', surface: 'desktop', ...STUDIO })
  await studio.input({ key: 'hex', text: 'not a colour' })
  expect(toasts).toContain('Use a colour like #FF8800.')
  await studio.input({ key: 'hex', text: '12ab9f' })
  await studio.select({ key: 'kind', value: 'cat' })
  await studio.press({ key: 'save' })
  await studio.unmount()
  const [b] = saved.roster as { color: string; kind: string }[]
  expect(b?.color).toBe('#12AB9F')
  expect(b?.kind).toBe('cat')
})
