---
status: accepted
date: 2026-01-27
decision-makers: synsk
---

# Product Vision and Principles

## Context and Problem Statement

synsk.me プロジェクトにおいて、プロダクトの目的・原則を明確にする必要がある。

これにより:
- 技術・デザイン判断に一貫性を持たせる
- ポートフォリオ閲覧者に意図を伝える
- 自分自身の思考を整理する

## Considered Options

* READMEに統合
* 独立したドキュメント

## Decision Outcome

**プロダクトのビジョンと原則を [VISION.md](../VISION.md) と [PRINCIPLES.md](../PRINCIPLES.md) として定義する。**

### VISION.md

Working Backwards 形式を採用:
- 完成した未来のプレスリリースとして記述
- 顧客（閲覧者）視点で価値を明確化

### PRINCIPLES.md

X over Y 形式を採用:
- トレードオフを明示
- 各原則に背景（Pain + Reflection）を記録

### Consequences

* Good, because すべての判断がビジョン・原則に基づくようになる
* Good, because ドキュメント間の関係が明確になる
* Good, because ポートフォリオとして技術力・思考力をアピールできる
* Bad, because ドキュメントのメンテナンスコストが発生
* Bad, because 最初に考える時間が必要
* Bad, because ビジョン・原則が形骸化する可能性
  * 対策: 定期的な見直しをスケジュール

### Confirmation

判定手段を定めていない。`Confirmation` を規約に加えたのは 2026-08-31 で、この記録より後である。

## Pros and Cons of the Options

### Option A: READMEに統合

Vision と Principles を README.md に記載する。

- **Pros**: ファイル数が少ない、すぐ見える
- **Cons**: READMEが肥大化、役割が曖昧になる

### Option B: 独立したドキュメント（採用）

専用のファイルとして分離する。

- **Pros**: 役割が明確、階層構造が作れる、参照しやすい
- **Cons**: ファイル数が増える

## References

- [Amazon Working Backwards](https://workingbackwards.com/)
- [Ray Dalio's Principles](https://www.principles.com/)
- [Architecture Decision Records](https://adr.github.io/)
