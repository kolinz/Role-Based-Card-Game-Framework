// FILE: server.js (全員ゴールまで続けるシステム対応版)
require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Simple CSV parser (replacing papaparse)
function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { data: [], errors: [] };
    
    const headers = parseCSVLine(lines[0]);
    const data = [];
    const errors = [];
    
    for (let i = 1; i < lines.length; i++) {
        try {
            const values = parseCSVLine(lines[i]);
            const row = {};
            headers.forEach((header, index) => {
                row[header.trim()] = values[index] || '';
            });
            data.push(row);
        } catch (error) {
            errors.push({ row: i + 1, message: error.message });
        }
    }
    
    return { data, errors };
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i++; // Skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    return result;
}

// Admin credentials from environment variables
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Database setup
const db = new sqlite3.Database('./game.db');

// Admin token storage (in-memory)
const adminTokens = new Map(); // Map<token, { username, expiry }>

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
        if (err) {
            console.error('❌ Database check error:', err);
            return;
        }
        
        console.log('📊 Database status:');
        console.log(`   Job cards: ${row.count}`);
        
        if (row && row.count === 0) {
            console.log('⚠️  No data found. Inserting sample data...');
            insertSampleData();
        } else {
            console.log('✅ Database already contains data');
            
            // データベースの詳細を確認
            db.get('SELECT COUNT(*) as count FROM skill_cards', (err2, row2) => {
                if (!err2) console.log(`   Skill cards: ${row2.count}`);
            });
            db.get('SELECT COUNT(*) as count FROM missions', (err3, row3) => {
                if (!err3) console.log(`   Mission cards: ${row3.count}`);
            });
            db.get('SELECT COUNT(*) as count FROM mission_categories', (err4, row4) => {
                if (!err4) console.log(`   Categories: ${row4.count}`);
            });
        }
    });
});

