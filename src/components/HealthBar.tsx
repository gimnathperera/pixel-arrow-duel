import React from 'react';

interface HealthBarProps {
  label: string;
  health: number;
  maxHealth: number;
  colorClass: string;
  isRightToLeft?: boolean;
}

export const HealthBar: React.FC<HealthBarProps> = ({
  label,
  health,
  maxHealth,
  colorClass,
  isRightToLeft = false,
}) => {
  const percentage = Math.max(0, Math.min(100, (health / maxHealth) * 100));
  const isLow = percentage <= 25;

  // Determine gradient based on colorClass
  const gradientClass = colorClass.includes('red') 
    ? 'from-red-600 to-red-400' 
    : 'from-blue-600 to-blue-400';

  return (
    <div
      className={`flex flex-col gap-1 w-48 sm:w-64 ${isRightToLeft ? 'items-end' : 'items-start'}`}
    >
      <div className="flex justify-between w-full px-1">
        <span className="text-white font-black tracking-tighter text-[10px] italic uppercase opacity-80">
          {label}
        </span>
      </div>
      
      <div
        className={`w-full h-4 sm:h-5 bg-slate-950/50 rounded-full overflow-hidden relative border border-white/10 shadow-inner p-0.5`}
      >
        <div
          className={`h-full bg-linear-to-r ${gradientClass} transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) rounded-full relative
            ${isLow ? 'animate-pulse' : ''}
          `}
          style={{
            width: `${percentage}%`,
            marginLeft: isRightToLeft ? 'auto' : '0',
            boxShadow: `0 0 15px ${colorClass.includes('red') ? 'rgba(239, 68, 68, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`,
          }}
        >
          {/* Highlight effect */}
          <div className="absolute inset-0 bg-white/20 h-1/2 rounded-full" />
        </div>
      </div>
    </div>
  );
};
