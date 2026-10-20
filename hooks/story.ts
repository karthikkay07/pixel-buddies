import type { Archetype, Journey, Run, Stats, StoryId } from '../types'

/**
 * A chapter: a beat of story, a quest from real work, and what comes back on
 * the stage when it ends. `{name}` is the buddy, `{left}` how much of the
 * quest is left.
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

export type StoryDef = {
  id: StoryId
  title: string
  emoji: string
  teaser: string
  /** Personalities this story suits best; it is suggested to them. */
  suits: readonly Archetype[]
  /** The stat that counts its finishes, for its achievement. */
  finishStat: keyof Omit<Stats, 'lastDay'>
  chapters: readonly Chapter[]
}

const q = (goal: string, stat: Chapter['quest']['stat'], need: number) => ({ goal, stat, need })

export const STORIES: readonly StoryDef[] = [
  {
    id: 'pixels',
    title: 'The Lost Pixels',
    emoji: '🏠',
    teaser: 'Your buddy fell out of Pixelia, a shattered game world. Find its lost pixels and rebuild its home.',
    suits: [],
    finishStat: 'storyPixels',
    chapters: [
      {
        title: 'A pixel falls',
        opening:
          "{name} tumbles out of a crack in the screen and dusts itself off. “I'm from Pixelia,” it says, “a little world inside an old game. It shattered, and its pixels scattered into the code all around us. Will you help me find them?”",
        quest: q('Send 5 prompts: every task shakes a lost pixel loose', 'prompts', 5),
        hint: '{left} more tasks and I bet a pixel shakes loose…',
        ending: 'A pixel rolls out from between two lines of code. {name} catches it, and it melts into the ground: grass springs up under your feet.',
        piece: 'Grass',
      },
      {
        title: 'The first spark',
        opening: '“Lost pixels hide where code works,” {name} whispers. “When tests pass, they light up like fireflies. Let\'s catch some.”',
        quest: q('Pass tests or a build 2 times', 'wins', 2),
        hint: '{left} more green test runs and the pixels will light up…',
        ending: 'Two pixels flare green and drift down beside the grass. A little tree sprouts. “That\'s the tree I used to nap under!”',
        piece: 'Tree',
      },
      {
        title: 'Map fragments',
        opening: '“Pixelia\'s map was torn into days,” {name} says. “Each day we spend together, another piece turns up.”',
        quest: q('Use Claude Code on 2 more days', 'days', 2),
        hint: 'See you tomorrow? {left} more days and the map is whole.',
        ending: 'With the map pieced together, {name} finds where home stood. Walls rise from the ground, just as it remembers.',
        piece: 'Walls',
      },
      {
        title: 'The Bug Swamp',
        opening: 'Between here and the old roof lies the Bug Swamp. “Errors are the swamp\'s monsters,” {name} says, gripping your sleeve. “Every one we survive makes us braver.”',
        quest: q('Survive 5 errors', 'errors', 5),
        hint: 'The swamp is scary… {left} more monsters to face.',
        ending: 'Covered in mud but grinning, {name} drags the old roof out of the swamp. Home has a roof again!',
        piece: 'Roof',
      },
      {
        title: "A friend's knock",
        opening: '“A home needs a door,” {name} says, “and a door needs a friend to knock on it.” It looks at you hopefully.',
        quest: q('Poke your buddy 5 times', 'pokes', 5),
        hint: 'Knock knock? {left} more pokes…',
        ending: 'Knock, knock! A door appears, and a window lights up beside it. {name} peeks out, delighted.',
        piece: 'Door and window',
      },
      {
        title: 'The long night',
        opening: 'Night falls over Pixelia, and it is very dark. “We need light,” {name} says. “Big jobs give off the brightest pixels.”',
        quest: q('Finish 3 long jobs (45 s or more)', 'longTurns', 3),
        hint: 'It\'s dark out… {left} big jobs would light it up.',
        ending: 'The long work pays off: a lamp post flickers on, and the dark feels cosy now.',
        piece: 'Lamp post',
      },
      {
        title: 'Raise the flag',
        opening: '“One last thing,” {name} says, eyes shining. “A flag on the roof, so other lost buddies can find their way home.”',
        quest: q('Watch Claude run 60 tools', 'toolCalls', 60),
        hint: 'The flag is nearly stitched… {left} more tools to go.',
        ending: 'The flag unfurls on the roof and catches the wind. Far away, something answers with a blink of light…',
        piece: 'Flag',
      },
      {
        title: "Who's out there?",
        opening: 'The light blinks again, closer now. {name} watches it for a long time. “There are others,” it says quietly. “Other buddies, still lost.”',
        quest: q('Come back on 3 more days', 'days', 3),
        hint: 'I keep watching that light… {left} more days.',
        ending: '{name} hangs a little pixel star by the door, so the others can find their way. “Home,” it says. Story complete!',
        piece: null,
      },
    ],
  },
  {
    id: 'voyager',
    title: 'Star Voyager',
    emoji: '🚀',
    teaser: 'Your buddy crash-landed in your terminal. Build a rocket, piece by piece, and fly it back to the stars.',
    suits: ['nerd', 'philosopher'],
    finishStat: 'storyVoyager',
    chapters: [
      {
        title: 'Crash landing',
        opening: 'With a thump and a puff of smoke, {name} lands in your terminal. “My rocket broke apart on the way down,” it says. “If we build a new one, I can see the stars again.”',
        quest: q('Send 5 prompts', 'prompts', 5),
        hint: '{left} more tasks and we\'ll have a launch pad.',
        ending: 'A launch pad clangs into place, and the night sky fills with stars.',
        piece: 'Launch pad and stars',
      },
      {
        title: 'Scaffolding',
        opening: '“Every rocket needs scaffolding,” {name} says. “Claude\'s tools are like a crane, lifting the parts into place.”',
        quest: q('Watch Claude run 25 tools', 'toolCalls', 25),
        hint: '{left} more tools and the scaffold is up.',
        ending: 'A scaffold tower rises beside the pad.',
        piece: 'Scaffold',
      },
      {
        title: 'The hull',
        opening: '“The hull has to be strong,” {name} says. “Code that passes its tests is the strongest stuff in the galaxy.”',
        quest: q('Pass tests or a build 2 times', 'wins', 2),
        hint: '{left} more passing test runs for the hull…',
        ending: 'Gleaming white panels bolt together into a rocket body.',
        piece: 'Rocket body',
      },
      {
        title: 'Mission control',
        opening: '“Every mission needs checking in,” {name} says. “Come back tomorrow, and we\'ll keep building.”',
        quest: q('Use Claude Code on 2 more days', 'days', 2),
        hint: 'Mission control, checking in… {left} more days.',
        ending: 'A bright red nose cone tops the rocket. It looks like it could fly already.',
        piece: 'Nose cone',
      },
      {
        title: 'Turbulence',
        opening: 'Test flights mean turbulence. “Every error we ride out teaches the rocket to steer,” {name} says, holding on tight.',
        quest: q('Survive 5 errors', 'errors', 5),
        hint: 'Bumpy ride… {left} more errors to weather.',
        ending: 'Fins snap onto the rocket. Now it won\'t spin like a pinwheel.',
        piece: 'Fins',
      },
      {
        title: 'A window to space',
        opening: '{name} keeps staring up at the sky. “I want to see where we\'re going,” it says dreamily.',
        quest: q('Hear 8 of its random thoughts', 'thoughts', 8),
        hint: 'Thinking about space… {left} more daydreams.',
        ending: 'A round porthole glows blue. {name} presses its face against it.',
        piece: 'Window',
      },
      {
        title: 'Ignition',
        opening: '“The engine needs real power,” {name} says. “Big jobs burn the brightest fuel.”',
        quest: q('Finish 3 long jobs (45 s or more)', 'longTurns', 3),
        hint: '{left} big jobs to fuel the engine…',
        ending: 'The engine roars to life with a burst of flame!',
        piece: 'Engine flame',
      },
      {
        title: 'Liftoff',
        opening: 'Everything is ready. “Will you count me down?” {name} asks. “Come back three more times for the countdown.”',
        quest: q('Start 3 more sessions', 'sessions', 3),
        hint: 'T-minus {left}…',
        ending: '3… 2… 1… LIFTOFF! The rocket streaks into the stars, and {name} waves from the window. Mission complete!',
        piece: null,
      },
    ],
  },
  {
    id: 'king',
    title: 'The Bug King',
    emoji: '⚔️',
    teaser: 'Deep beneath your code, the Bug King sends bugs into the world. Brave his dungeon and take him down.',
    suits: ['grump', 'gremlin', 'cheerleader'],
    finishStat: 'storyKing',
    chapters: [
      {
        title: 'The dungeon gate',
        opening: 'Deep beneath your code lies a dungeon, and in it the Bug King, who sends bugs out into the world. {name} straightens a tiny helmet. “Someone has to stop him.”',
        quest: q('Send 5 prompts', 'prompts', 5),
        hint: '{left} more tasks to reach the dungeon…',
        ending: 'Your steps echo on cold stone. You\'re in.',
        piece: 'Stone floor',
      },
      {
        title: 'Light in the dark',
        opening: 'It\'s pitch black down here. “We\'ll need torches,” {name} whispers.',
        quest: q('Start 2 more sessions', 'sessions', 2),
        hint: '{left} more visits and we\'ll have light…',
        ending: 'A torch flickers to life on the wall.',
        piece: 'Torch',
      },
      {
        title: 'Minions of the King',
        opening: 'Bugs swarm the corridor: the King\'s minions! “Every error we survive is one minion down,” {name} shouts.',
        quest: q('Survive 5 errors', 'errors', 5),
        hint: '{left} more minions to beat!',
        ending: 'The minions scatter, and a heavy dungeon door looms out of the dark.',
        piece: 'Dungeon door',
      },
      {
        title: 'The riddle lock',
        opening: 'The door is sealed with a riddle. “Only passing tests can answer it,” {name} reads aloud.',
        quest: q('Pass tests or a build 3 times', 'wins', 3),
        hint: '{left} more green test runs to crack the lock…',
        ending: 'Click. The door swings open, and another torch lights the way.',
        piece: 'Second torch',
      },
      {
        title: 'The treasure room',
        opening: 'Behind the door, a room piled with treasure, and traps everywhere. “Claude\'s tools can disarm them,” {name} says.',
        quest: q('Watch Claude run 40 tools', 'toolCalls', 40),
        hint: '{left} traps left to disarm…',
        ending: 'The traps go quiet. A treasure chest sits in the middle of the room.',
        piece: 'Treasure chest',
      },
      {
        title: 'The sword in the stone',
        opening: '“Only a true friend can pull the sword,” reads the inscription. {name} looks at you.',
        quest: q('Poke your buddy 5 times', 'pokes', 5),
        hint: 'Poke me {left} more times and I\'ll pull the sword!',
        ending: 'With a mighty heave, {name} pulls the sword free!',
        piece: 'Sword in the stone',
      },
      {
        title: 'The Bug King',
        opening: 'The Bug King rises, enormous and buzzing. “This is it,” {name} says. “Big jobs are our strongest attacks.”',
        quest: q('Finish 3 long jobs (45 s or more)', 'longTurns', 3),
        hint: '{left} more big blows and the King falls!',
        ending: 'The Bug King crumbles into a pile of fixed semicolons. His crown clatters onto the chest.',
        piece: "The King's crown",
      },
      {
        title: 'Hero of the realm',
        opening: 'The kingdom is safe… for now. “Come back on three more days,” says a herald, “to be crowned its hero.”',
        quest: q('Use Claude Code on 3 more days', 'days', 3),
        hint: '{left} days until the ceremony.',
        ending: 'Trumpets sound. {name} is knighted Hero of the Realm! Story complete!',
        piece: null,
      },
    ],
  },
  {
    id: 'garden',
    title: 'Code Garden',
    emoji: '🌱',
    teaser: 'A cosy one. Grow a garden from a single seed, a little every day.',
    suits: ['sleepy', 'poet'],
    finishStat: 'storyGarden',
    chapters: [
      {
        title: 'A single seed',
        opening: '{name} holds out a tiny seed in both hands. “Let\'s grow something,” it says. “Slowly, a little each day.”',
        quest: q('Send 3 prompts', 'prompts', 3),
        hint: '{left} more tasks and we can plant it…',
        ending: 'You dig a little patch of soil together and plant the seed.',
        piece: 'Soil',
      },
      {
        title: 'First sprout',
        opening: 'Seeds don\'t hurry. “We just have to come back and look after it,” {name} says.',
        quest: q('Use Claude Code on 2 more days', 'days', 2),
        hint: '{left} more days of sun and water…',
        ending: 'A tiny green sprout pokes out of the soil! {name} gasps.',
        piece: 'Sprout',
      },
      {
        title: 'Flowers',
        opening: '“Flowers love good news,” {name} says. “Let\'s give them some.”',
        quest: q('Pass tests or a build 2 times', 'wins', 2),
        hint: '{left} passing test runs and the flowers will open…',
        ending: 'Flowers bloom in pink and yellow and blue.',
        piece: 'Flowers',
      },
      {
        title: 'A fence',
        opening: 'Rabbits have been nibbling the leaves. “A little fence would keep the garden safe,” {name} says.',
        quest: q('Watch Claude run 30 tools', 'toolCalls', 30),
        hint: '{left} more tools to finish the fence…',
        ending: 'A white picket fence goes up, plank by plank.',
        piece: 'Fence',
      },
      {
        title: 'Blossom',
        opening: 'The sprout is getting tall. “It\'s turning into a tree!” {name} says.',
        quest: q('Start 4 more sessions', 'sessions', 4),
        hint: '{left} more visits and it\'ll blossom…',
        ending: 'The little tree bursts into pink blossom.',
        piece: 'Blossom tree',
      },
      {
        title: 'Rain',
        opening: 'Storm clouds roll in. “Rain is good for gardens,” {name} says, a little unsure. Some errors are like rain.',
        quest: q('Survive 4 errors', 'errors', 4),
        hint: '{left} more rainy errors and the pond will fill…',
        ending: 'After the storm, a little pond shimmers in the grass.',
        piece: 'Pond',
      },
      {
        title: 'Bees',
        opening: 'The garden is so peaceful that {name} keeps drifting off into daydreams.',
        quest: q('Hear 10 of its random thoughts', 'thoughts', 10),
        hint: 'Mmm, so peaceful… {left} more daydreams.',
        ending: 'Bees find the blossom, and a little beehive appears on the fence, humming.',
        piece: 'Beehive',
      },
      {
        title: 'In full bloom',
        opening: 'The garden is nearly perfect. “Let\'s just enjoy it for a few days,” {name} says.',
        quest: q('Use Claude Code on 3 more days', 'days', 3),
        hint: '{left} more lazy days in the garden.',
        ending: 'The garden is in full bloom, and {name} weaves you both a flower crown. Story complete!',
        piece: null,
      },
    ],
  },
  {
    id: 'repo',
    title: 'The Sunken Repo',
    emoji: '🏴‍☠️',
    teaser: 'Washed up on a beach with a soggy map, your buddy is after treasure lost at sea. Arr.',
    suits: ['pirate', 'gremlin'],
    finishStat: 'storyRepo',
    chapters: [
      {
        title: 'Washed ashore',
        opening: '{name} washes up on a sandy beach, clutching a soggy map. “The Sunken Repo,” it whispers. “Treasure, lost at sea!”',
        quest: q('Send 5 prompts', 'prompts', 5),
        hint: '{left} more tasks to dry out the map…',
        ending: 'Warm sand spreads under your feet, and the sea glitters.',
        piece: 'Beach',
      },
      {
        title: 'Shade',
        opening: 'The sun is scorching. “First, a palm tree,” {name} says, fanning itself.',
        quest: q('Start 2 more sessions', 'sessions', 2),
        hint: '{left} more visits until there\'s shade…',
        ending: 'A palm tree sways over the beach.',
        piece: 'Palm tree',
      },
      {
        title: 'Rough seas',
        opening: 'Storms whip up the waves. “Every error we weather calms the sea a little,” {name} says.',
        quest: q('Survive 4 errors', 'errors', 4),
        hint: '{left} more storms to weather…',
        ending: 'The sea calms into gentle rolling waves.',
        piece: 'Waves',
      },
      {
        title: 'A boat',
        opening: '“To reach the wreck, we need a boat,” {name} says. “Claude\'s tools make good hammers.”',
        quest: q('Watch Claude run 40 tools', 'toolCalls', 40),
        hint: '{left} more tools to finish the boat…',
        ending: 'A sturdy rowboat bobs on the water.',
        piece: 'Rowboat',
      },
      {
        title: 'Message in a bottle',
        opening: 'A bottle bobs ashore with a riddle inside. {name} sits on the sand and thinks.',
        quest: q('Hear 8 of its random thoughts', 'thoughts', 8),
        hint: 'Hmm, the riddle… {left} more thoughts.',
        ending: 'The riddle points to a spot on the beach, where the bottle lies half buried.',
        piece: 'Bottle',
      },
      {
        title: 'X marks the spot',
        opening: '“Dig where the tests pass,” says the riddle. “Of course!” {name} shouts.',
        quest: q('Pass tests or a build 3 times', 'wins', 3),
        hint: '{left} more passing test runs and we\'ll know where to dig…',
        ending: 'A big red X appears in the sand, with a shovel beside it.',
        piece: 'X and shovel',
      },
      {
        title: 'Dig!',
        opening: 'Digging is hard work. “Big jobs dig the deepest,” {name} says, rolling up its sleeves.',
        quest: q('Finish 3 long jobs (45 s or more)', 'longTurns', 3),
        hint: '{left} more big jobs and we\'ll hit something!',
        ending: 'Clunk! The shovel hits wood… a treasure chest!',
        piece: 'Treasure chest',
      },
      {
        title: "Captain's share",
        opening: 'The chest is stuck fast. “We\'ll come back with the tide,” {name} says.',
        quest: q('Use Claude Code on 3 more days', 'days', 3),
        hint: '{left} more tides…',
        ending: 'The chest creaks open: gold, gems, and a fine captain\'s hat. Story complete!',
        piece: null,
      },
    ],
  },
]

