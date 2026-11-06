import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  icon?: React.ReactNode;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  className = '',
}) => {
  return (
    <div
      className={`bg-[#141618] border border-[#23272B] hover:border-[#383E46] rounded-xl p-5 shadow-sm transition-all duration-200 flex flex-col justify-between ${className}`}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-mono font-medium text-[#8A929B] uppercase tracking-wider">
            {title}
          </h3>
          {icon && (
            <div className="p-2 rounded-lg bg-[#1F2328] border border-[#2D333B] flex items-center justify-center">
              {icon}
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-3">
          <p className="text-2xl lg:text-3xl font-bold font-mono tracking-tight text-[#F3F4F6]">
            {value}
          </p>

          {trend && (
            <div
              className={`flex items-center text-xs font-mono font-medium ${
                trend.isPositive ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {trend.value === 0 ? (
                <Minus className="w-3.5 h-3.5 mr-1 text-[#8A929B]" />
              ) : trend.isPositive ? (
                <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 mr-1" />
              )}
              <span>{Math.abs(trend.value)}%</span>
              {trend.label && (
                <span className="ml-1 text-[10px] text-[#8A929B] font-normal">
                  {trend.label}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {subtitle && (
        <div className="pt-2 mt-3 border-t border-[#1F2328] text-[11px] font-mono text-[#808893]">
          {subtitle}
        </div>
      )}
    </div>
  );
};

export const MetricCardSkeleton: React.FC = () => {
  return (
    <div className="bg-[#141618] border border-[#23272B] rounded-xl p-5 shadow-sm animate-pulse flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 bg-[#23272B] rounded w-1/3" />
          <div className="w-8 h-8 bg-[#1F2328] rounded-lg" />
        </div>
        <div className="flex items-baseline gap-4 mt-2">
          <div className="h-8 bg-[#23272B] rounded w-1/2" />
          <div className="h-4 bg-[#1F2328] rounded w-1/4" />
        </div>
      </div>
      <div className="pt-2 mt-3 border-t border-[#1F2328] h-3 bg-[#1F2328] rounded w-3/4" />
    </div>
  );
};
