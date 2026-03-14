import { useState, useEffect, useMemo } from "react";

const LEAGUE_SIZE  = 12;
const MY_PICK      = 10;
const ROUNDS       = 28;
const ROSTER_SLOTS = { C:1,"1B":1,"2B":1,SS:1,"3B":1,OF:3,UTIL:1,SP:5,RP:3,P:2,BN:7 };

const HIT_CATS = ["R","HR","RBI","SB","OBP","H","TB"];
const PIT_CATS = ["W","K","ERA","WHIP","SV","HLD","QS"];
const LOWER_BETTER = new Set(["ERA","WHIP"]);

const SYSTEMS = ["ATC","ZiPS","Steamer","THE BAT","Depth Charts"];
const SYS_COLORS = {
  "ATC":"#4A9EFF","ZiPS":"#A78BFA","Steamer":"#00C896",
  "THE BAT":"#FB923C","Depth Charts":"#F472B6",
};
const TIER_COLORS = { 1:"#00C896",2:"#4A9EFF",3:"#A78BFA",4:"#6B7280",5:"#F87171" };
const POSITIONS_HIT = ["All","C","1B","2B","3B","SS","OF","DH","UTIL"];
const POSITIONS_PIT = ["All","SP","RP"];

function pctColor(pct, lowerBetter=false) {
  const ep = lowerBetter && pct != null ? 1-pct : pct;
  if (ep==null) return "#444";
  if (ep>=.90) return "#00C896";
  if (ep>=.70) return "#4A9EFF";
  if (ep>=.40) return "#9CA3AF";
  if (ep>=.20) return "#FB923C";
  return "#F87171";
}

function fmt(val, cat) {
  if (val==null) return "—";
  if (["OBP","AVG","SLG","wOBA","ERA","WHIP"].includes(cat)) return Number(val).toFixed(3);
  if (cat === "wRC+") return Math.round(val);
  return Math.round(val*10)/10;
}

function scaleTo600(val, cat, pa) {
  if (val==null||!pa) return null;
  if (!["R","HR","RBI","SB","H","TB","BB","SO"].includes(cat)) return val;
  return Math.round((val/pa)*600*10)/10;
}

function getMyPicks(leagueSize, myPick, rounds) {
  return Array.from({length:rounds},(_,i)=>{
    const round=i+1, isEven=round%2===0;
    const pickInRound=isEven?leagueSize-myPick+1:myPick;
    return {round,pickInRound,overall:(round-1)*leagueSize+pickInRound};
  });
}

