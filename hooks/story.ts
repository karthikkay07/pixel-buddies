import type { Stats, Story } from '../types'

/**
 * The Lost Pixels: your buddy fell out of Pixelia, a little world inside an
 * old game that shattered, and wants to rebuild home. Each chapter opens with
 * a beat of story and a quest from real work; finishing it brings back a
 * piece of home on the buddy's stage. `{name}` is the buddy, `{left}` how much
 * of the quest is left.
 */
export type Chapter = {
  title: string
  opening: string
  quest: { goal: string; stat: keyof Omit<Stats, 'lastDay'>; need: number }
  /** A thought the buddy has about the quest while it is open. */
  hint: string
  ending: string
  /** What comes back on the stage when the chapter ends, if anything. */
  piece: string | null
}

export const CHAPTERS: readonly Chapter[] = [
  {
    title: 'A pixel falls',
    opening:
      "{name} tumbles out of a crack in the screen and dusts itself off. “I'm from Pixelia,” it says, “a little world inside an old game. It shattered, and its pixels scattered into the code all around us. Will you help me find them?”",
    quest: { goal: 'Send 5 prompts: every task shakes a lost pixel loose', stat: 'prompts', need: 5 },
    hint: '{left} more tasks and I bet a pixel shakes loose…',
    ending: 'A pixel rolls out from between two lines of code. {name} catches it, and it melts into the ground: grass springs up under your feet.',
    piece: 'Grass',
  },
  {
    title: 'The first spark',
    opening: '“Lost pixels hide where code works,” {name} whispers. “When tests pass, they light up like fireflies. Let\'s catch some.”',
    quest: { goal: 'Pass tests or a build 2 times', stat: 'wins', need: 2 },
    hint: '{left} more green test runs and the pixels will light up…',
    ending: 'Two pixels flare green and drift down beside the grass. A little tree sprouts. “That\'s the tree I used to nap under!”',
    piece: 'Tree',
  },
  {
    title: 'Map fragments',
    opening: '“Pixelia\'s map was torn into days,” {name} says. “Each day we spend together, another piece turns up.”',
    quest: { goal: 'Use Claude Code on 2 more days', stat: 'days', need: 2 },
    hint: 'See you tomorrow? {left} more days and the map is whole.',
    ending: 'With the map pieced together, {name} finds where home stood. Walls rise from the ground, just as it remembers.',
    piece: 'Walls',
  },
  {
    title: 'The Bug Swamp',
    opening: 'Between here and the old roof lies the Bug Swamp. “Errors are the swamp\'s monsters,” {name} says, gripping your sleeve. “Every one we survive makes us braver.”',
    quest: { goal: 'Survive 5 errors', stat: 'errors', need: 5 },
    hint: 'The swamp is scary… {left} more monsters to face.',
    ending: 'Covered in mud but grinning, {name} drags the old roof out of the swamp. Home has a roof again!',
    piece: 'Roof',
  },
  {
    title: "A friend's knock",
    opening: '“A home needs a door,” {name} says, “and a door needs a friend to knock on it.” It looks at you hopefully.',
    quest: { goal: 'Poke your buddy 5 times', stat: 'pokes', need: 5 },
    hint: 'Knock knock? {left} more pokes…',
    ending: 'Knock, knock! A door appears, and a window lights up beside it. {name} peeks out, delighted.',
    piece: 'Door and window',
  },
  {
    title: 'The long night',
    opening: 'Night falls over Pixelia, and it is very dark. “We need light,” {name} says. “Big jobs give off the brightest pixels.”',
    quest: { goal: 'Finish 3 long jobs (45 s or more)', stat: 'longTurns', need: 3 },
    hint: 'It\'s dark out… {left} big jobs would light it up.',
    ending: 'The long work pays off: a lamp post flickers on, and the dark feels cosy now.',
    piece: 'Lamp post',
  },
  {
    title: 'Raise the flag',
    opening: '“One last thing,” {name} says, eyes shining. “A flag on the roof, so other lost buddies can find their way home.”',
    quest: { goal: 'Watch Claude run 60 tools', stat: 'toolCalls', need: 60 },
    hint: 'The flag is nearly stitched… {left} more tools to go.',
    ending: 'The flag unfurls on the roof and catches the wind. Far away, something answers with a blink of light…',
    piece: 'Flag',
  },
  {
    title: "Who's out there?",
    opening: 'The light blinks again, closer now. {name} watches it for a long time. “There are others,” it says quietly. “Other buddies, still lost.”',
    quest: { goal: 'Come back on 3 more days', stat: 'days', need: 3 },
    hint: 'I keep watching that light… {left} more days.',
    ending: '{name} packs a tiny bag. “I think it\'s a friend,” it says. To be continued in the next update…',
    piece: null,
  },
]

/** How many pieces of home are back once `chapter` chapters are done. */
export function piecesBuilt(chapter: number): number {
  return CHAPTERS.slice(0, chapter).filter(c => c.piece !== null).length
}

export function isFinished(story: Story): boolean {
  return story.chapter >= CHAPTERS.length
}

export function questProgress(story: Story, stats: Stats): { value: number; need: number; isDone: boolean } {
  const chapter = CHAPTERS[story.chapter]
  if (!chapter) return { value: 0, need: 0, isDone: false }
  const { stat, need } = chapter.quest
  const value = Math.max(0, Math.min(need, stats[stat] - story.start[stat]))
  return { value, need, isDone: value >= need }
}

export function fillStory(text: string, name: string, left = 0): string {
  return text.replaceAll('{name}', name).replaceAll('{left}', String(left))
}

/** A progress bar of ten blocks: `███████░░░ 7/10`. */
export function bar(value: number, need: number): string {
  const filled = need > 0 ? Math.round((value / need) * 10) : 0
  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)} ${value}/${need}`
}
