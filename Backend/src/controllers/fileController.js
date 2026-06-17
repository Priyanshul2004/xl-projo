const path = require('path');
const fs = require('fs-extra');
const ExcelFile = require('../models/ExcelFile');

const uploadsRoot = path.resolve(__dirname, '../../uploads');
const processedDir = path.join(uploadsRoot, 'processed');
const mappingsDir = path.join(uploadsRoot, 'mappings');
const logsDir = path.join(uploadsRoot, 'logs');
const backendLogPath = path.join(logsDir, 'backend.log');

// Ensure upload directories exist on startup for local development
try {
    fs.ensureDirSync(uploadsRoot);
    fs.ensureDirSync(processedDir);
    fs.ensureDirSync(mappingsDir);
    fs.ensureDirSync(logsDir);
} catch (err) {
    console.error('Error ensuring upload directories exist:', err);
}

function appendLog(entry) {
    try {
        const ts = new Date().toISOString();
        fs.appendFileSync(backendLogPath, `[${ts}] ${entry}\n`);
    } catch (e) {
        console.error('Failed to write to backend log:', e);
    }
}

class FileController {
    async processFiles(req, res) {
        try {
            const files = req.files;
            // Verbose logging to help diagnose 500 errors in deployed environment
            try {
                const bodyKeys = JSON.stringify(Object.keys(req.body || {}));
                const filesKeys = JSON.stringify(Object.keys(files || {}));
                console.log('processFiles called - body keys:', bodyKeys);
                console.log('processFiles called - files keys:', filesKeys);
                appendLog(`processFiles called - body keys: ${bodyKeys}`);
                appendLog(`processFiles called - files keys: ${filesKeys}`);
                if (files) {
                    for (const k of Object.keys(files)) {
                        const f = files[k] && files[k][0];
                        if (f) {
                            const info = `uploaded file ${k}: originalname=${f.originalname}, path=${f.path}, size=${f.size}`;
                            console.log(info);
                            appendLog(info);
                        }
                    }
                }
                console.log('=== processFiles START ===');
                appendLog('=== processFiles START ===');
            } catch (logErr) {
                console.error('Error logging request payload:', logErr);
                appendLog(`Error logging request payload: ${logErr && logErr.stack ? logErr.stack : logErr}`);
            }
            const sourceFile = files && files.sourceFile && files.sourceFile[0];
            const templateFile = files && files.templateFile && files.templateFile[0];

            if (!sourceFile || !templateFile) {
                const msg = 'Please upload both source and template files';
                console.warn('processFiles validation failed:', msg, { filesPresent: !!files });
                appendLog(`processFiles validation failed: ${msg}`);
                return res.status(400).json({ error: msg });
            }

            const sourceExtension = path.extname(sourceFile.originalname).toLowerCase();
            const templateExtension = path.extname(templateFile.originalname).toLowerCase();
            const allowedSourceExtensions = new Set(['.xlsx', '.xls', '.csv']);
            const allowedTemplateExtensions = new Set(['.xlsx', '.xls']);

            if (!allowedSourceExtensions.has(sourceExtension)) {
                return res.status(400).json({
                    error: 'Source file must be .xlsx, .xls, or .csv'
                });
            }

            if (!allowedTemplateExtensions.has(templateExtension)) {
                return res.status(400).json({
                    error: 'Template file must be .xlsx or .xls'
                });
            }

            const { keyField, templateKeyField, fieldMappings } = req.body;
            if (!keyField || !fieldMappings) {
                return res.status(400).json({
                    error: 'Key field and field mappings are required'
                });
            }

            let mappings;
            try {
                mappings = JSON.parse(fieldMappings);
            } catch (error) {
                return res.status(400).json({
                    error: 'Invalid field mappings format'
                });
            }

            const sourceExcel = new ExcelFile(sourceFile.path);
            const templateExcel = new ExcelFile(templateFile.path);

            const sourceLoaded = await sourceExcel.loadFile();
            const templateLoaded = await templateExcel.loadFile();

            if (!sourceLoaded || !templateLoaded) {
                return res.status(500).json({
                    error: 'Failed to load Excel files'
                });
            }

            const stats = templateExcel.applyMappingsAcrossSheets(
                sourceExcel.getData(),
                keyField,
                templateKeyField || keyField,
                mappings
            );

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const templateBaseName = path.basename(templateFile.originalname, templateExtension);
            const outputFileName = `updated_${timestamp}_${templateBaseName}.xlsx`;
            const outputPath = path.join(processedDir, outputFileName);

            console.log('Preparing to save processed file to:', outputPath);
            await fs.ensureDir(path.dirname(outputPath));
            const saved = await templateExcel.saveUpdatedFile(outputPath);
            console.log('Result of saveUpdatedFile:', saved);

            if (!saved) {
                console.error('Failed to save updated file to', outputPath);
                return res.status(500).json({
                    error: 'Failed to save updated file'
                });
            }

            await fs.remove(sourceFile.path);
            await fs.remove(templateFile.path);

            const responsePayload = {
                success: true,
                message: 'Files processed successfully',
                downloadUrl: `/api/download/${outputFileName}`,
                stats: {
                    totalSheets: stats.totalSheets,
                    totalRowsScanned: stats.totalRowsScanned,
                    matchedRecords: stats.matchedRows,
                    updatedCells: stats.updatedCells
                }
            };
            console.log('=== processFiles SUCCESS ===', responsePayload);
            appendLog(`processFiles SUCCESS: downloadUrl=${responsePayload.downloadUrl}, stats=${JSON.stringify(responsePayload.stats)}`);
            res.json(responsePayload);
        } catch (error) {
            console.error('Error processing files:', error);
            if (error && error.stack) console.error(error.stack);
            const resp = { error: 'Internal server error during file processing' };
            if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
                resp.message = error.message;
                resp.stack = error.stack;
            }
            res.status(500).json(resp);
        }
    }

    async downloadFile(req, res) {
        try {
            const fileName = req.params.fileName;
            const filePath = path.join(processedDir, fileName);

            if (!await fs.pathExists(filePath)) {
                return res.status(404).json({
                    error: 'File not found'
                });
            }

            res.download(filePath, fileName, (err) => {
                if (err) {
                    console.error('Error downloading file:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Error downloading file' });
                    }
                } else {
                    setTimeout(() => {
                        fs.remove(filePath).catch(console.error);
                    }, 60000);
                }
            });
        } catch (error) {
            console.error('Error in download:', error);
            res.status(500).json({
                error: 'Internal server error during download'
            });
        }
    }

    async getFilePreview(req, res) {
        let tempPath = null;
        try {
            const file = req.file;
            if (!file) {
                return res.status(400).json({
                    error: 'No file uploaded'
                });
            }
            tempPath = file.path;

            const excel = new ExcelFile(tempPath);
            const loaded = await excel.loadFile();
            if (!loaded) {
                await fs.remove(tempPath).catch(() => {});
                return res.status(500).json({
                    error: 'Failed to load Excel file'
                });
            }

            const columns = excel.getColumnNames();
            const previewData = excel.getData().slice(0, 5);

            await fs.remove(tempPath);
            tempPath = null;

            res.json({
                columns,
                preview: previewData,
                totalRows: excel.getData().length
            });
        } catch (error) {
            if (tempPath) {
                await fs.remove(tempPath).catch(() => {});
            }
            console.error('Error getting file preview:', error);
            res.status(500).json({
                error: 'Internal server error during preview'
            });
        }
    }

    async saveMapping(req, res) {
        try {
            const { sourceKeyField, templateKeyField, fieldMappings, sourceColumns, templateColumns } = req.body;

            if (!sourceKeyField || !templateKeyField || !fieldMappings || !Array.isArray(fieldMappings)) {
                return res.status(400).json({
                    error: 'Missing required mapping fields'
                });
            }

            const mappingData = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                sourceKeyField,
                templateKeyField,
                fieldMappings,
                sourceColumns,
                templateColumns
            };

            // Store in a mappings file (can be extended to database later)
            const mappingsDir = path.join(uploadsRoot, 'mappings');
            await fs.ensureDir(mappingsDir);
            const mappingPath = path.join(mappingsDir, `mapping_${mappingData.id}.json`);
            await fs.writeJSON(mappingPath, mappingData);

            res.json({
                success: true,
                message: 'Mapping saved successfully',
                mappingId: mappingData.id,
                expiresAt: mappingData.expiresAt
            });
        } catch (error) {
            console.error('Error saving mapping:', error);
            res.status(500).json({
                error: 'Failed to save mapping'
            });
        }
    }

    async getSavedMappings(req, res) {
        try {
            const mappingsDir = path.join(uploadsRoot, 'mappings');
            
            if (!await fs.pathExists(mappingsDir)) {
                return res.json({
                    success: true,
                    mappings: [],
                    message: 'No saved mappings found'
                });
            }

            const files = await fs.readdir(mappingsDir);
            const mappings = [];

            for (const file of files) {
                try {
                    const filePath = path.join(mappingsDir, file);
                    const data = await fs.readJSON(filePath);

                    // Check if mapping expired
                    if (new Date(data.expiresAt) > new Date()) {
                        mappings.push(data);
                    } else {
                        // Delete expired mapping
                        await fs.remove(filePath).catch(() => {});
                    }
                } catch (error) {
                    console.error(`Error reading mapping file ${file}:`, error);
                }
            }

            res.json({
                success: true,
                mappings: mappings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            });
        } catch (error) {
            console.error('Error fetching saved mappings:', error);
            res.status(500).json({
                error: 'Failed to fetch saved mappings'
            });
        }
    }

    async deleteMapping(req, res) {
        try {
            const { mappingId } = req.params;

            if (!mappingId) {
                return res.status(400).json({
                    error: 'Mapping ID is required'
                });
            }

            const mappingsDir = path.join(uploadsRoot, 'mappings');
            const mappingPath = path.join(mappingsDir, `mapping_${mappingId}.json`);

            if (await fs.pathExists(mappingPath)) {
                await fs.remove(mappingPath);
                res.json({
                    success: true,
                    message: 'Mapping deleted successfully'
                });
            } else {
                res.status(404).json({
                    error: 'Mapping not found'
                });
            }
        } catch (error) {
            console.error('Error deleting mapping:', error);
            res.status(500).json({
                error: 'Failed to delete mapping'
            });
        }
    }
}

module.exports = new FileController();