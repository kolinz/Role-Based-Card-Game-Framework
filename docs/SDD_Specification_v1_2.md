# 職種×スキル カードゲーム - 完全実装仕様書 v1.2

**プロジェクト名**: Role Based Card Game Framework  
**バージョン**: 1.2  
**最終更新**: 2026-06-13  
**実装状況**: ✅ 本番運用可能

---

## 📋 変更履歴

| バージョン | 日付 | 主な変更内容 |
|---|---|---|
| 1.1 | 2026-02-05 | 初版リリース |
| 1.2 | 2026-06-13 | カード階層の再設計（職種をトップレベルに昇格）、`job_cards` → `category_cards` リネーム、`skill_types` テーブル追加、API・WebSocket・i18nキー更新 |

### v1.1 → v1.2 の主要変更点

**カード階層の再設計**  
職種（SE、PMなど）をゲームの基軸となる大分類として明示するため、カード分類の階層構造を以下のように再定義しました。

| 階層 | v1.1 の名称 | v1.2 の名称 | 説明 |
|---|---|---|---|
| 大分類 | — | **カテゴリ** | 職種（SE、PM、QAなど） |
| 中分類 | カテゴリ（Katzの3区分） | **スキル区分** | Katz/Druckerモデルによるスキル分類 |
| 小分類 | スキル | **スキル** | 個別スキルカード |

**DBテーブル変更**
- `job_cards` → `category_cards` にリネーム
- `skill_types` テーブルを新規追加（`model_type` フィールドで katz/drucker を区別）

**WebSocket メッセージタイプ変更**

| v1.1 | v1.2 |
|---|---|
| `jobSelected` | `categorySelected` |

**REST API エンドポイント変更**

| v1.1 | v1.2 |
|---|---|
| `GET /api/cards/jobs` | `GET /api/cards/categories` |
| `POST /api/admin/jobs` | `POST /api/admin/categories` |
| `PUT /api/admin/jobs/:id` | `PUT /api/admin/categories/:id` |
| `DELETE /api/admin/jobs/:id` | `DELETE /api/admin/categories/:id` |

> **注意**: v1.1 で `GET /api/cards/categories` はミッションカテゴリ取得用でしたが、v1.2 では職種カード取得用に変更されます。ミッションカテゴリは `GET /api/cards/mission-categories` に移動します。

**i18n キー変更**

| v1.1 | v1.2 |
|---|---|
| `game.selectJob` | `game.selectCategory` |
| `game.jobSelected` | `game.categorySelected` |
| `admin.jobCards` | `admin.categoryCards` |

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

---

## 1. プロジェクト概要

### 1.1 プロジェクトの目的

キャリア教育・職業理解を目的としたオンラインマルチプレイヤーカードゲームプラットフォーム。

**主要機能**:
- 3種類のカード（職種・スキル・ミッション）を使ったゲームメカニクス
- WebSocketによるリアルタイム同期
- 多言語対応（日本語・英語）
- 管理画面によるカード編集
- CSV Import/Export機能

### 1.2 カード概念モデル

本ゲームのカード体系はKatz（カッツ）の3スキルモデルおよびDruckerのマネジメントモデルに基づきます。

```
カテゴリ（大分類）    ← 職種（SE、PM、QA Engineer など）
    └── スキル区分（中分類）← Katz/Druckerモデルによる分類
            └── スキル（小分類）← 個別スキルカード
```

- **カテゴリ**: ゲームにおける「職種」。プレイヤーはここから自分の担当職種を選択する。
- **スキル区分**: スキルカードを束ねる中間分類。`model_type`（`katz` / `drucker`）で理論モデルを区別する。Katzモデルでは「テクニカル・ヒューマン・コンセプチュアル」の3区分が基本。
- **スキル**: プレイヤーが実際に選択するカード。どのカテゴリ（職種）にマッチするかを `matchesCategories` で定義する。

### 1.3 対象ユーザー

**プレイヤー**: 
- 中学生〜大学生（キャリア教育）
- 企業研修参加者（職種理解）
- 2〜4人のグループ

**運営者**:
- 教育機関の教員
- 企業の人事・研修担当者
- ゲーム管理者

### 1.4 システム要件

**サーバー環境**:
- Node.js 20以上
- 1GB RAM以上
- Ubuntu 22.04 LTS推奨

**クライアント環境**:
- モダンWebブラウザ（Chrome/Firefox/Safari/Edge）
- JavaScript有効化必須
- WebSocket対応必須

---

## 2. システムアーキテクチャ

### 2.1 全体構成図

```
┌─────────────────┐
│  Client Browser │
│  (index.html)   │
│  (game.js)      │
└────────┬────────┘
         │ WebSocket
         │ HTTP/HTTPS
         ↓
┌─────────────────┐
│   Nginx (SSL)   │
│  Reverse Proxy  │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   Node.js       │
│   Express       │
│   WebSocket     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   SQLite DB     │
│   (game.db)     │
└─────────────────┘
```

### 2.2 通信フロー

```
[クライアント] --WebSocket--> [サーバー]
      ↓                           ↓
   game.js                    server.js
      ↓                           ↓
   UIレンダリング          セッション管理
      ↑                           ↓
   イベント受信              データベース
      ↑                           ↓
   [WebSocket] <--ブロードキャスト--
```

### 2.3 ファイル構成

