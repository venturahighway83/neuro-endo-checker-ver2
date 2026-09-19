export interface LabelRect { x: number; y: number; width: number; height: number }
export interface LabelAnchor { x: number; y: number; visible: boolean }

export function overlaps(a: LabelRect, b: LabelRect, gap = 6) {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x
    && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

/** Find space outside every projected device and previously placed label. */
export function placeDeviceLabels(anchors: LabelAnchor[], devices: LabelRect[], area: LabelRect): (LabelRect | null)[] {
  const occupied = [...devices];
  return anchors.map((anchor) => {
    if (!anchor.visible || area.height < 28 || area.width < 80) return null;
    for (const width of [...new Set([Math.min(300, area.width * 0.42), Math.min(180, area.width * 0.42), Math.min(120, area.width)])]) {
      const clampX = (x: number) => Math.max(area.x, Math.min(area.x + area.width - width, x));
      const clampY = (y: number) => Math.max(area.y, Math.min(area.y + area.height - 28, y));
      const xs = [clampX(anchor.x - width - 24), clampX(anchor.x + 24), area.x, area.x + area.width - width];
      const ys = [clampY(anchor.y - 14), area.y, area.y + area.height - 28];
      for (const rect of occupied) {
        xs.push(clampX(rect.x - width - 8), clampX(rect.x + rect.width + 8));
        ys.push(clampY(rect.y - 36), clampY(rect.y + rect.height + 8));
      }
      for (let y = area.y; y + 28 <= area.y + area.height; y += 36) ys.push(y);
      let best: LabelRect | null = null;
      let bestScore = Infinity;
      for (const x of new Set(xs)) for (const y of new Set(ys)) {
        const candidate = { x, y, width, height: 28 };
        if (occupied.some((rect) => overlaps(candidate, rect))) continue;
        const nearestX = Math.max(x, Math.min(x + width, anchor.x));
        const nearestY = Math.max(y, Math.min(y + 28, anchor.y));
        const score = (anchor.x - nearestX) ** 2 + (anchor.y - nearestY) ** 2;
        if (score < bestScore) { best = candidate; bestScore = score; }
      }
      if (best) { occupied.push(best); return best; }
    }
    // Extreme zoom can leave no free space; never obscure a device with a label.
    return null;
  });
}
