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
(Tooltip.positioners as any).cursor = function(_elements: any, eventPosition: any) {
  return {
    x: eventPosition.x,
    y: eventPosition.y
  };
};

interface MonthlyBarChartProps {
  transactions: Transaction[];
  filters: TransactionFilters;
}

function MonthlyBarChart({ transactions, filters }: MonthlyBarChartProps) {
  const { drilldownView, selectedGroupId, drillDownToGroup, drillDownToCategory, goBackOneLevel } = useFilters();
  
  const [isLoading, setIsLoading] = useState(true);
  const [chartData, setChartData] = useState<{
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor: string;
      borderColor: string;
      borderWidth: number;
    }[];
  } | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        if (drilldownView === 'groups') {
          // Load monthly group summary
          let monthlyGroupSummary = await getMonthlyGroupSummary(filters);
          
          // Generate all months in the date range if filters specify dates
          if (filters.dateFrom && filters.dateTo) {
            const allMonths = eachMonthOfInterval({
              start: startOfMonth(filters.dateFrom),
              end: endOfMonth(filters.dateTo)
            });
            
            const monthlyMap = new Map(monthlyGroupSummary.map(item => [item.month, item]));
            
            monthlyGroupSummary = allMonths.map(date => {
              const monthKey = format(date, 'yyyy-MM');
              return monthlyMap.get(monthKey) || {
                month: monthKey,
                groups: {},
                total: 0
              };
            });
          }
          
          if (monthlyGroupSummary.length === 0) {
            setChartData(null);
            setIsLoading(false);
            return;
          }

          // Get group data for colors and sorting
          const categoryGroups = await db.categoryGroups.toArray();
          const groupMap = new Map(categoryGroups.map(g => [g.name, g]));

          // Extract unique groups and sort by priority
          const groupsSet = new Set<string>();
          monthlyGroupSummary.forEach(item => {
            Object.keys(item.groups).forEach(group => groupsSet.add(group));
          });
          const groups = Array.from(groupsSet).sort((a, b) => {
            const groupA = groupMap.get(a);
            const groupB = groupMap.get(b);
            if (!groupA || !groupB) return 0;
            return groupA.priority - groupB.priority;
          });

          // Format month labels
          const labels = monthlyGroupSummary.map(item => {
            const date = parse(item.month, 'yyyy-MM', new Date());
            return format(date, 'MMM yyyy');
          });

          // Create datasets (one per group)
          const datasets = groups.map(groupName => {
            const group = groupMap.get(groupName);
            const backgroundColor = group?.baseColor || 'hsl(0, 0%, 60%)';
            
            return {
              label: groupName,
              data: monthlyGroupSummary.map(item => item.groups[groupName] || 0),
              backgroundColor,
              borderColor: backgroundColor.replace(/[\d.]+\)$/, '1)'),
              borderWidth: 1,
            };
          });

          setChartData({
            labels,
            datasets,
          });
        } else {
          // Load category summary (either all or filtered by group)
          let summary = await getMonthlySummary(filters);
          
          // Generate all months in the date range if filters specify dates
          if (filters.dateFrom && filters.dateTo) {
            const allMonths = eachMonthOfInterval({
              start: startOfMonth(filters.dateFrom),
              end: endOfMonth(filters.dateTo)
            });
            
            const monthlyMap = new Map(summary.map(item => [item.month, item]));
            
            summary = allMonths.map(date => {
              const monthKey = format(date, 'yyyy-MM');
              return monthlyMap.get(monthKey) || {
                month: monthKey,
                categories: {},
                total: 0
              };
            });
          }
          
          if (summary.length === 0) {
            setChartData(null);
            setIsLoading(false);
            return;
          }

          // Get category rules and groups for filtering and colors
          const categoryRules = await db.categoryRules.toArray();
          const categoryGroups = await db.categoryGroups.toArray();
          const ruleMap = new Map(categoryRules.map(rule => [rule.name, rule]));
          const groupMap = new Map(categoryGroups.map(group => [group.id, group]));

          // Extract all unique categories
          const categoriesSet = new Set<string>();
          summary.forEach(item => {
            Object.keys(item.categories).forEach(cat => {
              // Filter by selected group if drilling down
              if (selectedGroupId) {
                const rule = ruleMap.get(cat);
                
                // Special handling for uncategorized group
                if (selectedGroupId === UNCATEGORIZED_GROUP_ID) {
                  // Include categories without rules or without groupId
                  if (!rule || !rule.groupId || rule.groupId === UNCATEGORIZED_GROUP_ID) {
                    categoriesSet.add(cat);
                  }
                } else {
                  // Regular drilldown logic
                  if (rule && rule.groupId === selectedGroupId) {
                    categoriesSet.add(cat);
                  }
                }
              } else {
                categoriesSet.add(cat);
              }
            });
          });
          const categories = Array.from(categoriesSet).sort();

          // Format month labels
          const labels = summary.map(item => {
            const date = parse(item.month, 'yyyy-MM', new Date());
            return format(date, 'MMM yyyy');
          });

          // Generate colors based on group colors and variants
          const colors = categories.map(category => {
            const rule = ruleMap.get(category);
            if (!rule || !rule.groupId) {
              return 'hsl(0, 0%, 60%)';
            }
            const group = groupMap.get(rule.groupId);
            if (!group) {
              return 'hsl(0, 0%, 60%)';
            }
            return getCategoryColor(group.baseColor, rule.colorVariant || 0);
          });

          // Create datasets (one per category)
          const datasets = categories.map((category, idx) => ({
            label: category,
            data: summary.map(item => item.categories[category] || 0),
            backgroundColor: colors[idx],
            borderColor: colors[idx].replace(/[\d.]+\)$/, '1)'),
            borderWidth: 1,
          }));

          setChartData({
            labels,
            datasets,
          });
        }
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

    if (drilldownView === 'groups') {
      // Drill down into group
      // Special handling for uncategorized/unknown expenses (virtual group)
      if (itemLabel === 'Unknown expenses') {
        drillDownToGroup(UNCATEGORIZED_GROUP_ID);
      } else {
        // Look up group in database
        const categoryGroups = await db.categoryGroups.toArray();
        const group = categoryGroups.find(g => g.name === itemLabel);
        if (group) {
          drillDownToGroup(group.id);
        }
      }
    } else {
      // Category clicked - drill down to category
      drillDownToCategory(itemLabel);
    }
  };

  const handleBackClick = () => {
    goBackOneLevel();
  };

  const options = {
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
            const currency = filters.currencies?.[0] || 'EUR';
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
        onClick: async (_event: unknown, legendItem: { text?: string }, _legend: unknown) => {
          const itemLabel = legendItem.text;
          if (!itemLabel) return;

          if (drilldownView === 'groups') {
            // Drill down into group
            // Special handling for uncategorized/unknown expenses (virtual group)
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
            // Category clicked - drill down to category
            drillDownToCategory(itemLabel);
          }
        },
      },
      tooltip: {
        position: 'cursor' as any,
        mode: 'index' as const,
        intersect: false,
        itemSort: (a: TooltipItem<'bar'>, b: TooltipItem<'bar'>) => {
          // Sort by amount in descending order
          return (b.parsed.y || 0) - (a.parsed.y || 0);
        },
        callbacks: {
          label: (context: TooltipItem<'bar'>) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y || 0;
            const currency = filters.currencies?.[0] || 'EUR';
            return `${label}: ${formatCurrency(value, currency)}`;
          },
          footer: (tooltipItems: TooltipItem<'bar'>[]) => {
            const total = tooltipItems.reduce((sum, item) => sum + (item.parsed.y || 0), 0);
            const currency = filters.currencies?.[0] || 'EUR';
            return `Total: ${formatCurrency(total, currency)}`;
          },
        },
      },
    },
  };

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
