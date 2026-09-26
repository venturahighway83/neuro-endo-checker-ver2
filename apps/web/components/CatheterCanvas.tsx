'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { type TubeRadii } from './tubeGeometry';
import { routeCatheters, routedSurface, tipExtensionLabel, tipExtensionNeedsCaution } from './catheterRouting';
import { createYConnector } from './yConnector';
import type { ConnectorKind } from './connectorKind';
import { createCatheterHub, hubDisplayLabel, type HubDisplay } from './catheterHub';

export interface TubeSpec extends TubeRadii {
  id:     string;
  label:  string;
  length: number;
  y:      number;
  proximalZ?: number;
  parentId?: string;
  connector?: ConnectorKind;
  connectorLength?: number;
  hubLength?: number;
  hub?: HubDisplay;
  c: { fill: string; dark: string; lumen: string };
}

interface Props {
  overlayTop?: number;
  tubes:    TubeSpec[];
  totalLen: number;
  maxR3:    number;
  camPos:   [number, number, number];
  proximalExposure: number;
  lengthScale: number;
}

// ── Inline orbit controls ─────────────────────────────────────────────────────
function attachOrbit(
  canvas: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  minDist: number,
  maxDist: number,
) {
  const offset = new THREE.Vector3().subVectors(camera.position, target);
  const sph = new THREE.Spherical().setFromVector3(offset);

  function apply() {
    offset.setFromSpherical(sph);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
  }

  let dragging = false;
  let px = 0, py = 0;

  const onDown  = (e: MouseEvent) => { dragging = true; px = e.clientX; py = e.clientY; };
  const onMove  = (e: MouseEvent) => {
    if (!dragging) return;
    sph.theta -= (e.clientX - px) * 0.008;
    sph.phi    = Math.max(0.05, Math.min(Math.PI - 0.05, sph.phi - (e.clientY - py) * 0.008));
    px = e.clientX; py = e.clientY;
    apply();
  };
  const onUp    = () => { dragging = false; };
  const onWheel = (e: WheelEvent) => {
    sph.radius = Math.max(minDist, Math.min(maxDist, sph.radius * (1 + e.deltaY * 0.001)));
    apply();
    e.preventDefault();
  };

  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup',   onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    canvas.removeEventListener('mousedown', onDown);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup',   onUp);
    canvas.removeEventListener('wheel', onWheel);
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export function CatheterCanvas({ tubes, totalLen, maxR3, camPos, proximalExposure, lengthScale, overlayTop = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const tipPanelRef = useRef<HTMLDivElement>(null);
  const [error, setError]       = useState<string | null>(null);
  const [ready, setReady]       = useState(false);
  const [showConnectors, setShowConnectors] = useState(true);
  const footerHeight = 84;
  const routes = useMemo(() => routeCatheters(tubes, proximalExposure), [tubes, proximalExposure]);
  // The panel uses full insertion; the model retains its visible proximal shaft.
  const maximumRoutes = useMemo(() => routeCatheters(tubes, 0), [tubes]);
  const tipRows = tubes.flatMap((tube) => {
    const parent = tubes.find((item) => item.id === tube.parentId);
    const route = maximumRoutes.get(tube.id)!;
    if (!parent || route.tipExtension == null) return [];
    return [{ tube, parent, label: tipExtensionLabel(route.tipExtension / lengthScale), port: route.port,
      needsCaution: tipExtensionNeedsCaution(route.tipExtension / lengthScale),
      assumed: parent.hub?.basis === 'fallback',
      connectorCm: Number(((parent.connectorLength ?? 0) / lengthScale).toFixed(1)),
      hubCm: Number(((parent.hubLength ?? 0) / lengthScale).toFixed(1)),
    }];
  });

  const sceneKey = JSON.stringify({ tubes, camPos, totalLen, maxR3, showConnectors, proximalExposure, overlayTop });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setError(null);
    setReady(false);

    let raf = 0;
    let detachOrbit: (() => void) | undefined;
    let renderer: THREE.WebGLRenderer | undefined;

    try {
      // Renderer — opaque gray-900 background
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setClearColor(0x111827, 1);   // Tailwind gray-900
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      // getBoundingClientRect gives the actual rendered size (reliable even when height:100% resolves to 0)
      const parent = canvas.parentElement ?? canvas;
      const rect   = parent.getBoundingClientRect();
      const w0 = Math.round(rect.width)  || 800;
      const h0 = Math.round(rect.height) || 400;
      renderer.setSize(w0, h0, false);

      // Scene & camera
      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, w0 / (h0 || 1), 0.01, 10000);
      camera.position.set(...camPos);

      // Studio lighting: soft ambient fill, a bright key, and a cool edge light.
      scene.add(new THREE.HemisphereLight(0xeaf3ff, 0x35445a, 1.1));
      const lightTarget = new THREE.Object3D();
      lightTarget.position.set(0, 0, totalLen * 0.45);
      scene.add(lightTarget);
      const keyLight = new THREE.DirectionalLight(0xfff5e9, 2.8);
      keyLight.position.set(totalLen * 0.5, totalLen * 0.8, totalLen * 0.65);
      keyLight.target = lightTarget;
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0xdceaff, 0.8);
      fillLight.position.set(-totalLen * 0.6, totalLen * 0.2, totalLen * 0.2);
      fillLight.target = lightTarget;
      scene.add(fillLight);
      const rimLight = new THREE.DirectionalLight(0xc7e2ff, 1.8);
      rimLight.position.set(totalLen * 0.1, -totalLen * 0.6, totalLen * 0.55);
      rimLight.target = lightTarget;
      scene.add(rimLight);

      // Tube meshes
      for (const { id, proximalOuterR, distalOuterR, proximalInnerR, distalInnerR, c, connector, connectorLength = 0, hubLength = 0 } of tubes) {
        const group = new THREE.Group();
        const { path, rootRotation } = routes.get(id)!;

        const outerG = routedSurface(path, proximalOuterR, distalOuterR);
        const outerM = new THREE.Mesh(outerG,
          new THREE.MeshPhysicalMaterial({
            color: c.fill, roughness: 0.24, metalness: 0.08,
            clearcoat: 0.65, clearcoatRoughness: 0.18,
          }));
        group.add(outerM);

        const innerG = routedSurface(path, proximalInnerR, distalInnerR);
        const innerM = new THREE.Mesh(innerG,
          new THREE.MeshStandardMaterial({ color: c.lumen, roughness: 0.65, side: THREE.BackSide }));
        group.add(innerM);

        const capMat = new THREE.MeshStandardMaterial({ color: c.dark, roughness: 0.45, side: THREE.DoubleSide });
        const lCap   = new THREE.Mesh(new THREE.RingGeometry(proximalInnerR, proximalOuterR, 48), capMat);
        lCap.position.copy(path.getPointAt(0));
        lCap.quaternion.copy(rootRotation);
        group.add(lCap);
        const rCap   = new THREE.Mesh(new THREE.RingGeometry(distalInnerR, distalOuterR, 48), capMat);
        rCap.position.copy(path.getPointAt(1));
        rCap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), path.getTangentAt(1));
        group.add(rCap);
        if (hubLength > 0) {
          const hub = createCatheterHub(proximalOuterR, proximalInnerR, hubLength, c.fill);
          hub.position.copy(path.getPointAt(0));
          hub.quaternion.copy(rootRotation);
          group.add(hub);
        }
        if (showConnectors && connector) {
          const mesh = createYConnector(proximalOuterR, proximalInnerR, connectorLength, connector);
          mesh.position.set(0, 0, -hubLength).applyQuaternion(rootRotation).add(path.getPointAt(0));
          mesh.quaternion.copy(rootRotation);
          group.add(mesh);
        }

        scene.add(group);
      }

      // Camera look-at + orbit
      const bounds = new THREE.Box3().setFromObject(scene);
      const sphere = bounds.getBoundingSphere(new THREE.Sphere());
      const target = sphere.center;
      const viewDirection = new THREE.Vector3(...camPos).sub(new THREE.Vector3(0, 0, totalLen * 0.45)).normalize();
      const framingPoints: THREE.Vector3[] = [];
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.computeBoundingBox();
        const box = object.geometry.boundingBox!;
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
          framingPoints.push(new THREE.Vector3(x, y, z).applyMatrix4(object.matrixWorld));
        }
      });
      const fitCamera = (width: number, height: number) => {
        // Fit each part in perspective and centre its visible extent. A sphere
        // wastes space around long shafts, especially when viewed from the hub.
        camera.lookAt(target);
        const rotation = camera.quaternion.clone().invert();
        const points = framingPoints.map((point) => point.clone().sub(target).applyQuaternion(rotation));
        const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const tipPanel = tipPanelRef.current;
        const legend = legendRef.current;
        const top = Math.min(Math.max(overlayTop + 44,
          tipPanel ? tipPanel.offsetTop + tipPanel.offsetHeight + 12 : 0,
          legend ? legend.offsetTop + legend.offsetHeight + 12 : 0), height * 0.4);
        const bottom = Math.min(footerHeight, height * 0.35);
        const availableWidth = Math.max(width - 48, width * 0.5);
        const availableHeight = height - top - bottom;
        const projectedBounds = (distance: number) => {
          const box = new THREE.Box2();
          for (const point of points) {
            const scale = height / (2 * tanHalfFov * (distance - point.z));
            box.expandByPoint(new THREE.Vector2(point.x * scale, -point.y * scale));
          }
          return box;
        };
        const fits = (distance: number) => {
          const size = projectedBounds(distance).getSize(new THREE.Vector2());
          return size.x <= availableWidth && size.y <= availableHeight;
        };
        let near = Math.max(maxR3 * 2, ...points.map((point) => point.z + camera.near * 2));
        let far = Math.max(near * 2, sphere.radius * 4);
        while (!fits(far)) far *= 2;
        for (let i = 0; i < 24; i++) {
          const middle = (near + far) / 2;
          if (fits(middle)) far = middle;
          else near = middle;
        }
        const distance = far * 1.03;
        const direction = camera.position.clone().sub(target).normalize();
        camera.position.copy(target).addScaledVector(direction, distance);
        const centre = projectedBounds(distance).getCenter(new THREE.Vector2());
        camera.setViewOffset(width, height, centre.x, centre.y + (bottom - top) / 2, width, height);
        camera.lookAt(target);
      };
      camera.position.copy(target).add(viewDirection);
      fitCamera(w0, h0);
      detachOrbit = attachOrbit(canvas, camera, target, maxR3 * 2, Math.max(totalLen * 5, sphere.radius * 12));

      // Render loop
      const tick = () => { raf = requestAnimationFrame(tick); renderer!.render(scene, camera); };
      tick();

      // Resize observer — use contentRect for accurate dimensions
      const ro = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        if (!width || !height) return;
        renderer!.setSize(Math.round(width), Math.round(height), false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        fitCamera(width, height);
        detachOrbit?.();
        detachOrbit = attachOrbit(canvas, camera, target, maxR3 * 2, Math.max(totalLen * 5, sphere.radius * 12));
      });
      ro.observe(parent);

      setReady(true);

      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        detachOrbit?.();
        scene.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
          }
        });
        renderer!.dispose();
      };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  }, [sceneKey]); // eslint-disable-line

  return (
    <div style={{ position: 'absolute', inset: 0, minHeight: 200, pointerEvents: 'none' }}>
      <canvas
        ref={canvasRef}
        aria-label="カテーテル・ハブ・コネクターの3D模式図"
        style={{ display: 'block', width: '100%', height: '100%', minHeight: 200, pointerEvents: 'auto' }}
      />
      {tipRows.length > 0 && (
        <div ref={tipPanelRef} role="region" aria-label="先端からどれくらい出るか" style={{
          position: 'absolute', top: overlayTop + 12, left: 12, zIndex: 2,
          width: 400, maxWidth: 'calc(55% - 18px)', maxHeight: '55%', overflowY: 'auto',
          boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8,
          border: '1px solid #475569', background: 'rgba(17,24,39,0.94)',
          color: '#e2e8f0', pointerEvents: 'auto', opacity: ready ? 1 : 0,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            先端からどれくらい出るか <span title="手元の露出を0 cmとした最大値" style={{ fontSize: 10, fontWeight: 400, color: '#94a3b8' }}>（最大挿入時）</span>
          </div>
          {tipRows.map(({ tube, parent, label, port, assumed, connectorCm, hubCm, needsCaution }) => (
            <div key={tube.id} style={{ padding: '5px 0', borderTop: '1px solid #334155' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px', alignItems: 'baseline', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ minWidth: 0, overflowWrap: 'anywhere', color: tube.c.fill }}>{tube.label}{port ? `（${port === 'side' ? '側孔' : '中央'}）` : ''}</span>
                <strong style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: needsCaution ? '#ff8080' : undefined }}>
                  {label}{assumed && <span style={{ fontSize: 10, color: '#fcd34d', marginLeft: 4 }}>（想定値）</span>}
                </strong>
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', overflowWrap: 'anywhere' }}>{parent.label} の先端から</div>
              <div style={{ fontSize: 10, color: assumed ? '#fcd34d' : '#94a3b8', overflowWrap: 'anywhere' }}>
                {parent.connector === 'tri' ? 'トリコネ' : 'Yコネ'} {connectorCm} cm・ハブ {hubCm} cm{assumed ? '（想定値）' : ''}
              </div>
              {needsCaution && (
                <div role="status" style={{ marginTop: 6, padding: '6px 8px', border: '1px solid #ef4444',
                  borderLeft: '4px solid #ef4444', borderRadius: 4, background: 'rgba(127,29,29,0.35)',
                  color: '#ff8080', fontSize: 12, lineHeight: '18px', fontWeight: 700 }}>
                  注意：最大でも5 cm以下です
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {ready && tubes.some((tube) => tube.connector) && (
        <label style={{ position: 'absolute', top: overlayTop + 12, right: 12,
          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
          borderRadius: 6, background: 'rgba(17,24,39,0.92)', color: '#e2e8f0', fontSize: 12, pointerEvents: 'auto' }}>
          <input type="checkbox" checked={showConnectors} onChange={(event) => setShowConnectors(event.target.checked)} />
          コネクターを表示
        </label>
      )}

      {/* Error display */}
      {error && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#111827', color: '#f87171', fontSize: 12, padding: 16, textAlign: 'center',
        }}>
          3D エラー: {error}
        </div>
      )}

      {/* Fixed legend stays readable while the model rotates or zooms. */}
        <div ref={legendRef} role="region" aria-label="選択デバイス" style={{
          position: 'absolute', top: overlayTop + 48, right: 12, zIndex: 2,
          width: 300, maxWidth: tipRows.length > 0 ? 'calc(45% - 18px)' : 'calc(100% - 24px)',
          maxHeight: 'calc(55% - 36px)', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 6,
          pointerEvents: 'auto', opacity: ready ? 1 : 0,
        }}>
          {tubes.map(({ id, label, c, hub }) => (
            <div key={id} data-device-label={id} title={hub ? `${label}\n3Dハブ表示：${hubDisplayLabel(hub)}` : label} style={{
              minHeight: 28, flexShrink: 0, boxSizing: 'border-box',
              display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 6px',
              background: 'rgba(17,24,39,0.94)',
              border: `1px solid ${c.fill}`,
              borderRadius: 6, padding: '3px 8px',
              fontSize: 12, color: '#f3f4f6',
            }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.fill, flexShrink: 0 }} />
              <span style={{ minWidth: 0, flex: 1, overflowWrap: 'anywhere' }}>{label}</span>
              {(() => {
                const tube = tubes.find((item) => item.id === id)!;
                const parent = tubes.find((item) => item.id === tube.parentId);
                if (parent?.connector !== 'tri') return null;
                const siblings = tubes.filter((item) => item.parentId === parent.id);
                return <span style={{ fontSize: 11, color: '#93c5fd' }}>（{siblings[1]?.id === id ? 'サイドポート' : '中央ポート'}）</span>;
              })()}
            </div>
          ))}
        </div>

      {/* Hint */}
      {ready && (
        <div style={{
          position: 'absolute', bottom: 12, right: 12,
          fontSize: 10, lineHeight: '14px', maxWidth: 'calc(100% - 24px)', color: 'rgba(156,163,175,0.6)',
          pointerEvents: 'none',
        }}>
          ドラッグ: 回転 &nbsp;|&nbsp; スクロール: ズーム
          <br />
          近位（根元）→遠位（先端）。両端径を直線的に補間した模式図です。
          <br />ハブ：登録値を使用、未登録は5cmの想定値。形状・太さは模式化しています。
          {tubes.some((tube) => tube.parentId && tubes.some((parent) => parent.id === tube.parentId)) && <><br />内側カテーテル：コネクター入口から手前に5cm露出。残りを先端側へ配置。</>}
          {showConnectors && tubes.some((tube) => tube.connector) && <><br />Yコネクタ：約5cm。トリコネクター：仮の表示長5cm。太さは拡大表示、適合性判定には含みません。</>}
        </div>
      )}

    </div>
  );
}