```
Role-Based-Card-Game-Framework/
├── server.js              # メインサーバー（Express + WebSocket）
├── index.html             # ゲーム画面
├── game.js                # クライアントロジック
├── admin.html             # 管理画面
├── initdb.js              # DB初期化スクリプト
├── package.json           # 依存関係定義
├── .env                   # 環境変数（要作成）
├── .env.example           # 環境変数サンプル
├── .gitignore             # Git除外設定
├── game.db                # SQLiteデータベース（自動生成）
├── lang/
│   ├── en.json           # 英語翻訳
│   └── ja.json           # 日本語翻訳
├── docs/
│   ├── TROUBLESHOOTING.md
│   ├── SDD_SPECIFICATION.md
│   ├── NGINX-REVERSE-PROXY.md
│   └── Reflection-sheet-sample.docx
└── README.md
```

---

## 3. 技術スタック詳細

### 3.1 バックエンド

**package.json**:
```json
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
```

**依存関係の役割**:
- **express**: HTTPサーバー + REST API
- **ws**: WebSocketサーバー（リアルタイム通信）
- **sqlite3**: データベース（カード情報・設定保存）
- **uuid**: セッションID・プレイヤーID生成
- **dotenv**: 環境変数管理（認証情報）

### 3.2 フロントエンド

**技術選定理由**:
- Vanilla JavaScript（フレームワーク不要）
- CSS3グラデーション・アニメーション
- WebSocket APIネイティブサポート
- モバイル対応レスポンシブデザイン

**フォント**:
```html
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
```

---

## 4. データベース設計

### 4.1 テーブル一覧

| テーブル名 | 役割 | v1.1からの変更 |
|---|---|---|
| `mission_categories` | ミッションカテゴリ | 変更なし |
| `category_cards` | 職種カード（大分類） | `job_cards` からリネーム |
| `skill_types` | スキル区分（中分類） | **新規追加** |
| `skill_cards` | スキルカード（小分類） | `matchesJobs` → `matchesCategories` にリネーム |
| `missions` | ミッションカード | 変更なし |

### 4.2 テーブル構造

#### mission_categories（ミッションカテゴリ）

```sql
CREATE TABLE mission_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL,
    name_ja TEXT NOT NULL,
    description_en TEXT,
    description_ja TEXT,
    sortOrder INTEGER DEFAULT 0
);
```

**サンプルデータ**:
```javascript
['Crisis Management', '危機管理', 'Handling unexpected issues', '予期せぬ問題への対応', 1],
['Decision Making', '意思決定', 'Making strategic choices', '戦略的な選択', 2],
['Communication', 'コミュニケーション', 'Team coordination', 'チーム調整', 3],
['Resource Management', 'リソース管理', 'Budget and time management', '予算と時間管理', 4]
```

#### category_cards（職種カード ＝ カテゴリ大分類）

> **v1.1からの変更**: `job_cards` → `category_cards` にリネーム。フィールド構造は変更なし。

```sql
CREATE TABLE category_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL,
    name_ja TEXT NOT NULL,
    imageUrl TEXT,                    -- Base64画像 or NULL
    descriptionHtml_en TEXT,          -- HTML形式の説明
    descriptionHtml_ja TEXT,
    targetPoints INTEGER NOT NULL     -- ゴール必要ポイント
);
```

**重要**: imageUrlはBase64エンコードされた画像データまたはNULL

**サンプルデータ（6件）**: Engineer / エンジニア、Designer / デザイナー、Project Manager / プロジェクトマネージャー、QA Engineer / QAエンジニア、DevOps Engineer / DevOpsエンジニア、Data Analyst / データアナリスト

#### skill_types（スキル区分 ＝ 中分類）

> **v1.2 新規追加**。KatzモデルとDruckerモデルを統一的に管理するためのテーブル。

```sql
CREATE TABLE skill_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL,
    name_ja TEXT NOT NULL,
    model_type TEXT NOT NULL DEFAULT 'katz',  -- 'katz' | 'drucker'
    description_en TEXT,
    description_ja TEXT,
    sortOrder INTEGER DEFAULT 0
);
```

**`model_type` の値**:
- `'katz'`: カッツの3スキルモデルに基づく区分（テクニカル・ヒューマン・コンセプチュアル）
- `'drucker'`: ドラッカーのマネジメントモデルに基づく区分

**Katzモデルのサンプルデータ（3件）**:
```javascript
['Technical Skill', 'テクニカルスキル', 'katz', 'Operational and technical expertise', '業務・技術的専門知識', 1],
['Human Skill',    'ヒューマンスキル',  'katz', 'Interpersonal and communication skills', '対人・コミュニケーション能力', 2],
['Conceptual Skill','コンセプチュアルスキル', 'katz', 'Strategic and abstract thinking', '概念的・戦略的思考力', 3]
```

#### skill_cards（スキルカード ＝ 小分類）

> **v1.2からの変更**: `matchesJobs` → `matchesCategories` にカラム名変更。処理ロジックは同一。

```sql
CREATE TABLE skill_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL,
    name_ja TEXT NOT NULL,
    imageUrl TEXT,
    descriptionHtml_en TEXT,
    descriptionHtml_ja TEXT,
    matchesCategories TEXT            -- カンマ区切りの職種ID "1,3,5"（旧: matchesJobs）
);
```

**matchesCategoriesの処理**:
```javascript
// サーバー側（handleRollDice内）
const matchesCategories = skill.matchesCategories
    ? skill.matchesCategories.split(',').map(Number)
    : [];

// マッチング判定（handleSelectCard内）
if (matchesCategories.includes(playerCategoryId)) {
    matched = true;
    points += 1;
}
```

