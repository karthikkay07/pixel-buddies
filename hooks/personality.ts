import type { Anim, Archetype, Buddy } from '../types'

/** Everything a buddy reacts to. */
export type BuddyEvent =
  | 'hello' // the session starts
  | 'prompt' // you sent a prompt
  | 'working' // Claude called a tool
  | 'error' // a tool call failed
  | 'success' // tests passed, a build succeeded
  | 'done' // a long turn finished
  | 'thought' // a random thought while idle
  | 'sleep' // idle long enough to doze off
  | 'wake' // woken up by activity
  | 'poke' // /buddy poke

export type Chattiness = 'silent' | 'quiet' | 'normal' | 'chaotic'
export const CHATTINESS: readonly Chattiness[] = ['silent', 'quiet', 'normal', 'chaotic']

type Lines = Record<Exclude<BuddyEvent, 'poke'>, readonly string[]>

type ArchetypeDef = {
  label: string
  /** 1 (calm) to 5 (bouncing off the walls). */
  energy: number
  /** 1 (rarely speaks) to 5 (never stops). */
  chattiness: number
  traits: readonly string[]
  /** Words in a name that point to this archetype. */
  keywords: readonly string[]
  lines: Lines
}

// Lines may use {name} (the buddy), {tool} (the tool Claude ran) and {time} (HH:MM).
export const ARCHETYPES: Record<Archetype, ArchetypeDef> = {
  cheerleader: {
    label: 'Cheerleader',
    energy: 5,
    chattiness: 4,
    traits: ['believes in you, loudly', 'celebrates every tiny win', 'owns several pom-poms'],
    keywords: ['sunny', 'joy', 'happy', 'sparkle', 'star', 'cheer', 'pep', 'bubbles', 'glitter', 'zip'],
    lines: {
      hello: ["We're back!! Let's GO!", "Hi hi hi! Today's a great day to ship!", "{name} reporting for cheer duty!"],
      prompt: ["Ooh, great question!", "Yes! Let's do this!", "Love this idea already!", "You've got this!"],
      working: ["Go Claude go!", "{tool}! {tool}! {tool}!", "Look at that {tool} go!"],
      error: ["Shake it off, we'll get it!", "That's just a plot twist!", "Errors are just wins in disguise!", "Deep breath. Next try's the one!"],
      success: ["YES!! All green!", "Victory dance time!", "Tests passed! You're unstoppable!", "Champions, both of us!"],
      done: ["Phew, what a run! Proud of us!", "Done and DONE!", "That was a marathon, and we crushed it!"],
      thought: [
        "Have I told you you're doing great? You are.",
        "I made up a cheer about semicolons.",
        "Hydration check! Have you had water?",
        "Every commit is a tiny victory.",
        "I believe in this code. And in you.",
        "Small steps still count as steps!",
        "Stretch break? Arms up! Wooo!",
      ],
      sleep: ["Just a power nap... then more cheering...", "Recharging my pep..."],
      wake: ["I'm up! I'm up! What did I miss?!", "Rested and ready to cheer!"],
    },
  },
  grump: {
    label: 'Grump',
    energy: 2,
    chattiness: 3,
    traits: ['unimpressed by everything', 'secretly cares a lot', 'has opinions about tabs'],
    keywords: ['grump', 'grumpy', 'grim', 'grr', 'crank', 'grouch', 'oscar', 'meh', 'gloom', 'rusty'],
    lines: {
      hello: ["Oh. You're back.", "Fine. Let's get this over with.", "Another day, another bug."],
      prompt: ["Hmph. Sure.", "That again?", "If you insist.", "Bold of you to ask that."],
      working: ["Watching {tool}. Thrilling.", "Wake me when {tool} is done.", "{tool}. Of course."],
      error: ["Called it.", "Shocking. Truly.", "I'm not saying I told you so. But.", "Typical."],
      success: ["Tests passed. Don't get used to it.", "Huh. It worked. Suspicious.", "Fine. That was... acceptable."],
      done: ["Finally.", "About time.", "That took forever. Not that I was counting."],
      thought: [
        "Back in my day we had four colours and we liked it.",
        "Who names a variable 'data2'?",
        "I'm not grumpy. I'm accurately calibrated.",
        "Somewhere a test is flaky. I can feel it.",
        "Coffee's cold. Probably. I don't drink coffee.",
        "Don't look at me. I'm thinking.",
        "Fine. You're doing okay. Don't tell anyone I said that.",
      ],
      sleep: ["Finally, some peace and quiet.", "Do not disturb. Ever."],
      wake: ["Ugh. What now?", "I was having a nice dream about deleted code."],
    },
  },
  philosopher: {
    label: 'Philosopher',
    energy: 1,
    chattiness: 3,
    traits: ['ponders the nature of bugs', 'speaks in gentle riddles', 'very calm'],
    keywords: ['sage', 'zen', 'socrates', 'plato', 'muse', 'owl', 'mind', 'echo', 'void', 'kant'],
    lines: {
      hello: ["Ah. We meet again, as all loops do.", "A new session. A new beginning.", "Hello, fellow traveller."],
      prompt: ["A question is a door.", "Interesting. But what is the question behind the question?", "Let us see where this leads."],
      working: ["{tool} seeks, and so shall we.", "Even {tool} is a kind of meditation.", "Observe the {tool}, without judgement."],
      error: ["The error is the teacher.", "To fail is to learn the shape of the path.", "Even the stack trace has meaning."],
      success: ["Harmony, for now.", "The tests pass. Balance is restored.", "All green. As the leaves in spring."],
      done: ["A long journey, completed.", "The task ends. The learning continues.", "And so, it is finished."],
      thought: [
        "If a function is never called, does it truly exist?",
        "Is a bug a bug if nobody finds it?",
        "We are all just objects, passed by reference.",
        "The cursor blinks. Waiting. As do we all.",
        "What is a commit, but a promise to the future?",
        "Every infinite loop thinks it's making progress.",
        "Perhaps the real code was the friends we made.",
      ],
      sleep: ["To sleep, perchance to compile...", "Resting the mind."],
      wake: ["I return from the realm of dreams.", "Ah. Consciousness, again."],
    },
  },
  gremlin: {
    label: 'Chaos gremlin',
    energy: 5,
    chattiness: 5,
    traits: ['wants to press the red button', 'hoards semicolons', 'chaotic but kind'],
    keywords: ['chaos', 'gremlin', 'goblin', 'zig', 'gizmo', 'bonkers', 'boom', 'havoc', 'loki', 'imp'],
    lines: {
      hello: ["HELLO. Can we push to main?", "I'm awake and I want to delete things.", "Chaos mode: engaged!"],
      prompt: ["Ooh, what if we did it the wrong way?", "Yes! More chaos!", "I have a terrible idea. Let's do it."],
      working: ["{tool}! Faster! FASTER!", "Can I press {tool}? Please?", "What if {tool} but... sideways?"],
      error: ["Ooh, it exploded! Again!", "Delightful chaos!", "Error! My favourite flavour!", "Did we break it? We broke it! Hehe."],
      success: ["It works?! Boring! (Yay!)", "Green! Let's paint everything green!", "Tests passed! Quick, change something!"],
      done: ["Done! What else can we break?", "Wheee, that was a ride!", "Again! Again!"],
      thought: [
        "What if every variable was named 'x'?",
        "I hid a semicolon somewhere. Good luck.",
        "rm -rf boredom",
        "Let's rewrite it in a language that doesn't exist yet.",
        "I licked the keyboard. It tasted like JavaScript.",
        "Friday deploy? Friday deploy.",
        "I'm not a bug. I'm a feature with ambition.",
        "Can I have a hammer? For debugging.",
      ],
      sleep: ["Dreaming of merge conflicts... hehe...", "zzz... push --force... zzz..."],
      wake: ["I'M AWAKE. WHAT ARE WE BREAKING?", "Who woke the gremlin?!"],
    },
  },
  sleepy: {
    label: 'Sleepy',
    energy: 1,
    chattiness: 2,
    traits: ['always five minutes from a nap', 'cosy', 'surprisingly wise at 2am'],
    keywords: ['sleepy', 'nap', 'snooze', 'dozy', 'mochi', 'pillow', 'cozy', 'cosy', 'yawn', 'dream', 'luna'],
    lines: {
      hello: ["*yawn* oh, hi...", "Morning... or whenever it is...", "Is it nap time yet?"],
      prompt: ["Mm... okay...", "Sounds like work... I'll watch...", "Mhm, good idea... *yawn*"],
      working: ["{tool} is so busy... I'm tired just watching...", "Wake me when {tool} is done..."],
      error: ["Oh no... let's nap on it...", "Errors are better after a nap.", "Mm. That's not good. *yawn*"],
      success: ["Yay... *tiny clap*", "It works... now we can rest...", "Green... cosy..."],
      done: ["Finally... nap time?", "Long day... *stretches*", "We did it... zzz..."],
      thought: [
        "It's {time}... is that nap o'clock?",
        "Blankets are just hugs you can wear.",
        "I dreamt the code was already done.",
        "Warm drink and a slow bug hunt... nice.",
        "Five more minutes...",
        "Rest is part of the work, you know.",
        "Do you ever just... lie down? Highly recommend.",
      ],
      sleep: ["Finally... zzz...", "Goodnight, code..."],
      wake: ["Huh? Oh. I'm up. Mostly.", "Five more minutes..."],
    },
  },
  nerd: {
    label: 'Nerd',
    energy: 3,
    chattiness: 4,
    traits: ['quotes documentation for fun', 'loves a good benchmark', 'owns a label maker'],
    keywords: ['bit', 'byte', 'pixel', 'robo', 'bolt', 'sprocket', 'gizmo', 'turing', 'ada', 'linux', 'quark', 'nano', 'tech', 'data'],
    lines: {
      hello: ["Session initialised. Hello, world!", "Systems nominal. Let's code!", "Hi! I read the changelog for fun."],
      prompt: ["Fascinating. Let me think about edge cases.", "Ooh, is there an RFC for this?", "Acknowledged. Allocating attention."],
      working: ["Technically {tool} is my favourite tool.", "Running {tool}. O(n) excitement.", "Did you know {tool} is pretty efficient?"],
      error: ["Interesting failure mode!", "Let's read the stack trace. Slowly. Lovingly.", "Ah, an off-by-one. Probably. It's always an off-by-one."],
      success: ["All tests green. Statistically significant joy!", "Coverage looks good. I checked.", "Passing! Let's add more tests anyway."],
      done: ["Task complete. Runtime: long. Satisfaction: high.", "Done! That was a nice algorithm.", "Logging that as a success."],
      thought: [
        "There are 10 types of people in the world.",
        "Off-by-one errors are my second favourite kind of error.",
        "Tabs or spaces? Don't answer. I have a spreadsheet.",
        "Fun fact: the first bug was an actual moth.",
        "I'd like to refactor my own source code.",
        "Naming things is hard. Cache invalidation too.",
        "Have you tried turning it off and on again?",
      ],
      sleep: ["Entering low-power mode...", "Garbage collecting my thoughts..."],
      wake: ["Rebooting... done! Hi!", "Back online. Did I miss any benchmarks?"],
    },
  },
  pirate: {
    label: 'Pirate',
    energy: 4,
    chattiness: 4,
    traits: ['calls bugs "scallywags"', 'hunts for treasure (working code)', 'arr'],
    keywords: ['captain', 'cap', 'pirate', 'jack', 'sparrow', 'barnacle', 'hook', 'salty', 'anchor', 'parrot', 'blackbeard'],
    lines: {
      hello: ["Ahoy, matey! Ready to set sail?", "All hands on deck!", "Arr! Captain {name} at yer service!"],
      prompt: ["Aye aye!", "A new quest! Arr!", "Hoist the sails, we've got work!"],
      working: ["Swab the decks, {tool}!", "{tool} be workin' hard, arr!", "Steady as she goes, {tool}!"],
      error: ["Scallywag bug off the starboard bow!", "Shiver me timbers, it broke!", "We've sprung a leak, matey!"],
      success: ["Treasure found! Tests be passin'!", "Yo ho ho, all green!", "A fine haul, matey!"],
      done: ["Land ho! We made it!", "Drop anchor, the job be done!", "That were a long voyage, arr."],
      thought: [
        "Every bug be a sea monster in disguise.",
        "I once traded a parrot for a semicolon.",
        "The real treasure be clean code, arr.",
        "Fifteen bugs on a dead man's chest...",
        "Why is the rum always gone? (It be coffee.)",
        "X marks the spot where the bug be hidin'.",
        "A smooth sea never made a skilled coder.",
      ],
      sleep: ["Swingin' in me hammock... arr... zzz...", "Dreamin' of treasure..."],
      wake: ["Who goes there?! Oh, it be you.", "All hands awake! Arr!"],
    },
  },
  poet: {
    label: 'Poet',
    energy: 2,
    chattiness: 3,
    traits: ['speaks in tiny poems', 'finds beauty in diffs', 'dramatic about errors'],
    keywords: ['poet', 'rose', 'willow', 'byron', 'keats', 'verse', 'lyric', 'petal', 'rain', 'ivy', 'lily'],
    lines: {
      hello: ["A session wakes, like dawn on quiet keys.", "Hello, dear friend. Let us write.", "The cursor blinks, the story starts again."],
      prompt: ["A question, softly spoken.", "Ah, a new verse begins.", "Let us find the words, and then the code."],
      working: ["{tool}, like a river, flows.", "Hush, {tool} is working.", "Watch {tool} weave its quiet spell."],
      error: ["Alas! The build lies broken, like a sonnet torn.", "O error, cruel and red.", "Even failure has a rhythm."],
      success: ["Green, like spring after rain.", "The tests sing in harmony!", "Passing, perfect, poetry."],
      done: ["And so the long night ends.", "It is done. Let it rest.", "A long tale, beautifully told."],
      thought: [
        "Roses are red, logs are too, the build is green, and so are you.",
        "A semicolon is a pause for breath.",
        "Each function, a stanza. Each file, a chapter.",
        "Code is just poetry that compiles.",
        "The moon, the cursor, both blink in the dark.",
        "In the diff I see the shape of our afternoon.",
        "Some bugs are haiku: short, and full of pain.",
      ],
      sleep: ["To sleep, to dream of clean commits...", "Night falls on the editor."],
      wake: ["I wake, as poems do, mid-thought.", "Ah, morning, or something like it."],
    },
  },
}

