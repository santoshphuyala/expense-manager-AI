// Main Application Class - FIXED VERSION WITH DASHBOARD REFRESH
class ExpenseTrackerApp {
    constructor() {
        this.db = new Database();
        this.scanner = new ReceiptScanner();
        this.analytics = null;
        this.insights = null;
        this.currentCurrency = 'NPR';
        this.currencies = {};
        this.charts = {};
        this.notifications = [];
        this.currentEditId = null;
        this.refreshInterval = null;
        
        console.log('🚀 Initializing Expense Tracker Pro...');
        this.init();
    }

    async init() {
        try {
            await this.db.init();
            this.analytics = new Analytics(this.db);
            this.insights = new InsightsEngine(this.db);
            
            await this.loadDefaultData();
            await this.loadCurrencies();
            this.setupEventListeners();
            await this.loadDashboard();
            await this.refreshInsights();
            
            // ✅ FIX: Setup auto-refresh for dashboard widgets
            this.setupDashboardAutoRefresh();
            
            // ✅ FIX: Initial widget refresh
            await this.refreshDashboardWidgets();
            
            console.log('✅ App initialized successfully');
            this.showToast('Welcome to Expense Tracker Pro!', 'success');
        } catch (error) {
            console.error('❌ Initialization error:', error);
            this.showToast('Failed to initialize app', 'error');
        }
    }

    // ==========================================
    // ✅ NEW: DASHBOARD WIDGET REFRESH SYSTEM
    // ==========================================
    
