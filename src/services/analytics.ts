import type { Transaction, CategorySummary, MonthlySummary, BalancePoint, TransactionFilters } from '../types/index';
import { db } from './db';
import { format } from 'date-fns';

/**
 * Applies filters to an array of transactions.
 * Filters by date range, categories, currencies, amount range, transaction type, and search query.
 * 
 * @param transactions - Array of transactions to filter
 * @param filters - Filter criteria to apply
 * @returns Filtered array of transactions
 */
export function applyFilters(transactions: Transaction[], filters: TransactionFilters): Transaction[] {
  let filtered = [...transactions];

  // Filter by date range
  if (filters.dateFrom) {
    filtered = filtered.filter(t => t.date >= filters.dateFrom!);
  }
  if (filters.dateTo) {
    filtered = filtered.filter(t => t.date <= filters.dateTo!);
  }

  // Filter by categories
  if (filters.categories && filters.categories.length > 0) {
    filtered = filtered.filter(t => t.category && filters.categories!.includes(t.category));
  }

  // Filter by currencies
  if (filters.currencies && filters.currencies.length > 0) {
    filtered = filtered.filter(t => filters.currencies!.includes(t.currency));
  }

  // Filter by amount range
  if (filters.minAmount !== undefined) {
    filtered = filtered.filter(t => Math.abs(t.amount) >= filters.minAmount!);
  }
  if (filters.maxAmount !== undefined) {
    filtered = filtered.filter(t => Math.abs(t.amount) <= filters.maxAmount!);
  }

  // Filter by transaction type
  if (filters.transactionType && filters.transactionType !== 'both') {
    if (filters.transactionType === 'income') {
      filtered = filtered.filter(t => t.type === 'credit');
    } else if (filters.transactionType === 'expense') {
      filtered = filtered.filter(t => t.type === 'debit');
    }
  }

  // Filter by search query (payee and description)
  if (filters.searchQuery && filters.searchQuery.trim() !== '') {
    const query = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(t => 
      t.payee.toLowerCase().includes(query) || 
      t.description.toLowerCase().includes(query)
    );
  }

  return filtered;
}

/**
 * Gets category summary with total amount, count, and percentage for each category.
 * Returns data sorted by amount in descending order.
 * 
 * @param filters - Optional filters to apply to transactions
 * @returns Promise resolving to array of category summaries
 */
export async function getCategorySummary(filters: TransactionFilters): Promise<CategorySummary[]> {
  // Get all transactions from database
  const allTransactions = await db.transactions.toArray();
  
  // Apply filters
  const transactions = applyFilters(allTransactions, filters);

  // Handle empty data
  if (transactions.length === 0) {
    return [];
  }

  // Group by category and calculate totals
  const categoryMap = new Map<string, { amount: number; count: number }>();
  let grandTotal = 0;

  for (const transaction of transactions) {
    const category = transaction.category || 'Uncategorized';
    const amount = Math.abs(transaction.amount);
    
    if (!categoryMap.has(category)) {
      categoryMap.set(category, { amount: 0, count: 0 });
    }
    
    const summary = categoryMap.get(category)!;
    summary.amount += amount;
    summary.count += 1;
    grandTotal += amount;
  }

  // Convert to array and calculate percentages
  const categorySummaries: CategorySummary[] = [];
  for (const [category, data] of categoryMap.entries()) {
    categorySummaries.push({
      category,
      amount: data.amount,
      count: data.count,
      percentage: grandTotal > 0 ? (data.amount / grandTotal) * 100 : 0
    });
  }

  // Sort by amount descending
  return categorySummaries.sort((a, b) => b.amount - a.amount);
}

/**
 * Gets monthly summary with amounts grouped by category for each month.
 * Returns data sorted chronologically.
 * 
 * @param filters - Optional filters to apply to transactions
 * @returns Promise resolving to array of monthly summaries
 */
export async function getMonthlySummary(filters: TransactionFilters): Promise<MonthlySummary[]> {
  // Get all transactions from database
  const allTransactions = await db.transactions.toArray();
  
  // Apply filters
  const transactions = applyFilters(allTransactions, filters);

  // Handle empty data
  if (transactions.length === 0) {
    return [];
  }

  // Group by month (YYYY-MM format)
  const monthlyMap = new Map<string, Record<string, number>>();

  for (const transaction of transactions) {
    const monthKey = format(transaction.date, 'yyyy-MM');
    const category = transaction.category || 'Uncategorized';
    const amount = Math.abs(transaction.amount);

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, {});
    }

    const monthData = monthlyMap.get(monthKey)!;
    monthData[category] = (monthData[category] || 0) + amount;
  }

  // Convert to array with monthly totals
  const monthlySummaries: MonthlySummary[] = [];
  for (const [month, categories] of monthlyMap.entries()) {
    const total = Object.values(categories).reduce((sum, amount) => sum + amount, 0);
    monthlySummaries.push({
      month,
      categories,
      total
    });
  }

  // Sort chronologically
  return monthlySummaries.sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Calculates running balance over time based on filtered transactions.
 * Credits add to balance, debits subtract from balance.
 * Handles multiple currencies by focusing on primary currency from filters.
 * 
 * @param filters - Optional filters to apply to transactions
 * @returns Promise resolving to array of balance points
 */
export async function getBalanceOverTime(filters: TransactionFilters): Promise<BalancePoint[]> {
  // Get all transactions from database
  const allTransactions = await db.transactions.toArray();
  
  // Apply filters
  const transactions = applyFilters(allTransactions, filters);

  // Handle empty data
  if (transactions.length === 0) {
    return [];
  }

  // Sort by date (ascending)
  const sortedTransactions = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Calculate running balance
  const balancePoints: BalancePoint[] = [];
  let runningBalance = 0;

  for (const transaction of sortedTransactions) {
    // Credits add, debits subtract
    if (transaction.type === 'credit') {
      runningBalance += transaction.amount;
    } else {
      runningBalance -= Math.abs(transaction.amount);
    }

    balancePoints.push({
      date: transaction.date,
      balance: runningBalance
    });
  }

  return balancePoints;
}
