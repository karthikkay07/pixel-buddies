import type { Anim, BuddyKind } from '../types'
import { ANIMS, TICK_MS, poseAt } from './animations'
import type { EffectKind, Pose } from './animations'

// Each sprite is 12x12. Letters: B body, D shade, L highlight, E eye,
// W eye shine, K ink, '.' empty. The body colours come from the buddy's colour.
export const SPRITES: Record<BuddyKind, readonly string[]> = {
  crab: [
    '............',
    '............',
    '.BB......BB.',
    'BDB......BDB',
    '.B........B.',
    '.B.BBBBBB.B.',
    '.BBBLBBBBBB.',
    '..BWEBBWEB..',
    '..BBBBBBBB..',
    '..DBBKKBBD..',
    '...DDDDDD...',
    '..D.D..D.D..',
  ],
  blob: [
    '............',
    '............',
    '....BBBB....',
    '...BLLBBB...',
    '..BLBBBBBB..',
    '.BBBBBBBBBB.',
    '.BBWEBBWEBB.',
    '.BBBEBBBEBB.',
    'BBBBBKKBBBBB',
    'BBBBBBBBBBBB',
    'BBBBBBBBBBBB',
    '.DDDDDDDDDD.',
  ],
  robot: [
    '.....DD.....',
    '.....BB.....',
    '..DDDDDDDD..',
    '..DLBBBBBD..',
    '..DWEBWEBD..',
    '..DBBBBBBD..',
    '..DBBKKBBD..',
    '..DDDDDDDD..',
    '.DBBBBBBBBD.',
    '.D.BBLBBB.D.',
    '...BB..BB...',
    '...DD..DD...',
  ],
  ghost: [
    '....BBBB....',
    '..BBLLBBBB..',
    '.BBLBBBBBBB.',
    '.BBBBBBBBBB.',
    '.BWEBBBWEBB.',
    '.BBEBBBBEBB.',
    '.BBBBBBBBBB.',
    '.BBBBKKBBBB.',
    '.BBBBBBBBBB.',
    '.BBBBBBBBBB.',
    '.BB.BBB.BBB.',
    '.D...D...D..',
  ],
}

export const KINDS: readonly { value: BuddyKind; label: string }[] = [
  { value: 'crab', label: 'Crab' },
  { value: 'blob', label: 'Blob' },
  { value: 'robot', label: 'Robot' },
  { value: 'ghost', label: 'Ghost' },
]

export const COLORS: readonly { value: string; label: string }[] = [
  { value: '#F07858', label: 'Coral' },
  { value: '#4FA3E0', label: 'Sky' },
  { value: '#3CC48C', label: 'Mint' },
  { value: '#F2C230', label: 'Sunny' },
  { value: '#9B6BDB', label: 'Grape' },
  { value: '#E86A9A', label: 'Rose' },
  { value: '#7A8899', label: 'Slate' },
]

export const NAMES = ['Pixel', 'Bloop', 'Nibbles', 'Sprocket', 'Mochi', 'Zig', 'Pebble', 'Bit']

/**
 * The canvas: the 12x12 sprite with room to hop above it, sway either side,
 * and a column on the right for effects (!, hearts, Zzz, ...).
 */
export const CANVAS_W = 19
export const CANVAS_H = 16
const SPRITE_X = 2
const SPRITE_Y = 3

const INK = 0x1e1e24
const WHITE = 0xffffff

function parseHex(hex: string): number {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return Number.isFinite(n) ? n & 0xffffff : 0xf07858
}

function mix(rgb: number, toward: number, amount: number): number {
  const channel = (shift: number) => {
    const a = (rgb >> shift) & 0xff
    const b = (toward >> shift) & 0xff
    return Math.round(a + (b - a) * amount) << shift
  }
  return channel(16) | channel(8) | channel(0)
}

export function palette(hex: string) {
  const body = parseHex(hex)
  return { body, shade: mix(body, 0x000000, 0.35), light: mix(body, WHITE, 0.45) }
}

