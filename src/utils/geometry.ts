/** End points of the two arrowhead strokes at `tip`, 30° either side of the shaft. */
export const arrowHeadWings = (
  tail: { x: number; y: number },
  tip: { x: number; y: number },
  length: number,
): Array<[number, number]> => {
  const angle = Math.atan2(tip.y - tail.y, tip.x - tail.x)
  return [angle + Math.PI - Math.PI / 6, angle + Math.PI + Math.PI / 6].map(
    (a) => [tip.x + Math.cos(a) * length, tip.y + Math.sin(a) * length] as [number, number]
  )
}
