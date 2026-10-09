/* BARBERCRAFT social/passport session resolver.
   Never fall back from Client to PRO or from PRO to Client.
   URLs from PRO explicitly set ?from=pro, otherwise this is a Client page. */
(()=>{
"use strict";
const pending={};
window.BCPassportSession=function(){
 const portal=new URLSearchParams(location.search).get("from")==="pro"?"pro":"client";
 if(!pending[portal]){
  pending[portal]=Promise.resolve(window.BCAuthClient?.(portal,{detectSessionInUrl:false})||null);
 }
 return pending[portal];
};
})();
