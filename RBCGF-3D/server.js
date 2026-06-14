'use strict';

require('dotenv').config();

const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const Database  = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path      = require('path');
const fs        = require('fs');

// ── アプリ・サーバー初期化 ────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

// ── DB（better-sqlite3 同期API）──────────────────────────────
const db = new Database('./game.db');

// ── 状態管理 Map ─────────────────────────────────────────────
const gameSessions = new Map();  // Map<sessionId, session>
const clients      = new Map();  // Map<sessionId, Map<playerId, WebSocket>>
const adminTokens  = new Map();  // Map<token, { username, expiry }>

// ── 認証定数 ─────────────────────────────────────────────────
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const TOKEN_EXPIRY   = parseInt(process.env.ADMIN_TOKEN_EXPIRY_HOURS || '24', 10) * 60 * 60 * 1000;

// ゲームバランス設定
const MAX_PLAYERS            = parseInt(process.env.MAX_PLAYERS             || '4',   10);
const SPECIAL_MISSION_RATE   = parseFloat(process.env.SPECIAL_MISSION_RATE  || '0.1');
const DECK_RESET_THRESHOLD   = parseInt(process.env.DECK_RESET_THRESHOLD    || '7',   10);
const DICE_ROLL_DURATION     = parseFloat(process.env.DICE_ROLL_DURATION     || '2.2');
const WS_RECONNECT_DELAY     = parseInt(process.env.WS_RECONNECT_DELAY      || '3000', 10);

// ── ユーティリティ関数 ────────────────────────────────────────

/**
 * セッションID生成: UUID v4 の先頭8文字を大文字で返す
 */
function generateSessionId() {
    return uuidv4().substring(0, 8).toUpperCase();
}

/**
 * セッション内の全クライアントにブロードキャスト
 * @param {string} sessionId
 * @param {object} message
 * @param {string|null} excludePlayerId - 除外するプレイヤーID
 */
function broadcast(sessionId, message, excludePlayerId = null) {
    const sc = clients.get(sessionId);
    if (!sc) return;
    const json = JSON.stringify(message);
    sc.forEach((ws, pid) => {
        if (pid !== excludePlayerId && ws.readyState === WebSocket.OPEN) {
            ws.send(json);
        }
    });
}

/**
 * 特定プレイヤーにメッセージ送信
 * @param {string} sessionId
 * @param {string} playerId
 * @param {object} message
 */
function sendToPlayer(sessionId, playerId, message) {
    const sc = clients.get(sessionId);
    if (!sc) return;
    const ws = sc.get(playerId);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

// ── WebSocket 接続ハンドラ ────────────────────────────────────
wss.on('connection', (ws) => {
    let currentSessionId = null;
    let currentPlayerId  = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // セッション追跡（createSession / joinSession 時に設定）
            if (data.sessionId) currentSessionId = data.sessionId;
            if (data.playerId)  currentPlayerId  = data.playerId;

            switch (data.type) {
                case 'createSession':  handleCreateSession(ws, data);  break;
                case 'joinSession':    handleJoinSession(ws, data);    break;
                case 'selectAvatar':   handleSelectAvatar(ws, data);   break; // v1.3
                case 'selectCategory': handleSelectCategory(ws, data); break; // v1.2
                case 'startGame':      handleStartGame(ws, data);      break;
                case 'rollDice':       handleRollDice(ws, data);       break;
                case 'selectCard':     handleSelectCard(ws, data);     break;
                case 'nextTurn':       handleNextTurn(ws, data);       break;
                case 'resign':         handleResign(ws, data);         break;
                case 'resetGame':      handleResetGame(ws, data);      break;
                default:
                    ws.send(JSON.stringify({
                        type: 'error',
                        error: { code: 'UNKNOWN_TYPE', message: `Unknown type: ${data.type}` }
                    }));
            }
        } catch (error) {
            ws.send(JSON.stringify({
                type: 'error',
                error: { code: 'SERVER_ERROR', message: error.message }
            }));
        }
    });

    ws.on('close', () => {
        if (currentSessionId && currentPlayerId) {
            const sc = clients.get(currentSessionId);
            if (sc) sc.delete(currentPlayerId);
        }
    });
});

