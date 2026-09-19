export type ConnectorKind = 'y' | 'tri';

/** Only direct, selected children count; empty dropdowns do not. */
export function connectorKind(category: string | undefined, children: readonly unknown[]): ConnectorKind | undefined {
  if (category === 'マイクロ') return 'y';
  if (category !== 'ガイディング' && category !== '中間') return undefined;
  return children.filter(Boolean).length >= 2 ? 'tri' : 'y';
}
