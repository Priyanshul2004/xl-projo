const express = require('express');
const path = require('path');
const cors = require('cors');
const fileUploadRoutes = require('./routes/fileUpload');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

const frontendPath = path.resolve(__dirname, '../../Frontend');
const frontendDistPath = path.join(frontendPath, 'dist');
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', fileUploadRoutes);

// During development, proxy to Vite dev server for hot reload
if (!isProduction) {
    app.use('/', createProxyMiddleware({
        target: 'http://localhost:5173',
        changeOrigin: true,
        ws: true,
        pathRewrite: {
            '^/$': '/',
        },
        onError: (err, req, res) => {
            // Fallback to static files if Vite dev server is not available
            res.sendFile(path.join(frontendDistPath, 'index.html'));
        }
    }));
}

// In production or as fallback, serve static files
app.use(express.static(frontendDistPath));

app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
});

module.exports = app;
