export async function getFilePreview(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/preview', { method: 'POST', body: formData });
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

    const response = await fetch('/api/process', { method: 'POST', body: formData });
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
