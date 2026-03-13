import { useState, useEffect, useMemo } from "react";

const TIER_COLORS = { 1:"#1D9E75", 2:"#378ADD", 3:"#7F77DD", 4:"#888780", 5:"#E24B4A" };
const POSITIONS = ["All","C","1B","2B","SS","3B","OF","DH"];
const SKILL_KEYS = ['xwOBA','HardHit%','Barrel%','K%','BB%','SwStr%','BABIP','GB%','FB%','Pull%'];
const HIGHER_BETTER = new Set(['xwOBA','HardHit%','Barrel%','BB%','BABIP','FB%','Pull%']);
const CAT_KEYS = ['HR','RBI','SB','H','TB','OBP'];

// ── Radar chart ──────────────────────────────────────────────────────────────
function RadarChart({ player, allPlayers }) {
  const size = 220, cx = 110, cy = 115, r = 80;
  const n = CAT_KEYS.length;
  const angles = CAT_KEYS.map((_, i) => (Math.PI * 2 * i) / n - Math.PI / 2);

  const pctiles = useMemo(() => {
    const result = {};
    CAT_KEYS.forEach(cat => {
      const vals = allPlayers.map(p => p.projections[cat] || 0).sort((a,b)=>a-b);
      const v = player.projections[cat] || 0;
      const rank = vals.filter(x => x <= v).length;
      result[cat] = rank / vals.length;
    });
    return result;
  }, [player, allPlayers]);

  const pts = angles.map((a, i) => {
    const pct = pctiles[CAT_KEYS[i]];
    return [cx + r * pct * Math.cos(a), cy + r * pct * Math.sin(a)];
  });

  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg width={size} height={size} style={{display:"block",margin:"0 auto"}}>
      {/* Grid */}
      {gridLevels.map(lvl => {
        const gPts = angles.map(a => [cx + r*lvl*Math.cos(a), cy + r*lvl*Math.sin(a)]);
        return <polygon key={lvl} points={gPts.map(p=>p.join(",")).join(" ")}
          fill="none" stroke="#e8e8e8" strokeWidth={1}/>;
      })}
      {/* Axes */}
      {angles.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={cx+r*Math.cos(a)} y2={cy+r*Math.sin(a)}
          stroke="#e8e8e8" strokeWidth={1}/>
      ))}
      {/* Data polygon */}
      <polygon points={pts.map(p=>p.join(",")).join(" ")}
        fill={TIER_COLORS[player.tier]+"33"} stroke={TIER_COLORS[player.tier]} strokeWidth={2}/>
      {/* Dots */}
      {pts.map((p,i) => <circle key={i} cx={p[0]} cy={p[1]} r={3} fill={TIER_COLORS[player.tier]}/>)}
      {/* Labels */}
      {angles.map((a, i) => {
        const lx = cx + (r+18)*Math.cos(a);
        const ly = cy + (r+18)*Math.sin(a);
        const val = player.projections[CAT_KEYS[i]];
        return (
          <g key={i}>
            <text x={lx} y={ly-5} textAnchor="middle" fontSize={10} fill="#888">{CAT_KEYS[i]}</text>
            <text x={lx} y={ly+7} textAnchor="middle" fontSize={10} fontWeight="600" fill="#333">
              {val != null ? (CAT_KEYS[i]==='OBP' ? val.toFixed(3) : Math.round(val)) : "—"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ values, higherBetter }) {
  const valid = values.filter(v => v != null);
  if (valid.length < 2) return null;
  const min = Math.min(...valid), max = Math.max(...valid);
  const range = max - min || 0.001;
  const w = 48, h = 18;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((( v ?? min) - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  const last = valid[valid.length - 1], prev = valid[valid.length - 2];
  const trending = higherBetter ? last >= prev : last <= prev;
  const color = trending ? "#1D9E75" : "#E24B4A";
  return (
    <svg width={w} height={h} style={{display:"inline-block",verticalAlign:"middle"}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}/>
    </svg>
  );
}

// ── Percentile color ─────────────────────────────────────────────────────────
function pctileColor(pct) {
  if (pct >= 0.85) return "#1D9E75";
  if (pct >= 0.65) return "#6BBF8E";
  if (pct >= 0.40) return "#999";
  if (pct >= 0.20) return "#E8956B";
  return "#E24B4A";
}

// ── Scarcity meter ───────────────────────────────────────────────────────────
function ScarcityMeter({ players, drafted }) {
  const SLOTS = { C:1, SS:1, "2B":1, "3B":1, "1B":1, OF:3, DH:1 };
  const leagueSize = 12;
  return (
    <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:10,padding:14,marginBottom:16}}>
      <div style={{fontSize:12,fontWeight:500,color:"#888",marginBottom:10}}>Positional scarcity</div>
      {Object.entries(SLOTS).map(([pos, slots]) => {
        const total = players.filter(p => p.position === pos && p.tier <= 3).length;
        const draftedCount = [...drafted].filter(id => {
          const p = players.find(x => x.id === id);
          return p && p.position === pos;
        }).length;
        const remaining = total - draftedCount;
        const pct = remaining / Math.max(total, 1);
        const color = pct > 0.6 ? "#1D9E75" : pct > 0.3 ? "#F5A623" : "#E24B4A";
        return (
          <div key={pos} style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
              <span style={{fontWeight:500}}>{pos}</span>
              <span style={{color:"#888"}}>{remaining} of {total} left</span>
            </div>
            <div style={{height:6,background:"#f0f0f0",borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${pct*100}%`,background:color,borderRadius:3,transition:"width 0.3s"}}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main app ─────────────────────────────────────────────────────────────────
export default function App() {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [drafted, setDrafted] = useState(new Set());
  const [showDrafted, setShowDrafted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/fantasy-baseball-predictor/players.json")
      .then(r => r.json())
      .then(d => { setPlayers(d.players); setLoading(false); });
  }, []);

  // Compute percentiles for color coding
  const percentiles = useMemo(() => {
    const result = {};
    SKILL_KEYS.forEach(key => {
      const vals = players.map(p => p.skills[key]).filter(v => v != null).sort((a,b)=>a-b);
      result[key] = (v) => {
        if (v == null) return null;
        return vals.filter(x => x <= v).length / vals.length;
      };
    });
    return result;
  }, [players]);

  const toggleDraft = (e, player) => {
    e.stopPropagation();
    setDrafted(prev => {
      const next = new Set(prev);
      next.has(player.id) ? next.delete(player.id) : next.add(player.id);
      return next;
    });
  };

  const filtered = players
    .filter(p => posFilter === "All" || p.position === posFilter)
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .filter(p => showDrafted || !drafted.has(p.id));

  const tierGroups = [1,2,3,4].map(t => ({
    tier: t,
    players: filtered.filter(p => p.tier === t)
  })).filter(g => g.players.length > 0);

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"#888",fontFamily:"system-ui"}}>
      Loading projections...
    </div>
  );

  return (
    <div style={{fontFamily:"system-ui",maxWidth:1300,margin:"0 auto",padding:"24px 16px"}}>
      <div style={{display:"flex",alignItems:"baseline",gap:16,marginBottom:4}}>
        <h1 style={{fontSize:22,fontWeight:500,margin:0}}>Fantasy baseball draft board</h1>
        <span style={{fontSize:13,color:"#888"}}>{players.length} players · 7-cat VORP · {drafted.size} drafted</span>
      </div>

      <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <input placeholder="Search player..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{padding:"8px 12px",border:"0.5px solid #ccc",borderRadius:8,fontSize:14,flex:1,minWidth:180}}/>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {POSITIONS.map(pos => (
            <button key={pos} onClick={() => setPosFilter(pos)}
              style={{padding:"6px 12px",borderRadius:6,border:"0.5px solid #ccc",
                background:posFilter===pos?"#1D9E75":"transparent",
                color:posFilter===pos?"#fff":"#444",cursor:"pointer",fontSize:13}}>
              {pos}
            </button>
          ))}
        </div>
        <button onClick={() => setShowDrafted(v => !v)}
          style={{padding:"6px 14px",borderRadius:6,border:"0.5px solid #ccc",
            background:showDrafted?"#378ADD":"transparent",
            color:showDrafted?"#fff":"#444",cursor:"pointer",fontSize:13}}>
          {showDrafted ? "Hiding drafted" : "Show drafted"}
        </button>
        {drafted.size > 0 && (
          <button onClick={() => setDrafted(new Set())}
            style={{padding:"6px 14px",borderRadius:6,border:"0.5px solid #E24B4A",
              color:"#E24B4A",background:"transparent",cursor:"pointer",fontSize:13}}>
            Reset draft
          </button>
        )}
      </div>

      <div style={{display:"flex",gap:20,alignItems:"flex-start"}}>
        {/* Left sidebar — scarcity */}
        <div style={{width:200,flexShrink:0,position:"sticky",top:20}}>
          <ScarcityMeter players={players} drafted={drafted}/>
        </div>

        {/* Main board */}
        <div style={{flex:1,minWidth:0}}>
          {tierGroups.map(({tier, players: tp}) => (
            <div key={tier} style={{marginBottom:24}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{background:TIER_COLORS[tier],color:"#fff",borderRadius:4,padding:"2px 8px",fontSize:12,fontWeight:500}}>
                  Tier {tier}
                </span>
                <span style={{fontSize:12,color:"#888"}}>{tp.length} players</span>
              </div>
              {tp.map(p => {
                const isDrafted = drafted.has(p.id);
                return (
                  <div key={p.id} onClick={() => setSelected(selected?.id===p.id ? null : p)}
                    style={{display:"flex",alignItems:"center",padding:"9px 14px",marginBottom:4,
                      borderRadius:8,cursor:"pointer",opacity:isDrafted?0.4:1,
                      border:selected?.id===p.id?`1.5px solid ${TIER_COLORS[tier]}`:"0.5px solid #e0e0e0",
                      background:isDrafted?"#f9f9f9":selected?.id===p.id?"#f8fffe":"#fff"}}>
                    <div style={{width:28,height:28,borderRadius:14,background:TIER_COLORS[tier],color:"#fff",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:11,fontWeight:500,marginRight:12,flexShrink:0}}>
                      {p.position}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <span style={{fontWeight:500,fontSize:14,textDecoration:isDrafted?"line-through":"none"}}>{p.name}</span>
                      <span style={{fontSize:12,color:"#888",marginLeft:8}}>{p.team} · Age {p.age}</span>
                    </div>
                    <div style={{display:"flex",gap:14,fontSize:13,flexShrink:0,alignItems:"center"}}>
                      <span><b>{p.projections.xwOBA}</b> <span style={{color:"#aaa",fontSize:11}}>xwOBA</span></span>
                      <span><b>{p.projections.HR}</b> <span style={{color:"#aaa",fontSize:11}}>HR</span></span>
                      <span><b>{p.projections.RBI}</b> <span style={{color:"#aaa",fontSize:11}}>RBI</span></span>
                      <span><b>{p.projections.SB}</b> <span style={{color:"#aaa",fontSize:11}}>SB</span></span>
                      <span><b>{p.projections.AVG}</b> <span style={{color:"#aaa",fontSize:11}}>AVG</span></span>
                      <span style={{color:TIER_COLORS[tier],fontWeight:500,minWidth:60,textAlign:"right"}}>
                        {p.VORP} <span style={{color:"#aaa",fontSize:11,fontWeight:400}}>VORP</span>
                      </span>
                      <button onClick={e => toggleDraft(e, p)}
                        style={{padding:"3px 10px",borderRadius:5,border:`0.5px solid ${isDrafted?"#E24B4A":"#ccc"}`,
                          background:isDrafted?"#fff5f5":"transparent",
                          color:isDrafted?"#E24B4A":"#888",cursor:"pointer",fontSize:12,flexShrink:0}}>
                        {isDrafted ? "Undraft" : "Draft"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Right sidebar — player card */}
        {selected && (
          <div style={{width:290,flexShrink:0,position:"sticky",top:20}}>
            <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:16,
              maxHeight:"92vh",overflowY:"auto"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <div style={{width:36,height:36,borderRadius:18,background:TIER_COLORS[selected.tier],
                  color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:500}}>
                  {selected.position}
                </div>
                <div>
                  <div style={{fontWeight:500,fontSize:15}}>{selected.name}</div>
                  <div style={{fontSize:12,color:"#888"}}>{selected.team} · Age {selected.age}</div>
                </div>
                <button onClick={() => setSelected(null)}
                  style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"#aaa",fontSize:20}}>×</button>
              </div>

              {/* VORP */}
              <div style={{padding:"10px",background:"#f8fffe",borderRadius:8,textAlign:"center",marginBottom:14}}>
                <div style={{fontSize:11,color:"#888"}}>Value over replacement</div>
                <div style={{fontSize:28,fontWeight:600,color:TIER_COLORS[selected.tier]}}>{selected.VORP}</div>
              </div>

              {/* Radar */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:12,color:"#888",fontWeight:500,marginBottom:6}}>Category profile</div>
                <RadarChart player={selected} allPlayers={players}/>
              </div>

              {/* Projections */}
              <div style={{fontSize:12,color:"#888",fontWeight:500,marginBottom:6}}>2026 Projections</div>
              {Object.entries(selected.projections).map(([k,v]) => v != null && (
                <div key={k} style={{display:"flex",justifyContent:"space-between",
                  padding:"4px 0",borderBottom:"0.5px solid #f0f0f0",fontSize:13}}>
                  <span style={{color:"#666"}}>{k}</span>
                  <span style={{fontWeight:500}}>{v}</span>
                </div>
              ))}

              {/* Skills with sparklines + color coding */}
              {selected.history && selected.history.length > 0 && (
                <>
                  <div style={{fontSize:12,color:"#888",fontWeight:500,margin:"14px 0 6px"}}>
                    Skills by season
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"80px 1fr repeat(3,44px)",
                    gap:2,fontSize:10,color:"#aaa",fontWeight:500,marginBottom:4,
                    paddingBottom:4,borderBottom:"0.5px solid #eee"}}>
                    <span>Stat</span>
                    <span style={{textAlign:"center"}}>Trend</span>
                    {selected.history.map(h => (
                      <span key={h.season} style={{textAlign:"right"}}>{h.season}</span>
                    ))}
                  </div>
                  {SKILL_KEYS.map(key => {
                    const vals = selected.history.map(h => h[key]);
                    const hasData = vals.some(v => v != null);
                    if (!hasData) return null;
                    const latest = vals[vals.length - 1];
                    const pct = percentiles[key]?.(latest);
                    const hb = HIGHER_BETTER.has(key);
                    return (
                      <div key={key} style={{display:"grid",gridTemplateColumns:"80px 1fr repeat(3,44px)",
                        gap:2,padding:"4px 0",borderBottom:"0.5px solid #f5f5f5",
                        fontSize:12,alignItems:"center"}}>
                        <span style={{color:"#666",fontSize:11}}>{key}</span>
                        <span><Sparkline values={vals} higherBetter={hb}/></span>
                        {vals.map((v, i) => (
                          <span key={i} style={{textAlign:"right",
                            fontWeight:i===vals.length-1?600:400,
                            color:i===vals.length-1 && pct!=null ? pctileColor(hb ? pct : 1-pct) : "#999",
                            fontSize:11}}>
                            {v != null ? v.toFixed(3) : "—"}
                          </span>
                        ))}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
