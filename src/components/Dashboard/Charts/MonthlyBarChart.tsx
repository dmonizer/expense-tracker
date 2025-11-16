import { memo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import type { TooltipItem } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { Transaction, TransactionFilters } from '../../../types';
import { getMonthlySummary, getMonthlyGroupSummary } from '../../../services/analytics';
import { formatCurrency } from '../../../utils';
import { getCategoryColor } from '../../../utils/colorUtils';
import { db } from '../../../services/db';
import { format, parse, eachMonthOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { useEffect, useState } from 'react';
import { useFilters } from '../../../contexts/FilterContext';
import { UNCATEGORIZED_GROUP_ID } from '../../../constants';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Register custom tooltip positioner to follow cursor
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Tooltip.positioners as any).cursor = function(
  _elements: unknown, 
  eventPosition: { x: number; y: number }
) {
  return {
    x: eventPosition.x,
    y: eventPosition.y
  };
};

interface MonthlyBarChartProps {
  transactions: Transaction[];
  filters: TransactionFilters;
}

// ============================================
// Helper Types
// ============================================

interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
}

interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

// ============================================
// Helper Functions - Data Transformation
// ============================================

/**
 * Fill missing months in a date range with empty data
 */
function fillMissingMonths<T extends { month: string }>(
  data: T[],
  dateFrom: Date | undefined,
  dateTo: Date | undefined,
  emptyDataFactory: (month: string) => T
): T[] {
  if (!dateFrom || !dateTo) {
    return data;
  }

  const allMonths = eachMonthOfInterval({
    start: startOfMonth(dateFrom),
    end: endOfMonth(dateTo)
  });

  const dataMap = new Map(data.map(item => [item.month, item]));

  return allMonths.map(date => {
    const monthKey = format(date, 'yyyy-MM');
    return dataMap.get(monthKey) || emptyDataFactory(monthKey);
  });
}

/**
 * Format month labels for display
 */
function formatMonthLabels(summaries: Array<{ month: string }>): string[] {
  return summaries.map(item => {
    const date = parse(item.month, 'yyyy-MM', new Date());
    return format(date, 'MMM yyyy');
  });
}

/**
 * Make border color from background color (increase opacity)
 */
function makeBorderColor(backgroundColor: string): string {
  return backgroundColor.replace(/[\d.]+\)$/, '1)');
}

/**
 * Check if a category should be included based on selected group
 */
function shouldIncludeCategory(
  category: string,
  selectedGroupId: string | null | undefined,
  ruleMap: Map<string, { groupId?: string }>
): boolean {
  if (!selectedGroupId) {
    return true;
  }

  const rule = ruleMap.get(category);

  // Handle uncategorized group
  if (selectedGroupId === UNCATEGORIZED_GROUP_ID) {
    return !rule || !rule.groupId || rule.groupId === UNCATEGORIZED_GROUP_ID;
  }

  // Regular group filtering
  return rule?.groupId === selectedGroupId;
}

/**
 * Get color for a category based on its group and variant
 */
function getCategoryColorFromRule(
  category: string,
  ruleMap: Map<string, { groupId?: string; colorVariant?: number }>,
  groupMap: Map<string, { baseColor: string }>
): string {
  const DEFAULT_COLOR = 'hsl(0, 0%, 60%)';
  
  const rule = ruleMap.get(category);
  if (!rule?.groupId) {
    return DEFAULT_COLOR;
  }

  const group = groupMap.get(rule.groupId);
  if (!group) {
    return DEFAULT_COLOR;
  }

  return getCategoryColor(group.baseColor, rule.colorVariant || 0);
}

// ============================================
// Helper Functions - Data Loading
// ============================================

/**
 * Load and format group summary data
 */
