import { Billboard, Text } from "@react-three/drei";
import type { PropertyListing } from "../../shared/types";
import { entranceMarkersFor } from "../lib/entrances";

/** Original game wayfinding, aligned to a measured opening; never a fabricated scanned door. */
export function EntranceMarkers({ property }: { property: PropertyListing }) {
  return <group name="entrance-wayfinding">
    {entranceMarkersFor(property).map((marker,i)=><group key={marker.openingId ?? i}>
      {marker.hasOpening && <group position={[marker.position.x,0,marker.position.z]} rotation={[0,marker.rotation,0]}>
        {/* Open jambs only: no door leaf, glass panel or new collision across the route. */}
        {[-1,1].map(side=><mesh key={side} position={[side*(marker.width/2+.02),marker.height/2,marker.surfaceOffset]} raycast={()=>null}>
          <boxGeometry args={[.04,marker.height,.07]} /><meshStandardMaterial color="#173c35" roughness={.7} />
        </mesh>)}
        <mesh position={[0,marker.height+.13,marker.surfaceOffset+.02]} raycast={()=>null}><boxGeometry args={[Math.max(1,Math.min(marker.width,1.8)),.24,.035]} /><meshStandardMaterial color="#173c35" roughness={.8} /></mesh>
        <Text position={[0,marker.height+.13,marker.surfaceOffset+.044]} fontSize={.12} color="#fff8df" anchorX="center" anchorY="middle" raycast={()=>null}>{marker.label}</Text>
        <mesh position={[0,.012,0]} raycast={()=>null}><boxGeometry args={[marker.width,.018,.16]} /><meshStandardMaterial color="#e9b765" roughness={.85} /></mesh>
      </group>}
      <group position={[marker.approach.x,.028,marker.approach.z]} rotation={[0,marker.rotation,0]}>
        <mesh rotation={[-Math.PI/2,0,0]} raycast={()=>null}><planeGeometry args={[Math.max(1.1,Math.min(marker.width,1.8)),.55]} /><meshStandardMaterial color="#173c35" roughness={1} /></mesh>
        <Text position={[0,.008,0]} rotation={[-Math.PI/2,0,0]} fontSize={.105} color="#fff8df" anchorX="center" anchorY="middle" raycast={()=>null}>{marker.label}</Text>
      </group>
      {!marker.hasOpening && <Billboard position={[marker.approach.x,.65,marker.approach.z]}>
        <Text fontSize={.14} color="#173c35" outlineColor="#fff8df" outlineWidth={.025} raycast={()=>null}>{marker.caption}</Text>
      </Billboard>}
    </group>)}
  </group>;
}
