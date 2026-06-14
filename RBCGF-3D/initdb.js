'use strict';

const fs       = require('fs');
const Database = require('better-sqlite3');

// ── 1. 既存DBを削除して新規作成 ──────────────────────────────
if (fs.existsSync('./game.db')) fs.unlinkSync('./game.db');
const db = new Database('./game.db');

// ── 2. テーブル一括作成 ──────────────────────────────────────
db.exec(`
CREATE TABLE mission_categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en     TEXT NOT NULL,
    name_ja     TEXT NOT NULL,
    description_en TEXT,
    description_ja TEXT,
    sortOrder   INTEGER DEFAULT 0
);

CREATE TABLE category_cards (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en             TEXT NOT NULL,
    name_ja             TEXT NOT NULL,
    imageUrl            TEXT,
    descriptionHtml_en  TEXT,
    descriptionHtml_ja  TEXT,
    targetPoints        INTEGER NOT NULL
);

CREATE TABLE skill_types (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en        TEXT NOT NULL,
    name_ja        TEXT NOT NULL,
    model_type     TEXT NOT NULL DEFAULT 'katz',
    description_en TEXT,
    description_ja TEXT,
    sortOrder      INTEGER DEFAULT 0
);

CREATE TABLE skill_cards (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en             TEXT NOT NULL,
    name_ja             TEXT NOT NULL,
    imageUrl            TEXT,
    descriptionHtml_en  TEXT,
    descriptionHtml_ja  TEXT,
    matchesCategories   TEXT
);

CREATE TABLE missions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en             TEXT,
    name_ja             TEXT,
    imageUrl            TEXT,
    descriptionHtml_en  TEXT NOT NULL,
    descriptionHtml_ja  TEXT NOT NULL,
    categoryId          INTEGER,
    target_en           TEXT,
    target_ja           TEXT,
    isSpecial           INTEGER DEFAULT 0,
    FOREIGN KEY(categoryId) REFERENCES mission_categories(id)
);
`);

// ── 3. mission_categories（4件）────────────────────────────────
const insMC = db.prepare(
    'INSERT INTO mission_categories (name_en, name_ja, description_en, description_ja, sortOrder) VALUES (?,?,?,?,?)'
);
insMC.run('Crisis Management',   '危機管理',         'Handle unexpected situations',           '予期しない状況に対処する',         1);
insMC.run('Decision Making',     '意思決定',         'Make choices under uncertainty',         '不確実な状況下での意思決定',         2);
insMC.run('Communication',       'コミュニケーション', 'Share information effectively',          '情報を効果的に共有する',             3);
insMC.run('Resource Management', 'リソース管理',     'Allocate time, people, and budget wisely','時間・人・予算を適切に配分する',     4);

// ── 4. category_cards（6件）────────────────────────────────────
// ID: 1=Engineer, 2=Designer, 3=PM, 4=QA, 5=DevOps, 6=DataAnalyst
const insCat = db.prepare(
    'INSERT INTO category_cards (name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints) VALUES (?,?,?,?,?,?)'
);
insCat.run('Engineer',            'エンジニア',             null,
    '<p>Designs and builds software systems.</p>',
    '<p>ソフトウェアシステムの設計・開発を行います。</p>', 5);
insCat.run('Designer',            'デザイナー',             null,
    '<p>Creates user interfaces and visual design.</p>',
    '<p>UIデザインやビジュアルデザインを担当します。</p>', 4);
insCat.run('Project Manager',     'プロジェクトマネージャー', null,
    '<p>Plans and oversees project execution.</p>',
    '<p>プロジェクトの計画・推進・管理を行います。</p>', 4);
insCat.run('QA Engineer',         'QAエンジニア',           null,
    '<p>Ensures quality through testing and validation.</p>',
    '<p>テストと検証を通じて品質を保証します。</p>', 3);
insCat.run('DevOps Engineer',     'DevOpsエンジニア',       null,
    '<p>Bridges development and operations for continuous delivery.</p>',
    '<p>開発と運用を橋渡しし、継続的デリバリーを実現します。</p>', 5);
insCat.run('Data Analyst',        'データアナリスト',       null,
    '<p>Analyzes data to drive business insights.</p>',
    '<p>データを分析してビジネスの意思決定を支援します。</p>', 4);

// ── 5. skill_types（3件 / Katz モデル固定）────────────────────
const insST = db.prepare(
    'INSERT INTO skill_types (name_en, name_ja, model_type, description_en, description_ja, sortOrder) VALUES (?,?,?,?,?,?)'
);
insST.run('Technical Skill',    'テクニカルスキル',    'katz',
    'Specialized knowledge and abilities in a specific field.',
    '特定の分野における専門的な知識・技術。', 1);