// ── WebSocket ハンドラ（Phase 3-2）───────────────────────────

// Section 5.3: セッション作成
function handleCreateSession(ws, data) {
    const sessionId = generateSessionId();
    const playerId  = uuidv4();

    const session = {
        id:                   sessionId,
        hostPlayerId:         playerId,
        players: [{
            id:                   playerId,
            name:                 data.playerName || 'Player 1',
            // v1.2
            categories:           [],
            points:               {},
            retired:              false,
            categorySelected:     false,
            selectedSkillCardIds: [],
            finished:             false,
            finishRank:           null,
            // v1.3
            avatarId:             null,
            avatarColorId:        null,
            avatarSelected:       false,
            seatIndex:            0,
        }],
        maxPlayers:           data.maxPlayers || MAX_PLAYERS,
        currentPlayerIndex:   0,
        gameStarted:          false,
        diceValue:            null,
        drawnCards:           [],
        selectedCardsHistory: [],
        usedCardIds:          [],
        finishedPlayers:      [],
        allFinished:          false,
    };

    gameSessions.set(sessionId, session);
    clients.set(sessionId, new Map([[playerId, ws]]));

    ws.send(JSON.stringify({ type: 'sessionCreated', sessionId, playerId, session }));
}

// Section 5.4: セッション参加
function handleJoinSession(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) {
        return ws.send(JSON.stringify({ type: 'error', error: { code: 'SESSION_NOT_FOUND' } }));
    }
    if (session.players.length >= session.maxPlayers) {
        return ws.send(JSON.stringify({ type: 'error', error: { code: 'SESSION_FULL' } }));
    }
    if (session.gameStarted) {
        return ws.send(JSON.stringify({ type: 'error', error: { code: 'GAME_ALREADY_STARTED' } }));
    }

    const playerId  = uuidv4();
    const seatIndex = session.players.length; // push 前の長さ = 座席番号

    session.players.push({
        id:                   playerId,
        name:                 data.playerName || `Player ${seatIndex + 1}`,
        categories:           [],
        points:               {},
        retired:              false,
        categorySelected:     false,
        selectedSkillCardIds: [],
        finished:             false,
        finishRank:           null,
        avatarId:             null,
        avatarColorId:        null,
        avatarSelected:       false,
        seatIndex,
    });

    if (!clients.has(data.sessionId)) clients.set(data.sessionId, new Map());
    clients.get(data.sessionId).set(playerId, ws);

    // 本人
    ws.send(JSON.stringify({ type: 'sessionJoined', sessionId: data.sessionId, playerId, session }));
    // 他全員
    broadcast(data.sessionId, { type: 'playerJoined', session }, playerId);
}

// Section 5.5: アバター選択（v1.3）
function handleSelectAvatar(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;
    const player = session.players.find(p => p.id === data.playerId);
    if (!player) return;

    player.avatarId       = data.avatarId;
    player.avatarColorId  = data.avatarColorId;
    player.avatarSelected = true;

    broadcast(data.sessionId, {
        type:         'avatarSelected',
        playerId:     data.playerId,
        avatarId:     data.avatarId,
        avatarColorId: data.avatarColorId,
        session,
    });
}

// Section 5.6: カテゴリ選択（v1.2 / 旧 handleSelectJob）
function handleSelectCategory(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;

    // 重複チェック: 他プレイヤーが同じ categoryId を選択済みか
    const alreadyTaken = session.players.some(
        p => p.id !== data.playerId && p.categories.includes(Number(data.categoryId))
    );
    if (alreadyTaken) {
        return ws.send(JSON.stringify({ type: 'error', error: { code: 'CATEGORY_TAKEN' } }));
    }

    const player = session.players.find(p => p.id === data.playerId);
    if (!player) return;

    player.categories.push(Number(data.categoryId));  // 文字列→数値に統一
    player.categorySelected = true;

    broadcast(data.sessionId, {
        type:       'categorySelected',
        playerId:   data.playerId,
        categoryId: data.categoryId,
        session,
    });
}

