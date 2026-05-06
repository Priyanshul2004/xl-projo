const express = require('express');
const path = require('path');
const cors = require('cors');
const fileUploadRoutes = require('./routes/fileUpload');

const app = express();

const frontendPath = path.resolve(__dirname, '../../Frontend');
const frontendDistPath = path.join(frontendPath, 'dist');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', fileUploadRoutes);
app.use(express.static(frontendDistPath));

app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
});

module.exports = app;
