import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Group, Object3D } from "three";
import { createCarriedProp } from "./CarriedProp";

type Node = { name?: string; children?: number[]; translation?: [number, number, number]; rotation?: [number, number, number, number]; scale?: [number, number, number] };
function assetSkeleton(skin: string) {
  const bytes = readFileSync(new URL(`../../public/models/crew/${skin}.glb`, import.meta.url));
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()) as { nodes: Node[]; scenes: { nodes: number[] }[]; scene?: number };
  const nodes = json.nodes.map(node => {
    const object = new Object3D(); object.name = node.name ?? "";
    if (node.translation) object.position.fromArray(node.translation);
    if (node.rotation) object.quaternion.fromArray(node.rotation);
    if (node.scale) object.scale.fromArray(node.scale);
    return object;
  });
  json.nodes.forEach((node, i) => node.children?.forEach(child => nodes[i].add(nodes[child])));
  const rig = new Group(); json.scenes[json.scene ?? 0].nodes.forEach(i => rig.add(nodes[i]));
  rig.updateMatrixWorld(true);
  return rig;
}

describe("carrying overlay on authored character skeletons", () => {
  for (const skin of ["humanMaleA", "humanFemaleA"]) {
    it(`${skin}: constant animation tracks cannot accumulate curl, and release restores every posed joint`, () => {
      const rig = assetSkeleton(skin);
      const controller = createCarriedProp(rig);
      expect(createCarriedProp(rig)).toBe(controller);
      const names = ["RightArm", "RightForeArm", "RightHand", "RightHandIndex1", "RightHandIndex2", "RightHandIndex3", "RightHandThumb2"];
      const original = names.map(name => ({ bone: rig.getObjectByName(name)!, quaternion: rig.getObjectByName(name)!.quaternion.clone() }));
      let settled = original.map(pose => pose.quaternion.clone());
      for (let frame = 0; frame < 300; frame++) {
        controller.restore();
        // Deliberately no mixer writes: Three skips unchanged constant-key properties.
        controller.update("drink", 1 / 60);
        if (frame === 199) settled = original.map(pose => pose.bone.quaternion.clone());
      }
      original.forEach((pose, i) => expect(pose.bone.quaternion.clone().normalize().angleTo(settled[i].clone().normalize())).toBeLessThan(1e-7));
      for (let frame = 0; frame < 300; frame++) { controller.restore(); controller.update(null, 1 / 60); }
      original.forEach(pose => expect(pose.bone.quaternion.clone().normalize().angleTo(pose.quaternion.clone().normalize())).toBeLessThan(1e-7));
      expect(rig.getObjectByName("carried-hand-socket")!.visible).toBe(false);
      expect(rig.getObjectByName("carried-cup")!.visible).toBe(false);
    });
  }
});
