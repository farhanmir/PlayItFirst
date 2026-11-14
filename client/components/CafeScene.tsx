import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, OrbitControls, PerspectiveCamera, Sparkles, Text } from "@react-three/drei";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DoubleSide, MathUtils, type Group, type PerspectiveCamera as ThreePerspectiveCamera } from "three";
import type { Customer, FurnitureItem, FurnitureKind, PlayerState, PropertyListing, RoomSnapshot } from "../../shared/types";
import { nearestStation } from "../../shared/stations";
import { placementIssue, snapFloor } from "../../shared/placement";
import { getLook, nudgeLook } from "../lib/look";
import { play } from "../lib/audio";
import { useApp } from "../lib/store";

const STATION_KIND: Record<string, FurnitureItem["kind"]> = {
  counter: "counter",
  machine: "coffee_machine",
  pickup: "pickup",
  fridge: "fridge",
};

const PALETTE = {
  bg: "#c8b7a0",
  fog: "#d9cbb8",
  floor: "#7a563c",
  plank: "#6b4a32",
  plankAlt: "#8a6344",
  wall: "#f0e4d4",
  wallTrim: "#5c4030",
  wood: "#8b5a3c",
  woodDark: "#5c4030",
  woodTop: "#c49a6c",
  crema: "#c4a574",
  foam: "#f3ebe2",
  espresso: "#3b2418",
  leaf: "#3f6b54",
  leafBright: "#5d9a74",
  ember: "#d9773f",
  metal: "#3a3a3c",
  metalLite: "#6a6a6e",
  fridge: "#9aa4ae",
  glass: "#d8e8f4",
  sky: "#8ec5e8",
  cityWarm: "#f2c48a",
  cityCool: "#9ec0de",
  rug: "#4a5c48",
  angry: "#c45c4a",
} as const;

export type CafeViewMode = "first" | "third" | "monitor" | "dollhouse";

interface Props {
  snapshot: RoomSnapshot;
  viewMode?: CafeViewMode;
  /** Local Sims-style editor — does not force the room into build phase. */
  buildMode?: boolean;
}

export function CafeScene({ snapshot, viewMode = "monitor", buildMode = false }: Props) {
  const property = snapshot.property!;
  const you = useApp((s) => s.you);
  const conn = useApp((s) => s.conn);
  const buildKind = useApp((s) => s.buildKind);
  const buildRotation = useApp((s) => s.buildRotation);
  const buildMovingId = useApp((s) => s.buildMovingId);
  const [hover, setHover] = useState<{ x: number; z: number } | null>(null);
  const me = snapshot.players.find((p) => p.id === you);
  const mode = viewMode;
  const canFloorPlace =
    !!buildKind &&
    (mode === "monitor" || mode === "dollhouse") &&
    (buildMode || snapshot.phase === "build");

  const placeOnFloor = (x: number, z: number) => {
    if (!canFloorPlace || !buildKind || !conn || !property) return;
    const px = snapFloor(x);
    const pz = snapFloor(z);
    if (placementIssue(property, snapshot.layout?.furniture ?? [], buildKind, px, pz, buildMovingId)) return;
    if (buildMovingId) {
      conn.send({ t: "move_furniture", id: buildMovingId, x: px, z: pz, rotation: buildRotation });
      useApp.getState().set({ buildKind: null, buildMovingId: null });
    } else {
      conn.send({ t: "place_furniture", kind: buildKind as FurnitureKind, x: px, z: pz, rotation: buildRotation });
    }
  };

  return (
    <div className={`cafe-canvas mode-${mode} ${canFloorPlace ? "placing" : ""}`}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance", failIfMajorPerformanceCaveat: false }}
      >
        <color attach="background" args={[PALETTE.bg]} />
        <fog
          attach="fog"
          args={[
            PALETTE.fog,
            mode === "first" ? 16 : mode === "dollhouse" ? 18 : 14,
            mode === "first" ? 48 : mode === "dollhouse" ? 42 : 36,
          ]}
        />

        {/* Warm daylight café — soft sun through the windows */}
        <ambientLight intensity={0.38} color="#fff4e8" />
        <directionalLight
          castShadow
          position={[8, 14, -2]}
          intensity={1.35}
          color="#ffe2b8"
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0004}
          shadow-camera-near={1}
          shadow-camera-far={40}
          shadow-camera-left={-14}
          shadow-camera-right={14}
          shadow-camera-top={14}
          shadow-camera-bottom={-14}
        />
        <directionalLight position={[-5, 7, 4]} intensity={0.28} color="#a8c4e0" />
        <hemisphereLight args={["#fff7ee", "#6b4f3a", 0.55]} />
        <pointLight position={[property.width * 0.35, 2.4, property.depth * 0.4]} intensity={0.45} color="#f0b878" distance={10} decay={2} />
        <pointLight position={[property.width * 0.7, 2.4, property.depth * 0.55]} intensity={0.35} color="#c4a574" distance={9} decay={2} />

        <CameraRig
          mode={mode}
          me={me ? { x: me.x, z: me.z } : null}
          width={property.width}
          depth={property.depth}
        />

        <CafeRoom
          property={property}
          furniture={snapshot.layout?.furniture ?? []}
          cutaway={mode === "dollhouse" || mode === "monitor"}
          overhead={mode !== "first"}
          placeEnabled={canFloorPlace}
          onFloorPlace={placeOnFloor}
          onFloorHover={(x, z) => {
            const nx = snapFloor(x), nz = snapFloor(z);
            setHover((prev) => prev?.x === nx && prev.z === nz ? prev : { x: nx, z: nz });
          }}
          highlightKind={
            you
              ? (() => {
                  const station = nearestStation(snapshot, you);
                  return station ? STATION_KIND[station] : null;
                })()
              : null
          }
        />
        {canFloorPlace && buildKind && hover ? (
          <PlacementGhost snapshot={snapshot} kind={buildKind} x={hover.x} z={hover.z} rotation={buildRotation} movingId={buildMovingId} />
        ) : null}
        {snapshot.customers.map((c) => (
          <CustomerMesh key={c.id} customer={c} />
        ))}
        {snapshot.players.map((p) => (
          <PlayerMesh
            key={p.id}
            player={p}
            isYou={p.id === you}
            hideBody={mode === "first" && p.id === you}
            followLook={p.id === you}
          />
        ))}
      </Canvas>
    </div>
  );
}