function insertSampleData() {
    console.log('Inserting sample data...');

    // Job cards
    const jobCards = [
        ['Software Engineer', 'ソフトウェアエンジニア', null,
         '<p>Develops software applications and systems. Specializes in coding, debugging, and system architecture.</p>',
         '<p>ソフトウェアアプリケーションとシステムを開発します。コーディング、デバッグ、システムアーキテクチャを専門とします。</p>', 5],
        ['Product Manager', 'プロダクトマネージャー', null,
         '<p>Manages product development from concept to launch. Coordinates teams and defines product vision.</p>',
         '<p>コンセプトから立ち上げまでの製品開発を管理します。チームを調整し、製品ビジョンを定義します。</p>', 6],
        ['Data Scientist', 'データサイエンティスト', null,
         '<p>Analyzes complex data to help organizations make decisions. Uses statistics and machine learning.</p>',
         '<p>複雑なデータを分析し、組織の意思決定を支援します。統計学と機械学習を使用します。</p>', 5],
        ['UX Designer', 'UXデザイナー', null,
         '<p>Creates user-centered designs for digital products. Focuses on user research and interface design.</p>',
         '<p>デジタル製品のユーザー中心のデザインを作成します。ユーザーリサーチとインターフェースデザインに焦点を当てます。</p>', 5]
    ];

    const insertJob = db.prepare('INSERT INTO job_cards (name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints) VALUES (?, ?, ?, ?, ?, ?)');
    jobCards.forEach(card => insertJob.run(card));
    insertJob.finalize();

    // Skill cards
    const skillCards = [
        ['Python Programming', 'Pythonプログラミング', null,
         '<p>Proficiency in Python for backend development and data analysis.</p>',
         '<p>バックエンド開発とデータ分析のためのPython習熟度。</p>', '1,3'],
        ['User Research', 'ユーザーリサーチ', null,
         '<p>Conducting interviews and surveys to understand user needs.</p>',
         '<p>ユーザーのニーズを理解するためのインタビューと調査の実施。</p>', '2,4'],
        ['Data Visualization', 'データ可視化', null,
         '<p>Creating charts and dashboards to communicate insights.</p>',
         '<p>インサイトを伝えるためのチャートとダッシュボードの作成。</p>', '3'],
        ['Agile Methods', 'アジャイル手法', null,
         '<p>Managing projects using Scrum and Kanban methodologies.</p>',
         '<p>ScrumとKanban方法論を使用したプロジェクト管理。</p>', '1,2'],
        ['Prototyping', 'プロトタイピング', null,
         '<p>Building interactive prototypes with Figma and similar tools.</p>',
         '<p>Figmaなどのツールでインタラクティブなプロトタイプを構築。</p>', '4'],
        ['Machine Learning', '機械学習', null,
         '<p>Developing AI models for predictions and automation.</p>',
         '<p>予測と自動化のためのAIモデル開発。</p>', '3'],
        ['API Design', 'API設計', null,
         '<p>Creating RESTful and GraphQL APIs for applications.</p>',
         '<p>アプリケーション用のRESTfulおよびGraphQL APIの作成。</p>', '1'],
        ['Market Analysis', '市場分析', null,
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

    const insertCategory = db.prepare('INSERT INTO mission_categories (name_en, name_ja, description_en, description_ja, sortOrder, color) VALUES (?, ?, ?, ?, ?, ?)');
    categories.forEach(cat => insertCategory.run(cat));
    insertCategory.finalize();

    // Missions
    const missions = [
        ['System Down', 'システムダウン', null,
         '<p>The main system is down during peak hours. How should the team respond?</p>',
         '<p>ピーク時にメインシステムがダウン。チームはどう対応すべきか?</p>', 1,
         'Discuss crisis response strategy', '危機対応戦略を議論', 0],
        ['Technical Debt vs Features', '技術的負債 vs 新機能', null,
         '<p>Engineering wants to fix technical debt, but sales wants new features. How do you decide?</p>',
         '<p>エンジニアリングは技術的負債の修正を望み、営業は新機能を望んでいる。どう決める?</p>', 2,
         'Balance technical and business needs', '技術とビジネスのニーズをバランス', 0],
        ['Team Alignment', 'チーム調整', null,
         '<p>Design and engineering teams have different interpretations of requirements. How to align?</p>',
         '<p>デザインチームとエンジニアリングチームで要件の解釈が異なる。どう調整する?</p>', 3,
         'Align team understanding', 'チームの理解を調整', 0],
        ['Budget Cut', '予算削減', null,
         '<p>Your project budget was cut by 30%. What gets prioritized?</p>',
         '<p>プロジェクト予算が30%削減された。何を優先する?</p>', 4,
         'Prioritize with constraints', '制約下での優先順位付け', 0],
        ['Resignation & Forced Dual Role', '退職＆強制兼任', null,
         '<p><strong>SPECIAL MISSION:</strong> You must resign immediately and assign your job to another player. That player now has dual responsibilities!</p>',
         '<p><strong>特別ミッション:</strong> あなたは即座に退職し、あなたの職種を別のプレイヤーに割り当てる必要があります。そのプレイヤーは二重の責任を負うことになります!</p>', 1,
         'Execute resignation and job transfer', '退職と職種移譲を実行', 1]
    ];

    const insertMission = db.prepare('INSERT INTO missions (name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, categoryId, target_en, target_ja, isSpecial) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    missions.forEach(mission => insertMission.run(mission));
    insertMission.finalize(() => {
        console.log('✅ Sample data inserted successfully');
        
        // 挿入されたデータを確認
        db.get('SELECT COUNT(*) as count FROM job_cards', (err, row) => {
            if (!err) console.log(`   ✓ Job cards: ${row.count}`);
        });
        db.get('SELECT COUNT(*) as count FROM skill_cards', (err, row) => {
            if (!err) console.log(`   ✓ Skill cards: ${row.count}`);
        });
        db.get('SELECT COUNT(*) as count FROM missions', (err, row) => {
            if (!err) console.log(`   ✓ Mission cards: ${row.count}`);
        });
        db.get('SELECT COUNT(*) as count FROM mission_categories', (err, row) => {
            if (!err) console.log(`   ✓ Categories: ${row.count}`);
        });
    });
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

// WebSocket connection handler
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
                case 'chatMessage':
                    handleChatMessage(ws, data);
                    break;
                case 'typing':
                    handleTyping(ws, data);
                    break;
                case 'stopTyping':
                    handleStopTyping(ws, data);
                    break;
                case 'toggleReaction':
                    handleToggleReaction(ws, data);
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
            
            // セッションからプレイヤーを削除
            const session = gameSessions.get(currentSessionId);
            if (session) {
                const playerIndex = session.players.findIndex(p => p.id === currentPlayerId);
                if (playerIndex !== -1) {
                    const removedPlayer = session.players[playerIndex];
                    session.players.splice(playerIndex, 1);
                    
                    // 他のプレイヤーに通知
                    broadcast(currentSessionId, {
                        type: 'playerLeft',
                        playerId: currentPlayerId,
                        playerName: removedPlayer.name,
                        session
                    });
                    
                    console.log(`Player ${currentPlayerId} (${removedPlayer.name}) left session ${currentSessionId}`);
                    
                    // セッションが空になった場合は削除
                    if (session.players.length === 0) {
                        gameSessions.delete(currentSessionId);
                        clients.delete(currentSessionId);
                        console.log(`Session ${currentSessionId} deleted (no players)`);
                    }
                }
            }
        }
    });

    function handleCreateSession(ws, data) {
        const sessionId = generateSessionId();
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
                finished: false,        // ★追加
                finishRank: null        // ★追加
            }],
            maxPlayers: data.maxPlayers || 4,
            currentPlayerIndex: 0,
            gameStarted: false,
            diceValue: null,
            drawnCards: [],
            selectedCardsHistory: [],
            usedCardIds: [],
            chatMessages: [],
            finishedPlayers: [],        // ★追加
            allFinished: false          // ★追加
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

        console.log(`Session created: ${sessionId}`);
    }

    function handleJoinSession(ws, data) {
        const session = gameSessions.get(data.sessionId);
        
        if (!session) {
            ws.send(JSON.stringify({
                type: 'error',
                error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' }
            }));
            return;
        }

        if (session.players.length >= session.maxPlayers) {
            ws.send(JSON.stringify({
                type: 'error',
                error: { code: 'SESSION_FULL', message: 'Session is full' }
            }));
            return;
        }

        if (session.gameStarted) {
            ws.send(JSON.stringify({
                type: 'error',
                error: { code: 'GAME_ALREADY_STARTED', message: 'Game already started' }
            }));
            return;
        }

        const playerId = uuidv4();
        
        const newPlayer = {
            id: playerId,
            name: data.playerName || `Player ${session.players.length + 1}`,
            jobs: [],
            points: {},
            retired: false,
            jobSelected: false,
            selectedSkillCardIds: [],
            finished: false,        // ★追加
            finishRank: null        // ★追加
        };

        session.players.push(newPlayer);

        if (!clients.has(data.sessionId)) {
            clients.set(data.sessionId, new Map());
        }
        clients.get(data.sessionId).set(playerId, ws);
        
        currentSessionId = data.sessionId;
        currentPlayerId = playerId;

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
        
        const allSelected = session.players.every(p => p.jobSelected);
        if (!allSelected) {
            ws.send(JSON.stringify({
                type: 'error',
                error: { code: 'ALL_PLAYERS_MUST_SELECT_JOB', message: 'All players must select a job card first' }
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

                    let availableCards = allCards.filter(card => 
                        !session.usedCardIds.includes(card.id)
                    );

                    if (availableCards.length <= 7) {
                        console.log(`No cards available in session ${data.sessionId}, resetting usedCardIds`);
                        session.usedCardIds = [];
                        availableCards = [...allCards];
                    }

                    // 10% chance for special mission
                    if (specialMissions.length > 0 && Math.random() < 0.1) {
                        const specialMission = specialMissions[0];
                        if (!session.usedCardIds.includes(specialMission.id)) {
                            availableCards.push({ ...specialMission, type: 'special' });
                        }
                    }

                    if (availableCards.length === 0) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            error: { code: 'SERVER_ERROR', message: 'No cards in database' }
                        }));
                        return;
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

        session.selectedCardsHistory.push({
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            card: card,
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

            db.all('SELECT * FROM job_cards', (err, jobCards) => {
                let hasWon = true;
                currentPlayer.jobs.forEach(jobId => {
                    const job = jobCards.find(j => j.id === jobId);
                    if (job && (currentPlayer.points[jobId] || 0) < job.targetPoints) {
                        hasWon = false;
                    }
                });

                // ★★★ ここが最も重要な変更 ★★★
                if (hasWon && currentPlayer.jobs.length > 0 && !currentPlayer.finished) {
                    // このプレイヤーをゴール済みにする
                    currentPlayer.finished = true;
                    const rank = session.finishedPlayers.length + 1;
                    currentPlayer.finishRank = rank;
                    session.finishedPlayers.push(currentPlayer.id);
                    
                    result.playerFinished = true;
                    result.finishRank = rank;
                    result.playerName = currentPlayer.name;
                    
                    // 全員がゴールしたかチェック（退職者を除く）
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

                ws.send(JSON.stringify({
                    ...result,
                    session
                }));

                broadcast(data.sessionId, {
                    type: 'cardSelectedByOther',
                    playerId: currentPlayer.id,
                    cardType: 'skill',
                    session
                }, currentPlayer.id);
                
                // 全員ゴール時に全員に通知
                if (result.allFinished) {
                    broadcast(data.sessionId, {
                        type: 'gameCompleted',
                        finalRankings: result.finalRankings,
                        session
                    });
                }
            });
        } else {
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


    function handleChatMessage(ws, data) {
        const session = gameSessions.get(data.sessionId);
        
        if (!session) return;

        const message = {
            id: Date.now(),
            playerId: data.playerId,
            playerName: data.playerName,
            message: data.message,
            timestamp: new Date().toLocaleTimeString('ja-JP', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }),
            reactions: {}
        };

        session.chatMessages.push(message);

        broadcast(data.sessionId, {
            type: 'chatMessageReceived',
            message,
            session
        });

        console.log(`Chat message in session ${data.sessionId}: ${data.playerName}: ${data.message}`);
    }


    function handleTyping(ws, data) {
        const session = gameSessions.get(data.sessionId);
        if (!session) return;

        // Broadcast to all except sender
        broadcast(data.sessionId, {
            type: 'userTyping',
            playerId: data.playerId,
            playerName: data.playerName
        }, data.playerId);
    }

    function handleStopTyping(ws, data) {
        const session = gameSessions.get(data.sessionId);
        if (!session) return;

        // Broadcast to all except sender
        broadcast(data.sessionId, {
            type: 'userStoppedTyping',
            playerId: data.playerId,
            playerName: data.playerName
        }, data.playerId);
    }

    function handleToggleReaction(ws, data) {
        const session = gameSessions.get(data.sessionId);
        if (!session) return;

        const messageIndex = session.chatMessages.findIndex(m => m.id === data.messageId);
        if (messageIndex === -1) return;

        const message = session.chatMessages[messageIndex];
        
        // Initialize reactions object if it doesn't exist
        if (!message.reactions) {
            message.reactions = {};
        }

        // Initialize emoji array if it doesn't exist
        if (!message.reactions[data.emoji]) {
            message.reactions[data.emoji] = [];
        }

        // Toggle reaction
        const userIndex = message.reactions[data.emoji].indexOf(data.playerId);
        if (userIndex === -1) {
            // Add reaction
            message.reactions[data.emoji].push(data.playerId);
        } else {
            // Remove reaction
            message.reactions[data.emoji].splice(userIndex, 1);
            
            // Clean up empty arrays
            if (message.reactions[data.emoji].length === 0) {
                delete message.reactions[data.emoji];
            }
        }

        // Broadcast to all
        broadcast(data.sessionId, {
            type: 'reactionToggled',
            messageId: data.messageId,
            message: message,
            session
        });

        console.log(`Reaction toggled in session ${data.sessionId}: ${data.emoji} on message ${data.messageId}`);
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
            selectedSkillCardIds: [],
            finished: false,        // ★追加
            finishRank: null        // ★追加
        }));

        session.currentPlayerIndex = 0;
        session.gameStarted = false;
        session.diceValue = null;
        session.drawnCards = [];
        session.selectedCardsHistory = [];
        session.usedCardIds = [];
        session.chatMessages = [];
        session.finishedPlayers = [];   // ★追加
        session.allFinished = false;    // ★追加

        broadcast(data.sessionId, {
            type: 'gameReset',
            session
        });

        console.log(`Game reset in session ${data.sessionId}`);
    }
});