type Glyph = { color: number; rows: readonly string[]; x: number; y: number }

/** Effect glyphs by frame, drawn in the right-hand column. */
function effectGlyphs(kind: EffectKind, frame: number): Glyph[] {
  switch (kind) {
    case 'bang':
      return [{ color: 0xffd84d, x: 16, y: 1, rows: ['X', 'X', 'X', '.', 'X'] }]
    case 'dots':
      return [{ color: 0xd8dbe6, x: 14, y: 2, rows: ['X.X.X'.slice(0, frame * 2 + 1)] }]
    case 'heart':
      return [{ color: 0xff5a7a, x: 14, y: 1 - frame, rows: ['XX.XX', 'XXXXX', '.XXX.', '..X..'] }]
    case 'sparkle':
      return frame === 0
        ? [
            { color: 0xffe066, x: 14, y: 1, rows: ['.X.', 'XXX', '.X.'] },
            { color: 0xffffff, x: 17, y: 5, rows: ['X'] },
          ]
        : [
            { color: 0xffe066, x: 16, y: 3, rows: ['.X.', 'XXX', '.X.'] },
            { color: 0xffffff, x: 14, y: 0, rows: ['X'] },
          ]
    case 'sweat':
      return [{ color: 0x7fd3ff, x: 14, y: 3 + frame, rows: ['.X', 'XX', 'XX'] }]
    case 'zzz':
      return [{ color: 0xb9c6ff, x: 14 + frame, y: 5 - frame * 2, rows: ['XXXX', '..X.', '.X..', 'XXXX'] }]
    case 'note':
      return [{ color: 0x9ee6a0, x: 14, y: frame, rows: ['..XX', '..X.', '..X.', 'XXX.', 'XX..'] }]
  }
}

/** The canvas for one pose, as rows of 0x00RRGGBB colours, or null where empty. */
export function pixels(kind: BuddyKind, hex: string, pose: Pose): (number | null)[][] {
  const { body, shade, light } = palette(hex)
  const grid: (number | null)[][] = Array.from({ length: CANVAS_H }, () =>
    Array.from({ length: CANVAS_W }, () => null),
  )
  const put = (x: number, y: number, color: number) => {
    const line = grid[y]
    if (line && x >= 0 && x < CANVAS_W) line[x] = color
  }
  const left = SPRITE_X + pose.dx
  const top = SPRITE_Y + pose.dy
  const rows = SPRITES[kind]
  const openMouth: [number, number][] = []
  const wideEyes: [number, number][] = []
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      // An eye's lowest pixel is its lid: a closed eye is a line there.
      const isLid = ch === 'E' && rows[y + 1]?.[x] !== 'E'
      let color: number | null = null
      if (ch === 'B') color = body
      else if (ch === 'D') color = shade
      else if (ch === 'L') color = light
      else if (ch === 'W') color = pose.eyes === 'open' || pose.eyes === 'wide' ? WHITE : body
      else if (ch === 'E') {
        color =
          pose.eyes === 'closed' ? (isLid ? shade : body)
          : pose.eyes === 'happy' ? (isLid ? INK : body)
          : INK
        // Wide eyes grow a white pixel above each eye.
        if (pose.eyes === 'wide' && rows[y - 1]?.[x] !== 'E') wideEyes.push([left + x, top + y - 1])
      } else if (ch === 'K') {
        color = pose.mouth === 'smile' || pose.mouth === 'open' ? INK : pose.mouth === 'flat' ? shade : body
        if (pose.mouth === 'open') openMouth.push([left + x, top + y + 1])
      }
      if (color !== null) put(left + x, top + y, color)
    }
  })
  for (const [x, y] of openMouth) put(x, y, INK)
  for (const [x, y] of wideEyes) put(x, y, WHITE)
  if (pose.effect) {
    for (const g of effectGlyphs(pose.effect.kind, pose.effect.frame)) {
      g.rows.forEach((row, dy) => {
        for (let dx = 0; dx < row.length; dx++) if (row[dx] === 'X') put(g.x + dx, g.y + dy, g.color)
      })
    }
  }
  return grid
}

