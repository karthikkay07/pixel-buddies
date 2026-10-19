import { expect, test } from 'claude-code/testing'

import { CANVAS_H, CANVAS_W, KINDS, SPRITES, frameAt, pixels, rasterCells, svgSource } from '../hooks/sprites'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 80, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const STUDIO = {
  component: 'Pane',
  requestId: 'buddy-studio',
  props: { title: 'Buddy studio', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

test('every sprite is 12x12 and uses only known letters', async () => {
  for (const { value } of KINDS) {
    const rows = SPRITES[value]
    expect(rows.length).toBe(12)
    for (const row of rows) {
      expect(row.length).toBe(12)
      expect(/^[BDLEWK.]+$/.test(row)).toBe(true)
    }
  }
})

test('frames bob, blink, and draw into the canvas', async () => {
  expect(frameAt(0, false)).toEqual({ bob: 0, isBlinking: false })
  expect(frameAt(2, false).bob).toBe(1)
  expect(frameAt(1, true).bob).toBe(1)
  expect(frameAt(15, false).isBlinking).toBe(true)
  const grid = pixels('crab', '#F07858', frameAt(0, false))
  expect(grid.length).toBe(CANVAS_H)
  expect(grid.every(row => row.length === CANVAS_W)).toBe(true)
  // 14x7 cells of 3 u32s = 1176 bytes = 1568 base64 characters.
  expect(rasterCells('robot', '#4FA3E0', frameAt(3, true)).length).toBe(1568)
  const svg = svgSource('ghost', '#9B6BDB', true)
  expect(svg.startsWith('<svg')).toBe(true)
  expect(svg.includes('dur="0.5s"')).toBe(true)
  expect(svg.length < 131072).toBe(true)
})

test('make a buddy in the studio and see it above the prompt', async ($, on) => {
  const saved: Record<string, unknown> = {}
  const toasts: string[] = []
  on('store.set', ($, e) => {
    saved[e.key] = e.value
    return { value: undefined }
  })
  on('store.get', ($, e) => ({ value: saved[e.key] }))
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ plugin: 'pixel-buddies', surface, ...BAND })
    if (surface === 'terminal') {
      expect(await band.find({ key: 'make' })).toBeDefined()
    }
    await band.unmount()

    const studio = await $.ui.mount({ plugin: 'pixel-buddies', surface, ...STUDIO })
    await studio.select({ key: 'kind', value: 'robot' })
    await studio.select({ key: 'color', value: '#3CC48C' })
    await studio.input({ key: 'name', text: `Sprocket-${surface}`, kind: 'change' })
    await studio.press({ key: 'save' })
    expect(await studio.find({ type: 'Text', text: `Sprocket-${surface}` })).toBeDefined()
    await studio.unmount()

    const shown = await $.ui.mount({ plugin: 'pixel-buddies', surface, ...BAND })
    expect(await shown.find({ type: 'Text', text: `Sprocket-${surface}` })).toBeDefined()
    expect(await shown.find({ type: surface === 'terminal' ? 'Raster' : 'Svg' })).toBeDefined()
    await shown.unmount()
  }
  // The second save edits the active buddy rather than adding another.
  const roster = saved.roster as { name: string; kind: string; color: string }[]
  expect(roster.map(b => b.name)).toEqual(['Sprocket-desktop'])
  expect(roster[0]?.kind).toBe('robot')
  expect(roster[0]?.color).toBe('#3CC48C')
  expect(toasts).toEqual(['Sprocket-terminal the robot is ready.', 'Sprocket-desktop the robot is ready.'])
})