// Express middleware
app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Middleware for admin authentication
function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            ok: false, 
            error: { code: 'UNAUTHORIZED', message: 'Authorization required' }
        });
    }
    
    const token = authHeader.substring(7);
    const tokenData = adminTokens.get(token);
    
    if (!tokenData) {
        return res.status(401).json({ 
            ok: false, 
            error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' }
        });
    }
    
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

// Translation API
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

// Authentication API
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    console.log('=== LOGIN ATTEMPT ===');
    console.log('Received username:', username);
    console.log('Received password length:', password ? password.length : 0);
    console.log('Expected username:', ADMIN_USERNAME);
    console.log('Expected password:', ADMIN_PASSWORD);
    console.log('Username match:', username === ADMIN_USERNAME);
    console.log('Password match:', password === ADMIN_PASSWORD);
    console.log('====================');
    
    if (!username || !password) {
        return res.status(400).json({ 
            ok: false, 
            error: { code: 'BAD_REQUEST', message: 'Username and password required' }
        });
    }
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = uuidv4();
        const expiry = Date.now() + TOKEN_EXPIRY;
        
        adminTokens.set(token, { username, expiry });
        
        console.log('✅ Login successful! Token generated:', token.substring(0, 8) + '...');
        res.json({ ok: true, token, expiresIn: TOKEN_EXPIRY });
    } else {
        console.log('❌ Login failed: Invalid credentials');
        res.status(401).json({ 
            ok: false, 
            error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' }
        });
    }
});