async function loadGroupSummaryData(
  filters: TransactionFilters
): Promise<ChartData | null> {
  const summaries = await getMonthlyGroupSummary(filters);
  const filledSummaries = fillMissingMonths(
    summaries,
    filters.dateFrom,
    filters.dateTo,
    (month): { month: string; groups: Record<string, number>; total: number } => 
      ({ month, groups: {}, total: 0 })
  );

  if (filledSummaries.length === 0) {
    return null;
  }

  // Get group data for colors and sorting
  const categoryGroups = await db.categoryGroups.toArray();
  const groupMap = new Map(categoryGroups.map(g => [g.name, g]));

  // Extract unique groups and sort by priority
  const groupsSet = new Set<string>();
  filledSummaries.forEach(item => {
    Object.keys(item.groups).forEach(group => groupsSet.add(group));
  });

  const sortedGroups = Array.from(groupsSet).sort((a, b) => {
    const groupA = groupMap.get(a);
    const groupB = groupMap.get(b);
    if (!groupA || !groupB) return 0;
    return groupA.priority - groupB.priority;
  });

  // Create datasets
  const datasets: ChartDataset[] = sortedGroups.map(groupName => {
    const group = groupMap.get(groupName);
    const backgroundColor = group?.baseColor || 'hsl(0, 0%, 60%)';

    return {
      label: groupName,
      data: filledSummaries.map(item => item.groups[groupName] || 0),
      backgroundColor,
      borderColor: makeBorderColor(backgroundColor),
      borderWidth: 1,
    };
  });

  return {
    labels: formatMonthLabels(filledSummaries),
    datasets,
  };
}

/**
 * Load and format category summary data
 */
async function loadCategorySummaryData(
  filters: TransactionFilters,
  selectedGroupId: string | null | undefined
): Promise<ChartData | null> {
  const summaries = await getMonthlySummary(filters);
  const filledSummaries = fillMissingMonths(
    summaries,
    filters.dateFrom,
    filters.dateTo,
    (month): { month: string; categories: Record<string, number>; total: number } => 
      ({ month, categories: {}, total: 0 })
  );

  if (filledSummaries.length === 0) {
    return null;
  }

  // Get category rules and groups
  const categoryRules = await db.categoryRules.toArray();
  const categoryGroups = await db.categoryGroups.toArray();
  const ruleMap = new Map(categoryRules.map(rule => [rule.name, rule]));
  const groupMap = new Map(categoryGroups.map(group => [group.id, group]));

  // Extract and filter categories
  const categoriesSet = new Set<string>();
  filledSummaries.forEach(item => {
    Object.keys(item.categories).forEach(cat => {
      if (shouldIncludeCategory(cat, selectedGroupId, ruleMap)) {
        categoriesSet.add(cat);
      }
    });
  });

  const sortedCategories = Array.from(categoriesSet).sort();

  // Create datasets
  const datasets: ChartDataset[] = sortedCategories.map(category => {
    const backgroundColor = getCategoryColorFromRule(category, ruleMap, groupMap);

    return {
      label: category,
      data: filledSummaries.map(item => item.categories[category] || 0),
      backgroundColor,
      borderColor: makeBorderColor(backgroundColor),
      borderWidth: 1,
    };
  });

  return {
    labels: formatMonthLabels(filledSummaries),
    datasets,
  };
}

/**
 * Handle drilldown action for a group or category label
 */
async function handleDrilldown(
  itemLabel: string,
  drilldownView: string,
  drillDownToGroup: (groupId: string) => void,
  drillDownToCategory: (category: string) => void
): Promise<void> {
  if (drilldownView === 'groups') {
    // Handle group drilldown
    if (itemLabel === 'Unknown expenses') {
      drillDownToGroup(UNCATEGORIZED_GROUP_ID);
    } else {
      const categoryGroups = await db.categoryGroups.toArray();
      const group = categoryGroups.find(g => g.name === itemLabel);
      if (group) {
        drillDownToGroup(group.id);
      }
    }
  } else {
    // Handle category drilldown
    drillDownToCategory(itemLabel);
  }
}

