import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Buddy, BuddyKind, Draft } from '../types'
import {
  CANVAS_H,
  CANVAS_W,
  COLORS,
  KINDS,
  NAMES,
  frameAt,
  rasterCells,
  svgSource,
} from './sprites'

const STUDIO = 'buddy-studio'
const MAX_NAME = 24

const draft = atom({ plugin: 'pixel-buddies', key: 'draft' } as const, {
  name: '',
  kind: 'crab',
  color: '#F07858',
})
const roster = atom({ plugin: 'pixel-buddies', key: 'roster' } as const, [])
const activeId = atom({ plugin: 'pixel-buddies', key: 'activeId' } as const, null)
const isHidden = atom({ plugin: 'pixel-buddies', key: 'isHidden' } as const, false)

const MOODS = {
  idle: ['is hanging out', 'is watching the cursor', 'is humming quietly', 'is ready when you are'],
  working: ['is cheering Claude on', 'is watching Claude work', 'is taking notes', 'is very focused'],
}

function pick<T>(list: readonly [T, ...T[]] | readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)] ?? (list[0] as T)
}

function isKind(value: string): value is BuddyKind {
  return KINDS.some(k => k.value === value)
}

async function activeBuddy($: EngineInterface): Promise<Buddy | null> {
  const id = await read($, activeId)
  const list = await read($, roster)
  return list.find(b => b.id === id) ?? null
}

async function persist($: EngineInterface) {
  await $.store.set('roster', await read($, roster))
  await $.store.set('activeId', await read($, activeId))
  await $.store.set('isHidden', await read($, isHidden))
}

async function openStudio($: EngineInterface) {
  const current = await activeBuddy($)
  const next: Draft = current
    ? { name: current.name, kind: current.kind, color: current.color }
    : { name: pick(NAMES), kind: pick(KINDS).value, color: pick(COLORS).value }
  await update($, draft, () => next)
  await $.ui.open({ id: STUDIO, title: 'Buddy studio', focus: true, closeOnEscape: true })
}

