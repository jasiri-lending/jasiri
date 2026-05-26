const Spinner = ({ text = 'Processing securely...' }) => {
  const petals = [
    { angle: 0,   color: '#2E5E99', opacity: 1.00 },
    { angle: 30,  color: '#2E5E99', opacity: 0.90 },
    { angle: 60,  color: '#2E5E99', opacity: 0.75 },
    { angle: 90,  color: '#10B981', opacity: 0.60 },
    { angle: 120, color: '#10B981', opacity: 0.45 },
    { angle: 150, color: '#10B981', opacity: 0.32 },
    { angle: 180, color: '#7BA4D0', opacity: 0.22 },
    { angle: 210, color: '#7BA4D0', opacity: 0.16 },
    { angle: 240, color: '#7BA4D0', opacity: 0.12 },
    { angle: 270, color: '#7BA4D0', opacity: 0.22 },
    { angle: 300, color: '#2E5E99', opacity: 0.40 },
    { angle: 330, color: '#2E5E99', opacity: 0.65 },
  ];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 gap-8">
      <div className="relative w-[110px] h-[110px]">

        {/* Rotating petal ring */}
        <div style={{ animation: 'jasiri-spin 1.2s linear infinite' }} className="absolute inset-0">
          <svg width="110" height="110" viewBox="0 0 110 110" fill="none">
            <g transform="translate(55,55)">
              {petals.map(({ angle, color, opacity }) => (
                <rect
                  key={angle}
                  x="-5.5" y="-46"
                  width="11" height="22"
                  rx="5.5"
                  fill={color}
                  opacity={opacity}
                  transform={`rotate(${angle})`}
                />
              ))}
            </g>
          </svg>
        </div>

        {/* Center medallion */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[50px] h-[50px] rounded-full bg-white border border-muted flex items-center justify-center ring-[3px] ring-neutral">
            <span
              className="text-[9px] font-bold tracking-[0.14em] text-brand-primary"
              style={{ animation: 'fade-text 2s ease-in-out infinite' }}
            >
              JASIRI
            </span>
          </div>
        </div>
      </div>

      <div className="text-center flex flex-col gap-2.5">
        <p className="text-[13px] font-medium text-text">{text}</p>
        <div className="flex items-center justify-center gap-2">
          <Dots />
          <span className="text-[11px] text-gray-400 tracking-wide">Secure financial infrastructure</span>
          <Dots delay />
        </div>
      </div>
    </div>
  );
};

const Dots = ({ delay = false }) => (
  <div className="flex gap-[5px] items-center">
    {[0, 0.2, 0.4].map((d, i) => (
      <span key={i} className="w-[5px] h-[5px] rounded-full bg-accent inline-block"
        style={{ animation: `dot-cascade 1.4s ease-in-out infinite`, animationDelay: `${d + (delay ? 0.6 : 0)}s` }}
      />
    ))}
  </div>
);

export default Spinner;