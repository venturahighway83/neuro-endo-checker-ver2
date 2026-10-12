import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DeviceMasterSchema } from '../schema/normalized';

const master = DeviceMasterSchema.parse(JSON.parse(readFileSync('master.json', 'utf8')));
const esperance = master.devices.filter(device => device.name.startsWith('Esperance '));

// Domestic PMDA label TB223-M01JA-02, p.1, table A/B/C/D/E (mm and cm).
// Keep the three tapered/uniform designs distinct and exclude overseas-only lengths.
const specifications = [
  { type: '5F', lengths: [125, 131], distalID: 1.40, distalOD: 1.57, proximalID: 1.40, proximalOD: 1.68 },
  { type: '6F', lengths: [125, 131], distalID: 1.80, distalOD: 2.06, proximalID: 1.80, proximalOD: 2.08 },
  { type: '3+', lengths: [120, 133, 145, 153, 160], distalID: 1.04, distalOD: 1.27, proximalID: 1.37, proximalOD: 1.68 },
];

describe('Esperance domestic aspiration catheter registration', () => {
  it('matches all nine labeled lengths and regional dimensions without inferring hub lengths', () => {
    expect(esperance).toHaveLength(9);
    const inch = (mm: number) => Number((mm / 25.4).toFixed(8));
    for (const spec of specifications) {
      for (const length of spec.lengths) {
        const device = esperance.find(item => item.name === `Esperance ${spec.type} (${length} cm)`);
        expect(device).toMatchObject({
          category: '中間', maker: 'Wallaby Medical', length_cm: length,
          id_inch: inch(spec.distalID), od_fr: Number((spec.proximalOD * 3).toFixed(8)),
          proximal_id_inch: inch(spec.proximalID), proximal_od_inch: inch(spec.proximalOD),
          distal_id_inch: inch(spec.distalID), distal_od_inch: inch(spec.distalOD),
          hub_length_cm: null, hub_length_source: '',
          proximal_non_effective_length_cm: null, proximal_length_source: '', proximal_length_note: '',
        });
      }
    }
  });
});
