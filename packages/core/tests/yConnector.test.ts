import { describe, expect, it } from 'vitest';
import { createYConnector, Y_CONNECTOR_LENGTH_CM } from '../../../apps/web/components/yConnector';

describe('Y connector length scale', () => {
  for (const catheterCm of [90, 120, 160]) {
    it(`shows a 5 cm connector relative to a ${catheterCm} cm catheter regardless of diameter`, () => {
      const scale = 22 / catheterCm;
      for (const radius of [1, 3, 6]) {
        const connector = createYConnector(radius, radius * 0.8, Y_CONNECTOR_LENGTH_CM * scale);
        connector.updateMatrixWorld(true);
        let minZ = Infinity, maxZ = -Infinity;
        connector.traverse((node) => {
          const mesh = node as unknown as { geometry?: { attributes: { position: {
            count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number;
          } } } };
          const vertices = mesh.geometry?.attributes.position;
          if (!vertices) return;
          for (let i = 0; i < vertices.count; i++) {
            const point = node.position.clone().set(vertices.getX(i), vertices.getY(i), vertices.getZ(i)).applyMatrix4(node.matrixWorld);
            minZ = Math.min(minZ, point.z);
            maxZ = Math.max(maxZ, point.z);
          }
        });
        expect(maxZ).toBeCloseTo(0, 5);
        expect(minZ).toBeCloseTo(-5 * scale, 5);
        expect((maxZ - minZ) / (catheterCm * scale)).toBeCloseTo(5 / catheterCm, 6);
      }
    });
  }
});