// Section 5.7: ゲーム開始
function handleStartGame(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;

    // バリデーション（順番厳守）
    if (data.playerId !== session.hostPlayerId) {
        return ws.send(JSON.stringify({ type: 'error', error: { code: 'NOT_HOST', message: 'ゲーム開始はホストのみ可能です' } }));
    }
    if (session.players.length < 2) {
        return ws.send(JSON.stringify({ type: 'error', error: { code: 'NOT_ENOUGH_PLAYERS', message: '最低2人必要です' } }));
    }
    if (session.players.some(p => !p.categorySelected)) {
        return ws.send(JSON.stringify({ type: 'error', error: { code: 'NOT_ALL_SELECTED', message: '全員が職種を選択するまで開始できません' } }));
    }

    session.gameStarted = true;
    broadcast(data.sessionId, { type: 'gameStarted', session });
}

// Section 5.8: サイコロ処理
function handleRollDice(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;

    const diceValue = Math.floor(Math.random() * 6) + 1;
    session.diceValue = diceValue;

    // better-sqlite3 同期API
    const skillCards      = db.prepare('SELECT * FROM skill_cards').all();
    const regularMissions = db.prepare('SELECT * FROM missions WHERE isSpecial = 0').all();
    const specialMissions = db.prepare('SELECT * FROM missions WHERE isSpecial = 1').all();

    // allCards 構築
    const allCards = [
        ...skillCards.map(c => ({
            ...c,
            type: 'skill',
            matchesCategories: c.matchesCategories
                ? c.matchesCategories.split(',').map(Number)
                : [],
        })),
        ...regularMissions.map(c => ({ ...c, type: 'mission' })),
    ];

    // 在庫管理: available が 7枚以下なら usedCardIds をリセット
    let available = allCards.filter(c => !session.usedCardIds.includes(c.id));
    if (available.length <= DECK_RESET_THRESHOLD) {
        session.usedCardIds = [];
        available = [...allCards];
    }

    // 特殊ミッション: 10% 確率で候補に追加（未使用かつ1件のみ）
    if (specialMissions.length > 0 && Math.random() < SPECIAL_MISSION_RATE) {
        const sp = specialMissions[0];
        if (!session.usedCardIds.includes(sp.id)) {
            available.push({ ...sp, type: 'special' });
        }
    }

    // ランダム抽選（Set で重複防止、diceValue 枚）
    const drawn = [];
    const usedIds = new Set();
    const limit = Math.min(diceValue, available.length);
    while (drawn.length < limit) {
        const c = available[Math.floor(Math.random() * available.length)];
        if (!usedIds.has(c.id)) {
            drawn.push(c);
            usedIds.add(c.id);
        }
    }

    session.drawnCards = drawn;
    broadcast(data.sessionId, { type: 'diceRolled', diceValue, drawnCards: drawn, session });
}