insST.run('Human Skill',        'ヒューマンスキル',    'katz',
    'Ability to work with and through other people.',
    '人と協力して働く能力・対人スキル。', 2);
insST.run('Conceptual Skill',   'コンセプチュアルスキル', 'katz',
    'Ability to see the organization as a whole and understand complex situations.',
    '組織全体を俯瞰し、複雑な状況を理解・判断する能力。', 3);

// ── 6. skill_cards（23件）─────────────────────────────────────
// category_cards ID: 1=Engineer, 2=Designer, 3=PM, 4=QA, 5=DevOps, 6=DataAnalyst
// skill_type: Technical(sortOrder=1), Human(sortOrder=2), Conceptual(sortOrder=3)
const insSC = db.prepare(
    'INSERT INTO skill_cards (name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesCategories) VALUES (?,?,?,?,?,?)'
);

// ── テクニカルスキル（9件）
insSC.run('Programming',          'プログラミング',
    null,
    '<p>Write clean, efficient code to build software.</p>',
    '<p>クリーンで効率的なコードを書いてソフトウェアを構築します。</p>',
    '1,5');
insSC.run('System Design',        'システム設計',
    null,
    '<p>Design scalable and reliable system architecture.</p>',
    '<p>スケーラブルで信頼性の高いシステムアーキテクチャを設計します。</p>',
    '1,3,5');
insSC.run('Database Management',  'データベース管理',
    null,
    '<p>Design and optimize database schemas and queries.</p>',
    '<p>DBスキーマの設計とクエリの最適化を行います。</p>',
    '1,5,6');
insSC.run('UI/UX Design',         'UI/UXデザイン',
    null,
    '<p>Create intuitive user interfaces and experiences.</p>',
    '<p>直感的なUIとUXを設計・制作します。</p>',
    '2,3');
insSC.run('Test Automation',      'テスト自動化',
    null,
    '<p>Build automated test suites to ensure quality.</p>',
    '<p>自動テストスイートを構築して品質を担保します。</p>',
    '1,4,5');
insSC.run('CI/CD Pipeline',       'CI/CDパイプライン',
    null,
    '<p>Set up continuous integration and deployment workflows.</p>',
    '<p>継続的インテグレーション・デプロイのワークフローを構築します。</p>',
    '5,1');
insSC.run('Data Analysis',        'データ分析',
    null,
    '<p>Analyze datasets to extract meaningful insights.</p>',
    '<p>データセットを分析して意味のある洞察を引き出します。</p>',
    '6,1');
insSC.run('Security Hardening',   'セキュリティ強化',
    null,
    '<p>Identify and mitigate security vulnerabilities.</p>',
    '<p>セキュリティ脆弱性を特定して対策を実施します。</p>',
    '1,4,5');
insSC.run('Prototyping',          'プロトタイピング',
    null,
    '<p>Quickly build prototypes to validate ideas.</p>',
    '<p>アイデアを素早く検証するためのプロトタイプを作成します。</p>',
    '2,1');

// ── ヒューマンスキル（8件）
insSC.run('Team Collaboration',   'チームコラボレーション',
    null,
    '<p>Work effectively with team members toward shared goals.</p>',
    '<p>共通のゴールに向けてチームメンバーと効果的に協働します。</p>',
    '1,2,3,4,5,6');
insSC.run('Active Listening',     'アクティブリスニング',
    null,
    '<p>Listen carefully and understand others\' perspectives.</p>',
    '<p>注意深く傾聴し、他者の視点を理解します。</p>',
    '3,2,6');
insSC.run('Conflict Resolution',  'コンフリクト解決',
    null,
    '<p>Mediate disputes and find mutually beneficial solutions.</p>',
    '<p>対立を仲裁して相互に利益のある解決策を見つけます。</p>',
    '3,2');
insSC.run('Mentoring',            'メンタリング',
    null,
    '<p>Guide and support the growth of team members.</p>',
    '<p>チームメンバーの成長をガイドし支援します。</p>',
    '3,1,5');
insSC.run('Presentation Skills',  'プレゼンテーション',
    null,
    '<p>Communicate ideas clearly to diverse audiences.</p>',
    '<p>多様な聴衆に対してアイデアを明確に伝えます。</p>',
    '3,2,6');
