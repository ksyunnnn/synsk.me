#!/usr/bin/env bash
#
# ドキュメント規約のうち、確実に判定できる検査だけを置く。
# 曖昧なものは監査人へ委ね、ここに書かない。
# docs/research/archive/ は凍結された記録のため、すべての検査から除く。
# 出力した行はすべて違反である。誤検出を出さないことを優先する。
#
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1

found=0
report() { found=1; echo "$1"; }

# --- [リンク切れ] 相対リンクの参照先が存在しない ---
while IFS= read -r line; do
  report "[リンク切れ] $line"
done < <(python3 - <<'PY'
import pathlib, re
for p in sorted(pathlib.Path('.').rglob('*.md')):
    if 'node_modules' in str(p) or 'docs/research/archive' in str(p):
        continue
    for i, line in enumerate(p.read_text().split('\n'), 1):
        for m in re.finditer(r'\]\(([^)#]+?)(#[^)]*)?\)', line):
            t = m.group(1).strip()
            if t.startswith(('http', 'mailto:')):
                continue
            if not (p.parent / t).exists():
                print(f'{p}:{i} -> {t}')
PY
)

# --- [冒頭宣言] 対象文書の見出し直後に宣言がない ---
for f in docs/REQUIREMENTS.md docs/adr/0*.md docs/research/*.md docs/scraps/*.md; do
  [ -f "$f" ] || continue
  head -6 "$f" | grep -q '^> ' || report "[冒頭宣言] $f"
done

# --- [目次] 100行超の research に Contents がない ---
for f in docs/research/*.md; do
  [ -f "$f" ] || continue
  n=$(wc -l < "$f")
  [ "$n" -le 100 ] && continue
  grep -q '^## Contents' "$f" || report "[目次] $f ($n 行)"
done

# --- [Deciders] ADR の Deciders が synsk 以外 ---
while IFS= read -r line; do
  report "[Deciders] $line"
done < <(grep -n '^- \*\*Deciders\*\*' docs/adr/*.md 2>/dev/null | grep -v ':- \*\*Deciders\*\*: synsk$')

# --- [Issue番号] REQUIREMENTS.md に Issue 番号がある ---
while IFS= read -r line; do
  report "[Issue番号] docs/REQUIREMENTS.md:$line"
done < <(grep -n '#[0-9]' docs/REQUIREMENTS.md 2>/dev/null)

# --- [ADR禁止節] Implementation Notes / 未確定事項 の節がある ---
while IFS= read -r line; do
  report "[ADR禁止節] $line"
done < <(grep -n '^## Implementation Notes\|^#\+ 未確定事項\|^#\+ 未決事項' docs/adr/0*.md 2>/dev/null)

[ "$found" -eq 0 ] && echo "検出なし（6項目すべて）"
exit 0
