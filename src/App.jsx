import { useState, useEffect, useMemo } from "react";

const LEAGUE_SIZE  = 12;
const HIT_CATS = ["R","HR","RBI","SB","OBP","H","TB"];
const PIT_CATS = ["W","K","ERA","WHIP","SV","HLD","QS"];
const LOWER_BETTER = new Set(["ERA","WHIP","K%","BB%"]);
const LOWER_BETTER_SKILLS = new Set(["K%","BB%","BABIP","GB%","LD%","LOB%"]);
const SYSTEMS = ["ATC","ZiPS","Steamer","THE BAT","Depth Charts"];
const SYS_COLORS = {
  "ATC":"#4A9EFF","ZiPS":"#A78BFA","Steamer":"#00C896",
  "THE BAT":"#FB923C","Depth Charts":"#F472B6",
};
const TIER_COLORS = { 1:"#00C896",2:"#4A9EFF",3:"#A78BFA",4:"#6B7280",5:"#F87171" };
const HIT_DISPLAY = ["G","HR","R","RBI","SB","AVG","OBP","SLG","wOBA","wRC+"];
const PIT_DISPLAY = ["G","W","K","ERA","WHIP","SV","HLD","QS"];
const HIT_POSITIONS = ["All","C","1B","2B","3B","SS","OF","DH","UTIL"];
const PIT_POSITIONS = ["All","SP","RP"];

const HIT_SKILLS = [
  {key:"BB%",   label:"BB%",      fmt:"pct",  higherBetter:true},
  {key:"K%",    label:"K%",       fmt:"pct",  higherBetter:false},
  {key:"BABIP", label:"BABIP",    fmt:"avg",  higherBetter:true},
  {key:"wOBA",  label:"wOBA",     fmt:"avg",  higherBetter:true},
  {key:"EV",    label:"Exit Velo",fmt:"dec1", higherBetter:true},
  {key:"LA",    label:"Launch Ang",fmt:"dec1",higherBetter:false},
  {key:"Barrel%",label:"Barrel%", fmt:"pct",  higherBetter:true},
  {key:"HardHit%",label:"HardHit%",fmt:"pct", higherBetter:true},
  {key:"xBA",   label:"xBA",      fmt:"avg",  higherBetter:true},
  {key:"Pull%", label:"Pull%",    fmt:"pct",  higherBetter:false},
  {key:"FB%",   label:"FB%",      fmt:"pct",  higherBetter:false},
  {key:"LD%",   label:"LD%",      fmt:"pct",  higherBetter:true},
  {key:"GB%",   label:"GB%",      fmt:"pct",  higherBetter:false},
  {key:"WAR",   label:"WAR",      fmt:"dec1", higherBetter:true},
];

const PIT_SKILLS = [
  {key:"K%",    label:"K%",       fmt:"pct",  higherBetter:true},
  {key:"BB%",   label:"BB%",      fmt:"pct",  higherBetter:false},
  {key:"BABIP", label:"BABIP",    fmt:"avg",  higherBetter:false},
  {key:"FIP",   label:"FIP",      fmt:"avg",  higherBetter:false},
  {key:"GB%",   label:"GB%",      fmt:"pct",  higherBetter:true},
  {key:"LD%",   label:"LD%",      fmt:"pct",  higherBetter:false},
  {key:"LOB%",  label:"LOB%",     fmt:"pct",  higherBetter:true},
  {key:"WAR",   label:"WAR",      fmt:"dec1", higherBetter:true},
];

// Historical stat keys to show
const HIT_HIST_STATS = ["G","PA","HR","R","RBI","SB","AVG","OBP","SLG","wOBA","WAR"];
const PIT_HIST_STATS = ["G","GS","IP","W","SO","ERA","WHIP","FIP","WAR"];

function pctColor(pct, lowerBetter=false) {
  const ep = lowerBetter && pct!=null ? 1-pct : pct;
  if (ep==null) return "#555";
  if (ep>=.90) return "#00C896";
  if (ep>=.70) return "#4A9EFF";
  if (ep>=.40) return "#9CA3AF";
  if (ep>=.20) return "#FB923C";
  return "#F87171";
}

function fmtStat(val, cat) {
  if (val==null) return "—";
  if (["OBP","AVG","SLG","wOBA","ERA","WHIP","BABIP","xBA","FIP"].includes(cat)) return Number(val).toFixed(3);
  if (cat==="wRC+") return Math.round(val);
  return Math.round(val*10)/10;
}

function fmtSkill(val, fmt) {
  if (val==null) return "—";
  if (fmt==="pct") return (val*100).toFixed(1)+"%";
  if (fmt==="avg") return Number(val).toFixed(3);
  if (fmt==="dec1") return Number(val).toFixed(1);
  return val;
}

