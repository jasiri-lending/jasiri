import { Handle, Position } from '@xyflow/react';
import { Plus, CheckCircle, Search, GitBranch, Zap, Play } from 'lucide-react';

export const StartNode = ({ data, selected }) => {
    return (
        <div className={`bg-white border-2 ${selected ? 'border-green-600 shadow-lg' : 'border-green-500'} rounded-lg p-3 shadow-md w-44 text-center transition-all relative group`}>
            <div className="flex items-center justify-center mb-1.5">
                <div className="bg-green-100 p-1 rounded-md">
                    <Play className="w-3.5 h-3.5 text-green-600 fill-current" />
                </div>
            </div>
            <div className="font-bold text-green-700 text-[9px] uppercase tracking-widest">Start</div>
            <div className="text-[11px] text-gray-800 mt-0.5 font-bold truncate">{data.label}</div>
            <div className="text-[9px] text-gray-400 mt-1.5 flex items-center justify-center">
                <span className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{data.roleName || 'Any Role'}</span>
            </div>
            <Handle 
                type="source" 
                position={Position.Bottom} 
                className="!w-4 !h-4 !bg-transparent !border-none flex items-center justify-center group/handle z-10"
            >
                <div className="w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm transition-all group-hover/handle:scale-110">
                    <Plus strokeWidth={3} className="w-2 h-2 text-white opacity-0 group-hover/handle:opacity-100" />
                </div>
            </Handle>
        </div>
    );
};

export const ApprovalNode = ({ data, selected }) => {
    return (
        <div className={`bg-white border-2 ${selected ? 'border-blue-600 shadow-lg' : 'border-blue-400'} rounded-lg p-3 shadow-sm w-44 text-center transition-all relative`}>
            <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-transparent !border-none flex items-center justify-center z-10" />
            <div className="flex items-center justify-center mb-1.5">
                <div className="bg-blue-100 p-1 rounded-md">
                    <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                </div>
            </div>
            <div className="font-bold text-blue-800 text-[9px] uppercase tracking-widest">Approval</div>
            <div className="text-[11px] text-gray-800 mt-0.5 font-bold truncate">{data.label}</div>
            <div className="text-[9px] text-gray-400 mt-1.5 flex items-center justify-center">
                <span className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{data.roleName || 'Unassigned'}</span>
            </div>
            <Handle type="source" position={Position.Bottom} className="!w-4 !h-4 !bg-transparent !border-none flex items-center justify-center z-10" />
        </div>
    );
};

export const ReviewNode = ({ data, selected }) => {
    return (
        <div className={`bg-white border-2 ${selected ? 'border-amber-600 shadow-lg' : 'border-amber-400'} rounded-lg p-3 shadow-sm w-44 text-center transition-all relative`}>
            <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-transparent !border-none flex items-center justify-center z-10" />
            <div className="flex items-center justify-center mb-1.5">
                <div className="bg-amber-100 p-1 rounded-md">
                    <Search className="w-3.5 h-3.5 text-amber-600" />
                </div>
            </div>
            <div className="font-bold text-amber-800 text-[9px] uppercase tracking-widest">Review</div>
            <div className="text-[11px] text-gray-800 mt-0.5 font-bold truncate">{data.label}</div>
            <div className="text-[9px] text-gray-400 mt-1.5 flex items-center justify-center">
                <span className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{data.roleName || 'Unassigned'}</span>
            </div>
            <Handle type="source" position={Position.Bottom} className="!w-4 !h-4 !bg-transparent !border-none flex items-center justify-center z-10" />
        </div>
    );
};

export const DecisionNode = ({ data, selected }) => {
    return (
        <div className={`bg-white border-2 ${selected ? 'border-purple-600 shadow-lg' : 'border-purple-400'} rounded-lg p-3 shadow-sm w-44 text-center transition-all relative`}>
            <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-transparent !border-none flex items-center justify-center z-10" />
            <div className="flex items-center justify-center mb-1.5">
                <div className="bg-purple-100 p-1 rounded-md">
                    <GitBranch className="w-3.5 h-3.5 text-purple-600" />
                </div>
            </div>
            <div className="font-bold text-purple-800 text-[9px] uppercase tracking-widest">Decision</div>
            <div className="text-[11px] text-gray-800 mt-0.5 font-bold truncate">{data.label}</div>
            <div className="text-[9px] text-gray-400 mt-1.5 italic">Automated</div>
            <Handle type="source" position={Position.Bottom} className="!w-4 !h-4 !bg-transparent !border-none flex items-center justify-center z-10" />
        </div>
    );
};

export const AutoProcessNode = ({ data, selected }) => {
    return (
        <div className={`bg-white border-2 ${selected ? 'border-indigo-600 shadow-lg' : 'border-indigo-400'} rounded-lg p-3 shadow-sm w-44 text-center transition-all relative`}>
            <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-transparent !border-none flex items-center justify-center z-10" />
            <div className="flex items-center justify-center mb-1.5">
                <div className="bg-indigo-100 p-1 rounded-md">
                    <Zap className="w-3.5 h-3.5 text-indigo-600" />
                </div>
            </div>
            <div className="font-bold text-indigo-800 text-[9px] uppercase tracking-widest">Auto Action</div>
            <div className="text-[11px] text-gray-800 mt-0.5 font-bold truncate">{data.label}</div>
            <div className="text-[9px] text-gray-400 mt-1.5 italic">{data.on_entry_actions?.length || 0} Tasks</div>
            <Handle type="source" position={Position.Bottom} className="!w-4 !h-4 !bg-transparent !border-none flex items-center justify-center z-10" />
        </div>
    );
};

export const EndNode = ({ data, selected }) => {
    return (
        <div className={`bg-white border-2 ${selected ? 'border-red-600 shadow-lg' : 'border-red-500'} rounded-lg p-2.5 shadow-md w-36 text-center relative`}>
            <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-transparent !border-none flex items-center justify-center z-10" />
            <div className="font-bold text-red-700 text-[9px] uppercase tracking-widest mb-0.5">End</div>
            <div className="text-[11px] text-gray-600 font-bold truncate">{data.label}</div>
        </div>
    );
};