export const STORY_IDS = STORIES.map(s => s.id)

export function isStoryId(value: unknown): value is StoryId {
  return typeof value === 'string' && STORY_IDS.includes(value as StoryId)
}

export function storyOf(id: StoryId): StoryDef {
  return STORIES.find(s => s.id === id) ?? (STORIES[0] as StoryDef)
}

/** The story a personality is suggested: the first that suits it, else The Lost Pixels. */
export function suggestedStory(archetype: Archetype): StoryId {
  return STORIES.find(s => s.suits.includes(archetype))?.id ?? 'pixels'
}

/** How many pieces of a story's scene are back once `chapter` chapters are done. */
export function piecesBuilt(id: StoryId, chapter: number): number {
  return storyOf(id).chapters.slice(0, chapter).filter(c => c.piece !== null).length
}

export function isFinished(id: StoryId, run: Run): boolean {
  return run.chapter >= storyOf(id).chapters.length
}

/** A run starting now, at the first chapter. */
export function newRun(stats: Stats): Run {
  return { chapter: 0, banked: 0, from: stats, isTold: false }
}

/** The quest's progress: what was banked while playing, and what has happened since it last started playing. */
export function runProgress(id: StoryId, run: Run, stats: Stats): { value: number; need: number; isDone: boolean } {
  const chapter = storyOf(id).chapters[run.chapter]
  if (!chapter) return { value: 0, need: 0, isDone: false }
  const { stat, need } = chapter.quest
  const live = run.from ? Math.max(0, stats[stat] - run.from[stat]) : 0
  const value = Math.min(need, run.banked + live)
  return { value, need, isDone: value >= need }
}

