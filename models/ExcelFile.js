const ExcelJS = require('exceljs');

class ExcelFile {
    constructor(filePath) {
        this.filePath = filePath;
        this.workbook = new ExcelJS.Workbook();
        this.data = [];
        this.primarySheet = null;
    }

    // Load Excel file
    async loadFile() {
        try {
            await this.workbook.xlsx.readFile(this.filePath);
            this.primarySheet = this.workbook.worksheets[0] || null;

            if (!this.primarySheet) {
                this.data = [];
                return true;
            }

            this.data = this._sheetToJson(this.primarySheet);
            return true;
        } catch (error) {
            console.error('Error loading Excel file:', error);
            return false;
        }
    }

    // Get data from file
    getData() {
        return this.data;
    }

    // Get column names
    getColumnNames() {
        if (this.data.length > 0) {
            return Object.keys(this.data[0]);
        }
        return [];
    }

    getSheetNames() {
        return this.workbook.worksheets.map((sheet) => sheet.name);
    }

    static _normalizeKey(value) {
        if (value === undefined || value === null) return null;
        const s = String(value).trim();
        return s === '' ? null : s.toLowerCase();
    }

    _sheetToJson(sheet) {
        const headerRow = sheet.getRow(1);
        const headers = [];
        const maxCol = headerRow.cellCount;

        for (let c = 1; c <= maxCol; c += 1) {
            const h = headerRow.getCell(c).value;
            headers.push(String(h ?? '').trim());
        }

        const rows = [];
        for (let r = 2; r <= sheet.rowCount; r += 1) {
            const row = sheet.getRow(r);
            const item = {};
            let hasValue = false;

            for (let c = 1; c <= maxCol; c += 1) {
                const key = headers[c - 1];
                if (!key) continue;
                const val = row.getCell(c).value;
                const normalizedVal = val === null || val === undefined ? '' : val;
                item[key] = normalizedVal;
                if (normalizedVal !== '') hasValue = true;
            }

            if (hasValue) rows.push(item);
        }

        return rows;
    }

    /**
     * Update ALL sheets in this workbook in-place.
     * - Keeps sheet names and worksheet structure.
     * - Matches rows by key field (e.g. "Campaign Name") and copies mapped fields.
     *
     * Returns stats:
     *  { totalSheets, totalRowsScanned, matchedRows, updatedCells }
     */
    applyMappingsAcrossSheets(sourceData, sourceKeyField, templateKeyField = sourceKeyField, fieldMappings = []) {
        if (!this.workbook) throw new Error('Workbook not loaded');

        const sourceMap = new Map();
        sourceData.forEach((record) => {
            const k = ExcelFile._normalizeKey(record[sourceKeyField]);
            if (k !== null) sourceMap.set(k, record);
        });

        const worksheets = this.workbook.worksheets;
        let totalRowsScanned = 0;
        let matchedRows = 0;
        let updatedCells = 0;

        for (const worksheet of worksheets) {
            const headerRow = worksheet.getRow(1);
            if (!headerRow || headerRow.cellCount === 0) continue;

            const headerIndex = new Map();
            for (let c = 1; c <= headerRow.cellCount; c += 1) {
                const h = headerRow.getCell(c).value;
                const key = String(h ?? '').trim();
                if (key !== '') headerIndex.set(key.toLowerCase(), c);
            }

            const keyColIdx = headerIndex.get(String(templateKeyField).toLowerCase());
            if (keyColIdx === undefined) {
                // This sheet doesn't have the key column; skip it without altering.
                continue;
            }

            // Pre-resolve target column indices; only update columns that exist in this sheet.
            const resolvedMappings = fieldMappings
                .map((m) => {
                    const sourceField = m.source;
                    const targetField = m.target;
                    const targetIdx = headerIndex.get(String(targetField).toLowerCase());
                    return targetIdx === undefined ? null : { sourceField, targetField, targetIdx };
                })
                .filter(Boolean);

            // Iterate data rows starting from row 2.
            for (let r = 2; r <= worksheet.rowCount; r += 1) {
                totalRowsScanned += 1;
                const row = worksheet.getRow(r);
                const rawKey = row.getCell(keyColIdx).value;
                const k = ExcelFile._normalizeKey(rawKey);
                if (k === null) continue;

                const sourceRecord = sourceMap.get(k);
                if (!sourceRecord) continue;
                matchedRows += 1;

                for (const m of resolvedMappings) {
                    if (sourceRecord[m.sourceField] === undefined) continue;
                    // Keep style/design by only changing value on existing cells.
                    row.getCell(m.targetIdx).value = sourceRecord[m.sourceField];
                    updatedCells += 1;
                }
            }
        }

        return {
            totalSheets: worksheets.length,
            totalRowsScanned,
            matchedRows,
            updatedCells
        };
    }

    // Find matching records based on key field
    findMatches(sourceData, sourceKeyField, templateKeyField = sourceKeyField) {
        const matches = [];
        const sourceMap = new Map();

        // Create a map of source data for quick lookup
        sourceData.forEach(record => {
            const k = ExcelFile._normalizeKey(record[sourceKeyField]);
            if (k !== null) {
                sourceMap.set(k, record);
            }
        });

        // Find matching records in template
        this.data.forEach(templateRecord => {
            const k = ExcelFile._normalizeKey(templateRecord[templateKeyField]);
            if (k !== null) {
                const sourceRecord = sourceMap.get(k);
                if (sourceRecord) {
                    matches.push({
                        template: templateRecord,
                        source: sourceRecord
                    });
                }
            }
        });

        return matches;
    }

    // Update template data with source data
    updateData(matches, fieldMappings) {
        const updatedData = [...this.data];

        matches.forEach(match => {
            const templateIndex = updatedData.findIndex(
                record => record === match.template
            );

            if (templateIndex !== -1) {
                // Update fields based on mappings
                fieldMappings.forEach(mapping => {
                    const sourceField = mapping.source;
                    const targetField = mapping.target;
                    
                    if (match.source[sourceField] !== undefined) {
                        updatedData[templateIndex][targetField] = match.source[sourceField];
                    }
                });
            }
        });

        this.data = updatedData;
        return updatedData;
    }

    // Save updated data to new Excel file
    async saveUpdatedFile(outputPath) {
        try {
            await this.workbook.xlsx.writeFile(outputPath);
            return true;
        } catch (error) {
            console.error('Error saving updated file:', error);
            return false;
        }
    }
}

module.exports = ExcelFile;
