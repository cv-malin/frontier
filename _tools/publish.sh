#!/usr/bin/env bash
# 发布到 GitHub：建库 -> 标准 git push -> 打 tag -> 建 Release 传 zip -> 开 Pages
#
# 推代码全程走 `git push`，不做逐文件 API 写入。API 只用在三件 git 协议
# 干不了的事上：建仓库、建 Release、开 Pages。
#
# 用法：
#   GITHUB_TOKEN=ghp_xxx ./_tools/publish.sh
#   GITHUB_TOKEN=ghp_xxx REPO_NAME=frontier VISIBILITY=private ./_tools/publish.sh
#
# 可选环境变量：
#   REPO_NAME    仓库名，默认 frontier
#   VISIBILITY   public / private，默认 public
#   PAGES        设为 0 跳过开 Pages，默认开
#   VERSION      版本号，默认从 _tools/pack.py 读

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API="https://api.github.com"

TOKEN="${GITHUB_TOKEN:-}"
REPO_NAME="${REPO_NAME:-frontier}"
VISIBILITY="${VISIBILITY:-public}"
PAGES="${PAGES:-1}"
OWNER="${GITHUB_OWNER:-cv-malin}"

die() { echo "错误: $*" >&2; exit 1; }
say() { echo "==> $*"; }

command -v curl >/dev/null || die "找不到 curl"
command -v python >/dev/null || die "找不到 python"

# 没给 GITHUB_TOKEN 时，试着从 git 凭据管理器取
# （_tools/github-login.bat 用设备码登录后，GCM 会把 OAuth token 存在这里）
if [ -z "$TOKEN" ]; then
  say "没有 GITHUB_TOKEN，尝试从 git 凭据管理器读取"
  TOKEN="$(printf 'protocol=https\nhost=github.com\n\n' \
    | timeout 15 git credential fill 2>/dev/null \
    | sed -n 's/^password=//p' | tr -d '\r' | head -1)"
fi

[ -n "$TOKEN" ] || die "拿不到凭据。二选一：
  1) 双击 _tools/github-login.bat 完成一次设备码登录（不需要建 token）
  2) 建一个 PAT（勾 repo 权限），然后：
     GITHUB_TOKEN=ghp_xxx ./_tools/publish.sh"

VERSION="${VERSION:-$(sed -n "s/^VERSION = '\(.*\)'/\1/p" _tools/pack.py | head -1)}"
[ -n "$VERSION" ] || die "读不到版本号，检查 _tools/pack.py 里的 VERSION"
TAG="v$VERSION"
ZIP="dist/frontier-$TAG.zip"

# 所有 API 调用都走这个函数：token 只在本进程环境里，不落盘
api() {
  local method="$1" path="$2"
  shift 2
  curl -sS -X "$method" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "$@" "$API$path"
}

# 从 JSON 里取一个顶层字符串字段
jget() {
  python -c "
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(1)
v = d
for k in sys.argv[1].split('.'):
    if not isinstance(v, dict) or k not in v:
        sys.exit(1)
    v = v[k]
print(v if not isinstance(v, bool) else str(v).lower())
" "$1"
}

# ---------- 0. 预检 ----------
say "版本 $TAG，仓库 $REPO_NAME（$VISIBILITY）"

if [ -n "$(git status --porcelain)" ]; then
  die "工作区有未提交的改动。先 commit，再发布。"
fi

[ -f "$ZIP" ] || { say "发行包不存在，先打包"; python _tools/pack.py; }

# ---------- 1. 身份 ----------
say "确认账号"
ME="$(api GET /user)"
LOGIN="$(printf '%s' "$ME" | jget login)" || die "token 无效，或没有读账号的权限"
echo "    token 属于: $LOGIN"

# 目标账号得和 token 的主人一致，否则会把仓库建到别人名下
if [ "$LOGIN" != "$OWNER" ]; then
  die "token 属于 $LOGIN，但目标是 $OWNER。
  想推到 $LOGIN 名下就加 GITHUB_OWNER=$LOGIN，或者换一个 $OWNER 的 token。"
fi
FULL="$OWNER/$REPO_NAME"

# ---------- 2. 建仓库（已存在就复用） ----------
say "检查远程仓库 $FULL"
CODE="$(curl -sS -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
  "$API/repos/$FULL")"

if [ "$CODE" = "404" ]; then
  say "创建仓库 $FULL"
  BODY="$(python -c "
