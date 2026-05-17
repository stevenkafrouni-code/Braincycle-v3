"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  cover:"#1E130C", coverAlt:"#2A1A10",
  bg:"#D5CFC3", page:"#FAF8F3", border:"#DDD8CE", ruled:"#EAE5DD",
  ink:"#18140F", inkMid:"#4A4540", inkFaint:"#9A928A", inkRed:"#8B2828",
  green:"#1C3820", greenMid:"#3D6645", greenSoft:"#EEF3EE",
  gold:"#A87B28", goldSoft:"#FBF4E6",
  urgent:"#B83020", urgentSoft:"#FDF0EE",
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DSHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const fmt    = d => `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const dkey   = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const addDays = (d,n) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };
const sameDay = (a,b) => dkey(a)===dkey(b);
const today   = () => new Date();

// ── Inline markdown renderer ─────────────────────────────────────────────────
function inl(t) {
  return t.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((p,i) => {
    if (p.startsWith("**")&&p.endsWith("**")) return <strong key={i}>{p.slice(2,-2)}</strong>;
    if (p.startsWith("*")&&p.endsWith("*")&&p.length>2) return <em key={i}>{p.slice(1,-1)}</em>;
    return p;
  });
}
function MD({ text }) {
  if (!text) return null;
  return <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13.5,lineHeight:1.75,color:C.ink}}>
    {text.split("\n").map((line,i) => {
      if (!line.trim()) return <div key={i} style={{height:5}}/>;
      if (line.startsWith("## "))  return <div key={i} style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:600,margin:"12px 0 4px"}}>{inl(line.slice(3))}</div>;
      if (line.startsWith("### ")) return <div key={i} style={{fontSize:10,fontWeight:600,color:C.greenMid,textTransform:"uppercase",letterSpacing:"0.08em",margin:"8px 0 3px"}}>{inl(line.slice(4))}</div>;
      if (line.match(/^[-•] /))   return <div key={i} style={{display:"flex",gap:8,marginBottom:3}}><span style={{color:C.greenMid,flexShrink:0}}>◦</span><span>{inl(line.slice(2))}</span></div>;
      if (line.match(/^\d+\. /)) { const m=line.match(/^(\d+)\. (.*)/); return <div key={i} style={{display:"flex",gap:8,marginBottom:3}}><span style={{color:C.greenMid,flexShrink:0,minWidth:14}}>{m[1]}.</span><span>{inl(m[2])}</span></div>; }
      return <div key={i} style={{marginBottom:1}}>{inl(line)}</div>;
    })}
  </div>;
}
function Dots() {
  return <div style={{display:"flex",gap:4,alignItems:"center",padding:"4px 0"}}>
    {[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:C.inkFaint,animation:`bc-dot 1.2s ${i*0.2}s ease-in-out infinite`}}/>)}
  </div>;
}

// ── Priority badges ──────────────────────────────────────────────────────────
const PRI = {
  p1:{bg:"#FDF0EE",col:"#B83020",label:"P1"},
  p2:{bg:"#FBF4E6",col:"#A87B28",label:"P2"},
  p3:{bg:"#EEF3EE",col:"#3D6645",label:"P3"},
};

// ── Section header ───────────────────────────────────────────────────────────
function SH({ label, right, badge, compose, onClick, chevron }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:13,cursor:onClick?"pointer":"default"}} onClick={onClick}>
      <span style={{fontSize:9.5,fontWeight:600,letterSpacing:"0.14em",color:C.inkRed,textTransform:"uppercase",flexShrink:0}}>{label}</span>
      <div style={{flex:1,height:1,background:C.ruled}}/>
      {badge && <span style={{fontSize:9.5,padding:"2px 7px",borderRadius:4,fontWeight:600,flexShrink:0,...badge}}>{badge.text}</span>}
      {compose && <button onClick={e=>{e.stopPropagation();compose();}} style={{padding:"4px 12px",background:C.green,color:"#fff",border:"none",borderRadius:7,fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",flexShrink:0}}>✏️ New Email</button>}
      {chevron!==undefined && <span style={{fontSize:12,color:C.inkFaint,transition:"transform 0.2s",transform:chevron?"":"rotate(-90deg)"}}>▾</span>}
    </div>
  );
}

// ── Input styles ─────────────────────────────────────────────────────────────
const inp = {
  width:"100%",padding:"8px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,
  fontSize:13,color:C.ink,fontFamily:"'DM Sans',sans-serif",outline:"none",
  background:"rgba(255,255,255,0.7)",transition:"border-color 0.2s",boxSizing:"border-box",
};

// ════════════════════════════════════════════════════════════════════════════
export default function Braincycle({ googleConnected = false }) {
  // ── Navigation ──────────────────────────────────────────────────────────
  const [view,      setView]      = useState("diary");
  const [diaryView, setDiaryView] = useState("day");
  const [selDate,   setSelDate]   = useState(today());

  // ── Day data ────────────────────────────────────────────────────────────
  const [dayData,     setDayData]     = useState({meetings:[],emails:[],tasks:[],notes:""});
  const [syncing,     setSyncing]     = useState(false);
  const [addTaskText, setAddTaskText] = useState("");
  const [expandedTask,setExpandedTask]= useState(null);

  // ── Chat ────────────────────────────────────────────────────────────────
  const [msgs,       setMsgs]       = useState([{role:"assistant",content:`Good ${new Date().getHours()<12?"morning":new Date().getHours()<17?"afternoon":"evening"}, Steven. Your diary is open for **${fmt(today())}**.\n\nI'm connected to Gmail, Calendar, Tasks and Drive. Hit **Sync Today** to load your day, or ask me anything.`}]);
  const [chatInput,  setChatInput]  = useState("");
  const [chatLoading,setChatLoading]= useState(false);
  const [chatOpen,   setChatOpen]   = useState(true);
  const [ariaFloat,  setAriaFloat]  = useState(false);

  // ── Modals ──────────────────────────────────────────────────────────────
  const [emailModal,  setEmailModal]  = useState(null);
  const [modalDraft,  setModalDraft]  = useState("");
  const [modalTo,     setModalTo]     = useState("");
  const [modalCc,     setModalCc]     = useState("");
  const [modalTab,    setModalTab]    = useState("reply");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo,   setComposeTo]   = useState("");
  const [composeCc,   setComposeCc]   = useState("");
  const [composeSub,  setComposeSub]  = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [abSuggestions, setAbSuggestions] = useState([]);
  const [abField,     setAbField]     = useState(null);

  // ── Search & notes ──────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [notesIndex,  setNotesIndex]  = useState([]);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved,  setNotesSaved]  = useState(false);

  // ── Notifications ───────────────────────────────────────────────────────
  const [notifs,    setNotifs]    = useState([]);
  const [nextScan,  setNextScan]  = useState(3600);
  const [scanning,  setScanning]  = useState(false);
  const [lastScan,  setLastScan]  = useState(null);

  // ── Team ────────────────────────────────────────────────────────────────
  const [teamTasks,  setTeamTasks]  = useState([]);
  const [teamMember, setTeamMember] = useState("");
  const [teamTask,   setTeamTask]   = useState("");

  // ── Settings ────────────────────────────────────────────────────────────
  const [vipSenders,setVipSenders] = useState("");
  const [keywords,  setKeywords]   = useState("urgent, invoice, contract, deadline, payment, legal, ASAP, sign, overdue");
  const [saved,     setSaved]       = useState(false);

  const chatEndRef = useRef(null);
  const taRef      = useRef(null);
  const notesTimer = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({behavior:"smooth"}); }, [msgs, chatLoading]);
  useEffect(() => {
    if (taRef.current) { taRef.current.style.height="auto"; taRef.current.style.height=Math.min(taRef.current.scrollHeight,120)+"px"; }
  }, [chatInput]);

  // ── Load day ─────────────────────────────────────────────────────────────
  const loadDay = useCallback(async (date) => {
    try {
      const raw = localStorage.getItem(`bc-day-${dkey(date)}`);
      if (raw) setDayData(JSON.parse(raw));
      else setDayData({meetings:[],emails:[],tasks:[],notes:""});
    } catch { setDayData({meetings:[],emails:[],tasks:[],notes:""}); }
  }, []);

  useEffect(() => { loadDay(selDate); }, [selDate, loadDay]);

  const saveDay = useCallback(async (data, date=selDate) => {
    localStorage.setItem(`bc-day-${dkey(date)}`, JSON.stringify(data));
  }, [selDate]);

  // ── Notes index ──────────────────────────────────────────────────────────
  const updateIndex = useCallback(async (date, data) => {
    const content = [data.notes||"", ...(data.tasks||[]).map(t=>[t.text,t.notes||""].join(" "))].join(" | ").trim();
    if (!content) return;
    const raw = localStorage.getItem("bc-notes-index");
    let idx = []; try { if(raw) idx=JSON.parse(raw); } catch {}
    const key = dkey(date); const i = idx.findIndex(e=>e.date===key);
    const entry = {date:key, dateDisplay:fmt(date), content};
    if (i>=0) idx[i]=entry; else idx.push(entry);
    idx.sort((a,b)=>b.date.localeCompare(a.date));
    const trimmed = idx.slice(0,730);
    localStorage.setItem("bc-notes-index", JSON.stringify(trimmed));
    setNotesIndex(trimmed);
  }, []);

  const getResults = () => {
    const q = searchQuery.toLowerCase().trim();
    if (!q || q.length<2) return [];
    return notesIndex.filter(e=>e.content.toLowerCase().includes(q));
  };

  // ── Contacts ─────────────────────────────────────────────────────────────
  const CONTACTS = [
    {name:"Arch",          email:"arch@misspickle.com.au"},
    {name:"Maria Kafrouni",email:"maria@misspickle.com.au"},
    {name:"Ange",          email:"ange@leasewise.com.au"},
    {name:"Kristina",      email:"kristina@leasewise.com.au"},
    {name:"Bishal",        email:"bishal@misspickle.com.au"},
    {name:"Pankaj",        email:"pankaj@misspickle.com.au"},
    {name:"Bishnu",        email:"bishnu@misspickle.com.au"},
    {name:"Chloe Kafrouni",email:"chloe@kafrouni.com.au"},
    {name:"T (Point Cook)",email:"t.pointcook@misspickle.com.au"},
  ];

  const filterContacts = (val) => {
    if (!val.trim()) { setAbSuggestions([]); return; }
    const q = val.toLowerCase();
    setAbSuggestions(CONTACTS.filter(c=>c.name.toLowerCase().includes(q)||c.email.toLowerCase().includes(q)));
  };

  // ── Sync today ───────────────────────────────────────────────────────────
  const syncToday = async () => {
    setSyncing(true);
    const prompt = `Today is ${fmt(selDate)}.
Call Google Calendar (today's events), Gmail (important unread, VIP: ${vipSenders||"none"}, keywords: ${keywords}), Google Tasks (due/overdue).
Return ONLY valid JSON:
{"meetings":[{"id":"1","time":"09:00","endTime":"10:00","title":"...","location":"..."}],"emails":[{"id":"1","from":"Name","email":"addr","subject":"...","preview":"...","priority":"high|medium","suggestedAction":"reply|flag|delete|review","draftReply":"...","reason":"..."}],"tasks":[{"id":"1","text":"...","priority":"p1|p2|p3","due":"today|overdue"}]}`;
    try {
      const res  = await fetch("/api/sync", {method:"POST"});
      const data = await res.json();
      const merged = {
        meetings: data.meetings||[],
        emails:   (data.emails||[]),
        tasks:    dayData.tasks.length ? dayData.tasks : (data.tasks||[]),
        notes:    dayData.notes||"",
      };
      setDayData(merged); await saveDay(merged);
    } catch(e) { console.error("Sync error",e); }
    finally { setSyncing(false); }
  };

  // ── Chat ─────────────────────────────────────────────────────────────────
  const sendChat = async (override=null) => {
    const text = override ?? chatInput;
    if (!text?.trim() || chatLoading) return;
    if (!override) setChatInput("");
    const next = [...msgs, {role:"user",content:text}];
    setMsgs(next); setChatLoading(true);
    try {
      const res  = await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:next.map(m=>({role:m.role,content:m.content}))})});
      const data = await res.json();
      const reply = (data.content||[]).filter(x=>x.type==="text").map(x=>x.text).join("\n")||"Sorry, try again.";
      setMsgs(p=>[...p,{role:"assistant",content:reply}]);
    } catch { setMsgs(p=>[...p,{role:"assistant",content:"Connection issue — check your network and try again."}]); }
    finally { setChatLoading(false); }
  };

  // ── Task ops ─────────────────────────────────────────────────────────────
  const toggleTask = async (id) => {
    const u = {...dayData,tasks:dayData.tasks.map(t=>t.id===id?{...t,done:!t.done}:t)};
    setDayData(u); await saveDay(u);
  };
  const addTask = async () => {
    if (!addTaskText.trim()) return;
    const t = {id:`m-${Date.now()}`,text:addTaskText.trim(),priority:"p2",due:"today",done:false,notes:""};
    const u = {...dayData,tasks:[...dayData.tasks,t]};
    setDayData(u); await saveDay(u); setAddTaskText("");
  };
  const updateTaskNote = async (id,note) => {
    const u = {...dayData,tasks:dayData.tasks.map(t=>t.id===id?{...t,notes:note}:t)};
    setDayData(u); await saveDay(u); await updateIndex(selDate,u);
  };
  const updateNotes = async (text) => {
    const u = {...dayData,notes:text}; setDayData(u);
    setNotesSaved(false); setNotesSaving(false);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(()=>{ setNotesSaving(true); saveDay(u); updateIndex(selDate,u); setTimeout(()=>{setNotesSaving(false);setNotesSaved(true);setTimeout(()=>setNotesSaved(false),3000);},400); },5000);
  };
  const saveNotesNow = async () => {
    clearTimeout(notesTimer.current);
    setNotesSaving(true); await saveDay(dayData); await updateIndex(selDate,dayData);
    setNotesSaving(false); setNotesSaved(true); setTimeout(()=>setNotesSaved(false),3000);
  };

  // ── Email ops ─────────────────────────────────────────────────────────────
  const markActioned = async (id) => {
    const u = {...dayData,emails:dayData.emails.map(e=>e.id===id?{...e,actioned:true}:e)};
    setDayData(u); await saveDay(u);
  };
  const approveEmail = () => {
    const ccNote = modalCc ? ` CC: ${modalCc}.` : "";
    const action = modalTab==="forward"?"forward":"send";
    const id = emailModal?.id;
    setEmailModal(null);
    if (id) markActioned(id);
    sendChat(`I've approved — please ${action} this email to ${modalTo}.${ccNote} Draft:\n\n"${modalDraft.slice(0,120)}…"`);
  };

  // ── Team ─────────────────────────────────────────────────────────────────
  const addTeamTask = () => {
    if (!teamMember.trim()||!teamTask.trim()) return;
    const u = [...teamTasks,{id:Date.now(),member:teamMember.trim(),task:teamTask.trim()}];
    setTeamTasks(u); localStorage.setItem("bc-team",JSON.stringify(u)); setTeamMember(""); setTeamTask("");
  };
  const removeTeamTask = (id) => {
    const u = teamTasks.filter(t=>t.id!==id); setTeamTasks(u); localStorage.setItem("bc-team",JSON.stringify(u));
  };

  // ── Calendar helpers ──────────────────────────────────────────────────────
  const weekDays = () => { const d=new Date(selDate); d.setDate(d.getDate()-d.getDay()); return Array.from({length:7},(_,i)=>addDays(d,i)); };
  const monthDays = () => {
    const first=new Date(selDate.getFullYear(),selDate.getMonth(),1);
    const last=new Date(selDate.getFullYear(),selDate.getMonth()+1,0);
    const days=[]; for(let i=0;i<first.getDay();i++) days.push(null);
    for(let i=1;i<=last.getDate();i++) days.push(new Date(selDate.getFullYear(),selDate.getMonth(),i));
    return days;
  };

  const unread = notifs.filter(n=>!n.read).length;
  const fmtNext = s => { const m=Math.floor(s/60); return `${m}:${String(s%60).padStart(2,"0")}`; };

  // ── Render helpers ────────────────────────────────────────────────────────
  const navBtn = (id, icon, label, badge=false) => (
    <button key={id} onClick={()=>setView(id)} style={{width:52,paddingTop:7,paddingBottom:6,borderRadius:10,border:"none",background:view===id?"rgba(255,255,255,0.15)":"transparent",color:view===id?"#fff":"rgba(255,255,255,0.3)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,transition:"all 0.2s",position:"relative"}}
      onMouseEnter={e=>{if(view!==id)e.currentTarget.style.color="rgba(255,255,255,0.65)";}}
      onMouseLeave={e=>{if(view!==id)e.currentTarget.style.color="rgba(255,255,255,0.3)";}}>
      <span style={{fontSize:16,lineHeight:1}}>{icon}</span>
      <span style={{fontSize:8.5,fontWeight:500,letterSpacing:"0.05em",textTransform:"uppercase",fontFamily:"'DM Sans',sans-serif",lineHeight:1}}>{label}</span>
      {badge && unread>0 && <div style={{position:"absolute",top:3,right:5,width:14,height:14,borderRadius:"50%",background:C.urgent,color:"#fff",fontSize:7,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{unread>9?"9+":unread}</div>}
    </button>
  );

  const chatPanel = (endRef, float=false) => (
    <div style={{display:"flex",flexDirection:"column",height:float?"100%":undefined}}>
      {msgs.length<=1&&(
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
          {[{l:"☀️ Briefing",p:"Generate my daily briefing — meetings, key emails, tasks, and one strategic insight for today."},{l:"✉️ Draft Email",p:"I need to draft an email. Ask me the details."},{l:"💡 Strategy",p:"Let's think through Miss Pickle strategy. Ask me what to focus on."},{l:"✅ Add Task",p:"Add a task. Ask me the details."}].map(a=>(
            <button key={a.l} onClick={()=>sendChat(a.p)} style={{padding:"5px 12px",background:"rgba(255,255,255,0.6)",border:`1px solid ${C.border}`,borderRadius:20,fontSize:11.5,color:C.inkMid,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.greenMid;e.currentTarget.style.color=C.ink;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.inkMid;}}>
              {a.l}
            </button>
          ))}
        </div>
      )}
      <div style={{flex:float?1:undefined,overflowY:"auto",maxHeight:float?undefined:440,display:"flex",flexDirection:"column",gap:9,paddingRight:2,marginBottom:12}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",alignItems:"flex-end",gap:7,justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            {m.role==="assistant"&&<div style={{width:20,height:20,borderRadius:5,background:C.green,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"'Cormorant Garamond',serif",color:"#fff",fontSize:12,fontStyle:"italic",fontWeight:600}}>B</div>}
            <div style={{maxWidth:"84%",padding:m.role==="user"?"9px 13px":"11px 14px",borderRadius:m.role==="user"?"12px 12px 2px 12px":"2px 12px 12px 12px",background:m.role==="user"?C.green:"rgba(255,255,255,0.72)",border:m.role==="user"?"none":`1px solid ${C.border}`}}>
              {m.role==="user"?<span style={{fontSize:13.5,color:"#fff",lineHeight:1.55,fontFamily:"'DM Sans',sans-serif"}}>{m.content}</span>:<MD text={m.content}/>}
            </div>
          </div>
        ))}
        {chatLoading&&<div style={{display:"flex",alignItems:"flex-end",gap:7}}><div style={{width:20,height:20,borderRadius:5,background:C.green,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"'Cormorant Garamond',serif",color:"#fff",fontSize:12,fontStyle:"italic",fontWeight:600}}>B</div><div style={{padding:"11px 14px",background:"rgba(255,255,255,0.72)",border:`1px solid ${C.border}`,borderRadius:"2px 12px 12px 12px"}}><Dots/></div></div>}
        <div ref={endRef}/>
      </div>
      <div style={{borderTop:`1px solid ${C.ruled}`,paddingTop:12,display:"flex",gap:7,alignItems:"flex-end"}}>
        <textarea ref={float?undefined:taRef} value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat();}}} placeholder="Write to Braincycle…" rows={1}
          style={{flex:1,background:"transparent",border:"none",borderBottom:`1.5px solid ${C.border}`,outline:"none",resize:"none",fontSize:13.5,color:C.ink,fontFamily:"'DM Sans',sans-serif",fontWeight:400,lineHeight:1.55,padding:"3px 0 6px",maxHeight:110,overflow:"auto",transition:"border-color 0.2s"}}
          onFocus={e=>(e.target.style.borderBottomColor=C.green)} onBlur={e=>(e.target.style.borderBottomColor=C.border)}/>
        <button onClick={()=>sendChat()} disabled={!chatInput.trim()||chatLoading} style={{width:32,height:32,borderRadius:8,background:chatInput.trim()&&!chatLoading?C.green:C.border,border:"none",cursor:chatInput.trim()&&!chatLoading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#fff",fontSize:14,transition:"all 0.2s"}}>↑</button>
      </div>
      <div style={{fontSize:9.5,color:C.inkFaint,marginTop:6,textAlign:"center"}}>Enter to send · Shift+Enter for new line</div>
    </div>
  );

  const floatChatEndRef = useRef(null);

  // ── Not connected banner ──────────────────────────────────────────────────
  if (!googleConnected) {
    return (
      <div style={{display:"flex",height:"100vh",alignItems:"center",justifyContent:"center",background:C.bg}}>
        <div style={{background:C.page,borderRadius:20,padding:"48px 44px",maxWidth:480,width:"92%",boxShadow:"0 32px 100px rgba(0,0,0,0.15)",border:`1px solid ${C.border}`,textAlign:"center"}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:52,fontWeight:400,fontStyle:"italic",color:C.ink,marginBottom:8}}>Braincycle</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontStyle:"italic",color:C.inkMid,marginBottom:32}}>Your personal AI diary</div>
          <a href="/api/google/auth" style={{display:"block",padding:"14px",background:C.green,color:"#fff",borderRadius:12,fontSize:14,fontWeight:500,textDecoration:"none",fontFamily:"'DM Sans',sans-serif",marginBottom:12,transition:"opacity 0.2s"}}
            onMouseEnter={e=>(e.target.style.opacity="0.85")} onMouseLeave={e=>(e.target.style.opacity="1")}>
            Connect Google Account →
          </a>
          <div style={{fontSize:12,color:C.inkFaint,lineHeight:1.65}}>Connects Gmail, Calendar, Tasks and Drive. Your Anthropic API key is secured server-side.</div>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div style={{display:"flex",height:"100vh",overflow:"hidden",background:C.bg}}>

      {/* Email modal */}
      {emailModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(14,9,4,0.6)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300}} onClick={()=>setEmailModal(null)}>
          <div style={{background:C.page,borderRadius:16,padding:"32px 36px",maxWidth:560,width:"94%",boxShadow:"0 32px 100px rgba(0,0,0,0.22)",border:`1px solid ${C.border}`}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:9.5,fontWeight:600,letterSpacing:".14em",color:C.inkRed,textTransform:"uppercase",marginBottom:8}}>Email Action</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:500,marginBottom:3}}>{emailModal.from}</div>
            <div style={{fontSize:13.5,color:C.inkMid,marginBottom:14}}>{emailModal.subject}</div>
            <div style={{background:"rgba(255,255,255,0.6)",border:`1px solid ${C.border}`,borderRadius:9,padding:"12px 16px",marginBottom:14,maxHeight:180,overflowY:"auto",fontSize:13,lineHeight:1.7,color:C.ink,fontFamily:"'DM Sans',sans-serif",whiteSpace:"pre-wrap"}}>{emailModal.body||emailModal.preview}</div>
            <div style={{background:C.greenSoft,borderRadius:9,padding:"12px 16px",marginBottom:16}}>
              <div style={{fontSize:9,fontWeight:600,letterSpacing:".1em",color:C.greenMid,textTransform:"uppercase",marginBottom:4}}>Braincycle suggests</div>
              <div style={{fontSize:13,color:C.ink,lineHeight:1.6}}>{emailModal.reason}</div>
            </div>
            <div style={{display:"flex",gap:4,marginBottom:14,background:"rgba(0,0,0,0.06)",borderRadius:8,padding:3,width:"fit-content"}}>
              {["reply","forward"].map(t=>(
                <button key={t} onClick={()=>setModalTab(t)} style={{padding:"5px 14px",borderRadius:6,border:"none",fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",background:modalTab===t?C.green:"transparent",color:modalTab===t?"#fff":C.inkMid,transition:"all 0.18s",textTransform:"capitalize"}}>{t}</button>
              ))}
            </div>
            {[["To",modalTo,setModalTo,"Reply to…"],["CC",modalCc,setModalCc,"CC (optional)…"]].map(([label,val,setter,ph])=>(
              <div key={label} style={{marginBottom:8}}>
                <div style={{fontSize:9.5,fontWeight:600,letterSpacing:".1em",color:C.inkRed,textTransform:"uppercase",marginBottom:4}}>{label}</div>
                <input value={val} onChange={e=>setter(e.target.value)} placeholder={ph} style={{...inp,marginBottom:0}} onFocus={e=>(e.target.style.borderColor=C.greenMid)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
              </div>
            ))}
            <div style={{fontSize:9.5,fontWeight:600,letterSpacing:".12em",color:C.inkRed,textTransform:"uppercase",margin:"12px 0 6px"}}>Draft — awaiting approval</div>
            <textarea value={modalDraft} onChange={e=>setModalDraft(e.target.value)} onFocus={e=>(e.target.style.borderColor=C.greenMid)} onBlur={e=>(e.target.style.borderColor=C.border)} style={{width:"100%",height:110,padding:"12px 14px",borderRadius:9,border:`1.5px solid ${C.border}`,resize:"none",fontSize:13,lineHeight:1.65,color:C.ink,fontFamily:"'DM Sans',sans-serif",background:"rgba(255,255,255,0.7)",outline:"none",boxSizing:"border-box",marginBottom:16,transition:"border-color 0.2s"}}/>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <button onClick={approveEmail} style={{padding:"9px 20px",background:C.green,color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>✓ Approve & {modalTab==="forward"?"Forward":"Send"}</button>
              <button onClick={()=>{markActioned(emailModal.id);setEmailModal(null);sendChat(`Help me think through my response to ${emailModal.from} about "${emailModal.subject}". Should I loop anyone in?`);}} style={{padding:"9px 20px",background:"transparent",color:C.ink,border:`1.5px solid ${C.border}`,borderRadius:9,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Discuss with Braincycle</button>
              <button onClick={()=>{markActioned(emailModal.id);setEmailModal(null);}} style={{padding:"9px 20px",background:"transparent",color:C.inkFaint,border:`1px solid ${C.border}`,borderRadius:9,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Dismiss</button>
            </div>
            <div style={{fontSize:10,color:C.inkFaint,marginTop:10}}>All emails require your approval before sending</div>
          </div>
        </div>
      )}

      {/* Compose modal */}
      {composeOpen&&(
        <div style={{position:"fixed",inset:0,background:"rgba(14,9,4,0.6)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300}} onClick={()=>setComposeOpen(false)}>
          <div style={{background:C.page,borderRadius:16,padding:"32px 36px",maxWidth:580,width:"94%",boxShadow:"0 32px 100px rgba(0,0,0,0.22)",border:`1px solid ${C.border}`}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div style={{fontSize:9.5,fontWeight:600,letterSpacing:".14em",color:C.inkRed,textTransform:"uppercase"}}>New Email</div>
              <button onClick={()=>setComposeOpen(false)} style={{background:"none",border:"none",color:C.inkFaint,cursor:"pointer",fontSize:20,lineHeight:1}}>×</button>
            </div>
            {[["To",composeTo,setComposeTo,"Name or email…"],["CC",composeCc,setComposeCc,"CC (optional)…"],["Subject",composeSub,setComposeSub,"Subject…"]].map(([label,val,setter,ph])=>(
              <div key={label} style={{marginBottom:9}}>
                <div style={{fontSize:9.5,fontWeight:600,letterSpacing:".1em",color:C.inkRed,textTransform:"uppercase",marginBottom:4}}>{label}</div>
                <div style={{position:"relative"}}>
                  <input value={val} onChange={e=>{setter(e.target.value);if(label==="To"){filterContacts(e.target.value);setAbField("to");}else if(label==="CC"){filterContacts(e.target.value);setAbField("cc");}}} onBlur={()=>setTimeout(()=>{setAbSuggestions([]);setAbField(null);},200)} style={{...inp}} onFocus={e=>(e.target.style.borderColor=C.greenMid)} placeholder={ph}/>
                  {abField===label.toLowerCase()&&abSuggestions.length>0&&(
                    <div style={{position:"absolute",top:"100%",left:0,right:0,background:C.page,border:`1.5px solid ${C.border}`,borderRadius:9,boxShadow:"0 8px 24px rgba(0,0,0,0.1)",zIndex:10,maxHeight:180,overflowY:"auto",marginTop:3}}>
                      {abSuggestions.map(c=>(
                        <div key={c.email} onClick={()=>{setter(`${c.name} <${c.email}>`);setAbSuggestions([]);}} style={{padding:"9px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,transition:"background 0.12s"}} onMouseEnter={e=>(e.currentTarget.style.background=C.greenSoft)} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                          <div><div style={{fontSize:13,fontWeight:500}}>{c.name}</div><div style={{fontSize:11.5,color:C.inkFaint}}>{c.email}</div></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div style={{marginBottom:9}}>
              <div style={{fontSize:9.5,fontWeight:600,letterSpacing:".1em",color:C.inkRed,textTransform:"uppercase",marginBottom:4}}>Message</div>
              <textarea value={composeBody} onChange={e=>setComposeBody(e.target.value)} placeholder="Write your email, or ask Braincycle to draft it…" style={{width:"100%",height:140,padding:"12px 14px",borderRadius:9,border:`1.5px solid ${C.border}`,resize:"none",fontSize:13.5,lineHeight:1.65,color:C.ink,fontFamily:"'DM Sans',sans-serif",background:"rgba(255,255,255,0.7)",outline:"none",boxSizing:"border-box",transition:"border-color 0.2s"}} onFocus={e=>(e.target.style.borderColor=C.greenMid)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
            </div>
            <div style={{display:"flex",gap:9,flexWrap:"wrap",marginTop:4}}>
              <button onClick={()=>{setComposeOpen(false);sendChat(`I've approved this email — please send it to ${composeTo}${composeCc?`, CC ${composeCc}`:""}.\nSubject: ${composeSub}\n\n"${composeBody.slice(0,120)}…"`);}} style={{padding:"9px 20px",background:C.green,color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>✓ Approve & Send</button>
              <button onClick={()=>{setComposeOpen(false);sendChat(`Draft this email for me in my voice — warm, direct, personal. To: ${composeTo||"TBD"}. Subject: ${composeSub||"TBD"}. Context: ${composeBody||"ask me what it should say."}`);}} style={{padding:"9px 18px",background:C.greenSoft,color:C.green,border:`1.5px solid ${C.greenMid}`,borderRadius:9,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>✦ Ask Braincycle to draft</button>
              <button onClick={()=>setComposeOpen(false)} style={{padding:"9px 18px",background:"transparent",color:C.inkFaint,border:`1px solid ${C.border}`,borderRadius:9,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Discard</button>
            </div>
          </div>
        </div>
      )}

      {/* Braincycle float overlay */}
      {ariaFloat&&(
        <div style={{position:"fixed",inset:0,background:"rgba(14,9,4,0.55)",backdropFilter:"blur(8px)",display:"flex",alignItems:"flex-end",zIndex:250}} onClick={()=>setAriaFloat(false)}>
          <div style={{width:"100%",height:"70vh",background:C.page,borderRadius:"20px 20px 0 0",display:"flex",flexDirection:"column",boxShadow:"0 -20px 60px rgba(0,0,0,0.18)"}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:"16px 24px",borderBottom:`1px solid ${C.ruled}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:26,height:26,borderRadius:7,background:C.green,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Cormorant Garamond',serif",color:"#fff",fontSize:15,fontStyle:"italic",fontWeight:600}}>B</div>
                <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:19,fontStyle:"italic",color:C.ink}}>Braincycle</span>
              </div>
              <button onClick={()=>setAriaFloat(false)} style={{background:"none",border:"none",color:C.inkFaint,cursor:"pointer",fontSize:22,lineHeight:1}}>×</button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"18px 24px"}}>{chatPanel(floatChatEndRef,true)}</div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div style={{width:66,background:C.cover,display:"flex",flexDirection:"column",alignItems:"center",paddingTop:18,paddingBottom:20,gap:2,flexShrink:0,boxShadow:"4px 0 20px rgba(0,0,0,0.3)"}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:"rgba(255,255,255,0.92)",fontWeight:600,fontStyle:"italic",marginBottom:22}}>B</div>
        {navBtn("diary","🗓","Diary")}
        {navBtn("mail","📬","Mail")}
        {navBtn("search","🔎","Search")}
        {navBtn("alerts","🔔","Alerts",true)}
        {navBtn("team","👥","Team")}
        {navBtn("settings","⚙️","Settings")}
      </div>

      {/* Main */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* Diary header */}
        {view==="diary"&&(
          <div style={{background:C.coverAlt,padding:"12px 22px",display:"flex",alignItems:"center",gap:12,flexShrink:0,boxShadow:"0 2px 14px rgba(0,0,0,0.22)"}}>
            <button onClick={()=>setSelDate(addDays(selDate,-1))} style={{background:"rgba(255,255,255,0.1)",border:"none",color:"rgba(255,255,255,0.7)",width:28,height:28,borderRadius:6,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
            <div style={{flex:1,textAlign:"center",fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontStyle:"italic",color:"rgba(255,255,255,0.95)"}}>{fmt(selDate)}</div>
            <button onClick={()=>setSelDate(addDays(selDate,1))} style={{background:"rgba(255,255,255,0.1)",border:"none",color:"rgba(255,255,255,0.7)",width:28,height:28,borderRadius:6,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
            {!sameDay(selDate,today())&&<button onClick={()=>setSelDate(today())} style={{background:"rgba(255,255,255,0.11)",border:"1px solid rgba(255,255,255,0.18)",color:"rgba(255,255,255,0.8)",padding:"4px 12px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Today</button>}
            <div style={{display:"flex",background:"rgba(0,0,0,0.2)",borderRadius:7,padding:2,gap:1}}>
              {["day","week","month"].map(v=>(
                <button key={v} onClick={()=>setDiaryView(v)} style={{padding:"4px 11px",borderRadius:5,border:"none",fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",textTransform:"capitalize",transition:"all 0.18s",background:diaryView===v?"rgba(255,255,255,0.2)":"transparent",color:diaryView===v?"#fff":"rgba(255,255,255,0.38)"}}>{v}</button>
              ))}
            </div>
            <button onClick={syncToday} disabled={syncing} style={{background:"rgba(255,255,255,0.13)",border:"1px solid rgba(255,255,255,0.18)",color:"rgba(255,255,255,0.85)",padding:"5px 13px",borderRadius:7,fontSize:11,fontFamily:"'DM Sans',sans-serif",cursor:syncing?"wait":"pointer",display:"flex",alignItems:"center",gap:5,opacity:syncing?0.65:1}}>
              <span style={{display:"inline-block",animation:syncing?"bc-spin 1s linear infinite":undefined}}>⟳</span>{syncing?"Syncing…":"Sync Today"}
            </button>
          </div>
        )}

        {/* Page content */}
        <div style={{flex:1,overflowY:"auto"}}>

          {/* ── DAY VIEW ── */}
          {view==="diary"&&diaryView==="day"&&(
            <div style={{padding:"28px 40px 60px",maxWidth:900,width:"100%"}}>

              {/* Top grid: Meetings + Tasks */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:28,marginBottom:28}}>

                {/* Meetings */}
                <div>
                  <SH label="Meetings"/>
                  {dayData.meetings.length===0&&!syncing&&<div style={{fontSize:13,color:C.inkFaint,fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif"}}>No meetings — sync to load calendar</div>}
                  {syncing&&<Dots/>}
                  {dayData.meetings.map(m=>(
                    <div key={m.id} style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:11}}>
                      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,fontWeight:500,color:C.ink,minWidth:46,textAlign:"right",flexShrink:0,paddingTop:1}}>{m.time}</div>
                      <div style={{width:1,background:C.border,alignSelf:"stretch",flexShrink:0}}/>
                      <div>
                        <div style={{fontSize:13,fontWeight:500,color:C.ink}}>{m.title}</div>
                        {m.location&&m.location!=="Phone"&&m.location!=="Zoom"&&m.location!=="Online"
                          ?<a href={`https://maps.google.com/?q=${encodeURIComponent(m.location)}`} target="_blank" rel="noreferrer" style={{fontSize:11,color:C.greenMid,marginTop:2,display:"inline-flex",alignItems:"center",gap:4,textDecoration:"none"}} onMouseEnter={e=>(e.target.style.textDecoration="underline")} onMouseLeave={e=>(e.target.style.textDecoration="none")}>📍 {m.location} <span style={{fontSize:9,opacity:.7}}>→ Maps</span></a>
                          :m.location&&<div style={{fontSize:11,color:C.inkFaint,marginTop:2}}>{m.location==="Phone"?"📞 Phone":"💻 "+m.location}</div>
                        }
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tasks */}
                <div>
                  <SH label="Tasks" badge={dayData.tasks.filter(t=>!t.done).length>0?{bg:"#FBF4E6",col:"#A87B28",text:`${dayData.tasks.filter(t=>!t.done).length} remaining`}:null}/>
                  {dayData.tasks.map(task=>(
                    <div key={task.id} style={{marginBottom:4}}>
                      <div style={{display:"flex",alignItems:"center",gap:9,padding:"7px 11px",borderRadius:8,background:"rgba(255,255,255,0.5)",border:`1px solid ${C.border}`,opacity:task.done?0.5:1,transition:"opacity 0.2s"}}>
                        <div onClick={()=>toggleTask(task.id)} style={{width:17,height:17,borderRadius:4,border:`2px solid ${task.done?C.greenMid:C.border}`,background:task.done?C.greenMid:"transparent",flexShrink:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s",color:"#fff",fontSize:9}}>
                          {task.done&&"✓"}
                        </div>
                        <span style={{flex:1,fontSize:12.5,color:task.done?C.inkFaint:C.ink,textDecoration:task.done?"line-through":"none"}}>{task.text}</span>
                        {task.priority&&PRI[task.priority]&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:4,fontWeight:600,flexShrink:0,background:PRI[task.priority].bg,color:PRI[task.priority].col}}>{PRI[task.priority].label}</span>}
                        <button onClick={()=>setExpandedTask(expandedTask===task.id?null:task.id)} style={{background:"none",border:"none",color:C.inkFaint,cursor:"pointer",fontSize:12,padding:"0 2px",flexShrink:0}} title="Notes">✎</button>
                      </div>
                      {expandedTask===task.id&&(
                        <div style={{marginLeft:12,padding:"8px 12px",background:"rgba(255,255,255,0.35)",borderRadius:"0 0 8px 8px",borderTop:"none",border:`1px solid ${C.border}`}}>
                          <textarea value={task.notes||""} onChange={e=>updateTaskNote(task.id,e.target.value)} placeholder="Notes…" style={{width:"100%",minHeight:52,background:"transparent",border:"none",outline:"none",resize:"none",fontSize:12.5,color:C.inkMid,fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",lineHeight:1.6}}/>
                        </div>
                      )}
                    </div>
                  ))}
                  <div style={{display:"flex",gap:7,marginTop:8,alignItems:"center"}}>
                    <input value={addTaskText} onChange={e=>setAddTaskText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="+ Add a task…" style={{...inp,flex:1,fontSize:12,padding:"7px 11px",background:"rgba(255,255,255,0.5)"}} onFocus={e=>(e.target.style.borderColor=C.greenMid)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                    {addTaskText.trim()&&<button onClick={addTask} style={{padding:"7px 14px",background:C.green,color:"#fff",border:"none",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",flexShrink:0}}>Add</button>}
                  </div>
                </div>
              </div>

              {/* Emails */}
              <div style={{marginBottom:28}}>
                <SH label="Emails for Action" badge={dayData.emails.filter(e=>!e.actioned).length>0?{bg:"#FDF0EE",col:"#B83020",text:`${dayData.emails.filter(e=>!e.actioned).length} pending`}:null} compose={()=>setComposeOpen(true)}/>
                {dayData.emails.length===0&&!syncing&&<div style={{fontSize:13,color:C.inkFaint,fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif"}}>No flagged emails — sync to load inbox</div>}
                {dayData.emails.map(email=>(
                  <div key={email.id} onClick={()=>{if(!email.actioned){setEmailModal(email);setModalTo(email.email||"");setModalCc("");setModalDraft(email.draftReply||"");setModalTab("reply");}}} style={{display:"flex",alignItems:"center",gap:10,marginBottom:7,padding:"9px 12px",borderRadius:9,background:"rgba(255,255,255,0.65)",border:`1px solid ${C.border}`,cursor:email.actioned?"default":"pointer",opacity:email.actioned?0.45:1,transition:"all 0.18s"}} onMouseEnter={e=>{if(!email.actioned)e.currentTarget.style.borderColor=C.greenMid;}} onMouseLeave={e=>{if(!email.actioned)e.currentTarget.style.borderColor=C.border;}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:email.actioned?C.inkFaint:email.priority==="high"?C.urgent:C.gold,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:7}}>
                        <span style={{fontSize:13,fontWeight:500,color:email.actioned?C.inkFaint:C.ink}}>{email.from}</span>
                        {email.priority==="high"&&!email.actioned&&<span style={{fontSize:9,background:C.urgentSoft,color:C.urgent,padding:"1px 6px",borderRadius:3,fontWeight:600}}>Urgent</span>}
                        {email.actioned&&<span style={{fontSize:10,color:C.inkFaint,fontStyle:"italic"}}>actioned</span>}
                      </div>
                      <div style={{fontSize:11.5,color:C.inkMid,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{email.subject}</div>
                    </div>
                    {!email.actioned&&<div style={{fontSize:11,color:C.greenMid,fontWeight:500,flexShrink:0}}>Action →</div>}
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div style={{marginBottom:32}}>
                <SH label="Notes"/>
                <textarea value={dayData.notes||""} onChange={e=>updateNotes(e.target.value)} placeholder={`Write anything here — thoughts, decisions, payments, follow-ups for ${fmt(selDate)}…`}
                  style={{width:"100%",minHeight:120,background:"rgba(255,255,255,0.5)",border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 18px",resize:"none",fontSize:15,lineHeight:"30px",color:C.ink,fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",outline:"none",boxSizing:"border-box",backgroundImage:"repeating-linear-gradient(transparent,transparent 29px,rgba(234,229,221,0.7) 29px,rgba(234,229,221,0.7) 30px)",backgroundAttachment:"local",transition:"border-color 0.2s"}} onFocus={e=>(e.target.style.borderColor=C.inkRed+"60")} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:7}}>
                  <div style={{fontSize:9,color:C.inkFaint}}>Auto-indexed & searchable → 🔎</div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {notesSaving&&<span style={{fontSize:11,color:C.inkFaint}}>Saving…</span>}
                    {notesSaved&&!notesSaving&&<span style={{fontSize:11,color:C.greenMid}}>✓ Saved</span>}
                    {!notesSaved&&!notesSaving&&dayData.notes&&<button onClick={saveNotesNow} style={{padding:"4px 13px",background:C.green,color:"#fff",border:"none",borderRadius:6,fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Save note</button>}
                  </div>
                </div>
              </div>

              {/* Braincycle chat */}
              <div>
                <SH label="✦ Braincycle" onClick={()=>setChatOpen(o=>!o)} chevron={chatOpen}/>
                {chatOpen&&<div style={{paddingBottom:8}}>{chatPanel(chatEndRef)}</div>}
              </div>
            </div>
          )}

          {/* ── WEEK VIEW ── */}
          {view==="diary"&&diaryView==="week"&&(
            <div style={{padding:"28px 24px",overflowX:"auto"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8,minWidth:700}}>
                {weekDays().map((d,i)=>{
                  const isT=sameDay(d,today()),isSel=sameDay(d,selDate);
                  return <div key={i} onClick={()=>{setSelDate(d);setDiaryView("day");}} style={{background:isSel?"rgba(255,255,255,0.9)":isT?"rgba(255,255,255,0.68)":"rgba(255,255,255,0.4)",borderRadius:12,padding:"16px 14px",cursor:"pointer",border:`2px solid ${isSel?C.inkRed:C.border}`,minHeight:160,transition:"all 0.18s"}}
                    onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background="rgba(255,255,255,0.65)";}} onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background=isT?"rgba(255,255,255,0.68)":"rgba(255,255,255,0.4)";}}>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontStyle:"italic",color:isT?C.inkRed:C.ink}}>{d.getDate()}</div>
                    <div style={{fontSize:10,color:C.inkFaint,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{DSHORT[d.getDay()]}</div>
                    {isT&&dayData.meetings.slice(0,2).map(m=><div key={m.id} style={{fontSize:11,color:C.inkMid,marginBottom:3,display:"flex",alignItems:"center",gap:4}}><span style={{width:5,height:5,borderRadius:"50%",background:C.green,flexShrink:0}}/>{m.time} {m.title}</div>)}
                    {isT&&dayData.tasks.filter(t=>!t.done).slice(0,3).map(t=><div key={t.id} style={{fontSize:11,color:C.inkMid,marginBottom:2,display:"flex",alignItems:"center",gap:4}}><span style={{width:5,height:5,borderRadius:"50%",background:C.gold,flexShrink:0}}/>{t.text}</div>)}
                  </div>;
                })}
              </div>
            </div>
          )}

          {/* ── MONTH VIEW ── */}
          {view==="diary"&&diaryView==="month"&&(
            <div style={{padding:"28px 32px"}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontStyle:"italic",color:C.ink,marginBottom:18}}>{MONTHS[selDate.getMonth()]} {selDate.getFullYear()}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:8}}>
                {DSHORT.map(d=><div key={d} style={{fontSize:10,fontWeight:600,color:C.inkFaint,textTransform:"uppercase",letterSpacing:"0.08em",textAlign:"center",padding:"6px 0"}}>{d}</div>)}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
                {monthDays().map((d,i)=>{
                  if(!d) return <div key={i}/>;
                  const isT=sameDay(d,today()),isSel=sameDay(d,selDate);
                  return <div key={i} onClick={()=>{setSelDate(d);setDiaryView("day");}} style={{background:isSel?C.ink:isT?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.45)",borderRadius:9,padding:"10px 10px",cursor:"pointer",border:`1.5px solid ${isSel?C.ink:C.border}`,minHeight:66,transition:"all 0.15s"}}
                    onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background="rgba(255,255,255,0.72)";}} onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background=isT?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.45)";}}>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:19,color:isSel?"#fff":isT?C.inkRed:C.ink}}>{d.getDate()}</div>
                    {isT&&<div style={{display:"flex",gap:3,marginTop:4}}>
                      {dayData.meetings.length>0&&<div style={{width:6,height:6,borderRadius:"50%",background:C.green}}/>}
                      {dayData.tasks.filter(t=>!t.done).length>0&&<div style={{width:6,height:6,borderRadius:"50%",background:C.gold}}/>}
                      {dayData.emails.filter(e=>!e.actioned).length>0&&<div style={{width:6,height:6,borderRadius:"50%",background:C.urgent}}/>}
                    </div>}
                  </div>;
                })}
              </div>
            </div>
          )}

          {/* ── MAIL VIEW ── */}
          {view==="mail"&&(
            <div style={{padding:"32px 40px",maxWidth:680}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:36,fontStyle:"italic",color:C.ink}}>Mail</div>
                <button onClick={()=>setComposeOpen(true)} style={{padding:"8px 16px",background:C.green,color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>✏️ New Email</button>
              </div>
              <div style={{fontSize:13,color:C.inkMid,marginBottom:22}}>Your full email interface — inbox, drafts, and sent.</div>
              {/* Inbox, Drafts, Sent are fetched via sync and displayed here */}
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontStyle:"italic",color:C.inkFaint,background:"rgba(255,255,255,0.5)",border:`1px solid ${C.border}`,borderRadius:12,padding:"22px 26px"}}>
                Sync your diary to load inbox emails, or switch to the Diary view to see and action emails for today.
              </div>
            </div>
          )}

          {/* ── SEARCH VIEW ── */}
          {view==="search"&&(
            <div style={{padding:"32px 40px",maxWidth:680}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:36,fontStyle:"italic",color:C.ink,marginBottom:8}}>Search Notes</div>
              <div style={{fontSize:13,color:C.inkMid,marginBottom:22}}>Every word you write is indexed. Search names, amounts, decisions, places.</div>
              <div style={{position:"relative",marginBottom:24}}>
                <span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",fontSize:15,color:C.inkFaint,pointerEvents:"none"}}>🔎</span>
                <input autoFocus value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder='Try "Haig", "cash", "Knox", "franchise"…' style={{...inp,paddingLeft:42,fontSize:14,borderRadius:11,height:46,background:"rgba(255,255,255,0.75)"}} onFocus={e=>(e.target.style.borderColor=C.greenMid)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                {searchQuery&&<button onClick={()=>setSearchQuery("")} style={{position:"absolute",right:13,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.inkFaint,cursor:"pointer",fontSize:18,lineHeight:1}}>×</button>}
              </div>
              {searchQuery.length>=2&&(()=>{
                const results=getResults();
                return <div>
                  <div style={{fontSize:11,color:C.inkFaint,marginBottom:14}}>{results.length===0?`No entries for "${searchQuery}"`:`${results.length} entr${results.length===1?"y":"ies"} found`}</div>
                  {results.map(entry=>(
                    <div key={entry.date} onClick={()=>{setSelDate(new Date(entry.date+"T12:00:00"));setView("diary");setDiaryView("day");}} style={{background:"rgba(255,255,255,0.68)",borderRadius:12,border:`1px solid ${C.border}`,padding:"16px 20px",cursor:"pointer",marginBottom:9,transition:"all 0.18s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=C.greenMid;e.currentTarget.style.background="rgba(255,255,255,0.9)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background="rgba(255,255,255,0.68)";}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,fontStyle:"italic",color:C.ink}}>{entry.dateDisplay}</div><div style={{fontSize:11,color:C.greenMid,fontWeight:500}}>Open →</div></div>
                      <div style={{fontSize:13.5,color:C.inkMid,fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",lineHeight:1.65}}>{entry.content.slice(0,140)}{entry.content.length>140?"…":""}</div>
                    </div>
                  ))}
                </div>;
              })()}
              {!searchQuery&&<div style={{background:"rgba(255,255,255,0.5)",borderRadius:12,border:`1px solid ${C.border}`,padding:"22px 26px"}}>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,fontStyle:"italic",color:C.inkMid,lineHeight:1.85}}>Your diary is a permanent, searchable knowledge base. Every note and task annotation is retrievable instantly.</div>
                <div style={{fontSize:11,color:C.inkFaint,marginTop:12}}>{notesIndex.length>0?`${notesIndex.length} day${notesIndex.length!==1?"s":""} indexed`:"Start writing in your diary to build your knowledge base."}</div>
              </div>}
            </div>
          )}

          {/* ── TEAM VIEW ── */}
          {view==="team"&&(
            <div style={{padding:"32px 40px",maxWidth:560}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:36,fontStyle:"italic",color:C.ink,marginBottom:8}}>Team Inbox</div>
              <div style={{fontSize:13,color:C.inkMid,marginBottom:22}}>Tasks and requests submitted by your team for review.</div>
              <div style={{background:"rgba(255,255,255,0.62)",border:`1px solid ${C.border}`,borderRadius:13,padding:"22px 24px",marginBottom:18}}>
                <div style={{fontSize:13,fontWeight:500,marginBottom:12}}>Add a team request</div>
                {[["Member",teamMember,setTeamMember,"Team member name"],["Task",teamTask,setTeamTask,"Task or request"]].map(([l,v,s,p])=>(
                  <input key={l} value={v} onChange={e=>s(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTeamTask()} placeholder={p} style={{...inp,marginBottom:9}} onFocus={e=>(e.target.style.borderColor=C.greenMid)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                ))}
                <button onClick={addTeamTask} disabled={!teamMember.trim()||!teamTask.trim()} style={{padding:"9px 20px",background:C.green,color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",opacity:(!teamMember.trim()||!teamTask.trim())?0.4:1}}>Add Request</button>
              </div>
              {teamTasks.length===0?<div style={{textAlign:"center",padding:"40px",color:C.inkFaint,fontSize:14}}><div style={{fontSize:36,opacity:.2,marginBottom:12}}>◎</div>No team requests yet.</div>:(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {teamTasks.map(t=>(
                    <div key={t.id} style={{background:"rgba(255,255,255,0.62)",border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
                      <span style={{background:C.green,color:"#fff",fontSize:10,padding:"2px 9px",borderRadius:4,fontWeight:500,flexShrink:0}}>{t.member}</span>
                      <span style={{flex:1,fontSize:13.5}}>{t.task}</span>
                      <button onClick={()=>removeTeamTask(t.id)} style={{background:"none",border:"none",color:C.inkFaint,cursor:"pointer",fontSize:18,lineHeight:1}} onMouseEnter={e=>(e.target.style.color=C.ink)} onMouseLeave={e=>(e.target.style.color=C.inkFaint)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ALERTS VIEW ── */}
          {view==="alerts"&&(
            <div style={{padding:"32px 40px",maxWidth:640}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:36,fontStyle:"italic",color:C.ink,marginBottom:8}}>Alerts</div>
              <div style={{fontSize:13,color:C.inkMid,marginBottom:22}}>Braincycle monitors your inbox & tasks every hour. Next scan in {fmtNext(nextScan)}.</div>
              {notifs.length===0?<div style={{textAlign:"center",padding:"60px",color:C.inkFaint}}><div style={{fontSize:40,opacity:.2,marginBottom:12}}>🔔</div><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:C.inkMid,marginBottom:6}}>All clear</div><div>No alerts yet.</div></div>:(
                <div style={{display:"flex",flexDirection:"column",gap:9}}>
                  {notifs.map(n=>(
                    <div key={n.id} style={{background:n.urgency==="high"?C.urgentSoft:C.goldSoft,border:`1px solid ${n.urgency==="high"?C.urgent+"30":C.gold+"30"}`,borderRadius:12,padding:"14px 16px",display:"flex",gap:12,alignItems:"flex-start",opacity:n.read?0.55:1}}>
                      <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><div style={{width:7,height:7,borderRadius:"50%",background:n.urgency==="high"?C.urgent:C.gold}}/><span style={{fontSize:17}}>{n.icon}</span></div>
                      <div style={{flex:1}}><div style={{fontSize:13.5,fontWeight:500}}>{n.title}</div><div style={{fontSize:12.5,color:C.inkMid,marginTop:2}}>{n.body}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS VIEW ── */}
          {view==="settings"&&(
            <div style={{padding:"32px 40px",maxWidth:540}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:36,fontStyle:"italic",color:C.ink,marginBottom:8}}>Settings</div>
              <div style={{fontSize:13,color:C.inkMid,marginBottom:24}}>Manage Braincycle's scanning rules and integrations.</div>
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                {[{title:"⭐ VIP Senders",desc:"Always flag emails from these people. Names or emails, comma-separated.",val:vipSenders,set:setVipSenders,ph:"e.g. Arch, investor@vc.com, Ange"},{title:"🔑 Keywords",desc:"Flag emails containing these words. Comma-separated.",val:keywords,set:setKeywords,ph:"urgent, invoice, contract…"}].map(s=>(
                  <div key={s.title} style={{background:"rgba(255,255,255,0.62)",border:`1px solid ${C.border}`,borderRadius:13,padding:"22px 24px"}}>
                    <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>{s.title}</div>
                    <div style={{fontSize:12,color:C.inkMid,marginBottom:12}}>{s.desc}</div>
                    <textarea value={s.val} onChange={e=>s.set(e.target.value)} placeholder={s.ph} style={{width:"100%",height:70,padding:13,borderRadius:9,border:`1.5px solid ${C.border}`,resize:"none",fontSize:13,lineHeight:1.65,color:C.ink,fontFamily:"'DM Sans',sans-serif",background:"rgba(255,255,255,0.7)",outline:"none",boxSizing:"border-box"}} onFocus={e=>(e.target.style.borderColor=C.greenMid)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                  </div>
                ))}
                <div style={{display:"flex",alignItems:"center",gap:14}}>
                  <button onClick={()=>{localStorage.setItem("bc-vip",vipSenders);localStorage.setItem("bc-kw",keywords);setSaved(true);setTimeout(()=>setSaved(false),2500);}} style={{padding:"10px 24px",background:C.green,color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Save</button>
                  {saved&&<span style={{fontSize:13,color:C.greenMid}}>✓ Saved</span>}
                </div>
                <div style={{background:"rgba(255,255,255,0.62)",border:`1px solid ${C.border}`,borderRadius:13,padding:"22px 24px"}}>
                  <div style={{fontSize:13,fontWeight:500,marginBottom:14}}>Connected Integrations</div>
                  {[{icon:"✉️",name:"Gmail"},{icon:"📅",name:"Google Calendar"},{icon:"✅",name:"Google Tasks"},{icon:"📁",name:"Google Drive"}].map((s,i,arr)=>(
                    <div key={s.name} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none"}}>
                      <span style={{fontSize:18}}>{s.icon}</span>
                      <span style={{flex:1,fontSize:14}}>{s.name}</span>
                      <span style={{fontSize:12,color:C.greenMid,fontWeight:500}}>● Connected</span>
                    </div>
                  ))}
                  <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
                    <a href="/api/google/auth" style={{fontSize:12,color:C.urgent,textDecoration:"none",fontWeight:500}} onMouseEnter={e=>(e.target.style.textDecoration="underline")} onMouseLeave={e=>(e.target.style.textDecoration="none")}>↺ Re-authorise Google connection</a>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>{/* end page content */}

        {/* Float button for non-diary views */}
        {view!=="diary"&&(
          <button onClick={()=>setAriaFloat(true)} style={{position:"fixed",bottom:26,right:26,width:52,height:52,borderRadius:"50%",background:C.green,border:"none",cursor:"pointer",boxShadow:"0 4px 20px rgba(28,56,32,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,transition:"all 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.08)";e.currentTarget.style.boxShadow="0 6px 28px rgba(28,56,32,0.5)";}} onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.boxShadow="0 4px 20px rgba(28,56,32,0.4)";}}>
            <span style={{fontFamily:"'Cormorant Garamond',serif",color:"#fff",fontSize:26,fontStyle:"italic",fontWeight:600,lineHeight:1}}>B</span>
          </button>
        )}

      </div>{/* end main */}

      <style>{`
        @keyframes bc-dot  { 0%,100%{opacity:.2;transform:scale(.8)} 50%{opacity:1;transform:scale(1.1)} }
        @keyframes bc-spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
