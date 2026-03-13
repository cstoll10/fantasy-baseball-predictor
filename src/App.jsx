import { useState, useEffect, useMemo, useRef } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const LEAGUE_SIZE = 12;
const MY_PICK = 10;
const ROUNDS = 28;
const TIER_COLORS = { 1:"#00C896", 2:"#4A9EFF", 3:"#A78BFA", 4:"#6B7280", 5:"#F87171" };
const TIER_BG = { 1:"#00C89610", 2:"#4A9EFF10", 3:"#A78BFA10", 4:"#6B728010", 5:"#F8717110" };
const POSITIONS = ["All","C","1B","2B","SS","3B","OF","DH"];
const SKILL_KEYS = ["xwOBA","HardHit%","Barrel%","K%","BB%","SwStr%","BABIP","GB%","FB%","Pull%"];
const HIGHER_BETTER = new Set(["xwOBA","HardHit%","Barrel%","BB%","BABIP","FB%","Pull%"]);
const CAT_KEYS = ["HR","RBI","SB","H","TB","OBP"];
const ROSTER_SLOTS = { C:1, "1B":1, "2B":1, SS:1, "3B":1, OF:3, DH:1, UTIL:2, SP:5, RP:3, BN:3 };

// ── Snake draft pick calculator ───────────────────────────────────────────────
function getMyPicks(leagueSize, myPick, rounds) {
  const picks = [];
  for (let round = 1; round <= rounds; round++) {
    const isEven = round % 2 === 0;
    const pickInRound = isEven ? leagueSize - myPick + 1 : myPick;
    const overall = (round - 1) * leagueSize + pickInRound;
    picks.push({ round, pickInRound, overall });
  }
  return picks;
}

