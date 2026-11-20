# 場面ごとの出典

HIG の URL は `https://developer.apple.com/design/human-interface-guidelines/<page>`。HIG に Web 向けのページはない。広い画面の Web は macOS の記述に合わせる。

| 場面 | 使う | 避ける | ページ |
|---|---|---|---|
| 一覧と詳細 | Split view。選んだ行の強調を保つ。区切りは細く、ペインの幅に上限と下限 | — | split-views |
| 最上位のまとまり | Sidebar。2 階層まで | 既定で隠す | sidebars |
| 一覧の見せ方の切り替え | ツールバーの Segmented control | Pop-up button、Tab bar | segmented-controls、tab-views |
| 1 件の中身の切り替え | Tab view（6 つまで） | Segmented control | tab-views |
| 絞り込み | 1 つ選ぶ軸は Pop-up button、検索は Search field と Token | — | pop-up-buttons、search-fields |
| ツールバー | 区画は 3 つまで。主な操作は 1 つで末尾 | 背景や色付きの操作を増やす | toolbars |
| オンとオフ | 強調したい設定は Switch、単独の設定は Checkbox | ツールバーに置く | toggles |
| 編集と保存 | 値をその場で検証、何度も戻せる | 詳細の編集を Sheet で行う | entering-data、undo-and-redo、sheets |
| 狭い画面の詳細 | 半分の高さで止まるシート（medium detent）。広げたら不透明 | 長い・頻繁な作業をシートに閉じ込める | sheets |
| 削除の確認 | 取り消せない削除だけ確かめる。ボタンは具体的な名前 | 戻せる操作への確認 | alerts、action-sheets |
| パンくず | W3C APG Breadcrumb https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/ | Path control | path-controls |

## 食い違い

- 自動保存（file-management は勧める）は、API の呼び出しの回数とのかね合いで、ユーザーに選んでもらう
- iOS と macOS で勧める部品が違うとき（Tab bar と Sidebar、Switch と Checkbox）は、画面の幅で選び、選んだ理由を書く
