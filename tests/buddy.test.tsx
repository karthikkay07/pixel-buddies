import { expect, mock, test } from 'claude-code/testing'

import { ANIMS, ANIM_NAMES, clipOf, poseAt } from '../hooks/animations'

// 40x9 cells of 3 u32s = 4320 bytes = 5760 base64 characters.
const RASTER_LENGTH = 5760
import { CANVAS_H, CANVAS_W, KINDS, SPRITES, pixels, rasterCells, svgSource } from '../hooks/sprites'
import { DEFAULT_STYLE } from '../hooks/style'

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

test('every animation draws for every type, in the terminal and as SVG', async () => {
  for (const { value: kind } of KINDS) {
    for (const anim of ANIM_NAMES) {
      expect(rasterCells({ kind, color: '#4FA3E0', style: DEFAULT_STYLE }, clipOf(anim), 3).length).toBe(RASTER_LENGTH)
      // The busiest look there is, to stay well under the Svg element's limit.
      const svg = svgSource({ kind, color: '#9B6BDB', style: { eyes: 'angry', pattern: 'spots', accessory: 'headphones' } }, clipOf(anim))
      expect(svg.startsWith('<svg')).toBe(true)
      expect(svg.length < 131072).toBe(true)
      expect(svg.includes('<animate')).toBe(true)
    }
  }
})

test('poses loop, bob, blink and float their effects', async () => {
  expect(poseAt('idle', 0)).toEqual(poseAt('idle', ANIMS.idle.length))
  expect(poseAt('idle', -1)).toEqual(poseAt('idle', ANIMS.idle.length - 1))
  expect(poseAt('idle', 4).dy).toBe(1)
  expect(poseAt('idle', 31).eyes).toBe('closed')
  expect(poseAt('happy', 3).dy).toBe(-3)
  expect(poseAt('sleeping', 0).effect?.kind).toBe('zzz')
  expect(poseAt('sad', 0).eyes).toBe('sad')
  const grid = pixels({ kind: 'crab', color: '#F07858', style: DEFAULT_STYLE }, poseAt('surprised', 0))
  expect(grid.length).toBe(CANVAS_H)
  expect(grid.every(row => row.length === CANVAS_W)).toBe(true)
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
  // A day outside every season, so no seasonal achievement joins in.
  mock.clock(on, { now: new Date(2026, 8, 14, 12, 0).getTime() })
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
  expect(toasts).toEqual([
    'Sprocket-terminal the nerd robot is ready.',
    '🏆 Hello, friend: Dots eyes and Belly pattern unlocked! Try it in /buddy',
    'Sprocket-desktop the nerd robot is ready.',
  ])
})
