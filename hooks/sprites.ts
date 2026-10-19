import type { BuddyKind } from '../types'

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

/** Canvas the sprite sits in: one pixel of margin and a row of room to bob. */
export const CANVAS_W = 14
export const CANVAS_H = 14

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

export type Frame = { bob: 0 | 1; isBlinking: boolean }

/** The animation frame at a tick (250ms each); working buddies bob twice as fast. */
export function frameAt(tick: number, isWorking: boolean): Frame {
  const bob = (isWorking ? tick % 2 : Math.floor(tick / 2) % 2) as 0 | 1
  return { bob, isBlinking: tick % 16 === 15 }
}

/** The canvas as rows of 0x00RRGGBB colours, or null where empty. */
export function pixels(kind: BuddyKind, hex: string, frame: Frame): (number | null)[][] {
  const { body, shade, light } = palette(hex)
  const grid: (number | null)[][] = Array.from({ length: CANVAS_H }, () =>
    Array.from({ length: CANVAS_W }, () => null),
  )
  const top = 1 + frame.bob
  const rows = SPRITES[kind]
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      // A blink closes each eye to a single line at its lowest pixel.
      const isLid = ch === 'E' && rows[y + 1]?.[x] !== 'E'
      const color =
        ch === 'B' ? body
        : ch === 'D' ? shade
        : ch === 'L' ? light
        : ch === 'K' ? INK
        : ch === 'W' ? (frame.isBlinking ? body : WHITE)
        : ch === 'E' ? (frame.isBlinking ? (isLid ? shade : body) : INK)
        : null
      const line = grid[top + y]
      if (color !== null && line) line[1 + x] = color
    }
  })
  return grid
}

const DEFAULT = 0x01000000
const UPPER = 0x2580 // ▀
const LOWER = 0x2584 // ▄

/** Raster cells: two pixels per terminal cell with half blocks. */
export function rasterCells(kind: BuddyKind, hex: string, frame: Frame): string {
  const grid = pixels(kind, hex, frame)
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

function rects(grid: (number | null)[][]): string {
  let out = ''
  grid.forEach((row, y) =>
    row.forEach((c, x) => {
      if (c !== null) out += `<rect x="${x}" y="${y}" width="1" height="1" fill="${hexOf(c)}"/>`
    }),
  )
  return out
}

/** An SVG that animates itself (bob + blink) with SMIL, for the desktop surfaces. */
export function svgSource(kind: BuddyKind, hex: string, isWorking: boolean): string {
  const open = pixels(kind, hex, { bob: 0, isBlinking: false })
  const closed = pixels(kind, hex, { bob: 0, isBlinking: true })
  // Only the eye pixels differ between the two; draw those as a blinking overlay.
  const lids = closed.map((row, y) => row.map((c, x) => (c !== open[y]?.[x] ? c : null)))
  const bob = isWorking ? '0.5s' : '1s'
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" shape-rendering="crispEdges">` +
    `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 1" dur="${bob}" calcMode="discrete" repeatCount="indefinite"/>` +
    rects(open) +
    `<g opacity="0"><animate attributeName="opacity" values="0;1;0" keyTimes="0;0.94;0.97" dur="4s" calcMode="discrete" repeatCount="indefinite"/>` +
    rects(lids) +
    `</g></g></svg>`
  )
}
