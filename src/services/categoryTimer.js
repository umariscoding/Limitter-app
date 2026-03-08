import { CATEGORY_LIMIT } from './categoryMap';

let categoryTimeS = {
    "Social Media": 0
};

export const incrementCategoryTime = (categoryName) => {
    if (categoryTimeS[categoryName] !== undefined) {
        categoryTimeS[categoryName] += 1;
        return categoryTimeS[categoryName];
    }
    return 0;
};

export const isCategoryBlocked = (categoryName) => {
    return (categoryTimeS[categoryName] || 0) >= CATEGORY_LIMIT;
};

export const getCategoryTime = (categoryName) => {
    return categoryTimeS[categoryName] || 0;
};
