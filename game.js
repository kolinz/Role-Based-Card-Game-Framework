// FILE: game.js (全員ゴールまで続けるシステム対応版)
// ====== I18n System (API経由で翻訳ファイルを読み込む) ======
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

    async setLanguage(lang) {
        const success = await this.loadTranslations(lang);
        if (success && window.game) {
            window.game.language = lang;
            window.game.render();
            document.getElementById('page-title').textContent = this.t('game.title');
        }
    }

    watchLanguageChange() {
        window.addEventListener('storage', async (e) => {
            if (e.key === 'language' && e.newValue !== this.currentLang) {
                await this.loadTranslations(e.newValue);
                if (window.game) {
                    window.game.language = e.newValue;
                    window.game.render();
                    document.getElementById('page-title').textContent = this.t('game.title');
                }
            }
        });
    }
}

const i18n = new I18n();

// ====== GameClient Class ======
class GameClient {
    constructor() {
        this.ws = null;
        this.language = i18n.currentLang;
        this.sessionId = null;
        this.playerId = null;
        this.session = null;
        this.connected = false;
        this.mode = 'menu';
        this.selectedCard = null;
        this.rolling = false;
        this.modal = null;
        this.jobCardsCache = [];
        this.skillCardsCache = [];
        this.flippedCards = new Set();
        this.flippedJobCards = new Set();

        this.checkUrlParams();
    }

    async init() {
        await i18n.init();
        this.connect();
        this.fetchJobCards();
        this.fetchSkillCards();
        this.render();
    }

    checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('session');
        if (sessionId) {
            this.sessionId = sessionId;
            this.mode = 'join-direct';
        }
    }

    fetchJobCards() {
        fetch('/api/cards/jobs')
            .then(r => r.json())
            .then(data => {
                this.jobCardsCache = data.ok ? data.data : data;
            })
            .catch(console.error);
    }

    fetchSkillCards() {
        fetch('/api/cards/skills')
            .then(r => r.json())
            .then(data => {
                this.skillCardsCache = data.ok ? data.data : data;
            })
            .catch(console.error);
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
            setTimeout(() => this.connect(), 3000);
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

            case 'joinedSession':
                this.sessionId = data.sessionId;
                this.playerId = data.playerId;
                this.session = data.session;
                this.mode = 'lobby';
                this.render();
                break;

            case 'playerJoined':
                this.session = data.session;
                this.render();
                break;

            case 'jobSelected':
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
                
                // ★★★ ゴール時の処理を追加 ★★★
                if (data.playerFinished) {
                    const rankEmoji = this.getRankEmoji(data.finishRank);
                    const message = `${rankEmoji} ${data.playerName} ${this.t('game.finishedRank')} ${data.finishRank}${this.t('game.rankSuffix')}!`;
                    
                    this.showModal({
                        title: this.t('game.playerFinished'),
                        content: `<div style="text-align: center; font-size: 1.5rem; font-weight: 700;">${message}</div>`
                    });
                    
                    // 全員ゴール時の処理は別途gameCompletedで処理
                } else if (data.card.type === 'skill') {
                    if (data.alreadySelected) {
                        this.showModal({
                            title: this.t('game.alreadySelected'),
                            content: data.card[`descriptionHtml_${this.language}`] + '<br><br><em>' + this.t('game.alreadySelected') + '</em>'
                        });
                    } else {
                        this.showModal({
                            title: data.matched ? this.t('game.matchBonus') : this.t('game.noMatch'),
                            content: data.card[`descriptionHtml_${this.language}`]
                        });
                    }
                } else if (data.card.type === 'mission') {
                    this.showModal({
                        title: data.card[`name_${this.language}`] || 'Mission',
                        content: data.card[`descriptionHtml_${this.language}`] + '<br><br><em>' + this.t('game.discussMission') + '</em>'
                    });
                } else if (data.card.type === 'special') {
                    this.showPlayerSelectionModal(data.card);
                }
                
                this.render();
                break;

            // ★★★ 新しいケースを追加 ★★★
            case 'gameCompleted':
                this.session = data.session;
                setTimeout(() => {
                    this.showFinalRankingsModal(data.finalRankings);
                }, 1500);
                this.render();
                break;

            case 'cardSelectedByOther':
                this.session = data.session;
                this.render();
                break;

            case 'turnChanged':
                this.session = data.session;
                this.selectedCard = null;
                this.rolling = false;
                this.flippedCards.clear();
                this.render();
                break;

            case 'playerRetired':
                this.session = data.session;
                this.showModal({
                    title: this.t('game.youRetired'),
                    content: `Player ${data.targetPlayerId} ${this.t('game.assignedJob')}`
                });
                this.render();
                break;

            case 'gameReset':
                this.session = data.session;
                this.mode = 'lobby';
                this.selectedCard = null;
                this.rolling = false;
                this.flippedCards.clear();
                this.flippedJobCards.clear();
                this.render();
                break;

            case 'error':
                const errorMsg = data.error?.message || this.t('errors.SERVER_ERROR');
                alert(errorMsg);
                break;
        }
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    t(key) {
        return i18n.t(key);
    }

    createSession() {
        const playerName = document.getElementById('playerName').value.trim();
        const maxPlayers = parseInt(document.getElementById('maxPlayers').value);
        
        if (!playerName) {
            alert(this.t('errors.INVALID_INPUT'));
            return;
        }

        this.send({
            type: 'createSession',
            playerName,
            maxPlayers
        });
    }

    joinSession() {
        const playerName = document.getElementById('joinPlayerName').value.trim();
        const sessionId = document.getElementById('joinSessionId').value.trim();
        
        if (!playerName || !sessionId) {
            alert(this.t('errors.INVALID_INPUT'));
            return;
        }

        this.send({
            type: 'joinSession',
            sessionId,
            playerName
        });
    }

    startGame() {
        this.send({
            type: 'startGame',
            sessionId: this.sessionId
        });
    }

    selectJob(jobId) {
        this.send({
            type: 'selectJob',
            sessionId: this.sessionId,
            playerId: this.playerId,
            jobId: jobId
        });
    }

    flipJobCard(jobId) {
        if (this.flippedJobCards.has(jobId)) {
            this.flippedJobCards.delete(jobId);
        } else {
            this.flippedJobCards.add(jobId);
        }
        this.render();
    }

    rollDice() {
        if (this.rolling) return;
        
        this.rolling = true;
        this.selectedCard = null;
        this.render();
        
        this.send({
            type: 'rollDice',
            sessionId: this.sessionId
        });
        
        setTimeout(() => {
            if (this.rolling) {
                console.warn('Dice rolling timeout - force stopping');
                this.rolling = false;
                this.render();
            }
        }, 5000);
    }

    flipCard(cardId) {
        if (this.flippedCards.has(cardId)) {
            this.flippedCards.delete(cardId);
        } else {
            this.flippedCards.add(cardId);
        }
        this.render();
    }

    selectCard(card) {
        if (this.selectedCard) return;
        this.selectedCard = card;
        this.send({
            type: 'selectCard',
            sessionId: this.sessionId,
            cardId: card.id
        });
        this.render();
    }

    nextTurn() {
        this.rolling = false;
        this.send({
            type: 'nextTurn',
            sessionId: this.sessionId
        });
    }

    resetGame() {
        if (confirm(this.t('game.resetGame') + '?')) {
            this.send({
                type: 'resetGame',
                sessionId: this.sessionId
            });
        }
    }

    resign(targetPlayerId) {
        this.send({
            type: 'resign',
            sessionId: this.sessionId,
            playerId: this.playerId,
            targetPlayerId
        });
        this.closeModal();
    }

    showModal(options) {
        this.modal = options;
        this.render();
    }

    showPlayerSelectionModal(card) {
        const otherPlayers = this.session.players.filter(p => 
            !p.retired && p.id !== this.playerId
        );
        this.modal = {
            title: this.t('game.selectPlayerForJob'),
            playerSelection: true,
            players: otherPlayers,
            card
        };
        this.render();
    }

    // ★★★ 最終順位表示モーダルを追加 ★★★
    showFinalRankingsModal(rankings) {
        this.modal = {
            title: this.t('game.gameCompleted'),
            finalRankings: true,
            rankings: rankings
        };
        this.render();
    }

    closeModal() {
        this.modal = null;
        this.render();
    }

    copyInviteUrl() {
        const url = `${window.location.origin}?session=${this.sessionId}`;
        navigator.clipboard.writeText(url).then(() => {
            const btn = document.querySelector('.copy-btn');
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = this.t('game.urlCopied');
                setTimeout(() => {
                    btn.textContent = this.t('game.copyUrl');
                }, 2000);
            }
        });
    }

    getJobName(jobId) {
        const job = this.jobCardsCache.find(j => j.id === jobId);
        return job ? job[`name_${this.language}`] : '';
    }

    getJobTarget(jobId) {
        const job = this.jobCardsCache.find(j => j.id === jobId);
        return job ? job.targetPoints : 0;
    }

    // ★★★ 順位絵文字ヘルパーメソッドを追加 ★★★
    getRankEmoji(rank) {
        const emojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];
        return emojis[rank - 1] || '🏁';
    }

    render() {
        const app = document.getElementById('app');
        
        if (!app) return;

        if (!this.connected) {
            app.innerHTML = this.renderDisconnected();
            return;
        }

        let html = `
            <div class="connection-status connected">
                <span class="status-dot"></span>
                ${this.t('common.connected')}
            </div>
        `;

        if (this.mode === 'menu' || this.mode === 'join-direct') {
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

    renderDisconnected() {
        return `
            <div class="app-container">
                <div class="background-pattern"></div>
                <div class="connection-status disconnected">
                    <span class="status-dot"></span>
                    ${this.t('common.disconnected')}
                </div>
                <div class="game-setup">
                    <h2>${this.t('common.loading')}</h2>
                </div>
            </div>
        `;
    }

    renderMenu() {
        const isJoinDirect = this.mode === 'join-direct';
        
        return `
            <div class="app-container">
                <div class="background-pattern"></div>
                <div class="header">
                    <h1>${this.t('game.title')}</h1>
                    <div class="lang-toggle">
                        <button class="${this.language === 'en' ? 'active' : ''}" data-lang="en">${this.t('common.english')}</button>
                        <button class="${this.language === 'ja' ? 'active' : ''}" data-lang="ja">${this.t('common.japanese')}</button>
                    </div>
                </div>
                <div class="game-setup">
                    ${isJoinDirect ? `
                        <h2>${this.t('game.joinGame')}</h2>
                        <div class="form-group">
                            <label>${this.t('game.sessionId')}</label>
                            <input type="text" id="joinSessionId" value="${this.sessionId}" readonly>
                        </div>
                        <div class="form-group">
                            <label>${this.t('game.playerName')}</label>
                            <input type="text" id="joinPlayerName" placeholder="${this.t('game.playerName')}">
                        </div>
                        <button class="btn" onclick="game.joinSession()">${this.t('game.joinGame')}</button>
                    ` : `
                        <h2>${this.t('game.createGame')}</h2>
                        <div class="form-group">
                            <label>${this.t('game.playerName')}</label>
                            <input type="text" id="playerName" placeholder="${this.t('game.playerName')}">
                        </div>
                        <div class="form-group">
                            <label>${this.t('game.maxPlayers')}</label>
                            <select id="maxPlayers">
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4" selected>4</option>
                            </select>
                        </div>
                        <button class="btn" onclick="game.createSession()">${this.t('game.createGame')}</button>
                        
                        <div class="or-divider"><span>${this.t('common.or')}</span></div>
                        
                        <h2>${this.t('game.joinGame')}</h2>
                        <div class="form-group">
                            <label>${this.t('game.playerName')}</label>
                            <input type="text" id="joinPlayerName" placeholder="${this.t('game.playerName')}">
                        </div>
                        <div class="form-group">
                            <label>${this.t('game.sessionId')}</label>
                            <input type="text" id="joinSessionId" placeholder="${this.t('game.sessionId')}">
                        </div>
                        <button class="btn" onclick="game.joinSession()">${this.t('game.joinGame')}</button>
                    `}
                </div>
            </div>
        `;
    }

    renderLobby() {
        const inviteUrl = `${window.location.origin}?session=${this.sessionId}`;
        const isHost = this.playerId === this.session.hostPlayerId;
        
        return `
            <div class="app-container">
                <div class="background-pattern"></div>
                <div class="header">
                    <h1>${this.t('game.title')}</h1>
                    <div class="lang-toggle">
                        <button class="${this.language === 'en' ? 'active' : ''}" data-lang="en">${this.t('common.english')}</button>
                        <button class="${this.language === 'ja' ? 'active' : ''}" data-lang="ja">${this.t('common.japanese')}</button>
                    </div>
                </div>
                <div class="waiting-room">
                    <div class="waiting-header">
                        <h2>${this.t('game.waitingForPlayers')}</h2>
                        <div class="session-id-display">${this.sessionId}</div>
                        <p>${this.session.players.length} / ${this.session.maxPlayers} ${this.t('game.playersInLobby')}</p>
                    </div>
                    
                    <div class="invite-url-box">
                        <label>${this.t('game.inviteUrl')}</label>
                        <div class="invite-url-content">
                            <input type="text" value="${inviteUrl}" readonly>
                            <button class="copy-btn" onclick="game.copyInviteUrl()">${this.t('game.copyUrl')}</button>
                        </div>
                    </div>
                    
                    <div class="player-list">
                        <h3>${this.t('game.playersInLobby')}</h3>
                        ${this.session.players.map(player => `
                            <div class="player-item">
                                <div class="player-avatar">${player.name.charAt(0).toUpperCase()}</div>
                                <div class="player-name">
                                    ${player.name}
                                    ${player.id === this.playerId ? `<span class="you-badge">${this.t('common.you')}</span>` : ''}
                                    ${player.jobSelected ? `<span class="you-badge" style="background: var(--success); margin-left: 5px;">${this.t('game.jobSelectedBadge')}</span>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    ${!this.session.players.find(p => p.id === this.playerId).jobSelected ? `
                        <div class="player-list" style="margin-top: 20px;">
                            <h3>${this.t('game.selectYourJob')}</h3>
                            <p style="text-align: center; color: var(--text-secondary); margin-top: 10px; margin-bottom: 15px;">
                                ${this.t('game.cardSelectHint')}
                            </p>
                            <div class="cards-grid" id="jobSelection" style="margin-top: 15px;"></div>
                        </div>
                    ` : `
                        <div style="text-align: center; margin: 20px 0; padding: 20px; background: var(--bg-dark); border-radius: 12px;">
                            <p style="color: var(--success); font-weight: 600;">${this.t('game.waitingForOthers')}</p>
                        </div>
                    `}
                    
                    ${isHost ? `
                        <button class="btn" onclick="game.startGame()" ${this.session.players.length < 2 || !this.session.players.every(p => p.jobSelected) ? 'disabled' : ''}>
                            ${this.session.players.every(p => p.jobSelected) ? this.t('game.allPlayersReady') + ' - ' : ''}${this.t('game.startGame')}
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderGame() {
        const currentPlayer = this.session.players[this.session.currentPlayerIndex];
        const isMyTurn = currentPlayer.id === this.playerId;
        const myPlayer = this.session.players.find(p => p.id === this.playerId);

        return `
            <div class="app-container">
                <div class="background-pattern"></div>
                <div class="header">
                    <h1>${this.t('game.title')}</h1>
                    <div class="lang-toggle">
                        <button class="${this.language === 'en' ? 'active' : ''}" data-lang="en">${this.t('common.english')}</button>
                        <button class="${this.language === 'ja' ? 'active' : ''}" data-lang="ja">${this.t('common.japanese')}</button>
                    </div>
                </div>
                <div class="game-board">
                    <div class="turn-indicator">
                        ${this.t('game.currentTurn')}: ${currentPlayer.name}
                    </div>
                    
                    <div class="players-area">
                        ${this.session.players.map(player => {
                            const totalPoints = Object.values(player.points).reduce((a, b) => a + b, 0);
                            const isActive = player.id === currentPlayer.id;
                            const isYou = player.id === this.playerId;
                            
                            // ★★★ finished クラスを追加 ★★★
                            return `
                                <div class="player-card ${isActive ? 'active' : ''} ${isYou ? 'you' : ''} ${player.retired ? 'retired' : ''} ${player.finished ? 'finished' : ''}">
                                    <div class="player-header">
                                        <div class="player-name-tag">
                                            ${player.name}
                                            ${isYou ? `<span class="you-badge">${this.t('common.you')}</span>` : ''}
                                            ${player.finished ? `<span class="you-badge" style="background: var(--success); margin-left: 5px;">${this.getRankEmoji(player.finishRank)} ${player.finishRank}${this.t('game.rankSuffix')} ${this.t('game.finished')}</span>` : ''}
                                        </div>
                                        ${!player.retired && !player.finished ? `<div class="player-points">${totalPoints} ${this.t('common.points')}</div>` : ''}
                                    </div>
                                    ${player.retired ? `
                                        <div class="retired-badge">${this.t('game.resigned')}</div>
                                    ` : `
                                        <div class="player-jobs">
                                            ${player.jobs.map(jobId => `
                                                <div class="job-badge">
                                                    ${this.getJobName(jobId)}
                                                    ${!player.finished ? `(${player.points[jobId] || 0}/${this.getJobTarget(jobId)})` : ''}
                                                </div>
                                            `).join('')}
                                        </div>
                                    `}
                                </div>
                            `;
                        }).join('')}
                    </div>
                    
                    <div class="control-panel">
                        <div class="dice-container">
                            <div class="dice ${this.rolling ? 'rolling' : ''}">
                                ${this.session.diceValue || '?'}
                            </div>
                            <button class="btn btn-small" onclick="game.rollDice()" 
                                ${!isMyTurn || this.rolling || this.session.drawnCards.length > 0 || myPlayer.retired || myPlayer.finished ? 'disabled' : ''}>
                                ${this.t('game.rollDice')}
                            </button>
                        </div>
                        <button class="btn btn-small" onclick="game.nextTurn()" 
                            ${!this.selectedCard ? 'disabled' : ''}>
                            ${this.t('game.nextTurn')}
                        </button>
                        <button class="btn btn-small btn-secondary" onclick="game.resetGame()">
                            ${this.t('game.resetGame')}
                        </button>
                    </div>
                    
                    ${this.session.drawnCards.length > 0 ? `
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
                                    } else {
                                        bgStyle = 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);';
                                    }
                                    
                                    return `
                                    <div class="simple-card ${isDisabled ? 'disabled' : ''}" style="${bgStyle}">
                                        <div class="simple-card-main" onclick="game.selectCard(${JSON.stringify(card).replace(/"/g, '&quot;')})">
                                            ${isFlipped ? `
                                                <div class="simple-card-content">
                                                    ${card.imageUrl ? `<img src="${card.imageUrl}" style="max-width: 100%; border-radius: 8px; margin-bottom: 10px;">` : ''}
                                                    <div>${card[`descriptionHtml_${this.language}`] || card.descriptionHtml_en || ''}</div>
                                                </div>
                                            ` : `
                                                ${card[`name_${this.language}`] || 'Card ' + (index + 1)}
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
                    ` : ''}
                    
                    ${this.session.selectedCardsHistory && this.session.selectedCardsHistory.length > 0 ? `
                        <div class="cards-area">
                            <h3 class="cards-title">${this.t('game.selectedCardsHistory')}</h3>
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                ${this.session.selectedCardsHistory.slice().reverse().map((entry, index) => `
                                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background: var(--bg-dark); border-radius: 12px; border: 2px solid var(--border);">
                                        <div style="min-width: 80px; font-weight: 700; color: var(--text-secondary);">
                                            ${this.t('game.turn')} ${entry.turnNumber}
                                        </div>
                                        <div style="flex: 1;">
                                            <strong>${entry.playerName}</strong>
                                            <span style="margin: 0 10px; color: var(--text-secondary);">→</span>
                                            <span style="padding: 4px 12px; background: var(--card-${entry.card.type}); border-radius: 6px; color: white;">
                                                ${entry.card[`name_${this.language}`] || entry.card.name_en || 'Card'}
                                            </span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${myPlayer.jobs.length > 0 && this.skillCardsCache.length > 0 ? `
                        <div class="cards-area">
                            <h3 class="cards-title">${this.t('game.relatedSkills')}</h3>
                            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                                ${this.skillCardsCache
                                    .filter(skill => {
                                        const matchesJobs = skill.matchesJobs ? skill.matchesJobs.split(',').map(Number) : [];
                                        return myPlayer.jobs.some(jobId => matchesJobs.includes(jobId));
                                    })
                                    .map(skill => {
                                        const isSelected = myPlayer.selectedSkillCardIds && myPlayer.selectedSkillCardIds.includes(skill.id);
                                        return `
                                        <div style="
                                            padding: 8px 16px; 
                                            background: ${isSelected ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #64748b 0%, #475569 100%)'}; 
                                            border-radius: 8px; 
                                            color: white;
                                            font-size: 0.9rem;
                                            display: flex;
                                            align-items: center;
                                            gap: 8px;
                                        ">
                                            ${isSelected ? '✓' : '○'} ${skill[`name_${this.language}`] || skill.name_en}
                                            <span style="font-size: 0.75rem; opacity: 0.8;">(${isSelected ? this.t('game.selected') : this.t('game.notYetSelected')})</span>
                                        </div>
                                        `;
                                    }).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderModal() {
        if (!this.modal) return '';

        // ★★★ 最終順位表示モーダルの追加 ★★★
        if (this.modal.finalRankings) {
            return `
                <div class="modal-overlay">
                    <div class="modal">
                        <h2>🎉 ${this.modal.title} 🎉</h2>
                        <div style="margin: 30px 0;">
                            ${this.modal.rankings.map(player => `
                                <div style="
                                    padding: 15px 20px; 
                                    margin-bottom: 10px; 
                                    background: var(--bg-dark); 
                                    border-radius: 12px; 
                                    border: 2px solid ${player.rank === 1 ? '#fbbf24' : player.rank === 2 ? '#cbd5e1' : player.rank === 3 ? '#f59e0b' : 'var(--border)'};
                                    display: flex;
                                    align-items: center;
                                    gap: 15px;
                                    font-size: 1.2rem;
                                    font-weight: 600;
                                ">
                                    <span style="font-size: 2rem;">${this.getRankEmoji(player.rank)}</span>
                                    <span style="min-width: 60px; color: var(--text-secondary);">${player.rank}${this.t('game.rankSuffix')}</span>
                                    <span style="flex: 1;">${player.name}</span>
                                </div>
                            `).join('')}
                        </div>
                        <button class="btn" onclick="game.closeModal()">
                            ${this.t('common.close')}
                        </button>
                    </div>
                </div>
            `;
        }

        if (this.modal.playerSelection) {
            return `
                <div class="modal-overlay" onclick="game.closeModal()">
                    <div class="modal" onclick="event.stopPropagation()">
                        <h2>${this.modal.title}</h2>
                        <div class="select-job-list">
                            ${this.modal.players.map(player => `
                                <div class="select-job-item" onclick="game.resign('${player.id}')">
                                    ${player.name}
                                </div>
                            `).join('')}
                        </div>
                        <button class="btn btn-secondary" onclick="game.closeModal()">
                            ${this.t('common.cancel')}
                        </button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="modal-overlay" onclick="game.closeModal()">
                <div class="modal" onclick="event.stopPropagation()">
                    <h2>${this.modal.title}</h2>
                    <div class="modal-content">
                        ${this.modal.content || ''}
                    </div>
                    <button class="btn" onclick="game.closeModal()">
                        ${this.t('common.close')}
                    </button>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        document.querySelectorAll('[data-lang]').forEach(btn => {
            btn.addEventListener('click', () => {
                i18n.setLanguage(btn.dataset.lang);
            });
        });
        
        // Load job cards for selection
        const jobSelectionContainer = document.getElementById('jobSelection');
        if (jobSelectionContainer && this.jobCardsCache.length > 0) {
            const selectedJobIds = new Set();
            if (this.session && this.session.players) {
                this.session.players.forEach(player => {
                    if (player.id !== this.playerId && player.jobs && player.jobs.length > 0) {
                        player.jobs.forEach(jobId => selectedJobIds.add(jobId));
                    }
                });
            }
            
            jobSelectionContainer.innerHTML = this.jobCardsCache.map(job => {
                const isFlipped = this.flippedJobCards && this.flippedJobCards.has(job.id);
                const isSelected = selectedJobIds.has(job.id);
                const bgStyle = isSelected 
                    ? 'background: linear-gradient(135deg, #64748b 0%, #475569 100%); opacity: 0.5;'
                    : 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);';
                
                return `
                <div class="simple-card ${isSelected ? 'disabled' : ''}" style="${bgStyle}">
                    <div class="simple-card-main" onclick="${isSelected ? '' : `game.selectJob(${job.id})`}">
                        ${isFlipped ? `
                            <div class="simple-card-content">
                                ${job.imageUrl ? `<img src="${job.imageUrl}" style="max-width: 100%; border-radius: 8px; margin-bottom: 10px;">` : ''}
                                <div>${job[`descriptionHtml_${this.language}`] || ''}</div>
                            </div>
                        ` : `
                            ${job[`name_${this.language}`]}${isSelected ? '<br><small style="color: var(--text-secondary);">' + this.t('game.alreadySelectedByOther') + '</small>' : ''}
                        `}
                    </div>
                    <div class="simple-card-footer" onclick="event.stopPropagation(); ${isSelected ? '' : `game.flipJobCard(${job.id})`}">
                        ${isFlipped ? '← ' + this.t('game.backToFront') : this.t('game.viewDetails') + ' →'}
                    </div>
                </div>
                `;
            }).join('');
        } else if (jobSelectionContainer) {
            fetch('/api/cards/jobs')
                .then(r => r.json())
                .then(data => {
                    const jobs = data.ok ? data.data : data;
                    this.jobCardsCache = jobs;
                    
                    const selectedJobIds = new Set();
                    if (this.session && this.session.players) {
                        this.session.players.forEach(player => {
                            if (player.id !== this.playerId && player.jobs && player.jobs.length > 0) {
                                player.jobs.forEach(jobId => selectedJobIds.add(jobId));
                            }
                        });
                    }
                    
                    jobSelectionContainer.innerHTML = jobs.map(job => {
                        const isFlipped = this.flippedJobCards && this.flippedJobCards.has(job.id);
                        const isSelected = selectedJobIds.has(job.id);
                        const bgStyle = isSelected 
                            ? 'background: linear-gradient(135deg, #64748b 0%, #475569 100%); opacity: 0.5;'
                            : 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);';
                        
                        return `
                        <div class="simple-card ${isSelected ? 'disabled' : ''}" style="${bgStyle}">
                            <div class="simple-card-main" onclick="${isSelected ? '' : `game.selectJob(${job.id})`}">
                                ${isFlipped ? `
                                    <div class="simple-card-content">
                                        ${job.imageUrl ? `<img src="${job.imageUrl}" style="max-width: 100%; border-radius: 8px; margin-bottom: 10px;">` : ''}
                                        <div>${job[`descriptionHtml_${this.language}`] || ''}</div>
                                    </div>
                                ` : `
                                    ${job[`name_${this.language}`]}${isSelected ? '<br><small style="color: var(--text-secondary);">' + this.t('game.alreadySelectedByOther') + '</small>' : ''}
                                `}
                            </div>
                            <div class="simple-card-footer" onclick="event.stopPropagation(); ${isSelected ? '' : `game.flipJobCard(${job.id})`}">
                                ${isFlipped ? '← ' + this.t('game.backToFront') : this.t('game.viewDetails') + ' →'}
                            </div>
                        </div>
                        `;
                    }).join('');
                });
        }
    }
}

// Initialize game
const game = new GameClient();
window.game = game;
game.init();
