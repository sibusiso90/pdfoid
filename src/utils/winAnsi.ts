/**
 * pdf-lib's standard fonts (Helvetica, Times, …) only encode WinAnsi (CP1252).
 * Drawing any other character throws, so all user-supplied text drawn with a
 * standard font must pass through `toWinAnsi` first.
 */

// CP1252 0x80–0x9F range (printable entries only).
const WIN_ANSI_EXTRAS = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'

const SUBSTITUTIONS: Record<string, string> = {
  '▸': '›',
  '▶': '›',
  '►': '›',
  '→': '->',
  '←': '<-',
  '⇒': '=>',
  '✓': 'v',
  '✔': 'v',
  '✗': 'x',
  '✘': 'x',
  '−': '-',
  '‐': '-',
  '‑': '-',
  '‒': '-',
  '′': "'",
  '″': '"',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
}

const isWinAnsi = (ch: string): boolean => {
  const cp = ch.codePointAt(0)!
  if (cp === 0x09 || cp === 0x0a || cp === 0x0d) return true
  if (cp >= 0x20 && cp <= 0x7e) return true
  if (cp >= 0xa0 && cp <= 0xff) return true
  return WIN_ANSI_EXTRAS.includes(ch)
}

export function toWinAnsi(text: string): string {
  let out = ''
  for (const ch of text) {
    // Variation selectors and zero-width joiners only modify the previous glyph.
    if (/[︀-️​-‍⁠]/.test(ch)) continue
    if (isWinAnsi(ch)) out += ch
    else out += SUBSTITUTIONS[ch] ?? '?'
  }
  return out
}
