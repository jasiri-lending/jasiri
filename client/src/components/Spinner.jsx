
const Spinner = ({ text = 'Processing securely…' }) => {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      {/* Spinner Container */}
      <div className="relative w-16 h-16">
        {/* Outer Ring */}
        <div className="absolute inset-0 rounded-full border-4 border-[#586ab1]/20"></div>

        {/* Spinning Ring */}
        <div className="absolute inset-0 rounded-full border-4 border-[#586ab1] border-t-transparent animate-spin"></div>

        {/* Center Logo Text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold tracking-wide text-[#586ab1]">
            JASIRI
          </span>
        </div>
      </div>

      {/* Loading Text */}
      <p className="mt-4 text-sm font-medium text-gray-600">
        {text}
      </p>

      {/* Subtle Trust Message */}
      <p className="mt-1 text-xs text-gray-400">
        Secure loan processing
      </p>
    </div>
  );
};

export default Spinner;
