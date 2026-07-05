import { test, expect } from '@playwright/test';
import {
  equalStops, moveStop, insertStop, removeStop, replaceStopHex, midpoints,
  FLOW_MIN_STOPS, FLOW_MAX_STOPS,
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
