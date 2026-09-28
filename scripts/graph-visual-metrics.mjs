#!/usr/bin/env node

/**
 * Deterministic, synthetic geometry checks for SVG quadratic edge paths.
 *
 * Curves are sampled into straight segments, so this is a regression sensor,
 * not a proof of exact Bézier intersections. It intentionally ignores edge
 * pairs that share a graph endpoint: their meeting point is a relationship,
 * not visual clutter.
 */

import { pathToFileURL } from 'node:url';

const NUMBER = '-?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[-+]?\\d+)?';
const QUADRATIC_PATH = new RegExp(`^\\s*M\\s+(${NUMBER})\\s+(${NUMBER})\\s+Q\\s+(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s*$`, 'i');

export function parseQuadraticPath(path) {
  const match = QUADRATIC_PATH.exec(String(path));
  const values = match?.slice(1).map(Number);
  if (!values || values.some(value => !Number.isFinite(value))) {
    throw new TypeError(`Expected an SVG quadratic path in 'M x y Q cx cy x y' form: ${path}`);
  }
  return {
    start: [values[0], values[1]],
    control: [values[2], values[3]],
    end: [values[4], values[5]]
  };
}

export function quadraticPoint({ start, control, end }, t) {
  const inverse = 1 - t;
  return [
    inverse * inverse * start[0] + 2 * inverse * t * control[0] + t * t * end[0],
    inverse * inverse * start[1] + 2 * inverse * t * control[1] + t * t * end[1]
  ];
}

export function approximateQuadratic(path, segments = 24) {
  if (!Number.isInteger(segments) || segments < 2) throw new RangeError('segments must be an integer of at least 2');
  const curve = parseQuadraticPath(path);
  return Array.from({ length: segments + 1 }, (_, index) => quadraticPoint(curve, index / segments));
}

function cross([ax, ay], [bx, by]) { return ax * by - ay * bx; }
function subtract([ax, ay], [bx, by]) { return [ax - bx, ay - by]; }

export function segmentIntersection(firstStart, firstEnd, secondStart, secondEnd, epsilon = 1e-9) {
  const firstVector = subtract(firstEnd, firstStart);
  const secondVector = subtract(secondEnd, secondStart);
  const denominator = cross(firstVector, secondVector);
  if (Math.abs(denominator) <= epsilon) return null;
  const offset = subtract(secondStart, firstStart);
  const firstT = cross(offset, secondVector) / denominator;
  const secondT = cross(offset, firstVector) / denominator;
  // Inclusive endpoints matter: two sampled curves can cross exactly at a
  // polyline vertex. The edge-pair loop already de-duplicates that contact.
  if (firstT < -epsilon || firstT > 1 + epsilon || secondT < -epsilon || secondT > 1 + epsilon) return null;
  return { firstT, secondT };
}

function sharesEndpoint(left, right) {
  return left.source === right.source || left.source === right.target || left.target === right.source || left.target === right.target;
}

function curveIntersects(leftPath, rightPath, segments) {
  const leftPoints = approximateQuadratic(leftPath, segments);
  const rightPoints = approximateQuadratic(rightPath, segments);
  for (let left = 0; left < leftPoints.length - 1; left++) {
    for (let right = 0; right < rightPoints.length - 1; right++) {
      const intersection = segmentIntersection(leftPoints[left], leftPoints[left + 1], rightPoints[right], rightPoints[right + 1]);
      if (!intersection) continue;
      const atLeftCurveEndpoint = (left === 0 && intersection.firstT <= 1e-9)
        || (left === leftPoints.length - 2 && intersection.firstT >= 1 - 1e-9);
      const atRightCurveEndpoint = (right === 0 && intersection.secondT <= 1e-9)
        || (right === rightPoints.length - 2 && intersection.secondT >= 1 - 1e-9);
      if (!atLeftCurveEndpoint && !atRightCurveEndpoint) return true;
    }
  }
  return false;
}

/**
 * Counts edge-pair crossings in a synthetic edge fixture.
 * Edge shape: { id, source, target, path }. The returned pairs are sorted,
 * making the metric stable across input order.
 */
export function edgeCrossingMetrics(edges, { segments = 24 } = {}) {
  const ordered = [...edges].sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const crossings = [];
  for (let left = 0; left < ordered.length; left++) {
    for (let right = left + 1; right < ordered.length; right++) {
      const first = ordered[left];
      const second = ordered[right];
      if (sharesEndpoint(first, second)) continue;
      if (curveIntersects(first.path, second.path, segments)) crossings.push([String(first.id), String(second.id)]);
    }
  }
  return { edgeCount: ordered.length, segments, crossingCount: crossings.length, crossings };
}

export const SYNTHETIC_CROSSING_FIXTURE = Object.freeze([
  { id: 'alpha', source: 'fixture/a', target: 'fixture/b', path: 'M 0 0 Q 50 0 100 100' },
  { id: 'beta', source: 'fixture/c', target: 'fixture/d', path: 'M 0 100 Q 50 100 100 0' },
  { id: 'gamma', source: 'fixture/a', target: 'fixture/e', path: 'M 0 0 Q 0 50 0 100' }
]);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(edgeCrossingMetrics(SYNTHETIC_CROSSING_FIXTURE), null, 2));
}
