# Role-Based Card Game Framework — 再現実装プロンプト集 v1.2

> **仕様書**: `SDD_Specification_v1.2.md`  
> **GitHub タグ**: `v1.2`  
> **最終更新**: 2026-06-13

---

## 📋 v1.1 → v1.2 変更サマリー

このプロンプト集で変更・追加されたプロンプトは **[v1.2変更]** / **[v1.2新規]** でマークしています。

| 変更箇所 | v1.1 | v1.2 |
|---|---|---|
| DBテーブル | `job_cards` | `category_cards` |
| DBテーブル（新規） | — | `skill_types` |
| skillカードカラム | `matchesJobs` | `matchesCategories` |
| WebSocketメッセージ | `selectJob` / `jobSelected` | `selectCategory` / `categorySelected` |
| REST API（職種） | `/api/cards/jobs` | `/api/cards/categories` |
| REST API（ミッションカテゴリ） | `/api/cards/categories` | `/api/cards/mission-categories` |
| REST API（新規） | — | `/api/cards/skill-types` |
| 管理API | `/api/admin/jobs` | `/api/admin/categories` |
| 管理API（新規） | — | `/api/admin/skill-types` |
| i18nキー | `game.selectJob` / `admin.jobCards` | `game.selectCategory` / `admin.categoryCards` |
| エラーコード | `JOB_TAKEN` | `CATEGORY_TAKEN` |
| セッションプレイヤー | `jobs` / `jobSelected` | `categories` / `categorySelected` |
| フロントエンドキャッシュ | `jobCardsCache` | `categoryCardsCache` |

---

## 🛠️ このドキュメントの使い方

このプロンプト集は **2つのツール**に対応しています。

| ツール | 向いている作業 | プロンプトの使い方 |
|---|---|---|
| **Claude.ai** | 設計・ファイル単位の生成・レビュー | コードブロック内をコピペして会話で使用 |
| **Claude Code** | ファイル操作・実行・テスト・一括実装 | `claude` コマンドまたは `#` ファイル参照で使用 |

### Claude.ai で使う場合

1. 各プロンプトブロックをそのままチャットに貼り付ける
2. 生成されたコードをローカルにコピーする
3. 次のプロンプトに進む前に動作確認する

### Claude Code で使う場合

1. リポジトリルートで `claude` を起動する
2. `#SDD_Specification_v1.2.md` で仕様書を参照させる
3. プロンプトを貼り付けるか、`CLAUDE.md` に記載して自動実行させる

> **実行順序**: Phase 1 → 2 → 3 → 4 → 5 → 6 → 7  
> Phase をまたいで依存関係があるため、必ず順番通りに実行してください。

---

## 📋 目次

