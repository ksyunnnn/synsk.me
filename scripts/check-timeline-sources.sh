#!/usr/bin/env bash
# /lab/timeline が依存する外部エンドポイントの疎通を検査する。
#
# 各 source が採った取得手段は src/lib/timeline/sources/*.ts の冒頭に根拠を書いた。
# ここで見るのは「その手段がまだ生きているか」だけで、解析結果は見ない。
#
# テストフレームワークを使わないのは、方針が #19 で未決のため。
#
# 使い方: bash scripts/check-timeline-sources.sh
# 終了コード: すべて期待どおりなら 0、1 つでも外れたら 1

set -u

UA='synsk.me (+https://synsk.me)'
failed=0

check() {
  local name="$1" expected="$2" url="$3"
  local actual
  actual=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA" --max-time 15 "$url")
  if [ "$actual" = "$expected" ]; then
    printf '  ok   %-14s %s\n' "$name" "$actual"
  else
    printf '  FAIL %-14s expected %s, got %s\n    %s\n' "$name" "$expected" "$actual" "$url"
    failed=1
  fi
}

echo '取得できる経路'
check zenn        200 'https://zenn.dev/ksyunnnn/feed'
check qiita       200 'https://qiita.com/api/v2/users/ksyunnnn/items?per_page=1'
check devto       200 'https://dev.to/api/articles?username=ksyunnnn&per_page=1'
check medium      200 'https://medium.com/feed/@ksyunnnn'
check github      200 'https://api.github.com/users/ksyunnnn/repos?per_page=1'
check speakerdeck 200 'https://speakerdeck.com/ksyunnnn.rss'
check codesandbox 200 'https://codesandbox.io/embed/2u1kz'
check spotify     200 'https://open.spotify.com/oembed?url=https%3A%2F%2Fopen.spotify.com%2Fplaylist%2F3yLGcn1xFSeBypkFlWfeqj'

echo
echo 'dev.to は User-Agent を要求する'
devto_no_ua=$(curl -s -o /dev/null -w '%{http_code}' -A '' --max-time 15 'https://dev.to/api/articles?username=ksyunnnn&per_page=1')
if [ "$devto_no_ua" = '403' ]; then
  printf '  ok   %-14s %s\n' 'devto (no UA)' "$devto_no_ua"
else
  printf '  FAIL %-14s expected 403, got %s\n' 'devto (no UA)' "$devto_no_ua"
  failed=1
fi

echo
echo '取得できない経路（塞がったままであること）'
check codepen     403 'https://codepen.io/api/oembed?format=json&url=https%3A%2F%2Fcodepen.io%2Faccount%2Fpen%2Fabc'
check connpass-v1 403 'https://connpass.com/api/v1/event/?nickname=ksyunnnn'
check connpass-v2 401 'https://connpass.com/api/v2/users/ksyunnnn/attended_events/'

echo
if [ "$failed" -eq 0 ]; then
  echo 'すべて期待どおり。'
else
  echo '期待から外れた経路がある。src/lib/timeline/sources/ の該当 adapter を見直すこと。'
fi
exit "$failed"