#### missions（ミッションカード）

変更なし。

```sql
CREATE TABLE missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT,
    name_ja TEXT,
    imageUrl TEXT,
    descriptionHtml_en TEXT NOT NULL,
    descriptionHtml_ja TEXT NOT NULL,
    categoryId INTEGER,
    target_en TEXT,                   -- 実施対象（英語）
    target_ja TEXT,                   -- 実施対象（日本語）
    isSpecial INTEGER DEFAULT 0,      -- 特殊ミッションフラグ
    FOREIGN KEY(categoryId) REFERENCES mission_categories(id)
);
```

**isSpecial=1の特殊ミッション**:
- 出現確率10%
- 退職＆強制兼任の効果
- 1枚のみデータベースに存在

### 4.3 データベース初期化

**initdb.js実行**:
```bash
npm run initdb
```

**処理内容**:
1. 既存のgame.dbを削除
2. テーブル作成（5テーブル: mission_categories, category_cards, skill_types, skill_cards, missions）
3. サンプルデータ挿入

完了メッセージ例:
```
Database initialized successfully!
Tables: mission_categories(4), category_cards(6), skill_types(3), skill_cards(23), missions(40)
```

**重要**: 本番環境では初期化前にバックアップ必須

---

## 5. サーバーサイド実装

### 5.1 server.js構造

```javascript
// 依存関係
require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

// サーバー初期化
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// データベース接続
const db = new sqlite3.Database('./game.db');

// セッション管理
const gameSessions = new Map();  // Map<sessionId, session>
const clients = new Map();       // Map<sessionId, Map<playerId, WebSocket>>

// 認証
const adminTokens = new Map();   // Map<token, { username, expiry }>
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24時間
```

### 5.2 WebSocketハンドラ

```javascript
wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    
    let currentSessionId = null;
    let currentPlayerId = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received:', data.type);

            switch (data.type) {
                case 'createSession':    handleCreateSession(ws, data); break;
                case 'joinSession':      handleJoinSession(ws, data); break;
                case 'selectCategory':   handleSelectCategory(ws, data); break;  // v1.2: selectJob → selectCategory
                case 'startGame':        handleStartGame(ws, data); break;
                case 'rollDice':         handleRollDice(ws, data); break;
                case 'selectCard':       handleSelectCard(ws, data); break;
                case 'nextTurn':         handleNextTurn(ws, data); break;
                case 'resign':           handleResign(ws, data); break;
                case 'resetGame':        handleResetGame(ws, data); break;
            }
        } catch (error) {
            console.error('Error handling message:', error);
            ws.send(JSON.stringify({ 
                type: 'error', 
                error: { code: 'SERVER_ERROR', message: error.message }
            }));
        }
    });

    ws.on('close', () => {
        if (currentSessionId && currentPlayerId) {
            const sessionClients = clients.get(currentSessionId);
            if (sessionClients) sessionClients.delete(currentPlayerId);
        }
    });
});
```

### 5.3 セッション作成

```javascript
function handleCreateSession(ws, data) {
    const sessionId = generateSessionId();
    const playerId = uuidv4();
    
    const session = {
        id: sessionId,
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
    };

    gameSessions.set(sessionId, session);
    
    if (!clients.has(sessionId)) clients.set(sessionId, new Map());
    clients.get(sessionId).set(playerId, ws);
    
    currentSessionId = sessionId;
    currentPlayerId = playerId;

    ws.send(JSON.stringify({ type: 'sessionCreated', sessionId, playerId, session }));
}
```

### 5.4 ブロードキャスト関数

変更なし。

```javascript
function broadcast(sessionId, message, excludePlayerId = null) {
    const sessionClients = clients.get(sessionId);
    if (sessionClients) {
        sessionClients.forEach((ws, playerId) => {
            if (playerId !== excludePlayerId && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
            }
        });
    }
}

function sendToPlayer(sessionId, playerId, message) {
    const sessionClients = clients.get(sessionId);
    if (sessionClients) {
        const ws = sessionClients.get(playerId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
}
```

### 5.5 カテゴリ選択ハンドラ

> **v1.2変更**: `handleSelectJob` → `handleSelectCategory`、フィールド名 `jobs`/`jobSelected` → `categories`/`categorySelected`。

```javascript
function handleSelectCategory(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;

    // 重複チェック: 他プレイヤーが同じ categoryId を選択済みか
    const alreadyTaken = session.players.some(
        p => p.id !== data.playerId && p.categories.includes(data.categoryId)
    );
    if (alreadyTaken) {
        ws.send(JSON.stringify({ type: 'error', error: { code: 'CATEGORY_TAKEN' } }));
        return;
    }

    const player = session.players.find(p => p.id === data.playerId);
    if (!player) return;

    player.categories.push(data.categoryId);
    player.categorySelected = true;

    broadcast(data.sessionId, {
        type: 'categorySelected',   // v1.2: jobSelected → categorySelected
        playerId: data.playerId,
        categoryId: data.categoryId,
        session
    });
}
```

### 5.6 サイコロ処理（カード抽選）

> **v1.2変更**: DBクエリが `skill_cards` の `matchesCategories` を参照する。フィールド名を `matchesCategories` に統一。

