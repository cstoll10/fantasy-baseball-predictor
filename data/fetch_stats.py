import pandas as pd
from pybaseball import batting_stats, pitching_stats
import os

os.makedirs("data/raw", exist_ok=True)

print("Fetching hitter stats (2022-2024)...")
hitters = batting_stats(2022, 2024, qual=150)
hitters.to_csv("data/raw/hitters.csv", index=False)
print(f"Saved {len(hitters)} hitter seasons to data/raw/hitters.csv")

print("Fetching pitcher stats (2022-2024)...")
pitchers = pitching_stats(2022, 2024, qual=50)
pitchers.to_csv("data/raw/pitchers.csv", index=False)
print(f"Saved {len(pitchers)} pitcher seasons to data/raw/pitchers.csv")

print("Done.")
