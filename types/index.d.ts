export type BuddyKind = 'crab' | 'blob' | 'robot' | 'ghost' | 'cat' | 'dragon' | 'cactus'

export type EyeStyle = 'classic' | 'dots' | 'big' | 'sleepy' | 'angry' | 'love'
export type Pattern = 'plain' | 'spots' | 'stripes' | 'belly' | 'gradient'
export type Accessory =
  | 'none'
  | 'crown'
  | 'party'
  | 'beanie'
  | 'bow'
  | 'flower'
  | 'headphones'
  | 'shades'
  | 'scarf'
  | 'witch'
  | 'santa'
  | 'star'
  | 'astronaut'
  | 'knight'
  | 'wreath'
  | 'tricorn'

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
  /** The day it was made, YYYY-MM-DD; its birthday comes round each year. Buddies from before 0.5 count from the day they were first seen. */
  born: string
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
  /** Days active during Halloween and during winter, for the seasonal achievements. */
  halloweenDays: number
  winterDays: number
  /** Stories finished (by any buddy), one count each, for their achievements. */
  storyPixels: number
  storyVoyager: number
  storyKing: number
  storyGarden: number
  storyRepo: number
  /** Story chapters finished, across every story and buddy: they unlock the wardrobe. */
  chaptersDone: number
  /** The last day counted in `days`, as YYYY-MM-DD in local time. */
  lastDay: string
}

export type StoryId = 'pixels' | 'voyager' | 'king' | 'garden' | 'repo'

/**
 * One buddy's way through one story: the chapter it is on, how much of that
 * chapter's quest it has done while it was playing (`banked`), the stats
 * when it last started playing (`from`, null while paused: another story or
 * another buddy is being played), and whether the chapter's opening was told.
 */
export type Run = { chapter: number; banked: number; from: Stats | null; isTold: boolean }

/** A buddy's adventures: the story it is playing, and where it got to in each it has started. */
export type Journey = { current: StoryId | null; runs: Partial<Record<StoryId, Run>> }

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
      /** Each buddy's adventures, by buddy id. */
      journeys: Record<string, Journey>
      /** What the story pane shows: the story being played, or the list to choose from. */
      storyView: 'story' | 'picker'
    }
  }
}
