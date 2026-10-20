import type { Buddy, Journey, Stats } from '../types'
import { MILESTONES } from './achievements'
import { clipOf } from './animations'
import { personalityOf } from './personality'
import { svgSource } from './sprites'
import { currentRun, piecesBuilt, storyOf } from './story'

const REPO = 'github.com/karthikkay07/pixel-buddies'

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Whole days from one YYYY-MM-DD to another, at least 1 (the day it was made counts). */
export function daysTogether(born: string, today: string): number {
  const a = Date.parse(`${born}T00:00:00Z`)
  const b = Date.parse(`${today}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1)
}

/** A file name for a buddy's card: `pixel-buddy-captain-bolt.svg`. */
export function cardFileName(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'buddy'
  return `pixel-buddy-${slug}.svg`
}

/**
 * A shareable card: the buddy waving on its stage, its home as far as the
 * story has rebuilt it, and who it is. One self-contained animated SVG.
 */
export function cardSvg(buddy: Buddy, stats: Stats, earned: readonly string[], journey: Journey | undefined, today: string): string {
  const p = personalityOf(buddy)
  const cur = currentRun(journey)
  const scene = cur ? { story: cur.id, pieces: piecesBuilt(cur.id, cur.run.chapter) } : null
  const stage = svgSource(buddy, clipOf('wave'), 'card', scene)
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '')
  const def = cur ? storyOf(cur.id) : null
  const chapter = cur && def ? def.chapters[cur.run.chapter] : undefined
  const storyLine = !cur || !def ? 'Choosing an adventure' : chapter ? `${def.title}, ch. ${cur.run.chapter + 1}: ${chapter.title}` : `${def.title}: complete!`
  const days = daysTogether(buddy.born, today)
  const mono = 'font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"'
  const line = (y: number, text: string, size: number, fill: string, weight = 400) =>
    `<text x="392" y="${y}" ${mono} font-size="${size}" font-weight="${weight}" fill="${fill}">${escape(text)}</text>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="240" viewBox="0 0 640 240">` +
    `<title>${escape(`${buddy.name}, a ${p.label.toLowerCase()} ${buddy.kind}: a Pixel Buddy`)}</title>` +
    `<rect width="640" height="240" rx="18" fill="#1d1d22"/>` +
    `<rect x="16" y="16" width="360" height="180" rx="12" fill="#26262c"/>` +
    `<svg x="16" y="25" width="360" height="162" viewBox="0 0 40 18" shape-rendering="crispEdges">${stage}</svg>` +
    line(56, buddy.name, 26, buddy.color, 700) +
    line(82, `${p.label} ${buddy.kind}`, 15, '#c9ccd6') +
    line(116, `🗓 Day ${days} together`, 14, '#9a9aa6') +
    line(140, `🏆 ${MILESTONES.filter(a => earned.includes(a.id)).length}/${MILESTONES.length} achievements`, 14, '#9a9aa6') +
    line(164, `${def?.emoji ?? '📖'} ${storyLine}`, 13, '#9a9aa6') +
    line(188, `⚡ ${stats.prompts} prompts · ${stats.wins} wins`, 14, '#9a9aa6') +
    `<text x="24" y="222" ${mono} font-size="12" fill="#6e6e7a">Pixel Buddies for Claude Code · ${REPO}</text>` +
    `</svg>`
  )
}
