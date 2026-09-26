export type DeviceKind = 'guiding' | 'intermediate' | 'micro';
type DeviceColor = { fill: string; dark: string; lumen: string };

// Muted accents stay distinct against the dark canvas and share a common tone.
const palette: Record<DeviceKind, readonly [DeviceColor, DeviceColor]> = {
  guiding: [
    { fill: '#D99688', dark: '#8B514A', lumen: '#402420' },
    { fill: '#D99688', dark: '#8B514A', lumen: '#402420' },
  ],
  intermediate: [
    { fill: '#62C5B5', dark: '#326F68', lumen: '#142F2D' },
    { fill: '#4EAB9D', dark: '#295E58', lumen: '#102826' },
  ],
  micro: [
    { fill: '#509CF0', dark: '#285C99', lumen: '#112B4B' },
    { fill: '#3782D4', dark: '#214C82', lumen: '#10243F' },
  ],
};

export function deviceColor(kind: DeviceKind, variant: 1 | 2 = 1): DeviceColor {
  return palette[kind][variant - 1];
}
