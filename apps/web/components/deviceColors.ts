export type DeviceKind = 'guiding' | 'intermediate' | 'micro';
type DeviceColor = { fill: string; dark: string; lumen: string };

// Muted accents stay distinct against the dark canvas and share a common tone.
const palette: Record<DeviceKind, readonly [DeviceColor, DeviceColor]> = {
  guiding: [
    { fill: '#8BAFD4', dark: '#435F7C', lumen: '#182A3D' },
    { fill: '#8BAFD4', dark: '#435F7C', lumen: '#182A3D' },
  ],
  intermediate: [
    { fill: '#62C5B5', dark: '#326F68', lumen: '#142F2D' },
    { fill: '#4EAB9D', dark: '#295E58', lumen: '#102826' },
  ],
  micro: [
    { fill: '#B3A0DD', dark: '#665582', lumen: '#2B233C' },
    { fill: '#9985C7', dark: '#564670', lumen: '#241D34' },
  ],
};

export function deviceColor(kind: DeviceKind, variant: 1 | 2 = 1): DeviceColor {
  return palette[kind][variant - 1];
}