/** Puts a run aside (another story or another buddy is being played), keeping what it had done. */
export function pauseRun(id: StoryId, run: Run, stats: Stats): Run {
  if (!run.from) return run
  return { ...run, banked: runProgress(id, run, stats).value, from: null }
}

/** Picks a run back up: from now on, what happens counts toward it again. */
export function resumeRun(run: Run, stats: Stats): Run {
  return run.from ? run : { ...run, from: stats }
}

/** The next chapter, starting now. */
export function nextChapter(run: Run, stats: Stats): Run {
  return { chapter: run.chapter + 1, banked: 0, from: stats, isTold: false }
}

/** The story a buddy is playing and its run, if it is playing one. */
export function currentRun(journey: Journey | undefined): { id: StoryId; run: Run } | null {
  if (!journey?.current) return null
  const run = journey.runs[journey.current]
  return run ? { id: journey.current, run } : null
}

/**
 * Switches a buddy to `id`: the story it was playing is paused, the new one
 * resumed where it was left (or begun).
 */
export function switchStory(journey: Journey, id: StoryId, stats: Stats): Journey {
  const runs = { ...journey.runs }
  if (journey.current && journey.current !== id) {
    const old = runs[journey.current]
    if (old) runs[journey.current] = pauseRun(journey.current, old, stats)
  }
  const existing = runs[id]
  runs[id] = existing ? resumeRun(existing, stats) : newRun(stats)
  return { current: id, runs }
}

/** Every run of a buddy paused: it is no longer the one being played. */
export function pauseJourney(journey: Journey, stats: Stats): Journey {
  const runs = { ...journey.runs }
  for (const id of STORY_IDS) {
    const run = runs[id]
    if (run) runs[id] = pauseRun(id, run, stats)
  }
  return { ...journey, runs }
}

/** The buddy's current run resumed: it is the one being played now. */
export function resumeJourney(journey: Journey, stats: Stats): Journey {
  const cur = currentRun(journey)
  if (!cur) return journey
  return { ...journey, runs: { ...journey.runs, [cur.id]: resumeRun(cur.run, stats) } }
}

export function fillStory(text: string, name: string, left = 0): string {
  return text.replaceAll('{name}', name).replaceAll('{left}', String(left))
}

/** A progress bar of ten blocks: `███████░░░ 7/10`. */
export function bar(value: number, need: number): string {
  const filled = need > 0 ? Math.round((value / need) * 10) : 0
  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)} ${value}/${need}`
}
