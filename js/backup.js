/**
 * 💾 Backup & Export System for Expense Tracker Pro
 * Handles full database backup, restore, and individual store exports
 */

const BackupHelper = (() => {
    'use strict';

    console.log('🚀 Initializing Backup System for ExpenseTrackerProDB...');

    const DB_NAME = 'ExpenseTrackerProDB';
    const DB_VERSION = 1;
    
    // Store names mapping
    const STORE_NAMES = {
        bills: 'bills',
        categories: 'categories',
        currencies: 'currencies',
        documents: 'documents',
        insights: 'insights',
        notifications: 'notifications',
        receipts: 'receipts',
        recurring: 'recurring',
        settings: 'settings',
        shopping_lists: 'shopping_lists',
        shopping_templates: 'shopping_templates',
        splits: 'splits',
        subscriptions: 'subscriptions',
        transactions: 'transactions',
        wishlist: 'wishlist'
    };

    // Section ID mapping for UI injection
    const SECTION_MAP = {
        bills: '#bills-section',
        categories: '#categories-section',
        currencies: '#currencies-section',
        documents: '#documents-section',
        insights: '#insights-section',
        notifications: '#notifications-section',
        receipts: '#receipts-section',
        recurring: '#recurring-section',
        settings: '#settings-section',
        shopping_lists: '#shoppingList-section',
        shopping_templates: '#shopping-templates-section',
        splits: '#splits-section',
        subscriptions: '#subscriptions-section',
        transactions: '#transactions-section',
        wishlist: '#wishlist-section'
    };

    let db = null;
    let injectionObserver = null;
    let injectionDebounceTimer = null;

    /**
     * 🔌 Open IndexedDB connection
     */
    async function openDatabase() {
        return new Promise((resolve, reject) => {
            if (db) {
                resolve(db);
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onsuccess = (event) => {
                db = event.target.result;
                console.log('✅ Database connection established');
                resolve(db);
            };

            request.onerror = (event) => {
                console.error('❌ Database error:', event.target.error);
                reject(event.target.error);
            };

            request.onupgradeneeded = (event) => {
                console.log('🔄 Database upgrade needed');
                db = event.target.result;
            };
        });
    }

    /**
     * 📊 Get all store names from database
     */
    async function getStoreNames() {
        try {
            const database = await openDatabase();
            const stores = Array.from(database.objectStoreNames);
            console.log('📊 Detected Stores:', stores);
            return stores;
        } catch (error) {
            console.error('❌ Error getting store names:', error);
            return Object.values(STORE_NAMES);
        }
    }

    /**
     * 📦 Get all data from a specific store
     */
    async function getStoreData(storeName) {
        return new Promise(async (resolve, reject) => {
            try {
                const database = await openDatabase();
                
                if (!database.objectStoreNames.contains(storeName)) {
                    console.warn(`⚠️ Store "${storeName}" not found`);
                    resolve([]);
                    return;
                }

                const transaction = database.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.getAll();

                request.onsuccess = () => {
                    console.log(`✅ Retrieved ${request.result.length} items from "${storeName}"`);
                    resolve(request.result);
                };

                request.onerror = () => {
                    console.error(`❌ Error reading "${storeName}":`, request.error);
                    reject(request.error);
                };
            } catch (error) {
                console.error(`❌ Error accessing store "${storeName}":`, error);
                reject(error);
            }
        });
    }

    /**
     * 💾 Export full database backup
     */
    async function exportFullBackup() {
        try {
            console.log('🚀 Starting full backup...');
            const stores = await getStoreNames();
            const backup = {
                metadata: {
                    exportDate: new Date().toISOString(),
                    version: DB_VERSION,
                    dbName: DB_NAME,
                    storeCount: stores.length,
                    appVersion: '1.0.0'
                },
                data: {}
            };

            // Fetch data from all stores
            for (const storeName of stores) {
                try {
                    const data = await getStoreData(storeName);
                    backup.data[storeName] = data;
                } catch (error) {
                    console.error(`⚠️ Failed to backup "${storeName}":`, error);
                    backup.data[storeName] = [];
                }
            }

            // Calculate total records
            const totalRecords = Object.values(backup.data).reduce((sum, arr) => sum + arr.length, 0);
            backup.metadata.totalRecords = totalRecords;

            console.log(`✅ Backup complete: ${totalRecords} records from ${stores.length} stores`);
            return backup;
        } catch (error) {
            console.error('❌ Full backup failed:', error);
            throw error;
        }
    }

    /**
     * 📥 Download backup as JSON file
     */
    async function downloadBackup() {
        try {
            showToast('Preparing backup...', 'info');
            const backup = await exportFullBackup();
            
            const jsonString = JSON.stringify(backup, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `expense-tracker-backup-${timestamp}.json`;
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            showToast(`Backup downloaded: ${filename}`, 'success');
            console.log(`📥 Backup downloaded: ${filename}`);
        } catch (error) {
            console.error('❌ Download failed:', error);
            showToast('Backup download failed', 'error');
        }
    }

    /**
     * 📤 Export individual store
     */
    async function exportStore(storeName) {
        try {
            console.log(`📤 Exporting store: ${storeName}`);
            showToast(`Exporting ${storeName}...`, 'info');
            
            const data = await getStoreData(storeName);
            
            const exportData = {
                metadata: {
                    storeName,
                    exportDate: new Date().toISOString(),
                    recordCount: data.length
                },
                data
            };
            
            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `${storeName}-${timestamp}.json`;
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            showToast(`${storeName} exported (${data.length} records)`, 'success');
            console.log(`✅ Store exported: ${filename}`);
        } catch (error) {
            console.error(`❌ Export failed for "${storeName}":`, error);
            showToast(`Failed to export ${storeName}`, 'error');
        }
    }

    /**
     * 🔄 Restore backup from file
     */
    async function restoreBackup(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (event) => {
                try {
                    console.log('🔄 Starting restore...');
                    const backup = JSON.parse(event.target.result);
                    
                    // Validate backup structure
                    if (!backup.metadata || !backup.data) {
                        throw new Error('Invalid backup file format');
                    }
                    
                    const database = await openDatabase();
                    let restoredStores = 0;
                    let restoredRecords = 0;
                    
                    // Restore each store
                    for (const [storeName, records] of Object.entries(backup.data)) {
                        if (!database.objectStoreNames.contains(storeName)) {
                            console.warn(`⚠️ Skipping unknown store: ${storeName}`);
                            continue;
                        }
                        
                        try {
                            const transaction = database.transaction([storeName], 'readwrite');
                            const store = transaction.objectStore(storeName);
                            
                            // Clear existing data
                            await new Promise((res, rej) => {
                                const clearReq = store.clear();
                                clearReq.onsuccess = () => res();
                                clearReq.onerror = () => rej(clearReq.error);
                            });
                            
                            // Add restored data
                            for (const record of records) {
                                await new Promise((res, rej) => {
                                    const addReq = store.add(record);
                                    addReq.onsuccess = () => res();
                                    addReq.onerror = () => rej(addReq.error);
                                });
                            }
                            
                            restoredStores++;
                            restoredRecords += records.length;
                            console.log(`✅ Restored ${records.length} records to "${storeName}"`);
                        } catch (error) {
                            console.error(`❌ Failed to restore "${storeName}":`, error);
                        }
                    }
                    
                    console.log(`✅ Restore complete: ${restoredRecords} records in ${restoredStores} stores`);
                    showToast(`Restored ${restoredRecords} records`, 'success');
                    resolve({ stores: restoredStores, records: restoredRecords });
                    
                    // Reload the page to refresh UI
                    setTimeout(() => window.location.reload(), 1500);
                } catch (error) {
                    console.error('❌ Restore failed:', error);
                    showToast('Restore failed: ' + error.message, 'error');
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                console.error('❌ File read error');
                showToast('Failed to read backup file', 'error');
                reject(reader.error);
            };
            
            reader.readAsText(file);
        });
    }

    /**
     * 🗑️ Clear all data from database
     */
    async function clearAllData() {
        if (!confirm('⚠️ This will delete ALL data permanently. Are you sure?')) {
            return;
        }
        
        if (!confirm('⚠️ FINAL WARNING: This action cannot be undone!')) {
            return;
        }
        
        try {
            console.log('🗑️ Clearing all data...');
            showToast('Clearing all data...', 'info');
            
            const database = await openDatabase();
            const stores = Array.from(database.objectStoreNames);
            
            for (const storeName of stores) {
                const transaction = database.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                
                await new Promise((resolve, reject) => {
                    const request = store.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
                
                console.log(`✅ Cleared store: ${storeName}`);
            }
            
            showToast('All data cleared', 'success');
            console.log('✅ All data cleared');
            
            setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
            console.error('❌ Clear failed:', error);
            showToast('Failed to clear data', 'error');
        }
    }

    /**
     * 🔍 Inspect database structure (for debugging)
     */
    async function inspectDatabase() {
        try {
            const database = await openDatabase();
            const stores = Array.from(database.objectStoreNames);
            
            console.log('🔍 Database Inspection:');
            console.log('  Database:', DB_NAME);
            console.log('  Version:', database.version);
            console.log('  Stores:', stores);
            
            const inspection = {};
            
            for (const storeName of stores) {
                const data = await getStoreData(storeName);
                inspection[storeName] = {
                    count: data.length,
                    sample: data.slice(0, 2)
                };
                console.log(`  📦 ${storeName}: ${data.length} records`);
            }
            
            return inspection;
        } catch (error) {
            console.error('❌ Inspection failed:', error);
            return null;
        }
    }

    /**
     * 🎨 Create backup dashboard modal
     */
    function createBackupDashboard() {
        // Remove existing dashboard if present
        const existing = document.getElementById('backup-dashboard');
        if (existing) existing.remove();
        
        const dashboard = document.createElement('div');
        dashboard.id = 'backup-dashboard';
        dashboard.className = 'modal';
        dashboard.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2>💾 Backup & Export Manager</h2>
                    <button class="close-btn" onclick="BackupHelper.closeDashboard()">&times;</button>
                </div>
                
                <div class="modal-body" style="padding: 20px;">
                    <!-- Full Backup Section -->
                    <div class="backup-section" style="margin-bottom: 30px;">
                        <h3 style="margin-bottom: 15px;">📦 Full Database Backup</h3>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <button onclick="BackupHelper.downloadBackup()" class="btn-primary">
                                📥 Download Full Backup
                            </button>
                            <button onclick="document.getElementById('restore-file-input').click()" class="btn-secondary">
                                📤 Restore Backup
                            </button>
                            <input type="file" id="restore-file-input" accept=".json" style="display: none;" 
                                   onchange="BackupHelper.handleRestoreFile(event)">
                        </div>
                    </div>
                    
                    <!-- Individual Store Exports -->
                    <div class="backup-section" style="margin-bottom: 30px;">
                        <h3 style="margin-bottom: 15px;">📤 Export Individual Stores</h3>
                        <div id="store-export-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;">
                            <!-- Populated dynamically -->
                        </div>
                    </div>
                    
                    <!-- Danger Zone -->
                    <div class="backup-section" style="border-top: 2px solid #ff4444; padding-top: 20px;">
                        <h3 style="color: #ff4444; margin-bottom: 15px;">⚠️ Danger Zone</h3>
                        <button onclick="BackupHelper.clearAllData()" class="btn-danger">
                            🗑️ Clear All Data
                        </button>
                        <p style="font-size: 12px; color: #666; margin-top: 10px;">
                            This will permanently delete all data. Create a backup first!
                        </p>
                    </div>
                    
                    <!-- Debug Section -->
                    <div class="backup-section" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
                        <button onclick="BackupHelper.inspectDatabase()" class="btn-secondary btn-sm">
                            🔍 Inspect Database (Console)
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(dashboard);
        
        // Populate store export buttons
        populateStoreExports();
        
        // Show modal
        setTimeout(() => dashboard.classList.add('active'), 10);
    }

    /**
     * 📋 Populate individual store export buttons
     */
    async function populateStoreExports() {
        const container = document.getElementById('store-export-list');
        if (!container) return;
        
        try {
            const stores = await getStoreNames();
            container.innerHTML = '';
            
            for (const storeName of stores) {
                const btn = document.createElement('button');
                btn.className = 'btn-secondary btn-sm';
                btn.style.width = '100%';
                btn.innerHTML = `📤 ${storeName}`;
                btn.onclick = () => exportStore(storeName);
                container.appendChild(btn);
            }
        } catch (error) {
            console.error('❌ Failed to populate store exports:', error);
            container.innerHTML = '<p style="color: #ff4444;">Failed to load stores</p>';
        }
    }

    /**
     * 🚪 Open backup dashboard
     */
    function openDashboard() {
        createBackupDashboard();
    }

    /**
     * 🚪 Close backup dashboard
     */
    function closeDashboard() {
        const dashboard = document.getElementById('backup-dashboard');
        if (dashboard) {
            dashboard.classList.remove('active');
            setTimeout(() => dashboard.remove(), 300);
        }
    }

    /**
     * 📁 Handle restore file selection
     */
    function handleRestoreFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!file.name.endsWith('.json')) {
            showToast('Please select a JSON backup file', 'error');
            return;
        }
        
        restoreBackup(file);
        event.target.value = ''; // Reset input
    }

    /**
     * 🍞 Show toast notification
     */
    function showToast(message, type = 'info') {
        // Try to use app's toast system if available
        if (window.showToast) {
            window.showToast(message, type);
            return;
        }
        
        // Fallback to console
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
        console.log(`${icon} ${message}`);
        
        // Simple toast fallback
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            border-radius: 5px;
            z-index: 10000;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * 🎯 Auto-inject export buttons into sections
     */
    function autoInjectExportButtons() {
        // Debounce to prevent excessive calls
        clearTimeout(injectionDebounceTimer);
        injectionDebounceTimer = setTimeout(() => {
            performInjection();
        }, 100);
    }

    function performInjection() {
        console.log('🔍 Starting auto-injection...');
        
        // Inject dashboard button
        injectDashboardButton();
        
        // Inject individual store buttons
        let successCount = 0;
        let pendingCount = 0;
        
        Object.keys(SECTION_MAP).forEach(storeName => {
            const sectionId = SECTION_MAP[storeName];
            const section = document.querySelector(sectionId);
            
            if (section) {
                const existingBtn = section.querySelector(`[data-backup-store="${storeName}"]`);
                if (!existingBtn) {
                    const actionBar = section.querySelector('.action-bar, .section-actions, .controls, .section-header');
                    if (actionBar) {
                        const exportBtn = createExportButton(storeName);
                        actionBar.appendChild(exportBtn);
                        successCount++;
                    }
                }
            } else {
                pendingCount++;
            }
        });

        if (successCount > 0) {
            console.log(`✅ Injected ${successCount} export buttons`);
        }
        if (pendingCount > 0) {
            console.log(`⏳ ${pendingCount} sections not yet loaded`);
        }
    }

    /**
     * 🎯 Inject dashboard button
     */
    function injectDashboardButton() {
        const dashboardControls = document.querySelector('.dashboard-controls, .main-controls, .header-actions');
        if (dashboardControls && !document.getElementById('backup-dashboard-btn')) {
            const dashboardBtn = document.createElement('button');
            dashboardBtn.id = 'backup-dashboard-btn';
            dashboardBtn.className = 'btn-primary';
            dashboardBtn.innerHTML = '💾 Backup';
            dashboardBtn.onclick = () => openDashboard();
            dashboardBtn.style.cssText = 'margin-left: 10px;';
            dashboardControls.appendChild(dashboardBtn);
            console.log('✅ Dashboard button added');
        }
    }

    /**
     * 🎨 Create export button for store
     */
    function createExportButton(storeName) {
        const exportBtn = document.createElement('button');
        exportBtn.className = 'btn-secondary btn-sm';
        exportBtn.setAttribute('data-backup-store', storeName);
        exportBtn.innerHTML = `📤 Export`;
        exportBtn.title = `Export ${storeName} data`;
        exportBtn.onclick = () => exportStore(storeName);
        exportBtn.style.cssText = 'margin-left: 5px;';
        return exportBtn;
    }

    /**
     * 👁️ Start MutationObserver for dynamic content
     */
    function startInjectionObserver() {
        if (injectionObserver) return;
        
        const targetNode = document.getElementById('app') || document.body;
        
        injectionObserver = new MutationObserver((mutations) => {
            let shouldReinject = false;
            
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) {
                            // Check if it's a section or contains sections
                            if (node.classList?.contains('section') || 
                                node.querySelector?.('.section')) {
                                shouldReinject = true;
                            }
                        }
                    });
                }
            });
            
            if (shouldReinject) {
                autoInjectExportButtons();
            }
        });
        
        injectionObserver.observe(targetNode, {
            childList: true,
            subtree: true
        });
        
        console.log('👁️ Backup injection observer started');
    }

    /**
     * 🎯 Setup tab change listeners
     */
    function setupTabListeners() {
        // Listen for tab changes
        document.addEventListener('click', (event) => {
            const tabButton = event.target.closest('[data-tab]');
            if (tabButton) {
                setTimeout(() => autoInjectExportButtons(), 300);
            }
        });
        
        console.log('🎯 Tab listeners configured');
    }

    /**
     * 🚀 Initialize backup system
     */
    function init() {
        // Initial injection
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    autoInjectExportButtons();
                    startInjectionObserver();
                    setupTabListeners();
                }, 500);
            });
        } else {
            setTimeout(() => {
                autoInjectExportButtons();
                startInjectionObserver();
                setupTabListeners();
            }, 500);
        }
    }

    // Public API
    const api = {
        // Core functions
        downloadBackup,
        restoreBackup,
        exportStore,
        clearAllData,
        inspectDatabase,
        
        // UI functions
        openDashboard,
        closeDashboard,
        handleRestoreFile,
        
        // Utility functions
        getStoreNames,
        getStoreData,
        exportFullBackup,
        
        // Re-injection
        autoInjectExportButtons,
        
        // Internal (exposed for debugging)
        _db: () => db,
        _stores: STORE_NAMES
    };

    // Initialize
    init();

    console.log('✅ Backup system ready');
    console.log('💡 Usage: BackupHelper.openDashboard()');
    console.log('💡 Debug: BackupHelper.inspectDatabase()');

    return api;
})();

// Expose globally
window.BackupHelper = BackupHelper;
