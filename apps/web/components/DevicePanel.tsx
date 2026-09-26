'use client';

import { useState, useRef, useEffect, useLayoutEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import type { Device } from '@neuro-endo/core';
import { inchToMm, mmToFr } from '@neuro-endo/core';

interface Props {
  title: string;
  devices: Device[];
  selected: Device | null;
  onSelect: (device: Device | null) => void;
  nodeId?: string;
  parentId?: string;
}

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  opensUpwards: boolean;
}

function formatDiameter(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value.toPrecision(3)
    : '—';
}

function formatOuterDiameter(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? `${formatDiameter(value)} (${mmToFr(inchToMm(value)).toFixed(2)} Fr)`
    : '—';
}

export function DevicePanel({ title, devices, selected, onSelect, nodeId, parentId }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownId = useId();
  const hubLength = selected?.hub_length_cm ?? selected?.proximal_non_effective_length_cm;
  // Prefer the sourced total-minus-effective span when reconstructing total length.
  const proximalLength = selected?.proximal_non_effective_length_cm ?? hubLength;
  const totalLength = selected && proximalLength != null
    ? Number((selected.length_cm + proximalLength).toFixed(3))
    : null;

  useLayoutEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const gap = 4;
      const edge = 8;
      const below = Math.max(0, viewportTop + viewportHeight - rect.bottom - gap - edge);
      const above = Math.max(0, rect.top - viewportTop - gap - edge);
      const opensUpwards = below < 200 && above > below;
      const width = Math.min(Math.max(rect.width, 280), Math.max(0, viewportWidth - edge * 2));
      const next = {
        top: opensUpwards ? rect.top - gap : rect.bottom + gap,
        left: Math.max(viewportLeft + edge, Math.min(rect.left, viewportLeft + viewportWidth - width - edge)),
        width,
        maxHeight: Math.min(480, opensUpwards ? above : below),
        opensUpwards,
      };
      setPosition((previous) => previous
        && previous.top === next.top && previous.left === next.left
        && previous.width === next.width && previous.maxHeight === next.maxHeight
        && previous.opensUpwards === next.opensUpwards ? previous : next);
    }

    updatePosition();
    // Capture scroll events from the horizontal device panel and the page, too.
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('scroll', updatePosition);
    const observer = new ResizeObserver(updatePosition);
    if (ref.current) observer.observe(ref.current);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('scroll', updatePosition);
      observer.disconnect();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node) && !dropdownRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
        triggerRef.current?.focus({ preventScroll: true });
      }
    }
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const filtered = query.trim()
    ? devices.filter(
        (d) =>
          d.name.toLowerCase().includes(query.toLowerCase()) ||
          d.maker.toLowerCase().includes(query.toLowerCase())
      )
    : devices;

  function handleSelect(device: Device | null) {
    onSelect(device);
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus({ preventScroll: true });
  }

  return (
    <div ref={ref} className="relative">
      {/* Label */}
      <div className="text-sm font-semibold text-gray-300 mb-1">{title}</div>

      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? dropdownId : undefined}
        aria-haspopup="dialog"
        data-device-node={nodeId}
        data-device-parent={parentId}
        data-device-selected={!!selected}
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-1 px-2 py-1.5 text-left rounded border text-sm transition-colors ${
          open
            ? 'border-blue-500 ring-1 ring-blue-800 bg-gray-700'
            : selected
              ? 'border-blue-600 bg-blue-950 hover:border-blue-500'
              : 'border-gray-600 bg-gray-700 hover:border-gray-500'
        }`}
      >
        <span className={`flex-1 truncate ${selected ? 'text-gray-100 font-medium' : 'text-gray-500'}`}>
          {selected ? selected.name : `選択 (${devices.length}件)`}
        </span>
        <span className="text-gray-500 shrink-0 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {/* Selected specs */}
      {selected && (
        <div className="mt-1 text-xs text-gray-400 leading-4">
          <table className="w-full table-fixed border-collapse border border-gray-600 text-left [&_th]:border [&_th]:border-gray-600 [&_th]:px-1.5 [&_th]:py-0.5 [&_td]:border [&_td]:border-gray-600 [&_td]:px-1.5 [&_td]:py-0.5" aria-label={`${selected.name}の径（inch、外径はFr併記）`}>
            <thead>
              <tr className="bg-gray-700/50 text-gray-300">
                <th className="w-12 font-normal" scope="col">部位</th>
                <th className="w-20 font-normal" scope="col">内径 (inch)</th>
                <th className="font-normal" scope="col">外径 (inch)</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              <tr>
                <th className="font-normal" scope="row">近位</th>
                <td>{formatDiameter(selected.proximal_id_inch)}</td>
                <td className="whitespace-nowrap">{formatOuterDiameter(selected.proximal_od_inch)}</td>
              </tr>
              <tr>
                <th className="font-normal" scope="row">遠位</th>
                <td>{formatDiameter(selected.distal_id_inch)}</td>
                <td className="whitespace-nowrap">{formatOuterDiameter(selected.distal_od_inch)}</td>
              </tr>
            </tbody>
          </table>
          <div className="flex flex-wrap justify-between gap-x-2">
            <span>全長 {totalLength != null ? `${totalLength} cm` : '—'}</span>
            <span className="text-gray-500">—：未登録</span>
          </div>
          <div>有効長 {selected.length_cm} cm</div>
          <div>ハブ長 {hubLength != null ? `${hubLength} cm` : '—'}</div>
        </div>
      )}

      {/* Dropdown list */}
      {open && position && createPortal(
        <div
          ref={dropdownRef}
          id={dropdownId}
          role="dialog"
          aria-label={`${title}を選択`}
          className="fixed z-[100] flex flex-col overflow-hidden bg-gray-800 border border-gray-600 rounded shadow-xl"
          style={{
            top: position.top,
            left: position.left,
            width: position.width,
            maxHeight: position.maxHeight,
            transform: position.opensUpwards ? 'translateY(-100%)' : undefined,
          }}
        >
          {/* Search box */}
          <div className="shrink-0 p-2 border-b border-gray-700">
            <input
              autoFocus
              type="text"
              aria-label="名称・メーカーで検索"
              placeholder="名称・メーカーで検索…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Options */}
          <div className="min-h-0 overflow-y-auto overscroll-contain">
            {selected && (
              <button
                onClick={() => handleSelect(null)}
                className="w-full text-left px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-700 border-b border-gray-700"
              >
                ── 選択解除
              </button>
            )}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">該当なし</div>
            )}
            {filtered.map((device) => {
              const isSel = selected?.id === device.id;
              return (
                <button
                  key={device.id}
                  onClick={() => handleSelect(device)}
                  className={`w-full text-left px-3 py-2 border-b border-gray-700 hover:bg-gray-700 transition-colors ${
                    isSel ? 'bg-blue-950' : ''
                  }`}
                >
                  <div className={`text-sm font-medium leading-snug ${isSel ? 'text-blue-300' : 'text-gray-100'}`}>
                    {device.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {device.maker}
                  </div>
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
