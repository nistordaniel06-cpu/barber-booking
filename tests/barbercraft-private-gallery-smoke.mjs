import assert from "node:assert/strict";
import fs from "node:fs";import vm from "node:vm";
const read=p=>fs.readFileSync(p,"utf8");
for(const file of ["passport.js","passport-image.js"]){
 new vm.Script(read(file),{filename:file});
 console.log("PASS parse",file);
}
const html=read("passport.html"),js=read("passport.js");
assert.ok(html.includes('id="photoForm"'),"Private photo upload form exists");
assert.ok(html.includes('id="photoFeedback"'),"Inline accessible gallery error or success");
assert.ok(html.includes('id="photoPreview"'),"Photo preview available");
assert.ok(html.indexOf("./passport-image.js")<html.indexOf("./passport.js"),"Image helper loads first");
assert.ok(html.includes("image/heic"),"Phone photo picker supports HEIC selection");
assert.ok(js.includes('sb.storage.from("bc-passport").upload'),"Uploads to original private bucket");
assert.ok(js.includes('sb.from("bc_passport_photos").insert'),"Album DB record saved");
assert.ok(js.includes("getUser()"),"Active role session revalidated at upload");
assert.ok(js.includes("galleryFeedback("),"Inline feedback wired up");
assert.ok(js.includes("loadPhotos()"),"Photo list refreshed");
assert.ok(js.includes('remove([path])'),"Failed record upload cleaned up");
assert.ok(!js.includes('sb.storage.from("bc-passport").getPublicUrl('),"Never publish private photo URLs");
for(const inline of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
 if(inline[1].trim())new vm.Script(inline[1],{filename:"passport.html-inline"});
}
const created=[];
const runtime={window:{},document:{
 createElement(tag){
  assert.equal(tag,"canvas");
  const canvas={width:0,height:0,getContext(){return {fillRect(){},drawImage(){},set fillStyle(v){}};},
   toBlob(fn,type,quality){created.push({w:this.width,h:this.height,type,quality});fn({size:750000,type:"image/jpeg"})}};
  return canvas;
 }
},createImageBitmap:async()=>({width:4200,height:2800,close(){}})};
vm.runInNewContext(read("passport-image.js"),runtime);
const helper=runtime.window.BCPassportImage;
const small=await helper.prepare({name:"tuns.jpg",type:"image/jpeg",size:400000});
assert.equal(small.ext,"jpg");assert.equal(small.resized,false);
const big=await helper.prepare({name:"tuns-prea-mare.jpg",type:"image/jpeg",size:11500000});
assert.equal(big.ext,"jpg");assert.equal(big.resized,true);
assert.ok(big.blob.size<=5242880);
assert.ok(created[0].w<=2400&&created[0].h<=2400);
assert.equal(helper.supported({name:"iphone.heic",type:"image/heic",size:500000}),true);
await assert.rejects(()=>helper.prepare({name:"heavy.png",type:"image/png",size:45000000}),/40 MB/);
await assert.rejects(()=>helper.prepare({name:"file.exe",type:"application/octet-stream",size:100}),/fotografie/);
const session=read("passport-session.js");
assert.ok(session.includes('BCAuthClient?.(portal'),"Gallery reuses portal-isolated PRO/Client session");
console.log("PASS private gallery mobile photo compression, preview, upload, cleanup and session isolation");
