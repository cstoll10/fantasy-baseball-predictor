"""
Fantasy Baseball 2026 - Data Processing Pipeline
"""

import json
import re
import sys
import warnings
from pathlib import Path

import pandas as pd
import numpy as np

warnings.filterwarnings("ignore")

LEAGUE_SIZE  = 12
ROSTER_SLOTS = {"C":1,"1B":1,"2B":1,"SS":1,"3B":1,"OF":3,"UTIL":1,"SP":5,"RP":3,"P":2,"BN":7}
HIT_CATS     = ["R","HR","RBI","SB","OBP","H","TB"]
PIT_CATS     = ["W","K","ERA","WHIP","SV","HLD","QS"]
LOWER_BETTER = {"ERA","WHIP"}
MIN_PA       = 150
MIN_IP       = 40
SYSTEMS      = ["ATC","ZiPS","Steamer","THE BAT","Depth Charts"]

ROOT     = Path(__file__).parent.parent
DATA_DIR = ROOT / "data" / "projections"
HIST_DIR = ROOT / "data" / "raw"
OUT_FILE = ROOT / "public" / "players.json"

SYSTEM_FILES = {
    "ATC":          ("atc_hitters.csv",          "atc_pitchers.csv"),
    "ZiPS":         ("zips_hitters.csv",          "zips_pitchers.csv"),
    "Steamer":      ("steamer_hitters.csv",       "steamer_pitchers.csv"),
    "THE BAT":      ("thebat_hitters.csv",        "thebat_pitchers.csv"),
    "Depth Charts": ("depthcharts_hitters.csv",   "depthcharts_pitchers.csv"),
}

# Position priority — prefer scarcer positions
POS_PRIORITY = ["C","SS","2B","3B","CF","OF","LF","RF","1B","DH"]

def normalize_pos(p):
    if not isinstance(p, str): return None
    p = p.strip().upper()
    if p in ("LF","RF","CF"): return "OF"
    if p in ("C","SS","2B","3B","1B","DH","OF","SP","RP"): return p
    return None

def fetch_positions():
    """Fetch real positions from pybaseball fielding stats."""
    try:
        from pybaseball import fielding_stats
        print("  Fetching position data from fielding stats...")
        fielding = fielding_stats(2024, 2024, qual=1)
        pos_map = {}
        for _, row in fielding.iterrows():
            name = str(row.get("Name","")).strip()
            pos  = normalize_pos(str(row.get("Pos","")))
            if not pos or not name: continue
            if name not in pos_map:
                pos_map[name] = pos
            else:
                cur = POS_PRIORITY.index(pos_map[name]) if pos_map[name] in POS_PRIORITY else 99
                new = POS_PRIORITY.index(pos)           if pos           in POS_PRIORITY else 99
                if new < cur: pos_map[name] = pos
        print(f"  Got positions for {len(pos_map)} players")
        return pos_map
    except Exception as e:
        print(f"  Could not fetch fielding positions: {e}")
        return {}

def normalize_name(name):
    if not isinstance(name, str): return ""
    name = name.strip()
    name = re.sub(r"\s+(Jr\.?|Sr\.?|II|III|IV)$", "", name, flags=re.IGNORECASE)
    return name.lower()

def f(val):
    if val is None: return None
    try:
        v = float(val)
        return None if np.isnan(v) else round(v, 4)
    except: return None

def get(row, *keys):
    for k in keys:
        if k in row and row[k] is not None:
            return f(row[k])
    return None

def load_projections():
    hitter_frames, pitcher_frames = [], []
    for system, (h_file, p_file) in SYSTEM_FILES.items():
        for fpath, ftype, frames in [
            (DATA_DIR/h_file, "hitter",  hitter_frames),
            (DATA_DIR/p_file, "pitcher", pitcher_frames),
        ]:
            if not fpath.exists():
                print(f"  - {system} {ftype}s not found")
                continue
            try:
                df = pd.read_csv(fpath)
                if ftype == "hitter" and "TB" not in df.columns:
                    if all(c in df.columns for c in ["1B","2B","3B","HR"]):
                        df["TB"] = df["1B"] + 2*df["2B"] + 3*df["3B"] + 4*df["HR"]
                    elif all(c in df.columns for c in ["H","2B","3B","HR"]):
                        df["TB"] = df["H"] + df["2B"] + 2*df["3B"] + 3*df["HR"]
                df["_system"] = system
                df["_type"]   = ftype
                frames.append(df)
                print(f"  + {system} {ftype}s: {len(df)} rows")
            except Exception as e:
                print(f"  x {system} {ftype}s: {e}")

    hitters  = pd.concat(hitter_frames,  ignore_index=True) if hitter_frames  else pd.DataFrame()
    pitchers = pd.concat(pitcher_frames, ignore_index=True) if pitcher_frames else pd.DataFrame()
    return hitters, pitchers

