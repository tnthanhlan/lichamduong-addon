#!/bin/bash
set -e

OPTIONS_FILE=/data/options.json
TOKEN=""

if [ -f "$OPTIONS_FILE" ]; then
  TOKEN=$(node -e "
    try {
      const o = require('$OPTIONS_FILE');
      process.stdout.write(o.cloudflare_tunnel_token || '');
    } catch (e) {
      process.stdout.write('');
    }
  ")
fi

if [ -n "$TOKEN" ]; then
  echo "[lichamduong] Khởi động Cloudflare Tunnel riêng cho add-on này..."
  cloudflared tunnel run --token "$TOKEN" &
else
  echo "[lichamduong] Không có cloudflare_tunnel_token trong cấu hình add-on — bỏ qua Cloudflare Tunnel, chỉ chạy server nội bộ."
fi

echo "[lichamduong] Khởi động server Lịch Âm Dương..."
cd /app/server
exec node index.js