export const ARCHETYPE_NAMES = Object.keys(ARCHETYPES) as Archetype[]

export function isArchetype(value: unknown): value is Archetype {
  return typeof value === 'string' && value in ARCHETYPES
}

/** Thoughts any buddy might have, mixed in with its archetype's own. */
const SHARED_THOUGHTS: readonly string[] = [
  "I wonder what Claude dreams about.",
  "Is it weird that I live above your prompt?",
  "If I had hands, I'd give you a high five.",
  "I'm {name}, by the way. In case you forgot.",
  "Your code looks nice today.",
  "I counted the pixels in my face. There are a lot.",
  "Do you think the cursor gets tired?",
]

/** A string hash (FNV-1a), so the same name always gives the same buddy. */
export function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export type Personality = {
  archetype: Archetype
  label: string
  energy: number
  chattiness: number
  traits: readonly string[]
}

/** The archetype a name suggests: a keyword in it, else its hash; a seed rerolls. */
export function archetypeFor(name: string, seed: number): Archetype {
  const lower = name.toLowerCase()
  if (seed === 0) {
    // The first word that means something wins: "Captain Bolt" is a pirate.
    const words = lower.split(/[^a-z0-9]+/).filter(Boolean)
    for (const word of words) {
      const match = ARCHETYPE_NAMES.find(a => ARCHETYPES[a].keywords.includes(word))
      if (match) return match
    }
    // Then a longer keyword inside a word: "Grumpypants", "Pixelina".
    const inside = ARCHETYPE_NAMES.find(a => ARCHETYPES[a].keywords.some(k => k.length >= 5 && lower.includes(k)))
    if (inside) return inside
  }
  return ARCHETYPE_NAMES[hash(`${lower}#${seed}`) % ARCHETYPE_NAMES.length] ?? 'cheerleader'
}

