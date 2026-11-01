# -*- coding: utf-8 -*-
"""把实机截图压成 README 用的 webp。

原始截图是 1440 宽的 PNG，一张 1MB 上下。直接塞进仓库会让 clone 变慢，
README 加载也肉。这里统一转 webp（质量 82），并保持原宽度。
"""
import os
import io
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'shots')

# (源文件, 输出名, 说明)
JOBS = [
    (os.path.join(ROOT, 'shots-v2', 'final.png'),   'main.webp',   1),
    (os.path.join(ROOT, 'shots-v21', 'farm.png'),   'farm.webp',   1),
    (os.path.join(ROOT, 'shots-v2', 'c2.png'),      'crisis.webp', 2),
    (os.path.join(ROOT, 'shots-v22', 'pm.png'),     'review.webp', 2),
    (os.path.join(ROOT, 'shots-v22', 'runs.png'),   'runs.webp',   1),
]

os.makedirs(OUT, exist_ok=True)
total = 0
for src, name, scale in JOBS:
    if not os.path.exists(src):
        print('skip (missing):', src)
        continue
    im = Image.open(src).convert('RGB')
    if scale != 1:
        im = im.resize((im.width * scale, im.height * scale), Image.LANCZOS)
    dst = os.path.join(OUT, name)
    im.save(dst, 'WEBP', quality=82, method=6)
    a, b = os.path.getsize(src), os.path.getsize(dst)
    total += b
    print('%-14s %5.0f KB -> %5.0f KB  %dx%d' % (name, a / 1024, b / 1024, im.width, im.height))
print('合计 %.0f KB' % (total / 1024))
