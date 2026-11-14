import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Sparkles, Text } from "@react-three/drei";
import { useMemo, useRef, type ReactNode } from "react";
import { DoubleSide, type Group, type PerspectiveCamera as ThreePerspectiveCamera } from "three";
import type { Customer, FurnitureItem, PlayerState, PropertyListing, RoomSnapshot } from "../../shared/types";
import { nearestStation } from "../../shared/stations";
import { useApp } from "../lib/store";

const STATION_KIND: Record<string, FurnitureItem["kind"]> = {
  counter: "counter",
  machine: "coffee_machine",
  pickup: "pickup",
  fridge: "fridge",
};

const PALETTE = {
  bg: "#1a1511",
  fog: "#1c1410",
  floor: "#5c4030",
  plank: "#4a3428",
  plankAlt: "#6b4f3a",
  wall: "#3d2a20",
  wallTrim: "#2a1c14",
  wood: "#8b5a3c",
  woodDark: "#5c4030",
  woodTop: "#a67c52",
  crema: "#c4a574",
  foam: "#f3ebe2",
  espresso: "#3b2418",
  leaf: "#3f6b54",
  leafBright: "#5d9a74",
  ember: "#d9773f",
  metal: "#3a3a3c",
  metalLite: "#6a6a6e",
  fridge: "#9aa4ae",
  glass: "#d8c2a4",
  night: "#1a2233",
  cityWarm: "#e8a05a",
  cityCool: "#6b8cae",
  rug: "#4a5c48",
  angry: "#c45c4a",
} as const;

export type CafeViewMode = "orbit" | "dollhouse" | "play";

interface Props {
  snapshot: RoomSnapshot;
  firstPerson: boolean;
  viewMode?: CafeViewMode;
}

export function CafeScene({ snapshot, firstPerson, viewMode = "orbit" }: Props) {
  const property = snapshot.property!;
  const you = useApp((s) => s.you);
  const me = snapshot.players.find((p) => p.id === you);
  const mode = firstPerson ? "play" : viewMode;

  return (
    <div className="cafe-canvas">
      <Canvas shadows dpr={[1, 1.6]} gl={{ antialias: true, powerPreference: "high-performance" }}>
        <color attach="background" args={[PALETTE.bg]} />
        <fog attach="fog" args={[PALETTE.fog, mode === "dollhouse" ? 18 : 14, mode === "dollhouse" ? 40 : 32]} />

        {/* Warm key + cool fill */}
        <ambientLight intensity={0.22} color="#f3ebe2" />
        <directionalLight
          castShadow
          position={[7, 11, 5]}
          intensity={1.05}
          color="#f0c9a0"
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0004}
          shadow-camera-near={1}
          shadow-camera-far={40}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
        />
        <directionalLight position={[-6, 6, -4]} intensity={0.35} color="#8aa4c0" />
        <hemisphereLight args={["#f3ebe2", "#3b2418", 0.42]} />
        <pointLight position={[property.width * 0.35, 2.4, property.depth * 0.4]} intensity={0.55} color="#d9773f" distance={10} decay={2} />
        <pointLight position={[property.width * 0.7, 2.4, property.depth * 0.55]} intensity={0.4} color="#c4a574" distance={9} decay={2} />

        {mode === "play" && me ? (
          <FollowCam x={me.x} z={me.z} />
        ) : mode === "dollhouse" ? (
          <>
            <PerspectiveCamera
              makeDefault
              position={[property.width / 2 + 2, 16, property.depth / 2 + 10]}
              fov={38}
            />
            <OrbitControls
              target={[property.width / 2, 0.2, property.depth / 2]}
              maxPolarAngle={Math.PI / 2.4}
              minPolarAngle={0.15}
              minDistance={8}
              maxDistance={36}
            />
          </>
        ) : (
          <>
            <PerspectiveCamera makeDefault position={[property.width / 2, 11, property.depth + 8]} fov={42} />
            <OrbitControls
              target={[property.width / 2, 0.4, property.depth / 2]}
              maxPolarAngle={Math.PI / 2.15}
              minDistance={6}
              maxDistance={28}
            />
          </>
        )}

        <CafeRoom
          property={property}
          furniture={snapshot.layout?.furniture ?? []}
          cutaway={mode === "dollhouse"}
          highlightKind={
            you
              ? (() => {
                  const station = nearestStation(snapshot, you);
                  return station ? STATION_KIND[station] : null;
                })()
              : null
          }
        />
        {snapshot.customers.map((c) => (
          <CustomerMesh key={c.id} customer={c} />
        ))}
        {snapshot.players.map((p) => (
          <PlayerMesh key={p.id} player={p} isYou={p.id === you} hideBody={mode === "play" && p.id === you} />
        ))}
      </Canvas>
    </div>
  );
}

