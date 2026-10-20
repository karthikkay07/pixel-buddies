import type { BuddyKind, Look } from '../types'
import { TICK_MS, clipPose } from './animations'
import type { Clip, EffectKind, Pose } from './animations'
import { INK, WHITE, hexOf, palette } from './color'
import { propDabs } from './props'
import { sceneGrid } from './scenery'
import { LOVE, accessoryDabs, anchorsOf, eyeDabs, patterned } from './style'

// Each sprite is 12x12. Letters: B body, D shade, L highlight, E eye,
// W eye shine, K mouth, '.' empty. The body colours come from the buddy's colour.
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
  cat: [
    '............',
    '.D........D.',
    '.BD......DB.',
    '.BBBBBBBBBB.',
    '.BLBBBBBBBB.',
    '.BWEBBBBWEB.',
    'DBBBBKKBBBBD',
    '.BBBBBBBBBB.',
    '..BBBBBBBB.D',
    '..BBBBBBBB.D',
    '..BBBBBBBBBD',
    '..DD....DD..',
  ],
  dragon: [
    '..D......D..',
    '..DB....BD..',
    '...BBBBBB...',
    '..BBLBBBBB..',
    '..BWEBBWEB..',
    '..BBBBBBBB..',
    '..BBBKKBBB..',
    'D..BBBBBB..D',
    'DD.BLLLLB.DD',
    'DDDBLLLLBDDD',
    '...BBBBBB...',
    '...DD..DD...',
  ],
  cactus: [
    '....BBBB....',
    '...BLBBBB...',
    '.B.BLBBBB.B.',
    '.B.BEBBEB.B.',
    '.BBBBBBBBBB.',
    '...BBKKBB...',
    '...BLBBBB...',
    '...BLBBBB...',
    '...BBBBBB...',
    '..DDDDDDDD..',
    '...DDDDDD...',
    '...DDDDDD...',
  ],
}

