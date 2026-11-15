import { BoxGeometry, CylinderGeometry, Group, MathUtils, Mesh, MeshStandardMaterial, Quaternion, TorusGeometry, Vector3, type Object3D } from "three";

export type CarriedState = "ticket" | "brewing" | "drink" | null;

const controllers = new WeakMap<Object3D, { update(state: CarriedState, dt: number): void }>();

/** A hand socket and an arm-only pose layered after the authored locomotion mixer. */
export function createCarriedProp(rig: Object3D) {
  const existing = controllers.get(rig);
  if (existing) return existing;
  const upper = rig.getObjectByName("RightArm");
  const forearm = rig.getObjectByName("RightForeArm");
  const hand = rig.getObjectByName("RightHand");
  const socket = new Group(); socket.name = "carried-hand-socket";
  socket.position.set(0, .15, 0); hand?.add(socket);
  const cup = new Group(); cup.name = "carried-cup"; cup.position.set(.16, .07, 0);
  const cream = new MeshStandardMaterial({ color: "#f6efd8", roughness: .6 });
  const body = new Mesh(new CylinderGeometry(.145, .12, .28, 20), cream); body.castShadow = true; cup.add(body);
  const handle = new Mesh(new TorusGeometry(.085, .022, 8, 16), cream); handle.position.set(-.15, 0, 0); cup.add(handle);
  const coffee = new Mesh(new CylinderGeometry(.128, .128, .008, 20), new MeshStandardMaterial({ color: "#69412b", roughness: .8 })); coffee.position.y=.143; cup.add(coffee);
  const foam = new Mesh(new TorusGeometry(.067,.017,6,16),new MeshStandardMaterial({color:"#e9c995",roughness:.8})); foam.rotation.x=Math.PI/2;foam.position.y=.15;cup.add(foam);
  socket.add(cup);
  const ticket = new Group(); ticket.name="carried-ticket"; ticket.position.set(.03,.05,.06);
  const paper=new Mesh(new BoxGeometry(.27,.34,.012),new MeshStandardMaterial({color:"#fff5dc",roughness:1}));ticket.add(paper);
  const ink=new MeshStandardMaterial({color:"#173c35",roughness:1});
  for(let i=0;i<3;i++){const line=new Mesh(new BoxGeometry(i===0?.18:.13,.012,.006),ink);line.position.set(0,.08-i*.055,.01);ticket.add(line);}
  socket.add(ticket);socket.visible=false;
  const axis=new Vector3(0,1,0), current=new Vector3(), desired=new Vector3();
  const world=new Quaternion(), parent=new Quaternion(), delta=new Quaternion(), rigWorld=new Quaternion();
  const upperDirection=new Vector3(-.18,-.94,.29).normalize();
  const foreDirection=new Vector3(.08,.16,.98).normalize();
  let weight=0;
  const aim=(bone:Object3D,direction:Vector3)=>{
    bone.getWorldQuaternion(world);current.copy(axis).applyQuaternion(world);
    desired.copy(direction).applyQuaternion(rigWorld);
    delta.setFromUnitVectors(current,desired).multiply(world);
    bone.parent!.getWorldQuaternion(parent).invert();delta.premultiply(parent);
    bone.quaternion.slerp(delta,weight);bone.updateWorldMatrix(false,true);
  };
  const controller = { update(state:CarriedState,dt:number){
    socket.visible=!!state;cup.visible=state==="drink";ticket.visible=state==="ticket"||state==="brewing";
    weight=MathUtils.damp(weight,state?1:0,14,dt);
    if(!upper||!forearm||!hand||weight<.001)return;
    rig.updateWorldMatrix(true,true);rig.getWorldQuaternion(rigWorld);
    aim(upper,upperDirection);aim(forearm,foreDirection);aim(hand,foreDirection);
    // Cup is rigidly attached to the palm; counter-rotate only its orientation to keep liquid level.
    hand.getWorldQuaternion(world).invert();socket.quaternion.copy(world.multiply(rigWorld));
    socket.updateWorldMatrix(false,true);
  }};
  controllers.set(rig, controller);
  return controller;
}
