import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { Box3, Color, Group, Mesh, MeshStandardMaterial, Vector3, SphereGeometry, TorusGeometry, BoxGeometry, MathUtils } from "three";
import { createCarriedProp, type CarriedState } from "./CarriedProp";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

class CharacterBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** CC0 Kenney rig. Cached source assets; each avatar has its own skeleton and mixer. */
export function CafeCharacter({ seed, appearance, carried = null, fallback }: { seed: string; appearance?: number; carried?: CarriedState; fallback: ReactNode }) {
  return <CharacterBoundary fallback={fallback}><Suspense fallback={fallback}><AnimatedCharacter seed={seed} appearance={appearance} carried={carried} /></Suspense></CharacterBoundary>;
}

function AnimatedCharacter({ seed, appearance, carried }: { seed: string; appearance?: number; carried: CarriedState }) {
  const identity = Array.from(seed).reduce((n, c) => n + c.charCodeAt(0), 0);
  const variant = identity % 2;
  const style = (appearance ?? identity) % 5;
  const gltf = useGLTF(`/models/crew/${variant ? "humanFemaleA" : "humanMaleA"}.glb`);
  const rig = useMemo(() => {
    const result = clone(gltf.scene);
    result.name = `cafe-avatar:${seed}`;
    result.userData.style = style;
    result.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      o.castShadow = true; o.receiveShadow = true;
      // Each clone owns its geometry. Distinct jaw/cheek proportions, not just shirt swaps.
      o.geometry = o.geometry.clone();
      const positions = o.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i);
        if (y > 2.65) {
          const influence = MathUtils.smoothstep(y, 2.65, 2.95);
          const width = [.87, 1.14, .96, 1.07, .91][style];
          const jaw = y < 3.17 ? [.92, 1.05, .89, 1.08, 1][style] : 1;
          positions.setX(i, positions.getX(i) * MathUtils.lerp(1, width * jaw, influence));
          positions.setZ(i, positions.getZ(i) * MathUtils.lerp(1, [.94, 1.02, 1.08, .91, 1][style], influence));
        }
      }
      positions.needsUpdate = true; o.geometry.computeVertexNormals();
      // Tint only the shirt's UV island; skin, eyes, hair and shoes retain the authored texture.
      const source = o.material as MeshStandardMaterial;
      const material = source.clone();
      const shirt = new Color(["#54877a", "#b98656", "#a55f53", "#6b809d", "#827099"][identity % 5]);
      material.onBeforeCompile = (shader) => {
        shader.uniforms.shirtColor = { value: shirt };
        shader.uniforms.skinTint = { value: new Color(["#c39b7d", "#fff1e3", "#b88b6c", "#e0bd9d", "#f7e3ce"][style]) };
        shader.uniforms.hairTint = { value: new Color(["#241c18", "#a76b37", "#242025", "#b1aaa0", "#6d3c2a"][style]) };
        shader.fragmentShader = "uniform vec3 shirtColor; uniform vec3 skinTint; uniform vec3 hairTint;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
          #ifdef USE_MAP
          if (vMapUv.x < 0.59 && vMapUv.y > 0.49) diffuseColor.rgb *= shirtColor;
          else {
            float tone = dot(diffuseColor.rgb, vec3(.299,.587,.114));
            if (tone > .17 && diffuseColor.r > diffuseColor.b * 1.15) diffuseColor.rgb *= skinTint;
            else if (vMapUv.x < .63 && vMapUv.y < .3 && tone < .17) diffuseColor.rgb = mix(diffuseColor.rgb, hairTint * (.5 + tone), .8);
          }
          #endif`);
      };
      material.customProgramCacheKey = () => "cafe-person-v2";
      o.material = material;
    });
    // Authored accessories bind to the animated head, so they follow every gesture.
    const hair = new MeshStandardMaterial({ color: ["#241c18", "#a76b37", "#242025", "#b1aaa0", "#6d3c2a"][style], roughness: .92 });
    const accessories = new Group();
    const addHair = (position: [number, number, number], scale: [number, number, number]) => {
      const piece = new Mesh(new SphereGeometry(1, 12, 8), hair); piece.position.set(...position); piece.scale.set(...scale); piece.castShadow = true; accessories.add(piece);
    };
    if (style === 0) { // bob with a clean jaw-length silhouette
      addHair([-.37,3.24,-.12],[.18,.49,.39]); addHair([.37,3.24,-.12],[.18,.49,.39]);
      addHair([0,3.55,-.13],[.44,.28,.45]);
    } else if (style === 1) { // tied-back auburn hair
      addHair([0,3.6,-.2],[.47,.27,.44]); addHair([0,3.36,-.65],[.23,.42,.29]);
    } else if (style === 2) { // coiled high bun
      addHair([0,3.62,-.1],[.43,.25,.43]); addHair([0,3.91,-.17],[.25,.26,.25]);
    } else if (style === 3) { // silver swept crop with spectacles
      addHair([-.06,3.62,-.08],[.48,.25,.46]);
      const metal = new MeshStandardMaterial({color: "#3c3026", roughness: .45});
      for (const x of [-.19,.19]) {
        const lens = new Mesh(new TorusGeometry(.13,.018,6,18),metal); lens.position.set(x,3.27,.48); accessories.add(lens);
      }
      const bridge=new Mesh(new BoxGeometry(.13,.025,.025),metal);bridge.position.set(0,3.27,.49);accessories.add(bridge);
    }
    result.add(accessories); result.updateMatrixWorld(true);
    result.getObjectByName("Head")?.attach(accessories);
    return result;
  }, [gltf.scene, identity, style, seed]);
  useEffect(() => () => {
    rig.traverse((o) => { if (o instanceof Mesh) { (o.material as MeshStandardMaterial).dispose(); o.geometry.dispose(); } });
  }, [rig]);
  const dimensions = useMemo(() => {
    const bounds = new Box3().setFromObject(rig);
    const scale = [1.66, 1.84, 1.74, 1.91, 1.78][style] / (bounds.max.y - bounds.min.y);
    return { scale, y: -bounds.min.y * scale };
  }, [rig]);
  const held = useMemo(() => createCarriedProp(rig), [rig]);
  const root = useRef<Group>(null);
  const { actions } = useAnimations(gltf.animations, rig);
  const previous = useRef(new Vector3());
  const position = useMemo(() => new Vector3(), []);
  const initialized = useRef(false);
  const speedFilter = useRef(0);
  const walkWeight = useRef(0);
  useEffect(() => {
    const idle = actions.idle, walk = actions.run;
    idle?.play(); walk?.play().setEffectiveTimeScale(.7).setEffectiveWeight(0);
    if (idle) idle.time = (identity * .137) % idle.getClip().duration;
    if (walk) walk.time = (identity * .213) % walk.getClip().duration;
    return () => { actions.idle?.stop(); actions.run?.stop(); };
  }, [actions]);
  useFrame((_, dt) => {
    if (!root.current) return;
    root.current.getWorldPosition(position);
    const speed = initialized.current ? position.distanceTo(previous.current) / Math.max(dt, .001) : 0;
    previous.current.copy(position); initialized.current = true;
    // Continuously blend running and idle; never reset a clip at network snapshot boundaries.
    speedFilter.current = MathUtils.damp(speedFilter.current, speed > 8 ? 0 : speed, 7, dt);
    const targetWeight = MathUtils.smoothstep(speedFilter.current, .1, .8);
    walkWeight.current = MathUtils.damp(walkWeight.current, targetWeight, 7, dt);
    actions.run?.setEffectiveWeight(walkWeight.current);
    actions.idle?.setEffectiveWeight(1 - walkWeight.current);
    held.update(carried, dt);
  });
  return <group ref={root}><group scale={[[.93,1,1],[1.04,1,1],[.9,1,1],[1.1,1,1],[1,1,1]][style] as [number,number,number]}><primitive object={rig} scale={dimensions.scale} position={[0, dimensions.y, 0]} dispose={null} /></group></group>;
}