```javascript
function handleRollDice(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;

    const diceValue = Math.floor(Math.random() * 6) + 1;
    session.diceValue = diceValue;

    db.all('SELECT * FROM skill_cards', (err1, skillCards) => {
        db.all('SELECT * FROM missions WHERE isSpecial = 0', (err2, regularMissions) => {
            db.all('SELECT * FROM missions WHERE isSpecial = 1', (err3, specialMissions) => {
                if (err1 || err2 || err3) {
                    console.error('Error fetching cards:', err1, err2, err3);
                    return;
                }

                const allCards = [
                    ...skillCards.map(c => ({ 
                        ...c, 
                        type: 'skill', 
                        // v1.2: matchesJobs → matchesCategories
                        matchesCategories: c.matchesCategories
                            ? c.matchesCategories.split(',').map(Number)
                            : []
                    })),
                    ...regularMissions.map(c => ({ ...c, type: 'mission' }))
                ];

                let availableCards = allCards.filter(card => 
                    !session.usedCardIds.includes(card.id)
                );

                if (availableCards.length <= 7) {
                    session.usedCardIds = [];
                    availableCards = [...allCards];
                }

                if (specialMissions.length > 0 && Math.random() < 0.1) {
                    const specialMission = specialMissions[0];
                    if (!session.usedCardIds.includes(specialMission.id)) {
                        availableCards.push({ ...specialMission, type: 'special' });
                    }
                }

                const drawnCards = [];
                const drawnCardIds = new Set();
                const cardCount = Math.min(diceValue, availableCards.length);
                
                while (drawnCards.length < cardCount) {
                    const randomIndex = Math.floor(Math.random() * availableCards.length);
                    const randomCard = availableCards[randomIndex];
                    if (!drawnCardIds.has(randomCard.id)) {
                        drawnCards.push(randomCard);
                        drawnCardIds.add(randomCard.id);
                    }
                }

                session.drawnCards = drawnCards;

                broadcast(data.sessionId, {
                    type: 'diceRolled',
                    diceValue,
                    drawnCards,
                    session
                });
            });
        });
    });
}
```

### 5.7 カード選択処理

> **v1.2変更**: `player.jobs` → `player.categories`、`matchesJobs` → `matchesCategories`、DBクエリ対象が `category_cards` に変更。

```javascript
function handleSelectCard(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;

    const card = session.drawnCards.find(c => c.id === data.cardId);
    if (!card) return;

    const currentPlayer = session.players[session.currentPlayerIndex];
    let result = { type: 'cardSelected', card };

    session.selectedCardsHistory.push({
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        card,
        turnNumber: session.selectedCardsHistory.length + 1
    });

    if (!session.usedCardIds.includes(card.id)) {
        session.usedCardIds.push(card.id);
    }

    if (card.type === 'skill') {
        let matched = false;
        let alreadySelected = false;
        const newPoints = { ...currentPlayer.points };

        if (currentPlayer.selectedSkillCardIds.includes(card.id)) {
            alreadySelected = true;
        } else {
            // v1.2: player.jobs → player.categories、matchesJobs → matchesCategories
            currentPlayer.categories.forEach(categoryId => {
                if (card.matchesCategories && card.matchesCategories.includes(categoryId)) {
                    matched = true;
                    newPoints[categoryId] = (newPoints[categoryId] || 0) + 1;
                }
            });
            currentPlayer.selectedSkillCardIds.push(card.id);
        }

        currentPlayer.points = newPoints;
        result.matched = matched;
        result.alreadySelected = alreadySelected;
        result.pointsUpdated = newPoints;

        // 勝利判定: category_cards テーブルを参照（v1.2変更）
        db.all('SELECT * FROM category_cards', (err, categoryCards) => {
            let hasWon = true;
            currentPlayer.categories.forEach(categoryId => {
                const cat = categoryCards.find(c => c.id === categoryId);
                if (cat && (currentPlayer.points[categoryId] || 0) < cat.targetPoints) {
                    hasWon = false;
                }
            });

            if (hasWon && currentPlayer.categories.length > 0 && !currentPlayer.finished) {
                currentPlayer.finished = true;
                const rank = session.finishedPlayers.length + 1;
                currentPlayer.finishRank = rank;
                session.finishedPlayers.push(currentPlayer.id);
                
                result.playerFinished = true;
                result.finishRank = rank;
                result.playerName = currentPlayer.name;
                
                const activePlayers = session.players.filter(p => !p.retired);
                const allFinished = activePlayers.every(p => p.finished);
                
                if (allFinished) {
                    session.allFinished = true;
                    result.allFinished = true;
                    result.finalRankings = session.players
                        .filter(p => !p.retired)
                        .sort((a, b) => a.finishRank - b.finishRank)
                        .map(p => ({ id: p.id, name: p.name, rank: p.finishRank }));
                }
            }

            ws.send(JSON.stringify({ ...result, session }));
            broadcast(data.sessionId, {
                type: 'cardSelectedByOther',
                playerId: currentPlayer.id,
                cardType: 'skill',
                session
            }, currentPlayer.id);
            
            if (result.allFinished) {
                broadcast(data.sessionId, {
                    type: 'gameCompleted',
                    finalRankings: result.finalRankings,
                    session
                });
            }
        });
    } else {
        broadcast(data.sessionId, { ...result, session });
    }
}
```

### 5.8 ターン管理・退職・リセット

> **v1.2変更**: `handleResign` 内で `player.jobs` → `player.categories`、`jobSelected` → `categorySelected`。

