export const INK = 0x1e1e24
export const WHITE = 0xffffff
export const BLACK = 0x000000

export function parseHex(hex: string): number {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return Number.isFinite(n) ? n & 0xffffff : 0xf07858
}

export function hexOf(rgb: number): string {
  return '#' + rgb.toString(16).padStart(6, '0').toUpperCase()
}

/** `rgb` moved `amount` (0 to 1) of the way toward `toward`. */
export function mix(rgb: number, toward: number, amount: number): number {
  const channel = (shift: number) => {
    const a = (rgb >> shift) & 0xff
    const b = (toward >> shift) & 0xff
    return Math.round(a + (b - a) * amount) << shift
  }
  return channel(16) | channel(8) | channel(0)
}

/** A buddy's body colour with the shade and highlight drawn from it. */
export function palette(hex: string) {
  const body = parseHex(hex)
  return { body, shade: mix(body, BLACK, 0.35), light: mix(body, WHITE, 0.45) }
}
