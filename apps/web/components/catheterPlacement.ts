export interface PositionedTube {
  id: string;
  parentId?: string;
  connectorLength?: number;
  proximalZ?: number;
  length: number;
}

/** Preserve shaft lengths and place each child relative to its own parent. */
export function placeCatheters<T extends PositionedTube>(
  tubes: readonly T[], proximalExposure: number, fromConnectorInlet: boolean,
): T[] {
  const byId = new Map(tubes.map((tube) => [tube.id, tube]));
  const roots = new Map<string, number>();
  const root = (tube: T): number => {
    const cached = roots.get(tube.id);
    if (cached !== undefined) return cached;
    const parent = tube.parentId ? byId.get(tube.parentId) : undefined;
    const z = parent
      ? root(parent) - (fromConnectorInlet ? parent.connectorLength ?? 0 : 0) - proximalExposure
      : 0;
    roots.set(tube.id, z);
    return z;
  };
  return tubes.map((tube) => ({ ...tube, proximalZ: root(tube) }));
}
