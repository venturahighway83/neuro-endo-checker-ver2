'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Lines share the panel coordinate system, including when the panel area scrolls. */
export function DeviceConnections({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<{ id: string; d: string; selected: boolean }[]>([]);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const update = () => {
      const bounds = root.getBoundingClientRect();
      const nodes = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-device-node]'));
      const next = nodes.flatMap((child) => {
        const parent = nodes.find((node) => node.dataset.deviceNode === child.dataset.deviceParent);
        if (!parent) return [];
        const a = parent.getBoundingClientRect();
        const b = child.getBoundingClientRect();
        const x1 = a.right - bounds.left + 2;
        const x2 = b.left - bounds.left - 3;
        const y1 = a.top + a.height / 2 - bounds.top;
        const y2 = b.top + b.height / 2 - bounds.top;
        const mid = (x1 + x2) / 2;
        return [{ id: child.dataset.deviceNode!, d: `M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`, selected: parent.dataset.deviceSelected === 'true' && child.dataset.deviceSelected === 'true' }];
      });
      setPaths((old) => JSON.stringify(old) === JSON.stringify(next) ? old : next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    root.querySelectorAll('[data-device-node]').forEach((node) => observer.observe(node.parentElement!));
    return () => observer.disconnect();
  }, [children]);

  return (
    <div ref={ref} className="relative w-max min-w-full">
      <svg aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
        {paths.map(({ id, d, selected }) => (
          <path key={id} d={d} fill="none" stroke={selected ? '#94a3b8' : '#475569'} strokeWidth={2}
            strokeDasharray={selected ? undefined : '4 4'} strokeLinejoin="round" strokeLinecap="round" />
        ))}
      </svg>
      <div className="relative">{children}</div>
    </div>
  );
}
