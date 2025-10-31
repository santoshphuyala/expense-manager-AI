// AI Insights Engine
class InsightsEngine {
    constructor(database) {
        this.db = database;
    }

    async generateAllInsights() {
        const insights = [];
        
        const transactions = await this.db.getAll('transactions');
        const subscriptions = await this.db.getAll('subscriptions');
        const wishlist = await this.db.getAll('wishlist');
        
        // Spending Insights
        insights.push(...await this.getSpendingInsights(transactions));
        
        // Savings Insights
        insights.push(...await this.getSavingsInsights(transactions));
        
        // Pattern Insights
        insights.push(...await this.getPatternInsights(transactions));
        
        // Subscription Insights
        insights.push(...await this.getSubscriptionInsights(subscriptions));
        
        // Warning Insights
        insights.push(...await this.getWarningInsights(transactions, subscriptions));
        
        // Achievement Insights
        insights.push(...await this.getAchievements(transactions));
        
        // Tips
        insights.push(...await this.getTips(transactions, subscriptions));

        // Sort by priority and recency
        insights.sort((a, b) => {
            const priorityOrder = { urgent: 0, warning: 1, info: 2, tip: 3, achievement: 4 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

        // Save insights
        await this.db.clear('insights');
        for (const insight of insights) {
            await this.db.add('insights', {
                ...insight,
                createdAt: new Date().toISOString()
            });
        }

        return insights;
    }

    async getSpendingInsights(transactions) {
        const insights = [];
        const thisMonth = this.getThisMonthTransactions(transactions);
        const lastMonth = this.getLastMonthTransactions(transactions);

        // Calculate monthly totals
        const thisMonthExpense = thisMonth
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);
        
        const lastMonthExpense = lastMonth
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        // Month-over-month comparison
        if (lastMonthExpense > 0) {
            const change = ((thisMonthExpense - lastMonthExpense) / lastMonthExpense) * 100;
            
            if (change > 20) {
                insights.push({
                    category: 'spending',
                    priority: 'warning',
                    icon: '📈',
                    title: 'Spending Increased',
                    message: `Your spending increased by ${change.toFixed(1)}% compared to last month.`,
                    action: 'Review your expenses',
                    actionLink: 'transactions'
                });
            } else if (change < -20) {
                insights.push({
                    category: 'spending',
                    priority: 'achievement',
                    icon: '🎉',
                    title: 'Great Job!',
                    message: `You reduced spending by ${Math.abs(change).toFixed(1)}% this month!`,
                    action: null
                });
            }
        }

        // Category analysis
        const categorySpending = this.getCategoryTotals(thisMonth);
        const maxCategory = Object.entries(categorySpending)
            .sort((a, b) => b[1] - a[1])[0];

        if (maxCategory && thisMonthExpense > 0) {
            const percentage = (maxCategory[1] / thisMonthExpense) * 100;
            
            if (percentage > 40) {
                insights.push({
                    category: 'spending',
                    priority: 'info',
                    icon: '💡',
                    title: 'Top Spending Category',
                    message: `${maxCategory[0]} accounts for ${percentage.toFixed(1)}% of your spending.`,
                    action: 'View category details',
                    actionLink: 'analytics'
                });
            }
        }

        // Unusual spending detection
        const avgDailySpend = this.getAverageDailySpend(transactions);
        const recentDailySpend = this.getRecentDailySpend(transactions, 3);

        if (recentDailySpend > avgDailySpend * 2) {
            insights.push({
                category: 'spending',
                priority: 'warning',
                icon: '⚠️',
                title: 'Unusual Spending Detected',
                message: `Your recent daily spending is ${((recentDailySpend / avgDailySpend - 1) * 100).toFixed(0)}% higher than average.`,
                action: 'Check recent transactions',
                actionLink: 'transactions'
            });
        }

        return insights;
    }

    async getSavingsInsights(transactions) {
        const insights = [];
        const thisMonth = this.getThisMonthTransactions(transactions);

        const income = thisMonth
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        
        const expense = thisMonth
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        if (income > 0) {
            const savingsRate = ((income - expense) / income) * 100;
            
            if (savingsRate < 0) {
                insights.push({
                    category: 'savings',
                    priority: 'urgent',
                    icon: '🚨',
                    title: 'Spending More Than Earning',
                    message: `You're spending ${Math.abs(savingsRate).toFixed(1)}% more than your income!`,
                    action: 'Create budget plan',
                    actionLink: 'analytics'
                });
            } else if (savingsRate < 10) {
                insights.push({
                    category: 'savings',
                    priority: 'warning',
                    icon: '💰',
                    title: 'Low Savings Rate',
                    message: `You're only saving ${savingsRate.toFixed(1)}% of your income. Aim for at least 20%.`,
                    action: 'Tips to save more',
                    actionLink: 'insights'
                });
            } else if (savingsRate >= 30) {
                insights.push({
                    category: 'savings',
                    priority: 'achievement',
                    icon: '🏆',
                    title: 'Excellent Savings!',
                    message: `Amazing! You're saving ${savingsRate.toFixed(1)}% of your income.`,
                    action: null
                });
            }
        }

        // Savings streak
        const savingsStreak = this.calculateSavingsStreak(transactions);
        if (savingsStreak >= 3) {
            insights.push({
                category: 'savings',
                priority: 'achievement',
                icon: '🔥',
                title: `${savingsStreak} Month Savings Streak!`,
                message: `You've saved money for ${savingsStreak} consecutive months!`,
                action: null
            });
        }

        return insights;
    }

    async getPatternInsights(transactions) {
        const insights = [];

        // Day of week analysis
        const dayPattern = this.getDayOfWeekPattern(transactions);
        const maxDay = Object.entries(dayPattern)
            .sort((a, b) => b[1] - a[1])[0];

        if (maxDay) {
            insights.push({
                category: 'spending',
                priority: 'info',
                icon: '📊',
                title: 'Spending Pattern',
                message: `You tend to spend most on ${maxDay[0]}s.`,
                action: 'View analytics',
                actionLink: 'analytics'
            });
        }

        // Time-based patterns
        const morningSpend = this.getTimeBasedSpend(transactions, 6, 12);
        const eveningSpend = this.getTimeBasedSpend(transactions, 18, 23);

        if (eveningSpend > morningSpend * 2) {
            insights.push({
                category: 'spending',
                priority: 'tip',
                icon: '🌙',
                title: 'Evening Spending',
                message: 'You spend more in the evening. Consider planning purchases during the day.',
                action: null
            });
        }

        return insights;
    }

    async getSubscriptionInsights(subscriptions) {
        const insights = [];
        const activeSubscriptions = subscriptions.filter(s => s.active);

        if (activeSubscriptions.length === 0) return insights;

        // Total monthly cost
        const monthlyCost = activeSubscriptions.reduce((sum, sub) => {
            let cost = sub.amount;
            if (sub.cycle === 'yearly') cost = cost / 12;
            else if (sub.cycle === 'quarterly') cost = cost / 3;
            return sum + cost;
        }, 0);

        insights.push({
            category: 'spending',
            priority: 'info',
            icon: '🔄',
            title: 'Subscription Cost',
            message: `You're paying ${monthlyCost.toFixed(2)} monthly for ${activeSubscriptions.length} subscriptions.`,
            action: 'Manage subscriptions',
            actionLink: 'subscriptions'
        });

        // Upcoming renewals
        const upcomingRenewals = activeSubscriptions.filter(sub => {
            const daysUntil = this.getDaysUntil(sub.nextBilling);
            return daysUntil <= 7 && daysUntil >= 0;
        });

        if (upcomingRenewals.length > 0) {
            insights.push({
                category: 'warnings',
                priority: 'warning',
                icon: '⏰',
                title: 'Upcoming Renewals',
                message: `${upcomingRenewals.length} subscription(s) renewing within 7 days.`,
                action: 'View subscriptions',
                actionLink: 'subscriptions'
            });
        }

        // Unused subscriptions (no associated transactions in 30 days)
        // This would require tracking subscription usage - placeholder for now
        
        return insights;
    }

    async getWarningInsights(transactions, subscriptions) {
        const insights = [];

        // Budget warnings (if budgets are set)
        // This would require budget functionality - placeholder

        // Duplicate transactions
        const duplicates = this.findDuplicateTransactions(transactions);
        if (duplicates.length > 0) {
            insights.push({
                category: 'warnings',
                priority: 'warning',
                icon: '⚠️',
                title: 'Possible Duplicate Transactions',
                message: `Found ${duplicates.length} possible duplicate transaction(s).`,
                action: 'Review transactions',
                actionLink: 'transactions'
            });
        }

        // Large expenses
        const avgExpense = transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0) / Math.max(transactions.filter(t => t.type === 'expense').length, 1);

        const largeExpenses = transactions
            .filter(t => t.type === 'expense' && t.amount > avgExpense * 3)
            .filter(t => this.isRecent(t.date, 7));

        if (largeExpenses.length > 0) {
            insights.push({
                category: 'warnings',
                priority: 'info',
                icon: '💸',
                title: 'Large Expenses',
                message: `You had ${largeExpenses.length} large expense(s) in the past week.`,
                action: 'View details',
                actionLink: 'transactions'
            });
        }

        return insights;
    }

    async getAchievements(transactions) {
        const insights = [];

        // First transaction
        if (transactions.length === 1) {
            insights.push({
                category: 'achievements',
                priority: 'achievement',
                icon: '🎊',
                title: 'Welcome!',
                message: 'You\'ve added your first transaction. Great start to tracking finances!',
                action: null
            });
        }

        // Milestones
        const milestones = [10, 50, 100, 500, 1000];
        if (milestones.includes(transactions.length)) {
            insights.push({
                category: 'achievements',
                priority: 'achievement',
                icon: '🏅',
                title: `${transactions.length} Transactions!`,
                message: `Congratulations! You've tracked ${transactions.length} transactions.`,
                action: null
            });
        }

        // Consecutive days tracking
        const streak = this.calculateTrackingStreak(transactions);
        if (streak >= 7) {
            insights.push({
                category: 'achievements',
                priority: 'achievement',
                icon: '🔥',
                title: `${streak} Day Streak!`,
                message: `You've been tracking expenses for ${streak} consecutive days!`,
                action: null
            });
        }

        return insights;
    }

    async getTips(transactions, subscriptions) {
        const tips = [
            {
                category: 'tips',
                priority: 'tip',
                icon: '💡',
                title: 'Use Categories',
                message: 'Properly categorizing expenses helps you understand spending patterns better.',
                action: 'Manage categories',
                actionLink: 'more'
            },
            {
                category: 'tips',
                priority: 'tip',
                icon: '📸',
                title: 'Scan Receipts',
                message: 'Use the receipt scanner for quick expense entry.',
                action: 'Try scanner',
                actionLink: 'dashboard'
            },
            {
                category: 'tips',
                priority: 'tip',
                icon: '💾',
                title: 'Backup Your Data',
                message: 'Regularly export your data to keep a backup.',
                action: 'Export now',
                actionLink: 'more'
            },
            {
                category: 'tips',
                priority: 'tip',
                icon: '🎯',
                title: 'Set Financial Goals',
                message: 'Use the wishlist feature to save for things you want.',
                action: 'Create wishlist',
                actionLink: 'wishlist'
            }
        ];

        // Return random tips
        return tips.sort(() => Math.random() - 0.5).slice(0, 2);
    }

    // Helper methods
    getThisMonthTransactions(transactions) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        return transactions.filter(t => t.date >= startOfMonth);
    }

