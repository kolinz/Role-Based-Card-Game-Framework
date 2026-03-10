# 職種×スキル カードゲーム - 完全実装仕様書 v4.0

**プロジェクト名**: Role Based Card Game Framework  
**バージョン**: 4.0  
**最終更新**: 2026-02-05  
**実装状況**: ✅ 本番運用可能

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

### 1.2 対象ユーザー

**プレイヤー**: 
- 中学生〜大学生（キャリア教育）
- 企業研修参加者（職種理解）
- 2〜4人のグループ

**運営者**:
- 教育機関の教員
- 企業の人事・研修担当者
- ゲーム管理者

### 1.3 システム要件

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
  "version": "1.0.0",
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

### 4.1 テーブル構造

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

#### job_cards（職種カード）

```sql
CREATE TABLE job_cards (
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

#### skill_cards（スキルカード）

```sql
CREATE TABLE skill_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL,
    name_ja TEXT NOT NULL,
    imageUrl TEXT,
    descriptionHtml_en TEXT,
    descriptionHtml_ja TEXT,
    matchesJobs TEXT                  -- カンマ区切りの職種ID "1,3,5"
);
```

**matchesJobsの処理**:
```javascript
// サーバー側
const matchesJobs = skill.matchesJobs ? skill.matchesJobs.split(',').map(Number) : [];

// マッチング判定
if (matchesJobs.includes(playerJobId)) {
    matched = true;
    points += 1;
}
```

#### missions（ミッションカード）

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

### 4.2 データベース初期化

**initdb.js実行**:
```bash
npm run initdb
```

**処理内容**:
1. 既存のgame.dbを削除
2. テーブル作成
3. サンプルデータ挿入（職種6件、スキル23件、ミッション40件、カテゴリ4件）

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
                case 'createSession':
                    handleCreateSession(ws, data);
                    break;
                case 'joinSession':
                    handleJoinSession(ws, data);
                    break;
                case 'selectJob':
                    handleSelectJob(ws, data);
                    break;
                case 'startGame':
                    handleStartGame(ws, data);
                    break;
                case 'rollDice':
                    handleRollDice(ws, data);
                    break;
                case 'selectCard':
                    handleSelectCard(ws, data);
                    break;
                case 'nextTurn':
                    handleNextTurn(ws, data);
                    break;
                case 'resign':
                    handleResign(ws, data);
                    break;
                case 'resetGame':
                    handleResetGame(ws, data);
                    break;
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
        console.log('Client disconnected');
        if (currentSessionId && currentPlayerId) {
            const sessionClients = clients.get(currentSessionId);
            if (sessionClients) {
                sessionClients.delete(currentPlayerId);
            }
        }
    });
});
```

### 5.3 セッション作成

```javascript
function handleCreateSession(ws, data) {
    const sessionId = generateSessionId();  // 8文字のUUID
    const playerId = uuidv4();
    
    const session = {
        id: sessionId,
        hostPlayerId: playerId,
        players: [{
            id: playerId,
            name: data.playerName || 'Player 1',
            jobs: [],
            points: {},
            retired: false,
            jobSelected: false,
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
    
    if (!clients.has(sessionId)) {
        clients.set(sessionId, new Map());
    }
    clients.get(sessionId).set(playerId, ws);
    
    currentSessionId = sessionId;
    currentPlayerId = playerId;

    ws.send(JSON.stringify({
        type: 'sessionCreated',
        sessionId,
        playerId,
        session
    }));
}
```

### 5.4 ブロードキャスト関数

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

