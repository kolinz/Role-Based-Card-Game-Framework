# 職種×スキル カードゲーム - 完全実装仕様書 v1.2.1

**プロジェクト名**: Role Based Card Game Framework  
**バージョン**: 1.2.1  
**最終更新**: 2026-06-13  
**実装状況**: ✅ 本番運用可能

---

## 📋 変更履歴

| バージョン | 日付 | 主な変更内容 |
|---|---|---|
| 1.1 | 2026-02-05 | 初版リリース |
| 1.2 | 2026-06-13 | カード階層の再設計、`job_cards` → `category_cards`、`skill_types` テーブル追加、API・WebSocket・i18nキー更新 |
| 1.2.1 | 2026-06-13 | Node.js 20 → **Node.js 24** へ更新、`sqlite3` → **`better-sqlite3 ^12.8.0`** へ移行（同期API化）|

### v1.2 → v1.2.1 の変更点

| 変更箇所 | v1.2 | v1.2.1 |
|---|---|---|
| Node.js 要件 | 20以上 | **24以上**（Node.js 20はEOL） |
| DBライブラリ | `sqlite3 ^5.1.6`（非同期コールバック） | **`better-sqlite3 ^12.8.0`**（同期API） |
| DB接続 | `new sqlite3.Database(path, cb)` | `new Database(path)` |
| クエリ実行 | `db.all/run/get(sql, params, cb)` コールバック | `stmt.all/run/get(params)` 同期呼び出し |
| ネストコールバック | handleRollDice・handleSelectCardで多段ネスト | フラットな同期コードに変更 |
| エラーハンドリング | コールバック引数の `err` | `try/catch` による同期例外捕捉 |
| initdb.js | `db.serialize()` + コールバック | 同期的な順次実行に変更 |

> **better-sqlite3 の利点**: 同期APIなので非同期コールバックのネストが不要になり、コードが大幅にシンプルになる。Node.js 24 の ES2023+ 環境で安定動作する。

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

本ゲームのカード体系は管理・組織論の理論モデルに基づく3階層で構成される。スキル区分（中分類）は特定の理論に固定せず、管理画面から任意のモデル名を登録できる。

```
カテゴリ（大分類）     ← 職種（SE、PM、QA Engineer など）
    └── スキル区分（中分類）← 任意の理論モデルによる分類（Katz、Drucker など）
            └── スキル（小分類）← 個別スキルカード
```

- **カテゴリ**: ゲームにおける「職種」。プレイヤーはここから自分の担当職種を選択する。`category_cards` テーブルで管理。
- **スキル区分**: スキルカードを束ねる中間分類。`skill_types` テーブルで管理。`model_type` フィールドは自由記述（例: `'katz'`、`'drucker'`、`'custom'`）で、Katz・Drucker以外のモデルにも対応できる。
- **スキル**: プレイヤーが実際に選択するカード。`matchesCategories` でどの職種にマッチするかを定義する。

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
- **Node.js 24以上**（Node.js 20はEOLのため非対応）
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
│   Node.js 24    │
│   Express       │
│   WebSocket     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   SQLite DB     │
│  (better-sqlite3)│
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
   イベント受信         better-sqlite3（同期）
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
  "version": "1.2.1",
  "description": "Online multiplayer career and skills card game",
  "main": "server.js",
  "engines": {
    "node": ">=24"
  },
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
```

**依存関係の役割**:
- **express**: HTTPサーバー + REST API
- **ws**: WebSocketサーバー（リアルタイム通信）
- **better-sqlite3**: データベース（同期API、高速・シンプル）
- **uuid**: セッションID・プレイヤーID生成
- **dotenv**: 環境変数管理（認証情報）

### 3.2 better-sqlite3 API早見表

v1.2.1では `sqlite3`（非同期）から `better-sqlite3`（同期）へ移行した。APIの対応関係は以下の通り。

| 操作 | sqlite3（旧） | better-sqlite3（新） |
|---|---|---|
| DB接続 | `new sqlite3.Database(path, cb)` | `const db = new Database(path)` |
| 全件取得 | `db.all(sql, params, (err, rows) => {})` | `db.prepare(sql).all(params)` |
| 1件取得 | `db.get(sql, params, (err, row) => {})` | `db.prepare(sql).get(params)` |
| 実行 | `db.run(sql, params, function(err) {})` | `db.prepare(sql).run(params)` → `result.lastInsertRowid` |
| lastInsertRowid | `this.lastID` | `result.lastInsertRowid` |
| エラー処理 | コールバック引数 `err` | `try/catch` |
| トランザクション | ネストしたコールバック | `db.transaction(fn)()` |

### 3.3 フロントエンド

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

| テーブル名 | 役割 | v1.2からの変更 |
|---|---|---|
| `mission_categories` | ミッションカテゴリ | 変更なし |
| `category_cards` | 職種カード（大分類） | 変更なし |
| `skill_types` | スキル区分（中分類） | 変更なし |
| `skill_cards` | スキルカード（小分類） | 変更なし |
| `missions` | ミッションカード | 変更なし |

テーブル定義・データ内容は v1.2 と同一。変更はライブラリとアクセス方法のみ。

### 4.2 テーブル定義

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

**サンプルデータ（4件）**:
```javascript
['Crisis Management',   '危機管理',         'Handling unexpected issues',  '予期せぬ問題への対応', 1],
['Decision Making',     '意思決定',         'Making strategic choices',    '戦略的な選択',       2],
['Communication',       'コミュニケーション', 'Team coordination',           'チーム調整',         3],
['Resource Management', 'リソース管理',      'Budget and time management',  '予算と時間管理',     4]
```

#### category_cards（職種カード ＝ カテゴリ大分類）

```sql
CREATE TABLE category_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL,
    name_ja TEXT NOT NULL,
    imageUrl TEXT,
    descriptionHtml_en TEXT,
    descriptionHtml_ja TEXT,
    targetPoints INTEGER NOT NULL
);
```

**サンプルデータ（6件）**:
```javascript
['Engineer',       'エンジニア',             null, '<ul><li>プログラミング</li></ul>', '<ul><li>Programming</li></ul>', 4],
['Designer',       'デザイナー',             null, '<ul><li>UIデザイン</li></ul>',    '<ul><li>UI Design</li></ul>',   4],
['Project Manager','プロジェクトマネージャー', null, '<ul><li>計画立案</li></ul>',     '<ul><li>Planning</li></ul>',    5],
['QA Engineer',    'QAエンジニア',           null, '<ul><li>品質管理</li></ul>',     '<ul><li>Quality</li></ul>',     3],
['DevOps Engineer','DevOpsエンジニア',       null, '<ul><li>インフラ</li></ul>',     '<ul><li>Infrastructure</li></ul>', 4],
['Data Analyst',   'データアナリスト',        null, '<ul><li>データ分析</li></ul>',   '<ul><li>Data Analysis</li></ul>',  4]
```

#### skill_types（スキル区分 ＝ 中分類）

```sql
CREATE TABLE skill_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL,
    name_ja TEXT NOT NULL,
    model_type TEXT NOT NULL DEFAULT 'katz',
    -- 自由記述。'katz', 'drucker', 'custom' など。特定の値に制限しない。
    description_en TEXT,
    description_ja TEXT,
    sortOrder INTEGER DEFAULT 0
);
```

**Katzモデルのサンプルデータ（3件）**:
```javascript
['Technical Skill',  'テクニカルスキル',    'katz', 'Operational and technical expertise',    '業務・技術的専門知識',       1],
['Human Skill',      'ヒューマンスキル',    'katz', 'Interpersonal and communication skills', '対人・コミュニケーション能力', 2],
['Conceptual Skill', 'コンセプチュアルスキル','katz', 'Strategic and abstract thinking',       '概念的・戦略的思考力',       3]
```

#### skill_cards（スキルカード ＝ 小分類）

```sql
CREATE TABLE skill_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL,
    name_ja TEXT NOT NULL,
    imageUrl TEXT,
    descriptionHtml_en TEXT,
    descriptionHtml_ja TEXT,
    matchesCategories TEXT   -- カンマ区切りの職種ID "1,3,5"
);
```

**matchesCategoriesの処理**（v1.2.1: better-sqlite3 同期API版）:
```javascript
// handleRollDice内: DBから取得後に配列変換
const skillCards = db.prepare('SELECT * FROM skill_cards').all();
const cards = skillCards.map(c => ({
    ...c,
    type: 'skill',
    matchesCategories: c.matchesCategories
        ? c.matchesCategories.split(',').map(Number)
        : []
}));

// handleSelectCard内: マッチング判定
currentPlayer.categories.forEach(categoryId => {
    if (card.matchesCategories && card.matchesCategories.includes(categoryId)) {
        matched = true;
        newPoints[categoryId] = (newPoints[categoryId] || 0) + 1;
    }
});
```

**サンプルデータ（23件）**:
```javascript
// テクニカルスキル（8件）
['Programming',        'プログラミング',    null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '1,4,5'],
['Testing',            'テスト',           null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '1,4'],
['Infrastructure',     'インフラ構築',      null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '1,5'],
['Database Design',    'DB設計',           null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '1,6'],
['UI Design',          'UIデザイン',        null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '2'],
['Security',           'セキュリティ',      null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '1,5'],
['Data Analysis',      'データ分析',        null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '6'],
['CI/CD',              'CI/CD',            null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '5'],
// ヒューマンスキル（8件）
['Communication',      'コミュニケーション', null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '1,2,3,4,5,6'],
['Leadership',         'リーダーシップ',    null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '3'],
['Collaboration',      'チームワーク',      null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '1,2,3,4,5,6'],
['Presentation',       'プレゼン',          null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '2,3,6'],
['Negotiation',        '交渉力',            null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '3'],
['Coaching',           'コーチング',        null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '3'],
['Customer Relations', '顧客対応',          null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '2,3'],
['Documentation',      'ドキュメント作成',  null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '1,2,3,4,5,6'],
// コンセプチュアルスキル（7件）
['Problem Solving',    '問題解決',          null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '1,2,3,4,5,6'],
['Strategic Thinking', '戦略的思考',        null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '3,6'],
['Risk Management',    'リスク管理',        null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '3,4,5'],
['Innovation',         '革新',              null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '2,3'],
['Systems Thinking',   'システム思考',      null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '1,5,6'],
['Decision Making',    '意思決定',          null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '3,6'],
['Vision Setting',     'ビジョン設定',      null, '<ul><li>...</li></ul>', '<ul><li>...</li></ul>', '3']
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
    target_en TEXT,
    target_ja TEXT,
    isSpecial INTEGER DEFAULT 0,
    FOREIGN KEY(categoryId) REFERENCES mission_categories(id)
);
```

**isSpecial=1の特殊ミッション（1件）**: 退職＆強制兼任。出現確率10%。

**通常ミッションサンプル（39件）**: 各カテゴリから概ね均等（約10件ずつ）に割り当て。`target_en/ja` は `"Individual"/"個人"` または `"Team"/"チーム"`。

### 4.3 データベース初期化（initdb.js）

v1.2.1: `better-sqlite3` の同期APIを使用。`db.serialize()` 不要。

```javascript
import fs from 'fs';
import Database from 'better-sqlite3';