```javascript
function handleNextTurn(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;

    let nextIndex = (session.currentPlayerIndex + 1) % session.players.length;
    for (let i = 0; i < session.players.length; i++) {
        if (!session.players[nextIndex].retired) break;
        nextIndex = (nextIndex + 1) % session.players.length;
    }

    session.currentPlayerIndex = nextIndex;
    session.drawnCards = [];
    session.diceValue = null;

    broadcast(data.sessionId, { type: 'nextTurn', session });
}

function handleResign(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;

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

    broadcast(data.sessionId, {
        type: 'playerRetired',
        retiredPlayerId: data.playerId,
        targetPlayerId: data.targetPlayerId,
        session
    });
}

function handleResetGame(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;

    session.gameStarted = false;
    session.currentPlayerIndex = 0;
    session.drawnCards = [];
    session.selectedCardsHistory = [];
    session.usedCardIds = [];
    session.finishedPlayers = [];
    session.allFinished = false;
    session.diceValue = null;

    session.players.forEach(p => {
        p.categories = [];           // v1.2: jobs → categories
        p.points = {};
        p.retired = false;
        p.categorySelected = false;  // v1.2: jobSelected → categorySelected
        p.selectedSkillCardIds = [];
        p.finished = false;
        p.finishRank = null;
    });

    broadcast(data.sessionId, { type: 'gameReset', session });
}
```

### 5.9 Express REST API

> **v1.2変更点**:
> - `GET /api/cards/jobs` → `GET /api/cards/categories`（職種カード取得）
> - `GET /api/cards/categories` → `GET /api/cards/mission-categories`（ミッションカテゴリ取得）
> - `GET /api/cards/skill-types` 新規追加
> - 管理APIも同様にリネーム

```javascript
// 静的ファイル配信
app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 多言語API（変更なし）
app.get('/api/lang/:lang', (req, res) => { /* ... */ });

// 認証API（変更なし）
app.post('/api/auth/login', (req, res) => { /* ... */ });

// ============================================================
// カードAPI（認証不要 — 配列を直接返す）
// ============================================================
// v1.2: /api/cards/categories が職種カードを返す（旧: /api/cards/jobs）
app.get('/api/cards/categories', (req, res) => {
    db.all('SELECT * FROM category_cards', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/cards/skills', (req, res) => {
    db.all('SELECT * FROM skill_cards', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/cards/missions', (req, res) => {
    db.all('SELECT * FROM missions', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// v1.2: ミッションカテゴリは /api/cards/mission-categories に移動
app.get('/api/cards/mission-categories', (req, res) => {
    db.all('SELECT * FROM mission_categories', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// v1.2 新規: スキル区分API
app.get('/api/cards/skill-types', (req, res) => {
    db.all('SELECT * FROM skill_types ORDER BY sortOrder', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ============================================================
// 管理API（requireAdmin必須）— v1.2: /api/admin/jobs → /api/admin/categories
// ============================================================
app.post('/api/admin/categories', requireAdmin, (req, res) => {
    const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints } = req.body;
    db.run(
        'INSERT INTO category_cards (name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints) VALUES (?, ?, ?, ?, ?, ?)',
        [name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints],
        function(err) {
            if (err) return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message }});
            res.json({ ok: true, id: this.lastID });
        }
    );
});

app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
    const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints } = req.body;
    db.run(
        'UPDATE category_cards SET name_en=?, name_ja=?, imageUrl=?, descriptionHtml_en=?, descriptionHtml_ja=?, targetPoints=? WHERE id=?',
        [name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message }});
            res.json({ ok: true });
        }
    );
});

app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
    db.run('DELETE FROM category_cards WHERE id=?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message }});
        res.json({ ok: true });
    });
});

// スキル区分 CRUD（v1.2新規）
app.post('/api/admin/skill-types', requireAdmin, (req, res) => {
    const { name_en, name_ja, model_type, description_en, description_ja, sortOrder } = req.body;
    db.run(
        'INSERT INTO skill_types (name_en, name_ja, model_type, description_en, description_ja, sortOrder) VALUES (?, ?, ?, ?, ?, ?)',
        [name_en, name_ja, model_type || 'katz', description_en, description_ja, sortOrder || 0],
        function(err) {
            if (err) return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message }});
            res.json({ ok: true, id: this.lastID });
        }
    );
});

app.put('/api/admin/skill-types/:id', requireAdmin, (req, res) => { /* 同様に UPDATE */ });
app.delete('/api/admin/skill-types/:id', requireAdmin, (req, res) => { /* 同様に DELETE */ });

// スキル・ミッション CRUD（変更なし）
app.post('/api/admin/skills', requireAdmin, (req, res) => { /* ... */ });
app.put('/api/admin/skills/:id', requireAdmin, (req, res) => { /* ... */ });
app.delete('/api/admin/skills/:id', requireAdmin, (req, res) => { /* ... */ });

app.post('/api/admin/missions', requireAdmin, (req, res) => { /* ... */ });
app.put('/api/admin/missions/:id', requireAdmin, (req, res) => { /* ... */ });
app.delete('/api/admin/missions/:id', requireAdmin, (req, res) => { /* ... */ });

// CSV Import（v1.2: type に 'categories' と 'skill-types' を追加）
app.post('/api/admin/import/:type', requireAdmin, (req, res) => {
    // type: 'categories' | 'skills' | 'missions' | 'skill-types'
    // ...
});

// ヘルスチェック（変更なし）
app.get('/api/health', (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
});
```

---

## 6. クライアントサイド実装

### 6.1 game.js構造

I18nクラス・GameClientクラスの基本構造は変更なし。以下のプロパティ・メソッド名を更新。

**GameClient コンストラクタ プロパティ変更**:

