import type { Archetype, BuddyKind } from '../types'
import { BASE_POSE } from './animations'
import type { Clip, Pose } from './animations'
import type { PropKind } from './props'
import type { Season } from './seasons'

/**
 * An act: a short thing a buddy does on its own while idle, like a pet would.
 * `who` says which personalities do it (every one, when absent); `weight` how
 * often it comes up against the rest; `when` makes it likelier at a time of
 * day or after something went wrong.
 */
export type Act = Clip & {
  id: string
  who?: readonly Archetype[]
  /** Only buddies of these types do it: how each animal behaves. */
  kinds?: readonly BuddyKind[]
  /** Only in this season. */
  season?: Season
  /** Only on the buddy's birthday. */
  birthday?: true
  weight: number
  when?: { morning?: number; night?: number; afterError?: number }
}

type Step = [ticks: number, pose: Partial<Pose> | ((t: number) => Partial<Pose>)]

/** An act from keyframes: each step holds its pose (or a function of the step's own tick) for its ticks. */
function steps(list: readonly Step[]): { length: number; pose: (t: number) => Pose } {
  const length = list.reduce((n, [ticks]) => n + ticks, 0)
  return {
    length,
    pose: t => {
      let at = t
      for (const [ticks, pose] of list) {
        if (at < ticks) return { ...BASE_POSE, ...(typeof pose === 'function' ? pose(at) : pose) }
        at -= ticks
      }
      return BASE_POSE
    },
  }
}

const prop = (kind: PropKind, frame: number) => ({ kind, frame })
const HOP = [0, -1, -2, -2, -1, 0]
const hop = (t: number, period = 6) => HOP[t % period] ?? 0

function act(id: string, label: string, weight: number, list: readonly Step[], extra: Partial<Act> = {}): Act {
  return { id, key: `act:${id}`, label, weight, ...steps(list), ...extra }
}

/** Things every buddy does: looking about, stretching, sitting, chasing flies. */
const UNIVERSAL: readonly Act[] = [
  act('look', 'Look around', 4, [
    [12, { look: 'left' }],
    [4, { eyes: 'closed' }],
    [12, { look: 'right' }],
    [12, { look: 'left' }],
  ]),
  act('turn', 'Turn around', 3, [
    [20, { flip: true }],
    [2, { flip: true, eyes: 'closed' }],
    [20, { flip: true, look: 'left' }],
  ]),
  act('stretch', 'Stretch', 3, [
    [8, { squash: -1, eyes: 'closed', mouth: 'open' }],
    [10, { squash: -1, eyes: 'happy', mouth: 'open' }],
    [6, { squash: 1, eyes: 'happy' }],
    [6, { eyes: 'happy' }],
  ], { when: { morning: 4 } }),
  act('yawn', 'Yawn', 2, [
    [6, { eyes: 'closed' }],
    [14, { squash: -1, eyes: 'closed', mouth: 'open' }],
    [10, { eyes: 'closed', effect: { kind: 'zzz', frame: 0 } }],
  ], { when: { night: 5, morning: 2 } }),
  act('shiver', 'Shiver', 1, [[24, t => ({ dx: t % 2 === 0 ? 1 : -1, eyes: 'wide', mouth: 'flat' })]]),
  act('sneeze', 'Sneeze', 1, [
    [10, { squash: -1, eyes: 'closed', mouth: 'open' }],
    [4, { squash: 1, eyes: 'closed', dx: -1, effect: { kind: 'bang', frame: 0 } }],
    [10, { eyes: 'wide' }],
  ]),
  act('scratch', 'Scratch an itch', 2, [[28, t => ({ dy: t % 2, eyes: t % 8 < 6 ? 'happy' : 'closed' })]]),
  act('sit', 'Sit down', 3, [
    [24, { squash: 1 }],
    [12, { squash: 1, look: 'left' }],
    [2, { squash: 1, eyes: 'closed' }],
    [24, { squash: 1 }],
  ]),
  act('lie', 'Lie down', 2, [
    [8, { squash: 1, eyes: 'happy' }],
    [56, t => ({ squash: 2, eyes: 'closed', mouth: 'smile', effect: t > 24 ? { kind: 'zzz', frame: Math.floor(t / 8) % 3 } : null })],
    [8, { squash: 1 }],
  ], { when: { night: 3 } }),
  act('chase', 'Chase a fly', 2, [
    [48, t => {
      const f = Math.floor(t / 2) % 12
      // The fly circles the head; the buddy looks after it and pounces now and then.
      return {
        prop: prop('fly', f),
        look: f < 6 ? 'right' : 'left',
        dx: f < 6 ? 1 : 0,
        dy: t % 16 < 6 ? hop(t % 16) : 0,
        eyes: 'wide',
        mouth: t % 16 < 6 ? 'open' : 'smile',
      }
    }],
    [8, { eyes: 'happy', effect: { kind: 'heart', frame: 0 } }],
  ]),
]

