import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/** OrbitControls hedefini seçilen kata ya da binaya yumuşakça kaydırır. */
export default function CameraRig({ target }) {
  const { controls } = useThree();
  const goal = useRef(new THREE.Vector3());
  useFrame(() => {
    if (!controls) return;
    goal.current.set(target[0], target[1], target[2]);
    controls.target.lerp(goal.current, 0.06);
  });
  return null;
}