if (fs.existsSync('./game.db')) fs.unlinkSync('./game.db');

const db = new Database('./game.db');

// WALモードを有効化（同時読み書き性能向上）
db.pragma('journal_mode = WAL');

// トランザクションで一括挿入（同期・高速）
const init = db.transaction(() => {

    // テーブル作成
    db.exec(`
        CREATE TABLE mission_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name_en TEXT NOT NULL, name_ja TEXT NOT NULL,
            description_en TEXT, description_ja TEXT,
            sortOrder INTEGER DEFAULT 0
        );
        CREATE TABLE category_cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name_en TEXT NOT NULL, name_ja TEXT NOT NULL,
            imageUrl TEXT, descriptionHtml_en TEXT, descriptionHtml_ja TEXT,
            targetPoints INTEGER NOT NULL
        );
        CREATE TABLE skill_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name_en TEXT NOT NULL, name_ja TEXT NOT NULL,
            model_type TEXT NOT NULL DEFAULT 'katz',
            description_en TEXT, description_ja TEXT,
            sortOrder INTEGER DEFAULT 0
        );
        CREATE TABLE skill_cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name_en TEXT NOT NULL, name_ja TEXT NOT NULL,
            imageUrl TEXT, descriptionHtml_en TEXT, descriptionHtml_ja TEXT,
            matchesCategories TEXT
        );
        CREATE TABLE missions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name_en TEXT, name_ja TEXT, imageUrl TEXT,
            descriptionHtml_en TEXT NOT NULL, descriptionHtml_ja TEXT NOT NULL,
            categoryId INTEGER, target_en TEXT, target_ja TEXT,
            isSpecial INTEGER DEFAULT 0,
            FOREIGN KEY(categoryId) REFERENCES mission_categories(id)
        );
    `);

    // mission_categories（4件）
    const insertMC = db.prepare(
        'INSERT INTO mission_categories (name_en, name_ja, description_en, description_ja, sortOrder) VALUES (?, ?, ?, ?, ?)'
    );
    [
        ['Crisis Management',   '危機管理',         'Handling unexpected issues',  '予期せぬ問題への対応', 1],
        ['Decision Making',     '意思決定',         'Making strategic choices',    '戦略的な選択',       2],
        ['Communication',       'コミュニケーション', 'Team coordination',           'チーム調整',         3],
        ['Resource Management', 'リソース管理',      'Budget and time management',  '予算と時間管理',     4],
    ].forEach(row => insertMC.run(row));

    // category_cards（6件）
    const insertCC = db.prepare(
        'INSERT INTO category_cards (name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints) VALUES (?, ?, ?, ?, ?, ?)'
    );
    [
        ['Engineer',        'エンジニア',             null, '<ul><li>プログラミング・設計・実装を担当</li></ul>', '<ul><li>Responsible for programming, design, and implementation</li></ul>', 4],
        ['Designer',        'デザイナー',             null, '<ul><li>UI/UXデザイン・ビジュアル表現を担当</li></ul>', '<ul><li>Responsible for UI/UX design and visual communication</li></ul>', 4],
        ['Project Manager', 'プロジェクトマネージャー', null, '<ul><li>計画立案・進捗管理・チーム調整を担当</li></ul>', '<ul><li>Responsible for planning, progress management, and team coordination</li></ul>', 5],
        ['QA Engineer',     'QAエンジニア',           null, '<ul><li>品質保証・テスト設計・バグ管理を担当</li></ul>', '<ul><li>Responsible for quality assurance, test design, and bug management</li></ul>', 3],
        ['DevOps Engineer', 'DevOpsエンジニア',       null, '<ul><li>インフラ構築・CI/CD・運用自動化を担当</li></ul>', '<ul><li>Responsible for infrastructure, CI/CD, and operations automation</li></ul>', 4],
        ['Data Analyst',    'データアナリスト',        null, '<ul><li>データ収集・分析・インサイト提供を担当</li></ul>', '<ul><li>Responsible for data collection, analysis, and insights</li></ul>', 4],
    ].forEach(row => insertCC.run(row));

    // skill_types（3件: Katzモデル）
    const insertST = db.prepare(
        'INSERT INTO skill_types (name_en, name_ja, model_type, description_en, description_ja, sortOrder) VALUES (?, ?, ?, ?, ?, ?)'
    );
    [
        ['Technical Skill',  'テクニカルスキル',    'katz', 'Operational and technical expertise',    '業務・技術的専門知識',       1],
        ['Human Skill',      'ヒューマンスキル',    'katz', 'Interpersonal and communication skills', '対人・コミュニケーション能力', 2],
        ['Conceptual Skill', 'コンセプチュアルスキル','katz', 'Strategic and abstract thinking',       '概念的・戦略的思考力',       3],
    ].forEach(row => insertST.run(row));

    // skill_cards（23件）
    const insertSC = db.prepare(
        'INSERT INTO skill_cards (name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesCategories) VALUES (?, ?, ?, ?, ?, ?)'
    );
    [
        // テクニカルスキル
        ['Programming',        'プログラミング',    null, '<ul><li>コードを書いてシステムを構築するスキル</li></ul>', '<ul><li>Skill to build systems by writing code</li></ul>', '1,4,5'],
        ['Testing',            'テスト',           null, '<ul><li>品質を検証するスキル</li></ul>', '<ul><li>Skill to verify quality</li></ul>', '1,4'],
        ['Infrastructure',     'インフラ構築',      null, '<ul><li>サーバーやネットワークを構築するスキル</li></ul>', '<ul><li>Skill to build servers and networks</li></ul>', '1,5'],
        ['Database Design',    'DB設計',           null, '<ul><li>データを効率よく管理するスキル</li></ul>', '<ul><li>Skill to manage data efficiently</li></ul>', '1,6'],
        ['UI Design',          'UIデザイン',        null, '<ul><li>使いやすい画面を設計するスキル</li></ul>', '<ul><li>Skill to design user-friendly interfaces</li></ul>', '2'],
        ['Security',           'セキュリティ',      null, '<ul><li>システムを脅威から守るスキル</li></ul>', '<ul><li>Skill to protect systems from threats</li></ul>', '1,5'],
        ['Data Analysis',      'データ分析',        null, '<ul><li>データから洞察を得るスキル</li></ul>', '<ul><li>Skill to extract insights from data</li></ul>', '6'],
        ['CI/CD',              'CI/CD',            null, '<ul><li>継続的インテグレーション・デリバリーのスキル</li></ul>', '<ul><li>Continuous integration and delivery skills</li></ul>', '5'],
        // ヒューマンスキル
        ['Communication',      'コミュニケーション', null, '<ul><li>情報を正確に伝え合うスキル</li></ul>', '<ul><li>Skill to accurately exchange information</li></ul>', '1,2,3,4,5,6'],
        ['Leadership',         'リーダーシップ',    null, '<ul><li>チームを方向付け導くスキル</li></ul>', '<ul><li>Skill to guide and direct a team</li></ul>', '3'],
        ['Collaboration',      'チームワーク',      null, '<ul><li>チームで協力して成果を出すスキル</li></ul>', '<ul><li>Skill to collaborate and deliver results as a team</li></ul>', '1,2,3,4,5,6'],
        ['Presentation',       'プレゼン',          null, '<ul><li>考えを説得力を持って伝えるスキル</li></ul>', '<ul><li>Skill to communicate ideas persuasively</li></ul>', '2,3,6'],
        ['Negotiation',        '交渉力',            null, '<ul><li>合意形成を促すスキル</li></ul>', '<ul><li>Skill to facilitate agreement</li></ul>', '3'],
        ['Coaching',           'コーチング',        null, '<ul><li>メンバーの成長を支援するスキル</li></ul>', '<ul><li>Skill to support member growth</li></ul>', '3'],
        ['Customer Relations', '顧客対応',          null, '<ul><li>顧客との信頼関係を築くスキル</li></ul>', '<ul><li>Skill to build trust with customers</li></ul>', '2,3'],
        ['Documentation',      'ドキュメント作成',  null, '<ul><li>情報をわかりやすく文書化するスキル</li></ul>', '<ul><li>Skill to document information clearly</li></ul>', '1,2,3,4,5,6'],
        // コンセプチュアルスキル
        ['Problem Solving',    '問題解決',          null, '<ul><li>課題の本質を捉え解決策を導くスキル</li></ul>', '<ul><li>Skill to identify root causes and derive solutions</li></ul>', '1,2,3,4,5,6'],
        ['Strategic Thinking', '戦略的思考',        null, '<ul><li>長期視点で意思決定するスキル</li></ul>', '<ul><li>Skill to make decisions from a long-term perspective</li></ul>', '3,6'],
        ['Risk Management',    'リスク管理',        null, '<ul><li>リスクを予測し対策を取るスキル</li></ul>', '<ul><li>Skill to anticipate risks and take countermeasures</li></ul>', '3,4,5'],
        ['Innovation',         '革新',              null, '<ul><li>新しい価値を生み出すスキル</li></ul>', '<ul><li>Skill to create new value</li></ul>', '2,3'],
        ['Systems Thinking',   'システム思考',      null, '<ul><li>全体構造を俯瞰して考えるスキル</li></ul>', '<ul><li>Skill to think from a birds-eye view of the whole structure</li></ul>', '1,5,6'],
        ['Decision Making',    '意思決定',          null, '<ul><li>情報を基に適切な判断を下すスキル</li></ul>', '<ul><li>Skill to make appropriate judgments based on information</li></ul>', '3,6'],
        ['Vision Setting',     'ビジョン設定',      null, '<ul><li>組織の方向性を描くスキル</li></ul>', '<ul><li>Skill to define organizational direction</li></ul>', '3'],
    ].forEach(row => insertSC.run(row));

    // missions（40件: 通常39 + 特殊1）
    const insertM = db.prepare(
        'INSERT INTO missions (name_en, name_ja, descriptionHtml_en, descriptionHtml_ja, categoryId, target_en, target_ja, isSpecial) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    // 特殊ミッション（1件）
    insertM.run([
        'Resignation & Takeover', '退職＆強制兼任',
        '<p>A team member is leaving. Transfer all their responsibilities to another member.</p>',
        '<p>あるメンバーが退職することになりました。担当業務を他のメンバーに引き継いでください。</p>',
        null, 'Team', 'チーム', 1
    ]);
    // 通常ミッション（39件: categoryId 1〜4 から各約10件）
    const normalMissions = [
        // カテゴリ1: Crisis Management（10件）
        ['Handle a Server Outage', 'サーバー障害対応',          '<p>Critical system is down. Restore service within 30 minutes.</p>', '<p>本番サーバーがダウンしました。30分以内にサービスを復旧してください。</p>', 1, 'Team',       'チーム',  0],
        ['Data Breach Response',   'データ漏洩対応',            '<p>Customer data may be compromised. Assess and contain the situation.</p>', '<p>顧客データが漏洩した可能性があります。状況を把握し封じ込めてください。</p>', 1, 'Team',       'チーム',  0],
        ['Emergency Bug Fix',      '緊急バグ修正',              '<p>A critical bug is impacting all users. Fix it without a testing environment.</p>', '<p>重大なバグが全ユーザーに影響しています。テスト環境なしで修正してください。</p>', 1, 'Individual', '個人',    0],
        ['Sudden Scope Change',    '突然の仕様変更',            '<p>The client changed requirements 2 days before launch. Reprioritize immediately.</p>', '<p>リリース2日前に仕様変更が発生しました。即座に優先順位を見直してください。</p>', 1, 'Team',       'チーム',  0],
        ['Key Member Absent',      '主要メンバーの急欠',        '<p>A key engineer called in sick on release day. Cover their duties.</p>', '<p>リリース当日に主要エンジニアが欠席しました。業務を分担してカバーしてください。</p>', 1, 'Team',       'チーム',  0],
        ['Infrastructure Failure', 'インフラ障害',              '<p>The cloud provider is having an outage. Implement emergency measures.</p>', '<p>クラウドプロバイダーで障害が発生しています。緊急措置を講じてください。</p>', 1, 'Team',       'チーム',  0],
        ['Security Alert',         'セキュリティアラート',      '<p>An intrusion attempt has been detected. Respond and document actions.</p>', '<p>不正アクセスの試みが検出されました。対応し、記録してください。</p>', 1, 'Individual', '個人',    0],
        ['Network Outage',         'ネットワーク障害',          '<p>Internal network is down. Enable the team to work remotely.</p>', '<p>社内ネットワークが停止しました。チームがリモートで作業できるようにしてください。</p>', 1, 'Team',       'チーム',  0],
        ['DB Corruption',          'DB破損対応',                '<p>Database corruption is detected. Restore from backup and verify integrity.</p>', '<p>データベースの破損が検出されました。バックアップから復元し整合性を確認してください。</p>', 1, 'Team',       'チーム',  0],
        ['DDoS Attack',            'DDoS攻撃対応',              '<p>The system is under a DDoS attack. Protect the service and maintain uptime.</p>', '<p>DDoS攻撃を受けています。サービスを守り稼働を維持してください。</p>', 1, 'Team',       'チーム',  0],
        // カテゴリ2: Decision Making（10件）
        ['Tech Stack Choice',      '技術スタック選定',          '<p>Choose the framework for the next project. Present the rationale.</p>', '<p>次のプロジェクトのフレームワークを選定してください。理由を説明してください。</p>', 2, 'Team',       'チーム',  0],
        ['Build vs Buy',           '内製か購入か',              '<p>Should we build the feature in-house or buy a third-party tool?</p>', '<p>機能を内製すべきか、サードパーティのツールを購入すべきか決定してください。</p>', 2, 'Individual', '個人',    0],
        ['Release Timing',         'リリースタイミング決定',    '<p>Quality is not perfect. Decide whether to release now or delay.</p>', '<p>品質が完全ではありません。今すぐリリースするか延期するか決定してください。</p>', 2, 'Team',       'チーム',  0],
        ['Priority Conflict',      '優先度の衝突',              '<p>Business wants Feature A, engineering wants to refactor. Decide the priority.</p>', '<p>ビジネスはA機能を、開発はリファクタリングを望んでいます。優先度を決定してください。</p>', 2, 'Team',       'チーム',  0],
        ['Vendor Selection',       'ベンダー選定',              '<p>Select a vendor from three options. Justify your decision.</p>', '<p>3社のベンダーから1社を選定してください。理由を明確にしてください。</p>', 2, 'Team',       'チーム',  0],
        ['Budget Allocation',      '予算配分',                  '<p>Allocate the limited budget across four departments. Balance needs and impact.</p>', '<p>限られた予算を4部門に配分してください。ニーズとインパクトのバランスを考えてください。</p>', 2, 'Individual', '個人',    0],
        ['Sunset Product',         'プロダクト終了判断',        '<p>Usage is declining. Decide whether to continue, pivot, or sunset the product.</p>', '<p>利用者が減少しています。継続・ピボット・終了のいずれかを判断してください。</p>', 2, 'Team',       'チーム',  0],
        ['Hiring Decision',        '採用判断',                  '<p>Two candidates have different strengths. Make a hire decision and explain why.</p>', '<p>2人の候補者の強みが異なります。採用判断をして理由を説明してください。</p>', 2, 'Individual', '個人',    0],
        ['Remote vs Office',       'リモートvsオフィス',        '<p>Decide the work policy after the pandemic. Consider productivity and culture.</p>', '<p>パンデミック後の勤務方針を決定してください。生産性と文化を考慮してください。</p>', 2, 'Team',       'チーム',  0],
        ['OSS License',            'OSSライセンス選定',         '<p>Choose an appropriate open-source license for your new project.</p>', '<p>新しいプロジェクトに適切なオープンソースライセンスを選定してください。</p>', 2, 'Individual', '個人',    0],
        // カテゴリ3: Communication（10件）
        ['Stakeholder Update',     'ステークホルダー報告',      '<p>Explain the project delay to stakeholders. Be clear and solutions-focused.</p>', '<p>プロジェクトの遅延をステークホルダーに説明してください。明確に、解決策を中心に伝えてください。</p>', 3, 'Individual', '個人',    0],
        ['Cross Team Conflict',    'チーム間の対立解消',        '<p>Two teams have conflicting priorities. Facilitate a resolution.</p>', '<p>2つのチームが優先事項で対立しています。解決を促進してください。</p>', 3, 'Team',       'チーム',  0],
        ['Bad News Delivery',      '悪いニュースの伝え方',      '<p>You need to tell a client the deadline is missed. Deliver the news professionally.</p>', '<p>クライアントに納期遅延を伝えなければなりません。プロフェッショナルに伝えてください。</p>', 3, 'Individual', '個人',    0],
        ['Onboarding Plan',        'オンボーディング計画',      '<p>Design a one-week onboarding plan for a new engineer joining next week.</p>', '<p>来週入社する新エンジニアのための1週間のオンボーディング計画を設計してください。</p>', 3, 'Team',       'チーム',  0],
        ['Meeting Efficiency',     '会議の効率化',              '<p>Team meetings are too long and unproductive. Redesign the meeting format.</p>', '<p>チームの会議が長すぎて非生産的です。会議の形式を再設計してください。</p>', 3, 'Team',       'チーム',  0],
        ['Feedback Session',       'フィードバックセッション',  '<p>Give constructive feedback to a team member who missed expectations.</p>', '<p>期待に届かなかったチームメンバーに建設的なフィードバックを行ってください。</p>', 3, 'Individual', '個人',    0],
        ['Remote Team Cohesion',   'リモートチームの結束',      '<p>Remote team members feel disconnected. Plan activities to improve cohesion.</p>', '<p>リモートチームのメンバーが孤立感を感じています。結束を高める活動を計画してください。</p>', 3, 'Team',       'チーム',  0],
        ['Technical Explanation',  '技術説明',                  '<p>Explain a complex technical concept to a non-technical executive in 5 minutes.</p>', '<p>技術に詳しくない役員に複雑な技術コンセプトを5分で説明してください。</p>', 3, 'Individual', '個人',    0],
        ['Conflict Mediation',     '対立の調停',                '<p>Two engineers disagree on architecture. Mediate and reach a decision.</p>', '<p>2人のエンジニアがアーキテクチャについて対立しています。調停して決定を導いてください。</p>', 3, 'Team',       'チーム',  0],
        ['Sprint Retrospective',   'スプリント振り返り',        '<p>Facilitate a retrospective to identify what went well and what to improve.</p>', '<p>うまくいったこととの改善点を特定するための振り返りを進行してください。</p>', 3, 'Team',       'チーム',  0],
        // カテゴリ4: Resource Management（9件）
        ['Sprint Planning',        'スプリント計画',            '<p>Plan the next 2-week sprint. Allocate tasks based on capacity.</p>', '<p>次の2週間のスプリントを計画してください。キャパシティに基づいてタスクを割り当ててください。</p>', 4, 'Team',       'チーム',  0],
        ['Technical Debt',         '技術的負債の管理',          '<p>Technical debt is slowing the team. Plan how to address it alongside new features.</p>', '<p>技術的負債がチームの速度を低下させています。新機能と並行して対処する計画を立ててください。</p>', 4, 'Team',       'チーム',  0],
        ['Resource Shortage',      'リソース不足',              '<p>The team is understaffed. Prioritize and reassign work for the quarter.</p>', '<p>チームの人員が不足しています。四半期の業務を優先順位付けして再配分してください。</p>', 4, 'Individual', '個人',    0],
        ['Tool Evaluation',        'ツール評価',                '<p>Evaluate three project management tools and recommend one for the team.</p>', '<p>3つのプロジェクト管理ツールを評価して、チームに1つを推薦してください。</p>', 4, 'Individual', '個人',    0],
        ['Cost Optimization',      'コスト最適化',              '<p>Reduce cloud costs by 30% without degrading performance.</p>', '<p>パフォーマンスを低下させずにクラウドコストを30%削減してください。</p>', 4, 'Team',       'チーム',  0],
        ['Knowledge Transfer',     '知識移転',                  '<p>A senior engineer is leaving. Ensure knowledge is documented and transferred.</p>', '<p>シニアエンジニアが退職します。知識を文書化し移転を確保してください。</p>', 4, 'Team',       'チーム',  0],
        ['OKR Setting',            'OKR設定',                   '<p>Set OKRs for next quarter that align with company strategy.</p>', '<p>会社戦略に沿った来四半期のOKRを設定してください。</p>', 4, 'Team',       'チーム',  0],
        ['Capacity Planning',      'キャパシティ計画',          '<p>Plan team capacity for the next 6 months considering planned leave.</p>', '<p>計画的な休暇を考慮して、次の6ヶ月のチームキャパシティを計画してください。</p>', 4, 'Individual', '個人',    0],
        ['Process Improvement',    'プロセス改善',              '<p>The deployment process takes 4 hours. Reduce it to under 30 minutes.</p>', '<p>デプロイプロセスに4時間かかっています。30分以内に短縮してください。</p>', 4, 'Team',       'チーム',  0],
    ];
    normalMissions.forEach(row => insertM.run(row));
});

init();

console.log('Database initialized successfully!');
console.log('Tables: mission_categories(4), category_cards(6), skill_types(3), skill_cards(23), missions(40)');

db.close();
```

**重要**: 本番環境では初期化前にバックアップ必須。`npm run initdb` は全データを削除する。

### 4.4 v1.1 → v1.2.1 DBマイグレーション

既存データを保持したまま移行する場合（SQLite直接操作）:

```sql
-- 1. job_cards → category_cards にリネーム
ALTER TABLE job_cards RENAME TO category_cards;

-- 2. skill_cards.matchesJobs → matchesCategories にリネーム
CREATE TABLE skill_cards_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL, name_ja TEXT NOT NULL,
    imageUrl TEXT, descriptionHtml_en TEXT, descriptionHtml_ja TEXT,
    matchesCategories TEXT
);
INSERT INTO skill_cards_new
    SELECT id, name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesJobs
    FROM skill_cards;
