import { afterEach, describe, expect, it, vi } from "vitest";
import { PhoneBridge, briefly, parseIncoming, rejectReason } from "./phone-bridge.ts";
import type { PhoneOwner } from "./phone-bridge.ts";
import type { ManagerView } from "../shared/manager.ts";
import type { RoomSnapshot } from "../shared/types.ts";
const projectId="pho_prj_00000000000000000000000001", senderId="pho_usr_00000000000000000000000002", agentId="pho_usr_00000000000000000000000003", spaceId="pho_spc_00000000000000000000000004";
const config={transport:"bounded-inbox" as const,apiKey:"pho_sk_test",projectId,senderHandle:"+14155550123",agentHandle:"+14155550124",voiceSecret:"secret-012345678901234567890123456789",voiceNumber:"+14155550125",allowSponsor:false,activationCode:"team-activation-012345678901234567890123"};
const proposalId="10000000-0000-4000-8000-000000000001";
function fixture() {
  let view:ManagerView={runtime:"local",providerVerified:false,busy:false,summary:"Actual state",trace:[],proposals:[{id:proposalId,action:"reorder_supplies",reason:"Stock",cost:35,requestedBy:"owner",expiresAt:Date.now()+120000,status:"pending"}]};
  const snapshot={property:null,finance:{balance:100},inventory:{milk:24,cups:40,beans:30}} as RoomSnapshot;
  const owner:PhoneOwner={actor:{roomCode:"abc123",memberId:"owner"},read:()=>snapshot,active:()=>true,manager:{
    getView:()=>view,request:vi.fn(async()=>view),decline:vi.fn(()=>view),approve:vi.fn(async()=>{view={...view,proposals:[{...view.proposals[0],status:"executed",result:"Supplies delivered",transactionId:"receipt"}]};return view;})
  }};
  return {owner,snapshot};
}
const message=(text:string,createdAt=new Date().toISOString())=>({projectId,platform:"imessage",status:"received",createdAt,id:"pho_msg_00000000000000000000000005",sentBy:{kind:"human",handle:config.senderHandle,id:senderId},receivedBy:{kind:"agent",handle:config.agentHandle,id:agentId},space:{kind:"direct",id:spaceId},content:{type:"text",format:"plain",text}});
afterEach(()=>vi.useRealTimers());
describe("bounded phone demo",()=>{
  it("rejects stale, self, mismatched project, wrong sender and group messages",()=>{
    const now=Date.now(),m=message("hello");
    expect(parseIncoming(m,config,now-1000)?.agentId).toBe(agentId);
    expect(parseIncoming({...m,projectId:"wrong"},config,now-1000)).toBeNull();
    expect(parseIncoming({...m,sentBy:{...m.sentBy,handle:"wrong"}},config,now-1000)).toBeNull();
    expect(parseIncoming({...m,space:{...m.space,kind:"group"}},config,now-1000)).toBeNull();
    expect(parseIncoming({...m,status:"dispatched"},config,now-1000)).toBeNull();
    expect(parseIncoming(m,config,now+1000)).toBeNull();
  });
  it("accepts Photon's real shape: non-agent sender kind, agent from participants when receivedBy is absent",()=>{
    const now=Date.now(),m=message("PAIR abc");
    const real={...m,sentBy:{...m.sentBy,kind:"user"},receivedBy:undefined,space:{...m.space,participantIds:[senderId,agentId]}};
    expect(parseIncoming(real,config,now-1000)?.agentId).toBe(agentId);
    expect(rejectReason({...m,sentBy:{...m.sentBy,kind:"agent"}},config,now-1000)).toBe("sender-is-agent");
    expect(rejectReason({...m,sentBy:{...m.sentBy,handle:"+19999999999"}},config,now-1000)).toBe("sender-not-allowed");
    expect(parseIncoming(m,{...config,senderHandle:"(415) 555-0123"},now-1000)?.senderId).toBe(senderId);
    expect(parseIncoming(m,{...config,senderHandle:"4155550123"},now-1000)?.senderId).toBe(senderId);
    expect(parseIncoming(m,{...config,senderHandle:"+1 415 555 0124"},now-1000)).toBeNull();
  });
  it("accepts any handle in a comma-separated sender list and nothing else",()=>{
    const now=Date.now(),m=message("hello"),team={...config,senderHandle:" +14155550999 , "+config.senderHandle};
    expect(parseIncoming(m,team,now-1000)?.senderId).toBe(senderId);
    expect(parseIncoming({...m,sentBy:{...m.sentBy,handle:"+14155550999"}},team,now-1000)?.senderId).toBe(senderId);
    expect(parseIncoming({...m,sentBy:{...m.sentBy,handle:"+14155550998"}},team,now-1000)).toBeNull();
    expect(parseIncoming({...m,sentBy:{...m.sentBy,handle:""}},{...config,senderHandle:" , "},now-1000)).toBeNull();
  });
  it("lets a team caller ID talk to Jamie without codes, but only approves after an explicit yes",async()=>{
    vi.useFakeTimers();
    const {owner}=fixture();
    const bridge=new PhoneBridge({...config,apiKey:""},fetch),auth="Bearer "+config.voiceSecret;
    await expect(bridge.voice(auth,{callerId:config.senderHandle,action:"status"})).rejects.toThrow(/No phone session/);
    bridge.start(owner);
    expect((await bridge.voice(auth,{callerId:"(415) 555-0123",action:"status"})).answer).toMatch(/Cash \$100/);
    await expect(bridge.voice(auth,{callerId:"+19999999999",action:"status"})).rejects.toThrow(/session code/);
    vi.setSystemTime(Date.now()+3000);
    await expect(bridge.voice(auth,{callerId:config.senderHandle,action:"approve",proposalId})).rejects.toThrow(/clear yes/);
    expect(owner.manager.approve).not.toHaveBeenCalled();
    vi.setSystemTime(Date.now()+3000);
    await bridge.voice(auth,{callerId:config.senderHandle,action:"approve",proposalId,confirmed:true});
    expect(owner.manager.approve).toHaveBeenCalledTimes(1);
  });
  it("keeps phone text short and markdown-free",()=>{
    expect(briefly("**Milk** is at 24. Nobody waiting. Cups 40. Beans 30.")).toBe("Milk is at 24. Nobody waiting.");
    expect(briefly("x".repeat(400)).length).toBeLessThanOrEqual(280);
  });
  it("requires session and separate exact one-use owner approval for voice",async()=>{
    vi.useFakeTimers();
    const {owner}=fixture();
    const bridge=new PhoneBridge({...config,apiKey:""},fetch);
    expect(()=>bridge.start(owner,"")).not.toThrow();
    const s=bridge.start(owner,config.activationCode),auth="Bearer "+config.voiceSecret;
    await expect(bridge.voice("Bearer wrong",{code:s.code,action:"status"})).rejects.toThrow();
    await expect(bridge.voice(auth,{code:"wrong",action:"status"})).rejects.toThrow();
    await expect(bridge.voice(auth,{code:s.code,action:"approve",proposalId,approvalCode:"invented"})).rejects.toThrow();
    expect(owner.manager.approve).not.toHaveBeenCalled();
    const approval=bridge.issueVoiceApproval(owner,proposalId);
    vi.setSystemTime(Date.now()+3000);
    const result=await bridge.voice(auth,{code:s.code,action:"approve",proposalId,approvalCode:approval.approvalCode});
    expect(result.callVerified).toBe(false);
    expect(owner.manager.approve).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now()+3000);
    await expect(bridge.voice(auth,{code:s.code,action:"approve",proposalId,approvalCode:approval.approvalCode})).rejects.toThrow();
    bridge.end(owner);
  });
  it("does not allow another room to take over an active demo or send restricted context",()=>{
    const {owner,snapshot}=fixture();
    const bridge=new PhoneBridge({...config,apiKey:""});
    bridge.start(owner,config.activationCode);
    expect(()=>bridge.start({...owner,actor:{roomCode:"other",memberId:"owner"}},config.activationCode)).toThrow();
    bridge.end(owner);
    snapshot.property={id:"real",source:"costar-extract"} as RoomSnapshot["property"];
    expect(()=>bridge.start(owner,config.activationCode)).toThrow(/not authorized/);
  });
  it("uses an exact message approval, rejects group/wrong-space input and never charges a duplicate message twice",async()=>{
    vi.useFakeTimers();
    const {owner}=fixture();
    let items:unknown[]=[];
    const fetcher=vi.fn(async(_url:string|URL|Request,init?:RequestInit)=>new Response(JSON.stringify(init?.method==="POST"?{id:"pho_msg_00000000000000000000000006",projectId}:{items}),{status:init?.method==="POST"?202:200}));
    const bridge=new PhoneBridge(config,fetcher as typeof fetch);
    const session=bridge.start(owner,config.activationCode);
    const pair=message("PAIR "+session.code);
    items=[pair]; await vi.advanceTimersByTimeAsync(1);
    const ask={...message("Please check supplies"),id:"pho_msg_00000000000000000000000007"};
    items=[pair,ask]; await vi.advanceTimersByTimeAsync(3000);
    expect(owner.manager.request).toHaveBeenCalledTimes(1);
    const approve={...message("APPROVE "+proposalId),id:"pho_msg_00000000000000000000000008"};
    items=[pair,ask,{...approve,id:"pho_msg_00000000000000000000000009",space:{kind:"group",id:spaceId}},approve];
    await vi.advanceTimersByTimeAsync(3000);
    expect(owner.manager.approve).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(owner.manager.approve).toHaveBeenCalledTimes(1);
    bridge.end(owner);
  });
  it("pairs only on the fresh code and deduplicates an incoming message",async()=>{
    vi.useFakeTimers();
    const {owner}=fixture();
    let items:unknown[]=[];
    const fetcher=vi.fn(async(_url:string|URL|Request,init?:RequestInit)=>new Response(JSON.stringify(init?.method==="POST"?{id:"pho_msg_00000000000000000000000006",projectId}:{items}),{status:init?.method==="POST"?202:200}));
    const bridge=new PhoneBridge(config,fetcher as typeof fetch);
    const s=bridge.start(owner,config.activationCode);
    items=[message("PAIR "+s.code)];
    await vi.advanceTimersByTimeAsync(1);
    expect(bridge.getStatus(owner).paired).toBe(true);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetcher.mock.calls.filter(c=>c[1]?.method==="POST")).toHaveLength(1);
    bridge.end(owner);
  });
});