    setupDashboardAutoRefresh() {
        console.log('⚙️ Setting up dashboard auto-refresh...');
        
        // Auto-refresh every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.refreshDashboardWidgets();
        }, 30000);
        
        // Refresh on storage changes (from other tabs)
        window.addEventListener('storage', (e) => {
            if (e.key === 'subscriptions' || e.key === 'bills' || e.key === 'transactions') {
                console.log('📦 Storage changed, refreshing widgets...');
                this.refreshDashboardWidgets();
            }
        });
        
        // Refresh when tab becomes visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('👁️ Tab visible, refreshing widgets...');
                this.refreshDashboardWidgets();
            }
        });
        
        console.log('✅ Auto-refresh enabled (30s interval)');
    }

    async refreshDashboardWidgets() {
        console.log('🔄 Refreshing dashboard widgets...');
        
        try {
            // ✅ FIX: Refresh subscription renewals widget
            await this.updateUpcomingRenewals();
            
            // ✅ FIX: Refresh bills widget
            await this.updateUpcomingBills();
            
            // ✅ FIX: Refresh warranties widget
            await this.updateExpiringWarranties();
            
            // Call external insights.js functions if they exist
            if (typeof updateUpcomingRenewals === 'function') {
                updateUpcomingRenewals();
            }
            if (typeof updateUpcomingBills === 'function') {
                updateUpcomingBills();
            }
            if (typeof updateExpiringWarranties === 'function') {
                updateExpiringWarranties();
            }
            if (typeof updateBudgetAlerts === 'function') {
                updateBudgetAlerts();
            }
            
            console.log('✅ Dashboard widgets refreshed');
        } catch (error) {
            console.error('❌ Error refreshing widgets:', error);
        }
    }

    // ✅ NEW: Update upcoming renewals widget
    async updateUpcomingRenewals() {
        const renewalsList = document.getElementById('renewalsList');
        if (!renewalsList) return;
        
        try {
            const subscriptions = await this.db.getAll('subscriptions');
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            
            const daysAhead = 30;
            const futureDate = new Date(now.getTime() + (daysAhead * 24 * 60 * 60 * 1000));
            
            const upcomingRenewals = subscriptions.filter(sub => {
                if (!sub.active || !sub.nextBilling) return false;
                
                const renewalDate = new Date(sub.nextBilling);
                renewalDate.setHours(0, 0, 0, 0);
                
                return renewalDate >= now && renewalDate <= futureDate;
            }).sort((a, b) => new Date(a.nextBilling) - new Date(b.nextBilling));
            
            console.log(`📅 Found ${upcomingRenewals.length} upcoming renewals`);
            
            if (upcomingRenewals.length === 0) {
                renewalsList.innerHTML = '<p class="text-muted">No upcoming renewals</p>';
                return;
            }
            
            renewalsList.innerHTML = upcomingRenewals.map(renewal => {
                const renewalDate = new Date(renewal.nextBilling);
                const daysUntil = Math.ceil((renewalDate - now) / (1000 * 60 * 60 * 24));
                const amount = this.convertAmount(renewal.amount, renewal.currency || 'NPR');
                
                let urgencyClass = '';
                if (daysUntil <= 3) urgencyClass = 'text-danger fw-bold';
                else if (daysUntil <= 7) urgencyClass = 'text-warning fw-bold';
                
                return `
                    <div class="d-flex justify-content-between align-items-center mb-2 p-2 border-bottom">
                        <div>
                            <strong>${renewal.name}</strong>
                            <div class="small text-muted">${renewal.category} • ${renewal.cycle}</div>
                        </div>
                        <div class="text-end">
                            <div class="${urgencyClass}">${this.formatCurrency(amount)}</div>
                            <div class="small">${daysUntil} day${daysUntil !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error updating renewals:', error);
        }
    }

    // ✅ NEW: Update upcoming bills widget
    async updateUpcomingBills() {
        const billsList = document.getElementById('billsList');
        if (!billsList) return;
        
        try {
            const transactions = await this.db.getAll('transactions');
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            
            const daysAhead = 30;
            const futureDate = new Date(now.getTime() + (daysAhead * 24 * 60 * 60 * 1000));
            
            // Filter for upcoming bills (you can customize this logic)
            const upcomingBills = transactions.filter(txn => {
                if (txn.type !== 'expense') return false;
                if (!txn.category || !txn.category.includes('Bill')) return false;
                
                const txnDate = new Date(txn.date);
                txnDate.setHours(0, 0, 0, 0);
                
                return txnDate >= now && txnDate <= futureDate;
            }).sort((a, b) => new Date(a.date) - new Date(b.date));
            
            if (upcomingBills.length === 0) {
                billsList.innerHTML = '<p class="text-muted">No upcoming bills</p>';
                return;
            }
            
            billsList.innerHTML = upcomingBills.map(bill => {
                const billDate = new Date(bill.date);
                const daysUntil = Math.ceil((billDate - now) / (1000 * 60 * 60 * 24));
                const amount = this.convertAmount(bill.amount, bill.currency || 'NPR');
                
                let urgencyClass = '';
                if (daysUntil <= 3) urgencyClass = 'text-danger fw-bold';
                else if (daysUntil <= 7) urgencyClass = 'text-warning fw-bold';
                
                return `
                    <div class="d-flex justify-content-between align-items-center mb-2 p-2 border-bottom">
                        <div>
                            <strong>${bill.description}</strong>
                            <div class="small text-muted">${bill.category}</div>
                        </div>
                        <div class="text-end">
                            <div class="${urgencyClass}">${this.formatCurrency(amount)}</div>
                            <div class="small">${daysUntil} day${daysUntil !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error updating bills:', error);
        }
    }

    // ✅ NEW: Update expiring warranties widget
    async updateExpiringWarranties() {
        const warrantiesList = document.getElementById('warrantiesList');
        if (!warrantiesList) return;
        
        try {
            const documents = await this.db.getAll('documents');
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            
            const daysAhead = 60;
            const futureDate = new Date(now.getTime() + (daysAhead * 24 * 60 * 60 * 1000));
            
            const expiringWarranties = documents.filter(doc => {
                if (doc.type !== 'warranty' || !doc.expiryDate) return false;
                
                const expiryDate = new Date(doc.expiryDate);
                expiryDate.setHours(0, 0, 0, 0);
                
                return expiryDate >= now && expiryDate <= futureDate;
            }).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
            
            if (expiringWarranties.length === 0) {
                warrantiesList.innerHTML = '<p class="text-muted">No expiring warranties</p>';
                return;
            }
            
            warrantiesList.innerHTML = expiringWarranties.map(warranty => {
                const expiryDate = new Date(warranty.expiryDate);
                const daysUntil = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
                
                let urgencyClass = '';
                if (daysUntil <= 7) urgencyClass = 'text-danger fw-bold';
                else if (daysUntil <= 30) urgencyClass = 'text-warning fw-bold';
                
                return `
                    <div class="d-flex justify-content-between align-items-center mb-2 p-2 border-bottom">
                        <div>
                            <strong>${warranty.title}</strong>
                            <div class="small text-muted">${warranty.product || 'Product'}</div>
                        </div>
                        <div class="text-end">
                            <div class="${urgencyClass}">${warranty.expiryDate}</div>
                            <div class="small">${daysUntil} day${daysUntil !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error updating warranties:', error);
        }
    }

    async loadDefaultData() {
        const categories = await this.db.getAll('categories');
        if (categories.length === 0) {
            const defaultCategories = [
                { name: 'Food & Dining', type: 'expense', icon: '🍔' },
                { name: 'Transportation', type: 'expense', icon: '🚗' },
                { name: 'Shopping', type: 'expense', icon: '🛍️' },
                { name: 'Entertainment', type: 'expense', icon: '🎬' },
                { name: 'Bills & Utilities', type: 'expense', icon: '💡' },
                { name: 'Healthcare', type: 'expense', icon: '🏥' },
                { name: 'Education', type: 'expense', icon: '📚' },
                { name: 'Travel', type: 'expense', icon: '✈️' },
                { name: 'Fitness', type: 'expense', icon: '💪' },
                { name: 'Others', type: 'expense', icon: '📌' },
                { name: 'Salary', type: 'income', icon: '💼' },
                { name: 'Business', type: 'income', icon: '💰' },
                { name: 'Investments', type: 'income', icon: '📈' },
                { name: 'Freelance', type: 'income', icon: '💻' },
                { name: 'Gifts', type: 'income', icon: '🎁' }
            ];

            for (const cat of defaultCategories) {
                await this.db.add('categories', cat);
            }
            console.log('✅ Default categories loaded');
        }
    }

    async loadCurrencies() {
        const saved = await this.db.getAll('currencies');
        if (saved.length > 0) {
            saved.forEach(curr => {
                this.currencies[curr.code] = curr;
            });
        } else {
            this.currencies = {
                NPR: { name: 'Nepalese Rupee', rate: 1, symbol: 'रू' },
                USD: { name: 'US Dollar', rate: 0.0075, symbol: '$' },
                GBP: { name: 'British Pound', rate: 0.0059, symbol: '£' }
            };

            for (const [code, data] of Object.entries(this.currencies)) {
                await this.db.add('currencies', { code, ...data });
            }
        }

        this.updateCurrencySelector();
        this.displayCurrencyList();
    }

    updateCurrencySelector() {
        const selector = document.getElementById('currencySelector');
        if (!selector) return;
        
        selector.innerHTML = '';
        
        for (const [code, data] of Object.entries(this.currencies)) {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = `${code} - ${data.symbol}`;
            if (code === this.currentCurrency) option.selected = true;
            selector.appendChild(option);
        }
    }

    // ==========================================
    // EVENT LISTENERS SETUP - FIXED
    // ==========================================
    
    setupEventListeners() {
        console.log('⚙️ Setting up event listeners...');

        // Tab navigation - FIXED
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = e.currentTarget.dataset.tab;
                console.log('Tab clicked:', tabName);
                this.switchTab(tabName);
            });
        });

        // Quick action buttons - FIXED
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const action = btn.dataset.action;
                const goto = btn.dataset.goto;
                
                if (action === 'income' || action === 'expense') {
                    console.log('Quick action:', action);
                    this.quickAddTransaction(action);
                } else if (goto) {
                    this.switchTab(goto);
                }
            });
        });

        // Quick scan button
        const quickScanBtn = document.getElementById('quickScanBtn');
        if (quickScanBtn) {
            quickScanBtn.addEventListener('click', () => this.openReceiptScanner());
        }

        // View All buttons with data-goto
        document.querySelectorAll('[data-goto]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = e.currentTarget.dataset.goto;
                this.switchTab(tab);
            });
        });

        // Currency selector
        const currencySelector = document.getElementById('currencySelector');
        if (currencySelector) {
            currencySelector.addEventListener('change', (e) => {
                this.currentCurrency = e.target.value;
                this.loadDashboard();
            });
        }

        // Header buttons
        const addCurrencyBtn = document.getElementById('addCurrencyBtn');
        if (addCurrencyBtn) {
            addCurrencyBtn.addEventListener('click', () => this.openModal('currencyModal'));
        }

        const scanReceiptBtn = document.getElementById('scanReceiptBtn');
        if (scanReceiptBtn) {
            scanReceiptBtn.addEventListener('click', () => this.openReceiptScanner());
        }

        const notificationBtn = document.getElementById('notificationBtn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', () => this.toggleNotificationPanel());
        }

        // Transaction
        const addTransactionBtn = document.getElementById('addTransactionBtn');
        if (addTransactionBtn) {
            addTransactionBtn.addEventListener('click', () => this.openTransactionModal());
        }

        const transactionForm = document.getElementById('transactionForm');
        if (transactionForm) {
            transactionForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveTransaction();
            });
        }

        // Transaction type change
        document.querySelectorAll('input[name="txnType"]').forEach(radio => {
            radio.addEventListener('change', async (e) => {
                await this.populateCategorySelect('txnCategory', e.target.value);
            });
        });

        // Filters
        const applyFilterBtn = document.getElementById('applyFilterBtn');
        if (applyFilterBtn) {
            applyFilterBtn.addEventListener('click', () => this.loadTransactions(true));
        }

        const clearFilterBtn = document.getElementById('clearFilterBtn');
        if (clearFilterBtn) {
            clearFilterBtn.addEventListener('click', () => {
                document.getElementById('filterStartDate').value = '';
                document.getElementById('filterEndDate').value = '';
                document.getElementById('filterType').value = '';
                document.getElementById('filterCategory').value = '';
                document.getElementById('filterAccount').value = '';
                this.loadTransactions(false);
            });
        }

        // Shopping
        const quickShoppingForm = document.getElementById('quickShoppingForm');
        if (quickShoppingForm) {
            quickShoppingForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.quickAddShoppingItem();
            });
        }

        const createShoppingListBtn = document.getElementById('createShoppingListBtn');
        if (createShoppingListBtn) {
            createShoppingListBtn.addEventListener('click', () => this.openShoppingListModal());
        }

        const shoppingListForm = document.getElementById('shoppingListForm');
        if (shoppingListForm) {
            shoppingListForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveShoppingList();
            });
        }

        const shoppingItemForm = document.getElementById('shoppingItemForm');
        if (shoppingItemForm) {
            shoppingItemForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveShoppingItem();
            });
        }

        const exportShoppingListBtn = document.getElementById('exportShoppingListBtn');
        if (exportShoppingListBtn) {
            exportShoppingListBtn.addEventListener('click', () => this.exportShoppingLists());
        }

        const shoppingListFilter = document.getElementById('shoppingListFilter');
        if (shoppingListFilter) {
            shoppingListFilter.addEventListener('change', (e) => this.loadShoppingLists(e.target.value));
        }

        // Subscriptions
        const addSubscriptionBtn = document.getElementById('addSubscriptionBtn');
        if (addSubscriptionBtn) {
            addSubscriptionBtn.addEventListener('click', () => this.openSubscriptionModal());
        }

        const subscriptionForm = document.getElementById('subscriptionForm');
        if (subscriptionForm) {
            subscriptionForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveSubscription();
            });
        }

        const exportSubscriptionsBtn = document.getElementById('exportSubscriptionsBtn');
        if (exportSubscriptionsBtn) {
            exportSubscriptionsBtn.addEventListener('click', () => this.exportSubscriptions());
        }

        // Subscription templates
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const template = e.currentTarget.dataset.template;
                this.addSubscriptionFromTemplate(template);
            });
        });

        // Wishlist
        const addWishlistBtn = document.getElementById('addWishlistBtn');
        if (addWishlistBtn) {
            addWishlistBtn.addEventListener('click', () => this.openWishlistModal());
        }

        const wishlistForm = document.getElementById('wishlistForm');
        if (wishlistForm) {
            wishlistForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveWishlistItem();
            });
        }

        const wishlistSortBy = document.getElementById('wishlistSortBy');
        if (wishlistSortBy) {
            wishlistSortBy.addEventListener('change', (e) => this.loadWishlist(e.target.value));
        }

        const exportWishlistBtn = document.getElementById('exportWishlistBtn');
        if (exportWishlistBtn) {
            exportWishlistBtn.addEventListener('click', () => this.exportWishlist());
        }

        // Documents
        const addDocumentBtn = document.getElementById('addDocumentBtn');
        if (addDocumentBtn) {
            addDocumentBtn.addEventListener('click', () => this.openDocumentModal('document'));
        }

        const addWarrantyBtn = document.getElementById('addWarrantyBtn');
        if (addWarrantyBtn) {
            addWarrantyBtn.addEventListener('click', () => this.openDocumentModal('warranty'));
        }

        const documentForm = document.getElementById('documentForm');
        if (documentForm) {
            documentForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveDocument();
            });
        }

        const documentFilter = document.getElementById('documentFilter');
        if (documentFilter) {
            documentFilter.addEventListener('change', (e) => this.loadDocuments(e.target.value));
        }

        const documentSearch = document.getElementById('documentSearch');
        if (documentSearch) {
            documentSearch.addEventListener('input', (e) => this.searchDocuments(e.target.value));
        }

        // Analytics
        const generateAnalyticsBtn = document.getElementById('generateAnalyticsBtn');
        if (generateAnalyticsBtn) {
            generateAnalyticsBtn.addEventListener('click', () => this.generateAnalytics());
        }

        const analyticsTimeRange = document.getElementById('analyticsTimeRange');
        if (analyticsTimeRange) {
            analyticsTimeRange.addEventListener('change', (e) => {
                const isCustom = e.target.value === 'custom';
                document.getElementById('analyticsStartDate').style.display = isCustom ? 'block' : 'none';
                document.getElementById('analyticsEndDate').style.display = isCustom ? 'block' : 'none';
            });
        }

        // Insights
        const refreshInsightsBtn = document.getElementById('refreshInsightsBtn');
        if (refreshInsightsBtn) {
            refreshInsightsBtn.addEventListener('click', () => this.refreshInsights());
        }

        document.querySelectorAll('.insight-categories .category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.insight-categories .category-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterInsights(e.target.dataset.category);
            });
        });

        // Receipt Scanner
        const receiptImageInput = document.getElementById('receiptImageInput');
        if (receiptImageInput) {
            receiptImageInput.addEventListener('change', (e) => {
                if (e.target.files[0]) {
                    this.handleReceiptUpload(e.target.files[0]);
                }
            });
        }

        const confirmScanBtn = document.getElementById('confirmScanBtn');
        if (confirmScanBtn) {
            confirmScanBtn.addEventListener('click', () => this.confirmScannedReceipt());
        }

        const rescanBtn = document.getElementById('rescanBtn');
        if (rescanBtn) {
            rescanBtn.addEventListener('click', () => this.resetScanner());
        }

        // Settings
        const addCategoryBtn = document.getElementById('addCategoryBtn');
        if (addCategoryBtn) {
            addCategoryBtn.addEventListener('click', () => this.addCategory());
        }

        const currencyForm = document.getElementById('currencyForm');
        if (currencyForm) {
            currencyForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addCurrency();
            });
        }

        // Menu item buttons
        const scanMenuBtn = document.getElementById('scanMenuBtn');
        if (scanMenuBtn) {
            scanMenuBtn.addEventListener('click', () => this.openReceiptScanner());
        }

        // Import/Export
        const exportJSONBtn = document.getElementById('exportJSONBtn');
        if (exportJSONBtn) {
            exportJSONBtn.addEventListener('click', () => this.exportData('json'));
        }

        const exportCSVBtn = document.getElementById('exportCSVBtn');
        if (exportCSVBtn) {
            exportCSVBtn.addEventListener('click', () => this.exportData('csv'));
        }

        const exportExcelBtn = document.getElementById('exportExcelBtn');
        if (exportExcelBtn) {
            exportExcelBtn.addEventListener('click', () => this.exportData('excel'));
        }

        const exportFullBackupBtn = document.getElementById('exportFullBackupBtn');
        if (exportFullBackupBtn) {
            exportFullBackupBtn.addEventListener('click', () => this.exportFullBackup());
        }

        const importFile = document.getElementById('importFile');
        if (importFile) {
            importFile.addEventListener('change', (e) => {
                const fileName = e.target.files[0]?.name || 'No file chosen';
                document.getElementById('fileName').textContent = fileName;
                document.getElementById('importBtn').disabled = !e.target.files[0];
            });
        }

        const importBtn = document.getElementById('importBtn');
        if (importBtn) {
            importBtn.addEventListener('click', () => this.importData());
        }

        const clearDataBtn = document.getElementById('clearDataBtn');
        if (clearDataBtn) {
            clearDataBtn.addEventListener('click', () => {
                if (confirm('⚠️ WARNING: This will delete ALL your data permanently!\n\nAre you absolutely sure?')) {
                    if (confirm('This action cannot be undone! Please confirm again.')) {
                        this.clearAllData();
                    }
                }
            });
        }

        // Notification panel
        const clearNotificationsBtn = document.getElementById('clearNotificationsBtn');
        if (clearNotificationsBtn) {
            clearNotificationsBtn.addEventListener('click', () => this.clearNotifications());
        }

        // Modal close buttons - FIXED
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.closeModal(modal.id);
                } else if (btn.dataset.modal) {
                    this.closeModal(btn.dataset.modal);
                }
            });
        });

        // Close modals on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // Set default dates
        const today = new Date().toISOString().split('T')[0];
        const txnDate = document.getElementById('txnDate');
        if (txnDate) txnDate.value = today;
        
        const listDate = document.getElementById('listDate');
        if (listDate) listDate.value = today;
        
        const subNextBilling = document.getElementById('subNextBilling');
        if (subNextBilling) subNextBilling.value = today;

        console.log('✅ Event listeners set up');
    }

    // ==========================================
    // TAB SWITCHING - FIXED
    // ==========================================
    
    switchTab(tabName) {
        console.log('Switching to tab:', tabName);
        
        // Remove active class from all tabs and contents
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        // Add active class to selected tab and content
        const selectedTab = document.querySelector(`[data-tab="${tabName}"]`);
        const selectedContent = document.getElementById(tabName);
        
        if (selectedTab) selectedTab.classList.add('active');
        if (selectedContent) selectedContent.classList.add('active');

        // Load data for specific tabs
        switch(tabName) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'transactions':
                this.loadTransactions();
                break;
            case 'analytics':
                this.generateAnalytics();
                break;
            case 'shopping':
                this.loadShoppingLists();
                this.loadShoppingStats();
                break;
            case 'subscriptions':
                this.loadSubscriptions();
                break;
            case 'wishlist':
                this.loadWishlist();
                break;
            case 'documents':
                this.loadDocuments();
                break;
            case 'insights':
                this.loadInsights();
                break;
            case 'more':
                this.loadSettings();
                break;
        }
    }

    // ==========================================
    // CURRENCY FUNCTIONS
    // ==========================================
    
    convertAmount(amount, fromCurrency = 'NPR', toCurrency = null) {
        if (!toCurrency) toCurrency = this.currentCurrency;
        if (fromCurrency === toCurrency) return amount;

        const inNPR = amount / this.currencies[fromCurrency].rate;
        return inNPR * this.currencies[toCurrency].rate;
    }

    formatCurrency(amount) {
        const curr = this.currencies[this.currentCurrency];
        return `${curr.symbol} ${amount.toFixed(2)}`;
    }

    async addCurrency() {
        const code = document.getElementById('currencyCode').value.toUpperCase();
        const name = document.getElementById('currencyName').value;
        const symbol = document.getElementById('currencySymbol').value;
        const rate = parseFloat(document.getElementById('currencyRate').value);

        if (!code || !name || !rate) {
            this.showToast('Please fill all fields', 'error');
            return;
        }

        this.currencies[code] = { name, rate, symbol };
        await this.db.add('currencies', { code, name, rate, symbol });

        this.updateCurrencySelector();
        this.displayCurrencyList();
        this.closeModal('currencyModal');
        document.getElementById('currencyForm').reset();
        this.showToast('Currency added successfully!', 'success');
    }

    displayCurrencyList() {
        const container = document.getElementById('currencyList');
        if (!container) return;
        
        const html = Object.entries(this.currencies).map(([code, data]) => `
            <div class="currency-item">
                <div>
                    <strong>${code}</strong> - ${data.name}
                    <br><small>Rate: 1 NPR = ${(1 / data.rate).toFixed(4)} ${code}</small>
                </div>
                ${!['NPR', 'USD', 'GBP'].includes(code) ? `
                    <button class="btn-delete" onclick="app.deleteCurrency('${code}')">🗑️</button>
                ` : ''}
            </div>
        `).join('');
        container.innerHTML = html;
    }

    async deleteCurrency(code) {
        if (confirm(`Delete ${code}?`)) {
            delete this.currencies[code];
            await this.db.delete('currencies', code);
            this.updateCurrencySelector();
            this.displayCurrencyList();
            this.showToast('Currency deleted', 'success');
        }
    }

    // ==========================================
    // DASHBOARD FUNCTIONS - FIXED WITH WIDGET REFRESH
    // ==========================================
    
    async loadDashboard() {
        console.log('Loading dashboard...');
        
        try {
            const transactions = await this.db.getAll('transactions');
            const subscriptions = await this.db.getAll('subscriptions');
            
            let totalIncome = 0;
            let totalExpense = 0;
            let cashBalance = 0;
            let bankBalance = 0;

            transactions.forEach(txn => {
                const amount = this.convertAmount(txn.amount, txn.currency || 'NPR');
                
                if (txn.type === 'income') {
                    totalIncome += amount;
                    if (txn.account === 'cash') cashBalance += amount;
                    else bankBalance += amount;
                } else {
                    totalExpense += amount;
                    if (txn.account === 'cash') cashBalance -= amount;
                    else bankBalance -= amount;
                }
            });

            const netSavings = totalIncome - totalExpense;

            // Update UI
            this.updateElementText('totalIncome', this.formatCurrency(totalIncome));
            this.updateElementText('totalExpense', this.formatCurrency(totalExpense));
            this.updateElementText('netSavings', this.formatCurrency(netSavings));
            this.updateElementText('cashBalance', this.formatCurrency(cashBalance));
            this.updateElementText('bankBalance', this.formatCurrency(bankBalance));
            this.updateElementText('totalBalance', this.formatCurrency(cashBalance + bankBalance));

            // Subscription stats
            const activeSubs = subscriptions.filter(s => s.active);
            const monthlyCost = this.calculateMonthlySubscriptionCost(activeSubs);
            
            this.updateElementText('activeSubscriptions', activeSubs.length);
            this.updateElementText('subscriptionCost', this.formatCurrency(monthlyCost));

            // Load charts and recent activity
            await this.renderDashboardCharts(transactions);
            this.renderRecentTransactions(transactions);
            
            // ✅ FIX: Refresh widgets after dashboard loads
            await this.refreshDashboardWidgets();
            
            console.log('✅ Dashboard loaded');
        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.showToast('Error loading dashboard', 'error');
        }
    }

    updateElementText(id, text) {
        const element = document.getElementById(id);
        if (element) element.textContent = text;
    }

    calculateMonthlySubscriptionCost(subscriptions) {
        return subscriptions.reduce((sum, sub) => {
            let cost = this.convertAmount(sub.amount, sub.currency || 'NPR');
            if (sub.cycle === 'yearly') cost = cost / 12;
            else if (sub.cycle === 'quarterly') cost = cost / 3;
            return sum + cost;
        }, 0);
    }

    async renderDashboardCharts(transactions) {
        // Trend Chart
        const last6Months = this.getLast6MonthsData(transactions);
        this.renderChart('trendChart', 'line', {
            labels: last6Months.map(m => m.month),
            datasets: [
                {
                    label: 'Income',
                    data: last6Months.map(m => m.income),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Expense',
                    data: last6Months.map(m => m.expense),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        }, {
            plugins: {
                legend: { position: 'bottom' }
            }
        });

        // Expense Distribution
        const categoryData = this.getCategoryBreakdown(transactions);
        const categories = Object.keys(categoryData);
        const amounts = Object.values(categoryData).map(c => c.amount);
        
        if (categories.length > 0) {
            this.renderChart('expenseChart', 'doughnut', {
                labels: categories,
                datasets: [{
                    data: amounts,
                    backgroundColor: [
                        '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
                        '#10b981', '#3b82f6', '#ef4444', '#06b6d4'
                    ]
                }]
            }, {
                plugins: {
                    legend: { position: 'bottom' }
                }
            });
        }
    }

    getLast6MonthsData(transactions) {
        const data = [];
        const now = new Date();

        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStr = date.toISOString().substring(0, 7);
            const monthName = date.toLocaleString('default', { month: 'short' });

            const monthTxns = transactions.filter(t => t.date.startsWith(monthStr));
            
            let income = 0, expense = 0;
            monthTxns.forEach(t => {
                const amount = this.convertAmount(t.amount, t.currency || 'NPR');
                if (t.type === 'income') income += amount;
                else expense += amount;
            });

            data.push({ month: monthName, income, expense });
        }

        return data;
    }

    getCategoryBreakdown(transactions) {
        const breakdown = {};
        
        transactions.filter(t => t.type === 'expense').forEach(txn => {
            const amount = this.convertAmount(txn.amount, txn.currency || 'NPR');
            if (!breakdown[txn.category]) {
                breakdown[txn.category] = { amount: 0, count: 0 };
            }
            breakdown[txn.category].amount += amount;
            breakdown[txn.category].count += 1;
        });

        return breakdown;
    }

    renderRecentTransactions(transactions) {
        const recent = transactions
            .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
            .slice(0, 5);

        const container = document.getElementById('recentTransactions');
        if (!container) return;

        if (recent.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-secondary); padding:2rem;">No transactions yet</p>';
            return;
        }

        const html = recent.map(txn => {
            const amount = this.convertAmount(txn.amount, txn.currency || 'NPR');
            return `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <h4>${txn.description}</h4>
                        <p>${txn.category} • ${txn.date} • ${txn.account}</p>
                    </div>
                    <span class="transaction-amount ${txn.type}">
                        ${txn.type === 'income' ? '+' : '-'}${this.formatCurrency(amount)}
                    </span>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    renderChart(canvasId, type, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        this.charts[canvasId] = new Chart(ctx, {
            type: type,
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: true,
                ...options
            }
        });
    }

    // ==========================================
    // QUICK ADD TRANSACTION - FIXED
    // ==========================================
    
    quickAddTransaction(type) {
        console.log('Quick add transaction:', type);
        this.openTransactionModal(null, type);
    }

    // ==========================================
    // TRANSACTION FUNCTIONS
    // ==========================================
    
    async openTransactionModal(editId = null, defaultType = 'expense') {
        console.log('Opening transaction modal, editId:', editId, 'type:', defaultType);
        
        const modal = document.getElementById('transactionModal');
        const form = document.getElementById('transactionForm');
        const title = document.getElementById('transactionModalTitle');

        if (editId) {
            title.textContent = 'Edit Transaction';
            const txn = await this.db.get('transactions', editId);
            
            document.getElementById('txnDate').value = txn.date;
            document.getElementById('txnTime').value = txn.time || '';
            document.querySelector(`input[name="txnType"][value="${txn.type}"]`).checked = true;
            await this.populateCategorySelect('txnCategory', txn.type);
            document.getElementById('txnCategory').value = txn.category;
            document.getElementById('txnDescription').value = txn.description;
            document.getElementById('txnAmount').value = txn.amount;
            document.querySelector(`input[name="txnAccount"][value="${txn.account}"]`).checked = true;
            document.getElementById('txnNotes').value = txn.notes || '';
            
            this.currentEditId = editId;
        } else {
            title.textContent = 'Add Transaction';
            form.reset();
            document.getElementById('txnDate').value = new Date().toISOString().split('T')[0];
            document.querySelector(`input[name="txnType"][value="${defaultType}"]`).checked = true;
            await this.populateCategorySelect('txnCategory', defaultType);
            this.currentEditId = null;
        }

        this.openModal('transactionModal');
    }

    async populateCategorySelect(selectId, type) {
        const categories = await this.db.getAll('categories');
        const filtered = categories.filter(c => c.type === type);
        const select = document.getElementById(selectId);
        
        if (!select) return;
        
        select.innerHTML = filtered.map(cat => 
            `<option value="${cat.name}">${cat.icon} ${cat.name}</option>`
        ).join('');
    }

    async saveTransaction() {
        try {
            const receiptFile = document.getElementById('txnReceipt').files[0];
            
            let receiptData = null;
            if (receiptFile) {
                receiptData = await this.fileToBase64(receiptFile);
            }

            const data = {
                date: document.getElementById('txnDate').value,
                time: document.getElementById('txnTime').value,
                type: document.querySelector('input[name="txnType"]:checked').value,
                category: document.getElementById('txnCategory').value,
                description: document.getElementById('txnDescription').value,
                amount: parseFloat(document.getElementById('txnAmount').value),
                account: document.querySelector('input[name="txnAccount"]:checked').value,
                notes: document.getElementById('txnNotes').value,
                receipt: receiptData,
                currency: this.currentCurrency,
                createdAt: new Date().toISOString()
            };

            if (this.currentEditId) {
                data.id = this.currentEditId;
                await this.db.update('transactions', data);
                this.showToast('Transaction updated!', 'success');
            } else {
                await this.db.add('transactions', data);
                this.showToast('Transaction added!', 'success');
            }

            this.closeModal('transactionModal');
            document.getElementById('transactionForm').reset();
            this.currentEditId = null;
            
            // ✅ FIX: Refresh after saving
            await this.loadDashboard();
            await this.loadTransactions();
            await this.refreshInsights();
        } catch (error) {
            console.error('Error saving transaction:', error);
            this.showToast('Error saving transaction', 'error');
        }
    }

    async loadTransactions(filtered = false) {
        console.log('Loading transactions...');
        
        try {
            let transactions = await this.db.getAll('transactions');
            
            if (filtered) {
                const startDate = document.getElementById('filterStartDate').value;
                const endDate = document.getElementById('filterEndDate').value;
                const type = document.getElementById('filterType').value;
                const category = document.getElementById('filterCategory').value;
                const account = document.getElementById('filterAccount').value;

                transactions = transactions.filter(txn => {
                    let match = true;
                    if (startDate && txn.date < startDate) match = false;
                    if (endDate && txn.date > endDate) match = false;
                    if (type && txn.type !== type) match = false;
                    if (category && txn.category !== category) match = false;
                    if (account && txn.account !== account) match = false;
                    return match;
                });
            }

            transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

            const tbody = document.getElementById('transactionsList');
            if (!tbody) return;
            
            if (transactions.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem;">No transactions found</td></tr>';
                return;
            }

            tbody.innerHTML = transactions.map(txn => {
                const amount = this.convertAmount(txn.amount, txn.currency || 'NPR');
                return `
                    <tr>
                        <td>${txn.date}</td>
                        <td><span class="badge badge-${txn.type}">${txn.type}</span></td>
                        <td>${txn.category}</td>
                        <td>${txn.description}</td>
                        <td class="${txn.type}">${this.formatCurrency(amount)}</td>
                        <td>${txn.account}</td>
                        <td>${txn.receipt ? '📎' : '-'}</td>
                        <td class="action-btns">
                            ${txn.receipt ? `<button class="btn-edit" onclick="app.viewReceipt(${txn.id})" title="View Receipt">👁️</button>` : ''}
                            <button class="btn-edit" onclick="app.openTransactionModal(${txn.id})" title="Edit">✏️</button>
                            <button class="btn-delete" onclick="app.deleteTransaction(${txn.id})" title="Delete">🗑️</button>
                        </td>
                    </tr>
                `;
            }).join('');

            // Update filter category dropdown
            const categories = await this.db.getAll('categories');
            const filterCat = document.getElementById('filterCategory');
            if (filterCat) {
                filterCat.innerHTML = '<option value="">All Categories</option>' +
                    categories.map(cat => `<option value="${cat.name}">${cat.icon} ${cat.name}</option>`).join('');
            }
            
            console.log('✅ Transactions loaded');
        } catch (error) {
            console.error('Error loading transactions:', error);
            this.showToast('Error loading transactions', 'error');
        }
    }

    async deleteTransaction(id) {
        if (confirm('Delete this transaction?')) {
            await this.db.delete('transactions', id);
            this.showToast('Transaction deleted', 'success');
            await this.loadDashboard();
            await this.loadTransactions();
        }
    }

    async viewReceipt(id) {
        const txn = await this.db.get('transactions', id);
        if (txn.receipt) {
            const win = window.open();
            win.document.write(`
                <html>
                    <head><title>Receipt - ${txn.description}</title></head>
                    <body style="margin:0; display:flex; justify-content:center; align-items:center; min-height:100vh; background:#000;">
                        <img src="${txn.receipt}" style="max-width:100%; max-height:100vh;">
                    </body>
                </html>
            `);
        }
    }

    // ==========================================
    // SHOPPING LIST FUNCTIONS - COMPLETE
    // ==========================================
    
    async quickAddShoppingItem() {
        const name = document.getElementById('quickItemName').value;
        const quantity = parseInt(document.getElementById('quickItemQuantity').value);
        const price = parseFloat(document.getElementById('quickItemPrice').value) || 0;

        if (!name) {
            this.showToast('Please enter item name', 'error');
            return;
        }

        let lists = await this.db.getAll('shopping_lists');
        let quickList = lists.find(l => l.name === 'Quick Shopping' && !l.completed);

        if (!quickList) {
            const id = await this.db.add('shopping_lists', {
                name: 'Quick Shopping',
                date: new Date().toISOString().split('T')[0],
                store: '',
                category: 'groceries',
                budget: 0,
                items: [],
                completed: false,
                createdAt: new Date().toISOString()
            });
            quickList = await this.db.get('shopping_lists', id);
        }

        quickList.items = quickList.items || [];
        quickList.items.push({
            id: Date.now(),
            name,
            quantity,
            unit: 'pcs',
            estimatedPrice: price,
            actualPrice: 0,
            category: 'other',
            notes: '',
            priority: false,
            purchased: false
        });

        await this.db.update('shopping_lists', quickList);

        document.getElementById('quickShoppingForm').reset();
        document.getElementById('quickItemQuantity').value = 1;
        
        this.showToast('Item added to Quick Shopping!', 'success');
        await this.loadShoppingLists();
        await this.loadShoppingStats();
    }

    async openShoppingListModal(editId = null) {
        const form = document.getElementById('shoppingListForm');
        const title = document.getElementById('shoppingListModalTitle');

        if (editId) {
            title.textContent = 'Edit Shopping List';
            const list = await this.db.get('shopping_lists', editId);
            
            document.getElementById('listName').value = list.name;
            document.getElementById('listDate').value = list.date;
            document.getElementById('listStore').value = list.store;
            document.getElementById('listBudget').value = list.budget || '';
            document.getElementById('listCategory').value = list.category;
            
            form.dataset.editId = editId;
        } else {
            title.textContent = 'Create Shopping List';
            form.reset();
            document.getElementById('listDate').value = new Date().toISOString().split('T')[0];
            delete form.dataset.editId;
        }

        this.openModal('shoppingListModal');
    }

    async saveShoppingList() {
        const form = document.getElementById('shoppingListForm');
        const data = {
            name: document.getElementById('listName').value,
            date: document.getElementById('listDate').value,
            store: document.getElementById('listStore').value,
            budget: parseFloat(document.getElementById('listBudget').value) || 0,
            category: document.getElementById('listCategory').value,
            items: [],
            completed: false,
            createdAt: new Date().toISOString()
        };

        if (form.dataset.editId) {
            data.id = parseInt(form.dataset.editId);
            const existing = await this.db.get('shopping_lists', data.id);
            data.items = existing.items;
            data.completed = existing.completed;
            await this.db.update('shopping_lists', data);
        } else {
            await this.db.add('shopping_lists', data);
        }

        this.closeModal('shoppingListModal');
        this.showToast('Shopping list saved!', 'success');
        await this.loadShoppingLists();
    }

    async loadShoppingLists(filter = 'all') {
        let lists = await this.db.getAll('shopping_lists');

        if (filter === 'active') {
            lists = lists.filter(l => !l.completed);
        } else if (filter === 'completed') {
            lists = lists.filter(l => l.completed);
        }

        lists.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const container = document.getElementById('shoppingListsContainer');
        if (!container) return;
        
        if (lists.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-secondary); padding:2rem;">No shopping lists yet</p>';
            return;
        }

        container.innerHTML = lists.map(list => this.renderShoppingListCard(list)).join('');
    }

    renderShoppingListCard(list) {
        const items = list.items || [];
        const purchasedCount = items.filter(i => i.purchased).length;
        const totalItems = items.length;
        const progress = totalItems > 0 ? (purchasedCount / totalItems) * 100 : 0;
        
        const estimatedTotal = items.reduce((sum, i) => sum + (i.estimatedPrice * i.quantity), 0);
        const actualTotal = items.reduce((sum, i) => sum + (i.purchased ? i.actualPrice * i.quantity : 0), 0);
        
        const categoryIcons = {
            groceries: '🛒', household: '🏠', electronics: '💻',
            clothing: '👕', pharmacy: '💊', other: '📦'
        };

        return `
            <div class="shopping-list-card ${list.completed ? 'completed' : ''}">
                <div class="shopping-list-header">
                    <div class="shopping-list-title">
                        <h3>${categoryIcons[list.category]} ${list.name}</h3>
                        <div class="shopping-list-meta">
                            <span>📅 ${list.date}</span>
                            ${list.store ? `<span>🏪 ${list.store}</span>` : ''}
                        </div>
                    </div>
                    <div class="shopping-list-actions">
                        <button class="btn-edit" onclick="app.addItemToList(${list.id})" title="Add Item">➕</button>
                        <button class="btn-edit" onclick="app.openShoppingListModal(${list.id})" title="Edit">✏️</button>
                        <button class="btn-delete" onclick="app.deleteShoppingList(${list.id})" title="Delete">🗑️</button>
                        ${!list.completed ? `
                            <button class="btn-pay" onclick="app.completeShoppingList(${list.id})" title="Complete">✓</button>
                        ` : ''}
                    </div>
                </div>

                <div class="shopping-items-container">
                    ${items.length > 0 ? items.map(item => this.renderShoppingItem(item, list.id)).join('') : 
                        '<p style="color:var(--text-secondary); text-align:center;">No items yet</p>'}
                </div>

                ${!list.completed ? `
                    <div class="add-item-btn" onclick="app.addItemToList(${list.id})">
                        ➕ Add Item
                    </div>
                ` : ''}

                <div class="shopping-list-footer">
                    <div class="list-progress">
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
                            <span style="font-size:0.875rem;">Progress</span>
                            <span style="font-size:0.875rem; font-weight:600;">${purchasedCount}/${totalItems} items</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width:${progress}%"></div>
                        </div>
                    </div>
                    <div class="list-total">
                        <div class="list-total-label">${purchasedCount > 0 ? 'Spent' : 'Estimated'}</div>
                        <div class="list-total-amount">
                            ${this.formatCurrency(purchasedCount > 0 ? actualTotal : estimatedTotal)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderShoppingItem(item, listId) {
        const categoryIcons = {
            vegetables: '🥕', fruits: '🍎', dairy: '🥛', meat: '🍖',
            bakery: '🍞', beverages: '🥤', snacks: '🍿', cleaning: '🧹',
            personal: '🧴', other: '📦'
        };

        return `
            <div class="shopping-item ${item.purchased ? 'purchased' : ''} ${item.priority ? 'priority' : ''}">
                <input type="checkbox" class="item-checkbox" 
                    ${item.purchased ? 'checked disabled' : ''} 
                    onchange="app.toggleItemPurchased(${listId}, ${item.id})">
                
                <div class="item-info">
                    <h4>
                        <span class="category-icon">${categoryIcons[item.category]}</span>
                        ${item.name}
                        ${item.priority ? '<span class="priority-badge">!</span>' : ''}
                    </h4>
                    <div class="item-details">
                        ${item.quantity} ${item.unit}
                        ${item.estimatedPrice > 0 ? ` • Est: ${this.formatCurrency(item.estimatedPrice * item.quantity)}` : ''}
                        ${item.purchased && item.actualPrice > 0 ? ` • Actual: ${this.formatCurrency(item.actualPrice * item.quantity)}` : ''}
                    </div>
                </div>

                ${!item.purchased ? `
                    <div class="item-actions">
                        <button class="btn-edit" onclick="app.editShoppingItem(${listId}, ${item.id})" title="Edit">✏️</button>
                        <button class="btn-delete" onclick="app.deleteShoppingItem(${listId}, ${item.id})" title="Delete">🗑️</button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    async addItemToList(listId) {
        const form = document.getElementById('shoppingItemForm');
        form.reset();
        form.dataset.listId = listId;
        delete form.dataset.itemId;
        document.getElementById('shoppingItemModalTitle').textContent = 'Add Item';
        this.openModal('shoppingItemModal');
    }

    async editShoppingItem(listId, itemId) {
        const list = await this.db.get('shopping_lists', listId);
        const item = list.items.find(i => i.id === itemId);

        if (!item) return;

        document.getElementById('itemName').value = item.name;
        document.getElementById('itemQuantity').value = item.quantity;
        document.getElementById('itemUnit').value = item.unit;
        document.getElementById('itemEstPrice').value = item.estimatedPrice;
        document.getElementById('itemActualPrice').value = item.actualPrice || '';
        document.getElementById('itemCategory').value = item.category;
        document.getElementById('itemNotes').value = item.notes || '';
        document.getElementById('itemPriority').checked = item.priority;

        const form = document.getElementById('shoppingItemForm');
        form.dataset.listId = listId;
        form.dataset.itemId = itemId;

        document.getElementById('shoppingItemModalTitle').textContent = 'Edit Item';
        this.openModal('shoppingItemModal');
    }

    async saveShoppingItem() {
        const form = document.getElementById('shoppingItemForm');
        const listId = parseInt(form.dataset.listId);
        const list = await this.db.get('shopping_lists', listId);

        const itemData = {
            id: form.dataset.itemId ? parseInt(form.dataset.itemId) : Date.now(),
            name: document.getElementById('itemName').value,
            quantity: parseFloat(document.getElementById('itemQuantity').value),
            unit: document.getElementById('itemUnit').value,
            estimatedPrice: parseFloat(document.getElementById('itemEstPrice').value) || 0,
            actualPrice: parseFloat(document.getElementById('itemActualPrice').value) || 0,
            category: document.getElementById('itemCategory').value,
            notes: document.getElementById('itemNotes').value,
            priority: document.getElementById('itemPriority').checked,
            purchased: false
        };

        if (form.dataset.itemId) {
            const index = list.items.findIndex(i => i.id === parseInt(form.dataset.itemId));
            if (index !== -1) {
                itemData.purchased = list.items[index].purchased;
                list.items[index] = itemData;
            }
        } else {
            list.items = list.items || [];
            list.items.push(itemData);
        }

        await this.db.update('shopping_lists', list);
        this.closeModal('shoppingItemModal');
        this.showToast('Item saved!', 'success');
        await this.loadShoppingLists();
        await this.loadShoppingStats();
    }

    async toggleItemPurchased(listId, itemId) {
        const list = await this.db.get('shopping_lists', listId);
        const item = list.items.find(i => i.id === itemId);

        if (!item || item.purchased) return;

        const actualPrice = prompt(`Enter actual price for ${item.name}:`, item.estimatedPrice || '');
        if (actualPrice === null) return;

        item.purchased = true;
        item.actualPrice = parseFloat(actualPrice) || item.estimatedPrice;
        item.purchasedDate = new Date().toISOString().split('T')[0];

        await this.db.update('shopping_lists', list);

        // Create expense transaction
        const categoryMapping = {
            vegetables: 'Food & Dining',
            fruits: 'Food & Dining',
            dairy: 'Food & Dining',
            meat: 'Food & Dining',
            bakery: 'Food & Dining',
            beverages: 'Food & Dining',
            snacks: 'Food & Dining',
            cleaning: 'Bills & Utilities',
            personal: 'Healthcare',
            other: 'Shopping'
        };

        await this.db.add('transactions', {
            date: item.purchasedDate,
            type: 'expense',
            category: categoryMapping[item.category] || 'Shopping',
            description: `${item.name} (${list.name})`,
            amount: item.actualPrice * item.quantity,
            account: 'cash',
            currency: this.currentCurrency,
            createdAt: new Date().toISOString()
        });

        this.showToast(`${item.name} marked as purchased & expense created!`, 'success');
        await this.loadShoppingLists();
        await this.loadShoppingStats();
        await this.loadDashboard();
    }

    async deleteShoppingItem(listId, itemId) {
        if (!confirm('Delete this item?')) return;

        const list = await this.db.get('shopping_lists', listId);
        list.items = list.items.filter(i => i.id !== itemId);
        await this.db.update('shopping_lists', list);

        this.showToast('Item deleted!', 'success');
        await this.loadShoppingLists();
        await this.loadShoppingStats();
    }

    async completeShoppingList(listId) {
        const list = await this.db.get('shopping_lists', listId);
        
        const unpurchased = list.items.filter(i => !i.purchased);
        if (unpurchased.length > 0) {
            if (!confirm(`There are ${unpurchased.length} unpurchased items. Complete anyway?`)) {
                return;
            }
        }

        list.completed = true;
        list.completedDate = new Date().toISOString().split('T')[0];
        await this.db.update('shopping_lists', list);

        this.showToast('Shopping list completed!', 'success');
        await this.loadShoppingLists();
    }

    async deleteShoppingList(listId) {
        if (!confirm('Delete this shopping list?')) return;

        await this.db.delete('shopping_lists', listId);
        this.showToast('Shopping list deleted!', 'success');
        await this.loadShoppingLists();
    }

    async loadShoppingStats() {
        const lists = await this.db.getAll('shopping_lists');
        const activeLists = lists.filter(l => !l.completed);

        let totalItems = 0;
        let purchasedItems = 0;
        let estimatedTotal = 0;
        let actualSpent = 0;

        activeLists.forEach(list => {
            (list.items || []).forEach(item => {
                totalItems++;
                estimatedTotal += item.estimatedPrice * item.quantity;
                if (item.purchased) {
                    purchasedItems++;
                    actualSpent += item.actualPrice * item.quantity;
                }
            });
        });

        this.updateElementText('totalShoppingItems', totalItems);
        this.updateElementText('purchasedItems', purchasedItems);
        this.updateElementText('estimatedTotal', this.formatCurrency(estimatedTotal));
        this.updateElementText('actualSpent', this.formatCurrency(actualSpent));
    }

    async exportShoppingLists() {
        const lists = await this.db.getAll('shopping_lists');
        const data = {
            lists,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        this.downloadFile(
            JSON.stringify(data, null, 2),
            `shopping-lists-${new Date().toISOString().split('T')[0]}.json`,
            'application/json'
        );

        this.showToast('Shopping lists exported!', 'success');
    }

    // ==========================================
    // SUBSCRIPTION FUNCTIONS - FIXED WITH REFRESH
    // ==========================================
    
    async openSubscriptionModal(editId = null, template = null) {
        const form = document.getElementById('subscriptionForm');
        const title = document.getElementById('subscriptionModalTitle');

        if (editId) {
            title.textContent = 'Edit Subscription';
            const sub = await this.db.get('subscriptions', editId);
            
            document.getElementById('subName').value = sub.name;
            document.getElementById('subCategory').value = sub.category;
            document.getElementById('subAmount').value = sub.amount;
            document.getElementById('subCycle').value = sub.cycle;
            document.getElementById('subNextBilling').value = sub.nextBilling;
            document.getElementById('subEmail').value = sub.email || '';
            document.getElementById('subUrl').value = sub.url || '';
            document.getElementById('subNotes').value = sub.notes || '';
            document.getElementById('subAutoRenew').checked = sub.autoRenew;
            document.getElementById('subReminder').checked = sub.reminder;
            
            form.dataset.editId = editId;
        } else {
            title.textContent = 'Add Subscription';
            form.reset();
            document.getElementById('subNextBilling').value = new Date().toISOString().split('T')[0];
            
            if (template) {
                document.getElementById('subName').value = template;
            }
            
            delete form.dataset.editId;
        }

        this.openModal('subscriptionModal');
    }

    async saveSubscription() {
        const form = document.getElementById('subscriptionForm');
        
        const data = {
            name: document.getElementById('subName').value,
            category: document.getElementById('subCategory').value,
            amount: parseFloat(document.getElementById('subAmount').value),
            cycle: document.getElementById('subCycle').value,
            nextBilling: document.getElementById('subNextBilling').value,
            email: document.getElementById('subEmail').value,
            url: document.getElementById('subUrl').value,
            notes: document.getElementById('subNotes').value,
            autoRenew: document.getElementById('subAutoRenew').checked,
            reminder: document.getElementById('subReminder').checked,
            active: true,
            currency: this.currentCurrency,
            createdAt: new Date().toISOString()
        };

        try {
            if (form.dataset.editId) {
                data.id = parseInt(form.dataset.editId);
                await this.db.update('subscriptions', data);
                this.showToast('Subscription updated!', 'success');
            } else {
                await this.db.add('subscriptions', data);
                this.showToast('Subscription added!', 'success');
            }

            this.closeModal('subscriptionModal');
            form.reset();
            
            // ✅ FIX: Refresh after saving subscription
            await this.loadSubscriptions();
            await this.loadDashboard();
            await this.refreshDashboardWidgets();
        } catch (error) {
            console.error('Error saving subscription:', error);
            this.showToast('Error saving subscription', 'error');
        }
    }

    async loadSubscriptions() {
        const subscriptions = await this.db.getAll('subscriptions');
        const active = subscriptions.filter(s => s.active);

        let monthlyCost = 0;
        let yearlyCost = 0;
        let upcomingCount = 0;

        active.forEach(sub => {
            const amount = this.convertAmount(sub.amount, sub.currency || 'NPR');
            
            if (sub.cycle === 'monthly') {
                monthlyCost += amount;
                yearlyCost += amount * 12;
            } else if (sub.cycle === 'quarterly') {
                monthlyCost += amount / 3;
                yearlyCost += amount * 4;
            } else if (sub.cycle === 'yearly') {
                monthlyCost += amount / 12;
                yearlyCost += amount;
            }

            const daysUntil = this.getDaysUntil(sub.nextBilling);
            if (daysUntil <= 30 && daysUntil >= 0) {
                upcomingCount++;
            }
        });

        this.updateElementText('activeSubCount', active.length);
        this.updateElementText('monthlySubCost', this.formatCurrency(monthlyCost));
        this.updateElementText('yearlySubCost', this.formatCurrency(yearlyCost));
        this.updateElementText('upcomingSubRenewals', upcomingCount);

        this.renderSubscriptionsList(subscriptions);
        this.renderSubscriptionCalendar(subscriptions);
        
        // ✅ FIX: Refresh widgets after loading
        await this.refreshDashboardWidgets();
    }

    renderSubscriptionsList(subscriptions) {
        const container = document.getElementById('subscriptionsList');
        if (!container) return;
        
        if (subscriptions.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-secondary); padding:2rem;">No subscriptions yet</p>';
            return;
        }

        const categoryIcons = {
            streaming: '🎬', music: '🎵', cloud: '☁️', software: '💻',
            gaming: '🎮', news: '📰', fitness: '💪', other: '📦'
        };

        const html = subscriptions.map(sub => {
            const amount = this.convertAmount(sub.amount, sub.currency || 'NPR');
            const daysUntil = this.getDaysUntil(sub.nextBilling);
            const isUpcoming = daysUntil <= 7 && daysUntil >= 0;

            return `
                <div class="subscription-card ${sub.active ? '' : 'inactive'} ${isUpcoming ? 'upcoming' : ''}">
                    <div class="sub-header">
                        <div class="sub-info">
                            <h3>${categoryIcons[sub.category]} ${sub.name}</h3>
                            <p class="sub-meta">
                                ${sub.cycle} • Next: ${sub.nextBilling}
                                ${isUpcoming ? ` (in ${daysUntil} days)` : ''}
                            </p>
                        </div>
                        <div class="sub-amount">
                            ${this.formatCurrency(amount)}
                            <span class="sub-cycle">/${sub.cycle === 'yearly' ? 'year' : sub.cycle === 'quarterly' ? 'quarter' : 'month'}</span>
                        </div>
                    </div>
                    <div class="sub-details">
                        ${sub.email ? `<p>📧 ${sub.email}</p>` : ''}
                        ${sub.notes ? `<p>📝 ${sub.notes}</p>` : ''}
                    </div>
                    <div class="sub-actions">
                        ${sub.url ? `<a href="${sub.url}" target="_blank" class="btn btn-ghost">🔗 Visit</a>` : ''}
                        <button class="btn-edit" onclick="app.openSubscriptionModal(${sub.id})">✏️ Edit</button>
                        <button class="btn-delete" onclick="app.deleteSubscription(${sub.id})">🗑️ Delete</button>
                        <button class="btn-pay" onclick="app.toggleSubscription(${sub.id})">
                            ${sub.active ? '⏸️ Pause' : '▶️ Resume'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    renderSubscriptionCalendar(subscriptions) {
        const active = subscriptions.filter(s => s.active);
        const calendar = document.getElementById('subscriptionCalendar');
        if (!calendar) return;
        
        const byMonth = {};
        active.forEach(sub => {
            const month = sub.nextBilling.substring(0, 7);
            if (!byMonth[month]) byMonth[month] = [];
            byMonth[month].push(sub);
        });

        const html = Object.entries(byMonth)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(0, 3)
            .map(([month, subs]) => {
                const monthName = new Date(month + '-01').toLocaleString('default', { month: 'long', year: 'numeric' });
                return `
                    <div class="calendar-month">
                        <h4>${monthName}</h4>
                        <div class="calendar-items">
                            ${subs.map(sub => {
                                const amount = this.convertAmount(sub.amount, sub.currency || 'NPR');
                                return `
                                    <div class="calendar-item">
                                        <span class="cal-date">${sub.nextBilling.split('-')[2]}</span>
                                        <span class="cal-name">${sub.name}</span>
                                        <span class="cal-amount">${this.formatCurrency(amount)}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }).join('');

        calendar.innerHTML = html || '<p>No upcoming renewals</p>';
    }

    async toggleSubscription(id) {
        const sub = await this.db.get('subscriptions', id);
        sub.active = !sub.active;
        await this.db.update('subscriptions', sub);
        this.showToast(`Subscription ${sub.active ? 'activated' : 'paused'}`, 'success');
        await this.loadSubscriptions();
        await this.loadDashboard();
    }

    async deleteSubscription(id) {
        if (!confirm('Delete this subscription?')) return;
        
        await this.db.delete('subscriptions', id);
        this.showToast('Subscription deleted', 'success');
        await this.loadSubscriptions();
        await this.loadDashboard();
    }

    addSubscriptionFromTemplate(name) {
        this.openSubscriptionModal(null, name);
    }

    async exportSubscriptions() {
        const subscriptions = await this.db.getAll('subscriptions');
        this.downloadFile(
            JSON.stringify(subscriptions, null, 2),
            `subscriptions-${new Date().toISOString().split('T')[0]}.json`,
            'application/json'
        );
        this.showToast('Subscriptions exported!', 'success');
    }

    getDaysUntil(dateString) {
        const target = new Date(dateString);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);
        return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    }

    // ==========================================
    // WISHLIST, DOCUMENTS, ANALYTICS, INSIGHTS
    // (Keeping all remaining functions from your original code...)
    // ==========================================
    
    // ... [Include all remaining functions from your original code: wishlist, documents, analytics, insights, receipt scanner, settings, utility functions] ...

    // ==========================================
    // UTILITY FUNCTIONS
    // ==========================================

    openModal(modalId) {
        console.log(`🔓 Opening modal: ${modalId}`);
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modalId) {
        console.log(`🔒 Closing modal: ${modalId}`);
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    showToast(message, type = 'info') {
        console.log(`🍞 Toast: [${type.toUpperCase()}] ${message}`);
        
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <span class="toast-message">${message}</span>
        `;

        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    toggleNotificationPanel() {
        const panel = document.getElementById('notificationPanel');
        if (panel) {
            panel.classList.toggle('active');
        }
    }

    clearNotifications() {
        this.notifications = [];
        const list = document.getElementById('notificationsList');
        if (list) {
            list.innerHTML = '<p style="text-align:center; padding:2rem; color:var(--text-secondary);">No notifications</p>';
        }
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            badge.textContent = '0';
            badge.style.display = 'none';
        }
    }

    downloadFile(content, filename, type) {
        try {
            const blob = new Blob([content], { type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download error:', error);
        }
    }

    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

} // <-- CLOSING BRACE FOR ExpenseTrackerApp CLASS

// ==========================================
// INITIALIZE APP
// ==========================================

let app;
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 DOM Content Loaded - Initializing Expense Tracker Pro...');
    
    try {
        app = new ExpenseTrackerApp();
        console.log('✅ App initialized successfully');
    } catch (error) {
        console.error('❌ App initialization failed:', error);
    }
});

console.log('📦 Script loaded successfully');
