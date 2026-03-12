import pandas as pd
import numpy as np
import json
import os

os.makedirs("public", exist_ok=True)

df = pd.read_csv('data/projections_hitters.csv')
df = df.where(pd.notna(df), None)

# Pull real position data from FanGraphs
from pybaseball import batting_stats
print("Fetching position data...")
raw = batting_stats(2024, 2024, qual=50)
pos_map = {}
if 'pos' in raw.columns:
    for _, row in raw.iterrows():
        pos_map[row['Name']] = row['pos']

# Position priority order (players often qualify at multiple)
POS_PRIORITY = ['C', 'SS', '2B', '3B', 'OF', '1B', 'DH']

def clean_position(raw_pos):
    if not isinstance(raw_pos, str):
        return 'OF'
    for p in POS_PRIORITY:
        if p in raw_pos.upper():
            return p
    return 'OF'

df['position'] = df['Name'].map(pos_map).apply(clean_position)

# Replacement level xwOBA by position (based on 150th-ranked player at each spot)
REPLACEMENT = {
    'C':  0.305,
    'SS': 0.318,
    '2B': 0.318,
    '3B': 0.325,
    'OF': 0.318,
    '1B': 0.338,
    'DH': 0.338,
}

# Positional scarcity multiplier — scarce positions worth more
SCARCITY = {
    'C':  1.30,
    'SS': 1.20,
    '2B': 1.15,
    '3B': 1.10,
    'OF': 1.00,
    '1B': 0.95,
    'DH': 0.90,
}

df['replacement_xwOBA'] = df['position'].map(REPLACEMENT).fillna(0.318)
df['scarcity'] = df['position'].map(SCARCITY).fillna(1.0)
df['VORP'] = ((df['xwOBA'] - df['replacement_xwOBA']) * df['proj_PA'] * 1.15 * df['scarcity']).round(1)

def assign_tier(vorp):
    if vorp >= 45: return 1
    if vorp >= 28: return 2
    if vorp >= 14: return 3
    if vorp >= 0:  return 4
    return 5

df['tier'] = df['VORP'].apply(assign_tier)

players = []
for _, row in df.iterrows():
    def safe_float(val, decimals=1):
        try:
            return round(float(val), decimals) if val is not None else None
        except:
            return None

    players.append({
        'id': int(row['IDfg']) if row['IDfg'] else None,
        'name': row['Name'],
        'age': int(row['Age']) if row['Age'] else None,
        'team': row['Team'],
        'position': row['position'],
        'tier': int(row['tier']),
        'projections': {
            'PA':   int(row['proj_PA']) if row['proj_PA'] else None,
            'HR':   safe_float(row['HR']),
            'RBI':  safe_float(row['RBI']),
            'R':    safe_float(row['R']),
            'SB':   safe_float(row['SB']),
            'AVG':  safe_float(row['AVG'], 3),
            'OBP':  safe_float(row['OBP'], 3),
            'SLG':  safe_float(row['SLG'], 3),
            'wOBA': safe_float(row['wOBA'], 3),
            'xwOBA':safe_float(row['xwOBA'], 4),
            'wRC+': safe_float(row.get('wRC+'), 0),
        },
        'skills': {
            'HardHit%': safe_float(row['HardHit%']),
            'Barrel%':  safe_float(row['Barrel%']),
            'K%':       safe_float(row['K%']),
            'BB%':      safe_float(row['BB%']),
            'SwStr%':   safe_float(row['SwStr%']),
            'BABIP':    safe_float(row['BABIP'], 3),
            'GB%':      safe_float(row['GB%']),
            'FB%':      safe_float(row['FB%']),
            'Pull%':    safe_float(row['Pull%']),
        },
        'VORP': safe_float(row['VORP']),
        'scarcity_pos': row['position'],
    })

players.sort(key=lambda x: x['VORP'] or 0, reverse=True)

with open('public/players.json', 'w') as f:
    json.dump({
        'players': players,
        'generated': pd.Timestamp.now().isoformat(),
        'total': len(players)
    }, f, indent=2)

print(f"Exported {len(players)} players")
print("\nTop 15 by VORP:")
for i, p in enumerate(players[:15], 1):
    print(f"  {i:2}. {p['name']:<22} {p['position']:3} Tier {p['tier']}  VORP: {p['VORP']:5}  xwOBA: {p['projections']['xwOBA']}")
