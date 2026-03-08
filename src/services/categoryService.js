import { NativeModules, NativeEventEmitter } from 'react-native';
import { categoryMap } from './categoryMap';
import { incrementCategoryTime, isCategoryBlocked } from './categoryTimer';

const { CategoryTrackerModule } = NativeModules;
const eventEmitter = new NativeEventEmitter(CategoryTrackerModule);

let currentItem = null;
let timerInterval = null;

export const startCategoryService = () => {
    if (!CategoryTrackerModule) {
        console.error("CategoryTrackerModule not found.");
        return;
    }

    CategoryTrackerModule.startTracking();

    // Check status every 5 seconds
    setInterval(async () => {
        try {
            const isEnabled = await CategoryTrackerModule.isServiceEnabled();
            if (!isEnabled) {
                CategoryTrackerModule.logToNative("⚠️ ACCESSIBILITY SERVICE IS OFF - Please enable it in Settings!");
            } else {
                CategoryTrackerModule.logToNative("✅ Service Status: ENABLED");
            }
        } catch (e) { }
    }, 5000);

    eventEmitter.addListener('onForegroundChange', (event) => {
        const { packageName, url } = event;

        CategoryTrackerModule.logToNative(`[JS] Detecting: Pkg=${packageName}, URL=${url}`);

        let detectedItem = null;

        // 1. Check URL first (if in browser)
        if (url && (packageName === 'com.android.chrome' || packageName === 'com.microsoft.emmx')) {
            for (const key in categoryMap) {
                // Check if the key is a domain (doesn't contain com.)
                if (!key.startsWith('com.') && url.toLowerCase().includes(key.toLowerCase())) {
                    detectedItem = key;
                    break;
                }
            }
        }

        // 2. If no URL match, check package name
        if (!detectedItem && categoryMap[packageName]) {
            detectedItem = packageName;
        }

        if (detectedItem !== currentItem) {
            CategoryTrackerModule.logToNative(`[JS] Switch: ${currentItem} -> ${detectedItem}`);
            currentItem = detectedItem;
            handleTimerUpdate();
        }
    });

    CategoryTrackerModule.logToNative("[JS] Category Service Initialized");
};

const handleTimerUpdate = () => {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    const category = currentItem ? categoryMap[currentItem] : null;

    if (category) {
        CategoryTrackerModule.logToNative(`Active tracking for category: ${category}`);

        if (isCategoryBlocked(category)) {
            CategoryTrackerModule.logToNative(`Category ${category} is ALREADY blocked.`);
            CategoryTrackerModule.triggerBlock(category);
            return;
        }

        timerInterval = setInterval(() => {
            const currentTime = incrementCategoryTime(category);
            CategoryTrackerModule.logToNative(`Time for ${category}: ${currentTime}s`);

            if (isCategoryBlocked(category)) {
                CategoryTrackerModule.logToNative(`Limit REACHED for ${category}. Triggering block.`);
                CategoryTrackerModule.triggerBlock(category);
                clearInterval(timerInterval);
                timerInterval = null;
            }
        }, 1000);
    } else {
        CategoryTrackerModule.logToNative("No tracked item in foreground. Timer cleared.");
    }
};
