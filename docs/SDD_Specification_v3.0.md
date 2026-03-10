# 📘 職種×スキル カードゲーム - 完全統合仕様書 v3.0

**最終更新**: 2026-01-30  
**バージョン**: 3.0  
**実装状況**: ✅ 完全動作確認済み

---

## 📋 目次

1. [概要](#1-概要)
2. [技術スタック](#2-技術スタック)
3. [ゲームコンセプト](#3-ゲームコンセプト)
4. [カード仕様](#4-カード仕様)
5. [データベース設計](#5-データベース設計)
6. [API仕様](#6-api仕様)
7. [WebSocketイベント](#7-websocketイベント)
8. [ゲームフロー](#8-ゲームフロー)
9. [多言語対応](#9-多言語対応)
10. [管理画面](#10-管理画面)
11. [認証システム](#11-認証システム)
12. [UI/UX仕様](#12-uiux仕様)
13. [ファイル構成](#13-ファイル構成)
14. [セットアップ手順](#14-セットアップ手順)
15. [実装の重要ポイント](#15-実装の重要ポイント)

---

## 1. 概要

### 1.1 基本情報
- **タイプ**: オンラインマルチプレイヤーカードゲーム
- **プレイヤー数**: 2〜4人
- **プラットフォーム**: Webブラウザ（デスクトップ・スマートフォン対応）
- **通信方式**: WebSocket（リアルタイム同期）
- **言語**: 日本語・英語

### 1.2 ゲームの目的
- 各プレイヤーは職種カードを選択
- サイコロを振ってカードを引く
- スキルカードで職種に合ったポイントを獲得
- 目標ポイントに到達したプレイヤーが勝利

---

## 2. 技術スタック

### 2.1 フロントエンド
- **HTML5** - セマンティックマークアップ
- **CSS3** - グラデーション、アニメーション
- **Vanilla JavaScript** - Reactは使用しない
- **WebSocket API** - リアルタイム通信

### 2.2 バックエンド
- **Node.js** (v14以上)
- **Express.js** (^4.18.2) - Webフレームワーク
- **ws** (^8.14.2) - WebSocketサーバー
- **SQLite3** (^5.1.6) - データベース
- **uuid** (^9.0.1) - セッションID生成
- **dotenv** (^16.3.1) - 環境変数管理

### 2.3 開発ツール
- **nodemon** (^3.0.1) - 開発時の自動リロード

---

## 3. ゲームコンセプト

このゲームは、現実の職場で起こる以下の状況を疑似体験する教育ゲーム：

- **退職** - 特殊ミッションで発動
- **兼任** - 退職者の職種を引き継ぐ
- **業務負荷の偏り** - 複数職種の目標達成
- **組織的な意思決定** - ミッションカードで議論
- **職種ごとの価値観** - スキルカードのマッチング
- **スキル習得** - 同じスキルは再取得不可

---

## 4. カード仕様

### 4.1 職種カード（Job Card）

#### 表示方式
- **カード中央（80%）**: クリックで選択
- **カード下部（20%）**: クリックで詳細表示

#### データ構造
```javascript
{
  id: 1,
  name_en: "Software Engineer",
  name_ja: "ソフトウェアエンジニア",
  imageUrl: "data:image/jpeg;base64,..." or null,
  descriptionHtml_en: "<p>Develops software...</p>",
  descriptionHtml_ja: "<p>ソフトウェア開発...</p>",
  targetPoints: 5
}
```

#### 特徴
- アスペクト比: 5:7
- 色: 紫系グラデーション（#667eea → #764ba2）
- 他プレイヤーが選択済みの職種は選択不可（グレーアウト）

---

### 4.2 スキルカード（Skill Card）

#### 表示方式
- **カード中央（80%）**: クリックで選択
- **カード下部（20%）**: クリックで詳細表示

#### データ構造
```javascript
{
  id: 1,
  name_en: "Python Programming",
  name_ja: "Pythonプログラミング",
  imageUrl: "data:image/jpeg;base64,..." or null,
  descriptionHtml_en: "<p>Proficiency in Python...</p>",
  descriptionHtml_ja: "<p>Python習熟度...</p>",
  matchesJobs: "1,3" // カンマ区切りの職種ID
}
```

#### 特徴
- アスペクト比: 5:7
- 色: ピンク系グラデーション（#f093fb → #f5576c）
- 職種とマッチすると +1pt（初回のみ）
- 再選択時はポイント加算なし
- プレイヤーごとに `selectedSkillCardIds` で管理

---

### 4.3 ミッションカード（Mission Card）

#### 表示方式
- **カード中央（80%）**: クリックで選択
- **カード下部（20%）**: クリックで詳細表示

#### データ構造
```javascript
{
  id: 1,
  name_en: "System Down",
  name_ja: "システムダウン",
  imageUrl: "data:image/jpeg;base64,..." or null,
  descriptionHtml_en: "<p>The main system is down...</p>",
  descriptionHtml_ja: "<p>メインシステムがダウン...</p>",
  categoryId: 1,
  target_en: "Discuss crisis response",
  target_ja: "危機対応戦略を議論",
  isSpecial: 0
}
```

#### 特徴
- アスペクト比: 5:7
- 色: シアン系グラデーション（#4facfe → #00f2fe）
- ポイント変化なし
- チームでの議論を促す

---

### 4.4 特殊ミッションカード

#### データ構造
```javascript
{
  id: 5,
  name_en: "Resignation & Forced Dual Role",
  name_ja: "退職＆強制兼任",
  imageUrl: "data:image/jpeg;base64,..." or null,
  descriptionHtml_en: "<p><strong>SPECIAL MISSION:</strong> ...</p>",
  descriptionHtml_ja: "<p><strong>特別ミッション:</strong> ...</p>",
  categoryId: 1,
  target_en: "Execute resignation",
  target_ja: "退職と職種移譲を実行",
  isSpecial: 1  // ← 特殊フラグ
}
```

#### 特徴
- 色: イエローピンク系グラデーション（#fa709a → #fee140）
- 出現確率: 10%
- 効果: 使用者は即時退職、他プレイヤーに職種を押し付ける
- データベースに1枚のみ

---

### 4.5 カード在庫管理

#### 使用済みカードトラッキング
```javascript
session.usedCardIds = [1, 3, 5, 7, ...];
```

#### 自動再利用システム ✨
```javascript
// カード在庫が0になった場合
if (availableCards.length === 0) {
    session.usedCardIds = [];
    availableCards = [...allCards];
}
```

---

## 5. データベース設計

### 5.1 mission_categories

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
['Crisis Management', '危機管理', 'Handling unexpected issues', '予期せぬ問題への対応', 1]
['Decision Making', '意思決定', 'Making strategic choices', '戦略的な選択', 2]
['Communication', 'コミュニケーション', 'Team coordination', 'チーム調整', 3]
['Resource Management', 'リソース管理', 'Budget and time management', '予算と時間管理', 4]
```

---

### 5.2 job_cards

```sql
CREATE TABLE job_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL,
    name_ja TEXT NOT NULL,
    imageUrl TEXT,
    descriptionHtml_en TEXT,
    descriptionHtml_ja TEXT,
    targetPoints INTEGER NOT NULL
);
```

**サンプルデータ**:
```javascript
['Software Engineer', 'ソフトウェアエンジニア', null, '<p>Develops software...</p>', '<p>ソフトウェア開発...</p>', 5]
['Product Manager', 'プロダクトマネージャー', null, '<p>Manages product...</p>', '<p>製品開発を管理...</p>', 6]
['Data Scientist', 'データサイエンティスト', null, '<p>Analyzes complex data...</p>', '<p>複雑なデータを分析...</p>', 5]
['UX Designer', 'UXデザイナー', null, '<p>Creates user-centered designs...</p>', '<p>ユーザー中心のデザイン...</p>', 5]
```

---

### 5.3 skill_cards

```sql
CREATE TABLE skill_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL,
    name_ja TEXT NOT NULL,
    imageUrl TEXT,
    descriptionHtml_en TEXT,
    descriptionHtml_ja TEXT,
    matchesJobs TEXT
);
```

**サンプルデータ**:
```javascript
['Python Programming', 'Pythonプログラミング', null, '<p>Proficiency in Python...</p>', '<p>Python習熟度...</p>', '1,3']
['User Research', 'ユーザーリサーチ', null, '<p>Conducting interviews...</p>', '<p>インタビューと調査...</p>', '2,4']
['Data Visualization', 'データ可視化', null, '<p>Creating charts...</p>', '<p>チャートとダッシュボード...</p>', '3']
['Agile Methods', 'アジャイル手法', null, '<p>Managing projects...</p>', '<p>プロジェクト管理...</p>', '1,2']
['Prototyping', 'プロトタイピング', null, '<p>Building prototypes...</p>', '<p>プロトタイプを構築...</p>', '4']
['Machine Learning', '機械学習', null, '<p>Developing AI models...</p>', '<p>AIモデル開発...</p>', '3']
['API Design', 'API設計', null, '<p>Creating RESTful APIs...</p>', '<p>RESTful API作成...</p>', '1']
['Market Analysis', '市場分析', null, '<p>Analyzing market trends...</p>', '<p>市場動向分析...</p>', '2']
```

---

### 5.4 missions

```sql
CREATE TABLE missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT,
    name_ja TEXT,
    imageUrl TEXT,
    descriptionHtml_en TEXT NOT NULL,
    descriptionHtml_ja TEXT NOT NULL,
    categoryId INTEGER,
    target_en TEXT,
    target_ja TEXT,
    isSpecial INTEGER DEFAULT 0,
    FOREIGN KEY(categoryId) REFERENCES mission_categories(id)
);
```

**サンプルデータ**:
```javascript
['System Down', 'システムダウン', null, '<p>The main system is down...</p>', '<p>メインシステムがダウン...</p>', 1, 'Discuss crisis response', '危機対応戦略を議論', 0]
['Technical Debt vs Features', '技術的負債 vs 新機能', null, '<p>Engineering wants to fix...</p>', '<p>技術的負債の修正を望み...</p>', 2, 'Balance technical needs', '技術とビジネスをバランス', 0]
['Team Alignment', 'チーム調整', null, '<p>Design and engineering...</p>', '<p>デザインとエンジニアリング...</p>', 3, 'Align team understanding', 'チームの理解を調整', 0]
['Budget Cut', '予算削減', null, '<p>Your project budget was cut...</p>', '<p>プロジェクト予算が削減...</p>', 4, 'Prioritize with constraints', '制約下での優先順位付け', 0]
['Resignation & Forced Dual Role', '退職＆強制兼任', null, '<p><strong>SPECIAL MISSION...</p>', '<p><strong>特別ミッション...</p>', 1, 'Execute resignation', '退職と職種移譲を実行', 1]
```

---

## 6. API仕様

### 6.1 認証API

#### POST /api/auth/login
**リクエスト**:
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**レスポンス（成功）**:
```json
{
  "ok": true,
  "token": "uuid-v4-token",
  "expiresIn": 86400000
}
```

**レスポンス（失敗）**:
```json
{
  "ok": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid credentials"
  }
}
```

---

#### POST /api/auth/logout
**ヘッダー**:
```
Authorization: Bearer <token>
```

**レスポンス**:
```json
{
  "ok": true
}
```

---

### 6.2 カードAPI

#### GET /api/cards/jobs
**レスポンス**:
```json
[
  {
    "id": 1,
    "name_en": "Software Engineer",
    "name_ja": "ソフトウェアエンジニア",
    "imageUrl": null,
    "descriptionHtml_en": "<p>...</p>",
    "descriptionHtml_ja": "<p>...</p>",
    "targetPoints": 5
  }
]
```

**重要**: 配列を直接返す（`{ ok: true, data: [...] }` ではない）

---

#### GET /api/cards/skills
**レスポンス**: 配列

#### GET /api/cards/missions
**レスポンス**: 配列

#### GET /api/categories
**レスポンス**: 配列

---

### 6.3 管理API（認証必須）

#### POST /api/admin/jobs
**ヘッダー**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**リクエスト**:
```json
{
  "name_en": "DevOps Engineer",
  "name_ja": "DevOpsエンジニア",
  "imageUrl": "data:image/jpeg;base64,...",
  "descriptionHtml_en": "<p>...</p>",
  "descriptionHtml_ja": "<p>...</p>",
  "targetPoints": 5
}
```

**レスポンス**:
```json
{
  "ok": true,
  "id": 5
}
```

---

#### PUT /api/admin/jobs/:id
**ヘッダー**: Bearer Token  
**リクエスト**: 同上

#### DELETE /api/admin/jobs/:id
**ヘッダー**: Bearer Token

同様のエンドポイント:
- `/api/admin/skills`
- `/api/admin/missions`
- `/api/admin/categories`

---

### 6.4 多言語API

#### GET /api/lang/:lang
**例**: `/api/lang/ja` または `/api/lang/en`

**レスポンス**:
```json
{
  "ok": true,
  "translations": {
    "common": {
      "language": "言語",
      "save": "保存",
      ...
    },
    "game": {
      "title": "職種 × スキル カードゲーム",
      ...
    },
    "admin": {
      "loginTitle": "管理者ログイン",
      ...
    },
    "errors": {
      "UNAUTHORIZED": "認証が必要です",
      ...
    }
  }
}
```

---

## 7. WebSocketイベント

### 7.1 セッション管理

#### createSession
**送信**:
```javascript
{
  type: 'createSession',
  playerName: 'Player1',
  maxPlayers: 4
}
```

**受信**:
```javascript
{
  type: 'sessionCreated',
  sessionId: 'abc123',
  playerId: 1,
  session: { ... }
}
```

---

#### joinSession
**送信**:
```javascript
{
  type: 'joinSession',
  sessionId: 'abc123',
  playerName: 'Player2'
}
```

**受信**:
```javascript
{
  type: 'joinedSession',
  sessionId: 'abc123',
  playerId: 2,
  session: { ... }
}
```

---

### 7.2 ゲームプレイ

#### selectJob
**送信**:
```javascript
{
  type: 'selectJob',
  sessionId: 'abc123',
  playerId: 1,
  jobId: 1
}
```

**受信（ブロードキャスト）**:
```javascript
{
  type: 'jobSelected',
  playerId: 1,
  jobId: 1,
  session: { ... }
}
```

---

#### startGame
**送信**:
```javascript
{
  type: 'startGame',
  sessionId: 'abc123'
}
```

**受信（ブロードキャスト）**:
```javascript
{
  type: 'gameStarted',
  session: { ... }
}
```

---

#### rollDice
**送信**:
```javascript
{
  type: 'rollDice',
  sessionId: 'abc123'
}
```

**受信（ブロードキャスト）**:
```javascript
{
  type: 'diceRolled',
  diceValue: 5,
  drawnCards: [ ... ],
  session: { ... }
}
```

---

#### selectCard
**送信**:
```javascript
{
  type: 'selectCard',
  sessionId: 'abc123',
  cardId: 3
}
```

**受信（選択者のみ）**:
```javascript
{
  type: 'cardSelected',
  card: { ... },
  matched: true,
  alreadySelected: false,
  pointsUpdated: { 1: 3 },
  winner: null,
  session: { ... }
}
```

**受信（他プレイヤー）**:
```javascript
{
  type: 'cardSelectedByOther',
  playerId: 1,
  cardType: 'skill',
  session: { ... }
}
```

---

#### nextTurn
**送信**:
```javascript
{
  type: 'nextTurn',
  sessionId: 'abc123'
}
```

**受信（ブロードキャスト）**:
```javascript
{
  type: 'turnChanged',
  currentPlayerIndex: 1,
  currentPlayer: { ... },
  session: { ... }
}
```

---

#### resign
**送信**:
```javascript
{
  type: 'resign',
  sessionId: 'abc123',
  playerId: 1,
  targetPlayerId: 2
}
```

**受信（ブロードキャスト）**:
```javascript
{
  type: 'playerRetired',
  retiredPlayerId: 1,
  targetPlayerId: 2,
  session: { ... }
}
```

---

#### resetGame
**送信**:
```javascript
{
  type: 'resetGame',
  sessionId: 'abc123'
}
```

**受信（ブロードキャスト）**:
```javascript
{
  type: 'gameReset',
  session: { ... }
}
```

---

## 8. ゲームフロー

### 8.1 ロビー画面（職種選択）

1. プレイヤーがゲームに参加
2. **各プレイヤーが職種カードを選択**（必須）
3. 他プレイヤーが選択済みの職種は選択不可
4. 全員が選択完了後、ホストが「ゲーム開始」

---

### 8.2 ゲーム画面

1. **サイコロを振る**（自ターンのみ）
2. **出目の数だけカードを抽選**（重複なし）
3. **カードを1枚選択**
   - スキルカード → 職種とマッチで +1pt（初回のみ）
   - ミッションカード → チームで議論
   - 特殊ミッション → 即時処理
4. **「次のターンへ」ボタン**
5. 目標ポイント達成で勝利

---

### 8.3 勝利条件

```javascript
// 兼任していない場合
points[jobId] >= targetPoints

// 兼任している場合（複数職種）
points[jobId1] >= targetPoints1 && points[jobId2] >= targetPoints2
```

---

## 9. 多言語対応

### 9.1 言語ファイル構造

**場所**: `/lang/en.json`, `/lang/ja.json`

```json
{
  "common": {
    "language": "Language",
    "save": "Save",
    "cancel": "Cancel",
    ...
  },
  "game": {
    "title": "Career × Skills Card Game",
    "createGame": "Create New Game",
    ...
  },
  "admin": {
    "loginTitle": "Admin Login",
    ...
  },
  "errors": {
    "UNAUTHORIZED": "Unauthorized access",
    ...
  }
}
```

---

### 9.2 I18nクラス

```javascript
class I18n {
    constructor() {
        this.currentLang = localStorage.getItem('language') || 
                          (navigator.language.startsWith('ja') ? 'ja' : 'en');
        this.translations = {};
    }

    async init() {
        await this.loadTranslations(this.currentLang);
    }

    async loadTranslations(lang) {
        const response = await fetch(`/api/lang/${lang}`);
        const data = await response.json();
        if (data.ok) {
            this.translations = data.translations;
            this.currentLang = lang;
            localStorage.setItem('language', lang);
        }
    }

    t(key) {
        const keys = key.split('.');
        let value = this.translations;
        for (const k of keys) {
            value = value?.[k];
        }
        return value || key;
    }

    async setLanguage(lang) {
        await this.loadTranslations(lang);
        // UIを再レンダリング
    }
}
```

---

### 9.3 使用例

```javascript
// 初期化
const i18n = new I18n();
await i18n.init();

// 翻訳取得
i18n.t('game.title');  // "Career × Skills Card Game"
i18n.t('game.rollDice');  // "Roll Dice"

// 言語切り替え
await i18n.setLanguage('ja');
i18n.t('game.title');  // "職種 × スキル カードゲーム"
```

---

## 10. 管理画面

### 10.1 機能一覧

- ✅ ログイン認証（トークンベース）
- ✅ 統計情報表示（カード数）
- ✅ 職種カード管理（追加・編集・削除）
- ✅ スキルカード管理（追加・編集・削除）
- ✅ ミッションカード管理（追加・編集・削除）
- ✅ カテゴリ管理（追加・編集・削除）
- ✅ 画像アップロード（Base64形式）
- ✅ 多言語編集（英語・日本語）
- ✅ 多言語UI（言語切り替え）

---

### 10.2 画像アップロード仕様

#### フロー
1. ファイル選択（`<input type="file">`）
2. FileReaderでBase64読み込み
3. Canvasで最大800x800pxにリサイズ
4. JPEG品質75%で圧縮
5. Base64文字列をimageUrl列に保存

#### コード例
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
            const base64 = canvas.toDataURL('image/jpeg', 0.75);
            document.getElementById(targetInputId).value = base64;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}
```

---

## 11. 認証システム

### 11.1 環境変数設定

**ファイル**: `.env`

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

**デフォルト値**（.envがない場合）:
```javascript
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
```

---

### 11.2 トークン管理

#### サーバー側
```javascript
const adminTokens = new Map(); // Map<token, { username, expiry }>

// ログイン時
const token = uuidv4();
const expiry = Date.now() + TOKEN_EXPIRY;
adminTokens.set(token, { username, expiry });
```

#### クライアント側
```javascript
// ログイン成功時
localStorage.setItem('admin_token', token);

// API呼び出し時
const token = localStorage.getItem('admin_token');
fetch('/api/admin/jobs', {
    headers: {
        'Authorization': `Bearer ${token}`
    }
});
```

---

### 11.3 認証ミドルウェア

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
    
    if (Date.now() > tokenData.expiry) {
        adminTokens.delete(token);
        return res.status(401).json({ 
            ok: false, 
            error: { code: 'UNAUTHORIZED', message: 'Token expired' }
        });
    }
    
    req.user = tokenData.username;
    next();
}
```

---

## 12. UI/UX仕様

### 12.1 カラースキーム

```css
:root {
    --primary: #2563eb;
    --primary-dark: #1e40af;
    --secondary: #f59e0b;
    --success: #10b981;
    --danger: #ef4444;
    --bg-dark: #0f172a;
    --bg-card: #1e293b;
    --bg-hover: #334155;
    --text-primary: #f1f5f9;
    --text-secondary: #94a3b8;
    --border: #334155;
    --card-job: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --card-skill: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    --card-mission: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    --card-special: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}
```

---

### 12.2 カード表示UI

#### シンプル2エリア構造
```html
<div class="simple-card">
    <div class="simple-card-main" onclick="selectCard(card)">
        <!-- カード名または説明文 -->
    </div>
    <div class="simple-card-footer" onclick="flipCard(cardId)">
        詳細を見る →
    </div>
</div>
```

#### 説明文
```
カード中央をクリックで選択 | 下部をクリックで詳細表示
```

---

### 12.3 レスポンシブデザイン

```css
@media (max-width: 768px) {
    .cards-grid {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    }
}
```

---

## 13. ファイル構成

```
career-card-game/
├── .env                    # 環境変数（Gitに含まれない）
├── .env.example            # 環境変数のサンプル
├── .gitignore              # Git除外設定
├── package.json            # 依存関係
├── server.js               # WebSocketサーバー + API
├── index.html              # ゲーム画面
├── admin.html              # 管理画面
├── initdb.js               # データベース初期化スクリプト
├── game.db                 # SQLiteデータベース（自動生成）
├── lang/
│   ├── en.json            # 英語翻訳
│   └── ja.json            # 日本語翻訳
├── README.md               # プロジェクト説明
├── QUICKSTART.md           # クイックスタート
├── RELEASE_NOTES.md        # リリースノート
└── TROUBLESHOOTING.md      # トラブルシューティング
```

---

## 14. セットアップ手順

### 14.1 インストール

```bash
# 1. 依存関係のインストール
npm install

# 2. 環境変数の設定（オプション）
cp .env.example .env
nano .env

# 3. データベース初期化（オプション）
npm run initdb

# 4. サーバー起動
npm start
```

---

### 14.2 アクセス

- **ゲーム画面**: http://localhost:3000
- **管理画面**: http://localhost:3000/admin.html

---

### 14.3 デフォルト認証情報

- **ユーザー名**: `admin`
- **パスワード**: `admin123`

---

## 15. 実装の重要ポイント

### 15.1 WebSocketのセッション管理

```javascript
const gameSessions = new Map(); // Map<sessionId, session>
const clients = new Map(); // Map<sessionId, Map<playerId, WebSocket>>

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
```

---

### 15.2 プレイヤー状態構造

```javascript
{
    id: 1,
    name: "Player1",
    jobs: [1],  // 職種IDの配列（兼任時は複数）
    points: { 1: 3 },  // { jobId: points }
    retired: false,
    jobSelected: true,
    selectedSkillCardIds: [1, 3, 5]  // 選択済みスキルカードID
}
```

---

### 15.3 セッション状態構造

```javascript
{
    id: "abc123",
    hostPlayerId: 1,
    players: [ ... ],
    maxPlayers: 4,
    currentPlayerIndex: 0,
    gameStarted: true,
    diceValue: 5,
    drawnCards: [ ... ],
    selectedCardsHistory: [
        {
            playerId: 1,
            playerName: "Player1",
            card: { ... },
            turnNumber: 1
        }
    ],
    usedCardIds: [1, 3, 5, 7]  // 使用済みカードID
}
```

---

### 15.4 カード抽選ロジック

```javascript
// 使用済みカードを除外
let availableCards = allCards.filter(card => 
    !session.usedCardIds.includes(card.id)
);

// カードが足りない場合は再利用
if (availableCards.length === 0) {
    console.log('No cards available, resetting usedCardIds');
    session.usedCardIds = [];
    availableCards = [...allCards];
}

// 10%の確率で特殊ミッション
if (specialMissions.length > 0 && Math.random() < 0.1) {
    const specialMission = specialMissions[0];
    if (!session.usedCardIds.includes(specialMission.id)) {
        availableCards.push({ ...specialMission, type: 'special' });
    }
}

// ランダムに抽選（重複なし）
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
```

---

### 15.5 スキルカード選択ロジック

```javascript
if (card.type === 'skill') {
    let matched = false;
    let alreadySelected = false;
    const newPoints = { ...currentPlayer.points };

    // 過去に選択済みかチェック
    if (currentPlayer.selectedSkillCardIds.includes(card.id)) {
        alreadySelected = true;
    } else {
        // 未選択の場合のみポイント加算
        currentPlayer.jobs.forEach(jobId => {
            if (card.matchesJobs && card.matchesJobs.includes(jobId)) {
                matched = true;
                newPoints[jobId] = (newPoints[jobId] || 0) + 1;
            }
        });

        // 選択済みリストに追加
        currentPlayer.selectedSkillCardIds.push(card.id);
    }

    currentPlayer.points = newPoints;
    
    // 選択者のみに結果を送信
    ws.send(JSON.stringify({
        type: 'cardSelected',
        card,
        matched,
        alreadySelected,
        pointsUpdated: newPoints,
        session
    }));

    // 他プレイヤーには状態更新のみ
    broadcast(sessionId, {
        type: 'cardSelectedByOther',
        playerId: currentPlayer.id,
        cardType: 'skill',
        session
    }, currentPlayer.id);
}
```

---

### 15.6 勝利判定

```javascript
db.all('SELECT * FROM job_cards', (err, jobCards) => {
    let hasWon = true;
    currentPlayer.jobs.forEach(jobId => {
        const job = jobCards.find(j => j.id === jobId);
        if (job && (currentPlayer.points[jobId] || 0) < job.targetPoints) {
            hasWon = false;
        }
    });

    if (hasWon && currentPlayer.jobs.length > 0) {
        result.winner = currentPlayer;
    }
});
```

---

### 15.7 デバッグログ

#### サーバー起動時
```javascript
console.log('=================================');
console.log('🚀 Server Started');
console.log('=================================');
console.log(`Server running on http://localhost:${PORT}`);
console.log('');
console.log('📝 Admin Credentials:');
console.log(`   Username: ${ADMIN_USERNAME}`);
console.log(`   Password: ${ADMIN_PASSWORD}`);
console.log('=================================');
console.log('📊 Database status:');
console.log(`   Job cards: ${count}`);
```

#### ログイン試行時
```javascript
console.log('=== LOGIN ATTEMPT ===');
console.log('Received username:', username);
console.log('Expected username:', ADMIN_USERNAME);
console.log('Username match:', username === ADMIN_USERNAME);
console.log('Password match:', password === ADMIN_PASSWORD);
console.log('====================');
```

#### API呼び出し時
```javascript
console.log(`📤 API: Sending ${rows.length} job cards`);
```

---

## 16. トラブルシューティング

### 16.1 ポート3000が使用中

```bash
PORT=8080 npm start
```

---

### 16.2 データベースをリセット

```bash
# Windowsの場合
del game.db
npm run initdb

# Mac/Linuxの場合
rm game.db
npm run initdb
```

---

### 16.3 管理画面にログインできない

1. サーバーコンソールで認証情報を確認
2. ログイン試行時のデバッグログを確認
3. ブラウザのキャッシュをクリア（Ctrl+Shift+Delete）

---

### 16.4 カード数が0と表示される

1. サーバーログで「Database status」を確認
2. ブラウザのキャッシュをクリア
3. データベースを再初期化

---

## 17. 今後の拡張案

- [ ] プレイヤーアバター機能
- [ ] チャット機能
- [ ] ゲーム履歴保存
- [ ] ランキング機能
- [ ] カスタムカード作成
- [ ] サウンドエフェクト
- [ ] アニメーション強化
- [ ] モバイルアプリ化

---

## 18. ライセンス

MIT License

---

**仕様書バージョン**: 3.0  
**最終更新日**: 2026-01-30  
**実装状況**: ✅ 完全動作確認済み  
**Claude再現性**: ✅ この仕様書で同等のシステムを再現可能

---

# 📝 実装チェックリスト

この仕様書をClaudeに渡す際、以下を確認してください：

## フロントエンド
- [ ] index.html - ゲーム画面
- [ ] admin.html - 管理画面
- [ ] I18nクラス - 多言語対応
- [ ] WebSocket接続 - リアルタイム通信
- [ ] カード表示 - シンプル2エリア構造

## バックエンド
- [ ] server.js - Express + WebSocket
- [ ] データベース初期化 - SQLite
- [ ] 認証システム - トークンベース
- [ ] API実装 - 配列を直接返す
- [ ] セッション管理 - Map構造

## データベース
- [ ] mission_categories
- [ ] job_cards
- [ ] skill_cards
- [ ] missions

## 多言語
- [ ] lang/en.json
- [ ] lang/ja.json
- [ ] APIエンドポイント /api/lang/:lang

## ゲームロジック
- [ ] 職種選択（重複防止）
- [ ] サイコロ
- [ ] カード抽選（重複防止）
- [ ] スキルカード再選択防止
- [ ] カード在庫再利用
- [ ] 勝利判定
- [ ] 特殊ミッション

## デバッグ
- [ ] サーバー起動時ログ
- [ ] ログイン試行時ログ
- [ ] API呼び出し時ログ
- [ ] データベース状態ログ

---

**この仕様書があれば、Claudeは同等のシステムを完全に再現できます。** ✅
