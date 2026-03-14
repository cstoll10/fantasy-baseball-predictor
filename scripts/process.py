"""
Fantasy Baseball 2026 — Data Processing Pipeline
"""

import json
import os
import re
import sys
import time
import warnings
from pathlib import Path

import pandas as pd
import numpy as np
import requests
from bs4 import BeautifulSoup

warnings.filterwarnings("ignore")

# ── Config ────────────────────────────────────────────────────────────────────
LEAGUE_SIZE   = 12
ROSTER_SLOTS  = {"C":1,"1B":1,"2B":1,"SS":1,"3B":1,"OF":3,"UTIL":1,"SP":5,"RP":3,"P":2,"BN":7}
HIT_CATS      = ["R","HR","RBI","SB","OBP","H","TB"]
PIT_CATS      = ["W","K","ERA","WHIP","SV","HLD","QS"]
LOWER_BETTER  = {"ERA","WHIP"}
MIN_PA        = 150
MIN_IP        = 40
SYSTEMS       = ["ATC","ZiPS","Steamer","THE BAT","Depth Charts"]

ROOT      = Path(__file__).parent.parent
DATA_DIR  = ROOT / "data" / "projections"
HIST_DIR  = ROOT / "data" / "raw"
OUT_FILE  = ROOT / "public" / "players.json"

SYSTEM_FILES = {
    "ATC":          ("atc_hitters.csv",          "atc_pitchers.csv"),
    "ZiPS":         ("zips_hitters.csv",          "zips_pitchers.csv"),
    "Steamer":      ("steamer_hitters.csv",       "steamer_pitchers.csv"),
    "THE BAT":      ("thebat_hitters.csv",        "thebat_pitchers.csv"),
    "Depth Charts": ("depthcharts_hitters.csv",   "depthcharts_pitchers.csv"),
}

HIT_ALIASES = {
    "Name":  ["Name","PlayerName","name"],
    "Team":  ["Team","Tm","team"],
    "Pos":   ["Pos","Position","pos","POS"],
    "PA":    ["PA","pa"],
    "R":     ["R","Runs"],
    "HR":    ["HR","HomeRuns"],
    "RBI":   ["RBI","rbi"],
    "SB":    ["SB","sb"],
    "H":     ["H","Hits"],
    "TB":    ["TB","TotalBases","Total Bases"],
    "OBP":   ["OBP","obp","On-Base%"],
    "AVG":   ["AVG","avg","BA"],
    "SLG":   ["SLG","slg"],
    "BB":    ["BB","bb"],
    "SO":    ["SO","K","Strikeouts","so"],
    "playerid": ["playerid","PlayerId","IDFANGRAPHS"],
}

PIT_ALIASES = {
    "Name":  ["Name","PlayerName","name"],
    "Team":  ["Team","Tm","team"],
    "Pos":   ["Pos","Position","pos","POS","Role"],
    "IP":    ["IP","ip","InningsPitched"],
    "W":     ["W","Wins","w"],
    "K":     ["SO","K","Strikeouts","so"],
    "ERA":   ["ERA","era"],
    "WHIP":  ["WHIP","whip"],
    "SV":    ["SV","sv","Saves"],
    "HLD":   ["HLD","HD","Holds","hld"],
    "QS":    ["QS","qs","QualityStarts"],
    "BB":    ["BB","bb"],
    "playerid": ["playerid","PlayerId","IDFANGRAPHS"],
}

def resolve_col(df, aliases):
    col_lower = {c.lower(): c for c in df.columns}
    for alias in aliases:
        if alias.lower() in col_lower:
            return col_lower[alias.lower()]
    return None

def extract(df, aliases, default=None):
    col = resolve_col(df, aliases)
    if col:
        return df[col]
    return pd.Series([default] * len(df), index=df.index)

def normalize_name(name):
    if not isinstance(name, str):
        return ""
    name = name.strip()
    name = re.sub(r"\s+(Jr\.?|Sr\.?|II|III|IV)$", "", name, flags=re.IGNORECASE)
    return name.lower()

def load_projections():
    hitter_frames = []
    pitcher_frames = []

    for system, (h_file, p_file) in SYSTEM_FILES.items():
        h_path = DATA_DIR / h_file
        p_path = DATA_DIR / p_file

        if h_path.exists():
            try:
                df = pd.read_csv(h_path)
                row = {canon: extract(df, aliases) for canon, aliases in HIT_ALIASES.items()}
                ndf = pd.DataFrame(row)
                ndf["_system"] = system
                ndf["_type"] = "hitter"
                hitter_frames.append(ndf)
                print(f"  + {system} hitters: {len(df)} rows")
            except Exception as e:
                print(f"  x {system} hitters: {e}")
        else:
            print(f"  - {system} hitters not found")

        if p_path.exists():
            try:
                df = pd.read_csv(p_path)
                row = {canon: extract(df, aliases) for canon, aliases in PIT_ALIASES.items()}
                ndf = pd.DataFrame(row)
                ndf["_system"] = system
                ndf["_type"] = "pitcher"
                pitcher_frames.append(ndf)
                print(f"  + {system} pitchers: {len(df)} rows")
            except Exception as e:
                print(f"  x {system} pitchers: {e}")
        else:
            print(f"  - {system} pitchers not found")

    hitters  = pd.concat(hitter_frames,  ignore_index=True) if hitter_frames  else pd.DataFrame()
    pitchers = pd.concat(pitcher_frames, ignore_index=True) if pitcher_frames else pd.DataFrame()
    return hitters, pitchers

