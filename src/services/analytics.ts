import type {Transaction, TransactionFilters} from '@/types';
import {db} from './db';
import {format} from 'date-fns';
import {UNCATEGORIZED_GROUP_ID} from '@/constants';
import {DEFAULT_GROUP_COLORS} from '../utils/colorUtils';
import {filterTransactions} from '../utils/transactionFilters';
import type {BalancePoint, CategorySummary, GroupSummary, MonthlySummary} from "@/types/chartDataTypes.ts";

/**
 * Applies filters to an array of transactions.
 * Filters by date range, categories, currencies, amount range, transaction type, and search query.
 * 
 * @param transactions - Array of transactions to filter
 * @param filters - Filter criteria to apply
 * @returns Filtered array of transactions
 * @deprecated Use filterTransactions from utils/transactionFilters instead
 */
export function applyFilters(transactions: Transaction[], filters: TransactionFilters): Transaction[] {
  return filterTransactions(transactions, filters);
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

  // Group by category and calculate totals (expenses only)
  const categoryMap = new Map<string, { amount: number; count: number }>();

  for (const transaction of transactions) {
    // Only process expense transactions (debits)
    if (transaction.type !== 'debit') {
      continue;
    }

    const category = transaction.category || 'Uncategorized';
    const amount = Math.abs(transaction.amount);
    
    if (!categoryMap.has(category)) {
      categoryMap.set(category, { amount: 0, count: 0 });
    }
    
    const summary = categoryMap.get(category)!;
    summary.amount += amount;
    summary.count += 1;
  }

  // Calculate total expenses for percentage calculation
  let totalExpenses = 0;
  for (const data of categoryMap.values()) {
    totalExpenses += data.amount;
  }

  // Convert to array and calculate percentages (as percentage of total expenses)
  const categorySummaries: CategorySummary[] = [];
  for (const [category, data] of categoryMap.entries()) {
    categorySummaries.push({
      category,
      amount: data.amount,
      count: data.count,
      percentage: totalExpenses > 0 ? (data.amount / totalExpenses) * 100 : 0
    });
  }

  // Sort by amount descending
  return categorySummaries.sort((a, b) => b.amount - a.amount);
}

/**
 * Get group summary with drill-down data
 * Aggregates transactions by category group and includes category-level details
 * 
 * @param filters - Transaction filters to apply
 * @returns Array of group summaries sorted by priority
 */
export async function getGroupSummary(filters: TransactionFilters): Promise<GroupSummary[]> {
  // Get all transactions and rules
  const allTransactions = await db.transactions.toArray();
  const categoryRules = await db.categoryRules.toArray();
  const categoryGroups = await db.categoryGroups.toArray();
  
  // Apply filters
  const transactions = applyFilters(allTransactions, filters);

  // Handle empty data
  if (transactions.length === 0) {
    return [];
  }

  // Create maps for quick lookups
  const ruleMap = new Map(categoryRules.map(rule => [rule.name, rule]));
  const groupMap = new Map(categoryGroups.map(group => [group.id, group]));

  // First, get category summaries
  const categorySummary = await getCategorySummary(filters);

  // Group categories by their group
  const groupDataMap = new Map<string, {
    groupId: string;
    groupName: string;
    baseColor: string;
    priority: number;
    amount: number;
    count: number;
    categories: CategorySummary[];
  }>();

  // Process each category and aggregate by group
  for (const catSummary of categorySummary) {
    const rule = ruleMap.get(catSummary.category);
    
    let targetGroupId: string;
    let targetGroup;
    
    if (!rule || !rule.groupId) {
      // Handle uncategorized or categories without groups
      // Add them to the special uncategorized group
      targetGroupId = UNCATEGORIZED_GROUP_ID;
      targetGroup = groupMap.get(UNCATEGORIZED_GROUP_ID);
      
      // If uncategorized group doesn't exist in DB yet, create a virtual one
      if (!targetGroup) {
        targetGroup = {
          id: UNCATEGORIZED_GROUP_ID,
          name: 'Unknown expenses',
          description: 'Transactions that have not been categorized yet',
          baseColor: DEFAULT_GROUP_COLORS.uncategorized,
          priority: 999,
          isDefault: true,
          sortOrder: 999,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
    } else {
      targetGroupId = rule.groupId;
      targetGroup = groupMap.get(rule.groupId);
      
      if (!targetGroup) {
        continue;
      }
    }

    if (!groupDataMap.has(targetGroupId)) {
      groupDataMap.set(targetGroupId, {
        groupId: targetGroup.id,
        groupName: targetGroup.name,
        baseColor: targetGroup.baseColor,
        priority: targetGroup.priority,
        amount: 0,
        count: 0,
        categories: [],
      });
    }

    const groupData = groupDataMap.get(targetGroupId)!;
    groupData.amount += catSummary.amount;
    groupData.count += catSummary.count;
    groupData.categories.push(catSummary);
  }

  // Calculate total for percentages
  let total = 0;
  for (const data of groupDataMap.values()) {
    total += data.amount;
  }

  // Convert to array and add percentages
  const groupSummaries: GroupSummary[] = Array.from(groupDataMap.values()).map(data => ({
    groupId: data.groupId,
    groupName: data.groupName,
    baseColor: data.baseColor,
    priority: data.priority,
    amount: data.amount,
    count: data.count,
    percentage: total > 0 ? (data.amount / total) * 100 : 0,
    categories: data.categories,
  }));

  // Sort by priority (lower priority number = more critical = appears first)
  return groupSummaries.sort((a, b) => a.priority - b.priority);
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

  // Group by month (YYYY-MM format) - expenses only
  const monthlyMap = new Map<string, Record<string, number>>();

  for (const transaction of transactions) {
    // Only process expense transactions (debits)
    if (transaction.type !== 'debit') {
      continue;
    }

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
 * Get monthly summary aggregated by category groups
 * Returns monthly data with group-level aggregation
 * 
 * @param filters - Transaction filters to apply
 * @returns Array of monthly summaries with group data
 */
export async function getMonthlyGroupSummary(filters: TransactionFilters): Promise<{
  month: string;
  groups: Record<string, number>;
  total: number;
}[]> {
  // Get regular monthly summary
  const monthlySummary = await getMonthlySummary(filters);
  
  // Get rules and groups for mapping
  const categoryRules = await db.categoryRules.toArray();
  const categoryGroups = await db.categoryGroups.toArray();
  
  const ruleMap = new Map(categoryRules.map(rule => [rule.name, rule]));
  const groupMap = new Map(categoryGroups.map(group => [group.id, group]));

  // Transform category-based data to group-based data
  return monthlySummary.map(monthData => {
    const groups: Record<string, number> = {};
    let total = 0;

    // Aggregate categories by their groups
    for (const [categoryName, amount] of Object.entries(monthData.categories)) {
      const rule = ruleMap.get(categoryName);
      
      let groupName: string;
      
      if (!rule || !rule.groupId) {
        // Add uncategorized transactions to the special uncategorized group
        const uncategorizedGroup = groupMap.get(UNCATEGORIZED_GROUP_ID);
        groupName = uncategorizedGroup ? uncategorizedGroup.name : 'Unknown expenses';
      } else {
        const group = groupMap.get(rule.groupId);
        if (!group) {
          continue;
        }
        groupName = group.name;
      }

      if (!groups[groupName]) {
        groups[groupName] = 0;
      }

      groups[groupName] += amount;
      total += amount;
    }

    return {
      month: monthData.month,
      groups,
      total,
    };
  });
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
