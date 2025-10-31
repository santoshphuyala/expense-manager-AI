// Advanced Analytics Engine
class Analytics {
    constructor(database) {
        this.db = database;
        this.charts = {};
    }

    async generateReport(timeRange) {
        const { startDate, endDate } = this.getDateRange(timeRange);
        const transactions = await this.getTransactionsInRange(startDate, endDate);
        
        return {
            summary: this.calculateSummary(transactions),
            categoryBreakdown: this.getCategoryBreakdown(transactions),
            dailyPattern: this.getDailyPattern(transactions),
            monthlyTrend: this.getMonthlyTrend(transactions),
            topCategories: this.getTopCategories(transactions),
            accountDistribution: this.getAccountDistribution(transactions),
            comparison: await this.getComparison(transactions, timeRange),
            insights: this.generateInsights(transactions)
        };
    }

    getDateRange(timeRange) {
        const today = new Date();
        let startDate, endDate;

        endDate = new Date(today);
        
        switch (timeRange) {
            case 'thisMonth':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                break;
            case 'lastMonth':
                startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                endDate = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
            case 'last3Months':
                startDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
                break;
            case 'last6Months':
                startDate = new Date(today.getFullYear(), today.getMonth() - 6, 1);
                break;
            case 'thisYear':
                startDate = new Date(today.getFullYear(), 0, 1);
                break;
            case 'lastYear':
                startDate = new Date(today.getFullYear() - 1, 0, 1);
                endDate = new Date(today.getFullYear() - 1, 11, 31);
                break;
            default:
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        }

        return {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        };
    }

    async getTransactionsInRange(startDate, endDate) {
        const all = await this.db.getAll('transactions');
        return all.filter(txn => txn.date >= startDate && txn.date <= endDate);
    }

    calculateSummary(transactions) {
        let totalIncome = 0;
        let totalExpense = 0;
        let transactionCount = transactions.length;

        transactions.forEach(txn => {
            if (txn.type === 'income') {
                totalIncome += txn.amount;
            } else {
                totalExpense += txn.amount;
            }
        });

        const netSavings = totalIncome - totalExpense;
        const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;
        
        // Calculate days
        const dates = transactions.map(t => t.date).sort();
        const dayCount = dates.length > 0 
            ? Math.ceil((new Date(dates[dates.length - 1]) - new Date(dates[0])) / (1000 * 60 * 60 * 24)) + 1 
            : 1;
        
        const avgDailySpend = totalExpense / dayCount;
        const highestExpense = Math.max(...transactions.filter(t => t.type === 'expense').map(t => t.amount), 0);

        return {
            totalIncome,
            totalExpense,
            netSavings,
            savingsRate,
            transactionCount,
            avgDailySpend,
            highestExpense,
            dayCount
        };
    }

    getCategoryBreakdown(transactions) {
        const breakdown = {};
        
        transactions.forEach(txn => {
            if (txn.type === 'expense') {
                if (!breakdown[txn.category]) {
                    breakdown[txn.category] = {
                        amount: 0,
                        count: 0,
                        percentage: 0
                    };
                }
                breakdown[txn.category].amount += txn.amount;
                breakdown[txn.category].count += 1;
            }
        });

        const totalExpense = Object.values(breakdown).reduce((sum, cat) => sum + cat.amount, 0);
        
        Object.keys(breakdown).forEach(cat => {
            breakdown[cat].percentage = totalExpense > 0 
                ? (breakdown[cat].amount / totalExpense) * 100 
                : 0;
        });

        return breakdown;
    }

    getDailyPattern(transactions) {
        const pattern = {
            Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0,
            Friday: 0, Saturday: 0, Sunday: 0
        };

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        transactions.filter(t => t.type === 'expense').forEach(txn => {
            const date = new Date(txn.date);
            const dayName = days[date.getDay()];
            pattern[dayName] += txn.amount;
        });

        return pattern;
    }

