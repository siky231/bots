
import React, { useState, useMemo } from 'react';
import { DingTalkMessage, WhitelistConfig } from '../types';
import { Search, ChevronDown, ChevronUp, Copy, CheckCircle2, Users, Settings, FileText, PlayCircle, Mic, X, Info, Trash2, ShieldCheck, Tag } from 'lucide-react';

interface HistoryProps {
  messages: DingTalkMessage[];
  whitelist: WhitelistConfig;
  onClear: () => void;
}

interface ConversationGroup {
  id: string; // senderId (单聊) 或 conversationId (群聊)
  title: string;
  type: '1' | '2';
  messages: DingTalkMessage[];
  isWhitelistedGroup: boolean;
  isWhitelistedUser: boolean; 
  webhook: string;
}

export const History: React.FC<HistoryProps> = ({ messages, whitelist, onClear }) => {
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [detailGroup, setDetailGroup] = useState<ConversationGroup | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 1. 核心聚合算法：基于 Webhook 逆向关联 senderId/conversationId
  const groups = useMemo(() => {
    // 建立 Webhook -> SessionInfo 的映射，用于将 outgoing 消息归位
    const webhookMap = new Map<string, { id: string, title: string, type: '1' | '2' }>();
    messages.forEach(m => {
      if (!m.isOutgoing && m.sessionWebhook) {
        // 单聊使用 senderId，群聊使用 conversationId
        const id = m.conversationType === '2' ? (m.conversationId || 'unknown') : (m.senderId || 'unknown');
        webhookMap.set(m.sessionWebhook, {
          id,
          title: m.conversationType === '2' ? (m.conversationTitle || m.conversationId || '未知群') : (m.senderNick || '未知用户'),
          type: m.conversationType
        });
      }
    });

    const groupedMap = new Map<string, ConversationGroup>();

    // 正向时间轴聚合
    [...messages].reverse().forEach(msg => {
      let key = '';
      let title = '';
      let type = msg.conversationType;

      if (!msg.isOutgoing) {
        // 入向消息：单聊取 senderId，群聊取 conversationId
        key = type === '2' ? (msg.conversationId || 'unknown') : (msg.senderId || 'unknown');
        title = type === '2' ? (msg.conversationTitle || msg.conversationId || '群聊') : (msg.senderNick || '用户');
      } else {
        // 出向消息：通过 Webhook 找回原本的 ID
        const info = msg.sessionWebhook ? webhookMap.get(msg.sessionWebhook) : null;
        if (info) {
          key = info.id;
          title = info.title;
          type = info.type;
        } else {
          key = msg.sessionWebhook || 'orphan_outgoing';
          title = '机器人回复 (未匹配)';
        }
      }

      if (!groupedMap.has(key)) {
        let isWhitelistedGroup = false;
        let isWhitelistedUser = false;

        if (type === '2') {
          // 群组白名单判断：使用 conversationId
          isWhitelistedGroup = whitelist.groups.some(g => g.groupId === key || g.groupId === '*');
        } else {
          // 单聊白名单判断：使用 senderId
          isWhitelistedUser = whitelist.directUsers.includes('*') || whitelist.directUsers.includes(key);
        }

        groupedMap.set(key, {
          id: key,
          title: title,
          type: type,
          messages: [],
          isWhitelistedGroup,
          isWhitelistedUser,
          webhook: msg.sessionWebhook || ''
        });
      }
      
      const group = groupedMap.get(key)!;
      group.messages.push(msg);
      if (msg.sessionWebhook) group.webhook = msg.sessionWebhook;
    });

    return Array.from(groupedMap.values()).reverse(); 
  }, [messages, whitelist]);

  const toggleGroup = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedGroups(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // 群聊内部消息标签判断
  const getGroupMsgTags = (msg: DingTalkMessage, group: ConversationGroup) => {
    if (group.type !== '2' || msg.isOutgoing) return null;
    
    const senderId = msg.senderId || '';
    const groupConfig = whitelist.groups.find(g => g.groupId === group.id || g.groupId === '*');
    // 群内成员白名单校验：使用 senderId
    const isWhite = groupConfig ? (groupConfig.users === '*' || groupConfig.users.split(',').map(u => u.trim()).includes(senderId)) : false;
    const isAtMe = msg.isInAtList === true;

    return { isWhite, isAtMe };
  };

  return (
    <div className="flex flex-col space-y-4 h-full relative">
      {/* 会话详情 Modal */}
      {detailGroup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5 text-primary font-bold">
                <div className="bg-primary/10 p-1.5 rounded-lg"><Settings size={18} /></div>
                <div className="flex flex-col">
                  <span className="text-sm leading-tight">会话元数据配置</span>
                  <span className="text-[10px] font-medium text-slate-400">{detailGroup.type === '1' ? '单聊会话' : '群组会话'}</span>
                </div>
              </div>
              <button onClick={() => setDetailGroup(null)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Tag size={10} /> {detailGroup.type === '1' ? '用户昵称' : '群聊名称'}
                </label>
                <div className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold">
                  {detailGroup.title}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Info size={10} /> 唯一标识 ID ({detailGroup.type === '1' ? 'Sender ID' : 'CID'})
                </label>
                <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <code className="text-[10px] font-mono text-slate-600 dark:text-slate-300 break-all select-all leading-relaxed">
                    {detailGroup.id}
                  </code>
                  <button onClick={() => copyToClipboard(detailGroup.id, 'id')} className="text-primary p-1.5 hover:bg-primary/10 rounded-lg transition-colors ml-2 flex-shrink-0">
                    {copiedField === 'id' ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <ShieldCheck size={10} /> 推送 Webhook
                </label>
                <div className="flex flex-col bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] font-mono text-slate-500 break-all italic mb-3 leading-relaxed">
                    {detailGroup.webhook || '尚未捕获 Webhook'}
                  </p>
                  {detailGroup.webhook && (
                    <button 
                      onClick={() => copyToClipboard(detailGroup.webhook, 'webhook')}
                      className="flex items-center justify-center gap-2 w-full py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-blue-600 transition-all shadow-lg"
                    >
                      {copiedField === 'webhook' ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                      {copiedField === 'webhook' ? '复制成功' : '复制 Webhook 地址'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-slate-500 flex items-center gap-2">
          <Users size={16} className="text-primary" />
          <span>深度聚合通信历史</span>
        </h2>
        <button onClick={onClear} className="text-slate-400 hover:text-red-500 transition-all flex items-center gap-1">
          <Trash2 size={14} /> <span className="text-xs font-bold">重置记录</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 chat-scrollbar pr-2 pb-6">
        {groups.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20"><Search size={40} /><p className="text-xs mt-2 font-bold tracking-widest uppercase">等待接入中</p></div>
        ) : (
          groups.map(group => {
            const isCollapsed = collapsedGroups.includes(group.id);
            return (
              <div key={group.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-all border-l-4 border-l-primary">
                {/* 组头部 */}
                <div 
                  onClick={(e) => toggleGroup(group.id, e)} 
                  className="p-3.5 bg-slate-50/80 dark:bg-slate-800/80 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-xs ${group.type === '1' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                      {group.type === '1' ? '单' : '群'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs dark:text-slate-200 truncate max-w-[200px]">{group.title}</span>
                        {group.type === '1' ? (
                           <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded-md ${group.isWhitelistedUser ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                             {group.isWhitelistedUser ? '白名单' : '非白名单'}
                           </span>
                        ) : (
                           <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded-md ${group.isWhitelistedGroup ? 'bg-emerald-500 text-white' : 'bg-slate-400 text-white'}`}>
                             {group.isWhitelistedGroup ? '群白名单' : '群非白名单'}
                           </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setDetailGroup(group); }}
                      className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                    >
                      <Settings size={15} />
                    </button>
                    {isCollapsed ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />}
                  </div>
                </div>

                {/* 消息历史列表 */}
                {!isCollapsed && (
                  <div className="p-3.5 space-y-4 max-h-[550px] overflow-y-auto chat-scrollbar bg-white dark:bg-slate-900 animate-in">
                    {group.messages.map(msg => {
                      const groupTags = getGroupMsgTags(msg, group);
                      return (
                        <div key={msg.id} className={`flex flex-col ${msg.isOutgoing ? 'items-end' : 'items-start'}`}>
                          <div className={`flex items-center gap-2 mb-1.5 ${msg.isOutgoing ? 'flex-row-reverse' : ''}`}>
                            <span className="text-[9px] text-slate-400 font-bold">{msg.isOutgoing ? '机器人回复' : (msg.senderNick || '匿名')}</span>
                            <span className="text-[8px] text-slate-300 font-mono">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            
                            {/* 群消息特定标签 */}
                            {groupTags && (
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-bold ${groupTags.isWhite ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                  {groupTags.isWhite ? '白名单' : '非白名单'}
                                </span>
                                {groupTags.isAtMe ? (
                                  <span className="bg-amber-500 text-white text-[8px] px-1.5 py-0.5 rounded-md font-bold">@机器人</span>
                                ) : (
                                  <span className="bg-slate-100 text-slate-400 text-[8px] px-1.5 py-0.5 rounded-md font-bold">未@机器人</span>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className={`max-w-[90%] p-3 rounded-2xl text-xs shadow-sm transition-all ${
                            msg.isOutgoing 
                              ? 'bg-primary text-white rounded-tr-none' 
                              : 'bg-slate-100 dark:bg-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-slate-700'
                          }`}>
                            {msg.msgtype === 'text' && <p className="whitespace-pre-wrap break-all leading-relaxed">{msg.text?.content}</p>}
                            {msg.msgtype === 'markdown' && <div className="prose prose-xs dark:prose-invert max-w-none font-sans opacity-90">{msg.markdown?.text}</div>}
                            
                            {msg.msgtype === 'image' && (
                              <div className="space-y-2">
                                <img src={msg.mediaUrl || 'https://via.placeholder.com/300?text=媒体已过期'} className="rounded-xl max-w-full shadow-sm hover:scale-[1.03] transition-transform duration-300" />
                              </div>
                            )}
                            
                            {msg.msgtype === 'voice' && (
                              <div className="flex flex-col gap-2 min-w-[120px]">
                                <div className="flex items-center gap-2 opacity-80">
                                  <Mic size={14} />
                                  <span className="font-bold">语音消息</span>
                                </div>
                                {msg.mediaUrl && <audio controls src={msg.mediaUrl} className="h-9 w-48 brightness-95 opacity-80" />}
                              </div>
                            )}
                            
                            {msg.msgtype === 'video' && (
                              <div className="space-y-2">
                                <div className="relative aspect-video bg-black/80 rounded-xl overflow-hidden shadow-inner">
                                   <video src={msg.mediaUrl} controls className="w-full h-full" />
                                </div>
                                <span className="text-[8px] opacity-40 flex items-center gap-1 uppercase tracking-tighter"><PlayCircle size={10}/> VIDEO_PLAYBACK</span>
                              </div>
                            )}
                            
                            {msg.msgtype === 'file' && (
                               <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 p-2.5 rounded-xl border border-white/5">
                                 <div className="bg-primary/10 p-2.5 rounded-xl text-primary">
                                   <FileText size={22} />
                                 </div>
                                 <div className="min-w-0 flex-1">
                                   <p className="truncate font-bold text-[11px] mb-0.5">{msg.fileName || 'ATTACHMENT'}</p>
                                   <p className="text-[8px] opacity-40">文件附件</p>
                                 </div>
                               </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
