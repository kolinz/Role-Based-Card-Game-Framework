# Role-Based Card Game Framework — 再現実装プロンプト集 v1.2.1

> **仕様書**: `SDD_Specification_v1.2.1_full.md`  
> **GitHub タグ**: `v1.2.1`  
> **最終更新**: 2026-06-13

---

## 🛠️ このドキュメントの使い方

このプロンプト集は **2つのツール** に対応しています。

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
2. `#SDD_Specification_v1.2.1_full.md` で仕様書を参照させる
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
- [補足: デバッグ・動作確認用プロンプト](#補足-デバッグ動作確認用プロンプト)

---

## Phase 1: プロジェクト初期化

### Prompt 1-1: 設定ファイルの一括生成

```
以下の4ファイルを作成してください。

## package.json
{
  "name": "career-skills-card-game",
  "version": "1.2.1",
  "description": "Online multiplayer career and skills card game",
  "main": "server.js",
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "initdb": "node initdb.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.14.2",
    "better-sqlite3": "^12.8.0",
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

## .env.example → .env のコピーコマンド
cp .env.example .env
```

---

### Prompt 1-2: ディレクトリ構造とスケルトンファイルの作成

**Claude Code 向け（推奨）**

```
以下のディレクトリ構造を作成し、各ファイルを空のスケルトン状態で用意してください。
package.json/.env.example/.gitignore はすでに作成済みです。

Role-Based-Card-Game-Framework/
├── server.js
├── index.html
├── game.js
├── admin.html
├── initdb.js
└── lang/
    ├── en.json
    └── ja.json

作成後、以下を実行してください:
npm install
cp .env.example .env

better-sqlite3 はネイティブアドオンです。ビルドエラーが出た場合は:
npm install --build-from-source
```

**Claude.ai 向け（bash コマンド生成）**

```
以下のプロジェクト構造を作るための bash スクリプトを出力してください。
mkdir・touch コマンドを使い、npm install と cp .env.example .env も含めてください。

構造:
- ルート: server.js, index.html, game.js, admin.html, initdb.js
- サブディレクトリ: lang/en.json, lang/ja.json
```

---

### Prompt 1-3: CLAUDE.md の作成（Claude Code 専用）

```
このプロジェクト用の CLAUDE.md を作成してください。

## プロジェクト概要
- 職種×スキル カードゲーム（キャリア教育向けオンラインマルチプレイヤーカードゲーム）
- 仕様書: SDD_Specification_v1.2.1_full.md を参照

## カード階層（v1.2.1）
カテゴリ（大分類）= 職種 → category_cards テーブル
スキル区分（中分類）= 理論モデルによる分類 → skill_types テーブル（model_type は自由記述）
スキル（小分類）= 個別スキルカード → skill_cards テーブル

## 技術スタック
- Node.js 24以上（"type": "module" でESM使用）
- バックエンド: Express + WebSocket (ws) + better-sqlite3（同期API）
- フロントエンド: Vanilla JavaScript
- DB: SQLite (game.db)、WALモード有効
- 認証: Bearer token（24時間有効）

## ファイル構成
- server.js: Express + WebSocket サーバー（メインエントリーポイント）
- index.html + game.js: ゲームクライアント
- admin.html: 管理画面（認証必須）
- initdb.js: DB初期化スクリプト（npm run initdb）
- lang/ja.json, lang/en.json: 翻訳ファイル

## 重要なコーディング規約
- ESM: import/export を使用（require は使わない）
- better-sqlite3 API:
  - 全件取得: db.prepare(sql).all()
  - 1件取得: db.prepare(sql).get(params)
  - 実行: db.prepare(sql).run(params) → result.lastInsertRowid
  - トランザクション: db.transaction(fn)()
  - エラー処理: try/catch（コールバック不要）
- API レスポンス: カード取得系は配列を直接返す（{ ok, data } ラッパーなし）
- 認証系・管理系は { ok: true/false, error: { code, message } } 形式
- WebSocket メッセージは { type: string, ...payload } 形式
- matchesCategories はDB上カンマ区切り文字列、JS処理時は .split(',').map(Number) で配列化

## WebSocket type 一覧（送受信）
クライアント→サーバー:
  createSession, joinSession, selectCategory, startGame,
  rollDice, selectCard, nextTurn, resign, resetGame
サーバー→クライアント:
  sessionCreated, sessionJoined, playerJoined, categorySelected,
  gameStarted, diceRolled, cardSelected, cardSelectedByOther,
  gameCompleted, playerRetired, nextTurn, gameReset, error

## REST API エンドポイント一覧
GET  /api/cards/categories         → category_cards 全件
GET  /api/cards/skills             → skill_cards 全件
GET  /api/cards/missions           → missions 全件
GET  /api/cards/mission-categories → mission_categories 全件
GET  /api/cards/skill-types        → skill_types 全件（sortOrder順）
GET  /api/lang/:lang               → 翻訳ファイル
POST /api/auth/login               → 管理者ログイン
POST/PUT/DELETE /api/admin/categories/:id
POST/PUT/DELETE /api/admin/skill-types/:id
POST/PUT/DELETE /api/admin/skills/:id
POST/PUT/DELETE /api/admin/missions/:id
POST /api/admin/import/:type       → CSV一括インポート
GET  /api/health                   → ヘルスチェック

## プレイヤーオブジェクト構造
{
  id, name,
  categories: [],         // 選択した職種IDの配列
  points: {},             // { categoryId: number }
  retired: false,
  categorySelected: false,
  selectedSkillCardIds: [],
  finished: false,
  finishRank: null
}

## よく使うコマンド
- npm start: サーバー起動
- npm run dev: nodemon で開発起動
- npm run initdb: DB初期化（全データ削除・再作成）
- node --version: Node.js 24以上であることを確認

## 注意事項
- .env は .gitignore に含まれるため .env.example からコピーして使用
- game.db は自動生成されるため Git に含めない
- Base64 画像は最大 800×800px、JPEG 品質 75% でリサイズ
- better-sqlite3 はネイティブアドオン。Node.js メジャーバージョン変更後は npm rebuild better-sqlite3 を実行
```

---

## Phase 2: データベース設計と初期化

### Prompt 2-1: initdb.js の完全実装

**Claude.ai 向け**
> 生成されたコードを `initdb.js` に保存後、`npm run initdb` で実行してください。

**Claude Code 向け**
> ファイル作成後に自動実行まで依頼できます。

```
#SDD_Specification_v1.2.1_full.md の Section 4 を参照して、initdb.js を完全実装してください。

## 技術要件
- ESM（import/export）を使用
- better-sqlite3 の同期API を使用
- db.transaction() で全挿入をまとめてアトミックに実行
- db.pragma('journal_mode = WAL') を起動直後に設定

## 処理の流れ
1. 既存の game.db を削除（fs.existsSync でチェック）
2. new Database('./game.db') で接続
3. db.pragma('journal_mode = WAL')
4. db.transaction() 内で:
   a. db.exec() で5テーブルを一括作成
   b. db.prepare().run() でサンプルデータを挿入
5. init() を呼び出して実行
6. 完了メッセージを表示して db.close()

## 作成するテーブル（5テーブル）
仕様書 Section 4.2 の CREATE TABLE 定義をそのまま使用:
- mission_categories（4件）
- category_cards（6件）
- skill_types（3件: Katzモデル）
- skill_cards（23件）
- missions（40件: 通常39 + 特殊1）

## サンプルデータ
仕様書 Section 4.2〜4.3 に記載の全データを使用。
missions の詳細な内容（name_en/ja, descriptionHtml_en/ja, categoryId, target_en/ja, isSpecial）は
仕様書 Section 4.3 の initdb.js サンプルコードをそのまま使用してください。

## 完了メッセージ
console.log('Database initialized successfully!');
console.log('Tables: mission_categories(4), category_cards(6), skill_types(3), skill_cards(23), missions(40)');
```

**Claude Code 追加指示**:
```
initdb.js の実装が完了したら、npm run initdb を実行して正常に完了することを確認してください。
エラーが出た場合は修正して再実行してください。
```

---

### Prompt 2-2: DB 確認スクリプトの作成と実行

```
check-db.js を作成して実行し、データベースが正しく初期化されているか確認してください。
better-sqlite3 の同期APIを使用してください（ESMで記述）。

## 確認項目
1. 各テーブルのレコード件数:
   - mission_categories: 4件
   - category_cards: 6件
   - skill_types: 3件
   - skill_cards: 23件
   - missions: 40件（うち isSpecial=1 が 1件）

2. category_cards の全レコード（id, name_ja, targetPoints）を表示

3. skill_types の全レコード（id, name_ja, model_type）を表示

4. skill_cards 先頭5件の matchesCategories の値を表示
   （カラム名が matchesCategories であることを確認）

## 確認コード例（better-sqlite3 同期API）
import Database from 'better-sqlite3';
const db = new Database('./game.db', { readonly: true });
const count = db.prepare('SELECT COUNT(*) as cnt FROM category_cards').get().cnt;

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

### Prompt 3-1: server.js の骨格（初期化・グローバル変数・ユーティリティ）

```
#SDD_Specification_v1.2.1_full.md の Section 5 を参照して、server.js の基本骨格を実装してください。

## ESM とインポート
import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

## サーバーと DB の初期化
- Express アプリ、http.createServer、WebSocketServer をサーバーに紐付け
- const db = new Database('./game.db')
- db.pragma('journal_mode = WAL')
- db.pragma('foreign_keys = ON')

## グローバル変数
const gameSessions = new Map();  // Map<sessionId, session>
const clients = new Map();       // Map<sessionId, Map<playerId, WebSocket>>
const adminTokens = new Map();   // Map<token, { username, expiry }>
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

function generateSessionId() {
    return uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
}

## ユーティリティ関数
broadcast(sessionId, message, excludePlayerId = null):
  - clients Map からセッションクライアントを取得
  - JSON.stringify(message) を事前に1回だけ実行してから各クライアントに送信
  - ws.readyState === WebSocket.OPEN のものだけ送信

sendToPlayer(sessionId, playerId, message):
  - clients.get(sessionId)?.get(playerId) でWSを取得
  - readyState チェックして送信

## WebSocket 接続ハンドラの骨格
wss.on('connection', (ws) => {
  let currentSessionId = null;
  let currentPlayerId = null;

  ws.on('message', (message) => {
    // JSON パース → try/catch → switch(data.type) で各ハンドラ呼び出し
    // type 一覧: createSession, joinSession, selectCategory, startGame,
    //            rollDice, selectCard, nextTurn, resign, resetGame
    // エラー時: ws.send({ type: 'error', error: { code: 'SERVER_ERROR', message } })
  });

  ws.on('close', () => {
    clients.get(currentSessionId)?.delete(currentPlayerId);
  });
});

## サーバー起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

ハンドラ関数は // TODO: implement のスタブとして定義だけしておいてください。
```

---

### Prompt 3-2: セッション管理ハンドラ（createSession / joinSession / selectCategory / startGame）

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
    categories: [],           // 選択した職種IDの配列
    points: {},               // { categoryId: number }
    retired: false,
    categorySelected: false,
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
gameSessions と clients に登録し、currentSessionId/currentPlayerId を更新。
送信: { type: 'sessionCreated', sessionId, playerId, session }

## handleJoinSession(ws, data)
バリデーション（エラー時は ws.send でエラー返却）:
- セッションが存在しない → SESSION_NOT_FOUND
- players.length >= maxPlayers → SESSION_FULL
- gameStarted === true → GAME_ALREADY_STARTED

新プレイヤーを session.players に push（categories/categorySelected を含む新構造）
送信（本人）: { type: 'sessionJoined', playerId, session }
ブロードキャスト（他全員）: { type: 'playerJoined', session }

## handleSelectCategory(ws, data)
バリデーション:
- 他プレイヤーが同じ categoryId を選択済みなら → CATEGORY_TAKEN エラー

player.categories に data.categoryId を push
player.categorySelected = true
ブロードキャスト: { type: 'categorySelected', playerId, categoryId: data.categoryId, session }

## handleStartGame(ws, data)
バリデーション:
- data.playerId !== session.hostPlayerId → UNAUTHORIZED エラー
- 全プレイヤーが categorySelected !== true → NOT_READY エラー「まだ職種未選択のプレイヤーがいます」

session.gameStarted = true
ブロードキャスト: { type: 'gameStarted', session }
```

---

### Prompt 3-3: ゲームコアハンドラ（rollDice / selectCard）

```
server.js に handleRollDice と handleSelectCard を実装してください。
仕様書 Section 5.6、5.7、9章 を参照してください。
better-sqlite3 の同期API（db.prepare().all()）を使用してください。

## handleRollDice(ws, data)

【サイコロ】
const diceValue = Math.floor(Math.random() * 6) + 1;
session.diceValue = diceValue;

【カード取得（better-sqlite3 同期API: ネストなし）】
const skillCards      = db.prepare('SELECT * FROM skill_cards').all();
const regularMissions = db.prepare('SELECT * FROM missions WHERE isSpecial = 0').all();
const specialMissions = db.prepare('SELECT * FROM missions WHERE isSpecial = 1').all();

【allCards 配列の構築】
- スキルカード: type: 'skill', matchesCategories: c.matchesCategories?.split(',').map(Number) ?? []
- 通常ミッション: type: 'mission'

【在庫管理】
availableCards = allCards.filter(c => !session.usedCardIds.includes(c.id))
7枚以下なら session.usedCardIds = [] でリセット後 availableCards = [...allCards]

【特殊ミッション（10%確率）】
if (specialMissions.length > 0 && Math.random() < 0.1) {
  未使用なら availableCards に push（type: 'special'）
}

【ランダム抽選（Set で重複防止、diceValue 枚）】

ブロードキャスト: { type: 'diceRolled', diceValue, drawnCards, session }

## handleSelectCard(ws, data)

【共通処理】
- drawnCards から card を検索
- selectedCardsHistory に追加
- usedCardIds に追加（重複なし）

【スキルカード (type === 'skill')】
1. 再選択チェック: selectedSkillCardIds.includes(card.id) → alreadySelected = true
2. 初回: player.categories と card.matchesCategories の積集合でマッチング
   - マッチした categoryId ごとに newPoints[categoryId] += 1
   - selectedSkillCardIds に push
3. 勝利判定（better-sqlite3 同期API）:
   const categoryCards = db.prepare('SELECT * FROM category_cards').all();
   player.categories.every(catId => {
     const cat = categoryCards.find(c => c.id === catId);
     return (player.points[catId] || 0) >= cat.targetPoints;
   });
4. ゴール達成時: finished = true, finishRank を設定
5. 全員ゴールチェック（retired を除く全員が finished）:
   - allFinished = true, finalRankings を生成
6. ws.send: { type: 'cardSelected', matched, alreadySelected, pointsUpdated,
              playerFinished?, finishRank?, allFinished?, finalRankings?, session }
7. broadcast（他プレイヤー）: { type: 'cardSelectedByOther', playerId, cardType: 'skill', session }
8. allFinished なら broadcast: { type: 'gameCompleted', finalRankings, session }

【ミッション/特殊カード】
broadcast: { type: 'cardSelected', card, session }
```

---

### Prompt 3-4: ターン管理ハンドラ（nextTurn / resign / resetGame）

```
server.js に以下の3つのハンドラを実装してください。

## handleNextTurn(ws, data)
- currentPlayerIndex を (index + 1) % players.length でインクリメント
- retired プレイヤーをスキップ（最大 players.length 回ループ）
- session.drawnCards = [], session.diceValue = null
- ブロードキャスト: { type: 'nextTurn', session }

## handleResign(ws, data)
// 特殊ミッション「退職＆強制兼任」処理
const retiringPlayer = session.players.find(p => p.id === data.playerId);
const targetPlayer   = session.players.find(p => p.id === data.targetPlayerId);

// 職種（カテゴリ）を targetPlayer に移譲
targetPlayer.categories = [...targetPlayer.categories, ...retiringPlayer.categories];
retiringPlayer.categories.forEach(categoryId => {
    targetPlayer.points[categoryId] = targetPlayer.points[categoryId] ?? 0;
});

// 退職プレイヤーのリセット
retiringPlayer.retired = true;
retiringPlayer.categories = [];
retiringPlayer.points = {};

ブロードキャスト: { type: 'playerRetired', retiredPlayerId, targetPlayerId, session }

## handleResetGame(ws, data)
Object.assign でセッションをリセット:
  gameStarted=false, currentPlayerIndex=0, drawnCards=[], selectedCardsHistory=[],
  usedCardIds=[], finishedPlayers=[], allFinished=false, diceValue=null

players.forEach で各プレイヤーをリセット:
  categories=[], points={}, retired=false, categorySelected=false,
  selectedSkillCardIds=[], finished=false, finishRank=null

ブロードキャスト: { type: 'gameReset', session }
```

---

### Prompt 3-5: Express REST API の実装

```
server.js に Express の REST API を実装してください。
仕様書 Section 5.9 を参照してください。
全DBクエリは better-sqlite3 の同期API（try/catch でエラー処理）を使用してください。

## ミドルウェア設定
app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

## requireAdmin ミドルウェア
Authorization: Bearer <token> を検証
- トークン不在: 401 { ok: false, error: { code: 'UNAUTHORIZED', message: 'Token required' } }
- 無効トークン: 401 UNAUTHORIZED
- 期限切れ: adminTokens から削除して 401
- 有効: req.admin = tokenData → next()

## 認証 API
POST /api/auth/login
- 一致: token を adminTokens に登録し { ok: true, token, expiresIn }
- 不一致: 401
- console.log でデバッグ出力（=== LOGIN ATTEMPT === 形式）

## カード取得 API（認証不要 — 配列を直接返す）
GET /api/cards/categories        → db.prepare('SELECT * FROM category_cards').all()
GET /api/cards/skills            → db.prepare('SELECT * FROM skill_cards').all()
GET /api/cards/missions          → db.prepare('SELECT * FROM missions').all()
GET /api/cards/mission-categories → db.prepare('SELECT * FROM mission_categories').all()
GET /api/cards/skill-types       → db.prepare('SELECT * FROM skill_types ORDER BY sortOrder').all()
全て try/catch で 500 エラーを返す

## 多言語 API（認証不要）
GET /api/lang/:lang
- join(__dirname, 'lang', `${lang}.json`) でファイルパス構築
- existsSync でチェック → なければ 404
- readFileSync で読み込み JSON.parse → { ok: true, translations }

## 管理 API（requireAdmin 必須）
各エンドポイントで { ok: true } または { ok: false, error } を返すこと。
INSERT後は result.lastInsertRowid を使用（this.lastID は使わない）。

### 職種カード（category_cards）
POST   /api/admin/categories      → INSERT、{ ok: true, id: result.lastInsertRowid }
PUT    /api/admin/categories/:id  → UPDATE
DELETE /api/admin/categories/:id  → DELETE

### スキル区分（skill_types）
POST   /api/admin/skill-types
PUT    /api/admin/skill-types/:id
DELETE /api/admin/skill-types/:id

### スキルカード（skill_cards）
POST   /api/admin/skills
PUT    /api/admin/skills/:id
DELETE /api/admin/skills/:id

### ミッション（missions）
POST   /api/admin/missions
PUT    /api/admin/missions/:id
DELETE /api/admin/missions/:id

## CSV Import API（requireAdmin 必須）
POST /api/admin/import/:type  （type: 'categories' | 'skills' | 'missions' | 'skill-types'）
- body: { csvData: [{...}, ...], preview: boolean }
- preview=true: DB 書き込みなし、{ ok: true, preview: true, total: number } を返す
- preview=false: db.transaction() で一括処理（高速・アトミック）
  - row.id あり → UPDATE、なし → INSERT
  - { ok: true, inserted, updated, total } を返す

tableMap:
  categories: 'category_cards'
  skills: 'skill_cards'
  missions: 'missions'
  'skill-types': 'skill_types'

## ヘルスチェック
GET /api/health → { ok: true, timestamp: new Date().toISOString() }
```

**Claude Code 追加指示**:
```
REST API 実装後に npm start でサーバーを起動し、以下で動作確認してください:

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

```
#SDD_Specification_v1.2.1_full.md の Section 6 を参照して、index.html を実装してください。

## 基本要件
- <html lang="ja">（言語切り替えで動的変更）
- Google Fonts: Outfit (400,500,600,700,800), DM Sans (400,500,600,700)
- <div id="app"> がメインのレンダリング対象

## CSS 変数（:root）
--primary: #6366f1
--primary-dark: #4f46e5
--secondary: #f59e0b
--success: #10b981
--danger: #ef4444
--bg: #0f0f23
--card-bg: #1a1a3e
--text: #e2e8f0
--text-secondary: #94a3b8
--border: rgba(255,255,255,0.1)
--shadow: 0 20px 60px rgba(0,0,0,0.5)

## 主要スタイル

### body
background: var(--bg); color: var(--text);
font-family: 'Outfit', sans-serif; min-height: 100vh;

### 接続状態インジケーター（#connection-indicator）
右上に position: fixed で常時表示。
🟢 Connected / 🔴 Disconnected を表示。

### .simple-card
border-radius: 16px; min-height: 200px; cursor: pointer;
transition: transform 0.2s; hover で translateY(-4px)
.disabled → opacity: 0.4; cursor: not-allowed; pointer-events: none;
.selected → outline: 3px solid var(--primary);

### .cards-grid
display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px;

### .btn-primary / .btn-secondary / .btn-danger
border-radius: 12px; padding: 12px 24px; font-weight: 600;

### .modal-overlay / .modal
overlay: position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:1000;
modal: 中央配置; max-width:600px; background:var(--card-bg); border-radius:20px; padding:32px;

### .lang-toggle
右上に配置。EN / 日本語 のトグルボタン。active クラスで強調表示。

## ゲームレイアウト（.game-layout）
左サイドバー（.player-sidebar）+ メインエリア（.main-area）の2カラム構成
レスポンシブ: 768px 以下でシングルカラム

## body 末尾
<div id="connection-indicator">⚪ Connecting...</div>
<div id="app"><p>読み込み中...</p></div>
<script src="game.js"></script>
```

---

### Prompt 4-2: game.js — I18n クラスと GameClient の骨格

```
game.js を作成してください。
仕様書 Section 6.1 を参照してください。

## I18n クラス
class I18n {
  constructor() {
    this.translations = {};
    this.currentLang = localStorage.getItem('language') ||
                       (navigator.language.startsWith('ja') ? 'ja' : 'en');
  }

  async init() { await this.loadTranslations(this.currentLang); }

  async loadTranslations(lang) {
    // GET /api/lang/${lang} を fetch
    // 成功: this.translations = data.translations, localStorage 保存, return true
    // 失敗: console.error, return false
  }

  async setLanguage(lang) {
    const success = await this.loadTranslations(lang);
    if (success) {
      this.currentLang = lang;
      document.documentElement.lang = lang;
      if (window.game) window.game.language = lang;
      window.game?.render();
    }
  }

  t(key) {
    // "game.title" のようなドット区切りキーを解決
    // 見つからなければ key をそのまま返す
    const keys = key.split('.');
    let value = this.translations;
    for (const k of keys) { value = value?.[k]; }
    return value || key;
  }
}

const i18n = new I18n();

## GameClient クラス（骨格のみ）
constructor プロパティ:
- ws, language, sessionId, playerId, session, connected
- mode: 'menu' | 'lobby' | 'game'
- selectedCard, rolling, modal
- categoryCardsCache: []   // 旧: jobCardsCache
- skillCardsCache: []
- flippedCards: new Set()
- flippedCategoryCards: new Set()

async init():
1. await i18n.init()
2. this.language = i18n.currentLang
3. this.connect()
4. this.fetchCategoryCards()   // GET /api/cards/categories
5. this.fetchSkillCards()      // GET /api/cards/skills
6. this.render()

ヘルパーメソッド:
- t(key): return i18n.t(key)
- getRankEmoji(rank): { 1: '🥇', 2: '🥈', 3: '🥉' }[rank] ?? `${rank}位`
- send(data): ws が OPEN なら JSON で送信
- async fetchCategoryCards(): GET /api/cards/categories → this.categoryCardsCache
- async fetchSkillCards(): GET /api/cards/skills → this.skillCardsCache

## 初期化
const game = new GameClient();
window.game = game;
game.init();
```

---

### Prompt 4-3: game.js — WebSocket 接続と受信ハンドラ

```
game.js の GameClient クラスに connect() と handleServerMessage() を追加してください。
仕様書 Section 6.2 を参照してください。

## connect() メソッド
- プロトコル判定: location.protocol === 'https:' → wss: else ws:
- 接続先: `${protocol}//${window.location.host}`
- onopen: connected = true, updateConnectionIndicator(), render()
- onclose: connected = false, updateConnectionIndicator(), render(), 3秒後に再接続
- onmessage: JSON.parse → handleServerMessage(data)
- onerror: console.error

## updateConnectionIndicator()
#connection-indicator の innerHTML を更新:
- connected: '🟢 Connected'
- disconnected: '🔴 Disconnected'

## handleServerMessage(data) — data.type で分岐

| type | 処理 |
|---|---|
| sessionCreated | sessionId/playerId/session を設定、mode='lobby'、render() |
| sessionJoined | sessionId=data.session.id、playerId/session を設定、mode='lobby'、render() |
| playerJoined | session 更新、render() |
| categorySelected | session 更新、render() |
| gameStarted | session 更新、mode='game'、render() |
| diceRolled | session 更新、rolling=false、selectedCard=null、flippedCards.clear()、render() |
| cardSelected | session 更新、playerFinished なら getRankEmoji でゴールモーダル表示、render() |
| cardSelectedByOther | session 更新、render() |
| gameCompleted | session 更新、render()、1500ms 後に showFinalRankingsModal(data.finalRankings) |
| playerRetired | session 更新、退職通知モーダル表示、render() |
| nextTurn | session 更新、render() |
| gameReset | session 更新、mode='lobby'、render() |
| error | console.error、SESSION_NOT_FOUND/SESSION_FULL/GAME_ALREADY_STARTED は alert |
```

---

### Prompt 4-4: game.js — メニュー・ロビー画面のレンダリング

```
game.js に render() と各画面のレンダリングメソッドを実装してください。
仕様書 Section 6.3 を参照してください。

## render()
app.innerHTML を this.mode に応じた HTML で更新
modal がある場合は html に追加
attachEventListeners() を最後に呼ぶ

## renderMenu()
1. 右上: .lang-toggle（EN / 日本語、data-lang 属性で切り替え）
2. 中央: ゲームタイトル（this.t('game.title')）、サブタイトル
3. 「新しいゲームを作成」ボタン → onclick="game.createGame()"
4. 「ゲームに参加」フォーム:
   - #join-session-id（セッションID入力）
   - #join-player-name（プレイヤー名入力）
   - 参加ボタン → onclick="game.joinGame()"
5. 未接続時: ボタンを disabled にして loading テキスト表示

## createGame()
const name = prompt(this.t('game.playerName'));
if (!name) return;
this.send({ type: 'createSession', playerName: name, maxPlayers: 4 });

## joinGame()
const sessionId = document.getElementById('join-session-id').value.trim().toUpperCase();
const playerName = document.getElementById('join-player-name').value.trim();
if (!sessionId || !playerName) return alert('セッションIDとプレイヤー名を入力してください');
this.send({ type: 'joinSession', sessionId, playerName });

## renderLobby()
1. セッションID を大きく表示 + クリップボードコピーボタン
2. 参加プレイヤー一覧（名前、categorySelected のバッジ）
3. 職種選択UI（categoryCardsCache からカード一覧）:
   - 他プレイヤーが選択済み（p.categories.includes(cat.id)）: disabled + 選択者名表示
   - 自分が選択済み（myPlayer.categories.includes(cat.id)）: .selected クラス + ✓ マーク
4. ホスト AND 全員 categorySelected 済みのとき「ゲーム開始」ボタン表示
5. それ以外: this.t('game.waitingForCategorySelection') 表示

## selectCategory(categoryId)
this.send({ type: 'selectCategory', sessionId, playerId, categoryId });

## startGame()
this.send({ type: 'startGame', sessionId, playerId });

## copySessionId()
navigator.clipboard.writeText(this.sessionId)
  .then(() => { /* トースト or alert で "コピーしました！" */ })
  .catch(() => { alert(this.sessionId); });
```

---

### Prompt 4-5: game.js — ゲーム画面のレンダリング

```
game.js に renderGame()、renderCards() と関連メソッドを実装してください。
仕様書 Section 6.4 を参照してください。

## renderGame() レイアウト

左サイドバー (.player-sidebar):
各プレイヤーを .player-card で表示:
- 現在のターンプレイヤー: .current-turn クラスでハイライト
- 名前
- 退職済み: .badge-retired
- 職種ごとのポイント表示（退職していない場合）:
  player.categories.map(catId => {
    const cat = this.categoryCardsCache.find(c => c.id === catId);
    return `${cat.name_XX}: ${player.points[catId] || 0}/${cat.targetPoints} pt`
  })
  ※ name_XX は name_ja または name_en（this.language で切り替え）
- 全職種達成済み: 🏆 + getRankEmoji(finishRank)

メインエリア (.main-area):
- 【自分のターン（isMyTurn）】:
  - drawnCards が空: サイコロボタン（rolling 中は disabled）
  - drawnCards あり: renderCards()
- 【他プレイヤーのターン】:
  - "currentPlayer.name + otherTurn テキスト"
  - drawnCards あり: renderCards()（観戦表示）

## renderCards()
カードグリッド（.cards-grid）:
各カードに type 別グラデーション:
- skill:   linear-gradient(135deg, #f093fb 0%, #f5576c 100%)
- mission: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)
- special: linear-gradient(135deg, #fa709a 0%, #fee140 100%)

カードの表裏:
- 裏（flippedCards に id が含まれる場合）: imageUrl + descriptionHtml_XX を表示
- 表（デフォルト）: name_XX を表示
フッター: 「詳細を見る →」または「← 表に戻る」→ game.flipCard(card.id)

カード選択:
- selectedCard がある場合: 他カードは .disabled クラス
- カード本体クリック → game.selectCard(card)（JSON.stringify でオブジェクト渡し、" を &quot; にエスケープ）

## rollDice()
this.rolling = true; this.render();
this.send({ type: 'rollDice', sessionId, playerId });

## flipCard(cardId)
flippedCards に cardId があれば delete、なければ add してから render()

## selectCard(card)
if (this.selectedCard?.id === card.id) {
  // 2回クリックで確定送信
  this.send({ type: 'selectCard', sessionId, playerId, cardId: card.id });
  if (card.type === 'special') this.showPlayerSelectionModal(card);
} else {
  this.selectedCard = card;  // 1回クリックで仮選択
  this.render();
}
```

---

### Prompt 4-6: game.js — モーダルとイベントリスナー

```
game.js に以下のモーダル関連メソッドとイベントリスナーを実装してください。
仕様書 Section 6.5 を参照してください。

## showModal(options)
this.modal = { title, content, buttons: options.buttons || [{ label: t('common.close'), action: 'close' }] };
this.render();

## closeModal()
this.modal = null; this.render();

## renderModal()
<div class="modal-overlay" onclick="game.handleModalOverlayClick(event)">
  <div class="modal" onclick="event.stopPropagation()">
    <h2>${this.modal.title}</h2>
    <div class="modal-content">${this.modal.content}</div>
    <div class="modal-buttons">
      ${this.modal.buttons.map(btn =>
        `<button class="btn-${btn.style || 'secondary'}"
                 onclick="game.handleModalAction('${btn.action}')">
           ${btn.label}
         </button>`
      ).join('')}
    </div>
  </div>
</div>

## handleModalOverlayClick(event)
event.target === event.currentTarget なら closeModal()

## handleModalAction(action)
- 'close': closeModal()
- 'resetGame': resetGame()
- 'backToMenu': mode='menu'、sessionId=null、session=null、closeModal()、render()

## showFinalRankingsModal(rankings)
content = rankings.map(r => `<div>${getRankEmoji(r.rank)} ${r.name}</div>`).join('')
showModal({
  title: '🎉 ' + t('game.allFinished'),
  content,
  buttons: [
    { label: t('game.playAgain'), action: 'resetGame', style: 'primary' },
    { label: t('game.backToMenu'), action: 'backToMenu', style: 'secondary' }
  ]
})

## showPlayerSelectionModal(card) — 特殊ミッション用
アクティブなプレイヤー（retired=false の全員）を一覧表示:
- 各プレイヤーに「この人に引き継ぐ」ボタン
  → onclick="game.executeResign('${this.playerId}', '${p.id}')"
- キャンセルボタン付き

## executeResign(retiredPlayerId, targetPlayerId)
this.send({ type: 'resign', sessionId, playerId: retiredPlayerId, targetPlayerId });
this.closeModal();

## resetGame()
this.send({ type: 'resetGame', sessionId });
this.closeModal();

## attachEventListeners()
document.querySelectorAll('[data-lang]').forEach(btn =>
  btn.addEventListener('click', () => i18n.setLanguage(btn.dataset.lang))
)
```

---

## Phase 5: 管理画面実装

### Prompt 5-1: admin.html の画面構造と CSS

```
admin.html を作成してください。
仕様書 Section 8.1、8.3 を参照してください。

## 画面構造
- #loginScreen: デフォルト表示
- #adminScreen: display:none（ログイン後に切り替え）

## ログイン画面（#loginScreen）
- タイトル: "管理者ログイン"
- #loginForm:
  - #username（ユーザー名）
  - #password（type="password"）
  - 送信ボタン
  - #loginError（エラーメッセージ表示）

## 管理画面（#adminScreen）
タブナビゲーション（data-tab 属性）:
- categories:        職種カード
- skill-types:       スキル区分（model_type は自由記述）
- skills:            スキルカード
- missions:          ミッション
- mission-categories: ミッションカテゴリ

各タブコンテンツに:
1. テーブル（tbody に動的生成）
2. 「新規追加」ボタン
3. CSV エクスポートボタン
4. CSV インポートエリア（ファイル選択 + #csv-preview + 取り込みボタン）

## モーダル（#cardModal）
動的コンテンツを #cardModal-content に注入する構造:
- タイトル（追加/編集で変わる）
- フォーム内容（タブに応じて切り替え）
- 保存ボタン + キャンセルボタン

## CSS テーマ
ダークテーマ（背景 #1a1a2e、カード背景 #16213e）
テーブル: hover エフェクト
モーダル: 中央配置、overflow-y: auto（長いフォーム対応）
レスポンシブ: 768px 以下でテーブルをスクロール可能に
```

---

### Prompt 5-2: admin.html の JavaScript ロジック

```
admin.html の <script> タグに管理画面ロジックを実装してください。
仕様書 Section 8.2〜8.7 を参照してください。

## 状態変数
let adminToken = localStorage.getItem('admin_token');
let currentTab = 'categories';
let editingId = null;
let currentCsvData = null;
let currentCsvType = null;
let allData = {
    categories: [],       // 職種カード
    skillTypes: [],       // スキル区分
    skills: [],
    missions: [],
    missionCategories: [] // ミッションカテゴリ
};

## ページロード
adminToken があれば #adminScreen を表示して loadData()
なければ #loginScreen を表示

## ログイン処理
POST /api/auth/login → token を localStorage に保存 → 画面切り替え
エラー時は #loginError にメッセージを表示

## loadData()
Promise.all で以下を並列取得:
  /api/cards/categories, /api/cards/skill-types,
  /api/cards/skills, /api/cards/missions, /api/cards/mission-categories
→ allData に格納 → renderTable(currentTab) を呼ぶ

## renderTable(type)
type: 'categories' | 'skill-types' | 'skills' | 'missions' | 'mission-categories'
- categories: id, name_ja, name_en, targetPoints, 操作
- skill-types: id, name_ja, name_en, model_type（バッジ表示）, 操作
- skills: id, name_ja, name_en, matchesCategories（allData.categories で職種名に変換）, 操作
- missions: id, name_ja, カテゴリ名（allData.missionCategories で変換）, isSpecial バッジ, 操作

## フォーム生成（openModal(type, data)）
categories フォーム: name_en, name_ja, targetPoints, descriptionHtml_en, descriptionHtml_ja, 画像
skill-types フォーム:
  name_en, name_ja
  model_type: <input type="text" list="model-type-suggestions"> + <datalist>
    ※ datalist の候補は allData.skillTypes から既存値を動的生成 + 'katz', 'drucker' を固定追加
  description_en, description_ja, sortOrder
skills フォーム: name_en, name_ja, descriptionHtml_en/ja, matchesCategories（チェックボックス）, 画像
missions フォーム: name_en, name_ja, descriptionHtml_en/ja, categoryId（セレクト）, target_en/ja, isSpecial

## saveCard(type)
editingId あり → PUT /api/admin/${type}/${editingId}
editingId なし → POST /api/admin/${type}
成功後: モーダルを閉じて loadData()

## deleteCard(type, id)
if (!confirm('削除しますか？')) return;
DELETE /api/admin/${type}/${id} → loadData()

## matchesCategories チェックボックスの処理
表示: allData.categories.map(cat => <input type="checkbox" name="matchesCategories" value="${cat.id}">)
保存時: [...document.querySelectorAll('input[name="matchesCategories"]:checked')]
         .map(el => el.value).join(',')

## handleImageUpload(event, targetInputId)
1. ファイルサイズチェック（20MB以下）
2. FileReader + Image + Canvas でリサイズ（最大 800×800px）
3. canvas.toDataURL('image/jpeg', 0.75) で Base64 エンコード
4. 2MB 超なら品質 0.5 で再エンコード
5. document.getElementById(targetInputId).value に格納

## exportCSV(type)
各 type に対して endpoint/headers/filename を定義:
  categories:  /api/cards/categories,  [id,name_en,name_ja,descriptionHtml_en,descriptionHtml_ja,targetPoints], category_cards.csv
  skill-types: /api/cards/skill-types, [id,name_en,name_ja,model_type,description_en,description_ja,sortOrder],  skill_types.csv
  skills:      /api/cards/skills,      [id,name_en,name_ja,descriptionHtml_en,descriptionHtml_ja,matchesCategories], skill_cards.csv
  missions:    /api/cards/missions,    [id,name_en,name_ja,descriptionHtml_en,descriptionHtml_ja,categoryId,target_en,target_ja,isSpecial], missions.csv
UTF-8 BOM ('\uFEFF') + CSV を Blob に変換してダウンロード

## importCSV(type, file)
FileReader → CSV テキスト → JSON 配列にパース
POST /api/admin/import/${type} に { csvData, preview: true }
→ プレビュー件数を #csv-preview に表示
→ 「確定取り込み」ボタン: preview: false で再送信 → 結果表示

## CSVエスケープ関数
const escapeCSV = (v) => {
  if (v == null) return '';
  const s = String(v);
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? '"' + s.replace(/"/g, '""') + '"' : s;
};
```

---

## Phase 6: 多言語対応システム

### Prompt 6-1: lang/ja.json の作成

```
lang/ja.json を作成してください。
仕様書 Section 7.1 の完全版 ja.json をそのまま使用してください。
以下の全キーを含む完全な翻訳ファイルです。

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
    "selectCategory": "職種を選択してください",
    "categorySelected": "選択済み",
    "startGame": "ゲームを開始",
    "waitingForPlayers": "他のプレイヤーの参加を待っています...",
    "waitingForCategorySelection": "全員が職種を選択するまでお待ちください",
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
    "youRetired": "あなたは退職しました",
    "playerRetiredNotice": "プレイヤーが退職しました",
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
    "categoryCards": "職種カード",
    "skillTypes": "スキル区分",
    "modelType": "モデル種別",
    "skillCards": "スキルカード",
    "missions": "ミッション",
    "missionCategories": "ミッションカテゴリ",
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
    "matchesCategories": "対応職種",
    "category": "カテゴリ",
    "targetAudience": "実施対象",
    "isSpecial": "特殊ミッション"
  },
  "errors": {
    "UNAUTHORIZED": "認証が必要です",
    "SERVER_ERROR": "サーバーエラーが発生しました",
    "CATEGORY_TAKEN": "その職種はすでに選択されています",
    "SESSION_NOT_FOUND": "セッションが見つかりません",
    "GAME_ALREADY_STARTED": "ゲームはすでに開始されています",
    "SESSION_FULL": "セッションが満員です",
    "NOT_YOUR_TURN": "あなたのターンではありません"
  }
}
```

---

### Prompt 6-2: lang/en.json の作成

```
lang/en.json を作成してください。
lang/ja.json と完全に同じキー構造で、英語翻訳を作成してください。
仕様書 Section 7.1 の完全版 en.json をそのまま使用してください。

{
  "common": {
    "language": "Language", "save": "Save", "cancel": "Cancel",
    "close": "Close", "edit": "Edit", "delete": "Delete",
    "add": "Add", "confirm": "Confirm", "loading": "Loading..."
  },
  "game": {
    "title": "Career × Skills Card Game",
    "subtitle": "Career Education Card Game",
    "createGame": "Create New Game",
    "joinGame": "Join Game",
    "sessionId": "Session ID",
    "playerName": "Enter your name",
    "join": "Join",
    "lobby": "Lobby",
    "players": "Players",
    "selectCategory": "Select a Job Role",
    "categorySelected": "Selected",
    "startGame": "Start Game",
    "waitingForPlayers": "Waiting for other players to join...",
    "waitingForCategorySelection": "Waiting for all players to select a job role...",
    "yourTurn": "It's your turn!",
    "otherTurn": "'s turn",
    "rollDice": "Roll Dice",
    "rolling": "Rolling...",
    "selectCard": "Select a Card",
    "cardSelectHint": "Click a card to select → click again to confirm",
    "viewDetails": "View Details",
    "backToFront": "Back",
    "points": "Points",
    "goal": "Goal",
    "playerFinished": "Goal Reached!",
    "finishedRank": "reached",
    "rankSuffix": "place",
    "allFinished": "All players have finished!",
    "finalRankings": "Final Rankings",
    "playAgain": "Play Again",
    "backToMenu": "Back to Menu",
    "copySessionId": "Copy Session ID",
    "copied": "Copied!",
    "retired": "Retired",
    "youRetired": "You have retired",
    "playerRetiredNotice": "A player has retired",
    "resign": "Resign & Transfer",
    "selectPlayerToResign": "Select a player to transfer your roles to",
    "transferTo": "Transfer to this player",
    "skillCard": "Skill Card",
    "missionCard": "Mission Card",
    "specialMission": "Special Mission",
    "matched": "Match! +1 Point",
    "notMatched": "Does not match your job role",
    "alreadySelected": "Already selected (no points)",
    "diceResult": "Dice Result",
    "cardDrawn": "cards drawn"
  },
  "admin": {
    "loginTitle": "Admin Login",
    "username": "Username",
    "password": "Password",
    "login": "Login",
    "loginError": "Invalid username or password",
    "categoryCards": "Job Role Cards",
    "skillTypes": "Skill Types",
    "modelType": "Model Type",
    "skillCards": "Skill Cards",
    "missions": "Missions",
    "missionCategories": "Mission Categories",
    "addCard": "Add Card",
    "editCard": "Edit Card",
    "deleteConfirm": "Delete this card? This action cannot be undone.",
    "exportCSV": "Export CSV",
    "importCSV": "Import CSV",
    "selectFile": "Select File",
    "preview": "Preview",
    "executeImport": "Execute Import",
    "importResult": "Import Result",
    "inserted": "Inserted",
    "updated": "Updated",
    "total": "Total",
    "imageUpload": "Upload Image",
    "targetPoints": "Target Points",
    "matchesCategories": "Matching Job Roles",
    "category": "Category",
    "targetAudience": "Target Audience",
    "isSpecial": "Special Mission"
  },
  "errors": {
    "UNAUTHORIZED": "Authentication required",
    "SERVER_ERROR": "A server error occurred",
    "CATEGORY_TAKEN": "That job role is already taken",
    "SESSION_NOT_FOUND": "Session not found",
    "GAME_ALREADY_STARTED": "Game has already started",
    "SESSION_FULL": "Session is full",
    "NOT_YOUR_TURN": "It's not your turn"
  }
}
```

---

## Phase 7: デプロイメント設定

### Prompt 7-1: systemd サービスファイル

```
以下の systemd サービスファイルを作成し、セットアップコマンドも出力してください。

## /etc/systemd/system/career-card-game.service

[Unit]
Description=Career Card Game - Multiplayer WebSocket Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/Role-Based-Card-Game-Framework
EnvironmentFile=/home/ubuntu/Role-Based-Card-Game-Framework/.env
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/career-card-game/access.log
StandardError=append:/var/log/career-card-game/error.log

[Install]
WantedBy=multi-user.target

## セットアップコマンド（順番通りに実行）
1. ログディレクトリ作成 + 権限設定
2. daemon-reload
3. enable + start
4. status 確認
5. tail -f でログ確認

## Node.js 24 のインストール（Ubuntu）
# NodeSource 経由でインストール
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs

# バージョン確認
node --version   # v24.x.x であること
npm --version

# better-sqlite3 のビルドに必要なツール
sudo apt-get install -y python3 build-essential
```

---

### Prompt 7-2: Nginx リバースプロキシ設定

```
以下の仕様で Nginx 設定ファイルを作成し、関連コマンドも出力してください。

## /etc/nginx/conf.d/ssl-proxy.conf の要件
- HTTPS (443) + HTTP/2 でリッスン
- HTTP (80) → HTTPS リダイレクト
- Node.js port 3000 へのリバースプロキシ
- WebSocket (wss://) アップグレード対応（必須）
- Let's Encrypt SSL 証明書を使用
- server_name: your-domain.com（プレースホルダー）

## 必須設定（WebSocket 対応）
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 86400;

## SSL 設定
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305';
ssl_prefer_server_ciphers on;
server_tokens off;

## 一緒に出力するもの
1. Nginx 設定ファイル本体（443 + 80 → HTTPS リダイレクト）
2. Let's Encrypt 証明書取得コマンド（certbot）
3. nginx -t でのテスト方法
4. nginx reload コマンド
```

---

### Prompt 7-3: 本番環境一括セットアップスクリプト

```
Ubuntu 22.04 LTS（Amazon Lightsail 等）での本番デプロイ用シェルスクリプト setup.sh を作成してください。
set -e を先頭に記述してください。

## スクリプトの処理内容（順番通り）
1. apt update && apt upgrade -y
2. Node.js 24.x のインストール（NodeSource リポジトリ経由）
3. ビルドツールのインストール: python3 build-essential
4. nginx, certbot, python3-certbot-nginx のインストール
5. UFW ファイアウォール設定（22, 80, 443 を許可）
6. リポジトリのクローン（GitHub URL はプレースホルダー）
7. npm install（better-sqlite3 のネイティブビルドを含む）
8. .env.example → .env のコピーと警告表示
9. npm run initdb
10. systemd サービスファイルの配置と起動
11. Nginx 設定の配置
12. 完了メッセージ（手動で必要な作業のリスト付き）

## 完了後の手動作業リスト（スクリプト末尾に表示）
- .env のパスワードを変更する
- certbot でSSL証明書を取得する（certbot certonly --nginx -d your-domain.com）
- Nginx の server_name を実際のドメインに変更する
- node --version で Node.js 24以上であることを確認する

スクリプトの各ステップにコメントを入れ、エラー時は exit 1 するようにしてください。
```

---

## 補足: デバッグ・動作確認用プロンプト

### Prompt D-1: WebSocket 接続トラブルシューティング

```
WebSocket 接続が "Disconnected" のままになっています。以下の順で確認・修正してください。

## Step 1: server.js の確認
WebSocket サーバーが正しくセットアップされているか確認:
- http.createServer(app) を作成しているか
- new WebSocketServer({ server }) でサーバーに紐付けているか（ポートを直接指定していないか）
- ESM の import 文が正しいか（ws パッケージの named import: import { WebSocketServer, WebSocket } from 'ws'）

## Step 2: game.js の確認
接続 URL の生成が正しいか確認:
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}`;

## Step 3: Nginx 設定の確認（本番環境）
以下のヘッダーが設定されているか確認:
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_http_version 1.1;

## Step 4: デバッグログの追加（一時的）
game.js の connect() に以下を追加:
console.log('Connecting to:', wsUrl);
this.ws.onclose = (event) => {
  console.log('Close code:', event.code, 'Reason:', event.reason);
};

問題を特定して修正し、修正内容を説明してください。
```

---

### Prompt D-2: better-sqlite3 インストール・動作確認

```
better-sqlite3 のインストールや動作に問題がある場合の診断と修正を行ってください。

## Step 1: 環境確認
node --version   # v24.x.x であることを確認
npm --version

## Step 2: ビルドエラーが出た場合
sudo apt install -y python3 build-essential
npm install --build-from-source

## Step 3: Node.js バージョン変更後の rebuild
npm rebuild better-sqlite3

## Step 4: 動作確認スクリプトを作成して実行
以下の test-db.mjs を作成して node test-db.mjs で実行:

import Database from 'better-sqlite3';
const db = new Database('./game.db', { readonly: true });
const rows = db.prepare('SELECT * FROM category_cards').all();
console.log('category_cards count:', rows.length);
console.log('First row:', rows[0]);
db.close();
console.log('better-sqlite3 OK');

## Step 5: よくあるエラーと対処
- "Cannot find module 'better-sqlite3'" → npm install
- "Error: Could not locate the bindings file" → npm rebuild better-sqlite3
- "SQLITE_CANTOPEN: unable to open database file" → npm run initdb でDB初期化
- "SyntaxError: Cannot use import statement" → package.json に "type": "module" を追加確認

問題を特定して修正し、修正内容を説明してください。
```

---

### Prompt D-3: カード選択・ポイント計算のバグ修正

```
スキルカード選択時にポイントが正しく加算されない問題を調査してください。

## 確認ポイント（server.js の handleSelectCard）

1. matchesCategories の型チェック:
   card.matchesCategories が配列（number[]）になっているか確認
   → handleRollDice で .split(',').map(Number) を実行しているか
   → カラム名が matchesCategories であることを確認
     node test-db.mjs で SELECT * FROM skill_cards LIMIT 1 の結果を確認

2. player.categories との比較:
   card.matchesCategories.includes(categoryId) の categoryId が number 型か
   → player.categories は number[] か string[] か確認

3. points の更新:
   newPoints[categoryId] = (newPoints[categoryId] || 0) + 1;
   の後に currentPlayer.points = newPoints; しているか

4. 勝利判定（better-sqlite3 同期API）:
   const categoryCards = db.prepare('SELECT * FROM category_cards').all();
   が正しく呼ばれているか（コールバック内ではなくフラットに配置されているか）
   → cat.targetPoints と player.points[categoryId] の型が一致しているか（ともに number）

実際のコードを確認して、問題箇所を特定・修正してください。
修正後、以下のシナリオで動作を検証してください:
- スキルカードの matchesCategories に categoryId が含まれる場合 → ポイント +1
- 含まれない場合 → ポイント変化なし
- 同じカードを2回選択 → alreadySelected = true でポイント加算なし
```

---

### Prompt D-4: 管理画面ログイン問題

```
管理画面で "Unauthorized access" エラーが出る場合の診断と修正をしてください。

## 診断手順

1. .env ファイルの確認:
   cat .env | grep ADMIN_USERNAME
   cat .env | grep ADMIN_PASSWORD
   （パスワードに特殊文字がある場合は引用符で囲む）

2. サーバーログの確認（=== LOGIN ATTEMPT === の出力を確認）

3. ブラウザの DevTools で確認:
   - Network タブ: POST /api/auth/login のレスポンスを確認
   - Application タブ: localStorage の admin_token を確認

4. トークンの手動テスト:
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin123"}'

## よくある原因と対処

| 原因 | 対処 |
|---|---|
| .env が存在しない | cp .env.example .env |
| パスワードに # が含まれる | .env でシングルクォートで囲む |
| 古いトークンがキャッシュされている | DevTools で localStorage.clear() |
| server.js 未再起動 | npm restart |
| ESM のインポートエラー | import 'dotenv/config' が先頭にあるか確認 |

上記を確認して問題を特定・修正してください。
```

---

### Prompt D-5: 全体動作確認チェックリスト

**Claude Code 向け（推奨）**

```
以下のチェックリストを順番に実行して、全機能が正常に動作することを確認してください。
各項目の結果を ✅ または ❌ でまとめてください。

## 前提確認
node --version    # v24.x.x であること
npm list better-sqlite3  # ^12.8.0 がインストールされていること

## API 動作確認
curl http://localhost:3000/api/health
→ { "ok": true, "timestamp": "..." } であること

curl http://localhost:3000/api/cards/categories
→ 6件の配列が返ること

curl http://localhost:3000/api/cards/skill-types
→ 3件の配列が返ること（model_type: "katz" を含む）

curl http://localhost:3000/api/cards/skills
→ 23件の配列が返ること
   matchesCategories がカンマ区切り文字列であること（配列ではなく文字列）

curl http://localhost:3000/api/cards/mission-categories
→ 4件の配列が返ること

curl http://localhost:3000/api/lang/ja
→ { "ok": true, "translations": { "game": { "selectCategory": "職種を選択してください" ... } } } であること

curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
→ { "ok": true, "token": "..." } であること

## 静的ファイル配信確認
curl -I http://localhost:3000/
→ HTTP/1.1 200 OK であること

curl -I http://localhost:3000/admin.html
→ HTTP/1.1 200 OK であること

## WebSocket 動作確認（ブラウザ手動テスト）
□ http://localhost:3000 でゲーム画面が表示される
□ 接続インジケーターが 🟢 Connected になる
□ 言語切り替え（EN/日本語）が動作する
□ 「新しいゲームを作成」でセッションIDが表示される
□ 2つ目のウィンドウで参加できる
□ 両ウィンドウで職種（カテゴリ）を選択できる（重複選択が弾かれる）
□ categorySelected メッセージが正しく届いてUI更新される
□ ゲーム開始 → サイコロ → カード選択 → ターン交代の一連が動作する
□ ポイントが category_cards の targetPoints まで貯まるとゴール判定される

## 管理画面確認
□ /admin.html でログイン画面が表示される
□ admin/admin123 でログインできる
□ 「職種カード」タブ（categories）に6件の一覧が表示される
□ 「スキル区分」タブ（skill-types）に3件が表示される
□ 「スキル区分」追加フォームの model_type が <input>+<datalist> になっている
□ 「スキルカード」の対応職種が matchesCategories チェックボックスで表示される
□ 新規カード追加 → 保存 → 一覧更新が動作する
□ CSV エクスポートでファイルがダウンロードされる

問題がある項目は修正してから再確認してください。
```

---

## 📝 実装メモ（Claude Code 利用時の推奨ワークフロー）

```
# 推奨の作業フロー

## 1. 環境確認（最初に必ず実行）
node --version   # v24.x.x であること
npm --version

## 2. リポジトリのセットアップ
git init
git remote add origin <GitHub URL>

## 3. CLAUDE.md を配置（Prompt 1-3 で生成）
→ claude コマンド起動時に自動で読み込まれる

## 4. フェーズごとに実装と確認を繰り返す
Phase 1 → npm install の確認（better-sqlite3 のビルド成功を確認）
Phase 2 → npm run initdb && node check-db.js
Phase 3 → npm start && curl で API 確認
Phase 4 → ブラウザで目視確認
Phase 5 → 管理画面でログイン確認
Phase 6 → 言語切り替え確認
Phase 7 → 本番サーバーへのデプロイ

## 5. コミットのタイミング
各 Phase 完了時にコミットすることを推奨:
git add .
git commit -m "feat: Phase N completed - [内容]"
git tag v1.2.1  # 全 Phase 完了後

## 6. better-sqlite3 特有の注意事項
- Node.js のメジャーバージョン変更後は必ず npm rebuild better-sqlite3
- DB接続は同期なのでエラーは try/catch で処理する
- トランザクション: db.transaction(fn)() の形で呼び出す
- readonly モード: new Database(path, { readonly: true })（check-db.js 等で使用）
```

---

*仕様書*: `SDD_Specification_v1.2.1_full.md`  
*GitHub タグ*: `v1.2.1`  
*プロンプト集バージョン*: `v1.2.1-implementation-prompts`  
*最終更新*: 2026-06-13
