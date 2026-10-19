export type BuddyKind = 'crab' | 'blob' | 'robot' | 'ghost'

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
}

export type Draft = {
  name: string
  kind: BuddyKind
  color: string
  archetype: Archetype | 'auto'
  seed: number
  /** The animation the studio previews; not saved with the buddy. */
  preview: Anim
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

declare module 'claude-code' {
  interface PluginState {
    'pixel-buddies': {
      draft: Draft
      roster: Buddy[]
      activeId: string | null
      isHidden: boolean
      mood: Mood
      isAsleep: boolean
    }
  }
}
