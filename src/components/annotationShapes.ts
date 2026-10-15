import type { AnnotationType } from '../types/annotations'
import { arrowHeadWings } from '../utils/geometry'

/** Annotation types drawn from a start→end drag by `drawShape`. */
export const CANVAS_SHAPE_TYPES = ['underline', 'strikethrough', 'ellipse', 'arrow', 'stamp', 'redaction'] as const
export type CanvasShapeType = (typeof CANVAS_SHAPE_TYPES)[number]

export const isCanvasShape = (type: string): type is CanvasShapeType =>
  (CANVAS_SHAPE_TYPES as readonly string[]).includes(type)

/**
 * Draws a shape annotation in canvas pixels. Used for both committed
 * annotations and the live drag preview so they always look the same.
 * Expects strokeStyle/fillStyle/lineWidth/globalAlpha to be set by the caller.
 */
export function drawShape(
  ctx: CanvasRenderingContext2D,
  type: CanvasShapeType | AnnotationType,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  text?: string
) {
  const left = Math.min(x1, x2)
  const top = Math.min(y1, y2)
  const width = Math.abs(x2 - x1)
  const height = Math.abs(y2 - y1)

  switch (type) {
    case 'underline':
    case 'strikethrough': {
      const y = type === 'underline' ? top + height : top + height / 2
      ctx.beginPath()
      ctx.moveTo(left, y)
      ctx.lineTo(left + width, y)
      ctx.stroke()
      break
    }
    case 'ellipse': {
      ctx.beginPath()
      ctx.ellipse(left + width / 2, top + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
    case 'arrow': {
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      for (const [wx, wy] of arrowHeadWings({ x: x1, y: y1 }, { x: x2, y: y2 }, Math.max(10, ctx.lineWidth * 4))) {
        ctx.moveTo(x2, y2)
        ctx.lineTo(wx, wy)
      }
      ctx.stroke()
      break
    }
    case 'stamp': {
      ctx.lineWidth = Math.max(2, ctx.lineWidth)
      ctx.strokeRect(left, top, width, height)
      const label = (text || 'APPROVED').toUpperCase()
      const size = Math.min(height * 0.6, width / Math.max(1, label.length * 0.62))
      if (size >= 4) {
        ctx.font = `bold ${size}px Helvetica, Arial, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, left + width / 2, top + height / 2)
        ctx.textAlign = 'start'
        ctx.textBaseline = 'alphabetic'
      }
      break
    }
    case 'redaction': {
      // Hatched black box: clearly "will be removed", not just covered.
      ctx.globalAlpha = 0.85
      ctx.fillStyle = '#000'
      ctx.fillRect(left, top, width, height)
      ctx.globalAlpha = 1
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.strokeRect(left, top, width, height)
      ctx.setLineDash([])
      break
    }
  }
}
