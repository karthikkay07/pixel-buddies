import type { Anchors, Dab } from './style'

export type PropKind =
  | 'pompom'
  | 'flag'
  | 'coffee'
  | 'cocoa'
  | 'cloud'
  | 'book'
  | 'juggle'
  | 'fire'
  | 'pillow'
  | 'laptop'
  | 'cube'
  | 'bulb'
  | 'telescope'
  | 'map'
  | 'parrot'
  | 'quill'
  | 'rose'
  | 'moon'
  | 'fly'

/**
 * Where a prop sits, in sprite coordinates:
 * `hand` beside the body at mouth height, `front` held over the lower face,
 * `above` over the head, `perch` on the head, `ground` beside the feet, and
 * `free` at offsets of its own (a fly buzzing about).
 */
type Anchor = 'hand' | 'front' | 'above' | 'perch' | 'ground' | 'free'

type PropDef = {
  anchor: Anchor
  colors: Record<string, number>
  /** One picture per frame; a frame number past the end wraps. */
  frames: readonly (readonly string[])[]
  /** For `free` props: where each frame sits, from the centre of the top of the head. */
  path?: readonly (readonly [number, number])[]
}

const BRASS = 0xc99a1e
const STICK = 0x8a5a2b
const STEAM = 0xc9ccd6
const MUG = 0xe8e8ee
const PINK_MUG = 0xff9fc0
const COFFEE = 0x6b4226
const CLOUD = 0x8a93a6
const RAIN = 0x7fd3ff
const PAGE = 0xf4efe1
const LINE = 0x8a8f9c
const COVER = 0xb8323f
const SCREEN = 0x2b2f3a
const GLOW = 0x7fd3ff
const GREEN_GLOW = 0x9ee6a0
const STEEL = 0x8a93a6
const PARCH = 0xebd9a8
const RED = 0xe8455a
const YELLOW = 0xffd84d
const BLUE = 0x4fa3e0
const GREEN = 0x3cc48c
const WHITE = 0xffffff
const ORANGE = 0xff6b3d
const PURPLE = 0x9b6bdb
const PILLOW = 0xdde6ff
const MOON = 0xffe9a8
const INK = 0x1e1e24
const BULB = 0xfff3a0

