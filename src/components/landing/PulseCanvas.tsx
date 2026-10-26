"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type * as THREE from "three";

/**
 * The hero's living layer: a dot-matrix field whose columns ride an ECG
 * waveform travelling across the screen — "the pulse" made visible. The
 * cursor pushes dots away; the wave keeps moving on its own.
 *
 * Guardrails: client-only (dynamic import in Hero), pixel ratio capped at
 * 1.5 via dpr, ~1150 points, no lights or shaders. Reduced motion and weak
 * devices never load it — the static SVG pulse line in Hero is the floor.
 */

const COLS = 72;
const ROWS = 16;
const TOTAL = COLS * ROWS;

/** One ECG beat as a sum of gaussians over x ∈ [0, 1). */
function ecg(u: number): number {
  const x = u - Math.floor(u); // wrap
  const g = (c: number, a: number, h: number) =>
    h * Math.exp(-((x - c) * (x - c)) / a);
  return (
    g(0.44, 0.0012, 0.12) + // P wave
    g(0.52, 0.0004, -0.15) + // Q
    g(0.56, 0.0006, 1.0) + // R spike
    g(0.6, 0.0008, -0.28) // S
  );
}

function PulseField() {
  const points = useRef<THREE.Points>(null);

  // Normalised base grid (-1..1 in both axes), built once; scaled to the
  // visible world each frame so resize stays correct.
  const { baseX, baseY, colors } = useMemo(() => {
    const baseX = new Float32Array(COLS);
    const baseY = new Float32Array(TOTAL);
    const colors = new Float32Array(TOTAL * 3);
    for (let c = 0; c < COLS; c++) baseX[c] = (c / (COLS - 1)) * 2 - 1;
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        baseY[c * ROWS + r] = (r / (ROWS - 1)) * 2 - 1;
      }
    }
    return { baseX, baseY, colors };
  }, []);

  useFrame((state) => {
    const pts = points.current;
    if (!pts) return;
    const attr = pts.geometry.getAttribute("position") as THREE.BufferAttribute;
    const colAttr = pts.geometry.getAttribute("color") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const col = colAttr.array as Float32Array;

    const t = state.clock.elapsedTime;
    const phase = t * 0.14; // one slow travelling beat
    const hw = state.viewport.width / 2;
    const hh = state.viewport.height / 2;
    // Pointer in world units; (0,0) before first move reads as "no pointer".
    const px = state.pointer.x * hw;
    const py = state.pointer.y * hh;
    const hasPointer = state.pointer.x !== 0 || state.pointer.y !== 0;
    const radius = 0.55 * hh;
    const radius2 = radius * radius;

    for (let c = 0; c < COLS; c++) {
      const beat = ecg((c / COLS) * 2 + phase); // two beats on screen at once
      const nx = baseX[c];
      for (let r = 0; r < ROWS; r++) {
        const i = c * ROWS + r;
        const ny = baseY[i];
        // Wave lift: strongest at the vertical middle of the field.
        const mid = 1 - Math.abs(ny);
        let wy = (ny + beat * 0.5 * mid * mid) * hh;
        let wx = nx * hw;

        // Cursor repel: push dots out of a soft radius.
        if (hasPointer) {
          const dx = wx - px;
          const dy = wy - py;
          const d2 = dx * dx + dy * dy;
          if (d2 < radius2 && d2 > 0.0001) {
            const d = Math.sqrt(d2);
            const f = (radius - d) / radius;
            const s = f * f * 0.22 * hh;
            wx += (dx / d) * s;
            wy += (dy / d) * s;
          }
        }

        arr[i * 3] = wx;
        arr[i * 3 + 1] = wy;

        // Dots riding the beat glow signal orange; the rest sit as faint
        // paper tone-on-tone over the ink field.
        const on = Math.min(Math.abs(beat) * 2.2, 1) * mid;
        col[i * 3] = 0.3 + on * (1.0 - 0.3); // paper 0.98→ call it 1.0
        col[i * 3 + 1] = 0.29 + on * (0.3 - 0.29);
        col[i * 3 + 2] = 0.27 + on * (0.0 - 0.27);
      }
    }
    attr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[new Float32Array(TOTAL * 3), 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={2.4}
        sizeAttenuation={false}
        vertexColors
        transparent
        opacity={0.9}
      />
    </points>
  );
}

export default function PulseCanvas() {
  return (
    <Canvas
      orthographic
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 5], zoom: 100 }}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <PulseField />
    </Canvas>
  );
}
