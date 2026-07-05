import { test, expect } from '@playwright/test';
import {
  equalStops, moveStop, insertStop, removeStop, replaceStopHex, midpoints,
  FLOW_MIN_STOPS, FLOW_MAX_STOPS,
  axisPoint, axisPos, offAxisDistance, conicRingRadius, windowRange,
  flowGradientCSS,
} from '../flow-core.js';

test.describe('flow-core stop operations', () => {
  const abc = [
    { name: 'A', hex: '#111111', pos: 0 },
    { name: 'B', hex: '#222222', pos: 0.5 },
    { name: 'C', hex: '#333333', pos: 1 },
  ];

  test('equalStops spaces n stops from 0 to 1', () => {
    expect(equalStops(['#a', '#b', '#c'])).toEqual([
      { hex: '#a', pos: 0 }, { hex: '#b', pos: 0.5 }, { hex: '#c', pos: 1 },
    ]);
    expect(equalStops(['#a'])).toEqual([{ hex: '#a', pos: 0.5 }]);
  });

  test('moveStop clamps to 0..1 and keeps order when not crossing', () => {
    const { stops, index } = moveStop(abc, 1, 0.7);
    expect(index).toBe(1);
    expect(stops[1]).toEqual({ name: 'B', hex: '#222222', pos: 0.7 });
    expect(moveStop(abc, 0, -5).stops[0].pos).toBe(0);
    expect(moveStop(abc, 2, 9).stops[2].pos).toBe(1);
  });

  test('moveStop past a neighbor swaps order and reports the new index', () => {
    const { stops, index } = moveStop(abc, 0, 0.8); // A dragged past B
    expect(index).toBe(1);
    expect(stops.map(s => s.name)).toEqual(['B', 'A', 'C']);
    expect(stops.map(s => s.pos)).toEqual([0.5, 0.8, 1]);
  });

  test('moveStop does not mutate its input', () => {
    moveStop(abc, 1, 0.9);
    expect(abc[1].pos).toBe(0.5);
  });

  test('insertStop adds sorted, carries fields, respects FLOW_MAX_STOPS', () => {
    const next = insertStop(abc, 0.25, { name: 'D', hex: '#444444' });
    expect(next.map(s => s.name)).toEqual(['A', 'D', 'B', 'C']);
    expect(next[1].pos).toBe(0.25);
    let six = abc;
    for (const p of [0.1, 0.2, 0.3]) six = insertStop(six, p, { hex: '#e' });
    expect(six.length).toBe(FLOW_MAX_STOPS);
    expect(insertStop(six, 0.9, { hex: '#f' })).toBe(six); // cap: unchanged
  });

  test('removeStop enforces FLOW_MIN_STOPS', () => {
    expect(removeStop(abc, 1).map(s => s.name)).toEqual(['A', 'C']);
    const two = removeStop(abc, 0);
    expect(removeStop(two, 0)).toBe(two); // at 2, unchanged
    expect(FLOW_MIN_STOPS).toBe(2);
  });

  test('replaceStopHex swaps color in place', () => {
    const next = replaceStopHex(abc, 2, '#999999');
    expect(next[2]).toEqual({ name: 'C', hex: '#999999', pos: 1 });
    expect(next[0]).toEqual(abc[0]);
  });

  test('midpoints returns n-1 insert positions', () => {
    expect(midpoints(abc)).toEqual([0.25, 0.75]);
  });
});

