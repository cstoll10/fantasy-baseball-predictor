from pybaseball import batting_stats
import os
os.makedirs("data/raw", exist_ok=True)
df = batting_stats(2025, 2025, qual=20)
df.to_csv("data/raw/hitters_2025.csv", index=False)
print(f"Fetched {len(df)} 2025 players")
