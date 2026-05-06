const express = require('express');
const path = require('path');
const cors = require('cors');
const fileUploadRoutes = require('./routes/fileUpload');

const app = express();

const frontendPath = path.resolve(__dirname, '../../Frontend');
const viewsPath = path.join(frontendPath, 'src', 'pages');
const publicPath = path.join(frontendPath, 'public');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicPath));

app.use('/api', fileUploadRoutes);

app.get('/', (req, res) => {
    res.sendFile(path.join(viewsPath, 'index.html'));
});

module.exports = app;
