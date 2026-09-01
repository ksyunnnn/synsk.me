---
status: accepted
date: 2026-02-02
decision-makers: synsk
---

# アイコンシステム

## Context and Problem Statement

synsk.me のリデザインにおいて、Timeline 表示で Platform を視覚的に識別する必要がある。また、UI 全体で使用するアイコンライブラリを整理する必要がある。

3つのアイコンライブラリが混在している:
- **Phosphor Icons**: メインで使用中（`src/icon.tsx`）
- **Lucide React**: shadcn/ui のデフォルトとして設定されているが、ほぼ未使用
- **FontAwesome**: Script タグで読み込み、既存ページで使用

## Decision Drivers

* [おもしろさ over 安全圏](../PRINCIPLES.md#3-おもしろさ)

## Considered Options

* ActivityType ごとにアイコン設定
* 全て Platform アイコン（フォールバックなし）
* 全て ActivityType アイコン

## Decision Outcome

**アイコンシステムを2層構造で設計する。**

### 1. Platform アイコン: Simple Icons + フォールバック

| カテゴリ | ソース | 対象 |
|---------|--------|------|
| 公式アイコンあり | Simple Icons | GitHub, Zenn, Qiita, dev.to, Medium, SpeakerDeck, Spotify, X, CodeSandbox |
| 公式アイコンなし | Phosphor Icons `Planet` | Connpass, TECHPLAY, CodePen |

**フォールバックに `Planet` を選んだ理由**:
- 「未知のプラットフォーム」を示唆するユーモア
- 「おもしろさ over 安全圏」原則に沿う

### 2. UI アイコン: Phosphor Icons に統一

新規実装では Phosphor Icons を使用する。

- 既存コードで使用中（追加コストなし）
- 6つのウェイト（Thin〜Fill）から選択可能
- ウェイト選択は実装時に [ADR-0005](./0005-design-tokens.md) の Typography と合わせて検討

### Consequences

* Good, because Platform の視覚的識別が容易になる
* Good, because UI アイコンの一貫性が向上
* Good, because フォールバック（Planet）がユーモアを加える
* Bad, because Simple Icons に依存（外部リソース）
* Bad, because フォールバック対象の Platform が増えると Planet の意味が薄れる可能性
* Bad, because Simple Icons のアイコンが変更・削除される可能性（低リスク）
* Bad, because Phosphor Icons のウェイト選択を誤ると Typography との不整合が起きる

### Confirmation

判定手段を定めていない。`Confirmation` を規約に加えたのは 2026-08-31 で、この記録より後である。

## Pros and Cons of the Options

### Option A: ActivityType ごとにアイコン設定

Timeline の各項目に ActivityType アイコン（Article, Code, Calendar 等）を表示。

- **Pros**: 視覚的なスキャンが容易
- **Cons**: テキストで既に明示されており情報の重複。「余白 over 密度」原則に反する

→ **不採用**: Platform アイコンのみで十分と判断

### Option B: 全て Platform アイコン（フォールバックなし）

Connpass, TECHPLAY, CodePen も公式ロゴを自前で用意。

- **Pros**: 完全な一貫性
- **Cons**: ロゴ取得・管理の手間、ブランドガイドライン確認が必要

→ **不採用**: コスト対効果が低い

### Option C: 全て ActivityType アイコン

Platform ロゴを使わず、ActivityType（event, sandbox 等）でアイコンを統一。

- **Pros**: シンプル
- **Cons**: Platform の視覚的識別ができない

→ **不採用**: GitHub や Zenn の認知度を活かせない

## More Information

- [Simple Icons](https://simpleicons.org/)
- [Phosphor Icons](https://phosphoricons.com/)
- [content-model-design.md](../archive/content-model-design.md) - Platform アイコン一覧
