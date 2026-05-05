class ExcelMappingApp {
    constructor() {
        this.sourceFile = null;
        this.templateFile = null;
        this.sourceColumns = [];
        this.templateColumns = [];
        this.fieldMappings = [];
        this.keyFieldPairs = new Map();
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // File upload events
        this.setupFileUpload('sourceFile', 'sourceDropZone', 'sourceFileInfo', (file) => {
            this.sourceFile = file;
            this.checkFilesReady();
        });

        this.setupFileUpload('templateFile', 'templateDropZone', 'templateFileInfo', (file) => {
            this.templateFile = file;
            this.checkFilesReady();
        });

        // Button events
        document.getElementById('analyzeFilesBtn').addEventListener('click', () => this.analyzeFiles());
        document.getElementById('addMappingBtn').addEventListener('click', () => this.addMappingField());
        document.getElementById('processFilesBtn').addEventListener('click', () => this.processFiles());
        document.getElementById('backToUploadBtn').addEventListener('click', () => this.goToStep(1));
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadFile());
        document.getElementById('startOverBtn').addEventListener('click', () => this.startOver());

        // Key field change event
        document.getElementById('keyField').addEventListener('change', () => this.updateMappingOptions());
    }

    setupFileUpload(inputId, dropZoneId, infoId, callback) {
        const input = document.getElementById(inputId);
        const dropZone = document.getElementById(dropZoneId);

        // Click to upload
        dropZone.addEventListener('click', () => input.click());

        // File input change
        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelect(e.target.files[0], infoId, callback);
            }
        });

        // Drag and drop
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
        // Validate file type
        const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
                           'application/vnd.ms-excel'];
        const validExtensions = ['.xlsx', '.xls'];
        
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
            this.showError(infoId, 'Please select a valid Excel file (.xlsx or .xls)');
            return;
        }

        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            this.showError(infoId, 'File size must be less than 10MB');
            return;
        }

        this.showFileInfo(infoId, file);
        callback(file);
    }

    showFileInfo(elementId, file) {
        const element = document.getElementById(elementId);
        element.innerHTML = `
            <div class="file-info">
                <strong>Selected:</strong> ${file.name}<br>
                <strong>Size:</strong> ${this.formatFileSize(file.size)}<br>
                <strong>Type:</strong> ${file.type || 'Excel file'}
            </div>
        `;
    }

    showError(elementId, message) {
        const element = document.getElementById(elementId);
        element.innerHTML = `
            <div class="error-message">
                ${message}
            </div>
        `;
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
        if (this.templateColumns.includes(sourceColumn)) {
            return sourceColumn;
        }
        const normalizedSource = this.normalizeColumnName(sourceColumn);
        return this.templateColumns.find(col => this.normalizeColumnName(col) === normalizedSource) || null;
    }

    checkFilesReady() {
        const analyzeBtn = document.getElementById('analyzeFilesBtn');
        if (this.sourceFile && this.templateFile) {
            analyzeBtn.disabled = false;
        } else {
            analyzeBtn.disabled = true;
        }
    }

    async analyzeFiles() {
        this.showLoading('Analyzing files...');
        
        try {
            // Get file previews for both files
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

        const response = await fetch('/api/preview', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Failed to get file preview');
        }

        return await response.json();
    }

    setupMappingInterface() {
        // Setup key field dropdown
        const keyFieldSelect = document.getElementById('keyField');
        keyFieldSelect.innerHTML = '<option value="">Select key field...</option>';
        this.keyFieldPairs.clear();

        const keyOptions = [];
        const seenSourceColumns = new Set();

        // Exact matches first
        this.sourceColumns.forEach(sourceCol => {
            if (this.templateColumns.includes(sourceCol)) {
                keyOptions.push({
                    source: sourceCol,
                    template: sourceCol,
                    label: sourceCol
                });
                seenSourceColumns.add(sourceCol);
            }
        });

        // Fuzzy matches (campaign_name -> Campaign Name)
        this.sourceColumns.forEach(sourceCol => {
            if (seenSourceColumns.has(sourceCol)) return;
            const matchedTemplate = this.findBestTemplateKeyForSource(sourceCol);
            if (matchedTemplate) {
                keyOptions.push({
                    source: sourceCol,
                    template: matchedTemplate,
                    label: sourceCol === matchedTemplate ? sourceCol : `${sourceCol} -> ${matchedTemplate}`
                });
                seenSourceColumns.add(sourceCol);
            }
        });

        // Fallback so dropdown is never empty
        if (keyOptions.length === 0) {
            this.sourceColumns.forEach(sourceCol => {
                keyOptions.push({
                    source: sourceCol,
                    template: null,
                    label: sourceCol
                });
            });
            this.showMappingNotification('No direct key match found. Select a source key column and map its template equivalent.');
        }

        keyOptions.forEach(optionData => {
            const option = document.createElement('option');
            option.value = optionData.source;
            option.textContent = optionData.label;
            keyFieldSelect.appendChild(option);
            this.keyFieldPairs.set(optionData.source, optionData.template);
        });

        // Auto-detect campaign data mapping
        this.detectCampaignMapping();

        // Add initial mapping field only if no campaign data was detected
        if (this.fieldMappings.length === 0) {
            this.addMappingField();
        }
    }

    detectCampaignMapping() {
        // Campaign data mapping configuration
        const campaignMapping = {
            'campaign_name': 'Campaign Name',
            'delivered': 'Count',
            'opened': 'Open',
            'clicked': 'Clicks',
            'unsubscribed': 'Unsub',
            'bounced': 'Bounces'
        };

        // Check if this looks like campaign data
        const hasCampaignName = this.sourceColumns.includes('campaign_name') && 
                               this.templateColumns.includes('Campaign Name');
        const hasCampaignMetrics = ['delivered', 'opened', 'clicked', 'unsubscribed', 'bounced']
            .some(col => this.sourceColumns.includes(col));

        if (hasCampaignName && hasCampaignMetrics) {
            // Auto-select key field
            const keyFieldSelect = document.getElementById('keyField');
            if (this.sourceColumns.includes('campaign_name') && 
                this.templateColumns.includes('Campaign Name')) {
                keyFieldSelect.value = 'campaign_name';
            }

            // Clear existing mappings
            document.getElementById('fieldMappings').innerHTML = '';
            this.fieldMappings = [];

            // Add predefined mappings
            Object.entries(campaignMapping).forEach(([source, target]) => {
                if (this.sourceColumns.includes(source) && this.templateColumns.includes(target)) {
                    this.addMappingField(source, target);
                }
            });

            // Show notification to user
            this.showMappingNotification('Campaign data detected! Field mappings have been auto-configured.');
        }
    }

    showMappingNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'success-message';
        notification.textContent = message;
        notification.style.marginBottom = '20px';
        
        const mappingSection = document.getElementById('mappingSection');
        mappingSection.insertBefore(notification, mappingSection.firstChild);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
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
            <span>→</span>
            <select class="target-field" data-index="${mappingIndex}">
                <option value="">Select template field...</option>
            </select>
            <button class="btn btn-danger" onclick="app.removeMapping(${mappingIndex})">Remove</button>
        `;

        mappingsContainer.appendChild(mappingDiv);

        // Populate dropdowns
        const sourceSelect = mappingDiv.querySelector('.source-field');
        const targetSelect = mappingDiv.querySelector('.target-field');

        this.sourceColumns.forEach(column => {
            const option = document.createElement('option');
            option.value = column;
            option.textContent = column;
            sourceSelect.appendChild(option);
        });

        this.templateColumns.forEach(column => {
            const option = document.createElement('option');
            option.value = column;
            option.textContent = column;
            targetSelect.appendChild(option);
        });

        // Set preselected values if provided
        if (preselectedSource) {
            sourceSelect.value = preselectedSource;
        }
        if (preselectedTarget) {
            targetSelect.value = preselectedTarget;
        }

        this.fieldMappings.push({ source: preselectedSource, target: preselectedTarget });
    }

    removeMapping(index) {
        const sourceEl = document.querySelector(`.source-field[data-index="${index}"]`);
        if (!sourceEl || !sourceEl.parentElement) {
            return;
        }
        sourceEl.parentElement.remove();

        this.fieldMappings.splice(index, 1);

        document.querySelectorAll('.field-mapping').forEach((div, newIndex) => {
            const src = div.querySelector('.source-field');
            const tgt = div.querySelector('.target-field');
            const btn = div.querySelector('.btn-danger');
            if (src) src.setAttribute('data-index', newIndex);
            if (tgt) tgt.setAttribute('data-index', newIndex);
            if (btn) btn.setAttribute('onclick', `app.removeMapping(${newIndex})`);
        });
    }

    updateMappingOptions() {
        // This could be used to filter options based on key field selection
        // For now, we'll keep all options available
    }

    async processFiles() {
        // Validate configuration
        const keyField = document.getElementById('keyField').value;
        if (!keyField) {
            this.showGlobalError('Please select a key field for matching');
            return;
        }
        const templateKeyField = this.keyFieldPairs.get(keyField) || this.findBestTemplateKeyForSource(keyField);
        if (!templateKeyField) {
            this.showGlobalError('Selected key field is not available in template file');
            return;
        }

        // Collect field mappings
        const mappings = [];
        document.querySelectorAll('.field-mapping').forEach(div => {
            const sourceField = div.querySelector('.source-field').value;
            const targetField = div.querySelector('.target-field').value;
            
            if (sourceField && targetField) {
                mappings.push({ source: sourceField, target: targetField });
            }
        });

        if (mappings.length === 0) {
            this.showGlobalError('Please add at least one field mapping');
            return;
        }

        this.goToStep(3);
        this.showProgress(0);

        try {
            const formData = new FormData();
            formData.append('sourceFile', this.sourceFile);
            formData.append('templateFile', this.templateFile);
            formData.append('keyField', keyField);
            formData.append('templateKeyField', templateKeyField);
            formData.append('fieldMappings', JSON.stringify(mappings));

            this.showProgress(30);
            this.updateProgressMessage('Uploading files...');

            const response = await fetch('/api/process', {
                method: 'POST',
                body: formData
            });

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
        const progressBar = document.getElementById('progressBar');
        const progressFill = document.getElementById('progressFill');
        
        progressBar.classList.add('active');
        progressFill.style.width = percent + '%';
        progressFill.textContent = percent + '%';
    }

    updateProgressMessage(message) {
        document.getElementById('processingMessage').innerHTML = `
            <div class="processing-status">${message}</div>
        `;
    }

    hideProgress() {
        document.getElementById('progressBar').classList.remove('active');
        document.getElementById('processingMessage').innerHTML = '';
    }

    showResults(result) {
        const resultSection = document.getElementById('resultSection');
        const stats = document.getElementById('stats');
        
        stats.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${result.stats.totalRecords}</div>
                <div class="stat-label">Total Records</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${result.stats.matchedRecords}</div>
                <div class="stat-label">Matched Records</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${result.stats.updatedFields}</div>
                <div class="stat-label">Values written</div>
            </div>
        `;

        // Store download URL for later use
        this.downloadUrl = result.downloadUrl;

        resultSection.classList.add('active');
    }

    async downloadFile() {
        if (this.downloadUrl) {
            window.open(this.downloadUrl, '_blank');
        }
    }

    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const text = document.getElementById('loadingOverlayText');
        if (overlay) {
            overlay.classList.add('active');
            overlay.setAttribute('aria-hidden', 'false');
        }
        if (text) {
            text.textContent = message;
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            overlay.setAttribute('aria-hidden', 'true');
        }
    }

    showGlobalError(message) {
        // Create or update error message
        let errorDiv = document.getElementById('globalError');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'globalError';
            errorDiv.className = 'error-message';
            document.querySelector('.main-content').insertBefore(
                errorDiv, 
                document.querySelector('.main-content').firstChild
            );
        }
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    goToStep(stepNumber) {
        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('active');
        });

        document.getElementById(`step${stepNumber}`).classList.add('active');

        const mappingSection = document.getElementById('mappingSection');
        if (mappingSection) {
            if (stepNumber === 2) {
                mappingSection.classList.add('active');
            } else {
                mappingSection.classList.remove('active');
            }
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    startOver() {
        // Reset all data
        this.sourceFile = null;
        this.templateFile = null;
        this.sourceColumns = [];
        this.templateColumns = [];
        this.fieldMappings = [];
        this.downloadUrl = null;

        // Reset UI
        document.getElementById('sourceFileInfo').innerHTML = '';
        document.getElementById('templateFileInfo').innerHTML = '';
        document.getElementById('fieldMappings').innerHTML = '';
        document.getElementById('resultSection').classList.remove('active');
        const globalError = document.getElementById('globalError');
        if (globalError) {
            globalError.style.display = 'none';
        }

        // Reset file inputs
        document.getElementById('sourceFile').value = '';
        document.getElementById('templateFile').value = '';

        // Go to first step
        this.goToStep(1);
        this.checkFilesReady();
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ExcelMappingApp();
});