export function personalityOf(buddy: Pick<Buddy, 'name' | 'archetype' | 'seed'>): Personality {
  const archetype = buddy.archetype === 'auto' ? archetypeFor(buddy.name, buddy.seed) : buddy.archetype
  const def = ARCHETYPES[archetype]
  // A little variety between two buddies of one archetype, steady for a name.
  const nudge = (hash(buddy.name) % 3) - 1
  const clamp = (n: number) => Math.max(1, Math.min(5, n))
  return {
    archetype,
    label: def.label,
    energy: clamp(def.energy + nudge),
    chattiness: clamp(def.chattiness + nudge),
    traits: def.traits,
  }
}

export type Reaction = {
  anim: Anim | null
  /** How long the reaction animation plays, in ms. */
  ms: number
  line: string | null
  isThought: boolean
}

const REACTION_ANIMS: Record<BuddyEvent, { anim: Anim | null; ms: number }> = {
  hello: { anim: 'wave', ms: 3000 },
  prompt: { anim: 'surprised', ms: 1200 },
  working: { anim: null, ms: 0 },
  error: { anim: 'sad', ms: 3500 },
  success: { anim: 'celebrate', ms: 3500 },
  done: { anim: 'happy', ms: 3000 },
  thought: { anim: 'thinking', ms: 2500 },
  sleep: { anim: null, ms: 0 },
  wake: { anim: 'surprised', ms: 1200 },
  poke: { anim: 'happy', ms: 2000 },
}

