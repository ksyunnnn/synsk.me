# Web でのガラス（Liquid Glass に倣う）

Apple は Liquid Glass の部品を SwiftUI・UIKit・AppKit にしか配らない（https://developer.apple.com/documentation/technologyoverviews/liquid-glass ）。Web では見た目を自分で作り、次の決まりに従う。

## 決まり

1. ガラスはナビと操作の層（サイドバー・ツールバー・切り替え・シート・メニュー）に限る。表や詳細の本文は不透明な面にする
   - HIG Materials: "Don't use Liquid Glass in the content layer." https://developer.apple.com/design/human-interface-guidelines/materials
2. ガラスの上にガラスを重ねない。重なる部品は塗りにする
   - WWDC25 Meet Liquid Glass: "always avoid glass on glass" https://developer.apple.com/videos/play/wwdc2025/219/
   - CSS でも、`backdrop-filter` を入れ子にすると描画の負荷が増える（W3C Filter Effects Level 2 https://drafts.csswg.org/filter-effects-2/ ）
3. 大きい面ほど不透明に寄せる。全体の高さに広げたシートは不透明にする
   - HIG Color https://developer.apple.com/design/human-interface-guidelines/color 、Adopting Liquid Glass https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass
4. 色は主な操作の背景にだけ使う
   - HIG Color: "To emphasize primary actions, apply color to the background rather than to symbols or text."
5. コントラストを上げる設定（`prefers-contrast: more`）では、不透明の地と境界線に切り替える。透明度を下げる設定（`prefers-reduced-transparency`）は Safari が CSS で受け取れないので、既定を不透明寄りにする
   - MDN https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-contrast

## CSS の例（Tailwind v4 の `@utility`）

```css
@utility glass {
  background-color: hsl(var(--background) / 0.72);
  backdrop-filter: blur(24px) saturate(1.8);
  border: 1px solid hsl(var(--foreground) / 0.08);
  @media (prefers-contrast: more) {
    background-color: hsl(var(--background));
    backdrop-filter: none;
    border-color: hsl(var(--foreground));
  }
}
.glass .glass {
  background-color: hsl(var(--background));
  backdrop-filter: none;
}
```

値（0.72・24px など）は作り手が決めた値で、出典はない。足したことを明記し、レビューの対象にする。