### 5.5 サイコロ処理（カード抽選）

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
                        matchesJobs: c.matchesJobs ? c.matchesJobs.split(',').map(Number) : [] 
                    })),
                    ...regularMissions.map(c => ({ ...c, type: 'mission' }))
                ];

                // 使用済みカードを除外
                let availableCards = allCards.filter(card => 
                    !session.usedCardIds.includes(card.id)
                );

                // カード在庫が7枚以下なら再利用
                if (availableCards.length <= 7) {
                    console.log(`Low cards in session ${data.sessionId}, resetting usedCardIds`);
                    session.usedCardIds = [];
                    availableCards = [...allCards];
                }

                // 10%の確率で特殊ミッション追加
                if (specialMissions.length > 0 && Math.random() < 0.1) {
                    const specialMission = specialMissions[0];
                    if (!session.usedCardIds.includes(specialMission.id)) {
                        availableCards.push({ ...specialMission, type: 'special' });
                    }
                }

                // ランダム抽選（重複なし）
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

### 5.6 カード選択処理

```javascript
function handleSelectCard(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;

    const card = session.drawnCards.find(c => c.id === data.cardId);
    if (!card) return;

    const currentPlayer = session.players[session.currentPlayerIndex];
    let result = { type: 'cardSelected', card };

    // 履歴に追加
    session.selectedCardsHistory.push({
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        card: card,
        turnNumber: session.selectedCardsHistory.length + 1
    });

    // 使用済みカードに追加
    if (!session.usedCardIds.includes(card.id)) {
        session.usedCardIds.push(card.id);
    }

    if (card.type === 'skill') {
        let matched = false;
        let alreadySelected = false;
        const newPoints = { ...currentPlayer.points };

        // 再選択チェック
        if (currentPlayer.selectedSkillCardIds.includes(card.id)) {
            alreadySelected = true;
        } else {
            // マッチング判定
            currentPlayer.jobs.forEach(jobId => {
                if (card.matchesJobs && card.matchesJobs.includes(jobId)) {
                    matched = true;
                    newPoints[jobId] = (newPoints[jobId] || 0) + 1;
                }
            });

            currentPlayer.selectedSkillCardIds.push(card.id);
        }

        currentPlayer.points = newPoints;
        result.matched = matched;
        result.alreadySelected = alreadySelected;
        result.pointsUpdated = newPoints;

        // 勝利判定
        db.all('SELECT * FROM job_cards', (err, jobCards) => {
            let hasWon = true;
            currentPlayer.jobs.forEach(jobId => {
                const job = jobCards.find(j => j.id === jobId);
                if (job && (currentPlayer.points[jobId] || 0) < job.targetPoints) {
                    hasWon = false;
                }
            });

            if (hasWon && currentPlayer.jobs.length > 0 && !currentPlayer.finished) {
                currentPlayer.finished = true;
                const rank = session.finishedPlayers.length + 1;
                currentPlayer.finishRank = rank;
                session.finishedPlayers.push(currentPlayer.id);
                
                result.playerFinished = true;
                result.finishRank = rank;
                result.playerName = currentPlayer.name;
                
                // 全員ゴールチェック
                const activePlayers = session.players.filter(p => !p.retired);
                const allFinished = activePlayers.every(p => p.finished);
                
                if (allFinished) {
                    session.allFinished = true;
                    result.allFinished = true;
                    result.finalRankings = session.players
                        .filter(p => !p.retired)
                        .sort((a, b) => a.finishRank - b.finishRank)
                        .map(p => ({
                            id: p.id,
                            name: p.name,
                            rank: p.finishRank
                        }));
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
        // ミッションカード
        broadcast(data.sessionId, { ...result, session });
    }
}
```

### 5.7 Express APIルート

