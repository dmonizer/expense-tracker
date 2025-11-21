// Chart Data Types
export interface CategorySummary {
    category: string;
    amount: number;
    count: number;
    percentage: number;
}

export interface GroupSummary {
    groupId: string;
    groupName: string;
    baseColor: string;
    priority: number;
    amount: number;
    count: number;
    percentage: number;
    categories: CategorySummary[]; // Drill-down data
}

export interface MonthlySummary {
    month: string; // YYYY-MM
    categories: Record<string, number>;
    total: number;
}

export interface BalancePoint {
    date: Date;
    balance: number;
}