- [Phase 1: プロジェクト初期化](#phase-1-プロジェクト初期化)
- [Phase 2: データベース設計と初期化](#phase-2-データベース設計と初期化)
- [Phase 3: サーバーサイド実装](#phase-3-サーバーサイド実装)
- [Phase 4: クライアントサイド実装](#phase-4-クライアントサイド実装)
- [Phase 5: 管理画面実装](#phase-5-管理画面実装)
- [Phase 6: 多言語対応システム](#phase-6-多言語対応システム)
- [Phase 7: デプロイメント設定](#phase-7-デプロイメント設定)
- [補足: デバッグ・修正用プロンプト](#補足-デバッグ修正用プロンプト)

---

## Phase 1: プロジェクト初期化

### Prompt 1-1: プロジェクト設定ファイルの一括生成 **[v1.2変更]**

**Claude.ai 向け**
> 以下をそのまま貼り付けてください。3ファイルのコードが生成されます。

**Claude Code 向け**
> `claude` 起動後、以下を貼り付けると 3ファイルを直接作成してくれます。

```
以下の3ファイルを作成してください。

## package.json
{
  "name": "career-skills-card-game",
  "version": "1.2.0",
  "description": "Online multiplayer career and skills card game",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "initdb": "node initdb.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.14.2",
    "sqlite3": "^5.1.6",
    "uuid": "^9.0.1",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}

## .env.example
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
PORT=3000

## .gitignore
node_modules/
.env
game.db
*.log
```

---

### Prompt 1-2: ディレクトリ構造とスケルトンファイルの作成

（v1.1と変更なし）

```
以下のディレクトリ構造を作成し、各ファイルを空のスケルトン状態で用意してください。

Role-Based-Card-Game-Framework/
├── server.js
├── index.html
├── game.js
├── admin.html
├── initdb.js
├── package.json    ← すでに作成済み
├── .env.example    ← すでに作成済み
├── .gitignore      ← すでに作成済み
└── lang/
    ├── en.json
    └── ja.json

作成後、"npm install" の実行と "cp .env.example .env" も行ってください。
```

---

### Prompt 1-3: CLAUDE.md の作成（Claude Code 専用）**[v1.2変更]**

```
このプロジェクト用の CLAUDE.md を作成してください。

## プロジェクト概要
- 職種×スキル カードゲーム（キャリア教育向けオンラインマルチプレイヤーカードゲーム）
- 仕様書: SDD_Specification_v1.2.md を参照

## カード階層（v1.2）
- カテゴリ（大分類）: 職種（SE、PMなど）→ category_cards テーブル
- スキル区分（中分類）: Katz/Druckerモデルによる分類 → skill_types テーブル
- スキル（小分類）: 個別スキルカード → skill_cards テーブル

## 技術スタック
- バックエンド: Node.js + Express + WebSocket (ws) + SQLite3
- フロントエンド: Vanilla JavaScript（フレームワークなし）
- DB: SQLite (game.db)
- 認証: トークンベース（Bearer token、24時間有効）

## ファイル構成
- server.js: Express + WebSocket サーバー（メインエントリーポイント）
- index.html + game.js: ゲームクライアント
- admin.html: 管理画面（認証必須）
- initdb.js: DB初期化スクリプト（npm run initdb）
- lang/ja.json, lang/en.json: 翻訳ファイル

## 重要なコーディング規約（v1.2）
- API レスポンス: カード取得系は配列を直接返す（{ ok, data } ラッパーなし）
- 認証系・管理系は { ok: true/false, error: { code, message } } 形式
- WebSocket メッセージは { type: string, ...payload } 形式
- matchesCategories はDB上カンマ区切り文字列、JS処理時は .split(',').map(Number) で配列化
  （旧: matchesJobs — v1.1 との混同に注意）

## v1.2 命名規則（v1.1 から変更）
- テーブル: job_cards → category_cards
- テーブル: skill_types（新規追加）
- カラム: matchesJobs → matchesCategories（skill_cards テーブル）
- WS type: selectJob → selectCategory、jobSelected → categorySelected
- API: /api/cards/jobs → /api/cards/categories
- API: /api/cards/categories → /api/cards/mission-categories（ミッションカテゴリ）
- API: /api/cards/skill-types（新規）
- プレイヤーフィールド: jobs → categories、jobSelected → categorySelected
- エラーコード: JOB_TAKEN → CATEGORY_TAKEN
- フロントエンド: jobCardsCache → categoryCardsCache

## よく使うコマンド
- npm start: サーバー起動
- npm run dev: nodemon で開発起動
- npm run initdb: DB初期化（既存 game.db を削除して再作成）
- node check-db.js: DB状態確認

## 注意事項
- .env は .gitignore に含まれるため、.env.example をコピーして使用
- game.db は自動生成されるため Git に含めない
- Base64 画像は最大 800×800px、JPEG 品質 75% でリサイズ
```

---

## Phase 2: データベース設計と初期化

### Prompt 2-1: initdb.js の完全実装 **[v1.2変更]**

**Claude.ai 向け**
> 生成されたコードを `initdb.js` に保存後、`npm run initdb` で実行してください。

**Claude Code 向け**
> ファイル作成後に自動実行まで依頼できます。

```
#SDD_Specification_v1.2.md を参照して、initdb.js を実装してください。

## 処理の流れ
1. 既存の game.db を削除
2. 新しい game.db を作成
3. 5つのテーブルを作成（db.serialize() で順序保証）
4. サンプルデータを挿入
5. 完了メッセージを表示

## テーブル定義（仕様書 Section 4.2 参照）

### mission_categories（4件）
- Crisis Management / 危機管理
- Decision Making / 意思決定
- Communication / コミュニケーション
- Resource Management / リソース管理

### category_cards（6件）  ← v1.2: 旧 job_cards
IT職種を6つ。各職種に:
- targetPoints: 3〜5 の範囲
- descriptionHtml_en/ja: <ul><li> タグを含む HTML

例: Engineer / エンジニア, Designer / デザイナー, Project Manager / プロジェクトマネージャー,
    QA Engineer / QAエンジニア, DevOps Engineer / DevOpsエンジニア, Data Analyst / データアナリスト

### skill_types（3件）  ← v1.2: 新規テーブル
Katzモデルの3区分（model_type = 'katz'）:
- Technical Skill / テクニカルスキル
- Human Skill / ヒューマンスキル
- Conceptual Skill / コンセプチュアルスキル

### skill_cards（23件）
Katz の管理スキルモデルに基づいて:
- テクニカルスキル（8〜9件）: プログラミング、テスト、インフラ等
- ヒューマンスキル（7〜8件）: コミュニケーション、リーダーシップ等
- コンセプチュアルスキル（6〜7件）: 問題解決、戦略的思考等
- matchesCategories: 各スキルに適切な職種IDのカンマ区切り文字列
  （v1.2: 旧 matchesJobs — カラム名に注意）

### missions（40件: 通常 39件 + 特殊 1件）
- 各カテゴリから概ね均等に割り当て
- target_en/ja: "Individual" / "個人" または "Team" / "チーム"
- 特殊ミッション（isSpecial=1）: 内容は「退職＆強制兼任」

## 実装要件
- エラー時: console.error + process.exit(1)
- 完了時: 以下を表示:
  "Database initialized successfully!
   Tables: mission_categories(4), category_cards(6), skill_types(3), skill_cards(23), missions(40)"
```

**Claude Code 追加指示**:
```
initdb.js の実装が完了したら、"npm run initdb" を実行して正常に完了することを確認してください。
エラーが出た場合は修正して再実行してください。
```

---

### Prompt 2-2: DB 確認スクリプトの作成と実行 **[v1.2変更]**

```
check-db.js を作成して実行し、データベースが正しく初期化されているか確認してください。

## 確認項目
1. 各テーブルのレコード件数:
   - mission_categories: 4件
   - category_cards: 6件       ← v1.2: 旧 job_cards
   - skill_types: 3件           ← v1.2: 新規
   - skill_cards: 23件
   - missions: 40件（うち isSpecial=1 が 1件）
2. category_cards の全レコード（id, name_ja, targetPoints）を表示
3. skill_types の全レコード（id, name_ja, model_type）を表示
4. skill_cards の matchesCategories の値サンプル（先頭5件）を表示
   （カラム名が matchesCategories であることを確認）

## 期待する出力
=== Database Check ===
mission_categories: 4 records ✅
category_cards: 6 records ✅
skill_types: 3 records ✅
skill_cards: 23 records ✅
missions: 40 records (1 special) ✅

=== Category Cards ===
[1] エンジニア (targetPoints: 4)
...

=== Skill Types ===
[1] テクニカルスキル (model_type: katz)
...

件数が一致しない場合はエラーメッセージを表示して process.exit(1) してください。
```

---

## Phase 3: サーバーサイド実装

> **Claude Code を使う場合のヒント**:  
> `3-1 → 3-2 → 3-3 → 3-4 → 3-5` の順に実行し、
> 各ステップで `npm start` による起動確認を挟むと安全です。

---

### Prompt 3-1: server.js の骨格（初期化・グローバル変数・ユーティリティ関数）

（v1.1と変更なし）

```
#SDD_Specification_v1.2.md の Section 5 を参照して、server.js の基本骨格を実装してください。

## この段階で実装する内容（ハンドラ関数はスタブでOK）

### 依存関係のインポート
require('dotenv').config();
express, http, WebSocket, sqlite3, uuid, path, fs

### サーバーとDB の初期化
- Express アプリ
- http.createServer
- WebSocket.Server をサーバーに紐付け
- SQLite: new sqlite3.Database('./game.db', エラーハンドリング付き)

### グローバル変数
const gameSessions = new Map();
const clients = new Map();
const adminTokens = new Map();
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

### ユーティリティ関数
- generateSessionId(): uuidv4() の先頭8文字を大文字で返す
- broadcast(sessionId, message, excludePlayerId = null)
- sendToPlayer(sessionId, playerId, message)

### WebSocket 接続ハンドラの骨格
wss.on('connection', (ws) => {
  let currentSessionId = null;
  let currentPlayerId = null;

  ws.on('message', (message) => {
    // JSON パース → switch(data.type) で各ハンドラ呼び出し
    // type 一覧: createSession, joinSession, selectCategory, startGame,
    //            rollDice, selectCard, nextTurn, resign, resetGame
    // エラー時: { type: 'error', error: { code: 'SERVER_ERROR', message } }
  });

  ws.on('close', () => {
    // clients Map から currentPlayerId を削除
  });
});

### サーバー起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

ハンドラ関数は // TODO: implement のスタブとして定義だけしておいてください。
```

---

### Prompt 3-2: セッション管理ハンドラ **[v1.2変更]**

```
server.js に以下の4つの WebSocket ハンドラ関数を実装してください。
既存の // TODO スタブを置き換えてください。

## handleCreateSession(ws, data)
新しい session オブジェクト構造:
{
  id: generateSessionId(),
  hostPlayerId: playerId,
  players: [{
    id: playerId,
    name: data.playerName || 'Player 1',
    categories: [],             // v1.2: jobs → categories
    points: {},
    retired: false,
    categorySelected: false,    // v1.2: jobSelected → categorySelected
    selectedSkillCardIds: [],
    finished: false,
    finishRank: null
  }],
  maxPlayers: data.maxPlayers || 4,
  currentPlayerIndex: 0,
  gameStarted: false,
  diceValue: null,
  drawnCards: [],
  selectedCardsHistory: [],
  usedCardIds: [],
  chatMessages: [],
  finishedPlayers: [],
  allFinished: false
}
送信: { type: 'sessionCreated', sessionId, playerId, session }

## handleJoinSession(ws, data)
バリデーション（エラー時は ws.send でエラー返却）:
- セッションが存在しない → SESSION_NOT_FOUND
- players.length >= maxPlayers → SESSION_FULL
- gameStarted === true → GAME_ALREADY_STARTED

新プレイヤーを session.players に push（categories, categorySelected を含む新構造で）
送信（本人）: { type: 'sessionJoined', playerId, session }
ブロードキャスト（他全員）: { type: 'playerJoined', session }

## handleSelectCategory(ws, data)  ← v1.2: handleSelectJob → handleSelectCategory
バリデーション:
- 他プレイヤーが同じ categoryId を選択済みなら → { type: 'error', error: { code: 'CATEGORY_TAKEN' } }

player.categories に data.categoryId を追加
player.categorySelected = true
ブロードキャスト: { type: 'categorySelected', playerId: data.playerId, categoryId: data.categoryId, session }

## handleStartGame(ws, data)
バリデーション:
- data.playerId !== session.hostPlayerId → 権限エラー
- 全プレイヤーが categorySelected !== true → 「まだ職種未選択のプレイヤーがいます」エラー

session.gameStarted = true
ブロードキャスト: { type: 'gameStarted', session }
```

---

### Prompt 3-3: ゲームコアハンドラ（rollDice / selectCard）**[v1.2変更]**

```
server.js に handleRollDice と handleSelectCard を実装してください。
仕様書 Section 5.6、5.7、9章 を参照してください。

## handleRollDice(ws, data)

【サイコロ】
const diceValue = Math.floor(Math.random() * 6) + 1;
session.diceValue = diceValue;

【カード取得（3つの DB クエリをネスト）】
1. SELECT * FROM skill_cards
2. SELECT * FROM missions WHERE isSpecial = 0
3. SELECT * FROM missions WHERE isSpecial = 1

【allCards 配列の構築】
- スキルカード:
  type: 'skill',
  matchesCategories: c.matchesCategories ? c.matchesCategories.split(',').map(Number) : []
  （v1.2: matchesJobs → matchesCategories）
- 通常ミッション: type: 'mission'

【在庫管理・特殊ミッション・ランダム抽選】
v1.1 と変更なし（フィールド名のみ上記に読み替え）

ブロードキャスト: { type: 'diceRolled', diceValue, drawnCards, session }

## handleSelectCard(ws, data)

【スキルカード (type === 'skill')】
マッチング判定:
  currentPlayer.categories.forEach(categoryId => {   // v1.2: jobs → categories
    if (card.matchesCategories && card.matchesCategories.includes(categoryId)) {  // v1.2
      matched = true;
      newPoints[categoryId] = (newPoints[categoryId] || 0) + 1;
    }
  });

勝利判定（DB クエリ対象が変更）:
  db.all('SELECT * FROM category_cards', (err, categoryCards) => {  // v1.2: job_cards → category_cards
    let hasWon = true;
    currentPlayer.categories.forEach(categoryId => {                 // v1.2: jobs → categories
      const cat = categoryCards.find(c => c.id === categoryId);
      if (cat && (currentPlayer.points[categoryId] || 0) < cat.targetPoints) {
        hasWon = false;
      }
    });
    ...
  });

全員ゴールチェック・ブロードキャスト処理は v1.1 と変更なし
```

---

### Prompt 3-4: ターン管理ハンドラ（nextTurn / resign / resetGame）**[v1.2変更]**

```
server.js に以下の3つのハンドラを実装してください。

## handleNextTurn(ws, data)
（v1.1と変更なし）
- currentPlayerIndex インクリメント、retired プレイヤーをスキップ
- session.drawnCards = [], session.diceValue = null
- ブロードキャスト: { type: 'nextTurn', session }

## handleResign(ws, data)
// 特殊ミッション「退職＆強制兼任」処理
const retiringPlayer  = session.players.find(p => p.id === data.playerId);
const targetPlayer    = session.players.find(p => p.id === data.targetPlayerId);

// 職種（カテゴリ）を targetPlayer に移譲（v1.2: jobs → categories）
targetPlayer.categories = [...targetPlayer.categories, ...retiringPlayer.categories];
retiringPlayer.categories.forEach(categoryId => {
  targetPlayer.points[categoryId] = targetPlayer.points[categoryId] ?? 0;
});

// 退職プレイヤーのリセット（v1.2: jobs → categories）
retiringPlayer.retired = true;
retiringPlayer.categories = [];
retiringPlayer.points = {};

ブロードキャスト: { type: 'playerRetired', retiredPlayerId: data.playerId, targetPlayerId: data.targetPlayerId, session }

## handleResetGame(ws, data)
session リセット（v1.1と同様）

全プレイヤーのリセット（v1.2: 変更箇所に注意）:
- categories = []          // v1.2: jobs → categories
- points = {}
- retired = false
- categorySelected = false  // v1.2: jobSelected → categorySelected
- selectedSkillCardIds = []
- finished = false
- finishRank = null

ブロードキャスト: { type: 'gameReset', session }
```

---

### Prompt 3-5: Express REST API の実装 **[v1.2変更]**

```
server.js に Express の REST API を実装してください。
仕様書 Section 5.9、Section 8、Section 10 を参照してください。

## ミドルウェア設定（変更なし）
app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

## requireAdmin ミドルウェア（変更なし）
Authorization: Bearer <token> を検証

## 認証 API（変更なし）
POST /api/auth/login

## カード取得 API（認証不要 — 配列を直接返す）[v1.2変更]
GET /api/cards/categories       → SELECT * FROM category_cards  （旧: /api/cards/jobs）
GET /api/cards/skills           → SELECT * FROM skill_cards
GET /api/cards/missions         → SELECT * FROM missions
GET /api/cards/mission-categories → SELECT * FROM mission_categories  （旧: /api/cards/categories）
GET /api/cards/skill-types      → SELECT * FROM skill_types ORDER BY sortOrder  （v1.2 新規）

## 多言語 API（変更なし）
GET /api/lang/:lang

## 管理 API（requireAdmin 必須）[v1.2変更]

### 職種カード（カテゴリ） — エンドポイント名変更
POST   /api/admin/categories        → INSERT category_cards, { ok: true, id: this.lastID }
PUT    /api/admin/categories/:id    → UPDATE category_cards SET ... WHERE id=?
DELETE /api/admin/categories/:id    → DELETE FROM category_cards WHERE id=?

### スキル区分 — v1.2 新規
POST   /api/admin/skill-types
PUT    /api/admin/skill-types/:id
DELETE /api/admin/skill-types/:id
フィールド: name_en, name_ja, model_type（'katz' | 'drucker'）, description_en, description_ja, sortOrder

### スキルカード（変更なし）
POST   /api/admin/skills
PUT    /api/admin/skills/:id
DELETE /api/admin/skills/:id

### ミッション（変更なし）
POST   /api/admin/missions
PUT    /api/admin/missions/:id
DELETE /api/admin/missions/:id

## CSV Import API（requireAdmin 必須）[v1.2変更]
POST /api/admin/import/:type
type: 'categories' | 'skills' | 'missions' | 'skill-types'  （v1.2: 'jobs' → 'categories'、'skill-types' 追加）
（その他ロジックは v1.1 と変更なし）

## ヘルスチェック（変更なし）
GET /api/health → { ok: true, timestamp: new Date().toISOString() }
```

**Claude Code 追加指示**:
```
REST API 実装後に npm start でサーバーを起動し、以下で動作確認してください。

curl http://localhost:3000/api/health
curl http://localhost:3000/api/cards/categories
curl http://localhost:3000/api/cards/skill-types
curl http://localhost:3000/api/cards/mission-categories
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

全て正常なレスポンスが返ることを確認してください。
```

---

## Phase 4: クライアントサイド実装

### Prompt 4-1: index.html の実装

（v1.1と変更なし — CSS変数・レイアウト・スタイル定義はそのまま）

```
#SDD_Specification_v1.2.md の Section 6 を参照して、index.html を実装してください。
CSS変数・レイアウト・スタイル定義は v1.1 と変更ありません。仕様書の Section 6 に従ってください。
```

---

### Prompt 4-2: game.js — I18n クラスと GameClient の骨格 **[v1.2変更]**

```
game.js を作成してください。

## I18n クラス（変更なし）
class I18n {
  constructor() { ... }
  async init() { ... }
  async loadTranslations(lang) { ... }
  async setLanguage(lang) { ... }
  t(key) { ... }
}
const i18n = new I18n();

## GameClient クラス（骨格）— v1.2 変更箇所に注意
constructor プロパティ:
- ws, language, sessionId, playerId, session, connected
- mode: 'menu' | 'lobby' | 'game'
- selectedCard, rolling, modal
- categoryCardsCache    // v1.2: jobCardsCache → categoryCardsCache
- skillCardsCache
- flippedCards: new Set()
- flippedCategoryCards: new Set()  // v1.2: flippedJobCards → flippedCategoryCards

async init():
1. await i18n.init()
2. this.language = i18n.currentLang
3. this.connect()
4. this.fetchCategoryCards()  // v1.2: fetchJobCards → fetchCategoryCards
5. this.fetchSkillCards()
6. this.render()

ヘルパーメソッド:
- t(key): return i18n.t(key)
- getRankEmoji(rank): { 1: '🥇', 2: '🥈', 3: '🥉' }[rank] ?? `${rank}位`
- send(data): WebSocket が OPEN なら JSON で送信
- async fetchCategoryCards(): GET /api/cards/categories → this.categoryCardsCache  // v1.2
- async fetchSkillCards(): GET /api/cards/skills → this.skillCardsCache

## 初期化
const game = new GameClient();
window.game = game;
game.init();
```

---

### Prompt 4-3: game.js — WebSocket 接続と受信ハンドラ **[v1.2変更]**

```
game.js の GameClient クラスに connect() と handleServerMessage() を追加してください。

## connect() メソッド（変更なし）

## handleServerMessage(data) — v1.2 変更箇所に注意

| type | 処理 |
|---|---|
| sessionCreated | sessionId, playerId, session を設定、mode = 'lobby'、render() |
| sessionJoined | 同上 |
| playerJoined | session 更新、render() |
| categorySelected | session 更新、render()  ← v1.2: jobSelected → categorySelected |
| gameStarted | session 更新、mode = 'game'、render() |
| diceRolled | session 更新、rolling = false、selectedCard = null、flippedCards.clear()、render() |
| cardSelected | session 更新、playerFinished なら getRankEmoji でゴールモーダル表示、render() |
| cardSelectedByOther | session 更新、render() |
| gameCompleted | session 更新、render()、1500ms 後に showFinalRankingsModal(data.finalRankings) |
| playerRetired | session 更新、退職通知モーダル表示、render() |
| nextTurn | session 更新、render() |
| gameReset | session 更新、mode = 'lobby'、render() |
| error | console.error、致命的なエラーは alert |

## updateConnectionIndicator()（変更なし）
```

---

### Prompt 4-4: game.js — メニュー・ロビー画面のレンダリング **[v1.2変更]**

```
game.js に render() と各画面のレンダリングメソッドを実装してください。

## render()（変更なし）

## renderMenu()（変更なし）

## createGame() / joinGame()（変更なし）

## renderLobby() — v1.2 変更箇所に注意
1. セッションID を大きく表示 + クリップボードコピーボタン
2. 参加プレイヤー一覧（名前、職種選択状況のバッジ）
   - player.categorySelected を参照（v1.2: jobSelected → categorySelected）
3. 職種選択UI（categoryCardsCache からカード一覧）:  // v1.2: jobCardsCache → categoryCardsCache
   - 他プレイヤー選択済み（player.categories に含まれる）: disabled + 選択者名表示
   - 自分が選択済み: 選択マーク（✓）付き強調表示
4. ホスト AND 全員 categorySelected 済みのとき「ゲーム開始」ボタン表示
5. ゲーム開始待ちメッセージ

## selectCategory(categoryId)  ← v1.2: selectJob → selectCategory
this.send({
  type: 'selectCategory',       // v1.2
  sessionId: this.sessionId,
  playerId: this.playerId,
  categoryId                    // v1.2: jobId → categoryId
});

## startGame() / copySessionId()（変更なし）
```

---

### Prompt 4-5: game.js — ゲーム画面のレンダリング **[v1.2変更]**

```
game.js に renderGame() と関連メソッドを実装してください。

## renderGame() レイアウト

左サイドバー (.player-sidebar):
各プレイヤーを表示:
- 現在のターンプレイヤー: ハイライト枠
- 名前
- 職種ごとのポイント表示: "職種名: 3/5 pt"
  → categoryCardsCache から categoryId で名前を引く（v1.2: jobCardsCache → categoryCardsCache）
  → player.categories を参照（v1.2: player.jobs → player.categories）
- 全職種達成済み: 🏆 アイコン + 順位バッジ（getRankEmoji）
- 退職済み: 「退職」グレーバッジ

メインエリア (.main-area):
- ターン表示ヘッダー
- 【自分のターン】サイコロボタン + カードエリア
- 【他プレイヤーのターン】"○○さんのターンです" + 観戦表示

カードグリッド・カード表裏・カード選択はすべて v1.1 と変更なし

## rollDice() / flipCard() / selectCard()（変更なし）
```

---

### Prompt 4-6: game.js — モーダルとイベントリスナー

（v1.1と変更なし）

```
game.js に以下のモーダル関連メソッドとイベントリスナーを実装してください。
showModal, closeModal, renderModal, handleModalAction, showFinalRankingsModal,
showPlayerSelectionModal, resetGame, attachEventListeners
は v1.1 と実装内容は変更なし。

ただし showPlayerSelectionModal 内で：
- player.categories を参照（v1.2: player.jobs → player.categories）
- アクティブなプレイヤー（retired=false）の一覧表示

退職処理送信:
this.send({ type: 'resign', sessionId, playerId: 退職対象Id, targetPlayerId: 引き継ぎId });
```

---

## Phase 5: 管理画面実装

### Prompt 5-1: admin.html の画面構造と CSS **[v1.2変更]**

```
admin.html を作成してください。
仕様書 Section 8 を参照してください。

## 画面構造（変更なし）
- #loginScreen: デフォルト表示
- #adminScreen: display:none（ログイン後に切り替え）

## タブナビゲーション（v1.2 変更）
data-tab 属性:
- categories:       職種カード        （v1.2: 旧 jobs）
- skill-types:      スキル区分        （v1.2: 新規）
- skills:           スキルカード
- missions:         ミッション
- mission-categories: ミッションカテゴリ  （v1.2: 旧 categories）

各タブコンテンツに:
1. テーブル（#categories-table、#skill-types-table 等）
2. 「新規追加」ボタン
3. CSV エクスポートボタン（skill-types は CSV エクスポート不要でも可）
4. CSV インポートエリア（ファイル選択 + #csv-preview + 取り込みボタン）

## スタイル（変更なし）
```

---

### Prompt 5-2: admin.html の JavaScript ロジック **[v1.2変更]**

```
admin.html の <script> タグに管理画面ロジックを実装してください。

## 状態変数（v1.2変更）
let adminToken = localStorage.getItem('admin_token');
let currentTab = 'categories';   // v1.2: 'jobs' → 'categories'
let editingId = null;
let currentCsvData = null;
let currentCsvType = null;
let allData = {
    categories: [],          // v1.2: jobs → categories
    skillTypes: [],          // v1.2: 新規
    skills: [],
    missions: [],
    missionCategories: []    // v1.2: categories → missionCategories
};

## loadData()（v1.2変更）
Promise.all で以下を並列取得:
- GET /api/cards/categories       → allData.categories
- GET /api/cards/skill-types      → allData.skillTypes   （v1.2 新規）
- GET /api/cards/skills           → allData.skills
- GET /api/cards/missions         → allData.missions
- GET /api/cards/mission-categories → allData.missionCategories

## renderTable(type)（v1.2変更）
type: 'categories' | 'skill-types' | 'skills' | 'missions' | 'mission-categories'

- categories: 旧 jobs と同じ構成（id, name_ja, name_en, targetPoints, 操作）
- skill-types: id, name_ja, name_en, model_type（Katz/Drucker バッジ表示）, 操作
- skills: id, name_ja, name_en, matchesCategories（職種名に変換）, 操作
  （v1.2: matchesJobs → matchesCategories、allData.jobs → allData.categories で変換）
- missions: id, name_ja, categoryId（missionCategories から名前を引く）, isSpecial, 操作

## スキルカードフォームの matchesCategories 処理（v1.2変更）
- 職種リストは allData.categories からチェックボックス生成
  （v1.2: allData.jobs → allData.categories）
- 保存時フィールド名: matchesCategories（v1.2: matchesJobs → matchesCategories）

## skill-types フォーム（v1.2 新規）
- name_en, name_ja（テキスト入力）
- model_type（セレクト: katz / drucker）
- description_en, description_ja（テキストエリア）
- sortOrder（数値入力）

## saveCard(type)（v1.2変更）
- type 'categories': PUT/POST /api/admin/categories
- type 'skill-types': PUT/POST /api/admin/skill-types（v1.2 新規）
- その他は変更なし

## deleteCard(type, id)（v1.2変更）
- DELETE /api/admin/categories/:id（旧 /api/admin/jobs/:id）
- DELETE /api/admin/skill-types/:id（v1.2 新規）

## exportCSV(type) / importCSV(type, file)（v1.2変更）
- type 'categories' を追加（旧 'jobs'）
- type 'skill-types' を追加（v1.2 新規）

## handleImageUpload / ログイン処理（変更なし）
```

---

## Phase 6: 多言語対応システム

### Prompt 6-1: lang/ja.json の作成 **[v1.2変更]**

```
lang/ja.json を作成してください。以下の全キーを含む完全な翻訳ファイルです。
v1.1 からの変更・追加箇所に注意してください。

{
  "common": {
    "language": "言語", "save": "保存", "cancel": "キャンセル",
    "close": "閉じる", "edit": "編集", "delete": "削除",
    "add": "追加", "confirm": "確認", "loading": "読み込み中..."
  },
  "game": {
    "title": "職種 × スキル カードゲーム",
    "subtitle": "キャリア教育カードゲーム",
    "createGame": "新しいゲームを作成",
    "joinGame": "ゲームに参加",
    "sessionId": "セッションID",
    "playerName": "プレイヤー名を入力してください",
    "join": "参加する",
    "lobby": "ロビー",
    "players": "プレイヤー",
    "selectCategory": "職種を選択してください",   ← v1.2: selectJob → selectCategory
    "categorySelected": "選択済み",               ← v1.2: jobSelected → categorySelected
    "startGame": "ゲームを開始",
    "waitingForPlayers": "他のプレイヤーの参加を待っています...",
    "waitingForCategorySelection": "全員が職種を選択するまでお待ちください",  ← v1.2: waitingForJobSelection
    "yourTurn": "あなたのターンです！",
    "otherTurn": "のターンです",
    "rollDice": "サイコロを振る",
    "rolling": "振っています...",
    "selectCard": "カードを選択してください",
    "cardSelectHint": "カードをクリックして選択 → もう一度クリックで確定",
    "viewDetails": "詳細を見る",
    "backToFront": "表に戻る",
    "points": "ポイント",
    "goal": "ゴール",
    "playerFinished": "ゴール達成！",
    "finishedRank": "が",
    "rankSuffix": "位でゴール",
    "allFinished": "全員がゴールしました！",
    "finalRankings": "最終順位",
    "playAgain": "もう一度遊ぶ",
    "backToMenu": "メニューへ",
    "copySessionId": "セッションIDをコピー",
    "copied": "コピーしました！",
    "retired": "退職",
    "resign": "退職・兼任",
    "selectPlayerToResign": "職種を引き継ぐプレイヤーを選んでください",
    "transferTo": "この人に引き継ぐ",
    "skillCard": "スキルカード",
    "missionCard": "ミッションカード",
    "specialMission": "特殊ミッション",
    "matched": "マッチ！ +1ポイント",
    "notMatched": "あなたの職種とはマッチしませんでした",
    "alreadySelected": "このカードは選択済みです（ポイント加算なし）",
    "diceResult": "サイコロの結果",
    "cardDrawn": "枚のカードが引かれました"
  },
  "admin": {
    "loginTitle": "管理者ログイン",
    "username": "ユーザー名",
    "password": "パスワード",
    "login": "ログイン",
    "loginError": "ユーザー名またはパスワードが正しくありません",
    "categoryCards": "職種カード",           ← v1.2: jobCards → categoryCards
    "skillTypes": "スキル区分",              ← v1.2: 新規
    "modelType": "モデル種別",              ← v1.2: 新規
    "modelTypeKatz": "Katzモデル",          ← v1.2: 新規
    "modelTypeDrucker": "Druckerモデル",    ← v1.2: 新規
    "skillCards": "スキルカード",
    "missions": "ミッション",
    "missionCategories": "ミッションカテゴリ",  ← v1.2: categories → missionCategories
    "addCard": "カードを追加",
    "editCard": "カードを編集",
    "deleteConfirm": "このカードを削除しますか？この操作は取り消せません。",
    "exportCSV": "CSVエクスポート",
    "importCSV": "CSVインポート",
    "selectFile": "ファイルを選択",
    "preview": "プレビュー確認",
    "executeImport": "取り込みを実行",
    "importResult": "取り込み結果",
    "inserted": "追加",
    "updated": "更新",
    "total": "合計",
    "imageUpload": "画像をアップロード",
    "targetPoints": "必要ポイント",
    "matchesCategories": "対応職種",         ← v1.2: matchesJobs → matchesCategories
    "category": "カテゴリ",
    "targetAudience": "実施対象",
    "isSpecial": "特殊ミッション"
  },
  "errors": {
    "UNAUTHORIZED": "認証が必要です",
    "SERVER_ERROR": "サーバーエラーが発生しました",
    "CATEGORY_TAKEN": "その職種はすでに選択されています",   ← v1.2: JOB_TAKEN → CATEGORY_TAKEN
    "SESSION_NOT_FOUND": "セッションが見つかりません",
    "GAME_ALREADY_STARTED": "ゲームはすでに開始されています",
    "SESSION_FULL": "セッションが満員です",
    "NOT_YOUR_TURN": "あなたのターンではありません"
  }
}
```

---

### Prompt 6-2: lang/en.json の作成 **[v1.2変更]**

```
lang/en.json を作成してください。
lang/ja.json と完全に同じキー構造で、英語翻訳を作成してください。

v1.2 の変更・追加キー（英語翻訳）:
- game.selectCategory: "Select a Job Role"
- game.categorySelected: "Selected"
- game.waitingForCategorySelection: "Waiting for all players to select a job role..."
- admin.categoryCards: "Job Role Cards"
- admin.skillTypes: "Skill Types"
- admin.modelType: "Model Type"
- admin.modelTypeKatz: "Katz Model"
- admin.modelTypeDrucker: "Drucker Model"
- admin.missionCategories: "Mission Categories"
- admin.matchesCategories: "Matching Job Roles"
- errors.CATEGORY_TAKEN: "That job role is already taken"

その他のキーは v1.1 と同一の英語翻訳を使用。
全キーを網羅した完全な JSON として出力してください。
```

---

## Phase 7: デプロイメント設定

### Prompt 7-1: systemd サービスファイル

（v1.1と変更なし）

---

### Prompt 7-2: Nginx リバースプロキシ設定

（v1.1と変更なし）

---

### Prompt 7-3: 本番環境一括セットアップスクリプト

（v1.1と変更なし）

---

## 補足: デバッグ・修正用プロンプト

### Prompt D-1: WebSocket 接続トラブルシューティング

（v1.1と変更なし）

---

### Prompt D-2: カード選択・ポイント計算のバグ修正 **[v1.2変更]**

```
スキルカード選択時にポイントが正しく加算されない問題を調査してください。

## 確認ポイント（server.js の handleSelectCard）

1. matchesCategories の型チェック（v1.2変更）:
   card.matchesCategories が配列（number[]）になっているか確認
   → rollDice で .split(',').map(Number) を実行しているか
   → カラム名が matchesCategories（旧: matchesJobs）になっているか
   → DBから取得したカードに matchesCategories カラムが存在するか（initdb で確認）

2. player.categories との比較（v1.2変更）:
   card.matchesCategories.includes(categoryId) の categoryId が number 型か
   → player.categories は number[] か string[] か確認（旧: player.jobs）

3. points の更新（変更なし）:
   newPoints[categoryId] = (newPoints[categoryId] || 0) + 1;
   の後に currentPlayer.points = newPoints; しているか

4. 勝利判定（v1.2変更）:
   db.all('SELECT * FROM category_cards', ...) で正しいテーブルを参照しているか
   （旧: 'SELECT * FROM job_cards'）
   category.targetPoints と player.points[categoryId] の型が一致しているか

実際のコードを確認して、問題箇所を特定・修正してください。
```

---

### Prompt D-3: 管理画面ログイン問題

（v1.1と変更なし）

---

### Prompt D-4: ゲームバランスのパラメータ調整

（v1.1と変更なし）

---

### Prompt D-5: 全体動作確認チェックリスト **[v1.2変更]**

```
以下のチェックリストを順番に実行して、全機能が正常に動作することを確認してください。
各項目の結果を ✅ または ❌ でまとめてください。

## API 動作確認
curl http://localhost:3000/api/health
→ { "ok": true, "timestamp": "..." } であること

curl http://localhost:3000/api/cards/categories
→ 6件の配列が返ること（v1.2: 旧 /api/cards/jobs）

curl http://localhost:3000/api/cards/skill-types
→ 3件の配列が返ること（model_type: "katz" を含む）（v1.2 新規）

curl http://localhost:3000/api/cards/skills
→ 23件の配列が返ること（matchesCategories がカンマ区切り文字列であること）
   （v1.2: matchesJobs ではなく matchesCategories であることを確認）

curl http://localhost:3000/api/cards/mission-categories
→ 4件の配列が返ること（v1.2: 旧 /api/cards/categories）

curl http://localhost:3000/api/lang/ja
→ { "ok": true, "translations": { "game": { "selectCategory": "職種を選択してください", ... } } } であること

curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
→ { "ok": true, "token": "..." } であること

## 静的ファイル配信確認（変更なし）
curl -I http://localhost:3000/
curl -I http://localhost:3000/admin.html

## WebSocket 動作確認（ブラウザ手動テスト項目）
□ http://localhost:3000 でゲーム画面が表示される
□ 接続インジケーターが 🟢 Connected になる
□ 言語切り替え（EN/日本語）が動作する
□ 「新しいゲームを作成」でセッションIDが表示される
□ 2つ目のウィンドウで参加できる
□ 両ウィンドウで職種を選択できる（重複選択が弾かれる）
□ categorySelected メッセージが正しく届いてUI更新される（v1.2確認）
□ ゲーム開始 → サイコロ → カード選択 → ターン交代の一連が動作する
□ ポイントが category_cards の targetPoints まで貯まるとゴール判定される（v1.2確認）

## 管理画面確認（v1.2変更）
□ /admin.html でログイン画面が表示される
□ admin/admin123 でログインできる
□ 「職種カード」タブ（categories）に一覧が表示される
□ 「スキル区分」タブ（skill-types）に Katz モデルの3件が表示される（v1.2確認）
□ 「スキルカード」の対応職種が matchesCategories で表示される（v1.2確認）
□ 新規カード追加→保存→一覧更新が動作する
□ CSV エクスポートでファイルがダウンロードされる

問題がある項目は修正してから再確認してください。
```

---

### Prompt D-6: v1.1 → v1.2 移行確認 **[v1.2新規]**

```
既存の v1.1 コードベースを v1.2 に移行するための確認と修正を行ってください。

## Step 1: DBマイグレーション
game.db が v1.1 のまま（job_cards テーブルが存在する）場合は、
SDD_Specification_v1.2.md Section 12.5 の SQLを実行してください。
または npm run initdb で全リセットしてください（サンプルデータのみ可なら推奨）。

## Step 2: server.js の一括確認
以下を grep で確認し、残存する v1.1 の記述を修正してください。

grep -n "job_cards" server.js        → 0件であること（category_cards に変更済みか）
grep -n "matchesJobs" server.js      → 0件であること（matchesCategories に変更済みか）
grep -n "selectJob" server.js        → 0件であること（selectCategory に変更済みか）
grep -n "jobSelected" server.js      → 0件であること（categorySelected に変更済みか）
grep -n "player\.jobs" server.js     → 0件であること（player.categories に変更済みか）
grep -n "handleSelectJob" server.js  → 0件であること（handleSelectCategory に変更済みか）

## Step 3: game.js の一括確認
grep -n "jobCardsCache" game.js      → 0件であること
grep -n "fetchJobCards" game.js      → 0件であること
grep -n "selectJob" game.js          → 0件であること
grep -n "jobSelected" game.js        → 0件であること
grep -n "player\.jobs" game.js       → 0件であること
grep -n "/api/cards/jobs" game.js    → 0件であること

## Step 4: admin.html の一括確認
grep -n "allData\.jobs" admin.html   → 0件であること
grep -n "matchesJobs" admin.html     → 0件であること
grep -n "/api/admin/jobs" admin.html → 0件であること
grep -n "data-tab=\"jobs\"" admin.html → 0件であること

## Step 5: lang ファイルの確認
grep -n "selectJob" lang/ja.json     → 0件であること（selectCategory に変更済みか）
grep -n "JOB_TAKEN" lang/ja.json     → 0件であること（CATEGORY_TAKEN に変更済みか）
grep -n "selectJob" lang/en.json     → 0件であること
grep -n "JOB_TAKEN" lang/en.json     → 0件であること

残存する v1.1 記述があれば修正し、最後に Prompt D-5 のチェックリストを実行してください。
```

---

## 📝 実装メモ（Claude Code 利用時の推奨ワークフロー）

```
# 推奨の作業フロー

1. リポジトリのセットアップ
   git init
   git remote add origin <GitHub URL>

2. CLAUDE.md を配置（Prompt 1-3 で生成）
   → claude コマンド起動時に自動で読み込まれる

3. フェーズごとに実装と確認を繰り返す
   Phase 1 → npm install の確認
   Phase 2 → npm run initdb && node check-db.js
   Phase 3 → npm start && curl で API 確認
   Phase 4 → ブラウザで目視確認
   Phase 5 → 管理画面でログイン確認
   Phase 6 → 言語切り替え確認
   Phase 7 → 本番サーバーへのデプロイ

4. v1.2 固有の確認
   - curl /api/cards/categories で職種カードが返ること
   - curl /api/cards/skill-types でスキル区分が返ること
   - curl /api/cards/mission-categories でミッションカテゴリが返ること
   - ブラウザで categorySelected メッセージが正しく処理されること
   - 管理画面でスキル区分タブが動作すること

5. コミットのタイミング
   各 Phase 完了時にコミットすることを推奨:
   git add .
   git commit -m "feat: Phase N completed - [内容]"
   git tag v1.2 # 全 Phase 完了後
```

---

*仕様書*: `SDD_Specification_v1.2.md`  
*GitHub タグ*: `v1.2`  
*プロンプト集バージョン*: `v1.2-implementation-prompts`  
*最終更新*: 2026-06-13
