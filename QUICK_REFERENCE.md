## 🎯 QUICK REFERENCE & TROUBLESHOOTING

### **Quick Commands**

```bash
# Install dependencies
npm install
yarn install

# Start dev server
npx react-native run-android
npx react-native run-ios

# Clear cache & rebuild
npx react-native start --reset-cache

# View logs
npx react-native log-android
npx react-native log-ios

# Access MongoDB (example)
mongo "mongodb+srv://user:pass@cluster.mongodb.net/dbname"
```

---

### **File Locations Quick Reference**

```
e:\AppGuard2\
├── App.tsx (✅ UPDATED - Added UserContextProvider)
├── package.json
├── src/
│   ├── App.tsx (Root component)
│   ├── context/
│   │   └── UserContext.tsx (✅ NEW - Global state)
│   ├── screens/
│   │   ├── DashboardScreen.tsx (✅ UPDATED - Real data)
│   │   ├── LoginScreen.tsx (✅ UPDATED - Saves user)
│   │   ├── ConfirmOverrideScreen.tsx (🔴 Needs update)
│   │   ├── SettingsScreen.tsx (🔴 Needs logout)
│   │   └── ... (other screens)
│   ├── services/
│   │   ├── limitService.ts (✅ NEW - API calls)
│   │   └── ... (other services)
│   ├── config/
│   │   └── config.ts (✅ UPDATED - All endpoints)
│   ├── api/
│   │   └── api.js (Already working - unchanged)
│   └── navigation/
│       └── MainNavigator.tsx (No changes needed)
├── TESTING_GUIDE.md (✅ NEW)
├── INTEGRATION_SUMMARY.md (✅ NEW)
└── SCREEN_INTEGRATION_MAP.md (✅ NEW)
```

---

### **Common Errors & Fixes**

#### **Error: "Cannot find module 'UserContext'"**
```
❌ Import path wrong
✅ Fix: import { useUser } from '../context/UserContext';
```

#### **Error: "user is null"**
```
❌ Not logged in yet
✅ Fix: This is normal on LoginScreen. Dashboard checks for user.uid
```

#### **Error: "BASE_URL is not defined"**
```
❌ Didn't import BASE_URL
✅ Fix: import { BASE_URL, API } from '../config/config';
```

#### **Error: "API endpoints not working"**
```
❌ ngrok URL expired/changed
✅ Fix: Update BASE_URL in src/config/config.ts
✅ Check: Backend is running on that URL
✅ Check: Network tab shows actual request to correct URL
```

#### **Error: "Response is not JSON"**
```
❌ Backend returned non-JSON response
✅ Fix: Check backend is returning { success: true, data: {...} }
✅ Check: Content-Type header is application/json
```

#### **Error: "App crashes on Dashboard"**
```
❌ limits = undefined or not array
✅ Fix: Add array check: Array.isArray(response.data) ? ... : []
✅ Check: Backend /api/limits/:uid/:device endpoint returns array
```

---

### **Console Log Patterns**

Look for these in console to debug:

```javascript
// Success logs (green ✅)
✅ Fetched limits: [...]
✅ Create Limit API Response: {...}
✅ Update Usage API Response: {...}
✅ Override API Response: {...}
✅ Login API response: {...}

// Warning logs (yellow ⚠️)
⚠️ No user UID available
⚠️ Failed to fetch limits (but not crashing)

// Error logs (red ❌)
❌ Failed to fetch limits: Error...
❌ Create Limit Error: Error...
❌ Override Error: Error...

// Network errors
TypeError: Network request failed
Error: ... is not a function
Cannot read property 'uid' of null
```

---

### **Testing Checklist (Copy & Paste)**

```
QUICK TEST RUN:

[ ] 1. Start app: npx react-native run-android
[ ] 2. Open DevTools Console
[ ] 3. LoginScreen appears
[ ] 4. Enter test credentials
[ ] 5. Check console: "✅ Login API response"
[ ] 6. Wait for navigation to DashboardScreen
[ ] 7. Check console: "✅ Fetched limits"
[ ] 8. Dashboard shows user stats
[ ] 9. Click + button to create limit
[ ] 10. Enter app name "TestApp"
[ ] 11. Check console: "✅ Create Limit API Response"
[ ] 12. New limit appears on screen
[ ] 13. Pull down to refresh
[ ] 14. Check console: "✅ Fetched limits" (again)
[ ] 15. Click "Use Override" on any limit
[ ] 16. Check console: "✅ Override API Response"
[ ] 17. Return to dashboard
[ ] 18. Limit should show as ACTIVE (unblocked)

ALL TESTS PASSED! ✅
```

