import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { facadeTexture } from '../lib/textures.js';
import { FLOOR_H, RISE_MS, COLORS } from '../lib/constants.js';

const ease = (t) => 1 - Math.pow(1 - t, 3);

export default function Floor({ floor, width, y, delay, buildStart, maxCount, selected, hovered, mine, reduceMotion, onSelect, onHover }) {
  const mesh = useRef();

  const texture = useMemo(() => facadeTexture(floor, maxCount), [floor, maxCount]);
  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(width, FLOOR_H * 0.9, width);
    g.translate(0, FLOOR_H * 0.45, 0); // taban sıfırda: yukarı doğru büyür
    return g;
  }, [width]);
  const materials = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: '#ffffff', emissiveIntensity: 0.55, roughness: 0.7 });
    const cap = new THREE.MeshStandardMaterial({ color: COLORS.cap, roughness: 0.8 });
    return [side, side, cap, cap, side, side];
  }, [texture]);

  useEffect(() => () => {
    texture.dispose();
    geometry.dispose();
    materials[0].dispose();
    materials[2].dispose();
  }, [texture, geometry, materials]);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const now = performance.now();
    const t = reduceMotion ? 1 : Math.min(1, Math.max(0, (now - buildStart.current - delay) / RISE_MS));
    m.scale.y = Math.max(0.001, ease(t));
    const s = selected ? 1.07 : hovered ? 1.03 : 1;
    m.scale.x += (s - m.scale.x) * 0.18;
    m.scale.z = m.scale.x;
    const side = materials[0];
    const target = selected ? 1.15 + Math.sin(now / 260) * 0.15 : hovered ? 0.9 : 0.55;
    side.emissiveIntensity += (target - side.emissiveIntensity) * 0.15;
  });

  return (
    <mesh
      ref={mesh}
      position-y={y}
      geometry={geometry}
      material={materials}
      scale-y={reduceMotion ? 1 : 0.001}
      onClick={(e) => {
        if (e.delta > 6) return; // sürükleme sonrası tıklama sayılmaz
        e.stopPropagation();
        onSelect(floor.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(floor.id, e);
      }}
      onPointerMove={(e) => {
        e.stopPropagation();
        onHover(floor.id, e);
      }}
      onPointerOut={() => onHover(null)}
    >
      {mine && (
        <mesh position-y={FLOOR_H * 0.45}>
          <boxGeometry args={[width + 0.5, FLOOR_H * 0.95, width + 0.5]} />
          <meshBasicMaterial color={COLORS.mine} transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}
      <mesh position-y={FLOOR_H * 0.95}>
        <boxGeometry args={[width + 0.35, FLOOR_H * 0.1, width + 0.35]} />
        <meshStandardMaterial color={COLORS.slab} roughness={0.6} metalness={0.3} />
      </mesh>
    </mesh>
  );
}
