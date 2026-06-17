const app = require('./app');
const fs = require('fs-extra');
const path = require('path');

const PORT = process.env.PORT || 3000;

// Ensure uploads directories exist for local development
const uploadsRoot = path.resolve(__dirname, '../../uploads');
const processedDir = path.join(uploadsRoot, 'processed');
const mappingsDir = path.join(uploadsRoot, 'mappings');
const logsDir = path.join(uploadsRoot, 'logs');
try {
    fs.ensureDirSync(uploadsRoot);
    fs.ensureDirSync(processedDir);
    fs.ensureDirSync(mappingsDir);
    fs.ensureDirSync(logsDir);
} catch (err) {
    console.error('Failed to ensure upload directories:', err);
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
        console.log('Development mode: backend available at http://localhost:' + PORT);
        console.log('If using the frontend dev server, set VITE_API_BASE to http://localhost:' + PORT);
    }
});
