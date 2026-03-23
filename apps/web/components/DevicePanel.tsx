'use client';

import { useState, useRef, useEffect } from 'react';
import type { Device } from '@neuro-endo/core';

interface Props {
  title: string;
  devices: Device[];
  selected: Device | null;
  onSelect: (device: Device | null) => void;
}

export function DevicePanel({ title, devices, selected, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

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
  }

  return (
    <div ref={ref} className="relative">
      {/* Label */}
      <div className="text-sm font-semibold text-gray-300 mb-1">{title}</div>

      {/* Trigger */}
      <button
        type="button"
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
      {selected && !open && (
        <div className="mt-0.5 text-xs text-gray-500 font-mono leading-tight">
          ID&nbsp;{selected.id_inch}"&nbsp;({(selected.id_inch * 76.2).toFixed(1)}Fr) · OD&nbsp;{selected.od_fr}Fr · {selected.length_cm}cm
        </div>
      )}

      {/* Dropdown list */}
      {open && (
        <div
          className="absolute z-50 top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded shadow-xl"
          style={{ minWidth: '280px' }}
        >
          {/* Search box */}
          <div className="p-2 border-b border-gray-700">
            <input
              autoFocus
              type="text"
              placeholder="名称・メーカーで検索…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Options */}
          <div className="max-h-60 overflow-y-auto">
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
        </div>
      )}
    </div>
  );
}