def merge_players(hitters, pitchers, pos_map):
    players = {}

    def process(df, ptype):
        for _, row in df.iterrows():
            name = normalize_name(str(row.get("Name", "")))
            if not name: continue
            key = f"{name}_{ptype}"
            if key not in players:
                raw_name = str(row.get("Name","")).strip()
                # Use fielding position if available, fall back to CSV Pos column
                csv_pos = normalize_pos(str(row.get("Pos",""))) or ""
                real_pos = pos_map.get(raw_name, csv_pos)
                players[key] = {
                    "id":      key,
                    "name":    raw_name,
                    "team":    str(row.get("Team","")).strip(),
                    "pos":     real_pos,
                    "type":    ptype,
                    "systems": {},
                }
            p = players[key]
            if row.get("Team"): p["team"] = str(row["Team"]).strip()

            if ptype == "hitter":
                p["systems"][row["_system"]] = {
                    "G":    get(row, "G"),
                    "PA":   get(row, "PA"),
                    "R":    get(row, "R"),
                    "HR":   get(row, "HR"),
                    "RBI":  get(row, "RBI"),
                    "SB":   get(row, "SB"),
                    "H":    get(row, "H"),
                    "TB":   get(row, "TB"),
                    "AVG":  get(row, "AVG"),
                    "OBP":  get(row, "OBP"),
                    "SLG":  get(row, "SLG"),
                    "wOBA": get(row, "wOBA"),
                    "wRC+": get(row, "wRC+"),
                    "BABIP":get(row, "BABIP"),
                    "BB%":  get(row, "BB%"),
                    "K%":   get(row, "K%"),
                    "ISO":  get(row, "ISO"),
                }
            else:
                p["systems"][row["_system"]] = {
                    "G":    get(row, "G"),
                    "GS":   get(row, "GS"),
                    "IP":   get(row, "IP"),
                    "W":    get(row, "W"),
                    "K":    get(row, "K", "SO"),
                    "ERA":  get(row, "ERA"),
                    "WHIP": get(row, "WHIP"),
                    "SV":   get(row, "SV"),
                    "HLD":  get(row, "HLD", "HD"),
                    "QS":   get(row, "QS"),
                    "BB":   get(row, "BB"),
                    "FIP":  get(row, "FIP"),
                }

    if not hitters.empty:  process(hitters,  "hitter")
    if not pitchers.empty: process(pitchers, "pitcher")
    return list(players.values())

def add_consensus(players):
    for p in players:
        cats = (["G","PA","R","HR","RBI","SB","H","TB","AVG","OBP","SLG",
                 "wOBA","wRC+","BABIP","BB%","K%","ISO"]
                if p["type"] == "hitter"
                else ["G","GS","IP","W","K","ERA","WHIP","SV","HLD","QS","BB","FIP"])
        p["consensus"] = {}
        for cat in cats:
            vals = [s.get(cat) for s in p["systems"].values() if s.get(cat) is not None]
            p["consensus"][cat] = round(float(np.mean(vals)), 4) if vals else None
    return players

def add_disagreement(players):
    for p in players:
        cats = HIT_CATS + ["wOBA","wRC+"] if p["type"] == "hitter" else PIT_CATS
        dis = {}
        overall_cvs = []
        for cat in cats:
            vals = [s.get(cat) for s in p["systems"].values() if s.get(cat) is not None]
            if len(vals) < 2:
                dis[cat] = 0.0
                continue
            mean = np.mean(vals)
            std  = np.std(vals)
            cv   = float(std / abs(mean)) if abs(mean) > 0.001 else 0.0
            dis[cat] = round(cv, 4)
            overall_cvs.append(cv)
        p["disagreement"] = dis
        p["disagreement_score"] = round(float(np.mean(overall_cvs)), 4) if overall_cvs else 0.0
    return players