function FollowCam({ x, z }: { x: number; z: number }) {
  const ref = useRef<ThreePerspectiveCamera>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.x = x;
    ref.current.position.y = 1.6;
    ref.current.position.z = z;
    ref.current.lookAt(x, 1.4, z - 2);
  });
  return <PerspectiveCamera ref={ref} makeDefault fov={70} near={0.1} far={60} />;
}

function CafeRoom({
  property,
  furniture,
  cutaway = false,
  highlightKind,
}: {
  property: PropertyListing;
  furniture: FurnitureItem[];
  cutaway?: boolean;
  highlightKind?: FurnitureItem["kind"] | null;
}) {
  const w = property.width;
  const d = property.depth;
  const plankCount = Math.min(Math.floor(w * 2), 28);

  return (
    <group>
      {/* Floor base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[w / 2, 0, d / 2]} receiveShadow>
        <planeGeometry args={[w + 0.4, d + 0.4]} />
        <meshStandardMaterial color={PALETTE.floor} roughness={0.92} />
      </mesh>

      {/* Wood planks */}
      {Array.from({ length: plankCount }).map((_, i) => (
        <mesh
          key={`plank-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[(i + 0.5) * (w / plankCount), 0.008, d / 2]}
          receiveShadow
        >
          <planeGeometry args={[w / plankCount - 0.02, d - 0.3]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? PALETTE.plankAlt : PALETTE.plank}
            roughness={0.88}
          />
        </mesh>
      ))}

      {/* Seating area rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[w * 0.55, 0.015, d * 0.58]} receiveShadow>
        <planeGeometry args={[Math.min(w * 0.55, 5.5), Math.min(d * 0.4, 4)]} />
        <meshStandardMaterial color={PALETTE.rug} roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[w * 0.55, 0.017, d * 0.58]}>
        <planeGeometry args={[Math.min(w * 0.55, 5.5) - 0.35, Math.min(d * 0.4, 4) - 0.35]} />
        <meshStandardMaterial color="#3f5240" roughness={0.95} />
      </mesh>

      {/* Walls — tinted by property listing tone; dollhouse drops the front wall */}
      {!cutaway && <Wall length={w} position={[w / 2, 1.45, 0]} color={property.imageTone} />}
      <Wall length={w} position={[w / 2, 1.45, d]} color={property.imageTone} />
      <Wall length={d} position={[0, 1.45, d / 2]} rotation={Math.PI / 2} color={property.imageTone} />
      <Wall length={d} position={[w, 1.45, d / 2]} rotation={Math.PI / 2} color={property.imageTone} />

      {/* Baseboard trim */}
      <mesh position={[w / 2, 0.08, 0.1]} castShadow>
        <boxGeometry args={[w - 0.2, 0.16, 0.06]} />
        <meshStandardMaterial color={PALETTE.wallTrim} roughness={0.85} />
      </mesh>
      <mesh position={[w / 2, 0.08, d - 0.1]} castShadow>
        <boxGeometry args={[w - 0.2, 0.16, 0.06]} />
        <meshStandardMaterial color={PALETTE.wallTrim} roughness={0.85} />
      </mesh>

      {/* Entrance warm glow */}
      <mesh position={[-0.04, 1.15, 1.5]}>
        <boxGeometry args={[0.1, 2.3, 1.9]} />
        <meshStandardMaterial color="#f4d2a0" emissive={PALETTE.ember} emissiveIntensity={0.45} transparent opacity={0.85} />
      </mesh>
      <pointLight position={[0.4, 1.4, 1.5]} intensity={0.65} color="#f0b878" distance={5} decay={2} />

      {/* Front windows + night city + light shafts */}
      <WindowBank width={w * 0.42} centerX={w * 0.32} z={0.06} />
      <WindowBank width={w * 0.28} centerX={w * 0.72} z={0.06} />

      {/* Ceiling beam + pendant lamps */}
      <mesh position={[w / 2, 2.85, d / 2]} castShadow>
        <boxGeometry args={[w * 0.7, 0.08, 0.18]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={0.8} />
      </mesh>
      <PendantLight position={[w * 0.28, 2.55, d * 0.35]} />
      <PendantLight position={[w * 0.55, 2.55, d * 0.45]} />
      <PendantLight position={[w * 0.78, 2.55, d * 0.32]} />

      {/* Menu board on back wall */}
      <MenuBoard position={[w * 0.18, 1.85, d - 0.2]} />

      {/* Property signage */}
      <PropertySign name={property.name} width={w} />

      {furniture.map((f) => (
        <FurnitureMesh key={f.id} item={f} highlight={highlightKind === f.kind} />
      ))}
    </group>
  );
}

function Wall({
  length,
  position,
  rotation = 0,
  color = PALETTE.wall,
}: {
  length: number;
  position: [number, number, number];
  rotation?: number;
  color?: string;
}) {
  return (
    <mesh position={position} rotation={[0, rotation, 0]} castShadow receiveShadow>
      <boxGeometry args={[length, 2.9, 0.2]} />
      <meshStandardMaterial color={color} roughness={0.92} />
    </mesh>
  );
}

function WindowBank({ width, centerX, z }: { width: number; centerX: number; z: number }) {
  const panes = 3;
  const paneW = width / panes - 0.08;
  return (
    <group position={[centerX, 1.55, z]}>
      {/* Frame */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[width + 0.12, 1.45, 0.1]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={0.75} />
      </mesh>
      {Array.from({ length: panes }).map((_, i) => {
        const x = -width / 2 + paneW / 2 + 0.06 + i * (paneW + 0.08);
        return (
          <group key={i} position={[x, 0, 0.02]}>
            {/* Glass */}
            <mesh>
              <boxGeometry args={[paneW, 1.2, 0.04]} />
              <meshStandardMaterial
                color={PALETTE.glass}
                transparent
                opacity={0.28}
                emissive={PALETTE.crema}
                emissiveIntensity={0.12}
                roughness={0.15}
                metalness={0.05}
              />
            </mesh>
            {/* Exterior night city glow */}
            <mesh position={[0, 0, -0.12]}>
              <planeGeometry args={[paneW * 0.92, 1.05]} />
              <meshStandardMaterial
                color={PALETTE.night}
                emissive={i % 2 === 0 ? PALETTE.cityWarm : PALETTE.cityCool}
                emissiveIntensity={0.55}
                transparent
                opacity={0.9}
              />
            </mesh>
            {/* Soft city speckles */}
            <Sparkles
              count={8}
              scale={[paneW * 0.7, 0.85, 0.1]}
              size={1.8}
              speed={0.15}
              opacity={0.55}
              color={i % 2 === 0 ? "#f0c090" : "#a8c0e0"}
              position={[0, 0, -0.1]}
            />
            {/* Light shaft into room */}
            <mesh position={[0, -0.35, 1.1]} rotation={[0.55, 0, 0]}>
              <boxGeometry args={[paneW * 0.55, 0.02, 2.2]} />
              <meshStandardMaterial
                color="#f5e6d0"
                transparent
                opacity={0.07}
                emissive="#e8c9a0"
                emissiveIntensity={0.35}
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function PendantLight({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.4, 6]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0]} castShadow>
        <coneGeometry args={[0.18, 0.22, 12, 1, true]} />
        <meshStandardMaterial color="#4a3428" side={DoubleSide} roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.05, 0]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color="#fff2dd" emissive="#f0c090" emissiveIntensity={1.2} />
      </mesh>
      <pointLight position={[0, -0.2, 0]} intensity={0.55} color="#f0c090" distance={5.5} decay={2} />
    </group>
  );
}

function MenuBoard({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[1.6, 1.1, 0.08]} />
        <meshStandardMaterial color="#2a1c14" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <planeGeometry args={[1.4, 0.9]} />
        <meshStandardMaterial color="#1c1410" emissive="#3b2418" emissiveIntensity={0.15} />
      </mesh>
      <Text position={[0, 0.28, 0.06]} fontSize={0.12} color={PALETTE.crema} anchorX="center" anchorY="middle">
        MENU
      </Text>
      <Text position={[0, 0.08, 0.06]} fontSize={0.09} color={PALETTE.foam} anchorX="center" anchorY="middle">
        Espresso · Latte
      </Text>
      <Text position={[0, -0.08, 0.06]} fontSize={0.09} color={PALETTE.foam} anchorX="center" anchorY="middle">
        Cap · Cold brew
      </Text>
      <Text position={[0, -0.24, 0.06]} fontSize={0.09} color={PALETTE.leafBright} anchorX="center" anchorY="middle">
        Pastries
      </Text>
    </group>
  );
}

function PropertySign({ name, width }: { name: string; width: number }) {
  return (
    <group position={[width / 2, 2.55, 0.22]}>
      <mesh castShadow>
        <boxGeometry args={[Math.min(name.length * 0.18 + 0.6, width * 0.55), 0.48, 0.08]} />
        <meshStandardMaterial color={PALETTE.espresso} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[Math.min(name.length * 0.18 + 0.45, width * 0.52), 0.34, 0.02]} />
        <meshStandardMaterial color="#241810" emissive={PALETTE.ember} emissiveIntensity={0.08} />
      </mesh>
      <Text position={[0, 0.02, 0.08]} fontSize={0.22} color={PALETTE.foam} anchorX="center" anchorY="middle" maxWidth={width * 0.5}>
        {name}
      </Text>
    </group>
  );
}

function FurnitureMesh({ item, highlight = false }: { item: FurnitureItem; highlight?: boolean }) {
  let prop: ReactNode = null;
  switch (item.kind) {
    case "counter":
      prop = <CounterProp item={item} />;
      break;
    case "coffee_machine":
      prop = <EspressoMachine item={item} />;
      break;
    case "table":
      prop = <RoundTable item={item} />;
      break;
    case "chair":
      prop = <CafeChair item={item} />;
      break;
    case "fridge":
      prop = <FridgeProp item={item} />;
      break;
    case "pickup":
      prop = <PickupStation item={item} />;
      break;
    case "decoration":
      prop = <PlantProp item={item} />;
      break;
    default:
      return null;
  }
  if (!highlight) return prop;
  return (
    <group>
      {prop}
      <mesh position={[item.x, 0.04, item.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.78, 32]} />
        <meshStandardMaterial
          color={PALETTE.ember}
          emissive={PALETTE.ember}
          emissiveIntensity={0.85}
          transparent
          opacity={0.7}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}

function CounterProp({ item }: { item: FurnitureItem }) {
  return (
    <group position={[item.x, 0, item.z]} rotation={[0, item.rotation, 0]}>
      {/* Cabinet body */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.8, 0.68]} />
        <meshStandardMaterial color={PALETTE.wood} roughness={0.75} />
      </mesh>
      {/* Toe kick */}
      <mesh position={[0, 0.05, 0.02]} castShadow>
        <boxGeometry args={[2.15, 0.1, 0.62]} />
        <meshStandardMaterial color={PALETTE.wallTrim} roughness={0.85} />
      </mesh>
      {/* Countertop */}
      <mesh position={[0, 0.86, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.3, 0.08, 0.78]} />
        <meshStandardMaterial color={PALETTE.woodTop} roughness={0.45} metalness={0.05} />
      </mesh>
      {/* Front edge band */}
      <mesh position={[0, 0.82, 0.38]} castShadow>
        <boxGeometry args={[2.3, 0.06, 0.04]} />
        <meshStandardMaterial color={PALETTE.crema} roughness={0.5} />
      </mesh>
      {/* Drawer fronts */}
      {[-0.65, 0, 0.65].map((x) => (
        <mesh key={x} position={[x, 0.45, 0.35]} castShadow>
          <boxGeometry args={[0.55, 0.35, 0.03]} />
          <meshStandardMaterial color={PALETTE.woodDark} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function EspressoMachine({ item }: { item: FurnitureItem }) {
  const steamRef = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!steamRef.current) return;
    const t = clock.elapsedTime;
    steamRef.current.position.y = 0.72 + Math.sin(t * 1.6) * 0.04;
    steamRef.current.scale.setScalar(0.92 + Math.sin(t * 2.1) * 0.08);
  });

  return (
    <group position={[item.x, 0, item.z]} rotation={[0, item.rotation, 0]}>
      {/* Base */}
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.72, 0.24, 0.52]} />
        <meshStandardMaterial color={PALETTE.metal} metalness={0.55} roughness={0.35} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.62, 0.62, 0.45]} />
        <meshStandardMaterial color={PALETTE.metal} metalness={0.65} roughness={0.28} />
      </mesh>
      {/* Group head */}
      <mesh position={[0, 0.42, 0.28]} castShadow>
        <boxGeometry args={[0.28, 0.14, 0.16]} />
        <meshStandardMaterial color={PALETTE.metalLite} metalness={0.7} roughness={0.25} />
      </mesh>
      {/* Portafilter handle */}
      <mesh position={[0, 0.38, 0.42]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.22, 8]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Cup under spout */}
      <mesh position={[0, 0.22, 0.28]} castShadow>
        <cylinderGeometry args={[0.06, 0.05, 0.1, 10]} />
        <meshStandardMaterial color={PALETTE.foam} roughness={0.6} />
      </mesh>
      {/* Steam wand */}
      <mesh position={[0.22, 0.45, 0.2]} rotation={[0.4, 0, 0.3]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.28, 6]} />
        <meshStandardMaterial color={PALETTE.metalLite} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Top hopper */}
      <mesh position={[0, 0.95, -0.05]} castShadow>
        <cylinderGeometry args={[0.12, 0.14, 0.22, 10]} />
        <meshStandardMaterial color="#2c2c2e" metalness={0.4} roughness={0.4} />
      </mesh>
      {/* Status lamp */}
      <mesh position={[0.2, 0.78, 0.2]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color={PALETTE.ember} emissive={PALETTE.ember} emissiveIntensity={0.9} />
      </mesh>
      <pointLight position={[0.15, 0.85, 0.25]} intensity={0.35} color={PALETTE.ember} distance={2.5} decay={2} />

      {/* Subtle steam near wand + cup (low particle count) */}
      <group ref={steamRef} position={[0.18, 0.72, 0.22]}>
        <Sparkles count={10} scale={[0.22, 0.4, 0.18]} size={1.8} speed={0.45} opacity={0.4} color="#f3ebe2" />
      </group>
      <Sparkles
        count={6}
        scale={[0.14, 0.28, 0.14]}
        size={1.4}
        speed={0.35}
        opacity={0.28}
        color="#e8dcc8"
        position={[0, 0.38, 0.28]}
      />
    </group>
  );
}

function RoundTable({ item }: { item: FurnitureItem }) {
  return (
    <group position={[item.x, 0, item.z]} rotation={[0, item.rotation, 0]}>
      <mesh position={[0, 0.68, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.06, 24]} />
        <meshStandardMaterial color={PALETTE.woodTop} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 0.62, 8]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.28, 0.3, 0.05, 16]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={0.75} />
      </mesh>
    </group>
  );
}

function CafeChair({ item }: { item: FurnitureItem }) {
  return (
    <group position={[item.x, 0, item.z]} rotation={[0, item.rotation, 0]}>
      {/* Seat */}
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.42, 0.06, 0.42]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={0.7} />
      </mesh>
      {/* Back */}
      <mesh position={[0, 0.72, -0.18]} castShadow>
        <boxGeometry args={[0.4, 0.55, 0.05]} />
        <meshStandardMaterial color={PALETTE.wood} roughness={0.7} />
      </mesh>
      {/* Legs */}
      {[
        [-0.16, -0.16],
        [0.16, -0.16],
        [-0.16, 0.16],
        [0.16, 0.16],
      ].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.2, lz]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.4, 6]} />
          <meshStandardMaterial color="#3a2a20" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function FridgeProp({ item }: { item: FurnitureItem }) {
  return (
    <group position={[item.x, 0, item.z]} rotation={[0, item.rotation, 0]}>
      <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.78, 1.7, 0.68]} />
        <meshStandardMaterial color={PALETTE.fridge} metalness={0.35} roughness={0.4} />
      </mesh>
      {/* Door seam */}
      <mesh position={[0, 0.85, 0.35]}>
        <boxGeometry args={[0.72, 1.55, 0.02]} />
        <meshStandardMaterial color="#b8c0c8" metalness={0.3} roughness={0.45} />
      </mesh>
      {/* Handle */}
      <mesh position={[0.28, 0.9, 0.38]} castShadow>
        <boxGeometry args={[0.04, 0.35, 0.04]} />
        <meshStandardMaterial color="#4a5058" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Cool glow strip */}
      <mesh position={[0, 0.85, 0.36]}>
        <boxGeometry args={[0.55, 0.08, 0.01]} />
        <meshStandardMaterial color="#cfe0f0" emissive="#8ab0d0" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

function PickupStation({ item }: { item: FurnitureItem }) {
  return (
    <group position={[item.x, 0, item.z]} rotation={[0, item.rotation, 0]}>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.8, 0.55]} />
        <meshStandardMaterial color={PALETTE.wood} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.84, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.08, 0.62]} />
        <meshStandardMaterial color={PALETTE.woodTop} roughness={0.45} />
      </mesh>
      {/* Pickup shelf ledge */}
      <mesh position={[0, 1.05, 0.08]} castShadow>
        <boxGeometry args={[1.2, 0.04, 0.35]} />
        <meshStandardMaterial color={PALETTE.crema} roughness={0.55} />
      </mesh>
      {/* Cup markers */}
      {[-0.35, 0, 0.35].map((x) => (
        <mesh key={x} position={[x, 1.12, 0.08]}>
          <cylinderGeometry args={[0.07, 0.06, 0.1, 10]} />
          <meshStandardMaterial color={PALETTE.espresso} roughness={0.6} />
        </mesh>
      ))}
      <Text position={[0, 1.35, 0.2]} fontSize={0.1} color={PALETTE.foam} anchorX="center">
        PICKUP
      </Text>
    </group>
  );
}

function PlantProp({ item }: { item: FurnitureItem }) {
  return (
    <group position={[item.x, 0, item.z]} rotation={[0, item.rotation, 0]}>
      {/* Pot */}
      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.13, 0.32, 10]} />
        <meshStandardMaterial color="#6b4f3a" roughness={0.85} />
      </mesh>
      {/* Soil */}
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.04, 10]} />
        <meshStandardMaterial color="#2a1c14" roughness={1} />
      </mesh>
      {/* Foliage */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshStandardMaterial color={PALETTE.leaf} roughness={0.8} />
      </mesh>
      <mesh position={[0.12, 0.65, 0.05]} castShadow>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial color={PALETTE.leafBright} roughness={0.75} />
      </mesh>
      <mesh position={[-0.1, 0.62, -0.08]} castShadow>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshStandardMaterial color="#4a7a5c" roughness={0.8} />
      </mesh>
    </group>
  );
}

function personaColor(persona: Customer["persona"]): string {
  switch (persona) {
    case "student":
      return PALETTE.leafBright;
    case "office":
      return "#3d5a80";
    default:
      return PALETTE.crema;
  }
}

function CustomerMesh({ customer }: { customer: Customer }) {
  const angry = customer.state === "angry" || customer.patience < 20;
  const waiting = customer.state === "waiting" || customer.state === "ordering" || customer.state === "queue";
  const body = angry ? PALETTE.angry : personaColor(customer.persona);
  const bob = useRef<Group>(null);
  const orderLabel = customer.order ?? customer.preference;

  useFrame(({ clock }) => {
    if (!bob.current) return;
    const t = clock.elapsedTime;
    const phase = customer.x * 2.3 + customer.z;
    if (customer.state === "entering" || customer.state === "leaving") {
      bob.current.position.y = Math.abs(Math.sin(t * 6 + phase)) * 0.04;
    } else {
      // Slight idle bob — staggered per customer, cheap sin only
      bob.current.position.y = Math.sin(t * 1.35 + phase) * 0.018;
    }
  });

  return (
    <group position={[customer.x, 0, customer.z]}>
      <group ref={bob}>
        {/* Body */}
        <mesh position={[0, 0.82, 0]} castShadow>
          <capsuleGeometry args={[0.2, 0.72, 4, 10]} />
          <meshStandardMaterial color={body} roughness={0.65} />
        </mesh>
        {/* Shoulders hint */}
        <mesh position={[0, 1.15, 0]} castShadow>
          <capsuleGeometry args={[0.24, 0.08, 3, 8]} />
          <meshStandardMaterial color={body} roughness={0.65} />
        </mesh>
        {/* Head */}
        <mesh position={[0, 1.48, 0]} castShadow>
          <sphereGeometry args={[0.17, 12, 12]} />
          <meshStandardMaterial color="#e8d5c4" roughness={0.7} />
        </mesh>
        {/* Simple hair cap */}
        <mesh position={[0, 1.58, -0.02]}>
          <sphereGeometry args={[0.15, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color={customer.persona === "office" ? "#2a2430" : customer.persona === "student" ? "#4a3428" : "#5c4030"}
            roughness={0.85}
          />
        </mesh>
      </group>

      {waiting && (
        <group position={[0, 1.95, 0]}>
          <mesh>
            <boxGeometry args={[0.28, 0.22, 0.02]} />
            <meshStandardMaterial color={PALETTE.espresso} emissive={PALETTE.ember} emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[0, 0.02, 0.02]}>
            <cylinderGeometry args={[0.05, 0.04, 0.08, 8]} />
            <meshStandardMaterial color={PALETTE.crema} />
          </mesh>
          {orderLabel ? (
            <Text
              position={[0, 0.32, 0]}
              fontSize={0.11}
              color={PALETTE.foam}
              anchorX="center"
              anchorY="middle"
              maxWidth={1.4}
              outlineWidth={0.014}
              outlineColor={PALETTE.espresso}
            >
              {orderLabel}
            </Text>
          ) : null}
        </group>
      )}
    </group>
  );
}

function PlayerMesh({
  player,
  isYou,
  hideBody = false,
}: {
  player: PlayerState;
  isYou: boolean;
  hideBody?: boolean;
}) {
  if (hideBody) return null;

  return (
    <group position={[player.x, 0, player.z]}>
      {/* Distinct taller silhouette */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <capsuleGeometry args={[0.24, 0.85, 4, 10]} />
        <meshStandardMaterial
          color={player.color}
          emissive={isYou ? player.color : "#000000"}
          emissiveIntensity={isYou ? 0.22 : 0}
          roughness={0.55}
        />
      </mesh>
      <mesh position={[0, 1.62, 0]} castShadow>
        <sphereGeometry args={[0.19, 12, 12]} />
        <meshStandardMaterial color="#f0e0d0" roughness={0.65} />
      </mesh>
      {/* Collar band */}
      <mesh position={[0, 1.35, 0]}>
        <torusGeometry args={[0.2, 0.035, 6, 16]} />
        <meshStandardMaterial color={PALETTE.foam} roughness={0.6} />
      </mesh>
      {/* Name plate */}
      <mesh position={[0, 2.12, 0]}>
        <boxGeometry args={[Math.max(0.7, player.name.length * 0.09), 0.22, 0.02]} />
        <meshStandardMaterial color={PALETTE.espresso} transparent opacity={0.85} />
      </mesh>
      <Text position={[0, 2.12, 0.02]} fontSize={0.14} color={PALETTE.foam} anchorX="center" anchorY="middle">
        {isYou ? "You" : player.name}
      </Text>
      {player.holding && (
        <mesh position={[0.38, 1.15, 0.22]} castShadow>
          <cylinderGeometry args={[0.07, 0.06, 0.14, 10]} />
          <meshStandardMaterial
            color={player.holding === "coffee" ? "#6b3f24" : PALETTE.foam}
            roughness={0.55}
          />
        </mesh>
      )}
    </group>
  );
}