/** One stable camera — swapping remounts was killing WebGL on some GPUs. */
function CameraRig({
  mode,
  me,
  width,
  depth,
}: {
  mode: CafeViewMode;
  me: { x: number; z: number } | null;
  width: number;
  depth: number;
}) {
  const camRef = useRef<ThreePerspectiveCamera>(null);
  const controlsRef = useRef<{ enabled: boolean; target: { set: (x: number, y: number, z: number) => void }; update: () => void } | null>(null);
  const smooth = useRef({ x: me?.x ?? width / 2, z: me?.z ?? depth / 2 });
  const { gl } = useThree();
  const playLook = mode === "first" || mode === "third";
  const orbit = mode === "monitor" || mode === "dollhouse";

  useEffect(() => {
    if (!playLook) {
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock();
      return;
    }
    const el = gl.domElement;
    const onClick = () => {
      if (document.pointerLockElement !== el) void el.requestPointerLock();
    };
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      nudgeLook(e.movementX, e.movementY);
    };
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const prev = el as HTMLCanvasElement & { __lookX?: number; __lookY?: number };
      if (prev.__lookX != null && prev.__lookY != null) {
        nudgeLook(t.clientX - prev.__lookX, t.clientY - prev.__lookY, 0.004);
      }
      prev.__lookX = t.clientX;
      prev.__lookY = t.clientY;
    };
    const onTouchEnd = () => {
      const prev = el as HTMLCanvasElement & { __lookX?: number; __lookY?: number };
      prev.__lookX = undefined;
      prev.__lookY = undefined;
    };
    el.addEventListener("click", onClick);
    document.addEventListener("mousemove", onMove);
    el.addEventListener("touchmove", onTouch, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("click", onClick);
      document.removeEventListener("mousemove", onMove);
      el.removeEventListener("touchmove", onTouch);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      if (document.pointerLockElement === el) document.exitPointerLock();
    };
  }, [playLook, gl]);

  useEffect(() => {
    const cam = camRef.current;
    if (!cam) return;
    if (mode === "dollhouse") {
      cam.fov = 38;
      cam.position.set(width / 2 + 2, 16, depth / 2 + 10);
      cam.near = 0.1;
      cam.far = 80;
      cam.updateProjectionMatrix();
      controlsRef.current?.target.set(width / 2, 0.2, depth / 2);
    } else if (mode === "monitor") {
      cam.fov = 42;
      cam.position.set(width / 2, 11, depth + 8);
      cam.near = 0.1;
      cam.far = 70;
      cam.updateProjectionMatrix();
      controlsRef.current?.target.set(width / 2, 0.4, depth / 2);
    } else if (mode === "first") {
      cam.fov = 72;
      cam.near = 0.08;
      cam.far = 70;
      cam.updateProjectionMatrix();
    } else {
      cam.fov = 62;
      cam.near = 0.1;
      cam.far = 70;
      cam.updateProjectionMatrix();
    }
  }, [mode, width, depth]);

  useFrame((_, dt) => {
    const cam = camRef.current;
    if (!cam) return;
    if (controlsRef.current) controlsRef.current.enabled = orbit;

    if ((mode === "first" || mode === "third") && me) {
      const k = 1 - Math.exp(-(mode === "first" ? 14 : 10) * dt);
      smooth.current.x = MathUtils.lerp(smooth.current.x, me.x, k);
      smooth.current.z = MathUtils.lerp(smooth.current.z, me.z, k);
      const { yaw, pitch } = getLook();
      if (mode === "first") {
        cam.position.set(smooth.current.x, 1.55, smooth.current.z);
        cam.rotation.order = "YXZ";
        cam.rotation.y = yaw;
        cam.rotation.x = pitch;
        cam.rotation.z = 0;
      } else {
        // Elevated follow cam, clamped inside the room so we never stare at exterior walls.
        const dist = 6.4;
        const height = 4.6 - Math.sin(pitch) * 1.2;
        let cx = smooth.current.x - Math.sin(yaw) * dist;
        let cz = smooth.current.z + Math.cos(yaw) * dist;
        cx = MathUtils.clamp(cx, 1.4, Math.max(1.6, width - 1.4));
        cz = MathUtils.clamp(cz, 1.4, Math.max(1.6, depth - 1.4));
        cam.position.set(cx, Math.max(2.4, height), cz);
        cam.lookAt(smooth.current.x, 1.05, smooth.current.z);
      }
    }
  });

  return (
    <>
      <PerspectiveCamera ref={camRef} makeDefault position={[width / 2, 11, depth + 8]} fov={42} />
      <OrbitControls
        ref={controlsRef as never}
        enabled={orbit}
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={mode === "dollhouse" ? Math.PI / 2.4 : Math.PI / 2.15}
        minPolarAngle={mode === "dollhouse" ? 0.15 : 0}
        minDistance={mode === "dollhouse" ? 8 : 6}
        maxDistance={mode === "dollhouse" ? 36 : 28}
        target={[width / 2, 0.4, depth / 2]}
      />
    </>
  );
}

