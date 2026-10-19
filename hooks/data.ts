import type { Buddy, BuddyKind } from '../types'
import { isArchetype } from './personality'
import { KINDS } from './sprites'

export const MAX_NAME = 24
export const MAX_BUDDIES = 50

export function isKind(value: unknown): value is BuddyKind {
  return KINDS.some(k => k.value === value)
}

export function isColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
}

/** A name as shown: trimmed, control characters dropped, at most MAX_NAME long. */
export function cleanName(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NAME)
    : ''
}

/**
 * The roster as the store holds it, kept only where it is whole: anything
 * hand-edited, corrupted or written by a future version is dropped, never drawn.
 */
export function cleanRoster(value: unknown): Buddy[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: Buddy[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue
    const { id, name, kind, color, archetype, seed } = item as Record<string, unknown>
    const clean = cleanName(name)
    if (typeof id !== 'string' || id === '' || seen.has(id)) continue
    if (!clean || !isKind(kind) || !isColor(color)) continue
    seen.add(id)
    // Buddies saved by 0.1 have no personality fields: they read theirs from the name.
    out.push({
      id,
      name: clean,
      kind,
      color: color.toUpperCase(),
      archetype: isArchetype(archetype) ? archetype : 'auto',
      seed: cleanSeed(seed),
    })
    if (out.length === MAX_BUDDIES) break
  }
  return out
}

/** The saved active id, if it still names a buddy; else the first, or none. */
export function cleanActiveId(value: unknown, roster: readonly Buddy[]): string | null {
  return roster.some(b => b.id === value) ? (value as string) : (roster[0]?.id ?? null)
}

export function cleanSeed(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 1_000_000 ? value : 0
}
