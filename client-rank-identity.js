/* A public social identity rank, always from verified visits on server. */
(async()=>{"use strict";
 const badge=document.getElementById("clientRankBadge");if(!badge)return;
 try{
  if(!window.BCPassportSession)return;
  const sb=await window.BCPassportSession();
  const {data:{user}}=await sb.auth.getUser();
  if(!user){badge.textContent="Conectează-te ca să vezi rangul.";return}
  const {data,error}=await sb.rpc("bc_social_client_rank",{p_user:user.id});
  if(error||!data){badge.textContent="✂ Barber Passport";return}
  badge.textContent="🏅 "+data.rank+" · "+data.visits+" tunsori verificate"+
    (data.next_goal?" · "+data.visits+"/"+data.next_goal+" spre "+data.next_rank:" · rang maxim");
 }catch(_){badge.textContent="✂ Barber Passport"}
})();