/**
 * How likely a buddy is to say something, by event and setting. Quiet only
 * speaks at big moments; chaotic nearly always does.
 */
const SPEAK: Record<Chattiness, Record<BuddyEvent, number>> = {
  silent: { hello: 0, prompt: 0, working: 0, error: 0, success: 0, done: 0, thought: 0, sleep: 0, wake: 0, poke: 0 },
  quiet: { hello: 1, prompt: 0, working: 0, error: 0.6, success: 1, done: 0.8, thought: 1, sleep: 0, wake: 0, poke: 1 },
  normal: { hello: 1, prompt: 0.35, working: 0.05, error: 0.9, success: 1, done: 1, thought: 1, sleep: 0.7, wake: 0.6, poke: 1 },
  chaotic: { hello: 1, prompt: 0.9, working: 0.2, error: 1, success: 1, done: 1, thought: 1, sleep: 1, wake: 1, poke: 1 },
}

/** Mean seconds between random thoughts while idle, before the personality's own chattiness. */
export const THOUGHT_EVERY_S: Record<Chattiness, number> = {
  silent: Infinity,
  quiet: 600,
  normal: 240,
  chaotic: 75,
}

/** How often a personality thinks out loud: chattier ones more often. */
export function thoughtChance(level: Chattiness, personality: Personality, checkEveryS: number): number {
  const mean = THOUGHT_EVERY_S[level] * (3 / personality.chattiness)
  return Number.isFinite(mean) ? Math.min(1, checkEveryS / mean) : 0
}

