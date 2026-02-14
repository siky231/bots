
import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Sender } from './components/Sender';
import { History } from './components/History';
import { Footer } from './components/Footer';
import { DingTalkMessage, WhitelistConfig, ConnectionStatus } from './types';
import { Layers, Zap, Moon, Sun, ChevronLeft, ChevronRight } from 'lucide-react';

const API_BASE = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3001';

const App: React.FC = () => {
  const [messages, setMessages] = useState<DingTalkMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>({ connected: false, clientId: null });
  const [isDark, setIsDark] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [latency, setLatency] = useState(0);
  
  const [whitelist, setWhitelist] = useState<WhitelistConfig>({
    directUsers: ['*'],
    groups: [{ id: '1', groupId: 'cid_group_project_001', users: 'user_001, user_002' }],
  });

  useEffect(() => {
    const saved = localStorage.getItem('dt_whitelist_v3');
    if (saved) setWhitelist(JSON.parse(saved));
    
    const savedDark = localStorage.getItem('dt_dark_mode') === 'true';
    setIsDark(savedDark);
    if (savedDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('dt_dark_mode', String(next));
    if (next) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  };

  const checkStatus = async () => {
    try {
      const start = Date.now();
      const res = await fetch(`${API_BASE}/api/status`);
      const data = await res.json();
      setStatus(data);
      setLatency(Date.now() - start);
    } catch (e) {
      setStatus({ connected: false, clientId: null });
    }
  };

  const addMessage = useCallback((msg: Partial<DingTalkMessage>) => {
    const newMessage: DingTalkMessage = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      conversationType: '1',
      msgtype: 'text',
      ...msg
    } as DingTalkMessage;
    setMessages(prev => [newMessage, ...prev]);
  }, []);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'dingtalk-message') {
        addMessage({ ...msg.data, isOutgoing: false });
      }
    };
    return () => ws.close();
  }, [addMessage]);

  const saveWhitelist = (config: WhitelistConfig) => {
    setWhitelist(config);
    localStorage.setItem('dt_whitelist_v3', JSON.stringify(config));
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f6f7f8] dark:bg-slate-950 transition-colors duration-300">
      <nav className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-primary p-2 rounded-xl text-white shadow-lg shadow-primary/20">
              <Layers size={24} />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold dark:text-white leading-tight">钉钉调试控制台</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">版本 - 微信号：四爷讲AI版 v1.0</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-4 border-l border-slate-200 dark:border-slate-800 pl-6">
              <div className="flex items-center gap-2">
                <Sun size={14} className={isDark ? 'text-slate-400' : 'text-yellow-500'} />
                <button 
                  onClick={toggleDark}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${isDark ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 transform ${isDark ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
                <Moon size={14} className={isDark ? 'text-blue-400' : 'text-slate-400'} />
              </div>

              <button 
                onClick={checkStatus}
                className={`flex items-center space-x-2 px-5 py-2 rounded-lg font-bold text-sm transition-all ${
                  status.connected ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-primary text-white hover:bg-blue-600 shadow-lg shadow-primary/20'
                }`}
              >
                <Zap size={16} fill={status.connected ? "currentColor" : "none"} />
                <span>{status.connected ? '链路正常' : '启动连接'}</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex max-w-[1600px] mx-auto w-full px-6 py-6 overflow-hidden gap-4">
        <div className={`transition-all duration-300 ease-in-out flex-shrink-0 ${isSidebarOpen ? 'w-[320px]' : 'w-0 opacity-0 pointer-events-none'}`}>
          <Sidebar status={status} whitelist={whitelist} onSaveWhitelist={saveWhitelist} onRefresh={checkStatus} />
        </div>

        <div 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="flex items-center justify-center w-2 hover:bg-primary/10 cursor-pointer rounded-full transition-colors self-stretch group"
        >
          <div className="w-7 h-7 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
            {isSidebarOpen ? <ChevronLeft size={18} className="text-slate-500" /> : <ChevronRight size={18} className="text-slate-500" />}
          </div>
        </div>

        {/* 消息控制面板：设置固定宽度 */}
        <div className="w-[380px] flex-shrink-0 flex flex-col h-full overflow-hidden">
          <Sender connected={status.connected} messages={messages} onMessageSent={addMessage} />
        </div>

        {/* 深度聚合通信历史：设置为 flex-1，以便在侧边栏折叠时填充剩余空间 */}
        <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
          <History messages={messages} whitelist={whitelist} onClear={() => setMessages([])} />
        </div>
      </main>

      <Footer status={status} latency={latency} onClear={() => setMessages([])} />
    </div>
  );
};

export default App;
