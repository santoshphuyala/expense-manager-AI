// backup.js - COMPLETE VERSION - Shopping List Single Sheet Export
// Expense Tracker Pro - Full Backup & Restore System
// Version 3.0 - Fixed Shopping List Excel Export

class BackupManager {
    constructor() {
        this.dbName = 'ExpenseTrackerProDB';
        this.version = 3;
        this.detectedStores = [];
        this.storeDataCache = {};
        
        this.knownStores = [
            'transactions',
            'categories',
            'recurring',
            'bills',
            'splits',
            'currencies',
            'settings',
            'shopping_lists',
            'shopping_templates',
            'subscriptions',
            'wishlist',
            'documents',
            'receipts',
            'insights',
            'notifications'
        ];
        
        this.uiToStoreMapping = {
            'transactions': 'transactions',
            'transaction': 'transactions',
            'categories': 'categories',
            'category': 'categories',
            'recurring': 'recurring',
            'recurringtransactions': 'recurring',
            'recurring-transactions': 'recurring',
            'bills': 'bills',
            'bill': 'bills',
            'splits': 'splits',
            'split': 'splits',
            'shopping_lists': 'shopping_lists',
            'shoppinglists': 'shopping_lists',
            'shopping-lists': 'shopping_lists',
            'shoppinglist': 'shopping_lists',
            'shopping': 'shopping_lists',
            'shopping_templates': 'shopping_templates',
            'shoppingtemplates': 'shopping_templates',
            'shopping-templates': 'shopping_templates',
            'subscriptions': 'subscriptions',
            'subscription': 'subscriptions',
            'wishlist': 'wishlist',
            'wish-list': 'wishlist',
            'documents': 'documents',
            'document': 'documents',
            'receipts': 'receipts',
            'receipt': 'receipts',
            'insights': 'insights',
            'insight': 'insights',
            'notifications': 'notifications',
            'notification': 'notifications',
            'currencies': 'currencies',
            'currency': 'currencies',
            'settings': 'settings',
            'setting': 'settings'
        };
        
        this.moduleConfig = {
            transactions: ['date', 'amount', 'description'],
            categories: ['name', 'type'],
            recurring: ['description', 'amount', 'frequency'],
            bills: ['name', 'dueDate', 'amount'],
            splits: ['transactionId', 'category'],
            currencies: ['code', 'name'],
            settings: ['key'],
            shopping_lists: ['name', 'date'],
            shopping_templates: ['name'],
            subscriptions: ['name', 'nextBilling'],
            wishlist: ['name', 'price'],
            documents: ['name', 'uploadDate'],
            receipts: ['transactionId', 'date'],
            insights: ['type', 'date'],
            notifications: ['message', 'date']
        };
    }

