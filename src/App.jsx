import { useState, useEffect, useMemo, useCallback, useRef } from "react";

const LEAGUE_SIZE  = 12;
const HIT_CATS = ["R","HR","RBI","SB","OBP","H","TB"];
const PIT_CATS = ["W","K","ERA","WHIP","SV","HLD","QS"];
const LOWER_BETTER = new Set(["ERA","WHIP"]);
const SYSTEMS = ["ATC","ZiPS","Steamer","THE BAT","Depth Charts"];
const SYS_COLORS = {
  "ATC":"#4A9EFF","ZiPS":"#A78BFA","Steamer":"#00C896",
  "THE BAT":"#FB923C","Depth Charts":"#F472B6",
};
const HIT_DISPLAY  = ["G","HR","R","RBI","SB","AVG","OBP","SLG","wOBA","wRC+"];
const PIT_DISPLAY  = ["G","W","K","ERA","WHIP","SV","HLD","QS"];
const HIT_OVERVIEW = ["HR","RBI","R","SB","AVG","OBP","SLG","wOBA","wRC+","H","TB"];
const PIT_OVERVIEW = ["W","K","ERA","WHIP","SV","HLD","QS","FIP"];
const HIT_FANTASY  = ["HR","R","RBI","SB","OBP","H","TB","AVG"];
const PIT_FANTASY  = ["W","K","ERA","WHIP","SV","HLD","QS"];
const HIT_POSITIONS = ["All","C","1B","2B","3B","SS","OF","DH","UTIL"];
const PIT_POSITIONS = ["All","SP","RP"];

const HIT_SKILLS = [
  {key:"BB%",     label:"BB%",       fmt:"pct",  higherBetter:true},
  {key:"K%",      label:"K%",        fmt:"pct",  higherBetter:false},
  {key:"BABIP",   label:"BABIP",     fmt:"avg",  higherBetter:true},
  {key:"wOBA",    label:"wOBA",      fmt:"avg",  higherBetter:true},
  {key:"EV",      label:"Exit Velo", fmt:"dec1", higherBetter:true},
  {key:"LA",      label:"Launch Ang",fmt:"dec1", higherBetter:false},
  {key:"Barrel%", label:"Barrel%",   fmt:"pct",  higherBetter:true},
  {key:"HardHit%",label:"HardHit%",  fmt:"pct",  higherBetter:true},
  {key:"xBA",     label:"xBA",       fmt:"avg",  higherBetter:true},
  {key:"Pull%",   label:"Pull%",     fmt:"pct",  higherBetter:false},
  {key:"FB%",     label:"FB%",       fmt:"pct",  higherBetter:false},
  {key:"LD%",     label:"LD%",       fmt:"pct",  higherBetter:true},
  {key:"GB%",     label:"GB%",       fmt:"pct",  higherBetter:false},
  {key:"WAR",     label:"WAR",       fmt:"dec1", higherBetter:true},
];

const PIT_SKILLS = [
  {key:"K%",    label:"K%",    fmt:"pct",  higherBetter:true},
  {key:"BB%",   label:"BB%",   fmt:"pct",  higherBetter:false},
  {key:"BABIP", label:"BABIP", fmt:"avg",  higherBetter:false},
  {key:"FIP",   label:"FIP",   fmt:"avg",  higherBetter:false},
  {key:"GB%",   label:"GB%",   fmt:"pct",  higherBetter:true},
  {key:"LD%",   label:"LD%",   fmt:"pct",  higherBetter:false},
  {key:"LOB%",  label:"LOB%",  fmt:"pct",  higherBetter:true},
  {key:"WAR",   label:"WAR",   fmt:"dec1", higherBetter:true},
];

const HIT_HIST_STATS = ["G","PA","HR","R","RBI","SB","AVG","OBP","SLG","wOBA","WAR"];
const PIT_HIST_STATS = ["G","GS","IP","W","SO","ERA","WHIP","FIP","WAR"];

// ── Color helpers ─────────────────────────────────────────────────────────────
function pctColor(pct, lowerBetter=false) {
  const ep = lowerBetter && pct!=null ? 1-pct : pct;
  if (ep==null) return "#555";
  if (ep>=.90) return "#00C896";
  if (ep>=.70) return "#4A9EFF";
  if (ep>=.40) return "#9CA3AF";
  if (ep>=.20) return "#FB923C";
  return "#F87171";
}

