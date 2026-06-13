# 職種×スキル カードゲーム - 完全実装仕様書 v1.3

**プロジェクト名**: Role Based Card Game Framework  
**バージョン**: 1.3  
**最終更新**: 2026-06-13  
**実装状況**: 🚧 v1.2 ベース + 3D仮想空間実装中

> **この仕様書について**: v1.1〜v1.3 の内容をすべて統合した完全版です。  
> この1ファイルのみでシステムをゼロから再現できます。

---

## 📋 変更履歴

| バージョン | 日付 | 主な変更内容 |
|---|---|---|
| v1.1 | 2026-02-05 | 初版リリース。基本的なカードゲーム実装 |
| v1.2 | 2026-06-13 | カード階層再設計（カテゴリ/スキル区分/スキル）、`job_cards`→`category_cards`、`skill_types`テーブル追加 |
| v1.3 | 2026-06-13 | 3D仮想空間、アバターシステム、横一列スコアバー、カードインタラクションUX |

---

## 📋 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [システムアーキテクチャ](#2-システムアーキテクチャ)
3. [技術スタック詳細](#3-技術スタック詳細)
4. [データベース設計](#4-データベース設計)
5. [サーバーサイド実装](#5-サーバーサイド実装)
6. [クライアントサイド実装](#6-クライアントサイド実装)
7. [多言語対応システム](#7-多言語対応システム)
8. [管理画面実装](#8-管理画面実装)
9. [ゲームロジック詳細](#9-ゲームロジック詳細)
10. [セキュリティ実装](#10-セキュリティ実装)
11. [デプロイメント手順](#11-デプロイメント手順)
12. [トラブルシューティング](#12-トラブルシューティング)
13. [実装チェックリスト](#13-実装チェックリスト)
14. [本番運用チェックリスト](#14-本番運用チェックリスト)
15. [3D環境システム](#15-3d環境システム)
16. [アバターシステム](#16-アバターシステム)
17. [3D×2D統合レイヤー](#17-3d2d統合レイヤー)
18. [カードインタラクションシステム](#18-カードインタラクションシステム)
19. [z-index・CSSアニメーション定義](#19-z-indexcssアニメーション定義)
20. [参考資料](#20-参考資料)

---

## 1. プロジェクト概要

### 1.1 プロジェクトの目的

キャリア教育・職業理解を目的としたオンラインマルチプレイヤーカードゲームプラットフォーム。

**主要機能**:
- 3種類のカード（職種・スキル・ミッション）を使ったゲームメカニクス
- WebSocketによるリアルタイム同期（2〜4人対戦）
- **3D仮想テーブルでプレイヤーがアバターとして参加** ← v1.3
- 多言語対応（日本語・英語）
- 管理画面によるカード編集・CSV Import/Export

### 1.2 カード概念モデル

本ゲームのカード体系はKatz（カッツ）の3スキルモデルに基づきます。

```
カテゴリ（大分類）     ← 職種（SE、PM、QA Engineer など）
    └── スキル区分（中分類）← Katzモデルによる分類
            └── スキル（小分類）← 個別スキルカード
```

- **カテゴリ**: ゲームにおける「職種」。プレイヤーはここから自分の担当職種を選択する。
- **スキル区分**: スキルカードを束ねる中間分類。Katzモデルの「テクニカル・ヒューマン・コンセプチュアル」3区分を基本とする。
- **スキル**: プレイヤーが実際に選択するカード。どのカテゴリ（職種）にマッチするかを `matchesCategories` で定義する。

### 1.3 対象ユーザー

**プレイヤー**: 中学生〜大学生（キャリア教育）、企業研修参加者（職種理解）、2〜4人のグループ  
**運営者**: 教育機関の教員、企業の人事・研修担当者、ゲーム管理者

### 1.4 システム要件

**サーバー環境**: Node.js 24以上、1GB RAM以上、Ubuntu 22.04 LTS推奨  
**クライアント環境**: モダンWebブラウザ（Chrome/Firefox/Safari/Edge）、JavaScript有効化、WebSocket対応、**WebGL対応** ← v1.3

---

## 2. システムアーキテクチャ

### 2.1 全体構成図

```
┌──────────────────────────────────────────────────────────┐
│  Client Browser                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Layer 2: HTML UI Overlay (z-index: 2〜20)         │  │
│  │  スコアバー / カード選択 / 結果モーダル / 管理UI    │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  Layer 1: Three.js WebGL Canvas (z-index: 1)       │  │
│  │  3Dテーブル / アバター / ダイス / カード配置        │  │
│  └────────────────────────────────────────────────────┘  │
│  (index.html + game.js)                                  │
└─────────────────────┬────────────────────────────────────┘
                      │ WebSocket / HTTPS
                      ↓
             ┌────────────────┐
             │  Nginx (SSL)   │
             └───────┬────────┘
                     ↓
             ┌────────────────┐
             │  Node.js       │
             │  Express + WS  │
             └───────┬────────┘
                     ↓
             ┌────────────────┐
             │  SQLite DB     │
             │  (game.db)     │
             └────────────────┘
```

### 2.2 ファイル構成

```
Role-Based-Card-Game-Framework/
├── server.js              # メインサーバー（Express + WebSocket）
├── index.html             # ゲーム画面（3D canvas + HTML overlay）
├── game.js                # クライアントロジック（GameClient + SceneManager）
├── admin.html             # 管理画面
├── initdb.js              # DB初期化スクリプト
├── package.json
├── .env                   # 環境変数（要作成）
├── .env.example
├── .gitignore             # node_modules/, .env, game.db, *.log
├── game.db                # SQLiteデータベース（自動生成）
├── lang/
│   ├── en.json
│   └── ja.json
└── docs/
    ├── SDD_Specification_v1.3_full.md  ← このファイル
    └── ...
```

---

## 3. 技術スタック詳細

### 3.1 バックエンド

```json
{
  "name": "career-skills-card-game",
  "version": "1.3.0",
  "engines": { "node": ">=24.0.0" },
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
  "devDependencies": { "nodemon": "^3.0.1" }
}
```

**依存関係の役割**:
- **express**: HTTPサーバー + REST API
- **ws**: WebSocketサーバー（リアルタイム通信）
- **better-sqlite3**: データベース（同期API、Node.js 24対応）
- **uuid**: セッションID・プレイヤーID生成
- **dotenv**: 環境変数管理（認証情報）

> **better-sqlite3 基本パターン**:
> ```javascript
> const rows = db.prepare('SELECT * FROM table').all();               // 複数行取得
> const row  = db.prepare('SELECT * FROM table WHERE id=?').get(id);  // 1行取得
> const res  = db.prepare('INSERT INTO table (...) VALUES (?)').run(v);// 挿入 → res.lastInsertRowid
> ```

### 3.2 フロントエンド

- **Vanilla JavaScript** + CSS3（フレームワーク不要）
- **Three.js r128**（CDN経由）← v1.3 追加
- Google Fonts: Outfit / DM Sans
- WebSocket API ネイティブサポート

```html
<!-- index.html に追加 -->
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
```

---

## 4. データベース設計

### 4.1 テーブル一覧

| テーブル名 | 役割 | 追加バージョン |
|---|---|---|
| `mission_categories` | ミッションカテゴリ | v1.1 |
| `category_cards` | 職種カード（大分類）| v1.2（旧 `job_cards`）|
| `skill_types` | スキル区分（中分類）| v1.2（新規）|
| `skill_cards` | スキルカード（小分類）| v1.1（`matchesCategories` に変更）|
| `missions` | ミッションカード | v1.1 |

### 4.2 テーブル構造

#### mission_categories
```sql
CREATE TABLE mission_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL, name_ja TEXT NOT NULL,
    description_en TEXT, description_ja TEXT,
    sortOrder INTEGER DEFAULT 0
);
```
サンプル: Crisis Management/危機管理、Decision Making/意思決定、Communication/コミュニケーション、Resource Management/リソース管理

#### category_cards（職種カード）
```sql
CREATE TABLE category_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL, name_ja TEXT NOT NULL,
    imageUrl TEXT,
    descriptionHtml_en TEXT, descriptionHtml_ja TEXT,
    targetPoints INTEGER NOT NULL
);
```
サンプル6件: Engineer/エンジニア (5pt)、Designer/デザイナー (4pt)、Project Manager/プロジェクトマネージャー (4pt)、QA Engineer/QAエンジニア (3pt)、DevOps Engineer/DevOpsエンジニア (5pt)、Data Analyst/データアナリスト (4pt)

#### skill_types（スキル区分）
```sql
CREATE TABLE skill_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL, name_ja TEXT NOT NULL,
    model_type TEXT NOT NULL DEFAULT 'katz',  -- 現バージョンは 'katz' 固定
    description_en TEXT, description_ja TEXT,
    sortOrder INTEGER DEFAULT 0
);
```
サンプル(Katz): Technical Skill/テクニカルスキル、Human Skill/ヒューマンスキル、Conceptual Skill/コンセプチュアルスキル

#### skill_cards
```sql
CREATE TABLE skill_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL, name_ja TEXT NOT NULL,
    imageUrl TEXT,
    descriptionHtml_en TEXT, descriptionHtml_ja TEXT,
    matchesCategories TEXT    -- カンマ区切り職種ID "1,3,5"
);
```

#### missions
```sql
CREATE TABLE missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT, name_ja TEXT,
    imageUrl TEXT,
    descriptionHtml_en TEXT NOT NULL, descriptionHtml_ja TEXT NOT NULL,
    categoryId INTEGER,
    target_en TEXT, target_ja TEXT,
    isSpecial INTEGER DEFAULT 0,
    FOREIGN KEY(categoryId) REFERENCES mission_categories(id)
);
```
isSpecial=1: 退職&強制兼任（出現確率10%、1枚のみ）

### 4.3 DB初期化

```bash
npm run initdb
# → Database initialized! Tables: mission_categories(4), category_cards(6), skill_types(3), skill_cards(23), missions(40)
```

`initdb.js` は better-sqlite3 の同期APIで実装する:

```javascript
// initdb.js 骨格
const fs = require('fs');
const Database = require('better-sqlite3');
if (fs.existsSync('./game.db')) fs.unlinkSync('./game.db');
const db = new Database('./game.db');

db.exec(`
    CREATE TABLE mission_categories (...);
    CREATE TABLE category_cards (...);
    CREATE TABLE skill_types (...);
    CREATE TABLE skill_cards (...);
    CREATE TABLE missions (...);
`);

const insertCat = db.prepare('INSERT INTO category_cards (name_en,name_ja,imageUrl,descriptionHtml_en,descriptionHtml_ja,targetPoints) VALUES (?,?,?,?,?,?)');
insertCat.run('Engineer',         'エンジニア',             null, '...', '...', 5);
insertCat.run('Designer',         'デザイナー',             null, '...', '...', 4);
// ... 残り4件

console.log('Database initialized successfully!');
```

### 4.4 v1.1→v1.2 既存DBマイグレーション（新規構築時は不要）

```sql
ALTER TABLE job_cards RENAME TO category_cards;
-- skill_cards.matchesJobs → matchesCategories（再作成が必要）
CREATE TABLE skill_cards_new (id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_en TEXT, name_ja TEXT, imageUrl TEXT,
  descriptionHtml_en TEXT, descriptionHtml_ja TEXT, matchesCategories TEXT);
INSERT INTO skill_cards_new SELECT id,name_en,name_ja,imageUrl,
  descriptionHtml_en,descriptionHtml_ja,matchesJobs FROM skill_cards;
DROP TABLE skill_cards; ALTER TABLE skill_cards_new RENAME TO skill_cards;
CREATE TABLE skill_types (...); -- 上記定義を参照
```

---

## 5. サーバーサイド実装

### 5.1 server.js 骨格

```javascript
require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const Database = require('better-sqlite3');
const db = new Database('./game.db');
// better-sqlite3 は同期API。db.prepare(sql).all/get/run() で使用。

const gameSessions = new Map();   // Map<sessionId, session>
const clients = new Map();        // Map<sessionId, Map<playerId, WebSocket>>
const adminTokens = new Map();    // Map<token, { username, expiry }>
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

function generateSessionId() { return uuidv4().substring(0, 8).toUpperCase(); }

function broadcast(sessionId, message, excludePlayerId = null) {
    const sc = clients.get(sessionId);
    if (sc) sc.forEach((ws, pid) => {
        if (pid !== excludePlayerId && ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify(message));
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

### 5.2 WebSocket ハンドラ switch

```javascript
wss.on('connection', (ws) => {
    let currentSessionId = null;
    let currentPlayerId  = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            switch (data.type) {
                case 'createSession':  handleCreateSession(ws, data); break;
                case 'joinSession':    handleJoinSession(ws, data);   break;
                case 'selectAvatar':   handleSelectAvatar(ws, data);  break; // v1.3
                case 'selectCategory': handleSelectCategory(ws, data);break; // v1.2
                case 'startGame':      handleStartGame(ws, data);     break;
                case 'rollDice':       handleRollDice(ws, data);      break;
                case 'selectCard':     handleSelectCard(ws, data);    break;
                case 'nextTurn':       handleNextTurn(ws, data);      break;
                case 'resign':         handleResign(ws, data);        break;
                case 'resetGame':      handleResetGame(ws, data);     break;
            }
        } catch (error) {
            ws.send(JSON.stringify({ type: 'error', error: { code: 'SERVER_ERROR', message: error.message }}));
        }
    });

    ws.on('close', () => {
        if (currentSessionId && currentPlayerId) {
            const sc = clients.get(currentSessionId);
            if (sc) sc.delete(currentPlayerId);
        }
    });
});
```

### 5.3 セッション作成（handleCreateSession）

```javascript
function handleCreateSession(ws, data) {
    const sessionId = generateSessionId();
    const playerId  = uuidv4();

    const session = {
        id: sessionId,
        hostPlayerId: playerId,
        players: [{
            id: playerId,
            name: data.playerName || 'Player 1',
            // v1.2
            categories: [],
            points: {},
            retired: false,
            categorySelected: false,
            selectedSkillCardIds: [],
            finished: false,
            finishRank: null,
            // v1.3
            avatarId: null,
            avatarColorId: null,
            avatarSelected: false,
            seatIndex: 0,
        }],
        maxPlayers: data.maxPlayers || 4,
        currentPlayerIndex: 0,
        gameStarted: false,
        diceValue: null,
        drawnCards: [],
        selectedCardsHistory: [],
        usedCardIds: [],
        finishedPlayers: [],
        allFinished: false
    };

    gameSessions.set(sessionId, session);
    if (!clients.has(sessionId)) clients.set(sessionId, new Map());
    clients.get(sessionId).set(playerId, ws);
    currentSessionId = sessionId;
    currentPlayerId  = playerId;

    ws.send(JSON.stringify({ type: 'sessionCreated', sessionId, playerId, session }));
}
```

### 5.4 セッション参加（handleJoinSession）

```javascript
function handleJoinSession(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return ws.send(JSON.stringify({ type: 'error', error: { code: 'SESSION_NOT_FOUND' }}));
    if (session.players.length >= session.maxPlayers) return ws.send(JSON.stringify({ type: 'error', error: { code: 'SESSION_FULL' }}));
    if (session.gameStarted) return ws.send(JSON.stringify({ type: 'error', error: { code: 'GAME_ALREADY_STARTED' }}));

    const playerId = uuidv4();
    const seatIndex = session.players.length; // v1.3: 0始まりで自動割り当て

    session.players.push({
        id: playerId,
        name: data.playerName || `Player ${seatIndex + 1}`,
        categories: [], points: {}, retired: false, categorySelected: false,
        selectedSkillCardIds: [], finished: false, finishRank: null,
        avatarId: null, avatarColorId: null, avatarSelected: false, seatIndex
    });

    if (!clients.has(data.sessionId)) clients.set(data.sessionId, new Map());
    clients.get(data.sessionId).set(playerId, ws);
    currentSessionId = data.sessionId;
    currentPlayerId  = playerId;

    ws.send(JSON.stringify({ type: 'sessionJoined', playerId, session }));
    broadcast(data.sessionId, { type: 'playerJoined', session }, playerId);
}
```

### 5.5 アバター選択（handleSelectAvatar）← v1.3

```javascript
function handleSelectAvatar(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;
    const player = session.players.find(p => p.id === data.playerId);
    if (!player) return;

    player.avatarId      = data.avatarId;
    player.avatarColorId = data.avatarColorId;
    player.avatarSelected = true;

    broadcast(data.sessionId, {
        type: 'avatarSelected',
        playerId: data.playerId,
        avatarId: data.avatarId,
        avatarColorId: data.avatarColorId,
        session
    });
}
```

### 5.6 カテゴリ選択（handleSelectCategory）← v1.2

```javascript
function handleSelectCategory(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;

    const alreadyTaken = session.players.some(
        p => p.id !== data.playerId && p.categories.includes(data.categoryId)
    );
    if (alreadyTaken) return ws.send(JSON.stringify({ type: 'error', error: { code: 'CATEGORY_TAKEN' }}));

    const player = session.players.find(p => p.id === data.playerId);
    if (!player) return;
    player.categories.push(data.categoryId);
    player.categorySelected = true;

    broadcast(data.sessionId, {
        type: 'categorySelected',
        playerId: data.playerId,
        categoryId: data.categoryId,
        session
    });
}
```

### 5.7 ゲーム開始（handleStartGame）

```javascript
function handleStartGame(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;
    if (data.playerId !== session.hostPlayerId)
        return ws.send(JSON.stringify({ type: 'error', error: { code: 'NOT_HOST', message: 'ゲーム開始はホストのみ可能です' }}));
    if (session.players.length < 2)
        return ws.send(JSON.stringify({ type: 'error', error: { code: 'NOT_ENOUGH_PLAYERS', message: '最低2人必要です' }}));
    if (session.players.some(p => !p.categorySelected))
        return ws.send(JSON.stringify({ type: 'error', error: { code: 'NOT_ALL_SELECTED', message: '全員が職種を選択するまで開始できません' }}));
    session.gameStarted = true;
    broadcast(data.sessionId, { type: 'gameStarted', session });
}
```

### 5.8 サイコロ処理（handleRollDice）← v1.2 matchesCategories

```javascript
function handleRollDice(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;

    const diceValue = Math.floor(Math.random() * 6) + 1;
    session.diceValue = diceValue;

    // better-sqlite3: 同期API（コールバック不要）
    const skillCards     = db.prepare('SELECT * FROM skill_cards').all();
    const regularMissions = db.prepare('SELECT * FROM missions WHERE isSpecial = 0').all();
    const specialMissions = db.prepare('SELECT * FROM missions WHERE isSpecial = 1').all();

    const allCards = [
        ...skillCards.map(c => ({
            ...c, type: 'skill',
            matchesCategories: c.matchesCategories ? c.matchesCategories.split(',').map(Number) : []
        })),
        ...regularMissions.map(c => ({ ...c, type: 'mission' }))
    ];

    let available = allCards.filter(c => !session.usedCardIds.includes(c.id));
    if (available.length <= 7) { session.usedCardIds = []; available = [...allCards]; }

    if (specialMissions.length > 0 && Math.random() < 0.1) {
        const sp = specialMissions[0];
        if (!session.usedCardIds.includes(sp.id)) available.push({ ...sp, type: 'special' });
    }

    const drawn = [], ids = new Set();
    while (drawn.length < Math.min(diceValue, available.length)) {
        const c = available[Math.floor(Math.random() * available.length)];
        if (!ids.has(c.id)) { drawn.push(c); ids.add(c.id); }
    }
    session.drawnCards = drawn;
    broadcast(data.sessionId, { type: 'diceRolled', diceValue, drawnCards: drawn, session });
}
```

### 5.9 カード選択処理（handleSelectCard）← v1.2 matchesCategories

```javascript
function handleSelectCard(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;
    const card = session.drawnCards.find(c => c.id === data.cardId);
    if (!card) return;
    const player = session.players[session.currentPlayerIndex];
    let result = { type: 'cardSelected', card };

    session.selectedCardsHistory.push({ playerId: player.id, playerName: player.name, card, turnNumber: session.selectedCardsHistory.length + 1 });
    if (!session.usedCardIds.includes(card.id)) session.usedCardIds.push(card.id);

    if (card.type === 'skill') {
        let matched = false, alreadySelected = false;
        const newPoints = { ...player.points };

        if (player.selectedSkillCardIds.includes(card.id)) {
            alreadySelected = true;
        } else {
            player.categories.forEach(cid => {
                if (card.matchesCategories?.includes(cid)) { matched = true; newPoints[cid] = (newPoints[cid] || 0) + 1; }
            });
            player.selectedSkillCardIds.push(card.id);
        }
        player.points = newPoints;
        result = { ...result, matched, alreadySelected, pointsUpdated: newPoints };

        // better-sqlite3: 同期API
        const cats = db.prepare('SELECT * FROM category_cards').all();
        const hasWon = player.categories.length > 0 && player.categories.every(cid => {
            const cat = cats.find(c => c.id === cid);
            return cat && (player.points[cid] || 0) >= cat.targetPoints;
        });

        if (hasWon && !player.finished) {
            player.finished = true;
            player.finishRank = session.finishedPlayers.length + 1;
            session.finishedPlayers.push(player.id);
            result.playerFinished = true;
            result.finishRank = player.finishRank;
            result.playerName = player.name;

            const allDone = session.players.filter(p => !p.retired).every(p => p.finished);
            if (allDone) {
                session.allFinished = true;
                result.allFinished = true;
                result.finalRankings = session.players.filter(p => !p.retired)
                    .sort((a, b) => a.finishRank - b.finishRank)
                    .map(p => ({ id: p.id, name: p.name, rank: p.finishRank }));
            }
        }

        ws.send(JSON.stringify({ ...result, session }));
        broadcast(data.sessionId, { type: 'cardSelectedByOther', playerId: player.id, cardType: 'skill', session }, player.id);
        if (result.allFinished) broadcast(data.sessionId, { type: 'gameCompleted', finalRankings: result.finalRankings, session });
    } else {
        broadcast(data.sessionId, { ...result, session });
    }
}
```

### 5.10 ターン管理・退職・リセット

```javascript
function handleNextTurn(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;
    let next = (session.currentPlayerIndex + 1) % session.players.length;
    for (let i = 0; i < session.players.length; i++) {
        if (!session.players[next].retired) break;
        next = (next + 1) % session.players.length;
    }
    session.currentPlayerIndex = next;
    session.drawnCards = [];
    session.diceValue = null;
    broadcast(data.sessionId, { type: 'nextTurn', session });
}

function handleResign(ws, data) {
    const session  = gameSessions.get(data.sessionId);
    const retiring = session.players.find(p => p.id === data.playerId);
    const target   = session.players.find(p => p.id === data.targetPlayerId);
    target.categories = [...target.categories, ...retiring.categories];
    retiring.categories.forEach(cid => { target.points[cid] = target.points[cid] ?? 0; });
    retiring.retired = true; retiring.categories = []; retiring.points = {};
    broadcast(data.sessionId, { type: 'playerRetired', retiredPlayerId: data.playerId, targetPlayerId: data.targetPlayerId, session });
}

function handleResetGame(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;
    Object.assign(session, { gameStarted: false, currentPlayerIndex: 0, drawnCards: [], selectedCardsHistory: [], usedCardIds: [], finishedPlayers: [], allFinished: false, diceValue: null });
    session.players.forEach(p => {
        Object.assign(p, { categories: [], points: {}, retired: false, categorySelected: false, selectedSkillCardIds: [], finished: false, finishRank: null, avatarId: null, avatarColorId: null, avatarSelected: false });
    });
    broadcast(data.sessionId, { type: 'gameReset', session });
}
```

### 5.11 Express REST API

```javascript
app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// requireAdmin ミドルウェア
function requireAdmin(req, res, next) {
    const token = req.headers.authorization?.substring(7);
    const td = token && adminTokens.get(token);
    if (!td) return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Token required or invalid' }});
    if (Date.now() > td.expiry) { adminTokens.delete(token); return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Token expired' }}); }
    req.admin = td; next();
}

// 認証
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = uuidv4();
        adminTokens.set(token, { username, expiry: Date.now() + TOKEN_EXPIRY });
        res.json({ ok: true, token, expiresIn: TOKEN_EXPIRY });
    } else {
        res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' }});
    }
});

// カード取得 API（認証不要）— better-sqlite3: 同期API
app.get('/api/cards/categories',         (req, res) => res.json(db.prepare('SELECT * FROM category_cards').all()));
app.get('/api/cards/skills',             (req, res) => res.json(db.prepare('SELECT * FROM skill_cards').all()));
app.get('/api/cards/missions',           (req, res) => res.json(db.prepare('SELECT * FROM missions').all()));
app.get('/api/cards/skill-types',        (req, res) => res.json(db.prepare('SELECT * FROM skill_types ORDER BY sortOrder').all()));
app.get('/api/cards/mission-categories', (req, res) => res.json(db.prepare('SELECT * FROM mission_categories').all()));

// 多言語
app.get('/api/lang/:lang', (req, res) => {
    const f = path.join(__dirname, 'lang', `${req.params.lang}.json`);
    if (!fs.existsSync(f)) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND' }});
    try { res.json({ ok: true, translations: JSON.parse(fs.readFileSync(f, 'utf8')) }); }
    catch (e) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR' }}); }
});

// 管理 API（requireAdmin 必須）
// category_cards CRUD
// better-sqlite3 では try/catch で同期的にエラーハンドリング
app.post('/api/admin/categories', requireAdmin, (req, res) => {
    try {
        const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints } = req.body;
        const result = db.prepare(
            'INSERT INTO category_cards (name_en,name_ja,imageUrl,descriptionHtml_en,descriptionHtml_ja,targetPoints) VALUES (?,?,?,?,?,?)'
        ).run(name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints);
        res.json({ ok: true, id: result.lastInsertRowid });
    } catch (e) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: e.message }}); }
});
app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
    try {
        const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints } = req.body;
        db.prepare('UPDATE category_cards SET name_en=?,name_ja=?,imageUrl=?,descriptionHtml_en=?,descriptionHtml_ja=?,targetPoints=? WHERE id=?')
          .run(name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints, req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: e.message }}); }
});
app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
    try { db.prepare('DELETE FROM category_cards WHERE id=?').run(req.params.id); res.json({ ok: true }); }
    catch (e) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: e.message }}); }
});