DROP TABLE skill_cards;
ALTER TABLE skill_cards_new RENAME TO skill_cards;

-- 3. skill_types テーブルを新規作成
CREATE TABLE skill_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL, name_ja TEXT NOT NULL,
    model_type TEXT NOT NULL DEFAULT 'katz',
    description_en TEXT, description_ja TEXT,
    sortOrder INTEGER DEFAULT 0
);
INSERT INTO skill_types (name_en, name_ja, model_type, description_en, description_ja, sortOrder) VALUES
    ('Technical Skill',  'テクニカルスキル',    'katz', 'Operational and technical expertise',    '業務・技術的専門知識',       1),
    ('Human Skill',      'ヒューマンスキル',    'katz', 'Interpersonal and communication skills', '対人・コミュニケーション能力', 2),
    ('Conceptual Skill', 'コンセプチュアルスキル','katz', 'Strategic and abstract thinking',       '概念的・戦略的思考力',       3);

-- 4. WALモードを有効化
PRAGMA journal_mode = WAL;
```

---

## 5. サーバーサイド実装

### 5.1 server.js 構造

v1.2.1: `better-sqlite3` は同期APIなので、コールバックネストが完全になくなる。

```javascript
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

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// better-sqlite3: 同期接続、即座に使用可能
const db = new Database('./game.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const gameSessions = new Map();  // Map<sessionId, session>
const clients = new Map();       // Map<sessionId, Map<playerId, WebSocket>>
const adminTokens = new Map();   // Map<token, { username, expiry }>

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

function generateSessionId() {
    return uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
}
```

> **ESM について**: `better-sqlite3 ^12.8.0` + Node.js 24 では `import` 構文（ESM）を推奨。`package.json` に `"type": "module"` を追加すること。CommonJS (`require`) を使いたい場合は、`import` を `require`、`import.meta.url` の代わりに `__dirname` をそのまま使えばよい。

**package.json への追記**:
```json
{
  "type": "module"
}
```

### 5.2 ユーティリティ関数

```javascript
function broadcast(sessionId, message, excludePlayerId = null) {
    const sessionClients = clients.get(sessionId);
    if (!sessionClients) return;
    const payload = JSON.stringify(message);
    sessionClients.forEach((ws, playerId) => {
        if (playerId !== excludePlayerId && ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
        }
    });
}

function sendToPlayer(sessionId, playerId, message) {
    const ws = clients.get(sessionId)?.get(playerId);
    if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}
```

### 5.3 WebSocket 接続ハンドラ

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
                case 'createSession':   handleCreateSession(ws, data); break;
                case 'joinSession':     handleJoinSession(ws, data);   break;
                case 'selectCategory':  handleSelectCategory(ws, data); break;
                case 'startGame':       handleStartGame(ws, data);     break;
                case 'rollDice':        handleRollDice(ws, data);      break;
                case 'selectCard':      handleSelectCard(ws, data);    break;
                case 'nextTurn':        handleNextTurn(ws, data);      break;
                case 'resign':          handleResign(ws, data);        break;
                case 'resetGame':       handleResetGame(ws, data);     break;
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
            clients.get(currentSessionId)?.delete(currentPlayerId);
        }
    });
});
```

### 5.4 セッション作成・参加

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
            categories: [],
            points: {},
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
    };

    gameSessions.set(sessionId, session);
    if (!clients.has(sessionId)) clients.set(sessionId, new Map());
    clients.get(sessionId).set(playerId, ws);

    currentSessionId = sessionId;
    currentPlayerId = playerId;

    ws.send(JSON.stringify({ type: 'sessionCreated', sessionId, playerId, session }));
}