| v1.1 | v1.2 |
|---|---|
| `jobCardsCache` | `categoryCardsCache` |
| `fetchJobCards()` | `fetchCategoryCards()` |

```javascript
class GameClient {
    constructor() {
        // ...（その他変更なし）
        this.categoryCardsCache = [];  // v1.2: jobCardsCache → categoryCardsCache
        this.skillCardsCache = [];
        this.flippedCards = new Set();
        this.flippedCategoryCards = new Set();  // v1.2: flippedJobCards → flippedCategoryCards
    }

    async init() {
        await i18n.init();
        this.language = i18n.currentLang;
        this.connect();
        this.fetchCategoryCards();  // v1.2
        this.fetchSkillCards();
        this.render();
    }

    async fetchCategoryCards() {
        // v1.2: GET /api/cards/categories（旧: /api/cards/jobs）
        const res = await fetch('/api/cards/categories');
        this.categoryCardsCache = await res.json();
    }
}
```

### 6.2 WebSocket受信ハンドラ 変更点

```javascript
handleServerMessage(data) {
    switch (data.type) {
        // v1.2: jobSelected → categorySelected
        case 'categorySelected':
            this.session = data.session;
            this.render();
            break;

        // その他のハンドラは変更なし
        case 'sessionCreated':
        case 'sessionJoined':
        case 'playerJoined':
        case 'gameStarted':
        case 'diceRolled':
        case 'cardSelected':
        case 'cardSelectedByOther':
        case 'gameCompleted':
        case 'playerRetired':
        case 'nextTurn':
        case 'gameReset':
        case 'error':
            // ...（v1.1と同一）
    }
}
```

### 6.3 ロビー画面 変更点

```javascript
renderLobby() {
    // 職種選択UIの参照先を categoryCardsCache に変更
    // 選択送信メッセージタイプを selectCategory に変更
    // ...
}

selectCategory(categoryId) {
    // v1.2: type を selectCategory に変更
    this.send({
        type: 'selectCategory',
        sessionId: this.sessionId,
        playerId: this.playerId,
        categoryId   // v1.2: jobId → categoryId
    });
}
```

### 6.4 ゲーム画面 変更点

```javascript
renderGame() {
    // サイドバーでの職種ポイント表示:
    // categoryCardsCache から categoryId で名前を引く（旧: jobCardsCache）
    // player.categories を参照（旧: player.jobs）
    // player.categorySelected を参照（旧: player.jobSelected）
}
```

### 6.5 カード表示UI

変更なし。カードタイプ別グラデーションはそのまま適用される。

---

## 7. 多言語対応システム

### 7.1 翻訳ファイル構造

**lang/ja.json（v1.2 変更点）**:

```json
{
  "common": { "...": "変更なし" },
  "game": {
    "title": "職種 × スキル カードゲーム",
    "selectCategory": "職種を選択してください",   // v1.2: selectJob → selectCategory
    "categorySelected": "選択済み",               // v1.2: jobSelected → categorySelected
    "...": "その他変更なし"
  },
  "admin": {
    "categoryCards": "職種カード",                // v1.2: jobCards → categoryCards
    "skillTypes": "スキル区分",                   // v1.2 新規
    "modelType": "モデル種別",                    // v1.2 新規
    "modelTypeKatz": "Katzモデル",                // v1.2 新規
    "modelTypeDrucker": "Druckerモデル",          // v1.2 新規
    "...": "その他変更なし"
  },
  "errors": {
    "CATEGORY_TAKEN": "その職種はすでに選択されています",  // v1.2: JOB_TAKEN → CATEGORY_TAKEN
    "...": "その他変更なし"
  }
}
```

**lang/en.json（v1.2 変更点）**:

```json
{
  "game": {
    "selectCategory": "Select a Job Role",
    "categorySelected": "Selected"
  },
  "admin": {
    "categoryCards": "Job Role Cards",
    "skillTypes": "Skill Types",
    "modelType": "Model Type",
    "modelTypeKatz": "Katz Model",
    "modelTypeDrucker": "Drucker Model"
  },
  "errors": {
    "CATEGORY_TAKEN": "That job role is already taken"
  }
}
```

### 7.2 使用方法・言語切り替えUI

変更なし。

---

## 8. 管理画面実装

### 8.1 タブ構成 変更点

> **v1.2変更**: タブ `jobs` → `categories`、新規タブ `skill-types` を追加。

```html
<!-- v1.2 タブナビゲーション -->
<button data-tab="categories">職種カード</button>   <!-- 旧: jobs -->
<button data-tab="skill-types">スキル区分</button>  <!-- v1.2 新規 -->
<button data-tab="skills">スキルカード</button>
<button data-tab="missions">ミッション</button>
<button data-tab="mission-categories">カテゴリ</button>
```

### 8.2 スキル区分フォーム（v1.2 新規）

```html
<!-- skill-types 追加・編集フォーム -->
<label>英語名 <input type="text" id="st-name-en"></label>
<label>日本語名 <input type="text" id="st-name-ja"></label>
<label>モデル種別
    <select id="st-model-type">
        <option value="katz">Katzモデル</option>
        <option value="drucker">Druckerモデル</option>
    </select>
</label>
<label>説明（英語）<textarea id="st-desc-en"></textarea></label>
<label>説明（日本語）<textarea id="st-desc-ja"></textarea></label>
<label>表示順 <input type="number" id="st-sort-order"></label>
```

### 8.3 管理JavaScript 変更点

