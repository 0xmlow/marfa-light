#!/usr/bin/env python3
"""Pictures for the holders page, after tools/holders.mjs.

  python3 tools/holders-media.py

proposal-site/holders/pfp/<id>.jpg   each honorary NEW YORKERS portrait a holder has, 240 px
proposal-site/tokens/1/s/<id>.jpg    a still of each rendered token, the afternoon frame of its day GIF, 360 px

Only missing files are made, so it is cheap to run every hour.
"""
import json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HON = '/Users/degens/Desktop/NEW YORKERS BY MLOW/NEW YORKERS SITE/assets/honoraries'
data = json.load(open(os.path.join(ROOT, 'proposal-site/data/holders.json')))
pfp_dir = os.path.join(ROOT, 'proposal-site/holders/pfp')
still_dir = os.path.join(ROOT, 'proposal-site/tokens/1/s')
os.makedirs(pfp_dir, exist_ok=True); os.makedirs(still_dir, exist_ok=True)

made = 0
for h in data['holders']:
    hon = h.get('honorary')
    if not hon: continue
    out = os.path.join(pfp_dir, hon['id'] + '.jpg')
    src = os.path.join(HON, hon['src'])
    if os.path.exists(out) or not os.path.exists(src): continue
    im = Image.open(src).convert('RGB'); s = min(im.size)
    im = im.crop(((im.width - s) // 2, 0, (im.width - s) // 2 + s, s)).resize((240, 240), Image.LANCZOS)
    im.save(out, quality=84, optimize=True, progressive=True); made += 1

for t in data['tokens']:
    if not t['rendered']: continue
    out = os.path.join(still_dir, f"{t['id']}.jpg")
    gif = os.path.join(ROOT, f"proposal-site/tokens/1/{t['id']}.gif")
    if os.path.exists(out) or not os.path.exists(gif): continue
    im = Image.open(gif)
    # the day GIF runs midnight to midnight; frame 30 of 48 is mid afternoon, long shadows, warm light
    im.seek(min(30, im.n_frames - 1) if im.n_frames > 30 else im.n_frames // 2)
    im.convert('RGB').resize((360, 360), Image.LANCZOS).save(out, quality=82, optimize=True, progressive=True); made += 1

print(f'{made} picture(s) written')
