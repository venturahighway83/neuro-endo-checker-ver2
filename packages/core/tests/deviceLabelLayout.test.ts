import { describe, expect, it } from 'vitest';
import { placeDeviceLabels, overlaps } from '../../../apps/web/components/deviceLabelLayout';

describe('device labels avoid all model bodies', () => {
  it('places seven labels away from overlapping device bounds and one another', () => {
    const devices = [{ x: 330, y: 180, width: 400, height: 180 }, { x: 280, y: 250, width: 500, height: 140 }];
    const labels = placeDeviceLabels(Array.from({ length: 7 }, (_, i) => ({ x: 400 + i * 5, y: 270, visible: true })), devices, { x: 8, y: 100, width: 1264, height: 500 });
    expect(labels.every(Boolean)).toBe(true);
    labels.forEach((label, i) => {
      expect(devices.some((body) => overlaps(label!, body))).toBe(false);
      expect(labels.slice(0, i).some((other) => overlaps(label!, other!))).toBe(false);
      expect(label!.x).toBeGreaterThanOrEqual(8);
      expect(label!.x + label!.width).toBeLessThanOrEqual(1272);
      expect(label!.y + label!.height).toBeLessThanOrEqual(600);
    });
  });
  it('repositions when rotation moves another device into a previous label', () => {
    const area = { x: 8, y: 80, width: 1000, height: 450 };
    const anchor = [{ x: 500, y: 250, visible: true }];
    const first = placeDeviceLabels(anchor, [], area)[0]!;
    const next = placeDeviceLabels(anchor, [first], area)[0]!;
    expect(next).not.toBeNull();
    expect(overlaps(first, next)).toBe(false);
  });
  it('hides offscreen labels and avoids covering the model when fully zoomed in', () => {
    const area = { x: 8, y: 80, width: 500, height: 300 };
    expect(placeDeviceLabels([{ x: 100, y: 100, visible: false }], [], area)).toEqual([null]);
    expect(placeDeviceLabels([{ x: 100, y: 100, visible: true }], [area], area)).toEqual([null]);
  });
});
