import type { StoryId } from '../types'

/**
 * Each story's scene, rebuilt piece by piece on the buddy's stage as the
 * story goes on. Drawn in stage coordinates (40 x 18), behind the buddy,
 * never mirrored. A piece may be several stamps (stars across the sky).
 */
type Stamp = { x: number; y: number; rows: readonly string[]; colors: Record<string, number> }
type Piece = readonly Stamp[]

const GRASS = 0x3cc48c
const GRASS_DARK = 0x2fa374
const BARK = 0x8a5a2b
const LEAF = 0x3cc48c
const LEAF_DARK = 0x2a8f63
const WALL = 0xe8d5b0
const WALL_LINE = 0xcbb68e
const ROOF = 0xb8323f
const ROOF_DARK = 0x8f2430
const WOOD = 0x8a5a2b
const WINDOW = 0xffe066
const POLE = 0x8a93a6
const LIGHT = 0xfff3a0
const GLOW = 0xffd84d
const FLAG = 0x4fa3e0
const STEEL = 0x8a93a6
const STEEL_DARK = 0x6b7180
const WHITE = 0xf4f6fb
const HULL_SHADE = 0xc9ccd6
const RED = 0xe8455a
const SKY_BLUE = 0x4fa3e0
const ICE = 0xbfe6ff
const YELLOW = 0xffd84d
const ORANGE = 0xff8a1f
const STAR = 0xfff3a0
const STONE = 0x5a5f6b
const STONE_DARK = 0x474b55
const FRAME = 0x3a3f4b
const GOLD = 0xf5c542
const BLADE = 0xd8dbe6
const SOIL = 0x8a5a2b
const SOIL_DARK = 0x6b4226
const PINK = 0xff9fc0
const PINK_DARK = 0xff6fae
const SAND = 0xf2d9a0
const SAND_DARK = 0xe8c987
const SEA = 0x4fa3e0
const SEA_DARK = 0x3a86c8
const FOAM = 0xffffff

const one = (x: number, y: number, rows: readonly string[], colors: Record<string, number>): Piece => [{ x, y, rows, colors }]

