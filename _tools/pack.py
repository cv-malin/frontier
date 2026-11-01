# -*- coding: utf-8 -*-
"""打发行包：生成 dist/frontier-<version>.zip，解压即玩。

只装玩家需要的东西。_tools/ 是开发工具，docs/shots 是 README 配图，
shots-v*/ 是历史截图，都不进包。

用法：
    python _tools/pack.py
"""
import os
import io
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')

VERSION = '2.2'
PKG = 'frontier-v%s' % VERSION

# 逐项列出来，不用通配 —— 通配最容易把临时目录带进包里。
FILES = [
    'index.html',
    'README.md',
    'LICENSE',
]

DIRS = [
    'js',
]

# 设计文档只带最新一版，历史 PRD 留给仓库
EXTRA = [
    os.path.join('docs', 'prd', 'PRD-边陲-v%s.html' % VERSION),
]

# zip 里的时间戳固定，同一个版本重复打包出来的字节一致，方便比对
FIXED_DATE = (2026, 1, 1, 0, 0, 0)


def add(zf, path, arc):
    zi = zipfile.ZipInfo(arc, FIXED_DATE)
    zi.compress_type = zipfile.ZIP_DEFLATED
    zi.external_attr = 0o644 << 16
    with io.open(path, 'rb') as f:
        zf.writestr(zi, f.read())


def main():
    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, PKG + '.zip')
    n = 0
    missing = []

    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for name in FILES:
            p = os.path.join(ROOT, name)
            if not os.path.exists(p):
                missing.append(name)
                continue
            add(zf, p, '%s/%s' % (PKG, name))
            n += 1

        for d in DIRS:
            base = os.path.join(ROOT, d)
            for fn in sorted(os.listdir(base)):
                if not fn.endswith('.js'):
                    continue
                add(zf, os.path.join(base, fn), '%s/%s/%s' % (PKG, d, fn))
                n += 1

        for rel in EXTRA:
            p = os.path.join(ROOT, rel)
            if not os.path.exists(p):
                missing.append(rel)
                continue
            add(zf, p, '%s/%s' % (PKG, rel.replace(os.sep, '/')))
            n += 1

    size = os.path.getsize(out)
    print('打包完成: %s' % out)
    print('  %d 个文件, %.1f KB' % (n, size / 1024))
    if missing:
        print('  缺失（已跳过）: %s' % ', '.join(missing))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