// Section 5.9: カード選択処理
function handleSelectCard(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;

    const card   = session.drawnCards.find(c => c.id === data.cardId);
    if (!card) return;

    const player = session.players[session.currentPlayerIndex];

    // 使用済みカードに追加
    if (!session.usedCardIds.includes(card.id)) {
        session.usedCardIds.push(card.id);
    }
    session.selectedCardsHistory.push({
        playerId:   player.id,
        playerName: player.name,
        card,
        turnNumber: session.selectedCardsHistory.length + 1,
    });

    // スキルカード処理
    if (card.type === 'skill') {
        let matched         = false;
        let alreadySelected = false;

        if (player.selectedSkillCardIds.includes(card.id)) {
            // 同じカードを再選択（ポイント加算なし）
            alreadySelected = true;
        } else {
            // matchesCategories と player.categories を照合
            const mc = Array.isArray(card.matchesCategories)
                ? card.matchesCategories
                : (card.matchesCategories ? card.matchesCategories.split(',').map(Number) : []);

            player.categories.forEach(cid => {
                const cidNum = Number(cid);
                if (mc.includes(cidNum)) {
                    matched = true;
                    player.points[cidNum] = (player.points[cidNum] || 0) + 1;
                }
            });
            player.selectedSkillCardIds.push(card.id);
        }

        // 勝利判定（better-sqlite3 同期）
        const cats = db.prepare('SELECT * FROM category_cards').all();
        const hasWon = player.categories.length > 0 && player.categories.every(cid => {
            const cidNum = Number(cid);
            const cat = cats.find(c => c.id === cidNum);
            return cat && (player.points[cidNum] || 0) >= cat.targetPoints;
        });

        let playerFinished = false;
        let finishRank     = null;
        let allFinished    = false;
        let finalRankings  = null;

        if (hasWon && !player.finished) {
            player.finished   = true;
            player.finishRank = session.finishedPlayers.length + 1;
            session.finishedPlayers.push(player.id);
            playerFinished = true;
            finishRank     = player.finishRank;

            // 全員ゴールチェック（退職済みを除く）
            const activePlayers = session.players.filter(p => !p.retired);
            if (activePlayers.every(p => p.finished)) {
                session.allFinished = true;
                allFinished   = true;
                finalRankings = activePlayers
                    .sort((a, b) => a.finishRank - b.finishRank)
                    .map(p => ({ id: p.id, name: p.name, rank: p.finishRank }));
            }
        }

        // 本人へ送信
        ws.send(JSON.stringify({
            type: 'cardSelected',
            card,
            matched,
            alreadySelected,
            pointsUpdated: player.points,
            playerFinished,
            finishRank,
            playerName: player.name,
            allFinished,
            finalRankings,
            session,
        }));

        // 他全員へ broadcast（card データを含める）
        broadcast(data.sessionId, {
            type:     'cardSelectedByOther',
            playerId: player.id,
            cardType: 'skill',
            card,
            matched,
            playerName: player.name,
            session,
        }, player.id);

        // 全員ゴール時は gameCompleted を全員に broadcast
        if (allFinished) {
            broadcast(data.sessionId, {
                type: 'gameCompleted',
                finalRankings,
                session,
            });
        }

    // ミッション / 特殊カード処理
    } else {
        broadcast(data.sessionId, {
            type:     'cardSelected',
            card,
            cardType: card.type,
            session,
        });
    }
}

// Section 5.10: 次のターンへ
function handleNextTurn(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;

    // retired プレイヤーをスキップして次のアクティブプレイヤーを探す
    const total = session.players.length;
    let next = (session.currentPlayerIndex + 1) % total;
    for (let i = 0; i < total; i++) {
        if (!session.players[next].retired) break;
        next = (next + 1) % total;
    }
    session.currentPlayerIndex = next;
    session.drawnCards         = [];
    session.diceValue          = null;

    broadcast(data.sessionId, { type: 'nextTurn', session });
}

// Section 5.10: 退職&強制兼任（特殊ミッション）
function handleResign(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;

    const retiringPlayer = session.players.find(p => p.id === data.playerId);
    const targetPlayer   = session.players.find(p => p.id === data.targetPlayerId);
    if (!retiringPlayer || !targetPlayer) return;

    // 退職プレイヤーの職種・ポイントを引継先に移管
    retiringPlayer.categories.forEach(cid => {
        if (!targetPlayer.categories.includes(cid)) {
            targetPlayer.categories.push(cid);
        }
        // 引き継いだ categoryId のポイントが未設定なら 0 で初期化
        targetPlayer.points[cid] = targetPlayer.points[cid] ?? 0;
    });

    // 退職プレイヤーをリセット
    retiringPlayer.retired    = true;
    retiringPlayer.categories = [];
    retiringPlayer.points     = {};

    broadcast(data.sessionId, {
        type:            'playerRetired',
        retiredPlayerId: data.playerId,
        targetPlayerId:  data.targetPlayerId,
        session,
    });
}