test.describe('flow-core axis geometry', () => {
  const W = 390, H = 844;

  test('conic axis is a ring: t=0 top, t=0.25 right, wraps', () => {
    const r = conicRingRadius(W, H);
    const top = axisPoint('conic', 0, W, H);
    expect(top.x).toBeCloseTo(W * 0.5, 5);
    expect(top.y).toBeCloseTo(H * 0.42 - r, 5);
    const right = axisPoint('conic', 0.25, W, H);
    expect(right.x).toBeCloseTo(W * 0.5 + r, 5);
    expect(right.y).toBeCloseTo(H * 0.42, 5);
  });

  test('axisPos inverts axisPoint for every mode', () => {
    for (const mode of ['linear', 'stripes', 'radial', 'turrell', 'conic']) {
      for (const t of [0.01, 0.3, 0.5, 0.77, 0.99]) {
        const p = axisPoint(mode, t, W, H);
        expect(axisPos(mode, p.x, p.y, W, H)).toBeCloseTo(t, 3);
      }
    }
  });

  test('axisPos clamps to 0..1 on line modes', () => {
    expect(axisPos('linear', W / 2, -500, W, H)).toBe(0);
    expect(axisPos('linear', W / 2, 5000, W, H)).toBe(1);
  });

  test('offAxisDistance is 0 on the axis and grows off it', () => {
    const onRing = axisPoint('conic', 0.6, W, H);
    expect(offAxisDistance('conic', onRing.x, onRing.y, W, H)).toBeCloseTo(0, 5);
    expect(offAxisDistance('conic', W * 0.5, H * 0.42, W, H)).toBeCloseTo(conicRingRadius(W, H), 5);
    expect(offAxisDistance('linear', W / 2 + 80, 400, W, H)).toBe(80);
  });

  test('windowRange keeps a span around idx within bounds', () => {
    expect(windowRange(0, 100)).toEqual({ start: 0, end: 7 });
    expect(windowRange(50, 100)).toEqual({ start: 43, end: 57 });
    expect(windowRange(99, 100)).toEqual({ start: 92, end: 99 });
    expect(windowRange(2, 4, 7)).toEqual({ start: 0, end: 3 });
  });

  test('axisPos never returns NaN on degenerate viewports', () => {
    for (const h of [0, 70, 240]) {
      for (const mode of ['linear', 'radial']) {
        const t = axisPos(mode, 100, 50, 200, h);
        expect(Number.isNaN(t)).toBe(false);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(1);
      }
    }
  });

  test('equalStops returns [] for empty input', () => {
    expect(equalStops([])).toEqual([]);
  });
});

test.describe('flowGradientCSS', () => {
  const stops = [
    { hex: '#2850A8', pos: 0 },
    { hex: '#90B8D0', pos: 0.34 },
    { hex: '#705848', pos: 1 },
  ];

  test('linear uses positioned stops top→bottom', () => {
    expect(flowGradientCSS('linear', stops, '#E2DDD6').background)
      .toBe('linear-gradient(to bottom,#2850A8 0.0%,#90B8D0 34.0%,#705848 100.0%)');
  });

  test('radial centers at 50% 42%', () => {
    expect(flowGradientCSS('radial', stops, '#E2DDD6').background)
      .toBe('radial-gradient(circle at 50% 42%,#2850A8 0.0%,#90B8D0 34.0%,#705848 100.0%)');
  });

  test('conic wraps back to the first color at 100%', () => {
    expect(flowGradientCSS('conic', stops, '#E2DDD6').background)
      .toBe('conic-gradient(from 0deg at 50% 42%,#2850A8 0.0%,#90B8D0 34.0%,#705848 100.0%,#2850A8 100%)');
  });

  test('stripes mirrors positioned stops around 50%', () => {
    const css = flowGradientCSS('stripes', stops, '#E2DDD6').background;
    expect(css).toContain('#90B8D0 17.0%');  // fwd: pos*50
    expect(css).toContain('#90B8D0 83.0%');  // rev: 50+(1-pos)*50
  });

  test('turrell emits concentric-rect SVG data URI with pos-scaled margins', () => {
    const r = flowGradientCSS('turrell', stops, '#E2DDD6');
    expect(r.background).toBe('#2850A8');
    expect(r.backgroundSize).toBe('cover');
    expect(decodeURIComponent(r.backgroundImage)).toContain("x='15.30%'"); // 0.34*45
  });

  test('degenerate inputs fall back safely', () => {
    expect(flowGradientCSS('linear', [], '#E2DDD6').background).toBe('#E2DDD6');
    expect(flowGradientCSS('linear', [{ hex: '#111', pos: 0.5 }], '#E2DDD6').background).toBe('#111');
  });
});
