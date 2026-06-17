const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs-extra');

class ExcelFile {
    constructor(filePath) {
        this.filePath = filePath;
        this.workbook = new ExcelJS.Workbook();
        this.data = [];
        this.primarySheet = null;
    }

    async loadFile() {
        try {
            const extension = path.extname(this.filePath).toLowerCase();
            if (extension === '.csv') {
                await this.workbook.csv.readFile(this.filePath);
            } else {
                await this.workbook.xlsx.readFile(this.filePath);
            }
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

    getData() {
        return this.data;
    }

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
            if (keyColIdx === undefined) continue;

            const resolvedMappings = fieldMappings
                .map((m) => {
                    const sourceField = m.source;
                    const targetField = m.target;
                    const targetIdx = headerIndex.get(String(targetField).toLowerCase());
                    return targetIdx === undefined ? null : { sourceField, targetField, targetIdx };
                })
                .filter(Boolean);

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

    async saveUpdatedFile(outputPath) {
        try {
            await fs.ensureDir(path.dirname(outputPath));

            // Replace formula cells with their last calculated results to avoid
            // exceljs issues with shared formulas when writing files.
            try {
                this.workbook.eachSheet((worksheet) => {
                    worksheet.eachRow({ includeEmpty: true }, (row) => {
                        row.eachCell({ includeEmpty: true }, (cell) => {
                            try {
                                const val = cell.value;
                                if (val && typeof val === 'object') {
                                    const hasFormulaLike = ('formula' in val) || ('sharedFormula' in val) || ('master' in val) || (val.result !== undefined);
                                    if (hasFormulaLike) {
                                        const result = val.result !== undefined ? val.result : null;
                                        cell.value = result;
                                    }
                                }
                            } catch (e) {
                                // ignore per-cell errors
                            }
                        });
                    });
                });
            } catch (e) {
                console.warn('Failed to strip formulas before save:', e);
            }

            await this.workbook.xlsx.writeFile(outputPath);
            return true;
        } catch (error) {
            console.error('Error saving updated file via writeFile:', error);
            // Fallback: try writing buffer then saving via fs
            try {
                const buffer = await this.workbook.xlsx.writeBuffer();
                await fs.writeFile(outputPath, Buffer.from(buffer));
                console.log('Saved updated file via fallback buffer write:', outputPath);
                return true;
            } catch (err2) {
                console.error('Fallback buffer write failed:', err2);
                return false;
            }
        }
    }
}

module.exports = ExcelFile;
