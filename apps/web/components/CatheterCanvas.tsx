'use client';

import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { tubeSurface, type TubeRadii } from './tubeGeometry';
import { createYConnector } from './yConnector';

export interface TubeSpec extends TubeRadii {
  id:     string;
  label:  string;
  length: number;
  y:      number;
  proximalZ?: number;
  connector?: boolean;
  connectorLength?: number;
  c: { fill: string; dark: string; lumen: string };
}

interface Props {
  overlayTop?: number;
  tubes:    TubeSpec[];
  totalLen: number;
  maxR3:    number;
  camPos:   [number, number, number];
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
export function CatheterCanvas({ tubes, totalLen, maxR3, camPos, overlayTop = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError]       = useState<string | null>(null);
  const [ready, setReady]       = useState(false);
  const [showConnectors, setShowConnectors] = useState(true);

  const sceneKey = JSON.stringify({ tubes, camPos, totalLen, maxR3, showConnectors });

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

      // Lights
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const dl1 = new THREE.DirectionalLight(0xffffff, 1.1);
      dl1.position.set(maxR3 * 3, maxR3 * 5, totalLen * 0.8);
      scene.add(dl1);
      const dl2 = new THREE.DirectionalLight(0xffffff, 0.2);
      dl2.position.set(-maxR3 * 2, -maxR3 * 3, -totalLen * 0.3);
      scene.add(dl2);

      // Tube meshes
      for (const { proximalOuterR, distalOuterR, proximalInnerR, distalInnerR, length, y, c, proximalZ = 0, connector, connectorLength = 0 } of tubes) {
        const group = new THREE.Group();
        group.position.y = y;
        const z = showConnectors ? proximalZ : 0;
        group.position.z = z;
        const drawnLength = length;

        const outerG = tubeSurface(proximalOuterR, distalOuterR, drawnLength);
        const outerM = new THREE.Mesh(outerG,
          new THREE.MeshStandardMaterial({ color: c.fill, roughness: 0.32, metalness: 0.1 }));
        group.add(outerM);

        const innerG = tubeSurface(proximalInnerR, distalInnerR, drawnLength);
        const innerM = new THREE.Mesh(innerG,
          new THREE.MeshStandardMaterial({ color: c.lumen, roughness: 0.65, side: THREE.BackSide }));
        group.add(innerM);

        const capMat = new THREE.MeshStandardMaterial({ color: c.dark, roughness: 0.45, side: THREE.DoubleSide });
        const lCap   = new THREE.Mesh(new THREE.RingGeometry(proximalInnerR, proximalOuterR, 48), capMat);
        lCap.position.z = 0;
        group.add(lCap);
        const rCap   = new THREE.Mesh(new THREE.RingGeometry(distalInnerR, distalOuterR, 48), capMat);
        rCap.position.z = drawnLength;
        group.add(rCap);
        if (showConnectors && connector) group.add(createYConnector(proximalOuterR, proximalInnerR, connectorLength));

        scene.add(group);
      }

      // Camera look-at + orbit
      const bounds = new THREE.Box3().setFromObject(scene);
      const sphere = bounds.getBoundingSphere(new THREE.Sphere());
      const target = sphere.center;
      const viewDirection = new THREE.Vector3(...camPos).sub(new THREE.Vector3(0, 0, totalLen * 0.45)).normalize();
      const fitCamera = () => {
        const verticalFov = THREE.MathUtils.degToRad(camera.fov / 2);
        const halfFov = Math.min(verticalFov, Math.atan(Math.tan(verticalFov) * camera.aspect));
        const distance = sphere.radius / Math.sin(halfFov) * 1.12;
        camera.position.copy(target).addScaledVector(viewDirection, distance);
        camera.lookAt(target);
      };
      fitCamera();
      camera.lookAt(target);
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
        aria-label="カテーテルとYコネクタの3D模式図"
        style={{ display: 'block', width: '100%', height: '100%', minHeight: 200, pointerEvents: 'auto' }}
      />
      {ready && tubes.some((tube) => tube.connector) && (
        <label style={{ position: 'absolute', top: overlayTop + 12, right: 12,
          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
          borderRadius: 6, background: 'rgba(17,24,39,0.92)', color: '#e2e8f0', fontSize: 12, pointerEvents: 'auto' }}>
          <input type="checkbox" checked={showConnectors} onChange={(event) => setShowConnectors(event.target.checked)} />
          Yコネクタを表示
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

      {/* Legend */}
      {ready && (
        <div style={{
          position: 'absolute', top: overlayTop + 12, left: 12,
          display: 'flex', flexDirection: 'column', gap: 6,
          pointerEvents: 'none',
        }}>
          {tubes.map(({ id, label, c }) => (
            <div key={id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(17,24,39,0.88)',
              border: `1px solid ${c.fill}`,
              borderRadius: 6, padding: '4px 12px',
              fontSize: 13, color: '#f3f4f6',
              whiteSpace: 'nowrap',
            }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.fill, flexShrink: 0 }} />
              {label}
            </div>
          ))}
        </div>
      )}

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
          {showConnectors && tubes.some((tube) => tube.connector) && <><br />Yコネクタ：長さ約5cm（カテーテルと同じ長さ縮尺）。太さは拡大表示、適合性判定には含みません。</>}
        </div>
      )}

    </div>
  );
}