function handleJoinSession(ws, data) {
    const session = gameSessions.get(data.sessionId);

    if (!session) {
        ws.send(JSON.stringify({ type: 'error', error: { code: 'SESSION_NOT_FOUND' } }));
        return;
    }
    if (session.players.length >= session.maxPlayers) {
        ws.send(JSON.stringify({ type: 'error', error: { code: 'SESSION_FULL' } }));
        return;
    }
    if (session.gameStarted) {
        ws.send(JSON.stringify({ type: 'error', error: { code: 'GAME_ALREADY_STARTED' } }));
        return;
    }

    const playerId = uuidv4();
    session.players.push({
        id: playerId,
        name: data.playerName || `Player ${session.players.length + 1}`,
        categories: [],
        points: {},
        retired: false,
        categorySelected: false,
        selectedSkillCardIds: [],
        finished: false,
        finishRank: null
    });

    if (!clients.has(data.sessionId)) clients.set(data.sessionId, new Map());
    clients.get(data.sessionId).set(playerId, ws);

    currentSessionId = data.sessionId;
    currentPlayerId = playerId;

    ws.send(JSON.stringify({ type: 'sessionJoined', playerId, session }));
    broadcast(data.sessionId, { type: 'playerJoined', session }, playerId);
}
```

### 5.5 カテゴリ選択・ゲーム開始

```javascript
function handleSelectCategory(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;

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
        type: 'categorySelected',
        playerId: data.playerId,
        categoryId: data.categoryId,
        session
    });
}

function handleStartGame(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;

    if (data.playerId !== session.hostPlayerId) {
        ws.send(JSON.stringify({ type: 'error', error: { code: 'UNAUTHORIZED', message: 'Only host can start the game' } }));
        return;
    }

    if (!session.players.every(p => p.categorySelected)) {
        ws.send(JSON.stringify({ type: 'error', error: { code: 'NOT_READY', message: 'まだ職種未選択のプレイヤーがいます' } }));
        return;
    }

    session.gameStarted = true;
    broadcast(data.sessionId, { type: 'gameStarted', session });
}
```

### 5.6 サイコロ処理（カード抽選）

v1.2.1: コールバックネストが完全になくなり、フラットな同期コードになる。

```javascript
function handleRollDice(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;

    const diceValue = Math.floor(Math.random() * 6) + 1;
    session.diceValue = diceValue;

    // better-sqlite3: 同期でまとめて取得（ネストなし）
    const skillCards     = db.prepare('SELECT * FROM skill_cards').all();
    const regularMissions = db.prepare('SELECT * FROM missions WHERE isSpecial = 0').all();
    const specialMissions = db.prepare('SELECT * FROM missions WHERE isSpecial = 1').all();

    const allCards = [
        ...skillCards.map(c => ({
            ...c,
            type: 'skill',
            matchesCategories: c.matchesCategories
                ? c.matchesCategories.split(',').map(Number)
                : []
        })),
        ...regularMissions.map(c => ({ ...c, type: 'mission' }))
    ];

    let availableCards = allCards.filter(card => !session.usedCardIds.includes(card.id));

    // カード在庫が7枚以下なら全リセット
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

    // ランダム抽選（重複なし、diceValue 枚）
    const drawnCards = [];
    const drawnCardIds = new Set();
    const cardCount = Math.min(diceValue, availableCards.length);

    while (drawnCards.length < cardCount) {
        const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
        if (!drawnCardIds.has(randomCard.id)) {
            drawnCards.push(randomCard);
            drawnCardIds.add(randomCard.id);
        }
    }

    session.drawnCards = drawnCards;

    broadcast(data.sessionId, { type: 'diceRolled', diceValue, drawnCards, session });
}
```

### 5.7 カード選択処理

v1.2.1: 勝利判定の DB クエリも同期になり、ネストが解消される。

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
            currentPlayer.categories.forEach(categoryId => {
                if (card.matchesCategories?.includes(categoryId)) {
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

        // 勝利判定: better-sqlite3 同期クエリ（ネストなし）
        const categoryCards = db.prepare('SELECT * FROM category_cards').all();

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
            if (activePlayers.every(p => p.finished)) {
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

    } else {
        // ミッション・特殊ミッション
        broadcast(data.sessionId, { ...result, session });
    }
}
```

### 5.8 ターン管理・退職・リセット

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

    targetPlayer.categories = [...targetPlayer.categories, ...retiringPlayer.categories];
    retiringPlayer.categories.forEach(categoryId => {
        targetPlayer.points[categoryId] = targetPlayer.points[categoryId] ?? 0;
    });

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

    Object.assign(session, {
        gameStarted: false,
        currentPlayerIndex: 0,
        drawnCards: [],
        selectedCardsHistory: [],
        usedCardIds: [],
        finishedPlayers: [],
        allFinished: false,
        diceValue: null
    });

    session.players.forEach(p => {
        Object.assign(p, {
            categories: [],
            points: {},
            retired: false,
            categorySelected: false,
            selectedSkillCardIds: [],
            finished: false,
            finishRank: null
        });
    });

    broadcast(data.sessionId, { type: 'gameReset', session });
}
```

### 5.9 Express REST API

v1.2.1: 全DBクエリを better-sqlite3 同期APIに統一。

```javascript
app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// requireAdmin ミドルウェア
function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Token required' } });
    }
    const token = authHeader.substring(7);
    const tokenData = adminTokens.get(token);
    if (!tokenData) {
        return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    }
    if (Date.now() > tokenData.expiry) {
        adminTokens.delete(token);
        return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Token expired' } });
    }
    req.admin = tokenData;
    next();
}

// 多言語API
app.get('/api/lang/:lang', (req, res) => {
    const langFile = join(__dirname, 'lang', `${req.params.lang}.json`);
    if (!existsSync(langFile)) {
        return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Language file not found' } });
    }
    try {
        const translations = JSON.parse(readFileSync(langFile, 'utf8'));
        res.json({ ok: true, translations });
    } catch {
        res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to load translations' } });
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
        adminTokens.set(token, { username, expiry: Date.now() + TOKEN_EXPIRY });
        res.json({ ok: true, token, expiresIn: TOKEN_EXPIRY });
    } else {
        res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
    }
});

// ============================================================
// カードAPI（認証不要 — 配列を直接返す）
// better-sqlite3: .prepare().all() で同期取得
// ============================================================
app.get('/api/cards/categories', (req, res) => {
    try {
        res.json(db.prepare('SELECT * FROM category_cards').all());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/cards/skills', (req, res) => {
    try {
        res.json(db.prepare('SELECT * FROM skill_cards').all());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/cards/missions', (req, res) => {
    try {
        res.json(db.prepare('SELECT * FROM missions').all());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/cards/mission-categories', (req, res) => {
    try {
        res.json(db.prepare('SELECT * FROM mission_categories').all());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/cards/skill-types', (req, res) => {
    try {
        res.json(db.prepare('SELECT * FROM skill_types ORDER BY sortOrder').all());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// 管理API（requireAdmin 必須）
// better-sqlite3: .prepare().run() で同期実行、result.lastInsertRowid で ID取得
// ============================================================

// 職種カード CRUD
app.post('/api/admin/categories', requireAdmin, (req, res) => {
    const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints } = req.body;
    if (!name_en || !name_ja || !targetPoints) {
        return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Required fields missing' } });
    }
    if (isNaN(parseInt(targetPoints))) {
        return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'targetPoints must be a number' } });
    }
    try {
        const result = db.prepare(
            'INSERT INTO category_cards (name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints);
        res.json({ ok: true, id: result.lastInsertRowid });
    } catch (err) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } }); }
});

app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
    const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints } = req.body;
    try {
        db.prepare(
            'UPDATE category_cards SET name_en=?, name_ja=?, imageUrl=?, descriptionHtml_en=?, descriptionHtml_ja=?, targetPoints=? WHERE id=?'
        ).run(name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints, req.params.id);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } }); }
});

app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM category_cards WHERE id=?').run(req.params.id);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } }); }
});

