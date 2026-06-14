'use strict';

// ════════════════════════════════════════════════════════════════
// I18n クラス（Section 6.1）
// ════════════════════════════════════════════════════════════════
class I18n {
    constructor() {
        const saved = localStorage.getItem('language');
        const nav   = navigator.language || navigator.userLanguage || 'ja';
        this.currentLang  = saved || (nav.startsWith('ja') ? 'ja' : 'en');
        this.translations = {};
    }

    async init() {
        await this.loadTranslations(this.currentLang);
    }

    async loadTranslations(lang) {
        try {
            const res  = await fetch(`/api/lang/${lang}`);
            const data = await res.json();
            if (data.ok && data.translations) {
                this.translations = data.translations;
                this.currentLang  = lang;
                localStorage.setItem('language', lang);
                document.documentElement.lang = lang;
            }
        } catch (e) {
            console.warn(`[I18n] Failed to load language "${lang}":`, e);
        }
    }

    async setLanguage(lang) {
        await this.loadTranslations(lang);
        if (window.game) window.game.render();
    }

    /** ドット区切りキーでネストを解決。見つからなければ key をそのまま返す */
    t(key) {
        const parts = key.split('.');
        let node = this.translations;
        for (const p of parts) {
            if (node == null || typeof node !== 'object') return key;
            node = node[p];
        }
        return (node != null && typeof node !== 'object') ? String(node) : key;
    }
}

const i18n = new I18n();

// ════════════════════════════════════════════════════════════════
// アバター定数（Section 16.1）
// ════════════════════════════════════════════════════════════════
const AVATAR_TYPES = [
    { id: 1, name_ja: '卒業キャップ', name_en: 'Grad Cap',  accessory: 'cap'     },
    { id: 2, name_ja: 'ベレー帽',     name_en: 'Beret',     accessory: 'beret'   },
    { id: 3, name_ja: 'お団子ヘア',   name_en: 'Hair Bun',  accessory: 'bun'     },
    { id: 4, name_ja: 'メガネ',       name_en: 'Glasses',   accessory: 'glasses' },
];

const AVATAR_COLORS = [
    { id: 1, name_ja: 'インディゴ',   hex: '#6366f1', three: 0x6366f1 },
    { id: 2, name_ja: 'アンバー',     hex: '#f59e0b', three: 0xf59e0b },
    { id: 3, name_ja: 'エメラルド',   hex: '#10b981', three: 0x10b981 },
    { id: 4, name_ja: 'レッド',       hex: '#ef4444', three: 0xef4444 },
    { id: 5, name_ja: 'スカイ',       hex: '#38bdf8', three: 0x38bdf8 },
    { id: 6, name_ja: 'バイオレット', hex: '#a855f7', three: 0xa855f7 },
];

// ════════════════════════════════════════════════════════════════
// カード定数
// ════════════════════════════════════════════════════════════════
const CARD_GRADIENTS = {
    skill:   'linear-gradient(135deg,#f093fb,#f5576c)',
    mission: 'linear-gradient(135deg,#4facfe,#00f2fe)',
    special: 'linear-gradient(135deg,#fa709a,#fee140)',
};

const CARD_GLOW = {
    skill:   'rgba(240,147,251,.65)',
    mission: 'rgba(79,172,254,.65)',
    special: 'rgba(250,112,154,.65)',
};

const CARD_TYPE_LABELS_JA = {
    skill:   'スキル',
    mission: 'ミッション',
    special: '特殊',
};

// ════════════════════════════════════════════════════════════════
// Three.js 座席定数（Section 15.2）
// ════════════════════════════════════════════════════════════════
const SEAT_ANGLES = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
const SEAT_RADIUS = 4.75;

// ════════════════════════════════════════════════════════════════
// SceneManager クラス（Section 15.2）
// GameClient クラスの直前に定義
// ════════════════════════════════════════════════════════════════
class SceneManager {
    constructor(containerId) {
        // DOM コンテナ
        this.container = document.getElementById(containerId);

        // Three.js コア
        this.scene    = null;
        this.camera   = null;
        this.renderer = null;

        // アバター・リング・ラベル
        this.avatarGroups  = new Map(); // playerId → THREE.Group
        this.turnRings     = new Map(); // playerId → THREE.Mesh
        this.labelElements = new Map(); // playerId → HTMLElement

        // ダイス
        this.diceObject = null;

        // アニメーション
        this.animationId = null;
        this.time        = 0;

        // ダイスロールアニメーション
        this.isRolling      = false;
        this.rollTime       = 0;
        this._rollCallback  = null;

        // カメラ球面座標（現在値・目標値）
        this.camCurrent = { theta: 0.42, phi: 1.02, radius: 13 };
        this.camTarget  = { theta: 0.42, phi: 1.02, radius: 13 };

        // イベントハンドラ保持（destroy 時に removeEventListener するため）
        this._handlers = {};

        // サイドリム PointLight（ゆらぎあり）
        this._rl1 = null;
        this._rl2 = null;

        // プレイヤー専用PointLight × 4（安定）
        this._playerLights = [];

        // seatIndex 解決用
        this._players = [];
    }

    // ── public メソッド ───────────────────────────────────────

    /** シーン構築・アニメーション開始 */
    init(players) {
        this._players = players;
        this._setupRenderer();
        // _setupRenderer が失敗した場合（container が null 等）は中断
        if (!this.scene || !this.renderer) {
            console.error('[SceneManager] _setupRenderer に失敗したため init を中断します');
            return;
        }
        this._buildScene();
        this._buildAvatars(players);
        this._setupCameraControls();
        this._startAnimationLoop();
    }

