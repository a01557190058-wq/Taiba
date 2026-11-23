import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';

/**
 * Real WebGL hero scene: a floating "knowledge core", orbiting rings,
 * technology shards and a branded particle field. It is intentionally tiny
 * (low-poly geometry, no shadow maps, capped DPR) and is only loaded on
 * capable desktops by HeroExperience.jsx.
 *
 * All colours come from the existing school palette — no new identity.
 */

const BLUE = '#1769AA';
const DEEP = '#041B33';
const RED = '#D62839';
const GOLD = '#FFC928';

function Shard({ position, scale = 1, color = BLUE, speed = 0.4, kind = 'tetra' }) {
  const mesh = useRef(null);
  const base = useMemo(() => position, [position]);

  useFrame((state) => {
    const node = mesh.current;
    if (!node) return;
    const time = state.clock.getElapsedTime();
    node.rotation.x = time * speed * 0.6 + base[0];
    node.rotation.y = time * speed + base[1];
    node.position.y = base[1] + Math.sin(time * 0.9 + base[0] * 2) * 0.16;
  });

  return (
    <mesh ref={mesh} position={position} scale={scale}>
      {kind === 'octa' ? <octahedronGeometry args={[0.32, 0]} /> : null}
      {kind === 'box' ? <boxGeometry args={[0.42, 0.42, 0.42]} /> : null}
      {kind === 'torus' ? <torusGeometry args={[0.3, 0.075, 6, 18]} /> : null}
      {kind === 'tetra' ? <tetrahedronGeometry args={[0.38, 0]} /> : null}
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.28}
        metalness={0.72}
        roughness={0.3}
        transparent
        opacity={0.92}
      />
    </mesh>
  );
}

function KnowledgeCore() {
  const group = useRef(null);
  const solid = useRef(null);
  const wire = useRef(null);
  const ringOne = useRef(null);
  const ringTwo = useRef(null);

  useFrame((state, delta) => {
    const node = group.current;
    if (!node) return;
    const { pointer, clock } = state;
    const time = clock.getElapsedTime();

    // Gentle mouse parallax — R3F already normalises pointer to -1..1.
    node.rotation.y += (pointer.x * 0.32 - node.rotation.y) * Math.min(1, delta * 2.4);
    node.rotation.x += (-pointer.y * 0.22 - node.rotation.x) * Math.min(1, delta * 2.4);
    node.position.y = Math.sin(time * 0.75) * 0.12;

    if (solid.current) {
      solid.current.rotation.y = time * 0.14;
      solid.current.rotation.z = time * 0.06;
    }
    if (wire.current) {
      wire.current.rotation.y = -time * 0.22;
      wire.current.rotation.x = time * 0.1;
    }
    if (ringOne.current) {
      ringOne.current.rotation.z = time * 0.28;
      ringOne.current.rotation.x = Math.PI / 2.7 + Math.sin(time * 0.5) * 0.12;
    }
    if (ringTwo.current) {
      ringTwo.current.rotation.z = -time * 0.2;
      ringTwo.current.rotation.y = Math.PI / 3 + Math.cos(time * 0.42) * 0.16;
    }
  });

  return (
    <group ref={group} position={[0.35, 0, 0]}>
      <mesh ref={solid}>
        <icosahedronGeometry args={[1.18, 1]} />
        <meshStandardMaterial
          color={BLUE}
          emissive={BLUE}
          emissiveIntensity={0.22}
          metalness={0.78}
          roughness={0.26}
          transparent
          opacity={0.46}
        />
      </mesh>
      <mesh ref={wire} scale={1.035}>
        <icosahedronGeometry args={[1.18, 1]} />
        <meshBasicMaterial color={GOLD} wireframe transparent opacity={0.52} />
      </mesh>
      <mesh ref={ringOne}>
        <torusGeometry args={[1.85, 0.018, 6, 110]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.7} />
      </mesh>
      <mesh ref={ringTwo} rotation={[0, Math.PI / 3, 0]}>
        <torusGeometry args={[2.18, 0.012, 6, 110]} />
        <meshBasicMaterial color={RED} transparent opacity={0.55} />
      </mesh>
      <Shard position={[-2.25, 1.2, -0.6]} scale={0.9} color={GOLD} speed={0.55} kind="octa" />
      <Shard position={[2.35, -1.1, -0.4]} scale={0.8} color={RED} speed={0.42} kind="box" />
      <Shard position={[-1.7, -1.55, 0.3]} scale={0.72} color={BLUE} speed={0.5} kind="torus" />
      <Shard position={[1.85, 1.5, -0.9]} scale={0.66} color={GOLD} speed={0.62} kind="tetra" />
    </group>
  );
}

function ParticleField() {
  const points = useRef(null);
  const positions = useMemo(() => {
    const count = 200;
    const data = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      data[i * 3] = (Math.random() - 0.5) * 9;
      data[i * 3 + 1] = (Math.random() - 0.5) * 5.5;
      data[i * 3 + 2] = -1 - Math.random() * 4;
    }
    return data;
  }, []);

  useFrame((state) => {
    if (!points.current) return;
    points.current.rotation.y = state.clock.getElapsedTime() * 0.015;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={GOLD} size={0.032} transparent opacity={0.72} sizeAttenuation />
    </points>
  );
}

export default function HeroScene3D() {
  return (
    <div className="hero-scene" aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 6.4], fov: 46 }}
      >
        <ambientLight intensity={0.8} color="#ffffff" />
        <pointLight position={[3, 2, 4]} intensity={26} color={GOLD} distance={14} />
        <pointLight position={[-4, -1, 3]} intensity={22} color={BLUE} distance={14} />
        <pointLight position={[0, 3, -2]} intensity={18} color={RED} distance={12} />
        <group position={[-0.5, 0, 0]}>
          <KnowledgeCore />
        </group>
        <ParticleField />
        <mesh position={[0, 0, -4.5]}>
          <planeGeometry args={[18, 11]} />
          <meshBasicMaterial color={DEEP} transparent opacity={0.08} />
        </mesh>
      </Canvas>
    </div>
  );
}
