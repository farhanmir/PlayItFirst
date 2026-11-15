import { afterEach, describe, expect, it, vi } from "vitest";
import { PhoneBridge, parseIncoming } from "./phone-bridge.ts";
import type { PhoneOwner } from "./phone-bridge.ts";
import type { ManagerView } from "../shared/manager.ts";
import type { RoomSnapshot } from "../shared/types.ts";
const projectId="pho_prj_00000000000000000000000001", senderId="pho_usr_00000000000000000000000002", agentId="pho_usr_00000000000000000000000003", spaceId="pho_spc_00000000000000000000000004";
const config={apiKey:"pho_sk_test",projectId,senderHandle:"+14155550123",agentHandle:"+14155550124",voiceSecret:"secret-012345678901234567890123456789",voiceNumber:"+14155550125",allowSponsor:false};
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
  it("requires session and separate exact one-use owner approval for voice",async()=>{
    const {owner}=fixture();
    const bridge=new PhoneBridge({...config,apiKey:""},fetch);
    const s=bridge.start(owner),auth="Bearer "+config.voiceSecret;
    await expect(bridge.voice("Bearer wrong",{code:s.code,action:"status"})).rejects.toThrow();
    await expect(bridge.voice(auth,{code:"wrong",action:"status"})).rejects.toThrow();
    await expect(bridge.voice(auth,{code:s.code,action:"approve",proposalId,approvalCode:"invented"})).rejects.toThrow();
    expect(owner.manager.approve).not.toHaveBeenCalled();
    const approval=bridge.issueVoiceApproval(owner,proposalId);
    vi.useFakeTimers();vi.setSystemTime(Date.now()+3000);
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
    bridge.start(owner);
    expect(()=>bridge.start({...owner,actor:{roomCode:"other",memberId:"owner"}})).toThrow();
    bridge.end(owner);
    snapshot.property={id:"real",source:"costar-extract"} as RoomSnapshot["property"];
    expect(()=>bridge.start(owner)).toThrow(/not authorized/);
  });
  it("uses an exact message approval, rejects group/wrong-space input and never charges a duplicate message twice",async()=>{
    vi.useFakeTimers();
    const {owner}=fixture();
    let items:unknown[]=[];
    const fetcher=vi.fn(async(_url:string|URL|Request,init?:RequestInit)=>new Response(JSON.stringify(init?.method==="POST"?{id:"pho_msg_00000000000000000000000006",projectId}:{items}),{status:init?.method==="POST"?202:200}));
    const bridge=new PhoneBridge(config,fetcher as typeof fetch);
    const session=bridge.start(owner);
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
    const s=bridge.start(owner);
    items=[message("PAIR "+s.code)];
    await vi.advanceTimersByTimeAsync(1);
    expect(bridge.getStatus(owner).paired).toBe(true);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetcher.mock.calls.filter(c=>c[1]?.method==="POST")).toHaveLength(1);
    bridge.end(owner);
  });
});