    /** リソース解放・canvas 削除（Section 15.4）*/
    destroy() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.animationId = null;
        this._removeCameraControls();
        this.labelElements.forEach(el => el.remove());
        this.labelElements.clear();
        this.avatarGroups.clear();
        this.turnRings.clear();
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }
        this.scene    = null;
        this.camera   = null;
        this.renderer = null;
    }

    /** アクティブプレイヤーのターンリングを更新してカメラをフォーカス（Section 16.2）*/
    updateTurn(currentPlayerId) {
        this.turnRings.forEach((ring, playerId) => {
            const isActive = playerId === currentPlayerId;
            const color    = this._getPlayerColor(playerId);
            ring.material.color.setHex(isActive ? color : 0x282848);
            ring.material.emissive?.setHex(isActive ? color : 0x000000);
            ring.material.emissiveIntensity = isActive ? 0.3 : 0;
            ring.material.opacity = isActive ? 0.9 : 0.15;
        });
        const seatIdx = this._getSeatIndex(currentPlayerId);
        this.focusCameraOnSeat(seatIdx);
    }

    /** ダイスロールアニメーション開始 */
    triggerDiceRoll(callback = null) {
        this.isRolling     = true;
        this.rollTime      = 0;
        this._rollCallback = callback;
    }

    /** 3Dテーブルにカードメッシュを配置（Section 15.4）*/
    showCardOnTable(playerId, cardType) {
        if (!this.scene) return;
        const COLORS  = { skill: 0xf093fb, mission: 0x4facfe, special: 0xfa709a };
        const color   = COLORS[cardType] ?? 0xffffff;
        const seatIdx = this._getSeatIndex(playerId);
        const ang     = SEAT_ANGLES[seatIdx];

        const geo  = new THREE.BoxGeometry(0.77, 0.022, 1.02);
        const mat  = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(
            Math.sin(ang) * 2.6,
            0.17 + Math.random() * 0.06,
            Math.cos(ang) * 2.6
        );
        mesh.rotation.y = (Math.random() - 0.5) * 0.4;
        this.scene.add(mesh);
    }

    /** ターン切り替え時: 全プレイヤーを見下ろす俯瞰視点 */
    focusCameraOnSeat(seatIndex) {
        // phi を小さくすると真上に近づく（0.22 = ほぼ真上）
        this.camTarget.phi    = 0.28;
        this.camTarget.radius = 16;
        // theta はアクティブプレイヤーの方向に少し向ける
        this.camTarget.theta  = SEAT_ANGLES[seatIndex] + Math.PI;
        // 注視点をテーブル中心にリセット
        if (this._lookAtOffset) {
            this._lookAtOffset.x = 0;
            this._lookAtOffset.y = 1;
            this._lookAtOffset.z = 0;
        }
    }

    // ── private メソッド スタブ ──────────────────────────────

    /** WebGLRenderer・カメラ・シーン初期化 */
    _setupRenderer() {
        // container が DOM に存在しない場合は再取得
        if (!this.container) {
            this.container = document.getElementById('scene-container');
        }
        if (!this.container) {
            console.error('[SceneManager] #scene-container が見つかりません。render() より後に initScene() を呼んでください。');
            return;
        }
        const W = this.container.clientWidth  || window.innerWidth;
        const H = this.container.clientHeight || window.innerHeight;

        // シーン
        this.scene     = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x06060e, 0.034);

        // 空球（背景色の代わり）
        const skyGeo = new THREE.SphereGeometry(80, 24, 24);
        const skyMat = new THREE.MeshBasicMaterial({ color: 0x04040c, side: THREE.BackSide });
        this.scene.add(new THREE.Mesh(skyGeo, skyMat));

        // カメラ
        this.camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 120);
        // 初期位置を即座に設定（lerp 開始前に正しい位置へ）
        const _r = this.camCurrent.radius;
        const _t = this.camCurrent.theta;
        const _p = this.camCurrent.phi;
        this.camera.position.set(
            _r * Math.sin(_t) * Math.sin(_p),
            _r * Math.cos(_p) + 1.2,
            _r * Math.cos(_t) * Math.sin(_p)
        );
        this.camera.lookAt(0, 1, 0);

        // レンダラー
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(W, H);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
        this.renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;z-index:1;';
        this.container.appendChild(this.renderer.domElement);

        // リサイズハンドラ
        const onResize = () => {
            const w = this.container.clientWidth  || window.innerWidth;
            const h = this.container.clientHeight || window.innerHeight;
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
        };
        this._handlers['window:resize'] = onResize;
        window.addEventListener('resize', onResize);
    }

    /** 3Dシーン構築（フロア・壁・テーブル・パーティクル等）*/
    _buildScene() {
        const scene = this.scene;
        const PI    = Math.PI;

        // ────────────────────────────────────────────────────────
        // ライティング（Section 15.6）
        // ────────────────────────────────────────────────────────

        // 環境光
        scene.add(new THREE.AmbientLight(0x1a1a40, 1.6));

        // スポットライト（テーブル主光源）
        this._spot = new THREE.SpotLight(0xfff4e8, 2.6, 30, PI / 4.8, 0.5, 1.0);
        this._spot.position.set(0, 13, 0);
        this._spot.castShadow = true;
        scene.add(this._spot);

        // サイドリムライト（ゆらぎあり）
        this._rl1 = new THREE.PointLight(0x6366f1, 0.45, 18);
        this._rl1.position.set(-7, 2, -7);
        scene.add(this._rl1);

        this._rl2 = new THREE.PointLight(0x10b981, 0.25, 18);
        this._rl2.position.set(7, 2, 7);
        scene.add(this._rl2);

        // プレイヤー専用ポイントライト × 4（安定・ゆらぎなし）
        SEAT_ANGLES.forEach(ang => {
            const pl = new THREE.PointLight(0xfff6e8, 1.1, 7.5);
            pl.position.set(
                Math.sin(ang) * SEAT_RADIUS * 0.85,
                5.5,
                Math.cos(ang) * SEAT_RADIUS * 0.85
            );
            scene.add(pl);
            this._playerLights.push(pl);
        });

        // ────────────────────────────────────────────────────────
        // フロア（ベースプレーン）
        // ────────────────────────────────────────────────────────
        const floorGeo = new THREE.PlaneGeometry(28, 28);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x0c0c1c, roughness: 0.9 });
        const floor    = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x    = -PI / 2;
        floor.position.y    = -1.65;
        floor.receiveShadow = true;
        scene.add(floor);

        // ────────────────────────────────────────────────────────
        // 六角タイルフロア
        // ────────────────────────────────────────────────────────
        const tileColors   = [0x0d0d22, 0x0f0f2a, 0x0b0b1e];
        const hexGeo       = new THREE.CylinderGeometry(1.22, 1.22, 0.045, 6);
        let tileCount      = 0;

        for (let r = -6; r <= 6; r++) {
            for (let c = -7; c <= 7; c++) {
                const px = c * 2.425;
                const pz = r * 2.8 + (c % 2 ? 1.4 : 0);
                if (px * px + pz * pz > 200) continue;

                const isGlow = (tileCount % 23 === 0);
                const mat    = new THREE.MeshStandardMaterial({
                    color:     tileColors[(r + c + 99) % 3],
                    emissive:  isGlow ? 0x22226a : 0x000000,
                    roughness: 0.8,
                });
                const tile = new THREE.Mesh(hexGeo, mat);
                tile.position.set(px, -1.627, pz);
                tile.rotation.y    = PI / 6;
                tile.receiveShadow = true;
                scene.add(tile);
                tileCount++;
            }
        }

        // ────────────────────────────────────────────────────────
        // 八角形部屋
        // ────────────────────────────────────────────────────────
        const roomR   = 16;
        const wallH   = 10;
        const wallW   = 2 * roomR * Math.tan(PI / 8); // 各辺の幅
        const wallColors  = [0x0c0c20, 0x0a0a1c, 0x0e0e24];
        const wallLightColors = [0x6366f1, 0x38bdf8];

        for (let i = 0; i < 8; i++) {
            const midA = (i / 8) * 2 * PI;

            // 壁パネル
            const wallGeo = new THREE.PlaneGeometry(wallW, wallH);
            const wallMat = new THREE.MeshStandardMaterial({
                color:    wallColors[i % 3],
                roughness: 0.95,
            });
            const wall = new THREE.Mesh(wallGeo, wallMat);
            wall.position.set(
                Math.sin(midA) * roomR,
                wallH / 2 - 1.65,
                Math.cos(midA) * roomR
            );
            wall.rotation.y = PI - midA;
            scene.add(wall);

            // LED 底面ストリップ
            const stripGeo = new THREE.BoxGeometry(wallW * 0.88, 0.07, 0.05);
            const stripMat = new THREE.MeshStandardMaterial({
                color: 0x6366f1, emissive: 0x6366f1, emissiveIntensity: 0.6,
            });
            const strip = new THREE.Mesh(stripGeo, stripMat);
            strip.position.set(
                Math.sin(midA) * (roomR - 0.04),
                -1.62,
                Math.cos(midA) * (roomR - 0.04)
            );
            strip.rotation.y = PI - midA;
            scene.add(strip);

            // 上部アクセントバー
            const barGeo = new THREE.BoxGeometry(wallW * 0.65, 0.04, 0.04);
            const barMat = new THREE.MeshStandardMaterial({
                color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.5,
            });
            const bar = new THREE.Mesh(barGeo, barMat);
            bar.position.set(
                Math.sin(midA) * (roomR - 0.03),
                wallH - 1.65 - 0.3,
                Math.cos(midA) * (roomR - 0.03)
            );
            bar.rotation.y = PI - midA;
            scene.add(bar);

            // 柱
            const pillarA = ((i + 0.5) / 8) * 2 * PI;
            const pillarGeo = new THREE.CylinderGeometry(0.18, 0.18, wallH, 8);
            const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0e0e24, roughness: 0.8 });
            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(
                Math.sin(pillarA) * roomR,
                wallH / 2 - 1.65,
                Math.cos(pillarA) * roomR
            );
            scene.add(pillar);

            // 柱グロウ（交互に色を変える）
            const glowGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.06, 8);
            const glowColor = i % 2 === 0 ? 0x6366f1 : 0x38bdf8;
            const glowMat   = new THREE.MeshStandardMaterial({
                color: glowColor, emissive: glowColor, emissiveIntensity: 0.7, transparent: true, opacity: 0.8,
            });
            const glow = new THREE.Mesh(glowGeo, glowMat);
            glow.position.set(
                Math.sin(pillarA) * roomR,
                -1.62,
                Math.cos(pillarA) * roomR
            );
            scene.add(glow);

            // 壁ライト（偶数セグメントごと）
            if (i % 2 === 0) {
                const wlColor = wallLightColors[(i / 2) % 2];
                const wl      = new THREE.PointLight(wlColor, 0.38, 11);
                wl.position.set(
                    Math.sin(midA) * (roomR - 1.5),
                    2.0,
                    Math.cos(midA) * (roomR - 1.5)
                );
                scene.add(wl);
                // アニメーション対応のため配列に保持
                this._wallLights = this._wallLights || [];
                this._wallLights.push(wl);
            }
        }

        // 天井・中央グロウディスク: カメラ操作の妨げになるため削除

        // ────────────────────────────────────────────────────────
        // パーティクル（70個）
        // ────────────────────────────────────────────────────────
        const PARTICLE_COUNT = 70;
        const positions      = new Float32Array(PARTICLE_COUNT * 3);
        const colors         = new Float32Array(PARTICLE_COUNT * 3);
        this._particlePhases = new Float32Array(PARTICLE_COUNT);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const angle  = Math.random() * 2 * PI;
            const radius = 3 + Math.random() * 11;
            positions[i * 3]     = Math.cos(angle) * radius;
            positions[i * 3 + 1] = Math.random() * 7 - 1;
            positions[i * 3 + 2] = Math.sin(angle) * radius;
            // 色: インディゴ〜スカイ系
            colors[i * 3]     = 0.3 + Math.random() * 0.4;
            colors[i * 3 + 1] = 0.3 + Math.random() * 0.3;
            colors[i * 3 + 2] = 0.8 + Math.random() * 0.2;
            this._particlePhases[i] = Math.random() * 2 * PI;
        }

        const partGeo = new THREE.BufferGeometry();
        partGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        partGeo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
        const partMat = new THREE.PointsMaterial({
            vertexColors: true, size: 0.1, transparent: true, opacity: 0.65,
        });
        this._particles     = new THREE.Points(partGeo, partMat);
        this._particlePositions = positions;
        scene.add(this._particles);

        // ────────────────────────────────────────────────────────
        // テーブル（Section 15.3）
        // ────────────────────────────────────────────────────────

        // フェルト天板
        const feltGeo = new THREE.CylinderGeometry(3.32, 3.32, 0.12, 64);
        const feltMat = new THREE.MeshStandardMaterial({ color: 0x163016, roughness: 0.8 });
        const felt    = new THREE.Mesh(feltGeo, feltMat);
        felt.position.y    = 0.06;
        felt.receiveShadow = true;
        scene.add(felt);

        // 木製リム
        const rimGeo = new THREE.CylinderGeometry(3.45, 3.45, 0.18, 64, 1, true);
        const rimMat = new THREE.MeshStandardMaterial({ color: 0x4a1e0e, roughness: 0.7, side: THREE.DoubleSide });
        const rim    = new THREE.Mesh(rimGeo, rimMat);
        rim.position.y = 0.09;
        scene.add(rim);

        // 天板ベース
        const baseGeo = new THREE.CylinderGeometry(3.45, 3.45, 0.07, 64);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x3a1608, roughness: 0.8 });
        const base    = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = -0.035;
        scene.add(base);

        // 脚 × 4
        const legGeo = new THREE.CylinderGeometry(0.11, 0.15, 2.5, 8);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x3a1608, roughness: 0.9 });
        [[-2.1, -2.1], [2.1, -2.1], [-2.1, 2.1], [2.1, 2.1]].forEach(([lx, lz]) => {
            const leg     = new THREE.Mesh(legGeo, legMat);
            leg.position.set(lx, -1.3, lz);
            leg.castShadow = true;
            scene.add(leg);
        });

        // ────────────────────────────────────────────────────────
        // カードデッキ（センター）
        // ────────────────────────────────────────────────────────
        const deckGeo = new THREE.BoxGeometry(0.87, 0.034, 1.12);
        const deckMat = new THREE.MeshStandardMaterial({ color: 0x3b3b8f, roughness: 0.6 });
        for (let i = 0; i < 7; i++) {
            const card = new THREE.Mesh(deckGeo, deckMat);
            card.position.set(0, 0.16 + i * 0.034, 0);
            card.rotation.y = (Math.random() - 0.5) * 0.25;
            scene.add(card);
        }

        // ────────────────────────────────────────────────────────
        // ダイス
        // ────────────────────────────────────────────────────────
        const diceGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const diceMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.2, metalness: 0.1 });
        this.diceObject = new THREE.Mesh(diceGeo, diceMat);
        this.diceObject.position.set(0.95, 0.47, 0.95);
        this.diceObject.castShadow = true;
        scene.add(this.diceObject);

        // ────────────────────────────────────────────────────────
        // プレイヤーカードスロット（4個）
        // ────────────────────────────────────────────────────────
        const slotGeo = new THREE.BoxGeometry(0.92, 0.008, 1.14);
        SEAT_ANGLES.forEach((ang, i) => {
            const playerColor = AVATAR_COLORS[i % AVATAR_COLORS.length].three;
            const slotMat = new THREE.MeshStandardMaterial({
                color: playerColor, transparent: true, opacity: 0.22, roughness: 0.8,
            });
            const slot = new THREE.Mesh(slotGeo, slotMat);
            slot.position.set(
                Math.sin(ang) * 2.6,
                0.14,
                Math.cos(ang) * 2.6
            );
            scene.add(slot);
        });
    }

    /** アバター・椅子・ラベル生成（Section 16.2）*/
    _buildAvatars(players) {
        this._players = players;
        const PI = Math.PI;

        players.forEach((p, i) => {
            // 1. 色を取得
            const colorDef   = AVATAR_COLORS.find(c => c.id === p.avatarColorId) ?? AVATAR_COLORS[0];
            const avatarColor = colorDef.three;
            const colorHex    = colorDef.hex;

            // 2. グループ生成・座席位置計算
            const grp = new THREE.Group();
            const ang = SEAT_ANGLES[p.seatIndex ?? i];
            const sx  = Math.sin(ang) * SEAT_RADIUS;
            const sz  = Math.cos(ang) * SEAT_RADIUS;
            grp.position.set(sx, -1.65, sz);
            grp.rotation.y = Math.atan2(sx, sz);

            // ── 3. 椅子 ──────────────────────────────────────────
            const chairMat = new THREE.MeshStandardMaterial({ color: 0x1c1c3a, roughness: 0.8 });
            const legMat   = new THREE.MeshStandardMaterial({ color: 0x14142a, roughness: 0.9 });

            // 座面
            const seat = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.09, 1.18), chairMat);
            seat.position.y = 0.96;
            grp.add(seat);

            // 背もたれ
            const back = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.88, 0.09), chairMat);
            back.position.set(0, 1.39, -0.54);
            grp.add(back);

            // 脚 × 4
            const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.83, 7);
            [[-0.47, -0.47], [0.47, -0.47], [-0.47, 0.47], [0.47, 0.47]].forEach(([lx, lz]) => {
                const leg = new THREE.Mesh(legGeo, legMat);
                leg.position.set(lx, 0.545, lz);
                grp.add(leg);
            });

            // ── 4. アバター本体 ───────────────────────────────────
            const bodyMat = new THREE.MeshStandardMaterial({ color: avatarColor, roughness: 0.6 });
            const skinMat = new THREE.MeshStandardMaterial({ color: 0xf0c098, roughness: 0.7 });
            const neckMat = new THREE.MeshStandardMaterial({ color: 0xdba882, roughness: 0.7 });

            // 胴体
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.33, 0.88, 16), bodyMat);
            body.position.y = 1.77;
            grp.add(body);

            // 首
            const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.17, 10), neckMat);
            neck.position.y = 2.25;
            grp.add(neck);

            // 頭
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 16, 16), skinMat);
            head.position.y = 2.62;
            grp.add(head);

            // ── 5. アクセサリー ───────────────────────────────────
            const typeInfo  = AVATAR_TYPES.find(t => t.id === p.avatarId);
            const accessory = typeInfo?.accessory ?? 'cap';
            const accColor  = new THREE.MeshStandardMaterial({ color: avatarColor, roughness: 0.5 });
            const darkMat   = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.8 });

            if (accessory === 'cap') {
                // つば
                const brim = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.07, 0.7), darkMat);
                brim.position.y = 3.0;
                grp.add(brim);
                // トップ
                const top = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 6), darkMat);
                top.position.y = 2.97;
                grp.add(top);

            } else if (accessory === 'beret') {
                const beretGeo = new THREE.SphereGeometry(0.32, 12, 12);
                const beret    = new THREE.Mesh(beretGeo, accColor);
                beret.scale.y  = 0.34;
                beret.position.y = 2.92;
                grp.add(beret);

            } else if (accessory === 'bun') {
                const bunMat = new THREE.MeshStandardMaterial({ color: 0x4a2a08, roughness: 0.8 });
                const bun    = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), bunMat);
                bun.position.y = 2.97;
                grp.add(bun);

            } else if (accessory === 'glasses') {
                const glassMat = new THREE.MeshStandardMaterial({ color: 0x8888a0, roughness: 0.4, metalness: 0.3 });
                const lensGeo  = new THREE.TorusGeometry(0.09, 0.02, 6, 12);
                // 左レンズ
                const lensL = new THREE.Mesh(lensGeo, glassMat);
                lensL.position.set(-0.13, 2.58, 0.3);
                grp.add(lensL);
                // 右レンズ
                const lensR = new THREE.Mesh(lensGeo, glassMat);
                lensR.position.set(0.13, 2.58, 0.3);
                grp.add(lensR);
                // ブリッジ
                const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), glassMat);
                bridge.position.set(0, 2.58, 0.3);
                grp.add(bridge);
            }

            // ── 6. ターンリング ───────────────────────────────────
            const ringGeo = new THREE.TorusGeometry(0.54, 0.055, 8, 28);
            const isFirst = i === 0;
            const ringMat = new THREE.MeshStandardMaterial({
                color:       isFirst ? avatarColor : 0x282848,
                transparent: true,
                opacity:     isFirst ? 0.9 : 0.15,
                emissive:    isFirst ? avatarColor : 0x000000,
                emissiveIntensity: isFirst ? 0.3 : 0,
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.y = 0.91;
            ring.rotation.x = PI / 2;
            grp.add(ring);
            this.turnRings.set(p.id, ring);

            // ── 7. シーンに追加 ───────────────────────────────────
            this.scene.add(grp);
            this.avatarGroups.set(p.id, grp);

            // ── 8. カードスロット ─────────────────────────────────
            const slotMat = new THREE.MeshStandardMaterial({
                color: avatarColor, transparent: true, opacity: 0.22, roughness: 0.8,
            });
            const slot = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.008, 1.14), slotMat);
            slot.position.set(Math.sin(ang) * 2.6, 0.14, Math.cos(ang) * 2.6);
            this.scene.add(slot);

            // ── 9. HTML ラベル ────────────────────────────────────
            const overlay = document.getElementById('ui-overlay');
            if (overlay) {
                const label = document.createElement('div');
                label.style.cssText = [
                    'position:absolute',
                    `border:0.5px solid ${colorHex}55`,
                    'border-radius:20px',
                    'padding:3px 9px',
                    'font-size:11px',
                    'font-weight:600',
                    'color:#e2e8f0',
                    'background:rgba(6,6,18,.82)',
                    'pointer-events:none',
                    'white-space:nowrap',
                    'backdrop-filter:blur(4px)',
                ].join(';');
                label.innerHTML =
                    `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;` +
                    `background:${colorHex};margin-right:5px;vertical-align:middle;"></span>` +
                    `${p.name}`;
                overlay.appendChild(label);
                this.labelElements.set(p.id, label);
            }
        });
    }

    /** マウス・タッチカメラコントロール登録（Section 15.4）
     * #ui-interactive が z-index:3 で canvas の上に重なるため、
     * マウスイベントは window レベルで登録してボタン以外をカメラ操作に使う */
    _setupCameraControls() {
        let dragging = false;
        let px = 0, py = 0;

        // ボタン・入力要素のクリックはカメラ操作と区別する
        const isUIElement = (el) => {
            return el && (el.tagName === 'BUTTON' || el.tagName === 'INPUT' ||
                          el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' ||
                          el.closest('button') || el.closest('input'));
        };

        const onMouseDown = (e) => {
            if (isUIElement(e.target)) return;
            dragging = true;
            px = e.clientX; py = e.clientY;
        };
        const onMouseUp = () => { dragging = false; };
        const onMouseMove = (e) => {
            if (!dragging) return;
            const dx = e.clientX - px;
            const dy = e.clientY - py;
            px = e.clientX; py = e.clientY;
            this.camTarget.theta -= dx * 0.007;
            this.camTarget.phi    = Math.max(0.22, Math.min(1.38, this.camTarget.phi - dy * 0.007));
        };
        const onWheel = (e) => {
            if (isUIElement(e.target)) return;
            this.camTarget.radius = Math.max(7, Math.min(20, this.camTarget.radius + e.deltaY * 0.01));
        };

        // タッチ対応
        let lastTouchX = 0, lastTouchY = 0;
        const onTouchStart = (e) => {
            if (isUIElement(e.target)) return;
            dragging = true;
            lastTouchX = e.touches[0].clientX;
            lastTouchY = e.touches[0].clientY;
        };
        const onTouchEnd = () => { dragging = false; };
        const onTouchMove = (e) => {
            if (!dragging || e.touches.length < 1) return;
            const dx = e.touches[0].clientX - lastTouchX;
            const dy = e.touches[0].clientY - lastTouchY;
            lastTouchX = e.touches[0].clientX;
            lastTouchY = e.touches[0].clientY;
            this.camTarget.theta -= dx * 0.007;
            this.camTarget.phi    = Math.max(0.22, Math.min(1.38, this.camTarget.phi - dy * 0.007));
        };

        // ゲーム定番キーボード操作
        // W/↑: 前進  S/↓: 後退  A/←: 左移動  D/→: 右移動
        // Q: 左回転  E: 右回転
        // ホイール / PageUp/Down: ズーム
        this._keys = {};
        const onKeyDown = (e) => {
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            this._keys[e.key.toLowerCase()] = true;
            // ページスクロール防止
            if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) {
                e.preventDefault();
            }
        };
        const onKeyUp = (e) => {
            this._keys[e.key.toLowerCase()] = false;
        };

        // すべて window レベルで登録（UIレイヤーの上からでも拾えるように）
        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mouseup',   onMouseUp);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('wheel',     onWheel, { passive: false });
        window.addEventListener('touchstart',onTouchStart, { passive: true });
        window.addEventListener('touchend',  onTouchEnd);
        window.addEventListener('touchmove', onTouchMove, { passive: true });
        window.addEventListener('keydown',   onKeyDown);
        window.addEventListener('keyup',     onKeyUp);

        // cleanup 用に保持
        this._handlers['window:mousedown']  = onMouseDown;
        this._handlers['window:mouseup']    = onMouseUp;
        this._handlers['window:mousemove']  = onMouseMove;
        this._handlers['window:wheel']      = onWheel;
        this._handlers['window:touchstart'] = onTouchStart;
        this._handlers['window:touchend']   = onTouchEnd;
        this._handlers['window:touchmove']  = onTouchMove;
        this._handlers['window:keydown']    = onKeyDown;
        this._handlers['window:keyup']      = onKeyUp;
    }

    /** カメラコントロール解除 */
    _removeCameraControls() {
        const el = this.renderer?.domElement;
        Object.entries(this._handlers).forEach(([key, fn]) => {
            const [target, event] = key.split(':');
            if (target === 'window') {
                window.removeEventListener(event, fn);
            } else if (target === 'canvas' && el) {
                el.removeEventListener(event, fn);
            }
        });
        this._handlers = {};
    }

    /** requestAnimationFrame ループ開始（Section 15.4）*/
    _startAnimationLoop() {
        const loop = (timestamp) => {
            this.animationId = requestAnimationFrame(loop);
            if (!this.renderer || !this.scene || !this.camera) return;

            this.time += 0.016;
            const t = this.time;

            // ── 1. カメラ更新 ────────────────────────────────────
            const L = 0.07;
            const keys = this._keys || {};
            const MOVE_SPEED   = 0.12;  // 前後左右の移動速度
            const ROTATE_SPEED = 0.025; // QE回転速度
            const ZOOM_SPEED   = 0.15;  // ズーム速度

            // Q/E で theta 回転（lerp target を更新）
            if (keys['q'] || keys['arrowleft'])  this.camTarget.theta += ROTATE_SPEED;
            if (keys['e'] || keys['arrowright']) this.camTarget.theta -= ROTATE_SPEED;

            // ズーム: PageUp/Down
            if (keys['pageup'])   this.camTarget.radius = Math.max(2, this.camTarget.radius - ZOOM_SPEED);
            if (keys['pagedown']) this.camTarget.radius = Math.min(22, this.camTarget.radius + ZOOM_SPEED);

            // W/S: カメラの向きに対して前後移動（lookAt中心を平行移動）
            // A/D: カメラの向きに対して左右移動
            if (keys['w'] || keys['arrowup'] || keys['s'] || keys['arrowdown'] ||
                keys['a'] || keys['d']) {

                // 現在のカメラの theta（水平角）から前後左右ベクトルを算出
                const θ = this.camCurrent.theta;
                const fwdX = Math.sin(θ);   // 前方X
                const fwdZ = Math.cos(θ);   // 前方Z
                const rgtX = Math.cos(θ);   // 右方X
                const rgtZ = -Math.sin(θ);  // 右方Z

                let dx = 0, dz = 0;
                if (keys['w'] || keys['arrowup'])   { dx -= fwdX * MOVE_SPEED; dz -= fwdZ * MOVE_SPEED; }
                if (keys['s'] || keys['arrowdown']) { dx += fwdX * MOVE_SPEED; dz += fwdZ * MOVE_SPEED; }
                if (keys['a'])                      { dx -= rgtX * MOVE_SPEED; dz -= rgtZ * MOVE_SPEED; }
                if (keys['d'])                      { dx += rgtX * MOVE_SPEED; dz += rgtZ * MOVE_SPEED; }

                // lookAt の中心点をずらすことでカメラが移動する感覚を実現
                if (!this._lookAtOffset) this._lookAtOffset = { x: 0, y: 1, z: 0 };
                this._lookAtOffset.x += dx;
                this._lookAtOffset.z += dz;
                // 中心から遠くなりすぎないようにクランプ
                const dist = Math.sqrt(this._lookAtOffset.x ** 2 + this._lookAtOffset.z ** 2);
                if (dist > 14) {
                    this._lookAtOffset.x *= 14 / dist;
                    this._lookAtOffset.z *= 14 / dist;
                }
            }

            // lerp でスムーズに補間
            this.camCurrent.theta  += (this.camTarget.theta  - this.camCurrent.theta)  * L;
            this.camCurrent.phi    += (this.camTarget.phi    - this.camCurrent.phi)    * L;
            this.camCurrent.radius += (this.camTarget.radius - this.camCurrent.radius) * L;

            const r = this.camCurrent.radius;
            const θ = this.camCurrent.theta;
            const φ = this.camCurrent.phi;
            const ox = this._lookAtOffset?.x ?? 0;
            const oy = this._lookAtOffset?.y ?? 1;
            const oz = this._lookAtOffset?.z ?? 0;

            this.camera.position.set(
                ox + r * Math.sin(θ) * Math.sin(φ),
                oy + r * Math.cos(φ),
                oz + r * Math.cos(θ) * Math.sin(φ)
            );
            this.camera.lookAt(ox, oy, oz);

            // ── 2. ターンリングのパルス ──────────────────────────
            this.turnRings.forEach((ring, playerId) => {
                if (ring.material.opacity > 0.5) {
                    // アクティブリングのみパルス
                    const s = 1 + Math.sin(t * 3.6) * 0.13;
                    ring.scale.set(s, 1, s);
                } else {
                    ring.scale.set(1, 1, 1);
                }
            });

            // ── 3. ダイスアニメーション ──────────────────────────
            if (this.diceObject) {
                if (this.isRolling) {
                    this.rollTime += 0.016;
                    const spd = Math.max(0.05, 1 - this.rollTime / 2);
                    this.diceObject.rotation.x += spd * 0.3;
                    this.diceObject.rotation.y += spd * 0.2;
                    this.diceObject.rotation.z += spd * 0.15;
                    this.diceObject.position.y  = 0.47 + Math.abs(Math.sin(this.rollTime * 8)) * 0.6 * spd;
                    if (this.rollTime > this._diceRollDuration) {
                        this.isRolling = false;
                        this.diceObject.position.y = 0.47;
                        if (this._rollCallback) {
                            this._rollCallback();
                            this._rollCallback = null;
                        }
                    }
                } else {
                    this.diceObject.rotation.y += 0.005;
                    this.diceObject.position.y  = 0.47 + Math.sin(t * 1.2) * 0.027;
                }
            }

            // ── 4. ライトのゆらぎ ────────────────────────────────
            if (this._rl1) this._rl1.intensity = 0.34 + Math.sin(t * 0.7)  * 0.12;
            if (this._rl2) this._rl2.intensity = 0.20 + Math.cos(t * 0.85) * 0.08;
            if (this._wallLights) {
                this._wallLights.forEach((wl, i) => {
                    wl.intensity = 0.28 + Math.sin(t * 0.4 + i * 1.3) * 0.09;
                });
            }

            // ── 5. パーティクル y 座標更新 ───────────────────────
            if (this._particles && this._particlePositions && this._particlePhases) {
                const pos = this._particlePositions;
                for (let i = 0; i < this._particlePhases.length; i++) {
                    pos[i * 3 + 1] = 1.5 + Math.sin(t * 0.5 + this._particlePhases[i]) * 3.5;
                }
                this._particles.geometry.attributes.position.needsUpdate = true;
            }

            // ── 6. ラベル投影 ─────────────────────────────────────
            this.scene.updateMatrixWorld();
            this._updateLabels();

            // ── 7. レンダリング ───────────────────────────────────
            this.renderer.render(this.scene, this.camera);
        };
        loop();
    }

    /** アバターラベルを毎フレーム 3D→2D 投影（Section 15.5）*/
    _updateLabels() {
        if (!this.camera || !this.renderer) return;
        const W  = this.renderer.domElement.clientWidth  || window.innerWidth;
        const H  = this.renderer.domElement.clientHeight || window.innerHeight;
        const wp = new THREE.Vector3();

        this.avatarGroups.forEach((grp, playerId) => {
            const el = this.labelElements.get(playerId);
            if (!el) return;
            wp.set(0, 3.1, 0);
            wp.applyMatrix4(grp.matrixWorld);
            wp.project(this.camera);
            el.style.left    = ((wp.x *  0.5 + 0.5) * W) + 'px';
            el.style.top     = ((wp.y * -0.5 + 0.5) * H - 14) + 'px';
            el.style.display = wp.z > 1 ? 'none' : 'block';
        });
    }

    /** playerId から seatIndex を返す */
    _getSeatIndex(playerId) {
        return this._players.find(p => p.id === playerId)?.seatIndex ?? 0;
    }

    /** playerId からアバターカラー（THREE hex）を返す */
    _getPlayerColor(playerId) {
        const p = this._players.find(pl => pl.id === playerId);
        return (AVATAR_COLORS.find(c => c.id === p?.avatarColorId) ?? AVATAR_COLORS[0]).three;
    }
}

