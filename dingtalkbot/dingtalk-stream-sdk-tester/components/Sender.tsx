
import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Image as ImageIcon, Video, Mic, Layout, UploadCloud, Square, FileText, Settings2 } from 'lucide-react';
import { DingTalkMessage } from '../types';

interface SenderProps {
  connected: boolean;
  messages: DingTalkMessage[];
  onMessageSent: (msg: Partial<DingTalkMessage>) => void;
}

export const Sender: React.FC<SenderProps> = ({ connected, messages, onMessageSent }) => {
  const [targetType, setTargetType] = useState<'direct' | 'group'>('group');
  const [targetId, setTargetId] = useState('');
  const [msgType, setMsgType] = useState('text');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ 
    url: string, 
    name: string, 
    size: string, 
    base64: string,
    duration?: string,
    picBase64?: string
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [targetVoiceExt, setTargetVoiceExt] = useState('mp3');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const voiceExtensions = ['mp3', 'wav', 'amr', 'ogg', 'aac', 'flac', 'm4a'];

  const handleTypeSwitch = (type: 'direct' | 'group') => {
    if (type !== targetType) {
      setTargetType(type);
      setTargetId('');
      setContent('');
      setPreviewFile(null);
      setMsgType('text');
      if (isRecording) stopRecording();
    }
  };

  useEffect(() => {
    if (!targetId && messages.length > 0) {
      const lastMsg = messages.find(m => !m.isOutgoing);
      if (lastMsg) {
        if (targetType === 'direct' && lastMsg.sessionWebhook && lastMsg.conversationType === '1') {
          setTargetId(lastMsg.sessionWebhook);
        } else if (targetType === 'group' && lastMsg.sessionWebhook && lastMsg.conversationType === '2') {
          setTargetId(lastMsg.sessionWebhook);
        }
      }
    }
  }, [messages, targetType]);

  const fileToBase64 = (file: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  };

  // 提取视频第一帧作为封面图片
  const extractVideoFrame = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.src = URL.createObjectURL(file);
      video.onloadedmetadata = () => {
        video.currentTime = 0.5; // 跳转到0.5秒确保有画面
      };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        URL.revokeObjectURL(video.src);
        resolve(base64);
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve('');
      };
    });
  };

  const handleSend = async () => {
    if (!targetId || !connected) return;
    setSending(true);
    try {
      const body = { 
        sessionWebhook: targetId, 
        msgType: msgType,
        content: content,
        fileData: previewFile?.base64,
        fileName: previewFile?.name,
        duration: '60000', // 语音和视频统一使用 60s 默认值，或由后端处理
        picData: previewFile?.picBase64
      };

      const res = await fetch('http://localhost:3000/api/send-msg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const result = await res.json();
      if (result.success) {
        const originalMsg = messages.find(m => m.sessionWebhook === targetId);
        onMessageSent({
          isOutgoing: true,
          msgtype: msgType,
          text: msgType === 'text' ? { content } : undefined,
          markdown: msgType === 'markdown' ? { title: '通知', text: content } : undefined,
          mediaUrl: previewFile?.url,
          fileName: previewFile?.name,
          conversationType: targetType === 'direct' ? '1' : '2',
          conversationId: originalMsg?.conversationId,
          senderId: originalMsg?.senderId,
          senderNick: '我的机器人',
          sessionWebhook: targetId
        });
        setContent('');
        setPreviewFile(null);
      } else {
        alert('发送失败: ' + result.error);
      }
    } catch (e) {
      console.error(e);
      alert('连接后端失败，请确保后端服务 (3000端口) 已启动');
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      let picBase64 = '';
      if (msgType === 'video') {
        picBase64 = await extractVideoFrame(file);
      }
      setPreviewFile({
        url: URL.createObjectURL(file),
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
        base64,
        picBase64
      });
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        // 使用用户选择的后缀名
        const fileName = `voice_${Date.now()}.${targetVoiceExt}`;
        const file = new File([blob], fileName, { type: recorder.mimeType });
        const base64 = await fileToBase64(file);
        
        setPreviewFile({
          url: URL.createObjectURL(blob),
          name: fileName,
          size: (blob.size / 1024).toFixed(1) + ' KB',
          base64,
          duration: '60000'
        });
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start();
      setIsRecording(true);
      timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch (err) {
      alert('无法开启麦克风，请检查权限。');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
      setRecordingTime(0);
    }
  };

  const msgTypes = [
    { id: 'text', icon: <MessageSquare size={16} />, label: '文本' },
    { id: 'image', icon: <ImageIcon size={16} />, label: '图片' },
    { id: 'video', icon: <Video size={16} />, label: '视频' },
    { id: 'voice', icon: <Mic size={16} />, label: '语音' },
    { id: 'file', icon: <FileText size={16} />, label: '文件' },
    { id: 'markdown', icon: <Layout size={16} />, label: '卡片' },
  ];

  return (
    <div className="flex flex-col space-y-4 h-full">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-slate-500 flex items-center gap-2">
          <Send size={16} className="text-primary" />
          <span>消息控制面板</span>
        </h2>
        <div className="bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg flex">
          <button onClick={() => handleTypeSwitch('direct')} className={`px-3 py-1 text-[10px] font-bold rounded ${targetType === 'direct' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>私聊回复</button>
          <button onClick={() => handleTypeSwitch('group')} className={`px-3 py-1 text-[10px] font-bold rounded ${targetType === 'group' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>群聊回复</button>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 custom-shadow flex flex-col space-y-5 overflow-hidden">
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wide">会话回调 Webhook</label>
          <input type="text" value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono outline-none" placeholder="粘贴 Webhook 地址" />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 mb-2">选择真实消息类型</label>
          <div className="grid grid-cols-3 gap-2">
            {msgTypes.map(t => (
              <button key={t.id} onClick={() => { setMsgType(t.id); setPreviewFile(null); }} className={`px-2 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${msgType === t.id ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>{t.icon} {t.label}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 overflow-hidden relative">
          {msgType === 'voice' ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="mb-4 flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <Settings2 size={14} className="text-slate-400" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">录制格式:</span>
                <select 
                  value={targetVoiceExt} 
                  onChange={(e) => setTargetVoiceExt(e.target.value)}
                  className="bg-transparent text-[10px] font-bold text-primary border-none p-0 focus:ring-0 cursor-pointer"
                >
                  {voiceExtensions.map(ext => <option key={ext} value={ext}>{ext.toUpperCase()}</option>)}
                </select>
              </div>

              {isRecording ? (
                <div className="animate-pulse flex flex-col items-center">
                  <Square onClick={stopRecording} size={40} className="text-red-500 cursor-pointer" />
                  <span className="text-xl font-mono mt-2 dark:text-white">{recordingTime}s</span>
                </div>
              ) : previewFile ? (
                <div className="flex flex-col items-center w-full">
                  <audio controls src={previewFile.url} className="w-full mb-2" />
                  <button onClick={() => setPreviewFile(null)} className="text-[10px] font-bold text-red-500 uppercase">重新录制</button>
                </div>
              ) : (
                <Mic onClick={startRecording} size={40} className="text-primary cursor-pointer hover:scale-110 transition-transform" />
              )}
              <span className="text-xs text-slate-400 mt-2 font-bold uppercase tracking-widest">{isRecording ? '录音中...' : '点击录制语音消息'}</span>
            </div>
          ) : (['image', 'video', 'file'].includes(msgType)) ? (
            <div className="flex flex-col h-full">
              <div className="flex-1 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex items-center justify-center mb-2 overflow-hidden bg-white dark:bg-slate-900">
                {previewFile ? (
                   msgType === 'image' ? <img src={previewFile.url} className="max-h-full object-contain" /> :
                   msgType === 'video' ? <video src={previewFile.url} controls className="max-h-full" /> :
                   <div className="flex flex-col items-center"><FileText size={40} className="text-primary" /><span className="text-xs font-mono mt-2 px-4 truncate w-full text-center">{previewFile.name}</span></div>
                ) : <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center cursor-pointer text-slate-300 hover:text-primary transition-colors"><UploadCloud size={40} /><span className="text-[10px] mt-1 uppercase font-bold">选择文件</span></div>}
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
              </div>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} className="h-12 bg-transparent resize-none text-xs outline-none dark:text-white" placeholder="输入备注信息..." />
            </div>
          ) : (
            <textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full h-full bg-transparent resize-none text-sm outline-none dark:text-white font-mono" placeholder="输入消息内容..." />
          )}
        </div>

        <button onClick={handleSend} disabled={sending || !connected || !targetId} className="w-full py-4 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-600 disabled:opacity-50 transition-all shadow-lg active:scale-[0.98]">
          {sending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Send size={18} /><span>确认发送真实消息</span></>}
        </button>
      </div>
    </div>
  );
};
