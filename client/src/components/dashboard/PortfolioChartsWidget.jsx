import React from 'react';
import DashboardCard from './DashboardCard';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

const PortfolioChartsWidget = ({ statusData, typeData }) => {
    const statusChartData = {
        labels: statusData.labels,
        datasets: [
            {
                data: statusData.data,
                backgroundColor: [
                    '#10B981', // Active - Emerald
                    '#F59E0B', // Arrears - Amber
                    '#EF4444', // Defaulted - Red
                    '#3B82F6', // Disbursed/Other - Blue
                    '#94A3B8', // Closed/Other - Slate
                ],
                borderWidth: 0,
                hoverOffset: 4,
            },
        ],
    };

    const typeChartData = {
        labels: typeData.labels,
        datasets: [
            {
                data: typeData.data,
                backgroundColor: [
                    '#6366F1', // Indigo
                    '#EC4899', // Pink
                    '#8B5CF6', // Violet
                    '#06B6D4', // Cyan
                ],
                borderWidth: 0,
                hoverOffset: 4,
            },
        ],
    };

    const options = {
        cutout: '75%', // Thinner ring
        plugins: {
            legend: {
                position: 'bottom', // Legend at bottom like many dashboards
                labels: {
                    usePointStyle: true,
                    boxWidth: 8,
                    font: { size: 10 },
                    padding: 15
                }
            }
        },
        maintainAspectRatio: false,
        layout: { padding: 10 }
    };

    return (
        <DashboardCard title="Portfolio Breakdown" className="min-h-[380px]">
            <div className="flex flex-col h-full gap-6">
                <div className="flex-1 flex flex-col items-center justify-center relative min-h-[160px]">
                    <h4 className="absolute text-center text-xs font-bold text-gray-400 pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-[-15px]">STATUS</h4>
                    <div className="w-full h-full">
                        <Doughnut data={statusChartData} options={options} />
                    </div>
                </div>
                <div className="w-full h-px bg-gray-100"></div>
                <div className="flex-1 flex flex-col items-center justify-center relative min-h-[160px]">
                    <h4 className="absolute text-center text-xs font-bold text-gray-400 pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-[-15px]">TYPE</h4>
                    <div className="w-full h-full">
                        <Doughnut data={typeChartData} options={options} />
                    </div>
                </div>
            </div>
        </DashboardCard>
    );
};

export default PortfolioChartsWidget;