```javascript
// v1.2: allData に categories・skillTypes を追加（旧: jobs）
let allData = {
    categories: [],      // 旧: jobs
    skillTypes: [],      // v1.2 新規
    skills: [],
    missions: [],
    missionCategories: []  // 旧: categories
};

async function loadData() {
    const [categories, skillTypes, skills, missions, missionCategories] = await Promise.all([
        fetch('/api/cards/categories').then(r => r.json()),       // v1.2
        fetch('/api/cards/skill-types').then(r => r.json()),      // v1.2 新規
        fetch('/api/cards/skills').then(r => r.json()),
        fetch('/api/cards/missions').then(r => r.json()),
        fetch('/api/cards/mission-categories').then(r => r.json()) // v1.2
    ]);
    allData = { categories, skillTypes, skills, missions, missionCategories };
    renderTable(currentTab);
}
```

### 8.4 スキルカードの matchesCategories チェックボックス

```javascript
// v1.2: matchesJobs → matchesCategories、allData.jobs → allData.categories
function renderMatchesCategoriesCheckboxes(selectedIds = []) {
    return allData.categories.map(cat => `
        <label>
            <input type="checkbox" name="matchesCategories" value="${cat.id}"
                   ${selectedIds.includes(cat.id) ? 'checked' : ''}>
            ${cat.name_ja}（${cat.name_en}）
        </label>
    `).join('');
}

// 保存時
function getMatchesCategoriesValue() {
    return [...document.querySelectorAll('input[name="matchesCategories"]:checked')]
        .map(el => el.value)
        .join(',');
}
```

### 8.5 ログイン処理・画像アップロード・CSV Export/Import

変更なし（ただし CSV Export で `type='categories'` と `type='skill-types'` を追加）。

---

## 9. ゲームロジック詳細

### 9.1 ゲームフロー

```
1. セッション作成
   ↓
2. プレイヤー参加（2〜4人）
   ↓
3. 職種（カテゴリ）カード選択（全員必須）
   ↓
4. ゲーム開始
   ↓
5. ターン開始
   ├─ サイコロを振る（1〜6）
   ├─ カード抽選（重複なし）
   ├─ カードを1枚選択
   │  ├─ スキルカード → ポイント加算
   │  ├─ ミッションカード → チーム議論
   │  └─ 特殊ミッション → 退職処理
   ├─ 勝利判定
   └─ 次のターンへ
   ↓
6. 全員ゴールまたはリセット
```

### 9.2 勝利条件

```javascript
// 単一職種の場合
player.points[categoryId] >= category.targetPoints

// 兼任（複数職種）の場合
player.categories.every(categoryId => {
    const cat = categoryCards.find(c => c.id === categoryId);
    return player.points[categoryId] >= cat.targetPoints;
})
```

### 9.3 スキルカード重複防止・カード在庫管理・特殊ミッション処理

変更なし（フィールド名のみ `categories`/`matchesCategories` に読み替え）。

---

## 10. セキュリティ実装

変更なし（Section 10.1〜10.3）。

---

## 11. デプロイメント手順

変更なし（Section 11.1〜11.3）。

---

## 12. トラブルシューティング

### 12.1〜12.4

変更なし。

### 12.5 v1.1 → v1.2 マイグレーション

既存の本番DBをゼロリセットせずに v1.2 へ移行する場合:

```sql
-- 1. job_cards テーブルを category_cards にリネーム
ALTER TABLE job_cards RENAME TO category_cards;

-- 2. skill_cards の matchesJobs カラムを matchesCategories にリネーム
--    （SQLite は ALTER COLUMN RENAME 非対応のため再作成が必要）
CREATE TABLE skill_cards_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL,
    name_ja TEXT NOT NULL,
    imageUrl TEXT,
    descriptionHtml_en TEXT,
    descriptionHtml_ja TEXT,
    matchesCategories TEXT
);
INSERT INTO skill_cards_new SELECT id, name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesJobs FROM skill_cards;
DROP TABLE skill_cards;
ALTER TABLE skill_cards_new RENAME TO skill_cards;

-- 3. skill_types テーブルを新規作成
CREATE TABLE skill_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL,
    name_ja TEXT NOT NULL,
    model_type TEXT NOT NULL DEFAULT 'katz',
    description_en TEXT,
    description_ja TEXT,
    sortOrder INTEGER DEFAULT 0
);
-- Katz 3区分の初期データを挿入
INSERT INTO skill_types (name_en, name_ja, model_type, description_en, description_ja, sortOrder) VALUES
    ('Technical Skill',    'テクニカルスキル',     'katz', 'Operational and technical expertise',   '業務・技術的専門知識',  1),
    ('Human Skill',        'ヒューマンスキル',     'katz', 'Interpersonal and communication skills','対人・コミュニケーション能力', 2),
    ('Conceptual Skill',   'コンセプチュアルスキル','katz', 'Strategic and abstract thinking',       '概念的・戦略的思考力',  3);
```

> **注意**: `npm run initdb` は全データを削除して再作成します。既存データを保持したい場合は上記SQLを直接実行してください。

---

## 13. 実装チェックリスト

### 13.1 サーバーサイド