```javascript
// 静的ファイル配信
app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 多言語API
app.get('/api/lang/:lang', (req, res) => {
    const lang = req.params.lang;
    const langFile = path.join(__dirname, 'lang', `${lang}.json`);
    
    if (!fs.existsSync(langFile)) {
        return res.status(404).json({ 
            ok: false, 
            error: { code: 'NOT_FOUND', message: 'Language file not found' }
        });
    }
    
    try {
        const translations = JSON.parse(fs.readFileSync(langFile, 'utf8'));
        res.json({ ok: true, translations });
    } catch (error) {
        res.status(500).json({ 
            ok: false, 
            error: { code: 'SERVER_ERROR', message: 'Failed to load translations' }
        });
    }
});

// 認証API
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    console.log('=== LOGIN ATTEMPT ===');
    console.log('Received username:', username);
    console.log('Expected username:', ADMIN_USERNAME);
    console.log('====================');
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = uuidv4();
        const expiry = Date.now() + TOKEN_EXPIRY;
        adminTokens.set(token, { username, expiry });
        res.json({ ok: true, token, expiresIn: TOKEN_EXPIRY });
    } else {
        res.status(401).json({ 
            ok: false, 
            error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' }
        });
    }
});

// カードAPI（認証不要）
app.get('/api/cards/jobs', (req, res) => {
    db.all('SELECT * FROM job_cards', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);  // 配列を直接返す（重要）
    });
});

// 管理API（認証必須）
app.post('/api/admin/jobs', requireAdmin, (req, res) => {
    const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints } = req.body;
    
    db.run(
        'INSERT INTO job_cards (name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints) VALUES (?, ?, ?, ?, ?, ?)',
        [name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints],
        function(err) {
            if (err) {
                res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message }});
                return;
            }
            res.json({ ok: true, id: this.lastID });
        }
    );
});
```

---

## 6. クライアントサイド実装

### 6.1 game.js構造

```javascript
// I18nシステム
class I18n {
    constructor() {
        this.translations = {};
        this.currentLang = localStorage.getItem('language') || 
                          (navigator.language.startsWith('ja') ? 'ja' : 'en');
    }

    async init() {
        await this.loadTranslations(this.currentLang);
        this.watchLanguageChange();
    }

    async loadTranslations(lang) {
        try {
            const response = await fetch(`/api/lang/${lang}`);
            const data = await response.json();
            if (data.ok) {
                this.translations = data.translations;
                this.currentLang = lang;
                localStorage.setItem('language', lang);
                return true;
            }
        } catch (error) {
            console.error('Failed to load translations:', error);
        }
        return false;
    }

    t(key) {
        const keys = key.split('.');
        let value = this.translations;
        for (const k of keys) {
            value = value?.[k];
        }
        return value || key;
    }
}

const i18n = new I18n();

// GameClientクラス
class GameClient {
    constructor() {
        this.ws = null;
        this.language = i18n.currentLang;
        this.sessionId = null;
        this.playerId = null;
        this.session = null;
        this.connected = false;
        this.mode = 'menu';  // menu, lobby, game
        this.selectedCard = null;
        this.rolling = false;
        this.modal = null;
        this.jobCardsCache = [];
        this.skillCardsCache = [];
        this.flippedCards = new Set();
        this.flippedJobCards = new Set();
    }

    async init() {
        await i18n.init();
        this.connect();
        this.fetchJobCards();
        this.fetchSkillCards();
        this.render();
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('Connected to server');
            this.connected = true;
            this.render();
        };

        this.ws.onclose = () => {
            console.log('Disconnected from server');
            this.connected = false;
            this.render();
            setTimeout(() => this.connect(), 3000);  // 自動再接続
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleServerMessage(data);
        };
    }

    handleServerMessage(data) {
        console.log('Received:', data.type);

        switch (data.type) {
            case 'sessionCreated':
                this.sessionId = data.sessionId;
                this.playerId = data.playerId;
                this.session = data.session;
                this.mode = 'lobby';
                this.render();
                break;

            case 'diceRolled':
                this.session = data.session;
                this.rolling = false;
                this.selectedCard = null;
                this.flippedCards.clear();
                this.render();
                break;

            case 'cardSelected':
                this.session = data.session;
                
                if (data.playerFinished) {
                    const rankEmoji = this.getRankEmoji(data.finishRank);
                    const message = `${rankEmoji} ${data.playerName} ${this.t('game.finishedRank')} ${data.finishRank}${this.t('game.rankSuffix')}!`;
                    
                    this.showModal({
                        title: this.t('game.playerFinished'),
                        content: `<div style="text-align: center; font-size: 1.5rem; font-weight: 700;">${message}</div>`
                    });
                }
                
                this.render();
                break;

            case 'gameCompleted':
                this.session = data.session;
                setTimeout(() => {
                    this.showFinalRankingsModal(data.finalRankings);
                }, 1500);
                this.render();
                break;
        }
    }

    render() {
        const app = document.getElementById('app');
        if (!app) return;

        let html = '';

        if (this.mode === 'menu') {
            html += this.renderMenu();
        } else if (this.mode === 'lobby') {
            html += this.renderLobby();
        } else if (this.mode === 'game') {
            html += this.renderGame();
        }

        if (this.modal) {
            html += this.renderModal();
        }

        app.innerHTML = html;
        this.attachEventListeners();
    }
}

// 初期化
const game = new GameClient();
window.game = game;
game.init();
```

