# Environment Migration Summary: Android Emulator → Physical Device USB

**Migration Date:** 2026-07-11  
**Environment:** Linux + Expo + FastAPI Backend  
**Target:** Physical Android Device via USB

---

## What Changed

### 1. Network Configuration
**Before (Emulator):** 
- Backend accessible at `localhost:8000` or `10.0.2.2:8000`
- Emulator could reach host via special IP `10.0.2.2`

**After (Physical Device):**
- Backend accessible at **`192.168.0.102:8000`** (machine IP)
- Device on same Wi-Fi network as dev machine
- Backend must bind to `0.0.0.0` (not just localhost)

### 2. Environment Variables
**Before:**
```
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_SUPABASE_URL=...
REACT_APP_SUPABASE_ANON_KEY=...
```

**After:**
```
EXPO_PUBLIC_BACKEND_BASE_URL=http://192.168.0.102:8000
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

**Key Changes:**
- Prefix changed from `REACT_APP_*` to `EXPO_PUBLIC_*` (Expo requirement)
- IP changed from `localhost` to `192.168.0.102`
- Variable name changed from `BACKEND_URL` to `BACKEND_BASE_URL`

### 3. Build & Deployment Flow
**Before:**
- Android emulator spawned locally
- App deployed to emulator via Gradle/Android Studio
- Metro bundler connected to emulator

**After:**
```bash
# Terminal 1: Backend
cd gymnight/backend
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 2: Frontend
cd gymnight/frontend
adb devices                    # Verify USB connection
npx expo run:android           # Build APK + deploy to device
```

### 4. Files Updated

#### Configuration Files
- ✅ `gymnight/frontend/.env.example` — Updated to use `EXPO_PUBLIC_*` and `192.168.0.102`
- ✅ `gymnight/frontend/scripts/setup-device.sh` — Updated to use `EXPO_PUBLIC_*` prefixes
- ✅ `gymnight/frontend/scripts/setup-device.cmd` — Updated to use `EXPO_PUBLIC_*` prefixes

#### Documentation
- ✅ `DEVICE_USB_QUICK_START.md` — Updated with physical device-specific steps
- ✅ `.kiro/specs/frontend-backend-integration/tasks.md` — Added "Quick Reference" section with physical device flow
- ✅ `docs/PHYSICAL_DEVICE_CHECKLIST.md` — **NEW** — Comprehensive checklist for physical device deployment
- ✅ `docs/ENVIRONMENT_MIGRATION_SUMMARY.md` — **NEW** — This file

#### App Configuration
- ✅ `app.json` — No changes needed (Expo handles both emulator and device)

---

## What Did NOT Change

The following were NOT modified per your instructions:

- ❌ WatermelonDB sync logic (offline-first behavior unchanged)
- ❌ Auth interceptor implementations
- ❌ Component test files (components remain as-is)
- ❌ Backend SQLAlchemy models
- ❌ Data structure or schema definitions
- ❌ Route handlers or endpoint logic

---

## Key Network Requirements

### Machine IP: 192.168.0.102
```bash
# Verify your machine IP
hostname -I
# Expected: 192.168.0.102 172.17.0.1 ...
```

### Backend Binding
```bash
# Must bind to 0.0.0.0 to be accessible from device
uvicorn app.main:app --host 0.0.0.0 --port 8000

# NOT just localhost (won't work for device)
# ❌ uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Device on Same Network
- Physical device must be on same Wi-Fi as dev machine
- Both should be able to ping each other
- USB connection is for deployment/debugging only; app communicates via Wi-Fi

---

## Deployment Flow Checklist

### Pre-Deployment
- [ ] Machine IP is `192.168.0.102`
- [ ] `.env` has `EXPO_PUBLIC_BACKEND_BASE_URL=http://192.168.0.102:8000`
- [ ] Device connected via USB
- [ ] USB debugging enabled on device
- [ ] `adb devices` shows device as "device" (not offline)

