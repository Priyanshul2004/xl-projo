export class ExcelMappingApp {
    constructor() {
        this.sourceFile = null;
        this.templateFile = null;
        this.sourceColumns = [];
        this.templateColumns = [];
        this.fieldMappings = [];

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.setupFileUpload('sourceFile', 'sourceDropZone', 'sourceFileInfo', (file) => {
            this.sourceFile = file;
            this.checkFilesReady();
        });

        this.setupFileUpload('templateFile', 'templateDropZone', 'templateFileInfo', (file) => {
            this.templateFile = file;
            this.checkFilesReady();
        });

        document.getElementById('analyzeFilesBtn').addEventListener('click', () => this.analyzeFiles());
        document.getElementById('addMappingBtn').addEventListener('click', () => this.addMappingField());
        document.getElementById('processFilesBtn').addEventListener('click', () => this.processFiles());
        document.getElementById('backToUploadBtn').addEventListener('click', () => this.goToStep(1));
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadFile());
        document.getElementById('startOverBtn').addEventListener('click', () => this.startOver());
        document.getElementById('sourceKeyField').addEventListener('change', () => this.updateMappingOptions());

        document.getElementById('fieldMappings').addEventListener('click', (event) => {
            const button = event.target.closest('.remove-mapping-btn');
            if (!button) return;
            const index = Number(button.getAttribute('data-index'));
            this.removeMapping(index);
        });
    }

    setupFileUpload(inputId, dropZoneId, infoId, callback) {
        const input = document.getElementById(inputId);
        const dropZone = document.getElementById(dropZoneId);

        dropZone.addEventListener('click', () => input.click());

        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelect(e.target.files[0], infoId, callback);
            }
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                this.handleFileSelect(e.dataTransfer.files[0], infoId, callback);
            }
        });
    }

    handleFileSelect(file, infoId, callback) {
        const isSourceUpload = infoId === 'sourceFileInfo';
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/octet-stream',
            'text/csv',
            'application/csv'
        ];
        const validExtensions = isSourceUpload ? ['.xlsx', '.xls', '.csv'] : ['.xlsx', '.xls'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
            const allowedText = isSourceUpload
                ? 'Please select a valid file (.xlsx, .xls, or .csv) for source'
                : 'Please select a valid Excel file (.xlsx or .xls) for template';
            this.showError(infoId, allowedText);
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            this.showError(infoId, 'File size must be less than 10MB');
            return;
        }

        this.showFileInfo(infoId, file);
        callback(file);
    }

    showFileInfo(elementId, file) {
        const element = document.getElementById(elementId);
        element.innerHTML = `<div class="file-info"><strong>Selected:</strong> ${file.name}<br><strong>Size:</strong> ${this.formatFileSize(file.size)}<br><strong>Type:</strong> ${file.type || 'Excel file'}</div>`;
    }

    showError(elementId, message) {
        const element = document.getElementById(elementId);
        element.innerHTML = `<div class="error-message">${message}</div>`;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    normalizeColumnName(name) {
        return String(name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    findBestTemplateKeyForSource(sourceColumn) {
        if (!sourceColumn) return null;
        if (this.templateColumns.includes(sourceColumn)) return sourceColumn;
        const normalizedSource = this.normalizeColumnName(sourceColumn);
        return this.templateColumns.find((col) => this.normalizeColumnName(col) === normalizedSource) || null;
    }

    checkFilesReady() {
        document.getElementById('analyzeFilesBtn').disabled = !(this.sourceFile && this.templateFile);
    }

    async analyzeFiles() {
        this.showLoading('Analyzing files...');
        try {
            const [sourcePreview, templatePreview] = await Promise.all([
                this.getFilePreview(this.sourceFile),
                this.getFilePreview(this.templateFile)
            ]);
            this.sourceColumns = sourcePreview.columns;
            this.templateColumns = templatePreview.columns;
            this.setupMappingInterface();
            this.goToStep(2);
            this.hideLoading();
        } catch (error) {
            this.hideLoading();
            this.showGlobalError('Failed to analyze files: ' + error.message);
        }
    }

    async getFilePreview(file) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/preview', { method: 'POST', body: formData });
        if (!response.ok) throw new Error('Failed to get file preview');
        return await response.json();
    }

    setupMappingInterface() {
        const sourceKeyFieldSelect = document.getElementById('sourceKeyField');
        sourceKeyFieldSelect.innerHTML = '<option value="">Select source key column...</option>';
        this.sourceColumns.forEach((column) => {
            const option = document.createElement('option');
            option.value = column;
            option.textContent = column;
            sourceKeyFieldSelect.appendChild(option);
        });

        const templateKeyFieldSelect = document.getElementById('templateKeyField');
        templateKeyFieldSelect.innerHTML = '<option value="">Select template key column...</option>';
        this.templateColumns.forEach((column) => {
            const option = document.createElement('option');
            option.value = column;
            option.textContent = column;
            templateKeyFieldSelect.appendChild(option);
        });

        const defaultSourceKey = this.sourceColumns[0] || '';
        if (defaultSourceKey) {
            sourceKeyFieldSelect.value = defaultSourceKey;
            const matchedTemplateKey = this.findBestTemplateKeyForSource(defaultSourceKey);
            if (matchedTemplateKey) templateKeyFieldSelect.value = matchedTemplateKey;
        }

        this.detectCampaignMapping();
        if (this.fieldMappings.length === 0) this.addMappingField();
    }

    detectCampaignMapping() {
        const campaignMapping = {
            campaign_name: 'Campaign Name',
            delivered: 'Count',
            opened: 'Open',
            clicked: 'Clicks',
            unsubscribed: 'Unsub',
            bounced: 'Bounces'
        };

        const hasCampaignName = this.sourceColumns.includes('campaign_name') && this.templateColumns.includes('Campaign Name');
        const hasCampaignMetrics = ['delivered', 'opened', 'clicked', 'unsubscribed', 'bounced'].some((col) => this.sourceColumns.includes(col));
        if (!hasCampaignName || !hasCampaignMetrics) return;

        document.getElementById('sourceKeyField').value = 'campaign_name';
        document.getElementById('templateKeyField').value = 'Campaign Name';
        document.getElementById('fieldMappings').innerHTML = '';
        this.fieldMappings = [];

        Object.entries(campaignMapping).forEach(([source, target]) => {
            if (this.sourceColumns.includes(source) && this.templateColumns.includes(target)) {
                this.addMappingField(source, target);
            }
        });
        this.showMappingNotification('Campaign data detected! Field mappings have been auto-configured.');
    }

    showMappingNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'success-message';
        notification.textContent = message;
        notification.style.marginBottom = '20px';
        const mappingSection = document.getElementById('mappingSection');
        mappingSection.insertBefore(notification, mappingSection.firstChild);
        setTimeout(() => notification.remove(), 5000);
    }

    addMappingField(preselectedSource = '', preselectedTarget = '') {
        const mappingsContainer = document.getElementById('fieldMappings');
        const mappingIndex = this.fieldMappings.length;
        const mappingDiv = document.createElement('div');
        mappingDiv.className = 'field-mapping';
        mappingDiv.innerHTML = `
            <select class="source-field" data-index="${mappingIndex}">
                <option value="">Select source field...</option>
            </select>
            <span>-></span>
            <select class="target-field" data-index="${mappingIndex}">
                <option value="">Select template field...</option>
            </select>
            <button type="button" class="btn btn-danger remove-mapping-btn" data-index="${mappingIndex}">Remove</button>
        `;
        mappingsContainer.appendChild(mappingDiv);

        const sourceSelect = mappingDiv.querySelector('.source-field');
        const targetSelect = mappingDiv.querySelector('.target-field');
        this.sourceColumns.forEach((column) => {
            const option = document.createElement('option');
            option.value = column;
            option.textContent = column;
            sourceSelect.appendChild(option);
        });
        this.templateColumns.forEach((column) => {
            const option = document.createElement('option');
            option.value = column;
            option.textContent = column;
            targetSelect.appendChild(option);
        });
        if (preselectedSource) sourceSelect.value = preselectedSource;
        if (preselectedTarget) targetSelect.value = preselectedTarget;
        this.fieldMappings.push({ source: preselectedSource, target: preselectedTarget });
    }

    removeMapping(index) {
        const sourceEl = document.querySelector(`.source-field[data-index="${index}"]`);
        if (!sourceEl || !sourceEl.parentElement) return;
        sourceEl.parentElement.remove();
        this.fieldMappings.splice(index, 1);
        document.querySelectorAll('.field-mapping').forEach((div, newIndex) => {
            div.querySelector('.source-field')?.setAttribute('data-index', newIndex);
            div.querySelector('.target-field')?.setAttribute('data-index', newIndex);
            div.querySelector('.remove-mapping-btn')?.setAttribute('data-index', newIndex);
        });
    }

    updateMappingOptions() {}

    async processFiles() {
        const sourceKeyField = document.getElementById('sourceKeyField').value;
        const templateKeyField = document.getElementById('templateKeyField').value;
        if (!sourceKeyField) return this.showGlobalError('Please select a source key column for matching');
        if (!templateKeyField) return this.showGlobalError('Please select a template key column for matching');

        const mappings = [];
        document.querySelectorAll('.field-mapping').forEach((div) => {
            const sourceField = div.querySelector('.source-field').value;
            const targetField = div.querySelector('.target-field').value;
            if (sourceField && targetField) mappings.push({ source: sourceField, target: targetField });
        });
        if (mappings.length === 0) return this.showGlobalError('Please add at least one field mapping');

        this.goToStep(3);
        this.showProgress(0);

        try {
            const formData = new FormData();
            formData.append('sourceFile', this.sourceFile);
            formData.append('templateFile', this.templateFile);
            formData.append('keyField', sourceKeyField);
            formData.append('templateKeyField', templateKeyField);
            formData.append('fieldMappings', JSON.stringify(mappings));

            this.showProgress(30);
            this.updateProgressMessage('Uploading files...');
            const response = await fetch('/api/process', { method: 'POST', body: formData });
            this.showProgress(60);
            this.updateProgressMessage('Processing data...');
            if (!response.ok) {
                let msg = 'Processing failed';
                try {
                    const err = await response.json();
                    msg = err.error || msg;
                } catch {
                    msg = response.statusText || msg;
                }
                throw new Error(msg);
            }
            const result = await response.json();
            this.showProgress(100);
            this.updateProgressMessage('Processing complete!');
            setTimeout(() => {
                this.hideProgress();
                this.showResults(result);
            }, 1000);
        } catch (error) {
            this.hideProgress();
            this.goToStep(2);
            this.showGlobalError('Processing failed: ' + error.message);
        }
    }

    showProgress(percent) {
        document.getElementById('progressBar').classList.add('active');
        const progressFill = document.getElementById('progressFill');
        progressFill.style.width = percent + '%';
        progressFill.textContent = percent + '%';
    }

    updateProgressMessage(message) {
        document.getElementById('processingMessage').innerHTML = `<div class="processing-status">${message}</div>`;
    }

    hideProgress() {
        document.getElementById('progressBar').classList.remove('active');
        document.getElementById('processingMessage').innerHTML = '';
    }

    showResults(result) {
        document.getElementById('stats').innerHTML = `
            <div class="stat-card"><div class="stat-number">${result.stats.totalRowsScanned}</div><div class="stat-label">Rows scanned</div></div>
            <div class="stat-card"><div class="stat-number">${result.stats.matchedRecords}</div><div class="stat-label">Matched rows</div></div>
            <div class="stat-card"><div class="stat-number">${result.stats.updatedCells}</div><div class="stat-label">Values written</div></div>
        `;
        this.downloadUrl = result.downloadUrl;
        document.getElementById('resultSection').classList.add('active');
    }

    downloadFile() {
        if (this.downloadUrl) window.open(this.downloadUrl, '_blank');
    }

    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const text = document.getElementById('loadingOverlayText');
        overlay?.classList.add('active');
        overlay?.setAttribute('aria-hidden', 'false');
        if (text) text.textContent = message;
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        overlay?.classList.remove('active');
        overlay?.setAttribute('aria-hidden', 'true');
    }

    showGlobalError(message) {
        let errorDiv = document.getElementById('globalError');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'globalError';
            errorDiv.className = 'error-message';
            document.querySelector('.main-content').insertBefore(errorDiv, document.querySelector('.main-content').firstChild);
        }
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    goToStep(stepNumber) {
        document.querySelectorAll('.step').forEach((step) => step.classList.remove('active'));
        document.getElementById(`step${stepNumber}`).classList.add('active');
        const mappingSection = document.getElementById('mappingSection');
        if (mappingSection) {
            if (stepNumber === 2) mappingSection.classList.add('active');
            else mappingSection.classList.remove('active');
        }
    }

    startOver() {
        this.sourceFile = null;
        this.templateFile = null;
        this.sourceColumns = [];
        this.templateColumns = [];
        this.fieldMappings = [];
        this.downloadUrl = null;

        document.getElementById('sourceFileInfo').innerHTML = '';
        document.getElementById('templateFileInfo').innerHTML = '';
        document.getElementById('fieldMappings').innerHTML = '';
        document.getElementById('resultSection').classList.remove('active');

        const globalError = document.getElementById('globalError');
        if (globalError) globalError.style.display = 'none';

        document.getElementById('sourceFile').value = '';
        document.getElementById('templateFile').value = '';
        this.goToStep(1);
        this.checkFilesReady();
    }
}
