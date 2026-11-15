import { memo, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { CanvasTexture, DoubleSide, Group, RepeatWrapping, Shape, SRGBColorSpace } from "three";
import type { PropertyListing } from "../../shared/types";
import type { PlanWall } from "../../shared/floorplan";
import { useApp } from "../lib/store";
import { measuredShellHeight, openingVerticalSpan } from "../lib/measuredShell";

/** Measured footprint and openings, with an original approximation of observed finishes.
 * No scan textures or fabricated original furniture are embedded in this shell.
 * Missing sill/ceiling measurements remain explicit estimates, never scan measurements.
 */
export function MeasuredShell({ property, overhead, cutaway, placeEnabled, onFloorPlace, onFloorHover, children }: {
  property: PropertyListing; overhead: boolean; cutaway: boolean; placeEnabled: boolean;
  onFloorPlace?: (x: number, z: number) => void; onFloorHover?: (x: number, z: number) => void; children: ReactNode;
}) {
  const plan = useMemo(() => property.floorPlan!, [property.floorPlan!.modelId, property.floorPlan!.floorId, property.floorPlan!.coordinateConvention]);
  const shapes = useMemo(() => plan.rooms.map((room) => {
    const shape = new Shape();
    room.polygon.forEach((p, i) => i ? shape.lineTo(p.x, -p.z) : shape.moveTo(p.x, -p.z));
    shape.closePath();
    return shape;
  }), [plan.modelId, plan.floorId, plan.coordinateConvention]);
  const floor = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#b5ab96"; ctx.fillRect(0, 0, 512, 512);
    ctx.translate(256, 256); ctx.rotate(Math.PI / 4);
    const unit = 24, length = 4;
    const colors = ["#c9c0aa", "#ddd3bd", "#bdb39e", "#d1c8b3", "#c1b7a1"];
    for (let i = -10; i < 10; i++) for (let j = -32; j < 32; j++) {
      const x = (i * length + j) * unit, y = (i * length - j) * unit;
      for (const [px, py, w, h] of [[x, y, length * unit, unit], [x + length * unit, y, unit, length * unit]]) {
        ctx.fillStyle = colors[Math.abs(i * 31 + j * 7) % colors.length]; ctx.fillRect(px + .6, py + .6, w - 1.2, h - 1.2);
        ctx.strokeStyle = "#8b806025";
        for (let g = 1; g < 5; g++) {
          ctx.beginPath();
          if (w > h) { ctx.moveTo(px + 4, py + g * h / 5); ctx.lineTo(px + w - 4, py + g * h / 5 + 1); }
          else { ctx.moveTo(px + g * w / 5, py + 4); ctx.lineTo(px + g * w / 5 + 1, py + h - 4); }
          ctx.stroke();
        }
      }
    }
    const map = new CanvasTexture(canvas); map.wrapS = map.wrapT = RepeatWrapping; map.repeat.set(.3, .3); map.colorSpace = SRGBColorSpace;
    return map;
  }, []);
  useEffect(() => () => floor.dispose(), [floor]);
  // A wall must at least contain its measured openings. Ceiling clearance is an estimate.
  const height = measuredShellHeight(plan);
  return <group>
    {shapes.map((shape, i) => <mesh key={plan.rooms[i].id} rotation={[-Math.PI / 2, 0, 0]} receiveShadow
      onPointerMove={e => { if (placeEnabled) onFloorHover?.(e.point.x, e.point.z); }}
      onClick={e => { if (placeEnabled) { e.stopPropagation(); onFloorPlace?.(e.point.x, e.point.z); } }}>
      <shapeGeometry args={[shape]} /><meshStandardMaterial map={floor} roughness={.84} side={DoubleSide} />
    </mesh>)}
    {plan.walls.map(wall => <MeasuredWall key={wall.id} wall={wall} height={height} cutaway={cutaway} overhead={overhead} />)}
    {/* The scan shows a dark exposed ceiling. Its exact beams/duct runs are not in the imported data. */}
    {!overhead && shapes.map((shape, i) => <mesh key={`ceiling-${i}`} position={[0, height, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <shapeGeometry args={[shape]} /><meshStandardMaterial color="#262a2c" roughness={1} side={DoubleSide} />
    </mesh>)}
    {cutaway && plan.rooms.map((room, i) => {
      const p = room.polygon.reduce((a, p) => ({ x: a.x + p.x / room.polygon.length, z: a.z + p.z / room.polygon.length }), { x: 0, z: 0 });
      return <Text key={room.id} position={[p.x, .035, p.z]} rotation={[-Math.PI / 2, 0, 0]} color="#34423c" fontSize={.18}>{room.label || `Room ${i + 1}`} · {Math.round(room.areaM2)} m²</Text>;
    })}
    {children}
  </group>;
}

const MeasuredWall = memo(function MeasuredWall({ wall, height, overhead, cutaway }: { wall: PlanWall; height: number; overhead: boolean; cutaway: boolean }) {
  const root = useRef<Group>(null);
  useFrame(({ camera }, dt) => {
    if (!root.current) return;
    const state = useApp.getState();
    const me = state.snapshot?.players.find(p => p.id === state.you);
    let obstructs = false;
    if (overhead && me) {
      const ax = camera.position.x, az = camera.position.z;
      const rx = me.x - ax, rz = me.z - az;
      const sx = wall.b.x - wall.a.x, sz = wall.b.z - wall.a.z;
      const cross = rx * sz - rz * sx;
      if (Math.abs(cross) > 1e-6) {
        const qx = wall.a.x - ax, qz = wall.a.z - az;
        const t = (qx * sz - qz * sx) / cross, u = (qx * rz - qz * rx) / cross;
        obstructs = t > 0 && t < 1 && u >= 0 && u <= 1;
      }
    }
    const scale = cutaway || obstructs ? .85 / height : 1;
    root.current.scale.y += (scale - root.current.scale.y) * (1 - Math.exp(-10 * dt));
    // Compressing a lintel lowers it into an otherwise open doorway. In cutaway
    // views omit only the high header pieces; retain their exact source geometry
    // for full-height views and leave the walkable opening visually clear.
    for (const piece of root.current.children) {
      if (piece.userData.openingHeader) piece.visible = root.current.scale.y > .98;
    }
  });
  const length = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z);
  const pieces: ReactNode[] = [];
  const block = (a: number, b: number, y: number, h: number, key: string, openingHeader = false) => {
    if (b - a < .005 || h <= 0) return;
    pieces.push(<mesh key={key} userData={{ openingHeader }} position={[(a + b - length) / 2, y + h / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[b - a, h, wall.thickness]} /><meshStandardMaterial color="#e7e2d5" roughness={.95} />
    </mesh>);
    if (y === 0) pieces.push(<mesh key={`${key}-base`} position={[(a + b - length) / 2, .04, 0]}>
      <boxGeometry args={[b - a, .08, wall.thickness + .012]} /><meshStandardMaterial color="#a89b83" roughness={.85} />
    </mesh>);
  };
  let from = 0;
  for (const opening of [...wall.openings].sort((a,b) => a.center - b.center)) {
    const a = Math.max(from, opening.center * length - opening.width / 2), b = Math.min(length, opening.center * length + opening.width / 2);
    const { bottom, top } = openingVerticalSpan(opening);
    block(from, a, 0, height, `${opening.id}-wall`);
    block(a, b, 0, bottom, `${opening.id}-sill`);
    block(a, b, top, height - top, `${opening.id}-header`, true);
    if (opening.type === "window") {
      const cx = (a + b - length) / 2, width = b-a, h = top-bottom;
      const mullions = Math.max(2, Math.ceil(width / .9) + 1);
      pieces.push(<group key={`${opening.id}-window`} position={[cx, bottom + h / 2, 0]}>
        <mesh><boxGeometry args={[width, h, .025]} /><meshStandardMaterial color="#c4d7d7" metalness={.1} roughness={.2} transparent opacity={.28} /></mesh>
        {Array.from({length: mullions}, (_, i) => <mesh key={i} position={[-width/2+i*width/(mullions-1),0,0]}>
          <boxGeometry args={[.035,h,.06]} /><meshStandardMaterial color="#424846" roughness={.5} /></mesh>)}
        {[-.5,0,.5].map(y => <mesh key={y} position={[0,y*h,0]}><boxGeometry args={[width,.035,.06]} /><meshStandardMaterial color="#424846" roughness={.5} /></mesh>)}
      </group>);
    }
    // A measured doorway does not establish a door leaf or its swing direction.
    from = Math.max(from,b);
  }
  block(from,length,0,height,"last");
  return <group ref={root} position={[(wall.a.x+wall.b.x)/2,0,(wall.a.z+wall.b.z)/2]} rotation={[0,-Math.atan2(wall.b.z-wall.a.z,wall.b.x-wall.a.x),0]}>{pieces}</group>;
});