def filter_qualified(players):
    qualified = []
    for p in players:
        if p["type"] == "hitter":
            pas = [s.get("PA") for s in p["systems"].values() if s.get("PA") is not None]
            if pas and np.mean(pas) >= MIN_PA: qualified.append(p)
        else:
            ips = [s.get("IP") for s in p["systems"].values() if s.get("IP") is not None]
            if ips and np.mean(ips) >= MIN_IP: qualified.append(p)
    print(f"  Qualified: {len(qualified)} / {len(players)}")
    return qualified

def add_zscores_var(players):
    hitters  = [p for p in players if p["type"] == "hitter"]
    pitchers = [p for p in players if p["type"] == "pitcher"]

    def compute_z(pool, cats):
        stats = {}
        for cat in cats:
            vals = [p["consensus"].get(cat) for p in pool if p["consensus"].get(cat) is not None]
            stats[cat] = (np.mean(vals), np.std(vals) or 1) if vals else (0, 1)
        for p in pool:
            z = 0.0
            for cat in cats:
                val = p["consensus"].get(cat)
                if val is None: continue
                mean, std = stats[cat]
                zc = (val - mean) / std
                z += -zc if cat in LOWER_BETTER else zc
            p["zScore"] = round(float(z), 2)

    compute_z(hitters,  HIT_CATS)
    compute_z(pitchers, PIT_CATS)

    h_slots = LEAGUE_SIZE * (ROSTER_SLOTS["C"] + ROSTER_SLOTS["1B"] + ROSTER_SLOTS["2B"] +
                              ROSTER_SLOTS["SS"] + ROSTER_SLOTS["3B"] + ROSTER_SLOTS["OF"] +
                              ROSTER_SLOTS["UTIL"])
    p_slots = LEAGUE_SIZE * (ROSTER_SLOTS["SP"] + ROSTER_SLOTS["RP"] + ROSTER_SLOTS["P"])

    h_sorted = sorted(hitters,  key=lambda x: x.get("zScore",0), reverse=True)
    p_sorted = sorted(pitchers, key=lambda x: x.get("zScore",0), reverse=True)

    h_repl = h_sorted[h_slots]["zScore"] if len(h_sorted) > h_slots else 0
    p_repl = p_sorted[p_slots]["zScore"] if len(p_sorted) > p_slots else 0

    for p in hitters:  p["VAR"] = round(p.get("zScore",0) - h_repl, 2)
    for p in pitchers: p["VAR"] = round(p.get("zScore",0) - p_repl, 2)
    return players

def add_tiers(players):
    for p in players:
        var = p.get("VAR", 0)
        if var >= 15:   p["tier"] = 1
        elif var >= 8:  p["tier"] = 2
        elif var >= 2:  p["tier"] = 3
        elif var >= -2: p["tier"] = 4
        else:           p["tier"] = 5
    return players

def add_percentiles(players):
    hitters  = [p for p in players if p["type"] == "hitter"]
    pitchers = [p for p in players if p["type"] == "pitcher"]

    def compute(pool, cats):
        for cat in cats:
            vals = sorted([p["consensus"].get(cat) for p in pool
                          if p["consensus"].get(cat) is not None])
            n = len(vals)
            if not n: continue
            for p in pool:
                v = p["consensus"].get(cat)
                pct = len([x for x in vals if x <= v]) / n if v is not None else None
                p.setdefault("percentiles", {})[cat] = round(pct, 4) if pct is not None else None

    compute(hitters,  HIT_CATS + ["wOBA","wRC+","AVG","SLG","ISO"])
    compute(pitchers, PIT_CATS + ["FIP"])

    all_vars = sorted([p.get("VAR",0)    for p in players])
    all_z    = sorted([p.get("zScore",0) for p in players])
    n = len(all_vars)
    for p in players:
        v = p.get("VAR",0)
        z = p.get("zScore",0)
        p.setdefault("percentiles",{})["VAR"]    = round(len([x for x in all_vars if x<=v])/n, 4)
        p.setdefault("percentiles",{})["zScore"] = round(len([x for x in all_z    if x<=z])/n, 4)
    return players

