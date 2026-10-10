import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

// Execute the production controller with a small DOM and controllable RPC replies.
// No real accounts or bookings are created.
const source=fs.readFileSync(process.argv[2]||"catalog-booking.js","utf8");
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){
 let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no});
 return {promise,resolve,reject};
}
class Node {
 constructor(){this.children=[];this.value="";this.hidden=false;this.disabled=false;this.checked=false;this.attributes={};this.textContent="";}
 replaceChildren(...nodes){this.children=nodes;this.textContent="";}
 append(node){this.children.push(node);if(node.option&&!this.value)this.value=node.value;}
 setAttribute(key,value){this.attributes[key]=value;}
 querySelectorAll(){return this.children;}
 querySelector(){return this.children[0]||new Node();}
 dispatchEvent(){return this.onchange?.();}
 checkValidity(){return true;}
 scrollIntoView(){}
}
const salon="11111111-1111-4111-8111-111111111111";
async function harness(approval="approved"){
 const nodes=new Map();
 const $=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id)};
 $("pilotSuccess").hidden=true;
 const h={$,calls:[],approval,user:{id:"client-a"},ids:0,confirmations:0};
 h.slotHandler=async()=>({data:["10:00"],error:null});
 h.bookingHandler=async()=>({data:{confirmed:true,code:"BC-TEST",start:"2026-10-11T07:00:00Z",service:"Tuns",price_ron:80,salon:"Salon test"},error:null});
 h.getUser=async()=>({data:{user:h.user},error:null});
 const sb={
  auth:{getUser:()=>h.getUser(),signOut:async()=>{h.user=null;return {error:null}}},
  rpc:async(name,args)=>{
   h.calls.push({name,args:args?JSON.parse(JSON.stringify(args)):{}});
   if(name==="bc_catalog_booking_public")return {data:{enabled:true,name:"Salon test",services:[{name:"Tuns",price:80,duration:30},{name:"Barbă",price:40,duration:15}]}};
   if(name==="bc_client_my_approval")return {data:{status:h.approval}};
   if(name==="bc_catalog_booking_slots")return h.slotHandler(args);
   if(name==="bc_catalog_booking_create")return h.bookingHandler(args);
   throw Error("Unexpected RPC: "+name);
  }
 };
 const context={
  document:{getElementById:$,createElement:()=>new Node()},
  window:{supabase:{},BCAuthClient:()=>sb},
  location:{search:"?salon="+salon},URLSearchParams,URL,Intl,Date,console,
  crypto:{randomUUID:()=>"request-"+(++h.ids)},
  confirm:()=>{h.confirmations++;return true},
  Option:class extends Node{constructor(text,value){super();this.option=true;this.textContent=text;this.value=value}},
  Event:class {},
  navigator:{clipboard:{writeText:async()=>{}}}
 };
 await new vm.Script(source,{filename:"catalog-booking.js"}).runInNewContext(context);
 await tick();
 $("pilotClientName").value="Client Test";$("pilotClientPhone").value="0712345678";$("pilotConsent").checked=true;
 h.select=()=>{$("pilotSlots").children[0].onclick()};
 h.submit=()=>$("pilotBookingForm").onsubmit({preventDefault(){}});
 h.bookings=()=>h.calls.filter(x=>x.name==="bc_catalog_booking_create");
 return h;
}
const tests=[];
function test(name,run){tests.push({name,run})}
test("latest day wins even when the previous response arrives last",async()=>{
 const h=await harness(),a=deferred(),b=deferred();
 let n=0;h.slotHandler=()=>++n===1?a.promise:b.promise;
 const today=h.$("pilotDate").min,next=h.$("pilotDate").max;
 h.$("pilotDate").value=today;const first=h.$("pilotDate").onchange();
 h.$("pilotDate").value=next;const second=h.$("pilotDate").onchange();
 b.resolve({data:["14:00"]});await second;
 a.resolve({data:["09:00"]});await first;
 assert.equal(h.$("pilotSlots").children[0].textContent,"14:00");
 h.select();await h.submit();
 assert.equal(h.bookings()[0].args.p_date,next);
 assert.equal(h.bookings()[0].args.p_time,"14:00");
});
test("stale service errors cannot overwrite current availability",async()=>{
 const h=await harness(),a=deferred(),b=deferred();let n=0;
 h.slotHandler=()=>++n===1?a.promise:b.promise;
 const first=h.$("pilotService").onchange();
 h.$("pilotService").value="Barbă";const second=h.$("pilotService").onchange();
 b.resolve({data:["15:00"]});await second;await tick();
 a.resolve({error:{message:"Old failure",code:"503"}});await first;await tick();
 assert.equal(h.$("pilotSlots").children[0].textContent,"15:00");
 assert.ok(!h.$("pilotClientStatus").textContent.includes("Old failure"));
});
test("changing to an invalid date invalidates outstanding slots",async()=>{
 const h=await harness(),wait=deferred();
 h.slotHandler=()=>wait.promise;
 const first=h.$("pilotDate").onchange();
 h.$("pilotDate").value="";await h.$("pilotDate").onchange();
 wait.resolve({data:["11:00"]});await first;
 assert.equal(h.$("pilotSlots").children.length,0);
 assert.equal(h.$("pilotSubmit").disabled,true);
 assert.match(h.$("pilotSlots").textContent,/zi validă/);
});
test("removed slot buttons cannot select a previous day's slot",async()=>{
 const h=await harness(),old=h.$("pilotSlots").children[0];h.select();
 await h.$("pilotDate").onchange();
 old.onclick();
 assert.equal(h.$("pilotSelectedTime").value,"");
 assert.equal(h.$("pilotSubmit").disabled,true);
});
test("double submit is locked before the asynchronous account check",async()=>{
 const h=await harness(),gate=deferred();h.select();
 h.getUser=()=>gate.promise;
 const first=h.submit(),second=h.submit();
 assert.equal(h.$("pilotDate").disabled,true);
 assert.equal(h.$("pilotClientPhone").disabled,true);
 gate.resolve({data:{user:h.user}});await Promise.all([first,second]);
 assert.equal(h.bookings().length,1);
 assert.equal(h.$("pilotSuccess").hidden,false);
 assert.equal(h.$("pilotSubmit").disabled,true);
 await h.submit();assert.equal(h.bookings().length,1);
});
test("lost booking reply retries identical payload and displays replay confirmation",async()=>{
 const h=await harness();h.select();let n=0;
 h.bookingHandler=async()=>++n===1?{error:{message:"Failed to fetch",code:""}}:
  {data:{confirmed:true,code:"BC-REPLAY",start:"2026-10-11T07:00:00Z",service:"Tuns"}};
 await h.submit();
 assert.match(h.$("pilotClientStatus").textContent,/poate fi deja salvată/);
 assert.equal(h.$("pilotDate").disabled,true);
 assert.equal(h.$("pilotSubmit").disabled,false);
 await h.submit();
 assert.deepEqual(h.bookings()[0].args,h.bookings()[1].args);
 assert.equal(h.confirmations,1);
 assert.equal(h.$("pilotBookingCode").textContent,"BC-REPLAY");
 assert.match(h.$("pilotResult").textContent,/Salon test/);
 assert.ok(!h.$("pilotResult").textContent.includes("undefined"));
});
test("slot conflict reloads availability and a new choice gets a new request ID",async()=>{
 const h=await harness();h.select();let n=0;
 h.bookingHandler=async()=>++n===1?{error:{message:"SLOT_TAKEN",code:"P0001"}}:
  {data:{confirmed:true,code:"BC-NEW",start:"2026-10-11T08:00:00Z",service:"Tuns",price_ron:80,salon:"Salon test"}};
 h.slotHandler=async()=>({data:["11:00"]});
 await h.submit();
 assert.equal(h.$("pilotDate").disabled,false);
 assert.equal(h.$("pilotSubmit").disabled,true);
 h.select();await h.submit();
 assert.notEqual(h.bookings()[0].args.p_request,h.bookings()[1].args.p_request);
 assert.equal(h.bookings()[1].args.p_time,"11:00");
});
test("a retry cannot be sent under another client's account",async()=>{
 const h=await harness();h.select();
 h.bookingHandler=async()=>({error:{message:"Lost reply",code:""}});
 await h.submit();h.user={id:"client-b"};await h.submit();
 assert.equal(h.bookings().length,1);
 assert.match(h.$("pilotClientStatus").textContent,/contul Client folosit/);
});
test("a server gate after a lost reply cannot erase the uncertain request",async()=>{
 const h=await harness();h.select();let n=0;
 h.bookingHandler=async()=>++n===1?{error:{message:"Lost reply",code:""}}:
  n===2?{error:{message:"OWNER_HAS_CLOSED_BOOKINGS",code:"P0001"}}:
  {data:{confirmed:true,code:"BC-RECOVERED",start:"2026-10-11T07:00:00Z",service:"Tuns"}};
 await h.submit();await h.submit();
 assert.equal(h.$("pilotDate").disabled,true);
 assert.match(h.$("pilotClientStatus").textContent,/poate fi deja salvată/);
 await h.submit();
 assert.deepEqual(h.bookings()[0].args,h.bookings()[2].args);
 assert.equal(h.$("pilotBookingCode").textContent,"BC-RECOVERED");
});
test("an account lookup failure does not leave the form permanently busy",async()=>{
 const h=await harness();h.select();
 h.getUser=async()=>{throw Error("Offline")};
 await h.submit();
 assert.equal(h.bookings().length,0);
 assert.equal(h.$("pilotDate").disabled,false);
 assert.equal(h.$("pilotSubmit").disabled,false);
});
test("pending clients can access logout outside the hidden login form",async()=>{
 const html=fs.readFileSync("catalog-booking.html","utf8");
 const button=html.indexOf('id="catalogLogout"');
 const formStart=html.indexOf('<form id="catalogAccountLogin"');
 const formEnd=html.indexOf("</form>",formStart);
 assert.ok(button>formEnd,"Logout must not be a child of the hidden login form");
 const h=await harness("pending");
 assert.equal(h.$("catalogAccountLogin").hidden,true);
 assert.equal(h.$("catalogLogout").hidden,false);
 await h.$("catalogLogout").onclick();
 assert.equal(h.$("catalogAccountLogin").hidden,false);
});
let failures=0;
for(const {name,run} of tests){
 try{await run();console.log("PASS",name)}
 catch(error){failures++;console.error("FAIL",name,error.message)}
}
assert.equal(failures,0,"Booking flow regressions");
