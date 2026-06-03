const BACKEND_CONNECTION_ERROR = 'Cannot connect to backend API. Please make sure backend server is running.';

async function safeFetch(url, options) {
    try {
        return await fetch(url, options);
    } catch (error) {
        throw new Error(BACKEND_CONNECTION_ERROR);
    }
}

export async function getFilePreview(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await safeFetch('/api/preview', { method: 'POST', body: formData });
    if (!response.ok) throw new Error('Failed to get file preview');
    return response.json();
}

export async function processMapping(payload) {
    const formData = new FormData();
    formData.append('sourceFile', payload.sourceFile);
    formData.append('templateFile', payload.templateFile);
    formData.append('keyField', payload.keyField);
    formData.append('templateKeyField', payload.templateKeyField);
    formData.append('fieldMappings', JSON.stringify(payload.fieldMappings));

    const response = await safeFetch('/api/process', { method: 'POST', body: formData });
    if (!response.ok) {
        let message = 'Processing failed';
        try {
            const err = await response.json();
            message = err.error || message;
        } catch {
            message = response.statusText || message;
        }
        throw new Error(message);
    }

    return response.json();
}

export async function saveMapping(mappingData) {
    const response = await safeFetch('/api/mapping/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mappingData)
    });

    if (!response.ok) {
        let message = 'Failed to save mapping';
        try {
            const err = await response.json();
            message = err.error || message;
        } catch {
            message = response.statusText || message;
        }
        throw new Error(message);
    }

    return response.json();
}

export async function getSavedMappings() {
    const response = await safeFetch('/api/mapping/list', { method: 'GET' });
    if (!response.ok) throw new Error('Failed to fetch saved mappings');
    return response.json();
}

export async function deleteMapping(mappingId) {
    const response = await safeFetch(`/api/mapping/${mappingId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete mapping');
    return response.json();
}