def merge_players(hitters, pitchers):
    players = {}

    def _f(row, col):
        v = row.get(col)
        if v is None or (isinstance(v, float) and np.isnan(v)):
            return None
        try:
            return round(float(v), 4)
        except:
            return None

    def process_frame(df, ptype):
        for _, row in df.iterrows():
            name = normalize_name(row.get("Name", ""))
            if not name:
                continue
            key = f"{name}_{ptype}"
            if key not in players:
                players[key] = {
                    "id": key,
                    "name": str(row.get("Name","")).strip(),
                    "team": str(row.get("Team","")).strip(),
                    "pos": str(row.get("Pos","")).strip(),
                    "type": ptype,
                    "systems": {},
                }
            p = players[key]
            sys_name = row["_system"]

            if ptype == "hitter":
                stats = {
                    "PA":  _f(row,"PA"),  "R":   _f(row,"R"),
                    "HR":  _f(row,"HR"),  "RBI": _f(row,"RBI"),
                    "SB":  _f(row,"SB"),  "H":   _f(row,"H"),
                    "TB":  _f(row,"TB"),  "OBP": _f(row,"OBP"),
                    "AVG": _f(row,"AVG"), "SLG": _f(row,"SLG"),
                    "BB":  _f(row,"BB"),  "SO":  _f(row,"SO"),
                }
            else:
                stats = {
                    "IP":   _f(row,"IP"),   "W":    _f(row,"W"),
                    "K":    _f(row,"K"),    "ERA":  _f(row,"ERA"),
                    "WHIP": _f(row,"WHIP"), "SV":   _f(row,"SV"),
                    "HLD":  _f(row,"HLD"),  "QS":   _f(row,"QS"),
                    "BB":   _f(row,"BB"),
                }

            p["systems"][sys_name] = stats
            if row.get("Team") and str(row["Team"]).strip():
                p["team"] = str(row["Team"]).strip()

    if not hitters.empty:
        process_frame(hitters, "hitter")
    if not pitchers.empty:
        process_frame(pitchers, "pitcher")

    return list(players.values())

def filter_qualified(players):
    qualified = []
    for p in players:
        if p["type"] == "hitter":
            pas = [s.get("PA") for s in p["systems"].values() if s.get("PA") is not None]
            if np.mean(pas) >= MIN_PA if pas else False:
                qualified.append(p)
        else:
            ips = [s.get("IP") for s in p["systems"].values() if s.get("IP") is not None]
            if np.mean(ips) >= MIN_IP if ips else False:
                qualified.append(p)
    print(f"  Qualified: {len(qualified)} / {len(players)}")
    return qualified

def add_consensus(players):
    for p in players:
        cats = (["PA","R","HR","RBI","SB","H","TB","OBP","AVG","SLG","BB","SO"]
                if p["type"] == "hitter"
                else ["IP","W","K","ERA","WHIP","SV","HLD","QS","BB"])
        consensus = {}
        for cat in cats:
            vals = [s.get(cat) for s in p["systems"].values() if s.get(cat) is not None]
            consensus[cat] = round(float(np.mean(vals)), 4) if vals else None
        p["consensus"] = consensus
    return players

def add_disagreement(players):
    for p in players:
        cats = HIT_CATS if p["type"] == "hitter" else PIT_CATS
        dis = {}
        for cat in cats:
            vals = [s.get(cat) for s in p["systems"].values() if s.get(cat) is not None]
            if len(vals) < 2:
                dis[cat] = 0.0
                continue
            mean = np.mean(vals)
            std  = np.std(vals)
            cv   = float(std / abs(mean)) if abs(mean) > 0.001 else 0.0
            dis[cat] = round(cv, 4)
        p["disagreement"] = dis
    return players

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
                if val is None:
                    continue
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

    for p in hitters:
        p["VAR"] = round(p.get("zScore",0) - h_repl, 2)
    for p in pitchers:
        p["VAR"] = round(p.get("zScore",0) - p_repl, 2)

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
            if not n:
                continue
            for p in pool:
                v = p["consensus"].get(cat)
                pct = len([x for x in vals if x <= v]) / n if v is not None else None
                p.setdefault("percentiles", {})[cat] = round(pct, 4) if pct is not None else None

    compute(hitters,  HIT_CATS + ["AVG","SLG"])
    compute(pitchers, PIT_CATS)

    all_vars = sorted([p.get("VAR",0) for p in players])
    all_z    = sorted([p.get("zScore",0) for p in players])
    n = len(all_vars)
    for p in players:
        pct = p.setdefault("percentiles", {})
        v = p.get("VAR", 0)
        z = p.get("zScore", 0)
        pct["VAR"]    = round(len([x for x in all_vars if x <= v]) / n, 4)
        pct["zScore"] = round(len([x for x in all_z   if x <= z]) / n, 4)

    return players