function CafeRoom({
  property,
  furniture,
  cutaway = false,
  overhead = false,
  highlightKind,
  placeEnabled = false,
  onFloorPlace,
  onFloorHover,
}: {
  property: PropertyListing;
  furniture: FurnitureItem[];
  cutaway?: boolean;
  overhead?: boolean;
  highlightKind?: FurnitureItem["kind"] | null;
  placeEnabled?: boolean;
  onFloorPlace?: (x: number, z: number) => void;
  onFloorHover?: (x: number, z: number) => void;
}) {
  const w = property.width;
  const d = property.depth;
  const plankCount = Math.min(Math.floor(w * 2), 28);

  return (
    <group>
      {/* Floor base — clickable for build placement */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[w / 2, 0, d / 2]}
        receiveShadow
        onPointerMove={(e) => { if (placeEnabled) onFloorHover?.(e.point.x, e.point.z); }}
        onClick={(e) => {
          if (!placeEnabled || !onFloorPlace) return;
          e.stopPropagation();
          onFloorPlace(e.point.x, e.point.z);
        }}
        onPointerOver={(e) => {
          if (!placeEnabled) return;
          e.stopPropagation();
          document.body.style.cursor = "crosshair";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <planeGeometry args={[w + 0.4, d + 0.4]} />
        <meshStandardMaterial
          color={placeEnabled ? "#6b5040" : PALETTE.floor}
          roughness={0.92}
          emissive={placeEnabled ? PALETTE.ember : "#000000"}
          emissiveIntensity={placeEnabled ? 0.08 : 0}
        />
      </mesh>

      {placeEnabled ? <group>
        {Array.from({ length: Math.floor(w * 2) + 1 }, (_, i) => (
          <mesh key={`gx-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[i / 2, 0.025, d / 2]} raycast={() => null}>
            <planeGeometry args={[0.012, d]} /><meshBasicMaterial color="#bdc5a5" transparent opacity={0.45} depthWrite={false} />
          </mesh>
        ))}
        {Array.from({ length: Math.floor(d * 2) + 1 }, (_, i) => (
          <mesh key={`gz-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[w / 2, 0.026, i / 2]} raycast={() => null}>
            <planeGeometry args={[w, 0.012]} /><meshBasicMaterial color="#bdc5a5" transparent opacity={0.45} depthWrite={false} />
          </mesh>
        ))}
      </group> : null}

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

      {/* Warm plaster walls — listing tone stays as an accent strip, not the whole room */}
      {!cutaway && <Wall length={w} position={[w / 2, 1.45, 0]} color={PALETTE.wall} />}
      {!cutaway && <Wall length={w} position={[w / 2, 1.45, d]} color={PALETTE.wall} />}
      <Wall length={d} position={[0, 1.45, d / 2]} rotation={Math.PI / 2} color={PALETTE.wall} />
      <Wall length={d} position={[w, 1.45, d / 2]} rotation={Math.PI / 2} color={PALETTE.wall} />
      {/* Sage wainscoting and hand-lettered café identity. */}
      <mesh position={[0.12, 0.5, d / 2]} receiveShadow>
        <boxGeometry args={[0.04, 1, d - 0.25]} /><meshStandardMaterial color="#6b8068" roughness={0.9} />
      </mesh>
      {Array.from({ length: Math.floor(d) }).map((_, i) => (
        <mesh key={`panel-${i}`} position={[0.15, 0.5, i + 0.5]}>
          <boxGeometry args={[0.03, 0.9, 0.035]} /><meshStandardMaterial color="#9aa58a" roughness={0.9} />
        </mesh>
      ))}
      <group position={[0.17, 2, 5.3]} rotation={[0, Math.PI / 2, 0]}>
        <Text fontSize={0.35} color="#49644d" anchorX="center">SoftOpen</Text>
        <Text position={[0, -0.32, 0]} fontSize={0.105} letterSpacing={0.12} color="#77654e">SLOW MORNINGS · GOOD COFFEE</Text>
      </group>
      <mesh position={[w / 2, 2.35, d - 0.12]}>
        <boxGeometry args={[Math.min(w * 0.55, 6), 0.18, 0.05]} />
        <meshStandardMaterial color={property.imageTone || PALETTE.wood} roughness={0.8} />
      </mesh>

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

      {/* Soft ceiling — faces downward so overhead cameras still see the floor */}
      {!cutaway && (
        <mesh position={[w / 2, 3.05, d / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w + 0.6, d + 0.6]} />
          <meshStandardMaterial color="#e8dcc8" roughness={0.95} />
        </mesh>
      )}

      {/* Ceiling beam + pendant lamps */}
      {!overhead && <mesh position={[w / 2, 2.85, d / 2]} castShadow>
        <boxGeometry args={[w * 0.7, 0.08, 0.18]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={0.8} />
      </mesh>}
      {!overhead && <mesh position={[w / 2, 2.85, d * 0.28]} castShadow>
        <boxGeometry args={[w * 0.55, 0.06, 0.14]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={0.8} />
      </mesh>}
      <PendantLight position={[w * 0.28, 2.55, d * 0.35]} />
      <PendantLight position={[w * 0.55, 2.55, d * 0.45]} />
      <PendantLight position={[w * 0.78, 2.55, d * 0.32]} />

      {/* Menu board on back wall */}
      <MenuBoard position={[w * 0.18, 1.85, d - 0.2]} />

      {/* Cup shelf + set dressing so the room feels stocked */}
      <CupShelf position={[w * 0.72, 1.55, d - 0.28]} />
      <PastryCase position={[3.4, 0, 3.35]} />
      <WallArt position={[w * 0.48, 1.7, 0.14]} />
      <FloorRunner width={w} depth={d} />

      {/* Property signage */}
      <PropertySign name={property.name} width={w} />

      {furniture.map((f) => (
        <FurnitureMesh key={f.id} item={f} highlight={highlightKind === f.kind} />
      ))}
    </group>
  );
}

function PlacementGhost({ snapshot, kind, x, z, rotation, movingId }: {
  snapshot: RoomSnapshot; kind: FurnitureKind; x: number; z: number; rotation: number; movingId: string | null;
}) {
  const issue = placementIssue(snapshot.property!, snapshot.layout?.furniture ?? [], kind, x, z, movingId);
  const color = issue ? "#e88778" : "#a9dcb2";
  const size: [number, number, number] = kind === "counter" ? [2.2, 0.95, 0.8]
    : kind === "pickup" ? [1.5, 0.9, 0.65] : kind === "fridge" ? [0.8, 1.7, 0.7]
    : kind === "table" ? [1.1, 0.7, 1.1] : [0.65, 0.85, 0.65];
  return (
    <group position={[x, 0.04, z]} rotation={[0, rotation, 0]}>
      <mesh position={[0, size[1] / 2, 0]} raycast={() => null}>
        <boxGeometry args={size} />
        <meshBasicMaterial color={color} transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <ringGeometry args={[0.48, 0.55, 32]} />
        <meshBasicMaterial color={color} side={DoubleSide} />
      </mesh>
      <Billboard position={[0, size[1] + 0.35, 0]}>
        <Text fontSize={0.18} color={color} outlineWidth={0.015} outlineColor="#26362c">
          {issue ?? (movingId ? "Click to move · no charge" : "Click to place")}
        </Text>
      </Billboard>
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
            <mesh position={[0, 0, 0.11]}>
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
            {/* Exterior daylight + soft sky */}
            <mesh position={[0, 0, 0.08]}>
              <planeGeometry args={[paneW * 0.92, 1.05]} />
              <meshStandardMaterial
                color={PALETTE.sky}
                emissive={i % 2 === 0 ? PALETTE.cityWarm : PALETTE.cityCool}
                emissiveIntensity={0.42}
                transparent
                opacity={0.92}
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
      {/* POS terminal */}
      <mesh position={[-0.75, 1.05, -0.05]} castShadow>
        <boxGeometry args={[0.28, 0.32, 0.08]} />
        <meshStandardMaterial color="#1c1c1e" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[-0.75, 1.05, 0.01]}>
        <boxGeometry args={[0.22, 0.24, 0.01]} />
        <meshStandardMaterial color="#8ec5e8" emissive="#3a6a90" emissiveIntensity={0.45} />
      </mesh>
      {/* Tip jar + stacked cups */}
      <mesh position={[0.85, 0.98, 0.1]} castShadow>
        <cylinderGeometry args={[0.08, 0.07, 0.16, 10]} />
        <meshStandardMaterial color={PALETTE.glass} transparent opacity={0.45} roughness={0.15} />
      </mesh>
      {[-0.2, 0, 0.2].map((x, i) => (
        <mesh key={x} position={[0.35 + x * 0.05, 0.96 + i * 0.02, -0.15]} castShadow>
          <cylinderGeometry args={[0.055, 0.045, 0.09, 10]} />
          <meshStandardMaterial color={i % 2 ? PALETTE.foam : "#e8d8c8"} roughness={0.55} />
        </mesh>
      ))}
      <Text position={[0, 1.22, 0.42]} rotation={[0, Math.PI, 0]} fontSize={0.11} color={PALETTE.foam} anchorX="center">
        ORDER HERE
      </Text>
    </group>
  );
}

function CupShelf({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[1.5, 0.9, 0.22]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={0.8} />
      </mesh>
      {[0.15, -0.15].map((y) => (
        <mesh key={y} position={[0, y, 0.02]} castShadow>
          <boxGeometry args={[1.35, 0.04, 0.18]} />
          <meshStandardMaterial color={PALETTE.wood} roughness={0.75} />
        </mesh>
      ))}
      {[-0.5, -0.25, 0, 0.25, 0.5].map((x, i) => (
        <mesh key={x} position={[x, 0.28, 0.04]} castShadow>
          <cylinderGeometry args={[0.06, 0.05, 0.12, 10]} />
          <meshStandardMaterial color={i % 2 ? PALETTE.foam : "#d9c4a8"} roughness={0.55} />
        </mesh>
      ))}
      {[-0.4, -0.1, 0.2, 0.45].map((x) => (
        <mesh key={`b-${x}`} position={[x, -0.02, 0.04]} castShadow>
          <cylinderGeometry args={[0.055, 0.045, 0.11, 10]} />
          <meshStandardMaterial color={PALETTE.espresso} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function PastryCase({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.95, 0.7, 0.55]} />
        <meshStandardMaterial color={PALETTE.wood} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[0.9, 0.42, 0.5]} />
        <meshStandardMaterial color={PALETTE.glass} transparent opacity={0.35} roughness={0.2} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow>
        <boxGeometry args={[0.75, 0.04, 0.35]} />
        <meshStandardMaterial color={PALETTE.crema} roughness={0.6} />
      </mesh>
      {[-0.2, 0.05, 0.25].map((x, i) => (
        <mesh key={x} position={[x, 0.78, 0]} castShadow>
          <sphereGeometry args={[0.07 + (i % 2) * 0.015, 10, 10]} />
          <meshStandardMaterial color={i === 1 ? "#c4784a" : "#e8c9a0"} roughness={0.7} />
        </mesh>
      ))}
      <Text position={[0, 1.15, 0.28]} rotation={[0, Math.PI, 0]} fontSize={0.09} color={PALETTE.foam} anchorX="center">
        Pastries
      </Text>
    </group>
  );
}

function WallArt({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.85, 0.6, 0.04]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[0.7, 0.45]} />
        <meshStandardMaterial color="#d9b896" emissive="#c49a6c" emissiveIntensity={0.12} />
      </mesh>
    </group>
  );
}

function FloorRunner({ width, depth }: { width: number; depth: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[Math.min(1.8, width * 0.22), 0.012, depth * 0.42]} receiveShadow>
      <planeGeometry args={[Math.min(1.2, width * 0.18), Math.min(depth * 0.55, 5.5)]} />
      <meshStandardMaterial color="#5a4030" roughness={0.95} />
    </mesh>
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
      <mesh position={[0, 0.43, 0]} castShadow receiveShadow>
        <boxGeometry args={[1, 0.86, 0.85]} />
        <meshStandardMaterial color={PALETTE.wood} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.88, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.08, 0.08, 0.92]} />
        <meshStandardMaterial color="#d4c5aa" roughness={0.4} />
      </mesh>
      <group position={[0, 0.94, 0]}>
      {/* Base */}
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.72, 0.24, 0.52]} />
        <meshStandardMaterial color="#c6c3b4" metalness={0.25} roughness={0.35} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.62, 0.62, 0.45]} />
        <meshStandardMaterial color="#7f9c89" metalness={0.2} roughness={0.28} />
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