function skillPctColor(pct, higherBetter=true) {
  if (pct==null) return "#9CA3AF";
  const ep = higherBetter ? pct : 1-pct;
  if (ep >= 0.95) return "#00C896";
  if (ep >= 0.90) return "#34D399";
  if (ep >= 0.75) return "#6EE7B7";
  if (ep <= 0.05) return "#EF4444";
  if (ep <= 0.10) return "#F87171";
  if (ep <= 0.25) return "#FCA5A5";
  return "#9CA3AF";
}

// Disagreement light color
function disColor(dis) {
  if (dis <= 0.1)  return "#00C896"; // green — high agreement
  if (dis <= 0.2)  return "#FBBF24"; // yellow — medium
  return "#F87171";                  // red — low agreement
}
function disLabel(dis) {
  if (dis <= 0.1)  return "🟢";
  if (dis <= 0.2)  return "🟡";
  return "🔴";
}

function fmtStat(val, cat) {
  if (val==null) return "—";
  if (["OBP","AVG","SLG","wOBA","ERA","WHIP","BABIP","xBA","FIP"].includes(cat)) return Number(val).toFixed(3);
  if (cat==="wRC+") return Math.round(val);
  return Math.round(val*10)/10;
}

function fmtSkill(val, fmt) {
  if (val==null) return "—";
  if (fmt==="pct")  return (val*100).toFixed(1)+"%";
  if (fmt==="avg")  return Number(val).toFixed(3);
  if (fmt==="dec1") return Number(val).toFixed(1);
  return val;
}

function scaleTo600(val, cat, pa) {
  if (val==null||!pa) return null;
  if (!["R","HR","RBI","SB","H","TB","BB","SO","W","K","SV","HLD","QS"].includes(cat)) return val;
  return Math.round((val/pa)*600*10)/10;
}

function ordinal(pct) {
  if (pct==null) return null;
  const n = Math.round(pct*100);
  if (n===100) return "99th";
  const s=["th","st","nd","rd"], v=n%100;
  return n+(s[(v-20)%10]||s[v]||s[0]);
}

