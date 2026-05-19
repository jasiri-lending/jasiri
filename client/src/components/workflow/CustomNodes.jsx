import { Handle, Position } from '@xyflow/react';
import { Plus, CheckCircle, Search, GitBranch, Zap, Play } from 'lucide-react';

export const StartNode = ({ data, selected }) => {
    return (
        <div className={`bg-white border-2 ${selected ? 'border-green-600 shadow-lg' : 'border-green-500'} rounded-lg p-3 shadow-md w-36 text-center transition-all relative group`}>
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
                id="bottom-source"
                className="!w-3 !h-3 !bg-green-500 !border-2 !border-white transition-opacity duration-200 opacity-0 group-hover:opacity-100 z-10"
            />
        </div>
    );
};

export const TaskNode = ({ data, selected }) => {
    return (
        <div className={`bg-white border-2 ${selected ? 'border-blue-600 shadow-lg' : 'border-blue-400'} rounded-lg p-3 shadow-sm w-44 text-center transition-all relative group`}>
            {/* Top Target (Forward) */}
            <Handle type="target" position={Position.Top} id="top-target" className="!w-3 !h-3 !bg-blue-400 !border-2 !border-white transition-opacity duration-200 opacity-0 group-hover:opacity-100 z-10" />
            
            {/* Bottom Source (Forward) */}
            <Handle type="source" position={Position.Bottom} id="bottom-source" className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white transition-opacity duration-200 opacity-0 group-hover:opacity-100 z-10" />
            
            {/* Left Source & Target (Send Back) */}
            <Handle type="source" position={Position.Left} id="left-source" style={{ top: '30%' }} className="!w-2.5 !h-2.5 !bg-amber-400 !border-2 !border-white transition-opacity duration-200 opacity-0 group-hover:opacity-100 z-10" />
            <Handle type="target" position={Position.Left} id="left-target" style={{ top: '70%' }} className="!w-2.5 !h-2.5 !bg-amber-400 !border-2 !border-white transition-opacity duration-200 opacity-0 group-hover:opacity-100 z-10" />
            
            {/* Right Source & Target (Send Back) */}
            <Handle type="source" position={Position.Right} id="right-source" style={{ top: '30%' }} className="!w-2.5 !h-2.5 !bg-amber-400 !border-2 !border-white transition-opacity duration-200 opacity-0 group-hover:opacity-100 z-10" />
            <Handle type="target" position={Position.Right} id="right-target" style={{ top: '70%' }} className="!w-2.5 !h-2.5 !bg-amber-400 !border-2 !border-white transition-opacity duration-200 opacity-0 group-hover:opacity-100 z-10" />
            
            <div className="flex items-center justify-center mb-1.5">
                <div className="bg-blue-100 p-1 rounded-md">
                    <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                </div>
            </div>
            <div className="font-bold text-blue-800 text-[9px] uppercase tracking-widest">User Task</div>
            <div className="text-[11px] text-gray-800 mt-0.5 font-bold truncate">{data.label}</div>
            <div className="text-[9px] mt-1.5 flex items-center justify-center">
                <span className={`px-1.5 py-0.5 rounded border ${data.roleName ? 'bg-indigo-50 text-indigo-700 border-indigo-100 font-bold' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                    {data.roleName || 'Unassigned'}
                </span>
            </div>
        </div>
    );
};



export const EndNode = ({ data, selected }) => {
    return (
        <div className={`bg-white border-2 ${selected ? 'border-red-600 shadow-lg' : 'border-red-500'} rounded-lg p-2.5 shadow-md w-28 text-center transition-all relative group`}>
            <Handle 
                type="target" 
                position={Position.Top} 
                id="top-target"
                className="!w-3 !h-3 !bg-red-400 !border-2 !border-white transition-opacity duration-200 opacity-0 group-hover:opacity-100 z-10"
            />
            <div className="font-bold text-red-700 text-[9px] uppercase tracking-widest mb-0.5">End</div>
            <div className="text-[11px] text-gray-600 font-bold truncate">{data.label}</div>
        </div>
    );
};

