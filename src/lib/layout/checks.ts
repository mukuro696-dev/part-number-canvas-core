import type { DiagramLayout, PlacedItemLayout } from "./computeLayout";
import { rectIntersectsSegment, segmentsCrossExcludingSharedEndpoints, type Point, type Rect, type Segment } from "./geometry";

export interface LayoutIssue {
  code: "out-of-bounds" | "leader-crossing" | "leader-pierces-label";
  itemIds: string[];
  message: string;
}

function leaderSegments(leader: PlacedItemLayout["leader"]): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < leader.points.length - 1; i++) {
    segments.push({ a: leader.points[i], b: leader.points[i + 1] });
  }
  return segments;
}

function leaderPoints(leader: PlacedItemLayout["leader"]): Point[] {
  return leader.points;
}

/**
 * Mirrors the Phase 1 "保存を止めるエラー" rules that are layout-shaped:
 * text/lines exceeding the canvas, leader lines crossing each other, and
 * a leader line piercing another item's label text.
 */
export function checkLayoutIssues(layout: DiagramLayout): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  const canvas: Rect = { x: 0, y: 0, width: layout.svgWidth, height: layout.height };

  const lastCharRight = layout.graphemes.length > 0 ? layout.charX(layout.graphemes.length) : 0;
  if (lastCharRight > layout.svgWidth) {
    issues.push({
      code: "out-of-bounds",
      itemIds: [],
      message: `part number text (right edge ${Math.round(lastCharRight)}px) exceeds the canvas width (${layout.svgWidth}px)`,
    });
  }

  for (const p of layout.placed) {
    const { bbox } = p.label;
    const withinX = bbox.x >= 0 && bbox.x + bbox.width <= canvas.width;
    const withinY = bbox.y >= 0 && bbox.y + bbox.height <= canvas.height;
    if (!withinX || !withinY) {
      issues.push({
        code: "out-of-bounds",
        itemIds: [p.item.id],
        message: `label for item "${p.item.heading || p.item.id}" exceeds the drawing area`,
      });
    }
    for (const pt of leaderPoints(p.leader)) {
      if (pt.x < 0 || pt.x > canvas.width || pt.y < 0 || pt.y > canvas.height) {
        issues.push({
          code: "out-of-bounds",
          itemIds: [p.item.id],
          message: `leader line for item "${p.item.heading || p.item.id}" exceeds the drawing area`,
        });
        break;
      }
    }
  }

  const withItemId = layout.placed.map((p) => ({ itemId: p.item.id, segments: leaderSegments(p.leader) }));
  for (let i = 0; i < withItemId.length; i++) {
    for (let j = i + 1; j < withItemId.length; j++) {
      for (const segA of withItemId[i].segments) {
        for (const segB of withItemId[j].segments) {
          if (segmentsCrossExcludingSharedEndpoints(segA, segB)) {
            issues.push({
              code: "leader-crossing",
              itemIds: [withItemId[i].itemId, withItemId[j].itemId],
              message: `leader lines for "${withItemId[i].itemId}" and "${withItemId[j].itemId}" cross`,
            });
          }
        }
      }
    }
  }

  for (const p of layout.placed) {
    for (const other of layout.placed) {
      if (other.item.id === p.item.id) continue;
      for (const seg of leaderSegments(p.leader)) {
        if (rectIntersectsSegment(other.label.bbox, seg)) {
          issues.push({
            code: "leader-pierces-label",
            itemIds: [p.item.id, other.item.id],
            message: `leader line for "${p.item.id}" passes through the label text of "${other.item.id}"`,
          });
          break;
        }
      }
    }
  }

  return issues;
}