    getMonthlyTrend(transactions) {
        const trend = {};

        transactions.forEach(txn => {
            const month = txn.date.substring(0, 7); // YYYY-MM
            
            if (!trend[month]) {
                trend[month] = { income: 0, expense: 0 };
            }
            
            if (txn.type === 'income') {
                trend[month].income += txn.amount;
            } else {
                trend[month].expense += txn.amount;
            }
        });

        return trend;
    }

    getTopCategories(transactions, limit = 5) {
        const breakdown = this.getCategoryBreakdown(transactions);
        
        return Object.entries(breakdown)
            .sort((a, b) => b[1].amount - a[1].amount)
            .slice(0, limit)
            .map(([category, data]) => ({
                category,
                ...data
            }));
    }

    getAccountDistribution(transactions) {
        const distribution = {
            cash: { income: 0, expense: 0, balance: 0 },
            bank: { income: 0, expense: 0, balance: 0 }
        };

        transactions.forEach(txn => {
            const account = txn.account || 'cash';
            if (txn.type === 'income') {
                distribution[account].income += txn.amount;
                distribution[account].balance += txn.amount;
            } else {
                distribution[account].expense += txn.amount;
                distribution[account].balance -= txn.amount;
            }
        });

        return distribution;
    }

    async getComparison(currentTransactions, timeRange) {
        // Get previous period transactions
        const { startDate } = this.getDateRange(timeRange);
        const start = new Date(startDate);
        const daysDiff = Math.ceil((new Date() - start) / (1000 * 60 * 60 * 24));
        
        const prevStart = new Date(start);
        prevStart.setDate(prevStart.getDate() - daysDiff);
        const prevEnd = new Date(start);
        prevEnd.setDate(prevEnd.getDate() - 1);

        const prevTransactions = await this.getTransactionsInRange(
            prevStart.toISOString().split('T')[0],
            prevEnd.toISOString().split('T')[0]
        );

        const current = this.calculateSummary(currentTransactions);
        const previous = this.calculateSummary(prevTransactions);

        return {
            income: {
                current: current.totalIncome,
                previous: previous.totalIncome,
                change: this.calculateChange(previous.totalIncome, current.totalIncome)
            },
            expense: {
                current: current.totalExpense,
                previous: previous.totalExpense,
                change: this.calculateChange(previous.totalExpense, current.totalExpense)
            },
            savings: {
                current: current.netSavings,
                previous: previous.netSavings,
                change: this.calculateChange(previous.netSavings, current.netSavings)
            }
        };
    }

    calculateChange(oldValue, newValue) {
        if (oldValue === 0) return newValue > 0 ? 100 : 0;
        return ((newValue - oldValue) / oldValue) * 100;
    }

    generateInsights(transactions) {
        const insights = [];
        const breakdown = this.getCategoryBreakdown(transactions);
        const summary = this.calculateSummary(transactions);

        // High spending category
        const topCategory = Object.entries(breakdown)
            .sort((a, b) => b[1].amount - a[1].amount)[0];
        
        if (topCategory) {
            insights.push({
                type: 'info',
                message: `Your highest spending is on ${topCategory[0]} (${topCategory[1].percentage.toFixed(1)}%)`
            });
        }

        // Savings rate
        if (summary.savingsRate < 10) {
            insights.push({
                type: 'warning',
                message: `Low savings rate: ${summary.savingsRate.toFixed(1)}%. Try to save at least 20% of income.`
            });
        } else if (summary.savingsRate > 30) {
            insights.push({
                type: 'success',
                message: `Great savings rate: ${summary.savingsRate.toFixed(1)}%! Keep it up!`
            });
        }

        return insights;
    }

    // Chart rendering methods
    renderChart(canvasId, type, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        // Create new chart
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

    destroyChart(canvasId) {
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
            delete this.charts[canvasId];
        }
    }

    destroyAllCharts() {
        Object.keys(this.charts).forEach(canvasId => {
            this.destroyChart(canvasId);
        });
    }
}