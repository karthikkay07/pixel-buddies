import type { Accessory, EyeStyle, Pattern, Style } from '../types'
import { BLACK, WHITE, mix } from './color'

export const DEFAULT_STYLE: Style = { eyes: 'classic', pattern: 'plain', accessory: 'none' }

export const EYE_STYLES: readonly { value: EyeStyle; label: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'dots', label: 'Dots' },
  { value: 'big', label: 'Big & shiny' },
  { value: 'sleepy', label: 'Sleepy' },
  { value: 'angry', label: 'Angry' },
  { value: 'love', label: 'Love' },
]

export const PATTERNS: readonly { value: Pattern; label: string }[] = [
  { value: 'plain', label: 'Plain' },
  { value: 'spots', label: 'Spots' },
  { value: 'stripes', label: 'Stripes' },
  { value: 'belly', label: 'Belly' },
  { value: 'gradient', label: 'Gradient' },
]

export const ACCESSORIES: readonly { value: Accessory; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'crown', label: 'Crown' },
  { value: 'party', label: 'Party hat' },
  { value: 'beanie', label: 'Beanie' },
  { value: 'bow', label: 'Bow' },
  { value: 'flower', label: 'Flower' },
  { value: 'headphones', label: 'Headphones' },
  { value: 'shades', label: 'Shades' },
  { value: 'scarf', label: 'Scarf' },
]

export function isEyeStyle(value: unknown): value is EyeStyle {
  return EYE_STYLES.some(o => o.value === value)
}
export function isPattern(value: unknown): value is Pattern {
  return PATTERNS.some(o => o.value === value)
}
export function isAccessory(value: unknown): value is Accessory {
  return ACCESSORIES.some(o => o.value === value)
}

/**
 * Where things sit on a sprite, read from its letters so a new type needs no
 * numbers of its own: the eyes, the top of the head, the mouth, and the head's
 * edges at eye height. In sprite coordinates (0 to 11).
 */
export type Anchors = {
  eyes: { x: number; y: number }[]
  left: { x: number; y: number }[]
  right: { x: number; y: number }[]
  eyeTop: number
  eyeMinX: number
  eyeMaxX: number
  headTop: number
  headLeft: number
  headRight: number
  mouthY: number
  centerX: number
}

const cache = new Map<readonly string[], Anchors>()

export function anchorsOf(rows: readonly string[]): Anchors {
  const hit = cache.get(rows)
  if (hit) return hit
  const eyes: { x: number; y: number }[] = []
  let mouthY = -1
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === 'E' || row[x] === 'W') eyes.push({ x, y })
      if (row[x] === 'K' && mouthY < 0) mouthY = y
    }
  })
  const xs = eyes.map(e => e.x)
  const eyeMinX = Math.min(...xs)
  const eyeMaxX = Math.max(...xs)
  const eyeTop = Math.min(...eyes.map(e => e.y))
  const mid = (rows[0]?.length ?? 12) / 2
  let headTop = eyeTop
  for (let y = 0; y < eyeTop; y++) {
    const row = rows[y] ?? ''
    if ([...row.slice(eyeMinX, eyeMaxX + 1)].some(c => c !== '.')) {
      headTop = y
      break
    }
  }
  const eyeRow = rows[eyeTop] ?? ''
  const filled = [...eyeRow].map((c, x) => (c !== '.' ? x : -1)).filter(x => x >= 0)
  const anchors: Anchors = {
    eyes,
    left: eyes.filter(e => e.x < mid),
    right: eyes.filter(e => e.x >= mid),
    eyeTop,
    eyeMinX,
    eyeMaxX,
    headTop,
    headLeft: Math.min(...filled),
    headRight: Math.max(...filled),
    mouthY: mouthY < 0 ? eyeTop + 2 : mouthY,
    centerX: Math.floor((eyeMinX + eyeMaxX) / 2),
  }
  cache.set(rows, anchors)
  return anchors
}

/** The colour of a body pixel under a pattern, by its place in the sprite. */
export function patterned(pattern: Pattern, body: number, light: number, x: number, y: number, a: Anchors): number {
  switch (pattern) {
    case 'plain':
      return body
    case 'spots':
      return (x * 5 + y * 3) % 7 === 0 ? mix(body, BLACK, 0.22) : body
    case 'stripes':
      return y % 3 === 2 ? mix(body, BLACK, 0.18) : body
    case 'belly':
      return y > a.mouthY && x >= a.eyeMinX && x <= a.eyeMaxX ? light : body
    case 'gradient':
      return y < 4 ? mix(body, WHITE, 0.2) : y >= 8 ? mix(body, BLACK, 0.18) : body
  }
}

/** A pixel an accessory draws, in sprite coordinates (it may stick out above or beside). */
export type Dab = { x: number; y: number; color: number }

function stamp(rows: readonly string[], x0: number, y0: number, colors: Record<string, number>): Dab[] {
  const out: Dab[] = []
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const color = colors[row[dx] ?? '.']
      if (color !== undefined) out.push({ x: x0 + dx, y: y0 + dy, color })
    }
  })
  return out
}