// ════════════════════════════════════════════════════════════════
// GameClient クラス（Section 6.2, 6.5）
// ════════════════════════════════════════════════════════════════
class GameClient {
    constructor() {
        // WebSocket
        this.ws        = null;
        this.connected = false;

        // セッション
        this.language  = 'ja';
        this.sessionId = null;
        this.playerId  = null;
        this.session   = null;

        // 画面モード: 'menu' | 'avatar-select' | 'lobby' | 'game'
        this.mode = 'menu';

        // カードキャッシュ（v1.2: 旧 jobCardsCache → categoryCardsCache）
        this.categoryCardsCache = [];
        this.skillCardsCache    = [];
        this.missionCardsCache  = [];

        // カード選択状態
        this.selectedCard = null;
        this.drawnCards   = [];
        this.usedCardIds  = new Set();
        this.rolling      = false;

        // モーダル・タイマー
        this.modal     = null;
        this._rmTimer  = null;

        // サーバー設定（/api/config から取得）
        this._cardDisplayDuration      = 7000;
        this._cardDisplayDurationShort = 2200;
        this._missionDisplayDuration   = 10000;  // v1.3.1: ミッションカード専用
        this._diceRollDuration         = 2.2;
        this._wsReconnectDelay         = 3000;

        // アバター選択中（v1.3）
        this.pendingAvatarId = null;
        this.pendingColorId  = null;

        // 3D シーン（v1.3）
        this.sceneManager = null;
    }