app.post('/api/auth/logout', requireAdmin, (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader.substring(7);
    adminTokens.delete(token);
    res.json({ ok: true });
});

// Public API routes
app.get('/api/cards/jobs', (req, res) => {
    db.all('SELECT * FROM job_cards', (err, rows) => {
        if (err) {
            console.error('❌ Error fetching job cards:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        console.log(`📤 API: Sending ${rows.length} job cards`);
        res.json(rows);
    });
});

app.get('/api/cards/skills', (req, res) => {
    db.all('SELECT * FROM skill_cards', (err, rows) => {
        if (err) {
            console.error('❌ Error fetching skill cards:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        console.log(`📤 API: Sending ${rows.length} skill cards`);
        res.json(rows);
    });
});

app.get('/api/cards/missions', (req, res) => {
    db.all('SELECT * FROM missions', (err, rows) => {
        if (err) {
            console.error('❌ Error fetching missions:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        console.log(`📤 API: Sending ${rows.length} mission cards`);
        res.json(rows);
    });
});

app.get('/api/categories', (req, res) => {
    db.all('SELECT * FROM mission_categories ORDER BY sortOrder', (err, rows) => {
        if (err) {
            console.error('❌ Error fetching categories:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        console.log(`📤 API: Sending ${rows.length} categories`);
        res.json(rows);
    });
});

// Admin API - Job Cards
app.post('/api/admin/jobs', requireAdmin, (req, res) => {
    const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints } = req.body;
    
    if (!name_en || !name_ja || !targetPoints) {
        return res.status(400).json({ 
            ok: false, 
            error: { code: 'BAD_REQUEST', message: 'Required fields missing' }
        });
    }
    
    db.run(
        'INSERT INTO job_cards (name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints) VALUES (?, ?, ?, ?, ?, ?)',
        [name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints],
        function(err) {
            if (err) {
                res.status(500).json({ 
                    ok: false, 
                    error: { code: 'SERVER_ERROR', message: err.message }
                });
                return;
            }
            res.json({ ok: true, id: this.lastID });
        }
    );
});

app.put('/api/admin/jobs/:id', requireAdmin, (req, res) => {
    const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints } = req.body;
    
    db.run(
        'UPDATE job_cards SET name_en = ?, name_ja = ?, imageUrl = ?, descriptionHtml_en = ?, descriptionHtml_ja = ?, targetPoints = ? WHERE id = ?',
        [name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints, req.params.id],
        (err) => {
            if (err) {
                res.status(500).json({ 
                    ok: false, 
                    error: { code: 'SERVER_ERROR', message: err.message }
                });
                return;
            }
            res.json({ ok: true });
        }
    );
});

app.delete('/api/admin/jobs/:id', requireAdmin, (req, res) => {
    db.run('DELETE FROM job_cards WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            res.status(500).json({ 
                ok: false, 
                error: { code: 'SERVER_ERROR', message: err.message }
            });
            return;
        }
        res.json({ ok: true });
    });
});

// Admin API - Skill Cards
app.post('/api/admin/skills', requireAdmin, (req, res) => {
    const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesJobs } = req.body;
    
    if (!name_en || !name_ja) {
        return res.status(400).json({ 
            ok: false, 
            error: { code: 'BAD_REQUEST', message: 'Required fields missing' }
        });
    }
    
    db.run(
        'INSERT INTO skill_cards (name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesJobs) VALUES (?, ?, ?, ?, ?, ?)',
        [name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesJobs],
        function(err) {
            if (err) {
                res.status(500).json({ 
                    ok: false, 
                    error: { code: 'SERVER_ERROR', message: err.message }
                });
                return;
            }
            res.json({ ok: true, id: this.lastID });
        }
    );
});

app.put('/api/admin/skills/:id', requireAdmin, (req, res) => {
    const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesJobs } = req.body;
    
    db.run(
        'UPDATE skill_cards SET name_en = ?, name_ja = ?, imageUrl = ?, descriptionHtml_en = ?, descriptionHtml_ja = ?, matchesJobs = ? WHERE id = ?',
        [name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesJobs, req.params.id],
        (err) => {
            if (err) {
                res.status(500).json({ 
                    ok: false, 
                    error: { code: 'SERVER_ERROR', message: err.message }
                });
                return;
            }
            res.json({ ok: true });
        }
    );
});