/** Each personality's own habits, with its props. */
const SIGNATURE: readonly Act[] = [
  // Cheerleader
  act('pompoms', 'Shake pom-poms', 4, [[40, t => ({ prop: prop('pompom', Math.floor(t / 2) % 2), dy: hop(t), eyes: 'happy', mouth: 'open' })]], { who: ['cheerleader'] }),
  act('jacks', 'Jumping jacks', 3, [[32, t => ({ dy: hop(t), squash: t % 6 < 3 ? -1 : 1, eyes: 'happy', mouth: 'open', effect: { kind: 'sparkle', frame: Math.floor(t / 4) % 2 } })]], { who: ['cheerleader'] }),
  act('flag', 'Wave a flag', 3, [[40, t => ({ prop: prop('flag', Math.floor(t / 3) % 2), dx: [0, 1, 0, -1][Math.floor(t / 6) % 4] ?? 0, eyes: 'happy' })]], { who: ['cheerleader'] }),
  // Grump
  act('coffee', 'Sip coffee', 4, [[48, t => ({ prop: prop('coffee', Math.floor(t / 4) % 2), eyes: t % 16 < 6 ? 'closed' : 'sad', mouth: 'flat', dy: t % 16 < 6 ? -1 : 0 })]], { who: ['grump'], when: { morning: 3 } }),
  act('tap', 'Tap foot', 3, [[32, t => ({ dy: Math.floor(t / 3) % 2, look: 'left', mouth: 'flat', eyes: 'sad' })]], { who: ['grump'] }),
  act('cloud', 'Sulk under a cloud', 2, [[56, t => ({ prop: prop('cloud', Math.floor(t / 3) % 3), eyes: 'sad', mouth: 'flat', squash: 1 })]], { who: ['grump'], when: { afterError: 6 } }),
  // Philosopher
  act('meditate', 'Meditate', 4, [[64, t => ({ dy: Math.floor(t / 16) % 2 === 0 ? -1 : -2, eyes: 'closed', mouth: 'smile', squash: 1, effect: { kind: 'dots', frame: Math.floor(t / 8) % 3 } })]], { who: ['philosopher'] }),
  act('read', 'Read a book', 4, [[64, t => ({ prop: prop('book', Math.floor(t / 20) % 2), mouth: 'flat', eyes: t % 30 === 29 ? 'closed' : 'open' })]], { who: ['philosopher'] }),
  act('ponder', 'Ponder', 3, [[40, t => ({ look: 'left', mouth: 'flat', effect: { kind: 'question', frame: 0 }, dy: t % 20 < 10 ? 0 : 1 })]], { who: ['philosopher'] }),
  // Chaos gremlin
  act('juggle', 'Juggle', 4, [[48, t => ({ prop: prop('juggle', Math.floor(t / 2) % 6), eyes: 'wide', mouth: 'open', dy: t % 4 < 2 ? 0 : -1 })]], { who: ['gremlin'] }),
  act('spin', 'Spin', 3, [[24, t => ({ flip: Math.floor(t / 2) % 2 === 1, dy: hop(t), eyes: 'happy', mouth: 'open' })]], { who: ['gremlin'] }),
  act('fire', 'Start a tiny fire', 3, [
    [24, t => ({ prop: prop('fire', t % 3), look: 'right', eyes: 'wide', mouth: 'open' })],
    [16, t => ({ prop: t < 10 ? prop('fire', t % 3) : null, dx: 2, dy: hop(t), eyes: 'wide', effect: { kind: 'sweat', frame: t % 2 } })],
    [8, { dx: 2, eyes: 'happy', mouth: 'smile' }],
  ], { who: ['gremlin'] }),
  // Sleepy
  act('cocoa', 'Sip cocoa', 4, [[48, t => ({ prop: prop('cocoa', Math.floor(t / 4) % 2), eyes: 'happy', mouth: 'smile', dy: t % 16 < 6 ? -1 : 0 })]], { who: ['sleepy'], when: { night: 2 } }),
  act('nap', 'Nap on a pillow', 4, [[80, t => ({ prop: prop('pillow', 0), squash: 2, eyes: 'closed', mouth: 'none', effect: { kind: 'zzz', frame: Math.floor(t / 8) % 3 } })]], { who: ['sleepy'], when: { night: 3 } }),
  act('nod', 'Nod off', 3, [
    [32, t => ({ eyes: 'closed', dy: Math.min(2, Math.floor(t / 10)), mouth: 'none' })],
    [10, { eyes: 'wide', mouth: 'open', effect: { kind: 'bang', frame: 0 } }],
  ], { who: ['sleepy'] }),
  // Nerd
  act('laptop', 'Type on a laptop', 4, [[56, t => ({ prop: prop('laptop', Math.floor(t / 2) % 2), mouth: t % 4 < 2 ? 'smile' : 'flat', dy: t % 2 })]], { who: ['nerd'] }),
  act('cube', 'Solve a cube', 3, [
    [40, t => ({ prop: prop('cube', Math.floor(t / 4) % 3), look: 'right', mouth: 'flat' })],
    [10, { prop: prop('cube', 2), eyes: 'happy', mouth: 'open', effect: { kind: 'sparkle', frame: 0 } }],
  ], { who: ['nerd'] }),
  act('idea', 'Have an idea', 3, [
    [10, { look: 'left', mouth: 'flat', effect: { kind: 'dots', frame: 2 } }],
    [24, t => ({ prop: prop('bulb', Math.floor(t / 3) % 2), eyes: 'wide', mouth: 'open', dy: hop(t) })],
  ], { who: ['nerd'] }),
  // Pirate
  act('telescope', 'Look through a telescope', 4, [[48, t => ({ prop: prop('telescope', t < 8 ? 0 : 1), look: 'right', eyes: t % 24 < 20 ? 'open' : 'wide', mouth: 'flat' })]], { who: ['pirate'] }),
  act('map', 'Read a treasure map', 3, [[48, t => ({ prop: prop('map', Math.floor(t / 4) % 2), mouth: 'flat', look: t % 24 < 12 ? 'left' : 'right' })]], { who: ['pirate'] }),
  act('parrot', 'A parrot drops by', 3, [
    [16, t => ({ prop: prop('parrot', t % 2), eyes: 'wide', look: 'left' })],
    [40, t => ({ prop: prop('parrot', t % 20 < 2 ? 1 : 2), eyes: 'happy', mouth: 'open' })],
  ], { who: ['pirate'] }),
  // Poet
  act('quill', 'Write a poem', 4, [[56, t => ({ prop: prop('quill', Math.floor(t / 4) % 3), mouth: 'flat', eyes: t % 28 > 25 ? 'closed' : 'open' })]], { who: ['poet'] }),
  act('rose', 'Smell a rose', 3, [[40, t => ({ prop: prop('rose', 0), eyes: 'closed', mouth: 'smile', effect: t > 12 ? { kind: 'heart', frame: Math.floor(t / 6) % 2 } : null })]], { who: ['poet'] }),
  act('moon', 'Gaze at the moon', 3, [[56, t => ({ prop: prop('moon', 0), look: 'right', dx: [0, 0, 1, 1, 0, 0, -1, -1][Math.floor(t / 7) % 8] ?? 0, mouth: 'smile' })]], { who: ['poet'], when: { night: 4 } }),
]