### 6.2 カード表示UI

```javascript
renderGame() {
    const currentPlayer = this.session.players[this.session.currentPlayerIndex];
    const isMyTurn = currentPlayer.id === this.playerId;
    const myPlayer = this.session.players.find(p => p.id === this.playerId);

    return `
        <div class="cards-area">
            <h3 class="cards-title">${this.t('game.selectCard')}</h3>
            <p style="text-align: center; color: var(--text-secondary); margin-bottom: 15px;">
                ${this.t('game.cardSelectHint')}
            </p>
            <div class="cards-grid">
                ${this.session.drawnCards.map((card, index) => {
                    const isFlipped = this.flippedCards.has(card.id);
                    const isDisabled = this.selectedCard && this.selectedCard.id !== card.id;
                    
                    let bgStyle = '';
                    if (card.type === 'skill') {
                        bgStyle = 'background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);';
                    } else if (card.type === 'mission') {
                        bgStyle = 'background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);';
                    } else if (card.type === 'special') {
                        bgStyle = 'background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);';
                    }
                    
                    return `
                    <div class="simple-card ${isDisabled ? 'disabled' : ''}" style="${bgStyle}">
                        <div class="simple-card-main" onclick="game.selectCard(${JSON.stringify(card).replace(/"/g, '&quot;')})">
                            ${isFlipped ? `
                                <div class="simple-card-content">
                                    ${card.imageUrl ? `<img src="${card.imageUrl}" style="max-width: 100%; border-radius: 8px; margin-bottom: 10px;">` : ''}
                                    <div>${card[\`descriptionHtml_\${this.language}\`] || ''}</div>
                                </div>
                            ` : `
                                ${card[\`name_\${this.language}\`] || 'Card ' + (index + 1)}
                            `}
                        </div>
                        <div class="simple-card-footer" onclick="event.stopPropagation(); game.flipCard(${card.id})">
                            ${isFlipped ? '← ' + this.t('game.backToFront') : this.t('game.viewDetails') + ' →'}
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}
```

---

## 7. 多言語対応システム

### 7.1 翻訳ファイル構造

**lang/ja.json**:
```json
{
  "common": {
    "language": "言語",
    "save": "保存",
    "cancel": "キャンセル"
  },
  "game": {
    "title": "職種 × スキル カードゲーム",
    "createGame": "新しいゲームを作成",
    "rollDice": "サイコロを振る"
  },
  "admin": {
    "loginTitle": "管理者ログイン",
    "username": "ユーザー名"
  },
  "errors": {
    "UNAUTHORIZED": "認証が必要です",
    "SERVER_ERROR": "サーバーエラーが発生しました"
  }
}
```

### 7.2 使用方法

```javascript
// 翻訳取得
i18n.t('game.title')  // "職種 × スキル カードゲーム"
i18n.t('errors.UNAUTHORIZED')  // "認証が必要です"

// 言語切り替え
await i18n.setLanguage('en');
i18n.t('game.title')  // "Career × Skills Card Game"
```

### 7.3 言語切り替えUI

```html
<div class="lang-toggle">
    <button class="${this.language === 'en' ? 'active' : ''}" data-lang="en">EN</button>
    <button class="${this.language === 'ja' ? 'active' : ''}" data-lang="ja">日本語</button>
</div>
```

```javascript
document.querySelectorAll('[data-lang]').forEach(btn => {
    btn.addEventListener('click', () => {
        i18n.setLanguage(btn.dataset.lang);
    });
});
```

---

## 8. 管理画面実装

### 8.1 ログイン処理

```javascript
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        
        if (data.ok && data.token) {
            localStorage.setItem('admin_token', data.token);
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('adminScreen').style.display = 'block';
            loadData();
        } else {
            alert(data.error?.message || 'ログインに失敗しました');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('ログインエラーが発生しました');
    }
});
```

### 8.2 画像アップロード

```javascript
function handleImageUpload(event, targetInputId) {
    const file = event.target.files[0];
    if (!file) return;
    
    // サイズチェック（20MB以下）
    if (file.size > 20 * 1024 * 1024) {
        alert('画像サイズは20MB以下にしてください');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // リサイズ処理（最大800x800px）
            const maxSize = 800;
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > maxSize) {
                    height = height * (maxSize / width);
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width = width * (maxSize / height);
                    height = maxSize;
                }
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // JPEG品質75%でBase64エンコード
            const resizedBase64 = canvas.toDataURL('image/jpeg', 0.75);
            
            // 最終サイズチェック（2MB以下に調整）
            if (resizedBase64.length > 2 * 1024 * 1024 * 1.37) {
                const finalBase64 = canvas.toDataURL('image/jpeg', 0.5);
                document.getElementById(targetInputId).value = finalBase64;
            } else {
                document.getElementById(targetInputId).value = resizedBase64;
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}
```

### 8.3 CSV Export/Import

**CSV Export**:
```javascript
async function exportCSV(type) {
    try {
        let endpoint = '';
        let headers = [];
        let filename = '';

        if (type === 'jobs') {
            endpoint = '/api/cards/jobs';
            headers = ['id', 'name_en', 'name_ja', 'descriptionHtml_en', 'descriptionHtml_ja', 'targetPoints'];
            filename = 'job_cards.csv';
        }

        const response = await fetch(endpoint);
        const data = await response.json();

        const csv = convertToCSV(data, headers);
        const bom = '\uFEFF'; // UTF-8 BOM for Excel
        const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    } catch (error) {
        console.error('Export error:', error);
        alert('エクスポートエラーが発生しました');
    }
}

function convertToCSV(data, headers) {
    const escapeCSV = (value) => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    };

    const rows = [headers.join(',')];
    data.forEach(item => {
        const row = headers.map(header => escapeCSV(item[header]));
        rows.push(row.join(','));
    });

    return rows.join('\n');
}
```

**CSV Import**:
```javascript
async function executeCsvImport() {
    if (!currentCsvData || !currentCsvType) return;

    try {
        const token = localStorage.getItem('admin_token');
        const endpoint = `/api/admin/import/${currentCsvType}`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                csvData: currentCsvData,
                preview: false
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Import failed');
        }

        // 結果表示
        const resultsHtml = `
            <div class="csv-success-box">
                <h3>取り込み完了！</h3>
                <p>追加: ${result.inserted || 0} 件</p>
                <p>更新: ${result.updated || 0} 件</p>
                <p>合計: ${result.total || 0}</p>
            </div>
        `;

        document.getElementById('csvResultsContainer').innerHTML = resultsHtml;
        await loadData();
    } catch (error) {
        console.error('Import error:', error);
        alert('取り込みエラー: ' + error.message);
    }
}
```

---

## 9. ゲームロジック詳細

### 9.1 ゲームフロー

```
1. セッション作成
   ↓