app.delete('/api/admin/skills/:id', requireAdmin, (req, res) => {
    db.run('DELETE FROM skill_cards WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            res.status(500).json({ 
                ok: false, 
                error: { code: 'SERVER_ERROR', message: err.message }
            });
            return;
        }
        res.json({ ok: true });
    });
});

// Admin API - Missions
app.post('/api/admin/missions', requireAdmin, (req, res) => {
    const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, categoryId, target_en, target_ja, isSpecial } = req.body;
    
    if (!descriptionHtml_en || !descriptionHtml_ja) {
        return res.status(400).json({ 
            ok: false, 
            error: { code: 'BAD_REQUEST', message: 'Required fields missing' }
        });
    }
    
    db.run(
        'INSERT INTO missions (name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, categoryId, target_en, target_ja, isSpecial) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, categoryId, target_en, target_ja, isSpecial ? 1 : 0],
        function(err) {
            if (err) {
                res.status(500).json({ 
                    ok: false, 
                    error: { code: 'SERVER_ERROR', message: err.message }
                });
                return;
            }
            res.json({ ok: true, id: this.lastID });
        }
    );
});

app.put('/api/admin/missions/:id', requireAdmin, (req, res) => {
    const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, categoryId, target_en, target_ja, isSpecial } = req.body;
    
    db.run(
        'UPDATE missions SET name_en = ?, name_ja = ?, imageUrl = ?, descriptionHtml_en = ?, descriptionHtml_ja = ?, categoryId = ?, target_en = ?, target_ja = ?, isSpecial = ? WHERE id = ?',
        [name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, categoryId, target_en, target_ja, isSpecial ? 1 : 0, req.params.id],
        (err) => {
            if (err) {
                res.status(500).json({ 
                    ok: false, 
                    error: { code: 'SERVER_ERROR', message: err.message }
                });
                return;
            }
            res.json({ ok: true });
        }
    );
});

