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
  const isCritical = percentage <= 10;

  return (
    <div
      className={`flex flex-col gap-1.5 w-48 sm:w-64 ${isRightToLeft ? 'items-end' : 'items-start'}`}
    >
      <span className="text-white font-bold tracking-widest text-xs sm:text-sm drop-shadow-md">
        {label}
      </span>
      <div
        className={`w-full h-7 sm:h-8 border-4 border-slate-600 bg-slate-900 overflow-hidden relative shadow-inner
          ${isRightToLeft ? 'rounded-l-md' : 'rounded-r-md'}
          ring-2 ring-slate-500/50
        `}
      >
        <div
          className={`h-full ${colorClass} transition-all duration-200 ease-out
            ${isLow ? 'animate-pulse' : ''}
            ${isCritical ? 'brightness-110' : ''}
          `}
          style={{
            width: `${percentage}%`,
            marginLeft: isRightToLeft ? 'auto' : '0',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
          }}
        />
        <div className="absolute inset-0 border-y-2 border-white/20 pointer-events-none rounded-[2px]" />
      </div>
      <span className="text-slate-400 text-xs tabular-nums">
        {Math.round(health)} / {maxHealth}
      </span>
    </div>
  );
};
