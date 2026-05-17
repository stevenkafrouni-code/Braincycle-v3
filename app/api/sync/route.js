import { NextResponse } from "next/server";

function extractBody(payload) {
  if (!payload) return "";
  if (payload.body?.data) {
    const decoded = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
    return decoded.replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s{2,}/g,' ').trim();
  }
  if (payload.parts) {
    let textPlain="",textHtml="";
    for (const part of payload.parts) {
      if (part.mimeType==='text/plain'&&part.body?.data) textPlain=Buffer.from(part.body.data,'base64url').toString('utf-8').trim();
      if (part.mimeType==='text/html'&&part.body?.data) textHtml=Buffer.from(part.body.data,'base64url').toString('utf-8').replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s{2,}/g,' ').trim();
      if (part.parts) { const nested=extractBody(part); if (nested) textPlain=textPlain||nested; }
    }
    return textPlain||textHtml;
  }
  return "";
}

export async function POST(request) {
  try {
    const accessToken=request.cookies.get("google_access_token")?.value;
    if (!accessToken) return NextResponse.json({error:"Not authenticated"},{status:401});
    const [calendarRes,gmailRes,tasksListRes]=await Promise.all([
      fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?"+new URLSearchParams({timeMin:new Date(new Date().setHours(0,0,0,0)).toISOString(),timeMax:new Date(new Date().setHours(23,59,59,999)).toISOString(),singleEvents:"true",orderBy:"startTime",maxResults:"20"}),{headers:{Authorization:"Bearer "+accessToken}}),
      fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?"+new URLSearchParams({q:"in:inbox -category:promotions -category:social newer_than:2d",maxResults:"25"}),{headers:{Authorization:"Bearer "+accessToken}}),
      fetch("https://tasks.googleapis.com/tasks/v1/users/@me/lists",{headers:{Authorization:"Bearer "+accessToken}}),
    ]);
    let meetings=[];
    if (calendarRes.ok) { const d=await calendarRes.json(); meetings=(d.items||[]).map(e=>({id:e.id,title:e.summary||"Untitled",time:e.start?.dateTime?new Date(e.start.dateTime).toLocaleTimeString("en-AU",{hour:"2-digit",minute:"2-digit",hour12:false}):"All day",endTime:e.end?.dateTime?new Date(e.end.dateTime).toLocaleTimeString("en-AU",{hour:"2-digit",minute:"2-digit",hour12:false}):"",location:e.location||""})); }
    let emails=[];
    if (gmailRes.ok) {
      const gd=await gmailRes.json();
      const ids=(gd.messages||[]).slice(0,25);
      const details=await Promise.all(ids.map(m=>fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/"+m.id+"?format=full",{headers:{Authorization:"Bearer "+accessToken}}).then(r=>r.json())));
      emails=details.map(msg=>{
        const headers=msg.payload?.headers||[];
        const from=headers.find(h=>h.name==="From")?.value||"";
        const subject=headers.find(h=>h.name==="Subject")?.value||"(no subject)";
        const date=headers.find(h=>h.name==="Date")?.value||"";
        const fromName=from.replace(/<.*>/,"").trim().replace(/"/g,"")||from.split("@")[0];
        const fromEmail=(from.match(/<(.+)>/)||[,from])[1];
        const snippet=msg.snippet||"";
        const fullBody=extractBody(msg.payload)||snippet;
        const isUnread=(msg.labelIds||[]).includes("UNREAD");
        const isUrgent=/urgent|asap|deadline|overdue|payment|invoice|legal|sign|contract/i.test(subject+snippet);
        return {id:msg.id,from:fromName,email:fromEmail,subject,preview:snippet.slice(0,100),body:fullBody,date,isUnread,priority:isUrgent?"high":"medium",suggestedAction:"reply",draftReply:"",reason:isUrgent?"Flagged urgent":"Unread email",actioned:false};
      });
    }
    let tasks=[];
    if (tasksListRes.ok) {
      const ld=await tasksListRes.json();
      const listId=ld.items?.[0]?.id;
      if (listId) { const tr=await fetch("https://tasks.googleapis.com/tasks/v1/lists/"+listId+"/tasks?showCompleted=false&maxResults=20",{headers:{Authorization:"Bearer "+accessToken}}); if (tr.ok) { const td=await tr.json(); tasks=(td.items||[]).map(t=>({id:t.id,text:t.title,priority:"p2",due:"today",done:false,notes:t.notes||""})); } }
    }
    return NextResponse.json({meetings,emails,tasks});
  } catch(error) { return NextResponse.json({error:"Sync failed: "+error.message},{status:500}); }
}