/** How each type of buddy behaves, like the animal (or cactus) it is. */
const QUIRKS: readonly Act[] = [
  // Cat
  act('groom', 'Groom', 4, [[40, t => ({ squash: 1, eyes: 'happy', look: 'left', dy: t % 8 < 4 ? 0 : 1, effect: t > 28 ? { kind: 'sparkle', frame: t % 2 } : null })]], { kinds: ['cat'] }),
  act('tail', 'Chase its tail', 3, [
    [32, t => ({ flip: Math.floor(t / 2) % 2 === 1, dx: [0, 1, 2, 1, 0, -1, -2, -1][Math.floor(t / 2) % 8] ?? 0, eyes: 'wide', mouth: 'open' })],
    [10, { eyes: 'closed', squash: 1, effect: { kind: 'question', frame: 0 } }],
  ], { kinds: ['cat'] }),
  // Dragon
  act('smoke', 'Puff smoke', 4, [[40, t => ({ prop: { kind: 'smoke', frame: Math.floor(t / 4) % 3 }, eyes: 'closed', mouth: t % 16 < 8 ? 'open' : 'smile', look: 'right' })]], { kinds: ['dragon'] }),
  act('flame', 'Breathe a tiny flame', 3, [
    [12, { squash: -1, eyes: 'wide', mouth: 'flat' }],
    [24, t => ({ prop: { kind: 'flame', frame: t % 3 }, eyes: 'happy', mouth: 'open' })],
    [8, { eyes: 'happy', effect: { kind: 'sweat', frame: 0 } }],
  ], { kinds: ['dragon'] }),
  // Crab
  act('scuttle', 'Scuttle sideways', 4, [[48, t => ({ dx: [0, 1, 2, 3, 4, 3, 2, 1, 0, -1, -2, -3, -4, -3, -2, -1][Math.floor(t / 3) % 16] ?? 0, dy: t % 2, eyes: 'wide' })]], { kinds: ['crab'] }),
  act('clack', 'Clack its claws', 3, [[32, t => ({ squash: t % 4 < 2 ? -1 : 0, eyes: 'happy', mouth: 'open', effect: { kind: 'note', frame: Math.floor(t / 4) % 2 } })]], { kinds: ['crab'] }),
  // Blob
  act('jiggle', 'Jiggle', 4, [[32, t => ({ squash: [0, -1, 0, 1][t % 4] ?? 0, eyes: 'happy', mouth: t % 8 < 4 ? 'open' : 'smile' })]], { kinds: ['blob'] }),
  act('split', 'Split in two', 3, [[48, t => ({ prop: { kind: 'mini', frame: Math.floor(t / 4) % 12 }, eyes: t < 24 ? 'wide' : 'happy', look: 'right', squash: t < 8 ? 1 : 0 })]], { kinds: ['blob'] }),
  // Robot
  act('glitch', 'Glitch', 3, [[32, t => ({ dx: ((t * 7) % 3) - 1, flip: t % 5 === 0, eyes: t % 3 === 0 ? 'closed' : 'wide', mouth: t % 2 === 0 ? 'flat' : 'open', fade: t % 4 === 1 ? 1 : 0 })]], { kinds: ['robot'] }),
  act('charge', 'Recharge', 4, [
    [56, t => ({ prop: { kind: 'battery', frame: Math.min(3, Math.floor(t / 14)) }, eyes: 'closed', mouth: 'smile', squash: 1 })],
    [8, { eyes: 'wide', mouth: 'open', effect: { kind: 'sparkle', frame: 0 } }],
  ], { kinds: ['robot'] }),
  // Ghost
  act('fade', 'Fade away', 3, [[48, t => ({ fade: t < 12 ? 1 : t < 36 ? 2 : 1, dy: -1, eyes: 'happy' })]], { kinds: ['ghost'] }),
  act('float', 'Float in a loop', 4, [[56, t => ({ dy: [0, -1, -2, -3, -3, -2, -1, 0][Math.floor(t / 4) % 8] ?? 0, dx: [0, 1, 2, 1, 0, -1, -2, -1][Math.floor(t / 7) % 8] ?? 0, eyes: 'happy' })]], { kinds: ['ghost'] }),
  // Cactus
  act('bloom', 'Bloom', 3, [[48, t => ({ prop: { kind: 'bud', frame: Math.min(2, Math.floor(t / 12)) }, eyes: t > 24 ? 'happy' : 'open', effect: t > 36 ? { kind: 'sparkle', frame: t % 2 } : null })]], { kinds: ['cactus'] }),
  act('sway', 'Sway in the breeze', 4, [[48, t => ({ dx: [0, 0, 1, 1, 0, 0, -1, -1][Math.floor(t / 6) % 8] ?? 0, eyes: 'closed', mouth: 'smile' })]], { kinds: ['cactus'] }),
]