function buildSkillPercentiles(allPlayers, type) {
  const skills = type==="hitter" ? HIT_SKILLS : PIT_SKILLS;
  const pctFns = {};
  skills.forEach(skill => {
    const vals = [];
    allPlayers.filter(p=>p.type===type).forEach(p=>{
      const hist = p.history||[];
      const latest = hist.filter(h=>h[skill.key]!=null).sort((a,b)=>(b.season||0)-(a.season||0))[0];
      if (latest) vals.push(latest[skill.key]);
    });
    vals.sort((a,b)=>a-b);
    pctFns[skill.key] = v => {
      if (v==null||!vals.length) return null;
      return vals.filter(x=>x<=v).length / vals.length;
    };
  });
  return pctFns;
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({values, higherBetter, pct2025}) {
  const valid = values.filter(v=>v!=null);
  if (valid.length < 2) return <span style={{color:"#2a2a3e",fontSize:10}}>—</span>;
  const min=Math.min(...valid), max=Math.max(...valid), range=max-min||0.001;
  const w=56, h=16;
  const pts = values.map((v,i)=>{
    const x=(i/(values.length-1))*w;
    const y=v!=null?h-((v-min)/range)*(h-2)+1:null;
    return y!=null?`${x},${y}`:null;
  }).filter(Boolean).join(" ");
  const lineColor = skillPctColor(pct2025, higherBetter);
  return (
    <svg width={w} height={h} style={{verticalAlign:"middle",overflow:"visible"}}>
      <polyline points={pts} fill="none" stroke={lineColor} strokeWidth={1.5} strokeOpacity={0.8}/>
      {values.map((v,i)=>{
        if(v==null) return null;
        const x=(i/(values.length-1))*w;
        const y=h-((v-min)/range)*(h-2)+1;
        const isLast=i===values.length-1;
        return <circle key={i} cx={x} cy={y} r={isLast?2.5:1.5} fill={isLast?lineColor:"#333"}/>;
      })}
    </svg>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({cat, val, pct}) {
  const lb    = LOWER_BETTER.has(cat);
  const ep    = lb && pct!=null ? 1-pct : pct;
  const color = pctColor(ep);
  const ord   = ordinal(ep);
  return (
    <div style={{background:"#111118",border:"1px solid #1a1a2e",borderRadius:8,
      padding:"10px 12px",display:"flex",flexDirection:"column",gap:4}}>
      <div style={{fontSize:9,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.6px"}}>{cat}</div>
      <div style={{fontSize:22,fontWeight:700,color,fontFamily:"'DM Mono',monospace",lineHeight:1}}>{fmtStat(val,cat)}</div>
      <div>
        <div style={{height:3,background:"#1a1a2e",borderRadius:2,marginBottom:3,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${(ep??0)*100}%`,background:color,borderRadius:2,transition:"width 0.5s"}}/>
        </div>
        <div style={{fontSize:9,color:ord?color:"#333",fontFamily:"'DM Mono',monospace"}}>{ord||"—"}</div>
      </div>
    </div>
  );
}

// ── Systems panel — horizontal bars ───────────────────────────────────────────
function SystemsPanel({player, per600}) {
  const cats = player.type==="hitter" ? HIT_FANTASY : PIT_FANTASY;
  const available = SYSTEMS.filter(s => player.systems?.[s]);
  if (!available.length) return <div style={{color:"#444",fontSize:12,padding:8}}>No system data.</div>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      {cats.map(cat => {
        const lb = LOWER_BETTER.has(cat);
        const pa = player.consensus?.PA || 1;
        const sysVals = available.map(sys => {
          const raw = player.systems[sys]?.[cat];
          const val = per600 ? scaleTo600(raw,cat,pa) : raw;
          return {sys, val};
        }).filter(d => d.val != null);
        const consensus = player.consensus?.[cat];
        const consVal   = per600 ? scaleTo600(consensus,cat,pa) : consensus;
        if (!sysVals.length && consVal==null) return null;
        const allVals = [...sysVals.map(d=>d.val), ...(consVal!=null?[consVal]:[])];
        const min = Math.min(...allVals), max = Math.max(...allVals), range = max-min||0.001;
        const pct    = player.percentiles?.[cat];
        const ep     = lb && pct!=null ? 1-pct : pct;
        const color  = pctColor(ep);

        return (
          <div key={cat}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:7}}>
              <span style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:"0.6px"}}>{cat}</span>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                {pct!=null && <span style={{fontSize:10,color,fontFamily:"'DM Mono',monospace"}}>{ordinal(ep)}</span>}
                <span style={{fontSize:13,fontWeight:700,color,fontFamily:"'DM Mono',monospace"}}>{fmtStat(consVal,cat)}</span>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {sysVals.map(({sys,val}) => {
                const barW = Math.max(0.04, Math.min(1, (val-min)/range));
                const sysColor = SYS_COLORS[sys];
                return (
                  <div key={sys} style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:82,fontSize:10,color:"#555",display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
                      <span style={{width:6,height:6,borderRadius:"50%",background:sysColor,display:"inline-block",flexShrink:0}}/>
                      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sys}</span>
                    </div>
                    <div style={{flex:1,height:6,background:"#1a1a2e",borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${barW*100}%`,background:sysColor,borderRadius:3,opacity:0.85,transition:"width 0.4s"}}/>
                    </div>
                    <div style={{width:42,textAlign:"right",fontSize:11,color:sysColor,fontFamily:"'DM Mono',monospace",fontWeight:600,flexShrink:0}}>
                      {fmtStat(val,cat)}
                    </div>
                  </div>
                );
              })}
              {consVal!=null && (
                <div style={{display:"flex",alignItems:"center",gap:8,marginTop:1,paddingTop:4,borderTop:"1px solid #1a1a2e"}}>
                  <div style={{width:82,fontSize:10,color:"#4A9EFF",fontWeight:700,flexShrink:0}}>Consensus</div>
                  <div style={{flex:1,height:6,background:"#1a1a2e",borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${Math.max(0.04,Math.min(1,(consVal-min)/range))*100}%`,background:color,borderRadius:3,transition:"width 0.4s"}}/>
                  </div>
                  <div style={{width:42,textAlign:"right",fontSize:11,color,fontFamily:"'DM Mono',monospace",fontWeight:700,flexShrink:0}}>
                    {fmtStat(consVal,cat)}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Disagreement panel ────────────────────────────────────────────────────────
function DisagreementPanel({player}) {
  const cats = player.type==="hitter" ? HIT_CATS : PIT_CATS;
  const overall = player.disagreement_score ?? 0;
  return (
    <div>
      {/* Overall */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
        padding:"6px 0 10px",marginBottom:8,borderBottom:"2px solid #1a1a2e"}}>
        <span style={{fontSize:11,color:"#888",fontWeight:700}}>Overall Agreement</span>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>{disLabel(overall)}</span>
          <span style={{fontSize:11,color:disColor(overall),fontFamily:"'DM Mono',monospace",fontWeight:700}}>
            {overall<=0.1?"High":overall<=0.2?"Medium":"Low"}
          </span>
        </div>
      </div>
      {cats.map(cat=>{
        const cv=player.disagreement?.[cat]??0;
        const color=disColor(cv);
        const label=cv<=0.1?"High":cv<=0.2?"Medium":"Low";
        return (
          <div key={cat} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
            padding:"5px 0",borderBottom:"1px solid #131320"}}>
            <span style={{fontSize:11,color:"#555"}}>{cat}</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:70,height:3,background:"#1a1a2e",borderRadius:2}}>
                <div style={{height:"100%",width:`${Math.min(cv*200,100)}%`,background:color,borderRadius:2}}/>
              </div>
              <span style={{fontSize:12}}>{disLabel(cv)}</span>
              <span style={{fontSize:10,color,width:52,textAlign:"right"}}>{label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Skills panel ──────────────────────────────────────────────────────────────
function SkillsPanel({player, skillPctFns}) {
  const skills  = player.type==="hitter" ? HIT_SKILLS : PIT_SKILLS;
  const history = player.history||[];
  const seasons = [...new Set(history.map(h=>h.season).filter(Boolean))].sort().slice(-4);
  return (
    <div style={{background:"#0f0f18",border:"1px solid #1a1a2e",borderRadius:8,padding:12}}>
      <div style={{fontSize:9,color:"#444",fontWeight:700,marginBottom:10,
        textTransform:"uppercase",letterSpacing:"0.8px"}}>Skill Metrics — Year over Year</div>
      {seasons.length===0 ? (
        <div style={{color:"#333",fontSize:12,textAlign:"center",padding:20}}>No historical skill data</div>
      ) : (
        <>
          <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:6,paddingBottom:5,borderBottom:"1px solid #1a1a2e"}}>
            <div style={{width:78,flexShrink:0,fontSize:9,color:"#333",fontWeight:700}}>Stat</div>
            <div style={{width:58,flexShrink:0,fontSize:9,color:"#333",fontWeight:700,textAlign:"center"}}>Trend</div>
            {seasons.map(s=><div key={s} style={{flex:1,fontSize:9,color:"#444",fontWeight:700,textAlign:"right"}}>{s}</div>)}
          </div>
          {skills.map(skill=>{
            const vals=seasons.map(s=>{
              const h=history.find(h=>h.season===s);
              return h?h[skill.key]??null:null;
            });
            const hasData=vals.some(v=>v!=null);
            const latest=vals[vals.length-1];
            const rawPct=skillPctFns?.[skill.key]?.(latest);
            const latestColor=skillPctColor(rawPct, skill.higherBetter);
            return (
              <div key={skill.key} style={{display:"flex",alignItems:"center",gap:4,
                padding:"3px 0",borderBottom:"1px solid #0f0f1a"}}>
                <div style={{width:78,flexShrink:0,fontSize:10,color:"#666",
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{skill.label}</div>
                <div style={{width:58,flexShrink:0,textAlign:"center"}}>
                  {hasData?<Sparkline values={vals} higherBetter={skill.higherBetter} pct2025={rawPct}/>
                    :<span style={{color:"#2a2a3e",fontSize:10}}>—</span>}
                </div>
                {vals.map((v,i)=>{
                  const isLatest=i===vals.length-1;
                  return (
                    <div key={i} style={{flex:1,textAlign:"right",fontFamily:"'DM Mono',monospace",
                      fontSize:10,fontWeight:isLatest?700:400,
                      color:v==null?"#2a2a3e":isLatest?latestColor:"#555"}}>
                      {fmtSkill(v,skill.fmt)}
                    </div>
                  );
                })}
              </div>
            );
          })}
          <div style={{marginTop:10,display:"flex",gap:8,flexWrap:"wrap"}}>
            {[{color:"#00C896",label:"Top 5%"},{color:"#34D399",label:"Top 10%"},{color:"#6EE7B7",label:"Top 25%"},
              {color:"#FCA5A5",label:"Bot 25%"},{color:"#F87171",label:"Bot 10%"},{color:"#EF4444",label:"Bot 5%"}].map(({color,label})=>(
              <div key={label} style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:8,height:8,borderRadius:2,background:color}}/>
                <span style={{fontSize:9,color:"#555"}}>{label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Historical panel ──────────────────────────────────────────────────────────
function HistoricalPanel({player, skillPctFns}) {
  const history  = player.history||[];
  const seasons  = [...new Set(history.map(h=>h.season).filter(Boolean))].sort();
  const statKeys = player.type==="hitter" ? HIT_HIST_STATS : PIT_HIST_STATS;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {seasons.length===0 ? (
        <div style={{background:"#0f0f18",border:"1px solid #1a1a2e",borderRadius:8,padding:20,textAlign:"center",color:"#333",fontSize:12}}>No historical data</div>
      ) : (
        <div style={{background:"#0f0f18",border:"1px solid #1a1a2e",borderRadius:8,padding:14}}>
          <div style={{fontSize:9,color:"#444",fontWeight:700,marginBottom:12,textTransform:"uppercase",letterSpacing:"0.8px"}}>Season Stats (2022–2025)</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"'DM Mono',monospace"}}>
              <thead>
                <tr>
                  <th style={{textAlign:"left",padding:"4px 6px",color:"#444",fontSize:10,fontWeight:700}}>Season</th>
                  {statKeys.map(k=><th key={k} style={{textAlign:"right",padding:"4px 5px",color:"#444",fontSize:10,fontWeight:700}}>{k}</th>)}
                </tr>
              </thead>
              <tbody>
                {seasons.map(season=>{
                  const h=history.find(x=>x.season===season);
                  return (
                    <tr key={season} style={{borderTop:"1px solid #1a1a2e"}}>
                      <td style={{padding:"5px 6px",color:"#4A9EFF",fontWeight:700}}>{season}</td>
                      {statKeys.map(k=>{
                        const v=h?.[k];
                        return <td key={k} style={{textAlign:"right",padding:"5px 5px",color:v!=null?"#bbb":"#2a2a3e"}}>{v!=null?fmtStat(v,k):"—"}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <SkillsPanel player={player} skillPctFns={skillPctFns}/>
    </div>
  );
}

// ── Player panel ──────────────────────────────────────────────────────────────
function PlayerPanel({player,allPlayers,per600,showPct,onClose,onNavigate,skillPctFns,poolPcts,scarcity}) {
  const [panelTab,setPanelTab]=useState("overview");
  if (!player) return null;
  const idx  = allPlayers.findIndex(p=>p.id===player.id);
  const overviewCats = player.type==="hitter" ? HIT_OVERVIEW : PIT_OVERVIEW;
  const flags= player.flags??[];
  const war  = player.consensus?.WAR ?? player.history?.slice(-1)[0]?.WAR ?? null;

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
          <div style={{fontSize:16,fontWeight:700,color:"#f0f0f0",letterSpacing:"-0.3px",
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{player.name}</div>
          <div style={{fontSize:12,color:"#666",marginTop:4,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <span>{player.team}</span>
            <span style={{color:"#2a2a3e"}}>·</span>
            <span>{player.pos||"?"}</span>
            {war!=null&&(
              <>
                <span style={{color:"#2a2a3e"}}>·</span>
                <span style={{color:"#A78BFA",fontFamily:"'DM Mono',monospace",fontWeight:700}}>
                  {war>0?"+":""}{Number(war).toFixed(1)} WAR
                </span>
              </>
            )}
            {flags.map(f=>(
              <span key={f} style={{color:"#F87171",background:"#F8717115",
                border:"1px solid #F8717130",borderRadius:3,padding:"0 4px",fontSize:9,fontWeight:700}}>
                {f.toUpperCase()}
              </span>
            ))}
          </div>
          <div style={{fontSize:10,color:"#444",marginTop:3,fontFamily:"'DM Mono',monospace"}}>
            {player.type==="hitter"?`${Math.round(player.consensus?.PA||0)} PA`:`${Math.round(player.consensus?.IP||0)} IP`}
            {" · "}{Object.keys(player.systems||{}).length} sys
            {(()=>{
              const s = scarcity?.[player.pos];
              if (!s) return null;
              const si = s.scarcity_index;
              const label = si < 0.8 ? "🔴 Scarce" : si < 1.2 ? "🟡 Moderate" : "🟢 Deep";
              const color = si < 0.8 ? "#F87171" : si < 1.2 ? "#FBBF24" : "#00C896";
              return <span style={{color,marginLeft:6,fontWeight:700}}>
                {label} ({s.elite_count} elite / {s.starter_slots} slots)
              </span>;
            })()}
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

      {/* VAR · Z · CWS · WFPTS */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
        {[
          ["VAR",    player.VAR,    "#4A9EFF", "Value over repl.",   player.percentiles?.VAR],
          ["Z-Score",player.zScore, "#A78BFA", "Category z-score",   player.percentiles?.zScore],
          ["CWS",    player.CWS,    "#00C896", "Category win score",  player.percentiles?.CWS],
          ["WFPTS",  player.WFPTS,  "#FB923C", "Weighted fant. pts",  player.percentiles?.WFPTS],
        ].map(([lbl,val,c,sub,pct])=>{
          const ord = ordinal(pct);
          return (
            <div key={lbl} style={{background:c+"10",border:`1px solid ${c}25`,borderRadius:8,
              padding:"8px 10px",textAlign:"center"}}>
              <div style={{fontSize:8,color:"#444",marginBottom:1,letterSpacing:"0.4px"}}>{lbl}</div>
              <div style={{fontSize:18,fontWeight:700,color:c,fontFamily:"'DM Mono',monospace",lineHeight:1.1}}>
                {val!=null?(val>0&&lbl==="VAR"?"+":"")+val:"—"}
              </div>
              {ord && <div style={{fontSize:9,color:c,fontFamily:"'DM Mono',monospace",marginTop:2,opacity:0.8}}>{ord}</div>}
              <div style={{fontSize:8,color:"#333",marginTop:1}}>{sub}</div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:1,marginBottom:14,background:"#0f0f18",borderRadius:7,padding:3,flexWrap:"wrap"}}>
        {PT("overview","Overview")}
        {PT("systems","Systems")}
        {PT("disagree","Disagree")}
        {PT("skills","Skills")}
        {PT("history","Historical")}
      </div>

      {panelTab==="overview"&&(
        <div>
          <div style={{fontSize:9,color:"#444",fontWeight:700,marginBottom:10,
            textTransform:"uppercase",letterSpacing:"0.8px"}}>
            Key Stats — vs top 300 {per600?"(per 600 PA)":""}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {overviewCats.map(cat=>{
              const raw=player.consensus?.[cat], pa=player.consensus?.PA||1;
              const val=per600?scaleTo600(raw,cat,pa):raw;
              return <StatCard key={cat} cat={cat} val={val} pct={player.percentiles?.[cat]}/>;
            })}
          </div>
        </div>
      )}

      {panelTab==="systems"&&(
        <div>
          <div style={{fontSize:9,color:"#444",fontWeight:700,marginBottom:12,
            textTransform:"uppercase",letterSpacing:"0.8px"}}>
            Fantasy Stats by System {per600?"(per 600 PA)":""}
          </div>
          <SystemsPanel player={player} per600={per600}/>
        </div>
      )}

      {panelTab==="disagree"&&(
        <div style={{background:"#0f0f18",border:"1px solid #1a1a2e",borderRadius:8,padding:14}}>
          <div style={{fontSize:9,color:"#444",fontWeight:700,marginBottom:10,
            textTransform:"uppercase",letterSpacing:"0.8px"}}>Model Agreement per Category</div>
          <DisagreementPanel player={player}/>
        </div>
      )}
      {panelTab==="skills"&&<SkillsPanel player={player} skillPctFns={skillPctFns}/>}
      {panelTab==="history"&&<HistoricalPanel player={player} skillPctFns={skillPctFns}/>}
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
      <div style={{width:26,flexShrink:0,fontSize:9,color:"#333",textTransform:"uppercase",letterSpacing:"0.4px",textAlign:"center"}}>POS</div>
      <div style={{minWidth:140,maxWidth:180,flexShrink:0,fontSize:9,color:"#444",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"}}>Player</div>
      <div style={{display:"flex",gap:8,flexShrink:0}}>
        {cols.map(cat=>(
          <div key={cat} style={{minWidth:36,textAlign:"right"}}>
            <div style={{fontSize:9,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.4px"}}>{cat}</div>
            {showPct&&<div style={{fontSize:8,color:"#2a2a3e",marginTop:1}}>rank</div>}
          </div>
        ))}
      </div>
      <div style={{minWidth:26,textAlign:"center",flexShrink:0,fontSize:9,color:"#555",fontWeight:700,letterSpacing:"0.4px"}}>AGR</div>
      <div style={{minWidth:36,textAlign:"right",flexShrink:0,fontSize:9,color:"#555",fontWeight:700,letterSpacing:"0.4px"}}>VAR</div>
    </div>
  );
}

// ── Player row ────────────────────────────────────────────────────────────────
function PlayerRow({player,rank,isSelected,onSelect,showPct,per600}) {
  const flags = player.flags??[];
  const c     = player.consensus??{};
  const pa    = c.PA||1;
  const isHitter = player.type==="hitter";
  const cols  = isHitter ? HIT_DISPLAY : PIT_DISPLAY;
  const dis   = player.disagreement_score??0;
  const varColor = player.VAR>=8?"#00C896":player.VAR>=2?"#4A9EFF":player.VAR>=-2?"#9CA3AF":"#F87171";

  return (
    <div onClick={()=>onSelect(player)}
      style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",
        borderRadius:7,cursor:"pointer",marginBottom:2,
        background:isSelected?"#131320":"#0d0d15",
        border:isSelected?"1px solid #4A9EFF45":"1px solid #131320",
        transition:"all 0.1s"}}>
      <span style={{width:22,fontSize:10,color:"#2a2a3e",fontFamily:"'DM Mono',monospace",flexShrink:0}}>{rank}</span>
      <div style={{width:26,height:26,borderRadius:4,background:"#1a1a2e",border:"1px solid #2a2a3e",
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:8,fontWeight:700,color:"#888",flexShrink:0}}>
        {(player.pos||"?").slice(0,3)}
      </div>
      <div style={{minWidth:140,maxWidth:180,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{fontSize:13,fontWeight:600,color:"#ddd",letterSpacing:"-0.2px",
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{player.name}</span>
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
              {showPct&&<div style={{fontSize:9,color:ep!=null?color:"#333",fontFamily:"'DM Mono',monospace"}}>{ep!=null?ordinal(ep):"—"}</div>}
            </div>
          );
        })}
      </div>
      {/* Agreement light */}
      <div style={{minWidth:26,textAlign:"center",flexShrink:0,fontSize:14,lineHeight:1}}>
        {disLabel(dis)}
      </div>
      <div style={{minWidth:36,textAlign:"right",flexShrink:0}}>
        <div style={{color:varColor,fontWeight:700,fontFamily:"'DM Mono',monospace",fontSize:11}}>
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
        <div style={{height:"100%",background:"#4A9EFF",borderRadius:2,animation:"load 1.4s ease-in-out infinite",width:"40%"}}/>
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
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [data,setData]         = useState(null);
  const [loading,setLoading]   = useState(true);
  const [error,setError]       = useState(null);
  // Search state lifted to top level to fix re-render focus loss
  const [search,setSearch]     = useState("");
  const [teamFilter,setTeamFilter] = useState("All");
  const [typeFilter,setTypeFilter] = useState("All");
  const [posFilter,setPosFilter]   = useState("All");
  const [disFilter,setDisFilter]   = useState("All");
  const [selected,setSelected] = useState(null);
  const [per600,setPer600]     = useState(false);
  const [showPct,setShowPct]   = useState(false);
  const [sortBy,setSortBy]     = useState("VAR");
  const searchRef = useRef(null);

  useEffect(()=>{
    fetch("/fantasy-baseball-predictor/players.json")
      .then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();})
      .then(d=>{setData(d);setLoading(false);})
      .catch(e=>{setError(e.message);setLoading(false);});
  },[]);

  const players  = data?.players??[];
  const scarcity  = data?.scarcity??{};

  const hitterSkillPcts  = useMemo(()=>buildSkillPercentiles(players,"hitter"),  [players]);
  const pitcherSkillPcts = useMemo(()=>buildSkillPercentiles(players,"pitcher"), [players]);
  const getSkillPcts = useCallback(p=>p.type==="hitter"?hitterSkillPcts:pitcherSkillPcts,[hitterSkillPcts,pitcherSkillPcts]);

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

  // Per-600 adjusted values for sorting
  const getSortVal = (p, key) => {
    if (key === "VAR" || key === "zScore" || key === "CWS") return p[key] ?? -999;
    if (key === "WFPTS") {
      if (!per600) return p.WFPTS ?? -999;
      // Recalculate WFPTS on the fly with per-600 values — use raw VAR as proxy since
      // WFPTS is already normalized; per600 doesn't change ranking meaningfully for rate stats
      return p.WFPTS ?? -999;
    }
    return p[key] ?? -999;
  };

  const sorted = useMemo(()=>[...filtered].sort((a,b)=>getSortVal(b,sortBy)-getSortVal(a,sortBy))
  ,[filtered, sortBy, per600]);

  // Pool percentiles stored server-side in player.percentiles — just pass a lookup fn
  const poolPcts = useMemo(()=>({
    VAR:    v => null, // resolved per-player via player.percentiles.VAR
    zScore: v => null,
    WFPTS:  v => null,
    CWS:    v => null,
  }),[]);

  const handleSelect   = useCallback(p=>setSelected(s=>s?.id===p.id?null:p),[]);
  const handleNavigate = useCallback(dir=>{
    setSelected(prev=>{
      if(!prev) return prev;
      const idx=filtered.findIndex(p=>p.id===prev.id);
      const next=filtered[idx+dir];
      return next||prev;
    });
  },[filtered]);
  const handleTypeChange = useCallback(v=>{setTypeFilter(v);setPosFilter("All");},[]);

  if(loading) return <LoadingScreen/>;
  if(error)   return <ErrorScreen msg={error}/>;

  const sel={padding:"6px 10px",background:"#0d0d15",border:"1px solid #1e1e2e",
    borderRadius:7,color:"#ccc",fontSize:11,cursor:"pointer",outline:"none"};

  const Pill=(val,cur,setter,label,activeColor="#4A9EFF")=>(
    <button key={val} onClick={()=>setter(val)}
      style={{padding:"5px 11px",borderRadius:6,border:"1px solid",fontSize:11,fontWeight:600,cursor:"pointer",
        borderColor:cur===val?activeColor:"#1e1e2e",background:cur===val?activeColor+"18":"transparent",
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

  const PlayerList = ({list})=>{
    if(list.length===0) return <div style={{color:"#2a2a3e",fontSize:13,textAlign:"center",padding:40}}>No players found.</div>;
    const isHitter=list.filter(p=>p.type==="hitter").length >= list.filter(p=>p.type==="pitcher").length;
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

      {/* Header */}
      <div style={{borderBottom:"1px solid #131320",padding:"13px 24px 12px",background:"#080810",
        position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1600,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"baseline",gap:12,marginBottom:12}}>
            <span style={{fontSize:17,fontWeight:700,color:"#f0f0f0",letterSpacing:"-0.4px"}}>⚾ Fantasy Baseball 2026</span>
            <span style={{fontSize:10,color:"#2a2a3e",fontFamily:"'DM Mono',monospace"}}>
              {players.length} players · {filtered.length} shown
              {data?.generated&&` · Updated ${new Date(data.generated).toLocaleDateString()}`}
            </span>
          </div>

          {/* Controls — all in one row */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <input
              ref={searchRef}
              placeholder="Search player or team…"
              value={search}
              onChange={e=>setSearch(e.target.value)}
              style={{...sel,minWidth:160,fontFamily:"inherit",padding:"6px 12px"}}
            />
            <select value={teamFilter} onChange={e=>setTeamFilter(e.target.value)} style={sel}>
              {teams.map(t=><option key={t} value={t}>{t==="All"?"All Teams":t}</option>)}
            </select>
            <div style={{display:"flex",gap:4}}>
              {["All","Hitters","Pitchers"].map(t=>Pill(t,typeFilter,handleTypeChange,null,"#A78BFA"))}
            </div>
            <select value={posFilter} onChange={e=>setPosFilter(e.target.value)} style={sel}>
              {posOptions.map(p=><option key={p} value={p}>{p==="All"?"All Positions":p}</option>)}
            </select>
            <div style={{width:1,height:18,background:"#2a2a3e",flexShrink:0}}/>
            <span style={{fontSize:9,color:"#444",fontWeight:700,letterSpacing:"0.5px",textTransform:"uppercase"}}>Agreement:</span>
            <div style={{display:"flex",gap:4}}>
              {Pill("All",   disFilter,setDisFilter,"All",    "#4A9EFF")}
              {Pill("High",  disFilter,setDisFilter,"🟢 High","#00C896")}
              {Pill("Medium",disFilter,setDisFilter,"🟡 Med", "#FBBF24")}
              {Pill("Low",   disFilter,setDisFilter,"🔴 Low", "#F87171")}
            </div>
            <div style={{width:1,height:18,background:"#2a2a3e",flexShrink:0}}/>
            {Toggle(per600,  per600?"✓ /600 PA":"/600 PA",   ()=>setPer600(v=>!v))}
            {Toggle(showPct, showPct?"✓ Percentiles":"Percentiles", ()=>setShowPct(v=>!v), "#A78BFA")}
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{...sel,color:"#A78BFA",borderColor:"#A78BFA50"}}>
              <option value="VAR">Sort: VAR</option>
              <option value="zScore">Sort: Z-Score</option>
              <option value="CWS">Sort: CWS</option>
              <option value="WFPTS">Sort: WFPTS</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1600,margin:"0 auto",padding:"14px 24px"}}>
        <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
          <div style={{flex:1,minWidth:0}}>
            <PlayerList list={sorted}/>
          </div>
          {selected&&(
            <PlayerPanel player={selected} allPlayers={sorted}
              per600={per600} showPct={showPct}
              skillPctFns={getSkillPcts(selected)}
              poolPcts={poolPcts}
              scarcity={scarcity}
              onClose={()=>setSelected(null)} onNavigate={handleNavigate}/>
          )}
        </div>
      </div>
    </div>
  );
}