export const KINDS: readonly { value: BuddyKind; label: string }[] = [
  { value: 'crab', label: 'Crab' },
  { value: 'blob', label: 'Blob' },
  { value: 'robot', label: 'Robot' },
  { value: 'ghost', label: 'Ghost' },
  { value: 'cat', label: 'Cat' },
  { value: 'dragon', label: 'Dragon' },
  { value: 'cactus', label: 'Cactus' },
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
 * The stage: wide enough for the buddy to wander, tall enough for hats and
 * hops. The buddy's home is the middle; effects float to the right of its
 * head wherever it stands. The height is even: the terminal draws two pixel
 * rows per cell.
 */
export const CANVAS_W = 40
export const CANVAS_H = 18
/** Where the sprite's left edge stands when it has not wandered. */
const HOME_X = 14
const SPRITE_Y = 5
/** Effects sit a little lower than the canvas top, beside the head. */
const EFFECT_Y = 2

type Glyph = { color: number; rows: readonly string[]; x: number; y: number }

/** Effect glyphs by frame, in sprite columns (12 and up is just right of the head). */
function effectGlyphs(kind: EffectKind, frame: number): Glyph[] {
  switch (kind) {
    case 'bang':
      return [{ color: 0xffd84d, x: 14, y: 1, rows: ['X', 'X', 'X', '.', 'X'] }]
    case 'dots':
      return [{ color: 0xd8dbe6, x: 12, y: 2, rows: ['X.X.X'.slice(0, frame * 2 + 1)] }]
    case 'heart':
      return [{ color: 0xff5a7a, x: 12, y: 1 - frame, rows: ['XX.XX', 'XXXXX', '.XXX.', '..X..'] }]
    case 'sparkle':
      return frame === 0
        ? [
            { color: 0xffe066, x: 12, y: 1, rows: ['.X.', 'XXX', '.X.'] },
            { color: 0xffffff, x: 15, y: 5, rows: ['X'] },
          ]
        : [
            { color: 0xffe066, x: 14, y: 3, rows: ['.X.', 'XXX', '.X.'] },
            { color: 0xffffff, x: 12, y: 0, rows: ['X'] },
          ]
    case 'sweat':
      return [{ color: 0x7fd3ff, x: 12, y: 3 + frame, rows: ['.X', 'XX', 'XX'] }]
    case 'zzz':
      return [{ color: 0xb9c6ff, x: 12 + frame, y: 5 - frame * 2, rows: ['XXXX', '..X.', '.X..', 'XXXX'] }]
    case 'note':
      return [{ color: 0x9ee6a0, x: 12, y: frame, rows: ['..XX', '..X.', '..X.', 'XXX.', 'XX..'] }]
    case 'question':
      return [{ color: 0xe6e8f0, x: 12, y: 0, rows: ['XXX', '..X', '.XX', '...', '.X.'] }]
  }
}

/**
 * The canvas for one pose of a look, as rows of 0x00RRGGBB colours, or null
 * where empty. Everything belonging to the buddy (body, face, accessory,
 * prop) is drawn in sprite space first, so squashing and turning around
 * apply to all of it alike.
 */
export function pixels(look: Look, pose: Pose, scene = 0): (number | null)[][] {
  const { body, shade, light } = palette(look.color)
  const { eyes: eyeStyle, pattern, accessory } = look.style
  const rows = SPRITES[look.kind]
  const a = anchorsOf(rows)
  const local = new Map<string, { x: number; y: number; color: number }>()
  const put = (x: number, y: number, color: number) => local.set(`${x},${y}`, { x, y, color })

  // The eye style shows while the eyes are open; an expression takes over otherwise.
  const style = pose.eyes === 'open' ? eyeStyle : pose.eyes === 'wide' ? 'big' : 'classic'
  const isOpen = pose.eyes === 'open' || pose.eyes === 'wide'
  // Looking left moves the pupil to where the shine was.
  const lookLeft = pose.look === 'left' && isOpen
  const later: { x: number; y: number; color: number }[] = []
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      // An eye's lowest pixel is its lid: a closed eye is a line there.
      const isLid = ch === 'E' && rows[y + 1]?.[x] !== 'E'
      const shineColor =
        pose.eyes === 'closed' || pose.eyes === 'happy' || pose.eyes === 'sad' ? body
        : style === 'dots' ? body
        : style === 'sleepy' ? shade
        : style === 'love' ? LOVE.shine
        : WHITE
      const pupilColor = (isLidPixel: boolean) =>
        pose.eyes === 'closed' ? (isLidPixel ? shade : body)
        : pose.eyes === 'happy' ? (isLidPixel ? INK : body)
        : style === 'love' ? LOVE.iris
        : style === 'sleepy' && !isLidPixel ? shade
        : INK
      let color: number | null = null
      if (ch === 'B') color = patterned(pattern, body, light, x, y, a)
      else if (ch === 'D') color = shade
      else if (ch === 'L') color = light
      else if (ch === 'W') {
        const next = row[x + 1]
        color = lookLeft && next === 'E' ? pupilColor(rows[y + 1]?.[x + 1] !== 'E') : shineColor
      } else if (ch === 'E') {
        color = lookLeft && row[x - 1] === 'W' ? shineColor : pupilColor(isLid)
      } else if (ch === 'K') {
        color = pose.mouth === 'smile' || pose.mouth === 'open' ? INK : pose.mouth === 'flat' ? shade : body
        if (pose.mouth === 'open') later.push({ x, y: y + 1, color: INK })
      }
      if (color !== null) put(x, y, color)
    }
  })
  for (const d of later) put(d.x, d.y, d.color)
  if (isOpen) for (const d of eyeDabs(style, a, INK)) put(d.x, d.y, d.color)
  for (const d of accessoryDabs(accessory, a)) put(d.x, d.y, d.color)
  if (pose.prop) for (const d of propDabs(pose.prop.kind, pose.prop.frame, a, { body, light })) put(d.x, d.y, d.color)

  // Squash removes body rows just below the mouth (everything above drops
  // down); a stretch doubles that row (everything above rises).
  const squash = pose.squash ?? 0
  const cut = Math.min(a.mouthY + 1, 10)
  const flip = pose.flip === true
  // Home, as far as the story has rebuilt it, behind everything else.
  const grid = sceneGrid(scene, CANVAS_W, CANVAS_H)
  const fade = pose.fade ?? 0
  const left = HOME_X + pose.dx
  const top = SPRITE_Y + pose.dy
  const paint = (x: number, y: number, color: number) => {
    if (fade === 1 && (x + y) % 2 === 0) return
    if (fade >= 2 && (x + y) % 4 !== 0) return
    const line = grid[top + y]
    const cx = left + (flip ? 11 - x : x)
    if (line && cx >= 0 && cx < CANVAS_W) line[cx] = color
  }
  // Draw from the top down so lower rows win where squashed rows meet.
  const dots = [...local.values()].sort((p, q) => p.y - q.y)
  for (const { x, y, color } of dots) {
    if (squash > 0) {
      if (y >= cut && y < cut + squash) continue
      paint(x, y < cut ? y + squash : y, color)
    } else if (squash < 0) {
      if (y < cut) paint(x, y - 1, color)
      else if (y === cut) {
        paint(x, y - 1, color)
        paint(x, y, color)
      } else paint(x, y, color)
    } else paint(x, y, color)
  }

  if (pose.effect) {
    for (const g of effectGlyphs(pose.effect.kind, pose.effect.frame)) {
      g.rows.forEach((row, dy) => {
        for (let dx = 0; dx < row.length; dx++) {
          const line = grid[g.y + dy + EFFECT_Y]
          const cx = left + g.x + dx
          if (row[dx] === 'X' && line && cx >= 0 && cx < CANVAS_W) line[cx] = g.color
        }
      })
    }
  }
  return grid
}

