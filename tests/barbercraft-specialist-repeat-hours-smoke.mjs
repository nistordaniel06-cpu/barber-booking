import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const source=fs.readFileSync("professionals.html","utf8");
const dest=fs.readFileSync("pro/index.html","utf8");
const mirror=source.replace("<head>",'<head><base href="../"><meta name="barbercraft-portal" content="pro">').replace(/href="#/g,'href="./pro/#');
assert.equal(dest,mirror,"Standalone PRO portal remains synchronized");

class Node {
 constructor(tag){this.tag=tag;this.children=[];this.parent=null;this.textContent="";this.value="";this.checked=false;this.disabled=false;this.className="";}
 append(...elements){
  for(const element of elements){
   if(element.parent){const old=element.parent.children.indexOf(element);if(old!==-1)element.parent.children.splice(old,1);}
   element.parent=this;this.children.push(element);
  }
 }
 after(element){
  assert.ok(this.parent,"Source row must be visible before repeat panel insertion");
  const index=this.parent.children.indexOf(this);
  this.parent.children.splice(index+1,0,element);element.parent=this.parent;
 }
 remove(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null}}
 setAttribute(){}
 scrollIntoView(){}
}
const user={id:"frizer-4men"};
const result=[];
const client={
 rpc:async(name,args)=>{
  if(name==="bc_my_professional_access")return {data:[{salon_id:"salon-4men",member_role:"manager"}],error:null};
  if(name==="bc_pro_staff_settings")return {data:[{
   user_id:user.id,role:"manager",hours:Object.fromEntries(Array.from({length:7},(_,i)=>[
    i+1,{open:"09:00",close:"19:00",closed:i>=5}
   ])),prices:{}
  }],error:null};
  if(name==="bc_pro_services")return {data:{services:[]},error:null};
  if(name==="bc_pro_team_list")return {data:[{user_id:user.id,display_name:"Frizer 4MEN"}],error:null};
  if(name==="bc_pro_save_staff_settings"){result.push(args);return {data:{ok:true},error:null}}
  throw Error("Unexpected RPC "+name);
 }
};
const document={createElement:tag=>new Node(tag),createTextNode:text=>{const n=new Node("text");n.textContent=text;return n}};
const context={document,client,user,$:id=>id==="calSalon"?{value:"salon-4men"}:null};
const begin=source.indexOf("async function renderStaffEditor(body){");
const finish=source.indexOf("async function loadMyInvitations(){",begin);
assert.ok(begin>=0&&finish>begin);
const run=vm.runInNewContext(source.slice(begin,finish)+"\nrenderStaffEditor",context);
const body=new Node("main");
await run(body);
const detail=body.children.find(n=>n.className==="staffEditorCard");
assert.ok(detail,"Professional hours panel created");
const fields=detail.children.find(n=>n.className==="staffEditorFields");
assert.ok(fields);
const rows=fields.children.filter(n=>n.className==="staffDayRow");
assert.equal(rows.length,7);
rows[0].children[1].value="10:30";
rows[0].children[2].value="18:30";
rows[0].children[4].onclick();
let panel=fields.children.find(n=>n.className==="staffRepeatPanel");
assert.ok(panel,"Repeating hours panel opens for individual specialist");
let options=panel.children[3].children;
assert.equal(options.length,6);
assert.equal(options.slice(0,4).every(n=>n.children[0].checked),true,"Weekdays auto-selected");
assert.equal(options.slice(4).every(n=>!n.children[0].checked),true,"Weekend remains unselected");
await panel.children[5].children[1].onclick();
assert.equal(result.length,1,"Applying copies and saves in one action");
assert.equal(result[0].p_staff,user.id);
for(const day of ["2","3","4","5"]){
 assert.equal(result[0].p_hours[day].open,"10:30");
 assert.equal(result[0].p_hours[day].close,"18:30");
}
assert.equal(result[0].p_hours["6"].closed,true);
assert.equal(result[0].p_hours["7"].closed,true);
assert.ok(!fields.children.some(n=>n.className==="staffRepeatPanel"),"Panel dismissed after successful save");

// Explicitly turning a closed day into a working day.
rows[0].children[4].onclick();
panel=fields.children.find(n=>n.className==="staffRepeatPanel");
options=panel.children[3].children;
options.forEach(n=>n.children[0].checked=false);
options[5].children[0].checked=true; // Sunday
panel.children[4].children[0].checked=true; // explicit reopen
await panel.children[5].children[1].onclick();
assert.equal(result.length,2);
assert.equal(result[1].p_hours["7"].open,"10:30");
assert.equal(result[1].p_hours["7"].closed,false);
assert.equal(Object.keys(result[1].p_prices).length,0,"Prices are unchanged");

assert.match(source,/apply\.onclick=async\(\)=>\{[\s\S]*?await save\.onclick\(\)/,"Salon repeat automatically invokes Save");
const migration=fs.readFileSync("supabase/migrations/20261010_scope_pro_working_hours_to_salon.sql","utf8");
assert.match(migration,/public\.bc_can_manage_pro_hours/);
assert.doesNotMatch(migration,/m\.salon_id\s*=\s*m\.salon_id/);
console.log("PASS: specialist repeat changes selected hours, keeps weekend closed, explicitly opens days off, saves through real RPC");
