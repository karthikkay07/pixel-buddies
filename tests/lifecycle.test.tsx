import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 80, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const STUDIO = {
  component: 'Pane',
  requestId: 'buddy-studio',
  props: { title: 'Buddy studio', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

test('restore, hide and show, switch, save as new, and delete', async ($, on) => {
  // A store as a previous session (and a careless hand edit) left it.
  const saved: Record<string, unknown> = {
    roster: [
      { id: 'a', name: 'Alpha', kind: 'crab', color: '#F07858' },
      { id: 'b', name: 'Beta', kind: 'ghost', color: '#9B6BDB' },
      { id: 'x', name: 'Broken', kind: 'unicorn', color: '#000000' },
      'junk',
    ],
    activeId: 'gone',
    isHidden: false,
  }
  const commands: string[] = []
  const opened: string[] = []
  on('store.get', ($, e) => ({ value: saved[e.key] }))
  on('store.set', ($, e) => {
    saved[e.key] = e.value
    return { value: undefined }
  })
  on('command.register', ($, e) => {
    commands.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  // The engine's own band beneath: nothing to show.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  mock.clock(on, { now: new Date(2026, 8, 14, 12, 0).getTime() })

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  expect(commands).toEqual(['buddy'])

  // The broken entries are gone and the missing active id fell back to the first.
  const band = async () => {
    const ui = await $.ui.mount({ plugin: 'pixel-buddies', surface: 'desktop', ...BAND })
    const names = (await ui.findAll({ type: 'Text' })).map(t => t.text)
    await ui.unmount()
    return names
  }
  expect(await band()).toContain('Alpha')
  expect((await band()).some(t => t.includes('Broken'))).toBe(false)

  // /buddy hide and /buddy show, remembered in the store.
  expect((await $.command.run({ command: 'buddy', args: 'hide', ...RUN })).text).toContain('hidden')
  expect(await band()).not.toContain('Alpha')
  expect(saved.isHidden).toBe(true)
  expect((await $.command.run({ command: 'buddy', args: ' SHOW ', ...RUN })).text).toBe('Buddy is back.')
  expect(await band()).toContain('Alpha')
  expect(saved.isHidden).toBe(false)

  // /buddy opens the studio.
  await $.command.run({ command: 'buddy', args: '', ...RUN })
  expect(opened).toEqual(['buddy-studio'])

  const studio = await $.ui.mount({ plugin: 'pixel-buddies', surface: 'desktop', ...STUDIO })

  // Use another buddy.
  await studio.press({ key: 'use-b' })
  expect(saved.activeId).toBe('b')
  expect(await band()).toContain('Beta')

  // Save as new keeps Beta and adds the design as a third buddy.
  await studio.input({ key: 'name', text: 'Gamma', kind: 'change' })
  await studio.select({ key: 'kind', value: 'blob' })
  await studio.press({ key: 'new' })
  const afterNew = saved.roster as { id: string; name: string; kind: string }[]
  expect(afterNew.map(b => b.name)).toEqual(['Alpha', 'Beta', 'Gamma'])
  const gamma = afterNew[2]!
  expect(gamma.kind).toBe('blob')
  expect(saved.activeId).toBe(gamma.id)

  // Deleting the active buddy falls back to the first one left.
  await studio.press({ key: `del-${gamma.id}` })
  expect((saved.roster as { name: string }[]).map(b => b.name)).toEqual(['Alpha', 'Beta'])
  expect(saved.activeId).toBe('a')

  // Deleting the rest leaves the empty state with its "Make one" button.
  await studio.press({ key: 'del-a' })
  await studio.press({ key: 'del-b' })
  await studio.unmount()
  expect(saved.roster).toEqual([])
  expect(saved.activeId).toBe(null)
  const empty = await $.ui.mount({ plugin: 'pixel-buddies', surface: 'desktop', ...BAND })
  expect(await empty.find({ key: 'make' })).toBeDefined()
  await empty.unmount()
})
