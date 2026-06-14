# 職種×スキル カードゲーム - 完全実装仕様書 v1.3.1

**プロジェクト名**: Role Based Card Game Framework  
**バージョン**: 1.3.1  
**最終更新**: 2026-06-14  
**実装状況**: ✅ v1.3 ベース + バグ修正・仕様改善完了

> **この仕様書について**: v1.1〜v1.3.1 の内容をすべて統合した完全版です。  
> この1ファイルのみでシステムをゼロから再現できます。

---

## 📋 変更履歴

| バージョン | 日付 | 主な変更内容 |
|---|---|---|
| v1.1 | 2026-02-05 | 初版リリース。基本的なカードゲーム実装 |
| v1.2 | 2026-06-13 | カード階層再設計（カテゴリ/スキル区分/スキル）、`job_cards`→`category_cards`、`skill_types`テーブル追加 |
| v1.3 | 2026-06-13 | 3D仮想空間、アバターシステム、横一列スコアバー、カードインタラクションUX |
| v1.3.1 | 2026-06-14 | バグ修正7件、環境変数拡張、カメラ操作改善、カード表示改善、ミッションカード全員表示、表示時間分離 |

### v1.3.1 変更詳細

| # | 分類 | 内容 |
|---|---|---|
| 1 | 🐛 バグ修正 | `showResult()` 内 `/\n/g` 正規表現がヒアドキュメント処理で改行に化けていた問題を修正 |
| 2 | 🐛 バグ修正 | `sessionJoined` レスポンスに `sessionId` が含まれておらず2人目の sessionId が `undefined` になる問題を修正 |
| 3 | 🐛 バグ修正 | `avatar-select` → `lobby` 遷移時に `#scene-container` が存在せず `initScene()` が失敗する問題を修正（`render()` を先に呼ぶよう順序変更） |
| 4 | 🐛 バグ修正 | 職種 ID の型不一致（クライアントから文字列 `"1"` / `matchesCategories` は数値 `1`）によりスキルカードのマッチングが常に失敗する問題を修正（`Number()` で統一） |
| 5 | 🐛 バグ修正 | `diceRolled` / `cardSelected` 受信後に `render()` を呼ぶとボタン状態がリセットされカード確定・次のターンが押せなくなる問題を修正 |
| 6 | 🐛 バグ修正 | スコアバー（`#sb`）が `#ui-interactive` 内に配置されており `render()` のたびに消えていた問題を修正（`#ui-interactive` の外に固定配置） |
| 7 | 🐛 バグ修正 | `this.language` が `init()` 時のみ更新されるため言語切り替え後もカードが古い言語で表示される問題を修正（`i18n.currentLang` を直接参照） |
| 8 | ✨ 仕様追加 | `/api/config` エンドポイント追加（ゲームパラメータを `.env` で制御可能に）|
| 9 | ✨ 仕様追加 | カードスキップ/マッチ結果表示にカード説明文・画像を含める |
| 10 | ✨ 仕様追加 | カード結果表示時間を `.env` で設定可能に（説明文あり: 7秒 / なし: 2.2秒）|
| 11 | ✨ 仕様追加 | ゲーム定番カメラ操作（WASD移動・QE回転・ホイールズーム・カーソルキー）|
| 12 | ✨ 仕様追加 | ターン切り替え時に全プレイヤーを見渡す俯瞰視点に自動切り替え |
| 13 | ✨ 仕様追加 | 天井オブジェクトを削除（カメラ操作の妨げになるため）|
| 14 | ✨ 仕様追加 | URL `?session=XXXX` で2人目アクセス時にセッションIDを自動入力 |
| 15 | ✨ 仕様追加 | WebSocket 接続インジケーターを右下（次のターンボタン上）に移動 |
| 16 | ✨ 仕様追加 | Phase 11-3 動作確認フェーズを追加 |
| 17 | 🐛 バグ修正 | ミッション/特殊カードが他プレイヤーに表示されない問題を修正（`cardSelectedByOther` に `card` データを追加、`_showCardResult()` 共通メソッドで全員に表示）|
| 18 | ✨ 仕様追加 | ミッションカード専用の表示時間（`MISSION_DISPLAY_DURATION`）を `.env` で設定可能に（デフォルト10秒）|

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
11. [環境変数設定](#11-環境変数設定)
12. [デプロイメント手順](#12-デプロイメント手順)
13. [トラブルシューティング](#13-トラブルシューティング)
14. [実装チェックリスト](#14-実装チェックリスト)
15. [本番運用チェックリスト](#15-本番運用チェックリスト)
16. [3D環境システム](#16-3d環境システム)
17. [アバターシステム](#17-アバターシステム)
18. [3D×2D統合レイヤー](#18-3d2d統合レイヤー)
19. [カードインタラクションシステム](#19-カードインタラクションシステム)
20. [z-index・CSSアニメーション定義](#20-z-indexcssアニメーション定義)
21. [参考資料](#21-参考資料)

---

## 1. プロジェクト概要

### 1.1 プロジェクトの目的

キャリア教育・職業理解を目的としたオンラインマルチプレイヤーカードゲームプラットフォーム。

**主要機能**:
- 3種類のカード（職種・スキル・ミッション）を使ったゲームメカニクス
- WebSocketによるリアルタイム同期（2〜4人対戦）
- 3D仮想テーブルでプレイヤーがアバターとして参加
- 多言語対応（日本語・英語）
- 管理画面によるカード編集・CSV Import/Export
- `.env` によるゲームパラメータ制御（v1.3.1）

### 1.2 カード概念モデル

```
カテゴリ（大分類）     ← 職種（SE、PM、QA Engineer など）
    └── スキル区分（中分類）← Katzモデルによる分類
            └── スキル（小分類）← 個別スキルカード
```

### 1.3 対象ユーザー

**プレイヤー**: 中学生〜大学生（キャリア教育）、企業研修参加者（職種理解）、2〜4人のグループ  
**運営者**: 教育機関の教員、企業の人事・研修担当者、ゲーム管理者

### 1.4 システム要件

**サーバー環境**: Node.js 24以上、1GB RAM以上、Ubuntu 22.04 LTS推奨  
**クライアント環境**: モダンWebブラウザ（Chrome/Firefox/Safari/Edge）、JavaScript有効化、WebSocket対応、WebGL対応

---

## 2. システムアーキテクチャ

### 2.1 全体構成図

```
┌──────────────────────────────────────────────────────────┐
│  Client Browser                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Layer 4: #sb スコアバー（fixed・常時表示）z-index:4│  │
│  │  Layer 3: #ui-interactive（カード・ボタン）z-index:3│  │
│  │  Layer 2: #ui-overlay（ラベル）z-index:2            │  │
│  │  Layer 1: Three.js WebGL Canvas z-index:1           │  │
│  └────────────────────────────────────────────────────┘  │
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

> **v1.3.1 重要**: `#sb`（スコアバー）は `#ui-interactive` の**外**に固定配置する。
> `render()` が `#ui-interactive` を書き換えても `#sb` は消えない。

### 2.2 ファイル構成

```
Role-Based-Card-Game-Framework/
├── server.js
├── index.html
├── game.js
├── admin.html
├── initdb.js
├── check-db.js
├── package.json
├── .env
├── .env.example
├── .gitignore
├── game.db
└── lang/
    ├── en.json
    └── ja.json
```

---

## 3. 技術スタック詳細

### 3.1 バックエンド

```json
{
  "name": "career-skills-card-game",
  "version": "1.3.1",
  "engines": { "node": ">=24.0.0" },
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

### 3.2 フロントエンド

- **Vanilla JavaScript** + CSS3
- **Three.js r128**（CDN経由）
- Google Fonts: Outfit / DM Sans

> **Three.js r128 制約**:
> - `THREE.CapsuleGeometry` 使用不可（r142以降）→ `CylinderGeometry` + `SphereGeometry` で代替
> - `THREE.OrbitControls` CDNに含まれない → 独自実装（v1.3.1: window レベルで登録）

---

## 4. データベース設計

### 4.1 テーブル一覧

| テーブル名 | 役割 |
|---|---|
| `mission_categories` | ミッションカテゴリ |
| `category_cards` | 職種カード（大分類）|
| `skill_types` | スキル区分（中分類）|
| `skill_cards` | スキルカード（小分類）|
| `missions` | ミッションカード |

### 4.2 テーブル構造

#### category_cards
```sql
CREATE TABLE category_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL, name_ja TEXT NOT NULL,
    imageUrl TEXT,
    descriptionHtml_en TEXT, descriptionHtml_ja TEXT,
    targetPoints INTEGER NOT NULL
);
```
サンプル6件: Engineer(5pt)、Designer(4pt)、Project Manager(4pt)、QA Engineer(3pt)、DevOps Engineer(5pt)、Data Analyst(4pt)

#### skill_types
```sql
CREATE TABLE skill_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL, name_ja TEXT NOT NULL,
    model_type TEXT NOT NULL DEFAULT 'katz',
    description_en TEXT, description_ja TEXT,
    sortOrder INTEGER DEFAULT 0
);
```
`model_type` は現バージョン `'katz'` 固定。

#### skill_cards
```sql
CREATE TABLE skill_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL, name_ja TEXT NOT NULL,
    imageUrl TEXT,
    descriptionHtml_en TEXT, descriptionHtml_ja TEXT,
    matchesCategories TEXT  -- カンマ区切り category_cards ID 文字列 "1,3,5"
);
```

> **v1.3.1 重要**: `matchesCategories` はDB上カンマ区切り**文字列**。
> サーバー処理時は必ず `.split(',').map(Number)` で数値配列化する。
> 職種IDの比較は必ず `Number()` に変換してから行う（型不一致バグ対策）。

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
`isSpecial=1`: 退職&強制兼任（出現確率は `SPECIAL_MISSION_RATE` で制御）

---

## 5. サーバーサイド実装

### 5.1 定数定義（v1.3.1 環境変数化）

```javascript
const ADMIN_USERNAME       = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD       = process.env.ADMIN_PASSWORD || 'admin123';
const TOKEN_EXPIRY         = parseInt(process.env.ADMIN_TOKEN_EXPIRY_HOURS || '24', 10) * 60 * 60 * 1000;
const MAX_PLAYERS          = parseInt(process.env.MAX_PLAYERS             || '4',   10);
const SPECIAL_MISSION_RATE = parseFloat(process.env.SPECIAL_MISSION_RATE  || '0.1');
const DECK_RESET_THRESHOLD = parseInt(process.env.DECK_RESET_THRESHOLD    || '7',   10);
const DICE_ROLL_DURATION   = parseFloat(process.env.DICE_ROLL_DURATION     || '2.2');
const WS_RECONNECT_DELAY   = parseInt(process.env.WS_RECONNECT_DELAY      || '3000', 10);
```

### 5.2 WebSocket ハンドラ

```javascript
switch (data.type) {
    case 'createSession':  handleCreateSession(ws, data);  break;
    case 'joinSession':    handleJoinSession(ws, data);    break;
    case 'selectAvatar':   handleSelectAvatar(ws, data);   break;
    case 'selectCategory': handleSelectCategory(ws, data); break;
    case 'startGame':      handleStartGame(ws, data);      break;
    case 'rollDice':       handleRollDice(ws, data);       break;
    case 'selectCard':     handleSelectCard(ws, data);     break;
    case 'nextTurn':       handleNextTurn(ws, data);       break;
    case 'resign':         handleResign(ws, data);         break;
    case 'resetGame':      handleResetGame(ws, data);      break;
}
```

### 5.3 handleJoinSession（v1.3.1 修正）

```javascript
// 本人へ送信 — sessionId を必ず含める（v1.3.1 修正）
ws.send(JSON.stringify({
    type: 'sessionJoined',
    sessionId: data.sessionId,  // ← v1.3 ではなかった。2人目のsessionIdがundefinedになるバグの原因
    playerId,
    session
}));
```

### 5.4 handleSelectCategory（v1.3.1 修正）

```javascript
// categoryId を Number に変換して格納（型不一致バグ対策）
player.categories.push(Number(data.categoryId));
```

### 5.5 handleRollDice（v1.3.1 環境変数化）

```javascript
const diceValue = Math.floor(Math.random() * 6) + 1;

// 在庫管理: DECK_RESET_THRESHOLD 以下ならリセット
if (available.length <= DECK_RESET_THRESHOLD) {
    session.usedCardIds = [];
    available = [...allCards];
}

// 特殊ミッション: SPECIAL_MISSION_RATE の確率で追加
if (specialMissions.length > 0 && Math.random() < SPECIAL_MISSION_RATE) { ... }
```

### 5.6 handleSelectCard（v1.3.1 型統一）

```javascript
// matchesCategories と player.categories の比較は必ず Number で統一
player.categories.forEach(cid => {
    const cidNum = Number(cid);
    if (mc.includes(cidNum)) {
        matched = true;
        player.points[cidNum] = (player.points[cidNum] || 0) + 1;
    }
});

// 勝利判定も Number で統一
const hasWon = player.categories.every(cid => {
    const cidNum = Number(cid);
    const cat = cats.find(c => c.id === cidNum);
    return cat && (player.points[cidNum] || 0) >= cat.targetPoints;
});
```

### 5.7 REST API 一覧

```
GET  /api/cards/categories
GET  /api/cards/skills
GET  /api/cards/missions
GET  /api/cards/skill-types
GET  /api/cards/mission-categories
GET  /api/lang/:lang
GET  /api/config                    ← v1.3.1 新規追加
POST /api/auth/login
POST/PUT/DELETE /api/admin/categories
POST/PUT/DELETE /api/admin/skills
POST/PUT/DELETE /api/admin/missions
POST/PUT/DELETE /api/admin/skill-types
POST /api/admin/import/:type
GET  /api/health
```

### 5.8 /api/config（v1.3.1 新規）

```javascript
app.get('/api/config', (req, res) => {
    res.json({
        ok:                       true,
        cardDisplayDuration:      parseInt(process.env.CARD_DISPLAY_DURATION         || '7000',  10),
        cardDisplayDurationShort: parseInt(process.env.CARD_DISPLAY_DURATION_SHORT   || '2200',  10),
        missionDisplayDuration:   parseInt(process.env.MISSION_DISPLAY_DURATION      || '10000', 10),
        diceRollDuration:         DICE_ROLL_DURATION,
        wsReconnectDelay:         WS_RECONNECT_DELAY,
        maxPlayers:               MAX_PLAYERS,
        specialMissionRate:       SPECIAL_MISSION_RATE,
    });
});
```

---

## 6. クライアントサイド実装

### 6.1 GameClient の初期化フロー

```javascript
async init() {
    await i18n.init();
    this.language = i18n.currentLang;  // 後方互換のため残存（実際は i18n.currentLang を直接使用）
    this.connect();
    await Promise.all([
        this.fetchCategoryCards(),
        this.fetchSkillCards(),
        this.fetchMissionCards(),
        this.fetchConfig(),            // v1.3.1 追加
    ]);
    this.render();
}

async fetchConfig() {
    const res  = await fetch('/api/config');
    const data = await res.json();
    if (data.ok) {
        this._cardDisplayDuration      = data.cardDisplayDuration;
        this._cardDisplayDurationShort = data.cardDisplayDurationShort;
        this._diceRollDuration         = data.diceRollDuration;
        this._wsReconnectDelay         = data.wsReconnectDelay;
    }
}
```

### 6.2 言語参照ルール（v1.3.1 修正）

カード名・説明文の言語参照は **必ず `i18n.currentLang` を使う**。`this.language` は使用しない。

```javascript
// ✅ 正しい
const name = card['name_' + i18n.currentLang] ?? card.name_ja;
const desc = card['descriptionHtml_' + i18n.currentLang] ?? card.descriptionHtml_ja;

// ❌ 使用禁止（言語切り替え後に古い値が残る）
const name = card['name_' + this.language] ?? card.name_ja;
```

### 6.3 render() のルール（v1.3.1 重要）

```javascript
render() {
    // menu / avatar-select → app 全体を置き換え
    if (this.mode === 'menu' || this.mode === 'avatar-select') {
        app.innerHTML = this.renderMenu() / this.renderAvatarSelect();
        return;
    }

    // lobby / game → #scene-container が存在しなければ4層構造を再構築
    if (!document.getElementById('scene-container')) {
        app.innerHTML = `
<div id="scene-container" ...></div>
<div id="ui-overlay"      ...></div>
<div id="ui-interactive"  ...></div>
<div id="sb" style="position:absolute;top:10px;left:10px;right:10px;z-index:4;
  display:flex;..."></div>`;   // ← #sb はここで生成（#ui-interactive の外）
    }

    // #ui-interactive のみ更新（#scene-container・#sb は保護）
    const ui = document.getElementById('ui-interactive');
    ui.innerHTML = this.renderLobby() / this.renderGame();

    // 常時スコアバーを更新
    if (this.mode === 'game' || this.mode === 'lobby') {
        this.upScoreboard();
    }
}
```

### 6.4 initScene() の呼び出し順序（v1.3.1 修正）

```javascript
// ✅ 正しい順序: render() で DOM を確保 → initScene() で SceneManager 起動
this.mode = 'lobby';
this.render();        // ← 先に #scene-container を DOM に生成
this.initScene();     // ← その後 SceneManager を起動

// ❌ 誤った順序（#scene-container が null でエラー）
this.mode = 'lobby';
this.initScene();     // ← #scene-container がまだ存在しない
this.render();
```

適用箇所: `confirmAvatar()` / `gameStarted` ハンドラ / `gameReset` ハンドラ

### 6.5 render() を呼ばないケース（v1.3.1 追加）

game モード中に以下のイベントを受信したとき `render()` を呼ぶと `#ui-interactive` が再生成され、ボタン状態が初期化される。これらは `upScoreboard()` だけ呼ぶ。

| WSメッセージ | 理由 |
|---|---|
| `diceRolled` | `showCardArea()` でカード表示後に `render()` すると `#ca` が `display:none` にリセットされる |
| `cardSelected` | `confirmCard()` の `setBtnState({next:'active'})` が上書きされる |
| `cardSelectedByOther` | 3D側のみ更新すれば十分 |

### 6.6 URL セッション自動入力（v1.3.1 追加）

```javascript
attachEventListeners() {
    // URL の ?session=XXXX をフォームに自動セット
    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get('session');
    if (sessionParam) {
        const input = document.getElementById('join-session-id');
        if (input) input.value = sessionParam.toUpperCase();
    }
}
```

---

## 7. 多言語対応システム

lang/ja.json・lang/en.json のキー構造は v1.3 から変更なし。  
各 JSON の全キー数: common(9) / game(35) / avatar(6) / admin(17) / errors(7) = 計74キー。

---

## 8. 管理画面実装

v1.3 から変更なし。タブ構成: categories / skill-types / skills / missions / mission-categories。

---

## 9. ゲームロジック詳細

### 9.1 ゲームフロー

```
[メニュー] → createSession / joinSession
      ↓
[アバター選択] selectAvatar
      ↓
[ロビー] selectCategory（全員完了後）→ startGame
      ↓
[ゲームループ]
  1. rollDice → ダイスアニメーション（DICE_ROLL_DURATION 秒）
  2. カード 1〜6 枚スライドアップ表示
  3. 1st タップ → カードハイライト + ヒント「もう一度タップで確定」
  4. 2nd タップ → confirmCard() → WS送信 → cardSelected 受信
     → マッチング結果表示（説明文・画像付き / CARD_DISPLAY_DURATION ms）
     → スコアバー更新（マッチ時のみピップ増加）
  5. 「次のターン」→ 俯瞰視点へ自動切り替え
      ↓
[ゴール] 全職種 targetPoints 達成 → 最終ランキング
```

### 9.2 スキルカードマッチング判定

```javascript
// matchesCategories（数値配列）と player.categories（Number変換済み）を照合
const mc = card.matchesCategories.split(',').map(Number);
player.categories.forEach(cid => {
    const cidNum = Number(cid);
    if (mc.includes(cidNum)) {
        matched = true;
        player.points[cidNum] = (player.points[cidNum] || 0) + 1;
    }
});
```

### 9.3 カード結果表示（v1.3.1 改善）

クライアントは `confirmCard()` 時点では結果を表示**しない**。サーバーから WS メッセージを受信後に `_showCardResult()` で表示する。

#### スキルカード（本人: `cardSelected` / 他プレイヤー: `cardSelectedByOther`）

| `data.matched` | `data.alreadySelected` | 表示 |
|---|---|---|
| `true` | `false` | ✅ マッチ！「カード名」+ 説明文 |
| `false` | `false` | 「カード名」あなたの職種には対応していません + 説明文 |
| — | `true` | 「カード名」すでに選択済みです |

他プレイヤーのスキルカードは「〇〇 が選択：スキルカード名」形式で表示。

#### ミッション/特殊カード（全員: `cardSelected` broadcast）

サーバーはミッション/特殊カード選択時、`cardSelected` を**全プレイヤーに broadcast** する。  
クライアントは全員が `cardSelected` を受信し、`_showCardResult()` でミッション内容を表示する。

| カード種別 | 表示内容 |
|---|---|
| mission | `ミッション発動！「名前」〇〇で議論してください` + 説明文 |
| special | `特殊ミッション！「名前」プレイヤーを選択してください` + 説明文 |

#### _showCardResult() 共通メソッド

```javascript
_showCardResult(card, matched, alreadySelected, isOther = false, playerName = '') {
    // card.type に応じて skill / mission / special の表示を分岐
    // isOther=true の場合は「playerName が選択：」プレフィックスを付与
    // 表示時間: skill → _cardDisplayDuration / mission,special → _missionDisplayDuration
}
```

#### cardSelectedByOther の payload（v1.3.1 追加）

```javascript
// server.js: スキルカード選択時の他プレイヤーへの broadcast
broadcast(sessionId, {
    type:       'cardSelectedByOther',
    playerId:   player.id,
    cardType:   'skill',
    card,           // ← v1.3.1 追加: カード内容を含める
    matched,        // ← v1.3.1 追加: マッチング結果
    playerName: player.name,  // ← v1.3.1 追加
    session,
}, player.id);
```

---

## 10. セキュリティ実装

### 10.1 環境変数（機密情報）

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here
```

`.gitignore` に `.env` を含める。

### 10.2 認証トークン

Bearer token（UUID v4）、有効期限は `ADMIN_TOKEN_EXPIRY_HOURS` で設定（デフォルト24時間）。

---

## 11. 環境変数設定（v1.3.1 新規セクション）

### 11.1 .env.example 完全版

```env
# ── 認証 ──────────────────────────────────────────────────────
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_TOKEN_EXPIRY_HOURS=24      # 管理者トークン有効期限（時間）

# ── サーバー ───────────────────────────────────────────────────
PORT=3000

# ── ゲームバランス ─────────────────────────────────────────────
MAX_PLAYERS=4                    # 最大プレイヤー数
SPECIAL_MISSION_RATE=0.1         # 特殊ミッション出現確率（0.0〜1.0）
DECK_RESET_THRESHOLD=7           # デッキリセット閾値（残り枚数）

# ── アニメーション・タイミング ──────────────────────────────────
DICE_ROLL_DURATION=2.2           # ダイスアニメーション時間（秒）
WS_RECONNECT_DELAY=3000          # WebSocket 再接続待ち（ミリ秒）
CARD_DISPLAY_DURATION=7000       # スキルカード説明文表示時間（ミリ秒）
CARD_DISPLAY_DURATION_SHORT=2200 # スキルカード説明文なし時の表示時間（ミリ秒）
MISSION_DISPLAY_DURATION=10000   # ミッション/特殊カード表示時間（ミリ秒）
```

### 11.2 値の流れ

```
.env
  ↓ dotenv
server.js の定数（MAX_PLAYERS, SPECIAL_MISSION_RATE 等）
  ↓ ゲームロジックで使用
GET /api/config
  ↓
game.js の fetchConfig()
  ↓ this._cardDisplayDuration 等
showResult() / アニメーションループ 等で使用
```

---

## 12. デプロイメント手順

### 12.1 ローカル開発

```bash
npm install
cp .env.example .env   # .env を編集して設定を調整
npm run initdb
npm start
```

### 12.2 systemd サービス

```ini
[Unit]
Description=Career Card Game WebSocket Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/Role-Based-Card-Game-Framework
EnvironmentFile=/home/ubuntu/Role-Based-Card-Game-Framework/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 12.3 Nginx + Let's Encrypt

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;
}
```

---

## 13. トラブルシューティング

| 症状 | 原因 | 解決方法 |
|---|---|---|
| スキルカードが常にマッチしない | categoryId の型不一致（文字列 vs 数値）| `Number()` 変換を確認（v1.3.1 修正済み）|
| 2人目の sessionId が undefined | `sessionJoined` に sessionId なし | server.js の `handleJoinSession` を確認（v1.3.1 修正済み）|
| 3Dシーンが表示されない | `initScene()` より前に `render()` を呼んでいない | `render()` → `initScene()` の順序を確認 |
| カード確定後「次のターン」が押せない | `cardSelected` 後の `render()` でボタンがリセット | `cardSelected` では `render()` を呼ばない |
| スコアバーが消える | `#sb` が `#ui-interactive` 内に配置されている | `#sb` を `#ui-interactive` の外に配置（v1.3.1 修正済み）|
| カードが英語で表示される | `this.language` が古い値を保持 | `i18n.currentLang` を直接参照（v1.3.1 修正済み）|
| WebSocket が Disconnected のまま | Nginx の WebSocket ヘッダー未設定 | `Upgrade` / `Connection` ヘッダーを確認 |
| DBエラー | スキーマ不整合 | `rm game.db && npm run initdb` |

---

## 14. 実装チェックリスト

### 14.1 サーバーサイド

- [ ] 定数宣言が全て環境変数で制御されている（Section 5.1）
- [ ] `handleJoinSession`: `sessionId` を含む `sessionJoined` を送信（v1.3.1）
- [ ] `handleSelectCategory`: `Number(data.categoryId)` で push（v1.3.1）
- [ ] `handleSelectCard`: `Number(cid)` で matchesCategories と比較（v1.3.1）
- [ ] `/api/config` エンドポイントが存在する（v1.3.1）
- [ ] `DECK_RESET_THRESHOLD` / `SPECIAL_MISSION_RATE` が環境変数から読む

### 14.2 クライアントサイド

- [ ] `fetchConfig()` が `init()` で呼ばれている（v1.3.1）
- [ ] カード名・説明文の参照が `i18n.currentLang`（v1.3.1）
- [ ] `render()` で `#scene-container` がない場合に4層構造（`#sb`含む）を再構築
- [ ] `confirmAvatar()` / `gameStarted` / `gameReset` が `render()` → `initScene()` の順
- [ ] `diceRolled` / `cardSelected` / `cardSelectedByOther` で `render()` を呼ばない
- [ ] `cardSelected` 受信時に `_showCardResult()` でカード種別に応じた結果表示
- [ ] `cardSelectedByOther` 受信時に `_showCardResult()` で他プレイヤーのカード内容表示
- [ ] ミッションカードが全員の画面に表示される（`cardSelected` が全員 broadcast されること）
- [ ] `MISSION_DISPLAY_DURATION` が `.env` で設定可能
- [ ] URL `?session=XXXX` でフォームに自動入力
- [ ] WebSocket 接続インジケーターが右下（`bottom:52px; right:16px`）

### 14.3 3Dシーン

- [ ] 天井オブジェクト（CylinderGeometry / CircleGeometry）が存在しない（v1.3.1）
- [ ] カメライベントが `window` レベルで登録（v1.3.1）
- [ ] `focusCameraOnSeat()` が俯瞰視点（`phi:0.28`, `radius:16`）（v1.3.1）
- [ ] WASD / QE / カーソルキーによるカメラ操作

---

## 15. 本番運用チェックリスト

- [ ] `.env` に強力なパスワード設定
- [ ] HTTPS/WSS 使用
- [ ] DBバックアップ設定
- [ ] systemd 自動起動確認
- [ ] `CARD_DISPLAY_DURATION` を授業設計に合わせて調整

---

## 16. 3D環境システム

### 16.1 SceneManager クラス API

```javascript
class SceneManager {
    constructor(containerId)
    init(players)                         // 起動（render()後に呼ぶこと）
    destroy()
    updateTurn(currentPlayerId)           // 俯瞰視点へ自動切り替え
    triggerDiceRoll(callback?)
    showCardOnTable(playerId, cardType)
    focusCameraOnSeat(seatIndex)          // 俯瞰視点（phi:0.28, radius:16）
}
```

### 16.2 カメラ操作（v1.3.1 改善）

**入力方式**: `window` レベルでイベント登録（UIレイヤーの上からでも操作可能）

| 操作 | 動作 |
|---|---|
| マウスドラッグ | 自由回転 |
| ホイール | ズームイン/アウト（`passive:false`）|
| `W` / `↑` | 前進 |
| `S` / `↓` | 後退 |
| `A` | 左に平行移動 |
| `D` | 右に平行移動 |
| `Q` / `←` | 左回転 |
| `E` / `→` | 右回転 |
| `PageUp` | ズームイン |
| `PageDown` | ズームアウト |

テキスト入力中（`INPUT` / `TEXTAREA` / `SELECT` にフォーカス時）はキーボード操作を無効化。

### 16.3 ターン切り替え時のカメラ（v1.3.1 変更）

```javascript
focusCameraOnSeat(seatIndex) {
    this.camTarget.phi    = 0.28;   // ほぼ真上（俯瞰）
    this.camTarget.radius = 16;     // 広角
    this.camTarget.theta  = SEAT_ANGLES[seatIndex] + Math.PI;
    // lookAt オフセットをリセット
    if (this._lookAtOffset) {
        this._lookAtOffset = { x: 0, y: 1, z: 0 };
    }
}
```

v1.3 の「アクティブプレイヤー方向への低角度フォーカス」から「全プレイヤーを見渡す俯瞰視点」に変更。

### 16.4 シーン構成の変更（v1.3.1）

- **天井（CylinderGeometry）削除**: カメラ操作の妨げになるため削除
- **中央グロウディスク（CircleGeometry）削除**: 同上

---

## 17. アバターシステム

v1.3 から変更なし。AVATAR_TYPES(4種) / AVATAR_COLORS(6色) / 座席 SEAT_ANGLES / SEAT_RADIUS。

---

## 18. 3D×2D統合レイヤー

### 18.1 DOM 4層構造（v1.3.1 修正）

```html
<div id="app">
  <div id="scene-container"  z-index:1>  <!-- Three.js canvas -->
  <div id="ui-overlay"       z-index:2>  <!-- ラベル（pointer-events:none）-->
  <div id="ui-interactive"   z-index:3>  <!-- ゲームUI（render()が書き換える）-->
  <div id="sb"               z-index:4>  <!-- スコアバー（常時固定・render()で消えない）-->
</div>
```

> **重要**: `#sb` は `render()` が `#ui-interactive` を書き換えても消えない。

### 18.2 スコアバー仕様

```javascript
upScoreboard(flashIdx = -1) {
    const sb = document.getElementById('sb');
    // ...
    // 兼任（複数職種）の場合は全職種の最小進捗を表示
    const minProg = progresses.reduce((a, b) => (a.pts/a.max <= b.pts/b.max ? a : b));
}
```

### 18.3 接続インジケーター位置（v1.3.1 変更）

```css
#connection-indicator {
    position: fixed;
    bottom: 52px; right: 16px;  /* v1.3: top:12px; right:16px → スコアバーと被る問題を修正 */
    z-index: 9999;
}
```

---

## 19. カードインタラクションシステム

### 19.1 フロー（v1.3.1 修正）

```
rollDice()
  → setBtnState({ dice:'rolling' })  ← render() は呼ばない
  → WS送信
  ↓
diceRolled 受信
  → showCardArea()                   ← render() は呼ばない
  ↓
1st タップ → onCardClick()           → setBtnState({ dice:'disabled', next:'disabled' })
  ↓
2nd タップ → confirmCard()           → WS送信 → hideCardArea()
                                     → setTimeout(() => setBtnState({next:'active'}), 0)
  ↓
【スキルカード】
  本人: cardSelected 受信            ← render() は呼ばない
    → _showCardResult(card, matched, alreadySelected, false)
    → upScoreboard()
  他者: cardSelectedByOther 受信
    → sceneManager.showCardOnTable()
    → _showCardResult(card, matched, false, true, playerName)
    → upScoreboard()

【ミッション/特殊カード】
  全員: cardSelected 受信（broadcast）← render() は呼ばない
    → _showCardResult(card, -, -, isOther)  ← _missionDisplayDuration で表示
    → upScoreboard()
```

### 19.2 _showCardResult() と showResult()（v1.3.1 改善）

```javascript
/** カード選択結果を表示する共通メソッド */
_showCardResult(card, matched, alreadySelected, isOther = false, playerName = '') {
    // card.type に応じて分岐
    // skill  → matched/alreadySelected でメッセージを切り替え
    // mission/special → ミッション内容 + 対象（個人/チーム）を表示
    // isOther=true 時は「playerName が選択：」プレフィックスを付与
    // showResult() の isMission フラグで表示時間を切り替え
}

showResult(msg, type = null, col = null, imageUrl = null, description = '', isMission = false) {
    // imageUrl がある場合は画像を先頭に表示
    // 説明文がある場合は区切り線の下に小さく表示

    // 表示時間の切り替え
    const duration = isMission
        ? this._missionDisplayDuration          // MISSION_DISPLAY_DURATION（デフォルト10秒）
        : description
            ? this._cardDisplayDuration         // CARD_DISPLAY_DURATION（デフォルト7秒）
            : this._cardDisplayDurationShort;   // CARD_DISPLAY_DURATION_SHORT（デフォルト2.2秒）
}
```

#### 表示時間の種別

| 種別 | `.env` 変数 | デフォルト | 用途 |
|---|---|---|---|
| ミッション/特殊 | `MISSION_DISPLAY_DURATION` | 10秒 | 全員で声に出して読む時間を確保 |
| スキル（説明あり）| `CARD_DISPLAY_DURATION` | 7秒 | スキル内容を読む時間 |
| スキル（説明なし）| `CARD_DISPLAY_DURATION_SHORT` | 2.2秒 | 最小表示 |

---

## 20. z-index・CSSアニメーション定義

### 20.1 z-index 階層

| レイヤー | 要素 | z-index |
|---|---|---|
| Three.js canvas | 3D シーン | 1 |
| プレイヤーラベル | 座席名前表示 | 2 |
| ゲームUI | #ui-interactive | 3 |
| スコアバー | #sb（常時固定）| 4 |
| カードエリア | #ca（スライドアップ）| 10 |
| 結果モーダル | #rm | 20 |
| モーダルオーバーレイ | .modal-overlay | 1000 |
| 接続インジケーター | #connection-indicator | 9999 |

### 20.2 CSSアニメーション

```css
@keyframes su  { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
@keyframes fo  { to { opacity:0; transform:scale(0.94); } }
@keyframes pip { 0%{transform:scale(1)} 50%{transform:scale(1.5)} 100%{transform:scale(1)} }
```

---

## 21. 参考資料

### 21.1 公式ドキュメント

- Node.js: https://nodejs.org/
- Three.js r128: https://threejs.org/docs/
- better-sqlite3: https://github.com/WiseLibs/better-sqlite3

### 21.2 理論的フレームワーク

- Katz, R.L. (1955). Skills of an Effective Administrator. *Harvard Business Review*.

### 21.3 プロジェクト固有ドキュメント

- `v1.3.1-implementation-prompts.md`: 実装プロンプト集
- `Phase11-3_動作確認.md`: デプロイ前動作確認チェックリスト

---

**仕様書バージョン**: 1.3.1  
**最終更新日**: 2026-06-14  
**実装状況**: ✅ 動作確認済み  
**Claude再現性**: ✅ この1ファイルでゼロから完全再現可能