/** Acts for a season, or a birthday. */
const SEASONAL: readonly Act[] = [
  act('pumpkin', 'Carve a pumpkin', 4, [[48, t => ({ prop: { kind: 'pumpkin', frame: Math.floor(t / 6) % 2 }, look: 'right', eyes: t < 16 ? 'wide' : 'happy', mouth: 'open' })]], { season: 'halloween' }),
  act('bats', 'Watch the bats', 3, [[40, t => ({ prop: { kind: 'bat', frame: Math.floor(t / 4) % 10 }, look: Math.floor(t / 4) % 10 < 5 ? 'left' : 'right', eyes: 'wide', mouth: 'open' })]], { season: 'halloween' }),
  act('boo', 'Say boo', 3, [
    [8, { squash: 1, eyes: 'closed' }],
    [16, t => ({ squash: -1, dy: -1, eyes: 'wide', mouth: 'open', fade: t % 4 < 2 ? 1 : 0, effect: { kind: 'bang', frame: 0 } })],
    [8, { eyes: 'happy' }],
  ], { season: 'halloween' }),
  act('snow', 'Catch snowflakes', 4, [[56, t => ({ prop: { kind: 'snow', frame: Math.floor(t / 3) % 4 }, eyes: 'happy', mouth: 'open', dy: t % 16 < 4 ? -1 : 0 })]], { season: 'winter' }),
  act('cake', 'Birthday cake', 6, [[56, t => ({ prop: { kind: 'cake', frame: Math.floor(t / 3) % 2 }, eyes: 'happy', mouth: 'open', dy: t % 16 < 6 ? -1 : 0, effect: { kind: t % 32 < 16 ? 'heart' : 'sparkle', frame: Math.floor(t / 4) % 2 } })]], { birthday: true }),
]

