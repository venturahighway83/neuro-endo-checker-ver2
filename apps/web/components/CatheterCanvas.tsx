'use client';

import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { type TubeRadii } from './tubeGeometry';
import { routeCatheters, routedSurface } from './catheterRouting';
import { createYConnector } from './yConnector';
import type { ConnectorKind } from './connectorKind';
import { placeDeviceLabels } from './deviceLabelLayout';

export interface TubeSpec extends TubeRadii {
  id:     string;
  label:  string;
  length: number;
  y:      number;
  proximalZ?: number;
  parentId?: string;
  connector?: ConnectorKind;
  connectorLength?: number;
  c: { fill: string; dark: string; lumen: string };
}

interface Props {
  overlayTop?: number;
  tubes:    TubeSpec[];
  totalLen: number;
  maxR3:    number;
  camPos:   [number, number, number];
  proximalExposure: number;
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
export function CatheterCanvas({ tubes, totalLen, maxR3, camPos, proximalExposure, overlayTop = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const annotationRef = useRef<HTMLDivElement>(null);
  const [error, setError]       = useState<string | null>(null);
  const [ready, setReady]       = useState(false);
  const [showConnectors, setShowConnectors] = useState(true);

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
      const routes = routeCatheters(tubes, proximalExposure);
      const deviceBounds: THREE.Box3[] = [];
      for (const { id, proximalOuterR, distalOuterR, proximalInnerR, distalInnerR, c, connector, connectorLength = 0 } of tubes) {
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
        if (showConnectors && connector) {
          const mesh = createYConnector(proximalOuterR, proximalInnerR, connectorLength, connector);
          mesh.position.copy(path.getPointAt(0));
          mesh.quaternion.copy(rootRotation);
          group.add(mesh);
        }

        scene.add(group);
        deviceBounds.push(new THREE.Box3().setFromObject(group));
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
        const top = Math.min(overlayTop + 44, height * 0.25);
        const bottom = Math.min(72, height * 0.3);
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

      // Project device labels onto the same camera as the model. Updating DOM
      // coordinates avoids React re-renders during orbit and zoom.
      let viewportWidth = w0, viewportHeight = h0;
      const labelNodes = Array.from(annotationRef.current?.querySelectorAll<HTMLElement>('[data-device-label]') ?? []);
      const lineNodes = Array.from(annotationRef.current?.querySelectorAll<SVGLineElement>('line') ?? []);
      const anchors = tubes.map((tube) => routes.get(tube.id)!.path.getPointAt(1));
      const projected = new THREE.Vector3();
      const updateLabels = () => {
        const top = overlayTop + 44;
        const bottom = Math.max(top + 28, viewportHeight - 72);
        const items = anchors.map((anchor, index) => {
          projected.copy(anchor).project(camera);
          const visible = projected.z >= -1 && projected.z <= 1 && Math.abs(projected.x) <= 1.2 && Math.abs(projected.y) <= 1.2;
          const x = (projected.x + 1) * viewportWidth / 2;
          const y = (1 - projected.y) * viewportHeight / 2;
          return { index, x, y, visible };
        });
        const obstacles = deviceBounds.map((box) => {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
            projected.set(x, y, z).project(camera);
            // A near-plane intersection has no reliable finite projected box.
            if (projected.z < -1 || projected.z > 1) return { x: 0, y: 0, width: viewportWidth, height: viewportHeight };
            const px = (projected.x + 1) * viewportWidth / 2;
            const py = (1 - projected.y) * viewportHeight / 2;
            minX = Math.min(minX, px); maxX = Math.max(maxX, px);
            minY = Math.min(minY, py); maxY = Math.max(maxY, py);
          }
          return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        });
        const placements = placeDeviceLabels(items, obstacles, { x: 8, y: top, width: viewportWidth - 16, height: bottom - top });
        for (const item of items) {
          const placement = placements[item.index];
          labelNodes[item.index].style.visibility = placement ? 'visible' : 'hidden';
          lineNodes[item.index].style.visibility = placement ? 'visible' : 'hidden';
          if (!placement) continue;
          const { x, y, width: labelWidth } = placement;
          const node = labelNodes[item.index];
          node.style.width = `${labelWidth}px`;
          node.style.transform = `translate(${x}px, ${y}px)`;
          const line = lineNodes[item.index];
          line.setAttribute('x1', String(item.x));
          line.setAttribute('y1', String(item.y));
          line.setAttribute('x2', String(Math.max(x, Math.min(x + labelWidth, item.x))));
          line.setAttribute('y2', String(Math.max(y, Math.min(y + 28, item.y))));
        }
      };
      // Render loop
      const tick = () => { raf = requestAnimationFrame(tick); renderer!.render(scene, camera); updateLabels(); };
      tick();

      // Resize observer — use contentRect for accurate dimensions
      const ro = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        if (!width || !height) return;
        viewportWidth = width;
        viewportHeight = height;
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
        aria-label="カテーテルとコネクターの3D模式図"
        style={{ display: 'block', width: '100%', height: '100%', minHeight: 200, pointerEvents: 'auto' }}
      />
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

      {/* Device names follow their distal ends, with colour-matched leaders. */}
        <div ref={annotationRef} style={{
          position: 'absolute', inset: 0, overflow: 'hidden',
          pointerEvents: 'none', opacity: ready ? 1 : 0,
        }}>
          <svg aria-hidden="true" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
            {tubes.map(({ id, c }) => <line key={id} stroke={c.fill} strokeWidth="1.5" strokeOpacity="0.85" />)}
          </svg>
          {tubes.map(({ id, label, c }) => (
            <div key={id} data-device-label={id} title={label} style={{
              position: 'absolute', top: 0, left: 0, height: 28,
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(17,24,39,0.94)',
              border: `1px solid ${c.fill}`,
              borderRadius: 6, padding: '3px 8px',
              fontSize: 12, color: '#f3f4f6',
              whiteSpace: 'nowrap', overflow: 'hidden',
            }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.fill, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1 }}>{label}</span>
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
          fontSize: 10, color: 'rgba(156,163,175,0.6)',
          pointerEvents: 'none',
        }}>
          ドラッグ: 回転 &nbsp;|&nbsp; スクロール: ズーム
          <br />
          近位（根元）→遠位（先端）。両端径を直線的に補間した模式図です。
          {tubes.some((tube) => tube.parentId && tubes.some((parent) => parent.id === tube.parentId)) && <><br />内側カテーテル：コネクター入口から手前に5cm露出。残りを先端側へ配置。</>}
          {showConnectors && tubes.some((tube) => tube.connector) && <><br />Yコネクタ：約5cm。トリコネクター：仮の表示長5cm。太さは拡大表示、適合性判定には含みません。</>}
        </div>
      )}

    </div>
  );
}
