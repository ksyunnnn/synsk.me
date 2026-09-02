#!/usr/bin/env bash
# 外部プラットフォームの経路を1つずつ叩き、いま何が返るかを表にする。
#
# docs/sources/ に書かれた「経路」の値は、このスクリプトの出力である。
# 記録が古くなったかどうかは、これを実行して差分を見れば分かる。
#
# 使い方: bash scripts/probe-sources.sh
# 出力: プラットフォーム / 経路 / HTTP / 件数 / 実行日

set -u

UA='synsk.me (+https://synsk.me)'
DATE=$(date -u +%Y-%m-%d)

probe() {
  local platform="$1" route="$2" url="$3" counter="${4:-}"
  local body code count='-'
  body=$(mktemp)
  code=$(curl -s -o "$body" -w '%{http_code}' -A "$UA" -L --max-time 20 "$url")
  if [ "$code" = "200" ] && [ -n "$counter" ]; then
    count=$(eval "$counter" < "$body" 2>/dev/null || echo '-')
  fi
  printf '%-14s %-22s %-5s %-6s %s\n' "$platform" "$route" "$code" "$count" "$DATE"
  rm -f "$body"
}

printf '%-14s %-22s %-5s %-6s %s\n' 'PLATFORM' 'ROUTE' 'HTTP' 'COUNT' 'DATE'
printf '%-14s %-22s %-5s %-6s %s\n' '--------' '-----' '----' '-----' '----'

probe zenn        'RSS'                 'https://zenn.dev/ksyunnnn/feed' \
  "grep -c '<item>'"
probe qiita       'REST (official)'          'https://qiita.com/api/v2/users/ksyunnnn/items?per_page=100' \
  "python3 -c 'import sys,json;print(len(json.load(sys.stdin)))'"
probe devto       'REST (official)'        'https://dev.to/api/articles?username=ksyunnnn&per_page=100' \
  "python3 -c 'import sys,json;print(len(json.load(sys.stdin)))'"
probe medium      'RSS'                 'https://medium.com/feed/@ksyunnnn' \
  "grep -c '<item>'"
probe github      'REST (official)'        'https://api.github.com/users/ksyunnnn/repos?per_page=100' \
  "python3 -c 'import sys,json;print(len(json.load(sys.stdin)))'"
probe speakerdeck 'RSS'                 'https://speakerdeck.com/ksyunnnn.rss' \
  "grep -c '<item>'"
probe codesandbox 'HTML og:meta' 'https://codesandbox.io/embed/2u1kz' \
  "grep -c 'og:title'"
probe spotify     'oEmbed'              'https://open.spotify.com/oembed?url=https%3A%2F%2Fopen.spotify.com%2Fplaylist%2F3yLGcn1xFSeBypkFlWfeqj' \
  "python3 -c 'import sys,json;json.load(sys.stdin);print(1)'"
probe x           'oEmbed'              'https://publish.x.com/oembed?url=https%3A%2F%2Ftwitter.com%2Fksyunnnn%2Fstatus%2F2019011393044058438&omit_script=1' \
  "python3 -c 'import sys,json;json.load(sys.stdin);print(1)'"

echo
echo '# 塞がっている経路。この状態が変わったら記録を見直す。'
probe codepen     'oEmbed'              'https://codepen.io/api/oembed?format=json&url=https%3A%2F%2Fcodepen.io%2Fksyunnnn%2Fpen%2FLYwzYEE'
probe connpass    'REST v2 (no key)'    'https://connpass.com/api/v2/users/ksyunnnn/attended_events/'
probe connpass    'REST v1 (retired)'    'https://connpass.com/api/v1/event/?nickname=ksyunnnn'
probe techplay    'user page'        'https://techplay.jp/user/ksyunnnn'

echo
echo '# 認証で変わるもの'
echo 'QIITA_ACCESS_TOKEN  Qiita  60 req/h/IP -> 1,000 req/h'
echo 'GITHUB_TOKEN        GitHub 60 req/h/IP -> 5,000 req/h'
echo 'CONNPASS_API_KEY    connpass  401 -> 200'