app.delete('/api/admin/missions/:id', requireAdmin, (req, res) => {
    db.run('DELETE FROM missions WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            res.status(500).json({ 
                ok: false, 
                error: { code: 'SERVER_ERROR', message: err.message }
            });
            return;
        }
        res.json({ ok: true });
    });
});

// Admin API - Categories
app.post('/api/admin/categories', requireAdmin, (req, res) => {
    const { name_en, name_ja, description_en, description_ja, sortOrder, color } = req.body;
    
    if (!name_en || !name_ja) {
        return res.status(400).json({ 
            ok: false, 
            error: { code: 'BAD_REQUEST', message: 'Required fields missing' }
        });
    }
    
    db.run(
        'INSERT INTO mission_categories (name_en, name_ja, description_en, description_ja, sortOrder, color) VALUES (?, ?, ?, ?, ?, ?)',
        [name_en, name_ja, description_en, description_ja, sortOrder, color || '#667eea'],
        function(err) {
            if (err) {
                res.status(500).json({ 
                    ok: false, 
                    error: { code: 'SERVER_ERROR', message: err.message }
                });
                return;
            }
            res.json({ ok: true, id: this.lastID });
        }
    );
});

app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
    const { name_en, name_ja, description_en, description_ja, sortOrder, color } = req.body;
    
    db.run(
        'UPDATE mission_categories SET name_en = ?, name_ja = ?, description_en = ?, description_ja = ?, sortOrder = ?, color = ? WHERE id = ?',
        [name_en, name_ja, description_en, description_ja, sortOrder, color || '#667eea', req.params.id],
        (err) => {
            if (err) {
                res.status(500).json({ 
                    ok: false, 
                    error: { code: 'SERVER_ERROR', message: err.message }
                });
                return;
            }
            res.json({ ok: true });
        }
    );
});