const GOLD = 0xf5c542
const RUBY = 0xe8455a
const PINK = 0xff6fae
const BERRY = 0xd64c8b
const PARTY = 0xe85aad
const LEMON = 0xffe066
const PETAL = 0xff8fc7
const SUN = 0xffd84d
const GRAPHITE = 0x3a3f4b
const STEEL = 0x8a93a6
const SHADES = 0x15151b
const RED = 0xe8455a
const DARK_RED = 0xb8323f

/** The pixels an accessory adds to a sprite. */
export function accessoryDabs(accessory: Accessory, a: Anchors): Dab[] {
  const cx = a.centerX
  switch (accessory) {
    case 'none':
      return []
    case 'crown':
      return stamp(['G.G.G', 'GGRGG'], cx - 2, a.headTop - 2, { G: GOLD, R: RUBY })
    case 'party':
      return stamp(['..W..', '..M..', '.MYM.', 'MYMYM'], cx - 2, a.headTop - 4, { M: PARTY, Y: LEMON, W: WHITE })
    case 'beanie': {
      const dabs: Dab[] = [{ x: cx, y: a.headTop - 3, color: WHITE }]
      for (let x = a.eyeMinX; x <= a.eyeMaxX; x++) dabs.push({ x, y: a.headTop - 2, color: RED })
      for (let x = a.eyeMinX - 1; x <= a.eyeMaxX + 1; x++) dabs.push({ x, y: a.headTop - 1, color: DARK_RED })
      return dabs
    }
    case 'bow':
      return stamp(['X...X', 'XXOXX', 'X...X'], a.eyeMaxX - 2, a.headTop - 2, { X: PINK, O: BERRY })
    case 'flower':
      return stamp(['.P.', 'PYP', '.P.'], a.eyeMinX - 1, a.headTop - 2, { P: PETAL, Y: SUN })
    case 'headphones': {
      const dabs: Dab[] = []
      const l = a.headLeft - 1
      const r = a.headRight + 1
      for (let x = l + 1; x <= r - 1; x++) dabs.push({ x, y: a.headTop - 1, color: GRAPHITE })
      for (let y = a.headTop; y < a.eyeTop; y++) {
        dabs.push({ x: l, y, color: GRAPHITE }, { x: r, y, color: GRAPHITE })
      }
      for (let y = a.eyeTop; y <= a.eyeTop + 1; y++) {
        dabs.push({ x: l, y, color: STEEL }, { x: r, y, color: STEEL })
      }
      return dabs
    }
    case 'shades': {
      const dabs: Dab[] = []
      for (const side of [a.left, a.right]) {
        if (side.length === 0) continue
        const minX = Math.min(...side.map(e => e.x)) - 1
        const maxX = Math.max(...side.map(e => e.x)) + 1
        const maxY = Math.max(...side.map(e => e.y))
        for (let y = a.eyeTop; y <= maxY; y++) for (let x = minX; x <= maxX; x++) dabs.push({ x, y, color: SHADES })
        dabs.push({ x: minX, y: a.eyeTop, color: WHITE })
      }
      const leftEnd = Math.max(...a.left.map(e => e.x)) + 1
      const rightStart = Math.min(...a.right.map(e => e.x)) - 1
      for (let x = leftEnd + 1; x < rightStart; x++) dabs.push({ x, y: a.eyeTop, color: SHADES })
      return dabs
    }
    case 'scarf': {
      const dabs: Dab[] = []
      const y = a.mouthY + 1
      for (let x = a.eyeMinX - 1; x <= a.eyeMaxX + 1; x++) dabs.push({ x, y, color: Math.floor(x / 2) % 2 === 0 ? RED : DARK_RED })
      // The tail hangs two pixels, or less on a buddy whose mouth sits low.
      for (let dy = 1; dy <= 2 && y + dy <= 11; dy++) dabs.push({ x: a.eyeMaxX, y: y + dy, color: dy === 1 ? RED : DARK_RED })
      return dabs
    }
  }
}

/** Pixels an eye style adds around open eyes: shine above big eyes, brows over angry ones. */
export function eyeDabs(eyes: EyeStyle, a: Anchors, brow: number): Dab[] {
  if (eyes === 'big') {
    return a.eyes.filter(e => !a.eyes.some(o => o.x === e.x && o.y === e.y - 1)).map(e => ({ x: e.x, y: e.y - 1, color: WHITE }))
  }
  if (eyes === 'angry') {
    const dabs: Dab[] = []
    for (const [side, inward] of [[a.left, 1], [a.right, -1]] as const) {
      if (side.length === 0) continue
      const xs = side.map(e => e.x)
      const inner = inward === 1 ? Math.max(...xs) : Math.min(...xs)
      const outer = inward === 1 ? Math.min(...xs) : Math.max(...xs)
      // A brow slanting down toward the nose.
      dabs.push({ x: inner, y: a.eyeTop - 1, color: brow })
      if (outer !== inner) dabs.push({ x: outer, y: a.eyeTop - 2, color: brow })
      else dabs.push({ x: inner - inward, y: a.eyeTop - 2, color: brow })
    }
    return dabs
  }
  return []
}

export const LOVE = { iris: 0xff4d79, shine: 0xffb3c7 }
