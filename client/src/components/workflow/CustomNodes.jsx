import { Handle, Position } from '@xyflow/react';
import { Plus } from 'lucide-react';

export const StartNode = ({ data, selected }) => {
    return (
        <div className={`bg-white border-2 ${selected ? 'border-green-600 shadow-lg' : 'border-green-500'} rounded-lg p-3 shadow-md w-48 text-center transition-all relative`}>
            <div className="font-bold text-green-700 text-sm">START</div>
            <div className="text-xs text-gray-700 mt-1 font-medium">{data.label}</div>
            <div className="text-[10px] text-gray-400 mt-1">{data.roleName || 'Any Role'}</div>
            <Handle 
                type="source" 
                position={Position.Bottom} 
                className="!w-8 !h-8 !bg-transparent !border-none flex items-center justify-center group z-10"
            >
                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm transition-all group-hover:scale-150 group-hover:bg-green-600">
                    <Plus strokeWidth={3} className="w-2.5 h-2.5 text-white opacity-0 group-hover:opacity-100" />
                </div>
            </Handle>
        </div>
    );
};

export const ApprovalNode = ({ data, selected }) => {
    return (
        <div className={`bg-white border-2 ${selected ? 'border-blue-600 shadow-lg' : 'border-blue-400'} rounded-lg p-3 shadow-sm w-48 text-center transition-all relative`}>
            <Handle 
                type="target" 
                position={Position.Top} 
                className="!w-8 !h-8 !bg-transparent !border-none flex items-center justify-center group z-10"
            >
                <div className="w-4 h-4 bg-blue-400 rounded-full flex items-center justify-center border-2 border-white shadow-sm transition-all group-hover:scale-150 group-hover:bg-blue-600">
                     <Plus strokeWidth={3} className="w-2.5 h-2.5 text-white opacity-0 group-hover:opacity-100" />
                </div>
            </Handle>
            <div className="font-bold text-blue-800 text-sm">APPROVAL</div>
            <div className="text-xs text-gray-700 mt-1 font-medium">{data.label}</div>
            <div className="text-[10px] text-gray-400 mt-1">{data.roleName || 'No Role Assigned'}</div>
            <Handle 
                type="source" 
                position={Position.Bottom} 
                className="!w-8 !h-8 !bg-transparent !border-none flex items-center justify-center group z-10"
            >
                <div className="w-4 h-4 bg-blue-400 rounded-full flex items-center justify-center border-2 border-white shadow-sm transition-all group-hover:scale-150 group-hover:bg-blue-600">
                     <Plus strokeWidth={3} className="w-2.5 h-2.5 text-white opacity-0 group-hover:opacity-100" />
                </div>
            </Handle>
        </div>
    );
};

export const EndNode = ({ data }) => {
    return (
        <div className="bg-white border-2 border-red-500 rounded-lg p-3 shadow-md w-40 text-center relative">
            <Handle 
                type="target" 
                position={Position.Top} 
                className="!w-8 !h-8 !bg-transparent !border-none flex items-center justify-center group z-10"
            >
                <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm transition-all group-hover:scale-150 group-hover:bg-red-600">
                     <Plus strokeWidth={3} className="w-2.5 h-2.5 text-white opacity-0 group-hover:opacity-100" />
                </div>
            </Handle>
            <div className="font-bold text-red-700 text-sm">END</div>
            <div className="text-xs text-gray-500">{data.label}</div>
        </div>
    );
};
