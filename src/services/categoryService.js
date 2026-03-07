import { NativeModules, NativeEventEmitter } from 'react-native';
import { categoryMap } from './categoryMap';
import { incrementCategoryTime, isCategoryBlocked } from './categoryTimer';

const { CategoryTrackerModule } = NativeModules;
const eventEmitter = new NativeEventEmitter(CategoryTrackerModule);

let currentItem = null;
let timerInterval = null;

export const startCategoryService = () => {
    if (!CategoryTrackerModule) {
        console.error("CategoryTrackerModule not found. Ensure Native code is integrated.");
        return;
    }

    CategoryTrackerModule.startTracking();

    eventEmitter.addListener('onForegroundChange', (event) => {
        const { packageName, url } = event;

        let detectedItem = null;
        if (url && (packageName === 'com.android.chrome' || packageName === 'com.microsoft.emmx')) {
            for (const key in categoryMap) {
                if (url.includes(key)) {
                    detectedItem = key;
                    break;
                }
            }
        }

        if (!detectedItem && categoryMap[packageName]) {
            detectedItem = packageName;
        }

        if (detectedItem !== currentItem) {
            currentItem = detectedItem;
            handleTimerUpdate();
        }
    });

    console.log("[CategoryTracker] Service Initialized");
};

const handleTimerUpdate = () => {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    const category = currentItem ? categoryMap[currentItem] : null;

    if (category) {
        console.log(`[CategoryTracker] Current foreground detected in category: ${category}`);

        // If already blocked, trigger immediate overlay
        if (isCategoryBlocked(category)) {
            console.log(`[CategoryTracker] ${category} is already blocked! Triggering blocking overlay.`);
            CategoryTrackerModule.triggerBlock(category);
            return;
        }

        timerInterval = setInterval(() => {
            const currentTime = incrementCategoryTime(category);
            console.log(`[CategoryTracker] Category Total: ${currentTime}s`);

            if (isCategoryBlocked(category)) {
                console.log(`[CategoryTracker] Limit reached for ${category}!`);
                CategoryTrackerModule.triggerBlock(category);
                clearInterval(timerInterval);
                timerInterval = null;
            }
        }, 1000);
    }
};
