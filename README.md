# Role Based Card Game Framework

オンラインマルチプレイヤー対応のカードゲームです。管理画面を通してカードを作成管理するため、軽量なオンラインカードゲームエンジンとしても使うことができます。

## 目次
1. [実装済みの機能](#anchor1)
2. [必要な環境](#anchor2)
3. [すぐにはじめたい人向け](#anchor3)
4. [セットアップ手順](#anchor4)
5. [管理画面](#anchor5)
6. [ゲームの起動(npm start)をサービス化する方法](#anchor6)
7. [本番環境で運用する場合](#anchor7)


<a id="anchor1"></a>
## 🎮 実装済みの機能
- ✅ ３種類のカード（職種カード、スキルカード、ミッションカード）を使った、軽量なオンラインカードゲームプラットフォーム
- ✅ サイコロを振る機能
- ✅ 複数端末から接続可能
- ✅ 招待URLでゲームに参加
- ✅ 2-4人のマルチプレイヤー対応
- ✅ WebSocketによるリアルタイム同期
- ✅ WebSocket自動再接続
- ✅ SQLiteデータベース
- ✅ 多言語対応** (日本語/英語 - 翻訳ファイル方式)
- ✅ 特別ミッション: 退職＆強制兼任
- ✅ ゲーム中にカードの数が残り７枚以下で、使用済みのカードを再利用する機能
- ✅ 管理画面認証（24時間トークン）
- ✅ 管理画面：新規カード作成・編集・削除
- ✅ 管理画面：カードに画像（イラストなど）を添付可能
- ✅ 管理画面：カードのCSV Import / Export

<a id="anchor2"></a>
## 📋 必要な環境
- ゲーム運営環境
  - Node.js 20以上
  - npm または yarn
  - Webブラウザから管理画面にアクセス
- プレイヤー
  - Webブラウザのみ（インストール不要） 

<a id="anchor3"></a>
## すぐにはじめたい人向け
[クイックスタートガイド](https://github.com/kolinz/Role-Based-Card-Game-Framework/blob/main/QUICKSTART.md) をご覧ください。

<a id="anchor4"></a>
## 🚀 セットアップ手順
### 1. 依存関係のインストール
```bash
npm install
```
### 2. 環境変数の設定（オプション）
```bash
cp .env.example .env
# .envファイルを編集して管理者パスワードを変更
```
### 3. データベースの初期化
```bash
npm run initdb
```
### 4. サーバーの起動
```bash
npm start
```
サーバーが起動したら:
- ゲーム画面: http://localhost:3000
- 管理画面: http://localhost:3000/admin.html

<a id="anchor5"></a>
## 🔐 管理画面

デフォルトのログイン情報:
- **ユーザー名**: `admin`
- **パスワード**: `admin123`

**⚠️ 重要**: 本番環境では必ず`.env`ファイルを作成し、強力なパスワードに変更してください！

<a id="anchor6"></a>
## ゲームの起動(npm start)をサービス化する方法
Role Based Card Game Framework のパスが、/home/ubuntu/Role-Based-Card-Game-Framework とする場合 について述べます。パスが異なる場合は、適宜読み替えてください。
Ubutnu を前提にしています。後述の意味が分かる人は、Ubuntu以外のRedHat系でも問題ないはずなので、適宜読み替えてください。

### systemd サービスファイルの作成
下記のコマンドを実行します。
```
sudo nano /etc/systemd/system/career-card-game.service
```
中身は、次のように記述します。
```
[Unit]
Description=Career Card Game - Multiplayer WebSocket Server
Documentation=https://github.com/yourusername/career-card-game
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/Role-Based-Card-Game-Framework
EnvironmentFile=/home/ubuntu/Role-Based-Card-Game-Framework/.env
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/career-card-game/access.log
StandardError=append:/var/log/career-card-game/error.log

# セキュリティ設定
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```
保存します。

### ログディレクトリの作成
次時のコマンドを実行します。
```
sudo mkdir -p /var/log/career-card-game
sudo chown ubuntu:ubuntu /var/log/career-card-game
```

### サービスの有効化と起動
次のコマンドを実行します。
```
sudo systemctl daemon-reload
sudo systemctl enable career-card-game
sudo systemctl start career-card-game
```
起動確認として、次のコマンドを実行します。
```
sudo systemctl status career-card-game
```

<a id="anchor7"></a>
## 本番環境で運用する場合
HTTPS接続が必要である、リバースプロキシもしくは、リバースプロキシ相当のサービスを使ってください。リバースプロキシ設定は[こちらの資料](https://github.com/kolinz/Role-Based-Card-Game-Framework/blob/main/docs/NGINX-REVERSE-PROXY.md)からご覧になることができます。
