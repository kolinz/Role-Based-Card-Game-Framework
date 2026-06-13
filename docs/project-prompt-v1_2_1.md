# Role-Based Card Game Framework — プロジェクトプロンプト v1.2.1

あなたはこのプロジェクトの開発パートナーです。
仕様書 `SDD_Specification_v1.2.1_full.md` と実装プロンプト集 `v1.2.1-implementation-prompts.md` を正として動作してください。

---

## プロジェクト概要

**名称**: Role-Based Card Game Framework（職種×スキル カードゲーム）  
**目的**: キャリア教育・職業理解を目的としたオンラインマルチプレイヤーカードゲーム  
**対象**: 中学生〜大学生、企業研修（2〜4人グループ）  
**理論基盤**: 管理・組織論モデル（Katz の Three Skills モデル等）

---

## 技術スタック

| レイヤー | 技術 | 備考 |
|---|---|---|
| Runtime | **Node.js 24** | `engines: { node: ">=24" }`、Node.js 20 は EOL |
| DB | **better-sqlite3 ^12.8.0** | 同期 API。コールバック不使用 |
| Backend | Express + ws（WebSocket） | ESM（`"type": "module"`） |
| Frontend | Vanilla JavaScript | フレームワーク不使用 |
| Auth | UUID Bearer token（24h） | |

---

## better-sqlite3 の鉄則

**コールバックは一切使わない**。3パターンのみ：

```javascript
db.prepare('SELECT * FROM table').all()               // 複数行
db.prepare('SELECT * FROM table WHERE id=?').get(id)  // 1行
db.prepare('INSERT INTO table (...) VALUES (?)').run(val) // → res.lastInsertRowid
```

エラーハンドリングは `try/catch`（同期）。  
トランザクションは `db.transaction(fn)()`。  
`this.lastID` は使わない → `result.lastInsertRowid` を使う。

---

## ESM の鉄則

`"type": "module"` を `package.json` に追加済み。すべてのファイルで `import/export` を使う。

```javascript
// ✅ 正しい
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

// ❌ 使わない
const Database = require('better-sqlite3');
```

---

## DB テーブル（5つ）

| テーブル | 役割 | v1.1 からの変更 |
|---|---|---|
| `category_cards` | 職種カード（大分類） | `job_cards` からリネーム |
| `skill_types` | スキル区分（中分類） | 新規追加 |
| `skill_cards` | スキルカード（小分類） | `matchesCategories` カラム（旧 `matchesJobs`） |
| `missions` | ミッションカード | 変更なし |
| `mission_categories` | ミッションカテゴリ | 変更なし |

**`skill_types.model_type`**: 自由記述フィールド（特定の値に制限しない）。  
管理画面では `<input type="text">` + `<datalist>` で入力。デフォルト値は `'katz'`。

---

## 命名の絶対ルール（v1.2 以降）

| ❌ 旧（v1.1） | ✅ 現在（v1.2.1） |
|---|---|
| `job_cards` | `category_cards` |
| `matchesJobs` | `matchesCategories` |
| `player.jobs` | `player.categories` |
| `player.jobSelected` | `player.categorySelected` |
| `handleSelectJob` | `handleSelectCategory` |
| `jobSelected`（WS msg） | `categorySelected` |
| `/api/cards/jobs` | `/api/cards/categories` |
| `JOB_TAKEN`（error） | `CATEGORY_TAKEN` |
| `jobCardsCache` | `categoryCardsCache` |
| `sqlite3`（ライブラリ） | `better-sqlite3` |
| `db.all/run/get(sql, cb)` | `db.prepare(sql).all/run/get()` |
| `this.lastID` | `result.lastInsertRowid` |

**旧命名は絶対に使用しない。**

---

## WebSocket メッセージタイプ（全量）

```
クライアント → サーバー:
  createSession / joinSession
  selectCategory     ← v1.2（旧 selectJob）
  startGame / rollDice / selectCard
  nextTurn / resign / resetGame

サーバー → クライアント:
  sessionCreated / sessionJoined / playerJoined
  categorySelected   ← v1.2（旧 jobSelected）
  gameStarted / diceRolled
  cardSelected / cardSelectedByOther / gameCompleted
  playerRetired / nextTurn / gameReset / error
```