// skill_types CRUD（better-sqlite3、同パターン）
app.post('/api/admin/skill-types', requireAdmin, (req, res) => {
    try {
        const { name_en, name_ja, model_type, description_en, description_ja, sortOrder } = req.body;
        const result = db.prepare('INSERT INTO skill_types (name_en,name_ja,model_type,description_en,description_ja,sortOrder) VALUES (?,?,?,?,?,?)')
            .run(name_en, name_ja, model_type||'katz', description_en, description_ja, sortOrder||0);
        res.json({ ok: true, id: result.lastInsertRowid });
    } catch (e) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: e.message }}); }
});
app.put('/api/admin/skill-types/:id', requireAdmin, (req, res) => { /* 同パターンで UPDATE */ });
app.delete('/api/admin/skill-types/:id', requireAdmin, (req, res) => { /* 同パターンで DELETE */ });

// skills / missions CRUD（同パターン）
// CSV Import: POST /api/admin/import/:type  type: categories|skills|missions|skill-types
// Health: GET /api/health → { ok: true, timestamp }
```

---

## 6. クライアントサイド実装

### 6.1 I18n クラス

変更なし。ドット区切りキーを再帰解決する `t(key)` メソッドを持つ。

```javascript
class I18n {
    constructor() {
        this.translations = {};
        this.currentLang = localStorage.getItem('language') || (navigator.language.startsWith('ja') ? 'ja' : 'en');
    }
    async init() { await this.loadTranslations(this.currentLang); }
    async loadTranslations(lang) { /* GET /api/lang/${lang} */ }
    async setLanguage(lang) { /* loadTranslations → document.documentElement.lang → game.render() */ }
    t(key) { /* key.split('.') でネスト解決 */ }
}
const i18n = new I18n();
```

### 6.2 GameClient コンストラクタ

```javascript
class GameClient {
    constructor() {
        this.ws = null;
        this.language = 'ja';
        this.sessionId = null;
        this.playerId  = null;
        this.session   = null;
        this.connected = false;

        // mode: 'menu' | 'avatar-select' | 'lobby' | 'game'  ← v1.3 avatar-select 追加
        this.mode = 'menu';

        // キャッシュ
        this.categoryCardsCache = [];   // v1.2: 旧 jobCardsCache
        this.skillCardsCache    = [];
        this.missionCardsCache  = [];

        // カード選択状態
        this.selectedCard = null;
        this.drawnCards   = [];
        this.usedCardIds  = new Set();
        this.rolling      = false;

        // アバター選択（v1.3）
        this.pendingAvatarId  = null;
        this.pendingColorId   = null;

        // 3D シーン（v1.3）
        this.sceneManager = null;

        // モーダル
        this.modal = null;
        this._rmTimer = null;
    }

