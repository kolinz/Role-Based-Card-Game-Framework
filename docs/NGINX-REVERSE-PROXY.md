# Nginxによるリバースプロキシ設定手順

## Let's Encryptによる証明書と証明書の秘密鍵の取得


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
