export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  a: Point;
  b: Point;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function onSegment(a: Point, b: Point, p: Point): boolean {
  return (
    Math.min(a.x, b.x) - 1e-9 <= p.x &&
    p.x <= Math.max(a.x, b.x) + 1e-9 &&
    Math.min(a.y, b.y) - 1e-9 <= p.y &&
    p.y <= Math.max(a.y, b.y) + 1e-9
  );
}

/**
 * True segment-segment intersection test (proper crossing or touching),
 * used to detect leader lines that cross each other.
 */
export function segmentsIntersect(s1: Segment, s2: Segment): boolean {
  const d1 = cross(s2.a, s2.b, s1.a);
  const d2 = cross(s2.a, s2.b, s1.b);
  const d3 = cross(s1.a, s1.b, s2.a);
  const d4 = cross(s1.a, s1.b, s2.b);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  if (d1 === 0 && onSegment(s2.a, s2.b, s1.a)) return true;
  if (d2 === 0 && onSegment(s2.a, s2.b, s1.b)) return true;
  if (d3 === 0 && onSegment(s1.a, s1.b, s2.a)) return true;
  if (d4 === 0 && onSegment(s1.a, s1.b, s2.b)) return true;
  return false;
}

/** Segments that only touch at a shared endpoint are not a real crossing. */
export function segmentsCrossExcludingSharedEndpoints(s1: Segment, s2: Segment): boolean {
  const sharesEndpoint =
    samePoint(s1.a, s2.a) || samePoint(s1.a, s2.b) || samePoint(s1.b, s2.a) || samePoint(s1.b, s2.b);
  if (sharesEndpoint) return false;
  return segmentsIntersect(s1, s2);
}

function samePoint(a: Point, b: Point, epsilon = 1e-6): boolean {
  return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon;
}

export function rectIntersectsSegment(rect: Rect, seg: Segment): boolean {
  const { x, y, width, height } = rect;
  if (pointInRect(seg.a, rect) || pointInRect(seg.b, rect)) return true;

  const corners: Point[] = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
  for (let i = 0; i < 4; i++) {
    const edge: Segment = { a: corners[i], b: corners[(i + 1) % 4] };
    if (segmentsIntersect(seg, edge)) return true;
  }
  return false;
}

export function pointInRect(p: Point, rect: Rect): boolean {
  return p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height;
}

export function rectFullyContains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}