// Section 5.10: ゲームリセット
function handleResetGame(ws, data) {
    const session = gameSessions.get(data.sessionId);
    if (!session) return;

    // セッション状態をリセット
    Object.assign(session, {
        gameStarted:          false,
        currentPlayerIndex:   0,
        diceValue:            null,
        drawnCards:           [],
        selectedCardsHistory: [],
        usedCardIds:          [],
        finishedPlayers:      [],
        allFinished:          false,
    });

    // 全プレイヤーをリセット
    session.players.forEach(p => {
        Object.assign(p, {
            categories:           [],
            points:               {},
            retired:              false,
            categorySelected:     false,
            selectedSkillCardIds: [],
            finished:             false,
            finishRank:           null,
            avatarId:             null,
            avatarColorId:        null,
            avatarSelected:       false,
        });
    });

    broadcast(data.sessionId, { type: 'gameReset', session });
}

// ── Express ミドルウェア ─────────────────────────────────────
app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ── requireAdmin ミドルウェア ─────────────────────────────────
function requireAdmin(req, res, next) {
    const auth  = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.substring(7) : null;
    if (!token) {
        return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Token required' } });
    }
    const td = adminTokens.get(token);
    if (!td) {
        return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    }
    if (Date.now() > td.expiry) {
        adminTokens.delete(token);
        return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Token expired' } });
    }
    req.admin = td;
    next();
}

// ── 認証 API ─────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = uuidv4();
        adminTokens.set(token, { username, expiry: Date.now() + TOKEN_EXPIRY });
        res.json({ ok: true, token, expiresIn: TOKEN_EXPIRY });
    } else {
        res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
    }
});

// ── カード取得 API（認証不要 / 配列を直接返す）───────────────
app.get('/api/cards/categories',
    (req, res) => res.json(db.prepare('SELECT * FROM category_cards').all()));

app.get('/api/cards/skills',
    (req, res) => res.json(db.prepare('SELECT * FROM skill_cards').all()));

app.get('/api/cards/missions',
    (req, res) => res.json(db.prepare('SELECT * FROM missions').all()));

app.get('/api/cards/skill-types',
    (req, res) => res.json(db.prepare('SELECT * FROM skill_types ORDER BY sortOrder').all()));

app.get('/api/cards/mission-categories',
    (req, res) => res.json(db.prepare('SELECT * FROM mission_categories').all()));

// ── 多言語 API ───────────────────────────────────────────────
app.get('/api/lang/:lang', (req, res) => {
    const lang = req.params.lang.replace(/[^a-z]/g, ''); // サニタイズ
    const filePath = path.join(__dirname, 'lang', `${lang}.json`);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: `Language "${lang}" not found` } });
    }
    try {
        const translations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.json({ ok: true, translations });
    } catch (e) {
        res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: e.message } });
    }
});

// ── 管理 API: category_cards CRUD ────────────────────────────
app.post('/api/admin/categories', requireAdmin, (req, res) => {
    try {
        const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints } = req.body;
        const result = db.prepare(
            'INSERT INTO category_cards (name_en,name_ja,imageUrl,descriptionHtml_en,descriptionHtml_ja,targetPoints) VALUES (?,?,?,?,?,?)'
        ).run(name_en, name_ja, imageUrl || null, descriptionHtml_en || null, descriptionHtml_ja || null, targetPoints);
        res.json({ ok: true, id: result.lastInsertRowid });
    } catch (e) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: e.message } }); }
});

app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
    try {
        const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, targetPoints } = req.body;
        db.prepare(
            'UPDATE category_cards SET name_en=?,name_ja=?,imageUrl=?,descriptionHtml_en=?,descriptionHtml_ja=?,targetPoints=? WHERE id=?'
        ).run(name_en, name_ja, imageUrl || null, descriptionHtml_en || null, descriptionHtml_ja || null, targetPoints, req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: e.message } }); }
});

app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM category_cards WHERE id=?').run(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: e.message } }); }
});

// ── 管理 API: skill_types CRUD ────────────────────────────────
app.post('/api/admin/skill-types', requireAdmin, (req, res) => {
    try {
        const { name_en, name_ja, model_type, description_en, description_ja, sortOrder } = req.body;
        const result = db.prepare(
            'INSERT INTO skill_types (name_en,name_ja,model_type,description_en,description_ja,sortOrder) VALUES (?,?,?,?,?,?)'
        ).run(name_en, name_ja, model_type || 'katz', description_en || null, description_ja || null, sortOrder || 0);
        res.json({ ok: true, id: result.lastInsertRowid });
    } catch (e) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: e.message } }); }
});