def add_scarcity(players):
    pos_groups = {}
    for p in players:
        pos = p.get("pos","?")
        if pos not in pos_groups: pos_groups[pos] = []
        pos_groups[pos].append(p)
    scarcity = {}
    for pos, pool in pos_groups.items():
        slots       = ROSTER_SLOTS.get(pos, 1) * LEAGUE_SIZE
        sorted_pool = sorted(pool, key=lambda x: x.get("VAR",0), reverse=True)
        s_vars      = [p["VAR"] for p in sorted_pool[:slots]                  if "VAR" in p]
        b_vars      = [p["VAR"] for p in sorted_pool[slots:slots+LEAGUE_SIZE] if "VAR" in p]
        s_avg       = float(np.mean(s_vars)) if s_vars else 0
        b_avg       = float(np.mean(b_vars)) if b_vars else 0
        scarcity[pos] = {
            "total":           len(pool),
            "starter_slots":   slots,
            "starter_avg_var": round(s_avg, 2),
            "bench_avg_var":   round(b_avg, 2),
            "drop_off":        round(s_avg - b_avg, 2),
        }
    return scarcity

def flag_players(players):
    for p in players:
        p["flags"] = []
        if p["type"] == "hitter":
            if (p["consensus"].get("PA") or 0) < 300: p["flags"].append("part-time")
        else:
            if (p["consensus"].get("IP") or 0) < 100: p["flags"].append("part-time")
    return players

def load_historical():
    history = {}
    for fname in ["hitters_all.csv","pitchers_all.csv"]:
        path = HIST_DIR / fname
        if not path.exists():
            print(f"  - {fname} not found")
            continue
        try:
            df = pd.read_csv(path)
            name_col   = next((c for c in df.columns if c.lower() in ["name","playername"]), None)
            season_col = next((c for c in df.columns if c.lower() == "season"), None)
            if not name_col: continue
            for _, row in df.iterrows():
                name = normalize_name(str(row.get(name_col,"")))
                if not name: continue
                if name not in history: history[name] = []
                entry = {}
                if season_col:
                    entry["season"] = int(row[season_col]) if pd.notna(row[season_col]) else None
                for col in df.columns:
                    if col in (name_col, season_col, "IDfg","playerid"): continue
                    try:
                        entry[col] = round(float(row[col]),4) if pd.notna(row[col]) else None
                    except:
                        entry[col] = str(row[col]) if pd.notna(row[col]) else None
                history[name].append(entry)
            print(f"  + {fname}: loaded")
        except Exception as e:
            print(f"  x {fname}: {e}")
    return history

def main():
    print("\nFantasy Baseball 2026 - Processing Pipeline\n")

    print("Step 1: Loading projection CSVs...")
    hitters, pitchers = load_projections()
    if hitters.empty and pitchers.empty:
        print("No CSV files found.")
        sys.exit(1)

    print("\nStep 2: Fetching real positions...")
    pos_map = fetch_positions()

    print("\nStep 3: Merging players...")
    players = merge_players(hitters, pitchers, pos_map)
    print(f"  Total: {len(players)} unique players")

    print("\nStep 4: Filtering qualified players...")
    players = filter_qualified(players)

    print("\nStep 5: Computing stats...")
    players = add_consensus(players)
    players = add_disagreement(players)
    players = add_zscores_var(players)
    players = add_tiers(players)
    players = add_percentiles(players)

    print("\nStep 6: Position scarcity...")
    scarcity = add_scarcity(players)

    print("\nStep 7: Flags...")
    players = flag_players(players)

    print("\nStep 8: Historical data...")
    history = load_historical()
    for p in players:
        p["history"] = history.get(normalize_name(p["name"]), [])

    players.sort(key=lambda x: x.get("VAR",0), reverse=True)

    output = {
        "generated": pd.Timestamp.now().isoformat(),
        "systems":   SYSTEMS,
        "league":    {"size":LEAGUE_SIZE,"hit_cats":HIT_CATS,"pit_cats":PIT_CATS,"roster_slots":ROSTER_SLOTS},
        "scarcity":  scarcity,
        "players":   players,
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w") as f:
        json.dump(output, f, indent=2, default=str)

    print(f"\nDone! Wrote {len(players)} players to {OUT_FILE}")
    print(f"  Hitters:  {sum(1 for p in players if p['type']=='hitter')}")
    print(f"  Pitchers: {sum(1 for p in players if p['type']=='pitcher')}")

if __name__ == "__main__":
    main()
