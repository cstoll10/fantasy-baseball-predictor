import { useState, useEffect } from "react";

const TIER_COLORS = {
  1: "#1D9E75", 2: "#378ADD", 3: "#7F77DD", 4: "#888780", 5: "#E24B4A"
};

const POSITIONS = ["All", "C", "1B", "2B", "SS", "3B", "OF", "DH"];

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
    <div style={{fontFamily:"system-ui",maxWidth:1100,margin:"0 auto",padding:"24px 16px"}}>
      <h1 style={{fontSize:22,fontWeight:500,margin:"0 0 4px"}}>Fantasy baseball draft board</h1>
      <p style={{fontSize:13,color:"#888",margin:"0 0 20px"}}>
        {players.length} players · Weighted 3-year projections · Ranked by xwOBA + VORP
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

      <div style={{display:"flex",gap:20}}>
        <div style={{flex:1}}>
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
                  <div style={{flex:1}}>
                    <span style={{fontWeight:500,fontSize:14}}>{p.name}</span>
                    <span style={{fontSize:12,color:"#888",marginLeft:8}}>{p.team} · Age {p.age}</span>
                  </div>
                  <div style={{display:"flex",gap:16,fontSize:13}}>
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
          <div style={{width:260,flexShrink:0}}>
            <div style={{background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:12,padding:16}}>
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
              </div>
              <div style={{fontSize:12,color:"#888",fontWeight:500,marginBottom:6}}>Projections</div>
              {Object.entries(selected.projections).map(([k,v]) => v && (
                <div key={k} style={{display:"flex",justifyContent:"space-between",
                  padding:"5px 0",borderBottom:"0.5px solid #f0f0f0",fontSize:13}}>
                  <span style={{color:"#666"}}>{k}</span>
                  <span style={{fontWeight:500}}>{v}</span>
                </div>
              ))}
              <div style={{fontSize:12,color:"#888",fontWeight:500,margin:"14px 0 6px"}}>Skills</div>
              {Object.entries(selected.skills).map(([k,v]) => v && (
                <div key={k} style={{display:"flex",justifyContent:"space-between",
                  padding:"5px 0",borderBottom:"0.5px solid #f0f0f0",fontSize:13}}>
                  <span style={{color:"#666"}}>{k}</span>
                  <span style={{fontWeight:500}}>{v}</span>
                </div>
              ))}
              <div style={{marginTop:14,padding:"10px",background:"#f8fffe",
                borderRadius:8,textAlign:"center"}}>
                <div style={{fontSize:11,color:"#888"}}>Value over replacement</div>
                <div style={{fontSize:24,fontWeight:500,color:TIER_COLORS[selected.tier]}}>{selected.VORP}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