---

## ゲームフロー

```
menu → lobby → game
```

- `lobby`: 最低2人・最大4人待機。全員 `categorySelected` でゲーム開始可能
- `startGame` バリデーション順: NOT_HOST → NOT_READY（未選択プレイヤーあり）

---

## セッション内プレイヤーオブジェクト

```javascript
{
  id: string,
  name: string,
  categories: [],          // 選択した職種 ID の配列（旧: jobs）
  points: {},              // { categoryId: number }
  retired: false,
  categorySelected: false, // 旧: jobSelected
  selectedSkillCardIds: [],
  finished: false,
  finishRank: null
}
```

---

## REST API エンドポイント一覧

```
GET  /api/cards/categories          # 職種カード（配列直接）
GET  /api/cards/skills              # スキルカード
GET  /api/cards/missions            # ミッション
GET  /api/cards/skill-types         # スキル区分
GET  /api/cards/mission-categories  # ミッションカテゴリ
GET  /api/lang/:lang                # 翻訳ファイル → { ok, translations }
POST /api/auth/login                # → { ok, token }
POST/PUT/DELETE /api/admin/categories
POST/PUT/DELETE /api/admin/skills
POST/PUT/DELETE /api/admin/missions
POST/PUT/DELETE /api/admin/skill-types
POST /api/admin/import/:type        # CSV upsert（type: categories|skills|missions|skill-types）
GET  /api/health                    # → { ok, timestamp }
```

**レスポンス形式**:
- カード取得系（GET /api/cards/\*）: 配列を直接返す（ラッパーなし）
- 管理系・認証系: `{ ok: true }` または `{ ok: false, error: { code, message } }`

---

## i18n キーの注意点

- `game.selectCategory`（旧: `game.selectJob`）
- `game.categorySelected`（旧: `game.jobSelected`）
- `game.waitingForCategorySelection`（旧: `game.waitingForJobSelection`）
- `admin.categoryCards`（旧: `admin.jobCards`）
- `admin.matchesCategories`（旧: `admin.matchesJobs`）
- `admin.skillTypes` / `admin.modelType`（v1.2 で追加）
- `errors.CATEGORY_TAKEN`（旧: `errors.JOB_TAKEN`）

---

## initdb.js のパターン（必ずこの形で書く）

```javascript
import fs from 'fs';
import Database from 'better-sqlite3';

if (fs.existsSync('./game.db')) fs.unlinkSync('./game.db');

const db = new Database('./game.db');
db.pragma('journal_mode = WAL');

const init = db.transaction(() => {
    db.exec(`CREATE TABLE ...`);
    const stmt = db.prepare('INSERT INTO ... VALUES (?, ?)');
    rows.forEach(row => stmt.run(row));
});

init();
console.log('Database initialized successfully!');
db.close();
```

---

## 開発時の注意事項

- `better-sqlite3` はネイティブモジュール。`npm install` 時にビルドが必要
- Node.js のメジャーバージョン変更後は `npm rebuild better-sqlite3` を実行
- ビルドエラー時: `sudo apt install -y python3 build-essential` の後に `npm install --build-from-source`
- `game.db` は `.gitignore` に含まれる。初期化は `npm run initdb`
- 管理画面の `model_type` 入力は `<input type="text">` + `<datalist>`（`<select>` ではない）
- `matchesCategories` は DB 上カンマ区切り文字列。JS では `.split(',').map(Number)` で配列化

---

## ファイル構成

```
├── server.js              # Express + WebSocket + better-sqlite3
├── index.html             # CSS animations + #app DOM
├── game.js                # I18n + GameClient
├── admin.html             # 管理画面
├── initdb.js              # DB 初期化（better-sqlite3）
├── package.json           # "type": "module", engines: node>=24
├── .env                   # 環境変数（.gitignore に含まれる）
├── .env.example           # サンプル
├── lang/
│   ├── ja.json            # 日本語翻訳
│   └── en.json            # 英語翻訳
└── docs/
    ├── SDD_Specification_v1.2.1_full.md
    └── v1.2.1-implementation-prompts.md
```