app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
    db.run('DELETE FROM mission_categories WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            res.status(500).json({ 
                ok: false, 
                error: { code: 'SERVER_ERROR', message: err.message }
            });
            return;
        }
        res.json({ ok: true });
    });
});

// Validation functions for CSV import
function validateJobCard(row, rowIndex) {
    const errors = [];
    
    if (!row.name_en || row.name_en.trim() === '') {
        errors.push(`Row ${rowIndex}: name_en is required`);
    }
    
    if (!row.name_ja || row.name_ja.trim() === '') {
        errors.push(`Row ${rowIndex}: name_ja is required`);
    }
    
    if (row.targetPoints && isNaN(parseInt(row.targetPoints))) {
        errors.push(`Row ${rowIndex}: targetPoints must be a number`);
    }
    
    return errors;
}

function validateSkillCard(row, rowIndex) {
    const errors = [];
    
    if (!row.name_en || row.name_en.trim() === '') {
        errors.push(`Row ${rowIndex}: name_en is required`);
    }
    
    if (!row.name_ja || row.name_ja.trim() === '') {
        errors.push(`Row ${rowIndex}: name_ja is required`);
    }
    
    return errors;
}

function validateMissionCard(row, rowIndex) {
    const errors = [];
    
    if (!row.descriptionHtml_en || row.descriptionHtml_en.trim() === '') {
        errors.push(`Row ${rowIndex}: descriptionHtml_en is required`);
    }
    
    if (!row.descriptionHtml_ja || row.descriptionHtml_ja.trim() === '') {
        errors.push(`Row ${rowIndex}: descriptionHtml_ja is required`);
    }
    
    if (row.categoryId && isNaN(parseInt(row.categoryId))) {
        errors.push(`Row ${rowIndex}: categoryId must be a number`);
    }
    
    return errors;
}

// CSV Import API - Job Cards
app.post('/api/admin/import/jobs', (req, res) => {
    const { csvData, preview = false } = req.body;
    
    if (!csvData) {
        return res.status(400).json({ error: 'CSV data is required' });
    }
    
    // Remove UTF-8 BOM if present
    const cleanedCSV = csvData.replace(/^\uFEFF/, '');
    
    // Parse CSV
    const parsed = parseCSV(cleanedCSV);
    
    if (parsed.errors.length > 0) {
        return res.status(400).json({ 
            error: 'CSV parsing error', 
            details: parsed.errors 
        });
    }
    
    const rows = parsed.data;
    const validationErrors = [];
    
    // Validate all rows
    rows.forEach((row, index) => {
        const errors = validateJobCard(row, index + 2); // +2 for header and 0-index
        validationErrors.push(...errors);
    });
    
    if (validationErrors.length > 0) {
        return res.status(400).json({ 
            error: 'Validation failed', 
            details: validationErrors 
        });
    }
    
    // Preview mode - return parsed data
    if (preview) {
        return res.json({ 
            ok: true, 
            preview: rows,
            totalRows: rows.length
        });
    }
    
    // Execute mode - insert/update to database
    db.serialize(() => {
        db.all('SELECT * FROM job_cards', (err, existingRows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO job_cards 
                (id, name_en, name_ja, descriptionHtml_en, descriptionHtml_ja, targetPoints)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            let insertedCount = 0;
            let updatedCount = 0;
            
            rows.forEach((row) => {
                const id = row.id ? parseInt(row.id) : null;
                const existing = existingRows.find(e => e.id === id);
                
                if (existing) {
                    updatedCount++;
                } else {
                    insertedCount++;
                }
                
                stmt.run(
                    id,
                    row.name_en,
                    row.name_ja,
                    row.descriptionHtml_en || '',
                    row.descriptionHtml_ja || '',
                    parseInt(row.targetPoints)
                );
            });
            
            stmt.finalize((err) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                res.json({ 
                    ok: true, 
                    inserted: insertedCount,
                    updated: updatedCount,
                    total: rows.length
                });
            });
        });
    });
});