    async init() {
        await i18n.init();
        this.language = i18n.currentLang;
        this.connect();
        this.fetchCategoryCards();   // v1.2
        this.fetchSkillCards();
        this.fetchMissionCards();
        this.render();
    }

    async fetchCategoryCards() {
        const r = await fetch('/api/cards/categories');
        this.categoryCardsCache = await r.json();
    }
    async fetchSkillCards()   { this.skillCardsCache   = await (await fetch('/api/cards/skills')).json(); }
    async fetchMissionCards() { this.missionCardsCache = await (await fetch('/api/cards/missions')).json(); }
}
```

### 6.3 WebSocket 受信ハンドラ

```javascript
handleServerMessage(data) {
    switch (data.type) {
        // セッション
        case 'sessionCreated':
        case 'sessionJoined':
            this.sessionId = data.sessionId;
            this.playerId  = data.playerId;
            this.session   = data.session;
            this.mode = 'avatar-select';  // v1.3: lobbyの前にアバター選択
            this.render(); break;

        case 'playerJoined':
            this.session = data.session; this.render(); break;

        // アバター（v1.3）
        case 'avatarSelected':
            this.session = data.session; this.render(); break;

        // 職種（v1.2）
        case 'categorySelected':
            this.session = data.session; this.render(); break;

        case 'gameStarted':
            this.session = data.session;
            this.mode = 'game';
            if (!this.sceneManager) this.initScene();
            this.upScoreboard(); this.render(); break;

        case 'diceRolled':
            this.session = data.session;
            this.rolling = false;
            this.drawnCards = data.drawnCards;
            this.showCardArea(data.drawnCards);
            this.render(); break;

        case 'cardSelected':
            this.session = data.session;
            if (data.playerFinished) this.showGoalModal(data);
            if (data.allFinished) setTimeout(() => this.showFinalRankingsModal(data.finalRankings), 1500);
            this.upScoreboard(); this.render(); break;

        case 'cardSelectedByOther':
            this.session = data.session;
            if (this.sceneManager && data.cardType) {
                const p = this.session.players.find(pl => pl.id === data.playerId);
                if (p) this.sceneManager.showCardOnTable(p.id, data.cardType);
            }
            this.upScoreboard(); this.render(); break;

        case 'nextTurn':
            this.session = data.session;
            if (this.sceneManager) {
                const cur = this.session.players[this.session.currentPlayerIndex];
                this.sceneManager.updateTurn(cur.id);
            }
            this.upScoreboard(); this.hideCardArea(); this.render();
            const isMyTurn = this.session.players[this.session.currentPlayerIndex]?.id === this.playerId;
            this.setBtnState({ dice: isMyTurn ? 'active' : 'disabled', next: 'disabled' }); break;

        case 'playerRetired':
            this.session = data.session; this.render(); break;

        case 'gameReset':
            this.session = data.session;
            this.mode = 'lobby';
            this.initScene();
            this.upScoreboard(); this.render(); break;

        case 'gameCompleted':
            this.session = data.session;
            setTimeout(() => this.showFinalRankingsModal(data.finalRankings), 1500); break;

        case 'error':
            console.error('Server error:', data.error); break;
    }
}
```

### 6.4 render() — コンテナ分離

```javascript
render() {
    const app = document.getElementById('app');

    // menu / avatar-select は Three.js 未起動 → app 全体を置き換え
    if (this.mode === 'menu') {
        app.innerHTML = this.renderMenu(); this.attachEventListeners(); return;
    }
    if (this.mode === 'avatar-select') {
        app.innerHTML = this.renderAvatarSelect(); this.attachEventListeners(); return;
    }

    // lobby / game → #ui-interactive のみ更新（#scene-container を保護）
    const ui = document.getElementById('ui-interactive');
    if (!ui) return;
    let html = this.mode === 'lobby' ? this.renderLobby() : this.renderGame();
    if (this.modal) html += this.renderModal();
    ui.innerHTML = html;
    this.attachEventListeners();
}
```

### 6.5 アバター確定

```javascript
confirmAvatar() {
    if (!this.pendingAvatarId || !this.pendingColorId)
        return alert(this.t('avatar.pleaseSelect'));
    this.send({ type: 'selectAvatar', sessionId: this.sessionId, playerId: this.playerId,
                avatarId: this.pendingAvatarId, avatarColorId: this.pendingColorId });
    this.mode = 'lobby';
    this.initScene();
    this.render();
}

