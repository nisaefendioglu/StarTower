import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { repoFacadeTexture, signTexture } from '../lib/textures.js';
import { hash } from '../lib/random.js';
import { REPO_FLOOR_H, COLORS } from '../lib/constants.js';

const PLINTH = 0.4;
const ease = (t) => 1 - Math.pow(1 - t, 3);

function floorFromPoint(b, worldY) {
  const i = Math.floor((worldY - PLINTH) / REPO_FLOOR_H);
  return i >= 0 && i < b.floors ? i : null;
}

function RepoBuilding({ b, delay, start, selectedFloor, hoveredFloor, mineFloor, mineBuilding, isSelected, reduceMotion, onPick, onHover }) {
  const group = useRef();
  const body = useRef();
  const marker = useRef();
  const hoverMarker = useRef();
  const lit = b.repo.floorLogins.length;
  const n = b.floors;
  const bodyH = Math.max(REPO_FLOOR_H, n * REPO_FLOOR_H);

  const tex = useMemo(() => repoFacadeTexture(hash(b.repo.name), Math.max(1, n), lit), [b, n, lit]);
  const sign = useMemo(() => signTexture(b.repo.name, b.repo.stars), [b]);
  const mats = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.5, roughness: 0.75 });
    const cap = new THREE.MeshStandardMaterial({ color: COLORS.cap, roughness: 0.8 });
    return [side, side, cap, cap, side, side];
  }, [tex]);
  useEffect(() => () => { tex.dispose(); sign.dispose(); mats[0].dispose(); mats[2].dispose(); }, [tex, sign, mats]);

  useFrame(() => {
    const now = performance.now();
    const t = reduceMotion ? 1 : Math.min(1, Math.max(0, (now - start.current - delay) / 700));
    if (group.current) group.current.scale.y = Math.max(0.001, ease(t));
    const target = isSelected ? 0.95 : hoveredFloor != null ? 0.75 : 0.5;
    mats[0].emissiveIntensity += (target - mats[0].emissiveIntensity) * 0.15;
    if (marker.current) marker.current.material.opacity = 0.45 + Math.sin(now / 260) * 0.2;
  });

  const handle = (e, fn) => {
    e.stopPropagation();
    fn(floorFromPoint(b, e.point.y), e);
  };

  return (
    <group position={[b.x, 0, b.z]}>
      <group ref={group} scale-y={reduceMotion ? 1 : 0.001}>
        <mesh position-y={PLINTH / 2}>
          <boxGeometry args={[b.w + 0.8, PLINTH, b.w + 0.8]} />
          <meshStandardMaterial color={COLORS.slab} roughness={0.6} metalness={0.3} />
        </mesh>
        <mesh
          ref={body}
          position-y={PLINTH + bodyH / 2}
          material={mats}
          onClick={(e) => {
            if (e.delta > 6) return;
            handle(e, (f) => onPick(b.repo.name, f));
          }}
          onPointerMove={(e) => handle(e, (f, ev) => onHover(b.repo.name, f, ev))}
          onPointerOut={() => onHover(null)}
        >
          <boxGeometry args={[b.w, bodyH, b.w]} />
        </mesh>
        <mesh position-y={PLINTH + bodyH + 0.2}>
          <boxGeometry args={[b.w * 0.8, 0.4, b.w * 0.8]} />
          <meshStandardMaterial color={COLORS.slab} roughness={0.6} metalness={0.3} />
        </mesh>
        {mineBuilding && mineFloor == null && (
          <mesh position-y={PLINTH + bodyH / 2}>
            <boxGeometry args={[b.w + 0.5, bodyH + 0.3, b.w + 0.5]} />
            <meshBasicMaterial color={COLORS.mine} transparent opacity={0.22} depthWrite={false} />
          </mesh>
        )}
        {mineFloor != null && mineFloor !== selectedFloor && (
          <mesh position-y={PLINTH + (mineFloor + 0.5) * REPO_FLOOR_H}>
            <boxGeometry args={[b.w + 0.35, REPO_FLOOR_H * 0.9, b.w + 0.35]} />
            <meshBasicMaterial color={COLORS.mine} transparent opacity={0.45} depthWrite={false} />
          </mesh>
        )}
        {selectedFloor != null && (
          <mesh ref={marker} position-y={PLINTH + (selectedFloor + 0.5) * REPO_FLOOR_H}>
            <boxGeometry args={[b.w + 0.3, REPO_FLOOR_H * 0.9, b.w + 0.3]} />
            <meshBasicMaterial color={COLORS.lamp} transparent opacity={0.5} depthWrite={false} />
          </mesh>
        )}
        {hoveredFloor != null && hoveredFloor !== selectedFloor && (
          <mesh ref={hoverMarker} position-y={PLINTH + (hoveredFloor + 0.5) * REPO_FLOOR_H}>
            <boxGeometry args={[b.w + 0.2, REPO_FLOOR_H * 0.9, b.w + 0.2]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.18} depthWrite={false} />
          </mesh>
        )}
      </group>
      <sprite
        position-y={b.height + 2}
        scale={[5.2, 1.3, 1]}
        onClick={(e) => {
          if (e.delta > 6) return;
          e.stopPropagation();
          onPick(b.repo.name, null);
        }}
      >
        <spriteMaterial map={sign} transparent depthWrite={false} opacity={isSelected ? 1 : 0.88} />
      </sprite>
    </group>
  );
}

/** Ana kulenin etrafındaki repo binaları. */
export default function RepoCity({ tower, mineLogin, mineRepos, repoSel, repoHover, reduceMotion, onPick, onHover }) {
  const start = useRef(performance.now());
  useLayoutEffect(() => {
    start.current = performance.now();
  }, [tower]);

  return (
    <group>
      {tower.city.map((b, i) => {
        const name = b.repo.name;
        return (
          <RepoBuilding
            key={`${tower.owner}:${name}`}
            b={b}
            delay={reduceMotion ? 0 : 300 + i * 45}
            start={start}
            isSelected={repoSel?.name === name}
            selectedFloor={repoSel?.name === name ? repoSel.floor : null}
            hoveredFloor={repoHover?.name === name ? repoHover.floor : null}
            mineBuilding={!!mineRepos?.has(name)}
            mineFloor={mineLogin && b.repo.floorLogins.includes(mineLogin) ? b.repo.floorLogins.indexOf(mineLogin) : null}
            reduceMotion={reduceMotion}
            onPick={onPick}
            onHover={onHover}
          />
        );
      })}
    </group>
  );
}
