export type BuddyKind = 'crab' | 'blob' | 'robot' | 'ghost'

export type Buddy = { id: string; name: string; kind: BuddyKind; color: string }

export type Draft = { name: string; kind: BuddyKind; color: string }

declare module 'claude-code' {
  interface PluginState {
    'pixel-buddies': {
      draft: Draft
      roster: Buddy[]
      activeId: string | null
      isHidden: boolean
    }
  }
}
