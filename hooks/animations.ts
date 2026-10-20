import type { Anim } from '../types'
import type { PropKind } from './props'

export type Eyes = 'open' | 'closed' | 'happy' | 'wide' | 'sad'
export type Mouth = 'smile' | 'open' | 'flat' | 'none'
export type EffectKind = 'bang' | 'dots' | 'heart' | 'sparkle' | 'sweat' | 'zzz' | 'note' | 'question'

/** One frame of a buddy: where it stands, its face, and what floats beside it. */
export type Pose = {
  dx: number
  dy: number
  eyes: Eyes
  mouth: Mouth
  effect: { kind: EffectKind; frame: number } | null
  /** Facing the other way: the sprite, its accessory and its prop mirrored. */
  flip?: boolean
  /** Squashed by 1 (sitting) or 2 (lying down), or stretched by -1. */
  squash?: number
  /** Where the pupils look; absent looks ahead. */
  look?: 'left' | 'right'
  /** Something the buddy holds or plays with. */
  prop?: { kind: PropKind; frame: number } | null
  /** See-through: 1 drops every other pixel, 2 keeps one in four (a ghost fading). */
  fade?: number
}

/**
 * A playable stretch of poses: one of the animations, an act, or a walk.
 * `key` names it for caching; the same key always draws the same frames.
 */
export type Clip = { key: string; label: string; length: number; pose: (t: number) => Pose }

/** Every frame lasts one tick. */
export const TICK_MS = 125

type AnimDef = { label: string; length: number; pose: (t: number) => Pose }

const HOP = [0, -1, -2, -3, -3, -2, -1, 0]
const SWAY = [0, 1, 1, 0, 0, -1, -1, 0]

const base: Pose = { dx: 0, dy: 0, eyes: 'open', mouth: 'smile', effect: null }

export const ANIMS: Record<Anim, AnimDef> = {
  idle: {
    label: 'Idle',
    length: 32,
    pose: t => ({ ...base, dy: Math.floor(t / 4) % 2, eyes: t % 32 >= 30 ? 'closed' : 'open' }),
  },
  typing: {
    label: 'Typing',
    length: 4,
    pose: t => ({ ...base, dy: t % 2, mouth: t % 4 < 2 ? 'open' : 'smile' }),
  },
  thinking: {
    label: 'Thinking',
    length: 12,
    pose: t => ({ ...base, mouth: 'flat', effect: { kind: 'dots', frame: Math.floor(t / 4) % 3 } }),
  },
  happy: {
    label: 'Happy',
    length: 8,
    pose: t => ({ ...base, dy: HOP[t % 8] ?? 0, eyes: 'happy', mouth: 'open', effect: { kind: 'heart', frame: t % 8 < 4 ? 0 : 1 } }),
  },
  celebrate: {
    label: 'Celebrate',
    length: 8,
    pose: t => ({ ...base, dy: HOP[t % 8] ?? 0, eyes: 'happy', mouth: 'open', effect: { kind: 'sparkle', frame: Math.floor(t / 2) % 2 } }),
  },
  sad: {
    label: 'Sad',
    length: 16,
    pose: t => ({
      ...base,
      dx: [0, -1, 0, 1][Math.floor(t / 4) % 4] ?? 0,
      dy: 1,
      eyes: 'sad',
      mouth: 'flat',
      effect: { kind: 'sweat', frame: Math.floor(t / 4) % 2 },
    }),
  },
  surprised: {
    label: 'Surprised',
    length: 8,
    pose: t => ({ ...base, dy: t < 2 ? -2 : 0, eyes: 'wide', mouth: 'open', effect: { kind: 'bang', frame: 0 } }),
  },
  sleeping: {
    label: 'Sleeping',
    length: 24,
    pose: t => ({ ...base, dy: Math.floor(t / 12) % 2, eyes: 'closed', mouth: 'none', effect: { kind: 'zzz', frame: Math.floor(t / 8) % 3 } }),
  },
  wave: {
    label: 'Wave',
    length: 8,
    pose: t => ({ ...base, dx: SWAY[t % 8] ?? 0, eyes: 'happy', effect: { kind: 'note', frame: Math.floor(t / 4) % 2 } }),
  },
}

export const ANIM_NAMES = Object.keys(ANIMS) as Anim[]

export function isAnim(value: unknown): value is Anim {
  return typeof value === 'string' && value in ANIMS
}

export function poseAt(anim: Anim, tick: number): Pose {
  const def = ANIMS[anim]
  return def.pose(((tick % def.length) + def.length) % def.length)
}

/** An animation as a clip. */
export function clipOf(anim: Anim): Clip {
  return { key: anim, ...ANIMS[anim] }
}

export const BASE_POSE: Pose = base

/** The pose of a clip at a tick, looping. */
export function clipPose(clip: Clip, tick: number): Pose {
  return clip.pose(((tick % clip.length) + clip.length) % clip.length)
}