    getLastMonthTransactions(transactions) {
        const now = new Date();
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
        return transactions.filter(t => t.date >= startOfLastMonth && t.date <= endOfLastMonth);
    }

    getCategoryTotals(transactions) {
        const totals = {};
        transactions.filter(t => t.type === 'expense').forEach(t => {
            totals[t.category] = (totals[t.category] || 0) + t.amount;
        });
        return totals;
    }

    getAverageDailySpend(transactions) {
        const expenses = transactions.filter(t => t.type === 'expense');
        if (expenses.length === 0) return 0;

        const dates = [...new Set(expenses.map(t => t.date))];
        const total = expenses.reduce((sum, t) => sum + t.amount, 0);
        return total / Math.max(dates.length, 1);
    }

    getRecentDailySpend(transactions, days) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().split('T')[0];

        const recent = transactions.filter(t => t.type === 'expense' && t.date >= cutoffStr);
        return recent.reduce((sum, t) => sum + t.amount, 0) / days;
    }

    getDayOfWeekPattern(transactions) {
        const pattern = {
            Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0,
            Friday: 0, Saturday: 0, Sunday: 0
        };

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        transactions.filter(t => t.type === 'expense').forEach(t => {
            const date = new Date(t.date);
            const dayName = days[date.getDay()];
            pattern[dayName] += t.amount;
        });

        return pattern;
    }

    getTimeBasedSpend(transactions, startHour, endHour) {
        // This would work if we had time data in transactions
        // For now, return 0
        return 0;
    }

    calculateSavingsStreak(transactions) {
        // Group by month
        const monthlyData = {};
        transactions.forEach(t => {
            const month = t.date.substring(0, 7);
            if (!monthlyData[month]) {
                monthlyData[month] = { income: 0, expense: 0 };
            }
            if (t.type === 'income') monthlyData[month].income += t.amount;
            else monthlyData[month].expense += t.amount;
        });

        // Count consecutive months with positive savings
        const months = Object.keys(monthlyData).sort().reverse();
        let streak = 0;
        
        for (const month of months) {
            if (monthlyData[month].income > monthlyData[month].expense) {
                streak++;
            } else {
                break;
            }
        }

        return streak;
    }

    calculateTrackingStreak(transactions) {
        if (transactions.length === 0) return 0;

        const dates = [...new Set(transactions.map(t => t.date))].sort().reverse();
        let streak = 0;
        let currentDate = new Date();

        for (let i = 0; i < dates.length; i++) {
            const txnDate = new Date(dates[i]);
            const diffDays = Math.floor((currentDate - txnDate) / (1000 * 60 * 60 * 24));

            if (diffDays === streak) {
                streak++;
            } else if (diffDays > streak) {
                break;
            }
        }

        return streak;
    }

    findDuplicateTransactions(transactions) {
        const duplicates = [];
        const recent = transactions.filter(t => this.isRecent(t.date, 30));

        for (let i = 0; i < recent.length; i++) {
            for (let j = i + 1; j < recent.length; j++) {
                if (
                    recent[i].amount === recent[j].amount &&
                    recent[i].category === recent[j].category &&
                    recent[i].type === recent[j].type &&
                    recent[i].date === recent[j].date
                ) {
                    duplicates.push([recent[i], recent[j]]);
                }
            }
        }

        return duplicates;
    }

    getDaysUntil(dateString) {
        const target = new Date(dateString);
        const now = new Date();
        return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    }

    isRecent(dateString, days) {
        const date = new Date(dateString);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return date >= cutoff;
    }
}