const DEFAULT = 0x01000000
const UPPER = 0x2580 // ▀
const LOWER = 0x2584 // ▄

/** Raster cells for one tick of a clip: two pixels per terminal cell. */
export function rasterCells(look: Look, clip: Clip, tick: number, scene = 0): string {
  const grid = pixels(look, clipPose(clip, tick), scene)
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

/** One frame as a path per colour, each row's runs merged. */
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
 * An SVG that plays a whole clip by itself (SMIL), for the desktop surfaces.
 * Each distinct picture of the buddy is drawn once (where the buddy stands
 * aside), and each stretch of the clip shows one of them, moved to where the
 * buddy stands then: a walk is two pictures, however far it goes.
 * `id` keeps the frames apart when several of these share a page.
 */
export function svgSource(look: Look, clip: Clip, id = 'f', scene = 0): string {
  const frames = new Map<string, string>()
  const segments: { frame: string; dx: number; start: number; end: number }[] = []
  for (let t = 0; t < clip.length; t++) {
    const pose = clipPose(clip, t)
    const drawn = paths(pixels(look, { ...pose, dx: 0 }))
    let frame = frames.get(drawn)
    if (frame === undefined) {
      frame = `${id}${frames.size}`
      frames.set(drawn, frame)
    }
    const last = segments[segments.length - 1]
    if (last && last.frame === frame && last.dx === pose.dx) last.end = t + 1
    else segments.push({ frame, dx: pose.dx, start: t, end: t + 1 })
  }
  const defs = [...frames].map(([drawn, frame]) => `<g id="${frame}">${drawn}</g>`).join('')
  const dur = `${(clip.length * TICK_MS) / 1000}s`
  let body = ''
  for (const seg of segments) {
    const at = seg.dx === 0 ? '' : ` x="${seg.dx}"`
    if (segments.length === 1) {
      body += `<use href="#${seg.frame}"${at}/>`
      continue
    }
    const s = seg.start / clip.length
    const e = seg.end / clip.length
    const [values, times] =
      s === 0 ? ['visible;hidden', `0;${fraction(e)}`]
      : e === 1 ? ['hidden;visible', `0;${fraction(s)}`]
      : ['hidden;visible;hidden', `0;${fraction(s)};${fraction(e)}`]
    body +=
      `<use href="#${seg.frame}"${at} visibility="${s === 0 ? 'visible' : 'hidden'}">` +
      `<animate attributeName="visibility" values="${values}" keyTimes="${times}" dur="${dur}" calcMode="discrete" repeatCount="indefinite"/>` +
      '</use>'
  }
  // The scenery stays put while the buddy moves, so it is drawn once, behind.
  const backdrop = scene > 0 ? paths(sceneGrid(scene, CANVAS_W, CANVAS_H)) : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" shape-rendering="crispEdges"><defs>${defs}</defs>${backdrop}${body}</svg>`
}
