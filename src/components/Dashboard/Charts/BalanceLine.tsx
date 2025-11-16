import {memo, useEffect, useState} from 'react';
import type {TooltipItem} from 'chart.js';
import {
    CategoryScale,
    Chart as ChartJS,
    Filler,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Title,
    Tooltip,
} from 'chart.js';
import {Line} from 'react-chartjs-2';
import type {Transaction, TransactionFilters} from '../../../types';
import {getBalanceOverTime} from '../../../services/analytics';
import {formatCurrency, formatDate} from '../../../utils';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

interface BalanceLineProps {
    transactions: Transaction[];
    filters: TransactionFilters;
}

function BalanceLine({transactions, filters}: Readonly<BalanceLineProps>) {
    const [isLoading, setIsLoading] = useState(true);

    const [chartData, setChartData] = useState<{
        labels: string[];
        datasets: {
            label: string;
            data: number[];
            borderColor: string;
            backgroundColor: string;
            borderWidth: number;
            fill: boolean;
            tension: number;
            pointRadius: number;
            pointHoverRadius: number;
            pointBackgroundColor: string;
            pointBorderColor: string;
            pointBorderWidth: number;
        }[];
    } | null>(null);

    useEffect(() => {
        async function loadData() {
            setIsLoading(true);
            try {
                const balancePoints = await getBalanceOverTime(filters);

                if (balancePoints.length === 0) {
                    setChartData(null);
                    setIsLoading(false);
                    return;
                }

                // Prepare data for line chart
                const labels = balancePoints.map(point => formatDate(point.date, 'dd MMM'));
                const data = balancePoints.map(point => point.balance);

                // Determine if we should use gradient fill
                const hasNegative = data.some(val => val < 0);
                const hasPositive = data.some(val => val > 0);

                setChartData({
                    labels,
                    datasets: [
                        {
                            label: 'Balance',
                            data,
                            borderColor: 'rgb(59, 130, 246)',
                            backgroundColor: hasNegative && hasPositive
                                ? 'rgba(59, 130, 246, 0.1)'
                                : hasNegative
                                    ? 'rgba(239, 68, 68, 0.1)'
                                    : 'rgba(34, 197, 94, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.3,
                            pointRadius: 2,
                            pointHoverRadius: 5,
                            pointBackgroundColor: 'rgb(59, 130, 246)',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                        },
                    ],
                });
            } catch (error) {
                console.error('Error loading balance data:', error);
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
        scales: {
            x: {
                grid: {
                    display: false,
                },
                ticks: {
                    maxRotation: 45,
                    minRotation: 0,
                    font: {
                        size: 10,
                    },
                },
            },
            y: {
                beginAtZero: false,
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)',
                },
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
                display: false,
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
                callbacks: {
                    label: (context: TooltipItem<'line'>) => {
                        const value = context.parsed.y || 0;
                        const currency = filters.currencies?.[0] || 'EUR';
                        return `Balance: ${formatCurrency(value, currency)}`;
                    },
                },
            },
        },
        interaction: {
            mode: 'nearest' as const,
            axis: 'x' as const,
            intersect: false,
        },
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="animate-pulse w-full px-4">
                    <div className="h-4 w-24 bg-gray-200 rounded mb-4"></div>
                    <div className="space-y-2">
                        <div className="h-20 bg-gray-200 rounded"></div>
                        <div className="h-32 bg-gray-200 rounded"></div>
                        <div className="h-24 bg-gray-200 rounded"></div>
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
                            d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
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
            <Line data={chartData} options={options}/>
        </div>
    );
}

export default memo(BalanceLine);