insSC.run('Stakeholder Management','ステークホルダー管理',
    null,
    '<p>Build and maintain relationships with key stakeholders.</p>',
    '<p>主要なステークホルダーとの関係を構築・維持します。</p>',
    '3,2');
insSC.run('Feedback Giving',      'フィードバック',
    null,
    '<p>Provide constructive feedback to help others improve.</p>',
    '<p>他者の成長を促す建設的なフィードバックを提供します。</p>',
    '3,4,2');
insSC.run('Cross-functional Coordination', 'クロスファンクション調整',
    null,
    '<p>Coordinate work across different teams and functions.</p>',
    '<p>異なるチームや機能をまたいで業務を調整します。</p>',
    '3,5');

// ── コンセプチュアルスキル（6件）
insSC.run('Strategic Thinking',   '戦略的思考',
    null,
    '<p>See the big picture and align actions with long-term goals.</p>',
    '<p>全体像を把握し、行動を長期的な目標に合わせます。</p>',
    '3,6');
insSC.run('Risk Assessment',      'リスクアセスメント',
    null,
    '<p>Identify, evaluate, and prioritize potential risks.</p>',
    '<p>潜在的なリスクを特定・評価・優先順位付けします。</p>',
    '3,4,5');
insSC.run('Innovation Mindset',   'イノベーション思考',
    null,
    '<p>Challenge assumptions and generate creative solutions.</p>',
    '<p>前提を疑い、創造的な解決策を生み出します。</p>',
    '2,3,6');
insSC.run('Problem Structuring',  '問題構造化',
    null,
    '<p>Break down complex problems into manageable components.</p>',
    '<p>複雑な問題を管理しやすいコンポーネントに分解します。</p>',
    '3,1,6');
insSC.run('Business Acumen',      'ビジネス感覚',
    null,
    '<p>Understand business models and how decisions impact outcomes.</p>',
    '<p>ビジネスモデルと意思決定が成果に与える影響を理解します。</p>',
    '3,6');
insSC.run('Systems Thinking',     'システム思考',
    null,
    '<p>Understand how components interact within the larger system.</p>',
    '<p>コンポーネントがより大きなシステム内でどう相互作用するかを理解します。</p>',
    '1,3,5,6');

// ── 7. missions（40件: 通常39件 + 特殊1件）───────────────────
// categoryId: 1=Crisis Mgmt, 2=Decision Making, 3=Communication, 4=Resource Mgmt
const insM = db.prepare(
    'INSERT INTO missions (name_en, name_ja, descriptionHtml_en, descriptionHtml_ja, categoryId, target_en, target_ja, isSpecial) VALUES (?,?,?,?,?,?,?,?)'
);

// Crisis Management (categoryId=1) — 10件
insM.run('System Outage',         'システム障害',
    '<p>A critical system goes down. Discuss the immediate response plan.</p>',
    '<p>重要なシステムがダウンした。即時対応計画について議論しなさい。</p>',
    1, 'Team', 'チーム', 0);
insM.run('Data Breach',           'データ漏洩',
    '<p>Customer data has been exposed. What are the first actions?</p>',
    '<p>顧客データが流出した。最初に取るべき行動は何か？</p>',
    1, 'Team', 'チーム', 0);
insM.run('Key Member Absent',     '主要メンバー欠席',
    '<p>A critical team member is suddenly unavailable. How do you adapt?</p>',
    '<p>重要なメンバーが突然離脱した。どう対応するか？</p>',
    1, 'Individual', '個人', 0);
insM.run('Budget Cut',            '予算削減',
    '<p>30% budget cut announced mid-project. Re-prioritize your plan.</p>',
    '<p>プロジェクト中盤で30%の予算削減が発表された。計画を再優先化せよ。</p>',
    1, 'Team', 'チーム', 0);
insM.run('Scope Creep',           'スコープクリープ',
    '<p>Stakeholders keep adding requirements. Discuss how to manage this.</p>',
    '<p>ステークホルダーが次々と要件を追加してくる。管理方法を議論せよ。</p>',
    1, 'Team', 'チーム', 0);
insM.run('Deadline Conflict',     '締切の衝突',
    '<p>Two critical deadlines overlap. How will you handle both?</p>',
    '<p>重要な締切が重なった。両方どう対処するか？</p>',
    1, 'Individual', '個人', 0);
insM.run('Vendor Failure',        'ベンダー障害',
    '<p>A key vendor fails to deliver. What is your contingency plan?</p>',
    '<p>主要ベンダーが納品できなくなった。コンティンジェンシープランは？</p>',
    1, 'Team', 'チーム', 0);