async function saveDraft($: EngineInterface, asNew: boolean) {
  const d = await read($, draft)
  const name = d.name.trim().slice(0, MAX_NAME) || pick(NAMES)
  const current = await activeBuddy($)
  const id = !asNew && current ? current.id : `b${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
  const buddy: Buddy = { id, name, kind: d.kind, color: d.color }
  await update($, roster, list =>
    list.some(b => b.id === id) ? list.map(b => (b.id === id ? buddy : b)) : [...list, buddy],
  )
  await update($, activeId, () => id)
  await update($, isHidden, () => false)
  await persist($)
  $.ui.toast(`${name} the ${d.kind} is ready.`)
}

// Where a terminal drew each Raster last, so the timer repaints it in place.
let bandSite: string | null = null
let isStudioOnTerminal = false
let isWorking = false
let mood = pick(MOODS.idle)

// Set up once per load: at session start, or on the first draw when the mod
// is installed into a session that has already started.
let isStarted = false
async function start($: EngineInterface) {
  if (isStarted) return
  isStarted = true
  const saved = await $.store.get('roster')
  const savedActive = await $.store.get('activeId')
  const savedHidden = await $.store.get('isHidden')
  await update($, roster, () => (Array.isArray(saved) ? (saved as Buddy[]) : []))
  await update($, activeId, () => (typeof savedActive === 'string' ? savedActive : null))
  await update($, isHidden, () => savedHidden === true)

  await $.command.register({
    name: 'buddy',
    description: 'Pixel Buddies: open the studio, or /buddy hide | show',
  })

  let tick = 0
  $.clock.every(250, async () => {
    tick += 1
    if (bandSite !== null) {
      const buddy = await activeBuddy($)
      if (buddy) {
        const shown = await $.ui.blit({
          requestId: bandSite,
          key: 'band-sprite',
          cells: rasterCells(buddy.kind, buddy.color, frameAt(tick, isWorking)),
        })
        // Not mounted any more: stop painting until the band draws it again.
        if (shown.deny) bandSite = null
      }
    }
    if (isStudioOnTerminal) {
      const d = await read($, draft)
      const shown = await $.ui.blit({
        requestId: STUDIO,
        key: 'preview',
        cells: rasterCells(d.kind, d.color, frameAt(tick, false)),
      })
      if (shown.deny) isStudioOnTerminal = false
    }
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await start($)
    return next(e)
  })

  on('command.run', { command: 'buddy' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'hide' || arg === 'show') {
      await update($, isHidden, () => arg === 'hide')
      await persist($)
      return { text: arg === 'hide' ? 'Buddy hidden. /buddy show brings it back.' : 'Buddy is back.' }
    }
    await openStudio($)
    return { text: 'Buddy studio opened.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!isStarted) {
      // Drawing is pure, so the first-draw start runs just after, off the draw.
      $.clock.after(0, () => void start($))
    }
    if (e.props.hasSurvey || (await read($, isHidden))) {
      bandSite = null
      return next(e)
    }
    const buddy = await activeBuddy($)
    const { Box, Text, Button } = $.ui.resolve(e)

    if (!buddy) {
      bandSite = null
      return (
        <Box>
          <Text dimColor>No buddy yet. </Text>
          <Button key="make" label="Make one" onPress={() => openStudio($)} />
        </Box>
      )
    }

    if (e.props.isWorking !== isWorking) {
      isWorking = e.props.isWorking
      mood = pick(isWorking ? MOODS.working : MOODS.idle)
    }

    let sprite
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      bandSite = e.requestId
      sprite = (
        <Raster
          key="band-sprite"
          columns={CANVAS_W}
          rows={CANVAS_H / 2}
          cells={rasterCells(buddy.kind, buddy.color, frameAt(0, isWorking))}
        />
      )
    } else {
      bandSite = null
      const { Svg } = $.ui.resolve(e)
      sprite = (
        <Svg
          source={svgSource(buddy.kind, buddy.color, isWorking)}
          alt={`${buddy.name} the ${buddy.kind}`}
          width={56}
          height={56}
          isInteractive
        />
      )
    }

    return (
      <Box flexDirection="row" alignItems="center">
        {sprite}
        <Box flexDirection="column" marginLeft={2}>
          <Text bold color={buddy.color}>
            {buddy.name}
          </Text>
          <Text dimColor>{mood}</Text>
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: STUDIO }, async ($, e) => {
    if (e.surface === 'mobile') {
      const { Text } = $.ui.resolve(e)
      return <Text dimColor>The buddy studio needs the terminal or desktop app.</Text>
    }
    const { Box, Text, Button, Input, Select } = $.ui.resolve(e)
    const d = await read($, draft)
    const list = await read($, roster)
    const current = await activeBuddy($)

    let preview
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      isStudioOnTerminal = true
      preview = (
        <Raster key="preview" columns={CANVAS_W} rows={CANVAS_H / 2} cells={rasterCells(d.kind, d.color, frameAt(0, false))} />
      )
    } else {
      isStudioOnTerminal = false
      const { Svg } = $.ui.resolve(e)
      preview = (
        <Svg source={svgSource(d.kind, d.color, false)} alt={`Preview of ${d.name || 'your buddy'}`} width={112} height={112} isInteractive />
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" alignItems="center">
          {preview}
          <Box flexDirection="column" marginLeft={2}>
            <Text bold color={d.color}>
              {d.name.trim() || 'Unnamed'}
            </Text>
            <Text dimColor>
              {KINDS.find(k => k.value === d.kind)?.label} · {COLORS.find(c => c.value === d.color)?.label}
            </Text>
          </Box>
        </Box>

        <Select
          key="kind"
          label="Type"
          options={KINDS}
          value={d.kind}
          autoFocus
          onSelect={(v: string) => isKind(v) && update($, draft, x => ({ ...x, kind: v }))}
        />
        <Select
          key="color"
          label="Colour"
          options={COLORS}
          value={d.color}
          onSelect={(v: string) => update($, draft, x => ({ ...x, color: v }))}
        />
        <Input
          key="name"
          label="Name"
          placeholder="Give it a name"
          value={d.name}
          submitLabel="save"
          onInput={(v: string) => update($, draft, x => ({ ...x, name: v.slice(0, MAX_NAME) }))}
          onSubmit={() => saveDraft($, false)}
        />

        <Box flexDirection="row" gap={2}>
          <Button key="save" label={current ? 'Save changes' : 'Save buddy'} hotkey="s" onPress={() => saveDraft($, false)} />
          {current && <Button key="new" label="Save as new" hotkey="n" onPress={() => saveDraft($, true)} />}
          <Button
            key="random"
            label="Surprise me"
            hotkey="r"
            onPress={() =>
              update($, draft, () => ({ name: pick(NAMES), kind: pick(KINDS).value, color: pick(COLORS).value }))
            }
          />
        </Box>

        {list.length > 0 && (
          <Box flexDirection="column">
            <Text bold>Your buddies</Text>
            {list.map(b => (
              <Box key={`row-${b.id}`} flexDirection="row" gap={2}>
                <Text color={b.color}>
                  {b.id === current?.id ? '● ' : '  '}
                  {b.name}
                </Text>
                <Text dimColor>{b.kind}</Text>
                {b.id !== current?.id && (
                  <Button
                    key={`use-${b.id}`}
                    label="Use"
                    onPress={async () => {
                      await update($, activeId, () => b.id)
                      await update($, draft, () => ({ name: b.name, kind: b.kind, color: b.color }))
                      await persist($)
                    }}
                  />
                )}
                <Button
                  key={`del-${b.id}`}
                  label="Delete"
                  onPress={async () => {
                    await update($, roster, all => all.filter(x => x.id !== b.id))
                    if (b.id === current?.id) {
                      const rest = await read($, roster)
                      await update($, activeId, () => rest[0]?.id ?? null)
                    }
                    await persist($)
                  }}
                />
              </Box>
            ))}
          </Box>
        )}
      </Box>
    )
  })
}
