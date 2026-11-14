import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Text } from "@react-three/drei";
import { useMemo, useRef } from "react";
import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";
import type { Customer, FurnitureItem, PlayerState, PropertyListing, RoomSnapshot } from "../../shared/types";
import { useApp } from "../lib/store";

interface Props {
  snapshot: RoomSnapshot;
  firstPerson: boolean;
}

export function CafeScene({ snapshot, firstPerson }: Props) {
  const property = snapshot.property!;
  const you = useApp((s) => s.you);
  const me = snapshot.players.find((p) => p.id === you);

  return (
    <div className="cafe-canvas">
      <Canvas shadows dpr={[1, 1.75]}>
        <color attach="background" args={["#1a1511"]} />
        <fog attach="fog" args={["#1a1511", 12, 28]} />
        <ambientLight intensity={0.45} />
        <directionalLight
          castShadow
          position={[8, 12, 6]}
          intensity={1.15}
          shadow-mapSize={[1024, 1024]}
        />
        <hemisphereLight args={["#f3ebe2", "#3b2418", 0.35]} />

        {firstPerson && me ? (
          <FollowCam x={me.x} z={me.z} />
        ) : (
          <>
            <PerspectiveCamera makeDefault position={[property.width / 2, 11, property.depth + 8]} fov={42} />
            <OrbitControls
              target={[property.width / 2, 0, property.depth / 2]}
              maxPolarAngle={Math.PI / 2.15}
              minDistance={6}
              maxDistance={28}
            />
          </>
        )}

        <CafeRoom property={property} furniture={snapshot.layout?.furniture ?? []} />
        {snapshot.customers.map((c) => (
          <CustomerMesh key={c.id} customer={c} />
        ))}
        {snapshot.players.map((p) => (
          <PlayerMesh key={p.id} player={p} isYou={p.id === you} hideBody={firstPerson && p.id === you} />
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
}: {
  property: PropertyListing;
  furniture: FurnitureItem[];
}) {
  const w = property.width;
  const d = property.depth;

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[w / 2, 0, d / 2]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#6b4f3a" roughness={0.85} />
      </mesh>
      {/* Wood planks hint */}
      {Array.from({ length: Math.floor(w) }).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[i + 0.5, 0.01, d / 2]}>
          <planeGeometry args={[0.04, d]} />
          <meshStandardMaterial color="#5a4030" />
        </mesh>
      ))}

      {/* Walls */}
      <Wall length={w} position={[w / 2, 1.4, 0]} />
      <Wall length={w} position={[w / 2, 1.4, d]} />
      <Wall length={d} position={[0, 1.4, d / 2]} rotation={Math.PI / 2} />
      <Wall length={d} position={[w, 1.4, d / 2]} rotation={Math.PI / 2} />

      {/* Entrance gap glow */}
      <mesh position={[-0.05, 1.1, 1.4]}>
        <boxGeometry args={[0.12, 2.2, 1.8]} />
        <meshStandardMaterial color="#f4d2a0" emissive="#d9773f" emissiveIntensity={0.35} />
      </mesh>

      {/* Windows */}
      <mesh position={[w / 2, 1.6, 0.08]}>
        <boxGeometry args={[w * 0.45, 1.2, 0.08]} />
        <meshStandardMaterial color="#d8c2a4" transparent opacity={0.35} emissive="#c4a574" emissiveIntensity={0.2} />
      </mesh>

      {furniture.map((f) => (
        <FurnitureMesh key={f.id} item={f} />
      ))}

      <Text
        position={[w / 2, 2.9, 0.2]}
        fontSize={0.35}
        color="#f3ebe2"
        anchorX="center"
        anchorY="middle"
      >
        {property.name}
      </Text>
    </group>
  );
}

function Wall({ length, position, rotation = 0 }: { length: number; position: [number, number, number]; rotation?: number }) {
  return (
    <mesh position={position} rotation={[0, rotation, 0]} castShadow receiveShadow>
      <boxGeometry args={[length, 2.8, 0.18]} />
      <meshStandardMaterial color="#3d2a20" roughness={0.9} />
    </mesh>
  );
}

function FurnitureMesh({ item }: { item: FurnitureItem }) {
  const color = useMemo(() => {
    switch (item.kind) {
      case "counter":
        return "#8b5a3c";
      case "coffee_machine":
        return "#2c2c2c";
      case "table":
        return "#a67c52";
      case "chair":
        return "#5c4030";
      case "fridge":
        return "#9aa4ae";
      case "pickup":
        return "#6b4f3a";
      default:
        return "#3f6b54";
    }
  }, [item.kind]);

  const size = useMemo<[number, number, number]>(() => {
    switch (item.kind) {
      case "counter":
        return [2.2, 0.9, 0.7];
      case "coffee_machine":
        return [0.7, 1.1, 0.55];
      case "table":
        return [1.1, 0.7, 1.1];
      case "chair":
        return [0.45, 0.55, 0.45];
      case "fridge":
        return [0.8, 1.6, 0.7];
      case "pickup":
        return [1.4, 0.85, 0.6];
      default:
        return [0.4, 0.7, 0.4];
    }
  }, [item.kind]);

  return (
    <group position={[item.x, size[1] / 2, item.z]} rotation={[0, item.rotation, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={item.kind === "coffee_machine" ? 0.4 : 0.05} />
      </mesh>
      {item.kind === "coffee_machine" && (
        <mesh position={[0, 0.65, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.2, 8]} />
          <meshStandardMaterial color="#d9773f" emissive="#d9773f" emissiveIntensity={0.4} />
        </mesh>
      )}
      {item.kind === "decoration" && (
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[0.22, 12, 12]} />
          <meshStandardMaterial color="#5d9a74" />
        </mesh>
      )}
    </group>
  );
}

function CustomerMesh({ customer }: { customer: Customer }) {
  const tone =
    customer.persona === "student" ? "#5d9a74" : customer.persona === "office" ? "#3d5a80" : "#c4a574";
  const angry = customer.state === "angry" || customer.patience < 20;
  return (
    <group position={[customer.x, 0, customer.z]}>
      <mesh position={[0, 0.85, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.7, 4, 8]} />
        <meshStandardMaterial color={angry ? "#c45c4a" : tone} />
      </mesh>
      <mesh position={[0, 1.45, 0]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color="#f3ebe2" />
      </mesh>
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
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[0.25, 0.8, 4, 8]} />
        <meshStandardMaterial color={player.color} emissive={isYou ? player.color : "#000"} emissiveIntensity={isYou ? 0.15 : 0} />
      </mesh>
      <Text position={[0, 2.05, 0]} fontSize={0.22} color="#f3ebe2" anchorX="center">
        {isYou ? "You" : player.name}
      </Text>
      {player.holding && (
        <mesh position={[0.35, 1.1, 0.2]}>
          <boxGeometry args={[0.2, 0.25, 0.2]} />
          <meshStandardMaterial color={player.holding === "coffee" ? "#6b3f24" : "#f3ebe2"} />
        </mesh>
      )}
    </group>
  );
}