initScene() {
    if (this.sceneManager) { this.sceneManager.destroy(); this.sceneManager = null; }
    this.sceneManager = new SceneManager('scene-container');
    this.sceneManager.init(this.session.players);
}
```

### 6.6 カテゴリ選択（v1.2）

```javascript
selectCategory(categoryId) {
    this.send({ type: 'selectCategory', sessionId: this.sessionId, playerId: this.playerId, categoryId });
}
startGame() {
    this.send({ type: 'startGame', sessionId: this.sessionId, playerId: this.playerId });
}
```

---

## 7. 多言語対応システム

### 7.1 lang/ja.json（完全版）

```json
{
  "common": {
    "language":"言語","save":"保存","cancel":"キャンセル","close":"閉じる",
    "edit":"編集","delete":"削除","add":"追加","confirm":"確認","loading":"読み込み中..."
  },
  "game": {
    "title":"職種 × スキル カードゲーム",
    "subtitle":"キャリア教育カードゲーム",
    "createGame":"新しいゲームを作成",
    "joinGame":"ゲームに参加",
    "sessionId":"セッションID",
    "playerName":"プレイヤー名を入力してください",
    "join":"参加する",
    "lobby":"ロビー",
    "players":"プレイヤー",
    "selectCategory":"職種を選択してください",
    "categorySelected":"選択済み",
    "startGame":"ゲームを開始",
    "waitingForPlayers":"他のプレイヤーの参加を待っています...",
    "yourTurn":"あなたのターンです！",
    "otherTurn":"のターンです",
    "rollDice":"サイコロを振る",
    "rolling":"振っています...",
    "selectCard":"カードを選択してください",
    "cardSelectHint":"タップで選択 → もう一度タップで確定",
    "points":"ポイント",
    "playerFinished":"ゴール達成！",
    "allFinished":"全員がゴールしました！",
    "finalRankings":"最終順位",
    "playAgain":"もう一度遊ぶ",
    "backToMenu":"メニューへ",
    "copySessionId":"セッションIDをコピー",
    "copied":"コピーしました！",
    "retired":"退職",
    "matched":"マッチ！ +1ポイント",
    "notMatched":"あなたの職種とはマッチしませんでした",
    "alreadySelected":"このカードは選択済みです（ポイント加算なし）",
    "skillCard":"スキルカード","missionCard":"ミッションカード","specialMission":"特殊ミッション"
  },
  "avatar": {
    "title":"アバターを選んでください",
    "subtitle":"あなたのキャラクターをカスタマイズします",
    "chooseType":"アバター種別",
    "chooseColor":"アバターカラー",
    "confirm":"このアバターで決定",
    "pleaseSelect":"アバターとカラーを選択してください"
  },
  "admin": {
    "loginTitle":"管理者ログイン","username":"ユーザー名","password":"パスワード","login":"ログイン",
    "loginError":"ユーザー名またはパスワードが正しくありません",
    "categoryCards":"職種カード","skillCards":"スキルカード","missions":"ミッション",
    "skillTypes":"スキル区分",
    "modelTypeKatz":"Katzモデル",
    "exportCSV":"CSVエクスポート","importCSV":"CSVインポート",
    "targetPoints":"必要ポイント","matchesCategories":"対応職種",
    "category":"カテゴリ","targetAudience":"実施対象","isSpecial":"特殊ミッション"
  },
  "errors": {
    "UNAUTHORIZED":"認証が必要です","SERVER_ERROR":"サーバーエラーが発生しました",
    "CATEGORY_TAKEN":"その職種はすでに選択されています",
    "SESSION_NOT_FOUND":"セッションが見つかりません",
    "GAME_ALREADY_STARTED":"ゲームはすでに開始されています","SESSION_FULL":"セッションが満員です"
  }
}
```

lang/en.json は同じキー構造で英語翻訳を提供する（`selectCategory`→"Select a Job Role"、`categoryCards`→"Job Role Cards"、`modelTypeKatz`→"Katz Model"、`avatar.title`→"Choose Your Avatar" 等）。

---

## 8. 管理画面実装

### 8.1 タブ構成（v1.2）

```html
<button data-tab="categories">職種カード</button>   <!-- v1.2: 旧 jobs -->
<button data-tab="skill-types">スキル区分</button>  <!-- v1.2 新規 -->
<button data-tab="skills">スキルカード</button>
<button data-tab="missions">ミッション</button>
<button data-tab="mission-categories">カテゴリ</button>
```

### 8.2 管理JS 主要変更点（v1.2）

```javascript
let allData = { categories:[], skillTypes:[], skills:[], missions:[], missionCategories:[] };