function CharacterFace({ y = 1.42, office = false }: { y?: number; office?: boolean }) {
  return (
    <group position={[0, y, 0]}>
      {[-0.065, 0.065].map((x) => (
        <group key={x} position={[x, 0.015, 0.164]}>
          <mesh><sphereGeometry args={[0.023, 8, 8]} /><meshStandardMaterial color="#302b29" /></mesh>
          {office ? <mesh><torusGeometry args={[0.048, 0.008, 5, 12]} /><meshStandardMaterial color="#71523b" /></mesh> : null}
        </group>
      ))}
      <mesh position={[0, -0.045, 0.18]}><sphereGeometry args={[0.035, 8, 8]} /><meshStandardMaterial color="#d7a087" /></mesh>
      <mesh position={[0, -0.09, 0.15]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.045, 0.009, 5, 12, Math.PI]} /><meshStandardMaterial color="#9c6553" />
      </mesh>
    </group>
  );
}

function CustomerMesh({ customer }: { customer: Customer }) {
  const angry = customer.state === "angry" || customer.patience < 20;
  const waiting = customer.state === "waiting" || customer.state === "ordering" || customer.state === "queue";
  const moving = customer.state === "entering" || customer.state === "leaving" || customer.state === "queue";
  const body = angry ? PALETTE.angry : personaColor(customer.persona);
  const root = useRef<Group>(null);
  const bob = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const arms = useRef<Group>(null);
  const orderLabel = customer.order ?? customer.preference;
  const target = useRef({ x: customer.x, z: customer.z });
  target.current = { x: customer.x, z: customer.z };

  useFrame(({ clock }, dt) => {
    if (root.current) {
      const k = 1 - Math.exp(-9 * dt);
      const nx = MathUtils.lerp(root.current.position.x, target.current.x, k);
      const nz = MathUtils.lerp(root.current.position.z, target.current.z, k);
      const dx = target.current.x - root.current.position.x;
      const dz = target.current.z - root.current.position.z;
      if (Math.hypot(dx, dz) > 0.02) root.current.rotation.y = Math.atan2(dx, dz);
      root.current.position.x = nx;
      root.current.position.z = nz;
    }
    const t = clock.elapsedTime;
    const phase = customer.x * 2.3 + customer.z;
    if (bob.current) {
      bob.current.position.y = moving ? Math.abs(Math.sin(t * 7 + phase)) * 0.05 : Math.sin(t * 1.35 + phase) * 0.018;
    }
    const swing = moving ? Math.sin(t * 8 + phase) * 0.45 : 0;
    if (leftLeg.current) leftLeg.current.rotation.x = swing;
    if (rightLeg.current) rightLeg.current.rotation.x = -swing;
    if (arms.current) arms.current.rotation.z = Math.sin(t * (moving ? 7 : 1.8) + phase) * (moving ? 0.06 : 0.02);
  });

  return (
    <group ref={root} position={[customer.x, 0, customer.z]}>
      <group ref={bob}>
        <mesh position={[0, 0.95, 0]} castShadow>
          <capsuleGeometry args={[0.22, 0.55, 4, 10]} />
          <meshStandardMaterial color={body} roughness={0.62} />
        </mesh>
        <mesh position={[0, 1.42, 0]} castShadow>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshStandardMaterial color="#f0dcc8" roughness={0.68} />
        </mesh>
        <CharacterFace office={customer.persona === "office"} />
        <group ref={arms} position={[0, 1.06, 0]}>
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.26, 0, 0]} rotation={[0, 0, side * 0.12]}>
              <mesh position={[0, -0.1, 0]} castShadow><capsuleGeometry args={[0.065, 0.3, 3, 8]} /><meshStandardMaterial color={body} /></mesh>
              <mesh position={[0, -0.32, 0.02]} castShadow><sphereGeometry args={[0.067, 8, 8]} /><meshStandardMaterial color="#e5bc9e" /></mesh>
            </group>
          ))}
        </group>
        <mesh position={[0, 1.52, -0.02]}>
          <sphereGeometry args={[0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color={customer.persona === "office" ? "#2a2430" : customer.persona === "student" ? "#4a3428" : "#5c4030"}
            roughness={0.85}
          />
        </mesh>
        <group ref={leftLeg} position={[-0.1, 0.55, 0]}>
          <mesh position={[0, -0.46, 0.05]} castShadow><boxGeometry args={[0.14, 0.1, 0.25]} /><meshStandardMaterial color="#e6d5b8" /></mesh>
          <mesh position={[0, -0.22, 0]} castShadow>
            <capsuleGeometry args={[0.07, 0.28, 3, 8]} />
            <meshStandardMaterial color={PALETTE.espresso} roughness={0.75} />
          </mesh>
        </group>
        <group ref={rightLeg} position={[0.1, 0.55, 0]}>
          <mesh position={[0, -0.46, 0.05]} castShadow><boxGeometry args={[0.14, 0.1, 0.25]} /><meshStandardMaterial color="#e6d5b8" /></mesh>
          <mesh position={[0, -0.22, 0]} castShadow>
            <capsuleGeometry args={[0.07, 0.28, 3, 8]} />
            <meshStandardMaterial color={PALETTE.espresso} roughness={0.75} />
          </mesh>
        </group>
      </group>

      {waiting && (
        <Billboard position={[0, 2.05, 0]}>
          <mesh>
            <boxGeometry args={[Math.max(0.7, orderLabel.length * 0.11), 0.34, 0.04]} />
            <meshStandardMaterial color="#fff8ef" emissive="#f5e6d2" emissiveIntensity={0.35} />
          </mesh>
          <mesh position={[0, -0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.08, 0.12, 4]} />
            <meshStandardMaterial color="#fff8ef" />
          </mesh>
          <Text
            position={[0, 0.02, 0.03]}
            fontSize={0.14}
            color={PALETTE.espresso}
            anchorX="center"
            anchorY="middle"
            maxWidth={1.6}
          >
            {orderLabel}
          </Text>
        </Billboard>
      )}
      {waiting && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.32, 0.4, 24, 1, 0, Math.PI * 2 * Math.min(1, customer.patience / 100)]} />
          <meshStandardMaterial
            color={angry ? PALETTE.angry : PALETTE.leafBright}
            emissive={angry ? PALETTE.angry : PALETTE.leaf}
            emissiveIntensity={0.4}
            side={DoubleSide}
            transparent
            opacity={0.85}
          />
        </mesh>
      )}
    </group>
  );
}

