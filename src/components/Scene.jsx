import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import City from './City.jsx';
import Tower from './Tower.jsx';
import CameraRig from './CameraRig.jsx';
import RepoCity from './RepoCity.jsx';

/** Tüm 3B sahne. App.jsx bunu ayrı bir parça olarak sonradan yükler. */
export default function Scene({ tower, selectedId, hoveredId, mineLogin, mineRepos, repoSel, repoHover, reduceMotion, autoRotate, target, onSelect, onHover, onRepoPick, onRepoHover, onLayout, onMiss, onInteract }) {
  const downAt = useRef(null);
  return (
    <div
      className={`scene ${hoveredId || repoHover ? 'hovering' : ''}`}
      onPointerDown={(e) => (downAt.current = { x: e.clientX, y: e.clientY })}
    >
      <Canvas
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: false }}
        camera={{ position: [34, 22, 38], fov: 42, near: 0.1, far: 600 }}
        onPointerMissed={(e) => {
          const d = downAt.current;
          if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
          onMiss();
        }}
      >
        <City />
        {tower && (
          <RepoCity tower={tower} mineLogin={mineLogin} mineRepos={mineRepos} repoSel={repoSel} repoHover={repoHover} reduceMotion={reduceMotion} onPick={onRepoPick} onHover={onRepoHover} />
        )}
        {tower && (
          <Tower
            tower={tower}
            selectedId={selectedId}
            hoveredId={hoveredId}
            mineLogin={mineLogin}
            mineRepos={mineRepos}
            reduceMotion={reduceMotion}
            onSelect={onSelect}
            onHover={onHover}
            onLayout={onLayout}
          />
        )}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.07}
          autoRotate={autoRotate}
          autoRotateSpeed={0.55}
          maxPolarAngle={Math.PI * 0.49}
          minDistance={8}
          maxDistance={280}
          onStart={onInteract}
        />
        <CameraRig target={target} />
      </Canvas>
    </div>
  );
}
