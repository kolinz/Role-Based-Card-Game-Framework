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
        sortOrder INTEGER DEFAULT 0
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

    // Job cards
    const jobCards = [
        ['Software Engineer', 'ソフトウェアエンジニア', '/assets/cards/job1.png',
         '<p>Develops software applications and systems. Specializes in coding, debugging, and system architecture.</p>',
         '<p>ソフトウェアアプリケーションとシステムを開発します。コーディング、デバッグ、システムアーキテクチャを専門とします。</p>', 5],
        ['Product Manager', 'プロダクトマネージャー', '/assets/cards/job2.png',
         '<p>Manages product development from concept to launch. Coordinates teams and defines product vision.</p>',
         '<p>コンセプトから立ち上げまでの製品開発を管理します。チームを調整し、製品ビジョンを定義します。</p>', 6],
        ['Data Scientist', 'データサイエンティスト', '/assets/cards/job3.png',
         '<p>Analyzes complex data to help organizations make decisions. Uses statistics and machine learning.</p>',
         '<p>複雑なデータを分析し、組織の意思決定を支援します。統計学と機械学習を使用します。</p>', 5],
        ['UX Designer', 'UXデザイナー', '/assets/cards/job4.png',
         '<p>Creates user-centered designs for digital products. Focuses on user research and interface design.</p>',
         '<p>デジタル製品のユーザー中心のデザインを作成します。ユーザーリサーチとインターフェースデザインに焦点を当てます。</p>', 5]
    ];

    const insertJob = db.prepare('INSERT INTO job_cards (name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints) VALUES (?, ?, ?, ?, ?, ?)');
    jobCards.forEach(card => insertJob.run(card));
    insertJob.finalize(() => {
        console.log(`✅ ${jobCards.length}件の職種カードを追加`);
    });

    // Skill cards
    const skillCards = [
        ['Python Programming', 'Pythonプログラミング', '/assets/cards/skill1.png',
         '<p>Proficiency in Python for backend development and data analysis.</p>',
         '<p>バックエンド開発とデータ分析のためのPython習熟度。</p>', '1,3'],
        ['User Research', 'ユーザーリサーチ', '/assets/cards/skill2.png',
         '<p>Conducting interviews and surveys to understand user needs.</p>',
         '<p>ユーザーのニーズを理解するためのインタビューと調査の実施。</p>', '2,4'],
        ['Data Visualization', 'データ可視化', '/assets/cards/skill3.png',
         '<p>Creating charts and dashboards to communicate insights.</p>',
         '<p>インサイトを伝えるためのチャートとダッシュボードの作成。</p>', '3'],
        ['Agile Methods', 'アジャイル手法', '/assets/cards/skill4.png',
         '<p>Managing projects using Scrum and Kanban methodologies.</p>',
         '<p>ScrumとKanban方法論を使用したプロジェクト管理。</p>', '1,2'],
        ['Prototyping', 'プロトタイピング', '/assets/cards/skill5.png',
         '<p>Building interactive prototypes with Figma and similar tools.</p>',
         '<p>Figmaなどのツールでインタラクティブなプロトタイプを構築。</p>', '4'],
        ['Machine Learning', '機械学習', '/assets/cards/skill6.png',
         '<p>Developing AI models for predictions and automation.</p>',
         '<p>予測と自動化のためのAIモデル開発。</p>', '3'],
        ['API Design', 'API設計', '/assets/cards/skill7.png',
         '<p>Creating RESTful and GraphQL APIs for applications.</p>',
         '<p>アプリケーション用のRESTfulおよびGraphQL APIの作成。</p>', '1'],
        ['Market Analysis', '市場分析', '/assets/cards/skill8.png',
         '<p>Analyzing market trends and competitive landscapes.</p>',
         '<p>市場動向と競合環境の分析。</p>', '2']
    ];

    const insertSkill = db.prepare('INSERT INTO skill_cards (name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesJobs) VALUES (?, ?, ?, ?, ?, ?)');
    skillCards.forEach(card => insertSkill.run(card));
    insertSkill.finalize(() => {
        console.log(`✅ ${skillCards.length}件のスキルカードを追加`);
    });

    // Mission categories
    const categories = [
        ['Crisis Management', '危機管理', 'Handling unexpected issues', '予期せぬ問題への対応', 1],
        ['Decision Making', '意思決定', 'Making strategic choices', '戦略的な選択', 2],
        ['Communication', 'コミュニケーション', 'Team coordination', 'チーム調整', 3],
        ['Resource Management', 'リソース管理', 'Budget and time management', '予算と時間管理', 4]
    ];

    const insertCategory = db.prepare('INSERT INTO mission_categories (name_en, name_ja, description_en, description_ja, sortOrder) VALUES (?, ?, ?, ?, ?)');
    categories.forEach(cat => insertCategory.run(cat));
    insertCategory.finalize(() => {
        console.log(`✅ ${categories.length}件のカテゴリを追加`);
    });

    // Missions
    const missions = [
        ['System Down', 'システムダウン', '/assets/cards/mission1.png',
         '<p>The main system is down during peak hours. How should the team respond?</p>',
         '<p>ピーク時にメインシステムがダウン。チームはどう対応すべきか?</p>', 1,
         'Discuss crisis response strategy', '危機対応戦略を議論', 0],
        ['Technical Debt vs Features', '技術的負債 vs 新機能', '/assets/cards/mission2.png',
         '<p>Engineering wants to fix technical debt, but sales wants new features. How do you decide?</p>',
         '<p>エンジニアリングは技術的負債の修正を望み、営業は新機能を望んでいる。どう決める?</p>', 2,
         'Balance technical and business needs', '技術とビジネスのニーズをバランス', 0],
        ['Team Alignment', 'チーム調整', '/assets/cards/mission3.png',
         '<p>Design and engineering teams have different interpretations of requirements. How to align?</p>',
         '<p>デザインチームとエンジニアリングチームで要件の解釈が異なる。どう調整する?</p>', 3,
         'Align team understanding', 'チームの理解を調整', 0],
        ['Budget Cut', '予算削減', '/assets/cards/mission4.png',
         '<p>Your project budget was cut by 30%. What gets prioritized?</p>',
         '<p>プロジェクト予算が30%削減された。何を優先する?</p>', 4,
         'Prioritize with constraints', '制約下での優先順位付け', 0],
        ['Resignation & Forced Dual Role', '退職＆強制兼任', '/assets/cards/mission_special.png',
         '<p><strong>SPECIAL MISSION:</strong> You must resign immediately and assign your job to another player. That player now has dual responsibilities!</p>',
         '<p><strong>特別ミッション:</strong> あなたは即座に退職し、あなたの職種を別のプレイヤーに割り当てる必要があります。そのプレイヤーは二重の責任を負うことになります!</p>', 1,
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
