# 🔧 トラブルシューティングガイド

## 🚨 管理画面にログインできない場合

### エラー: "Unauthorized access"

このエラーが表示される場合、以下の手順で問題を解決してください。

---

## 📋 解決手順

### ステップ1: サーバーのログを確認

サーバーを起動すると、コンソールに以下のような情報が表示されます：

```
=================================
🚀 Server Started
=================================
Server running on http://localhost:3000
WebSocket server ready for multiplayer connections
Admin panel: http://localhost:3000/admin.html

📝 Admin Credentials:
   Username: admin
   Password: admin123
=================================
```

**この表示されている `Username` と `Password` を使用してログインしてください。**

---

### ステップ2: ログイン試行時のデバッグログを確認

ログインボタンを押すと、サーバーコンソールに以下のようなログが表示されます：

```
=== LOGIN ATTEMPT ===
Received username: admin
Received password length: 8
Expected username: admin
Expected password: admin123
Username match: true
Password match: true
====================
✅ Login successful! Token generated: 12345678...
```

または、失敗した場合：

```
=== LOGIN ATTEMPT ===
Received username: admin
Received password length: 5
Expected username: admin
Expected password: admin123
Username match: true
Password match: false
====================
❌ Login failed: Invalid credentials
```

---

### ステップ3: 一般的な問題と解決策

#### 問題1: パスワードが間違っている

**症状**: 
```
Password match: false
```

**解決策**: 
- デフォルトパスワードは `admin123` です（数字の123を含む）
- コピー&ペーストして入力してください
- 全角文字が混ざっていないか確認してください

---

#### 問題2: ユーザー名が間違っている

**症状**: 
```
Username match: false
```

**解決策**: 
- デフォルトユーザー名は `admin` です（すべて小文字）
- 大文字の `Admin` や `ADMIN` ではありません

---

#### 問題3: .envファイルの設定が読み込まれていない

**症状**: 
サーバー起動時のログに表示される認証情報が `admin` / `admin123` でない

**解決策**: 
1. `.env`ファイルが存在するか確認
2. `.env`ファイルの内容を確認：
   ```
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=admin123
   ```
3. サーバーを再起動

---

#### 問題4: npm installを実行していない

**症状**: 
サーバーが起動しない、またはエラーメッセージが表示される

**解決策**: 
```bash
npm install
npm start
```

---

## 🔐 カスタム認証情報の設定

デフォルトのユーザー名とパスワードを変更したい場合：

### 方法1: .envファイルを編集（推奨）

1. `.env`ファイルを作成または編集：
   ```bash
   cp .env.example .env
   nano .env
   ```

2. 以下のように編集：
   ```
   ADMIN_USERNAME=your_username
   ADMIN_PASSWORD=your_secure_password
   ```

3. サーバーを再起動：
   ```bash
   npm start
   ```

---

### 方法2: 環境変数で指定

**Windows (PowerShell)**:
```powershell
$env:ADMIN_USERNAME="your_username"
$env:ADMIN_PASSWORD="your_password"
npm start
```

**Mac/Linux**:
```bash
ADMIN_USERNAME=your_username ADMIN_PASSWORD=your_password npm start
```

---

## 🐛 その他のデバッグ方法

### ブラウザの開発者ツールを使用

1. ブラウザで `F12` を押して開発者ツールを開く
2. `Network` タブを選択
3. ログインボタンを押す
4. `/api/auth/login` リクエストを確認
5. `Response` タブでエラーメッセージを確認

---

### サーバーログを詳しく確認

サーバーコンソールに表示される以下の情報を確認：

- ✅ サーバーが正常に起動しているか
- ✅ 認証情報が正しく表示されているか
- ✅ ログイン試行時にログが表示されるか
- ✅ エラーメッセージが表示されているか

---

## 📞 それでも解決しない場合

以下の情報を含めてお問い合わせください：

1. サーバー起動時のログ全文
2. ログイン試行時のデバッグログ
3. ブラウザのコンソールエラー（F12 → Console タブ）
4. 使用しているOS（Windows / Mac / Linux）
5. Node.jsのバージョン（`node --version`）

---

## ✅ チェックリスト

解決する前に以下を確認してください：

- [ ] `npm install` を実行した
- [ ] サーバーが起動している（`npm start`）
- [ ] ブラウザで http://localhost:3000/admin.html にアクセスしている
- [ ] サーバーコンソールに認証情報が表示されている
- [ ] 表示されている認証情報を使用している
- [ ] パスワードをコピー&ペーストしている
- [ ] ブラウザのキャッシュをクリアした（Ctrl+Shift+Delete）

---

**バージョン**: 1.0  
**最終更新**: 2026-01-30