def add_scarcity(players):
    pos_groups = {}
    for p in players:
        pos = p.get("pos","?")
        if pos not in pos_groups:
            pos_groups[pos] = []
        pos_groups[pos].append(p)

    scarcity = {}
    for pos, pool in pos_groups.items():
        slots = ROSTER_SLOTS.get(pos, 1) * LEAGUE_SIZE
        sorted_pool  = sorted(pool, key=lambda x: x.get("VAR",0), reverse=True)
        starter_vars = [p["VAR"] for p in sorted_pool[:slots] if "VAR" in p]
        bench_vars   = [p["VAR"] for p in sorted_pool[slots:slots+LEAGUE_SIZE] if "VAR" in p]
        starter_avg  = float(np.mean(starter_vars)) if starter_vars else 0
        bench_avg    = float(np.mean(bench_vars))   if bench_vars   else 0
        scarcity[pos] = {
            "total":           len(pool),
            "starter_slots":   slots,
            "starter_avg_var": round(starter_avg, 2),
            "bench_avg_var":   round(bench_avg, 2),
            "drop_off":        round(starter_avg - bench_avg, 2),
        }
    return scarcity

def flag_players(players):
    for p in players:
        p["flags"] = []
        if p["type"] == "hitter":
            if (p["consensus"].get("PA") or 0) < 300:
                p["flags"].append("part-time")
        else:
            if (p["consensus"].get("IP") or 0) < 100:
                p["flags"].append("part-time")
    return players

def load_historical():
    history = {}
    for fname, label in [("hitters_all.csv","hitter"), ("pitchers_all.csv","pitcher")]:
        path = HIST_DIR / fname
        if not path.exists():
            print(f"  - {fname} not found")
            continue
        try:
            df = pd.read_csv(path)
            name_col = next((c for c in df.columns if c.lower() in ["name","playername"]), None)
            season_col = next((c for c in df.columns if c.lower() == "season"), None)
            if not name_col:
                print(f"  x {fname}: no Name column found")
                continue
            for _, row in df.iterrows():
                name = normalize_name(str(row.get(name_col,"")))
                if not name:
                    continue
                if name not in history:
                    history[name] = []
                entry = {}
                if season_col:
                    entry["season"] = int(row[season_col]) if pd.notna(row[season_col]) else None
                for col in df.columns:
                    if col in (name_col, season_col, "IDfg","playerid"):
                        continue
                    try:
                        entry[col] = round(float(row[col]), 4) if pd.notna(row[col]) else None
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
        print("\nNo CSV files found. Add them to data/projections/ and try again.")
        sys.exit(1)

    print("\nStep 2: Merging players...")
    players = merge_players(hitters, pitchers)
    print(f"  Total: {len(players)} unique players")

    print("\nStep 3: Filtering qualified players...")
    players = filter_qualified(players)

    print("\nStep 4: Computing stats...")
    players = add_consensus(players)
    players = add_disagreement(players)
    players = add_zscores_var(players)
    players = add_tiers(players)
    players = add_percentiles(players)

    print("\nStep 5: Position scarcity...")
    scarcity = add_scarcity(players)

    print("\nStep 6: Flags...")
    players = flag_players(players)

    print("\nStep 7: Historical data...")
    history = load_historical()
    for p in players:
        key = normalize_name(p["name"])
        p["history"] = history.get(key, [])

    players.sort(key=lambda x: x.get("VAR",0), reverse=True)

    output = {
        "generated": pd.Timestamp.now().isoformat(),
        "systems":   SYSTEMS,
        "league": {
            "size":         LEAGUE_SIZE,
            "hit_cats":     HIT_CATS,
            "pit_cats":     PIT_CATS,
            "roster_slots": ROSTER_SLOTS,
        },
        "scarcity": scarcity,
        "players":  players,
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w") as f:
        json.dump(output, f, indent=2, default=str)

    print(f"\nDone! Wrote {len(players)} players to {OUT_FILE}")
    print(f"  Hitters:  {sum(1 for p in players if p['type']=='hitter')}")
    print(f"  Pitchers: {sum(1 for p in players if p['type']=='pitcher')}")

if __name__ == "__main__":
    main()