function PlayerMesh({
  player,
  isYou,
  hideBody = false,
  followLook = false,
}: {
  player: PlayerState;
  isYou: boolean;
  hideBody?: boolean;
  followLook?: boolean;
}) {
  const root = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const target = useRef({ x: player.x, z: player.z });
  const last = useRef({ x: player.x, z: player.z });
  target.current = { x: player.x, z: player.z };
  const drink = player.holding?.startsWith("drink:");
  const brewing = player.holding?.startsWith("brewing:");

  useFrame(({ clock }, dt) => {
    if (!root.current) return;
    const k = 1 - Math.exp(-14 * dt);
    const nx = MathUtils.lerp(root.current.position.x, target.current.x, k);
    const nz = MathUtils.lerp(root.current.position.z, target.current.z, k);
    const speed = Math.hypot(nx - last.current.x, nz - last.current.z) / Math.max(dt, 0.001);
    last.current = { x: nx, z: nz };
    root.current.position.x = nx;
    root.current.position.z = nz;
    if (followLook) root.current.rotation.y = Math.PI - getLook().yaw;
    const swing = speed > 0.4 ? Math.sin(clock.elapsedTime * 9) * 0.5 : 0;
    if (leftLeg.current) leftLeg.current.rotation.x = swing;
    if (rightLeg.current) rightLeg.current.rotation.x = -swing;
  });

  if (hideBody) {
    return drink || brewing ? (
      <group ref={root} position={[player.x, 0, player.z]}>
        <HeldCup drink={!!drink} brewing={!!brewing} firstPerson />
      </group>
    ) : null;
  }

  return (
    <group ref={root} position={[player.x, 0, player.z]}>
      <mesh position={[0, 1.05, 0]} castShadow>
        <capsuleGeometry args={[0.24, 0.7, 4, 10]} />
        <meshStandardMaterial
          color={player.color}
          emissive={isYou ? player.color : "#000000"}
          emissiveIntensity={isYou ? 0.18 : 0}
          roughness={0.55}
        />
      </mesh>
      {/* Apron */}
      <mesh position={[0, 0.95, 0.14]} castShadow>
        <boxGeometry args={[0.38, 0.55, 0.06]} />
        <meshStandardMaterial color={PALETTE.foam} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.62, 0]} castShadow>
        <sphereGeometry args={[0.19, 12, 12]} />
        <meshStandardMaterial color="#f0e0d0" roughness={0.65} />
      </mesh>
      <CharacterFace y={1.62} />
      <mesh position={[0, 1.02, 0.193]}><boxGeometry args={[0.23, 0.15, 0.018]} /><meshStandardMaterial color="#c6bca1" /></mesh>
      {[-0.12, 0.12].map((x) => <mesh key={x} position={[x, 1.28, 0.155]}><boxGeometry args={[0.045, 0.23, 0.02]} /><meshStandardMaterial color={PALETTE.foam} /></mesh>)}
      <mesh position={[0, 1.72, -0.02]}>
        <sphereGeometry args={[0.17, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#3a2a22" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.35, 0]}>
        <torusGeometry args={[0.2, 0.035, 6, 16]} />
        <meshStandardMaterial color={PALETTE.foam} roughness={0.6} />
      </mesh>
      {/* Arms */}
      <mesh position={[-0.32, 1.05, 0.05]} rotation={[0.2, 0, 0.35]} castShadow>
        <capsuleGeometry args={[0.07, 0.28, 3, 8]} />
        <meshStandardMaterial color={player.color} roughness={0.6} />
      </mesh>
      <mesh position={[0.32, 1.05, 0.05]} rotation={[0.2, 0, -0.35]} castShadow>
        <capsuleGeometry args={[0.07, 0.28, 3, 8]} />
        <meshStandardMaterial color={player.color} roughness={0.6} />
      </mesh>
      <group ref={leftLeg} position={[-0.12, 0.55, 0]}>
        <mesh position={[0, -0.24, 0]} castShadow>
          <capsuleGeometry args={[0.08, 0.32, 3, 8]} />
          <meshStandardMaterial color="#2f241c" roughness={0.8} />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.12, 0.55, 0]}>
        <mesh position={[0, -0.24, 0]} castShadow>
          <capsuleGeometry args={[0.08, 0.32, 3, 8]} />
          <meshStandardMaterial color="#2f241c" roughness={0.8} />
        </mesh>
      </group>
      {!isYou && <Billboard position={[0, 2.12, 0]}>
      <mesh>
        <boxGeometry args={[Math.max(0.7, player.name.length * 0.09), 0.22, 0.02]} />
        <meshStandardMaterial color={PALETTE.espresso} transparent opacity={0.85} />
      </mesh>
      <Text position={[0, 0, 0.02]} fontSize={0.14} color={PALETTE.foam} anchorX="center" anchorY="middle">
        {player.name}
      </Text>
      </Billboard>}
      {(player.holding || drink || brewing) && <HeldCup drink={!!drink} brewing={!!brewing} />}
    </group>
  );
}

function HeldCup({ drink, brewing, firstPerson = false }: { drink: boolean; brewing: boolean; firstPerson?: boolean }) {
  const steam = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!steam.current) return;
    steam.current.position.y = 0.2 + Math.sin(clock.elapsedTime * 3) * 0.03;
  });
  return (
    <group position={firstPerson ? [0.35, 1.15, -0.45] : [0.38, 1.15, 0.22]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.07, 0.06, 0.14, 10]} />
        <meshStandardMaterial color={PALETTE.foam} roughness={0.5} />
      </mesh>
      <mesh position={[0.075, 0, 0]}><torusGeometry args={[0.045, 0.012, 6, 12]} /><meshStandardMaterial color={PALETTE.foam} /></mesh>
      <mesh position={[0, 0.072, 0]}><cylinderGeometry args={[0.06, 0.06, 0.005, 16]} /><meshStandardMaterial color={drink ? PALETTE.crema : PALETTE.espresso} /></mesh>
      {(drink || brewing) && (
        <group ref={steam}>
          <Sparkles count={8} scale={[0.16, 0.28, 0.16]} size={1.5} speed={0.5} opacity={0.45} color="#f8f1e8" />
        </group>
      )}
    </group>
  );
}
