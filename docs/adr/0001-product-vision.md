# ADR-0001: Product Vision and Principles

- **Status**: proposed
- **Date**: 2025-01-23
- **Deciders**: [あなたの名前]
- **Related Principles**: [../PRINCIPLES.md](../PRINCIPLES.md)

---

## Context

synsk.me プロジェクトにおいて、プロダクトの目的・原則を明確にする必要がある。

これにより:
- 今後の技術・デザイン判断に一貫性を持たせる
- ポートフォリオ閲覧者に意図を伝える
- 自分自身の思考を整理する

---

## Decision

**プロダクトのビジョンと原則を [VISION.md](../VISION.md) と [PRINCIPLES.md](../PRINCIPLES.md) として定義する。**

### VISION.md

Working Backwards 形式を採用:
- 完成した未来のプレスリリースとして記述
- 顧客（閲覧者）視点で価値を明確化

### PRINCIPLES.md

X over Y 形式を採用:
- トレードオフを明示
- 各原則に背景（Pain + Reflection）を記録

---

## Alternatives Considered

### Option A: READMEに統合

Vision と Principles を README.md に記載する。

- **Pros**: ファイル数が少ない、すぐ見える
- **Cons**: READMEが肥大化、役割が曖昧になる

### Option B: 独立したドキュメント（採用）

専用のファイルとして分離する。

- **Pros**: 役割が明確、階層構造が作れる、参照しやすい
- **Cons**: ファイル数が増える

---

## Consequences

### Positive

- すべての判断がビジョン・原則に基づくようになる
- ドキュメント間の関係が明確になる
- ポートフォリオとして技術力・思考力をアピールできる

### Negative

- ドキュメントのメンテナンスコストが発生
- 最初に考える時間が必要

### Risks

- ビジョン・原則が形骸化する可能性
  - 対策: 定期的な見直しをスケジュール

---

## References

- [Amazon Working Backwards](https://workingbackwards.com/)
- [Ray Dalio's Principles](https://www.principles.com/)
- [Architecture Decision Records](https://adr.github.io/)
