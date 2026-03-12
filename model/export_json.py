import pandas as pd
import json
import os
from calculate_replacements import calculate_replacements, get_pos_map

os.makedirs("public", exist_ok=True)

df = pd.read_csv('data/projections_hitters.csv')
df = df.where(pd.notna(df), None)

print("Calculating replacement levels...")
raw_df = pd.read_csv('data/raw/hitters.csv')
pos_map = get_pos_map()
replacements, scarcity, _ = calculate_replacements(raw_df, pos_map)

df['position'] = df['Name'].map(pos_map).fillna('OF')
df['replacement_xwOBA'] = df['position'].map(replacements).fillna(0.315)
df['scarcity'] = df['position'].map(scarcity).fillna(1.0)
df['VORP_raw'] = (df['xwOBA'] - df['replacement_xwOBA']) * df['proj_PA'] * 1.15 * df['scarcity']
max_vorp = df['VORP_raw'].max()
df['VORP'] = (df['VORP_raw'] / max_vorp * 100).round(1)

def assign_tier(vorp):
    if vorp >= 50: return 1
    if vorp >= 30: return 2
    if vorp >= 15: return 3
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
            'PA':    int(row['proj_PA']) if row['proj_PA'] else None,
            'HR':    safe_float(row['HR']),
            'RBI':   safe_float(row['RBI']),
            'R':     safe_float(row['R']),
            'SB':    safe_float(row['SB']),
            'AVG':   safe_float(row['AVG'], 3),
            'OBP':   safe_float(row['OBP'], 3),
            'SLG':   safe_float(row['SLG'], 3),
            'wOBA':  safe_float(row['wOBA'], 3),
            'xwOBA': safe_float(row['xwOBA'], 4),
            'wRC+':  safe_float(row.get('wRC+'), 0),
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
    })

players.sort(key=lambda x: x['VORP'] or 0, reverse=True)

with open('public/players.json', 'w') as f:
    json.dump({
        'players': players,
        'generated': pd.Timestamp.now().isoformat(),
        'total': len(players)
    }, f, indent=2)

print(f"\nExported {len(players)} players")
print("\nTop 15 by VORP:")
for i, p in enumerate(players[:15], 1):
    print(f"  {i:2}. {p['name']:<22} {p['position']:3} Tier {p['tier']}  VORP: {p['VORP']:6}  xwOBA: {p['projections']['xwOBA']}")