// ============================================
// Helper Functions - Chart Configuration
// ============================================

/**
 * Create chart options with event handlers
 */
function createChartOptions(
  filters: TransactionFilters,
  drilldownView: string,
  handleChartClick: (event: unknown, elements: unknown[]) => void,
  drillDownToGroup: (groupId: string) => void,
  drillDownToCategory: (category: string) => void
) {
  const currency = filters.currencies?.[0] || 'EUR';

  return {
    responsive: true,
    maintainAspectRatio: false,
    onClick: handleChartClick,
    scales: {
      x: {
        stacked: true,
        grid: {
          display: false,
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: {
          callback: (tickValue: string | number) => {
            const value = typeof tickValue === 'string' ? parseFloat(tickValue) : tickValue;
            return formatCurrency(value, currency);
          },
        },
      },
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          padding: 10,
          font: {
            size: 11,
          },
          boxWidth: 12,
        },
        onClick: async (_event: unknown, legendItem: { text?: string }) => {
          const itemLabel = legendItem.text;
          if (!itemLabel) return;
          await handleDrilldown(itemLabel, drilldownView, drillDownToGroup, drillDownToCategory);
        },
      },
      tooltip: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        position: 'cursor' as any,
        mode: 'index' as const,
        intersect: false,
        itemSort: (a: TooltipItem<'bar'>, b: TooltipItem<'bar'>) => {
          return (b.parsed.y || 0) - (a.parsed.y || 0);
        },
        callbacks: {
          label: (context: TooltipItem<'bar'>) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y || 0;
            return `${label}: ${formatCurrency(value, currency)}`;
          },
          footer: (tooltipItems: TooltipItem<'bar'>[]) => {
            const total = tooltipItems.reduce((sum, item) => sum + (item.parsed.y || 0), 0);
            return `Total: ${formatCurrency(total, currency)}`;
          },
        },
      },
    },
  };
}

function MonthlyBarChart({ transactions, filters }: Readonly<MonthlyBarChartProps>) {
  const { drilldownView, selectedGroupId, drillDownToGroup, drillDownToCategory, goBackOneLevel } = useFilters();
  
  const [isLoading, setIsLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartData | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const data = drilldownView === 'groups'
          ? await loadGroupSummaryData(filters)
          : await loadCategorySummaryData(filters, selectedGroupId);

        setChartData(data);
      } catch (error) {
        console.error('Error loading monthly summary:', error);
        setChartData(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [transactions, filters, drilldownView, selectedGroupId]);

  const handleChartClick = async (_event: unknown, elements: unknown[]) => {
    if (!elements || !Array.isArray(elements) || elements.length === 0) {
      return;
    }

    const element = elements[0] as { datasetIndex: number };
    const itemLabel = chartData?.datasets[element.datasetIndex]?.label;
    
    if (!itemLabel) return;

    await handleDrilldown(itemLabel, drilldownView, drillDownToGroup, drillDownToCategory);
  };

  const handleBackClick = () => {
    goBackOneLevel();
  };

  const options = createChartOptions(
    filters,
    drilldownView,
    handleChartClick,
    drillDownToGroup,
    drillDownToCategory
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-pulse w-full px-4">
          <div className="h-4 w-24 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-2">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-40 bg-gray-200 rounded"></div>
            <div className="h-28 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!chartData) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-gray-500 text-sm">No data available</p>
          <p className="text-gray-400 text-xs mt-1">Try adjusting your filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {drilldownView !== 'groups' && (
        <div className="mb-2 flex items-center gap-2">
          <button
            onClick={handleBackClick}
            className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <span className="text-sm text-gray-600">
            {drilldownView === 'category' ? 'Category view' : drilldownView === 'group' ? 'Group view' : 'Groups overview'}
          </span>
        </div>
      )}
      <div className="flex-1">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}

export default memo(MonthlyBarChart);