    async openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                this.knownStores.forEach(storeName => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        if (storeName === 'currencies') {
                            db.createObjectStore(storeName, { keyPath: 'code' });
                        } else {
                            db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
                        }
                    }
                });
            };
        });
    }

    async discoverAllStores() {
        const db = await this.openDB();
        this.detectedStores = Array.from(db.objectStoreNames);
        db.close();
        
        console.log('📊 Detected Stores:', this.detectedStores);
        return this.detectedStores;
    }

    resolveStoreName(uiName) {
        if (!uiName) return null;
        
        const normalized = uiName.toLowerCase().trim().replace(/[-_\s]/g, '');
        
        if (this.uiToStoreMapping[uiName.toLowerCase()]) {
            return this.uiToStoreMapping[uiName.toLowerCase()];
        }
        
        for (const [key, value] of Object.entries(this.uiToStoreMapping)) {
            if (key.replace(/[-_\s]/g, '') === normalized) {
                return value;
            }
        }
        
        const partialMatch = this.knownStores.find(store => 
            store.replace(/[-_\s]/g, '').includes(normalized) ||
            normalized.includes(store.replace(/[-_\s]/g, ''))
        );
        
        if (partialMatch) return partialMatch;
        
        console.warn(`⚠️ Could not resolve store name for: ${uiName}`);
        return uiName;
    }

    async getAllData(storeName) {
        const resolvedStore = this.resolveStoreName(storeName);
        if (!resolvedStore) {
            console.error(`❌ Cannot resolve store: ${storeName}`);
            return [];
        }

        const db = await this.openDB();
        
        return new Promise((resolve, reject) => {
            try {
                if (!db.objectStoreNames.contains(resolvedStore)) {
                    console.warn(`⚠️ Store "${resolvedStore}" does not exist`);
                    db.close();
                    resolve([]);
                    return;
                }
                
                const transaction = db.transaction(resolvedStore, 'readonly');
                const store = transaction.objectStore(resolvedStore);
                const request = store.getAll();
                
                request.onsuccess = () => {
                    const data = request.result || [];
                    console.log(`✅ ${resolvedStore}: Retrieved ${data.length} items`);
                    db.close();
                    resolve(data);
                };
                
                request.onerror = () => {
                    console.error(`❌ Error reading ${resolvedStore}:`, request.error);
                    db.close();
                    resolve([]);
                };
                
            } catch (error) {
                console.error(`❌ Exception in getAllData for ${resolvedStore}:`, error);
                db.close();
                resolve([]);
            }
        });
    }

    async scanDatabase() {
        console.log('🔍 Scanning database...');
        const stores = await this.discoverAllStores();
        this.storeDataCache = {};
        
        for (const storeName of stores) {
            const data = await this.getAllData(storeName);
            this.storeDataCache[storeName] = data;
            console.log(`📦 ${storeName}: ${data.length} items`);
        }
        
        return this.storeDataCache;
    }

    async clearStore(storeName) {
        const resolvedStore = this.resolveStoreName(storeName);
        const db = await this.openDB();
        
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction(resolvedStore, 'readwrite');
                const store = transaction.objectStore(resolvedStore);
                const request = store.clear();
                
                request.onsuccess = () => {
                    db.close();
                    resolve();
                };
                request.onerror = () => {
                    db.close();
                    reject(request.error);
                };
            } catch (error) {
                db.close();
                reject(error);
            }
        });
    }

    async addData(storeName, data) {
        if (!Array.isArray(data) || data.length === 0) return 0;
        
        const resolvedStore = this.resolveStoreName(storeName);
        const db = await this.openDB();
        
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction(resolvedStore, 'readwrite');
                const store = transaction.objectStore(resolvedStore);
                let addedCount = 0;
                
                data.forEach(item => {
                    const itemCopy = { ...item };
                    
                    if (resolvedStore !== 'currencies') {
                        delete itemCopy.id;
                    }
                    
                    try {
                        const request = store.add(itemCopy);
                        request.onsuccess = () => addedCount++;
                    } catch (e) {
                        console.warn(`Failed to add item:`, e);
                    }
                });
                
                transaction.oncomplete = () => {
                    db.close();
                    resolve(addedCount);
                };
                transaction.onerror = () => {
                    db.close();
                    reject(transaction.error);
                };
            } catch (error) {
                db.close();
                reject(error);
            }
        });
    }

    async updateData(storeName, data) {
        if (!Array.isArray(data) || data.length === 0) return;
        
        const resolvedStore = this.resolveStoreName(storeName);
        const db = await this.openDB();
        
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction(resolvedStore, 'readwrite');
                const store = transaction.objectStore(resolvedStore);
                
                data.forEach(item => {
                    if (item.id || item.code) {
                        store.put(item);
                    }
                });
                
                transaction.oncomplete = () => {
                    db.close();
                    resolve();
                };
                transaction.onerror = () => {
                    db.close();
                    reject(transaction.error);
                };
            } catch (error) {
                db.close();
                reject(error);
            }
        });
    }

    // ==================== EXPORT JSON ====================
    
    async exportFullBackupJSON() {
        try {
            console.log('📦 Starting Full JSON Export...');
            
            await this.scanDatabase();
            
            const backupData = {
                appName: 'Expense Tracker Pro',
                dbName: this.dbName,
                version: this.version,
                exportDate: new Date().toISOString(),
                stores: this.detectedStores,
                data: this.storeDataCache
            };

            let totalItems = 0;
            Object.values(this.storeDataCache).forEach(data => {
                totalItems += data.length;
            });

            console.log(`📊 Export Summary: ${this.detectedStores.length} stores, ${totalItems} items`);

            const blob = new Blob([JSON.stringify(backupData, null, 2)], { 
                type: 'application/json' 
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `expense_tracker_backup_${this.getFormattedDate()}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            this.showNotification(
                `✅ Backup complete! ${this.detectedStores.length} stores, ${totalItems} items`, 
                'success'
            );
            
            return backupData;
        } catch (error) {
            console.error('❌ Export failed:', error);
            this.showNotification('❌ Export failed: ' + error.message, 'error');
            throw error;
        }
    }

    async exportModuleJSON(moduleName) {
        try {
            console.log(`📦 Exporting module: ${moduleName}`);
            
            const resolvedName = this.resolveStoreName(moduleName);
            if (!resolvedName) {
                throw new Error(`Cannot resolve module name: ${moduleName}`);
            }
            
            const moduleData = await this.getAllData(resolvedName);
            
            if (!moduleData || moduleData.length === 0) {
                this.showNotification(
                    `⚠️ ${this.formatModuleName(resolvedName)} has no data to export`, 
                    'warning'
                );
                return null;
            }
            
            const backupData = {
                appName: 'Expense Tracker Pro',
                dbName: this.dbName,
                module: resolvedName,
                exportDate: new Date().toISOString(),
                count: moduleData.length,
                data: moduleData
            };

            const blob = new Blob([JSON.stringify(backupData, null, 2)], { 
                type: 'application/json' 
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${resolvedName}_${this.getFormattedDate()}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            this.showNotification(
                `✅ ${this.formatModuleName(resolvedName)} exported: ${moduleData.length} items`, 
                'success'
            );
            
            return moduleData;
        } catch (error) {
            console.error('❌ Module export failed:', error);
            this.showNotification('❌ Export failed: ' + error.message, 'error');
            throw error;
        }
    }

    // ==================== EXPORT EXCEL ====================
    
    createShoppingListSingleSheet(workbook, shoppingLists) {
        const flattenedData = [];
        
        shoppingLists.forEach(list => {
            if (list.items && Array.isArray(list.items) && list.items.length > 0) {
                list.items.forEach(item => {
                    flattenedData.push({
                        'List ID': list.id || '',
                        'List Name': list.name || '',
                        'List Date': list.date || '',
                        'Store': list.store || '',
                        'List Category': list.category || '',
                        'Budget': list.budget || 0,
                        'List Completed': list.completed ? 'Yes' : 'No',
                        'Created At': list.createdAt || '',
                        'Item ID': item.id || '',
                        'Item Name': item.name || '',
                        'Quantity': item.quantity || 0,
                        'Unit': item.unit || '',
                        'Estimated Price': item.estimatedPrice || 0,
                        'Actual Price': item.actualPrice || 0,
                        'Item Category': item.category || '',
                        'Notes': item.notes || '',
                        'Priority': item.priority ? 'Yes' : 'No',
                        'Purchased': item.purchased ? 'Yes' : 'No',
                        'Purchased Date': item.purchasedDate || ''
                    });
                });
            } else {
                flattenedData.push({
                    'List ID': list.id || '',
                    'List Name': list.name || '',
                    'List Date': list.date || '',
                    'Store': list.store || '',
                    'List Category': list.category || '',
                    'Budget': list.budget || 0,
                    'List Completed': list.completed ? 'Yes' : 'No',
                    'Created At': list.createdAt || '',
                    'Item ID': '',
                    'Item Name': '(No Items)',
                    'Quantity': 0,
                    'Unit': '',
                    'Estimated Price': 0,
                    'Actual Price': 0,
                    'Item Category': '',
                    'Notes': '',
                    'Priority': 'No',
                    'Purchased': 'No',
                    'Purchased Date': ''
                });
            }
        });

        const worksheet = XLSX.utils.json_to_sheet(flattenedData);
        
        const cols = [
            { wch: 8 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
            { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 25 },
            { wch: 10 }, { wch: 8 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
            { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 15 }
        ];
        worksheet['!cols'] = cols;
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Shopping Lists');
        
        console.log(`✅ Added sheet: Shopping Lists (${flattenedData.length} rows)`);
        
        return {
            sheetsAdded: 1,
            itemsCount: flattenedData.length
        };
    }

    async exportFullBackupExcel() {
        try {
            if (typeof XLSX === 'undefined') {
                throw new Error('XLSX library not loaded. Please include SheetJS in your HTML.');
            }

            console.log('📊 Starting Full Excel Export...');
            
            await this.scanDatabase();
            
            const workbook = XLSX.utils.book_new();
            let totalItems = 0;
            let sheetsAdded = 0;

            for (const [storeName, data] of Object.entries(this.storeDataCache)) {
                console.log(`📋 Processing ${storeName}: ${data.length} items`);
                
                if (data && data.length > 0) {
                    try {
                        if (storeName === 'shopping_lists') {
                            const result = this.createShoppingListSingleSheet(workbook, data);
                            sheetsAdded += result.sheetsAdded;
                            totalItems += result.itemsCount;
                        } else {
                            const worksheet = XLSX.utils.json_to_sheet(data);
                            
                            let sheetName = storeName.replace(/_/g, ' ');
                            sheetName = sheetName.substring(0, 31);
                            
                            let counter = 1;
                            let finalSheetName = sheetName;
                            while (workbook.SheetNames.includes(finalSheetName)) {
                                finalSheetName = `${sheetName.substring(0, 28)} ${counter}`;
                                counter++;
                            }
                            
                            XLSX.utils.book_append_sheet(workbook, worksheet, finalSheetName);
                            
                            totalItems += data.length;
                            sheetsAdded++;
                            console.log(`✅ Added sheet: ${finalSheetName} (${data.length} items)`);
                        }
                    } catch (error) {
                        console.error(`❌ Failed to create sheet for ${storeName}:`, error);
                    }
                } else {
                    console.log(`⏭️ Skipping ${storeName} (no data)`);
                }
            }

            const metadata = [{
                'App Name': 'Expense Tracker Pro',
                'Database': this.dbName,
                'Version': this.version,
                'Export Date': new Date().toLocaleString(),
                'Total Stores': this.detectedStores.length,
                'Sheets Created': sheetsAdded,
                'Total Items': totalItems,
                'Stores': this.detectedStores.join(', ')
            }];
            
            const metaSheet = XLSX.utils.json_to_sheet(metadata);
            XLSX.utils.book_append_sheet(workbook, metaSheet, 'Backup Info');

            const fileName = `expense_tracker_backup_${this.getFormattedDate()}.xlsx`;
            XLSX.writeFile(workbook, fileName);
            
            console.log(`✅ Excel file created: ${fileName}`);
            console.log(`📊 Summary: ${sheetsAdded} sheets, ${totalItems} total items`);
            
            this.showNotification(
                `✅ Excel exported! ${sheetsAdded} sheets, ${totalItems} items`, 
                'success'
            );
            
        } catch (error) {
            console.error('❌ Excel export failed:', error);
            this.showNotification('❌ Excel export failed: ' + error.message, 'error');
            throw error;
        }
    }

    async exportModuleExcel(moduleName) {
        try {
            if (typeof XLSX === 'undefined') {
                throw new Error('XLSX library not loaded');
            }

            console.log(`📊 Exporting Excel for: ${moduleName}`);
            
            const resolvedName = this.resolveStoreName(moduleName);
            if (!resolvedName) {
                throw new Error(`Cannot resolve module name: ${moduleName}`);
            }
            
            const data = await this.getAllData(resolvedName);
            
            if (!data || data.length === 0) {
                this.showNotification(
                    `⚠️ ${this.formatModuleName(resolvedName)} has no data to export`, 
                    'warning'
                );
                return null;
            }

            const workbook = XLSX.utils.book_new();

            if (resolvedName === 'shopping_lists') {
                this.createShoppingListSingleSheet(workbook, data);
            } else {
                const worksheet = XLSX.utils.json_to_sheet(data);
                let sheetName = resolvedName.replace(/_/g, ' ').substring(0, 31);
                XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
            }

            const fileName = `${resolvedName}_${this.getFormattedDate()}.xlsx`;
            XLSX.writeFile(workbook, fileName);
            
            this.showNotification(
                `✅ ${this.formatModuleName(resolvedName)} exported to Excel`, 
                'success'
            );
            
            return data;
        } catch (error) {
            console.error('❌ Excel export failed:', error);
            this.showNotification('❌ Excel export failed: ' + error.message, 'error');
            throw error;
        }
    }

    // ==================== IMPORT OPERATIONS ====================
    
    compareItems(item1, item2, module) {
        const identifiers = this.moduleConfig[module] || ['name', 'id'];
        
        return identifiers.every(key => {
            const val1 = item1[key];
            const val2 = item2[key];
            
            if (key.includes('date') || key.includes('Date')) {
                if (val1 && val2) {
                    return new Date(val1).getTime() === new Date(val2).getTime();
                }
            }
            
            if (typeof val1 === 'number' && typeof val2 === 'number') {
                return Math.abs(val1 - val2) < 0.01;
            }
            
            if (typeof val1 === 'string' && typeof val2 === 'string') {
                return val1.trim().toLowerCase() === val2.trim().toLowerCase();
            }
            
            return val1 === val2;
        });
    }

    analyzeImportData(existingData, importData, module) {
        const analysis = {
            new: [],
            duplicates: [],
            updates: []
        };

        if (!Array.isArray(importData)) return analysis;

        importData.forEach(importItem => {
            const duplicate = existingData.find(existing => 
                this.compareItems(existing, importItem, module)
            );

            if (!duplicate) {
                analysis.new.push(importItem);
            } else {
                const isIdentical = JSON.stringify(duplicate) === JSON.stringify({ ...importItem, id: duplicate.id });
                
                if (isIdentical) {
                    analysis.duplicates.push({ existing: duplicate, import: importItem });
                } else {
                    analysis.updates.push({ existing: duplicate, import: importItem });
                }
            }
        });

        return analysis;
    }

    async analyzeFullImport(backupData) {
        const fullAnalysis = {};
        
        for (const [module, importData] of Object.entries(backupData.data)) {
            if (Array.isArray(importData) && importData.length > 0) {
                try {
                    const existingData = await this.getAllData(module);
                    fullAnalysis[module] = this.analyzeImportData(existingData, importData, module);
                } catch (error) {
                    console.warn(`Failed to analyze ${module}:`, error);
                    fullAnalysis[module] = {
                        new: importData,
                        duplicates: [],
                        updates: []
                    };
                }
            }
        }

        return fullAnalysis;
    }

    async importFullBackupJSON(file) {
        try {
            const fileContent = await this.readFile(file);
            const backupData = JSON.parse(fileContent);

            if (!backupData.data || typeof backupData.data !== 'object') {
                throw new Error('Invalid backup file format');
            }

            const analysis = await this.analyzeFullImport(backupData);
            this.showImportPreview(analysis, backupData, 'full', 'json');
            
        } catch (error) {
            console.error('Import failed:', error);
            this.showNotification('❌ Import failed: ' + error.message, 'error');
            throw error;
        }
    }

    async importModuleJSON(file, moduleName) {
        try {
            const fileContent = await this.readFile(file);
            const backupData = JSON.parse(fileContent);

            if (!backupData.data || !Array.isArray(backupData.data)) {
                throw new Error('Invalid module backup file');
            }

            const resolvedName = this.resolveStoreName(moduleName);
            const existingData = await this.getAllData(resolvedName);
            const analysis = this.analyzeImportData(existingData, backupData.data, resolvedName);
            
            this.showImportPreview(
                { [resolvedName]: analysis }, 
                { data: { [resolvedName]: backupData.data } },
                'module',
                'json',
                resolvedName
            );
            
        } catch (error) {
            console.error('Module import failed:', error);
            this.showNotification('❌ Import failed: ' + error.message, 'error');
            throw error;
        }
    }

    reconstructShoppingLists(flattenedData) {
        const listsMap = new Map();
        
        flattenedData.forEach(row => {
            const listId = row['List ID'];
            
            if (!listsMap.has(listId)) {
                listsMap.set(listId, {
                    id: listId,
                    name: row['List Name'],
                    date: row['List Date'],
                    store: row['Store'],
                    category: row['List Category'],
                    budget: row['Budget'],
                    completed: row['List Completed'] === 'Yes',
                    createdAt: row['Created At'],
                    items: []
                });
            }
            
            if (row['Item Name'] && row['Item Name'] !== '(No Items)') {
                listsMap.get(listId).items.push({
                    id: row['Item ID'],
                    name: row['Item Name'],
                    quantity: row['Quantity'],
                    unit: row['Unit'],
                    estimatedPrice: row['Estimated Price'],
                    actualPrice: row['Actual Price'],
                    category: row['Item Category'],
                    notes: row['Notes'],
                    priority: row['Priority'] === 'Yes',
                    purchased: row['Purchased'] === 'Yes',
                    purchasedDate: row['Purchased Date']
                });
            }
        });
        
        return Array.from(listsMap.values());
    }

    async importFullBackupExcel(file) {
        try {
            if (typeof XLSX === 'undefined') {
                throw new Error('XLSX library not loaded');
            }

            const data = await this.readFileAsArrayBuffer(file);
            const workbook = XLSX.read(data, { type: 'array' });

            console.log('📊 Excel sheets found:', workbook.SheetNames);

            const backupData = { data: {} };
            
            workbook.SheetNames.forEach(sheetName => {
                if (sheetName === 'Backup Info' || sheetName === 'Info' || sheetName === 'Metadata') {
                    return;
                }
                
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                
                if (jsonData.length > 0) {
                    const storeName = sheetName.toLowerCase().replace(/\s+/g, '_').trim();
                    const matchedStore = this.resolveStoreName(storeName) || storeName;
                    
                    if (matchedStore === 'shopping_lists') {
                        backupData.data[matchedStore] = this.reconstructShoppingLists(jsonData);
                    } else {
                        backupData.data[matchedStore] = jsonData;
                    }
                    
                    console.log(`✅ Loaded sheet "${sheetName}" as "${matchedStore}": ${jsonData.length} items`);
                }
            });

            const analysis = await this.analyzeFullImport(backupData);
            this.showImportPreview(analysis, backupData, 'full', 'excel');
            
        } catch (error) {
            console.error('Excel import failed:', error);
            this.showNotification('❌ Excel import failed: ' + error.message, 'error');
            throw error;
        }
    }

    async importModuleExcel(file, moduleName) {
        try {
            if (typeof XLSX === 'undefined') {
                throw new Error('XLSX library not loaded');
            }

            const data = await this.readFileAsArrayBuffer(file);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            let jsonData = XLSX.utils.sheet_to_json(worksheet);

            const resolvedName = this.resolveStoreName(moduleName);
            
            if (resolvedName === 'shopping_lists') {
                jsonData = this.reconstructShoppingLists(jsonData);
            }
            
            const existingData = await this.getAllData(resolvedName);
            const analysis = this.analyzeImportData(existingData, jsonData, resolvedName);
            
            this.showImportPreview(
                { [resolvedName]: analysis },
                { data: { [resolvedName]: jsonData } },
                'module',
                'excel',
                resolvedName
            );
            
        } catch (error) {
            console.error('Excel module import failed:', error);
            this.showNotification('❌ Import failed: ' + error.message, 'error');
            throw error;
        }
    }

    showImportPreview(analysis, backupData, importType, fileType, moduleName = null) {
        this.previewData = { analysis, backupData, importType, fileType, moduleName };
        
        let totalNew = 0;
        let totalDuplicates = 0;
        let totalUpdates = 0;
        
        Object.values(analysis).forEach(moduleAnalysis => {
            totalNew += moduleAnalysis.new.length;
            totalDuplicates += moduleAnalysis.duplicates.length;
            totalUpdates += moduleAnalysis.updates.length;
        });

        const existingModal = document.querySelector('.backup-modal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.className = 'backup-modal';
        modal.innerHTML = `
            <div class="backup-modal-content">
                <div class="backup-modal-header">
                    <h2>📊 Import Preview - ${importType === 'full' ? 'Full Backup' : this.formatModuleName(moduleName)}</h2>
                    <button class="backup-modal-close">&times;</button>
                </div>
                
                <div class="backup-modal-body">
                    <div class="import-summary">
                        <div class="summary-card new">
                            <div class="summary-icon">✨</div>
                            <div class="summary-info">
                                <div class="summary-number">${totalNew}</div>
                                <div class="summary-label">New Items</div>
                            </div>
                        </div>
                        <div class="summary-card duplicate">
                            <div class="summary-icon">📋</div>
                            <div class="summary-info">
                                <div class="summary-number">${totalDuplicates}</div>
                                <div class="summary-label">Duplicates</div>
                            </div>
                        </div>
                        <div class="summary-card update">
                            <div class="summary-icon">🔄</div>
                            <div class="summary-info">
                                <div class="summary-number">${totalUpdates}</div>
                                <div class="summary-label">Updates</div>
                            </div>
                        </div>
                    </div>

                    <div class="import-details">
                        ${this.renderAnalysisDetails(analysis)}
                    </div>

                    <div class="import-options">
                        <h3>Import Options:</h3>
                        <label class="option-radio">
                            <input type="radio" name="import-mode" value="replace" checked>
                            <span>🔄 Replace All - Delete existing data and import everything</span>
                        </label>
                        <label class="option-radio">
                            <input type="radio" name="import-mode" value="merge-skip">
                            <span>➕ Merge (Skip Duplicates) - Add only new items (${totalNew} items)</span>
                        </label>
                        <label class="option-radio">
                            <input type="radio" name="import-mode" value="merge-update">
                            <span>🔄 Merge (Update Duplicates) - Add new + update existing (${totalNew + totalUpdates} items)</span>
                        </label>
                    </div>
                </div>

                <div class="backup-modal-footer">
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-confirm">Proceed with Import</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.backup-modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
        modal.querySelector('.btn-confirm').addEventListener('click', () => {
            const mode = modal.querySelector('input[name="import-mode"]:checked').value;
            modal.remove();
            this.executeImport(mode);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    renderAnalysisDetails(analysis) {
        let html = '';
        
        Object.entries(analysis).forEach(([module, data]) => {
            const total = data.new.length + data.duplicates.length + data.updates.length;
            if (total === 0) return;

            html += `
                <div class="module-analysis">
                    <h4>📦 ${this.formatModuleName(module)}</h4>
                    <div class="module-stats">
                        <span class="stat-new">✨ ${data.new.length} new</span>
                        <span class="stat-duplicate">📋 ${data.duplicates.length} duplicates</span>
                        <span class="stat-update">🔄 ${data.updates.length} updates</span>
                    </div>
                </div>
            `;
        });

        return html || '<p class="no-data">No data to import</p>';
    }

    formatModuleName(module) {
        if (!module) return 'Unknown';
        return module
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }

    async executeImport(mode) {
        const { analysis, backupData, importType, moduleName } = this.previewData;
        
        try {
            this.showNotification('⏳ Importing data...', 'info');

            const modulesToProcess = moduleName ? [moduleName] : Object.keys(analysis);
            let successCount = 0;
            let errorCount = 0;

            for (const module of modulesToProcess) {
                if (!backupData.data[module] || !analysis[module]) continue;

                try {
                    const moduleAnalysis = analysis[module];

                    if (mode === 'replace') {
                        await this.clearStore(module);
                        await this.addData(module, backupData.data[module]);
                        successCount++;
                        
                    } else if (mode === 'merge-skip') {
                        if (moduleAnalysis.new.length > 0) {
                            await this.addData(module, moduleAnalysis.new);
                            successCount++;
                        }
                        
                    } else if (mode === 'merge-update') {
                        if (moduleAnalysis.new.length > 0) {
                            await this.addData(module, moduleAnalysis.new);
                        }
                        
                        if (moduleAnalysis.updates.length > 0) {
                            const itemsToUpdate = moduleAnalysis.updates.map(u => ({
                                ...u.import,
                                id: u.existing.id
                            }));
                            await this.updateData(module, itemsToUpdate);
                        }
                        
                        if (moduleAnalysis.new.length > 0 || moduleAnalysis.updates.length > 0) {
                            successCount++;
                        }
                    }
                } catch (error) {
                    errorCount++;
                    console.error(`❌ Failed to import ${module}:`, error);
                }
            }

            if (errorCount === 0) {
                this.showNotification(
                    `✅ Import completed! ${successCount} stores restored`, 
                    'success'
                );
            } else {
                this.showNotification(
                    `⚠️ Partial import: ${successCount} success, ${errorCount} errors`, 
                    'warning'
                );
            }

            setTimeout(() => location.reload(), 2000);
            
        } catch (error) {
            console.error('Import execution failed:', error);
            this.showNotification('❌ Import failed: ' + error.message, 'error');
            throw error;
        }
    }

    // ==================== UTILITIES ====================
    
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsArrayBuffer(file);
        });
    }

    getFormattedDate() {
        const now = new Date();
        return now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    }

    showNotification(message, type = 'info') {
        document.querySelectorAll('.backup-notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `backup-notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 100000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            animation: slideInRight 0.3s ease-out;
            max-width: 400px;
            font-size: 14px;
        `;

        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }
}

// ==================== HELPER UTILITIES ====================

const BackupHelper = {
    async inspectDatabase() {
        console.log('🔍 ========== DATABASE INSPECTION ==========');
        console.log('Database Name:', backupManager.dbName);
        console.log('Version:', backupManager.version);
        
        const data = await backupManager.scanDatabase();
        
        console.table(Object.entries(data).map(([name, items]) => ({
            Store: name,
            Count: items.length,
            Status: items.length > 0 ? '✅ Has Data' : '❌ Empty'
        })));
        
        return data;
    },

    async checkModule(moduleName) {
        const resolved = backupManager.resolveStoreName(moduleName);
        console.log(`🔍 Checking: "${moduleName}" → "${resolved}"`);
        
        const data = await backupManager.getAllData(resolved);
        console.log(`📊 Found ${data.length} items`);
        if (data.length > 0) {
            console.log('Sample:', data[0]);
        }
        return data;
    },

    findSections() {
        console.log('🔍 ========== SECTION DETECTION ==========');
        const sections = document.querySelectorAll('[id$="-section"], section, [data-section]');
        const found = Array.from(sections).map(s => ({
            ID: s.id || 'none',
            DataSection: s.getAttribute('data-section') || 'none',
            Classes: s.className
        }));
        console.table(found);
        return sections;
    },

    async testExport(moduleName) {
        console.log(`🧪 Testing export: ${moduleName}`);
        try {
            await backupManager.exportModuleJSON(moduleName);
        } catch (error) {
            console.error('❌ Export test failed:', error);
        }
    },

    showStores() {
        console.log('📦 Known Stores:');
        console.table(backupManager.knownStores);
    },

    showMappings() {
        console.log('🗺️ UI to Store Mappings:');
        console.table(backupManager.uiToStoreMapping);
    },

    async reinject() {
        console.log('🔄 Re-injecting buttons...');
        await autoInjectExportButtons();
    }
};

window.BackupHelper = BackupHelper;

// ==================== UI COMPONENTS ====================

function createModuleExportButton(moduleName) {
    const container = document.createElement('div');
    container.className = 'module-export-buttons';
    container.setAttribute('data-module-name', moduleName);
    
    container.innerHTML = `
        <style>
            .module-export-buttons {
                display: inline-flex;
                gap: 8px;
                align-items: center;
                margin-left: auto;
            }
            
            .export-actions-group {
                display: flex;
                gap: 8px;
                align-items: center;
            }
            
            .btn-quick-import-excel {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 8px 12px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                transition: all 0.2s;
            }
            
            .btn-quick-import-excel:hover {
                background: #2563eb;
                transform: translateY(-1px);
            }
            
            .export-dropdown {
                position: relative;
                display: inline-block;
            }
            
            .btn-export-module {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 8px 12px;
                background: #10b981;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                transition: all 0.2s;
            }
            
            .btn-export-module:hover {
                background: #059669;
            }
            
            .export-dropdown-content {
                display: none;
                position: absolute;
                right: 0;
                top: calc(100% + 4px);
                background: white;
                min-width: 220px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                border-radius: 8px;
                z-index: 1000;
                overflow: hidden;
            }
            
            .export-dropdown:hover .export-dropdown-content,
            .export-dropdown-content:hover {
                display: block;
            }
            
            .export-dropdown-content a {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 16px;
                color: #1f2937;
                text-decoration: none;
                transition: background 0.2s;
                font-size: 14px;
            }
            
            .export-dropdown-content a:hover {
                background: #f3f4f6;
            }
            
            .export-dropdown-content a span {
                font-size: 16px;
            }
        </style>
        
        <div class="export-actions-group">
            <button class="btn-quick-import-excel" data-module="${moduleName}" title="Quick Import Excel">
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                    <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
                </svg>
                Import
            </button>
            
            <div class="export-dropdown">
                <button class="btn-export-module">
                    <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                    </svg>
                    Export ▼
                </button>
                <div class="export-dropdown-content">
                    <a href="#" class="export-json" data-module="${moduleName}">
                        <span>📄</span> Export JSON
                    </a>
                    <a href="#" class="export-excel" data-module="${moduleName}">
                        <span>📊</span> Export Excel
                    </a>
                    <a href="#" class="import-json" data-module="${moduleName}">
                        <span>📥</span> Import JSON
                    </a>
                    <a href="#" class="import-excel" data-module="${moduleName}">
                        <span>📤</span> Import Excel
                    </a>
                </div>
            </div>
        </div>
    `;

    return container;
}

function createDashboardBackupUI() {
    const container = document.createElement('div');
    container.className = 'dashboard-backup-section';
    container.innerHTML = `
        <div class="backup-card">
            <h3>📦 Data Backup & Restore</h3>
            <p class="backup-description">Export all stores to Excel (multi-sheet) or JSON format</p>
            
            <div class="backup-quick-row">
                <button id="btn-quick-import-excel-dashboard" class="btn-quick-import-large">
                    <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                        <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
                    </svg>
                    <span class="btn-text">
                        <strong>Quick Import Excel</strong>
                        <small>Restore from backup</small>
                    </span>
                </button>
                
                <button id="btn-export-all-excel-dashboard" class="btn-quick-export-large">
                    <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                    </svg>
                    <span class="btn-text">
                        <strong>Quick Export Excel</strong>
                        <small>All data in one file</small>
                    </span>
                </button>
            </div>
            
            <div class="backup-grid">
                <div class="backup-column">
                    <h4>📥 Export Backup</h4>
                    <button id="btn-export-all-json" class="btn-primary">
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                            <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                        </svg>
                        Export All (JSON)
                    </button>
                    <button id="btn-export-all-excel" class="btn-primary">
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M5.884 6.68a.5.5 0 1 0-.768.64L7.349 10l-2.233 2.68a.5.5 0 0 0 .768.64L8 10.781l2.116 2.54a.5.5 0 0 0 .768-.641L8.651 10l2.233-2.68a.5.5 0 0 0-.768-.64L8 9.219l-2.116-2.54z"/>
                            <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/>
                        </svg>
                        Export All (Excel)
                    </button>
                </div>
                <div class="backup-column">
                    <h4>📤 Import Backup</h4>
                    <button id="btn-import-all-json" class="btn-secondary">
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                            <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
                        </svg>
                        Import All (JSON)
                    </button>
                    <button id="btn-import-all-excel" class="btn-secondary">
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M5.884 6.68a.5.5 0 1 0-.768.64L7.349 10l-2.233 2.68a.5.5 0 0 0 .768.64L8 10.781l2.116 2.54a.5.5 0 0 0 .768-.641L8.651 10l2.233-2.68a.5.5 0 0 0-.768-.64L8 9.219l-2.116-2.54z"/>
                            <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/>
                        </svg>
                        Import All (Excel)
                    </button>
                </div>
            </div>
            <input type="file" id="file-input-json" accept=".json" style="display: none;">
            <input type="file" id="file-input-excel" accept=".xlsx,.xls" style="display: none;">
            <input type="file" id="file-input-excel-dashboard-quick" accept=".xlsx,.xls" style="display: none;">
        </div>
    `;

    return container;
}

// ==================== AUTO-INJECTION ====================

async function autoInjectExportButtons() {
    try {
        await backupManager.discoverAllStores();
        
        console.log('🔍 Starting auto-injection...');
        
        const dashboard = document.querySelector('#dashboard');
        if (dashboard && !document.querySelector('.dashboard-backup-section')) {
            const backupUI = createDashboardBackupUI();
            const quickActions = dashboard.querySelector('.quick-actions');
            if (quickActions) {
                quickActions.after(backupUI);
            } else {
                dashboard.insertBefore(backupUI, dashboard.firstChild);
            }
            console.log('✅ Dashboard UI added');
            attachDashboardListeners();
        }
        
        const sectionMappings = {
            'shopping_lists': ['#shopping-section', '#shopping-list-section', '#shoppingList-section'],
            'shopping_templates': ['#shopping-templates-section', '#templates-section'],
            'transactions': ['#transactions-section', '#transaction-section'],
            'subscriptions': ['#subscriptions-section', '#subscription-section'],
            'recurring': ['#recurring-section', '#recurring-transactions-section'],
            'bills': ['#bills-section', '#bill-section'],
            'categories': ['#categories-section', '#category-section'],
            'wishlist': ['#wishlist-section', '#wish-list-section'],
            'documents': ['#documents-section', '#document-section'],
            'receipts': ['#receipts-section', '#receipt-section'],
            'insights': ['#insights-section', '#insight-section'],
            'notifications': ['#notifications-section', '#notification-section'],
            'currencies': ['#currencies-section', '#currency-section'],
            'settings': ['#settings-section', '#setting-section'],
            'splits': ['#splits-section', '#split-section']
        };
        
        for (const storeName of backupManager.detectedStores) {
            const selectors = sectionMappings[storeName] || [`#${storeName}-section`];
            let injected = false;
            
            for (const selector of selectors) {
                const section = document.querySelector(selector);
                
                if (section && !section.querySelector('.module-export-buttons')) {
                    const button = createModuleExportButton(storeName);
                    
                    const header = section.querySelector('.section-header, .module-header, header, .header');
                    const actions = section.querySelector('.section-actions, .header-actions, .actions');
                    
                    if (actions) {
                        actions.appendChild(button);
                    } else if (header) {
                        header.style.display = 'flex';
                        header.style.justifyContent = 'space-between';
                        header.style.alignItems = 'center';
                        header.appendChild(button);
                    } else {
                        section.insertBefore(button, section.firstChild);
                    }
                    
                    console.log(`✅ Button added for ${storeName} at ${selector}`);
                    injected = true;
                    break;
                }
            }
            
            if (!injected) {
                // Silently skip missing sections
// console.warn(`⚠️ Section not found for: ${storeName}`);
            }
        }
        
        console.log('✅ Auto-injection complete');
        
    } catch (error) {
        console.error('❌ Auto-injection failed:', error);
    }
}

function attachDashboardListeners() {
    const handlers = {
        'btn-quick-import-excel-dashboard': () => {
            const fileInput = document.getElementById('file-input-excel-dashboard-quick');
            fileInput.onchange = (e) => {
                if (e.target.files[0]) {
                    backupManager.importFullBackupExcel(e.target.files[0]);
                }
                e.target.value = '';
            };
            fileInput.click();
        },
        'btn-export-all-excel-dashboard': () => {
            backupManager.exportFullBackupExcel();
        },
        'btn-export-all-json': () => {
            backupManager.exportFullBackupJSON();
        },
        'btn-export-all-excel': () => {
            backupManager.exportFullBackupExcel();
        },
        'btn-import-all-json': () => {
            const fileInput = document.getElementById('file-input-json');
            fileInput.onchange = (e) => {
                if (e.target.files[0]) {
                    backupManager.importFullBackupJSON(e.target.files[0]);
                }
                e.target.value = '';
            };
            fileInput.click();
        },
        'btn-import-all-excel': () => {
            const fileInput = document.getElementById('file-input-excel');
            fileInput.onchange = (e) => {
                if (e.target.files[0]) {
                    backupManager.importFullBackupExcel(e.target.files[0]);
                }
                e.target.value = '';
            };
            fileInput.click();
        }
    };
    
    Object.entries(handlers).forEach(([id, handler]) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('click', handler);
        }
    });
}

