#!/usr/bin/env bash
# 外部プラットフォームの経路を1つずつ叩き、返る状態を表にする。
#
# docs/sources/ の各ファイルが持つ「経路」の値は、このスクリプトの出力である。
# 出力と記録が食い違えば、外部側が変わったと分かる。
#
# 期待する状態も併せて検査する。すべて期待どおりなら終了コード 0、
# 1 つでも外れたら 1 を返す。
#
# 使い方: bash scripts/probe-sources.sh

set -u

UA='synsk.me (+https://synsk.me)'
DATE=$(date -u +%Y-%m-%d)
failed=0

probe() {
  local platform="$1" route="$2" expected="$3" url="$4" counter="${5:-}"
  local body code count='-' mark='ok'
  body=$(mktemp)
  code=$(curl -s -o "$body" -w '%{http_code}' -A "$UA" -L --max-time 20 "$url")
  if [ "$code" = "200" ] && [ -n "$counter" ]; then
    count=$(eval "$counter" < "$body" 2>/dev/null || echo '-')
  fi
  if [ "$code" != "$expected" ]; then
    mark="FAIL(期待 $expected)"
    failed=1
  fi
  printf '%-14s %-22s %-5s %-6s %-6s %s\n' "$platform" "$route" "$code" "$count" "$DATE" "$mark"
  rm -f "$body"
}

printf '%-14s %-22s %-5s %-6s %-6s %s\n' 'PLATFORM' 'ROUTE' 'HTTP' 'COUNT' 'DATE' 'CHECK'
printf '%-14s %-22s %-5s %-6s %-6s %s\n' '--------' '-----' '----' '-----' '----' '-----'

probe zenn        'RSS'             200 'https://zenn.dev/ksyunnnn/feed' \
  "grep -c '<item>'"
probe qiita       'REST (official)' 200 'https://qiita.com/api/v2/users/ksyunnnn/items?per_page=10' \
  "python3 -c 'import sys,json;print(len(json.load(sys.stdin)))'"
probe devto       'REST (official)' 200 'https://dev.to/api/articles?username=ksyunnnn&per_page=10' \
  "python3 -c 'import sys,json;print(len(json.load(sys.stdin)))'"
probe medium      'RSS'             200 'https://medium.com/feed/@ksyunnnn' \
  "grep -c '<item>'"
probe github      'REST (official)' 200 'https://api.github.com/users/ksyunnnn/repos?sort=pushed&per_page=30' \
  "python3 -c 'import sys,json;print(len(json.load(sys.stdin)))'"
probe speakerdeck 'RSS'             200 'https://speakerdeck.com/ksyunnnn.rss' \
  "grep -c '<item>'"
probe codesandbox 'HTML og:meta'    200 'https://codesandbox.io/embed/2u1kz' \
  "grep -c 'og:title'"
probe spotify     'oEmbed'          200 'https://open.spotify.com/oembed?url=https%3A%2F%2Fopen.spotify.com%2Fplaylist%2F3yLGcn1xFSeBypkFlWfeqj' \
  "python3 -c 'import sys,json;json.load(sys.stdin);print(1)'"
probe x           'oEmbed'          200 'https://publish.x.com/oembed?url=https%3A%2F%2Ftwitter.com%2Fksyunnnn%2Fstatus%2F2019011393044058438&omit_script=1' \
  "python3 -c 'import sys,json;json.load(sys.stdin);print(1)'"

echo
echo '# 塞がっている経路。この状態が変われば記録を見直す。'
probe codepen     'oEmbed'            403 'https://codepen.io/api/oembed?format=json&url=https%3A%2F%2Fcodepen.io%2Fksyunnnn%2Fpen%2FLYwzYEE'
probe connpass    'REST v2 (no key)'  401 'https://connpass.com/api/v2/users/ksyunnnn/attended_events/'
probe connpass    'REST v1 (retired)' 403 'https://connpass.com/api/v1/event/?nickname=ksyunnnn'
probe techplay    'user page'         404 'https://techplay.jp/user/ksyunnnn'

echo
echo '# User-Agent への依存'
ua_none=$(curl -s -o /dev/null -w '%{http_code}' -A '' --max-time 20 'https://dev.to/api/articles?username=ksyunnnn&per_page=1')
if [ "$ua_none" = '403' ]; then
  printf '%-14s %-22s %-5s %-6s %-6s %s\n' 'devto' 'UA なし' "$ua_none" '-' "$DATE" 'ok'
else
  printf '%-14s %-22s %-5s %-6s %-6s %s\n' 'devto' 'UA なし' "$ua_none" '-' "$DATE" 'FAIL(期待 403)'
  failed=1
fi

echo
echo '# 認証で変わるもの'
echo 'QIITA_ACCESS_TOKEN  Qiita     60 req/h/IP -> 1,000 req/h'
echo 'GITHUB_TOKEN        GitHub    60 req/h/IP -> 5,000 req/h'
echo 'CONNPASS_API_KEY    connpass  401 -> 200'

echo
if [ "$failed" -eq 0 ]; then
  echo 'すべて期待どおり。'
else
  echo '期待から外れた経路がある。docs/sources/ の該当ファイルを見直すこと。'
fi
exit "$failed"
