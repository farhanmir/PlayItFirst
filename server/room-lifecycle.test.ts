import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket, type WebSocketServer } from "ws";
import { CafeRoomServer, RoomCapacityError } from "./rooms.ts";
class Socket extends EventEmitter {
  readyState:number=WebSocket.OPEN;
  messages:any[]=[];
  send(value:string){this.messages.push(JSON.parse(value));}
  close(){this.readyState=WebSocket.CLOSED;this.emit("close");}
  terminate(){this.close();}
  ping(){}
}
const servers:EventEmitter[]=[];
function setup(limits={maxRooms:2,maxMembers:3,abandonGraceMs:1000}){
  const wss=new EventEmitter();servers.push(wss);
  const rooms=new CafeRoomServer(wss as unknown as WebSocketServer,limits);
  const socket=()=>{const ws=new Socket();wss.emit("connection",ws,{});return ws};
  const send=async(ws:Socket,msg:any)=>{ws.emit("message",JSON.stringify(msg));await Promise.resolve();await Promise.resolve();};
  const join=async(code:string,role="barista",resume?:string)=>{const ws=socket();await send(ws,{t:"hello",room:code,name:role,role,resume});return ws};
  return {rooms,wss,socket,send,join};
}
afterEach(()=>{for(const wss of servers.splice(0))wss.emit("close");vi.useRealTimers()});
describe("bounded room lifecycle and active sessions",()=>{
  it("expires unclaimed rooms, releases capacity, and never creates rooms via hello",async()=>{
    vi.useFakeTimers();const {rooms,socket,send}=setup();
    const a=rooms.createRoom(),b=rooms.createRoom();
    expect(()=>rooms.createRoom()).toThrow(RoomCapacityError);
    const ws=socket();await send(ws,{t:"hello",room:"unknown",name:"x"});
    expect(ws.messages.at(-1)).toMatchObject({t:"error",code:"ROOM_NOT_FOUND",terminal:true});
    expect(rooms.getRoom("unknown")).toBeUndefined();
    vi.advanceTimersByTime(1000);
    expect(rooms.getRoom(a.code)).toBeUndefined();expect(rooms.getRoom(b.code)).toBeUndefined();
    expect(()=>rooms.createRoom()).not.toThrow();
  });
  it("pauses all three loops on disconnect, resumes during grace, and clears timers on expiry",async()=>{
    vi.useFakeTimers();const {rooms,join}=setup();const {code}=rooms.createRoom();
    const owner=await join(code),room=rooms.getRoom(code)!;
    const token=owner.messages.find(m=>m.t==="welcome").token;
    expect(vi.getTimerCount()).toBe(3);
    owner.close();expect(room.stepTimer).toBeUndefined();expect(room.snapshotTimer).toBeUndefined();expect(room.directorTimer).toBeUndefined();
    expect(vi.getTimerCount()).toBe(1);vi.advanceTimersByTime(900);
    const resumed=await join(code,"owner",token);expect(resumed.messages.some(m=>m.t==="welcome")).toBe(true);
    expect(vi.getTimerCount()).toBe(3);vi.advanceTimersByTime(200);expect(rooms.getRoom(code)).toBe(room);
    resumed.close();vi.advanceTimersByTime(1000);expect(rooms.getRoom(code)).toBeUndefined();expect(vi.getTimerCount()).toBe(0);
  });
  it("revokes old socket authority immediately and preserves replacement on delayed close",async()=>{
    const {rooms,join,send}=setup();const {code}=rooms.createRoom();const old=await join(code,"owner");
    const welcome=old.messages.find(m=>m.t==="welcome"),room=rooms.getRoom(code)!;
    // Simulate a delayed close delivery while the old transport remains writable.
    old.close=()=>{};
    const replacement=await join(code,"owner",welcome.token);
    expect(old.messages.at(-1)).toMatchObject({code:"SESSION_REPLACED",terminal:true});
    await send(old,{t:"select_property",propertyId:rooms.listProperties()[0].id});expect(room.snapshot.property).toBeNull();
    old.emit("close");
    await send(replacement,{t:"select_property",propertyId:rooms.listProperties()[0].id});expect(room.snapshot.property).not.toBeNull();
    expect(room.snapshot.players).toHaveLength(1);
    expect(room.members.get(welcome.you)?.socket).toBe(replacement);
  });
  it("hides disconnected avatars and resumes the exact held state without a duplicate", async () => {
    const { rooms, join } = setup();const { code } = rooms.createRoom();
    const owner = await join(code, "owner");const guest = await join(code, "barista");
    const welcome = owner.messages.find(m => m.t === "welcome");const room = rooms.getRoom(code)!;
    room.snapshot = { ...room.snapshot, players: room.snapshot.players.map(p => p.id === welcome.you ? { ...p, x: 4.25, z: 6.75, holding: "drink:latte" } : p) };
    owner.close();
    expect(room.snapshot.players.find(p => p.id === welcome.you)).toMatchObject({ connected: false, x: 4.25, z: 6.75, holding: "drink:latte" });
    expect(guest.messages.at(-1).snapshot.players.find((p: any) => p.id === welcome.you).connected).toBe(false);
    const resumed = await join(code, "owner", welcome.token);
    const state = resumed.messages.find(m => m.t === "welcome");
    expect(state.you).toBe(welcome.you);
    expect(state.snapshot.players.filter((p: any) => p.id === welcome.you)).toHaveLength(1);
    expect(state.snapshot.players.find((p: any) => p.id === welcome.you)).toMatchObject({ connected: true, x: 4.25, z: 6.75, holding: "drink:latte" });
  });
  it("unicasts phone pairing codes to the authenticated owner only", async () => {
    vi.stubEnv("PHOTON_PROJECT_ID", "pho_prj_00000000000000000000000001");
    vi.stubEnv("PHOTON_SENDER_ID", "pho_usr_00000000000000000000000001");
    vi.stubEnv("PHOTON_API_KEY", "pho_sk_test");
    vi.stubEnv("PHOTON_WEBHOOK_SECRET", `whsec_${Buffer.alloc(32, 7).toString("base64")}`);
    try {
      const { rooms, join, send } = setup();const { code } = rooms.createRoom();
      const owner = await join(code, "owner"), guest = await join(code, "barista");
      await send(guest, { t: "photon_pair_start" });
      expect(guest.messages.at(-1).t).toBe("photon_pair_error");
      await send(owner, { t: "photon_pair_start" });
      expect(owner.messages.at(-1)).toMatchObject({ t: "photon_pairing", pairing: { paired: false, code: expect.any(String) } });
      expect(guest.messages.some(m => m.t === "photon_pairing")).toBe(false);
      expect(JSON.stringify(rooms.getRoom(code)!.snapshot)).not.toContain(owner.messages.at(-1).pairing.code);
    } finally { vi.unstubAllEnvs(); }
  });
  it("enforces member cap and rejects invalid resume instead of allocating another member",async()=>{
    const {rooms,join}=setup({maxRooms:1,maxMembers:1,abandonGraceMs:1000});const {code}=rooms.createRoom();
    const owner=await join(code),token=owner.messages.find(m=>m.t==="welcome").token;
    const extra=await join(code);expect(extra.messages.at(-1)).toMatchObject({code:"JOIN_REJECTED",terminal:true});
    const invalid=await join(code,"owner","wrong");expect(invalid.messages.at(-1)).toMatchObject({code:"JOIN_REJECTED"});
    const resumed=await join(code,"owner",token);expect(resumed.messages.some(m=>m.t==="welcome")).toBe(true);
    expect(rooms.getRoom(code)?.members.size).toBe(1);
  });
  it("times out a socket that stops replying to heartbeat and expires its abandoned room",async()=>{
    vi.useFakeTimers();const {rooms,join}=setup();const {code}=rooms.createRoom();const ws=await join(code);
    vi.advanceTimersByTime(60_000);expect(ws.readyState).toBe(WebSocket.CLOSED);
    vi.advanceTimersByTime(1000);expect(rooms.getRoom(code)).toBeUndefined();expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps build and service teamwork but rejects customer mutations and non-owner demo",async()=>{
    const {rooms,join,send}=setup({maxRooms:1,maxMembers:5,abandonGraceMs:1000});const {code}=rooms.createRoom();
    const owner=await join(code,"owner"),builder=await join(code,"builder"),customer=await join(code,"customer"),manager=await join(code,"manager");
    await send(owner,{t:"select_property",propertyId:rooms.listProperties()[0].id});const room=rooms.getRoom(code)!;
    for(const msg of [{t:"open_cafe"},{t:"set_phase",phase:"play"},{t:"place_furniture",kind:"decoration",x:11,z:8},{t:"demo_boost"},{t:"interact",action:"restock"},{t:"director_choice",eventId:"x",choiceId:"x"}]){
      const before=room.snapshot;await send(customer,msg);expect(customer.messages.at(-1).t).toBe("error");expect(room.snapshot).toBe(before);
    }
    await send(builder,{t:"place_furniture",kind:"decoration",x:11,z:8});expect(room.snapshot.layout!.furniture).toHaveLength(10);
    await send(builder,{t:"open_cafe"});expect(room.snapshot.open).toBe(false);
    await send(manager,{t:"open_cafe"});expect(room.snapshot.open).toBe(true);
    const before=room.snapshot;await send(manager,{t:"demo_boost"});expect(room.snapshot).toBe(before);
    await send(owner,{t:"demo_boost"});expect(room.snapshot.customers.length).toBeGreaterThan(0);
  });
});
