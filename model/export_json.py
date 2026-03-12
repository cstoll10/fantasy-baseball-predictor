import pandas as pd
import json
import os

os.makedirs("public", exist_ok=True)

df = pd.read_csv('data/projections_hitters.csv')
df = df.where(pd.notna(df), None)

POSITIONS = {
    'Aaron Judge': 'OF', 'Juan Soto': 'OF', 'Shohei Ohtani': 'DH',
    'Yordan Alvarez': 'DH', 'Ronald Acuna Jr.': 'OF', 'Vladimir Guerrero Jr.': '1B',
    'Marcell Ozuna': 'DH', 'Corey Seager': 'SS', 'Mike Trout': 'OF',
    'Kyle Tucker': 'OF', 'Freddie Freeman': '1B', 'Bobby Witt Jr.': 'SS',
    'Mookie Betts': 'OF', 'Fernando Tatis Jr.': 'OF', 'Kyle Schwarber': '1B',
    'Bryce Harper': '1B', 'Rafael Devers': '3B', 'Jackson Merrill': 'OF',
    'Kyle Tucker': 'OF', 'Jose Ramirez': '3B', 'Gunnar Henderson': 'SS',
    'Elly De La Cruz': 'SS', 'Francisco Lindor': 'SS', 'Julio Rodriguez': 'OF',
}

POSITION_REPLACEMENTS = {
    'C': 0.310, '1B': 0.345, '2B': 0.330, 'SS': 0.330,
    '3B': 0.335, 'OF': 0.320, 'DH': 0.340,
}

df['position'] = df['Name'].map(POSITIONS).fillna('OF')
df['replacement_xwOBA'] = df['position'].map(POSITION_REPLACEMENTS).fillna(0.320)
df['VORP'] = ((df['xwOBA'] - df['replacement_xwOBA']) * df['proj_PA'] * 1.15).round(1)

def assign_tier(vorp):
    if vorp >= 40: return 1
    if vorp >= 25: return 2
    if vorp >= 12: return 3
    if vorp >= 0:  return 4
    return 5

df['tier'] = df['VORP'].apply(assign_tier)

players = []
for _, row in df.iterrows():
    players.append({
        'id': int(row['IDfg']) if row['IDfg'] else None,
        'name': row['Name'],
        'age': int(row['Age']) if row['Age'] else None,
        'team': row['Team'],
        'position': row['position'],
        'tier': int(row['tier']),
        'projections': {
            'PA': int(row['proj_PA']) if row['proj_PA'] else None,
            'HR': round(float(row['HR']), 1) if row['HR'] else None,
            'RBI': round(float(row['RBI']), 1) if row['RBI'] else None,
            'R': round(float(row['R']), 1) if row['R'] else None,
            'SB': round(float(row['SB']), 1) if row['SB'] else None,
            'AVG': round(float(row['AVG']), 3) if row['AVG'] else None,
            'OBP': round(float(row['OBP']), 3) if row['OBP'] else None,
            'xwOBA': round(float(row['xwOBA']), 4) if row['xwOBA'] else None,
        },
        'skills': {
            'HardHit%': round(float(row['HardHit%']), 1) if row['HardHit%'] else None,
            'Barrel%': round(float(row['Barrel%']), 1) if row['Barrel%'] else None,
            'K%': round(float(row['K%']), 1) if row['K%'] else None,
            'BB%': round(float(row['BB%']), 1) if row['BB%'] else None,
            'SwStr%': round(float(row['SwStr%']), 1) if row['SwStr%'] else None,
            'BABIP': round(float(row['BABIP']), 3) if row['BABIP'] else None,
        },
        'VORP': round(float(row['VORP']), 1) if row['VORP'] else None,
    })

with open('public/players.json', 'w') as f:
    json.dump({'players': players, 'generated': pd.Timestamp.now().isoformat()}, f, indent=2)

print(f"Exported {len(players)} players to public/players.json")
top = sorted(players, key=lambda x: x['VORP'] or 0, reverse=True)[:10]
for i, p in enumerate(top, 1):
    print(f"  {i}. {p['name']} ({p['position']}, Tier {p['tier']}) — VORP: {p['VORP']}")
