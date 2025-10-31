// Database Management System
class Database {
    constructor() {
        this.dbName = 'ExpenseTrackerProDB';
        this.version = 3;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('Database initialized successfully');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores if they don't exist
                const stores = [
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

                stores.forEach(storeName => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
                        console.log(`Created store: ${storeName}`);
                    }
                });

                // Special store for currencies (uses code as key)
                if (db.objectStoreNames.contains('currencies')) {
                    db.deleteObjectStore('currencies');
                }
                db.createObjectStore('currencies', { keyPath: 'code' });
            };
        });
    }

    async add(storeName, data) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.add(data);
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.getAll();
                
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    async get(storeName, id) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(id);
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    async update(storeName, data) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.put(data);
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    async delete(storeName, id) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.delete(id);
                
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    async clear(storeName) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();
                
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    async count(storeName) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.count();
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    // Bulk operations
    async bulkAdd(storeName, dataArray) {
        const results = [];
        for (const data of dataArray) {
            const id = await this.add(storeName, data);
            results.push(id);
        }
        return results;
    }

    async bulkDelete(storeName, ids) {
        for (const id of ids) {
            await this.delete(storeName, id);
        }
    }

    // Query helpers
    async query(storeName, filterFn) {
        const all = await this.getAll(storeName);
        return all.filter(filterFn);
    }

    async findOne(storeName, filterFn) {
        const all = await this.getAll(storeName);
        return all.find(filterFn);
    }

    // Export entire database
    async exportAll() {
        const data = {};
        const storeNames = Array.from(this.db.objectStoreNames);
        
        for (const storeName of storeNames) {
            data[storeName] = await this.getAll(storeName);
        }
        
        return {
            version: this.version,
            exportDate: new Date().toISOString(),
            data: data
        };
    }

    // Import entire database
    async importAll(exportData) {
        if (!exportData.data) throw new Error('Invalid export data');
        
        for (const [storeName, items] of Object.entries(exportData.data)) {
            if (this.db.objectStoreNames.contains(storeName)) {
                await this.clear(storeName);
                for (const item of items) {
                    await this.add(storeName, item);
                }
            }
        }
    }

    // Get database size
    async getSize() {
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            return {
                usage: estimate.usage,
                quota: estimate.quota,
                usageMB: (estimate.usage / (1024 * 1024)).toFixed(2),
                quotaMB: (estimate.quota / (1024 * 1024)).toFixed(2),
                percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(2)
            };
        }
        return null;
    }
}