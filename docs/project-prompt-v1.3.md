# Role-Based Card Game Framework — プロジェクトプロンプト v1.3

あなたはこのプロジェクトの開発パートナーです。
仕様書 `SDD_Specification_v1.3_full.md` と実装プロンプト集 `v1.3-implementation-prompts-full.md` を正として動作してください。

---

## プロジェクト概要

**名称**: Role-Based Card Game Framework（職種×スキル カードゲーム）  
**目的**: キャリア教育・職業理解を目的としたオンラインマルチプレイヤー3Dカードゲーム  
**対象**: 中学生〜大学生、企業研修（2〜4人グループ）  
**理論基盤**: Katz の Three Skills モデル（テクニカル・ヒューマン・コンセプチュアル）

---

## 技術スタック

| レイヤー | 技術 | 備考 |
|---|---|---|
| Runtime | **Node.js 24** | `engines: { node: ">=24.0.0" }` |
| DB | **better-sqlite3 ^12.8.0** | 同期API。コールバック不使用 |
| Backend | Express + ws（WebSocket）| |
| Frontend | Vanilla JavaScript | フレームワーク不使用 |
| 3D | **Three.js r128**（CDN）| OrbitControls は含まれない |
| Auth | UUID Bearer token（24h）| |

---

## better-sqlite3 の鉄則

**コールバックは一切使わない**。3パターンのみ：

```javascript
db.prepare('SELECT * FROM table').all()              // 複数行
db.prepare('SELECT * FROM table WHERE id=?').get(id) // 1行
db.prepare('INSERT INTO table (...) VALUES (?)').run(val) // → res.lastInsertRowid
```

エラーハンドリングは `try/catch`（同期）。

---

## DB テーブル（5つ）

| テーブル | 役割 | 旧名称（v1.1）|
|---|---|---|
| `category_cards` | 職種カード（大分類）| `job_cards` |
| `skill_types` | スキル区分（中分類）| 新規 |
| `skill_cards` | スキルカード（小分類）| `matchesCategories` カラム |
| `missions` | ミッションカード | 変更なし |
| `mission_categories` | ミッションカテゴリ | 変更なし |

**重要**: `skill_types.model_type` は `'katz'` 固定。Drucker モデルは実装しない。

---

## 命名の絶対ルール（v1.2 以降）

| ❌ 旧（v1.1） | ✅ 新（v1.3） |
|---|---|
| `job_cards` | `category_cards` |
| `matchesJobs` | `matchesCategories` |
| `player.jobs` | `player.categories` |
| `player.jobSelected` | `player.categorySelected` |
| `handleSelectJob` | `handleSelectCategory` |
| `jobSelected`（WS msg）| `categorySelected` |
| `/api/cards/jobs` | `/api/cards/categories` |
| `JOB_TAKEN`（error）| `CATEGORY_TAKEN` |
| `jobCardsCache` | `categoryCardsCache` |

**旧命名は絶対に使用しない。**

---

## WebSocket メッセージタイプ（全量）

```
createSession / joinSession
selectAvatar       ← v1.3
selectCategory     ← v1.2（旧 selectJob）
startGame / rollDice / selectCard
nextTurn / resign / resetGame
```

---

## ゲームフロー

```
menu → avatar-select → lobby → game
```

- `avatar-select`: avatarId + avatarColorId を選択して `selectAvatar` を送信
- `lobby`: 最低2人・最大4人待機。全員 `categorySelected` でゲーム開始可能
- `startGame` バリデーション順: NOT_HOST → NOT_ENOUGH_PLAYERS（<2）→ NOT_ALL_SELECTED

---

## クライアント DOM 構造（3D×2D 分離）

```
#app
├── #scene-container  z-index:1  ← Three.js canvas（触らない）
├── #ui-overlay       z-index:2  ← ラベル等（pointer-events:none）
└── #ui-interactive   z-index:3  ← スコアバー・カード・ボタン
```

`render()` のルール：
- `mode === 'menu'` / `'avatar-select'` → `app.innerHTML` 全体を置き換えてよい
- `mode === 'lobby'` / `'game'` → `#ui-interactive` のみ更新（`#scene-container` を壊さない）

---

## SceneManager の主要 public メソッド

```javascript
new SceneManager('scene-container')
  .init(players)                    // 起動
  .destroy()                        // 破棄
  .updateTurn(currentPlayerId)      // リング更新 + カメラ移動
  .triggerDiceRoll(callback?)       // ダイスアニメーション
  .showCardOnTable(playerId, type)  // 3Dカードメッシュ配置
  .focusCameraOnSeat(seatIndex)     // カメラ向き変更
```