const SCENES: Record<StoryId, readonly Piece[]> = {
  pixels: [
    one(0, 17, ['gGgGgGgGgGgGgGgGgGgGgGgGgGgGgGgGgGgGgGgG'], { g: GRASS, G: GRASS_DARK }),
    one(0, 8, ['.LLL.', 'LLlLL', 'LlLLL', 'LLLlL', '.LLL.', '..B..', '..B..', '..B..', '..B..'], { L: LEAF, l: LEAF_DARK, B: BARK }),
    one(5, 12, ['WWWWWWWW', 'WwWWWWwW', 'WWWWWWWW', 'WWWwWWWW', 'WWWWWWWW'], { W: WALL, w: WALL_LINE }),
    one(4, 8, ['....RR....', '...RRRR...', '..RrRRrR..', '.RRRRRRRR.'], { R: ROOF, r: ROOF_DARK }),
    one(7, 13, ['....Y', '.DD..', '.DD.Y', '.DD..'], { D: WOOD, Y: WINDOW }),
    one(36, 9, ['.o.', 'oYo', '.P.', '.P.', '.P.', '.P.', '.P.', '.P.'], { o: GLOW, Y: LIGHT, P: POLE }),
    one(9, 4, ['PFF', 'PFF', 'P..', 'P..'], { P: POLE, F: FLAG }),
  ],
  voyager: [
    [
      { x: 0, y: 17, rows: ['mMmMmMmMmMmMmMmMmMmMmMmMmMmMmMmMmMmMmMmM'], colors: { m: STEEL, M: STEEL_DARK } },
      ...[[2, 1], [11, 3], [18, 0], [26, 6], [30, 1], [36, 4], [33, 9], [22, 3], [38, 0]].map(([x, y]) => ({ x: x ?? 0, y: y ?? 0, rows: ['*'], colors: { '*': STAR } })),
    ],
    one(0, 5, ['GGG', 'G.G', 'GGG', 'G.G', 'GGG', 'G.G', 'GGG', 'G.G', 'GGG', 'G.G', 'GGG', 'G.G'], { G: STEEL }),
    one(4, 6, ['wWWWw', 'wWWWw', 'wWWWw', 'wWWWw', 'wWWWw', 'wWWWw', 'wWWWw', 'wWWWw', 'wWWWw'], { W: WHITE, w: HULL_SHADE }),
    one(4, 2, ['..R..', '.RRR.', '.RRR.', 'RRRRR'], { R: RED }),
    one(3, 12, ['R.....R', 'RR...RR', 'RR...RR'], { R: RED }),
    one(5, 8, ['.B.', 'BLB', '.B.'], { B: SKY_BLUE, L: ICE }),
    one(5, 15, ['YOY', '.O.'], { Y: YELLOW, O: ORANGE }),
  ],
  king: [
    one(0, 17, ['sSsSsSsSsSsSsSsSsSsSsSsSsSsSsSsSsSsSsSsS'], { s: STONE, S: STONE_DARK }),
    one(0, 8, ['.Y.', 'YOY', '.O.', '.B.', '.B.', '.B.'], { Y: YELLOW, O: ORANGE, B: WOOD }),
    one(4, 9, ['..DDD..', '.DdddD.', 'DdddddD', 'DdddkdD', 'DdddddD', 'DdddddD', 'DdddddD', 'DdddddD'], { D: FRAME, d: WOOD, k: GOLD }),
    one(30, 5, ['.Y.', 'YOY', '.O.', '.B.', '.B.', '.B.'], { Y: YELLOW, O: ORANGE, B: WOOD }),
    one(28, 13, ['.GGGG.', 'BBBBBB', 'BBGGBB', 'BBBBBB'], { G: GOLD, B: WOOD }),
    one(34, 7, ['..W..', '..W..', '..W..', '..W..', '..W..', '.GGG.', '..B..', '.SSS.', 'SSSSS', 'SSSSS'], { W: BLADE, G: GOLD, B: WOOD, S: STONE }),
    one(29, 11, ['G.R.G', 'GGGGG'], { G: GOLD, R: RED }),
  ],
  garden: [
    [
      { x: 0, y: 17, rows: ['dDdDdDdDdDdDdDdDdDdDdDdDdDdDdDdDdDdDdDdD'], colors: { d: SOIL, D: SOIL_DARK } },
      { x: 0, y: 16, rows: ['.g...g....g...g.....g....g...g.....g...g'], colors: { g: GRASS } },
    ],
    one(1, 13, ['G.G', '.G.', '.G.'], { G: GRASS }),
    one(6, 13, ['P.Y.B.P', 'G.G.G.G', 'G.G.G.G'], { P: PINK_DARK, Y: YELLOW, B: SKY_BLUE, G: GRASS }),
    one(27, 11, ['W.W.W.W.W.W.W', 'WWWWWWWWWWWWW', 'W.W.W.W.W.W.W', 'WWWWWWWWWWWWW', 'W.W.W.W.W.W.W'], { W: WHITE }),
    one(0, 5, ['.PPP.', 'PPpPP', 'PpPPP', 'PPPpP', '.PPP.', '..B..', '..B..', '..B..'], { P: PINK, p: PINK_DARK, B: BARK }),
    one(28, 16, ['.bBLBBBb.', 'BBBBBBBBB'], { B: SEA, b: SEA_DARK, L: GRASS }),
    one(37, 6, ['.K.', 'YYY', 'KKK', 'YYY', '.Y.'], { K: SOIL_DARK, Y: YELLOW }),
  ],
  repo: [
    [
      { x: 0, y: 16, rows: ['sSsSsSsSsSsSsSsSsSsSsSsSsSsSsS'], colors: { s: SAND, S: SAND_DARK } },
      { x: 0, y: 17, rows: ['SsSsSsSsSsSsSsSsSsSsSsSsSsSsSs'], colors: { s: SAND, S: SAND_DARK } },
      { x: 30, y: 16, rows: ['bBbBbBbBbB', 'BbBbBbBbBb'], colors: { B: SEA, b: SEA_DARK } },
    ],
    one(0, 4, ['GG...GG', '.GGGGG.', 'GG.B.GG', '...B...', '...B...', '...B...', '..B....', '..B....', '..B....', '..B....', '.B.....', '.B.....'], { G: LEAF, B: BARK }),
    one(28, 15, ['..w...w...w.', 'BBBBBBBBBBBB', 'bBbBbBbBbBbB'], { w: FOAM, B: SEA, b: SEA_DARK }),
    one(31, 13, ['B.....B', 'BBBBBBB'], { B: WOOD }),
    one(10, 14, ['c.', 'GG'], { c: WOOD, G: GRASS }),
    [
      { x: 6, y: 15, rows: ['R.R', '.R.', 'R.R'], colors: { R: RED } },
      { x: 9, y: 11, rows: ['B.', 'B.', 'B.', 'SS', 'SS'], colors: { B: WOOD, S: STEEL } },
    ],
    one(5, 12, ['.GGG.', 'BBBBB', 'BBGBB', 'BBBBB'], { G: GOLD, B: WOOD }),
  ],
}

/** How many pieces each story's scene has. */
export function pieceCount(id: StoryId): number {
  return SCENES[id].length
}

/** What the stage shows behind a buddy: a story's scene, as far as it has been rebuilt. */
export type SceneRef = { story: StoryId; pieces: number }

/** The scene, as a stage-sized grid (null where empty). */
export function sceneGrid(scene: SceneRef | null, width: number, height: number): (number | null)[][] {
  const grid: (number | null)[][] = Array.from({ length: height }, () => Array.from({ length: width }, () => null))
  if (!scene) return grid
  for (const piece of SCENES[scene.story].slice(0, Math.max(0, scene.pieces))) {
    for (const stamp of piece) {
      stamp.rows.forEach((row, dy) => {
        for (let dx = 0; dx < row.length; dx++) {
          const color = stamp.colors[row[dx] ?? '.']
          const line = grid[stamp.y + dy]
          if (color !== undefined && line && stamp.x + dx >= 0 && stamp.x + dx < width) line[stamp.x + dx] = color
        }
      })
    }
  }
  return grid
}