export const PROPS: Record<PropKind, PropDef> = {
  pompom: {
    anchor: 'hand',
    colors: { P: 0xff6fae, Y: YELLOW, S: STICK },
    frames: [
      ['YPY', 'PYP', 'YPY', '.S.', '...'],
      ['...', 'YPY', 'PYP', 'YPY', '.S.'],
    ],
  },
  flag: {
    anchor: 'hand',
    colors: { S: STICK, R: RED, W: WHITE },
    frames: [
      ['SRRR', 'SRWR', 'SRRR', 'S...', 'S...'],
      ['SRR.', 'SRWR', 'SRRR', 'S..R', 'S...'],
    ],
  },
  coffee: {
    anchor: 'hand',
    colors: { M: MUG, C: COFFEE, s: STEAM },
    frames: [
      ['.s..', '..s.', 'MCM.', 'MMMM', 'MMM.'],
      ['..s.', '.s..', 'MCM.', 'MMMM', 'MMM.'],
    ],
  },
  cocoa: {
    anchor: 'hand',
    colors: { M: PINK_MUG, C: COFFEE, s: STEAM },
    frames: [
      ['.s..', '..s.', 'MCM.', 'MMMM', 'MMM.'],
      ['..s.', '.s..', 'MCM.', 'MMMM', 'MMM.'],
    ],
  },
  cloud: {
    anchor: 'above',
    colors: { G: CLOUD, B: RAIN },
    frames: [
      ['.GGG.', 'GGGGG', 'GGGGG', '.B.B.', '.....'],
      ['.GGG.', 'GGGGG', 'GGGGG', '..B.B', 'B....'],
      ['.GGG.', 'GGGGG', 'GGGGG', 'B.B..', '...B.'],
    ],
  },
  book: {
    anchor: 'front',
    colors: { W: PAGE, L: LINE, C: COVER },
    frames: [
      ['WWW.WWW', 'WLW.WLW', 'WLW.WLW', 'CCCCCCC'],
      ['WWW.WWW', 'WLW.WWW', 'WLW.WLW', 'CCCCCCC'],
    ],
  },
  juggle: {
    anchor: 'above',
    colors: { R: RED, Y: YELLOW, B: BLUE },
    frames: [
      ['..R..', '.....', 'Y...B'],
      ['...R.', 'Y....', '....B'],
      ['.Y...', '....R', 'B....'],
      ['..Y..', '.....', 'B...R'],
      ['...Y.', 'B....', '....R'],
      ['.B...', '....Y', 'R....'],
    ],
  },
  fire: {
    anchor: 'ground',
    colors: { R: ORANGE, Y: YELLOW },
    frames: [
      ['.R.', 'RYR', 'RYR'],
      ['R..', 'RYR', '.YR'],
      ['..R', 'RY.', 'RYR'],
    ],
  },
  pillow: {
    anchor: 'ground',
    colors: { W: PILLOW, S: STEEL },
    frames: [['.WWWW.', 'WWWWWW', '.SSSS.']],
  },
  laptop: {
    anchor: 'front',
    colors: { K: SCREEN, S: GLOW, G: GREEN_GLOW, B: STEEL },
    frames: [
      ['KKKKKKK', 'KSS.GGK', 'KG.SS.K', 'BBBBBBB'],
      ['KKKKKKK', 'KS.GG.K', 'KGG.SSK', 'BBBBBBB'],
    ],
  },
  cube: {
    anchor: 'hand',
    colors: { R: RED, G: GREEN, B: BLUE, Y: YELLOW, W: WHITE },
    frames: [
      ['RGB', 'YWR', 'BYG'],
      ['GRY', 'BWG', 'YRB'],
      ['YYY', 'RWB', 'GGR'],
    ],
  },
  bulb: {
    anchor: 'above',
    colors: { Y: BULB, O: YELLOW, S: STEEL },
    frames: [
      ['.YYY.', 'YYYYY', 'YYYYY', '.YYY.', '.SSS.'],
      ['O.Y.O', '.YYY.', 'YYYYY', '.YYY.', '.SSS.'],
    ],
  },
  telescope: {
    anchor: 'hand',
    colors: { G: BRASS, L: GLOW },
    frames: [
      ['GGGL', 'GGGL'],
      ['GGGGGL', 'GGGGGL'],
    ],
  },
  map: {
    anchor: 'front',
    colors: { T: PARCH, X: RED, K: LINE },
    frames: [
      ['TTTTTTT', 'TK.TTTT', 'TTK.TXT', 'TTTTTTT'],
      ['TTTTTTT', 'TK.TTTT', 'TTK.TTT', 'TTTTTTT'],
    ],
  },
  parrot: {
    anchor: 'perch',
    colors: { R: RED, Y: YELLOW, G: GREEN, K: INK },
    frames: [
      ['G...G', '.RRR.', '.RKRY', '..RR.'],
      ['.....', 'GRRRG', '.RKRY', '..RR.'],
      ['.....', '.RRR.', 'GRKRY', '..GG.'],
    ],
  },
  quill: {
    anchor: 'front',
    colors: { F: PURPLE, W: PAGE, L: LINE },
    frames: [
      ['.....F', '....F.', 'WWWWWW', 'WL...W', 'WWWWWW'],
      ['...F..', '..F...', 'WWWWWW', 'WLLL.W', 'WWWWWW'],
      ['....F.', '...F..', 'WWWWWW', 'WLLLLW', 'WWWWWW'],
    ],
  },
  rose: {
    anchor: 'hand',
    colors: { R: RED, G: GREEN },
    frames: [['.R.', 'RRR', '.G.', 'GG.', '.G.']],
  },
  moon: {
    anchor: 'free',
    colors: { M: MOON, S: WHITE },
    frames: [['.MMM', 'MM..', 'MM..', '.MMM']],
    path: [[9, -4]],
  },
  fly: {
    anchor: 'free',
    colors: { W: STEAM, K: INK },
    frames: [['W.W', '.K.']],
    path: [
      [7, -2],
      [8, -1],
      [9, -2],
      [9, -3],
      [7, -4],
      [5, -3],
      [3, -4],
      [1, -3],
      [0, -2],
      [2, -1],
      [4, -2],
      [6, -3],
    ],
  },
}

export function isPropKind(value: unknown): value is PropKind {
  return typeof value === 'string' && value in PROPS
}

/** How many distinct frames a prop has (a `free` prop's path counts too). */
export function propFrames(kind: PropKind): number {
  const def = PROPS[kind]
  return Math.max(def.frames.length, def.path?.length ?? 1)
}

/** The pixels of a prop at a frame, in sprite coordinates. */
export function propDabs(kind: PropKind, frame: number, a: Anchors): Dab[] {
  const def = PROPS[kind]
  const rows = def.frames[frame % def.frames.length] ?? []
  const h = rows.length
  const w = Math.max(...rows.map(r => r.length))
  let x0: number
  let y0: number
  switch (def.anchor) {
    case 'hand':
      x0 = a.headRight + 1
      y0 = a.mouthY + 2 - h
      break
    case 'front':
      // Held at the chest, under the mouth, or as low as the feet allow.
      x0 = Math.round(a.centerX + 0.5 - w / 2)
      y0 = Math.min(a.mouthY + 1, 13 - h)
      break
    case 'above':
      x0 = Math.round(a.centerX + 0.5 - w / 2)
      y0 = a.headTop - h
      break
    case 'perch':
      x0 = Math.round(a.centerX + 0.5 - w / 2)
      y0 = a.headTop - h
      break
    case 'ground':
      x0 = a.headRight + 2
      y0 = 12 - h
      break
    case 'free': {
      const path = def.path ?? [[0, 0]]
      const [px, py] = path[frame % path.length] ?? [0, 0]
      x0 = a.centerX + px
      y0 = a.headTop + py
      break
    }
  }
  const out: Dab[] = []
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const color = def.colors[row[dx] ?? '.']
      if (color !== undefined) out.push({ x: x0 + dx, y: y0 + dy, color })
    }
  })
  return out
}
