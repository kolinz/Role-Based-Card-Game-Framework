// FILE: initdb.js
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

console.log('=================================');
console.log('データベース初期化スクリプト');
console.log('=================================\n');

// 既存のデータベースファイルを削除
if (fs.existsSync('./game.db')) {
    console.log('既存のデータベースを削除中...');
    fs.unlinkSync('./game.db');
    console.log('✅ 削除完了\n');
}

// 新しいデータベースを作成
console.log('新しいデータベースを作成中...');
const db = new sqlite3.Database('./game.db');

db.serialize(() => {
    console.log('テーブルを作成中...\n');

    // Mission categories
    db.run(`CREATE TABLE IF NOT EXISTS mission_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_en TEXT NOT NULL,
        name_ja TEXT NOT NULL,
        description_en TEXT,
        description_ja TEXT,
        sortOrder INTEGER DEFAULT 0,
        color TEXT DEFAULT '#667eea'
    )`, (err) => {
        if (err) console.error('Error creating mission_categories:', err);
        else console.log('✅ mission_categories テーブル作成完了');
    });

    // Job cards
    db.run(`CREATE TABLE IF NOT EXISTS job_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_en TEXT NOT NULL,
        name_ja TEXT NOT NULL,
        imageUrl TEXT,
        descriptionHtml_en TEXT,
        descriptionHtml_ja TEXT,
        targetPoints INTEGER NOT NULL
    )`, (err) => {
        if (err) console.error('Error creating job_cards:', err);
        else console.log('✅ job_cards テーブル作成完了');
    });

    // Skill cards
    db.run(`CREATE TABLE IF NOT EXISTS skill_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_en TEXT NOT NULL,
        name_ja TEXT NOT NULL,
        imageUrl TEXT,
        descriptionHtml_en TEXT,
        descriptionHtml_ja TEXT,
        matchesJobs TEXT
    )`, (err) => {
        if (err) console.error('Error creating skill_cards:', err);
        else console.log('✅ skill_cards テーブル作成完了');
    });

    // Missions
    db.run(`CREATE TABLE IF NOT EXISTS missions (
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
    )`, (err) => {
        if (err) console.error('Error creating missions:', err);
        else console.log('✅ missions テーブル作成完了');
    });

    console.log('\nサンプルデータを投入中...\n');

    // Job cards (CSVから生成)
    const jobCards = [
        ['Software Engineer', 'ソフトウェアエンジニア', null,
         '<p>Develops software applications and systems. Specializes in coding, debugging, and system architecture.</p>',
         '<p>ソフトウェアアプリケーションとシステムを開発します。コーディング、デバッグ、システムアーキテクチャを専門とします。</p>', 7],
        ['Cloud Architect', 'クラウドアーキテクト', null,
         '<p>Designs and oversees cloud infrastructure, ensuring scalability, security, and cost efficiency.</p>',
         '<p>クラウド基盤を設計・統括し、拡張性・セキュリティ・コスト効率を確保します。</p>', 7],
        ['DevOps Engineer', 'DevOpsエンジニア', null,
         '<p>Automates deployment and operations, bridging development and operations teams.</p>',
         '<p>開発と運用をつなぎ、自動化によりシステムの安定運用と迅速なリリースを支援します。</p>', 8],
        ['Cybersecurity Specialist', 'サイバーセキュリティ専門家', null,
         '<p>Protects systems and data from cyber threats through monitoring, assessment, and response.</p>',
         '<p>監視・評価・対応を通じて、システムやデータをサイバー脅威から守ります。</p>', 8],
        ['AI Engineer', 'AIエンジニア', null,
         '<p>Builds and deploys machine learning and AI models into real-world applications.</p>',
         '<p>機械学習やAIモデルを構築し、実運用システムへ組み込みます。</p>', 6],
        ['IT Governance Officer', 'ITガバナンス担当', null,
         '<p>Establishes policies and controls to ensure IT aligns with business and compliance requirements.</p>',
         '<p>ITが経営方針や法令に適合するよう、方針策定や統制を行います。</p>', 7]
    ];

    const insertJob = db.prepare('INSERT INTO job_cards (name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints) VALUES (?, ?, ?, ?, ?, ?)');
    jobCards.forEach(card => insertJob.run(card));
    insertJob.finalize(() => {
        console.log(`✅ ${jobCards.length}件の職種カードを追加`);
    });

    // Skill cards (CSVから生成)
    const skillCards = [
        ['Infrastructure as Code (IaC)', 'Infrastructure as Code（IaC）', null,
         '<p>Automating infrastructure provisioning using tools like Terraform or CloudFormation.</p>',
         '<p>TerraformやCloudFormation等で、インフラ構成をコード化して自動化します。</p>', '1,2,3'],
        ['CI/CD Pipelines', 'CI/CDパイプライン', null,
         '<p>Building automated build/test/deploy pipelines to release software safely and frequently.</p>',
         '<p>ビルド・テスト・デプロイを自動化し、安全かつ頻繁なリリースを実現します。</p>', '1,3'],
        ['Containers & Kubernetes', 'コンテナ＆Kubernetes', null,
         '<p>Packaging apps with containers and orchestrating them with Kubernetes for scalable operations.</p>',
         '<p>コンテナでアプリを配布し、Kubernetesでスケーラブルに運用します。</p>', '1,2,3'],
        ['Observability (Logs/Metrics/Traces)', 'オブザーバビリティ（ログ/メトリクス/トレース）', null,
         '<p>Monitoring system health and diagnosing issues using logs, metrics, and distributed tracing.</p>',
         '<p>ログ・メトリクス・分散トレーシングで健全性監視と障害解析を行います。</p>', '3,4'],
        ['Cloud Networking', 'クラウドネットワーク', null,
         '<p>Designing VPC/VNet, routing, DNS, and connectivity (VPN/Direct Connect) for secure cloud networks.</p>',
         '<p>VPC/VNet、ルーティング、DNS、VPN等を設計し、安全なクラウド接続を構築します。</p>', '2,3,4'],
        ['Cloud Cost Optimization (FinOps)', 'クラウドコスト最適化（FinOps）', null,
         '<p>Optimizing cloud spend through right-sizing, budgeting, and usage visibility.</p>',
         '<p>リソース最適化や予算管理、可視化によりクラウドコストを最適化します。</p>', '2'],
        ['Threat Modeling', '脅威モデリング', null,
         '<p>Identifying potential threats and designing mitigations early in the development lifecycle.</p>',
         '<p>開発初期に脅威を洗い出し、対策設計につなげます。</p>', '1,2,4'],
        ['Incident Response', 'インシデント対応', null,
         '<p>Detecting, containing, and recovering from security incidents with clear runbooks.</p>',
         '<p>手順書に基づき、検知・封じ込め・復旧を行います。</p>', '3,4'],
        ['Identity & Access Management (IAM)', 'ID・アクセス管理（IAM）', null,
         '<p>Managing authentication/authorization, least privilege, and access reviews.</p>',
         '<p>認証・認可、最小権限、アクセスレビューを管理します。</p>', '2,4,6'],
        ['Vulnerability Management', '脆弱性管理', null,
         '<p>Scanning, prioritizing, and remediating vulnerabilities across systems and applications.</p>',
         '<p>脆弱性の検出・優先度付け・修正を継続的に行います。</p>', '1,3,4'],
        ['Data Engineering Basics', 'データエンジニアリング基礎', null,
         '<p>Building reliable data pipelines, data quality checks, and storage for analytics/ML.</p>',
         '<p>分析/機械学習向けに、データパイプラインや品質管理、保存基盤を整備します。</p>', '5'],
        ['Model Deployment', 'モデルデプロイ', null,
         '<p>Packaging and serving ML models via APIs, batch jobs, or edge deployments.</p>',
         '<p>MLモデルをAPIやバッチ、エッジ等で提供できる形にして運用します。</p>', '3,5'],
        ['MLOps', 'MLOps', null,
         '<p>Operationalizing ML with versioning, monitoring, retraining, and governance.</p>',
         '<p>バージョン管理・監視・再学習・ガバナンスでMLを運用可能にします。</p>', '5,6'],
        ['Prompt Engineering', 'プロンプトエンジニアリング', null,
         '<p>Designing prompts and evaluation strategies to get reliable outputs from LLMs.</p>',
         '<p>LLMから安定した出力を得るためのプロンプト設計と評価設計。</p>', '5'],
        ['Risk Management', 'リスクマネジメント', null,
         '<p>Identifying, assessing, and tracking risks to support informed decision-making.</p>',
         '<p>リスクの特定・評価・追跡により、意思決定を支援します。</p>', '4,6'],
        ['Compliance & Policy', 'コンプライアンス＆ポリシー', null,
         '<p>Establishing policies and ensuring compliance with standards and regulations.</p>',
         '<p>方針を整備し、標準や法令への適合を確認します。</p>', '4,6'],
        ['Stakeholder Management', 'ステークホルダーマネジメント', null,
         '<p>Aligning expectations across teams and communicating trade-offs clearly.</p>',
         '<p>関係者の期待値を調整し、トレードオフを明確に伝えます。</p>', '2,6'],
        ['Unit Testing & Test Automation', 'ユニットテストとテスト自動化', null,
         '<p>Ability to design and implement unit tests and automate testing pipelines to ensure software quality</p>',
         '<p>ソフトウェア品質を確保するために、ユニットテストを設計・実装し、テスト自動化パイプラインを構築する能力。</p>', '1'],
        ['Code Refactoring & Maintainability', 'コードリファクタリングと保守性', null,
         '<p>Ability to improve existing code structure to enhance readability, performance, and maintainability.</p>',
         '<p>既存コードの構造を改善し、可読性・性能・保守性を高める能力。</p>', '1'],
        ['Model Fine-tuning & Evaluation', 'モデルのファインチューニングと評価', null,
         '<p>Ability to fine-tune machine learning models and evaluate performance using appropriate metrics.</p>',
         '<p>機械学習モデルをファインチューニングし、適切な評価指標で性能を評価する能力。</p>', '5'],
        ['AI Deployment & MLOps', 'AIデプロイとMLOps', null,
         '<p>Ability to deploy AI models and manage their lifecycle using MLOps practices.</p>',
         '<p>MLOpsの手法を用いてAIモデルをデプロイし、ライフサイクルを管理する能力。</p>', '5'],
        ['IT Policy & Compliance Management', 'ITポリシーとコンプライアンス管理', null,
         '<p>Ability to design, implement, and manage IT policies and ensure regulatory compliance.</p>',
         '<p>ITポリシーを策定・運用し、法規制や内部規程への準拠を確保する能力。</p>', '6'],
        ['Risk Assessment & Control Design', 'リスクアセスメントと統制設計', null,
         '<p>Ability to assess IT risks and design appropriate controls to mitigate them.</p>',
         '<p>ITリスクを評価し、低減するための適切な統制を設計する能力。</p>', '6']
    ];

    const insertSkill = db.prepare('INSERT INTO skill_cards (name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesJobs) VALUES (?, ?, ?, ?, ?, ?)');
    skillCards.forEach(card => insertSkill.run(card));
    insertSkill.finalize(() => {
        console.log(`✅ ${skillCards.length}件のスキルカードを追加`);
    });

    // Mission categories (新カテゴリ構成)
    const categories = [
        ['Technical Skills', 'テクニカルスキル（T）', 'Technical competencies for IT professionals', 'IT専門家に必要な技術的能力', 1, '#3b82f6'],
        ['Human Skills', 'ヒューマンスキル（H）', 'Interpersonal and communication skills', '対人関係とコミュニケーション能力', 2, '#10b981'],
        ['Conceptual Skills', 'コンセプチュアルスキル（C）', 'Strategic thinking and leadership abilities', '戦略的思考とリーダーシップ能力', 3, '#f59e0b'],
        ['Unexpected Situations', '予期せぬ事態への対応', 'Handling unexpected situations', '予期せぬ事態への対応', 4, '#ef4444']
    ];

    const insertCategory = db.prepare('INSERT INTO mission_categories (name_en, name_ja, description_en, description_ja, sortOrder, color) VALUES (?, ?, ?, ?, ?, ?)');
    categories.forEach(cat => insertCategory.run(cat));
    insertCategory.finalize(() => {
        console.log(`✅ ${categories.length}件のカテゴリを追加`);
    });

    // Missions (40個のミッション - テクニカル13枚 + ヒューマン13枚 + コンセプチュアル13枚 + 特別1枚)
    const missions = [
        // テクニカルスキル（T） - categoryId: 1 (13枚)
        ['No-Code Development Challenge', 'ノーコード開発チャレンジ', null,
         '<p>Design a simple app using no-code tools and share it in the next turn.</p>',
         '<p>ノーコードツールで簡単なアプリを構想し、次のターンで共有する</p>', 1,
         'Person who drew the card', 'カードを引いた人', 0],
        ['AI Agent Designer', 'AIエージェントの設計者', null,
         '<p>Discuss what instructions you would give to an AI agent to convey "today\'s schedule".</p>',
         '<p>AIエージェントに「今日の予定」を伝えるならどんな指示を出すか話し合う</p>', 1,
         'All players', 'プレイヤー全員で取り組む', 0],
        ['Colab Challenge', 'Colabでチャレンジ', null,
         '<p>Run "Hello, AI World!" on Google Colab and report the results in the next turn.</p>',
         '<p>Google Colabで「Hello, AI World!」を実行し、次ターンで結果を報告する</p>', 1,
         'Person who drew the card', 'カードを引いた人', 0],
        ['Cloud Architecture Map', 'クラウド構成マップ作成', null,
         '<p>Draw and explain a web app architecture (frontend, backend, DB) on paper.</p>',
         '<p>Webアプリの構成（フロント・バック・DB）を紙に描き、説明する</p>', 1,
         'Left neighbor', '左隣の人と取り組む', 0],
        ['Server Carrying Training', 'サーバー運搬訓練', null,
         '<p>Do 10 squats as "server carrying preparation" and discuss the importance of physical strength.</p>',
         '<p>「サーバーを運ぶ準備」としてスクワット10回！終わったら体力の重要性を話す</p>', 1,
         'All players', 'プレイヤー全員で取り組む', 0],
        ['AI Tool Comparison', 'AIツール比較', null,
         '<p>Compare ChatGPT with other AI tools and present in the next turn.</p>',
         '<p>ChatGPTと他のAIツールを比較し、次ターンで発表する</p>', 1,
         'Person who drew the card', 'カードを引いた人', 0],
        ['Automation Ideas', '自動化アイデア発表', null,
         '<p>Brainstorm ideas on how to automate workplace tasks.</p>',
         '<p>職場の作業を自動化するにはどうするか、アイデアを出し合う</p>', 1,
         'Right neighbor', '右隣の人と取り組む', 0],
        ['Version Control Experience', 'バージョン管理体験', null,
         '<p>Explain the importance of version control with examples.</p>',
         '<p>バージョン管理の重要性を例を挙げて説明する</p>', 1,
         'Person who drew the card', 'カードを引いた人', 0],
        ['Security Quiz', 'セキュリティクイズ', null,
         '<p>List three ways to create a secure password.</p>',
         '<p>安全なパスワードの作り方を3つ挙げる</p>', 1,
         'All players', 'プレイヤー全員で取り組む', 0],
        ['Data Analysis Challenge', 'データ分析チャレンジ', null,
         '<p>Think of data visualization ideas and present in the next turn.</p>',
         '<p>データの可視化アイデアを考え、次ターンで発表する</p>', 1,
         'Person who drew the card', 'カードを引いた人', 0],
        ['API Exploration', 'API探索', null,
         '<p>Research one useful API and introduce it in the next turn.</p>',
         '<p>便利なAPIを1つ調べて、次ターンで紹介する</p>', 1,
         'Person who drew the card', 'カードを引いた人', 0],
        ['Programming Consultation', 'プログラミング相談会', null,
         '<p>Share solutions for when you get stuck on coding.</p>',
         '<p>コードで詰まったときの解決法を全員で共有する</p>', 1,
         'All players', 'プレイヤー全員で取り組む', 0],
        ['Shortcut Discovery', 'ショートカット発見', null,
         '<p>Share commonly used shortcuts with everyone.</p>',
         '<p>よく使うショートカットを全員に共有する</p>', 1,
         'Person who drew the card', 'カードを引いた人', 0],

        // ヒューマンスキル（H） - categoryId: 2 (13枚)
        ['Pair App Planning', 'ペアアプリ企画', null,
         '<p>Think of a no-code app idea together.</p>',
         '<p>ノーコードアプリのアイデアを一緒に考える</p>', 2,
         'Left neighbor', '左隣の人と取り組む', 0],
        ['Team AI Strategy Meeting', 'チームAI活用戦略会議', null,
         '<p>Discuss how the team can utilize AI and present in the next turn.</p>',
         '<p>チームでAIをどう活用できるか次ターンで発表する</p>', 2,
         'All players', 'プレイヤー全員で取り組む', 0],
        ['Squat Solidarity', 'スクワット連帯感', null,
         '<p>Do 5 squats together and discuss the relationship with concentration.</p>',
         '<p>全員でスクワット5回して集中力の関係を話す</p>', 2,
         'All players', 'プレイヤー全員で取り組む', 0],
        ['Programming Question Practice', 'プログラミング質問練習', null,
         '<p>Practice asking questions and discuss improvements.</p>',
         '<p>質問の仕方を練習し、改善点を話し合う</p>', 2,
         'Right neighbor', '右隣の人と取り組む', 0],
        ['Pair Review Experience', 'ペアレビュー体験', null,
         '<p>Discuss attitudes during code reviews.</p>',
         '<p>コードレビューでの態度について話す</p>', 2,
         'Right neighbor', '右隣の人と取り組む', 0],
        ['Team Development Simulation', 'チーム開発シミュレーション', null,
         '<p>Explain the development flow with role assignments.</p>',
         '<p>チームで開発の流れを役割分担して説明する</p>', 2,
         'All players', 'プレイヤー全員で取り組む', 0],
        ['Online Morning Meeting', 'オンライン朝会', null,
         '<p>Recreate a virtual morning meeting with 1-minute self-introductions.</p>',
         '<p>仮想の朝会を再現して1分自己紹介する</p>', 2,
         'All players', 'プレイヤー全員で取り組む', 0],
        ['Consultation Time', '相談タイム', null,
         '<p>Share concerns and get advice.</p>',
         '<p>悩みを共有し、アドバイスをもらう</p>', 2,
         'Left neighbor', '左隣の人と取り組む', 0],
        ['Gratitude and Improvement', '感謝と改善', null,
         '<p>Tell your neighbor what they did well and what can be improved.</p>',
         '<p>隣の人に良かった点と改善点を伝える</p>', 2,
         'Right neighbor', '右隣の人と取り組む', 0],
        ['Team Rules Making', 'チームルール作り', null,
         '<p>Think of 3 team rules by the next turn and share.</p>',
         '<p>次ターンまでにチームルール3つを考えて共有する</p>', 2,
         'All players', 'プレイヤー全員で取り組む', 0],
        ['Ideas from Casual Talk', '雑談から企画', null,
         '<p>Come up with new ideas from casual conversation.</p>',
         '<p>雑談から新しいアイデアを発想する</p>', 2,
         'Left neighbor', '左隣の人と取り組む', 0],
        ['Empathy Training', '共感トレーニング', null,
         '<p>Respond to the other person\'s story using "I see" three times.</p>',
         '<p>相手の話に「そうですね」を3回使って返す</p>', 2,
         'Right neighbor', '右隣の人と取り組む', 0],
        ['Team Retrospective Meeting', 'チームふりかえり会議', null,
         '<p>Share good points and improvements from recent activities as a team.</p>',
         '<p>チーム全員で直近の活動をふりかえり、良かった点・改善点を共有する</p>', 2,
         'All players', 'プレイヤー全員で取り組む', 0],

        // コンセプチュアルスキル（C） - categoryId: 3 (13枚)
        ['Future Work Style Forecast', '働き方未来予測', null,
         '<p>Present your ideal work style in 10 years.</p>',
         '<p>10年後の理想の働き方を発表する</p>', 3,
         'Person who drew the card', 'カードを引いた人', 0],
        ['New Service Concept', '新サービス構想', null,
         '<p>Think of a new IT service idea and present in the next turn.</p>',
         '<p>新しいITサービス案を考え次ターンで発表する</p>', 3,
         'All players', 'プレイヤー全員で取り組む', 0],
        ['Issue Discovery Workshop', '課題発見ワーク', null,
         '<p>Identify workplace issues and propose solutions in the next turn.</p>',
         '<p>現場の課題を挙げ次ターンで解決案を提示する</p>', 3,
         'Person who drew the card', 'カードを引いた人', 0],
        ['Career Plan Presentation', 'キャリアプラン発表', null,
         '<p>Talk about your future vision.</p>',
         '<p>自分の将来ビジョンを話す</p>', 3,
         'Person who drew the card', 'カードを引いた人', 0],
        ['Team Structure Design', 'チーム構成設計', null,
         '<p>Think of an ideal team structure and share.</p>',
         '<p>理想のチーム構成を考えて共有する</p>', 3,
         'Left neighbor', '左隣の人と取り組む', 0],
        ['KGI Definition', 'KGI定義', null,
         '<p>Define the team\'s goal and present in the next turn.</p>',
         '<p>チームのゴールを定義し次ターンで発表する</p>', 3,
         'All players', 'プレイヤー全員で取り組む', 0],
        ['Goal Setting Challenge', '目標設定チャレンジ', null,
         '<p>Set your own goal and report in the next turn.</p>',
         '<p>自分の目標を設定し次ターンで報告する</p>', 3,
         'Person who drew the card', 'カードを引いた人', 0],
        ['Concept Naming', 'コンセプトネーミング', null,
         '<p>Come up with a new project name on the spot.</p>',
         '<p>新プロジェクト名を即興で考える</p>', 3,
         'Right neighbor', '右隣の人と取り組む', 0],
        ['Work Style Policy Development', '働き方ポリシー策定', null,
         '<p>Decide team work rules and present in the next turn.</p>',
         '<p>チームで勤務ルールを決め次ターンで発表する</p>', 3,
         'All players', 'プレイヤー全員で取り組む', 0],
        ['Team Vision Sharing', 'チームビジョン共有', null,
         '<p>Assuming all players are executives of the same company, discuss and share the company\'s future vision.</p>',
         '<p>プレイヤー全員が同じ会社の役員という前提で、会社の未来像を話し合い共有する</p>', 3,
         'All players', 'プレイヤー全員で取り組む', 0],
        ['Decision Making Role-play', '意思決定ロールプレイ', null,
         '<p>Discuss how to make difficult decisions like team reduction or project cancellation in the next turn.</p>',
         '<p>チームメンバー削減や開発中止など難しい判断をどう下すかを次ターンで話す</p>', 3,
         'Left neighbor', '左隣の人と取り組む', 0],
        ['Self-Growth Map', '自己成長マップ', null,
         '<p>Organize what is necessary for your growth and report in the next turn.</p>',
         '<p>自分の成長に必要なことを整理し次ターンで報告する</p>', 3,
         'Person who drew the card', 'カードを引いた人', 0],
        ['Rediscovering Meaning of Work', '働く意義の再発見', null,
         '<p>Discuss "the meaning of work" with everyone.</p>',
         '<p>「働く意味」を全員と話す</p>', 3,
         'All players', 'プレイヤー全員で取り組む', 0],

        // 予期せぬ事態への対応 - categoryId: 4 (1枚 - 特別ミッション)
        ['Resignation & Forced Dual Role', '退職に伴う兼任', null,
         '<p><strong>SPECIAL MISSION:</strong> You must resign immediately and assign your job to another player. That player now has dual responsibilities!</p>',
         '<p><strong>特別ミッション:</strong> あなたは即座に退職し、あなたの職種を別のプレイヤーに割り当てる必要があります。そのプレイヤーは二重の責任を負うことになります!</p>', 4,
         'Execute resignation and job transfer', '退職と職種移譲を実行', 1]
    ];

    const insertMission = db.prepare('INSERT INTO missions (name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, categoryId, target_en, target_ja, isSpecial) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    missions.forEach(mission => insertMission.run(mission));
    insertMission.finalize(() => {
        console.log(`✅ ${missions.length}件のミッションカードを追加`);
    });
});

db.close((err) => {
    if (err) {
        console.error('\n❌ エラーが発生しました:', err);
        process.exit(1);
    } else {
        console.log('\n=================================');
        console.log('✅ データベース初期化完了！');
        console.log('=================================');
        console.log('\nサーバーを起動するには:');
        console.log('  npm start');
        console.log('');
        process.exit(0);
    }
});