function scaleTo600(val, cat, pa) {
  if (val==null||!pa) return null;
  if (!["R","HR","RBI","SB","H","TB","BB","SO","W","K","SV","HLD","QS"].includes(cat)) return val;
  return Math.round((val/pa)*600*10)/10;
}

function ordinal(pct) {
  if (pct==null) return "—";
  const n = Math.round(pct*100);
  if (n===100) return "99th";
  const s=["th","st","nd","rd"];
  const v=n%100;
  return n+(s[(v-20)%10]||s[v]||s[0]);
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({values, higherBetter}) {
  const valid = values.filter(v=>v!=null);
  if (valid.length < 2) return <span style={{color:"#2a2a3e",fontSize:10}}>—</span>;
  const min=Math.min(...valid), max=Math.max(...valid), range=max-min||0.001;
  const w=60, h=18;
  const pts = values.map((v,i)=>{
    const x=(i/(values.length-1))*w;
    const y=v!=null ? h-((v-min)/range)*h : null;
    return y!=null ? `${x},${y}` : null;
  }).filter(Boolean).join(" ");
  const last=valid[valid.length-1], prev=valid[valid.length-2];
  const good = higherBetter ? last>=prev : last<=prev;
  const color = good?"#00C896":"#F87171";
  return (
    <svg width={w} height={h} style={{verticalAlign:"middle",overflow:"visible"}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}/>
      {values.map((v,i)=>{
        if (v==null) return null;
        const x=(i/(values.length-1))*w;
        const y=h-((v-min)/range)*h;
        return <circle key={i} cx={x} cy={y} r={i===values.length-1?2.5:1.5}
          fill={i===values.length-1?color:"#444"}/>;
      })}
    </svg>
  );
}

function DisBadge({cv}) {
  if (!cv||cv<0.12) return null;
  const high=cv>0.25, c=high?"#F87171":"#FB923C";
  return (
    <span style={{fontSize:9,fontWeight:700,color:c,background:c+"20",
      border:`1px solid ${c}40`,borderRadius:3,padding:"1px 4px",marginLeft:4}}>
      {high?"HIGH⚡":"MED~"}
    </span>
  );
}

function SystemTable({player,per600,cats}) {
  const available=SYSTEMS.filter(s=>player.systems?.[s]);
  if (!available.length) return <div style={{color:"#444",fontSize:12}}>No system data.</div>;
  return (
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"'DM Mono',monospace"}}>
        <thead>
          <tr>
            <th style={{textAlign:"left",padding:"4px 8px",color:"#333",fontWeight:600,fontSize:10}}>System</th>
            {cats.map(c=><th key={c} style={{textAlign:"right",padding:"4px 5px",color:"#444",fontWeight:600,fontSize:10}}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {available.map(sys=>{
            const s=player.systems[sys];
            return (
              <tr key={sys} style={{borderTop:"1px solid #1a1a2e"}}>
                <td style={{padding:"5px 8px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <span style={{width:6,height:6,borderRadius:"50%",background:SYS_COLORS[sys],display:"inline-block"}}/>
                    <span style={{color:"#777",fontSize:10}}>{sys}</span>
                  </div>
                </td>
                {cats.map(cat=>{
                  const raw=s?.[cat], pa=s?.PA||player.consensus?.PA||1;
                  const val=per600?scaleTo600(raw,cat,pa):raw;
                  return <td key={cat} style={{textAlign:"right",padding:"5px 5px",color:val==null?"#2a2a3e":"#bbb",fontSize:11}}>{fmtStat(val,cat)}</td>;
                })}
              </tr>
            );
          })}
          <tr style={{borderTop:"2px solid #2a2a3e"}}>
            <td style={{padding:"5px 8px",color:"#4A9EFF",fontWeight:700,fontSize:10}}>AVG</td>
            {cats.map(cat=>{
              const raw=player.consensus?.[cat], pa=player.consensus?.PA||1;
              const val=per600?scaleTo600(raw,cat,pa):raw;
              const cv=player.disagreement?.[cat];
              return (
                <td key={cat} style={{textAlign:"right",padding:"5px 5px",fontWeight:700}}>
                  <span style={{color:"#4A9EFF",fontFamily:"'DM Mono',monospace",fontSize:11}}>{fmtStat(val,cat)}</span>
                  <DisBadge cv={cv}/>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function DisagreementPanel({player}) {
  const cats=player.type==="hitter"?HIT_CATS:PIT_CATS;
  return (
    <div>
      {cats.map(cat=>{
        const cv=player.disagreement?.[cat]??0;
        const color=cv>0.25?"#F87171":cv>0.12?"#FB923C":"#00C896";
        const label=cv>0.25?"High":cv>0.12?"Moderate":"Consensus";
        return (
          <div key={cat} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
            padding:"5px 0",borderBottom:"1px solid #131320"}}>
            <span style={{fontSize:11,color:"#555"}}>{cat}</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:70,height:3,background:"#1a1a2e",borderRadius:2}}>
                <div style={{height:"100%",width:`${Math.min(cv*200,100)}%`,background:color,borderRadius:2}}/>
              </div>
              <span style={{fontSize:10,color,width:72,textAlign:"right"}}>{label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Skills tab ────────────────────────────────────────────────────────────────
function SkillsPanel({player}) {
  const skills = player.type==="hitter" ? HIT_SKILLS : PIT_SKILLS;
  const history = player.history || [];
  const seasons = [...new Set(history.map(h=>h.season).filter(Boolean))].sort();

  return (
    <div style={{background:"#0f0f18",border:"1px solid #1a1a2e",borderRadius:8,padding:14}}>
      <div style={{fontSize:9,color:"#444",fontWeight:700,marginBottom:12,
        textTransform:"uppercase",letterSpacing:"0.8px"}}>
        Skill Metrics — Year over Year
      </div>

      {/* Header row */}
      <div style={{display:"grid",
        gridTemplateColumns:`110px 60px repeat(${seasons.length}, 52px)`,
        gap:4,marginBottom:6,paddingBottom:6,borderBottom:"1px solid #1a1a2e"}}>
        <span style={{fontSize:9,color:"#333",fontWeight:700}}>Stat</span>
        <span style={{fontSize:9,color:"#333",fontWeight:700,textAlign:"center"}}>Trend</span>
        {seasons.map(s=>(
          <span key={s} style={{fontSize:9,color:"#444",fontWeight:700,textAlign:"right"}}>{s}</span>
        ))}
      </div>

      {skills.map(skill=>{
        const vals = seasons.map(s=>{
          const h = history.find(h=>h.season===s);
          return h ? h[skill.key]??null : null;
        });
        const hasData = vals.some(v=>v!=null);
        const latest  = vals[vals.length-1];

        return (
          <div key={skill.key} style={{display:"grid",
            gridTemplateColumns:`110px 60px repeat(${seasons.length}, 52px)`,
            gap:4,padding:"4px 0",borderBottom:"1px solid #0f0f1a",alignItems:"center"}}>
            <span style={{fontSize:11,color:"#666"}}>{skill.label}</span>
            <span style={{textAlign:"center"}}>
              {hasData ? <Sparkline values={vals} higherBetter={skill.higherBetter}/> : <span style={{color:"#2a2a3e",fontSize:10}}>—</span>}
            </span>
            {vals.map((v,i)=>{
              const isLatest = i===vals.length-1;
              const prev = i>0 ? vals[i-1] : null;
              const improved = v!=null && prev!=null && (skill.higherBetter ? v>prev : v<prev);
              const declined = v!=null && prev!=null && (skill.higherBetter ? v<prev : v>prev);
              return (
                <span key={i} style={{textAlign:"right",
                  fontFamily:"'DM Mono',monospace",fontSize:10,
                  fontWeight:isLatest?700:400,
                  color: v==null?"#2a2a3e":
                    isLatest? (improved?"#00C896":declined?"#F87171":"#ddd") : "#555"}}>
                  {fmtSkill(v, skill.fmt)}
                </span>
              );
            })}
          </div>
        );
      })}

      {seasons.length===0&&(
        <div style={{color:"#333",fontSize:12,textAlign:"center",padding:20}}>
          No historical skill data available
        </div>
      )}
    </div>
  );
}

// ── Historical tab ────────────────────────────────────────────────────────────
function HistoricalPanel({player}) {
  const history  = player.history || [];
  const seasons  = [...new Set(history.map(h=>h.season).filter(Boolean))].sort();
  const statKeys = player.type==="hitter" ? HIT_HIST_STATS : PIT_HIST_STATS;

  if (seasons.length===0) return (
    <div style={{background:"#0f0f18",border:"1px solid #1a1a2e",borderRadius:8,padding:20,
      textAlign:"center",color:"#333",fontSize:12}}>
      No historical data available
    </div>
  );

  return (
    <div style={{background:"#0f0f18",border:"1px solid #1a1a2e",borderRadius:8,padding:14}}>
      <div style={{fontSize:9,color:"#444",fontWeight:700,marginBottom:12,
        textTransform:"uppercase",letterSpacing:"0.8px"}}>
        Season Stats (2022–2025)
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"'DM Mono',monospace"}}>
          <thead>
            <tr>
              <th style={{textAlign:"left",padding:"4px 6px",color:"#444",fontSize:10,fontWeight:700}}>Season</th>
              {statKeys.map(k=>(
                <th key={k} style={{textAlign:"right",padding:"4px 5px",color:"#444",fontSize:10,fontWeight:700}}>{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seasons.map(season=>{
              const h = history.find(x=>x.season===season);
              return (
                <tr key={season} style={{borderTop:"1px solid #1a1a2e"}}>
                  <td style={{padding:"5px 6px",color:"#4A9EFF",fontWeight:700}}>{season}</td>
                  {statKeys.map(k=>{
                    const v = h?.[k];
                    return (
                      <td key={k} style={{textAlign:"right",padding:"5px 5px",color:v!=null?"#bbb":"#2a2a3e"}}>
                        {v!=null ? fmtStat(v,k) : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Historical skills below */}
      <div style={{marginTop:16}}>
        <div style={{fontSize:9,color:"#444",fontWeight:700,marginBottom:10,
          textTransform:"uppercase",letterSpacing:"0.8px"}}>
          Historical Skills
        </div>
        <SkillsPanel player={player}/>
      </div>
    </div>
  );
}

// ── Player panel ──────────────────────────────────────────────────────────────
function PlayerPanel({player,allPlayers,per600,showPct,onClose,onNavigate}) {
  const [panelTab,setPanelTab]=useState("overview");
  if (!player) return null;
  const tc   = TIER_COLORS[player.tier]??"#6B7280";
  const idx  = allPlayers.findIndex(p=>p.id===player.id);
  const cats = player.type==="hitter"?HIT_CATS:PIT_CATS;
  const flags= player.flags??[];

  const PT=(t,label)=>(
    <button key={t} onClick={()=>setPanelTab(t)}
      style={{padding:"5px 8px",fontSize:10,fontWeight:700,border:"none",cursor:"pointer",
        borderRadius:5,background:panelTab===t?"#1e1e2e":"transparent",
        color:panelTab===t?"#ddd":"#444",whiteSpace:"nowrap"}}>
      {label}
    </button>
  );

  return (
    <div style={{width:360,flexShrink:0,position:"sticky",top:16,height:"calc(100vh - 32px)",
      overflowY:"auto",background:"#0a0a12",border:"1px solid #1e1e2e",borderRadius:12,padding:18}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:700,color:"#f0f0f0",letterSpacing:"-0.3px",
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{player.name}</div>
          <div style={{fontSize:11,color:"#444",marginTop:3,display:"flex",gap:6,flexWrap:"wrap"}}>
            <span>{player.team}</span><span>·</span>
            <span>{player.pos||"?"}</span><span>·</span>
            <span style={{color:tc}}>Tier {player.tier}</span>
            {flags.map(f=>(
              <span key={f} style={{color:"#F87171",background:"#F8717115",
                border:"1px solid #F8717130",borderRadius:3,padding:"0 4px",fontSize:9,fontWeight:700}}>
                {f.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:4,flexShrink:0,marginLeft:8}}>
          <button onClick={()=>onNavigate(-1)} disabled={idx<=0}
            style={{background:"none",border:"1px solid #2a2a3e",borderRadius:5,
              color:idx<=0?"#222":"#777",cursor:idx<=0?"default":"pointer",padding:"3px 7px",fontSize:12}}>←</button>
          <button onClick={()=>onNavigate(1)} disabled={idx>=allPlayers.length-1}
            style={{background:"none",border:"1px solid #2a2a3e",borderRadius:5,
              color:idx>=allPlayers.length-1?"#222":"#777",
              cursor:idx>=allPlayers.length-1?"default":"pointer",padding:"3px 7px",fontSize:12}}>→</button>
          <button onClick={onClose}
            style={{background:"none",border:"1px solid #2a2a3e",borderRadius:5,
              color:"#555",cursor:"pointer",padding:"3px 8px",fontSize:13}}>×</button>
        </div>
      </div>

      {/* VAR + Z */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
        {[["VAR",player.VAR,tc],["Z-Score",player.zScore,"#A78BFA"]].map(([lbl,val,c])=>(
          <div key={lbl} style={{background:c+"10",border:`1px solid ${c}25`,borderRadius:8,
            padding:"9px 12px",textAlign:"center"}}>
            <div style={{fontSize:9,color:"#444",marginBottom:2,letterSpacing:"0.5px"}}>{lbl}</div>
            <div style={{fontSize:21,fontWeight:700,color:c,fontFamily:"'DM Mono',monospace"}}>
              {val>0?"+":""}{val}
            </div>
          </div>
        ))}
      </div>

      {/* Panel tabs */}
      <div style={{display:"flex",gap:1,marginBottom:14,background:"#0f0f18",borderRadius:7,padding:3,flexWrap:"wrap"}}>
        {PT("overview","Overview")}
        {PT("systems","Systems")}
        {PT("disagree","Disagreement")}
        {PT("skills","Skills")}
        {PT("history","Historical")}
      </div>

      {/* Overview — percentile bars */}
      {panelTab==="overview"&&(
        <div style={{background:"#0f0f18",border:"1px solid #1a1a2e",borderRadius:8,padding:14}}>
          <div style={{fontSize:9,color:"#444",fontWeight:700,marginBottom:10,
            textTransform:"uppercase",letterSpacing:"0.8px"}}>
            Percentile Ranks {per600?"(per 600 PA)":""} — vs top 300
          </div>
          {cats.map(cat=>{
            const raw=player.consensus?.[cat], pa=player.consensus?.PA||1;
            const val=per600?scaleTo600(raw,cat,pa):raw;
            const pct=player.percentiles?.[cat];
            const lb=LOWER_BETTER.has(cat);
            const ep=lb&&pct!=null?1-pct:pct;
            const color=pctColor(ep);
            return (
              <div key={cat} style={{marginBottom:9}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:10,color:"#555",textTransform:"uppercase",letterSpacing:"0.5px"}}>{cat}</span>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <span style={{fontSize:10,color,fontFamily:"'DM Mono',monospace"}}>{ordinal(ep)}</span>
                    <span style={{fontSize:12,fontWeight:700,color,fontFamily:"'DM Mono',monospace"}}>{fmtStat(val,cat)}</span>
                  </div>
                </div>
                <div style={{height:3,background:"#1a1a2e",borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${(ep??0)*100}%`,background:color,borderRadius:2,transition:"width 0.5s"}}/>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {panelTab==="systems"&&(
        <div style={{background:"#0f0f18",border:"1px solid #1a1a2e",borderRadius:8,padding:14}}>
          <SystemTable player={player} per600={per600} cats={cats}/>
        </div>
      )}

      {panelTab==="disagree"&&(
        <div style={{background:"#0f0f18",border:"1px solid #1a1a2e",borderRadius:8,padding:14}}>
          <div style={{fontSize:9,color:"#444",fontWeight:700,marginBottom:10,
            textTransform:"uppercase",letterSpacing:"0.8px"}}>Model Agreement per Category</div>
          <DisagreementPanel player={player}/>
        </div>
      )}

      {panelTab==="skills"&&<SkillsPanel player={player}/>}
      {panelTab==="history"&&<HistoricalPanel player={player}/>}
    </div>
  );
}

// ── Column headers ────────────────────────────────────────────────────────────
function ColumnHeaders({isHitter, showPct}) {
  const cols = isHitter ? HIT_DISPLAY : PIT_DISPLAY;
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:6,padding:"4px 12px 6px",
      borderBottom:"1px solid #1e1e2e",marginBottom:4,userSelect:"none"}}>
      <div style={{width:22,flexShrink:0}}/>
      <div style={{width:26,flexShrink:0,fontSize:9,color:"#333",textTransform:"uppercase",
        letterSpacing:"0.4px",textAlign:"center"}}>POS</div>
      <div style={{minWidth:140,maxWidth:180,flexShrink:0,fontSize:9,color:"#444",
        fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"}}>Player</div>
      <div style={{display:"flex",gap:8,flexShrink:0}}>
        {cols.map(cat=>(
          <div key={cat} style={{minWidth:36,textAlign:"right"}}>
            <div style={{fontSize:9,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.4px"}}>{cat}</div>
            {showPct&&<div style={{fontSize:8,color:"#2a2a3e",marginTop:1}}>rank</div>}
          </div>
        ))}
      </div>
      <div style={{minWidth:34,textAlign:"right",flexShrink:0,fontSize:9,color:"#555",fontWeight:700,letterSpacing:"0.4px"}}>DIS</div>
      <div style={{minWidth:36,textAlign:"right",flexShrink:0,fontSize:9,color:"#555",fontWeight:700,letterSpacing:"0.4px"}}>VAR</div>
    </div>
  );
}

// ── Player row ────────────────────────────────────────────────────────────────
function PlayerRow({player,rank,isSelected,onSelect,showPct,per600}) {
  const tc    = TIER_COLORS[player.tier]??"#6B7280";
  const flags = player.flags??[];
  const c     = player.consensus??{};
  const pa    = c.PA||1;
  const isHitter = player.type==="hitter";
  const cols  = isHitter ? HIT_DISPLAY : PIT_DISPLAY;
  const dis   = player.disagreement_score??0;
  const disColor = dis>0.2?"#F87171":dis>0.1?"#FB923C":"#9CA3AF";

  return (
    <div onClick={()=>onSelect(player)}
      style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",
        borderRadius:7,cursor:"pointer",marginBottom:2,
        background:isSelected?"#131320":"#0d0d15",
        border:isSelected?`1px solid ${tc}45`:"1px solid #131320",
        transition:"all 0.1s"}}>

      <span style={{width:22,fontSize:10,color:"#2a2a3e",fontFamily:"'DM Mono',monospace",flexShrink:0}}>{rank}</span>

      <div style={{width:26,height:26,borderRadius:4,background:tc+"15",border:`1px solid ${tc}35`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:8,fontWeight:700,color:tc,flexShrink:0}}>
        {(player.pos||"?").slice(0,3)}
      </div>

      <div style={{minWidth:140,maxWidth:180,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{fontSize:13,fontWeight:600,color:"#ddd",
            letterSpacing:"-0.2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {player.name}
          </span>
          {flags.length>0&&<span style={{fontSize:9,color:"#F87171",flexShrink:0}}>⚠</span>}
        </div>
        <div style={{fontSize:10,color:"#444"}}>{player.team}</div>
      </div>

      <div style={{display:"flex",gap:8,flexShrink:0}}>
        {cols.map(cat=>{
          const raw=c[cat];
          const val=per600?scaleTo600(raw,cat,pa):raw;
          const pct=player.percentiles?.[cat];
          const lb=LOWER_BETTER.has(cat);
          const ep=lb&&pct!=null?1-pct:pct;
          const color=pctColor(ep);
          return (
            <div key={cat} style={{minWidth:36,textAlign:"right"}}>
              <div style={{color,fontWeight:600,fontFamily:"'DM Mono',monospace",fontSize:11}}>{fmtStat(val,cat)}</div>
              {showPct&&(
                <div style={{fontSize:9,color:ep!=null?color:"#333",fontFamily:"'DM Mono',monospace"}}>
                  {ep!=null?ordinal(ep):"—"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{minWidth:34,textAlign:"right",flexShrink:0}}>
        <div style={{color:disColor,fontWeight:600,fontFamily:"'DM Mono',monospace",fontSize:11}}>
          {(dis*100).toFixed(0)}%
        </div>
        {showPct&&<div style={{fontSize:9,color:"#333",fontFamily:"'DM Mono',monospace"}}>dis</div>}
      </div>

      <div style={{minWidth:36,textAlign:"right",flexShrink:0}}>
        <div style={{color:tc,fontWeight:700,fontFamily:"'DM Mono',monospace",fontSize:11}}>
          {player.VAR>0?"+":""}{player.VAR}
        </div>
        {showPct&&<div style={{fontSize:9,color:"#333",fontFamily:"'DM Mono',monospace"}}>var</div>}
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{minHeight:"100vh",background:"#080810",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",fontFamily:"'DM Mono',monospace",gap:16}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;600&display=swap');`}</style>
      <div style={{fontSize:28}}>⚾</div>
      <div style={{fontSize:14,color:"#4A9EFF",fontWeight:600}}>Loading 2026 Projections…</div>
      <div style={{width:200,height:2,background:"#1a1a2e",borderRadius:2,overflow:"hidden"}}>
        <div style={{height:"100%",background:"#4A9EFF",borderRadius:2,
          animation:"load 1.4s ease-in-out infinite",width:"40%"}}/>
      </div>
      <style>{`@keyframes load{0%{transform:translateX(-100%)}100%{transform:translateX(600%)}}`}</style>
    </div>
  );
}

function ErrorScreen({msg}) {
  return (
    <div style={{minHeight:"100vh",background:"#080810",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",fontFamily:"system-ui",gap:12,padding:24}}>
      <div style={{fontSize:28}}>⚠️</div>
      <div style={{fontSize:16,fontWeight:700,color:"#F87171"}}>Could not load player data</div>
      <div style={{fontSize:13,color:"#555",maxWidth:440,textAlign:"center"}}>{msg}</div>
      <div style={{fontSize:12,color:"#333",marginTop:8}}>
        Run <code style={{color:"#00C896",background:"#00C89610",padding:"2px 6px",borderRadius:4}}>
          python scripts/process.py</code> to generate players.json first.
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [data,setData]         = useState(null);
  const [loading,setLoading]   = useState(true);
  const [error,setError]       = useState(null);
  const [tab,setTab]           = useState("players");
  const [search,setSearch]     = useState("");
  const [teamFilter,setTeamFilter] = useState("All");
  const [typeFilter,setTypeFilter] = useState("All");
  const [posFilter,setPosFilter]   = useState("All");
  const [disFilter,setDisFilter]   = useState("All");
  const [selected,setSelected] = useState(null);
  const [per600,setPer600]     = useState(false);
  const [showPct,setShowPct]   = useState(false);

  useEffect(()=>{
    fetch("/fantasy-baseball-predictor/players.json")
      .then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();})
      .then(d=>{setData(d);setLoading(false);})
      .catch(e=>{setError(e.message);setLoading(false);});
  },[]);

  const players = data?.players??[];

  const teams = useMemo(()=>{
    const t=[...new Set(players.map(p=>p.team).filter(Boolean))].sort();
    return ["All",...t];
  },[players]);

  const posOptions = useMemo(()=>{
    if (typeFilter==="Pitchers") return PIT_POSITIONS;
    if (typeFilter==="Hitters")  return HIT_POSITIONS;
    return ["All",...HIT_POSITIONS.slice(1),...PIT_POSITIONS.slice(1)];
  },[typeFilter]);

  const filtered = useMemo(()=>players
    .filter(p=>typeFilter==="All"||(typeFilter==="Hitters"&&p.type==="hitter")||(typeFilter==="Pitchers"&&p.type==="pitcher"))
    .filter(p=>teamFilter==="All"||p.team===teamFilter)
    .filter(p=>posFilter==="All"||(p.positions||[p.pos]).some(x=>x===posFilter))
    .filter(p=>p.name?.toLowerCase().includes(search.toLowerCase())||p.team?.toLowerCase().includes(search.toLowerCase()))
    .filter(p=>{
      const dis=p.disagreement_score??0;
      if (disFilter==="Low")    return dis>0.2;
      if (disFilter==="Medium") return dis>0.1&&dis<=0.2;
      if (disFilter==="High")   return dis<=0.1;
      return true;
    })
  ,[players,typeFilter,teamFilter,posFilter,search,disFilter]);

  const byTeam = useMemo(()=>{
    const map={};
    filtered.forEach(p=>{const t=p.team||"—";if(!map[t])map[t]=[];map[t].push(p);});
    return Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0]));
  },[filtered]);

  const byPos = useMemo(()=>{
    const map={};
    filtered.forEach(p=>{
      (p.positions||[p.pos||"?"]).forEach(pos=>{
        if(!map[pos])map[pos]=[];
        if(!map[pos].find(x=>x.id===p.id))map[pos].push(p);
      });
    });
    return Object.entries(map).sort((a,b)=>b[1].length-a[1].length);
  },[filtered]);

  const handleSelect   = p=>setSelected(s=>s?.id===p.id?null:p);
  const handleNavigate = dir=>{
    if(!selected)return;
    const idx=filtered.findIndex(p=>p.id===selected.id);
    const next=filtered[idx+dir];
    if(next)setSelected(next);
  };
  const handleTypeChange = v=>{setTypeFilter(v);setPosFilter("All");};

  if(loading) return <LoadingScreen/>;
  if(error)   return <ErrorScreen msg={error}/>;

  const TAB=(t,label)=>(
    <button key={t} onClick={()=>setTab(t)}
      style={{padding:"7px 18px",borderRadius:"5px 5px 0 0",border:"none",cursor:"pointer",
        fontSize:11,fontWeight:700,letterSpacing:"0.3px",
        background:tab===t?"#0d0d15":"transparent",
        color:tab===t?"#ddd":"#444",
        borderBottom:tab===t?"2px solid #4A9EFF":"2px solid transparent",
        transition:"all 0.12s"}}>
      {label}
    </button>
  );

  const selectStyle={padding:"6px 10px",background:"#0d0d15",border:"1px solid #1e1e2e",
    borderRadius:7,color:"#ccc",fontSize:11,cursor:"pointer",outline:"none"};

  const Pill=(val,cur,setter,label,activeColor="#4A9EFF")=>(
    <button key={val} onClick={()=>setter(val)}
      style={{padding:"5px 11px",borderRadius:6,border:"1px solid",fontSize:11,fontWeight:600,cursor:"pointer",
        borderColor:cur===val?activeColor:"#1e1e2e",
        background:cur===val?activeColor+"18":"transparent",
        color:cur===val?activeColor:"#555",whiteSpace:"nowrap"}}>
      {label||val}
    </button>
  );

  const Toggle=(active,label,onClick,activeColor="#4A9EFF")=>(
    <button onClick={onClick}
      style={{padding:"5px 11px",borderRadius:6,border:`1px solid ${active?activeColor:"#1e1e2e"}`,
        background:active?activeColor+"18":"transparent",
        color:active?activeColor:"#555",cursor:"pointer",fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>
      {label}
    </button>
  );

  const Controls=()=>(
    <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
      <input placeholder="Search player or team…" value={search} onChange={e=>setSearch(e.target.value)}
        style={{...selectStyle,minWidth:160,fontFamily:"inherit",padding:"6px 12px"}}/>
      <select value={teamFilter} onChange={e=>setTeamFilter(e.target.value)} style={selectStyle}>
        {teams.map(t=><option key={t} value={t}>{t==="All"?"All Teams":t}</option>)}
      </select>
      <div style={{display:"flex",gap:4}}>
        {["All","Hitters","Pitchers"].map(t=>Pill(t,typeFilter,handleTypeChange,null,"#A78BFA"))}
      </div>
      <select value={posFilter} onChange={e=>setPosFilter(e.target.value)} style={selectStyle}>
        {posOptions.map(p=><option key={p} value={p}>{p==="All"?"All Positions":p}</option>)}
      </select>
      <div style={{width:1,height:18,background:"#2a2a3e",flexShrink:0}}/>
      <span style={{fontSize:9,color:"#444",fontWeight:700,letterSpacing:"0.5px",textTransform:"uppercase"}}>Agreement:</span>
      <div style={{display:"flex",gap:4}}>
        {Pill("All",   disFilter,setDisFilter,"All",    "#4A9EFF")}
        {Pill("High",  disFilter,setDisFilter,"✓ High", "#00C896")}
        {Pill("Medium",disFilter,setDisFilter,"~ Med",  "#FB923C")}
        {Pill("Low",   disFilter,setDisFilter,"⚡ Low", "#F87171")}
      </div>
      <div style={{width:1,height:18,background:"#2a2a3e",flexShrink:0}}/>
      {Toggle(per600,  per600?"✓ /600 PA":"/600 PA",   ()=>setPer600(v=>!v))}
      {Toggle(showPct, showPct?"✓ Percentiles":"Percentiles", ()=>setShowPct(v=>!v), "#A78BFA")}
    </div>
  );

  const PlayerList=({list})=>{
    if (list.length===0) return <div style={{color:"#2a2a3e",fontSize:13,textAlign:"center",padding:40}}>No players found.</div>;
    const lh=list.filter(p=>p.type==="hitter").length;
    const lp=list.filter(p=>p.type==="pitcher").length;
    const isHitter=lh>=lp;
    return (
      <>
        <ColumnHeaders isHitter={isHitter} showPct={showPct}/>
        {list.map((p,i)=>(
          <PlayerRow key={p.id} player={p} rank={i+1}
            isSelected={selected?.id===p.id}
            onSelect={handleSelect} showPct={showPct} per600={per600}/>
        ))}
      </>
    );
  };

  const WithPanel=({children})=>(
    <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
      <div style={{flex:1,minWidth:0}}>{children}</div>
      {selected&&<PlayerPanel player={selected} allPlayers={filtered}
        per600={per600} showPct={showPct}
        onClose={()=>setSelected(null)} onNavigate={handleNavigate}/>}
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#080810",fontFamily:"system-ui",color:"#e0e0e0"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:#0a0a12}
        ::-webkit-scrollbar-thumb{background:#1e1e2e;border-radius:2px}
        select{appearance:none;}
        select option{background:#0d0d15;color:#ccc;}
      `}</style>

      <div style={{borderBottom:"1px solid #131320",padding:"13px 24px 0",background:"#080810",
        position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1600,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"baseline",gap:12}}>
              <span style={{fontSize:17,fontWeight:700,color:"#f0f0f0",letterSpacing:"-0.4px"}}>
                ⚾ Fantasy Baseball 2026
              </span>
              <span style={{fontSize:10,color:"#2a2a3e",fontFamily:"'DM Mono',monospace"}}>
                {players.length} players · {filtered.length} shown
                {data?.generated&&` · Updated ${new Date(data.generated).toLocaleDateString()}`}
              </span>
            </div>
          </div>
          <div style={{display:"flex",gap:1}}>
            {TAB("players","📊 All Players")}
            {TAB("teams","🏟 By Team")}
            {TAB("positions","📍 By Position")}
          </div>
        </div>
      </div>

      <div style={{maxWidth:1600,margin:"0 auto",padding:"14px 24px"}}>
        <Controls/>
        {tab==="players"&&<WithPanel><PlayerList list={filtered}/></WithPanel>}
        {tab==="teams"&&(
          <WithPanel>
            {byTeam.map(([team,tp])=>(
              <div key={team} style={{marginBottom:20}}>
                <div style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",
                  letterSpacing:"0.8px",marginBottom:6,paddingBottom:5,borderBottom:"1px solid #131320"}}>
                  {team} <span style={{color:"#2a2a3e",fontWeight:400}}>({tp.length})</span>
                </div>
                <PlayerList list={tp}/>
              </div>
            ))}
          </WithPanel>
        )}
        {tab==="positions"&&(
          <WithPanel>
            {byPos.map(([pos,pp])=>(
              <div key={pos} style={{marginBottom:20}}>
                <div style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",
                  letterSpacing:"0.8px",marginBottom:6,paddingBottom:5,borderBottom:"1px solid #131320"}}>
                  {pos} <span style={{color:"#2a2a3e",fontWeight:400}}>({pp.length})</span>
                </div>
                <PlayerList list={pp}/>
              </div>
            ))}
          </WithPanel>
        )}
      </div>
    </div>
  );
}