2. プレイヤー参加（2〜4人）
   ↓
3. 職種カード選択（全員必須）
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
player.points[jobId] >= job.targetPoints

// 兼任（複数職種）の場合
player.jobs.every(jobId => {
    const job = jobCards.find(j => j.id === jobId);
    return player.points[jobId] >= job.targetPoints;
})
```

### 9.3 スキルカード重複防止

```javascript
// プレイヤーごとに選択済みカードを記録
player.selectedSkillCardIds = [1, 3, 5, 7];

// 選択時にチェック
if (player.selectedSkillCardIds.includes(card.id)) {
    alreadySelected = true;  // ポイント加算なし
} else {
    player.selectedSkillCardIds.push(card.id);
    // ポイント加算処理
}
```

### 9.4 カード在庫管理

```javascript
// 全体の使用済みカード記録
session.usedCardIds = [1, 3, 5, 7, 9, ...];

// 抽選時にフィルタリング
let availableCards = allCards.filter(card => 
    !session.usedCardIds.includes(card.id)
);

// 在庫が7枚以下なら再利用
if (availableCards.length <= 7) {
    console.log('Low cards, resetting usedCardIds');
    session.usedCardIds = [];
    availableCards = [...allCards];
}
```

### 9.5 特殊ミッション処理

```javascript
// 10%の確率で出現
if (Math.random() < 0.1) {
    availableCards.push({ ...specialMission, type: 'special' });
}