---

### **If Limits Are Not Showing:**

1. **Check user.uid is valid**
   ```typescript
   // In DashboardScreen useEffect
   console.log('User UID:', user?.uid);
   ```

2. **Check device_id parameter**
   ```typescript
   // Currently hardcoded
   const defaultDeviceId = 'device_001';
   // Make sure backend has limits for this device
   ```

3. **Check backend endpoint**
   ```
   GET http://your-base-url/api/limits/YOUR_UID/device_001
   Should return: { success: true, data: [...] }
   ```

4. **Check response format**
   ```javascript
   // If backend returns different format:
   // { limits: [...] } instead of { data: [...] }
   // Update limitService.ts response parsing
   ```

5. **Check network tab**
   ```
   Open DevTools → Network
   Filter: XHR/Fetch
   Look for: /api/limits/... request
   Check: Status 200, Response body shows data
   ```

---

### **Debugging Tips**

**1. Add console logs to track flow:**
```typescript
console.log('1. User logged in:', user);
console.log('2. About to fetch limits');
const response = await getLimitsAPI(user.uid, deviceId);
console.log('3. Limits response:', response);
console.log('4. Setting limits:', response.data);
setLimits(response.data);
```

**2. Use React DevTools to inspect state:**
```
Open Component Tree
Navigate to DashboardScreen
Check "limits" state value
Check "user" from UserContext
```

**3. Simulate slow network:**
```
DevTools → Network
Throttling → Slow 3G
Observe loading state behavior
```

**4. Test different scenarios:**
```
Scenario A: No user logged in → Should show loading state
Scenario B: User logged in, no limits → Should show empty state
Scenario C: User logged in, has limits → Should show limits
```

---

### **Backend Integration Checklist**

Before testing, ensure backend has:

```
✅ /api/auth/login endpoint working
✅ /api/auth/signup endpoint working
✅ /api/limits/create endpoint working
✅ /api/limits/update-usage endpoint working
✅ /api/limits/override endpoint working
✅ GET /api/limits/:user_id/:device_id endpoint working
✅ All endpoints return { success: true, data: {...} }
✅ CORS enabled for your ngrok URL
✅ MongoDB connection working
✅ Firebase Auth configured (if using)
```

---

### **Performance Tips**

1. **Avoid refetching on every render**
   ```typescript
   ✅ We use: useFocusEffect() - only fetches when screen comes into focus
   ✅ NOT: useEffect() with user.uid - causes issues
   ```

2. **Implement pagination for large datasets**
   ```typescript
   // If user has 100s of limits:
   GET /api/limits/:user_id/:device_id?page=1&limit=20
   ```

3. **Cache limits locally**
   ```typescript
   // Store in AsyncStorage before making API call
   // Show cached data immediately
   // Update with fresh data from backend
   ```

4. **Use FlatList for large lists**
   ```typescript
   // Current: Rendered inside ScrollView (fine for < 50 items)
   // Future: Replace with FlatList for 100+ items
   ```

---

### **Security Considerations**

1. **Never store password locally**
   ```typescript
   ✅ Store only: idToken or JWT token
   ❌ Never store: password
   ```

2. **Use HTTPS/ngrok (you're using ngrok ✅)**
   ```
   ✅ All API calls are over HTTPS
   ```

3. **Validate user.uid before API calls**
   ```typescript
   ✅ Dashboard checks: if (!user?.uid) return;
   ```

4. **Store sensitive tokens securely**
   ```typescript
   // Future enhancement:
   import AsyncStorage from '@react-native-async-storage/async-storage';
   await AsyncStorage.setItem('idToken', user.idToken);
   ```

---

### **Version Compatibility**

```
React Native: 0.71+
React Navigation: 6.x
TypeScript: 4.8+
Node: 16+
```

To check your versions:
```bash
node --version
npm --version
npx react-native --version
```

---

### **Still Stuck?**

1. **Check TESTING_GUIDE.md** - Step-by-step walkthrough
2. **Check INTEGRATION_SUMMARY.md** - What changed and why
3. **Check SCREEN_INTEGRATION_MAP.md** - How screens connect
4. **Check console logs** - All API calls are logged with emojis
5. **Check Network tab** - See actual HTTP requests
6. **Check backend logs** - Is backend receiving requests?

---

### **Contact/Support Checklist**

If asking for help, provide:
- [ ] Console error message (exact text)
- [ ] Screenshot of DevTools Network tab
- [ ] Backend logs showing API request
- [ ] What you were trying to do
- [ ] Which step of TESTING_GUIDE failed

Good luck! 🚀
