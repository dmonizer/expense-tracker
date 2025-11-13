import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import type { TooltipItem } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import type { Transaction, TransactionFilters } from '../../../types';
import { getCategorySummary } from '../../../services/analytics';
import { formatCurrency } from '../../../utils';
import { useEffect, useState } from 'react';

ChartJS.register(ArcElement, Tooltip, Legend);

interface CategoryPieChartProps {
  transactions: Transaction[];
  filters: TransactionFilters;
  onCategoryClick?: (categoryName: string) => void;
}

function CategoryPieChart({ transactions, filters, onCategoryClick }: CategoryPieChartProps) {
  const [isLoading, setIsLoading] = useState(true);
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
  } | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const summary = await getCategorySummary(filters);
        
        if (summary.length === 0) {
          setChartData(null);
          setIsLoading(false);
          return;
        }

        // Prepare data for pie chart
        const labels = summary.map(item => item.category);
        const amounts = summary.map(item => item.amount);
        const percentages = summary.map(item => item.percentage);

        // Generate distinct colors for each category
        const colors = generateColors(summary.length);

        setChartData({
          labels,
          datasets: [
            {
              label: 'Amount',
              data: amounts,
              backgroundColor: colors,
              borderColor: colors.map(color => color.replace('0.8', '1')),
              borderWidth: 1,
            },
          ],
          percentages,
        });
      } catch (error) {
        console.error('Error loading category summary:', error);
        setChartData(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [transactions, filters]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (_event: unknown, elements: unknown[]) => {
      if (onCategoryClick && elements && Array.isArray(elements) && elements.length > 0) {
        const element = elements[0] as { index: number };
        const categoryName = chartData?.labels[element.index];
        if (categoryName) {
          onCategoryClick(categoryName);
        }
      }
    },
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
        onClick: (_event: unknown, legendItem: { text?: string }) => {
          const categoryName = legendItem.text?.split(' (')[0]; // Extract category name before percentage
          if (onCategoryClick && categoryName) {
            onCategoryClick(categoryName);
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
    <div className="w-full h-full">
      <Pie data={chartData} options={options} />
    </div>
  );
}

/**
 * Generates distinct colors for pie chart segments
 */
function generateColors(count: number): string[] {
  const hueStep = 360 / count;
  const colors: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const hue = (i * hueStep) % 360;
    colors.push(`hsla(${hue}, 70%, 60%, 0.8)`);
  }
  
  return colors;
}

export default CategoryPieChart;
