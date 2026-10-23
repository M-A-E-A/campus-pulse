"use client";

import { useMemo, useRef, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * One scene: a drifting field of points that leans toward the cursor.
 * Mounted client-only (see Hero.tsx) with DPR capped, and only when the
 * device can handle it and motion isn't reduced.
 */

const COUNT = 1800;
const SPREAD = 14;

function PointField() {
  const points = useRef<THREE.Points>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const { viewport } = useThree();

  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * SPREAD * 2;
      arr[i * 3 + 1] = (Math.random() - 0.5) * SPREAD;
      arr[i * 3 + 2] = (Math.random() - 0.5) * SPREAD;
    }
    return arr;
  }, []);

  // Per-point drift seeds so the field moves like a slow current, not a blob.
  const seeds = useMemo(
    () => Array.from({ length: COUNT }, () => Math.random() * Math.PI * 2),
    []
  );

  useFrame((state, delta) => {
    const pts = points.current;
    if (!pts) return;

    // Cursor influence: pointer position in normalized device coords.
    mouse.current.x += (state.pointer.x - mouse.current.x) * 0.05;
    mouse.current.y += (state.pointer.y - mouse.current.y) * 0.05;

    const pos = pts.geometry.attributes.position as THREE.BufferAttribute;
    const t = state.clock.elapsedTime;

    for (let i = 0; i < COUNT; i++) {
      const seed = seeds[i];
      // Gentle vertical current + horizontal sway per point.
      let y = pos.getY(i) + delta * 0.12 * (0.4 + Math.sin(seed) * 0.3);
      if (y > SPREAD / 2) y = -SPREAD / 2; // recycle off the top
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(t * 0.3 + seed) * delta * 0.05);
    }
    pos.needsUpdate = true;

    // Whole field leans toward the cursor, camera fixed.
    pts.rotation.y += (mouse.current.x * 0.25 - pts.rotation.y) * 0.04;
    pts.rotation.x += (-mouse.current.y * 0.15 - pts.rotation.x) * 0.04;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        color="#ff4d00"
        transparent
        opacity={0.75}
        sizeAttenuation
        depthWrite={false}
      />
      {/* Keep the scene sized to the viewport without layout thrash. */}
      <group scale={Math.min(1.4, Math.max(0.7, viewport.width / 12))} />
    </points>
  );
}

export default function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 9], fov: 55 }}
      dpr={[1, 1.5]} // cap pixel ratio — the brief's performance note
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%" }}
    >
      <Suspense fallback={null}>
        <PointField />
      </Suspense>
    </Canvas>
  );
}
