import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root=fs.readFileSync("professionals.html","utf8");
const pro=fs.readFileSync("pro/index.html","utf8");
const expected=root.replace("<head>",'<head><base href="../"><meta name="barbercraft-portal" content="pro">').replace(/href="#/g,'href="./pro/#');
assert.equal(pro,expected,"Standalone PRO page matches its source");
assert.match(root,/Repetă orele în alte zile/,"Every weekday offers a repeat-hours action");
assert.match(root,/Luni–Vineri/,"Weekday selection preset");
assert.match(root,/Deschide și zilele libere selectate/,"Opening closed days requires opt-in");
assert.match(root,/onConflict:"salon_id,weekday"/,"Repeat uses the existing salon hours persistence");

class Element {
 constructor(tag){this.tag=tag;this.children=[];this.parent=null;this.textContent="";this.value="";this.checked=false;this.disabled=false;}
 append(...nodes){
  for(const n of nodes){this.children.push(n);n.parent=this;}
 }
 after(node){
  const index=this.parent.children.indexOf(this);
  assert.ok(index>=0,"Element must be attached before insertion");
  this.parent.children.splice(index+1,0,node);node.parent=this.parent;
 }
 remove(){
  if(this.parent){const i=this.parent.children.indexOf(this);if(i>=0)this.parent.children.splice(i,1);this.parent=null;}
 }
 setAttribute(){}
 scrollIntoView(){}
}

const start=root.indexOf("async function renderHoursEditor(body){");
const end=root.indexOf("async function renderProServiceEditor(body){",start);
assert.ok(start>0&&end>start,"Working hours editor is available");
let persisted=[];
const from=table=>({
 select:()=>({eq:async()=>({data:Array.from({length:7},(_,i)=>({
  weekday:i+1,opens:"09:00:00",closes:"19:00:00",is_closed:i===5
 })),error:null})}),
 upsert:async(records,options)=>{
  assert.equal(options.onConflict,"salon_id,weekday");
  persisted=records;return {error:null};
 }
});
const sandbox={
 document:{createElement:tag=>new Element(tag)},
 $:id=>id==="calSalon"?{value:"salon-4men"}:null,
 client:{
  rpc:async()=>({data:[{salon_id:"salon-4men",member_role:"owner"}],error:null}),
  from
 }
};
const fn=vm.runInNewContext(root.slice(start,end)+"\nrenderHoursEditor",sandbox);
const body=new Element("main");
await fn(body);
const rows=body.children.filter(x=>x.className==="hoursCard");
assert.equal(rows.length,7,"Each weekday is editable");
const startField=r=>r.children[1].children[0];
const endField=r=>r.children[2].children[0];
const closedField=r=>r.children[3].children[0];
startField(rows[0]).value="10:30";endField(rows[0]).value="18:30";
rows[0].children[4].onclick();
let panel=body.children.find(x=>x.className==="hoursRepeatPanel");
assert.ok(panel,"Copy panel opens beside the selected day");
const days=panel.children[3].children;
assert.equal(days.length,6,"Source day is not included among destinations");
days[0].children[0].checked=true; // Tuesday
days[1].children[0].checked=true; // Wednesday
days[4].children[0].checked=true; // Saturday, previously closed
panel.children[6].children[1].onclick();
assert.equal(startField(rows[1]).value,"10:30");
assert.equal(endField(rows[2]).value,"18:30");
assert.equal(startField(rows[4]).value,"09:00","Unselected Friday unchanged");
assert.equal(startField(rows[5]).value,"10:30","Closed Saturday times copied");
assert.equal(closedField(rows[5]).checked,true,"Closed Saturday does not reopen without consent");
const save=body.children.find(x=>x.textContent==="Salvează programul");
assert.ok(save);
await save.onclick();
assert.equal(persisted.length,7);
assert.equal(persisted[5].is_closed,true,"Closed Saturday remains closed in database");
assert.equal(persisted[1].opens,"10:30","Tuesday receives source opening time");

rows[0].children[4].onclick();
panel=body.children.find(x=>x.className==="hoursRepeatPanel");
panel.children[3].children[4].children[0].checked=true; // Saturday
panel.children[4].children[0].checked=true; // explicit reopen
panel.children[6].children[1].onclick();
assert.equal(closedField(rows[5]).checked,false,"Explicitly selected closed day can become working day");
await save.onclick();
assert.equal(persisted[5].is_closed,false,"Reopened Saturday persisted");
console.log("PASS: repeat working hours to chosen days, preserve days off, optionally reopen, save once for salon");