// スキル区分 CRUD
app.post('/api/admin/skill-types', requireAdmin, (req, res) => {
    const { name_en, name_ja, model_type, description_en, description_ja, sortOrder } = req.body;
    if (!name_en || !name_ja) {
        return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'name_en and name_ja are required' } });
    }
    try {
        const result = db.prepare(
            'INSERT INTO skill_types (name_en, name_ja, model_type, description_en, description_ja, sortOrder) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(name_en, name_ja, model_type || 'katz', description_en, description_ja, sortOrder || 0);
        res.json({ ok: true, id: result.lastInsertRowid });
    } catch (err) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } }); }
});

app.put('/api/admin/skill-types/:id', requireAdmin, (req, res) => {
    const { name_en, name_ja, model_type, description_en, description_ja, sortOrder } = req.body;
    try {
        db.prepare(
            'UPDATE skill_types SET name_en=?, name_ja=?, model_type=?, description_en=?, description_ja=?, sortOrder=? WHERE id=?'
        ).run(name_en, name_ja, model_type, description_en, description_ja, sortOrder, req.params.id);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } }); }
});

app.delete('/api/admin/skill-types/:id', requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM skill_types WHERE id=?').run(req.params.id);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } }); }
});

// スキルカード CRUD
app.post('/api/admin/skills', requireAdmin, (req, res) => {
    const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesCategories } = req.body;
    try {
        const result = db.prepare(
            'INSERT INTO skill_cards (name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesCategories) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesCategories);
        res.json({ ok: true, id: result.lastInsertRowid });
    } catch (err) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } }); }
});

app.put('/api/admin/skills/:id', requireAdmin, (req, res) => {
    const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesCategories } = req.body;
    try {
        db.prepare(
            'UPDATE skill_cards SET name_en=?, name_ja=?, imageUrl=?, descriptionHtml_en=?, descriptionHtml_ja=?, matchesCategories=? WHERE id=?'
        ).run(name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesCategories, req.params.id);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } }); }
});

app.delete('/api/admin/skills/:id', requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM skill_cards WHERE id=?').run(req.params.id);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } }); }
});

// ミッション CRUD
app.post('/api/admin/missions', requireAdmin, (req, res) => {
    const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, categoryId, target_en, target_ja, isSpecial } = req.body;
    try {
        const result = db.prepare(
            'INSERT INTO missions (name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, categoryId, target_en, target_ja, isSpecial) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, categoryId, target_en, target_ja, isSpecial || 0);
        res.json({ ok: true, id: result.lastInsertRowid });
    } catch (err) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } }); }
});

app.put('/api/admin/missions/:id', requireAdmin, (req, res) => {
    const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, categoryId, target_en, target_ja, isSpecial } = req.body;
    try {
        db.prepare(
            'UPDATE missions SET name_en=?, name_ja=?, imageUrl=?, descriptionHtml_en=?, descriptionHtml_ja=?, categoryId=?, target_en=?, target_ja=?, isSpecial=? WHERE id=?'
        ).run(name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, categoryId, target_en, target_ja, isSpecial, req.params.id);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } }); }
});

app.delete('/api/admin/missions/:id', requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM missions WHERE id=?').run(req.params.id);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } }); }
});

