require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Admin credentials from environment variables
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Database setup
const db = new sqlite3.Database('./game.db');

// Initialize database
db.serialize(() => {
    // Mission categories
    db.run(`CREATE TABLE IF NOT EXISTS mission_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_en TEXT NOT NULL,
        name_ja TEXT NOT NULL,
        description_en TEXT,
        description_ja TEXT,
        sortOrder INTEGER DEFAULT 0
    )`);

    // Job cards
    db.run(`CREATE TABLE IF NOT EXISTS job_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_en TEXT NOT NULL,
        name_ja TEXT NOT NULL,
        imageUrl TEXT,
        descriptionHtml_en TEXT,
        descriptionHtml_ja TEXT,
        targetPoints INTEGER NOT NULL
    )`);

    // Skill cards
    db.run(`CREATE TABLE IF NOT EXISTS skill_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_en TEXT NOT NULL,
        name_ja TEXT NOT NULL,
        imageUrl TEXT,
        descriptionHtml_en TEXT,
        descriptionHtml_ja TEXT,
        matchesJobs TEXT
    )`);

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
    )`);

    // Check if data exists
    db.get('SELECT COUNT(*) as count FROM job_cards', (err, row) => {
        if (row && row.count === 0) {
            insertSampleData();
        }
    });
});

function insertSampleData() {
    console.log('Inserting sample data...');

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
    insertJob.finalize();

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
    insertSkill.finalize();

    // Mission categories
    const categories = [
        ['Crisis Management', '危機管理', 'Handling unexpected issues', '予期せぬ問題への対応', 1],
        ['Decision Making', '意思決定', 'Making strategic choices', '戦略的な選択', 2],
        ['Communication', 'コミュニケーション', 'Team coordination', 'チーム調整', 3],
        ['Resource Management', 'リソース管理', 'Budget and time management', '予算と時間管理', 4]
    ];

    const insertCategory = db.prepare('INSERT INTO mission_categories (name_en, name_ja, description_en, description_ja, sortOrder) VALUES (?, ?, ?, ?, ?)');
    categories.forEach(cat => insertCategory.run(cat));
    insertCategory.finalize();

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
    insertMission.finalize();

    console.log('Sample data inserted successfully');
}

// Game sessions storage
const gameSessions = new Map();
const clients = new Map(); // Map<sessionId, Map<playerId, WebSocket>>

function generateSessionId() {
    return uuidv4().substring(0, 8);
}

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

wss.on('connection', (ws) => {
    console.log('New WebSocket connection');

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
            ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        clients.forEach((sessionClients, sessionId) => {
            sessionClients.forEach((client, playerId) => {
                if (client === ws) {
                    sessionClients.delete(playerId);
                    broadcast(sessionId, {
                        type: 'playerDisconnected',
                        playerId
                    });
                }
            });
        });
    });
});

function handleCreateSession(ws, data) {
    const sessionId = generateSessionId();
    const playerId = 1;
    
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
            selectedSkillCardIds: []
        }],
        maxPlayers: data.maxPlayers || 4,
        currentPlayerIndex: 0,
        gameStarted: false,
        diceValue: null,
        drawnCards: [],
        selectedCardsHistory: [],
        usedCardIds: []
    };

    gameSessions.set(sessionId, session);
    
    if (!clients.has(sessionId)) {
        clients.set(sessionId, new Map());
    }
    clients.get(sessionId).set(playerId, ws);

    ws.send(JSON.stringify({
        type: 'sessionCreated',
        sessionId,
        playerId,
        session
    }));

    console.log(`Session created: ${sessionId}`);
}

function handleJoinSession(ws, data) {
    const session = gameSessions.get(data.sessionId);
    
    if (!session) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Session not found'
        }));
        return;
    }

    if (session.players.length >= session.maxPlayers) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Session is full'
        }));
        return;
    }

    if (session.gameStarted) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Game already started'
        }));
        return;
    }

    const playerId = session.players.length + 1;
    
    const newPlayer = {
        id: playerId,
        name: data.playerName || `Player ${playerId}`,
        jobs: [],
        points: {},
        retired: false,
        jobSelected: false,
        selectedSkillCardIds: []
    };

    session.players.push(newPlayer);

    if (!clients.has(data.sessionId)) {
        clients.set(data.sessionId, new Map());
    }
    clients.get(data.sessionId).set(playerId, ws);

    ws.send(JSON.stringify({
        type: 'joinedSession',
        sessionId: data.sessionId,
        playerId,
        session
    }));

    broadcast(data.sessionId, {
        type: 'playerJoined',
        player: newPlayer,
        session
    }, playerId);

    console.log(`Player ${playerId} joined session ${data.sessionId}`);
}

function handleSelectJob(ws, data) {
    const session = gameSessions.get(data.sessionId);
    
    if (!session) return;

    const player = session.players.find(p => p.id === data.playerId);
    if (!player) return;

    // 職種を設定
    player.jobs = [data.jobId];
    player.points = { [data.jobId]: 0 };
    player.jobSelected = true;

    broadcast(data.sessionId, {
        type: 'jobSelected',
        playerId: data.playerId,
        jobId: data.jobId,
        session
    });

    console.log(`Player ${data.playerId} selected job ${data.jobId} in session ${data.sessionId}`);
}

function handleStartGame(ws, data) {
    const session = gameSessions.get(data.sessionId);
    
    if (!session) return;
    if (session.gameStarted) return;
    
    // 全員が職種を選択しているかチェック
    const allSelected = session.players.every(p => p.jobSelected);
    if (!allSelected) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'All players must select a job card first'
        }));
        return;
    }
    
    session.gameStarted = true;

    broadcast(data.sessionId, {
        type: 'gameStarted',
        session
    });

    console.log(`Game started in session ${data.sessionId}`);
}

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

                // カードが足りない場合、使用済みカードをクリアして再利用
                if (availableCards.length === 0) {
                    console.log(`No cards available in session ${data.sessionId}, resetting usedCardIds`);
                    session.usedCardIds = [];
                    availableCards = [...allCards];
                }

                // 10% chance for special mission (if exists)
                if (specialMissions.length > 0 && Math.random() < 0.1) {
                    const specialMission = specialMissions[0];
                    if (!session.usedCardIds.includes(specialMission.id)) {
                        availableCards.push({ ...specialMission, type: 'special' });
                    }
                }

                // カードが本当にない場合（データベースが空）
                if (availableCards.length === 0) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'No cards in database'
                    }));
                    return;
                }

                const drawnCards = [];
                const drawnCardIds = new Set();
                const cardCount = Math.min(diceValue, availableCards.length);
                
                // 重複しないようにカードを抽選
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

                console.log(`Dice rolled: ${diceValue} in session ${data.sessionId}`);
            });
        });
    });
}

function handleSelectCard(ws, data) {
    const session = gameSessions.get(data.sessionId);
    
    if (!session) return;

    const card = session.drawnCards.find(c => c.id === data.cardId);
    if (!card) return;

    const currentPlayer = session.players[session.currentPlayerIndex];
    let result = { type: 'cardSelected', card };

    // Add to history
    session.selectedCardsHistory.push({
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        card: card,
        turnNumber: session.selectedCardsHistory.length + 1
    });

    // 使用済みカードとして記録
    if (!session.usedCardIds.includes(card.id)) {
        session.usedCardIds.push(card.id);
    }

    if (card.type === 'skill') {
        let matched = false;
        let alreadySelected = false;
        const newPoints = { ...currentPlayer.points };

        // 過去に選択済みかチェック
        if (currentPlayer.selectedSkillCardIds.includes(card.id)) {
            alreadySelected = true;
        } else {
            // 未選択のスキルカードの場合のみポイント加算
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
        result.matched = matched;
        result.alreadySelected = alreadySelected;
        result.pointsUpdated = newPoints;

        // Check for winner
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

            // スキルカードの結果は選択したプレイヤーにのみ送信
            ws.send(JSON.stringify({
                ...result,
                session
            }));

            // 他のプレイヤーには状態更新のみをブロードキャスト
            broadcast(data.sessionId, {
                type: 'cardSelectedByOther',
                playerId: currentPlayer.id,
                cardType: 'skill',
                session
            }, currentPlayer.id);
        });
    } else {
        // ミッションカードと特別ミッションは全員にブロードキャスト
        broadcast(data.sessionId, {
            ...result,
            session
        });
    }

    console.log(`Card selected in session ${data.sessionId}: ${card.type}`);
}

function handleNextTurn(ws, data) {
    const session = gameSessions.get(data.sessionId);
    
    if (!session) return;

    session.drawnCards = [];
    session.diceValue = null;

    let nextIndex = (session.currentPlayerIndex + 1) % session.players.length;
    while (session.players[nextIndex].retired && session.players.filter(p => !p.retired).length > 0) {
        nextIndex = (nextIndex + 1) % session.players.length;
    }

    session.currentPlayerIndex = nextIndex;

    broadcast(data.sessionId, {
        type: 'turnChanged',
        currentPlayerIndex: nextIndex,
        currentPlayer: session.players[nextIndex],
        session
    });

    console.log(`Turn changed in session ${data.sessionId}`);
}

function handleResign(ws, data) {
    const session = gameSessions.get(data.sessionId);
    
    if (!session) return;

    const retiringPlayer = session.players.find(p => p.id === data.playerId);
    const targetPlayer = session.players.find(p => p.id === data.targetPlayerId);

    if (!retiringPlayer || !targetPlayer) return;

    targetPlayer.jobs = [...targetPlayer.jobs, ...retiringPlayer.jobs];
    retiringPlayer.jobs.forEach(jobId => {
        targetPlayer.points[jobId] = 0;
    });

    retiringPlayer.retired = true;
    retiringPlayer.jobs = [];
    retiringPlayer.points = {};

    broadcast(data.sessionId, {
        type: 'playerRetired',
        retiredPlayerId: data.playerId,
        targetPlayerId: data.targetPlayerId,
        session
    });

    console.log(`Player resigned in session ${data.sessionId}`);
}

function handleResetGame(ws, data) {
    const session = gameSessions.get(data.sessionId);
    
    if (!session) return;

    session.players = session.players.map((player) => ({
        id: player.id,
        name: player.name,
        jobs: [],
        points: {},
        retired: false,
        jobSelected: false,
        selectedSkillCardIds: []
    }));

    session.currentPlayerIndex = 0;
    session.gameStarted = false;
    session.diceValue = null;
    session.drawnCards = [];
    session.selectedCardsHistory = [];
    session.usedCardIds = [];

    broadcast(data.sessionId, {
        type: 'gameReset',
        session
    });

    console.log(`Game reset in session ${data.sessionId}`);
}

// Express middleware
app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Authentication API
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
});

// API routes
app.get('/api/cards/jobs', (req, res) => {
    db.all('SELECT * FROM job_cards', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.get('/api/cards/skills', (req, res) => {
    db.all('SELECT * FROM skill_cards', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.get('/api/cards/missions', (req, res) => {
    db.all('SELECT * FROM missions', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.get('/api/categories', (req, res) => {
    db.all('SELECT * FROM mission_categories ORDER BY sortOrder', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Admin API - Job Cards
app.post('/api/admin/jobs', (req, res) => {
    const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints } = req.body;
    db.run(
        'INSERT INTO job_cards (name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints) VALUES (?, ?, ?, ?, ?, ?)',
        [name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID });
        }
    );
});

app.put('/api/admin/jobs/:id', (req, res) => {
    const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints } = req.body;
    db.run(
        'UPDATE job_cards SET name_en = ?, name_ja = ?, imageUrl = ?, descriptionHtml_en = ?, descriptionHtml_ja = ?, targetPoints = ? WHERE id = ?',
        [name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints, req.params.id],
        (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true });
        }
    );
});

app.delete('/api/admin/jobs/:id', (req, res) => {
    db.run('DELETE FROM job_cards WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ success: true });
    });
});

// Admin API - Skill Cards
app.post('/api/admin/skills', (req, res) => {
    const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesJobs } = req.body;
    db.run(
        'INSERT INTO skill_cards (name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesJobs) VALUES (?, ?, ?, ?, ?, ?)',
        [name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesJobs],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID });
        }
    );
});

app.put('/api/admin/skills/:id', (req, res) => {
    const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesJobs } = req.body;
    db.run(
        'UPDATE skill_cards SET name_en = ?, name_ja = ?, imageUrl = ?, descriptionHtml_en = ?, descriptionHtml_ja = ?, matchesJobs = ? WHERE id = ?',
        [name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesJobs, req.params.id],
        (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true });
        }
    );
});

app.delete('/api/admin/skills/:id', (req, res) => {
    db.run('DELETE FROM skill_cards WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ success: true });
    });
});

// Admin API - Missions
app.post('/api/admin/missions', (req, res) => {
    const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, categoryId, target_en, target_ja, isSpecial } = req.body;
    db.run(
        'INSERT INTO missions (name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, categoryId, target_en, target_ja, isSpecial) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, categoryId, target_en, target_ja, isSpecial ? 1 : 0],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID });
        }
    );
});

app.put('/api/admin/missions/:id', (req, res) => {
    const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, categoryId, target_en, target_ja, isSpecial } = req.body;
    db.run(
        'UPDATE missions SET name_en = ?, name_ja = ?, imageUrl = ?, descriptionHtml_en = ?, descriptionHtml_ja = ?, categoryId = ?, target_en = ?, target_ja = ?, isSpecial = ? WHERE id = ?',
        [name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, categoryId, target_en, target_ja, isSpecial ? 1 : 0, req.params.id],
        (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true });
        }
    );
});

app.delete('/api/admin/missions/:id', (req, res) => {
    db.run('DELETE FROM missions WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ success: true });
    });
});

// Admin API - Categories
app.post('/api/admin/categories', (req, res) => {
    const { name_en, name_ja, description_en, description_ja, sortOrder } = req.body;
    db.run(
        'INSERT INTO mission_categories (name_en, name_ja, description_en, description_ja, sortOrder) VALUES (?, ?, ?, ?, ?)',
        [name_en, name_ja, description_en, description_ja, sortOrder],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID });
        }
    );
});

app.put('/api/admin/categories/:id', (req, res) => {
    const { name_en, name_ja, description_en, description_ja, sortOrder } = req.body;
    db.run(
        'UPDATE mission_categories SET name_en = ?, name_ja = ?, description_en = ?, description_ja = ?, sortOrder = ? WHERE id = ?',
        [name_en, name_ja, description_en, description_ja, sortOrder, req.params.id],
        (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true });
        }
    );
});

app.delete('/api/admin/categories/:id', (req, res) => {
    db.run('DELETE FROM mission_categories WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ success: true });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('WebSocket server ready for multiplayer connections');
    console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
});
