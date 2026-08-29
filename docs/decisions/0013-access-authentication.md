---
status: accepted
date: 2026-08-27
decision-makers: synsk
---

# 認証をアプリケーションの外で行う

## Context and Problem Statement

記事をブラウザ上の管理画面で書く方針を決めたことで、その画面に誰を通すかを判定する必要が生じた。使うのは作り手ひとりで、サインアップの仕組みを必要としない。

認証を扱う道具には、性質の異なる2種類がある。ひとつはサービスに会員登録してもらうためのもので、ログインの処理と状態の管理をアプリケーションの中に持つ。もうひとつは、あらかじめ許可した相手だけを通すためのもので、アプリケーションに届く前に判定する。

前者は 2026年夏に別プロジェクト（meatup）で使った。そのとき手を取られたのは認証そのものではなく、ログイン状態を画面へ反映する処理だった。アプリケーションの中に認証状態を持つことから生じている。

## Decision Drivers

* [実験 over 完璧な計画](../PRINCIPLES.md#2-実験)

## Considered Options

* 認証ライブラリをアプリケーションに組む
* Firebase Authentication を使う
* Cloudflare Access

## Decision Outcome

**認証をアプリケーションの外で行う。Cloudflare Access で判定する。**

### Consequences

* Good, because ログイン画面、セッション管理、ログアウトを実装しない
* Good, because 利用者の情報をデータベースに持たない
* Bad, because ログイン画面の見た目を作れない。組織名、ロゴ、背景色の変更にとどまる
* Bad, because **ログインしている相手をアプリケーションが直接知らない。** 判定はアプリケーションの外で終わる。相手のメールアドレスが必要になった場合、Cloudflare が付与する JWT（`Cf-Access-Jwt-Assertion` ヘッダ）を読み、署名を検証することになる
* Bad, because **JWT の `sub` は Cloudflare が発行する値である。** 公式は `unique to an email address per account` とのみ定めており、Cloudflare アカウントの外で通用する保証も、永続する保証も示していない

## Pros and Cons of the Options

### Option A: 認証ライブラリをアプリケーションに組む

NextAuth.js や Better Auth を使い、ログイン画面とセッション管理を持つ。

- **Pros**: ログインしている相手の情報をアプリケーション側で自由に扱える
- **Cons**: ログイン画面、セッションの保存と失効、状態の画面への反映を実装することになる

### Option B: Firebase Authentication を使う

- **Pros**: 別プロジェクトで使った実績がある
- **Cons**: Option A と同じ実装が必要になる。Cloudflare の外に依存先が増える

### Option C: Cloudflare Access — 採用

- **Pros**: 実装するものがない。設定で許可する相手を指定する
- **Cons**: ログイン画面の見た目を作れない

## References

- [ADR-0012: ホスティングに Cloudflare を採用する](./0012-cloudflare-hosting.md)
- [Cloudflare Access: Application token](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/)
- [Cloudflare Access policies](https://developers.cloudflare.com/cloudflare-one/policies/access/)
