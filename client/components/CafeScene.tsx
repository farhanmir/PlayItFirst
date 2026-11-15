import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, OrbitControls, PerspectiveCamera, RoundedBox, Sparkles, Text } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CanvasTexture, Vector2, RepeatWrapping, SRGBColorSpace, Shape, DoubleSide, MathUtils, type Group, type PerspectiveCamera as ThreePerspectiveCamera } from "three";
import type { Customer, FurnitureItem, FurnitureKind, PlayerState, PropertyListing, RoomSnapshot } from "../../shared/types";
import { nearestStation } from "../../shared/stations";
import { placementIssue, snapFloor } from "../../shared/placement";
import { getLook, nudgeLook } from "../lib/look";
import { createTouchLookTracker } from "../lib/touchLook";
import { play } from "../lib/audio";
import { useApp } from "../lib/store";
import { CafeCharacter } from "./CafeCharacter";
import { MeasuredShell } from "./MeasuredShell";
import { EntranceMarkers } from "./EntranceMarkers";

const STATION_KIND: Record<string, FurnitureItem["kind"]> = {
  counter: "counter",
  machine: "coffee_machine",
  pickup: "pickup",
  fridge: "fridge",
};

const PALETTE = {
  bg: "#aebdb7",
  fog: "#d9dfd4",
  floor: "#7a563c",
  plank: "#6b4a32",
  plankAlt: "#8a6344",
  wall: "#f0e4d4",
  wallTrim: "#5c4030",
  wood: "#173c35",
  woodDark: "#59402f",
  woodTop: "#f6efd8",
  crema: "#e9b765",
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
  const appearances = useRef(new Map<string, number>());
  for (const customer of snapshot.customers) {
    if (!appearances.current.has(customer.id)) appearances.current.set(customer.id, appearances.current.size);
  }
  const serviceLine = snapshot.customers
    .filter((customer) => ["queue", "ordering", "waiting"].includes(customer.state))
    .sort((a, b) => a.joinedAt - b.joinedAt);
  // One readable order in the world; the rail retains the complete queue details.
  // Prioritize this player's ticket so another barista cannot obscure their task.
  const featuredCustomer = serviceLine.find((customer) => customer.ticketHolder === you && customer.state === "waiting")
    ?? serviceLine.find((customer) => customer.state === "ordering")
    ?? serviceLine.find((customer) => customer.state === "waiting")
    ?? serviceLine[0];
  const queuedCustomers = serviceLine.filter((customer) => customer.state !== "waiting");
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
        <ambientLight intensity={0.55} color="#fff4e8" />
        <directionalLight
          castShadow
          position={[8, 14, -2]}
          intensity={2.1}
          color="#ffe2b8"
          shadow-mapSize={[2048, 2048]}
          shadow-normalBias={0.025}
          shadow-radius={3}
          shadow-bias={-0.0004}
          shadow-camera-near={1}
          shadow-camera-far={40}
          shadow-camera-left={-14}
          shadow-camera-right={14}
          shadow-camera-top={14}
          shadow-camera-bottom={-14}
        />
        <directionalLight position={[-5, 7, 4]} intensity={0.28} color="#a8c4e0" />
        <hemisphereLight args={["#fff7ee", "#738477", 0.8]} />
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
        <EntranceMarkers property={property} />
        {canFloorPlace && buildKind && hover ? (
          <PlacementGhost snapshot={snapshot} kind={buildKind} x={hover.x} z={hover.z} rotation={buildRotation} movingId={buildMovingId} />
        ) : null}
        {snapshot.customers.map((c) => (
          <CustomerMesh key={c.id} customer={c} appearance={appearances.current.get(c.id)!} featured={c.id === featuredCustomer?.id}
            yourTicket={c.ticketHolder === you} queuePosition={queuedCustomers.findIndex((customer) => customer.id === c.id) + 1} />
        ))}
        {snapshot.aiBarista && snapshot.aiBarista.x != null && snapshot.aiBarista.z != null && (
          <PlayerMesh
            player={{ id: "__jamie_ai__", name: "Jamie", role: "barista", x: snapshot.aiBarista.x, z: snapshot.aiBarista.z, holding: snapshot.aiBarista.holding, score: 0, color: PALETTE.wood }}
            isYou={false}
            displayStatus={snapshot.aiBarista.status}
          />
        )}
        {snapshot.players.filter((p) => p.connected !== false).map((p) => (
          <PlayerMesh
            key={p.id}
            player={p}
            isYou={p.id === you}
            hideBody={mode === "first" && p.id === you}
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
    let dragging = false;
    const onClick = (event: MouseEvent) => {
      if (document.querySelector("dialog[open]") || (event instanceof PointerEvent && event.pointerType !== "mouse")) return;
      if (document.pointerLockElement !== el && typeof el.requestPointerLock === "function") {
        try { const result = el.requestPointerLock(); result?.catch(() => { /* Drag look remains available. */ }); } catch { /* Browser denied pointer lock. */ }
      }
    };
    const onDragStart = (e: PointerEvent) => { if (e.pointerType === "mouse" && e.button === 0) dragging = true; };
    const onDragEnd = () => { dragging = false; };

    const onMove = (e: MouseEvent) => {
      if (document.hidden || document.querySelector("dialog[open]")) { dragging = false; return; }
      if (document.pointerLockElement !== el && !dragging) return;
      nudgeLook(e.movementX, e.movementY);
    };
    const touchLook = createTouchLookTracker();
    const previousTouchAction = el.style.touchAction;
    el.style.touchAction = "none";
    const onTouchStart = (e: TouchEvent) => {
      if (document.querySelector("dialog[open]")) return;
      if (e.cancelable) e.preventDefault();
      // HUD and movement-pad touches belong to their controls, never the camera.
      const touch = Array.from(e.changedTouches).find((candidate) => candidate.target === el);
      if (touch) touchLook.start(touch);
    };
    const onTouch = (e: TouchEvent) => {
      if (document.hidden || document.querySelector("dialog[open]")) { touchLook.reset(); return; }
      if (e.cancelable) e.preventDefault();
      const delta = touchLook.move(e.touches);
      if (delta) nudgeLook(delta.x, delta.y, 0.004);
    };
    const onTouchEnd = (e: TouchEvent) => touchLook.end(e.changedTouches);
    const resetTouchLook = () => touchLook.reset();
    el.addEventListener("click", onClick);
    el.addEventListener("pointerdown", onDragStart);
    window.addEventListener("pointerup", onDragEnd);
    window.addEventListener("blur", onDragEnd);
    document.addEventListener("mousemove", onMove);
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouch, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    window.addEventListener("blur", resetTouchLook);
    document.addEventListener("visibilitychange", resetTouchLook);
    return () => {
      el.removeEventListener("click", onClick);
      el.removeEventListener("pointerdown", onDragStart);
      window.removeEventListener("pointerup", onDragEnd);
      window.removeEventListener("blur", onDragEnd);
      document.removeEventListener("mousemove", onMove);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouch);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("blur", resetTouchLook);
      document.removeEventListener("visibilitychange", resetTouchLook);
      el.style.touchAction = previousTouchAction;
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
        const dist = 4.6;
        const height = 3.5 - Math.sin(pitch) * 0.9;
        let cx = smooth.current.x + Math.sin(yaw) * dist;
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
  const wood = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext("2d")!;
    let seed = 74;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    ctx.fillStyle = "#68503b";
    ctx.fillRect(0, 0, 1024, 1024);
    for (let row = 0; row < 16; row++) {
      const y = row * 64;
      for (let col = -1; col < 4; col++) {
        const x = col * 384 + (row % 3) * 128;
        const tone = 140 + Math.floor(random() * 25);
        ctx.fillStyle = `rgb(${tone},${tone * 0.77},${tone * 0.53})`;
        ctx.fillRect(x + 1, y + 1, 382, 62);
        for (let grain = 0; grain < 45; grain++) {
          ctx.strokeStyle = `rgba(65,39,18,${0.025 + random() * 0.065})`;
          ctx.beginPath();
          const gy = y + random() * 62;
          ctx.moveTo(x, gy);
          ctx.bezierCurveTo(x + 120, gy - 3, x + 240, gy + 3, x + 384, gy);
          ctx.stroke();
        }
      }
    }
    const texture = new CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(w / 8, d / 8);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }, [w, d]);
  useEffect(() => () => wood.dispose(), [wood]);
  if (property.floorPlan) return <MeasuredCafeRoom property={property} furniture={furniture} overhead={overhead} showRooms={cutaway}
    highlightKind={highlightKind} placeEnabled={placeEnabled} onFloorPlace={onFloorPlace} onFloorHover={onFloorHover} />;

  return (
    <group>
      {/* Floor base — clickable for build placement */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[w / 2, 0, d / 2]}
        receiveShadow
        onPointerMove={(e) => { if (placeEnabled) onFloorHover?.(e.point.x, e.point.z); }}
        onClick={(e) => {
          if (!placeEnabled || !onFloorPlace || e.delta > 4) return;
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

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[w / 2, 0.008, d / 2]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={wood} roughness={0.68} />
      </mesh>

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
      <Wall length={w} position={[w / 2, 1.45, 0]} color={PALETTE.wall} />
      {!cutaway && <Wall length={w} position={[w / 2, 1.45, d]} color={PALETTE.wall} />}
      {/* Fictional demo doors match the simulation's arrival/departure lanes. */}
      {[{ x: 0, low: .6, high: 3.4 }, { x: w, low: .5, high: 1.5 }].map(({ x, low, high }) => <group key={x}>
        <Wall length={low} position={[x, 1.45, low / 2]} rotation={Math.PI / 2} />
        <Wall length={d - high} position={[x, 1.45, (d + high) / 2]} rotation={Math.PI / 2} />
        <mesh position={[x, 2.6, (low + high) / 2]}><boxGeometry args={[.2, .6, high - low]} /><meshStandardMaterial color={PALETTE.wall} roughness={.92} /></mesh>
      </group>)}
      {/* Sage wainscoting and hand-lettered café identity. */}
      {[[.125,.6],[3.4,d-.125]].map(([a,b]) => <mesh key={a} position={[.12,.5,(a+b)/2]} receiveShadow><boxGeometry args={[.04,1,b-a]} /><meshStandardMaterial color="#6b8068" roughness={.9} /></mesh>)}
      {Array.from({ length: Math.floor(d) }).map((_, i) => i + .5 >= .6 && i + .5 <= 3.4 ? null : (
        <mesh key={`panel-${i}`} position={[0.15, 0.5, i + 0.5]}>
          <boxGeometry args={[0.03, 0.9, 0.035]} /><meshStandardMaterial color="#9aa58a" roughness={0.9} />
        </mesh>
      ))}
      <group position={[0.17, 2, 5.3]} rotation={[0, Math.PI / 2, 0]}>
        <Text fontSize={0.35} color="#49644d" anchorX="center">Play It First</Text>
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

      <pointLight position={[0.4, 1.4, 2]} intensity={0.65} color="#f0b878" distance={5} decay={2} />

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
      {!overhead && <PendantLight position={[w * 0.28, 2.55, d * 0.35]} />}
      {!overhead && <PendantLight position={[w * 0.55, 2.55, d * 0.45]} />}
      {!overhead && <PendantLight position={[w * 0.78, 2.55, d * 0.32]} />}

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

function MeasuredCafeRoom({ property, furniture, overhead, showRooms, highlightKind, placeEnabled, onFloorPlace, onFloorHover }: {
  property: PropertyListing; furniture: FurnitureItem[]; overhead: boolean; showRooms: boolean; highlightKind?: FurnitureKind | null;
  placeEnabled: boolean; onFloorPlace?: (x: number, z: number) => void; onFloorHover?: (x: number, z: number) => void;
}) {
  return <MeasuredShell property={property} overhead={overhead} cutaway={showRooms} placeEnabled={placeEnabled}
    onFloorPlace={onFloorPlace} onFloorHover={onFloorHover}>
    {furniture.map((f) => <FurnitureMesh key={f.id} item={f} highlight={highlightKind === f.kind} />)}
  </MeasuredShell>;
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
  const streetscape = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    const sky = ctx.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, "#a9cad0"); sky.addColorStop(1, "#f5e9c9");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = "#fff0c5"; ctx.beginPath(); ctx.arc(780, 90, 35, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 7; i++) {
      const x = i * 165 - 30, y = 115 + (i % 3) * 38;
      ctx.fillStyle = ["#b59a85", "#d0b9a0", "#9caeac"][i % 3];
      ctx.fillRect(x, y, 150, 320);
      ctx.fillStyle = "#697e7e";
      for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) ctx.fillRect(x + 15 + col * 33, y + 25 + row * 55, 18, 30);
      ctx.fillStyle = "#e2d5b9"; ctx.fillRect(x - 3, y - 7, 156, 10);
    }
    ctx.fillStyle = "#c4bea8"; ctx.fillRect(0, 410, 1024, 102);
    for (const x of [100, 475, 900]) {
      ctx.fillStyle = "#756447"; ctx.fillRect(x, 270, 10, 150);
      for (let j = 0; j < 6; j++) {
        ctx.fillStyle = j % 2 ? "#81956d" : "#607d65";
        ctx.beginPath(); ctx.ellipse(x + Math.cos(j * 2) * 32, 270 + Math.sin(j * 2) * 30, 40, 48, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
    return texture;
  }, []);
  useEffect(() => () => streetscape.dispose(), [streetscape]);
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
            {/* Original painted street view gives the windows depth without extra geometry. */}
            <mesh position={[0, 0, 0.08]}>
              <planeGeometry args={[paneW * 0.98, 1.2]} />
              <meshBasicMaterial map={streetscape} />
            </mesh>
            <mesh position={[0, 0, 0.15]}><boxGeometry args={[0.035, 1.2, 0.045]} /><meshStandardMaterial color="#dbcfb5" /></mesh>
            <mesh position={[0, -0.12, 0.15]}><boxGeometry args={[paneW, 0.035, 0.045]} /><meshStandardMaterial color="#dbcfb5" /></mesh>
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
      <RoundedBox position={[0, 0.4, 0]} castShadow receiveShadow args={[2.2, 0.8, 0.68]} radius={0.025} smoothness={2}><meshStandardMaterial color={PALETTE.wood} roughness={0.75} /></RoundedBox>
      {/* Toe kick */}
      <RoundedBox position={[0, 0.05, 0.02]} castShadow args={[2.15, 0.1, 0.62]} radius={0.025} smoothness={2}><meshStandardMaterial color={PALETTE.wallTrim} roughness={0.85} /></RoundedBox>
      {/* Countertop */}
      <RoundedBox position={[0, 0.86, 0]} castShadow receiveShadow args={[2.3, 0.08, 0.78]} radius={0.025} smoothness={2}><meshStandardMaterial color={PALETTE.woodTop} roughness={0.45} metalness={0.05} /></RoundedBox>
      {/* Front edge band */}
      <RoundedBox position={[0, 0.82, 0.38]} castShadow args={[2.3, 0.06, 0.04]} radius={0.025} smoothness={2}><meshStandardMaterial color={PALETTE.crema} roughness={0.5} /></RoundedBox>
      {/* Recessed walnut slats and brass rail give the service island a crafted face. */}
      {Array.from({ length: 18 }, (_, i) => (
        <mesh key={i} position={[-1.02 + i * .12, .43, .35]} castShadow>
          <boxGeometry args={[.055, .63, .032]} />
          <meshStandardMaterial color={PALETTE.woodDark} roughness={.72} />
        </mesh>
      ))}
      <mesh position={[0, .13, .38]}><boxGeometry args={[2.1, .025, .035]} /><meshStandardMaterial color={PALETTE.crema} metalness={.6} roughness={.35} /></mesh>
      {/* POS terminal */}
      <RoundedBox position={[-0.75, 1.05, -0.05]} castShadow args={[0.28, 0.32, 0.08]} radius={0.025} smoothness={2}><meshStandardMaterial color="#1c1c1e" metalness={0.4} roughness={0.4} /></RoundedBox>
      <RoundedBox position={[-0.75, 1.05, 0.01]} args={[0.22, 0.24, 0.01]} radius={0.025} smoothness={2}><meshStandardMaterial color="#8ec5e8" emissive="#3a6a90" emissiveIntensity={0.45} /></RoundedBox>
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
      <Text position={[0, 0.55, 0.382]} fontSize={0.11} color={PALETTE.foam} anchorX="center">
        ORDER HERE
      </Text>
    </group>
  );
}

function CupShelf({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <RoundedBox castShadow args={[1.5, 0.9, 0.22]} radius={0.025} smoothness={2}><meshStandardMaterial color={PALETTE.woodDark} roughness={0.8} /></RoundedBox>
      {[0.15, -0.15].map((y) => (
        <RoundedBox key={y} position={[0, y, 0.02]} castShadow args={[1.35, 0.04, 0.18]} radius={0.025} smoothness={2}><meshStandardMaterial color={PALETTE.wood} roughness={0.75} /></RoundedBox>
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
      <RoundedBox position={[0, 0.35, 0]} castShadow receiveShadow args={[0.95, 0.7, 0.55]} radius={0.025} smoothness={2}><meshStandardMaterial color={PALETTE.wood} roughness={0.75} /></RoundedBox>
      <RoundedBox position={[0, 0.85, 0]} castShadow args={[0.9, 0.42, 0.5]} radius={0.025} smoothness={2}><meshStandardMaterial color={PALETTE.glass} transparent opacity={0.35} roughness={0.2} metalness={0.1} /></RoundedBox>
      <RoundedBox position={[0, 0.72, 0]} castShadow args={[0.75, 0.04, 0.35]} radius={0.025} smoothness={2}><meshStandardMaterial color={PALETTE.crema} roughness={0.6} /></RoundedBox>
      {[-0.2, 0.05, 0.25].map((x, i) => (
        <mesh key={x} position={[x, 0.78, 0]} castShadow>
          <sphereGeometry args={[0.07 + (i % 2) * 0.015, 10, 10]} />
          <meshStandardMaterial color={i === 1 ? "#c4784a" : "#e8c9a0"} roughness={0.7} />
        </mesh>
      ))}
      <Text position={[0, 0.48, 0.29]} fontSize={0.09} color={PALETTE.foam} anchorX="center">
        Pastries
      </Text>
    </group>
  );
}

function WallArt({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <RoundedBox castShadow args={[0.85, 0.6, 0.04]} radius={0.025} smoothness={2}><meshStandardMaterial color={PALETTE.woodDark} roughness={0.8} /></RoundedBox>
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
      <RoundedBox position={[0, 0.43, 0]} castShadow receiveShadow args={[1, 0.86, 0.85]} radius={0.025} smoothness={2}><meshStandardMaterial color={PALETTE.wood} roughness={0.7} /></RoundedBox>
      <RoundedBox position={[0, 0.88, 0]} castShadow receiveShadow args={[1.08, 0.08, 0.92]} radius={0.025} smoothness={2}><meshStandardMaterial color="#d4c5aa" roughness={0.4} /></RoundedBox>
      <group position={[0, 0.94, 0]}>
      {/* Base */}
      <RoundedBox position={[0, 0.12, 0]} castShadow receiveShadow args={[0.72, 0.24, 0.52]} radius={0.025} smoothness={2}><meshStandardMaterial color="#c6c3b4" metalness={0.25} roughness={0.35} /></RoundedBox>
      {/* Body */}
      <RoundedBox position={[0, 0.55, 0]} castShadow args={[0.62, 0.62, 0.45]} radius={0.025} smoothness={2}><meshStandardMaterial color="#7f9c89" metalness={0.2} roughness={0.28} /></RoundedBox>
      {/* Group head */}
      <RoundedBox position={[0, 0.42, 0.28]} castShadow args={[0.28, 0.14, 0.16]} radius={0.025} smoothness={2}><meshStandardMaterial color={PALETTE.metalLite} metalness={0.7} roughness={0.25} /></RoundedBox>
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
      {/* Cup warming rail and porcelain cups; pressure gauge reads as real equipment. */}
      <RoundedBox position={[0, 0.88, 0]} args={[0.66, 0.04, 0.48]} radius={0.015} smoothness={2}><meshStandardMaterial color="#d0ccc0" metalness={0.45} roughness={0.3} /></RoundedBox>
      {[-0.18, 0, 0.18].map((x) => <mesh key={x} position={[x, 0.95, 0]} castShadow><cylinderGeometry args={[0.055, 0.065, 0.1, 12]} /><meshStandardMaterial color="#f1eadb" roughness={0.3} /></mesh>)}
      <mesh position={[-0.12, 0.69, 0.235]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.075, 0.075, 0.025, 24]} /><meshStandardMaterial color="#e8dfc9" metalness={0.1} roughness={0.35} /></mesh>
      <mesh position={[-0.12, 0.7, 0.255]} rotation={[0, 0, -0.6]}><boxGeometry args={[0.008, 0.075, 0.01]} /><meshStandardMaterial color="#333e38" /></mesh>
      {[-0.2, -0.1, 0, 0.1, 0.2].map((x) => <mesh key={x} position={[x, 0.248, 0.12]}><boxGeometry args={[0.015, 0.008, 0.25]} /><meshStandardMaterial color="#595f59" metalness={0.6} roughness={0.35} /></mesh>)}
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
      <RoundedBox position={[0, 0.42, 0]} castShadow receiveShadow args={[0.42, 0.06, 0.42]} radius={0.025} smoothness={2}><meshStandardMaterial color={PALETTE.woodDark} roughness={0.7} /></RoundedBox>
      {/* Back */}
      <RoundedBox position={[0, 0.72, -0.18]} castShadow args={[0.4, 0.55, 0.05]} radius={0.025} smoothness={2}><meshStandardMaterial color={PALETTE.wood} roughness={0.7} /></RoundedBox>
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
      <RoundedBox position={[0, 0.85, 0]} castShadow receiveShadow args={[0.78, 1.7, 0.68]} radius={0.025} smoothness={2}><meshStandardMaterial color={PALETTE.fridge} metalness={0.35} roughness={0.4} /></RoundedBox>
      {/* Door seam */}
      <RoundedBox position={[0, 0.85, 0.35]} args={[0.72, 1.55, 0.02]} radius={0.025} smoothness={2}><meshStandardMaterial color="#b8c0c8" metalness={0.3} roughness={0.45} /></RoundedBox>
      {/* Handle */}
      <RoundedBox position={[0.28, 0.9, 0.38]} castShadow args={[0.04, 0.35, 0.04]} radius={0.025} smoothness={2}><meshStandardMaterial color="#4a5058" metalness={0.7} roughness={0.3} /></RoundedBox>
      {/* Cool glow strip */}
      <RoundedBox position={[0, 0.85, 0.36]} args={[0.55, 0.08, 0.01]} radius={0.025} smoothness={2}><meshStandardMaterial color="#cfe0f0" emissive="#8ab0d0" emissiveIntensity={0.5} /></RoundedBox>
    </group>
  );
}

function PickupStation({ item }: { item: FurnitureItem }) {
  return (
    <group position={[item.x, 0, item.z]} rotation={[0, item.rotation, 0]}>
      <RoundedBox position={[0, 0.4, 0]} castShadow receiveShadow args={[1.4, 0.8, 0.55]} radius={0.025} smoothness={2}><meshStandardMaterial color={PALETTE.wood} roughness={0.75} /></RoundedBox>
      <RoundedBox position={[0, 0.84, 0]} castShadow receiveShadow args={[1.5, 0.08, 0.62]} radius={0.025} smoothness={2}><meshStandardMaterial color={PALETTE.woodTop} roughness={0.45} /></RoundedBox>
      {/* Pickup shelf ledge */}
      <RoundedBox position={[0, 1.05, 0.08]} castShadow args={[1.2, 0.04, 0.35]} radius={0.025} smoothness={2}><meshStandardMaterial color={PALETTE.crema} roughness={0.55} /></RoundedBox>
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
      {/* Broad leaves with stems, rather than three spherical blobs. */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <group key={i} rotation={[0, i * 2.4, 0]}>
        <mesh position={[0.055, 0.49 + i * 0.04, 0]} rotation={[0, 0, -0.22]} castShadow><cylinderGeometry args={[0.009, 0.012, 0.35 + i * 0.035, 5]} /><meshStandardMaterial color="#536341" /></mesh>
        <mesh position={[0.14, 0.62 + i * 0.045, 0]} rotation={[0, 0, -0.65]} scale={[0.65, 1, 0.12]} castShadow><sphereGeometry args={[0.18, 8, 8]} /><meshStandardMaterial color={i % 2 ? PALETTE.leaf : PALETTE.leafBright} roughness={0.8} /></mesh>
      </group>)}
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
          <mesh position={[-0.006, 0.007, 0.02]}><sphereGeometry args={[0.007, 5, 5]} /><meshBasicMaterial color="#fff5df" /></mesh>
          <mesh position={[0, 0.048, -0.006]} rotation={[0, 0, Math.PI / 2 + (x < 0 ? -0.12 : 0.12)]}><capsuleGeometry args={[0.008, 0.035, 2, 5]} /><meshStandardMaterial color="#574034" /></mesh>
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

/** Original toy-like silhouettes; deterministic variation survives reconnects. */
function characterStyle(seed: string) {
  const n = Array.from(seed).reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return { skin: ["#efc9a5", "#c28a65", "#87563e", "#dba57c"][n % 4],
    hair: ["#3a2924", "#654332", "#302b32", "#b57c43"][n % 4], shirt: ["#527c78", "#a9604b", "#697ca2", "#c49b54", "#857298", "#658158"][n % 6], variant: n % 3 };
}

function CharacterHead({ seed, y, office = false }: { seed: string; y: number; office?: boolean }) {
  const { skin, hair, variant } = characterStyle(seed);
  return <group position={[0, y, 0]}>
    <mesh castShadow scale={[1, 1.08, 0.94]}><sphereGeometry args={[0.19, 16, 12]} /><meshStandardMaterial color={skin} roughness={0.8} /></mesh>
    {[-1, 1].map((side) => <group key={side}>
      <mesh position={[side * 0.185, -0.015, 0]} scale={[0.65, 1, 0.75]}><sphereGeometry args={[0.055, 8, 8]} /><meshStandardMaterial color={skin} roughness={0.8} /></mesh>
      <mesh position={[side * 0.115, -0.045, 0.147]} scale={[1, 0.55, 0.18]}><sphereGeometry args={[0.045, 8, 8]} /><meshStandardMaterial color="#ce8c77" roughness={0.9} /></mesh>
    </group>)}
    <CharacterFace y={0} office={office} />
    <mesh position={[0, 0.065, -0.005]} scale={[1.08, 1.12, 1.04]} castShadow><sphereGeometry args={[0.205, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={hair} roughness={0.95} /></mesh>
    {[0, 1, 2].map((i) => <mesh key={i} position={[-0.105 + i * 0.085, 0.12 - i * 0.023, 0.175]} rotation={[0, 0, -0.35]} scale={[1.2, 0.65, 0.65]} castShadow><sphereGeometry args={[0.074, 8, 8]} /><meshStandardMaterial color={hair} roughness={0.95} /></mesh>)}
    {variant === 1 && <mesh position={[0, 0.145, -0.17]} castShadow><sphereGeometry args={[0.105, 10, 8]} /><meshStandardMaterial color={hair} roughness={0.95} /></mesh>}
    {variant === 2 && [-1, 1].map((side) => <mesh key={side} position={[side * 0.16, 0.005, -0.06]} scale={[0.6, 1.3, 1]} castShadow><sphereGeometry args={[0.09, 8, 8]} /><meshStandardMaterial color={hair} roughness={0.95} /></mesh>)}
  </group>;
}

// Tailored shoulder/waist silhouettes, shared across all customers.
const SHIRT_PROFILE = [new Vector2(0, -0.3), new Vector2(0.19, -0.3), new Vector2(0.18, -0.12), new Vector2(0.22, 0.16), new Vector2(0.25, 0.22), new Vector2(0.11, 0.3), new Vector2(0, 0.3)];
const BARISTA_PROFILE = [new Vector2(0, -0.34), new Vector2(0.21, -0.34), new Vector2(0.19, -0.1), new Vector2(0.25, 0.2), new Vector2(0.28, 0.25), new Vector2(0.12, 0.34), new Vector2(0, 0.34)];

function CustomerMesh({ customer, appearance, featured, yourTicket, queuePosition }: {
  appearance: number; customer: Customer; featured: boolean; yourTicket: boolean; queuePosition: number;
}) {
  const angry = customer.state === "angry" || customer.patience < 20;
  const waiting = customer.state === "waiting" || customer.state === "ordering" || customer.state === "queue";
  const body = angry ? PALETTE.angry : characterStyle(customer.id).shirt;
  const { skin } = characterStyle(customer.id);
  const root = useRef<Group>(null);
  const initialPosition = useRef<[number, number, number]>([customer.x, 0, customer.z]);
  const bob = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const arms = useRef<Group>(null);
  const gait = useRef(0);
  const orderLabel = customer.order ?? customer.preference;
  const target = useRef({ x: customer.x, z: customer.z });
  target.current = { x: customer.x, z: customer.z };

  useFrame(({ clock }, dt) => {
    let moving = false;
    if (root.current) {
      const k = 1 - Math.exp(-9 * dt);
      const nx = MathUtils.lerp(root.current.position.x, target.current.x, k);
      const nz = MathUtils.lerp(root.current.position.z, target.current.z, k);
      const dx = target.current.x - root.current.position.x;
      const dz = target.current.z - root.current.position.z;
      moving = Math.hypot(dx, dz) > 0.035;
      if (Math.hypot(dx, dz) > 0.02) {
        const desired = Math.atan2(dx, dz);
        const shortest = Math.atan2(Math.sin(desired - root.current.rotation.y), Math.cos(desired - root.current.rotation.y));
        root.current.rotation.y += shortest * (1 - Math.exp(-12 * dt));
      }
      root.current.position.x = nx;
      root.current.position.z = nz;
    }
    const t = clock.elapsedTime;
    gait.current = MathUtils.damp(gait.current, moving ? 1 : 0, 10, dt);
    const phase = customer.x * 2.3 + customer.z;
    if (bob.current) {
      bob.current.position.y = Math.abs(Math.sin(t * 7 + phase)) * 0.045 * gait.current + Math.sin(t * 1.35 + phase) * 0.012;
    }
    const swing = Math.sin(t * 8 + phase) * 0.45 * gait.current;
    if (leftLeg.current) leftLeg.current.rotation.x = swing;
    if (rightLeg.current) rightLeg.current.rotation.x = -swing;
    if (arms.current) arms.current.rotation.z = Math.sin(t * (moving ? 7 : 1.8) + phase) * (moving ? 0.06 : 0.02);
  });

  return (
    <group ref={root} position={initialPosition.current}>
      <CafeCharacter seed={customer.id} appearance={appearance} fallback={
      <group ref={bob}>
        <mesh position={[0, 0.92, 0]} castShadow>
          <latheGeometry args={[SHIRT_PROFILE, 12]} />
          <meshStandardMaterial color={body} roughness={0.9} />
        </mesh>
        <CharacterHead seed={customer.id} y={1.46} office={customer.persona === "office"} />
        <mesh position={[0, 1.235, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.105, 0.025, 5, 12]} /><meshStandardMaterial color={PALETTE.foam} roughness={0.9} /></mesh>
        {customer.persona === "office" ? [0.82, 0.95, 1.08].map((y) => <mesh key={y} position={[0, y, 0.223]}><sphereGeometry args={[0.017, 6, 6]} /><meshStandardMaterial color="#c9b59a" metalness={0.3} roughness={0.5} /></mesh>) : <mesh position={[0, 0.94, 0.22]}><boxGeometry args={[0.28, 0.055, 0.018]} /><meshStandardMaterial color={PALETTE.foam} roughness={0.9} /></mesh>}
        {customer.persona === "student" && <group position={[0, 0.94, -0.22]}><mesh castShadow><boxGeometry args={[0.31, 0.32, 0.15]} /><meshStandardMaterial color="#b7764a" roughness={0.9} /></mesh><mesh position={[0, -0.045, -0.08]}><boxGeometry args={[0.22, 0.13, 0.025]} /><meshStandardMaterial color="#d6aa75" roughness={0.9} /></mesh></group>}
        <group ref={arms} position={[0, 1.06, 0]}>
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.26, 0, 0]} rotation={[0, 0, side * 0.12]}>
              <mesh position={[0, -0.1, 0]} castShadow><cylinderGeometry args={[0.085, 0.055, 0.36, 8]} /><meshStandardMaterial color={body} /></mesh>
              <mesh position={[0, -0.32, 0.02]} castShadow><sphereGeometry args={[0.067, 8, 8]} /><meshStandardMaterial color={skin} roughness={0.8} /></mesh>
            </group>
          ))}
        </group>
        <group ref={leftLeg} position={[-0.1, 0.55, 0]}>
          <mesh position={[0, -0.46, 0.05]} castShadow><boxGeometry args={[0.14, 0.1, 0.25]} /><meshStandardMaterial color="#e6d5b8" /></mesh>
          <mesh position={[0, -0.22, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.065, 0.4, 8]} />
            <meshStandardMaterial color={PALETTE.espresso} roughness={0.75} />
          </mesh>
        </group>
        <group ref={rightLeg} position={[0.1, 0.55, 0]}>
          <mesh position={[0, -0.46, 0.05]} castShadow><boxGeometry args={[0.14, 0.1, 0.25]} /><meshStandardMaterial color="#e6d5b8" /></mesh>
          <mesh position={[0, -0.22, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.065, 0.4, 8]} />
            <meshStandardMaterial color={PALETTE.espresso} roughness={0.75} />
          </mesh>
        </group>
      </group>
      } />

      {waiting && featured && (
        <Billboard position={[0, 2.12, 0]}>
          <mesh>
            <boxGeometry args={[Math.max(1.05, orderLabel.length * 0.11), 0.48, 0.04]} />
            <meshStandardMaterial color="#fff8ef" emissive="#f5e6d2" emissiveIntensity={0.35} />
          </mesh>
          <Text position={[0, 0.13, 0.03]} fontSize={0.075} letterSpacing={0.07} color={PALETTE.leaf} anchorX="center" anchorY="middle">
            {yourTicket ? "YOUR TICKET" : customer.state === "waiting" ? "IN PROGRESS" : "ORDER HERE"}
          </Text>
          <mesh position={[0, -0.27, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.08, 0.12, 4]} />
            <meshStandardMaterial color="#fff8ef" />
          </mesh>
          <Text
            position={[0, -0.04, 0.03]}
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
      {waiting && !featured && (
        <Billboard position={[0, 1.97, 0]}>
          <mesh><circleGeometry args={[0.105, 16]} /><meshStandardMaterial color={customer.state === "waiting" ? PALETTE.crema : PALETTE.leaf} roughness={0.85} /></mesh>
          <Text position={[0, 0, 0.015]} fontSize={0.115} color={PALETTE.foam} anchorX="center" anchorY="middle">
            {customer.state === "waiting" ? "…" : queuePosition}
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
  displayStatus,
}: {
  player: PlayerState;
  isYou: boolean;
  hideBody?: boolean;
  displayStatus?: string;
}) {
  const root = useRef<Group>(null);
  const initialPosition = useRef<[number, number, number]>([player.x, 0, player.z]);
  const facing = useRef(isYou ? Math.PI + getLook().yaw : 0);
  const initialRotation = useRef<[number, number, number]>([0, facing.current, 0]);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const { skin } = characterStyle(player.id);
  const { camera } = useThree();
  const target = useRef({ x: player.x, z: player.z });
  const last = useRef({ x: player.x, z: player.z });
  target.current = { x: player.x, z: player.z };
  const drink = player.holding?.startsWith("drink:");
  const brewing = player.holding?.startsWith("brewing:");
  const carried = drink ? "drink" : brewing ? "brewing" : player.holding ? "ticket" : null;
  useEffect(() => {
    // A first-person view model uses camera coordinates; reset when restoring the world avatar.
    if (!hideBody && root.current) {
      root.current.position.set(target.current.x, 0, target.current.z);
      last.current = { ...target.current };
      root.current.rotation.set(0, facing.current, 0);
    }
  }, [hideBody]);

  useFrame(({ clock }, dt) => {
    if (!root.current) return;
    if (hideBody) {
      // Camera-relative view model: follows yaw, pitch and the camera's smoothing.
      // The normal avatar faces +Z, but the first-person camera faces local -Z.
      root.current.position.copy(camera.position);
      root.current.quaternion.copy(camera.quaternion);
      return;
    }
    const k = 1 - Math.exp(-14 * dt);
    const nx = MathUtils.lerp(root.current.position.x, target.current.x, k);
    const nz = MathUtils.lerp(root.current.position.z, target.current.z, k);
    const dx = nx - last.current.x, dz = nz - last.current.z;
    const speed = Math.hypot(dx, dz) / Math.max(dt, 0.001);
    last.current = { x: nx, z: nz };
    root.current.position.x = nx;
    root.current.position.z = nz;
    root.current.rotation.x = 0;
    root.current.rotation.z = 0;
    // The walking clip faces +Z. Turn the body toward actual travel, independently
    // of camera yaw, and retain the last heading when movement stops.
    if (speed > .1) {
      const desired = Math.atan2(dx, dz);
      const shortest = Math.atan2(Math.sin(desired - facing.current), Math.cos(desired - facing.current));
      facing.current += shortest * (1 - Math.exp(-12 * dt));
    }
    root.current.rotation.y = facing.current;
    const swing = speed > 0.4 ? Math.sin(clock.elapsedTime * 9) * 0.5 : 0;
    if (leftLeg.current) leftLeg.current.rotation.x = swing;
    if (rightLeg.current) rightLeg.current.rotation.x = -swing;
    if (leftArm.current) leftArm.current.rotation.x = -swing * 0.65;
    if (rightArm.current) rightArm.current.rotation.x = drink || brewing ? -0.65 : swing * 0.65;
  });

  if (hideBody) {
    return drink ? (
      <group ref={root} position={initialPosition.current}>
        <HeldCup drink firstPerson skin={skin} />
      </group>
    ) : null;
  }

  return (
    <group ref={root} name={`player:${player.id}`} position={initialPosition.current} rotation={initialRotation.current}>
      <CafeCharacter seed={player.id} carried={carried} fallback={<group>
      <mesh position={[0, 1.02, 0]} castShadow>
        <latheGeometry args={[BARISTA_PROFILE, 12]} />
        <meshStandardMaterial
          color={player.color}
          roughness={0.9}
        />
      </mesh>
      {/* Apron */}
      <mesh position={[0, 0.95, 0.14]} castShadow>
        <boxGeometry args={[0.38, 0.55, 0.06]} />
        <meshStandardMaterial color={PALETTE.foam} roughness={0.85} />
      </mesh>
      <CharacterHead seed={player.id} y={1.62} />
      <mesh position={[0, 1.02, 0.193]}><boxGeometry args={[0.23, 0.15, 0.018]} /><meshStandardMaterial color="#c6bca1" /></mesh>
      {[-0.12, 0.12].map((x) => <mesh key={x} position={[x, 1.28, 0.155]}><boxGeometry args={[0.045, 0.23, 0.02]} /><meshStandardMaterial color={PALETTE.foam} /></mesh>)}
      <mesh position={[0, 1.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.035, 6, 16]} />
        <meshStandardMaterial color={PALETTE.foam} roughness={0.6} />
      </mesh>
      {/* Arms */}
      {[-1, 1].map((side) => <group key={side} ref={side < 0 ? leftArm : rightArm} position={[side * 0.29, 1.23, 0]}>
        <group rotation={[0, 0, side * 0.12]}>
          <mesh position={[0, -0.16, 0]} castShadow><cylinderGeometry args={[0.095, 0.065, 0.34, 8]} /><meshStandardMaterial color={player.color} roughness={0.9} /></mesh>
          <mesh position={[0, -0.34, 0.02]} castShadow><sphereGeometry args={[0.075, 8, 8]} /><meshStandardMaterial color={skin} roughness={0.8} /></mesh>
          {side > 0 && drink && <group position={[.09, -.34, .02]} rotation={[.65, 0, -.12]}><HeldCup drink /></group>}
        </group>
      </group>)}
      <group ref={leftLeg} position={[-0.12, 0.55, 0]}>
        <mesh position={[0, -0.46, 0.055]} castShadow><boxGeometry args={[0.17, 0.12, 0.28]} /><meshStandardMaterial color="#e4d2b8" roughness={0.9} /></mesh>
        <mesh position={[0, -0.24, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.07, 0.44, 8]} />
          <meshStandardMaterial color="#2f241c" roughness={0.8} />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.12, 0.55, 0]}>
        <mesh position={[0, -0.46, 0.055]} castShadow><boxGeometry args={[0.17, 0.12, 0.28]} /><meshStandardMaterial color="#e4d2b8" roughness={0.9} /></mesh>
        <mesh position={[0, -0.24, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.07, 0.44, 8]} />
          <meshStandardMaterial color="#2f241c" roughness={0.8} />
        </mesh>
      </group>
      </group>} />
      {!isYou && <Billboard position={[0, 2.12, 0]}>
      <mesh>
        <boxGeometry args={[Math.max(0.7, player.name.length * 0.09), 0.22, 0.02]} />
        <meshStandardMaterial color={PALETTE.espresso} transparent opacity={0.85} />
      </mesh>
      <Text position={[0, 0, 0.02]} fontSize={0.14} color={PALETTE.foam} anchorX="center" anchorY="middle">
        {player.name}
      </Text>
      {displayStatus && <Text position={[0, -.23, .02]} fontSize={.1} color={PALETTE.foam} outlineColor={PALETTE.espresso} outlineWidth={.012} anchorX="center" anchorY="middle">{displayStatus}</Text>}
      </Billboard>}
    </group>
  );
}

function HeldCup({ drink, brewing = false, firstPerson = false, skin = "#c58d68" }: { drink: boolean; brewing?: boolean; firstPerson?: boolean; skin?: string }) {
  const steam = useRef<Group>(null);
  const { size } = useThree();
  useFrame(({ clock }) => {
    if (!steam.current) return;
    steam.current.position.y = 0.2 + Math.sin(clock.elapsedTime * 3) * 0.03;
  });
  return (
    <group position={firstPerson ? [Math.min(0.25, 0.14 * size.width / size.height), size.width < size.height ? -0.1 : -0.16, -0.48] : [0, 0, 0]}>
      {firstPerson && <group>
        <mesh position={[.09, -.025, .025]} rotation={[.25, 0, -.25]} renderOrder={100}><capsuleGeometry args={[.026, .055, 4, 8]} /><meshStandardMaterial color={skin} roughness={.85} depthTest={false} depthWrite={false} /></mesh>
        <mesh position={[.125, -.12, .075]} rotation={[-.4, 0, .3]} renderOrder={100}><capsuleGeometry args={[.032, .16, 4, 8]} /><meshStandardMaterial color={skin} roughness={.85} depthTest={false} depthWrite={false} /></mesh>
      </group>}
      <mesh castShadow={!firstPerson} renderOrder={firstPerson ? 100 : 0}>
        <cylinderGeometry args={[0.07, 0.06, 0.14, 10]} />
        <meshStandardMaterial color={PALETTE.foam} roughness={0.5} depthTest={!firstPerson} depthWrite={!firstPerson} />
      </mesh>
      <mesh position={[0.075, 0, 0]} renderOrder={firstPerson ? 100 : 0}><torusGeometry args={[0.045, 0.012, 6, 12]} /><meshStandardMaterial color={PALETTE.foam} depthTest={!firstPerson} depthWrite={!firstPerson} /></mesh>
      <mesh position={[0, 0.072, 0]} renderOrder={firstPerson ? 100 : 0}><cylinderGeometry args={[0.06, 0.06, 0.005, 16]} /><meshStandardMaterial color={drink ? PALETTE.crema : PALETTE.espresso} depthTest={!firstPerson} depthWrite={!firstPerson} /></mesh>
      {(drink || brewing) && (
        <group ref={steam}>
          <Sparkles count={8} scale={[0.16, 0.28, 0.16]} size={1.5} speed={0.5} opacity={0.45} color="#f8f1e8" />
        </group>
      )}
    </group>
  );
}