// CSV Import: better-sqlite3 トランザクションで一括処理
app.post('/api/admin/import/:type', requireAdmin, (req, res) => {
    const { type } = req.params;
    const { csvData, preview } = req.body;

    if (!csvData || !Array.isArray(csvData)) {
        return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'csvData must be an array' } });
    }

    const tableMap = {
        categories: 'category_cards',
        skills: 'skill_cards',
        missions: 'missions',
        'skill-types': 'skill_types'
    };

    const table = tableMap[type];
    if (!table) {
        return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: `Unknown type: ${type}` } });
    }

    if (preview) {
        return res.json({ ok: true, preview: true, total: csvData.length });
    }

    let inserted = 0;
    let updated = 0;

    try {
        // better-sqlite3 トランザクションで一括処理（高速・アトミック）
        const importAll = db.transaction((rows) => {
            for (const row of rows) {
                if (row.id) {
                    const keys = Object.keys(row).filter(k => k !== 'id');
                    const sets = keys.map(k => `${k}=?`).join(',');
                    const vals = [...keys.map(k => row[k]), row.id];
                    db.prepare(`UPDATE ${table} SET ${sets} WHERE id=?`).run(vals);
                    updated++;
                } else {
                    const keys = Object.keys(row);
                    const vals = keys.map(k => row[k]);
                    const placeholders = keys.map(() => '?').join(',');
                    db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`).run(vals);
                    inserted++;
                }
            }
        });

        importAll(csvData);
        res.json({ ok: true, inserted, updated, total: csvData.length });
    } catch (err) {
        res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});

// ヘルスチェック
app.get('/api/health', (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
});

// サーバー起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

## 6. クライアントサイド実装

### 6.1 game.js 構造

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
        const keys = key.split('.');
        let value = this.translations;
        for (const k of keys) { value = value?.[k]; }
        return value || key;
    }
}

const i18n = new I18n();

// GameClient クラス
class GameClient {
    constructor() {
        this.ws = null;
        this.language = i18n.currentLang;
        this.sessionId = null;
        this.playerId = null;
        this.session = null;
        this.connected = false;
        this.mode = 'menu';   // 'menu' | 'lobby' | 'game'
        this.selectedCard = null;
        this.rolling = false;
        this.modal = null;
        this.categoryCardsCache = [];   // v1.2: 旧 jobCardsCache
        this.skillCardsCache = [];
        this.flippedCards = new Set();
        this.flippedCategoryCards = new Set();  // v1.2: 旧 flippedJobCards
    }

    async init() {
        await i18n.init();
        this.language = i18n.currentLang;
        this.connect();
        this.fetchCategoryCards();   // v1.2: 旧 fetchJobCards
        this.fetchSkillCards();
        this.render();
    }

    t(key) { return i18n.t(key); }

    getRankEmoji(rank) {
        return { 1: '🥇', 2: '🥈', 3: '🥉' }[rank] ?? `${rank}位`;
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    async fetchCategoryCards() {
        // v1.2: /api/cards/categories（旧 /api/cards/jobs）
        try {
            const res = await fetch('/api/cards/categories');
            this.categoryCardsCache = await res.json();
        } catch (e) { console.error('Failed to fetch category cards:', e); }
    }

    async fetchSkillCards() {
        try {
            const res = await fetch('/api/cards/skills');
            this.skillCardsCache = await res.json();
        } catch (e) { console.error('Failed to fetch skill cards:', e); }
    }
}

const game = new GameClient();
window.game = game;
game.init();
```

### 6.2 WebSocket 接続と受信ハンドラ

```javascript
connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
        console.log('Connected to server');
        this.connected = true;
        this.updateConnectionIndicator();
        this.render();
    };

    this.ws.onclose = () => {
        console.log('Disconnected from server');
        this.connected = false;
        this.updateConnectionIndicator();
        this.render();
        setTimeout(() => this.connect(), 3000);  // 自動再接続
    };

    this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleServerMessage(data);
    };

    this.ws.onerror = (error) => { console.error('WebSocket error:', error); };
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

        case 'sessionJoined':
            this.sessionId = data.session.id;
            this.playerId = data.playerId;
            this.session = data.session;
            this.mode = 'lobby';
            this.render();
            break;

        case 'playerJoined':
            this.session = data.session;
            this.render();
            break;

        case 'categorySelected':   // v1.2: 旧 jobSelected
            this.session = data.session;
            this.render();
            break;

        case 'gameStarted':
            this.session = data.session;
            this.mode = 'game';
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

        case 'cardSelectedByOther':
            this.session = data.session;
            this.render();
            break;

        case 'gameCompleted':
            this.session = data.session;
            setTimeout(() => this.showFinalRankingsModal(data.finalRankings), 1500);
            this.render();
            break;

        case 'playerRetired':
            this.session = data.session;
            this.showModal({
                title: this.t('game.retired'),
                content: `<p>${data.retiredPlayerId === this.playerId
                    ? this.t('game.youRetired')
                    : this.t('game.playerRetiredNotice')}</p>`
            });
            this.render();
            break;

        case 'nextTurn':
            this.session = data.session;
            this.render();
            break;

        case 'gameReset':
            this.session = data.session;
            this.mode = 'lobby';
            this.render();
            break;

        case 'error':
            console.error('Server error:', data.error);
            if (['SESSION_NOT_FOUND', 'SESSION_FULL', 'GAME_ALREADY_STARTED'].includes(data.error.code)) {
                alert(`エラー: ${this.t('errors.' + data.error.code) || data.error.code}`);
            }
            break;
    }
}

updateConnectionIndicator() {
    const el = document.getElementById('connection-indicator');
    if (el) el.innerHTML = this.connected ? '🟢 Connected' : '🔴 Disconnected';
}
```

### 6.3 メニュー・ロビー画面

```javascript
render() {
    const app = document.getElementById('app');
    if (!app) return;

    let html = '';
    if (this.mode === 'menu')       html += this.renderMenu();
    else if (this.mode === 'lobby') html += this.renderLobby();
    else if (this.mode === 'game')  html += this.renderGame();
    if (this.modal) html += this.renderModal();

    app.innerHTML = html;
    this.attachEventListeners();
}

renderMenu() {
    return `
        <div class="menu-screen">
            <div class="lang-toggle">
                <button class="${this.language === 'en' ? 'active' : ''}" data-lang="en">EN</button>
                <button class="${this.language === 'ja' ? 'active' : ''}" data-lang="ja">日本語</button>
            </div>
            <h1>${this.t('game.title')}</h1>
            <p>${this.t('game.subtitle')}</p>
            <button class="btn-primary" onclick="game.createGame()" ${!this.connected ? 'disabled' : ''}>
                ${this.t('game.createGame')}
            </button>
            <div class="join-form">
                <input id="join-session-id" type="text" placeholder="${this.t('game.sessionId')}">
                <input id="join-player-name" type="text" placeholder="${this.t('game.playerName')}">
                <button class="btn-secondary" onclick="game.joinGame()" ${!this.connected ? 'disabled' : ''}>
                    ${this.t('game.join')}
                </button>
            </div>
            ${!this.connected ? `<p>${this.t('common.loading')}</p>` : ''}
        </div>
    `;
}

createGame() {
    const name = prompt(this.t('game.playerName'));
    if (!name) return;
    this.send({ type: 'createSession', playerName: name, maxPlayers: 4 });
}

joinGame() {
    const sessionId = document.getElementById('join-session-id').value.trim().toUpperCase();
    const playerName = document.getElementById('join-player-name').value.trim();
    if (!sessionId || !playerName) return alert('セッションIDとプレイヤー名を入力してください');
    this.send({ type: 'joinSession', sessionId, playerName });
}

renderLobby() {
    const myPlayer = this.session.players.find(p => p.id === this.playerId);
    const isHost = this.session.hostPlayerId === this.playerId;
    const allSelected = this.session.players.every(p => p.categorySelected);  // v1.2

    return `
        <div class="lobby-screen">
            <h2>${this.t('game.lobby')}</h2>
            <div class="session-id-display">
                <span>${this.session.id}</span>
                <button onclick="game.copySessionId()">${this.t('game.copySessionId')}</button>
            </div>
            <div class="players-list">
                ${this.session.players.map(p => `
                    <div class="player-item">
                        <span>${p.name}</span>
                        ${p.categorySelected
                            ? `<span class="badge-selected">${this.t('game.categorySelected')}</span>`
                            : '<span class="badge-waiting">待機中</span>'}
                    </div>
                `).join('')}
            </div>
            <h3>${this.t('game.selectCategory')}</h3>
            <div class="cards-grid">
                ${this.categoryCardsCache.map(cat => {
                    // v1.2: player.categories を参照（旧 player.jobs）
                    const takenBy = this.session.players.find(
                        p => p.id !== this.playerId && p.categories.includes(cat.id)
                    );
                    const isMine = myPlayer?.categories.includes(cat.id);
                    const isDisabled = !!takenBy;
                    return `
                    <div class="simple-card ${isMine ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}"
                         onclick="${!isDisabled ? `game.selectCategory(${cat.id})` : ''}">
                        <div class="simple-card-main">
                            ${cat[`name_${this.language}`]}
                            ${isMine ? ' ✓' : ''}
                            ${takenBy ? `<br><small>（${takenBy.name}）</small>` : ''}
                        </div>
                    </div>`;
                }).join('')}
            </div>
            ${isHost && allSelected
                ? `<button class="btn-primary" onclick="game.startGame()">${this.t('game.startGame')}</button>`
                : `<p>${this.t('game.waitingForCategorySelection')}</p>`}
        </div>
    `;
}

// v1.2: selectJob → selectCategory
selectCategory(categoryId) {
    this.send({
        type: 'selectCategory',   // v1.2
        sessionId: this.sessionId,
        playerId: this.playerId,
        categoryId                // v1.2: 旧 jobId
    });
}

startGame() {
    this.send({ type: 'startGame', sessionId: this.sessionId, playerId: this.playerId });
}

copySessionId() {
    navigator.clipboard.writeText(this.sessionId)
        .then(() => { /* トースト表示 */ })
        .catch(() => { alert(this.sessionId); });
}
```

### 6.4 ゲーム画面のレンダリング

```javascript
renderGame() {
    const currentPlayer = this.session.players[this.session.currentPlayerIndex];
    const isMyTurn = currentPlayer.id === this.playerId;

    return `
        <div class="game-layout">
            <!-- 左サイドバー: プレイヤー状況 -->
            <div class="player-sidebar">
                ${this.session.players.map(p => {
                    const isCurrent = p.id === currentPlayer.id;
                    return `
                    <div class="player-card ${isCurrent ? 'current-turn' : ''}">
                        <div class="player-name">${p.name}</div>
                        ${p.retired
                            ? `<span class="badge-retired">${this.t('game.retired')}</span>`
                            : p.categories.map(catId => {
                                // v1.2: categoryCardsCache から名前を引く（旧 jobCardsCache）
                                const cat = this.categoryCardsCache.find(c => c.id === catId);
                                const pts = p.points[catId] || 0;
                                const target = cat?.targetPoints || '?';
                                return `<div>${cat?.[`name_${this.language}`] || catId}: ${pts}/${target} pt</div>`;
                            }).join('')
                        }
                        ${p.finished ? `<div>🏆 ${this.getRankEmoji(p.finishRank)}</div>` : ''}
                    </div>`;
                }).join('')}
            </div>

            <!-- メインエリア -->
            <div class="main-area">
                ${isMyTurn ? `
                    <h3>${this.t('game.yourTurn')}</h3>
                    ${!this.session.drawnCards.length
                        ? `<button class="btn-primary" onclick="game.rollDice()" ${this.rolling ? 'disabled' : ''}>
                               ${this.rolling ? this.t('game.rolling') : this.t('game.rollDice')}
                           </button>`
                        : this.renderCards()
                    }
                ` : `
                    <h3>${currentPlayer.name}${this.t('game.otherTurn')}</h3>
                    ${this.session.drawnCards.length ? this.renderCards() : ''}
                `}
            </div>
        </div>
    `;
}

renderCards() {
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
                    if (card.type === 'skill')        bgStyle = 'background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);';
                    else if (card.type === 'mission') bgStyle = 'background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);';
                    else if (card.type === 'special') bgStyle = 'background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);';

                    return `
                    <div class="simple-card ${isDisabled ? 'disabled' : ''}" style="${bgStyle}">
                        <div class="simple-card-main"
                             onclick="game.selectCard(${JSON.stringify(card).replace(/"/g, '&quot;')})">
                            ${isFlipped ? `
                                <div class="simple-card-content">
                                    ${card.imageUrl ? `<img src="${card.imageUrl}" style="max-width: 100%; border-radius: 8px; margin-bottom: 10px;">` : ''}
                                    <div>${card[`descriptionHtml_${this.language}`] || ''}</div>
                                </div>
                            ` : `
                                ${card[`name_${this.language}`] || 'Card ' + (index + 1)}
                            `}
                        </div>
                        <div class="simple-card-footer"
                             onclick="event.stopPropagation(); game.flipCard(${card.id})">
                            ${isFlipped ? '← ' + this.t('game.backToFront') : this.t('game.viewDetails') + ' →'}
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>
    `;
}

rollDice() {
    this.rolling = true;
    this.render();
    this.send({ type: 'rollDice', sessionId: this.sessionId, playerId: this.playerId });
}

flipCard(cardId) {
    this.flippedCards.has(cardId) ? this.flippedCards.delete(cardId) : this.flippedCards.add(cardId);
    this.render();
}

selectCard(card) {
    if (this.selectedCard?.id === card.id) {
        // 2回クリックで確定
        this.send({ type: 'selectCard', sessionId: this.sessionId, playerId: this.playerId, cardId: card.id });
        if (card.type === 'special') this.showPlayerSelectionModal(card);
    } else {
        this.selectedCard = card;  // 1回クリックで仮選択
        this.render();
    }
}
```

### 6.5 モーダルとイベントリスナー

```javascript
showModal(options) {
    this.modal = {
        title: options.title,
        content: options.content,
        buttons: options.buttons || [{ label: this.t('common.close'), action: 'close' }]
    };
    this.render();
}

closeModal() { this.modal = null; this.render(); }

renderModal() {
    return `
    <div class="modal-overlay" onclick="game.handleModalOverlayClick(event)">
        <div class="modal" onclick="event.stopPropagation()">
            <h2>${this.modal.title}</h2>
            <div class="modal-content">${this.modal.content}</div>
            <div class="modal-buttons">
                ${this.modal.buttons.map(btn => `
                    <button class="btn-${btn.style || 'secondary'}"
                            onclick="game.handleModalAction('${btn.action}')">
                        ${btn.label}
                    </button>
                `).join('')}
            </div>
        </div>
    </div>`;
}

handleModalOverlayClick(event) {
    if (event.target === event.currentTarget) this.closeModal();
}

handleModalAction(action) {
    switch (action) {
        case 'close':     this.closeModal(); break;
        case 'resetGame': this.resetGame();  break;
        case 'backToMenu':
            this.mode = 'menu';
            this.sessionId = null;
            this.session = null;
            this.closeModal();
            this.render();
            break;
    }
}

showFinalRankingsModal(rankings) {
    const content = rankings.map(r =>
        `<div>${this.getRankEmoji(r.rank)} ${r.name}</div>`
    ).join('');
    this.showModal({
        title: '🎉 ' + this.t('game.allFinished'),
        content,
        buttons: [
            { label: this.t('game.playAgain'), action: 'resetGame', style: 'primary' },
            { label: this.t('game.backToMenu'), action: 'backToMenu', style: 'secondary' }
        ]
    });
}

// 特殊ミッション: 退職対象プレイヤーを選択するモーダル
showPlayerSelectionModal(card) {
    const activePlayers = this.session.players.filter(p => !p.retired);
    const content = activePlayers.map(p => `
        <button class="btn-secondary"
                onclick="game.executeResign('${this.playerId}', '${p.id}')">
            ${p.name} ${this.t('game.transferTo')}
        </button>
    `).join('');
    this.showModal({
        title: this.t('game.selectPlayerToResign'),
        content,
        buttons: [{ label: this.t('common.cancel'), action: 'close' }]
    });
}

executeResign(retiredPlayerId, targetPlayerId) {
    this.send({ type: 'resign', sessionId: this.sessionId, playerId: retiredPlayerId, targetPlayerId });
    this.closeModal();
}

resetGame() {
    this.send({ type: 'resetGame', sessionId: this.sessionId });
    this.closeModal();
}

attachEventListeners() {
    document.querySelectorAll('[data-lang]').forEach(btn => {
        btn.addEventListener('click', () => i18n.setLanguage(btn.dataset.lang));
    });
}
```


---

## 7. 多言語対応システム

### 7.1 翻訳ファイル構造

**lang/ja.json**（完全版）:
```json
{
  "common": {
    "language": "言語",
    "save": "保存",
    "cancel": "キャンセル",
    "close": "閉じる",
    "edit": "編集",
    "delete": "削除",
    "add": "追加",
    "confirm": "確認",
    "loading": "読み込み中..."
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

**lang/en.json**（完全版）:
```json
{
  "common": {
    "language": "Language",
    "save": "Save",
    "cancel": "Cancel",
    "close": "Close",
    "edit": "Edit",
    "delete": "Delete",
    "add": "Add",
    "confirm": "Confirm",
    "loading": "Loading..."
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

### 7.2 使用方法

```javascript
i18n.t('game.title')              // "職種 × スキル カードゲーム"
i18n.t('game.selectCategory')     // "職種を選択してください"
i18n.t('errors.CATEGORY_TAKEN')   // "その職種はすでに選択されています"

await i18n.setLanguage('en');
i18n.t('game.title')              // "Career × Skills Card Game"
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
    btn.addEventListener('click', () => i18n.setLanguage(btn.dataset.lang));
});
```

---

## 8. 管理画面実装

### 8.1 画面構造

```html
<!-- #loginScreen: デフォルト表示 -->
<div id="loginScreen">
    <h2>管理者ログイン</h2>
    <form id="loginForm">
        <input id="username" type="text" placeholder="ユーザー名">
        <input id="password" type="password" placeholder="パスワード">
        <button type="submit">ログイン</button>
        <p id="loginError"></p>
    </form>
</div>

<!-- #adminScreen: ログイン後に display:block -->
<div id="adminScreen" style="display:none">
    <!-- タブナビゲーション（v1.2） -->
    <div class="tab-nav">
        <button data-tab="categories">職種カード</button>        <!-- v1.2: 旧 jobs -->
        <button data-tab="skill-types">スキル区分</button>       <!-- v1.2: 新規 -->
        <button data-tab="skills">スキルカード</button>
        <button data-tab="missions">ミッション</button>
        <button data-tab="mission-categories">カテゴリ</button>  <!-- v1.2: 旧 categories -->
    </div>
    <!-- 各タブコンテンツ: テーブル + 追加ボタン + CSVエリア -->
</div>
```

### 8.2 ログイン処理

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
            document.getElementById('loginError').textContent =
                data.error?.message || 'ログインに失敗しました';
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('ログインエラーが発生しました');
    }
});
```

### 8.3 データ管理

```javascript
let adminToken = localStorage.getItem('admin_token');
let currentTab = 'categories';  // v1.2: 旧 'jobs'
let editingId = null;
let currentCsvData = null;
let currentCsvType = null;
let allData = {
    categories: [],          // v1.2: 旧 jobs
    skillTypes: [],          // v1.2: 新規
    skills: [],
    missions: [],
    missionCategories: []    // v1.2: 旧 categories
};

async function loadData() {
    const [categories, skillTypes, skills, missions, missionCategories] = await Promise.all([
        fetch('/api/cards/categories').then(r => r.json()),
        fetch('/api/cards/skill-types').then(r => r.json()),
        fetch('/api/cards/skills').then(r => r.json()),
        fetch('/api/cards/missions').then(r => r.json()),
        fetch('/api/cards/mission-categories').then(r => r.json())
    ]);
    allData = { categories, skillTypes, skills, missions, missionCategories };
    renderTable(currentTab);
}
```

### 8.4 テーブル描画

```javascript
function renderTable(type) {
    // type: 'categories' | 'skill-types' | 'skills' | 'missions' | 'mission-categories'
    let rows = '';

    if (type === 'categories') {
        // v1.2: 旧 'jobs'
        rows = allData.categories.map(item => `
            <tr>
                <td>${item.id}</td>
                <td>${item.name_ja}</td>
                <td>${item.name_en}</td>
                <td>${item.targetPoints}</td>
                <td>
                    <button onclick="openEditModal('categories', ${item.id})">編集</button>
                    <button onclick="deleteCard('categories', ${item.id})">削除</button>
                </td>
            </tr>`).join('');

    } else if (type === 'skill-types') {
        // v1.2: 新規
        rows = allData.skillTypes.map(item => `
            <tr>
                <td>${item.id}</td>
                <td>${item.name_ja}</td>
                <td>${item.name_en}</td>
                <td><span class="badge">${item.model_type}</span></td>
                <td>
                    <button onclick="openEditModal('skill-types', ${item.id})">編集</button>
                    <button onclick="deleteCard('skill-types', ${item.id})">削除</button>
                </td>
            </tr>`).join('');

    } else if (type === 'skills') {
        rows = allData.skills.map(item => {
            // v1.2: matchesCategories を職種名に変換（旧 matchesJobs / allData.jobs）
            const matchNames = (item.matchesCategories || '')
                .split(',').filter(Boolean)
                .map(id => allData.categories.find(c => c.id === parseInt(id))?.name_ja || id)
                .join(', ');
            return `
            <tr>
                <td>${item.id}</td>
                <td>${item.name_ja}</td>
                <td>${item.name_en}</td>
                <td>${matchNames}</td>
                <td>
                    <button onclick="openEditModal('skills', ${item.id})">編集</button>
                    <button onclick="deleteCard('skills', ${item.id})">削除</button>
                </td>
            </tr>`;
        }).join('');

    } else if (type === 'missions') {
        rows = allData.missions.map(item => {
            const catName = allData.missionCategories.find(c => c.id === item.categoryId)?.name_ja || '';
            return `
            <tr>
                <td>${item.id}</td>
                <td>${item.name_ja || '（無名）'}</td>
                <td>${catName}</td>
                <td>${item.isSpecial ? '<span class="badge-special">特殊</span>' : ''}</td>
                <td>
                    <button onclick="openEditModal('missions', ${item.id})">編集</button>
                    <button onclick="deleteCard('missions', ${item.id})">削除</button>
                </td>
            </tr>`;
        }).join('');
    }

    document.getElementById(`${type}-table`).querySelector('tbody').innerHTML = rows;
}
```

### 8.5 カード追加・編集フォーム

```javascript
function openAddModal(type) { editingId = null; openModal(type, null); }
function openEditModal(type, id) {
    editingId = id;
    const data = allData[type === 'categories' ? 'categories'
                       : type === 'skill-types' ? 'skillTypes'
                       : type === 'skills' ? 'skills'
                       : 'missions'].find(item => item.id === id);
    openModal(type, data);
}

function openModal(type, data) {
    let formHtml = '';

    if (type === 'categories') {
        formHtml = `
            <label>英語名 <input type="text" id="f-name-en" value="${data?.name_en || ''}"></label>
            <label>日本語名 <input type="text" id="f-name-ja" value="${data?.name_ja || ''}"></label>
            <label>必要ポイント <input type="number" id="f-target-points" value="${data?.targetPoints || 4}"></label>
            <label>説明（英語）<textarea id="f-desc-en">${data?.descriptionHtml_en || ''}</textarea></label>
            <label>説明（日本語）<textarea id="f-desc-ja">${data?.descriptionHtml_ja || ''}</textarea></label>
            <label>画像 <input type="file" accept="image/*" onchange="handleImageUpload(event, 'f-image-url')">
                   <input type="hidden" id="f-image-url" value="${data?.imageUrl || ''}"></label>
        `;

    } else if (type === 'skill-types') {
        // v1.2: model_type は自由記述 + datalist でサジェスト
        const existingTypes = [...new Set(allData.skillTypes.map(t => t.model_type))];
        formHtml = `
            <label>英語名 <input type="text" id="f-name-en" value="${data?.name_en || ''}"></label>
            <label>日本語名 <input type="text" id="f-name-ja" value="${data?.name_ja || ''}"></label>
            <label>モデル種別
                <input type="text" id="f-model-type"
                       list="model-type-suggestions"
                       value="${data?.model_type || 'katz'}"
                       placeholder="例: katz">
                <datalist id="model-type-suggestions">
                    ${existingTypes.map(v => `<option value="${v}">`).join('')}
                    <option value="katz">
                    <option value="drucker">
                </datalist>
            </label>
            <label>説明（英語）<textarea id="f-desc-en">${data?.description_en || ''}</textarea></label>
            <label>説明（日本語）<textarea id="f-desc-ja">${data?.description_ja || ''}</textarea></label>
            <label>表示順 <input type="number" id="f-sort-order" value="${data?.sortOrder || 0}"></label>
        `;

    } else if (type === 'skills') {
        // v1.2: matchesCategories チェックボックス（旧 matchesJobs / allData.jobs）
        const selectedIds = (data?.matchesCategories || '').split(',').map(Number);
        formHtml = `
            <label>英語名 <input type="text" id="f-name-en" value="${data?.name_en || ''}"></label>
            <label>日本語名 <input type="text" id="f-name-ja" value="${data?.name_ja || ''}"></label>
            <label>説明（英語）<textarea id="f-desc-en">${data?.descriptionHtml_en || ''}</textarea></label>
            <label>説明（日本語）<textarea id="f-desc-ja">${data?.descriptionHtml_ja || ''}</textarea></label>
            <label>対応職種
                ${allData.categories.map(cat => `
                    <label>
                        <input type="checkbox" name="matchesCategories" value="${cat.id}"
                               ${selectedIds.includes(cat.id) ? 'checked' : ''}>
                        ${cat.name_ja}
                    </label>
                `).join('')}
            </label>
            <label>画像 <input type="file" accept="image/*" onchange="handleImageUpload(event, 'f-image-url')">
                   <input type="hidden" id="f-image-url" value="${data?.imageUrl || ''}"></label>
        `;
    }

    document.getElementById('cardModal-content').innerHTML = formHtml;
    document.getElementById('cardModal').style.display = 'block';
}

async function saveCard(type) {
    const token = localStorage.getItem('admin_token');
    let body = {};

    if (type === 'categories') {
        body = {
            name_en: document.getElementById('f-name-en').value,
            name_ja: document.getElementById('f-name-ja').value,
            targetPoints: document.getElementById('f-target-points').value,
            descriptionHtml_en: document.getElementById('f-desc-en').value,
            descriptionHtml_ja: document.getElementById('f-desc-ja').value,
            imageUrl: document.getElementById('f-image-url').value || null
        };
    } else if (type === 'skill-types') {
        body = {
            name_en: document.getElementById('f-name-en').value,
            name_ja: document.getElementById('f-name-ja').value,
            model_type: document.getElementById('f-model-type').value || 'katz',
            description_en: document.getElementById('f-desc-en').value,
            description_ja: document.getElementById('f-desc-ja').value,
            sortOrder: document.getElementById('f-sort-order').value
        };
    } else if (type === 'skills') {
        // v1.2: matchesCategories を収集（旧 matchesJobs）
        const matchesCategories = [...document.querySelectorAll('input[name="matchesCategories"]:checked')]
            .map(el => el.value).join(',');
        body = {
            name_en: document.getElementById('f-name-en').value,
            name_ja: document.getElementById('f-name-ja').value,
            descriptionHtml_en: document.getElementById('f-desc-en').value,
            descriptionHtml_ja: document.getElementById('f-desc-ja').value,
            matchesCategories,
            imageUrl: document.getElementById('f-image-url').value || null
        };
    }

    const url = editingId
        ? `/api/admin/${type}/${editingId}`
        : `/api/admin/${type}`;
    const method = editingId ? 'PUT' : 'POST';

    const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
    });
    const result = await response.json();
    if (result.ok) {
        document.getElementById('cardModal').style.display = 'none';
        await loadData();
    } else {
        alert('保存に失敗しました: ' + result.error?.message);
    }
}

