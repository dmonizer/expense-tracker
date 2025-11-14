import { memo } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import type { TooltipItem } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import type { Transaction, TransactionFilters } from '../../../types';
import { getCategorySummary, getGroupSummary } from '../../../services/analytics';
import { formatCurrency } from '../../../utils';
import { getCategoryColor } from '../../../utils/colorUtils';
import { db } from '../../../services/db';
import { useEffect, useState, useRef } from 'react';
import GroupContextMenu from '../../Categories/GroupContextMenu';
import { UNCATEGORIZED_GROUP_ID } from '../../../types';
import { DEFAULT_GROUP_COLORS } from '../../../utils/colorUtils';

ChartJS.register(ArcElement, Tooltip, Legend);

interface CategoryPieChartProps {
  transactions: Transaction[];
  filters: TransactionFilters;
  onCategoryClick?: (categoryName: string) => void;
}

function CategoryPieChart({ transactions, filters, onCategoryClick }: CategoryPieChartProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'group' | 'category'>('group');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; categoryName: string } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartData, setChartData] = useState<{
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor: string[];
      borderColor: string[];
      borderWidth: number;
    }[];
    percentages: number[];
    itemIds: string[]; // Store groupId or category name for click handling
  } | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        if (viewMode === 'group' && !selectedGroupId) {
          // Load group summary
          const groupSummary = await getGroupSummary(filters);
          
          if (groupSummary.length === 0) {
            setChartData(null);
            setIsLoading(false);
            return;
          }

          // Prepare data for group pie chart
          const labels = groupSummary.map(item => item.groupName);
          const amounts = groupSummary.map(item => item.amount);
          const percentages = groupSummary.map(item => item.percentage);
          const colors = groupSummary.map(item => item.baseColor);
          const itemIds = groupSummary.map(item => item.groupId);

          setChartData({
            labels,
            datasets: [
              {
                label: 'Amount',
                data: amounts,
                backgroundColor: colors,
                borderColor: colors.map(color => color.replace(/[\d.]+\)$/, '1)')), // Full opacity for border
                borderWidth: 1,
              },
            ],
            percentages,
            itemIds,
          });
        } else {
          // Load category summary (either all categories or filtered by group)
          let categorySummary = await getCategorySummary(filters);
          
          if (selectedGroupId) {
            if (selectedGroupId === UNCATEGORIZED_GROUP_ID) {
              // Special handling for uncategorized group - show only "Uncategorized"
              categorySummary = categorySummary.filter(item => 
                item.category === 'Uncategorized'
              );
            } else {
              // Filter categories by selected group
              const categoryRules = await db.categoryRules.toArray();
              const groupCategories = categoryRules
                .filter(rule => rule.groupId === selectedGroupId)
                .map(rule => rule.name);
              
              categorySummary = categorySummary.filter(item => 
                groupCategories.includes(item.category)
              );
            }
          }
          
          if (categorySummary.length === 0) {
            setChartData(null);
            setIsLoading(false);
            return;
          }

          // Get category colors based on their groups and variants
          const categoryRules = await db.categoryRules.toArray();
          const categoryGroups = await db.categoryGroups.toArray();
          const ruleMap = new Map(categoryRules.map(rule => [rule.name, rule]));
          const groupMap = new Map(categoryGroups.map(group => [group.id, group]));

          const colors = categorySummary.map(item => {
            const rule = ruleMap.get(item.category);
            if (!rule || !rule.groupId) {
              return DEFAULT_GROUP_COLORS.uncategorized; // Gray for uncategorized
            }
            const group = groupMap.get(rule.groupId);
            if (!group) {
              return DEFAULT_GROUP_COLORS.uncategorized;
            }
            // Use color utility to get the correct variant
            return getCategoryColor(group.baseColor, rule.colorVariant || 0);
          });

          // Prepare data for category pie chart
          const labels = categorySummary.map(item => item.category);
          const amounts = categorySummary.map(item => item.amount);
          const percentages = categorySummary.map(item => item.percentage);
          const itemIds = categorySummary.map(item => item.category);

          setChartData({
            labels,
            datasets: [
              {
                label: 'Amount',
                data: amounts,
                backgroundColor: colors,
                borderColor: colors.map(color => color.replace(/[\d.]+\)$/, '1)')),
                borderWidth: 1,
              },
            ],
            percentages,
            itemIds,
          });
        }
      } catch (error) {
        console.error('Error loading chart data:', error);
        setChartData(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [transactions, filters, viewMode, selectedGroupId]);

  const handleChartClick = (_event: unknown, elements: unknown[]) => {
    if (!elements || !Array.isArray(elements) || elements.length === 0) {
      return;
    }

    const element = elements[0] as { index: number };
    const itemId = chartData?.itemIds[element.index];

    if (!itemId) return;

    if (viewMode === 'group' && !selectedGroupId) {
      // Drill down into group
      setSelectedGroupId(itemId);
      setViewMode('category');
    } else if (onCategoryClick) {
      // Category clicked - call the callback
      onCategoryClick(itemId);
    }
  };

  const handleBackClick = () => {
    setSelectedGroupId(null);
    setViewMode('group');
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    // Only allow context menu in category view (not group view)
    if (viewMode === 'group' && !selectedGroupId) {
      return;
    }

    event.preventDefault();
    
    // Get the chart canvas element
    const canvas = chartRef.current?.querySelector('canvas');
    if (!canvas || !chartData) return;

    // Calculate position relative to canvas
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Get ChartJS instance to find clicked element
    const chart = ChartJS.getChart(canvas);
    if (!chart) return;

    const elements = chart.getElementsAtEventForMode(
      { x, y, native: event.nativeEvent } as any,
      'nearest',
      { intersect: true },
      false
    );

    if (elements && elements.length > 0) {
      const element = elements[0];
      const categoryName = chartData.labels[element.index];
      
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        categoryName,
      });
    }
  };

  const handleGroupSelect = async (groupId: string, categoryName: string) => {
    try {
      // Find the category rule
      const rule = await db.categoryRules.where('name').equals(categoryName).first();
      if (!rule) {
        console.error('Category rule not found:', categoryName);
        return;
      }

      // Get next available color variant for the new group
      const categoriesInGroup = await db.categoryRules
        .filter(r => r.groupId === groupId && r.id !== rule.id)
        .toArray();
      
      const usedVariants = categoriesInGroup.map(r => r.colorVariant || 0);
      const nextVariant = usedVariants.length > 0 ? Math.max(...usedVariants) + 1 : 0;

      // Update the rule
      await db.categoryRules.update(rule.id, {
        groupId,
        colorVariant: nextVariant,
        updatedAt: new Date(),
      });

      // Trigger reload by updating a state (the chart will reload via useEffect)
      setContextMenu(null);
      // Force chart reload by toggling state
      const currentGroupId = selectedGroupId;
      setSelectedGroupId(null);
      setTimeout(() => setSelectedGroupId(currentGroupId), 0);
    } catch (error) {
      console.error('Failed to update category group:', error);
    }
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: handleChartClick,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          padding: 15,
          font: {
            size: 12,
          },
          generateLabels: (chart: ChartJS) => {
            const data = chart.data;
            if (data.labels && data.labels.length && data.datasets.length) {
              return (data.labels as string[]).map((label: string, i: number) => {
                const percentage = chartData?.percentages[i] || 0;
                const bgColors = data.datasets[0].backgroundColor as string[];
                return {
                  text: `${label} (${percentage.toFixed(1)}%)`,
                  fillStyle: bgColors[i],
                  hidden: false,
                  index: i,
                };
              });
            }
            return [];
          },
        },
        onClick: (_event: unknown, legendItem: { index?: number }) => {
          if (legendItem.index === undefined) return;
          const itemId = chartData?.itemIds[legendItem.index];
          if (!itemId) return;

          if (viewMode === 'group' && !selectedGroupId) {
            // Drill down into group
            setSelectedGroupId(itemId);
            setViewMode('category');
          } else if (onCategoryClick) {
            // Category clicked - call the callback
            onCategoryClick(itemId);
          }
        },
      },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<'pie'>) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            const percentage = chartData?.percentages[context.dataIndex] || 0;
            const currency = filters.currencies?.[0] || 'EUR';
            return `${label}: ${formatCurrency(value, currency)} (${percentage.toFixed(1)}%)`;
          },
        },
      },
    },
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-48 w-48 bg-gray-200 rounded-full mb-4"></div>
          <div className="h-4 w-32 bg-gray-200 rounded"></div>
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
              d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
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
      {selectedGroupId && (
        <div className="mb-2 flex items-center gap-2">
          <button
            onClick={handleBackClick}
            className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to groups
          </button>
          <span className="text-sm text-gray-600">
            {viewMode === 'category' ? 'Category view' : 'Group view'}
          </span>
        </div>
      )}
      <div ref={chartRef} className="flex-1" onContextMenu={handleContextMenu}>
        <Pie data={chartData} options={options} />
      </div>
      {contextMenu && (
        <GroupContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          categoryName={contextMenu.categoryName}
          onGroupSelect={handleGroupSelect}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

export default memo(CategoryPieChart);
