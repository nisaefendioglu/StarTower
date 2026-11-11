import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import Floor from './Floor.jsx';
import { BASE_H, FLOOR_H, RISE_MS, COLORS } from '../lib/constants.js';

const ease = (t) => 1 - Math.pow(1 - t, 3);

export default function Tower({ tower, selectedId, hoveredId, mineLogin, mineRepos, reduceMotion, onSelect, onHover, onLayout }) {
  const buildStart = useRef(performance.now());
  const crown = useRef();
  const beacon = useRef();
  const { camera, controls } = useThree();

  const n = tower.floors.length;
  const stepDelay = reduceMotion ? 0 : Math.max(35, 1400 / Math.max(1, n));

  const layout = useMemo(
    () =>
      tower.floors.map((f, i) => ({
        floor: f,
        width: 11 - (n > 1 ? i / (n - 1) : 0) * 4.6,
        y: BASE_H + i * FLOOR_H,
        delay: i * stepDelay,
      })),
    [tower, n, stepDelay]
  );
  const topY = BASE_H + n * FLOOR_H;
  const topW = n ? layout[n - 1].width : 8;

  // Yeni kule geldiğinde animasyonu baştan başlat ve kamerayı kuleye göre yerleştir
  useLayoutEffect(() => {
    buildStart.current = performance.now();
    const h = topY + 6;
    const portrait = camera.aspect < 1 ? 1 / camera.aspect : 1;
    const dist = Math.max(36, h * 1.8, (tower.cityRadius || 0) * 1.45) * Math.min(1.8, portrait * 0.85 + 0.15);
    const target = controls?.target;
    const dx = camera.position.x - (target?.x ?? 0);
    const dz = camera.position.z - (target?.z ?? 0);
    const len = Math.hypot(dx, dz) || 1;
    camera.position.set((dx / len) * dist, Math.max(h * 0.6 + 6, dist * 0.42), (dz / len) * dist);
    onLayout({ topY, floorY: Object.fromEntries(layout.map((l) => [l.floor.id, l.y])) });
  }, [tower]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const now = performance.now();
    if (crown.current) {
      const last = n ? layout[n - 1].delay + RISE_MS : 0;
      const t = reduceMotion ? 1 : Math.min(1, Math.max(0, (now - buildStart.current - last) / 700));
      crown.current.scale.setScalar(Math.max(0.001, ease(t)));
    }
    if (beacon.current) beacon.current.color.set(Math.sin(now / 400) > 0 ? COLORS.signal : '#5a1d27');
  });

  return (
    <group>
      <mesh position-y={BASE_H / 2}>
        <boxGeometry args={[14, BASE_H, 14]} />
        <meshStandardMaterial color={COLORS.slab} roughness={0.6} metalness={0.3} />
      </mesh>

      {layout.map((l) => (
        <Floor
          key={`${tower.owner}:${l.floor.id}`}
          floor={l.floor}
          width={l.width}
          y={l.y}
          delay={l.delay}
          buildStart={buildStart}
          maxCount={tower.maxCount}
          selected={selectedId === l.floor.id}
          hovered={hoveredId === l.floor.id}
          mine={l.floor.repoName ? !!mineRepos?.has(l.floor.repoName) : mineLogin === l.floor.id}
          reduceMotion={reduceMotion}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}

      <group ref={crown} position-y={topY} scale={reduceMotion ? 1 : 0.001}>
        <mesh position-y={0.3}>
          <boxGeometry args={[topW * 0.75, 0.6, topW * 0.75]} />
          <meshStandardMaterial color={COLORS.slab} roughness={0.6} metalness={0.3} />
        </mesh>
        <mesh position-y={3.6}>
          <cylinderGeometry args={[0.08, 0.16, 6, 8]} />
          <meshStandardMaterial color="#8d97c4" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position-y={6.7}>
          <sphereGeometry args={[0.28, 16, 12]} />
          <meshBasicMaterial ref={beacon} color={COLORS.signal} />
        </mesh>
        <pointLight position-y={6.7} color={COLORS.signal} intensity={12} distance={14} />
      </group>
    </group>
  );
}