export const ACTS: readonly Act[] = [...UNIVERSAL, ...SIGNATURE, ...QUIRKS, ...SEASONAL]

/** What the band says while an act plays: "Captain Bolt · is reading a treasure map". */
export const DOING: Record<string, string> = {
  look: 'is looking around',
  turn: 'turned around',
  stretch: 'is stretching',
  yawn: 'is yawning',
  shiver: 'is shivering',
  sneeze: 'sneezed!',
  scratch: 'is scratching an itch',
  sit: 'is sitting down',
  lie: 'is lying down',
  chase: 'is chasing a fly',
  pompoms: 'is shaking pom-poms',
  jacks: 'is doing jumping jacks',
  flag: 'is waving a flag',
  coffee: 'is sipping coffee',
  tap: 'is tapping a foot',
  cloud: 'is sulking under a cloud',
  meditate: 'is meditating',
  read: 'is reading',
  ponder: 'is pondering',
  juggle: 'is juggling',
  spin: 'is spinning',
  fire: 'started a tiny fire',
  cocoa: 'is sipping cocoa',
  nap: 'is napping on a pillow',
  nod: 'is nodding off',
  laptop: 'is typing on a laptop',
  cube: 'is solving a cube',
  idea: 'had an idea!',
  telescope: 'is looking through a telescope',
  map: 'is reading a treasure map',
  parrot: 'has a parrot friend',
  quill: 'is writing a poem',
  rose: 'is smelling a rose',
  moon: 'is gazing at the moon',
  groom: 'is grooming',
  tail: 'is chasing its tail',
  smoke: 'is puffing smoke',
  flame: 'breathed a tiny flame!',
  scuttle: 'is scuttling sideways',
  clack: 'is clacking its claws',
  jiggle: 'is jiggling',
  split: 'split in two!',
  glitch: 'is glitching',
  charge: 'is recharging',
  fade: 'is fading away…',
  float: 'is floating in loops',
  bloom: 'is blooming',
  sway: 'is swaying in the breeze',
  pumpkin: 'is carving a pumpkin',
  bats: 'is watching the bats',
  boo: 'says BOO!',
  snow: 'is catching snowflakes',
  cake: 'is having birthday cake!',
  walk: 'is going for a stroll',
}