async function loadData() {
    const [cats, sts, skills, missions, mc] = await Promise.all([
        fetch('/api/cards/categories').then(r => r.json()),
        fetch('/api/cards/skill-types').then(r => r.json()),
        fetch('/api/cards/skills').then(r => r.json()),
        fetch('/api/cards/missions').then(r => r.json()),
        fetch('/api/cards/mission-categories').then(r => r.json())
    ]);
    allData = { categories:cats, skillTypes:sts, skills, missions, missionCategories:mc };
}

// matchesCategories チェックボックス（skill_cards フォーム）
function renderMatchesCategoriesCheckboxes(selectedIds=[]) {
    return allData.categories.map(cat =>
        `<label><input type="checkbox" name="matchesCategories" value="${cat.id}"
                 ${selectedIds.includes(cat.id)?'checked':''}> ${cat.name_ja}</label>`
    ).join('');
}
```

### 8.3 画像アップロード（変更なし）

最大800×800px、JPEG品質75%でリサイズ後Base64エンコード。2MB超は品質50%で再エンコード。

### 8.4 ロビー待機 UI 仕様

```
【招待URLエリア】
  - 招待URL: http(s)://<host>?session=<sessionId>
  - 「コピー」ボタン → clipboard.writeText（非HTTPS環境は alert フォールバック）

