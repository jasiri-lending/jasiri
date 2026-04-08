const Spinner = ({ text = 'Processing securely...' }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6">
      <div className="relative group">
        {/* Glow effect */}
        <div className="absolute -inset-4 bg-gradient-to-r from-[#586ab1]/20 to-[#10B981]/20 rounded-full blur-xl opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
        
        <div className="relative w-24 h-24">
          {/* Outer static ring */}
          <div className="absolute inset-0 rounded-full border-2 border-slate-100 shadow-inner"></div>
          
          {/* Primary spinning ring */}
          <div className="absolute inset-0 rounded-full border-[3px] border-[#586ab1] border-t-transparent border-l-transparent animate-spin"></div>
          
          {/* Secondary counter-spinning ring */}
          <div className="absolute inset-2 rounded-full border-2 border-[#10B981] border-b-transparent border-r-transparent animate-[spin_1.2s_linear_infinite_reverse]"></div>
          
          {/* Center text/brand container */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white rounded-full w-12 h-12 flex items-center justify-center shadow-sm border border-slate-50">
              <span className="text-[10px] font-black tracking-widest text-[#586ab1] animate-pulse">
                JASIRI
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center space-y-2">
        <h3 className="text-sm  text-slate-600 ">
          {text}
        </h3>
        <p className="text-xs text-slate-600  flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
          Secure Financial Infrastructure
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
        </p>
      </div>
    </div>
  );
};

export default Spinner;
