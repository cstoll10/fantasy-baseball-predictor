import { useState, useEffect } from "react";

const TIER_COLORS = {
  1: "#1D9E75", 2: "#378ADD", 3: "#7F77DD", 4: "#888780", 5: "#E24B4A"
};

const POSITIONS = ["All", "C", "1B", "2B", "SS", "3B", "OF", "DH"];

const SKILL_KEYS = ['xwOBA','HardHit%','Barrel%','K%','BB%','SwStr%','BABIP','GB%','FB%','Pull%'];

// Higher is better for these, lower is better for the rest
const HIGHER_BETTER = new Set(['xwOBA','HardHit%','Barrel%','BB%','BABIP','FB%','Pull%']);
const LOWER_BETTER  = new Set(['K%','SwStr%','GB%']);

function TrendArrow({ current, prev, statKey }) {
  if (prev == null || current == null) return null;
  const diff = current - prev;
  const threshold = 0.005;
  if (Math.abs(diff) < threshold) return <span style={{color:"#aaa",fontSize:11}}> →</span>;
  const better = HIGHER_BETTER.has(statKey) ? diff > 0 : diff < 0;
  return (
    <span style={{color: better ? "#1D9E75" : "#E24B4A", fontSize:11}}>
      {diff > 0 ? " ↑" : " ↓"}{Math.abs(diff).toFixed(3)}
    </span>
  );
}