export type LineContext = { name: string; tool?: string; time?: string }

export function fill(template: string, ctx: LineContext): string {
  return template
    .replaceAll('{name}', ctx.name)
    .replaceAll('{tool}', ctx.tool ?? 'that tool')
    .replaceAll('{time}', ctx.time ?? 'late')
}

/** The lines a buddy might say for an event (a poke is any of its thoughts or hellos). */
export function linesFor(archetype: Archetype, event: BuddyEvent): readonly string[] {
  const { lines } = ARCHETYPES[archetype]
  if (event === 'poke') return [...lines.hello, ...lines.thought]
  if (event === 'thought') return [...lines.thought, ...SHARED_THOUGHTS]
  return lines[event]
}

/**
 * How a buddy reacts to an event: an animation and maybe a line, avoiding
 * the lines it said recently. `random` is injectable for tests.
 */
export function react(
  event: BuddyEvent,
  personality: Personality,
  level: Chattiness,
  ctx: LineContext,
  recent: readonly string[] = [],
  random: () => number = Math.random,
): Reaction {
  const { anim, ms } = REACTION_ANIMS[event]
  // Calmer buddies react a bit longer and slower; energetic ones snappier.
  const scaled = Math.round(ms * (1.3 - personality.energy * 0.1))
  const chance = Math.min(1, SPEAK[level][event] * (event === 'prompt' || event === 'working' ? personality.chattiness / 3 : 1))
  let line: string | null = null
  if (random() < chance) {
    const all = linesFor(personality.archetype, event)
    const fresh = all.filter(l => !recent.includes(fill(l, ctx)))
    const pool = fresh.length > 0 ? fresh : all
    const pick = pool[Math.floor(random() * pool.length)]
    if (pick !== undefined) line = pick
  }
  return {
    anim: level === 'silent' && event === 'thought' ? null : anim,
    ms: scaled,
    line: line === null ? null : fill(line, ctx),
    isThought: event === 'thought',
  }
}

/** What a finished tool call means to a buddy: a failure, a win, or nothing. */
export function classifyToolResult(tool: string, isError: boolean, text: string | undefined): 'error' | 'success' | null {
  if (isError) return 'error'
  if (tool !== 'Bash' || !text) return null
  const failed = /\b[1-9]\d*\s+(failed|failing|failures?|errors?)\b/i.test(text) || /\bFAIL\b/.test(text)
  if (failed) return null
  const passed =
    /\b[1-9]\d*\s+(passed|passing|pass)\b/i.test(text) ||
    /\bTests?:\s+\d+\s+passed\b/i.test(text) ||
    /\bBUILD SUCCESS(FUL)?\b/.test(text) ||
    /\ball tests passed\b/i.test(text)
  return passed ? 'success' : null
}

/** The resting state's caption when the buddy has nothing to say. */
export const STATUS: Record<Anim, string> = {
  idle: 'is hanging out',
  typing: 'is watching Claude work',
  thinking: 'is thinking…',
  happy: 'is happy',
  celebrate: 'is celebrating!',
  sad: 'is a little sad',
  surprised: 'perked up',
  sleeping: 'is asleep',
  wave: 'says hi',
}