insM.run('Negative Press',        'ネガティブ報道',
    '<p>Negative news about the project surfaces. How do you respond?</p>',
    '<p>プロジェクトに関するネガティブな報道が出た。どう対応するか？</p>',
    1, 'Team', 'チーム', 0);
insM.run('Technical Debt Crisis', '技術的負債の危機',
    '<p>Technical debt is blocking new features. Present your resolution plan.</p>',
    '<p>技術的負債が新機能開発を阻んでいる。解消計画を提示せよ。</p>',
    1, 'Individual', '個人', 0);
insM.run('Team Burnout',          'チームの燃え尽き',
    '<p>The team shows signs of burnout. Discuss how to restore morale.</p>',
    '<p>チームに燃え尽き症状が出ている。士気回復策を議論せよ。</p>',
    1, 'Team', 'チーム', 0);

// Decision Making (categoryId=2) — 10件
insM.run('Build vs Buy',          'ビルドvsバイ',
    '<p>Should you build in-house or buy a third-party solution?</p>',
    '<p>内製すべきかサードパーティ製品を買うべきか？</p>',
    2, 'Team', 'チーム', 0);
insM.run('Technology Choice',     '技術選定',
    '<p>Choose between two competing technology stacks. Justify your choice.</p>',
    '<p>2つの技術スタックからひとつを選択し、その理由を述べよ。</p>',
    2, 'Individual', '個人', 0);
insM.run('Feature Prioritization','機能の優先順位付け',
    '<p>10 features, time for 3. How do you decide which ones to build?</p>',
    '<p>10機能あるが時間は3機能分。どれを作るか判断せよ。</p>',
    2, 'Team', 'チーム', 0);
insM.run('Hire or Outsource',     '採用かアウトソース',
    '<p>Decide whether to hire full-time staff or outsource the work.</p>',
    '<p>正社員採用かアウトソースかを判断せよ。</p>',
    2, 'Team', 'チーム', 0);
insM.run('Release Decision',      'リリース判断',
    '<p>The product has a minor bug. Do you release on schedule or delay?</p>',
    '<p>軽微なバグがある。予定通りリリースするか延期するか？</p>',
    2, 'Individual', '個人', 0);
insM.run('Pivot or Persist',      'ピボットか継続か',
    '<p>Early data suggests the product is not gaining traction. Pivot or persist?</p>',
    '<p>初期データで製品の伸びが鈍い。方向転換すべきか続けるべきか？</p>',
    2, 'Team', 'チーム', 0);
insM.run('Remote vs On-site',     'リモートかオンサイト',
    '<p>Should the team work remotely or on-site? Make the case.</p>',
    '<p>チームはリモートとオンサイトどちらで働くべきか議論せよ。</p>',
    2, 'Team', 'チーム', 0);
insM.run('MVP Scope',             'MVPスコープ',
    '<p>Define the minimum viable product for your project.</p>',
    '<p>プロジェクトのMVPを定義せよ。</p>',
    2, 'Individual', '個人', 0);
insM.run('Metrics Selection',     'メトリクス選定',
    '<p>What KPIs will you track to measure project success?</p>',
    '<p>プロジェクト成功を測るKPIは何を設定するか？</p>',
    2, 'Individual', '個人', 0);
insM.run('Team Structure',        'チーム構成',
    '<p>Redesign your team structure for maximum efficiency.</p>',
    '<p>最大効率を実現するチーム構成を再設計せよ。</p>',
    2, 'Team', 'チーム', 0);

// Communication (categoryId=3) — 10件
insM.run('Status Report',         'ステータスレポート',
    '<p>Deliver a project status update to executive stakeholders.</p>',
    '<p>経営幹部向けにプロジェクトのステータスを報告せよ。</p>',
    3, 'Individual', '個人', 0);
insM.run('Bad News Delivery',     '悪いニュースの伝え方',
    '<p>How do you communicate a major delay to the client?</p>',
    '<p>大幅な遅延をクライアントにどう伝えるか？</p>',
    3, 'Individual', '個人', 0);
insM.run('Cross-team Alignment',  'チーム間連携',
    '<p>Two teams have misaligned goals. Facilitate alignment.</p>',
    '<p>2チームの目標が合っていない。調整を促進せよ。</p>',
    3, 'Team', 'チーム', 0);
insM.run('Requirements Gathering','要件収集',
    '<p>Conduct a requirements gathering session with stakeholders.</p>',
    '<p>ステークホルダーとの要件収集セッションを実施せよ。</p>',
    3, 'Team', 'チーム', 0);