export default function App() {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/fantasy-baseball-predictor/players.json")
      .then(r => r.json())
      .then(d => { setPlayers(d.players); setLoading(false); });
  }, []);

  const filtered = players
    .filter(p => posFilter === "All" || p.position === posFilter)
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

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
    <div style={{fontFamily:"system-ui",maxWidth:1200,margin:"0 auto",padding:"24px 16px"}}>
      <h1 style={{fontSize:22,fontWeight:500,margin:"0 0 4px"}}>Fantasy baseball draft board</h1>
      <p style={{fontSize:13,color:"#888",margin:"0 0 20px"}}>
        {players.length} players · Weighted 3-year projections · 7-category VORP
      </p>

      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <input
          placeholder="Search player..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{padding:"8px 12px",border:"0.5px solid #ccc",borderRadius:8,fontSize:14,flex:1,minWidth:200}}
        />
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {POSITIONS.map(pos => (
            <button key={pos} onClick={() => setPosFilter(pos)}
              style={{padding:"6px 12px",borderRadius:6,border:"0.5px solid #ccc",
                background: posFilter===pos ? "#1D9E75" : "transparent",
                color: posFilter===pos ? "#fff" : "#444",
                cursor:"pointer",fontSize:13}}>
              {pos}
            </button>
          ))}
        </div>
      </div>

      <div style={{display:"flex",gap:20,alignItems:"flex-start"}}>
        <div style={{flex:1,minWidth:0}}>
          {tierGroups.map(({tier, players: tp}) => (
            <div key={tier} style={{marginBottom:24}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{background:TIER_COLORS[tier],color:"#fff",
                  borderRadius:4,padding:"2px 8px",fontSize:12,fontWeight:500}}>
                  Tier {tier}
                </span>
                <span style={{fontSize:12,color:"#888"}}>{tp.length} players</span>
              </div>
              {tp.map(p => (
                <div key={p.id} onClick={() => setSelected(selected?.id===p.id ? null : p)}
                  style={{display:"flex",alignItems:"center",padding:"10px 14px",
                    marginBottom:4,borderRadius:8,cursor:"pointer",
                    border: selected?.id===p.id ? `1.5px solid ${TIER_COLORS[tier]}` : "0.5px solid #e0e0e0",
                    background: selected?.id===p.id ? "#f8fffe" : "#fff"}}>
                  <div style={{width:28,height:28,borderRadius:14,
                    background:TIER_COLORS[tier],color:"#fff",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:11,fontWeight:500,marginRight:12,flexShrink:0}}>
                    {p.position}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <span style={{fontWeight:500,fontSize:14}}>{p.name}</span>
                    <span style={{fontSize:12,color:"#888",marginLeft:8}}>{p.team} · Age {p.age}</span>
                  </div>
                  <div style={{display:"flex",gap:16,fontSize:13,flexShrink:0}}>
                    <span><b>{p.projections.xwOBA}</b> <span style={{color:"#aaa",fontSize:11}}>xwOBA</span></span>
                    <span><b>{p.projections.HR}</b> <span style={{color:"#aaa",fontSize:11}}>HR</span></span>
                    <span><b>{p.projections.RBI}</b> <span style={{color:"#aaa",fontSize:11}}>RBI</span></span>
                    <span><b>{p.projections.SB}</b> <span style={{color:"#aaa",fontSize:11}}>SB</span></span>
                    <span><b>{p.projections.AVG}</b> <span style={{color:"#aaa",fontSize:11}}>AVG</span></span>
                    <span style={{color:TIER_COLORS[tier],fontWeight:500}}>{p.VORP} <span style={{color:"#aaa",fontSize:11,fontWeight:400}}>VORP</span></span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {selected && (
          <div style={{width:280,flexShrink:0,position:"sticky",top:20}}>
            <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:16,maxHeight:"90vh",overflowY:"auto"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                <div style={{width:36,height:36,borderRadius:18,
                  background:TIER_COLORS[selected.tier],color:"#fff",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:12,fontWeight:500}}>
                  {selected.position}
                </div>
                <div>
                  <div style={{fontWeight:500,fontSize:15}}>{selected.name}</div>
                  <div style={{fontSize:12,color:"#888"}}>{selected.team} · Age {selected.age}</div>
                </div>
                <button onClick={() => setSelected(null)}
                  style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"#aaa",fontSize:18}}>×</button>
              </div>

              {/* VORP badge */}
              <div style={{marginBottom:14,padding:"10px",background:"#f8fffe",
                borderRadius:8,textAlign:"center"}}>
                <div style={{fontSize:11,color:"#888"}}>Value over replacement</div>
                <div style={{fontSize:28,fontWeight:600,color:TIER_COLORS[selected.tier]}}>{selected.VORP}</div>
              </div>

              {/* Projections */}
              <div style={{fontSize:12,color:"#888",fontWeight:500,marginBottom:6}}>2025 Projections</div>
              {Object.entries(selected.projections).map(([k,v]) => v != null && (
                <div key={k} style={{display:"flex",justifyContent:"space-between",
                  padding:"5px 0",borderBottom:"0.5px solid #f0f0f0",fontSize:13}}>
                  <span style={{color:"#666"}}>{k}</span>
                  <span style={{fontWeight:500}}>{v}</span>
                </div>
              ))}

              {/* Season-by-season skills */}
              {selected.history && selected.history.length > 0 && (
                <>
                  <div style={{fontSize:12,color:"#888",fontWeight:500,margin:"14px 0 6px"}}>
                    Skills by season
                  </div>
                  {/* Header row */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr repeat(3,52px)",gap:4,
                    fontSize:11,color:"#aaa",fontWeight:500,marginBottom:4,paddingBottom:4,
                    borderBottom:"0.5px solid #e0e0e0"}}>
                    <span></span>
                    {selected.history.map(h => (
                      <span key={h.season} style={{textAlign:"right"}}>{h.season}</span>
                    ))}
                  </div>
                  {SKILL_KEYS.map(key => {
                    const vals = selected.history.map(h => h[key]);
                    const hasData = vals.some(v => v != null);
                    if (!hasData) return null;
                    const latest = vals[vals.length - 1];
                    const prev   = vals[vals.length - 2];
                    return (
                      <div key={key} style={{display:"grid",gridTemplateColumns:"1fr repeat(3,52px)",
                        gap:4,padding:"5px 0",borderBottom:"0.5px solid #f0f0f0",fontSize:12,
                        alignItems:"center"}}>
                        <span style={{color:"#666"}}>
                          {key}
                          <TrendArrow current={latest} prev={prev} statKey={key} />
                        </span>
                        {vals.map((v, i) => (
                          <span key={i} style={{textAlign:"right",fontWeight: i===vals.length-1 ? 600 : 400,
                            color: i===vals.length-1 ? "#222" : "#999"}}>
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
