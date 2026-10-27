@echo off
title TradePilot Mobile Cloudflare Tunnel
echo =========================================================
echo Launching Secure Public Mobile Link for TradePilot...
echo Open the generated https link on your phone (4G/5G/Wi-Fi)
echo =========================================================
npx --yes cloudflared tunnel --url http://localhost:5173
pause
