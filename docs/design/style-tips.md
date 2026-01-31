この記事について

- UI実装時に使うと表現の幅が広がりそうなCSSやJS・ライブラリなどのTIPSをまとめる
- UI提案・実装の時に参照したい
- 手動で追加する

---

## CSS

### :target-current / :target-before / :target-after

**スクロール連動UIをCSSだけで実装できる疑似クラス**

- **記事**: [スクロール連動UIはCSSだけで作れる！ 疑似クラス:target-current/before/afterが便利](https://ics.media/entry/260130/)
- **用途**: 目次のハイライト、進捗インジケーター、ナビゲーションのアクティブ表示
- **実装方法**: 親要素に `scroll-target-group: auto` を設定し、`<a href="#セクションID">` を配置
- **メリット**: JSなしでIntersection Observer相当の機能を実現