app.put('/api/admin/skill-types/:id', requireAdmin, (req, res) => {
    try {
        const { name_en, name_ja, model_type, description_en, description_ja, sortOrder } = req.body;
        db.prepare(
            'UPDATE skill_types SET name_en=?,name_ja=?,model_type=?,description_en=?,description_ja=?,sortOrder=? WHERE id=?'
        ).run(name_en, name_ja, model_type || 'katz', description_en || null, description_ja || null, sortOrder || 0, req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: e.message } }); }
});

app.delete('/api/admin/skill-types/:id', requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM skill_types WHERE id=?').run(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: e.message } }); }
});

// ── 管理 API: skill_cards CRUD ───────────────────────────────
app.post('/api/admin/skills', requireAdmin, (req, res) => {
    try {
        const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesCategories } = req.body;
        const result = db.prepare(
            'INSERT INTO skill_cards (name_en,name_ja,imageUrl,descriptionHtml_en,descriptionHtml_ja,matchesCategories) VALUES (?,?,?,?,?,?)'
        ).run(name_en, name_ja, imageUrl || null, descriptionHtml_en || null, descriptionHtml_ja || null, matchesCategories || null);
        res.json({ ok: true, id: result.lastInsertRowid });
    } catch (e) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: e.message } }); }
});

app.put('/api/admin/skills/:id', requireAdmin, (req, res) => {
    try {
        const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, matchesCategories } = req.body;
        db.prepare(
            'UPDATE skill_cards SET name_en=?,name_ja=?,imageUrl=?,descriptionHtml_en=?,descriptionHtml_ja=?,matchesCategories=? WHERE id=?'
        ).run(name_en, name_ja, imageUrl || null, descriptionHtml_en || null, descriptionHtml_ja || null, matchesCategories || null, req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: e.message } }); }
});

app.delete('/api/admin/skills/:id', requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM skill_cards WHERE id=?').run(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: e.message } }); }
});

// ── 管理 API: missions CRUD ──────────────────────────────────
app.post('/api/admin/missions', requireAdmin, (req, res) => {
    try {
        const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, categoryId, target_en, target_ja, isSpecial } = req.body;
        const result = db.prepare(
            'INSERT INTO missions (name_en,name_ja,imageUrl,descriptionHtml_en,descriptionHtml_ja,categoryId,target_en,target_ja,isSpecial) VALUES (?,?,?,?,?,?,?,?,?)'
        ).run(name_en || null, name_ja || null, imageUrl || null, descriptionHtml_en, descriptionHtml_ja, categoryId || null, target_en || null, target_ja || null, isSpecial ? 1 : 0);
        res.json({ ok: true, id: result.lastInsertRowid });
    } catch (e) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: e.message } }); }
});

app.put('/api/admin/missions/:id', requireAdmin, (req, res) => {
    try {
        const { name_en, name_ja, imageUrl, descriptionHtml_en, descriptionHtml_ja, categoryId, target_en, target_ja, isSpecial } = req.body;
        db.prepare(
            'UPDATE missions SET name_en=?,name_ja=?,imageUrl=?,descriptionHtml_en=?,descriptionHtml_ja=?,categoryId=?,target_en=?,target_ja=?,isSpecial=? WHERE id=?'
        ).run(name_en || null, name_ja || null, imageUrl || null, descriptionHtml_en, descriptionHtml_ja, categoryId || null, target_en || null, target_ja || null, isSpecial ? 1 : 0, req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: e.message } }); }
});

app.delete('/api/admin/missions/:id', requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM missions WHERE id=?').run(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: e.message } }); }
});

