/**
 * Pixelia, rebuilt piece by piece on the buddy's stage as the story goes on.
 * Drawn in stage coordinates (40 x 18), behind the buddy, never mirrored.
 */
type Piece = { x: number; y: number; rows: readonly string[]; colors: Record<string, number> }

const GRASS = 0x3cc48c
const GRASS_DARK = 0x2fa374
const BARK = 0x8a5a2b
const LEAF = 0x3cc48c
const LEAF_DARK = 0x2a8f63
const WALL = 0xe8d5b0
const WALL_LINE = 0xcbb68e
const ROOF = 0xb8323f
const ROOF_DARK = 0x8f2430
const DOOR = 0x8a5a2b
const WINDOW = 0xffe066
const POLE = 0x8a93a6
const LIGHT = 0xfff3a0
const GLOW = 0xffd84d
const FLAG = 0x4fa3e0

/** Each piece in the order the story brings them back. */
const PIECES: readonly Piece[] = [
  // Grass along the whole stage.
  {
    x: 0,
    y: 17,
    rows: ['gGgGgGgGgGgGgGgGgGgGgGgGgGgGgGgGgGgGgGgG'],
    colors: { g: GRASS, G: GRASS_DARK },
  },
  // A little tree.
  {
    x: 0,
    y: 8,
    rows: ['.LLL.', 'LLlLL', 'LlLLL', 'LLLlL', '.LLL.', '..B..', '..B..', '..B..', '..B..'],
    colors: { L: LEAF, l: LEAF_DARK, B: BARK },
  },
  // Walls.
  {
    x: 5,
    y: 12,
    rows: ['WWWWWWWW', 'WwWWWWwW', 'WWWWWWWW', 'WWWwWWWW', 'WWWWWWWW'],
    colors: { W: WALL, w: WALL_LINE },
  },
  // A roof.
  {
    x: 4,
    y: 8,
    rows: ['....RR....', '...RRRR...', '..RrRRrR..', '.RRRRRRRR.'],
    colors: { R: ROOF, r: ROOF_DARK },
  },
  // A door and a lit window.
  {
    x: 7,
    y: 13,
    rows: ['....Y', '.DD..', '.DD.Y', '.DD..'],
    colors: { D: DOOR, Y: WINDOW },
  },
  // A lamp post on the far side.
  {
    x: 36,
    y: 9,
    rows: ['.o.', 'oYo', '.P.', '.P.', '.P.', '.P.', '.P.', '.P.'],
    colors: { o: GLOW, Y: LIGHT, P: POLE },
  },
  // A flag on the roof.
  {
    x: 9,
    y: 4,
    rows: ['PFF', 'PFF', 'P..', 'P..'],
    colors: { P: POLE, F: FLAG },
  },
]

export const PIECE_COUNT = PIECES.length

/** The scenery with `pieces` pieces built, as a stage-sized grid (null where empty). */
export function sceneGrid(pieces: number, width: number, height: number): (number | null)[][] {
  const grid: (number | null)[][] = Array.from({ length: height }, () => Array.from({ length: width }, () => null))
  for (const piece of PIECES.slice(0, Math.max(0, pieces))) {
    piece.rows.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        const color = piece.colors[row[dx] ?? '.']
        const line = grid[piece.y + dy]
        if (color !== undefined && line && piece.x + dx < width) line[piece.x + dx] = color
      }
    })
  }
  return grid
}
