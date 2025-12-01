// CSV Format Transformer - Main JavaScript File

class CSVTransformer {
    constructor() {
        this.selectedFormat = null;
        this.originalData = null;
        this.transformedData = null;
        this.statusUpdateData = null;
        this.cleanedBatchData = null;
        this.fileName = '';
        this.statistics = {};
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Format selection
        document.querySelectorAll('.format-option').forEach(option => {
            option.addEventListener('click', () => this.selectFormat(option));
        });

        // File upload
        const fileInput = document.getElementById('fileInput');
        const fileUpload = document.getElementById('fileUpload');
        
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Drag and drop
        fileUpload.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUpload.classList.add('dragover');
        });
        
        fileUpload.addEventListener('dragleave', () => {
            fileUpload.classList.remove('dragover');
        });
        
        fileUpload.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUpload.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.processFile(files[0]);
            }
        });

        // Transform button
        document.getElementById('transformBtn').addEventListener('click', () => {
            this.transformFile();
        });

        // Download buttons
        document.getElementById('downloadStatusBtn').addEventListener('click', () => {
            this.downloadStatusUpdate();
        });

        document.getElementById('downloadCleanedBtn').addEventListener('click', () => {
            this.downloadCleanedBatch();
        });

        // Preview tabs
        document.querySelectorAll('.preview-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchPreviewTab(tab));
        });
    }

    selectFormat(option) {
        // Remove previous selection
        document.querySelectorAll('.format-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // Select new format
        option.classList.add('selected');
        this.selectedFormat = option.dataset.format;
        
        // Enable transform button if file is loaded
        this.updateTransformButton();
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    async processFile(file) {
        if (!file.name.toLowerCase().endsWith('.csv')) {
            this.showError('Please select a valid CSV file.');
            return;
        }

        try {
            const text = await file.text();
            this.originalData = this.parseCSV(text);
            this.fileName = file.name;
            
            this.displayFileInfo(file);
            this.updateTransformButton();
            this.hideError();
            
            // Show preview of original data
            this.showPreview('original');
            
        } catch (error) {
            this.showError('Error reading file: ' + error.message);
        }
    }

    parseCSV(text) {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length === 0) return { headers: [], data: [] };
        
        const headers = this.parseCSVLine(lines[0]);
        const data = lines.slice(1).map(line => this.parseCSVLine(line));
        
        return { headers, data };
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }

    displayFileInfo(file) {
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        const rowCount = document.getElementById('rowCount');
        
        fileName.textContent = `File: ${file.name}`;
        fileSize.textContent = `Size: ${this.formatFileSize(file.size)}`;
        rowCount.textContent = `Rows: ${this.originalData.data.length}`;
        
        fileInfo.classList.add('show');
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    updateTransformButton() {
        const transformBtn = document.getElementById('transformBtn');
        transformBtn.disabled = !(this.selectedFormat && this.originalData);
    }

    async transformFile() {
        if (!this.selectedFormat || !this.originalData) {
            this.showError('Please select a format and upload a file.');
            return;
        }

        this.showLoading(true);
        
        try {
            // Simulate processing time for large files
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (this.selectedFormat === 'returned') {
                const result = this.applyReturnedBatchTransformation();
                this.statusUpdateData = result.statusUpdate;
                this.cleanedBatchData = result.cleanedBatch;
                this.statistics = result.statistics;
                
                this.showStatistics();
                this.showDualPreview();
                this.showDualDownloadButtons();
            } else {
                this.transformedData = this.applyTransformation();
                this.showPreview('transformed');
                this.showDownloadButton();
            }
            
            this.hideError();
            
        } catch (error) {
            this.showError('Error transforming file: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    applyTransformation() {
        const { headers, data } = this.originalData;
        
        switch (this.selectedFormat) {
            case 'batch':
                return this.transformBatch(headers, data);
            case 'dialer':
                return this.transformDialer(headers, data);
            case 'import':
                return this.transformImport(headers, data);
            default:
                throw new Error('Unknown format selected');
        }
    }

    applyReturnedBatchTransformation() {
        const { headers, data } = this.originalData;
        
        // Step 1: Delete columns after REL6: Phone 2 (keep REL6: Phone 2 column)
        const rel6Phone2Index = this.findColumnIndex(headers, 'REL6: Phone 2');
        if (rel6Phone2Index === -1) {
            throw new Error('Could not find REL6: Phone 2 column');
        }
        
        let currentHeaders = headers.slice(0, rel6Phone2Index + 1);
        let currentData = data.map(row => row.slice(0, rel6Phone2Index + 1));
        
        // Step 2: Delete unnecessary columns
        const columnsToDelete = this.getColumnsToDelete(currentHeaders);
        const { headers: filteredHeaders, data: filteredData } = this.deleteColumns(currentHeaders, currentData, columnsToDelete);
        
        // Step 3: Process deceased records
        const deceasedIndex = this.findColumnIndex(filteredHeaders, 'DEC: Deceased (Y/N/U)');
        const ssnIndex = this.findColumnIndex(filteredHeaders, 'INPUT: SSN');
        
        if (deceasedIndex === -1 || ssnIndex === -1) {
            throw new Error('Could not find required columns for deceased processing');
        }
        
        const deceasedRows = filteredData.filter(row => row[deceasedIndex] === 'Y');
        const nonDeceasedData = filteredData.filter(row => row[deceasedIndex] !== 'Y');
        
        // Step 4: Process bankruptcy records
        const bankruptcyIndex = this.findColumnIndex(filteredHeaders, 'BNK: Bankrupt (Y/N/U)');
        
        if (bankruptcyIndex === -1) {
            throw new Error('Could not find bankruptcy column');
        }
        
        const bankruptcyRows = nonDeceasedData.filter(row => row[bankruptcyIndex] === 'Y');
        const cleanData = nonDeceasedData.filter(row => row[bankruptcyIndex] !== 'Y');
        
        // Create STATUS UPDATE data
        const statusUpdateData = [];
        deceasedRows.forEach(row => {
            statusUpdateData.push([row[ssnIndex], 'Deceased']);
        });
        bankruptcyRows.forEach(row => {
            statusUpdateData.push([row[ssnIndex], 'Bankruptcy']);
        });
        
        // Remove deceased and bankruptcy columns from clean data
        const finalHeaders = filteredHeaders.filter((_, index) => index !== deceasedIndex && index !== bankruptcyIndex);
        const finalData = cleanData.map(row => 
            row.filter((_, index) => index !== deceasedIndex && index !== bankruptcyIndex)
        );
        
        // Step 5: Merge Owner2 name columns
        const owner2FirstNameIndex = this.findColumnIndex(finalHeaders, 'PROP: Owner2 First Name');
        const owner2MiddleIndex = this.findColumnIndex(finalHeaders, 'PROP: Owner2 Middle Initial');
        const owner2LastNameIndex = this.findColumnIndex(finalHeaders, 'PROP: Owner2 Last Name');
        
        if (owner2FirstNameIndex !== -1 && owner2MiddleIndex !== -1 && owner2LastNameIndex !== -1) {
            const mergedData = finalData.map(row => {
                const newRow = [...row];
                const firstName = row[owner2FirstNameIndex] || '';
                const middle = row[owner2MiddleIndex] || '';
                const lastName = row[owner2LastNameIndex] || '';
                const fullName = [firstName, middle, lastName].filter(n => n).join(' ');
                newRow[owner2FirstNameIndex] = fullName;
                return newRow;
            });
            
            // Remove middle and last name columns
            const owner2Headers = finalHeaders.filter((_, index) => index !== owner2MiddleIndex && index !== owner2LastNameIndex);
            const owner2Data = mergedData.map(row => 
                row.filter((_, index) => index !== owner2MiddleIndex && index !== owner2LastNameIndex)
            );
            
            // Step 6: Merge vehicle columns
            const vehicleYearIndex = this.findColumnIndex(owner2Headers, 'VEHICLE: Model Year');
            const vehicleMakeIndex = this.findColumnIndex(owner2Headers, 'VEHICLE: Make');
            const vehicleModelIndex = this.findColumnIndex(owner2Headers, 'VEHICLE: Model');
            
            if (vehicleYearIndex !== -1 && vehicleMakeIndex !== -1 && vehicleModelIndex !== -1) {
                const vehicleData = owner2Data.map(row => {
                    const newRow = [...row];
                    const year = row[vehicleYearIndex] || '';
                    const make = row[vehicleMakeIndex] || '';
                    const model = row[vehicleModelIndex] || '';
                    const vehicleInfo = [year, make, model].filter(v => v).join(' ');
                    newRow[vehicleYearIndex] = vehicleInfo;
                    return newRow;
                });
                
                // Remove make and model columns
                const finalCleanedHeaders = owner2Headers.filter((_, index) => index !== vehicleMakeIndex && index !== vehicleModelIndex);
                const finalCleanedData = vehicleData.map(row => 
                    row.filter((_, index) => index !== vehicleMakeIndex && index !== vehicleModelIndex)
                );
                
                return {
                    statusUpdate: { headers: ['Social', 'Status'], data: statusUpdateData },
                    cleanedBatch: { headers: finalCleanedHeaders, data: finalCleanedData },
                    statistics: {
                        totalOriginal: data.length,
                        deceased: deceasedRows.length,
                        bankruptcy: bankruptcyRows.length,
                        totalStatus: statusUpdateData.length,
                        remaining: finalCleanedData.length
                    }
                };
            }
        }
        
        return {
            statusUpdate: { headers: ['Social', 'Status'], data: statusUpdateData },
            cleanedBatch: { headers: finalHeaders, data: finalData },
            statistics: {
                totalOriginal: data.length,
                deceased: deceasedRows.length,
                bankruptcy: bankruptcyRows.length,
                totalStatus: statusUpdateData.length,
                remaining: finalData.length
            }
        };
    }

    getColumnsToDelete(headers) {
        const columnsToDelete = [];
        
        // Single columns to delete
        const singleColumns = ['A', 'B', 'D', 'E', 'F', 'G', 'H', 'J', 'L', 'M', 'N', 'P', 'Q', 'R', 'T', 'U', 'V', 'X', 'Y', 'AA', 'AB', 'AD', 'AE'];
        
        // Columns to keep (relative information)
        const columnsToKeep = [
            { start: 'JC', end: 'JG' },  // Rel 1: Full Name through Zip
            { start: 'JI', end: 'JJ' },  // Rel 1: Phone 1 & Phone 2 (skip age at JH)
            { start: 'JT', end: 'JX' },  // Rel 2: Full Name through Zip
            { start: 'JZ', end: 'KA' },  // Rel 2: Phone 1 & Phone 2 (skip age at JY)
            { start: 'KK', end: 'KO' },  // Rel 3: Full Name through Zip
            { start: 'KQ', end: 'KR' },  // Rel 3: Phone 1 & Phone 2 (skip age at KP)
            { start: 'LB', end: 'LF' },  // Rel 4: Full Name through Zip
            { start: 'LH', end: 'LI' },  // Rel 4: Phone 1 & Phone 2 (skip age at LG)
            { start: 'LS', end: 'LW' },  // Rel 5: Full Name through Zip
            { start: 'LY', end: 'LZ' },  // Rel 5: Phone 1 & Phone 2 (skip age at LX)
            { start: 'MF', end: 'MN' },  // Rel 6: Full Name through Zip (MF-MN as specified)
            { start: 'MP', end: 'MQ' }   // Rel 6: Phone 1 & Phone 2 (skip age at MO)
        ];
        
        // Range columns to delete (modified to exclude relative columns)
        const rangeColumns = [
            { start: 'AG', end: 'AQ' },
            { start: 'AS', end: 'BH' },
            { start: 'BJ', end: 'EG' },
            { start: 'EM', end: 'EQ' },
            { start: 'ET', end: 'EX' },
            { start: 'EZ', end: 'FC' },
            { start: 'FG', end: 'FJ' },
            { start: 'FL', end: 'GQ' },
            { start: 'GT', end: 'GV' },
            { start: 'GY', end: 'HA' },
            { start: 'HE', end: 'JB' },  // Split: stops before JC (Rel 1 Full Name)
            // JC-JG are kept (Rel 1: Full Name through Zip)
            { start: 'JH', end: 'JH' },  // Delete JH (Rel 1 Age)
            // JI-JJ are kept (Rel 1: Phone 1 & Phone 2)
            { start: 'JK', end: 'JS' },  // Delete Phone 3+, stops before JT
            // JT-JX are kept (Rel 2: Full Name through Zip)
            { start: 'JY', end: 'JY' },  // Delete JY (Rel 2 Age)
            // JZ-KA are kept (Rel 2: Phone 1 & Phone 2)
            { start: 'KB', end: 'KJ' },  // Delete Phone 3+, stops before KK
            // KK-KO are kept (Rel 3: Full Name through Zip)
            { start: 'KP', end: 'KP' },  // Delete KP (Rel 3 Age)
            // KQ-KR are kept (Rel 3: Phone 1 & Phone 2)
            { start: 'KS', end: 'LA' },  // Delete Phone 3+, stops before LB
            // LB-LF are kept (Rel 4: Full Name through Zip)
            { start: 'LG', end: 'LG' },  // Delete LG (Rel 4 Age)
            // LH-LI are kept (Rel 4: Phone 1 & Phone 2)
            { start: 'LJ', end: 'LR' },  // Delete Phone 3+, stops before LS
            // LS-LW are kept (Rel 5: Full Name through Zip)
            { start: 'LX', end: 'LX' },  // Delete LX (Rel 5 Age)
            // LY-LZ are kept (Rel 5: Phone 1 & Phone 2)
            { start: 'MA', end: 'ME' },  // Delete Phone 3+, stops before MF
            // MF-MN are kept (Rel 6: Full Name through Zip)
            { start: 'MO', end: 'MO' },  // Delete MO (Rel 6 Age)
            // MP-MQ are kept (Rel 6: Phone 1 & Phone 2)
            { start: 'MR', end: 'MR' }   // Delete MR and beyond (Rel 6: Phone 3+)
        ];
        
        // Convert column letters to indices
        singleColumns.forEach(col => {
            const index = this.columnLetterToIndex(col);
            if (index < headers.length) {
                columnsToDelete.push(index);
            }
        });
        
        rangeColumns.forEach(range => {
            const startIndex = this.columnLetterToIndex(range.start);
            const endIndex = this.columnLetterToIndex(range.end);
            for (let i = startIndex; i <= endIndex && i < headers.length; i++) {
                columnsToDelete.push(i);
            }
        });
        
        return [...new Set(columnsToDelete)].sort((a, b) => b - a); // Sort descending to delete from end
    }

    columnLetterToIndex(column) {
        let result = 0;
        for (let i = 0; i < column.length; i++) {
            result *= 26;
            result += column.charCodeAt(i) - 'A'.charCodeAt(0) + 1;
        }
        return result - 1; // Convert to 0-based index
    }

    deleteColumns(headers, data, columnIndices) {
        const newHeaders = headers.filter((_, index) => !columnIndices.includes(index));
        const newData = data.map(row => row.filter((_, index) => !columnIndices.includes(index)));
        return { headers: newHeaders, data: newData };
    }

    findColumnIndex(headers, headerName) {
        return headers.findIndex(header => header === headerName);
    }

    transformBatch(headers, data) {
        // Find phone_1 column index
        const phoneColumnIndex = headers.findIndex(header => 
            header.toLowerCase().includes('phone_1') || 
            header.toLowerCase().includes('phone1') ||
            header.toLowerCase().includes('phone')
        );
        
        // Filter out rows with phone numbers
        let filteredData = data;
        if (phoneColumnIndex !== -1) {
            filteredData = data.filter(row => {
                const phoneValue = row[phoneColumnIndex] || '';
                return !phoneValue.trim() || phoneValue.trim() === '';
            });
        }
        
        // Keep only columns up to column I (index 8)
        const maxColumns = Math.min(9, headers.length);
        const newHeaders = headers.slice(0, maxColumns);
        const newData = filteredData.map(row => row.slice(0, maxColumns));
        
        // Remove first two columns (A and B) and rename headers
        const finalHeaders = ['First Name', 'Last Name', 'SSN', 'Address', 'City', 'State', 'Zip'];
        const finalData = newData.map(row => {
            // Skip first two columns and take next 7 columns
            return row.slice(2, 9);
        });
        
        return { headers: finalHeaders, data: finalData };
    }

    transformDialer(headers, data) {
        // Step1lete columns after DT [phone_20]
        const dtIndex = this.findColumnIndex(headers, 'phone_20');
        if (dtIndex === -1) {
            throw new Error('Could not find DT column [phone_20]');
        }
        
        let currentHeaders = headers.slice(0, dtIndex + 1);
        let currentData = data.map(row => row.slice(0, dtIndex + 1));
        
        // Step 2: Keep only specific columns to the right of Column I [masked_debtor_ssn_last_four]
        const columnsToKeep = [
            'phone_20', 'phone_19', 'phone_18', 'phone_17', 'phone_16', 'phone_15', 'phone_14', 'phone_13', 'phone_12', 'phone_11', 'phone_10', 'phone_9', 'phone_8', 'phone_7', 'phone_6', 'phone_5', 'phone_4', 'phone_3', 'phone_2', 'phone_1'
        ];
        
        // Find indices of columns to keep
        const keepIndices = [];
        columnsToKeep.forEach(colName => {
            const index = this.findColumnIndex(currentHeaders, colName);
            if (index !== -1) {
                keepIndices.push(index);
            }
        });
        
        // Keep columns A through I plus the phone columns
        const ssnIndex = this.findColumnIndex(currentHeaders, 'masked_debtor_ssn_last_four');
        if (ssnIndex === -1) {
            throw new Error('Could not find Column I [masked_debtor_ssn_last_four]');
        }
        
        // Keep columns A through I (indices 0 to ssnIndex)
        const baseIndices = [];
        for (let i = 0; i <= ssnIndex; i++) {
            baseIndices.push(i);
        }
        
        // Combine base indices with phone column indices
        const allKeepIndices = [...new Set([...baseIndices, ...keepIndices])].sort((a, b) => a - b);
        
        // Filter headers and data
        const filteredHeaders = allKeepIndices.map(index => currentHeaders[index]);
        const filteredData = currentData.map(row => allKeepIndices.map(index => row[index]));
        
        // Step 3dd SSN: column and merge with masked_debtor_ssn_last_four
        const newSsnIndex = this.findColumnIndex(filteredHeaders, 'masked_debtor_ssn_last_four');
        const ssnData = filteredData.map(row => {
            const newRow = [...row];
            const ssnValue = row[newSsnIndex] || '';
            newRow[newSsnIndex] = `SSN: ${ssnValue}`;
            return newRow;
        });
        
        // Step 4dd DOB: column and merge with batch_dob
        const dobIndex = this.findColumnIndex(filteredHeaders, 'batch_dob');
        if (dobIndex !== -1) {
            const dobData = ssnData.map(row => {
                const newRow = [...row];
                const dobValue = row[dobIndex] || '';
                newRow[dobIndex] = `DOB: ${dobValue}`;
                return newRow;
            });
            
            // Step 5 Merge DOB and SSN columns with spacing
            const finalData = dobData.map(row => {
                const newRow = [...row];
                const dobValue = row[dobIndex] || '';
                const ssnValue = row[newSsnIndex] || '';
                const mergedValue = `${dobValue} - ${ssnValue}`;
                newRow[dobIndex] = mergedValue;
                return newRow;
            });
            
            // Remove the SSN column since itsnow merged with DOB
            const finalHeaders = filteredHeaders.filter((_, index) => index !== newSsnIndex);
            const finalDataWithoutSsn = finalData.map(row => 
                row.filter((_, index) => index !== newSsnIndex)
            );
            
            // Step 6 & 7: Merge columns E, F, G (City, State, Zip)
            const colEIndex = 4; // Column E (0-based index 4)
            const colFIndex = 5; // Column F (0-based index 5)
            const colGIndex = 6; // Column G (0-based index 6)
            
            if (colEIndex < finalHeaders.length && colFIndex < finalHeaders.length && colGIndex < finalHeaders.length) {
                const mergedData = finalDataWithoutSsn.map(row => {
                    const newRow = [...row];
                    const city = row[colEIndex] || '';
                    const state = row[colFIndex] || '';
                    const zip = row[colGIndex] || '';
                    const address = [city, state, zip].filter(part => part).join(', ');
                    newRow[colEIndex] = address;
                    return newRow;
                });
                
                // Remove columns F and G, keep column E with merged data
                const finalHeadersMerged = finalHeaders.filter((_, index) => index !== colFIndex && index !== colGIndex);
                const finalDataMerged = mergedData.map(row => 
                    row.filter((_, index) => index !== colFIndex && index !== colGIndex)
                );
                
                return { headers: finalHeadersMerged, data: finalDataMerged };
            }
            
            return { headers: finalHeaders, data: finalDataWithoutSsn };
        }
        
        return { headers: filteredHeaders, data: ssnData };
    }

    transformImport(headers, data) {
        // For import new, standardize and validate data
        const newHeaders = ['First Name', 'Last Name', 'SSN', 'Address', 'City', 'State', 'Zip', 'Phone', 'Email', 'Status'];
        
        const newData = data.map(row => {
            const firstName = this.standardizeName(this.findColumnValue(headers, row, ['first', 'fname', 'firstname']));
            const lastName = this.standardizeName(this.findColumnValue(headers, row, ['last', 'lname', 'lastname']));
            const ssn = this.formatSSN(this.findColumnValue(headers, row, ['ssn', 'social']));
            const address = this.findColumnValue(headers, row, ['address', 'addr']);
            const city = this.standardizeCity(this.findColumnValue(headers, row, ['city']));
            const state = this.standardizeState(this.findColumnValue(headers, row, ['state']));
            const zip = this.formatZip(this.findColumnValue(headers, row, ['zip', 'zipcode', 'postal']));
            const phone = this.formatPhone(this.findColumnValue(headers, row, ['phone', 'tel', 'telephone']));
            const email = this.findColumnValue(headers, row, ['email', 'e-mail']);
            
            // Validate data and set status
            const status = this.validateRow([firstName, lastName, ssn, address, city, state, zip]) ? 'VALID' : 'NEEDS_REVIEW';
            
            return [firstName, lastName, ssn, address, city, state, zip, phone, email, status];
        });
        
        return { headers: newHeaders, data: newData };
    }

    // Helper methods for transformations
    getPhonePriority(header) {
        const headerLower = header.toLowerCase();
        if (headerLower.includes('phone_1') || headerLower.includes('primary')) return 3;
        if (headerLower.includes('phone_2') || headerLower.includes('secondary')) return 2;
        if (headerLower.includes('phone') || headerLower.includes('tel')) return 1;
        return 0;
    }

    getNamePriority(header) {
        const headerLower = header.toLowerCase();
        if (headerLower.includes('first') || headerLower.includes('fname')) return 2;
        if (headerLower.includes('last') || headerLower.includes('lname')) return 1;
        return 0;
    }

    findColumnValue(headers, row, possibleNames) {
        for (const name of possibleNames) {
            const index = headers.findIndex(h => h.toLowerCase().includes(name));
            if (index !== -1 && row[index]) {
                return row[index];
            }
        }
        return '';
    }

    standardizeName(name) {
        if (!name) return '';
        return name.trim().toUpperCase();
    }

    formatSSN(ssn) {
        if (!ssn) return '';
        // Remove non-digits and format as XXX-XX-XXXX
        const digits = ssn.replace(/\D/g, '');
        if (digits.length === 9) {
            return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
        }
        return ssn;
    }

    standardizeCity(city) {
        if (!city) return '';
        return city.trim().toUpperCase();
    }

    standardizeState(state) {
        if (!state) return '';
        return state.trim().toUpperCase();
    }

    formatZip(zip) {
        if (!zip) return '';
        // Remove non-digits and ensure 5 digits
        const digits = zip.replace(/\D/g, '');
        if (digits.length >= 5) {
            return digits.slice(0, 5);
        }
        return zip;
    }

    formatPhone(phone) {
        if (!phone) return '';
        // Remove non-digits and format as (XXX) XXX-XXXX
        const digits = phone.replace(/\D/g, '');
        if (digits.length === 10) {
            return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        }
        return phone;
    }

    validateRow(row) {
        return row.slice(0, 7).some(field => field && field.trim() !== '');
    }

    showStatistics() {
        const stats = this.statistics;
        const totalPercentage = ((stats.totalStatus / stats.totalOriginal) * 100).toFixed(1);
        const deceasedPercentage = ((stats.deceased / stats.totalOriginal) * 100).toFixed(1);
        const bankruptcyPercentage = ((stats.bankruptcy / stats.totalOriginal) * 100).toFixed(1);
        
        const statisticsGrid = document.getElementById('statisticsGrid');
        statisticsGrid.innerHTML = `
            <div class="stat-item">
                <div class="stat-number">${stats.totalOriginal}</div>
                <div class="stat-label">Total Records</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.deceased}</div>
                <div class="stat-label">Deceased Records</div>
                <div class="stat-percentage">${deceasedPercentage}%</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.bankruptcy}</div>
                <div class="stat-label">Bankruptcy Records</div>
                <div class="stat-percentage">${bankruptcyPercentage}%</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.totalStatus}</div>
                <div class="stat-label">Total Status Records</div>
                <div class="stat-percentage">${totalPercentage}%</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.remaining}</div>
                <div class="stat-label">Records Remaining</div>
            </div>
        `;
        
        document.getElementById('statisticsSection').classList.add('show');
    }

    showDualPreview() {
        // Hide single preview
        document.getElementById('previewSection').style.display = 'none';
        
        // Show dual preview
        document.getElementById('dualPreview').style.display = 'grid';
        
        // Populate STATUS UPDATE table
        this.populateTable('statusUpdateTable', this.statusUpdateData);
        
        // Populate CLEANED BATCH table
        this.populateTable('cleanedBatchTable', this.cleanedBatchData);
    }

    populateTable(tableId, data) {
        const table = document.getElementById(tableId);
        
        let tableHTML = '<thead><tr>';
        data.headers.forEach(header => {
            tableHTML += `<th>${header}</th>`;
        });
        tableHTML += '</tr></thead><tbody>';
        
        // Show first 10 rows for preview
        data.data.slice(0, 10).forEach(row => {
            tableHTML += '<tr>';
            row.forEach(cell => {
                tableHTML += `<td>${cell || ''}</td>`;
            });
            tableHTML += '</tr>';
        });
        
        if (data.data.length > 10) {
            tableHTML += `<tr><td colspan="${data.headers.length}" style="text-align: center; color: #6b7280; font-style: italic;">
                ... and ${data.data.length - 10} more rows
            </td></tr>`;
        }
        
        tableHTML += '</tbody>';
        table.innerHTML = tableHTML;
    }

    showDualDownloadButtons() {
        document.getElementById('downloadStatusBtn').classList.add('show');
        document.getElementById('downloadCleanedBtn').classList.add('show');
    }

    downloadStatusUpdate() {
        if (!this.statusUpdateData) return;
        
        const csvContent = this.convertToCSV(this.statusUpdateData);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        link.href = URL.createObjectURL(blob);
        link.download = 'STATUS UPDATE.csv';
        link.click();
    }

    downloadCleanedBatch() {
        if (!this.cleanedBatchData) return;
        
        const csvContent = this.convertToCSV(this.cleanedBatchData);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        // Extract "batch" part from original filename and add "- CLEANED BATCH"
        let fileName = this.fileName;
        if (fileName.toLowerCase().includes('batch')) {
            const batchIndex = fileName.toLowerCase().indexOf('batch');
            const beforeBatch = fileName.substring(0, batchIndex + 5); // Include "batch"
            fileName = beforeBatch + ' - CLEANED BATCH.csv';
        } else {
            fileName = this.fileName.replace('.csv', '') + ' - CLEANED BATCH.csv';
        }
        
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
    }

    showPreview(type) {
        const previewSection = document.getElementById('previewSection');
        const previewTable = document.getElementById('previewTable');
        
        const data = type === 'original' ? this.originalData : this.transformedData;
        if (!data) return;
        
        // Create table
        let tableHTML = '<thead><tr>';
        data.headers.forEach(header => {
            tableHTML += `<th>${header}</th>`;
        });
        tableHTML += '</tr></thead><tbody>';
        
        // Show first 10 rows for preview
        data.data.slice(0, 10).forEach(row => {
            tableHTML += '<tr>';
            row.forEach(cell => {
                tableHTML += `<td>${cell || ''}</td>`;
            });
            tableHTML += '</tr>';
        });
        
        if (data.data.length > 10) {
            tableHTML += `<tr><td colspan="${data.headers.length}" style="text-align: center; color: #6b7280; font-style: italic;">
                ... and ${data.data.length - 10} more rows
            </td></tr>`;
        }
        
        tableHTML += '</tbody>';
        previewTable.innerHTML = tableHTML;
        
        previewSection.style.display = 'block';
        
        // Update active tab
        document.querySelectorAll('.preview-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${type}"]`).classList.add('active');
    }

    switchPreviewTab(tab) {
        document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const type = tab.dataset.tab;
        this.showPreview(type);
    }

    showDownloadButton() {
        // For regular formats, just trigger the download immediately
        this.downloadFile();
    }

    downloadFile() {
        if (!this.transformedData) return;
        const csvContent = this.convertToCSV(this.transformedData);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        let fileName = this.fileName.replace('.csv', '');
        if (this.selectedFormat === 'dialer') {
            fileName += ' - Dialer Ready.csv';
        } else {
            fileName += '_' + this.selectedFormat.toUpperCase() + '.csv';
        }
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
    }

    convertToCSV(data) {
        const { headers, data: rows } = data;
        
        // Escape and quote headers
        const headerRow = headers.map(header => `"${header.replace(/"/g, '""')}"`).join(',');
        
        // Convert data rows
        const dataRows = rows.map(row => {
            return row.map(cell => {
                const cellStr = String(cell || '');
                return `"${cellStr.replace(/"/g, '""')}"`;
            }).join(',');
        });
        
        return [headerRow, ...dataRows].join('\n');
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (show) {
            loading.classList.add('show');
        } else {
            loading.classList.remove('show');
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
    }

    hideError() {
        document.getElementById('errorMessage').classList.remove('show');
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CSVTransformer();
}); 
