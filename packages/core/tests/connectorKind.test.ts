import { describe, expect, it } from 'vitest';
import { connectorKind } from '../../../apps/web/components/connectorKind';

describe('connector selection for direct catheter children', () => {
  for (const category of ['ガイディング', '中間']) {
    it(`${category}: two selected catheters use a tri connector, removing either restores Y`, () => {
      const device = { id: 'selected' };
      expect(connectorKind(category, [null, null])).toBe('y');
      expect(connectorKind(category, [device, null])).toBe('y');
      expect(connectorKind(category, [device, device])).toBe('tri');
      expect(connectorKind(category, [null, device])).toBe('y');
    });
  }
  it('attaches a Y connector to microcatheters', () => {
    expect(connectorKind('マイクロ', [])).toBe('y');
  });
  it('does not attach connectors to absent devices', () => {
    expect(connectorKind(undefined, [{}, {}])).toBeUndefined();
  });
});
