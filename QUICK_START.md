## ⚡ JUST TEST IT - 5 MINUTE QUICK START

### **Prerequisites:**
- Backend running on ngrok
- Your ngrok URL copied

---

### **Step 1: Update Base URL (30 seconds)**
```
Open: e:\AppGuard2\src\config\config.ts

Change:
export const BASE_URL = 'https://YOUR-CURRENT-NGROK-URL';

Example:
export const BASE_URL = 'https://abc123-ngrok-free.app';
```

---

### **Step 2: Start App (30 seconds)**
```bash
cd e:\AppGuard2
npx react-native run-android
# Wait for "Welcome to React Native!" message
```

---

### **Step 3: Open Console (30 seconds)**
```
Android:
  Open: Chrome DevTools
  Go to: chrome://inspect
  Click: Inspect on your device
  Open: Console tab

iOS:
  Open: Safari
  Develop → Device → Your App
  Open: Console
```

---

### **Step 4: Login (1 minute)**
1. **LoginScreen appears**
2. Enter email: `test@test.com` (or your test account)
3. Enter password: `password123`
4. Click Login

**Look at console:**
```
Should see: ✅ Login API response
```

If not, backend might not be running.

---

### **Step 5: Check Dashboard (1 minute)**
App auto-navigates to DashboardScreen.

**Look at console:**
```
Should see: ✅ Fetched limits
```

**Look at screen:**
- Shows your name
- Shows your plan (Free/Medium/Pro)
- Shows overrides left
- Shows list of limits

---

### **Step 6: Create a Limit (1 minute)**
1. Click `+` button
2. Enter: `Instagram`
3. Click "Create"

**Look at console:**
```
Should see: ✅ Create Limit API Response
```

**Look at screen:**
```
New "Instagram" limit appears with:
- Progress bar (0/60 min)
- Status badge (ACTIVE)
- Use Override button
```

---

### **IF SOMETHING DOESN'T WORK:**

```
❌ Console shows errors
  → Check ngrok URL is correct
  → Check backend is running
  → Read TESTING_GUIDE.md

❌ Login fails
  → Check credentials in your backend
  → Check /api/auth/login endpoint works
  → Check Network tab for actual error

❌ Limits don't show
  → Check console shows "✅ Fetched limits"
  → If not, backend /api/limits/:uid/:device endpoint broken
  → Check user.uid is being passed correctly

❌ App crashes
  → Check console for error message
  → Check QUICK_REFERENCE.md for that error
  → Restart app and try again
```

---

### **YOU'RE DONE! 🎉**

Everything is working if you can:
- ✅ Login successfully
- ✅ See your user info on Dashboard
- ✅ See "✅ Fetched limits" in console
- ✅ Create a limit
- ✅ See new limit appear

---

## **THAT'S IT!**

For more details, read:
- `TESTING_GUIDE.md` - Comprehensive guide
- `QUICK_REFERENCE.md` - Troubleshooting
- `README_DASHBOARD_UPDATE.md` - Full overview

Have fun testing! 🚀