// 選択時の処理
if (card.type === 'special') {
    // プレイヤー選択モーダル表示
    this.showPlayerSelectionModal(card);
}

// 退職処理
function handleResign(ws, data) {
    const retiringPlayer = session.players.find(p => p.id === data.playerId);
    const targetPlayer = session.players.find(p => p.id === data.targetPlayerId);

    // 職種を移譲
    targetPlayer.jobs = [...targetPlayer.jobs, ...retiringPlayer.jobs];
    retiringPlayer.jobs.forEach(jobId => {
        targetPlayer.points[jobId] = 0;
    });

    // 退職フラグ
    retiringPlayer.retired = true;
    retiringPlayer.jobs = [];
    retiringPlayer.points = {};

    broadcast(data.sessionId, {
        type: 'playerRetired',
        retiredPlayerId: data.playerId,
        targetPlayerId: data.targetPlayerId,
        session
    });
}
```

---

## 10. セキュリティ実装

### 10.1 環境変数管理

**.env**:
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here
PORT=3000
```

**.env.example**（Gitにコミット可）:
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
PORT=3000
```

### 10.2 認証ミドルウェア

```javascript
function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            ok: false, 
            error: { code: 'UNAUTHORIZED', message: 'Token required' }
        });
    }
    
    const token = authHeader.substring(7);
    const tokenData = adminTokens.get(token);
    
    if (!tokenData) {
        return res.status(401).json({ 
            ok: false, 
            error: { code: 'UNAUTHORIZED', message: 'Invalid token' }
        });
    }
    
    // トークン有効期限チェック
    if (Date.now() > tokenData.expiry) {
        adminTokens.delete(token);
        return res.status(401).json({ 
            ok: false, 
            error: { code: 'UNAUTHORIZED', message: 'Token expired' }
        });
    }
    
    req.admin = tokenData;
    next();
}
```

### 10.3 入力検証

```javascript
// カード作成時の検証
app.post('/api/admin/jobs', requireAdmin, (req, res) => {
    const { name_en, name_ja, targetPoints } = req.body;
    
    // 必須フィールドチェック
    if (!name_en || !name_ja || !targetPoints) {
        return res.status(400).json({ 
            ok: false, 
            error: { code: 'BAD_REQUEST', message: 'Required fields missing' }
        });
    }
    
    // 数値検証
    if (isNaN(parseInt(targetPoints))) {
        return res.status(400).json({ 
            ok: false, 
            error: { code: 'BAD_REQUEST', message: 'targetPoints must be a number' }
        });
    }
    
    // DB挿入処理
    // ...
});
```

---

## 11. デプロイメント手順

### 11.1 ローカル開発環境

```bash
# 1. 依存関係インストール
npm install

