import { useMemo, useState, useEffect } from 'react';
import { getFilePreview, processMapping } from '../services/api.js';
import { loadMappingFromStorage, saveMappingToStorage, getSavedMappingsFromStorage, deleteMappingFromStorage, loadUserNameFromStorage, saveUserNameToStorage } from '../utils/mappingStorage.js';

function fileSize(bytes) {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function emptyMapping() {
    return { source: '', target: '' };
}

export function App({ theme, onToggleTheme }) {
    const initialUserName = loadUserNameFromStorage();
    const [step, setStep] = useState(1);
    const [sourceFile, setSourceFile] = useState(null);
    const [templateFile, setTemplateFile] = useState(null);
    const [sourceColumns, setSourceColumns] = useState([]);
    const [templateColumns, setTemplateColumns] = useState([]);
    const [sourceKeyField, setSourceKeyField] = useState('');
    const [templateKeyField, setTemplateKeyField] = useState('');
    const [fieldMappings, setFieldMappings] = useState([emptyMapping()]);
    const [error, setError] = useState('');
    const [loadingText, setLoadingText] = useState('');
    const [processing, setProcessing] = useState(false);
    const [result, setResult] = useState(null);
    const [savedMappings, setSavedMappings] = useState([]);
    const [showSavedMappings, setShowSavedMappings] = useState(false);
    const [savingMapping, setSavingMapping] = useState(false);
    const [mappingName, setMappingName] = useState('');
    const [flowStage, setFlowStage] = useState(initialUserName ? 'welcome' : 'askName');
    const [userName, setUserName] = useState(initialUserName || '');
    const [nameInput, setNameInput] = useState('');
    const [editNameInput, setEditNameInput] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [isReturningUser, setIsReturningUser] = useState(Boolean(initialUserName));

    useEffect(() => {
        const saved = getSavedMappingsFromStorage();
        setSavedMappings(saved || []);

        const latest = loadMappingFromStorage();
        if (latest) {
            console.log('Found saved mapping in localStorage');
        }

        if (initialUserName) {
            const timer = setTimeout(() => setFlowStage('app'), 1000);
            return () => clearTimeout(timer);
        }
    }, [initialUserName]);

    const filesReady = Boolean(sourceFile && templateFile);

    const completedMappings = useMemo(
        () => fieldMappings.filter((m) => m.source && m.target),
        [fieldMappings]
    );

    const onSelectFile = (event, isSource) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setError('');
        if (isSource) setSourceFile(file);
        else setTemplateFile(file);
    };

    const analyzeFiles = async () => {
        if (!sourceFile || !templateFile) return;
        setError('');
        setLoadingText('Analyzing files...');
        try {
            const [sourcePreview, templatePreview] = await Promise.all([
                getFilePreview(sourceFile),
                getFilePreview(templateFile)
            ]);
            setSourceColumns(sourcePreview.columns || []);
            setTemplateColumns(templatePreview.columns || []);
            setSourceKeyField(sourcePreview.columns?.[0] || '');
            setTemplateKeyField(templatePreview.columns?.[0] || '');
            setFieldMappings([emptyMapping()]);
            setStep(2);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingText('');
        }
    };

    const updateMapping = (index, key, value) => {
        setFieldMappings((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
    };

    const addMapping = () => setFieldMappings((prev) => [...prev, emptyMapping()]);
    const removeMapping = (index) => setFieldMappings((prev) => prev.filter((_, i) => i !== index));

    const runProcess = async () => {
        if (!sourceKeyField || !templateKeyField) return setError('Select both key columns.');
        if (!completedMappings.length) return setError('Add at least one valid field mapping.');
        setError('');
        setStep(3);
        setProcessing(true);
        setLoadingText('Processing data...');
        try {
            const response = await processMapping({
                sourceFile,
                templateFile,
                keyField: sourceKeyField,
                templateKeyField,
                fieldMappings: completedMappings
            });
            setResult(response);
        } catch (err) {
            setError(err.message);
            setStep(2);
        } finally {
            setProcessing(false);
            setLoadingText('');
        }
    };

    const startOver = () => {
        setStep(1);
        setSourceFile(null);
        setTemplateFile(null);
        setSourceColumns([]);
        setTemplateColumns([]);
        setSourceKeyField('');
        setTemplateKeyField('');
        setFieldMappings([emptyMapping()]);
        setResult(null);
        setError('');
    };

    const handleSaveUserName = () => {
        if (!nameInput.trim()) {
            setError('Please enter your name to continue.');
            return;
        }

        const trimmedName = nameInput.trim();
        saveUserNameToStorage(trimmedName);
        setUserName(trimmedName);
        setIsReturningUser(true);
        setError('');
        setFlowStage('welcome');
        setTimeout(() => setFlowStage('app'), 1000);
    };

    const handleStartEditName = () => {
        setEditNameInput(userName);
        setError('');
        setIsEditingName(true);
    };

    const handleSaveEditedName = () => {
        if (!editNameInput.trim()) {
            setError('Please enter your name to save.');
            return;
        }

        const trimmedName = editNameInput.trim();
        saveUserNameToStorage(trimmedName);
        setUserName(trimmedName);
        setIsReturningUser(true);
        setIsEditingName(false);
        setError('');
    };

    const handleCancelEditName = () => {
        setEditNameInput(userName);
        setIsEditingName(false);
        setError('');
    };

    const handleSaveMapping = () => {
        if (!mappingName.trim()) {
            setError('Please enter a name for the saved mapping.');
            return;
        }

        if (!sourceKeyField || !templateKeyField || !completedMappings.length) {
            setError('Please complete the mapping setup before saving.');
            return;
        }

        setSavingMapping(true);
        setError('');
        try {
            const mappingData = {
                sourceKeyField,
                templateKeyField,
                fieldMappings: completedMappings,
                sourceColumns,
                templateColumns
            };

            const saved = saveMappingToStorage(mappingData, mappingName.trim());
            setSavedMappings((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
            setLoadingText('Mapping saved locally!');
        } catch (err) {
            setError(`Error saving mapping: ${err.message}`);
        } finally {
            setSavingMapping(false);
        }
    };

    const handleRestoreMapping = (mapping) => {
        setSourceKeyField(mapping.sourceKeyField || '');
        setTemplateKeyField(mapping.templateKeyField || '');
        setFieldMappings(mapping.fieldMappings || [emptyMapping()]);
        setSourceColumns(mapping.sourceColumns || sourceColumns);
        setTemplateColumns(mapping.templateColumns || templateColumns);
        setShowSavedMappings(false);
        setLoadingText(`Loaded mapping "${mapping.name}".`);
    };

    const handleDeleteMapping = (mappingId) => {
        try {
            deleteMappingFromStorage(mappingId);
            setSavedMappings((prev) => prev.filter((m) => m.id !== mappingId));
        } catch (err) {
            setError(`Error deleting mapping: ${err.message}`);
        }
    };

    const sourceFileName = sourceFile ? `${sourceFile.name} (${fileSize(sourceFile.size)})` : 'No file selected';
    const templateFileName = templateFile ? `${templateFile.name} (${fileSize(templateFile.size)})` : 'No file selected';

    if (flowStage === 'askName') {
        return (
            <div className="container welcome-screen">
                <div className="welcome-card onboarding-card">
                    <div className="welcome-label">Welcome</div>
                    <div className="welcome-title">What should we call you?</div>
                    <p className="welcome-copy">Enter your name so we can personalize your experience.</p>
                    {error ? <div className="error-message">{error}</div> : null}
                    <div className="name-input-row">
                        <label htmlFor="visitor-name">Your name</label>
                        <input
                            id="visitor-name"
                            type="text"
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            placeholder="Enter your name"
                        />
                    </div>
                    <button className="btn btn-primary" onClick={handleSaveUserName}>Continue</button>
                </div>
            </div>
        );
    }

    if (flowStage === 'welcome') {
        return (
            <div className="container welcome-screen">
                <div className="welcome-card">
                    <div className="welcome-label">
                        {isReturningUser ? 'Welcome back' : 'Great to meet you'}
                    </div>
                    <div className="welcome-title">
                        {userName ? `${isReturningUser ? 'Welcome back' : 'Welcome'}, ${userName}` : 'Welcome!'}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`container ${step === 1 ? 'home-static' : ''}`}>
            <div className="header">
                <div className="header-top">
                    <span className="header-badge">Data workflow</span>
                    <button type="button" className="btn btn-secondary theme-toggle" onClick={onToggleTheme}>
                        {theme === 'dark' ? 'Switch to light' : 'Switch to default'}
                    </button>
                </div>
                {userName ? (
                    <div className="header-meta">
                        {!isEditingName ? (
                            <div className="user-name-display">
                                <span className="user-name-label">Signed in as</span>
                                <strong>{userName}</strong>
                                <button type="button" className="btn btn-small btn-info" onClick={handleStartEditName}>Edit</button>
                            </div>
                        ) : (
                            <div className="header-edit-name">
                                <input
                                    type="text"
                                    className="header-name-input"
                                    value={editNameInput}
                                    onChange={(e) => setEditNameInput(e.target.value)}
                                    placeholder="Update your name"
                                />
                                <button type="button" className="btn btn-small btn-primary" onClick={handleSaveEditedName}>Save</button>
                                <button type="button" className="btn btn-small btn-secondary" onClick={handleCancelEditName}>Cancel</button>
                            </div>
                        )}
                    </div>
                ) : null}
                <h1>Excel Mapping Studio</h1>
            </div>

            <div className="main-content">
                {error ? <div className="error-message">{error}</div> : null}
                {loadingText ? <div className="processing-status">{loadingText}</div> : null}

                {step === 1 ? (
                    <div className="step active upload-step">
                        <div className="step-header"><div className="step-number">1</div><div className="step-title">Upload workbooks</div></div>
                        <p className="step-subtitle">Select source and template files to begin mapping.</p>
                        <div className={`file-upload-area ${sourceFile ? 'has-file' : ''}`}>
                            <div className="file-upload-head">
                                <h3>Source file</h3>
                                <span className="file-type-chip">.xlsx / .xls / .csv</span>
                            </div>
                            <p className="file-upload-note">Upload the sheet that contains your original records.</p>
                            <label className="file-picker">
                                <span className="file-picker-btn">{sourceFile ? 'Change Source File' : 'Choose Source File'}</span>
                                <input type="file" accept=".xlsx,.xls,.csv,text/csv" onChange={(e) => onSelectFile(e, true)} />
                            </label>
                            <div className="file-name">{sourceFileName}</div>
                            {sourceFile ? <div className="file-info">Ready: {sourceFile.name} ({fileSize(sourceFile.size)})</div> : null}
                        </div>
                        <div className={`file-upload-area ${templateFile ? 'has-file' : ''}`}>
                            <div className="file-upload-head">
                                <h3>Template file</h3>
                                <span className="file-type-chip">.xlsx / .xls</span>
                            </div>
                            <p className="file-upload-note">Upload the sheet that will be updated with mapped values.</p>
                            <label className="file-picker">
                                <span className="file-picker-btn">{templateFile ? 'Change Template File' : 'Choose Template File'}</span>
                                <input type="file" accept=".xlsx,.xls" onChange={(e) => onSelectFile(e, false)} />
                            </label>
                            <div className="file-name">{templateFileName}</div>
                            {templateFile ? <div className="file-info">Ready: {templateFile.name} ({fileSize(templateFile.size)})</div> : null}
                        </div>
                        <div className="actions-row">
                            <button className="btn btn-primary" disabled={!filesReady || processing} onClick={analyzeFiles}>Analyze and continue</button>
                        </div>
                    </div>
                ) : null}

                {step === 2 ? (
                    <div className="step active">
                        <div className="step-header"><div className="step-number">2</div><div className="step-title">Map fields</div></div>
                        <p className="step-subtitle">Pick key columns, then map source fields to template fields.</p>
                        <div className="mapping-panel">
                            <div className="mapping-panel-grid">
                                <div className="mapping-control">
                                    <label htmlFor="source-key-column">Source key column</label>
                                    <select id="source-key-column" className="column-select" value={sourceKeyField} onChange={(e) => setSourceKeyField(e.target.value)}>
                                        {sourceColumns.map((col) => <option key={col} value={col}>{col}</option>)}
                                    </select>
                                </div>
                                <div className="mapping-control">
                                    <label htmlFor="template-key-column">Template key column</label>
                                    <select id="template-key-column" className="column-select" value={templateKeyField} onChange={(e) => setTemplateKeyField(e.target.value)}>
                                        {templateColumns.map((col) => <option key={col} value={col}>{col}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <h4 className="mapping-title">Column mapping</h4>
                        {fieldMappings.map((mapping, index) => (
                            <div className="field-mapping" key={`mapping-${index}`}>
                                <div className="field-select-wrap">
                                    <label>From source</label>
                                    <select value={mapping.source} onChange={(e) => updateMapping(index, 'source', e.target.value)}>
                                        <option value="">Select source field...</option>
                                        {sourceColumns.map((col) => <option key={col} value={col}>{col}</option>)}
                                    </select>
                                </div>
                                <span className="mapping-arrow">-&gt;</span>
                                <div className="field-select-wrap">
                                    <label>To template</label>
                                    <select value={mapping.target} onChange={(e) => updateMapping(index, 'target', e.target.value)}>
                                        <option value="">Select template field...</option>
                                        {templateColumns.map((col) => <option key={col} value={col}>{col}</option>)}
                                    </select>
                                </div>
                                <button type="button" className="btn btn-danger" onClick={() => removeMapping(index)} disabled={fieldMappings.length === 1}>
                                    Remove
                                </button>
                            </div>
                        ))}
                        <div className="save-mapping-row">
                            <label htmlFor="mapping-name">Save mapping name</label>
                            <input
                                id="mapping-name"
                                type="text"
                                value={mappingName}
                                onChange={(e) => setMappingName(e.target.value)}
                                placeholder="Give this mapping a clear name for reuse"
                            />
                        </div>
                        <div className="actions-row">
                            <button className="btn btn-secondary" onClick={addMapping}>Add mapping</button>
                            <button className="btn btn-primary" onClick={runProcess} disabled={processing}>Process files</button>
                            <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
                            <button className="btn btn-secondary" onClick={handleSaveMapping} disabled={savingMapping}>
                                {savingMapping ? 'Saving...' : 'Save Mapping'}
                            </button>
                            {savedMappings.length > 0 && (
                                <button className="btn btn-info" onClick={() => setShowSavedMappings(!showSavedMappings)}>
                                    Saved Mappings ({savedMappings.length})
                                </button>
                            )}
                        </div>

                        {showSavedMappings && savedMappings.length > 0 && (
                            <div className="saved-mappings-panel">
                                <h4>Saved Mappings (Auto-expires in 30 days)</h4>
                                <div className="mappings-list">
                                    {savedMappings.map((mapping) => (
                                        <div key={mapping.id} className="mapping-item">
                                            <div className="mapping-info">
                                                <div className="mapping-name">
                                                    {mapping.name}
                                                </div>
                                                <div className="mapping-date">
                                                    Saved: {new Date(mapping.timestamp).toLocaleDateString()} {new Date(mapping.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                <div className="mapping-config">
                                                    {mapping.sourceKeyField} → {mapping.templateKeyField}
                                                </div>
                                                <div className="mapping-fields">
                                                    {mapping.fieldMappings.length} field mappings
                                                </div>
                                            </div>
                                            <div className="mapping-actions">
                                                <button className="btn btn-small btn-success" onClick={() => handleRestoreMapping(mapping)}>
                                                    Restore
                                                </button>
                                                <button className="btn btn-small btn-danger" onClick={() => handleDeleteMapping(mapping.id)}>
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}

                {step === 3 ? (
                    <div className="step active">
                        <div className="step-header"><div className="step-number">3</div><div className="step-title">Process and download</div></div>
                        {processing ? <div className="processing-status">Processing...</div> : null}
                        {result?.stats ? (
                            <div className="result-section active">
                                <h3>Complete</h3>
                                <div className="stats">
                                    <div className="stat-card"><div className="stat-number">{result.stats.totalRowsScanned}</div><div className="stat-label">Rows scanned</div></div>
                                    <div className="stat-card"><div className="stat-number">{result.stats.matchedRecords}</div><div className="stat-label">Matched rows</div></div>
                                    <div className="stat-card"><div className="stat-number">{result.stats.updatedCells}</div><div className="stat-label">Values written</div></div>
                                </div>
                                <div className="actions-row">
                                    <a className="btn btn-success" href={result.downloadUrl} target="_blank" rel="noreferrer">Download file</a>
                                    <button className="btn btn-primary" onClick={startOver}>Start over</button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
}