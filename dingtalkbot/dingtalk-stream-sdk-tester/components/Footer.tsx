
import React from 'react';
import { ConnectionStatus } from '../types';
import { Activity, ShieldCheck } from 'lucide-react';

interface FooterProps {
  status: ConnectionStatus;
  latency: number;
  onClear: () => void;
}

export const Footer: React.FC<FooterProps> = ({ status, latency }) => {
  return (
    <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 h-10 px-6 flex items-center justify-between z-40">
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          <div className={`w-2 h-2 rounded-full ${status.connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="font-mono">
            {status.connected ? `通道正常 (端口: 3001)` : '通道未连接'}
          </span>
        </div>
        <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <Activity size={12} />
          <span>网络延迟: {latency}ms</span>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <span className="text-[10px] text-slate-400 font-mono italic flex items-center gap-1">
          <ShieldCheck size={10} /> 专家调试版本 v3.0.0
        </span>
      </div>
    </footer>
  );
};
