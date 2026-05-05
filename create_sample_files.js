const XLSX = require('xlsx');
const path = require('path');

// Create sample source data
const sourceData = [
    {
        campaign_name: 'Summer Sale 2024',
        delivered: 10000,
        opened: 3500,
        clicked: 1200,
        unsubscribed: 50,
        bounced: 100
    },
    {
        campaign_name: 'Winter Campaign',
        delivered: 8000,
        opened: 2800,
        clicked: 900,
        unsubscribed: 30,
        bounced: 80
    },
    {
        campaign_name: 'Spring Newsletter',
        delivered: 15000,
        opened: 6000,
        clicked: 2000,
        unsubscribed: 25,
        bounced: 120
    },
    {
        campaign_name: 'Fall Promotion',
        delivered: 12000,
        opened: 4500,
        clicked: 1500,
        unsubscribed: 40,
        bounced: 90
    },
    {
        campaign_name: 'Holiday Special',
        delivered: 20000,
        opened: 8500,
        clicked: 3000,
        unsubscribed: 60,
        bounced: 150
    }
];

// Create sample template data
const templateData = [
    {
        'Campaign Name': 'Summer Sale 2024',
        'Count': '',
        'Open': '',
        'Clicks': '',
        'Unsub': '',
        'Bounces': ''
    },
    {
        'Campaign Name': 'Winter Campaign',
        'Count': '',
        'Open': '',
        'Clicks': '',
        'Unsub': '',
        'Bounces': ''
    },
    {
        'Campaign Name': 'Spring Newsletter',
        'Count': '',
        'Open': '',
        'Clicks': '',
        'Unsub': '',
        'Bounces': ''
    },
    {
        'Campaign Name': 'Fall Promotion',
        'Count': '',
        'Open': '',
        'Clicks': '',
        'Unsub': '',
        'Bounces': ''
    },
    {
        'Campaign Name': 'Holiday Special',
        'Count': '',
        'Open': '',
        'Clicks': '',
        'Unsub': '',
        'Bounces': ''
    }
];

// Create workbooks
const sourceWorkbook = XLSX.utils.book_new();
const sourceWorksheet = XLSX.utils.json_to_sheet(sourceData);
XLSX.utils.book_append_sheet(sourceWorkbook, sourceWorksheet, 'Campaign Data');

const templateWorkbook = XLSX.utils.book_new();
const templateWorksheet = XLSX.utils.json_to_sheet(templateData);
XLSX.utils.book_append_sheet(templateWorkbook, templateWorksheet, 'Template');

// Save files
const sourcePath = path.join(__dirname, 'sample_source_data.xlsx');
const templatePath = path.join(__dirname, 'sample_template_data.xlsx');

XLSX.writeFile(sourceWorkbook, sourcePath);
XLSX.writeFile(templateWorkbook, templatePath);

console.log('Sample Excel files created successfully!');
console.log('Source file:', sourcePath);
console.log('Template file:', templatePath);