async function deleteCard(type, id) {
    if (!confirm('このカードを削除しますか？この操作は取り消せません。')) return;
    const token = localStorage.getItem('admin_token');
    const response = await fetch(`/api/admin/${type}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();
    if (result.ok) await loadData();
    else alert('削除に失敗しました: ' + result.error?.message);
}
```

### 8.6 画像アップロード

```javascript
function handleImageUpload(event, targetInputId) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
        alert('画像サイズは20MB以下にしてください');
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const maxSize = 800;
            let { width, height } = img;
            if (width > height) {
                if (width > maxSize) { height = height * (maxSize / width); width = maxSize; }
            } else {
                if (height > maxSize) { width = width * (maxSize / height); height = maxSize; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            const resizedBase64 = canvas.toDataURL('image/jpeg', 0.75);
            // 2MB超なら品質を下げて再エンコード
            const finalBase64 = resizedBase64.length > 2 * 1024 * 1024 * 1.37
                ? canvas.toDataURL('image/jpeg', 0.5)
                : resizedBase64;
            document.getElementById(targetInputId).value = finalBase64;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}
```

### 8.7 CSV Export/Import

```javascript
async function exportCSV(type) {
    const config = {
        categories: {  // v1.2: 旧 jobs
            endpoint: '/api/cards/categories',
            headers: ['id', 'name_en', 'name_ja', 'descriptionHtml_en', 'descriptionHtml_ja', 'targetPoints'],
            filename: 'category_cards.csv'
        },
        'skill-types': {  // v1.2: 新規
            endpoint: '/api/cards/skill-types',
            headers: ['id', 'name_en', 'name_ja', 'model_type', 'description_en', 'description_ja', 'sortOrder'],
            filename: 'skill_types.csv'
        },
        skills: {
            endpoint: '/api/cards/skills',
            headers: ['id', 'name_en', 'name_ja', 'descriptionHtml_en', 'descriptionHtml_ja', 'matchesCategories'],
            filename: 'skill_cards.csv'
        },
        missions: {
            endpoint: '/api/cards/missions',
            headers: ['id', 'name_en', 'name_ja', 'descriptionHtml_en', 'descriptionHtml_ja', 'categoryId', 'target_en', 'target_ja', 'isSpecial'],
            filename: 'missions.csv'
        }
    };

    const { endpoint, headers, filename } = config[type];
    try {
        const data = await fetch(endpoint).then(r => r.json());
        const escapeCSV = (v) => {
            if (v === null || v === undefined) return '';
            const s = String(v);
            return (s.includes(',') || s.includes('"') || s.includes('\n'))
                ? '"' + s.replace(/"/g, '""') + '"'
                : s;
        };
        const rows = [headers.join(',')];
        data.forEach(item => rows.push(headers.map(h => escapeCSV(item[h])).join(',')));
        const csv = rows.join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    } catch (error) {
        console.error('Export error:', error);
        alert('エクスポートエラーが発生しました');
    }
}

async function importCSV(type, file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result.replace(/^\uFEFF/, '');  // BOM除去
        const lines = text.split('\n').filter(Boolean);
        const headers = lines[0].split(',');
        currentCsvData = lines.slice(1).map(line => {
            const values = line.split(',');
            return Object.fromEntries(headers.map((h, i) => [h.trim(), values[i]?.trim()]));
        });
        currentCsvType = type;

        // プレビュー
        const token = localStorage.getItem('admin_token');
        const response = await fetch(`/api/admin/import/${type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ csvData: currentCsvData, preview: true })
        });
        const result = await response.json();
        document.getElementById('csv-preview').innerHTML =
            `<p>プレビュー: ${result.total} 件を取り込み予定</p>
             <button onclick="executeCsvImport()">確定取り込み</button>`;
    };
    reader.readAsText(file, 'UTF-8');
}

