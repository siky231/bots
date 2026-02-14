
import React, { useState, useEffect } from 'react';
import { ConnectionStatus, WhitelistConfig, GroupConfig } from '../types';
import { ShieldCheck, PlusCircle, RefreshCw, Smartphone, Trash2, User, Key, Users, Settings } from 'lucide-react';

interface SidebarProps {
  status: ConnectionStatus;
  whitelist: WhitelistConfig;
  onSaveWhitelist: (config: WhitelistConfig) => void;
  onRefresh: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ status, whitelist, onSaveWhitelist, onRefresh }) => {
  const [appId, setAppId] = useState(status.clientId || '');
  const [secret, setSecret] = useState('');
  const [directList, setDirectList] = useState(whitelist.directUsers.join('\n'));
  const [groups, setGroups] = useState<GroupConfig[]>(whitelist.groups);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setGroups(whitelist.groups);
    setDirectList(whitelist.directUsers.join('\n'));
  }, [whitelist]);

  const addGroup = () => {
    setGroups([...groups, { id: Date.now().toString(), groupId: '', users: '' }]);
  };

  const removeGroup = (id: string) => {
    setGroups(groups.filter(g => g.id !== id));
  };

  const updateGroup = (id: string, key: 'groupId' | 'users', value: string) => {
    setGroups(groups.map(g => g.id === id ? { ...g, [key]: value } : g));
  };

  const handleConnect = async (customAppId?: string, customSecret?: string) => {
    const aid = customAppId || appId;
    const sec = customSecret || secret;
    if (!aid || !sec) return;
    setLoading(true);
    try {
      await fetch('http://localhost:3000/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: aid, clientSecret: sec })
      });
      onRefresh();
    } catch (e) {
      console.error('连接失败', e);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    onSaveWhitelist({
      directUsers: directList.split('\n').map(s => s.trim()).filter(Boolean),
      groups: groups
    });

    if (appId && secret) {
      await handleConnect();
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4 overflow-y-auto pr-2 chat-scrollbar pb-10">
      <div className="flex items-center space-x-2 text-sm font-bold text-slate-500 uppercase tracking-wider px-1 py-1">
        <ShieldCheck size={18} className="text-primary" />
        <span className="flex items-center gap-1.5"><Settings size={14} /> 调试安全配置</span>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-5">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 tracking-wide">
            <User size={12} /> DINGTALK APP_KEY
          </label>
          <input 
            type="text" 
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all font-mono"
            placeholder="应用唯一标识"
          />
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 tracking-wide">
            <Key size={12} /> DINGTALK APP_SECRET
          </label>
          <input 
            type="password" 
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all"
            placeholder="应用机密密钥"
          />
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">单聊白名单 (Sender ID)</label>
            <span className="text-[10px] text-primary font-bold">"*" 通配全员</span>
          </div>
          <textarea 
            className="w-full h-20 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 font-mono text-[10px] dark:text-white outline-none focus:ring-2 focus:ring-primary transition-all resize-none leading-relaxed"
            value={directList}
            onChange={(e) => setDirectList(e.target.value)}
            placeholder="输入 senderId (如 $:LWCP_v1:$...)，每行一个"
          />
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Users size={14} className="text-slate-400" />
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">群聊拦截配置</label>
            </div>
            <button 
              onClick={addGroup}
              className="text-primary hover:scale-110 transition-transform bg-primary/10 p-1 rounded-lg"
              title="添加授权群组"
            >
              <PlusCircle size={18} />
            </button>
          </div>
          <div className="space-y-4">
            {groups.length === 0 && <p className="text-[10px] text-slate-400 italic text-center py-2">尚未配置受控群组</p>}
            {groups.map((group) => (
              <div key={group.id} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5 relative group/item">
                <button 
                  onClick={() => removeGroup(group.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-red-500 transition-opacity p-1"
                >
                  <Trash2 size={14} />
                </button>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400">群组 ID (CID)</label>
                  <input 
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs dark:text-white font-mono"
                    placeholder="cid..."
                    value={group.groupId}
                    onChange={(e) => updateGroup(group.id, 'groupId', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400">群内成员白名单 (Sender IDs)</label>
                  <input 
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-[10px] dark:text-white font-mono"
                    placeholder="请输入 senderId，逗号隔开或 *"
                    value={group.users}
                    onChange={(e) => updateGroup(group.id, 'users', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <button 
          onClick={handleApply}
          disabled={loading}
          className="w-full py-3 bg-primary hover:bg-blue-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center space-x-2 active:scale-95"
        >
          {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <RefreshCw size={16} />}
          <span>保存并热更新配置</span>
        </button>

        <button 
          onClick={() => handleConnect()}
          disabled={loading || status.connected}
          className={`w-full py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-2 ${
            status.connected ? 'bg-emerald-100 text-emerald-600 cursor-default dark:bg-emerald-900/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Smartphone size={16} />
          <span>{status.connected ? 'STREAM 链路正常' : '手动初始化链路'}</span>
        </button>
      </div>
    </div>
  );
};