# 2. 環境変数設定
cp .env.example .env
nano .env  # パスワード変更推奨

# 3. データベース初期化
npm run initdb

# 4. サーバー起動
npm start
```

### 11.2 systemdサービス化

**/etc/systemd/system/career-card-game.service**:
```ini
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
```

**有効化**:
```bash
# ログディレクトリ作成
sudo mkdir -p /var/log/career-card-game
sudo chown ubuntu:ubuntu /var/log/career-card-game

# サービス有効化
sudo systemctl daemon-reload
sudo systemctl enable career-card-game
sudo systemctl start career-card-game

# 状態確認
sudo systemctl status career-card-game
```

### 11.3 Nginxリバースプロキシ（HTTPS）

**/etc/nginx/conf.d/ssl-proxy.conf**:
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    server_tokens off;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305';

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

**Let's Encrypt証明書取得**:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d your-domain.com
sudo nginx -t
sudo systemctl restart nginx
```

---

## 12. トラブルシューティング

### 12.1 管理画面にログインできない

**症状**: "Unauthorized access"エラー

**解決手順**:
1. サーバーコンソールで認証情報確認
2. ログイン試行時のデバッグログ確認
3. `.env`ファイルの存在確認
4. ブラウザキャッシュクリア

**デバッグログ例**:
```
=== LOGIN ATTEMPT ===
Received username: admin
Expected username: admin
Username match: true
Password match: false
====================
```

### 12.2 WebSocket接続エラー

**症状**: "Disconnected"表示が続く

**解決手順**:
1. ブラウザのコンソールでエラー確認
2. Nginxがproxy_upgradeを設定しているか確認
3. ファイアウォールでポート3000が開いているか確認
4. HTTPSの場合、wss://プロトコルを使用しているか確認

### 12.3 データベースエラー

**症状**: "Database check error"

**解決手順**:
```bash
# データベース再作成
rm game.db
npm run initdb
npm start
```

### 12.4 ポート3000が使用中

**解決手順**:
```bash
# 別ポートで起動
PORT=8080 npm start

# または使用中のプロセスを終了
sudo lsof -i :3000
sudo kill -9 <PID>
```

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

### 13.2 クライアントサイド

- [ ] `index.html`作成
- [ ] `game.js`作成（GameClientクラス）
- [ ] WebSocket接続実装
- [ ] 自動再接続機能
- [ ] I18nクラス実装
- [ ] カード表示UI（2エリア構造）
- [ ] モーダル表示機能
- [ ] レスポンシブデザイン

### 13.3 管理画面

- [ ] `admin.html`作成
- [ ] ログイン画面実装
- [ ] カード一覧表示
- [ ] カード追加・編集・削除
- [ ] 画像アップロード（Base64）
- [ ] CSV Export/Import
- [ ] 多言語UI切り替え

### 13.4 データベース

- [ ] mission_categoriesテーブル
- [ ] job_cardsテーブル
- [ ] skill_cardsテーブル
- [ ] missionsテーブル
- [ ] サンプルデータ挿入

### 13.5 多言語対応

- [ ] lang/en.json作成
- [ ] lang/ja.json作成
- [ ] I18nクラス実装
- [ ] APIエンドポイント実装
- [ ] UI言語切り替えボタン

### 13.6 ゲームロジック

- [ ] 職種選択（重複防止）
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

### 15.2 プロジェクト固有ドキュメント

- README.md: プロジェクト概要
- TROUBLESHOOTING.md: トラブルシューティング
- NGINX-REVERSE-PROXY.md: Nginx設定手順
- Reflection-sheet-sample.docx: 振り返りワークシート

---

**仕様書バージョン**: 4.0  
**最終更新日**: 2026-02-05  
**実装状況**: ✅ 本番運用可能  
**Claude再現性**: ✅ この仕様書で完全に再現可能

---

この仕様書に従えば、ゼロから同等のシステムを構築できます。各セクションの実装例をそのまま使用するか、必要に応じてカスタマイズしてください。