export function actById(id: string): Act | undefined {
  return ACTS.find(a => a.id === id)
}

/** What each personality does with its hands while Claude works. */
export const WORK_PROP: Record<Archetype, PropKind> = {
  cheerleader: 'pompom',
  grump: 'coffee',
  philosopher: 'book',
  gremlin: 'juggle',
  sleepy: 'cocoa',
  nerd: 'laptop',
  pirate: 'map',
  poet: 'quill',
}

/** How far a buddy may wander either side of the middle of its stage. */
export const WANDER = 9

/** A walk from one spot to another, facing the way it goes, bobbing each step. */
export function walkClip(from: number, to: number): Clip {
  const distance = Math.abs(to - from)
  const dir = Math.sign(to - from)
  const length = Math.max(1, distance * 3)
  return {
    key: `walk:${from}:${to}`,
    label: 'Walk',
    length,
    pose: t => ({
      ...BASE_POSE,
      // A step every three ticks; the last frame stands on the spot it was headed for.
      dx: from + dir * Math.min(distance, Math.floor((t + 1) / 3)),
      dy: Math.floor(t / 3) % 2 === 1 ? -1 : 0,
      flip: dir < 0,
    }),
  }
}

export type Context = {
  hour: number
  sinceErrorMs: number
  /** The buddy's type, for its quirks; without it, no quirks. */
  kind?: BuddyKind
  season?: Season | null
  isBirthday?: boolean
}

/** Whether a buddy in this context can do an act at all. */
function fits(a: Act, archetype: Archetype, ctx: Context): boolean {
  if (a.who && !a.who.includes(archetype)) return false
  if (a.kinds && (!ctx.kind || !a.kinds.includes(ctx.kind))) return false
  if (a.season && a.season !== ctx.season) return false
  if (a.birthday && !ctx.isBirthday) return false
  return true
}

function boost(a: Act, ctx: Context): number {
  const isMorning = ctx.hour >= 5 && ctx.hour < 11
  const isNight = ctx.hour >= 22 || ctx.hour < 5
  let w = a.weight
  if (isMorning && a.when?.morning) w *= a.when.morning
  if (isNight && a.when?.night) w *= a.when.night
  if (ctx.sinceErrorMs < 90_000 && a.when?.afterError) w *= a.when.afterError
  return w
}

/**
 * The next thing to do: an act this personality does, weighted by its habits
 * and the moment, never one of the last few; or a walk, more often for an
 * energetic buddy. `random` is injectable for tests.
 */
export function pickNext(
  archetype: Archetype,
  energy: number,
  ctx: Context,
  recent: readonly string[],
  random: () => number = Math.random,
): { kind: 'act'; act: Act } | { kind: 'walk' } {
  if (!recent.includes('walk') && random() < 0.12 + energy * 0.04) return { kind: 'walk' }
  const pool = ACTS.filter(a => fits(a, archetype, ctx) && !recent.includes(a.id))
  // A personality's own acts and its type's quirks come up about as often as
  // all the universal ones together; a season's or a birthday's, more still.
  const weighted = pool.map(a => ({
    a,
    w: boost(a, ctx) * (a.who || a.kinds ? 2.5 : 1) * (a.season ? 4 : 1) * (a.birthday ? 8 : 1),
  }))
  const total = weighted.reduce((n, x) => n + x.w, 0)
  let r = random() * total
  for (const { a, w } of weighted) {
    r -= w
    if (r < 0) return { kind: 'act', act: a }
  }
  const last = weighted[weighted.length - 1]
  return last ? { kind: 'act', act: last.a } : { kind: 'walk' }
}

/** Where to walk next: somewhere else on the stage, at least three steps away. */
export function walkTarget(from: number, random: () => number = Math.random): number {
  for (let i = 0; i < 8; i++) {
    const to = Math.round(random() * WANDER * 2) - WANDER
    if (Math.abs(to - from) >= 3) return to
  }
  return from > 0 ? -WANDER : WANDER
}

/** The rest between two acts: short for an energetic buddy, long for a calm one. */
export function restMs(energy: number, random: () => number = Math.random): number {
  const mean = (8 + (5 - energy) * 7) * 1000
  return Math.round(mean * (0.5 + random()))
}