async function executeCsvImport() {
    if (!currentCsvData || !currentCsvType) return;
    try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch(`/api/admin/import/${currentCsvType}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ csvData: currentCsvData, preview: false })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Import failed');
        document.getElementById('csvResultsContainer').innerHTML = `
            <div class="csv-success-box">
                <h3>取り込み完了！</h3>
                <p>追加: ${result.inserted || 0} 件</p>
                <p>更新: ${result.updated || 0} 件</p>
                <p>合計: ${result.total || 0}</p>
            </div>`;
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

// 兼任（複数職種）の場合（v1.2: player.categories）
player.categories.every(categoryId => {
    const cat = categoryCards.find(c => c.id === categoryId);
    return player.points[categoryId] >= cat.targetPoints;
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
let availableCards = allCards.filter(card => !session.usedCardIds.includes(card.id));

// 在庫が7枚以下なら全リセット
if (availableCards.length <= 7) {
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

// クライアント: 選択時にプレイヤー選択モーダルを表示
if (card.type === 'special') {
    this.showPlayerSelectionModal(card);
}

// サーバー: 退職処理（v1.2: categories フィールド）
function handleResign(ws, data) {
    const retiringPlayer = session.players.find(p => p.id === data.playerId);
    const targetPlayer   = session.players.find(p => p.id === data.targetPlayerId);

    targetPlayer.categories = [...targetPlayer.categories, ...retiringPlayer.categories];
    retiringPlayer.categories.forEach(categoryId => {
        targetPlayer.points[categoryId] = targetPlayer.points[categoryId] ?? 0;
    });

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

Section 5.9 の `requireAdmin` 参照。トークンは `adminTokens` Map で管理し、24時間で自動失効する。

### 10.3 入力検証例

```javascript
// category_cards 追加時（必須フィールド + 数値チェック）
if (!name_en || !name_ja || !targetPoints) {
    return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Required fields missing' } });
}
if (isNaN(parseInt(targetPoints))) {
    return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'targetPoints must be a number' } });
}
```

---

## 11. デプロイメント手順

### 11.1 ローカル開発環境

```bash
npm install
cp .env.example .env
nano .env           # パスワード変更推奨
npm run initdb
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

```bash
sudo mkdir -p /var/log/career-card-game
sudo chown ubuntu:ubuntu /var/log/career-card-game
sudo systemctl daemon-reload
sudo systemctl enable career-card-game
sudo systemctl start career-card-game
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
        proxy_read_timeout 86400;  -- WebSocket長時間接続のため重要
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

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
1. `.env` ファイルの存在確認（`cat .env`）
2. サーバーログで `=== LOGIN ATTEMPT ===` の出力を確認
3. ブラウザの DevTools → Application → localStorage の `admin_token` をクリア
4. パスワードに `#` 等の特殊文字がある場合は `.env` でシングルクォートで囲む

### 12.2 WebSocket接続エラー

**症状**: "Disconnected"表示が続く

**解決手順**:
1. ブラウザのコンソールで Close code を確認（`ws.onclose` に `console.log(event.code)` を追記）
2. Nginx設定に `proxy_set_header Upgrade $http_upgrade;` / `Connection "upgrade"` があるか確認
3. ファイアウォールでポート3000が開いているか確認
4. HTTPS環境で `wss://` プロトコルを使用しているか確認（`ws://` では接続不可）

### 12.3 データベースエラー

**症状**: "Database check error" / "no such table"

**解決手順**:
```bash
rm game.db
npm run initdb
npm start
```

v1.1からの移行漏れの場合は Section 4.4 のマイグレーションSQLを実行。

### 12.4 ポート3000が使用中

```bash
PORT=8080 npm start
# または
sudo lsof -i :3000
sudo kill -9 <PID>
```

### 12.5 better-sqlite3 インストールエラー

**症状**: `npm install` で `better-sqlite3` のビルドエラー

**解決手順**:
```bash
# Node.js 24 であることを確認
node --version  # v24.x.x であること

# ビルドツール（node-gyp 依存）をインストール
sudo apt install -y python3 build-essential

# キャッシュを使わず再インストール
npm install --build-from-source
```

> `better-sqlite3` はネイティブアドオンのためビルドが必要。Node.js のメジャーバージョンを変えた場合は `npm rebuild better-sqlite3` を実行する。

### 12.6 カード選択時にポイントが加算されない

**確認ポイント**:
```bash
# DBのカラム名確認（matchesCategories であること）
sqlite3 game.db ".schema skill_cards"
```

サーバーコード確認:
- `handleRollDice` で `c.matchesCategories.split(',').map(Number)` を参照しているか
- `handleSelectCard` で `player.categories` / `card.matchesCategories` を参照しているか
- 勝利判定クエリが `FROM category_cards` になっているか（`FROM job_cards` になっていないか）

---

## 13. 実装チェックリスト

### 13.1 サーバーサイド

- [ ] `server.js` 作成
- [ ] `better-sqlite3` インストール（`npm install`）
- [ ] `package.json` に `"type": "module"` と `"engines": {"node": ">=24"}` を追加
- [ ] WebSocketサーバー実装
- [ ] セッション管理（Map構造）
- [ ] データベース初期化（initdb.js）
- [ ] 認証システム（トークンベース）
- [ ] API実装（カード取得系は配列を直接返す）
- [ ] 多言語API（`/api/lang/:lang`）
- [ ] 環境変数設定（.env）
- [ ] `handleSelectCategory`（旧 `handleSelectJob`）
- [ ] `category_cards` テーブル参照（旧 `job_cards`）
- [ ] `matchesCategories` 処理（旧 `matchesJobs`）
- [ ] `GET /api/cards/categories`
- [ ] `GET /api/cards/skill-types`（新規）
- [ ] `GET /api/cards/mission-categories`（旧 `/api/cards/categories`）
- [ ] `/api/admin/categories` CRUD
- [ ] `/api/admin/skill-types` CRUD（新規）

### 13.2 クライアントサイド

- [ ] `index.html` 作成
- [ ] `game.js` 作成（GameClientクラス）
- [ ] WebSocket接続実装・自動再接続
- [ ] I18nクラス実装
- [ ] カード表示UI（サイドバー + メインエリア構造）
- [ ] モーダル表示機能
- [ ] レスポンシブデザイン
- [ ] `categoryCardsCache` / `fetchCategoryCards()`（旧 `jobCardsCache`）
- [ ] `categorySelected` 受信処理（旧 `jobSelected`）
- [ ] `selectCategory()` 送信（旧 `selectJob()`）
- [ ] `player.categories` / `player.categorySelected` 参照

### 13.3 管理画面

- [ ] `admin.html` 作成
- [ ] ログイン画面実装
- [ ] `categories` タブ（旧 `jobs`）
- [ ] `skill-types` タブ（新規）
- [ ] `mission-categories` タブ（旧 `categories`）
- [ ] カード追加・編集・削除
- [ ] 画像アップロード（Base64、最大800×800px）
- [ ] `matchesCategories` チェックボックス（旧 `matchesJobs`）
- [ ] `skill_types.model_type` を `<input>` + `<datalist>` の自由記述で入力
- [ ] CSV Export/Import（`categories`・`skill-types` タイプを含む）

### 13.4 データベース

- [ ] `mission_categories` テーブル（4件）
- [ ] `category_cards` テーブル（6件）
- [ ] `skill_types` テーブル（3件 Katzモデル初期値）
- [ ] `skill_cards` テーブル（23件、`matchesCategories` カラム）
- [ ] `missions` テーブル（40件: 通常39 + 特殊1）

### 13.5 多言語対応

- [ ] `lang/ja.json` 作成（全キー）
- [ ] `lang/en.json` 作成（全キー）
- [ ] `game.selectCategory` / `game.categorySelected` キー
- [ ] `game.waitingForCategorySelection` キー
- [ ] `admin.categoryCards` / `admin.skillTypes` / `admin.modelType` キー
- [ ] `admin.matchesCategories` キー
- [ ] `errors.CATEGORY_TAKEN` キー（旧 `JOB_TAKEN`）
- [ ] UI言語切り替えボタン

### 13.6 ゲームロジック

- [ ] 職種（カテゴリ）選択・重複防止
- [ ] サイコロ実装（1〜6）
- [ ] カード抽選・重複防止・在庫管理
- [ ] スキルカード再選択防止
- [ ] 勝利判定（全員ゴール対応）
- [ ] 特殊ミッション処理（10%確率・退職＆強制兼任）

### 13.7 デプロイメント

- [ ] systemdサービス設定
- [ ] Nginxリバースプロキシ設定（WebSocketアップグレード含む）
- [ ] Let's Encrypt証明書取得
- [ ] ファイアウォール設定（80、443）
- [ ] ログローテーション設定

---

## 14. 本番運用チェックリスト

### 14.1 セキュリティ

- [ ] `.env` で強力なパスワード設定
- [ ] `.env` を `.gitignore` に追加
- [ ] HTTPS/WSS 使用
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

- Node.js 24: https://nodejs.org/
- Express.js: https://expressjs.com/
- WebSocket (ws): https://github.com/websockets/ws
- better-sqlite3: https://github.com/WiseLibs/better-sqlite3
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

**仕様書バージョン**: 1.2.1  
**最終更新日**: 2026-06-13  
**実装状況**: ✅ 本番運用可能  
**Claude再現性**: ✅ この仕様書1本でゼロから完全に再現可能

---

この仕様書に従えば、ゼロから同等のシステムを構築できます。各セクションのコードサンプルはそのまま実装に使用できます。
