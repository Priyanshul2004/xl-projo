const STORAGE_KEY = 'excelMappingConfigs';
const USER_NAME_KEY = 'excelMappingUserName';
const EXPIRY_DAYS = 30;
const EXPIRY_MS = EXPIRY_DAYS * 24 * 60 * 60 * 1000;

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const cleanExpiredMappings = (mappings) => {
    const now = Date.now();
    return mappings.filter((mapping) => !mapping.expiresAt || mapping.expiresAt > now);
};

const loadStoredData = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    try {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return [];
        return cleanExpiredMappings(parsed);
    } catch (error) {
        console.error('Error parsing saved mappings:', error);
        localStorage.removeItem(STORAGE_KEY);
        return [];
    }
};

const saveStoredData = (mappings) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
};

export const getSavedMappingsFromStorage = () => {
    const mappings = loadStoredData();
    saveStoredData(mappings);
    return mappings;
};

export const saveMappingToStorage = (mappingData, name) => {
    const now = Date.now();
    const newMapping = {
        id: makeId(),
        name,
        timestamp: now,
        expiresAt: now + EXPIRY_MS,
        sourceKeyField: mappingData.sourceKeyField,
        templateKeyField: mappingData.templateKeyField,
        fieldMappings: mappingData.fieldMappings,
        sourceColumns: mappingData.sourceColumns,
        templateColumns: mappingData.templateColumns
    };

    const existing = loadStoredData();
    const updated = [newMapping, ...existing.filter((item) => item.id !== newMapping.id)];
    saveStoredData(updated);
    return newMapping;
};

export const deleteMappingFromStorage = (mappingId) => {
    const mappings = loadStoredData().filter((mapping) => mapping.id !== mappingId);
    saveStoredData(mappings);
};

export const loadMappingFromStorage = (mappingId) => {
    const mappings = loadStoredData();
    if (!mappings.length) return null;
    if (!mappingId) return mappings[0];
    return mappings.find((mapping) => mapping.id === mappingId) || null;
};

export const getMappingExpiryInfo = (mapping) => {
    if (!mapping || !mapping.expiresAt) return null;
    const expiresAt = new Date(mapping.expiresAt);
    const daysLeft = Math.ceil((mapping.expiresAt - Date.now()) / EXPIRY_MS * EXPIRY_DAYS);
    return {
        savedAt: new Date(mapping.timestamp),
        expiresAt,
        daysLeft
    };
};

export const saveUserNameToStorage = (name) => {
    localStorage.setItem(USER_NAME_KEY, JSON.stringify({ name, savedAt: Date.now() }));
};

export const loadUserNameFromStorage = () => {
    const stored = localStorage.getItem(USER_NAME_KEY);
    if (!stored) return null;

    try {
        const parsed = JSON.parse(stored);
        return parsed?.name || null;
    } catch (error) {
        localStorage.removeItem(USER_NAME_KEY);
        return null;
    }
};
