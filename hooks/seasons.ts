export type Season = 'halloween' | 'winter'

/** The season on a day, in local time: Halloween from 15 October to 2 November, winter from 1 December to 6 January. */
export function seasonOf(now: number): Season | null {
  const d = new Date(now)
  const month = d.getMonth() + 1
  const day = d.getDate()
  if ((month === 10 && day >= 15) || (month === 11 && day <= 2)) return 'halloween'
  if (month === 12 || (month === 1 && day <= 6)) return 'winter'
  return null
}

/** How many years old a buddy born on `born` (YYYY-MM-DD) turns today, or 0 when today is not its birthday. */
export function birthdayAge(born: string, now: number): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(born)
  if (!m) return 0
  const d = new Date(now)
  const age = d.getFullYear() - Number(m[1])
  return age > 0 && d.getMonth() + 1 === Number(m[2]) && d.getDate() === Number(m[3]) ? age : 0
}

/** A day as YYYY-MM-DD in local time. */
export function dayOf(now: number): string {
  const d = new Date(now)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