### During Deployment
- [ ] Backend running: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- [ ] Frontend builder: `npx expo run:android` (or `npm start -- --lan` then deploy)
- [ ] App launches on device
- [ ] Metro bundler shows "LAN: http://192.168.0.102:8081"

### Post-Deployment
- [ ] App connects to backend at `192.168.0.102:8000`
- [ ] Sign-in/profile creation works
- [ ] Sync cycle completes without network errors
- [ ] No "localhost" or "127.0.0.1" errors in `adb logcat`

---

## Command Reference

### Quick Start
```bash
# Terminal 1: Backend
cd gymnight/backend && uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 2: Frontend
cd gymnight/frontend
adb devices
npx expo run:android
```

### Development
```bash
# Watch logs
adb logcat | grep -i "gymnight\|expo"

# Test backend connectivity
curl http://192.168.0.102:8000/health

# Verify device IP
adb shell ip addr show | grep "inet " | grep -v "127.0.0.1"
```

### Troubleshooting
```bash
# Reset ADB daemon
adb kill-server && adb devices

# Clean Expo cache
cd gymnight/frontend && rm -rf node_modules/.cache
npx expo run:android --clean

# Check if device is reachable
ping $(adb shell getprop ro.kernel.android.checkjni 2>/dev/null | head -1 || echo "192.168.0.102")
```

---

## Task Adjustments

The following task sections were updated to reflect physical device environment:

### Task 1.3: Env_Config Example
- Added comment: `EXPO_PUBLIC_BACKEND_BASE_URL` example is `http://192.168.0.102:8000`
- Clarified: Physical device on same Wi-Fi network

### Task 9.1: Sync_Cycle_Runner HTTP Layer
- Documented: Read `backend_base_url` from `EnvConfig` at construction
- Note: Single call site ensures 192.168.0.102 is used consistently

### Task 19.1: End-to-end Validation
- Added prerequisites section with physical device setup steps
- Clarified: Device must be USB-connected, on same Wi-Fi as backend

### Section: Quick Reference & Environment Configuration
- Added buildable command reference for physical device
- Documented network setup requirements
- Explained backend binding to 0.0.0.0

---

## Migration Validation

All tasks remain unchanged in **logic and scope**. Physical device migration is **configuration only**:

✅ **Network Configuration** — IP changed, variables renamed  
✅ **Build Execution** — `npx expo run:android` (no emulator)  
✅ **Backend Binding** — `0.0.0.0:8000` (not localhost)  
✅ **Documentation** — Updated guides and checklists  
✅ **Env Variables** — EXPO_PUBLIC_* prefix, 192.168.0.102 IP  

❌ **No changes** to auth, sync, components, tests, or data layers

---

## Next Steps

1. **Verify setup:** Run `./scripts/setup-device.sh 192.168.0.102 <SUPABASE_URL> <SUPABASE_ANON_KEY>`
2. **Connect device:** USB cable + check `adb devices`
3. **Start backend:** `cd gymnight/backend && uvicorn app.main:app --host 0.0.0.0 --port 8000`
4. **Deploy frontend:** `cd gymnight/frontend && npx expo run:android`
5. **Verify:** App launches on device, connects to backend at 192.168.0.102:8000

For detailed checklist, see: `docs/PHYSICAL_DEVICE_CHECKLIST.md`

---

## Questions & Troubleshooting

- **"Device not found"** → Check USB cable, enable USB debugging, accept trust prompt
- **"Backend unreachable"** → Verify backend binding to `0.0.0.0`, not `localhost`
- **"192.168.0.102 timeout"** → Check device and machine on same Wi-Fi
- **"Wrong IP on your machine?"** → Run `hostname -I` to find your IP, update `.env`

See: `docs/PHYSICAL_DEVICE_CHECKLIST.md` (Troubleshooting section)

---

**Status:** ✅ Configuration migration complete. Ready for task implementation.
