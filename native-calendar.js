/* A browser cannot silently write to the phone calendar. OS import confirms the event. */
(()=>{"use strict";
const escape=s=>String(s||"").replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n").replace(/;/g,"\\;").replace(/,/g,"\\,");
const stamp=s=>new Date(s).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
function fold(line){let output="",length=0;for(const char of line){const bytes=new TextEncoder().encode(char).length;if(length+bytes>73){output+="\r\n ";length=1}output+=char;length+=bytes}return output}
window.BCNativeCalendar={async sync(event){
 const from=new Date(event.start),to=new Date(event.end);if(!Number.isFinite(from.getTime())||!Number.isFinite(to.getTime())||to<=from)throw Error("Interval calendar invalid");
 const text=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//BARBERCRAFT//Bookings//RO","CALSCALE:GREGORIAN","METHOD:PUBLISH","BEGIN:VEVENT","UID:"+event.id+"@barbercraft","DTSTAMP:"+stamp(new Date()),"DTSTART:"+stamp(from),"DTEND:"+stamp(to),"SUMMARY:"+escape(event.service+" · "+event.salon),"LOCATION:"+escape(event.location),"DESCRIPTION:"+escape(event.description||"Rezervare confirmată în BARBERCRAFT"),"STATUS:CONFIRMED","END:VEVENT","END:VCALENDAR"].map(fold).join("\r\n")+"\r\n";
 const file=new File([text],"barbercraft-programare.ics",{type:"text/calendar"});
 if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:"Programarea ta BARBERCRAFT"});return}
 const url=URL.createObjectURL(file),a=document.createElement("a");a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}};
})();
