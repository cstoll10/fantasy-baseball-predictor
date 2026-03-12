import pandas as pd
import numpy as np
from pybaseball import fielding_stats

def get_pos_map():
    print("Fetching fielding data...")
    fielding = fielding_stats(2023, 2024, qual=1)
    POS_PRIORITY = ['C', 'SS', '2B', '3B', 'OF', '1B', 'DH']

    def normalize_pos(p):
        if not isinstance(p, str): return None
        p = p.strip().upper()
        if p in ('LF', 'RF', 'CF'): return 'OF'
        if p in ('C', 'SS', '2B', '3B', '1B', 'DH', 'OF'): return p
        return None

    # Require minimum games to count as primary position
    min_games_col = next((c for c in fielding.columns if c in ('G', 'Games')), None)

    pos_map = {}
    for _, row in fielding.iterrows():
        name = row['Name']
        pos = normalize_pos(str(row.get('Pos', '')))
        if pos is None:
            continue
        # Skip if fewer than 20 games at this position
        if min_games_col and row.get(min_games_col, 0) < 20:
            continue
        if name not in pos_map:
            pos_map[name] = pos
        else:
            cur = POS_PRIORITY.index(pos_map[name]) if pos_map[name] in POS_PRIORITY else 99
            new = POS_PRIORITY.index(pos) if pos in POS_PRIORITY else 99
            if new < cur:
                pos_map[name] = pos

    # Manual overrides for known misassignments
    OVERRIDES = {
        'Vladimir Guerrero Jr.': '1B',
        'Mookie Betts': '2B',
        'Shohei Ohtani': 'DH',
        'Marcell Ozuna': 'DH',
        'Yordan Alvarez': 'DH',
        'J.D. Martinez': 'DH',
        'Nelson Cruz': 'DH',
    }
    pos_map.update(OVERRIDES)
    return pos_map

def calculate_replacements(df, pos_map, league_size=12):
    df = df.copy()
    df['position'] = df['Name'].map(pos_map).fillna('OF')
    qualified = df[(df['Season'] == 2024) & (df['PA'] >= 250)].copy()

    ROSTER = {'C': 1, 'SS': 1, '2B': 1, '3B': 1, '1B': 1, 'OF': 3}

    replacements = {}
    cliffs = {}

    for pos, slots in ROSTER.items():
        cutoff = slots * league_size + 2
        pos_df = qualified[qualified['position'] == pos].sort_values('xwOBA', ascending=False)
        if len(pos_df) >= cutoff:
            replacements[pos] = round(pos_df.iloc[cutoff - 1]['xwOBA'], 3)
            starter_avg = pos_df.head(slots * league_size)['xwOBA'].mean()
            cliffs[pos] = round(starter_avg - replacements[pos], 4)
        elif len(pos_df) > 0:
            replacements[pos] = round(pos_df['xwOBA'].median(), 3)
            cliffs[pos] = round(pos_df['xwOBA'].std(), 4)
        else:
            replacements[pos] = 0.310
            cliffs[pos] = 0.025

    replacements['DH'] = replacements.get('1B', 0.315)
    cliffs['DH'] = cliffs.get('1B', 0.025)

    # Normalize cliffs to 0.95 - 1.20 range (tighter to avoid over-inflation)
    max_cliff = max(cliffs.values())
    min_cliff = min(cliffs.values())
    scarcity = {}
    for pos in list(ROSTER.keys()) + ['DH']:
        if max_cliff > min_cliff:
            normalized = (cliffs[pos] - min_cliff) / (max_cliff - min_cliff)
        else:
            normalized = 0.5
        scarcity[pos] = round(0.95 + normalized * 0.25, 3)

    print(f"\n  {'Pos':<4} {'Replacement':>12} {'Cliff':>8} {'Scarcity':>10}")
    print("  " + "-" * 38)
    for pos in ['C', 'SS', '2B', '3B', '1B', 'OF', 'DH']:
        print(f"  {pos:<4} {replacements[pos]:>12.3f} {cliffs[pos]:>8.4f} {scarcity[pos]:>10.3f}")

    return replacements, scarcity, pos_map

if __name__ == '__main__':
    df = pd.read_csv('data/raw/hitters.csv')
    pos_map = get_pos_map()
    calculate_replacements(df, pos_map)
