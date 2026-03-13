import pandas as pd
import json
import os
from calculate_replacements import calculate_replacements, get_pos_map

os.makedirs("public", exist_ok=True)

df = pd.read_csv('data/projections_hitters.csv')
df = df.where(pd.notna(df), None)

print("Calculating replacement levels...")
raw_df = pd.read_csv('data/raw/hitters.csv')
history_df = raw_df.copy()
pos_map = get_pos_map()
replacements, scarcity, _ = calculate_replacements(raw_df, pos_map)

df['position'] = df['Name'].map(pos_map).fillna('OF')
df['replacement_xwOBA'] = df['position'].map(replacements).fillna(0.315)
df['scarcity'] = df['position'].map(scarcity).fillna(1.0)

# 7-category VORP: HR, RBI, SB, H, TB, OBP
df['approx_AB'] = df['proj_PA'] * 0.88
df['H']  = (df['AVG'] * df['approx_AB']).round(1)
df['TB'] = (df['SLG'] * df['approx_AB']).round(1)

WEIGHTS = {'HR': 1.4, 'RBI': 1.2, 'SB': 1.8, 'H': 1.0, 'TB': 1.0, 'OBP': 0.8}
CATS = list(WEIGHTS.keys())

qualified = df[df['proj_PA'] >= 300].copy()
replacement_cats = {}
cat_stds = {}
for cat in CATS:
    sorted_vals = qualified[cat].sort_values(ascending=False)
    cutoff = min(145, len(sorted_vals) - 1)
    replacement_cats[cat] = sorted_vals.iloc[cutoff]
    cat_stds[cat] = qualified[cat].std()

for cat in CATS:
    df[f'{cat}_z'] = ((df[cat] - replacement_cats[cat]) / cat_stds[cat]).clip(lower=-2)

df['VORP_raw'] = sum(df[f'{cat}_z'] * WEIGHTS[cat] for cat in CATS)

# Apply positional scarcity on top
df['VORP_raw'] = df['VORP_raw'] * df['scarcity']

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

    # Per-season history
    player_history = history_df[history_df['Name'] == row['Name']].sort_values('Season')
    season_history = []
    for _, hr in player_history.iterrows():
        def sf3(v):
            try: return round(float(v), 3) if v is not None and not pd.isna(v) else None
            except: return None
        season_history.append({
            'season': int(hr['Season']),
            'xwOBA':    sf3(hr.get('xwOBA')),
            'HardHit%': sf3(hr.get('HardHit%')),
            'Barrel%':  sf3(hr.get('Barrel%')),
            'K%':       sf3(hr.get('K%')),
            'BB%':      sf3(hr.get('BB%')),
            'SwStr%':   sf3(hr.get('SwStr%')),
            'BABIP':    sf3(hr.get('BABIP')),
            'GB%':      sf3(hr.get('GB%')),
            'FB%':      sf3(hr.get('FB%')),
            'Pull%':    sf3(hr.get('Pull%')),
        })

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
            'HardHit%': safe_float(row['HardHit%'], 3),
            'Barrel%':  safe_float(row['Barrel%'], 3),
            'K%':       safe_float(row['K%'], 3),
            'BB%':      safe_float(row['BB%'], 3),
            'SwStr%':   safe_float(row['SwStr%'], 3),
            'BABIP':    safe_float(row['BABIP'], 3),
            'GB%':      safe_float(row['GB%'], 3),
            'FB%':      safe_float(row['FB%'], 3),
            'Pull%':    safe_float(row['Pull%'], 3),
        },
        'VORP': safe_float(row['VORP']),
        'history': season_history,
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
