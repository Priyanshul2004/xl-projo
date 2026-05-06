import { useMemo, useState } from 'react';
import { getFilePreview, processMapping } from '../services/api.js';

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

    return (
        <div className="container">
            <div className="header">
                <div className="header-top">
                    <span className="header-badge">Data workflow</span>
                    <button type="button" className="btn btn-secondary theme-toggle" onClick={onToggleTheme}>
                        {theme === 'dark' ? 'Switch to light' : 'Switch to default'}
                    </button>
                </div>
                <h1>Excel Mapping Studio</h1>
                <p>Frontend is now React-based and connected through API endpoints only.</p>
            </div>

            <div className="main-content">
                {error ? <div className="error-message">{error}</div> : null}
                {loadingText ? <div className="processing-status">{loadingText}</div> : null}

                {step === 1 ? (
                    <div className="step active">
                        <div className="step-header"><div className="step-number">1</div><div className="step-title">Upload workbooks</div></div>
                        <div className="file-upload-area">
                            <h3>Source file</h3>
                            <p>.xlsx / .xls / .csv</p>
                            <input type="file" accept=".xlsx,.xls,.csv,text/csv" onChange={(e) => onSelectFile(e, true)} />
                            {sourceFile ? <div className="file-info">{sourceFile.name} ({fileSize(sourceFile.size)})</div> : null}
                        </div>
                        <div className="file-upload-area">
                            <h3>Template file</h3>
                            <p>.xlsx / .xls</p>
                            <input type="file" accept=".xlsx,.xls" onChange={(e) => onSelectFile(e, false)} />
                            {templateFile ? <div className="file-info">{templateFile.name} ({fileSize(templateFile.size)})</div> : null}
                        </div>
                        <div className="actions-row">
                            <button className="btn btn-primary" disabled={!filesReady || processing} onClick={analyzeFiles}>Analyze and continue</button>
                        </div>
                    </div>
                ) : null}

                {step === 2 ? (
                    <div className="step active">
                        <div className="step-header"><div className="step-number">2</div><div className="step-title">Map fields</div></div>
                        <label>Source key column</label>
                        <select className="column-select" value={sourceKeyField} onChange={(e) => setSourceKeyField(e.target.value)}>
                            {sourceColumns.map((col) => <option key={col} value={col}>{col}</option>)}
                        </select>
                        <label>Template key column</label>
                        <select className="column-select" value={templateKeyField} onChange={(e) => setTemplateKeyField(e.target.value)}>
                            {templateColumns.map((col) => <option key={col} value={col}>{col}</option>)}
                        </select>

                        <h4>Column mapping</h4>
                        {fieldMappings.map((mapping, index) => (
                            <div className="field-mapping" key={`mapping-${index}`}>
                                <select value={mapping.source} onChange={(e) => updateMapping(index, 'source', e.target.value)}>
                                    <option value="">Select source field...</option>
                                    {sourceColumns.map((col) => <option key={col} value={col}>{col}</option>)}
                                </select>
                                <span>-&gt;</span>
                                <select value={mapping.target} onChange={(e) => updateMapping(index, 'target', e.target.value)}>
                                    <option value="">Select template field...</option>
                                    {templateColumns.map((col) => <option key={col} value={col}>{col}</option>)}
                                </select>
                                <button type="button" className="btn btn-danger" onClick={() => removeMapping(index)}>Remove</button>
                            </div>
                        ))}
                        <div className="actions-row">
                            <button className="btn btn-secondary" onClick={addMapping}>Add mapping</button>
                            <button className="btn btn-primary" onClick={runProcess} disabled={processing}>Process files</button>
                            <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
                        </div>
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