import json, sys
print(json.dumps({
    'name': sys.argv[1],
    'description': '边陲 · FRONTIER — 12 天的边陲营地生存模拟。原生 JS + Canvas，零依赖。',
    'private': sys.argv[2] == 'private',
    'has_issues': True,
    'has_wiki': False,
    'auto_init': False,
}))
" "$REPO_NAME" "$VISIBILITY")"
  RES="$(api POST /user/repos -H 'Content-Type: application/json' -d "$BODY")"
  printf '%s' "$RES" | jget id >/dev/null || { echo "$RES" | head -20; die "建库失败"; }
elif [ "$CODE" = "200" ]; then
  say "仓库已存在，直接推"
else
  die "访问 $FULL 返回 HTTP $CODE，检查 token 权限"
fi

# ---------- 3. 标准 git push ----------
say "推送分支（master -> main）"
git branch -M main 2>/dev/null || true
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$FULL.git"

# 凭据只走本次命令的临时 header，不写进 .git/config。
# 注意：GitHub 的 git 端点认 Basic，不认 Bearer —— 用 Bearer 会返回
# "remote: invalid credentials"，而 API 端点恰好相反。两边别搞混。
BASIC="$(printf 'x-access-token:%s' "$TOKEN" | base64 | tr -d '\r\n')"
GIT_AUTH=(-c "http.https://github.com/.extraheader=Authorization: Basic $BASIC")

git "${GIT_AUTH[@]}" push -u origin main

say "推送 tag $TAG"
git tag -f "$TAG" -m "边陲 $TAG"
git "${GIT_AUTH[@]}" push -f origin "refs/tags/$TAG"

# ---------- 4. Release ----------
say "创建 Release $TAG"
# 注意：这段 python 代码外面包的是双引号，所以里面**不能出现反引号** ——
# shell 会把它当命令替换先执行掉，Release 描述里就只剩两个空格。
REL_BODY="$(python -c "
import json, sys
print(json.dumps({
    'tag_name': sys.argv[1],
    'name': '边陲 ' + sys.argv[1],
    'body': '## 下载\n\n解压后双击 index.html 即可开玩，无需安装任何环境。\n\n'
            '## 这一版\n\n'
            '完整的农业线、决策层与复盘系统。详细设计见仓库 docs/prd/ 目录。\n',
    'draft': False,
    'prerelease': False,
}))" "$TAG")"

REL="$(api POST "/repos/$FULL/releases" -H 'Content-Type: application/json' -d "$REL_BODY")"
REL_ID="$(printf '%s' "$REL" | jget id)" || {
  echo "$REL" | head -20
  say "创建 Release 失败（可能已存在同名 tag 的 Release）"
  REL="$(api GET "/repos/$FULL/releases/tags/$TAG")"
  REL_ID="$(printf '%s' "$REL" | jget id)" || die "拿不到 Release"
}

say "上传发行包 $(basename "$ZIP")"
UP_URL="https://uploads.github.com/repos/$FULL/releases/$REL_ID/assets"
UP="$(curl -sS -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/zip" \
  --data-binary "@$ZIP" \
  "$UP_URL?name=$(basename "$ZIP")")"
DL="$(printf '%s' "$UP" | jget browser_download_url)" || { echo "$UP" | head -20; die "上传失败"; }
echo "    下载地址: $DL"

# ---------- 5. Pages ----------
if [ "$PAGES" != "0" ]; then
  say "开启 GitHub Pages（main 分支根目录）"
  api POST "/repos/$FULL/pages" -H 'Content-Type: application/json' \
    -d '{"source":{"branch":"main","path":"/"},"build_type":"legacy"}' >/dev/null 2>&1 || \
  api PUT "/repos/$FULL/pages" -H 'Content-Type: application/json' \
    -d '{"source":{"branch":"main","path":"/"},"build_type":"legacy"}' >/dev/null 2>&1 || \
  say "Pages 开启失败（可能需要在仓库 Settings 里手动授权一次）"
fi

# ---------- 收尾 ----------
PAGES_URL="https://$OWNER.github.io/$REPO_NAME/"

echo
echo "────────────────────────────────────────────"
echo "仓库:   https://github.com/$FULL"
echo "下载:   $DL"
echo "在线玩: $PAGES_URL  （首次部署约 1 分钟生效）"
echo "────────────────────────────────────────────"
echo
echo "token 没有写进 .git/config，检查一下："
echo "    git remote -v    # 应该是纯 https://github.com/... 不带任何凭据"
