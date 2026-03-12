import pandas as pd
import numpy as np

HITTER_SKILLS = [
    'xwOBA', 'xSLG', 'xBA', 'Barrel%', 'HardHit%',
    'K%', 'BB%', 'BABIP', 'SwStr%', 'wRC+',
    'HR/FB', 'GB%', 'FB%', 'Pull%', 'Spd'
]

HITTER_COUNTING = ['HR', 'RBI', 'R', 'SB', 'AVG', 'OBP', 'SLG', 'wOBA']

WEIGHTS = {2024: 5, 2023: 3, 2022: 1}

def age_adjustment(age, stat_type='power'):
    peak = 27 if stat_type == 'power' else 26
    delta = age - peak
    if stat_type == 'speed':
        return max(0.6, 1.0 - 0.04 * max(0, delta))
    return max(0.7, 1.0 - 0.02 * abs(delta) * (1 if delta > 0 else 0.5))

def build_projections(csv_path='data/raw/hitters.csv'):
    df = pd.read_csv(csv_path)
    df = df[df['PA'] >= 100].copy()

    all_cols = HITTER_SKILLS + HITTER_COUNTING + ['Name', 'IDfg', 'Season', 'Age', 'Team', 'G', 'PA', 'AB']
    available = [c for c in all_cols if c in df.columns]
    df = df[available].copy()

    df['weight'] = df['Season'].map(WEIGHTS).fillna(0)
    projections = []

    for player_id, group in df.groupby('IDfg'):
        group = group[group['weight'] > 0].copy()
        if group.empty:
            continue

        latest = group.sort_values('Season').iloc[-1]
        name = latest['Name']
        age = latest['Age'] + 1
        team = latest['Team']
        total_weight = group['weight'].sum()

        proj = {'Name': name, 'IDfg': player_id, 'Age': age, 'Team': team}

        skill_cols = [c for c in HITTER_SKILLS if c in group.columns]
        for col in skill_cols:
            valid = group[group[col].notna()]
            if valid.empty:
                proj[col] = np.nan
                continue
            w = valid['weight'] * valid['PA']
            proj[col] = round((valid[col] * w).sum() / w.sum(), 4)

        count_cols = [c for c in HITTER_COUNTING if c in group.columns]
        avg_pa = (group['PA'] * group['weight']).sum() / total_weight
        for col in count_cols:
            valid = group[group[col].notna()]
            if valid.empty:
                proj[col] = np.nan
                continue
            w = valid['weight'] * valid['PA']
            val = (valid[col] * w).sum() / w.sum()
            if col == 'HR':
                val *= age_adjustment(age, 'power')
            elif col == 'SB':
                val *= age_adjustment(age, 'speed')
            proj[col] = round(val, 3)

        proj['proj_PA'] = round(avg_pa)
        projections.append(proj)

    result = pd.DataFrame(projections)

    if 'xwOBA' in result.columns:
        result['xwOBA_rank'] = result['xwOBA'].rank(ascending=False)

    result = result.sort_values('xwOBA', ascending=False).reset_index(drop=True)
    result.to_csv('data/projections_hitters.csv', index=False)
    print(f"Built projections for {len(result)} hitters")
    return result

if __name__ == '__main__':
    df = build_projections()
    print(df[['Name', 'Age', 'Team', 'xwOBA', 'HR', 'RBI', 'R', 'SB', 'AVG', 'proj_PA']].head(20).to_string())