// CSV Import API - Skill Cards
app.post('/api/admin/import/skills', (req, res) => {
    const { csvData, preview = false } = req.body;
    
    if (!csvData) {
        return res.status(400).json({ error: 'CSV data is required' });
    }
    
    // Remove UTF-8 BOM if present
    const cleanedCSV = csvData.replace(/^\uFEFF/, '');
    
    // Parse CSV
    const parsed = parseCSV(cleanedCSV);
    
    if (parsed.errors.length > 0) {
        return res.status(400).json({ 
            error: 'CSV parsing error', 
            details: parsed.errors 
        });
    }
    
    const rows = parsed.data;
    const validationErrors = [];
    
    // Validate all rows
    rows.forEach((row, index) => {
        const errors = validateSkillCard(row, index + 2);
        validationErrors.push(...errors);
    });
    
    if (validationErrors.length > 0) {
        return res.status(400).json({ 
            error: 'Validation failed', 
            details: validationErrors 
        });
    }
    
    // Preview mode
    if (preview) {
        return res.json({ 
            ok: true, 
            preview: rows,
            totalRows: rows.length
        });
    }
    
    // Execute mode
    db.serialize(() => {
        db.all('SELECT * FROM skill_cards', (err, existingRows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO skill_cards 
                (id, name_en, name_ja, descriptionHtml_en, descriptionHtml_ja, matchesJobs)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            let insertedCount = 0;
            let updatedCount = 0;
            
            rows.forEach((row) => {
                const id = row.id ? parseInt(row.id) : null;
                const existing = existingRows.find(e => e.id === id);
                
                if (existing) {
                    updatedCount++;
                } else {
                    insertedCount++;
                }
                
                stmt.run(
                    id,
                    row.name_en,
                    row.name_ja,
                    row.descriptionHtml_en || '',
                    row.descriptionHtml_ja || '',
                    row.matchesJobs || ''
                );
            });
            
            stmt.finalize((err) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                res.json({ 
                    ok: true, 
                    inserted: insertedCount,
                    updated: updatedCount,
                    total: rows.length
                });
            });
        });
    });
});

// CSV Import API - Missions
app.post('/api/admin/import/missions', (req, res) => {
    const { csvData, preview = false } = req.body;
    
    if (!csvData) {
        return res.status(400).json({ error: 'CSV data is required' });
    }
    
    // Remove UTF-8 BOM if present
    const cleanedCSV = csvData.replace(/^\uFEFF/, '');
    
    // Parse CSV
    const parsed = parseCSV(cleanedCSV);
    
    if (parsed.errors.length > 0) {
        return res.status(400).json({ 
            error: 'CSV parsing error', 
            details: parsed.errors 
        });
    }
    
    const rows = parsed.data;
    const validationErrors = [];
    
    // Validate all rows
    rows.forEach((row, index) => {
        const errors = validateMissionCard(row, index + 2);
        validationErrors.push(...errors);
    });
    
    if (validationErrors.length > 0) {
        return res.status(400).json({ 
            error: 'Validation failed', 
            details: validationErrors 
        });
    }
    
    // Preview mode
    if (preview) {
        return res.json({ 
            ok: true, 
            preview: rows,
            totalRows: rows.length
        });
    }
    
    // Execute mode
    db.serialize(() => {
        db.all('SELECT * FROM missions', (err, existingRows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO missions 
                (id, name_en, name_ja, descriptionHtml_en, descriptionHtml_ja, categoryId, target_en, target_ja, isSpecial)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            let insertedCount = 0;
            let updatedCount = 0;
            
            rows.forEach((row) => {
                const id = row.id ? parseInt(row.id) : null;
                const existing = existingRows.find(e => e.id === id);
                
                if (existing) {
                    updatedCount++;
                } else {
                    insertedCount++;
                }
                
                stmt.run(
                    id,
                    row.name_en || '',
                    row.name_ja || '',
                    row.descriptionHtml_en,
                    row.descriptionHtml_ja,
                    row.categoryId ? parseInt(row.categoryId) : null,
                    row.target_en || '',
                    row.target_ja || '',
                    row.isSpecial === '1' || row.isSpecial === 'true' ? 1 : 0
                );
            });
            
            stmt.finalize((err) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                res.json({ 
                    ok: true, 
                    inserted: insertedCount,
                    updated: updatedCount,
                    total: rows.length
                });
            });
        });
    });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('=================================');
    console.log('🚀 Server Started');
    console.log('=================================');
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('WebSocket server ready for multiplayer connections');
    console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
    console.log('');
    console.log('📝 Admin Credentials:');
    console.log(`   Username: ${ADMIN_USERNAME}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log('=================================');
});
