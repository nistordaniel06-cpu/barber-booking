/* Private BARBERCRAFT Passport gallery image preparation.
   Convert oversized phone photos in the browser. No image is sent to third-party services. */
(()=>{
"use strict";
const MAX_BYTES=5*1024*1024, MAX_INPUT=40*1024*1024;
const imageKinds=new Set(["image/jpeg","image/png","image/webp"]);
const convertibleKinds=new Set(["image/heic","image/heif","image/heic-sequence","image/heif-sequence"]);
const extension=name=>String(name||"").split(".").pop().toLowerCase();
function supported(file){
 const ext=extension(file?.name);
 return !!file&&(
  imageKinds.has(file.type)||
  convertibleKinds.has(file.type)||
  ["jpg","jpeg","png","webp","heic","heif"].includes(ext)
 );
}
function jpegCanvas(canvas,quality){
 return new Promise((resolve,reject)=>{
  if(!canvas.toBlob){reject(new Error("Browserul nu poate comprima fotografiile. Încearcă alt browser."));return}
  canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Nu am putut converti fotografia.")),"image/jpeg",quality);
 });
}
async function decode(file){
 // Browsers supporting HEIC/HEIF can decode directly; others get a clear error.
 if(typeof createImageBitmap==="function"){
  try{
   const bitmap=await createImageBitmap(file,{imageOrientation:"from-image"});
   return {width:bitmap.width,height:bitmap.height,draw:(ctx,w,h)=>ctx.drawImage(bitmap,0,0,w,h),
    close:()=>bitmap.close()};
  }catch(_e){/* Some Android versions support <img> but not createImageBitmap for certain formats. */}
 }
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();
  await new Promise((resolve,reject)=>{
   img.onload=resolve;img.onerror=()=>reject(new Error(
    "Telefonul nu poate deschide acest format. Folosește JPG/PNG/WebP sau exportă fotografia din HEIC."
   ));
   img.src=url;
  });
  return {width:img.naturalWidth,height:img.naturalHeight,draw:(ctx,w,h)=>ctx.drawImage(img,0,0,w,h),close:()=>{}};
 }finally{URL.revokeObjectURL(url)}
}
async function prepare(file){
 if(!file||!supported(file))throw new Error("Alege o fotografie JPG, PNG, WebP sau HEIC.");
 if(file.size>MAX_INPUT)throw new Error("Fotografia depășește 40 MB. Alege una mai mică.");
 if(file.size<=MAX_BYTES&&imageKinds.has(file.type))
  return {blob:file,contentType:file.type,ext:{"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[file.type],resized:false};
 const src=await decode(file);
 try{
  if(!src.width||!src.height)throw new Error("Fotografia nu are dimensiuni valide.");
  const baseScale=Math.min(1,2400/Math.max(src.width,src.height));
  for(const maxSide of [2400,1900,1500,1200]){
   const scale=Math.min(baseScale,maxSide/Math.max(src.width,src.height));
   const canvas=document.createElement("canvas");
   canvas.width=Math.max(1,Math.round(src.width*scale));
   canvas.height=Math.max(1,Math.round(src.height*scale));
   const ctx=canvas.getContext("2d");
   if(!ctx)throw new Error("Acest browser nu poate procesa fotografia.");
   ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);
   src.draw(ctx,canvas.width,canvas.height);
   for(const quality of [.88,.75,.62,.48]){
    const blob=await jpegCanvas(canvas,quality);
    if(blob.size<=MAX_BYTES)return {blob,contentType:"image/jpeg",ext:"jpg",resized:true};
   }
  }
  throw new Error("Fotografia nu a putut fi redusă sub 5 MB. Încearcă o fotografie mai mică.");
 }finally{src.close()}
}
window.BCPassportImage={prepare,supported,MAX_BYTES};
})();
