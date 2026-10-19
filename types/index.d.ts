export type BuddyKind = 'crab' | 'blob' | 'robot' | 'ghost' | 'cat' | 'dragon' | 'cactus'

export type EyeStyle = 'classic' | 'dots' | 'big' | 'sleepy' | 'angry' | 'love'
export type Pattern = 'plain' | 'spots' | 'stripes' | 'belly' | 'gradient'
export type Accessory = 'none' | 'crown' | 'party' | 'beanie' | 'bow' | 'flower' | 'headphones' | 'shades' | 'scarf'

/** How a buddy is dressed: absent on buddies saved before 0.3, which get the defaults. */
export type Style = { eyes: EyeStyle; pattern: Pattern; accessory: Accessory }

/** Everything that decides how a buddy looks. */
export type Look = { kind: BuddyKind; color: string; style: Style }

export type Archetype =
  | 'cheerleader'
  | 'grump'
  | 'philosopher'
  | 'gremlin'
  | 'sleepy'
  | 'nerd'
  | 'pirate'
  | 'poet'

export type Anim =
  | 'idle'
  | 'typing'
  | 'thinking'
  | 'happy'
  | 'celebrate'
  | 'sad'
  | 'surprised'
  | 'sleeping'
  | 'wave'

/**
 * `archetype` is `auto` to read the personality from the name; `seed` rerolls
 * an `auto` personality. Both are absent on buddies saved by 0.1.
 */
export type Buddy = {
  id: string
  name: string
  kind: BuddyKind
  color: string
  archetype: Archetype | 'auto'
  seed: number
  style: Style
}

export type Draft = {
  name: string
  kind: BuddyKind
  color: string
  archetype: Archetype | 'auto'
  seed: number
  style: Style
  /** What the studio previews: an animation, an act's id, `walk` or `work`; not saved with the buddy. */
  preview: string
}

/** What the buddy is doing right now and what it last said. */
export type Mood = {
  /** A reaction playing until `until`; null for the resting state. */
  anim: Anim | null
  until: number
  /** When the reaction started, so its animation plays from the first frame. */
  since: number
  line: string | null
  lineUntil: number
  /** A thought (drawn as one) rather than something said out loud. */
  isThought: boolean
}

/** An act the buddy is in the middle of, or a walk (`id` is `walk`) from `from` to `to`. */
export type ActState = { id: string; since: number; until: number; from: number; to: number }

/** What a person has done with their buddy, counted for achievements. */
export type Stats = {
  prompts: number
  toolCalls: number
  wins: number
  errors: number
  longTurns: number
  pokes: number
  thoughts: number
  sessions: number
  buddiesMade: number
  nightPrompts: number
  days: number
  /** The last day counted in `days`, as YYYY-MM-DD in local time. */
  lastDay: string
}

declare module 'claude-code' {
  interface PluginState {
    'pixel-buddies': {
      draft: Draft
      roster: Buddy[]
      activeId: string | null
      isHidden: boolean
      mood: Mood
      isAsleep: boolean
      act: ActState | null
      stats: Stats
      /** Achievement ids earned, in the order they were earned. */
      earned: string[]
    }
  }
}
