/* Local QR raster/vector render: NEVER send signed personal token to a third-party QR API. */
(()=>{"use strict";
const ns="http://www.w3.org/2000/svg";
window.BCRenderPassportQr=(root,payload)=>{
 root.replaceChildren();
 if(typeof payload!=="string"||!payload.startsWith("BCP1|"))throw Error("INVALID_PASSPORT_CODE");
 if(typeof window.qrcode==="function"){
  const qr=window.qrcode(0,"M");qr.addData(payload,"Byte");qr.make();
  const count=qr.getModuleCount(),quiet=4;
  const svg=document.createElementNS(ns,"svg");svg.setAttribute("viewBox",`0 0 ${count+quiet*2} ${count+quiet*2}`);
  svg.setAttribute("width","220");svg.setAttribute("height","220");
  svg.setAttribute("role","img");svg.setAttribute("aria-label","Cod QR personal temporar pentru check-in");
  const background=document.createElementNS(ns,"rect");
  background.setAttribute("width",String(count+quiet*2));background.setAttribute("height",String(count+quiet*2));background.setAttribute("fill","#fff");
  svg.append(background);
  let d="";
  for(let row=0;row<count;row++)for(let col=0;col<count;col++){
   if(qr.isDark(row,col))d+=`M${col+quiet} ${row+quiet}h1v1h-1z`;
  }
  if(d.length<100)throw Error("EMPTY_QR_MATRIX");
  const path=document.createElementNS(ns,"path");
  path.setAttribute("d",d);path.setAttribute("fill","#101010");svg.append(path);
  root.append(svg);return true;
 }
 if(typeof window.QRCode==="function"){
  new window.QRCode(root,{text:payload,width:220,height:220,
   colorDark:"#101010",colorLight:"#ffffff",correctLevel:window.QRCode.CorrectLevel.M});
  const ensure=()=>{
   const canvas=root.querySelector("canvas"),img=root.querySelector("img");
   if(canvas){canvas.style.display="block";canvas.style.width="220px";canvas.style.height="220px";}
   if(img){
    const usable=img.complete&&img.naturalWidth>0;
    img.style.display=usable&&!canvas?"block":"none";
   }
  };
  ensure();setTimeout(ensure,200);return true;
 }
 const warn=document.createElement("p");warn.className="muted";
 warn.textContent="Codul QR nu poate fi afișat. Folosește codul complet și butonul «Copiază codul».";
 root.append(warn);return false;
};
})();