【プレイヤー一覧】
  - 各プレイヤーをカード表示
    - アバターアイコン（avatarColorId の背景色 + 名前頭文字）
    - 名前 + 「あなた」バッジ（自分の playerId と一致するカードのみ）
    - 「職種選択済み」バッジ（categorySelected === true のとき）

【待機メッセージ（プレイヤー一覧の下）】
  players.length < 2        : "あと ${2 - players.length} 人の参加を待っています..."
  players.length === maxPlayers : 表示なし（満員）

【ゲーム開始ボタン（ホストのみ表示）】
  有効条件: players.length >= 2 AND players.every(p => p.categorySelected)
  無効時:   グレーアウト + "全員が職種を選択するまでお待ちください"
```

---

## 9. ゲームロジック詳細

### 9.1 ゲームフロー（v1.3 確定版）

```
[メニュー] → createSession / joinSession
      ↓
[アバター選択]  ← v1.3
  → avatarId / avatarColorId 選択 → confirmAvatar()
      ↓
[ロビー] 職種（カテゴリ）選択 ← v1.2
  → 全員 categorySelected → startGame()
      ↓
[ゲームループ]
  1. サイコロ → ダイスアニメーション（2.4秒）
  2. カード 2〜5枚 スライドアップ表示
  3. 1st tap → カードハイライト
  4. 2nd tap → confirmCard()
     → スキルカード: ポイント+1、スコアバー更新、imageUrlがあれば画像表示
     → ミッション: チーム議論
     → 特殊ミッション: 退職&強制兼任
  5. 「次のターン」→ カメラがアクティブプレイヤー方向へ移動
      ↓
[ゴール] 全職種 targetPoints 達成 → 最終ランキング
```

### 9.2 勝利条件

```javascript
// 単一職種
player.points[categoryId] >= category.targetPoints

// 兼任（複数職種）
player.categories.every(cid => {
    const cat = categoryCards.find(c => c.id === cid);
    return player.points[cid] >= cat.targetPoints;
})
```

---

## 10. セキュリティ実装

### 10.1 環境変数

```env
# .env（.gitignore に含まれる — コミット禁止）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here
PORT=3000
```

### 10.2 認証トークン

Bearer token（UUID v4）、24時間有効、メモリ上の Map で管理。

### 10.3 入力検証

必須フィールドの存在チェック、`targetPoints` の数値検証、Base64画像は2MB以内に制限。

---

## 11. デプロイメント手順

### 11.1 ローカル開発

```bash
npm install
cp .env.example .env && nano .env
npm run initdb
npm start  # http://localhost:3000
```

### 11.2 systemd サービス

```ini
# /etc/systemd/system/career-card-game.service
[Unit]
Description=Career Card Game WebSocket Server
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
```

```bash
sudo mkdir -p /var/log/career-card-game && sudo chown ubuntu:ubuntu /var/log/career-card-game
sudo systemctl daemon-reload && sudo systemctl enable --now career-card-game
```

### 11.3 Nginx + Let's Encrypt

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    server_tokens off;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";  # WebSocket必須
        proxy_set_header Host $host;
        proxy_read_timeout 86400;               # 長時間接続のため重要
    }
}
```

```bash
sudo certbot certonly --nginx -d your-domain.com
sudo nginx -t && sudo systemctl restart nginx
```

---

## 12. トラブルシューティング

| 症状 | 解決方法 |
|---|---|
| 管理画面ログイン失敗 | `.env` の存在確認、`=== LOGIN ATTEMPT ===` ログで照合 |
| WebSocket Disconnected | Nginx の `proxy_set_header Upgrade` 設定確認、`wss://` プロトコル確認 |
| 3D シーンが真っ黒 | WebGL 対応ブラウザか確認、コンソールで THREE エラー確認 |
| DBエラー | `rm game.db && npm run initdb` |
| ポート競合 | `PORT=8080 npm start` または `sudo kill -9 $(lsof -ti :3000)` |

---

## 13. 実装チェックリスト

### 13.1 サーバーサイド

- [ ] server.js（WebSocket + Express）
- [ ] handleCreateSession（seatIndex=0, avatarId=null）
- [ ] handleJoinSession（seatIndex 自動割り当て）
- [ ] **[v1.3]** handleSelectAvatar
- [ ] **[v1.2]** handleSelectCategory（旧 handleSelectJob）
- [ ] handleStartGame / handleRollDice（matchesCategories）/ handleSelectCard（category_cards参照）
- [ ] handleNextTurn / handleResign（categories）/ handleResetGame
- [ ] GET /api/cards/categories（旧 /jobs）
- [ ] GET /api/cards/skill-types
- [ ] GET /api/cards/mission-categories
- [ ] /api/admin/categories CRUD
- [ ] /api/admin/skill-types CRUD
- [ ] /api/auth/login / requireAdmin
- [ ] initdb.js（5テーブル + サンプルデータ）

### 13.2 クライアントサイド

- [ ] index.html（Three.js CDN、#scene-container、#ui-interactive、#sb）
- [ ] CSS アニメーション（@keyframes su / fo / pip）
- [ ] I18n クラス
- [ ] GameClient（mode: menu/avatar-select/lobby/game）
- [ ] **[v1.3]** SceneManager クラス
- [ ] **[v1.3]** renderAvatarSelect() / confirmAvatar()
- [ ] **[v1.2]** categoryCardsCache / fetchCategoryCards()
- [ ] **[v1.2]** selectCategory() / categorySelected ハンドラ
- [ ] **[v1.3]** upScoreboard()（横一列スコアバー）
- [ ] **[v1.3]** showCardArea() / onCardClick() / confirmCard()
- [ ] **[v1.3]** showResult()（imageUrl 対応）
- [ ] **[v1.3]** setBtnState()
- [ ] WebSocket 自動再接続

### 13.3 管理画面

- [ ] categories タブ（旧 jobs）
- [ ] skill-types タブ（新規）
- [ ] matchesCategories チェックボックス
- [ ] model_type フィールド（'katz' 固定）
- [ ] CSV Export/Import（categories, skill-types 対応）

### 13.4 3D 環境

- [ ] SceneManager._setupRenderer()
- [ ] SceneManager._buildScene()（八角形部屋・六角タイル・パーティクル・テーブル）
- [ ] SceneManager._buildAvatars(players)
- [ ] SceneManager._setupCameraControls()（マウス/タッチ）
- [ ] SceneManager._startAnimationLoop()
- [ ] プレイヤー専用ポイントライト ×4
- [ ] SceneManager.updateTurn() / triggerDiceRoll() / showCardOnTable() / destroy()
- [ ] ラベル投影計算（毎フレーム直接 DOM 更新）

### 13.5 多言語対応

- [ ] lang/ja.json（avatar.* キー追加）
- [ ] lang/en.json（同上）

### 13.6 デプロイメント

- [ ] systemd サービス / Nginx + Let's Encrypt / ファイアウォール

---

## 14. 本番運用チェックリスト

