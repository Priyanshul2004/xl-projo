const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const fileController = require('../controllers/fileController');

const router = express.Router();
const uploadsDir = path.resolve(__dirname, '../../uploads');

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            await fs.ensureDir(uploadsDir);
            cb(null, uploadsDir);
        } catch (error) {
            cb(error, uploadsDir);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/octet-stream',
            'text/csv',
            'application/csv'
        ];
        const allowedExtensions = ['.xlsx', '.xls', '.csv'];
        const fileExtension = path.extname(file.originalname).toLowerCase();

        if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel/CSV files (.xlsx, .xls, .csv) are allowed'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

router.post('/process', upload.fields([
    { name: 'sourceFile', maxCount: 1 },
    { name: 'templateFile', maxCount: 1 }
]), fileController.processFiles);

router.post('/mapping/save', fileController.saveMapping);
router.get('/mapping/list', fileController.getSavedMappings);
router.delete('/mapping/:mappingId', fileController.deleteMapping);
router.get('/download/:fileName', fileController.downloadFile);
router.post('/preview', upload.single('file'), fileController.getFilePreview);

module.exports = router;