// ── Radar chart ───────────────────────────────────────────────────────────────
function RadarChart({ player, allPlayers }) {
  const size = 200, cx = 100, cy = 105, r = 72;
  const n = CAT_KEYS.length;
  const angles = CAT_KEYS.map((_, i) => (Math.PI * 2 * i) / n - Math.PI / 2);
  const pctiles = useMemo(() => {
    const result = {};
    CAT_KEYS.forEach(cat => {
      const vals = allPlayers.map(p => p.projections[cat] || 0).sort((a,b)=>a-b);
      const v = player.projections[cat] || 0;
      result[cat] = vals.filter(x => x <= v).length / vals.length;
    });
    return result;
  }, [player, allPlayers]);
  const pts = angles.map((a, i) => [cx + r * pctiles[CAT_KEYS[i]] * Math.cos(a), cy + r * pctiles[CAT_KEYS[i]] * Math.sin(a)]);
  return (
    <svg width={size} height={size} style={{display:"block",margin:"0 auto"}}>
      {[.25,.5,.75,1].map(lvl => (
        <polygon key={lvl} points={angles.map(a=>`${cx+r*lvl*Math.cos(a)},${cy+r*lvl*Math.sin(a)}`).join(" ")}
          fill="none" stroke="#ffffff18" strokeWidth={1}/>
      ))}
      {angles.map((a,i) => <line key={i} x1={cx} y1={cy} x2={cx+r*Math.cos(a)} y2={cy+r*Math.sin(a)} stroke="#ffffff18" strokeWidth={1}/>)}
      <polygon points={pts.map(p=>p.join(",")).join(" ")} fill={TIER_COLORS[player.tier]+"30"} stroke={TIER_COLORS[player.tier]} strokeWidth={2}/>
      {pts.map((p,i) => <circle key={i} cx={p[0]} cy={p[1]} r={3} fill={TIER_COLORS[player.tier]}/>)}
      {angles.map((a, i) => {
        const lx = cx+(r+20)*Math.cos(a), ly = cy+(r+20)*Math.sin(a);
        const val = player.projections[CAT_KEYS[i]];
        return (
          <g key={i}>
            <text x={lx} y={ly-4} textAnchor="middle" fontSize={9} fill="#888">{CAT_KEYS[i]}</text>
            <text x={lx} y={ly+8} textAnchor="middle" fontSize={10} fontWeight="700" fill="#ddd">
              {val != null ? (CAT_KEYS[i]==="OBP" ? val.toFixed(3) : Math.round(val)) : "—"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ values, higherBetter }) {
  const valid = values.filter(v => v != null);
  if (valid.length < 2) return <span style={{color:"#444",fontSize:10}}>—</span>;
  const min = Math.min(...valid), max = Math.max(...valid), range = max-min||.001;
  const w = 52, h = 20;
  const pts = values.map((v,i) => `${(i/(values.length-1))*w},${h-((( v??min)-min)/range)*h}`).join(" ");
  const last = valid[valid.length-1], prev = valid[valid.length-2];
  const good = higherBetter ? last>=prev : last<=prev;
  return <svg width={w} height={h} style={{verticalAlign:"middle"}}><polyline points={pts} fill="none" stroke={good?"#00C896":"#F87171"} strokeWidth={1.5}/></svg>;
}

// ── Percentile color ──────────────────────────────────────────────────────────
function pctColor(pct) {
  if (pct>=.90) return "#00C896";
  if (pct>=.70) return "#4A9EFF";
  if (pct>=.40) return "#9CA3AF";
  if (pct>=.20) return "#FB923C";
  return "#F87171";
}

// ── Player row ────────────────────────────────────────────────────────────────
function PlayerRow({ player, rank, isSelected, isDrafted, onSelect, onDraft, showDraftBtn }) {
  const tc = TIER_COLORS[player.tier];
  return (
    <div onClick={() => onSelect(player)}
      style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",
        borderRadius:8,cursor:"pointer",marginBottom:3,
        background: isSelected ? "#1a1a2e" : isDrafted ? "#0d0d0d" : "#111118",
        border: isSelected ? `1px solid ${tc}60` : "1px solid #1e1e2e",
        opacity: isDrafted ? 0.45 : 1,
        transition:"all 0.15s"}}>
      <span style={{width:28,fontSize:11,color:"#444",fontFamily:"'DM Mono',monospace",flexShrink:0}}>{rank}</span>
      <div style={{width:30,height:30,borderRadius:6,background:tc+"20",border:`1px solid ${tc}50`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:10,fontWeight:700,color:tc,flexShrink:0}}>
        {player.position}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:600,color: isDrafted?"#555":"#e8e8e8",
          textDecoration:isDrafted?"line-through":"none",letterSpacing:"-0.2px"}}>
          {player.name}
        </div>
        <div style={{fontSize:11,color:"#555"}}>{player.team} · {player.age}y</div>
      </div>
      <div style={{display:"flex",gap:18,fontSize:12,flexShrink:0}}>
        {[["HR",player.projections.HR],["RBI",player.projections.RBI],["SB",player.projections.SB],["AVG",player.projections.AVG]].map(([k,v])=>(
          <div key={k} style={{textAlign:"right"}}>
            <div style={{color:"#ddd",fontWeight:600,fontFamily:"'DM Mono',monospace"}}>{v}</div>
            <div style={{color:"#444",fontSize:10}}>{k}</div>
          </div>
        ))}
        <div style={{textAlign:"right",minWidth:52}}>
          <div style={{color:tc,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{player.VORP}</div>
          <div style={{color:"#444",fontSize:10}}>VORP</div>
        </div>
      </div>
      {showDraftBtn && (
        <button onClick={e=>{e.stopPropagation();onDraft(player);}}
          style={{padding:"4px 12px",borderRadius:5,fontSize:11,fontWeight:600,cursor:"pointer",
            border:`1px solid ${isDrafted?"#F87171":"#2a2a3e"}`,
            background:isDrafted?"#F8717120":"#1e1e2e",
            color:isDrafted?"#F87171":"#666",flexShrink:0}}>
          {isDrafted?"Undraft":"Draft"}
        </button>
      )}
    </div>
  );
}

// ── Player panel (slide-in) ───────────────────────────────────────────────────
function PlayerPanel({ player, allPlayers, percentiles, onClose, onNavigate }) {
  if (!player) return null;
  const tc = TIER_COLORS[player.tier];
  const idx = allPlayers.findIndex(p => p.id === player.id);
  return (
    <div style={{width:320,flexShrink:0,position:"sticky",top:16,height:"calc(100vh - 32px)",
      overflowY:"auto",background:"#0c0c14",border:"1px solid #1e1e2e",borderRadius:12,padding:20}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16}}>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:"#f0f0f0",letterSpacing:"-0.3px"}}>{player.name}</div>
          <div style={{fontSize:12,color:"#555",marginTop:2}}>{player.team} · Age {player.age} · {player.position}</div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <button onClick={()=>onNavigate(-1)} disabled={idx<=0}
            style={{background:"none",border:"1px solid #2a2a3e",borderRadius:5,color:idx<=0?"#333":"#888",
              cursor:idx<=0?"default":"pointer",padding:"4px 8px",fontSize:12}}>←</button>
          <button onClick={()=>onNavigate(1)} disabled={idx>=allPlayers.length-1}
            style={{background:"none",border:"1px solid #2a2a3e",borderRadius:5,color:idx>=allPlayers.length-1?"#333":"#888",
              cursor:idx>=allPlayers.length-1?"default":"pointer",padding:"4px 8px",fontSize:12}}>→</button>
          <button onClick={onClose}
            style={{background:"none",border:"1px solid #2a2a3e",borderRadius:5,color:"#666",
              cursor:"pointer",padding:"4px 10px",fontSize:14}}>×</button>
        </div>
      </div>

      {/* VORP + Tier */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <div style={{flex:1,background:tc+"15",border:`1px solid ${tc}30`,borderRadius:8,padding:"10px 12px",textAlign:"center"}}>
          <div style={{fontSize:11,color:"#666",marginBottom:2}}>VORP</div>
          <div style={{fontSize:24,fontWeight:700,color:tc,fontFamily:"'DM Mono',monospace"}}>{player.VORP}</div>
        </div>
        <div style={{flex:1,background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,padding:"10px 12px",textAlign:"center"}}>
          <div style={{fontSize:11,color:"#666",marginBottom:2}}>Tier</div>
          <div style={{fontSize:24,fontWeight:700,color:tc,fontFamily:"'DM Mono',monospace"}}>{player.tier}</div>
        </div>
      </div>

      {/* Radar */}
      <div style={{background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,padding:12,marginBottom:16}}>
        <div style={{fontSize:11,color:"#555",fontWeight:600,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>Category Profile</div>
        <RadarChart player={player} allPlayers={allPlayers}/>
      </div>

      {/* Projections */}
      <div style={{background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,padding:12,marginBottom:16}}>
        <div style={{fontSize:11,color:"#555",fontWeight:600,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>2026 Projections</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 16px"}}>
          {Object.entries(player.projections).map(([k,v]) => v != null && (
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #1a1a2e"}}>
              <span style={{fontSize:11,color:"#555"}}>{k}</span>
              <span style={{fontSize:12,fontWeight:600,color:"#ccc",fontFamily:"'DM Mono',monospace"}}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Skills history */}
      {player.history && player.history.length > 0 && (
        <div style={{background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,padding:12}}>
          <div style={{fontSize:11,color:"#555",fontWeight:600,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>Skills by Season</div>
          <div style={{display:"grid",gridTemplateColumns:"72px 56px repeat(4, 44px)",gap:2,
            fontSize:10,color:"#444",fontWeight:600,marginBottom:6,paddingBottom:6,borderBottom:"1px solid #1a1a2e"}}>
            <span>Stat</span>
            <span style={{textAlign:"center"}}>Trend</span>
            {player.history.map(h=><span key={h.season} style={{textAlign:"right"}}>{h.season}</span>)}
          </div>
          {SKILL_KEYS.map(key => {
            const vals = player.history.map(h=>h[key]);
            if (!vals.some(v=>v!=null)) return null;
            const latest = vals[vals.length-1];
            const hb = HIGHER_BETTER.has(key);
            const pct = percentiles[key]?.(latest);
            const effectivePct = pct != null ? (hb ? pct : 1-pct) : null;
            return (
              <div key={key} style={{display:"grid",gridTemplateColumns:"72px 56px repeat(4, 44px)",
                gap:2,padding:"4px 0",borderBottom:"1px solid #0f0f1a",alignItems:"center"}}>
                <span style={{fontSize:11,color:"#666"}}>{key}</span>
                <span style={{textAlign:"center"}}><Sparkline values={vals} higherBetter={hb}/></span>
                {vals.map((v,i) => (
                  <span key={i} style={{textAlign:"right",fontFamily:"'DM Mono',monospace",
                    fontSize:10,fontWeight:i===vals.length-1?700:400,
                    color:i===vals.length-1&&effectivePct!=null ? pctColor(effectivePct) : "#444"}}>
                    {v!=null?v.toFixed(3):"—"}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Scarcity meter ────────────────────────────────────────────────────────────
function ScarcityMeter({ players, drafted }) {
  const SLOTS = { C:1, SS:1, "2B":1, "3B":1, "1B":1, OF:3, DH:1 };
  return (
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
      {Object.entries(SLOTS).map(([pos, slots]) => {
        const total = players.filter(p=>p.position===pos&&p.tier<=3).length;
        const gone = [...drafted].filter(id=>{const p=players.find(x=>x.id===id);return p&&p.position===pos;}).length;
        const remaining = total-gone;
        const pct = remaining/Math.max(total,1);
        const color = pct>.6?"#00C896":pct>.3?"#FB923C":"#F87171";
        return (
          <div key={pos} style={{flex:1,minWidth:80,background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,padding:"10px 12px"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:12,fontWeight:700,color:"#ccc"}}>{pos}</span>
              <span style={{fontSize:11,color:"#555",fontFamily:"'DM Mono',monospace"}}>{remaining}/{total}</span>
            </div>
            <div style={{height:4,background:"#1e1e2e",borderRadius:2}}>
              <div style={{height:"100%",width:`${pct*100}%`,background:color,borderRadius:2,transition:"width 0.4s"}}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Draft roster ──────────────────────────────────────────────────────────────
function DraftRoster({ myPicks, draftLog, players, currentPick }) {
  const myPickNumbers = new Set(myPicks.map(p=>p.overall));
  return (
    <div style={{width:260,flexShrink:0,background:"#0c0c14",border:"1px solid #1e1e2e",borderRadius:12,padding:16,
      position:"sticky",top:16,maxHeight:"calc(100vh - 32px)",overflowY:"auto"}}>
      <div style={{fontSize:12,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:14}}>
        My Roster · Pick {MY_PICK}
      </div>
      {myPicks.slice(0,ROUNDS).map(({round,pickInRound,overall})=>{
        const entry = draftLog.find(d=>d.pick===overall);
        const isMine = myPickNumbers.has(overall);
        const isCurrent = overall===currentPick;
        return (
          <div key={overall} style={{display:"flex",gap:10,padding:"7px 10px",borderRadius:6,marginBottom:3,
            background:isCurrent?"#1a1a2e":"#0d0d14",
            border:isCurrent?"1px solid #4A9EFF40":"1px solid transparent"}}>
            <div style={{width:36,flexShrink:0}}>
              <div style={{fontSize:10,color:"#4A9EFF",fontFamily:"'DM Mono',monospace",fontWeight:700}}>R{round}</div>
              <div style={{fontSize:9,color:"#333",fontFamily:"'DM Mono',monospace"}}>#{overall}</div>
            </div>
            {entry ? (
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:"#ddd",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                  {entry.player.name}
                </div>
                <div style={{fontSize:10,color:"#555"}}>{entry.player.position} · {entry.player.team}</div>
              </div>
            ) : (
              <div style={{flex:1,fontSize:12,color:isCurrent?"#4A9EFF":"#2a2a3a",fontStyle:"italic"}}>
                {isCurrent ? "← Your pick" : "—"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────
export default function App() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("projections");
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [drafted, setDrafted] = useState(new Set());
  const [draftLog, setDraftLog] = useState([]);
  const [currentPick, setCurrentPick] = useState(1);
  const [showDrafted, setShowDrafted] = useState(true);

  useEffect(()=>{
    fetch("/fantasy-baseball-predictor/players.json")
      .then(r=>r.json())
      .then(d=>{setPlayers(d.players);setLoading(false);});
  },[]);

  const percentiles = useMemo(()=>{
    const result={};
    SKILL_KEYS.forEach(key=>{
      const vals=players.map(p=>p.skills[key]).filter(v=>v!=null).sort((a,b)=>a-b);
      result[key]=(v)=>{if(v==null)return null;return vals.filter(x=>x<=v).length/vals.length;};
    });
    return result;
  },[players]);

  const myPicks = useMemo(()=>getMyPicks(LEAGUE_SIZE,MY_PICK,ROUNDS),[]);

  const filtered = useMemo(()=>players
    .filter(p=>posFilter==="All"||p.position===posFilter)
    .filter(p=>p.name.toLowerCase().includes(search.toLowerCase()))
    .filter(p=>showDrafted||!drafted.has(p.id))
  ,[players,posFilter,search,showDrafted,drafted]);

  const tierGroups = [1,2,3,4].map(t=>({tier:t,players:filtered.filter(p=>p.tier===t)})).filter(g=>g.players.length>0);

  const toggleDraft = (player) => {
    const isDrafted = drafted.has(player.id);
    setDrafted(prev=>{const n=new Set(prev);isDrafted?n.delete(player.id):n.add(player.id);return n;});
    if (!isDrafted) {
      setDraftLog(prev=>[...prev,{pick:currentPick,player}]);
      setCurrentPick(p=>p+1);
    } else {
      setDraftLog(prev=>prev.filter(d=>d.player.id!==player.id));
    }
  };

  const handleSelect = (player) => setSelected(s=>s?.id===player.id?null:player);

  const handleNavigate = (dir) => {
    if (!selected) return;
    const idx = players.findIndex(p=>p.id===selected.id);
    const next = players[idx+dir];
    if (next) setSelected(next);
  };

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",
      background:"#080810",color:"#444",fontFamily:"system-ui",fontSize:14}}>
      Loading projections...
    </div>
  );

  const TAB_STYLE = (t) => ({
    padding:"8px 20px",borderRadius:"6px 6px 0 0",border:"none",cursor:"pointer",fontSize:13,fontWeight:600,
    background:tab===t?"#111118":"transparent",
    color:tab===t?"#f0f0f0":"#555",
    borderBottom:tab===t?"2px solid #4A9EFF":"2px solid transparent",
    transition:"all 0.15s"
  });

  return (
    <div style={{minHeight:"100vh",background:"#080810",fontFamily:"system-ui",color:"#e8e8e8"}}>
      {/* Import DM Mono */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;600&display=swap');
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#0c0c14} ::-webkit-scrollbar-thumb{background:#2a2a3e;border-radius:2px}`}
      </style>

      {/* Header */}
      <div style={{borderBottom:"1px solid #1e1e2e",padding:"16px 24px 0"}}>
        <div style={{maxWidth:1400,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"baseline",gap:12,marginBottom:12}}>
            <h1 style={{margin:0,fontSize:20,fontWeight:700,color:"#f0f0f0",letterSpacing:"-0.5px"}}>
              ⚾ Fantasy Baseball
            </h1>
            <span style={{fontSize:12,color:"#444",fontFamily:"'DM Mono',monospace"}}>
              {players.length} players · 2026 projections · {drafted.size} drafted
            </span>
          </div>
          <div style={{display:"flex",gap:4}}>
            {[["projections","📊 Projections"],["draft","🎯 Draft Room"]].map(([t,label])=>(
              <button key={t} style={TAB_STYLE(t)} onClick={()=>setTab(t)}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:1400,margin:"0 auto",padding:"20px 24px"}}>

        {/* ── PROJECTIONS TAB ── */}
        {tab==="projections" && (
          <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
            <div style={{flex:1,minWidth:0}}>
              {/* Filters */}
              <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
                <input placeholder="Search player..." value={search} onChange={e=>setSearch(e.target.value)}
                  style={{padding:"8px 14px",background:"#111118",border:"1px solid #2a2a3e",borderRadius:8,
                    color:"#ddd",fontSize:13,flex:1,minWidth:180,outline:"none"}}/>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {POSITIONS.map(pos=>(
                    <button key={pos} onClick={()=>setPosFilter(pos)}
                      style={{padding:"6px 12px",borderRadius:6,border:"1px solid",fontSize:12,fontWeight:600,cursor:"pointer",
                        borderColor:posFilter===pos?"#4A9EFF":"#2a2a3e",
                        background:posFilter===pos?"#4A9EFF20":"transparent",
                        color:posFilter===pos?"#4A9EFF":"#555"}}>
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tier groups */}
              {tierGroups.map(({tier,players:tp})=>(
                <div key={tier} style={{marginBottom:24}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <span style={{background:TIER_COLORS[tier]+"20",border:`1px solid ${TIER_COLORS[tier]}40`,
                      color:TIER_COLORS[tier],borderRadius:4,padding:"2px 10px",fontSize:11,fontWeight:700,letterSpacing:"0.5px"}}>
                      TIER {tier}
                    </span>
                    <span style={{fontSize:11,color:"#444"}}>{tp.length} players</span>
                  </div>
                  {tp.map((p,i)=>(
                    <PlayerRow key={p.id} player={p} rank={players.indexOf(p)+1}
                      isSelected={selected?.id===p.id} isDrafted={drafted.has(p.id)}
                      onSelect={handleSelect} onDraft={toggleDraft} showDraftBtn={false}/>
                  ))}
                </div>
              ))}
            </div>

            {/* Slide-in panel */}
            {selected && (
              <PlayerPanel player={selected} allPlayers={players} percentiles={percentiles}
                onClose={()=>setSelected(null)} onNavigate={handleNavigate}/>
            )}
          </div>
        )}

        {/* ── DRAFT TAB ── */}
        {tab==="draft" && (
          <div>
            <ScarcityMeter players={players} drafted={drafted}/>
            <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
              <div style={{flex:1,minWidth:0}}>
                {/* Filters */}
                <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
                  <input placeholder="Search player..." value={search} onChange={e=>setSearch(e.target.value)}
                    style={{padding:"8px 14px",background:"#111118",border:"1px solid #2a2a3e",borderRadius:8,
                      color:"#ddd",fontSize:13,flex:1,minWidth:180,outline:"none"}}/>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {POSITIONS.map(pos=>(
                      <button key={pos} onClick={()=>setPosFilter(pos)}
                        style={{padding:"6px 12px",borderRadius:6,border:"1px solid",fontSize:12,fontWeight:600,cursor:"pointer",
                          borderColor:posFilter===pos?"#4A9EFF":"#2a2a3e",
                          background:posFilter===pos?"#4A9EFF20":"transparent",
                          color:posFilter===pos?"#4A9EFF":"#555"}}>
                        {pos}
                      </button>
                    ))}
                  </div>
                  <button onClick={()=>setShowDrafted(v=>!v)}
                    style={{padding:"6px 14px",borderRadius:6,border:"1px solid #2a2a3e",
                      background:showDrafted?"#FB923C20":"transparent",
                      color:showDrafted?"#FB923C":"#555",cursor:"pointer",fontSize:12,fontWeight:600}}>
                    {showDrafted?"Showing drafted":"Hiding drafted"}
                  </button>
                  {drafted.size>0&&(
                    <button onClick={()=>{setDrafted(new Set());setDraftLog([]);setCurrentPick(1);}}
                      style={{padding:"6px 14px",borderRadius:6,border:"1px solid #F8717140",
                        color:"#F87171",background:"transparent",cursor:"pointer",fontSize:12,fontWeight:600}}>
                      Reset draft
                    </button>
                  )}
                </div>
                {tierGroups.map(({tier,players:tp})=>(
                  <div key={tier} style={{marginBottom:24}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <span style={{background:TIER_COLORS[tier]+"20",border:`1px solid ${TIER_COLORS[tier]}40`,
                        color:TIER_COLORS[tier],borderRadius:4,padding:"2px 10px",fontSize:11,fontWeight:700,letterSpacing:"0.5px"}}>
                        TIER {tier}
                      </span>
                      <span style={{fontSize:11,color:"#444"}}>{tp.length} players</span>
                    </div>
                    {tp.map(p=>(
                      <PlayerRow key={p.id} player={p} rank={players.indexOf(p)+1}
                        isSelected={selected?.id===p.id} isDrafted={drafted.has(p.id)}
                        onSelect={handleSelect} onDraft={toggleDraft} showDraftBtn={true}/>
                    ))}
                  </div>
                ))}
              </div>

              {/* Draft roster + player panel */}
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <DraftRoster myPicks={myPicks} draftLog={draftLog} players={players} currentPick={currentPick}/>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
