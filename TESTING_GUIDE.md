## 🚀 TESTING GUIDE - Real-Time Dashboard with Backend Integration

Thanks for your patience! Here's **how the app now works end-to-end** with your backend APIs:

---

## **Architecture Changes**

```
App.tsx (Now wrapped with UserContextProvider)
  ↓
MainNavigator
  ├─ LoginScreen → Saves user data to UserContext
  └─ DashboardScreen → Uses real backend data
       ├─ Fetches limits from /api/limits/:user_id/:device_id
       ├─ Creates limits via /api/limits/create
       ├─ Updates usage via /api/limits/update-usage
       └─ Uses overrides via /api/limits/override
```

---

## **Step-by-Step Testing**

### **1️⃣ UPDATE YOUR BACKEND ngrok URL**

If your ngrok URL changes, update it in:
```
src/config/config.ts

export const BASE_URL = 'your-new-ngrok-url-here';
```

### **2️⃣ START THE APP**

```bash
npx react-native run-android
# or
npx react-native run-ios
```

### **3️⃣ LOGIN FLOW**

1. **LoginScreen** appears
2. Enter your test credentials (from backend auth)
3. Click "Login"
4. Backend validates credentials via `/api/auth/login`
5. **UserContext saves**: `uid`, `email`, `name`, `plan`, `overrides_left`
6. App navigates to **DashboardScreen** automatically

✅ **Check the console for**: `✅ Login API response:`

---

### **4️⃣ DASHBOARD DISPLAYS REAL DATA**

Once logged in, **DashboardScreen automatically**:

1. **Fetches** all limits for the user via:
   ```
   GET /api/limits/:user_id/:device_id
   ```

2. **Displays**:
   - User plan (Free/Medium/Pro)
   - Overrides left (from user.overrides_left)
   - Total usage today (calculated from all limits)
   - List of active limits with progress bars
   - Status badges (ACTIVE/BLOCKED)

3. **Shows Empty State** if no limits exist yet

✅ **Check console for**: `✅ Fetched limits:`

---

### **5️⃣ CREATE A NEW LIMIT**

**Click the "+" button** on Dashboard:

1. **Prompt appears**: "Enter app name:"
2. Type app name (e.g., "Instagram", "TikTok")
3. Click "Create"
4. Backend creates limit via:
   ```
   POST /api/limits/create
   Body: {
     user_id: "uid_from_login",
     device_id: "device_001",
     max_time_minutes: 60,
     app_name: "Instagram"
   }
   ```

5. **Dashboard auto-refreshes** and shows new limit

✅ **Check console for**: `✅ Create Limit API Response:`

---

### **6️⃣ UPDATE USAGE (SIMULATE WATCHING)**

**On any limit card, click** any button → Auto-updates progress

Backend updates via:
```
POST /api/limits/update-usage
Body: {
  limit_id: "limit_id_from_limit",
  minutes_to_add: 15
}
```

Progress bar updates in real-time.

✅ **Check console for**: `✅ Update Usage API Response:`

---

### **7️⃣ USE OVERRIDE (UNBLOCK A LIMIT)**

**When a limit is BLOCKED**, click "Use Override":

1. Opens **ConfirmOverrideScreen**
2. Click confirm → Backend calls:
   ```
   POST /api/limits/override
   Body: {
     user_id: "user_uid",
     device_id: "device_001",
     limit_id: "limit_id"
   }
   ```

3. **Backend returns**: `{ overrides_left: N, message: "..." }`
4. Limit is unblocked, progress resets to 0

✅ **Check console for**: `✅ Override API Response:`

---

### **8️⃣ PULL-TO-REFRESH**

**Pull down on Dashboard** to refresh limits manually

Fetches latest data from backend.

---

## **Console Logging (For Debugging)**

All API calls are logged with emojis for easy tracking:

```
✅ Fetched limits: [...]
✅ Create Limit API Response: {...}
✅ Update Usage API Response: {...}
✅ Override API Response: {...}
❌ Failed to fetch limits: Error...
⚠️ No user UID available
```

**Open DevTools → Console to see these logs**

---

## **Important Variables**

### **Backend Device ID**
Currently hardcoded as:
```typescript
const defaultDeviceId = 'device_001';
```

**To use real device IDs:**
1. Add device registration to your backend
2. Store device_id locally (AsyncStorage)
3. Update the dashboard to use real stored `device_id`

---

## **Error Handling**

All screens handle errors gracefully:

- **No user logged in** → Shows loading state
- **Backend error** → Shows Alert + returns empty state
- **Network error** → Toast notification + logs error

---

## **Real-Time Updates**

**Dashboard automatically refreshes when:**
1. ✅ Screen comes back into focus (useFocusEffect)
2. ✅ Pull-to-refresh triggered
3. ✅ After creating/updating/deleting a limit

**No manual refresh needed!**

---

## **Next Steps (Optional Enhancements)**

### **1. Store auth token for offline access**
```typescript
// In UserContext, add:
const [token, setToken] = useState<string | null>(null);
// Store in AsyncStorage
```

### **2. Add device management**
```typescript
// Get list of devices at login
// Let users switch between devices
// Each device has its own limits
```

### **3. Real-time updates with WebSocket**
```typescript
// Subscribe to limit changes
// Get instant notifications when limits change
```

### **4. Analytics screen integration**
```typescript
// Pull usage data from /api/limits endpoint
// Display time breakdown by app/category
```

---

## **Testing Checklist**

- [ ] Login with valid credentials
- [ ] Dashboard loads and shows user info
- [ ] Create a new limit
- [ ] See new limit appear on dashboard
- [ ] Simulate usage (update-usage API)
- [ ] See progress bar update
- [ ] Block a limit (usage >= max)
- [ ] Use override to unblock
- [ ] Pull-to-refresh works
- [ ] Navigate to other screens
- [ ] Return to dashboard (auto-refetches)
- [ ] Logout from settings

---

## **API Response Expected Format**

Your backend should return:

```javascript
// Create Limit
{ 
  success: true, 
  data: { id, user_id, device_id, app_name, max_time_minutes, time_used_minutes, is_blocked, ... }
}

// Get Limits
{ 
  success: true, 
  data: [ { id, user_id, ... }, ... ]
}

// Update Usage
{ 
  success: true, 
  data: { limit: { ... time_used_minutes updated ... }, justBlocked: boolean }
}

// Override
{ 
  success: true, 
  data: { overrides_left: N, message: "..." }
}
```

If your format is different, update `src/services/limitService.ts` response handling.

---

## **Questions?**

Check console.log outputs - all API responses are logged there for debugging.

Happy testing! 🎉
