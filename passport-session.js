/* BARBERCRAFT social/passport session resolver.
   Never fall back from Client to PRO or from PRO to Client.
   URLs from PRO explicitly set ?from=pro, otherwise this is a Client page. */
(()=>{
"use strict";
const pending={};
const portal=new URLSearchParams(location.search).get("from")==="pro"?"pro":"client";
window.BCPassportSession=function(){
 if(!pending[portal]){
  pending[portal]=Promise.resolve(window.BCAuthClient?.(portal,{detectSessionInUrl:false})||null);
 }
 return pending[portal];
};
// Keep role context when navigating between passports, gallery previews and social pages.
if(portal==="pro"){
 document.addEventListener("DOMContentLoaded",()=>{
  for(const anchor of document.querySelectorAll('a[href^="./"]')){
   const u=new URL(anchor.href,location.href);
   if(/\/(social|passport|passport-preview)\.html$/i.test(u.pathname)){
    u.searchParams.set("from","pro");
    anchor.href=u.href;
   }else if(/\/referral\.html$/i.test(u.pathname)){
    u.searchParams.set("type","pro");
    anchor.href=u.href;
   }
  }
 });
}
})();
