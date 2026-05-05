const ExcelFile = require('../models/ExcelFile');
const path = require('path');
const fs = require('fs-extra');

class FileController {
    // Handle file upload and processing
    async processFiles(req, res) {
        try {
            // multer.fields() attaches an object: { sourceFile: [...], templateFile: [...] }
            const files = req.files;
            const sourceFile = files && files.sourceFile && files.sourceFile[0];
            const templateFile = files && files.templateFile && files.templateFile[0];

            if (!sourceFile || !templateFile) {
                return res.status(400).json({
                    error: 'Please upload both source and template files'
                });
            }

            // Get mapping configuration from request body
            const { keyField, templateKeyField, fieldMappings } = req.body;
            
            if (!keyField || !fieldMappings) {
                return res.status(400).json({ 
                    error: 'Key field and field mappings are required' 
                });
            }

            // Parse field mappings
            let mappings;
            try {
                mappings = JSON.parse(fieldMappings);
            } catch (error) {
                return res.status(400).json({ 
                    error: 'Invalid field mappings format' 
                });
            }

            // Load Excel files
            const sourceExcel = new ExcelFile(sourceFile.path);
            const templateExcel = new ExcelFile(templateFile.path);

            const sourceLoaded = await sourceExcel.loadFile();
            const templateLoaded = await templateExcel.loadFile();

            if (!sourceLoaded || !templateLoaded) {
                return res.status(500).json({ 
                    error: 'Failed to load Excel files' 
                });
            }

            // Update ALL sheets in template workbook in-place (preserve structure)
            const stats = templateExcel.applyMappingsAcrossSheets(
                sourceExcel.getData(),
                keyField,
                templateKeyField || keyField,
                mappings
            );

            // Generate output filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const outputFileName = `updated_${timestamp}_${templateFile.originalname}`;
            const outputPath = path.join('uploads', 'processed', outputFileName);

            // Ensure processed directory exists
            await fs.ensureDir(path.dirname(outputPath));

            // Save updated file
            const saved = await templateExcel.saveUpdatedFile(outputPath);

            if (!saved) {
                return res.status(500).json({ 
                    error: 'Failed to save updated file' 
                });
            }

            // Clean up temporary files
            await fs.remove(sourceFile.path);
            await fs.remove(templateFile.path);

            // Return success response with download info
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

    // Handle file download
    async downloadFile(req, res) {
        try {
            const fileName = req.params.fileName;
            const filePath = path.join('uploads', 'processed', fileName);

            // Check if file exists
            if (!await fs.pathExists(filePath)) {
                return res.status(404).json({ 
                    error: 'File not found' 
                });
            }

            // Send file for download
            res.download(filePath, fileName, (err) => {
                if (err) {
                    console.error('Error downloading file:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Error downloading file' });
                    }
                } else {
                    // Optionally clean up the file after download
                    setTimeout(() => {
                        fs.remove(filePath).catch(console.error);
                    }, 60000); // Remove after 1 minute
                }
            });

        } catch (error) {
            console.error('Error in download:', error);
            res.status(500).json({ 
                error: 'Internal server error during download' 
            });
        }
    }

    // Get file preview for column mapping
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
                columns: columns,
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