# Nginxによるリバースプロキシ設定手順
HTTPS接続を行うために、リバースプロキシを構築する必要があるため、その手順です。

## Nginxのインストール
次のコマンドを実行します。最新バージョンのNginxをインストールします。
```
sudo apt install curl gnupg2 ca-certificates lsb-release ubuntu-keyring
curl https://nginx.org/keys/nginx_signing.key | gpg --dearmor | sudo tee /usr/share/keyrings/nginx-archive-keyring.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/nginx-archive-keyring.gpg] http://nginx.org/packages/mainline/ubuntu `lsb_release -cs` nginx" | sudo tee /etc/apt/sources.list.d/nginx.list
sudo apt update
sudo apt install -y nginx
sudo systemctl start nginx
```

## Let's Encryptによる証明書と秘密鍵の取得
次のコマンドを実行します。Let's Encyptの証明書と秘密鍵の取得に必要なソフトウェアのインストール。
```
sudo apt update
sudo apt install certbot python3-certbot-nginx
```
証明書と秘密鍵の発行のため、次のコマンドを実行します。
```
sudo certbot certonly --nginx -d ドメイン名
```
実行結果
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/ドメイン名/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/ドメイン名/privkey.pem
This certificate expires on 証明書の有効期限日.
These files will be updated when the certificate renews.
Certbot has set up a scheduled task to automatically renew this certificate in the background.
```
- fullchain.pem が証明書
- privkey.pem が秘密鍵
- 証明書の有効期限日が来る前に証明書を更新すること

## Nginx設定ファイルの場所を探す
パスを /etc/nginx/conf.d　とした場合。パスが異なる場合は、適宜読み替えてください。

## ssl-proxy.confの作成
次のコマンドを実行します。
```
sudo nano ssl.conf ssl-proxy.conf
```
中身を下記のように記述します。
```
server {
    listen 443 ssl;
    http2 on;
    server_name ドメイン名;

    # SSL証明書の設定
    ssl_certificate /etc/letsencrypt/live/ドメイン名/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ドメイン名/privkey.pem;

    # Nginxバージョン情報を隠す
    server_tokens off;

    # SSLプロトコルとセキュリティ設定
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256';

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 1.1.1.1 1.0.0.1 valid=300s;
    resolver_timeout 5s;
    ssl_trusted_certificate /etc/letsencrypt/live/ドメイン名/fullchain.pem;

    # WebSocketサポート
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocketタイムアウト
        proxy_read_timeout 86400;
}
```
## 設定ファイルのチェック
次のコマンドを実行します。
```
sudo nginx -t
```
実行結果
```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```
## Nginx再起動による設定ファイルの読み込み
次のコマンドを実行します。
```
 sudo systemctl restart nginx
```
実行結果
```
● nginx.service - nginx - high performance web server
     Loaded: loaded (/usr/lib/systemd/system/nginx.service; enabled; preset: enabled)
     Active: active (running) since Tue 2026-02-03 10:17:02 JST; 18min ago
       Docs: https://nginx.org/en/docs/
    Process: 14764 ExecStart=/usr/sbin/nginx -c ${CONFFILE} (code=exited, status=0/SUCCESS)
   Main PID: 14765 (nginx)
      Tasks: 3 (limit: 1008)
     Memory: 3.7M (peak: 4.3M)
        CPU: 48ms
     CGroup: /system.slice/nginx.service
             tq14765 "nginx: master process /usr/sbin/nginx -c /etc/nginx/nginx.conf"
             tq14766 "nginx: worker process"
             mq14767 "nginx: worker process"
```
これで、Nginxによるリバースプロキシ設定で、SSL/TLS接続は完了です。
