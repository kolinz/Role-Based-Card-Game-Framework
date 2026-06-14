'use strict';

const Database = require('better-sqlite3');
const db = new Database('./game.db');

// ── 1. 件数チェック ───────────────────────────────────────────
const counts = {
    mission_categories: db.prepare('SELECT COUNT(*) AS c FROM mission_categories').get().c,
    category_cards:     db.prepare('SELECT COUNT(*) AS c FROM category_cards').get().c,
    skill_types:        db.prepare('SELECT COUNT(*) AS c FROM skill_types').get().c,
    skill_cards:        db.prepare('SELECT COUNT(*) AS c FROM skill_cards').get().c,
    missions:           db.prepare('SELECT COUNT(*) AS c FROM missions').get().c,
    missions_special:   db.prepare('SELECT COUNT(*) AS c FROM missions WHERE isSpecial = 1').get().c,
};

const EXPECTED = {
    mission_categories: 4,
    category_cards:     6,
    skill_types:        3,
    skill_cards:        23,
    missions:           40,
    missions_special:   1,
};

console.log('=== Database Check ===');

let hasError = false;

function check(label, actual, expected, display) {
    const ok = actual === expected;
    if (!ok) hasError = true;
    console.log(`${label} ${display ?? actual} ${ok ? '✅' : `❌ (expected ${expected})`}`);
}

check('mission_categories:', counts.mission_categories, EXPECTED.mission_categories);
check('category_cards:    ', counts.category_cards,     EXPECTED.category_cards);
check('skill_types:       ', counts.skill_types,         EXPECTED.skill_types);
check('skill_cards:       ', counts.skill_cards,         EXPECTED.skill_cards);
check('missions:          ', counts.missions,             EXPECTED.missions,
    `${counts.missions} (special: ${counts.missions_special})`);

if (hasError) {
    console.error('\n❌ 件数不一致があります。initdb.js を再実行してください。');
    process.exit(1);
}

// ── 2. category_cards 全件（id, name_ja, targetPoints）────────
console.log('\n--- category_cards (id / name_ja / targetPoints) ---');
const cats = db.prepare('SELECT id, name_ja, targetPoints FROM category_cards').all();
cats.forEach(r => console.log(`  id=${r.id}  ${r.name_ja.padEnd(16)}  ${r.targetPoints}pt`));

// ── 3. skill_cards 先頭5件（matchesCategories サンプル）────────
console.log('\n--- skill_cards matchesCategories sample (top 5) ---');
const skills = db.prepare('SELECT id, name_ja, matchesCategories FROM skill_cards LIMIT 5').all();
skills.forEach(r => console.log(`  id=${r.id}  ${r.name_ja.padEnd(20)}  matchesCategories="${r.matchesCategories}"`));

// ── 4. skill_types 全件（id, name_ja, model_type）────────────
console.log('\n--- skill_types (id / name_ja / model_type) ---');
const types = db.prepare('SELECT id, name_ja, model_type FROM skill_types ORDER BY sortOrder').all();
types.forEach(r => console.log(`  id=${r.id}  ${r.name_ja.padEnd(16)}  model_type="${r.model_type}"`));

console.log('\n✅ All checks passed.');
