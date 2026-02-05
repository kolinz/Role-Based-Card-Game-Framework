# Role Based Card Game Framework
## 概要
- このツールを通して、職種/職業を学ぶキャリア教育や進路指導、また企業内における各職種/職業の役割を学ぶマルチプレイ対応のオンラインカードゲームをつくることができます。
- オンラインマルチプレイヤー対応のカードゲームです。管理画面を通してカードを作成管理するため、軽量なオンラインカードゲームエンジンとしても使うことができます。
- ゲーム運営者は、パソコン、Raspberry Pi、一般的なサーバー、AWSやIBM Cloudなどの一般的なクラウドの仮想マシンなどで環境構築し、プレイヤーはゲーム運営者が構築した環境に普段使っている「Webブラウザ」からアクセスすることで操作できます。

💡 Specification Driven Development（SDD）ベースで構築

本フレームワークは、仕様書（SDD）に基づいて開発された再現性の高いゲームエンジンです。
ゲームロジック、カード構造、WebSocket 通信、管理画面 API、DB スキーマなどの仕様が明文化されており、教育機関・企業研修・OSS コントリビュータが 容易に導入・拡張できるように設計されています。

### Githubでのダウンロード操作
Githubからファイルをダウンロードする場合は、下図のように「Download raw file」のアイコンをクリックしましょう。

<img width="244" height="105" alt="image" src="https://github.com/user-attachments/assets/a400e9ea-4643-46a4-a1b0-b07e6f226ddd" />


## 目次
1. [実装済みの機能](#anchor1)
2. [教育機関向けの振り返りワークシート](#anchor2)
3. [導入について](#anchor3)
99. [今後の作業](#anchor99)


<a id="anchor1"></a>
## 🎮 実装済みの機能
- ✅ ３種類のカード（職種カード、スキルカード、ミッションカード）を使ったオンラインカードゲームプラットフォーム。
  - 職種カード : 職種/職業情報、プレイ開始時に１人１枚選択。
  - スキルカード：プレイ中に集める。ミッションカードとともに同時に表示される。
  - ミッションカード：業務疑似体験カード。カードに書かれた疑似体験業務を、他のプレイヤーと協力して遂行する。
- ✅ 初期設定として、以下のICT関連職種を学べるデータセット <-- 管理画面を使うことで、ICT関連職種以外も実現できる。
  - 職種カード
    - ソフトウェアエンジニア
    - クラウドアーキテクト
    - DevOpsエンジニア
    - サイバーセキュリティ専門家
    - AIエンジニア
    - ITガバナンス担当
   - スキルカード
     - 職種カードに登録された職種に関するスキル（知識など）情報
   - ミッションカード
     - 職種カードに関係する業務疑似体験
   - カテゴリ
     - カッツモデルにもとづく、ミッションカードのカテゴリ3種
       - テクニカルスキル
       - ヒューマンスキル
       - コンセプチュアルスキル
     - 予期せぬ事態への対応
- ✅ サイコロを振る機能
  - １～６の目の数だけ、スキルカードおよびミッションカードが選ばれ、プレイヤーはそこから１枚得る。  
- ✅ 複数端末から接続可能
- ✅ 招待URLでゲームに参加
- ✅ 2-4人のマルチプレイヤー対応
- ✅ WebSocketによるリアルタイム同期
- ✅ WebSocket自動再接続
- ✅ SQLiteによるデータ永続化
- ✅ 多言語対応** (日本語/英語 - 翻訳ファイル方式)
- ✅ 特別ミッション: 退職＆強制兼任
- ✅ ゲーム中にカードの数が残り７枚以下で、使用済みのカードを再利用する機能
- ✅ 管理画面認証（24時間トークン）
- ✅ 管理画面：新規カード作成・編集・削除
- ✅ 管理画面：カードに画像（イラストなど）を添付可能
- ✅ 管理画面：カードのCSV Import / Export

<a id="anchor2"></a>
## 振り返りワークシート
中学や高校の探求学習、大学のキャリア教育向けにご活用ください。こちらから[ダウンロード](https://github.com/kolinz/Role-Based-Card-Game-Framework/blob/main/docs/Reflection-sheet-sample.docx)することができます。必要に応じて変更してください。

<a id="anchor3"></a>
## 🚀 導入について
### ゲームサーバー 
  - Node.js 20以上
  - npm または yarn
  - Webブラウザから管理画面にアクセス
### プレイヤー
  - Webブラウザのみ（インストール不要） 
### 📋 必要な環境
#### 1. 依存関係のインストール
```bash
npm install
```
#### 2. 環境変数の設定（オプション）
```bash
cp .env.example .env
# .envファイルを編集して管理者パスワードを変更
```
#### 3. データベースの初期化
```bash
npm run initdb
```
#### 4. サーバーの起動
```bash
npm start
```
サーバーが起動したら:
- ゲーム画面: http://localhost:3000
- 管理画面: http://localhost:3000/admin.html

### 🔐 管理画面にアクセス

デフォルトのログイン情報:
- **ユーザー名**: `admin`
- **パスワード**: `admin123`

**⚠️ 重要**: 本番環境では必ず`.env`ファイルを作成し、強力なパスワードに変更してください！

### ゲームの起動(npm start)をサービス化する方法
Role Based Card Game Framework のパスが、/home/ubuntu/Role-Based-Card-Game-Framework とする場合 について述べます。パスが異なる場合は、適宜読み替えてください。
Ubutnu を前提にしています。後述の意味が分かる人は、Ubuntu以外のRedHat系でも問題ないはずなので、適宜読み替えてください。

#### systemd サービスファイルの作成
下記のコマンドを実行します。
```
sudo nano /etc/systemd/system/rolebased-card-game.service
```
中身は、次のように記述します。
```
[Unit]
Description=Role based Card Game - Multiplayer WebSocket Server
Documentation=https://github.com/kolinz/Role-Based-Card-Game-Framework/
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
StandardOutput=append:/var/log/rolebased-card-game/access.log
StandardError=append:/var/log/rolebased-card-game/error.log

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
sudo mkdir -p /var/log/rolebased-card-game
sudo chown ubuntu:ubuntu /var/log/rolebased-card-game
```

### サービスの有効化と起動
次のコマンドを実行します。
```
sudo systemctl daemon-reload
sudo systemctl enable rolebased-card-game
sudo systemctl start rolebased-card-game
```
起動確認として、次のコマンドを実行します。
```
sudo systemctl status rolebased-card-game
```

### 本番環境で運用する場合
HTTPS接続が必要である、リバースプロキシもしくは、リバースプロキシ相当のサービスを使ってください。リバースプロキシ設定は[こちらの資料](https://github.com/kolinz/Role-Based-Card-Game-Framework/blob/main/docs/NGINX-REVERSE-PROXY.md)からご覧になることができます。

<a id="anchor99"></a>
## 今後の作業
- プレイガイドの作成
  - ゲーム運営管理向け
  - プレイヤー向け  
- localtonetなどのトンネルサービスを使ったゲーム運営方法
- 初期のサンプルデータセットのアップデート（すぐに遊べるようにする）
