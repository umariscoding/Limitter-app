# 🚨 LOGIN ERROR TROUBLESHOOTING GUIDE

## Error: "JSON Parse error unexpected character"

This means **backend is NOT returning valid JSON**.

---

## ✅ QUICK FIX CHECKLIST

### 1️⃣ Is Backend Running?
```bash
# Open Terminal - check backend
netstat -ano | findstr :3000

# If nothing, backend is NOT running
# Start it:
cd your_backend_folder
node index.js

# Expected output:
# ✅ [Server] Running on http://localhost:3000
# ✅ Firebase Admin SDK initialized
```

### 2️⃣ Is ngrok Running?
```bash
# Open another Terminal - check ngrok
# It should show:
# Forwarding https://something.ngrok-free.dev -> http://localhost:3000

# If not, restart:
ngrok http 3000
```

### 3️⃣ Is ngrok URL Updated?
```typescript
// File: src/config/config.ts
export const BASE_URL = 'https://your-url.ngrok-free.dev';
```

Compare with ngrok tunnel URL in Terminal. **If different, update it!**

---

## 🔍 WHAT'S HAPPENING

```
App tries to login
    ↓
Sends POST to https://url.ngrok-free.dev/api/auth/login
    ↓
Backend NOT running / ngrok down?
    ↓
Response is HTML error page OR garbage
    ↓
App tries to parse as JSON
    ↓
❌ "JSON Parse error unexpected character"
```

---

## 🧪 TEST WITHOUT APP

### Test in Terminal:
```bash
# Replace URL with your ngrok URL
curl -X POST https://your-url.ngrok-free.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}'

# Expected response:
# {"success": true, "uid": "...", "idToken": "...", ...}

# If you get HTML or error, backend is the problem
```

---

## 📋 CHECKLIST TO FIX

```
□ Backend running? (node index.js)
  └─ Check: localhost:3000 in browser

□ ngrok running? (ngrok http 3000)
  └─ Shows: Forwarding https://... -> http://localhost:3000

□ URL in config.ts matches ngrok URL?
  └─ Example: https://abc123def.ngrok-free.dev

□ Firebase .env in backend?
  └─ FIREBASE_API_KEY=...
  └─ FIREBASE_PROJECT_ID=...

□ Test curl command works?
  └─ curl POST to ngrok URL

□ App restarted after URL change?
  └─ npx react-native run-android
```

---

## 🚀 STEP-BY-STEP FIX

### Step 1: Stop everything
```bash
# Kill all terminals running React, node, ngrok
# Press Ctrl+C in each terminal
```

### Step 2: Start Backend
```bash
# Terminal 1
cd backend_folder
node index.js
# Wait for: ✅ [Server] Running on http://localhost:3000
```

### Step 3: Start ngrok
```bash
# Terminal 2
ngrok http 3000
# See: Forwarding https://XXXXX.ngrok-free.dev
# Copy this URL!
```

### Step 4: Update config
```typescript
// src/config/config.ts
export const BASE_URL = 'https://XXXXX.ngrok-free.dev'; // Your URL from ngrok
```

### Step 5: Restart App
```bash
# Terminal 3
cd e:\AppGuard2
npx react-native run-android
```

### Step 6: Login
```
📱 App
Email: test@example.com
Password: Test1234!
[Login]
```

---

## 📊 EXPECTED CONSOLE LOGS

```
✅ Good:
  🔄 Login API: Connecting to https://...
  ✅ Login API: Response status 200
  ✅ Login API: Parsed JSON: {success: true, ...}

❌ Bad:
  ❌ Login API HTTP Error: 404
  ❌ Response is not JSON
  ❌ Network error
```

---

## 🆘 IF STILL NOT WORKING

### Check Backend Logs
```bash
# In backend terminal, look for:
# - POST /api/auth/login
# - Any errors?
# - Is database connected?
```

### Check ngrok Logs
```
# In ngrok terminal, see requests coming in?
# If no requests, frontend can't reach backend
```

### Check React Native Logs
```bash
adb logcat | grep -i "login\|error\|json"
```

---

## 💡 COMMON ISSUES

| Error | Cause | Fix |
|-------|-------|-----|
| JSON parse error | Backend crash | Restart backend |
| Network Error | ngrok down | `ngrok http 3000` |
| HTTP 404 | Wrong URL in config | Update config.ts |
| HTTP 500 | Backend bug | Check backend logs |
| Timeout | Backend slow | Increase timeout, check DB |

---

## 📞 DEBUGGING HELP

Run this in app debugger console:
```javascript
// In React Native Debugger
fetch('https://your-url.ngrok-free.dev/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'Test1234!'
  })
})
  .then(r => r.json())
  .then(d => console.log('Response:', d))
  .catch(e => console.error('Error:', e))
```

---

**Status: Ready to test login after following steps above ✅**