const DEFAULT = 0x01000000
const UPPER = 0x2580 // ▀
const LOWER = 0x2584 // ▄

/** Raster cells for one tick of an animation: two pixels per terminal cell. */
export function rasterCells(kind: BuddyKind, hex: string, anim: Anim, tick: number): string {
  const grid = pixels(kind, hex, poseAt(anim, tick))
  const rows = CANVAS_H / 2
  const words = new Uint32Array(CANVAS_W * rows * 3)
  for (let r = 0; r < rows; r++) {
    for (let x = 0; x < CANVAS_W; x++) {
      const top = grid[r * 2]?.[x] ?? null
      const bottom = grid[r * 2 + 1]?.[x] ?? null
      const i = (r * CANVAS_W + x) * 3
      if (top !== null) {
        words.set([UPPER, top, bottom ?? DEFAULT], i)
      } else if (bottom !== null) {
        words.set([LOWER, bottom, DEFAULT], i)
      } else {
        words.set([0x20, DEFAULT, DEFAULT], i)
      }
    }
  }
  return toBase64(new Uint8Array(words.buffer))
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function toBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += B64.charAt((n >> 18) & 63) + B64.charAt((n >> 12) & 63)
    out += i + 1 < bytes.length ? B64.charAt((n >> 6) & 63) : '='
    out += i + 2 < bytes.length ? B64.charAt(n & 63) : '='
  }
  return out
}

function hexOf(rgb: number): string {
  return '#' + rgb.toString(16).padStart(6, '0')
}

/** One frame as a path per colour, each row's runs merged: small enough to hold many frames. */
function paths(grid: (number | null)[][]): string {
  const byColor = new Map<number, string>()
  grid.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const c = row[x]
      if (c === null || c === undefined) {
        x++
        continue
      }
      let end = x + 1
      while (end < row.length && row[end] === c) end++
      byColor.set(c, (byColor.get(c) ?? '') + `M${x} ${y}h${end - x}v1h-${end - x}z`)
      x = end
    }
  })
  let out = ''
  for (const [c, d] of byColor) out += `<path fill="${hexOf(c)}" d="${d}"/>`
  return out
}

function fraction(n: number): string {
  return String(Math.round(n * 10000) / 10000)
}

/**
 * An SVG that plays a whole animation by itself (SMIL), for the desktop
 * surfaces: each distinct frame is a group shown for its share of the cycle.
 */
export function svgSource(kind: BuddyKind, hex: string, anim: Anim): string {
  const { length } = ANIMS[anim]
  const segments: { svg: string; start: number; end: number }[] = []
  for (let t = 0; t < length; t++) {
    const svg = paths(pixels(kind, hex, poseAt(anim, t)))
    const last = segments[segments.length - 1]
    if (last && last.svg === svg) last.end = t + 1
    else segments.push({ svg, start: t, end: t + 1 })
  }
  const dur = `${(length * TICK_MS) / 1000}s`
  let body = ''
  if (segments.length === 1) {
    body = segments[0]?.svg ?? ''
  } else {
    for (const seg of segments) {
      const s = seg.start / length
      const e = seg.end / length
      const [values, times] =
        s === 0 ? ['visible;hidden', `0;${fraction(e)}`]
        : e === 1 ? ['hidden;visible', `0;${fraction(s)}`]
        : ['hidden;visible;hidden', `0;${fraction(s)};${fraction(e)}`]
      body +=
        `<g visibility="${s === 0 ? 'visible' : 'hidden'}">` +
        `<animate attributeName="visibility" values="${values}" keyTimes="${times}" dur="${dur}" calcMode="discrete" repeatCount="indefinite"/>` +
        seg.svg +
        '</g>'
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" shape-rendering="crispEdges">${body}</svg>`
}
