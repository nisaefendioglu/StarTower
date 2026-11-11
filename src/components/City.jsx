import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { rng } from '../lib/random.js';
import { windowTexture } from '../lib/textures.js';
import { COLORS } from '../lib/constants.js';

/** Zemin, ışıklar, gökyüzündeki yıldızlar ve uzaktaki ufuk binaları. */
export default function City() {
  const buildings = useMemo(() => {
    const r = rng(7);
    const dark = new THREE.MeshStandardMaterial({ color: '#10162f', roughness: 0.9 });
    return Array.from({ length: 50 }, (_, i) => {
      const ang = r() * Math.PI * 2;
      const dist = 95 + r() * 70; // repo binalarının dışında, ufuk çizgisi
      const w = 3 + r() * 5;
      const h = 3 + r() * 18;
      const tex = windowTexture(i * 13 + 1, 4, Math.max(3, Math.round(h / 1.6)), 0.18);
      const side = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.22, roughness: 0.9 });
      return { key: i, pos: [Math.cos(ang) * dist, h / 2, Math.sin(ang) * dist], size: [w, h, w], mats: [side, side, dark, dark, side, side] };
    });
  }, []);

  const starPositions = useMemo(() => {
    const n = 1400;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * (Math.random() * 0.5 + 0.5) - 1);
      const R = 260;
      p[i * 3] = R * Math.sin(ph) * Math.cos(th);
      p[i * 3 + 1] = Math.abs(R * Math.cos(ph)) + 10;
      p[i * 3 + 2] = R * Math.sin(ph) * Math.sin(th);
    }
    return p;
  }, []);

  useEffect(() => () => buildings.forEach((b) => { b.mats[0].map.dispose(); b.mats[0].dispose(); }), [buildings]);

  return (
    <>
      <color attach="background" args={[COLORS.sky]} />
      <fog attach="fog" args={[COLORS.sky, 110, 300]} />
      <hemisphereLight args={['#7d8fd6', '#0a0c18', 0.9]} />
      <directionalLight position={[-30, 60, 20]} color="#c9d4ff" intensity={0.7} />
      <pointLight position={[0, 4, 0]} color="#ffb84d" intensity={40} distance={60} />

      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[320, 64]} />
        <meshStandardMaterial color="#0d132b" roughness={1} />
      </mesh>
      <gridHelper args={[340, 120, '#26305c', '#161d3d']} position-y={0.01} />

      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[starPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#c8d2ff" size={1.1} sizeAttenuation={false} fog={false} />
      </points>

      {buildings.map((b) => (
        <mesh key={b.key} position={b.pos} material={b.mats}>
          <boxGeometry args={b.size} />
        </mesh>
      ))}
    </>
  );
}