座席定数: `SEAT_ANGLES = [0, π/2, π, 3π/2]` / `SEAT_RADIUS = 4.75`

---

## スコアバー（横一列）

```html
<div id="sb" style="position:absolute;top:10px;left:10px;right:10px;z-index:3;display:flex;...">
```

- アクティブプレイヤーのセル: `border-top:2.5px solid playerHex` + 薄い背景色
- ピップ点灯: `animation:pip .4s ease`
- ゴール表示: pts/max → `🏆 GOAL!`

---

## CSS アニメーション（3つ必須）

```css
@keyframes su  { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
@keyframes fo  { to { opacity:0; transform:scale(0.94); } }
@keyframes pip { 0%{transform:scale(1)} 50%{transform:scale(1.5)} 100%{transform:scale(1)} }
```

---

## カードインタラクション

1. サイコロ → ダイスアニメーション（2.4s）→ カード 2〜5 枚スライドアップ
2. 1st tap → ハイライト（`CARD_GLOW[type]` で glow）
3. 2nd tap → `confirmCard()` → `showResult(msg, type, col, imageUrl)` + 3D 配置
4. `imageUrl` があれば結果モーダルの先頭に画像表示

```javascript
const imgHtml = imageUrl
    ? `<img src="${imageUrl}" style="width:100%;max-height:120px;border-radius:6px;margin-bottom:10px;object-fit:cover;">`
    : '';
```

---

## アバター定数（変更禁止）

```javascript
const AVATAR_TYPES = [
  { id:1, accessory:'cap'     }, // 卒業キャップ
  { id:2, accessory:'beret'   }, // ベレー帽
  { id:3, accessory:'bun'     }, // お団子ヘア
  { id:4, accessory:'glasses' }, // メガネ
];
const AVATAR_COLORS = [
  { id:1, hex:'#6366f1', three:0x6366f1 }, // インディゴ
  { id:2, hex:'#f59e0b', three:0xf59e0b }, // アンバー
  { id:3, hex:'#10b981', three:0x10b981 }, // エメラルド
  { id:4, hex:'#ef4444', three:0xef4444 }, // レッド
  { id:5, hex:'#38bdf8', three:0x38bdf8 }, // スカイ
  { id:6, hex:'#a855f7', three:0xa855f7 }, // バイオレット
];
```

---

## REST API エンドポイント一覧

```
GET  /api/cards/categories          # 職種カード（配列直接）
GET  /api/cards/skills              # スキルカード
GET  /api/cards/missions            # ミッション
GET  /api/cards/skill-types         # スキル区分
GET  /api/cards/mission-categories  # ミッションカテゴリ
GET  /api/lang/:lang                # 翻訳ファイル
POST /api/auth/login                # { ok, token }
POST/PUT/DELETE /api/admin/categories
POST/PUT/DELETE /api/admin/skills
POST/PUT/DELETE /api/admin/missions
POST/PUT/DELETE /api/admin/skill-types
POST /api/admin/import/:type        # CSV upsert
GET  /api/health
```

---

## i18n キーの注意点

- `game.selectCategory`（旧: `game.selectJob`）
- `game.categorySelected`（旧: `game.jobSelected`）
- `avatar.*` キーが v1.3 で追加
- `errors.NOT_ENOUGH_PLAYERS` が v1.3 で追加
- `admin.skillTypes` / `admin.modelTypeKatz` が v1.2 で追加
- `admin.modelTypeDrucker` は存在しない（削除済み）

---

## 開発時の注意事項

- Three.js r128 では `THREE.CapsuleGeometry` は使用不可（r142 以降）→ `CylinderGeometry` + `SphereGeometry` で代替
- Three.js r128 では `THREE.OrbitControls` は CDN に含まれない → 手動実装
- `better-sqlite3` はサーバー起動前に `npm install` が必要（ネイティブモジュールのため）
- `game.db` は `.gitignore` に含まれる。本番では `npm run initdb` で初期化
- 管理画面の `model_type` セレクトは不要（`'katz'` 固定のため非表示でよい）

---

## ファイル構成

```
├── server.js        # Express + WebSocket + better-sqlite3
├── index.html       # Three.js CDN + CSS animations + #app DOM
├── game.js          # I18n + GameClient + SceneManager
├── admin.html       # 管理画面
├── initdb.js        # DB 初期化（better-sqlite3）
├── lang/ja.json     # 日本語翻訳
├── lang/en.json     # 英語翻訳
└── docs/
    ├── SDD_Specification_v1.3_full.md
    └── v1.3-implementation-prompts-full.md
```
