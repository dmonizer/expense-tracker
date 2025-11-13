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
import type { Transaction, TransactionFilters } from '../../../types/index';
import { getMonthlySummary } from '../../../services/analytics';
import { formatCurrency } from '../../../utils/formatters';
import { format, parse } from 'date-fns';
import { useEffect, useState } from 'react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface MonthlyBarChartProps {
  transactions: Transaction[];
  filters: TransactionFilters;
  onCategoryClick?: (categoryName: string) => void;
}

function MonthlyBarChart({ transactions, filters, onCategoryClick }: MonthlyBarChartProps) {
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
        const summary = await getMonthlySummary(filters);
        
        if (summary.length === 0) {
          setChartData(null);
          setIsLoading(false);
          return;
        }

        // Extract all unique categories
        const categoriesSet = new Set<string>();
        summary.forEach(item => {
          Object.keys(item.categories).forEach(cat => categoriesSet.add(cat));
        });
        const categories = Array.from(categoriesSet).sort();

        // Format month labels (MMM YYYY)
        const labels = summary.map(item => {
          const date = parse(item.month, 'yyyy-MM', new Date());
          return format(date, 'MMM yyyy');
        });

        // Generate colors for categories
        const colors = generateColors(categories.length);

        // Create datasets (one per category)
        const datasets = categories.map((category, idx) => ({
          label: category,
          data: summary.map(item => item.categories[category] || 0),
          backgroundColor: colors[idx],
          borderColor: colors[idx].replace('0.7', '1'),
          borderWidth: 1,
        }));

        setChartData({
          labels,
          datasets,
        });
      } catch (error) {
        console.error('Error loading monthly summary:', error);
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
        const element = elements[0] as { datasetIndex: number };
        const categoryName = chartData?.datasets[element.datasetIndex]?.label;
        if (categoryName) {
          onCategoryClick(categoryName);
        }
      }
    },
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
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
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
    <div className="w-full h-full">
      <Bar data={chartData} options={options} />
    </div>
  );
}

/**
 * Generates distinct colors for bar chart categories
 */
function generateColors(count: number): string[] {
  const hueStep = 360 / count;
  const colors: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const hue = (i * hueStep) % 360;
    colors.push(`hsla(${hue}, 65%, 55%, 0.7)`);
  }
  
  return colors;
}

export default MonthlyBarChart;