function PctBar({val,pct,cat}) {
  const lb=LOWER_BETTER.has(cat);
  const ep=lb?(pct!=null?1-pct:null):pct;
  const color=pctColor(ep);
  return (
    <div style={{marginBottom:7}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
        <span style={{fontSize:10,color:"#555",textTransform:"uppercase",letterSpacing:"0.5px"}}>{cat}</span>
        <span style={{fontSize:12,fontWeight:700,color,fontFamily:"'DM Mono',monospace"}}>{fmt(val,cat)}</span>
      </div>
      <div style={{height:3,background:"#1a1a2e",borderRadius:2,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${(ep??0)*100}%`,background:color,borderRadius:2,transition:"width 0.5s"}}/>
      </div>
    </div>
  );
}

function DisBadge({cv}) {
  if (!cv||cv<0.12) return null;
  const high=cv>0.25, c=high?"#F87171":"#FB923C";
  return (
    <span style={{fontSize:9,fontWeight:700,color:c,background:c+"20",
      border:`1px solid ${c}40`,borderRadius:3,padding:"1px 4px",letterSpacing:"0.5px",marginLeft:4}}>
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
                  return <td key={cat} style={{textAlign:"right",padding:"5px 5px",color:val==null?"#2a2a3e":"#bbb",fontSize:11}}>{fmt(val,cat)}</td>;
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
                  <span style={{color:"#4A9EFF",fontFamily:"'DM Mono',monospace",fontSize:11}}>{fmt(val,cat)}</span>
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

function PlayerPanel({player,allPlayers,per600,onClose,onNavigate}) {
  const [panelTab,setPanelTab]=useState("overview");
  if (!player) return null;
  const tc=TIER_COLORS[player.tier]??"#6B7280";
  const idx=allPlayers.findIndex(p=>p.id===player.id);
  const cats=player.type==="hitter"?HIT_CATS:PIT_CATS;
  const flags=player.flags??[];
  const PT=(t,label)=>(
    <button key={t} onClick={()=>setPanelTab(t)}
      style={{padding:"5px 10px",fontSize:10,fontWeight:700,border:"none",cursor:"pointer",
        borderRadius:5,background:panelTab===t?"#1e1e2e":"transparent",
        color:panelTab===t?"#ddd":"#444"}}>
      {label}
    </button>
  );
  return (
    <div style={{width:340,flexShrink:0,position:"sticky",top:16,height:"calc(100vh - 32px)",
      overflowY:"auto",background:"#0a0a12",border:"1px solid #1e1e2e",borderRadius:12,padding:18}}>
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
        <div style={{display:"flex",gap:5,flexShrink:0,marginLeft:8}}>
          <button onClick={()=>onNavigate(-1)} disabled={idx<=0}
            style={{background:"none",border:"1px solid #2a2a3e",borderRadius:5,
              color:idx<=0?"#222":"#777",cursor:idx<=0?"default":"pointer",padding:"3px 8px",fontSize:12}}>←</button>
          <button onClick={()=>onNavigate(1)} disabled={idx>=allPlayers.length-1}
            style={{background:"none",border:"1px solid #2a2a3e",borderRadius:5,
              color:idx>=allPlayers.length-1?"#222":"#777",
              cursor:idx>=allPlayers.length-1?"default":"pointer",padding:"3px 8px",fontSize:12}}>→</button>
          <button onClick={onClose}
            style={{background:"none",border:"1px solid #2a2a3e",borderRadius:5,
              color:"#555",cursor:"pointer",padding:"3px 9px",fontSize:13}}>×</button>
        </div>
      </div>

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

      <div style={{display:"flex",gap:2,marginBottom:14,background:"#0f0f18",borderRadius:7,padding:3}}>
        {PT("overview","Overview")}{PT("systems","Systems")}
        {PT("disagree","Disagreement")}{PT("history","History")}
      </div>

      {panelTab==="overview"&&(
        <div style={{background:"#0f0f18",border:"1px solid #1a1a2e",borderRadius:8,padding:14}}>
          <div style={{fontSize:9,color:"#444",fontWeight:700,marginBottom:10,
            textTransform:"uppercase",letterSpacing:"0.8px"}}>
            Percentiles {per600?"(per 600 PA)":""}
          </div>
          {cats.map(cat=>{
            const raw=player.consensus?.[cat], pa=player.consensus?.PA||1;
            const val=per600?scaleTo600(raw,cat,pa):raw;
            return <PctBar key={cat} val={val} pct={player.percentiles?.[cat]} cat={cat}/>;
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
      {panelTab==="history"&&(
        <div style={{background:"#0f0f18",border:"1px solid #1a1a2e",borderRadius:8,padding:14}}>
          <div style={{fontSize:9,color:"#444",fontWeight:700,marginBottom:10,
            textTransform:"uppercase",letterSpacing:"0.8px"}}>Historical Stats (2022–2025)</div>
          {(!player.history||player.history.length===0)?(
            <div style={{color:"#333",fontSize:12,textAlign:"center",padding:20}}>No historical data</div>
          ):(
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                <thead>
                  <tr>
                    <th style={{textAlign:"left",padding:"3px 6px",color:"#444",fontSize:10}}>Season</th>
                    {Object.keys(player.history[0]).filter(k=>k!=="season").slice(0,7).map(k=>(
                      <th key={k} style={{textAlign:"right",padding:"3px 5px",color:"#444",fontSize:10}}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {player.history.map((h,i)=>(
                    <tr key={i} style={{borderTop:"1px solid #1a1a2e"}}>
                      <td style={{padding:"4px 6px",color:"#4A9EFF",fontWeight:700}}>{h.season}</td>
                      {Object.entries(h).filter(([k])=>k!=="season").slice(0,7).map(([k,v])=>(
                        <td key={k} style={{textAlign:"right",padding:"4px 5px",color:"#bbb"}}>
                          {v!=null?(typeof v==="number"?fmt(v,k):v):"—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stat cell ─────────────────────────────────────────────────────────────────
function StatCell({val, cat, pct}) {
  const lb  = LOWER_BETTER.has(cat);
  const ep  = lb && pct != null ? 1-pct : pct;
  return (
    <div style={{textAlign:"right",minWidth:36}}>
      <div style={{color:pctColor(ep),fontWeight:600,fontFamily:"'DM Mono',monospace",fontSize:11}}>
        {fmt(val,cat)}
      </div>
      <div style={{color:"#2a2a3e",fontSize:9}}>{cat}</div>
    </div>
  );
}

// ── Player row ────────────────────────────────────────────────────────────────
function PlayerRow({player,rank,isSelected,isDrafted,onSelect,onDraft,showDraftBtn,per600}) {
  const tc    = TIER_COLORS[player.tier] ?? "#6B7280";
  const flags = player.flags ?? [];
  const c     = player.consensus ?? {};
  const pa    = c.PA || 1;
  const isHitter = player.type === "hitter";
  const dis   = player.disagreement_score ?? 0;
  const disColor = dis > 0.2 ? "#F87171" : dis > 0.1 ? "#FB923C" : "#9CA3AF";

  return (
    <div onClick={()=>onSelect(player)}
      style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",
        borderRadius:7,cursor:"pointer",marginBottom:2,
        background:isSelected?"#131320":isDrafted?"#0a0a0d":"#0d0d15",
        border:isSelected?`1px solid ${tc}45`:"1px solid #131320",
        opacity:isDrafted?0.4:1,transition:"all 0.1s"}}>

      {/* Rank */}
      <span style={{width:22,fontSize:10,color:"#2a2a3e",fontFamily:"'DM Mono',monospace",flexShrink:0}}>{rank}</span>

      {/* Pos badge */}
      <div style={{width:26,height:26,borderRadius:4,background:tc+"15",border:`1px solid ${tc}35`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:8,fontWeight:700,color:tc,flexShrink:0}}>
        {(player.pos||"?").slice(0,3)}
      </div>

      {/* Name + Team */}
      <div style={{minWidth:140,maxWidth:180,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{fontSize:13,fontWeight:600,color:isDrafted?"#3a3a4a":"#ddd",
            textDecoration:isDrafted?"line-through":"none",letterSpacing:"-0.2px",
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {player.name}
          </span>
          {flags.length>0&&<span style={{fontSize:9,color:"#F87171",flexShrink:0}}>⚠</span>}
        </div>
        <div style={{fontSize:10,color:"#444"}}>{player.team}</div>
      </div>

      {/* Stats */}
      <div style={{display:"flex",gap:8,flexShrink:0,flexWrap:"nowrap"}}>
        {isHitter ? (
          <>
            <StatCell val={c.G}                                          cat="G"    pct={null}/>
            <StatCell val={per600?scaleTo600(c.HR,  "HR",  pa):c.HR}    cat="HR"   pct={player.percentiles?.HR}/>
            <StatCell val={per600?scaleTo600(c.R,   "R",   pa):c.R}     cat="R"    pct={player.percentiles?.R}/>
            <StatCell val={per600?scaleTo600(c.RBI, "RBI", pa):c.RBI}   cat="RBI"  pct={player.percentiles?.RBI}/>
            <StatCell val={per600?scaleTo600(c.SB,  "SB",  pa):c.SB}    cat="SB"   pct={player.percentiles?.SB}/>
            <StatCell val={c.AVG}                                        cat="AVG"  pct={player.percentiles?.AVG}/>
            <StatCell val={c.OBP}                                        cat="OBP"  pct={player.percentiles?.OBP}/>
            <StatCell val={c.SLG}                                        cat="SLG"  pct={player.percentiles?.SLG}/>
            <StatCell val={c.wOBA}                                       cat="wOBA" pct={player.percentiles?.wOBA}/>
            <StatCell val={c["wRC+"]}                                    cat="wRC+" pct={player.percentiles?.["wRC+"]}/>
          </>
        ) : (
          <>
            <StatCell val={c.G}    cat="G"    pct={null}/>
            <StatCell val={c.W}    cat="W"    pct={player.percentiles?.W}/>
            <StatCell val={c.K}    cat="K"    pct={player.percentiles?.K}/>
            <StatCell val={c.ERA}  cat="ERA"  pct={player.percentiles?.ERA}/>
            <StatCell val={c.WHIP} cat="WHIP" pct={player.percentiles?.WHIP}/>
            <StatCell val={c.SV}   cat="SV"   pct={player.percentiles?.SV}/>
            <StatCell val={c.HLD}  cat="HLD"  pct={player.percentiles?.HLD}/>
            <StatCell val={c.QS}   cat="QS"   pct={player.percentiles?.QS}/>
          </>
        )}
      </div>

      {/* Disagreement score */}
      <div style={{textAlign:"right",minWidth:34,flexShrink:0}}>
        <div style={{color:disColor,fontWeight:600,fontFamily:"'DM Mono',monospace",fontSize:11}}>
          {(dis*100).toFixed(0)}%
        </div>
        <div style={{color:"#2a2a3e",fontSize:9}}>DIS</div>
      </div>

      {/* VAR */}
      <div style={{textAlign:"right",minWidth:36,flexShrink:0}}>
        <div style={{color:tc,fontWeight:700,fontFamily:"'DM Mono',monospace",fontSize:11}}>
          {player.VAR>0?"+":""}{player.VAR}
        </div>
        <div style={{color:"#2a2a3e",fontSize:9}}>VAR</div>
      </div>

      {showDraftBtn&&(
        <button onClick={e=>{e.stopPropagation();onDraft(player);}}
          style={{padding:"3px 9px",borderRadius:5,fontSize:10,fontWeight:700,cursor:"pointer",
            border:`1px solid ${isDrafted?"#F8717140":"#1e1e2e"}`,
            background:isDrafted?"#F8717112":"#131320",
            color:isDrafted?"#F87171":"#444",flexShrink:0}}>
          {isDrafted?"✕":"＋"}
        </button>
      )}
    </div>
  );
}

// ── Scarcity meter ────────────────────────────────────────────────────────────
function ScarcityMeter({scarcity,drafted,players}) {
  const positions=Object.keys(scarcity||{}).filter(p=>["C","1B","2B","SS","3B","OF","SP","RP"].includes(p));
  if (!positions.length) return null;
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:6,marginBottom:18}}>
      {positions.map(pos=>{
        const s=scarcity[pos];
        const gone=[...drafted].filter(id=>{
          const p=players.find(x=>x.id===id);
          return p&&(p.positions||[p.pos]).includes(pos);
        }).length;
        const remaining=Math.max((s?.total??0)-gone,0);
        const pct=s?.total>0?remaining/s.total:1;
        const color=pct>.6?"#00C896":pct>.3?"#FB923C":"#F87171";
        return (
          <div key={pos} style={{background:"#0d0d15",border:"1px solid #1a1a2e",borderRadius:7,padding:"8px 10px"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <span style={{fontSize:11,fontWeight:700,color:"#bbb"}}>{pos}</span>
              <span style={{fontSize:10,color:"#333",fontFamily:"'DM Mono',monospace"}}>{remaining}</span>
            </div>
            <div style={{height:3,background:"#1a1a2e",borderRadius:2}}>
              <div style={{height:"100%",width:`${pct*100}%`,background:color,borderRadius:2,transition:"width 0.4s"}}/>
            </div>
            <div style={{fontSize:9,color:"#444",marginTop:4}}>drop: {s?.drop_off?.toFixed(1)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Draft roster ──────────────────────────────────────────────────────────────
function DraftRoster({myPicks,draftLog,currentPick}) {
  return (
    <div style={{width:230,flexShrink:0,background:"#0a0a12",border:"1px solid #1a1a2e",
      borderRadius:12,padding:14,position:"sticky",top:16,
      maxHeight:"calc(100vh - 32px)",overflowY:"auto"}}>
      <div style={{fontSize:10,fontWeight:700,color:"#444",textTransform:"uppercase",
        letterSpacing:"0.5px",marginBottom:12}}>My Roster · Pick {MY_PICK}</div>
      {myPicks.map(({round,overall})=>{
        const entry=draftLog.find(d=>d.pick===overall);
        const isCurrent=overall===currentPick;
        const tc=entry?(TIER_COLORS[entry.player.tier]??"#6B7280"):null;
        return (
          <div key={overall} style={{display:"flex",gap:8,padding:"5px 7px",borderRadius:5,marginBottom:2,
            background:isCurrent?"#131325":"transparent",
            border:isCurrent?"1px solid #4A9EFF25":"1px solid transparent"}}>
            <div style={{width:28,flexShrink:0}}>
              <div style={{fontSize:9,color:"#4A9EFF",fontWeight:700}}>R{round}</div>
              <div style={{fontSize:8,color:"#1e1e2e",fontFamily:"'DM Mono',monospace"}}>#{overall}</div>
            </div>
            {entry?(
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:600,color:tc||"#ddd",
                  whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{entry.player.name}</div>
                <div style={{fontSize:9,color:"#444"}}>{entry.player.pos} · {entry.player.team}</div>
              </div>
            ):(
              <div style={{flex:1,fontSize:10,color:isCurrent?"#4A9EFF":"#1a1a2e",fontStyle:"italic"}}>
                {isCurrent?"← Your pick":"—"}
              </div>
            )}
          </div>
        );
      })}
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

export default function App() {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [tab,setTab]=useState("players");
  const [search,setSearch]=useState("");
  const [posFilter,setPosFilter]=useState("All");
  const [typeFilter,setTypeFilter]=useState("All");
  const [selected,setSelected]=useState(null);
  const [drafted,setDrafted]=useState(new Set());
  const [draftLog,setDraftLog]=useState([]);
  const [currentPick,setCurrentPick]=useState(1);
  const [showDrafted,setShowDrafted]=useState(true);
  const [per600,setPer600]=useState(false);

  useEffect(()=>{
    fetch("/fantasy-baseball-predictor/players.json")
      .then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();})
      .then(d=>{setData(d);setLoading(false);})
      .catch(e=>{setError(e.message);setLoading(false);});
  },[]);

  const players=data?.players??[];
  const scarcity=data?.scarcity??{};
  const myPicks=useMemo(()=>getMyPicks(LEAGUE_SIZE,MY_PICK,ROUNDS),[]);

  const filtered=useMemo(()=>players
    .filter(p=>typeFilter==="All"||(typeFilter==="Hitters"&&p.type==="hitter")||(typeFilter==="Pitchers"&&p.type==="pitcher"))
    .filter(p=>posFilter==="All"||(p.positions||[p.pos]).some(pos=>pos===posFilter))
    .filter(p=>p.name?.toLowerCase().includes(search.toLowerCase())||p.team?.toLowerCase().includes(search.toLowerCase()))
    .filter(p=>showDrafted||!drafted.has(p.id))
  ,[players,typeFilter,posFilter,search,showDrafted,drafted]);

  const byTeam=useMemo(()=>{
    const map={};
    filtered.forEach(p=>{const t=p.team||"—";if(!map[t])map[t]=[];map[t].push(p);});
    return Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0]));
  },[filtered]);

  const byPos=useMemo(()=>{
    const map={};
    filtered.forEach(p=>{
      (p.positions||[p.pos||"?"]).forEach(pos=>{
        if(!map[pos])map[pos]=[];
        if(!map[pos].find(x=>x.id===p.id))map[pos].push(p);
      });
    });
    return Object.entries(map).sort((a,b)=>b[1].length-a[1].length);
  },[filtered]);

  const toggleDraft=player=>{
    const isDrafted=drafted.has(player.id);
    setDrafted(prev=>{const n=new Set(prev);isDrafted?n.delete(player.id):n.add(player.id);return n;});
    if(!isDrafted){setDraftLog(prev=>[...prev,{pick:currentPick,player}]);setCurrentPick(p=>p+1);}
    else setDraftLog(prev=>prev.filter(d=>d.player.id!==player.id));
  };

  const handleSelect=p=>setSelected(s=>s?.id===p.id?null:p);
  const handleNavigate=dir=>{
    if(!selected)return;
    const idx=filtered.findIndex(p=>p.id===selected.id);
    const next=filtered[idx+dir];
    if(next)setSelected(next);
  };

  if(loading)return <LoadingScreen/>;
  if(error)return <ErrorScreen msg={error}/>;

  const TAB=(t,label)=>(
    <button key={t} onClick={()=>setTab(t)}
      style={{padding:"7px 16px",borderRadius:"5px 5px 0 0",border:"none",cursor:"pointer",
        fontSize:11,fontWeight:700,letterSpacing:"0.3px",
        background:tab===t?"#0d0d15":"transparent",
        color:tab===t?"#ddd":"#444",
        borderBottom:tab===t?"2px solid #4A9EFF":"2px solid transparent",
        transition:"all 0.12s"}}>
      {label}
    </button>
  );

  const Filters=()=>(
    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
      <input placeholder="Search player or team…" value={search} onChange={e=>setSearch(e.target.value)}
        style={{padding:"7px 12px",background:"#0d0d15",border:"1px solid #1e1e2e",borderRadius:7,
          color:"#ccc",fontSize:12,flex:1,minWidth:150,outline:"none",fontFamily:"inherit"}}/>
      {["All","Hitters","Pitchers"].map(t=>(
        <button key={t} onClick={()=>{setTypeFilter(t);setPosFilter("All");}}
          style={{padding:"5px 11px",borderRadius:6,border:"1px solid",fontSize:11,fontWeight:600,cursor:"pointer",
            borderColor:typeFilter===t?"#A78BFA":"#1e1e2e",
            background:typeFilter===t?"#A78BFA15":"transparent",
            color:typeFilter===t?"#A78BFA":"#444"}}>
          {t}
        </button>
      ))}
      {(typeFilter==="Pitchers"?POSITIONS_PIT:typeFilter==="Hitters"?POSITIONS_HIT:["All"]).map(pos=>(
        <button key={pos} onClick={()=>setPosFilter(pos)}
          style={{padding:"5px 10px",borderRadius:6,border:"1px solid",fontSize:11,fontWeight:600,cursor:"pointer",
            borderColor:posFilter===pos?"#4A9EFF":"#1e1e2e",
            background:posFilter===pos?"#4A9EFF15":"transparent",
            color:posFilter===pos?"#4A9EFF":"#444"}}>
          {pos}
        </button>
      ))}
    </div>
  );

  const PlayerList=({list,showDraft=false})=>list.length===0
    ?<div style={{color:"#2a2a3e",fontSize:13,textAlign:"center",padding:40}}>No players found.</div>
    :list.map((p,i)=>(
        <PlayerRow key={p.id} player={p} rank={i+1}
          isSelected={selected?.id===p.id} isDrafted={drafted.has(p.id)}
          onSelect={handleSelect} onDraft={toggleDraft}
          showDraftBtn={showDraft} per600={per600}/>
      ));

  const WithPanel=({children})=>(
    <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
      <div style={{flex:1,minWidth:0}}>{children}</div>
      {selected&&<PlayerPanel player={selected} allPlayers={filtered} per600={per600}
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
                {players.length} players · {drafted.size} drafted
                {data?.generated&&` · Updated ${new Date(data.generated).toLocaleDateString()}`}
              </span>
            </div>
            <button onClick={()=>setPer600(v=>!v)}
              style={{padding:"4px 11px",borderRadius:6,
                border:`1px solid ${per600?"#4A9EFF":"#1e1e2e"}`,
                background:per600?"#4A9EFF18":"transparent",
                color:per600?"#4A9EFF":"#444",cursor:"pointer",
                fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>
              {per600?"✓ per 600 PA":"per 600 PA"}
            </button>
          </div>
          <div style={{display:"flex",gap:1}}>
            {TAB("players","📊 All Players")}
            {TAB("teams","🏟 By Team")}
            {TAB("positions","📍 By Position")}
            {TAB("draft","🎯 Draft Board")}
            {TAB("historical","📅 Historical")}
          </div>
        </div>
      </div>
      <div style={{maxWidth:1600,margin:"0 auto",padding:"16px 24px"}}>
        {tab==="players"&&<><Filters/><WithPanel><PlayerList list={filtered}/></WithPanel></>}
        {tab==="teams"&&(
          <><Filters/><WithPanel>
            {byTeam.map(([team,tp])=>(
              <div key={team} style={{marginBottom:18}}>
                <div style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",
                  letterSpacing:"0.8px",marginBottom:7,paddingBottom:5,borderBottom:"1px solid #131320"}}>
                  {team} <span style={{color:"#2a2a3e",fontWeight:400}}>({tp.length})</span>
                </div>
                <PlayerList list={tp}/>
              </div>
            ))}
          </WithPanel></>
        )}
        {tab==="positions"&&(
          <><Filters/><WithPanel>
            {byPos.map(([pos,pp])=>(
              <div key={pos} style={{marginBottom:18}}>
                <div style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",
                  letterSpacing:"0.8px",marginBottom:7,paddingBottom:5,borderBottom:"1px solid #131320"}}>
                  {pos} <span style={{color:"#2a2a3e",fontWeight:400}}>({pp.length})</span>
                </div>
                <PlayerList list={pp}/>
              </div>
            ))}
          </WithPanel></>
        )}
        {tab==="draft"&&(
          <>
            <ScarcityMeter scarcity={scarcity} drafted={drafted} players={players}/>
            <Filters/>
            <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
              <button onClick={()=>setShowDrafted(v=>!v)}
                style={{padding:"4px 11px",borderRadius:6,border:"1px solid #1e1e2e",
                  background:showDrafted?"#FB923C15":"transparent",
                  color:showDrafted?"#FB923C":"#444",cursor:"pointer",fontSize:10,fontWeight:600}}>
                {showDrafted?"Showing drafted":"Hiding drafted"}
              </button>
              {drafted.size>0&&(
                <button onClick={()=>{setDrafted(new Set());setDraftLog([]);setCurrentPick(1);}}
                  style={{padding:"4px 11px",borderRadius:6,border:"1px solid #F8717130",
                    color:"#F87171",background:"transparent",cursor:"pointer",fontSize:10,fontWeight:600}}>
                  Reset
                </button>
              )}
            </div>
            <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
              <div style={{flex:1,minWidth:0}}><PlayerList list={filtered} showDraft={true}/></div>
              <DraftRoster myPicks={myPicks} draftLog={draftLog} currentPick={currentPick}/>
            </div>
          </>
        )}
        {tab==="historical"&&(
          <><Filters/><WithPanel><PlayerList list={filtered}/></WithPanel></>
        )}
      </div>
    </div>
  );
}