    // ── 初期化 ────────────────────────────────────────────────
    async init() {
        await i18n.init();
        this.language = i18n.currentLang;
        this.connect();
        await Promise.all([
            this.fetchCategoryCards(),
            this.fetchSkillCards(),
            this.fetchMissionCards(),
            this.fetchConfig(),
        ]);
        this.render();
    }

    async fetchConfig() {
        try {
            const res  = await fetch('/api/config');
            const data = await res.json();
            if (data.ok) {
                this._cardDisplayDuration      = data.cardDisplayDuration;
                this._cardDisplayDurationShort = data.cardDisplayDurationShort;
                this._missionDisplayDuration   = data.missionDisplayDuration ?? 10000;
                this._diceRollDuration         = data.diceRollDuration  ?? 2.2;
                this._wsReconnectDelay         = data.wsReconnectDelay  ?? 3000;
            }
        } catch (e) {
            console.warn('[GameClient] fetchConfig failed, using defaults:', e);
        }
    }

    // ── データ取得 ────────────────────────────────────────────
    async fetchCategoryCards() {
        try {
            const res = await fetch('/api/cards/categories');
            this.categoryCardsCache = await res.json();
        } catch (e) { console.error('[GameClient] fetchCategoryCards:', e); }
    }

    async fetchSkillCards() {
        try {
            const res = await fetch('/api/cards/skills');
            this.skillCardsCache = await res.json();
        } catch (e) { console.error('[GameClient] fetchSkillCards:', e); }
    }

    async fetchMissionCards() {
        try {
            const res = await fetch('/api/cards/missions');
            this.missionCardsCache = await res.json();
        } catch (e) { console.error('[GameClient] fetchMissionCards:', e); }
    }

    // ── ヘルパー ──────────────────────────────────────────────
    /** i18n ショートカット */
    t(key) { return i18n.t(key); }

    /** 順位絵文字 */
    getRankEmoji(rank) {
        return ({ 1: '🥇', 2: '🥈', 3: '🥉' })[rank] ?? `${rank}位`;
    }