- [ ] .env に強力なパスワード設定
- [ ] HTTPS/WSS 使用
- [ ] DBバックアップ設定
- [ ] ログローテーション
- [ ] systemd 自動起動確認
- [ ] WebGL 対応ブラウザでの動作確認

---

## 15. 3D環境システム

### 15.1 レンダリングアーキテクチャ

```
#app div
├── #scene-container  (position:absolute; z-index:1)
│   └── Three.js canvas（WebGLRenderer）
└── #ui-interactive   (position:absolute; z-index:3)
    ├── #sb（スコアバー）
    ├── #ca（カードエリア）
    ├── #rm（結果モーダル）
    └── ボタン類
```

### 15.2 SceneManager クラス API

```javascript
class SceneManager {
    constructor(containerId) { /* container, scene, camera, renderer, avatarGroups, turnRings, labelElements, animationId, camCurrent/camTarget, playerLights */ }
    init(players)                       // シーン構築・アニメーション開始
    destroy()                           // リソース解放・canvas 削除
    updateTurn(currentPlayerId)         // リング更新 + カメラ移動
    triggerDiceRoll(callback=null)      // ダイスアニメーション
    showCardOnTable(playerId, cardType) // 3Dカードメッシュ追加
    focusCameraOnSeat(seatIndex)        // カメラを該当プレイヤー方向へ
}
const SEAT_ANGLES = [0, Math.PI/2, Math.PI, 3*Math.PI/2];
const SEAT_RADIUS = 4.75;
```

### 15.3 シーン構成（主要オブジェクト）

**ライティング**:

| 種類 | パラメータ | 用途 |
|---|---|---|
| AmbientLight | 0x1a1a40, 1.6 | 全体の底上げ |
| SpotLight | 0xfff4e8, 2.6, 30, π/4.8, 0.5, 1.0 @ (0,13,0) | テーブル中央主光源 |
| PointLight × 2 | 0x6366f1/0x10b981, 0.45/0.25 @ (±7,2,±7) | サイドリム（ゆらぎあり）|
| **PointLight × 4** | 0xfff6e8, 1.1, 7.5 @ (sin(ang)*SR*0.85, 5.5, cos(ang)*SR*0.85) | プレイヤー専用（安定）|

**テーブル**:

| パーツ | ジオメトリ | カラー |
|---|---|---|
| フェルト天板 | CylinderGeometry(3.32,3.32,.12,64) | #163016 |
| 木製リム | CylinderGeometry(3.45,3.45,.18,64,1,true) | #4a1e0e |
| 脚 × 4 | CylinderGeometry(.11,.15,2.5,8) | #3a1608 |

**八角形部屋**: roomR=16, wallH=10。壁 × 8 + LED底面ストリップ(#6366f1) + 上部アクセントバー(#38bdf8) + 柱 × 8 + 天井 + 中央グロウディスク

**六角タイルフロア**: CylinderGeometry(1.22,1.22,.045,6)、r×c ループで半径14m以内に配置、random でエミッシブ点灯

**パーティクル**: Three.js Points (70個)、BufferGeometry で位置・色を管理、毎フレーム y 座標をサイン波で更新

### 15.4 カメラシステム

```javascript
// 毎フレーム lerp
const L = 0.07;
current.theta  += (target.theta  - current.theta)  * L;
current.phi    += (target.phi    - current.phi)    * L;
current.radius += (target.radius - current.radius) * L;

// 座標計算
camera.position.set(
    r * Math.sin(theta) * Math.sin(phi),
    r * Math.cos(phi) + 1.2,
    r * Math.cos(theta) * Math.sin(phi)
);
camera.lookAt(0, 1, 0);

// ターン切り替え時のフォーカス
focusCameraOnSeat(i) {
    this.camTarget.theta = SEAT_ANGLES[i] + Math.PI + 0.35;
    this.camTarget.phi   = 0.97;
}
```

### 15.5 ラベル投影（毎フレーム直接 DOM 更新）

```javascript
const wp = new THREE.Vector3();
avatarGroups.forEach((grp, playerId) => {
    const el = labelElements.get(playerId);
    wp.set(0, 3.1, 0);
    wp.applyMatrix4(grp.matrixWorld);
    wp.project(camera);
    el.style.left    = ((wp.x *  0.5 + 0.5) * W) + 'px';
    el.style.top     = ((wp.y * -0.5 + 0.5) * H - 14) + 'px';
    el.style.display = wp.z > 1 ? 'none' : 'block';
});
// ※ React state ではなく直接 DOM 操作で更新（毎フレーム実行のため）
```

---

## 16. アバターシステム

### 16.1 定数

```javascript
const AVATAR_TYPES = [
    { id:1, name_ja:'卒業キャップ', name_en:'Grad Cap',  accessory:'cap'     },
    { id:2, name_ja:'ベレー帽',     name_en:'Beret',     accessory:'beret'   },
    { id:3, name_ja:'お団子ヘア',   name_en:'Hair Bun',  accessory:'bun'     },
    { id:4, name_ja:'メガネ',       name_en:'Glasses',   accessory:'glasses' },
];

const AVATAR_COLORS = [
    { id:1, name_ja:'インディゴ',  hex:'#6366f1', three:0x6366f1 },
    { id:2, name_ja:'アンバー',    hex:'#f59e0b', three:0xf59e0b },
    { id:3, name_ja:'エメラルド',  hex:'#10b981', three:0x10b981 },
    { id:4, name_ja:'レッド',      hex:'#ef4444', three:0xef4444 },
    { id:5, name_ja:'スカイ',      hex:'#38bdf8', three:0x38bdf8 },
    { id:6, name_ja:'バイオレット',hex:'#a855f7', three:0xa855f7 },
];
```

### 16.2 アバター3Dジオメトリ

**共通パーツ**:

| パーツ | ジオメトリ | カラー | y位置 |
|---|---|---|---|
| 胴体 | CylinderGeometry(.27,.33,.88,16) | avatarColor | 1.77 |
| 首  | CylinderGeometry(.1,.13,.17,10) | #dba882 | 2.25 |
| 頭  | SphereGeometry(.33,16,16) | #f0c098 | 2.62 |

**アクセサリー**:

| accessory | ジオメトリ | カラー |
|---|---|---|
| cap | BoxGeometry(.7,.07,.7) @ y=3.0 | #1a1a2e |
| beret | SphereGeometry(.32,12,12) scale.y=.34 @ y=2.92 | avatarColor |
| bun | SphereGeometry(.14,8,8) @ y=2.97 | #4a2a08 |
| glasses | TorusGeometry(.09,.02,6,12)×2 @ y=2.58,z=.3 | #8888a0 |

**ターンリング**: TorusGeometry(.54,.055,8,28)、position.y=.91、rotation.x=π/2  
アクティブ: color=avatarColor, opacity=.9, パルスアニメーション `scale = 1 + sin(t*3.6)*.13`  
非アクティブ: color=0x282848, opacity=.15

**椅子**: BoxGeometry(1.18,.09,1.18) seat + BoxGeometry(1.18,.88,.09) back + CylinderGeometry(.04,.04,.83,7)×4 legs

**座席位置・回転**:
```javascript
const ang = SEAT_ANGLES[player.seatIndex];
grp.position.set(Math.sin(ang)*SEAT_RADIUS, -1.65, Math.cos(ang)*SEAT_RADIUS);
grp.rotation.y = Math.atan2(Math.sin(ang)*SEAT_RADIUS, Math.cos(ang)*SEAT_RADIUS);
```

### 16.3 WebSocket プロトコル

```
クライアント → サーバー:
{ type: 'selectAvatar', sessionId, playerId, avatarId, avatarColorId }

サーバー → 全員 broadcast:
{ type: 'avatarSelected', playerId, avatarId, avatarColorId, session }
```

---

## 17. 3D×2D統合レイヤー

### 17.1 モードとシーン対応

| mode | Three.jsシーン | 2D UIレイヤー |
|---|---|---|
| menu | なし | メニュー（全画面 innerHTML） |
| avatar-select | なし | アバター選択UI（全画面 innerHTML）|
| lobby | SceneManager 起動・アバター表示 | 職種選択UI |
| game | SceneManager 稼働 | カード・スコアバー・ボタン |

### 17.2 横一列スコアバー仕様

```html
<div id="sb" style="position:absolute;top:10px;left:10px;right:10px;z-index:3;
  display:flex;background:rgba(6,6,18,.93);border:0.5px solid rgba(255,255,255,.1);
  border-radius:8px;overflow:hidden;"></div>
```

各セル（プレイヤー × 4）:
- `flex:1; border-top: 2.5px solid playerHex`（アクティブ時）
- `background: playerHex + '14'`（アクティブ）/ `playerHex + '20'`（フラッシュ）
- 上段: カラードット + 名前 + 職種バッジ + pts表示（ゴール時🏆）
- 下段: ピップ列（filled=glow、empty=薄枠）

```javascript
function upScoreboard(flashIdx = -1) {
    document.getElementById('sb').innerHTML = session.players.map((p, i) => {
        const isCur = i === session.currentPlayerIndex;
        const pips  = Array.from({ length: p.max }, (_, j) => {
            const fill = j < p.pts, isNew = flashIdx === i && j === p.pts - 1;
            return `<span style="...${fill ? 'box-shadow:0 0 5px '+p.hex+'99;' : ''}
                    ${isNew ? 'animation:pip .4s ease;' : ''}"></span>`;
        }).join('');
        return `<div style="flex:1;border-top:2.5px solid ${isCur?p.hex:'transparent'};
                background:${isCur?p.hex+'14':flashIdx===i?p.hex+'20':'transparent'};transition:background .35s;">
            <div><!-- name + job badge + pts --></div>
            <div>${pips}</div></div>`;
    }).join('');
}
```

### 17.3 ターン切り替え連携

```javascript
// 'nextTurn' 受信時
sceneManager.updateTurn(currentPlayer.id);  // リング更新 + カメラ移動
upScoreboard();
hideCardArea();
setBtnState({ dice: isMyTurn ? 'active' : 'disabled', next: 'disabled' });
```

---

## 18. カードインタラクションシステム

### 18.1 カード表示・選択・確定フロー

```
rollDice() →（2.4s アニメーション）→ 'diceRolled' 受信
      ↓