- [ ] `server.js`作成
- [ ] WebSocketサーバー実装
- [ ] セッション管理（Map構造）
- [ ] データベース初期化（initdb.js）
- [ ] 認証システム（トークンベース）
- [ ] API実装（配列を直接返す）
- [ ] 多言語API（/api/lang/:lang）
- [ ] 環境変数設定（.env）
- [ ] **[v1.2]** `selectCategory` ハンドラ（旧 `selectJob`）
- [ ] **[v1.2]** `category_cards` テーブルへの参照（旧 `job_cards`）
- [ ] **[v1.2]** `matchesCategories` フィールドの処理（旧 `matchesJobs`）
- [ ] **[v1.2]** `GET /api/cards/categories` エンドポイント
- [ ] **[v1.2]** `GET /api/cards/skill-types` エンドポイント
- [ ] **[v1.2]** `GET /api/cards/mission-categories` エンドポイント
- [ ] **[v1.2]** `/api/admin/categories` CRUD
- [ ] **[v1.2]** `/api/admin/skill-types` CRUD

### 13.2 クライアントサイド

- [ ] `index.html`作成
- [ ] `game.js`作成（GameClientクラス）
- [ ] WebSocket接続実装
- [ ] 自動再接続機能
- [ ] I18nクラス実装
- [ ] カード表示UI（2エリア構造）
- [ ] モーダル表示機能
- [ ] レスポンシブデザイン
- [ ] **[v1.2]** `categoryCardsCache` / `fetchCategoryCards()`（旧 `jobCardsCache`）
- [ ] **[v1.2]** `categorySelected` メッセージ受信処理
- [ ] **[v1.2]** `selectCategory()` 送信処理
- [ ] **[v1.2]** `player.categories` / `player.categorySelected` 参照

### 13.3 管理画面

- [ ] `admin.html`作成
- [ ] ログイン画面実装
- [ ] カード一覧表示
- [ ] カード追加・編集・削除
- [ ] 画像アップロード（Base64）
- [ ] CSV Export/Import
- [ ] 多言語UI切り替え
- [ ] **[v1.2]** `categories` タブ（旧 `jobs`）
- [ ] **[v1.2]** `skill-types` タブ（新規）
- [ ] **[v1.2]** `mission-categories` タブ（旧 `categories`）
- [ ] **[v1.2]** matchesCategories チェックボックス（旧 matchesJobs）
- [ ] **[v1.2]** skill_types `model_type` セレクト（katz / drucker）

### 13.4 データベース

- [ ] mission_categoriesテーブル
- [ ] **[v1.2]** `category_cards` テーブル（旧 `job_cards`）
- [ ] **[v1.2]** `skill_types` テーブル（新規）
- [ ] `skill_cards` テーブル（`matchesCategories` カラム）
- [ ] missionsテーブル
- [ ] サンプルデータ挿入

### 13.5 多言語対応

- [ ] lang/en.json作成
- [ ] lang/ja.json作成
- [ ] I18nクラス実装
- [ ] APIエンドポイント実装
- [ ] UI言語切り替えボタン
- [ ] **[v1.2]** `game.selectCategory` / `game.categorySelected` キー
- [ ] **[v1.2]** `admin.categoryCards` / `admin.skillTypes` キー
- [ ] **[v1.2]** `admin.modelType` / `admin.modelTypeKatz` / `admin.modelTypeDrucker` キー
- [ ] **[v1.2]** `errors.CATEGORY_TAKEN` キー（旧 `errors.JOB_TAKEN`）

### 13.6 ゲームロジック

- [ ] 職種（カテゴリ）選択（重複防止）
- [ ] サイコロ実装
- [ ] カード抽選（重複防止）
- [ ] スキルカード再選択防止
- [ ] カード在庫再利用
- [ ] 勝利判定（全員ゴール対応）
- [ ] 特殊ミッション処理

### 13.7 デプロイメント

- [ ] systemdサービス設定
- [ ] Nginxリバースプロキシ設定
- [ ] Let's Encrypt証明書取得
- [ ] ファイアウォール設定
- [ ] ログローテーション設定

---

## 14. 本番運用チェックリスト

### 14.1 セキュリティ

- [ ] .envファイルで強力なパスワード設定
- [ ] .envファイルを.gitignoreに追加
- [ ] HTTPS/WSS使用
- [ ] 定期的なパスワード変更
- [ ] サーバーアクセスログ監視

### 14.2 パフォーマンス

- [ ] データベースバックアップ設定
- [ ] ログファイルのローテーション
- [ ] メモリ使用量監視
- [ ] 同時接続数の制限設定

### 14.3 監視

- [ ] systemdサービス自動起動設定
- [ ] エラーログ監視
- [ ] アクセスログ分析
- [ ] 定期的な動作確認

---

## 15. 参考資料

### 15.1 公式ドキュメント

- Node.js: https://nodejs.org/
- Express.js: https://expressjs.com/
- WebSocket (ws): https://github.com/websockets/ws
- SQLite3: https://www.sqlite.org/

### 15.2 理論的フレームワーク

- Katz, R.L. (1955). Skills of an Effective Administrator. *Harvard Business Review*.
- Drucker, P.F. (1954). *The Practice of Management*.

### 15.3 プロジェクト固有ドキュメント

- README.md: プロジェクト概要
- TROUBLESHOOTING.md: トラブルシューティング
- NGINX-REVERSE-PROXY.md: Nginx設定手順
- Reflection-sheet-sample.docx: 振り返りワークシート

---

**仕様書バージョン**: 1.2  
**最終更新日**: 2026-06-13  
**実装状況**: ✅ 本番運用可能  
**Claude再現性**: ✅ この仕様書で完全に再現可能

---

この仕様書に従えば、ゼロから同等のシステムを構築できます。各セクションの実装例をそのまま使用するか、必要に応じてカスタマイズしてください。