    /** WebSocket 送信（OPEN 時のみ）*/
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    // ── SceneManager 連携 ─────────────────────────────────────
    initScene() {
        if (this.sceneManager) {
            this.sceneManager.destroy();
            this.sceneManager = null;
        }
        this.sceneManager = new SceneManager('scene-container');
        this.sceneManager.init(this.session.players);
    }

    // ── WebSocket 接続（Section 6.3）────────────────────────────
    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url      = `${protocol}//${window.location.host}`;
        this.ws        = new WebSocket(url);

        this.ws.onopen = () => {
            this.connected = true;
            this.updateConnectionIndicator();
            this.render();
        };

        this.ws.onclose = () => {
            this.connected = false;
            this.updateConnectionIndicator();
            this.render();
            // 3秒後に自動再接続
            setTimeout(() => this.connect(), this._wsReconnectDelay);
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleServerMessage(data);
            } catch (e) {
                console.error('[GameClient] onmessage parse error:', e);
            }
        };
    }

    // ── 接続インジケーター更新 ────────────────────────────────
    updateConnectionIndicator() {
        const el = document.getElementById('connection-indicator');
        if (!el) return;
        el.innerHTML = this.connected ? '🟢 Connected' : '🔴 Disconnected';
    }

    // ── WebSocket 受信ハンドラ（Section 6.3）─────────────────
    handleServerMessage(data) {
        switch (data.type) {

            // ── セッション作成・参加 ──────────────────────────
            case 'sessionCreated':
            case 'sessionJoined':
                this.sessionId = data.sessionId;
                this.playerId  = data.playerId;
                this.session   = data.session;
                this.mode      = 'avatar-select';
                this.render();
                break;

            case 'playerJoined':
                this.session = data.session;
                this.render();
                break;

            // ── アバター選択（v1.3）──────────────────────────
            case 'avatarSelected':
                this.session = data.session;
                this.render();
                break;

            // ── カテゴリ選択（v1.2）──────────────────────────
            case 'categorySelected':
                this.session = data.session;
                this.render();
                break;

            // ── ゲーム開始 ────────────────────────────────────
            case 'gameStarted':
                this.session = data.session;
                this.mode    = 'game';
                // render() で game モードの #ui-interactive を更新
                // ただし #scene-container は render() 内で保護される
                this.render();
                // SceneManager を再起動（アバターカラー等が確定したため）
                this.initScene();
                this.upScoreboard();
                // カメラをホストのターンプレイヤーへ向ける
                {
                    const cur = this.session.players[this.session.currentPlayerIndex];
                    if (cur && this.sceneManager) this.sceneManager.updateTurn(cur.id);
                }
                break;

            // ── サイコロ結果 ──────────────────────────────────
            case 'diceRolled':
                this.session    = data.session;
                this.rolling    = false;
                this.drawnCards = data.drawnCards;
                // render() は呼ばない（#ca が display:none にリセットされるため）
                // ターン表示・ボタン状態だけ更新
                this.setBtnState({ dice: 'disabled', next: 'disabled' });
                this.showCardArea(data.drawnCards);
                break;

            // ── カード選択（自分）────────────────────────────
            case 'cardSelected':
                this.session = data.session;
                // カード種別に応じて結果を表示
                if (data.card) {
                    this._showCardResult(data.card, data.matched, data.alreadySelected, false);
                }
                if (data.playerFinished) {
                    setTimeout(() => this.showGoalModal(data), 2400);
                }
                if (data.allFinished) {
                    setTimeout(() => this.showFinalRankingsModal(data.finalRankings), 3500);
                }
                this.upScoreboard();
                break;

            // ── カード選択（他プレイヤー）────────────────────
            case 'cardSelectedByOther': {
                this.session = data.session;
                if (this.sceneManager) {
                    const p = this.session.players.find(pl => pl.id === data.playerId);
                    if (p) this.sceneManager.showCardOnTable(p.id, data.cardType);
                }
                // 他プレイヤーが選んだカードの内容を表示
                if (data.card) {
                    const playerName = data.playerName ?? '';
                    this._showCardResult(data.card, data.matched, false, true, playerName);
                }
                this.upScoreboard();
                break;
            }

            // ── 次のターン ────────────────────────────────────
            case 'nextTurn': {
                this.session = data.session;
                const cur = this.session.players[this.session.currentPlayerIndex];
                if (this.sceneManager && cur) {
                    this.sceneManager.updateTurn(cur.id);
                }
                this.upScoreboard();
                this.hideCardArea();
                const isMyTurn = cur?.id === this.playerId;
                this.setBtnState({
                    dice: isMyTurn ? 'active' : 'disabled',
                    next: 'disabled',
                });
                this.render();
                break;
            }

            // ── 退職 ─────────────────────────────────────────
            case 'playerRetired':
                this.session = data.session;
                this.render();
                break;

            // ── ゲームリセット ────────────────────────────────
            case 'gameReset':
                this.session = data.session;
                this.mode    = 'lobby';
                this.render();        // 先に DOM を生成（#scene-container を確保）
                this.initScene();     // その後 SceneManager 起動
                this.upScoreboard();
                break;

            // ── ゲーム完了 ────────────────────────────────────
            case 'gameCompleted':
                this.session = data.session;
                setTimeout(() => this.showFinalRankingsModal(data.finalRankings), 1500);
                this.render();
                break;

            // ── エラー ────────────────────────────────────────
            case 'error':
                console.error('[GameClient] Server error:', data.error);
                break;

            default:
                console.warn('[GameClient] Unknown message type:', data.type);
        }
    }

    // ════════════════════════════════════════════════════════════
    // render() — コンテナ分離パターン（Section 6.4）
    // ════════════════════════════════════════════════════════════
    render() {
        const app = document.getElementById('app');
        if (!app) return;

        // menu / avatar-select は Three.js 未起動 → app 全体を置き換え
        if (this.mode === 'menu') {
            app.innerHTML = this.renderMenu();
            this.attachEventListeners();
            return;
        }
        if (this.mode === 'avatar-select') {
            app.innerHTML = this.renderAvatarSelect();
            this.attachEventListeners();
            return;
        }

        // lobby / game: #scene-container が存在しなければ3層構造を再構築
        if (!document.getElementById('scene-container')) {
            app.innerHTML = `
<div id="scene-container" style="position:absolute;inset:0;z-index:1;"></div>
<div id="ui-overlay"      style="position:absolute;inset:0;z-index:2;pointer-events:none;"></div>
<div id="ui-interactive"  style="position:absolute;inset:0;z-index:3;"></div>
<div id="sb" style="position:absolute;top:10px;left:10px;right:10px;z-index:4;
  display:flex;background:rgba(6,6,18,.93);border:0.5px solid rgba(255,255,255,.1);
  border-radius:8px;overflow:hidden;pointer-events:none;min-height:48px;"></div>`;
        }

        // lobby / game → #ui-interactive のみ更新（#scene-container を保護）
        const ui = document.getElementById('ui-interactive');
        if (!ui) return;
        let html = this.mode === 'lobby' ? this.renderLobby() : this.renderGame();
        if (this.modal) html += this.renderModal();
        ui.innerHTML = html;
        this.attachEventListeners();

        // スコアバーを常時更新（#sb は #ui-interactive の外にあるため render() で消えない）
        if (this.mode === 'game' || this.mode === 'lobby') {
            this.upScoreboard();
        }
    }

    // ════════════════════════════════════════════════════════════
    // renderMenu() — メニュー画面
    // ════════════════════════════════════════════════════════════
    renderMenu() {
        const connected = this.connected;
        const lang      = i18n.currentLang;

        return `
<div style="width:100%;height:100vh;background:var(--bg);display:flex;flex-direction:column;
            align-items:center;justify-content:center;padding:20px;position:relative;">

  <!-- 言語切り替え -->
  <div class="lang-toggle" style="position:fixed;top:12px;right:16px;">
    <button data-lang="en"  class="${lang === 'en' ? 'active' : ''}">EN</button>
    <button data-lang="ja"  class="${lang === 'ja' ? 'active' : ''}">日本語</button>
  </div>

  <!-- タイトル -->
  <div style="text-align:center;margin-bottom:40px;animation:su .5s ease both;">
    <div style="font-size:13px;font-weight:600;letter-spacing:.18em;
                color:var(--primary);text-transform:uppercase;margin-bottom:10px;">
      Career Education Card Game
    </div>
    <h1 style="font-size:clamp(28px,5vw,48px);font-weight:800;
               background:linear-gradient(135deg,#fff 30%,var(--primary));
               -webkit-background-clip:text;-webkit-text-fill-color:transparent;
               line-height:1.1;margin-bottom:12px;">
      ${this.t('game.title')}
    </h1>
    <p style="color:var(--text-secondary);font-size:15px;">
      ${this.t('game.subtitle')}
    </p>
    ${!connected ? `
    <div style="margin-top:12px;font-size:12px;color:#f59e0b;font-weight:600;">
      🔴 サーバーに接続中...
    </div>` : ''}
  </div>

  <!-- カード群 -->
  <div style="display:flex;gap:20px;flex-wrap:wrap;justify-content:center;
              width:100%;max-width:640px;">

    <!-- 新規作成 -->
    <div class="simple-card" style="flex:1;min-width:240px;max-width:300px;animation:su .5s ease .1s both;">
      <div style="font-size:18px;margin-bottom:6px;">🎮</div>
      <h3 style="font-size:16px;font-weight:700;margin-bottom:8px;">
        ${this.t('game.createGame')}
      </h3>
      <p style="font-size:12px;color:var(--text-secondary);margin-bottom:16px;line-height:1.5;">
        新しいセッションを作成してホストになります。
      </p>
      <button class="btn-primary" style="width:100%;"
              onclick="game.createGame()" ${!connected ? 'disabled' : ''}>
        ${this.t('game.createGame')}
      </button>
    </div>

    <!-- ゲームに参加 -->
    <div class="simple-card" style="flex:1;min-width:240px;max-width:300px;animation:su .5s ease .2s both;">
      <div style="font-size:18px;margin-bottom:6px;">🚪</div>
      <h3 style="font-size:16px;font-weight:700;margin-bottom:12px;">
        ${this.t('game.joinGame')}
      </h3>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <input type="text" id="join-session-id"
               placeholder="${this.t('game.sessionId')}"
               style="text-transform:uppercase;"
               ${!connected ? 'disabled' : ''}>
        <input type="text" id="join-player-name"
               placeholder="${this.t('game.playerName')}"
               ${!connected ? 'disabled' : ''}>
        <button class="btn-secondary" style="width:100%;margin-top:4px;"
                onclick="game.joinGame()" ${!connected ? 'disabled' : ''}>
          ${this.t('game.join')}
        </button>
      </div>
    </div>

  </div>
</div>`;
    }

    // ════════════════════════════════════════════════════════════
    // createGame() / joinGame()
    // ════════════════════════════════════════════════════════════
    createGame() {
        const name = prompt(this.t('game.playerName'));
        if (!name || !name.trim()) return;
        this.send({ type: 'createSession', playerName: name.trim(), maxPlayers: 4 });
    }

    joinGame() {
        const sessionId  = (document.getElementById('join-session-id')?.value  ?? '').trim().toUpperCase();
        const playerName = (document.getElementById('join-player-name')?.value ?? '').trim();
        if (!sessionId || !playerName) {
            return alert('セッションIDとプレイヤー名を入力してください');
        }
        this.send({ type: 'joinSession', sessionId, playerName });
    }

    // ════════════════════════════════════════════════════════════
    // renderAvatarSelect()（Section 16.4）
    // ════════════════════════════════════════════════════════════
    renderAvatarSelect() {
        const lang       = i18n.currentLang;
        const selType    = this.pendingAvatarId;
        const selColor   = this.pendingColorId;
        const canConfirm = selType && selColor;

        const typeCards = AVATAR_TYPES.map(type => {
            const isSelected = selType === type.id;
            const name       = lang === 'ja' ? type.name_ja : type.name_en;
            const emoji      = { cap:'🎓', beret:'🪖', bun:'🧏', glasses:'🤓' }[type.accessory] ?? '👤';
            return `
<div onclick="game.selectAvatarType(${type.id})"
     style="cursor:pointer;padding:16px 12px;border-radius:14px;text-align:center;
            border:${isSelected ? '2px solid var(--primary)' : '1px solid var(--border)'};
            background:${isSelected ? 'rgba(99,102,241,.18)' : 'rgba(255,255,255,.04)'};
            box-shadow:${isSelected ? '0 0 16px rgba(99,102,241,.45)' : 'none'};
            transition:all .18s;">
  <div style="font-size:28px;margin-bottom:6px;">${emoji}</div>
  <div style="font-size:12px;font-weight:${isSelected ? 700 : 500};
              color:${isSelected ? 'var(--primary)' : 'var(--text-secondary)'};">
    ${name}
  </div>
</div>`;
        }).join('');

        const colorSwatches = AVATAR_COLORS.map(col => {
            const isSelected = selColor === col.id;
            return `
<div onclick="game.selectAvatarColor(${col.id})"
     title="${col.name_ja}"
     style="width:44px;height:44px;border-radius:50%;background:${col.hex};cursor:pointer;
            box-shadow:${isSelected
                ? `0 0 0 3px #fff, 0 0 0 5px ${col.hex}`
                : '0 2px 8px rgba(0,0,0,.4)'};
            transition:box-shadow .18s,transform .18s;
            transform:${isSelected ? 'scale(1.15)' : 'scale(1)'};">
</div>`;
        }).join('');

        return `
<div style="width:100%;height:100vh;background:var(--bg);display:flex;flex-direction:column;
            align-items:center;justify-content:center;padding:20px;overflow-y:auto;">

  <!-- タイトル -->
  <div style="text-align:center;margin-bottom:28px;animation:su .4s ease both;">
    <h2 style="font-size:24px;font-weight:800;color:var(--text);margin-bottom:6px;">
      ${this.t('avatar.title')}
    </h2>
    <p style="font-size:13px;color:var(--text-secondary);">
      ${this.t('avatar.subtitle')}
    </p>
  </div>

  <div style="width:100%;max-width:520px;display:flex;flex-direction:column;gap:24px;">

    <!-- アバター種別グリッド（2×2）-->
    <div>
      <div style="font-size:12px;font-weight:600;color:var(--text-secondary);
                  letter-spacing:.1em;text-transform:uppercase;margin-bottom:10px;">
        ${this.t('avatar.chooseType')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
        ${typeCards}
      </div>
    </div>

    <!-- カラーグリッド（3×2）-->
    <div>
      <div style="font-size:12px;font-weight:600;color:var(--text-secondary);
                  letter-spacing:.1em;text-transform:uppercase;margin-bottom:12px;">
        ${this.t('avatar.chooseColor')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(6,44px);gap:12px;">
        ${colorSwatches}
      </div>
    </div>

    <!-- 決定ボタン -->
    <button class="btn-primary"
            onclick="game.confirmAvatar()"
            style="width:100%;padding:14px;font-size:15px;
                   opacity:${canConfirm ? '1' : '.4'};
                   pointer-events:${canConfirm ? 'auto' : 'none'};">
      ${this.t('avatar.confirm')}
    </button>

  </div>
</div>`;
    }

    // ── アバター選択操作 ──────────────────────────────────────
    selectAvatarType(avatarId) {
        this.pendingAvatarId = avatarId;
        this.render();
    }

    selectAvatarColor(colorId) {
        this.pendingColorId = colorId;
        this.render();
    }

    confirmAvatar() {
        if (!this.pendingAvatarId || !this.pendingColorId) {
            return alert(this.t('avatar.pleaseSelect'));
        }
        this.send({
            type:        'selectAvatar',
            sessionId:   this.sessionId,
            playerId:    this.playerId,
            avatarId:    this.pendingAvatarId,
            avatarColorId: this.pendingColorId,
        });
        this.mode = 'lobby';
        this.render();        // ← 先に render() で #scene-container を DOM に生成
        this.initScene();     // ← その後 SceneManager を起動
    }

    // ════════════════════════════════════════════════════════════
    // renderLobby()（Section 8.4）
    // ════════════════════════════════════════════════════════════
    renderLobby() {
        if (!this.session) return '';
        const session   = this.session;
        const isHost    = session.hostPlayerId === this.playerId;
        const canStart  = session.players.length >= 2
                       && session.players.every(p => p.categorySelected);
        const needed    = 2 - session.players.length;
        const inviteUrl = `${window.location.origin}?session=${this.sessionId}`;
        const myPlayer  = session.players.find(p => p.id === this.playerId);

        // ── プレイヤー一覧 ────────────────────────────────────
        const playerCards = session.players.map(p => {
            const isMe  = p.id === this.playerId;
            const color = AVATAR_COLORS.find(c => c.id === p.avatarColorId)?.hex ?? '#6366f1';
            return `
<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
            border-radius:12px;background:rgba(255,255,255,.04);
            border:1px solid ${isMe ? color + '55' : 'var(--border)'};
            transition:border-color .2s;">
  <div style="width:36px;height:36px;border-radius:50%;background:${color};
              display:flex;align-items:center;justify-content:center;
              font-size:15px;font-weight:700;color:#fff;flex-shrink:0;">
    ${p.name[0].toUpperCase()}
  </div>
  <span style="font-size:14px;font-weight:600;flex:1;">${p.name}</span>
  ${isMe ? `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;
              background:var(--primary);color:#fff;">あなた</span>` : ''}
  ${p.categorySelected ? `<span style="font-size:10px;font-weight:600;padding:2px 8px;
              border-radius:20px;background:rgba(16,185,129,.2);color:#10b981;">
              職種選択済み ✓</span>` : ''}
</div>`;
        }).join('');

        // ── カテゴリ選択グリッド ──────────────────────────────
        const myCategories = myPlayer?.categories ?? [];
        const categoryGrid = this.categoryCardsCache.map(cat => {
            const takenBy  = session.players.find(
                p => p.id !== this.playerId && p.categories.includes(cat.id)
            );
            const isMine   = myCategories.includes(cat.id);
            const disabled = !!takenBy;
            return `
<div onclick="${disabled ? '' : `game.selectCategory(${cat.id})`}"
     style="padding:14px;border-radius:14px;cursor:${disabled ? 'not-allowed' : 'pointer'};
            border:${isMine ? '2px solid var(--primary)' : '1px solid var(--border)'};
            background:${isMine ? 'rgba(99,102,241,.18)' : disabled ? 'rgba(255,255,255,.02)' : 'rgba(255,255,255,.05)'};
            opacity:${disabled ? '.45' : '1'};
            box-shadow:${isMine ? '0 0 16px rgba(99,102,241,.3)' : 'none'};
            transition:all .18s;text-align:center;">
  <div style="font-size:14px;font-weight:700;color:${isMine ? 'var(--primary)' : disabled ? 'var(--text-secondary)' : 'var(--text)'};
              margin-bottom:4px;">
    ${cat.name_ja}
  </div>
  <div style="font-size:11px;color:var(--text-secondary);">${cat.name_en}</div>
  <div style="font-size:11px;font-weight:600;color:var(--secondary);margin-top:4px;">
    目標: ${cat.targetPoints}pt
  </div>
  ${takenBy ? `<div style="font-size:10px;color:var(--text-secondary);margin-top:4px;">
    ${takenBy.name} が選択中</div>` : ''}
  ${isMine ? `<div style="font-size:10px;color:var(--primary);margin-top:4px;font-weight:700;">
    ✓ 選択中</div>` : ''}
</div>`;
        }).join('');

        // ── ゲーム開始エリア ──────────────────────────────────
        const startArea = isHost
            ? `<button class="btn-primary" onclick="game.startGame()"
                 style="width:100%;padding:14px;font-size:15px;
                        opacity:${canStart ? '1' : '.4'};
                        pointer-events:${canStart ? 'auto' : 'none'};">
                 🎮 ${this.t('game.startGame')}
               </button>
               ${!canStart ? `<p style="text-align:center;font-size:12px;
                  color:var(--text-secondary);margin-top:8px;">
                  ${this.t('game.waitingForStart')}</p>` : ''}`
            : `<div style="text-align:center;padding:14px;border-radius:12px;
                  background:rgba(255,255,255,.04);border:1px solid var(--border);
                  font-size:13px;color:var(--text-secondary);">
                 ⏳ ホストがゲームを開始するまでお待ちください...
               </div>`;

        return `
<div style="position:absolute;inset:0;overflow-y:auto;padding:16px;
            display:flex;flex-direction:column;gap:14px;pointer-events:auto;">

  <!-- スコアバー占有用スペーサー -->
  <div style="height:52px;flex-shrink:0;"></div>

  <!-- 招待 URL エリア -->
  <div style="background:rgba(255,255,255,.04);border:1px solid var(--border);
              border-radius:14px;padding:14px;flex-shrink:0;">
    <div style="font-size:11px;font-weight:600;color:var(--text-secondary);
                letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">
      招待URL
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <input type="text" value="${inviteUrl}" readonly
             style="flex:1;font-size:11px;background:rgba(0,0,0,.3);
                    border-color:var(--border);color:var(--text-secondary);cursor:text;">
      <button class="btn-secondary" onclick="game.copySessionId()"
              style="flex-shrink:0;padding:8px 14px;font-size:12px;">
        📋 コピー
      </button>
    </div>
    <div style="font-size:11px;color:var(--text-secondary);margin-top:6px;">
      セッションID: <strong style="color:var(--primary);letter-spacing:.1em;">
        ${this.sessionId}
      </strong>
    </div>
  </div>

  <!-- プレイヤー一覧 -->
  <div style="flex-shrink:0;">
    <div style="font-size:11px;font-weight:600;color:var(--text-secondary);
                letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">
      プレイヤー (${session.players.length} / ${session.maxPlayers})
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;">
      ${playerCards}
    </div>
    ${needed > 0 ? `
    <p style="font-size:12px;color:var(--text-secondary);text-align:center;
              margin-top:10px;">
      あと ${needed} 人の参加を待っています...
    </p>` : ''}
  </div>

  <!-- 職種（カテゴリ）選択 -->
  <div style="flex-shrink:0;">
    <div style="font-size:11px;font-weight:600;color:var(--text-secondary);
                letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">
      ${this.t('game.selectCategory')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;">
      ${categoryGrid}
    </div>
  </div>

  <!-- ゲーム開始 -->
  <div style="flex-shrink:0;padding-bottom:16px;">
    ${startArea}
  </div>

</div>`;
    }

    // ── ロビー操作メソッド ────────────────────────────────────
    selectCategory(categoryId) {
        this.send({
            type:       'selectCategory',
            sessionId:  this.sessionId,
            playerId:   this.playerId,
            categoryId,
        });
    }

    startGame() {
        this.send({
            type:      'startGame',
            sessionId: this.sessionId,
            playerId:  this.playerId,
        });
    }

    copySessionId() {
        if (!this.sessionId) return;
        navigator.clipboard.writeText(this.sessionId)
            .then(() => {
                // コピー完了トースト
                this.showResult('📋 コピーしました！', null, 'rgba(16,185,129,.8)');
            })
            .catch(() => alert(this.sessionId)); // HTTPS 非対応環境フォールバック
    }

    // ════════════════════════════════════════════════════════════
    // upScoreboard()（Section 17.2）
    // ════════════════════════════════════════════════════════════
    upScoreboard(flashIdx = -1) {
        const sb = document.getElementById('sb');
        if (!sb || !this.session) return;

        const curIdx = this.session.currentPlayerIndex;

        sb.innerHTML = this.session.players.map((p, i) => {
            const isCur = i === curIdx;
            const hex   = AVATAR_COLORS.find(c => c.id === p.avatarColorId)?.hex ?? '#6366f1';

            // ポイント・最大値（兼任は全職種の最小進捗）
            let pts = 0, max = 0;
            if (p.categories.length > 0) {
                const progresses = p.categories.map(cid => {
                    const cat = this.categoryCardsCache.find(c => c.id === cid);
                    return {
                        pts: p.points[cid] ?? 0,
                        max: cat?.targetPoints ?? 1,
                    };
                });
                // 兼任の場合は最小進捗で表示
                const minProg = progresses.reduce((a, b) => (a.pts / a.max <= b.pts / b.max ? a : b));
                pts = minProg.pts;
                max = minProg.max;
            }

            const isGoal  = p.finished;
            const catName = p.categories.map(cid => {
                const cat = this.categoryCardsCache.find(c => c.id === cid);
                return cat?.name_ja ?? '';
            }).filter(Boolean).join('+');

            // ピップ列
            const pips = max > 0 ? Array.from({ length: max }, (_, j) => {
                const filled = j < pts;
                const isNew  = flashIdx === i && j === pts - 1;
                return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;
                    margin:1px;flex-shrink:0;
                    background:${filled ? hex : 'rgba(255,255,255,.12)'};
                    ${filled ? `box-shadow:0 0 5px ${hex}99;` : ''}
                    ${isNew  ? 'animation:pip .4s ease;' : ''}"></span>`;
            }).join('') : '';

            // 背景色
            const bg = isCur        ? hex + '14'
                     : flashIdx === i ? hex + '20'
                     : 'transparent';

            return `
<div style="flex:1;min-width:0;padding:6px 8px;
            border-top:2.5px solid ${isCur ? hex : 'transparent'};
            background:${bg};transition:background .35s;overflow:hidden;">
  <!-- 上段 -->
  <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px;min-width:0;">
    <span style="width:8px;height:8px;border-radius:50%;background:${hex};flex-shrink:0;"></span>
    <span style="font-size:11px;font-weight:700;color:#e2e8f0;
                 overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">
      ${p.name}
    </span>
    ${catName ? `<span style="font-size:9px;padding:1px 5px;border-radius:10px;
        background:${hex}28;color:${hex};font-weight:600;flex-shrink:0;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60px;">
        ${catName}</span>` : ''}
    ${isGoal
        ? `<span style="font-size:11px;flex-shrink:0;">🏆</span>`
        : max > 0
            ? `<span style="font-size:10px;color:rgba(255,255,255,.5);flex-shrink:0;">
               ${pts}/${max}</span>`
            : ''}
  </div>
  <!-- 下段: ピップ列 -->
  <div style="display:flex;flex-wrap:wrap;">${pips}</div>
</div>`;
        }).join('');
    }

    // ════════════════════════════════════════════════════════════
    // renderGame()（Section 17.3）
    // ════════════════════════════════════════════════════════════
    renderGame() {
        if (!this.session) return '';

        const curPlayer = this.session.players[this.session.currentPlayerIndex];
        const isMyTurn  = curPlayer?.id === this.playerId;
        const myPlayer  = this.session.players.find(p => p.id === this.playerId);

        const turnMsg = isMyTurn
            ? `<span style="color:var(--secondary);font-weight:800;">🎲 あなたのターン</span>`
            : `<span style="color:var(--text-secondary);">${curPlayer?.name ?? ''} のターンです</span>`;

        return `
<!-- 結果モーダル -->
<div id="rm" style="display:none;"></div>

<!-- カードエリア -->
<div id="ca" style="display:none;position:absolute;bottom:72px;left:0;right:0;z-index:10;
  padding:0 12px;flex-direction:row;gap:8px;
  overflow-x:auto;justify-content:center;align-items:flex-end;pointer-events:auto;">
  <div style="font-size:11px;color:rgba(255,255,255,.5);
              white-space:nowrap;align-self:flex-end;padding-bottom:4px;">
    <span id="ch">${this.t('game.cardSelectHint')}</span>
  </div>
  <div id="cr" style="display:flex;gap:8px;flex-wrap:nowrap;"></div>
</div>

<!-- ターン表示 + ボタンエリア -->
<div style="position:absolute;bottom:13px;right:12px;z-index:4;
  display:flex;align-items:center;gap:10px;pointer-events:auto;">
  <div style="font-size:13px;">${turnMsg}</div>
  ${isMyTurn ? `
  <button id="btn-dice" class="btn-primary"
          onclick="game.rollDice()"
          style="padding:10px 18px;font-size:13px;">
    🎲 ${this.t('game.rollDice')}
  </button>
  <button id="btn-next" class="btn-secondary"
          onclick="game.nextTurn()"
          style="padding:10px 18px;font-size:13px;opacity:.38;pointer-events:none;"
          disabled>
    ➡️ 次のターン
  </button>` : `
  <button id="btn-dice" class="btn-secondary"
          style="padding:10px 18px;font-size:13px;opacity:.38;pointer-events:none;"
          disabled>
    🎲 ${this.t('game.rollDice')}
  </button>
  <button id="btn-next" class="btn-secondary"
          style="padding:10px 18px;font-size:13px;opacity:.38;pointer-events:none;"
          disabled>
    ➡️ 次のターン
  </button>`}
</div>`;
    }

    // ════════════════════════════════════════════════════════════
    // setBtnState()（Section 18.6）
    // ════════════════════════════════════════════════════════════
    setBtnState({ dice, next } = {}) {
        const states = {
            active:   { disabled: false, opacity: '1',   pointerEvents: 'auto' },
            disabled: { disabled: true,  opacity: '.38', pointerEvents: 'none' },
            rolling:  { disabled: true,  opacity: '1',   pointerEvents: 'none' },
        };

        const applyState = (id, stateKey) => {
            const el = document.getElementById(id);
            if (!el) return;
            const s = states[stateKey] ?? states.disabled;
            el.disabled             = s.disabled;
            el.style.opacity        = s.opacity;
            el.style.pointerEvents  = s.pointerEvents;
            if (id === 'btn-dice' && stateKey === 'rolling') {
                el.textContent = `⏳ ${this.t('game.rolling')}`;
            }
        };

        if (dice) applyState('btn-dice', dice);
        if (next) applyState('btn-next', next);
    }

    // ════════════════════════════════════════════════════════════
    // showCardArea()（Section 18.1）
    // ════════════════════════════════════════════════════════════
    showCardArea(cards) {
        const cr = document.getElementById('cr');
        if (!cr) return;
        cr.innerHTML     = '';
        this.selectedCard = null;

        const lang = i18n.currentLang;
        const TYPE_LABELS_EN = { skill: 'Skill', mission: 'Mission', special: 'Special' };

        cards.forEach((card, i) => {
            const div       = document.createElement('div');
            div.className   = 'drawn-card';
            div.style.cssText = `
                width:108px;min-height:128px;
                background:rgba(10,10,26,.95);
                border:0.5px solid rgba(255,255,255,.12);
                border-radius:10px;cursor:pointer;overflow:hidden;
                animation:su .32s ease ${i * 0.07}s both;
                transition:transform .18s,box-shadow .18s;flex-shrink:0;
            `;

            const typeLabel = lang === 'ja'
                ? (CARD_TYPE_LABELS_JA[card.type] ?? card.type)
                : (TYPE_LABELS_EN[card.type] ?? card.type);
            const target = card['target_' + lang] ?? card.target_ja ?? '';

            div.innerHTML = `
<div style="background:${CARD_GRADIENTS[card.type] ?? 'rgba(99,102,241,.5)'};
            padding:5px 9px;font-size:10px;font-weight:600;color:#fff;">
  ${typeLabel}${target ? ' · ' + target : ''}
</div>
<div style="padding:9px;">
  <div style="font-size:12px;font-weight:600;color:#fff;margin-bottom:5px;line-height:1.3;">
    ${card['name_' + lang] ?? card.name_ja ?? 'カード'}
  </div>
  <div style="font-size:10px;color:rgba(255,255,255,.46);line-height:1.4;">
    ${card['descriptionHtml_' + lang] ?? card.descriptionHtml_ja ?? ''}
  </div>
</div>`;

            div.addEventListener('click', () => this.onCardClick(card, div));
            cr.appendChild(div);
        });

        const ca = document.getElementById('ca');
        if (ca) ca.style.display = 'flex';
        const ch = document.getElementById('ch');
        if (ch) ch.textContent = this.t('game.cardSelectHint');
    }

    // ════════════════════════════════════════════════════════════
    // hideCardArea()（Section 18.1）
    // ════════════════════════════════════════════════════════════
    hideCardArea() {
        const ca = document.getElementById('ca');
        if (ca) ca.style.display = 'none';
        this.selectedCard = null;
    }

    // ════════════════════════════════════════════════════════════
    // rollDice()（Section 18.3）
    // ════════════════════════════════════════════════════════════
    rollDice() {
        if (this.rolling) return;

        // カード表示中は振り直し防止
        const ca = document.getElementById('ca');
        if (ca && ca.style.display === 'flex') return;

        this.rolling = true;
        // render() は呼ばない（ボタンが再生成されて setBtnState が効かなくなるため）
        // ボタン状態だけ直接更新
        this.setBtnState({ dice: 'rolling', next: 'disabled' });

        if (this.sceneManager) this.sceneManager.triggerDiceRoll();

        this.send({
            type:      'rollDice',
            sessionId: this.sessionId,
            playerId:  this.playerId,
        });
    }

    // ════════════════════════════════════════════════════════════
    // nextTurn()
    // ════════════════════════════════════════════════════════════
    nextTurn() {
        this.send({
            type:      'nextTurn',
            sessionId: this.sessionId,
            playerId:  this.playerId,
        });
    }

    // ════════════════════════════════════════════════════════════
    // onCardClick()（Section 18.3）
    // ════════════════════════════════════════════════════════════
    onCardClick(card, div) {
        // 2nd tap → 確定
        if (this.selectedCard?.id === card.id) {
            this.confirmCard(card);
            return;
        }
        // 1st tap → 選択（他のカードをデセレクト）
        document.querySelectorAll('.drawn-card').forEach(c => {
            c.style.transform  = '';
            c.style.boxShadow  = '';
            c.style.border     = '0.5px solid rgba(255,255,255,.12)';
        });
        this.selectedCard      = card;
        div.style.transform    = 'translateY(-10px) scale(1.06)';
        div.style.boxShadow    = `0 8px 28px ${CARD_GLOW[card.type]}`;
        div.style.border       = `1px solid ${CARD_GLOW[card.type]}`;
        const ch = document.getElementById('ch');
        if (ch) ch.textContent = 'もう一度タップで確定';
        // ボタンは無効化したまま維持（カード確定まで次のターンは押せない）
        this.setBtnState({ dice: 'disabled', next: 'disabled' });
    }

    // ════════════════════════════════════════════════════════════
    // confirmCard()（Section 18.4）
    // ════════════════════════════════════════════════════════════
    confirmCard(card) {
        this.usedCardIds.add(card.id);

        if (card.type === 'skill') {
            // 結果表示はサーバーの cardSelected 受信時に行う（マッチング判定はサーバー側）
            // ここでは送信のみ（showResult は cardSelected で呼ぶ）
        } else {
            // ミッション/特殊カードはサーバーから cardSelected で全員に届く
            // confirmCard 側では表示しない（_showCardResult は cardSelected 受信時に呼ばれる）
        }

        // 3D テーブルにカードメッシュを配置
        if (this.sceneManager && this.session) {
            const cur = this.session.players[this.session.currentPlayerIndex];
            if (cur) this.sceneManager.showCardOnTable(cur.id, card.type);
        }

        // サーバーへ送信（正式なポイント処理はサーバー側）
        this.send({
            type:      'selectCard',
            sessionId: this.sessionId,
            playerId:  this.playerId,
            cardId:    card.id,
        });

        this.hideCardArea();
        // hideCardArea後に確実にボタン状態を更新
        setTimeout(() => {
            this.setBtnState({ dice: 'disabled', next: 'active' });
        }, 0);
    }

    // ════════════════════════════════════════════════════════════
    // showResult()（Section 18.5 / imageUrl 対応）
    // ════════════════════════════════════════════════════════════
    /** カード選択結果を表示する共通メソッド
     * @param {object}  card         - カードオブジェクト
     * @param {boolean} matched      - スキルカードのマッチ結果
     * @param {boolean} alreadySelected - 選択済みフラグ
     * @param {boolean} isOther      - 他プレイヤーが選んだカードか
     * @param {string}  playerName   - 他プレイヤー名（isOther=true 時）
     */
    _showCardResult(card, matched, alreadySelected, isOther = false, playerName = '') {
        const lang    = i18n.currentLang;
        const name    = card['name_' + lang] ?? card.name_ja ?? '';
        const descRaw = card['descriptionHtml_' + lang] ?? card.descriptionHtml_ja ?? '';
        const desc    = descRaw.replace(/<[^>]+>/g, '').trim();
        const prefix  = isOther && playerName ? `${playerName} が選択：\n` : '';

        if (card.type === 'skill') {
            if (alreadySelected) {
                this.showResult(
                    `${prefix}「${name}」\nすでに選択済みです`,
                    null, 'rgba(148,163,184,.8)', card.imageUrl, desc
                );
            } else if (matched) {
                this.showResult(
                    `${prefix}✅ マッチ！\n「${name}」`,
                    'skill', null, card.imageUrl, desc
                );
            } else {
                this.showResult(
                    `${prefix}「${name}」\n${isOther ? '（スキルカード）' : 'あなたの職種には対応していません'}`,
                    null, 'rgba(148,163,184,.8)', card.imageUrl, desc
                );
            }
        } else if (card.type === 'mission') {
            const target = card['target_' + lang] ?? card.target_ja ?? '';
            this.showResult(
                `${prefix}ミッション発動！\n「${name}」\n${target}で議論してください`,
                'mission', null, card.imageUrl, desc,
                true  // isMission フラグ
            );
        } else if (card.type === 'special') {
            this.showResult(
                `${prefix}特殊ミッション！\n「${name}」\nプレイヤーを選択してください`,
                'special', null, card.imageUrl, desc,
                true  // isMission フラグ
            );
        }
    }

    showResult(msg, type = null, col = null, imageUrl = null, description = '', isMission = false) {
        const rm = document.getElementById('rm');
        if (!rm) return;

        const borderColor = col ?? (type ? CARD_GLOW[type] : 'rgba(99,102,241,.8)');

        // 画像（登録済みの場合のみ）
        const imgHtml = imageUrl
            ? `<img src="${imageUrl}" style="width:100%;max-height:110px;border-radius:6px;
                    margin-bottom:8px;object-fit:cover;">`
            : '';

        // 説明文（あれば）
        const descHtml = description
            ? `<div style="margin-top:8px;padding-top:8px;
                border-top:0.5px solid rgba(255,255,255,.15);
                font-size:11px;color:rgba(255,255,255,.6);
                line-height:1.6;text-align:left;">${description}</div>`
            : '';

        rm.innerHTML = imgHtml
            + `<div style="text-align:center;">${msg.replace(/\n/g, '<br>')}</div>`
            + descHtml;

        rm.style.cssText = `
            display:block;position:absolute;top:46%;left:50%;
            transform:translate(-50%,-50%);z-index:20;
            background:rgba(6,6,18,.95);border-radius:12px;
            padding:16px 20px;color:#fff;font-size:13px;font-weight:500;
            border:0.5px solid ${borderColor};
            max-width:280px;line-height:1.7;pointer-events:none;
        `;

        // 説明文がある場合は表示時間を長くする
        // ミッションカードは専用の表示時間を使用
        const duration = isMission
            ? this._missionDisplayDuration
            : description
                ? this._cardDisplayDuration
                : this._cardDisplayDurationShort;
        clearTimeout(this._rmTimer);
        this._rmTimer = setTimeout(() => {
            rm.style.animation = 'fo .4s ease forwards';
            setTimeout(() => {
                rm.style.display   = 'none';
                rm.style.animation = '';
            }, 400);
        }, duration);
    }

    // ════════════════════════════════════════════════════════════
    // showGoalModal()
    // ════════════════════════════════════════════════════════════
    showGoalModal(data) {
        const rankEmoji = this.getRankEmoji(data.finishRank);
        const col       = data.playerId ? this._getPlayerHex(data.playerId) : null;
        this.showResult(
            `${rankEmoji} ${data.playerName ?? ''}
${data.finishRank}位でゴール！`,
            null,
            col
        );
    }

    /** playerId から avatar hex カラーを返すヘルパー */
    _getPlayerHex(playerId) {
        const p = this.session?.players.find(pl => pl.id === playerId);
        return AVATAR_COLORS.find(c => c.id === p?.avatarColorId)?.hex ?? '#6366f1';
    }

    // ════════════════════════════════════════════════════════════
    // showFinalRankingsModal()
    // ════════════════════════════════════════════════════════════
    showFinalRankingsModal(rankings) {
        if (!rankings) return;
        const content = rankings.map(r =>
            `<div style="padding:6px 0;font-size:16px;">${this.getRankEmoji(r.rank)} ${r.name}</div>`
        ).join('');
        this.showModal({
            title: '🎉 ' + this.t('game.allFinished'),
            content,
            buttons: [
                { label: this.t('game.playAgain'),  action: 'resetGame',  style: 'primary'   },
                { label: this.t('game.backToMenu'), action: 'backToMenu', style: 'secondary' },
            ],
        });
    }

    // ════════════════════════════════════════════════════════════
    // showModal() / renderModal()
    // ════════════════════════════════════════════════════════════
    showModal(opts) {
        this.modal = opts;
        this.render();
    }

    renderModal() {
        if (!this.modal) return '';
        const { title, content, buttons } = this.modal;
        const btns = (buttons ?? []).map(b => `
<button class="btn-${b.style ?? 'secondary'}"
        onclick="game.handleModalAction('${b.action}')"
        style="flex:1;padding:10px;">
  ${b.label}
</button>`).join('');

        return `
<div class="modal-overlay" onclick="if(event.target===this)game.closeModal()">
  <div class="modal">
    <h2>${title ?? ''}</h2>
    <div style="color:var(--text-secondary);font-size:15px;line-height:1.7;">
      ${content ?? ''}
    </div>
    <div class="modal-buttons">${btns}</div>
  </div>
</div>`;
    }

    closeModal() {
        this.modal = null;
        this.render();
    }

    handleModalAction(action) {
        this.closeModal();
        if (action === 'resetGame') {
            this.send({ type: 'resetGame', sessionId: this.sessionId, playerId: this.playerId });
        } else if (action === 'backToMenu') {
            this.mode    = 'menu';
            this.session = null;
            this.sessionId = null;
            this.playerId  = null;
            if (this.sceneManager) { this.sceneManager.destroy(); this.sceneManager = null; }
            this.render();
        }
    }

    // ════════════════════════════════════════════════════════════
    // attachEventListeners()
    // ════════════════════════════════════════════════════════════
    attachEventListeners() {
        // lang-toggle
        document.querySelectorAll('[data-lang]').forEach(btn => {
            btn.addEventListener('click', () => i18n.setLanguage(btn.dataset.lang));
        });

        // URL の ?session=XXXX をフォームに自動セット
        const params = new URLSearchParams(window.location.search);
        const sessionParam = params.get('session');
        if (sessionParam) {
            const input = document.getElementById('join-session-id');
            if (input) input.value = sessionParam.toUpperCase();
        }
    }
}

// ── グローバル初期化 ──────────────────────────────────────────
const game = new GameClient();
window.game = game;
game.init();
