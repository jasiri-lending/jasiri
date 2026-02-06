import DashboardCard from './DashboardCard';

const PipelineStage = ({ label, count,  colorClass, width }) => {
    return (
        <div className="flex flex-col items-center w-full mb-1">
            <div
                className={`relative flex items-center justify-between px-4 py-2.5 text-white shadow-sm transition-all hover:scale-[1.02] ${colorClass}`}
                style={{
                    width: width,
                    clipPath: 'polygon(0% 0%, 100% 0%, 97% 100%, 3% 100%)', // Trapezoid effect
                    borderRadius: '4px'
                }}
            >
                <span className="font-medium text-sm whitespace-nowrap">{label}</span>
                <div className="flex items-center gap-2">
                    <span className="font-bold">{count}</span>
                    {/* {time && <span className="text-[10px] bg-white/20 px-1.5 rounded opacity-90 whitespace-nowrap">{time}</span>} */}
                </div>
            </div>
        </div>
    );
};

const PipelineWidget = ({ data }) => {
    return (
        <DashboardCard title="Application Pipeline" subtitle="Conversion Funnel">
            <div className="mt-4 flex flex-col items-center space-y-1">
                <PipelineStage
                    label="New Applications"
                    count={data.new}
                    time="1.2 hrs"
                    colorClass="bg-blue-600"
                    width="100%"
                />
                <PipelineStage
                    label="Under Review"
                    count={data.review}
                    time="+ 6.5 hrs"
                    colorClass="bg-indigo-500"
                    width="90%"
                />
                <PipelineStage
                    label="Awaiting Documents"
                    count={data.docs}
                    time="+ 2.1 days"
                    colorClass="bg-emerald-500"
                    width="80%"
                />
                <PipelineStage
                    label="Approved"
                    count={data.approved}
                    time="• 4 hrs"
                    colorClass="bg-amber-500"
                    width="70%"
                />
                <div className="flex w-[60%] mt-1">
                    <div className="bg-red-500 text-white w-full py-2 px-4 rounded-b-lg flex justify-between items-center shadow-sm">
                        <span className="text-sm font-medium">Rejected</span>
                        <span className="font-bold">{data.rejected}</span>
                    </div>
                </div>
            </div>
        </DashboardCard>
    );
};

export default PipelineWidget;
