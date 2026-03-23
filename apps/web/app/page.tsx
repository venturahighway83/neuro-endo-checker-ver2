import { master } from '@neuro-endo/device-master';
import { CheckerApp } from '@/components/CheckerApp';

export default function HomePage() {
  const guiding = master.devices.filter((d) => d.category === 'ガイディング');
  const intermediate = master.devices.filter((d) => d.category === '中間');
  const micro = master.devices.filter((d) => d.category === 'マイクロ');

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-gray-900 border-b border-gray-700 px-6 py-3 flex items-baseline gap-3 shrink-0">
        <h1 className="text-xl font-bold text-white">Neuro-Endo Checker</h1>
        <span className="text-base text-gray-400">脳血管内治療デバイス互換性確認ツール</span>
      </header>
      <main className="flex-1 overflow-hidden">
        <CheckerApp
          guidingDevices={guiding}
          intermediateDevices={intermediate}
          microDevices={micro}
        />
      </main>
    </div>
  );
}
