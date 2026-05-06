const path = require('path');
const fs = require('fs-extra');
const ExcelFile = require('../models/ExcelFile');

const uploadsRoot = path.resolve(__dirname, '../../uploads');
const processedDir = path.join(uploadsRoot, 'processed');

class FileController {
    async processFiles(req, res) {
        try {
            const files = req.files;
            const sourceFile = files && files.sourceFile && files.sourceFile[0];
            const templateFile = files && files.templateFile && files.templateFile[0];

            if (!sourceFile || !templateFile) {
                return res.status(400).json({
                    error: 'Please upload both source and template files'
                });
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

            await fs.ensureDir(path.dirname(outputPath));
            const saved = await templateExcel.saveUpdatedFile(outputPath);

            if (!saved) {
                return res.status(500).json({
                    error: 'Failed to save updated file'
                });
            }

            await fs.remove(sourceFile.path);
            await fs.remove(templateFile.path);

            res.json({
                success: true,
                message: 'Files processed successfully',
                downloadUrl: `/api/download/${outputFileName}`,
                stats: {
                    totalSheets: stats.totalSheets,
                    totalRowsScanned: stats.totalRowsScanned,
                    matchedRecords: stats.matchedRows,
                    updatedCells: stats.updatedCells
                }
            });
        } catch (error) {
            console.error('Error processing files:', error);
            res.status(500).json({
                error: 'Internal server error during file processing'
            });
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
}

module.exports = new FileController();