showCardArea(drawnCards)  // スライドアップ表示
      ↓
1st tap → onCardClick()   // ハイライト
      ↓
2nd tap → confirmCard()   // 確定
      ↓
showResult(msg, type, imageUrl)  // 結果モーダル（画像対応）
sceneManager.showCardOnTable()   // 3D配置
upScoreboard(CT)                 // ピップ点灯
setBtnState({ next: 'active' })  // 次のターンボタン有効化
```

### 18.2 カード表示仕様

- **位置**: `position:absolute; bottom:58px; z-index:10`
- **カード**: width 108px, min-height 128px, animation `su .32s ease (i*.07s)`
- **グラデーションヘッダー**: skill=#f093fb→#f5576c / mission=#4facfe→#00f2fe / special=#fa709a→#fee140

### 18.3 カード選択ロジック

```javascript
onCardClick(card, div) {
    if (this.selectedCard?.id === card.id) { this.confirmCard(card); return; }
    // deselect others
    document.querySelectorAll('.drawn-card').forEach(c => { c.style.transform=''; c.style.border='...'; });
    this.selectedCard = card;
    div.style.transform = 'translateY(-10px) scale(1.06)';
    div.style.boxShadow = `0 8px 28px ${CARD_GLOW[card.type]}`;
    div.style.border    = `1px solid ${CARD_GLOW[card.type]}`;
    hintEl.textContent  = 'もう一度タップで確定';
}
```

### 18.4 confirmCard（画像対応）

```javascript
confirmCard(card) {
    this.usedCardIds.add(card.id);
    if (card.type === 'skill') {
        const p = players[currentIndex];
        p.pts = Math.min(p.max, (p.pts||0) + 1);
        p.finished = p.pts >= p.max;
        this.upScoreboard(currentIndex);
        setTimeout(() => this.upScoreboard(), 700);
    }
    this.showResult(msg, card.type, null, card.imageUrl);  // imageUrl渡す
    this.sceneManager?.showCardOnTable(currentPlayerId, card.type);
    this.send({ type:'selectCard', sessionId, playerId, cardId:card.id });
    this.hideCardArea();
    this.setBtnState({ dice:'disabled', next:'active' });
}
```

### 18.5 showResult（画像対応）

```javascript
showResult(msg, type=null, col=null, imageUrl=null) {
    const c = col ?? (type ? CARD_GLOW[type] : 'rgba(99,102,241,.8)');
    const imgHtml = imageUrl
        ? `<img src="${imageUrl}" style="width:100%;max-height:120px;border-radius:6px;
                margin-bottom:10px;object-fit:cover;">`
        : '';
    rm.innerHTML = imgHtml + msg.replace(/\n/g,'<br>');
    rm.style.border  = `0.5px solid ${c}`;
    rm.style.display = 'block';
    clearTimeout(this._rmTimer);
    this._rmTimer = setTimeout(() => {
        rm.style.animation = 'fo .4s ease forwards';
        setTimeout(() => { rm.style.display='none'; rm.style.animation=''; }, 400);
    }, 2200);
}
```

### 18.6 ボタン状態管理

| 状態 | dice | next |
|---|---|---|
| ターン開始 | active | disabled |
| 振り中 | rolling（"振り中..."）| disabled |
| カード表示中 | disabled | disabled |
| カード確定後 | disabled | **active** |
| 次のターンへ | active（リセット）| disabled |
| 他プレイヤーのターン | disabled | disabled |

---

## 19. z-index・CSSアニメーション定義

### 19.1 z-index 階層

| レイヤー | 要素 | z-index |
|---|---|---|
| Three.js canvas | 3D シーン | 1 |
| プレイヤーラベル | 座席名前表示 | 2 |
| スコアバー・ボタン | #sb, ボタン類, ヒント | 3 |
| カードエリア | #ca（スライドアップ）| 10 |
| 結果モーダル | #rm | 20 |

### 19.2 CSSアニメーション

```css
/* カードのスライドアップ */
@keyframes su {
  from { opacity: 0; transform: translateY(30px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* 結果モーダルのフェードアウト */
@keyframes fo {
  to { opacity: 0; transform: scale(0.94); }
}

/* スコアバーのピップ点灯 */
@keyframes pip {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.5); }
  100% { transform: scale(1); }
}
```

---

## 20. 参考資料

### 20.1 公式ドキュメント

- Node.js: https://nodejs.org/
- Express.js: https://expressjs.com/
- WebSocket (ws): https://github.com/websockets/ws
- SQLite3: https://www.sqlite.org/
- Three.js: https://threejs.org/docs/

### 20.2 理論的フレームワーク

- Katz, R.L. (1955). Skills of an Effective Administrator. *Harvard Business Review*.

> **注**: `skill_types` テーブルの `model_type` フィールドは将来的な拡張に備えた予備フィールド。現バージョンは `'katz'` 固定で実装する。

### 20.3 プロジェクト固有ドキュメント

- v1.3-implementation-prompts.md: 実装プロンプト集
- README.md: プロジェクト概要
- NGINX-REVERSE-PROXY.md: Nginx設定手順

---

**仕様書バージョン**: 1.3 (Full)  
**最終更新日**: 2026-06-13  
**実装状況**: 🚧 v1.2 ベース実装済み + 3D機能実装中  
**Claude再現性**: ✅ この1ファイルでゼロから完全再現可能