// ── CSV Import ────────────────────────────────────────────────
// POST /api/admin/import/:type
// type: 'categories' | 'skills' | 'missions' | 'skill-types'
// body: { csvData:[{...}], preview:boolean }
app.post('/api/admin/import/:type', requireAdmin, (req, res) => {
    try {
        const { type }    = req.params;
        const { csvData, preview } = req.body;

        if (!Array.isArray(csvData) || csvData.length === 0) {
            return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'csvData is empty or invalid' } });
        }

        // テーブル・INSERT/UPDATE 定義
        const config = {
            categories: {
                table:  'category_cards',
                insert: 'INSERT INTO category_cards (name_en,name_ja,imageUrl,descriptionHtml_en,descriptionHtml_ja,targetPoints) VALUES (?,?,?,?,?,?)',
                update: 'UPDATE category_cards SET name_en=?,name_ja=?,imageUrl=?,descriptionHtml_en=?,descriptionHtml_ja=?,targetPoints=? WHERE id=?',
                params: r => [r.name_en, r.name_ja, r.imageUrl || null, r.descriptionHtml_en || null, r.descriptionHtml_ja || null, r.targetPoints],
            },
            skills: {
                table:  'skill_cards',
                insert: 'INSERT INTO skill_cards (name_en,name_ja,imageUrl,descriptionHtml_en,descriptionHtml_ja,matchesCategories) VALUES (?,?,?,?,?,?)',
                update: 'UPDATE skill_cards SET name_en=?,name_ja=?,imageUrl=?,descriptionHtml_en=?,descriptionHtml_ja=?,matchesCategories=? WHERE id=?',
                params: r => [r.name_en, r.name_ja, r.imageUrl || null, r.descriptionHtml_en || null, r.descriptionHtml_ja || null, r.matchesCategories || null],
            },
            missions: {
                table:  'missions',
                insert: 'INSERT INTO missions (name_en,name_ja,imageUrl,descriptionHtml_en,descriptionHtml_ja,categoryId,target_en,target_ja,isSpecial) VALUES (?,?,?,?,?,?,?,?,?)',
                update: 'UPDATE missions SET name_en=?,name_ja=?,imageUrl=?,descriptionHtml_en=?,descriptionHtml_ja=?,categoryId=?,target_en=?,target_ja=?,isSpecial=? WHERE id=?',
                params: r => [r.name_en || null, r.name_ja || null, r.imageUrl || null, r.descriptionHtml_en, r.descriptionHtml_ja, r.categoryId || null, r.target_en || null, r.target_ja || null, r.isSpecial ? 1 : 0],
            },
            'skill-types': {
                table:  'skill_types',
                insert: 'INSERT INTO skill_types (name_en,name_ja,model_type,description_en,description_ja,sortOrder) VALUES (?,?,?,?,?,?)',
                update: 'UPDATE skill_types SET name_en=?,name_ja=?,model_type=?,description_en=?,description_ja=?,sortOrder=? WHERE id=?',
                params: r => [r.name_en, r.name_ja, r.model_type || 'katz', r.description_en || null, r.description_ja || null, r.sortOrder || 0],
            },
        };

        const cfg = config[type];
        if (!cfg) {
            return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: `Unknown type: ${type}` } });
        }

        // preview=true: DB書き込みなし、件数だけ返す
        if (preview) {
            const wouldInsert = csvData.filter(r => !r.id).length;
            const wouldUpdate = csvData.filter(r =>  r.id).length;
            return res.json({ ok: true, preview: true, inserted: wouldInsert, updated: wouldUpdate, total: csvData.length });
        }

        // preview=false: id があれば UPDATE、なければ INSERT（upsert）
        let inserted = 0;
        let updated  = 0;
        const stmtInsert = db.prepare(cfg.insert);
        const stmtUpdate = db.prepare(cfg.update);

        const upsert = db.transaction((rows) => {
            for (const row of rows) {
                const params = cfg.params(row);
                if (row.id) {
                    stmtUpdate.run(...params, row.id);
                    updated++;
                } else {
                    stmtInsert.run(...params);
                    inserted++;
                }
            }
        });
        upsert(csvData);

        res.json({ ok: true, inserted, updated, total: csvData.length });
    } catch (e) { res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: e.message } }); }
});

// ── クライアント設定 API ──────────────────────────────────────
// .env の値をクライアントに公開する（機密情報は含めない）
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

// ── ヘルスチェック ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
});

// ── サーバー起動 ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
