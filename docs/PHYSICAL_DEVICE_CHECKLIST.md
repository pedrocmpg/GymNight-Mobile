# Physical Device Deployment Checklist

Environment: Android Physical Device via USB + Linux + Expo + FastAPI Backend

---

## Pre-Deployment Setup

### 1. Network Configuration
- [ ] Machine IP is `192.168.0.102` (primary) or `172.17.0.1` (fallback)
- [ ] Physical Android device is on the same WiFi network as dev machine
- [ ] Verify connectivity: `ping <device-ip>` from machine and vice versa
- [ ] Backend will be accessible at `http://192.168.0.102:8000` from device

### 2. Environment Variables (Frontend)
- [ ] `.env` file exists in `gymnight/frontend/`
- [ ] Contains `EXPO_PUBLIC_BACKEND_BASE_URL=http://192.168.0.102:8000`
- [ ] Contains `EXPO_PUBLIC_SUPABASE_URL=<your-supabase-url>`
- [ ] Contains `EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>`
- [ ] **NO** references to `localhost`, `127.0.0.1`, or `10.0.2.2`
- [ ] **NO** `REACT_APP_*` prefixes (must be `EXPO_PUBLIC_*`)

### 3. Android Device
- [ ] Device connected via USB (cable inserted)
- [ ] File transfer mode enabled (not "charging only")
- [ ] USB debugging enabled: Settings → Developer Options → USB Debugging
- [ ] Trust prompt accepted on device ("Trust this computer?")
- [ ] Verify ADB connection: `adb devices` shows device with status `device`

### 4. Backend Configuration
- [ ] Backend API will listen on `0.0.0.0:8000` (not just localhost)
- [ ] Database migrations applied (including `007_make_users_email_nullable.py` if applicable)
- [ ] Supabase credentials configured in backend `.env`

---

## Build & Deployment Flow

### Terminal 1: Start Backend
```bash
cd gymnight/backend

# Ensure 0.0.0.0 binding (accessible from device on different interface)
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

✓ **Verify:** Backend logs show "Uvicorn running on http://0.0.0.0:8000"

### Terminal 2: Build & Deploy Frontend
```bash
cd gymnight/frontend

# Verify device still connected
adb devices

# Build APK and deploy directly to connected device
npx expo run:android
```

✓ **Expected behavior:**
- Expo detects connected USB device
- Builds APK (~1-2 minutes)
- Deploys APK to device
- App launches automatically
- Metro bundler starts and hot-reload is available

### Hot Reload During Development
- [ ] Edit any file in `src/`
- [ ] Save file
- [ ] App reloads automatically on device (fast refresh)
- [ ] No need to rebuild/redeploy unless native code changes

---

## Post-Deployment Validation

### App Behavior
- [ ] App launches without crash
- [ ] Loading screen appears briefly
- [ ] Auth screen shows (if no stored session)
- [ ] Can sign in with valid Supabase credentials
- [ ] Dashboard loads after successful sign-in
- [ ] Sync icon shows in dashboard

### Network Connectivity
- [ ] Backend API responds to frontend requests
- [ ] Profile creation succeeds (`POST /users`)
- [ ] Workout creation succeeds and syncs
- [ ] Active session logging works
- [ ] Push/pull sync cycles complete without 4xx/5xx errors

### Device Logs
```bash
# Monitor real-time logs
adb logcat | grep -i "gymnight\|expo\|error"
```

- [ ] No "localhost" or "127.0.0.1" connection errors
- [ ] No "Network unavailable" errors for backend calls
- [ ] Supabase auth tokens received correctly
- [ ] Sync payloads sent/received with correct user ID

---

## Troubleshooting Checklist

### Device Connection Issues
- [ ] Run `adb kill-server && adb devices`
- [ ] Check USB cable (try different port)
- [ ] Verify USB debugging enabled on device
- [ ] Restart ADB daemon: `adb kill-server`
- [ ] Unplug/replug device and accept trust prompt again

### Network Connectivity Issues
- [ ] Ping machine from device: `ping 192.168.0.102`
- [ ] Ping device from machine: `ping <device-ip>`
- [ ] Verify firewall allows ports 8000 (backend) and 8081 (Metro)
- [ ] Check backend logs for incoming connections
- [ ] Ensure device and machine are on same WiFi network

### Backend Not Reachable
- [ ] Verify backend running: `curl http://192.168.0.102:8000/health`
- [ ] Check backend listening on `0.0.0.0` (not localhost)
- [ ] Verify backend `.env` has correct database URL
- [ ] Check firewall: `sudo ufw status`, `sudo ufw allow 8000`

### Frontend Build Issues
- [ ] Clear cache: `rm -rf node_modules/.cache`
- [ ] Clean rebuild: `npx expo run:android --clean`
- [ ] Check `.env` has no syntax errors
- [ ] Verify `EXPO_PUBLIC_*` prefix (not `REACT_APP_*`)

### App Crashes on Launch
- [ ] Check `adb logcat` for exception details
- [ ] Verify all required environment variables set
- [ ] Ensure Supabase credentials are valid
- [ ] Check database connection from backend
- [ ] Try `npx expo run:android` again (clean build)

---

## Important Notes

- **No Emulator:** This project runs on physical device only. Android emulator has been removed.
- **IP Address:** Must use machine IP (192.168.0.102) for device to reach backend. No localhost/10.0.2.2.
- **Backend Binding:** Backend must bind to 0.0.0.0 to be reachable from device on different network interface.
- **USB Connection:** Ensure "File Transfer" mode is enabled, not "Charging Only."
- **Same Network:** Device and dev machine must be on same WiFi for connectivity.
- **Hot Reload:** Available after app launches; useful for iterative development.

---

## Related Documentation

- **Quick Start:** [DEVICE_USB_QUICK_START.md](DEVICE_USB_QUICK_START.md)
- **Integration Tasks:** [.kiro/specs/frontend-backend-integration/tasks.md]
- **Backend Setup:** [docs/backend.md]
- **Frontend Config:** [gymnight/frontend/src/config/]

---

Last Updated: 2026-07-11
Environment: Physical Device (USB) on Linux
