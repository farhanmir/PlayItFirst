import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { Box3, Color, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

class CharacterBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** CC0 Kenney rig. Cached source assets; each avatar has its own skeleton and mixer. */
export function CafeCharacter({ seed, fallback }: { seed: string; fallback: ReactNode }) {
  return <CharacterBoundary fallback={fallback}><Suspense fallback={fallback}><AnimatedCharacter seed={seed} /></Suspense></CharacterBoundary>;
}

function AnimatedCharacter({ seed }: { seed: string }) {
  const identity = Array.from(seed).reduce((n, c) => n + c.charCodeAt(0), 0);
  const variant = identity % 2;
  const gltf = useGLTF(`/models/crew/${variant ? "humanFemaleA" : "humanMaleA"}.glb`);
  const rig = useMemo(() => {
    const result = clone(gltf.scene);
    result.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      o.castShadow = true; o.receiveShadow = true;
      // Tint only the shirt's UV island; skin, eyes, hair and shoes retain the authored texture.
      const source = o.material as MeshStandardMaterial;
      const material = source.clone();
      const shirt = new Color(["#54877a", "#b98656", "#a55f53", "#6b809d", "#827099"][identity % 5]);
      material.onBeforeCompile = (shader) => {
        shader.uniforms.shirtColor = { value: shirt };
        shader.fragmentShader = "uniform vec3 shirtColor;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
          #ifdef USE_MAP
          if (vMapUv.x < 0.59 && vMapUv.y > 0.49) diffuseColor.rgb *= shirtColor;
          #endif`);
      };
      material.customProgramCacheKey = () => "cafe-shirt-v1";
      o.material = material;
    });
    return result;
  }, [gltf.scene, identity]);
  useEffect(() => () => {
    rig.traverse((o) => { if (o instanceof Mesh) (o.material as MeshStandardMaterial).dispose(); });
  }, [rig]);
  const dimensions = useMemo(() => {
    const bounds = new Box3().setFromObject(rig);
    const scale = 1.78 / (bounds.max.y - bounds.min.y);
    return { scale, y: -bounds.min.y * scale };
  }, [rig]);
  const root = useRef<Group>(null);
  const { actions } = useAnimations(gltf.animations, rig);
  const previous = useRef(new Vector3());
  const position = useMemo(() => new Vector3(), []);
  const initialized = useRef(false);
  const moving = useRef(false);
  useEffect(() => {
    actions.idle?.play();
    actions.run?.setEffectiveTimeScale(0.7);
    return () => { actions.idle?.stop(); actions.run?.stop(); };
  }, [actions]);
  useFrame((_, dt) => {
    if (!root.current) return;
    root.current.getWorldPosition(position);
    const speed = initialized.current ? position.distanceTo(previous.current) / Math.max(dt, .001) : 0;
    previous.current.copy(position); initialized.current = true;
    const next = speed > .12;
    if (moving.current !== next) {
      moving.current = next;
      actions.idle?.fadeOut(.18); actions.run?.fadeOut(.18);
      (next ? actions.run : actions.idle)?.reset().setEffectiveWeight(1).fadeIn(.18).play();
    }
  });
  return <group ref={root}><primitive object={rig} scale={dimensions.scale} position={[0, dimensions.y, 0]} dispose={null} /></group>;
}
