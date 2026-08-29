#!/usr/bin/env bash
#
# ドキュメント規約のうち、確実に判定できる検査だけを置く。
# 曖昧なものは監査人へ委ね、ここに書かない。
# docs/archive/ は凍結された記録のため、すべての検査から除く。
# .specify/ と .claude/skills/speckit-* は Spec Kit の生成物のため、すべての検査から除く。
# 出力した行はすべて違反である。誤検出を出さないことを優先する。
#
set -u

# 検査から除くパス。値は部分文字列で照合する。追加はここだけ。
EXCLUDE_DIRS="node_modules docs/archive .specify .claude/skills/speckit-"
export EXCLUDE_DIRS
cd "$(git rev-parse --show-toplevel)" || exit 1

found=0
report() { found=1; echo "$1"; }

# --- [リンク切れ] 相対リンクの参照先が存在しない ---
while IFS= read -r line; do
  report "[リンク切れ] $line"
done < <(python3 - <<'PY'
import pathlib, re, os
for p in sorted(pathlib.Path('.').rglob('*.md')):
    if any(d in str(p) for d in os.environ.get('EXCLUDE_DIRS', '').split()):
        continue
    fenced = False
    for i, line in enumerate(p.read_text().split('\n'), 1):
        if line.lstrip().startswith('```'):
            fenced = not fenced
            continue
        if fenced or 'check-ignore' in line:
            continue
        for m in re.finditer(r'\]\(([^)#]+?)(#[^)]*)?\)', line):
            t = m.group(1).strip()
            if t.startswith(('http', 'mailto:')):
                continue
            if not (p.parent / t).exists():
                print(f'{p}:{i} -> {t}')
PY
)

# --- [冒頭宣言] 対象文書の見出し直後に宣言がない ---
for f in docs/REQUIREMENTS.md docs/scraps/*.md; do
  [ -f "$f" ] || continue
  head -6 "$f" | grep -q '^> ' || report "[冒頭宣言] $f"
done

# --- [目次] 100行超の文書に Contents がない ---
for f in docs/*.md docs/scraps/*.md; do
  [ -f "$f" ] || continue
  n=$(wc -l < "$f")
  [ "$n" -le 100 ] && continue
  grep -q '^## Contents' "$f" || report "[目次] $f ($n 行)"
done

# --- [decision-makers] 決定の記録の decision-makers が synsk 以外 ---
while IFS= read -r line; do
  report "[decision-makers] $line"
done < <(grep -n '^decision-makers:' docs/decisions/0*.md 2>/dev/null | grep -v ':decision-makers: synsk$' | grep -v 'check-ignore')

# --- [Issue番号] REQUIREMENTS.md に Issue 番号がある ---
while IFS= read -r line; do
  report "[Issue番号] docs/REQUIREMENTS.md:$line"
done < <(grep -n '#[0-9]' docs/REQUIREMENTS.md 2>/dev/null | grep -v 'check-ignore')

# --- [原則リンク] Decision Drivers が PRINCIPLES.md 全体を指している ---
while IFS= read -r line; do
  report "[原則リンク] $line"
done < <(grep -ln '^decision-makers:' docs/decisions/0*.md 2>/dev/null | xargs -r grep -n '](\.\./PRINCIPLES\.md)' 2>/dev/null | grep -v 'check-ignore')

# --- [MADR] 決定の記録が MADR の構造から外れている ---
while IFS= read -r line; do
  report "[MADR] $line"
done < <(python3 - <<'PY'
import pathlib, re
REQUIRED = ['## Context and Problem Statement', '## Considered Options', '## Decision Outcome']
FORBIDDEN = ['## Confirmation', '## More Information']
STATUS = re.compile(r'^(proposed|rejected|accepted|deprecated|superseded by ADR-\d{4})$')
targets = sorted(pathlib.Path('docs/decisions').glob('0*.md'))
targets.append(pathlib.Path('docs/decisions/template.md'))
for p in targets:
    if not p.exists():
        continue
    text = p.read_text()
    lines = text.split('\n')
    if not lines or lines[0].strip() != '---':
        continue
    is_template = p.name == 'template.md'
    try:
        end = lines.index('---', 1)
    except ValueError:
        print(f'{p}:1 front matter が閉じていない')
        continue
    fm = {}
    for l in lines[1:end]:
        if ':' in l and not l.lstrip().startswith('#'):
            k, _, v = l.partition(':')
            fm[k.strip()] = v.strip().strip('"')
    if is_template:
        pass
    elif 'status' not in fm:
        print(f'{p}:1 status がない')
    elif not STATUS.match(fm['status']):
        print(f'{p}:1 status の値が不正: ' + fm['status'])
    if is_template:
        pass
    elif 'date' not in fm:
        print(f'{p}:1 date がない')
    elif not re.match(r'^\d{4}-\d{2}-\d{2}$', fm['date']):
        print(f'{p}:1 date が YYYY-MM-DD でない: ' + fm['date'])
    for s in REQUIRED:
        if s not in text:
            print(f'{p}:1 必須節がない: {s}')
    for s in FORBIDDEN:
        if s in text:
            print(f'{p}:1 使わない節がある: {s}')
    if is_template:
        continue
    for i, l in enumerate(lines[end+1:], end+2):
        if l.startswith('# '):
            if re.match(r'^# (ADR-)?\d+[:.]', l):
                print(f'{p}:{i} 見出しに番号がある')
            break
PY
)

# --- [用語] REQUIREMENTS.md に固定していない語がある ---
while IFS= read -r line; do
  report "[用語] docs/REQUIREMENTS.md:$line"
done < <(grep -n 'エントリ\|レコード\|記事' docs/REQUIREMENTS.md 2>/dev/null | grep -v 'check-ignore')

# --- [参照の向き] 変わりにくい側から変わりやすい側へのリンクがある ---
while IFS= read -r line; do
  report "[参照の向き] $line"
done < <(python3 - <<'PY'
import pathlib, re, os

EXCLUDE = os.environ.get('EXCLUDE_DIRS', '').split()
ORDER = ['REQUIREMENTS.md', 'decisions', 'PRINCIPLES.md', 'VISION.md']

def rank(path):
    s = str(path)
    for i, name in enumerate(ORDER):
        if name in s:
            return i
    return -1

for p in sorted(pathlib.Path('docs').rglob('*.md')):
    if any(d in str(p) for d in EXCLUDE) or p.name == 'README.md':
        continue
    src = rank(p)
    if src < 0:
        continue
    fenced = False
    for i, line in enumerate(p.read_text().split('\n'), 1):
        if line.lstrip().startswith('```'):
            fenced = not fenced
            continue
        if fenced or 'check-ignore' in line:
            continue
        for m in re.finditer(r'\]\(([^)#]+?)(#[^)]*)?\)', line):
            t = m.group(1).strip()
            if t.startswith(('http', 'mailto:')):
                continue
            dst = rank((p.parent / t).resolve())
            if dst >= 0 and dst < src:
                print(f'{p}:{i} -> {t}')
PY
)

[ "$found" -eq 0 ] && echo "検出なし（9項目すべて）"
exit 0