// ==================== INITIALIZE ====================

const backupManager = new BackupManager();
window.backupManager = backupManager;

function initializeBackupSystem() {
    console.log('🚀 Initializing Backup System for ExpenseTrackerProDB...');
    
    document.addEventListener('click', async (e) => {
        const target = e.target.closest('a, button');
        if (!target) return;

        const moduleName = target.dataset.module;
        if (!moduleName) return;

        e.preventDefault();
        e.stopPropagation();

        if (target.classList.contains('btn-quick-import-excel')) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.xlsx,.xls';
            input.onchange = (e) => {
                if (e.target.files[0]) {
                    backupManager.importModuleExcel(e.target.files[0], moduleName);
                }
            };
            input.click();
            
        } else if (target.classList.contains('export-json')) {
            await backupManager.exportModuleJSON(moduleName);
            
        } else if (target.classList.contains('export-excel')) {
            await backupManager.exportModuleExcel(moduleName);
            
        } else if (target.classList.contains('import-json')) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                if (e.target.files[0]) {
                    backupManager.importModuleJSON(e.target.files[0], moduleName);
                }
            };
            input.click();
            
        } else if (target.classList.contains('import-excel')) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.xlsx,.xls';
            input.onchange = (e) => {
                if (e.target.files[0]) {
                    backupManager.importModuleExcel(e.target.files[0], moduleName);
                }
            };
            input.click();
        }
    });

    setTimeout(autoInjectExportButtons, 500);
    setTimeout(autoInjectExportButtons, 2000);

    console.log('✅ Backup system ready');
    console.log('💡 Debug: BackupHelper.inspectDatabase()');
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBackupSystem);
} else {
    initializeBackupSystem();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BackupManager, backupManager, BackupHelper };
}