insM.run('Retrospective Facilitation', 'レトロスペクティブ',
    '<p>Facilitate a team retrospective to surface improvement points.</p>',
    '<p>改善点を引き出すレトロスペクティブをファシリテートせよ。</p>',
    3, 'Team', 'チーム', 0);
insM.run('Onboarding Plan',       'オンボーディング計画',
    '<p>Design an onboarding plan for a new team member.</p>',
    '<p>新メンバー向けオンボーディング計画を設計せよ。</p>',
    3, 'Individual', '個人', 0);
insM.run('Technical Explanation', '技術説明',
    '<p>Explain a complex technical concept to a non-technical audience.</p>',
    '<p>複雑な技術的概念を非技術者に説明せよ。</p>',
    3, 'Individual', '個人', 0);
insM.run('Negotiation',           '交渉',
    '<p>Negotiate a deadline extension with a client.</p>',
    '<p>クライアントと締切延長の交渉をせよ。</p>',
    3, 'Individual', '個人', 0);
insM.run('Knowledge Sharing',     '知識共有',
    '<p>Plan a knowledge sharing session for your team.</p>',
    '<p>チーム向けの知識共有セッションを計画せよ。</p>',
    3, 'Team', 'チーム', 0);
insM.run('Meeting Facilitation',  'ミーティングファシリテーション',
    '<p>Facilitate an efficient decision-making meeting.</p>',
    '<p>効率的な意思決定ミーティングをファシリテートせよ。</p>',
    3, 'Team', 'チーム', 0);

// Resource Management (categoryId=4) — 9件（通常）
insM.run('Sprint Planning',       'スプリント計画',
    '<p>Plan a 2-week sprint with the resources available.</p>',
    '<p>利用可能なリソースで2週間スプリントを計画せよ。</p>',
    4, 'Team', 'チーム', 0);
insM.run('Capacity Planning',     'キャパシティ計画',
    '<p>Estimate team capacity for the next quarter.</p>',
    '<p>次四半期のチームキャパシティを見積もれ。</p>',
    4, 'Individual', '個人', 0);
insM.run('Tool Selection',        'ツール選定',
    '<p>Select the right tools for your project within budget.</p>',
    '<p>予算内でプロジェクトに適切なツールを選定せよ。</p>',
    4, 'Team', 'チーム', 0);
insM.run('Time Management',       'タイムマネジメント',
    '<p>Share your personal strategy for managing competing priorities.</p>',
    '<p>競合する優先事項を管理するための個人的な戦略を共有せよ。</p>',
    4, 'Individual', '個人', 0);
insM.run('Cost Optimization',     'コスト最適化',
    '<p>Reduce project costs by 20% without impacting quality.</p>',
    '<p>品質を落とさずにプロジェクトコストを20%削減せよ。</p>',
    4, 'Team', 'チーム', 0);
insM.run('Skill Gap Analysis',    'スキルギャップ分析',
    '<p>Identify skill gaps in your team and plan to address them.</p>',
    '<p>チームのスキルギャップを特定して対応計画を立てよ。</p>',
    4, 'Team', 'チーム', 0);
insM.run('Workload Distribution', '作業分担',
    '<p>Distribute tasks fairly and efficiently across the team.</p>',
    '<p>チーム全体に公平かつ効率的にタスクを分担せよ。</p>',
    4, 'Team', 'チーム', 0);
insM.run('Infrastructure Scaling','インフラスケーリング',
    '<p>Plan for scaling infrastructure as user demand grows.</p>',
    '<p>ユーザー需要の増加に合わせたインフラ拡張計画を立てよ。</p>',
    4, 'Individual', '個人', 0);
insM.run('Documentation Plan',    'ドキュメント計画',
    '<p>Create a plan to improve project documentation coverage.</p>',
    '<p>プロジェクトドキュメントのカバレッジを改善する計画を作れ。</p>',
    4, 'Individual', '個人', 0);

// 特殊ミッション（isSpecial=1）— 1件
insM.run('Retirement & Forced Concurrent',  '退職&強制兼任',
    '<p>SPECIAL: A player retires and their roles are transferred to another player.</p>',
    '<p>【特殊】あるプレイヤーが退職し、担当職種が別プレイヤーに引き継がれます。</p>',
    null, 'Team', 'チーム', 1);

// ── 8. 完了メッセージ ─────────────────────────────────────────
console.log('Database initialized successfully!');
console.log('Tables: mission_categories(4), category_cards(6), skill_types(3), skill_cards(23), missions(40)');
