# 🚀 Rodar GymNight no Device via USB — Quick Start

Resumo rápido para executar o app no seu celular Android via USB (sem emulador).

**Environment: Physical Device (USB) on Linux with Expo**

---

## 1. Setup Inicial (uma vez)

```bash
# No PC, na raiz do projeto:
cd gymnight/frontend

# Seu IP local atual (para este ambiente):
# PRIMARY: 192.168.0.102 (recomendado)
# FALLBACK: 172.17.0.1
# Certifique-se que device e PC estão na mesma rede WiFi

# Rodar script de setup (Linux/Mac):
./scripts/setup-device.sh 192.168.0.102 <SUPABASE_URL> <SUPABASE_ANON_KEY>

# OU no Windows:
scripts/setup-device.cmd 192.168.0.102 <SUPABASE_URL> <SUPABASE_ANON_KEY>

# Se não quiser usar o script, edite manualmente:
cat > .env << EOF
EXPO_PUBLIC_BACKEND_BASE_URL=http://192.168.0.102:8000
EXPO_PUBLIC_SUPABASE_URL=<sua_url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<sua_chave>
EOF
```

⚠️ **CRITICAL:** Use `EXPO_PUBLIC_*` prefix (não `REACT_APP_*`) — Expo exige isso.

---

## 2. No Device Android

1. **Conectar via USB**
   - Cabo USB no device
   - Escolha "Transferência de arquivos" (não carregar apenas)

2. **Ativar Depuração USB**
   - Configurações → Sobre o telefone → Número da build (7 toques)
   - Volte em Configurações → Desenvolvedor → Depuração USB
   - Toque OK no popup do device ("Confiar neste computador?")

3. **Verificar conexão** (no PC):
   ```bash
   adb devices
   # Deve aparecer:
   # abc123def456    device
   ```

---

## 3. Abrir 2-3 Terminais

### Terminal 1: Backend
```bash
cd gymnight/backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
# ✓ Escuta em 0.0.0.0:8000 (acessível em 192.168.0.102 do device)
```

### Terminal 2: Frontend - Verificar Device + Deploy
```bash
cd gymnight/frontend

# Verificar conexão USB
adb devices
# Esperado: device com status "device"

# Build + Deploy diretamente no device USB
npx expo run:android
# Expo detecta device conectado e faz build em ~1-2 min
# App abre automaticamente no device
# Metro bundler inicia; hot-reload funciona
```

**Alternativa (se preferir LAN mode tradicional):**
```bash
# Terminal 2A: Start Expo dev server
npm start -- --lan

# Terminal 3: Deploy (em outro terminal)
npx expo run:android
```

---

## 4. Desenvolver

- Edite arquivos em `src/`
- Salve → o app recarrega automaticamente no device (fast refresh)
- Ver logs: `adb logcat | grep -i gymnight`

---

## 📚 Documentação Completa

- **Setup detalhado:** [`docs/SETUP_DEVICE_USB.md`](docs/SETUP_DEVICE_USB.md)
- **Checklist pré-deployment:** [`docs/DEVICE_SETUP_CHECKLIST.md`](docs/DEVICE_SETUP_CHECKLIST.md)
- **Configuração:** [`gymnight/frontend/src/config.ts`](gymnight/frontend/src/config.ts)

---

## ⚠️ Dicas Importantes

- **IP local:** Use `192.168.0.102` (sua máquina neste ambiente)
- **Backend:** Certifique-se que está rodando em `0.0.0.0:8000` (não localhost)
- **Device USB:** Conectado com "Transferência de arquivos" ativada, não charging-only
- **Depuração USB:** Ativar em Configurações → Desenvolvedor
- **Mesma rede:** Device e PC devem estar na mesma WiFi
- **Firewall:** Abra portas 8000 (backend) e 8081 (Metro) se necessário
- **No emulator:** Projeto roda APENAS em device físico via USB (emulator removido)
- **Env vars:** Prefixo `EXPO_PUBLIC_*` é obrigatório (Expo exigência)

---

## 🆘 Problemas?

```bash
# Device não aparece em adb devices
adb kill-server
adb devices
# Se ainda não aparecer: verifique USB debugging ativado no device

# Ver logs em tempo real
adb logcat | grep -i gymnight

# Testar conectividade backend
curl http://192.168.0.102:8000/health

# Firewall bloqueando
sudo ufw allow 8000 && sudo ufw allow 8081

# Resetar Expo cache
cd gymnight/frontend
rm -rf node_modules/.cache
npx expo run:android --clean

# Metro bundler conectando ao device
# (should be automatic; if stuck, Ctrl+C e tentar novamente)
```

Mais detalhes em [`docs/SETUP_DEVICE_USB.md`](docs/SETUP_DEVICE_USB.md).

---

Sucesso! 🎯
