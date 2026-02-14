
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { DWClient, TOPIC_ROBOT } from 'dingtalk-stream';
import axios from 'axios';
import FormData from 'form-data';
import { Buffer } from 'buffer';

const app = express();
const port = 3000;
const wsPort = 3001;

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// WebSocket 服务
const wss = new WebSocketServer({ port: wsPort });
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

const broadcast = (type: string, data: any) => {
  const payload = JSON.stringify({ type, data });
  clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(payload);
  });
};

// 钉钉客户端状态
let dwClient: any = null;
let currentConfig: any = null;
let tokenCache: { token: string, expiry: number } | null = null;

async function getAccessToken() {
  const now = Date.now();
  if (tokenCache && tokenCache.expiry > now + 60000) return tokenCache.token;
  if (!currentConfig) throw new Error('应用未连接');

  const res = await axios.post('https://api.dingtalk.com/v1.0/oauth2/accessToken', {
    appKey: currentConfig.clientId,
    appSecret: currentConfig.clientSecret,
  });

  tokenCache = {
    token: res.data.accessToken,
    expiry: now + (res.data.expireIn * 1000)
  };
  return tokenCache.token;
}

async function uploadMedia(buffer: Buffer, filename: string, type: 'image' | 'voice' | 'video' | 'file') {
  const token = await getAccessToken();
  const form = new FormData();
  form.append('media', buffer, filename);

  const res = await axios.post(`https://oapi.dingtalk.com/media/upload?access_token=${token}&type=${type}`, form, {
    headers: form.getHeaders()
  });

  if (res.data.errcode !== 0) throw new Error(`上传失败: ${res.data.errmsg}`);
  return res.data.media_id;
}

// 接口路由
app.post('/api/connect', async (req, res) => {
  const { clientId, clientSecret } = req.body;
  try {
    if (dwClient) dwClient = null;
    currentConfig = { clientId, clientSecret };
    tokenCache = null;

    dwClient = new DWClient({ clientId, clientSecret, debug: false });
    dwClient.registerCallbackListener(TOPIC_ROBOT, async (response: any) => {
      const messageId = response.headers?.messageId;
      if (messageId) dwClient.socketCallBackResponse(messageId, { success: true });
      
      try {
        const msg = JSON.parse(response.data);
        console.log('\x1b[36m%s\x1b[0m', '>>> [STREAM RECEIVE]');
        console.log(JSON.stringify(msg, null, 2));
        broadcast('dingtalk-message', msg);
      } catch (err) {
        console.error('解析入向消息失败', err);
      }
    });

    await dwClient.connect();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({
    connected: !!dwClient,
    clientId: currentConfig?.clientId || null
  });
});

app.post('/api/send-msg', async (req, res) => {
  const { sessionWebhook, msgType, content, fileData, fileName, duration, picData } = req.body;
  try {
    const token = await getAccessToken();
    let payload: any = { msgtype: msgType };

    if (msgType === 'text') {
      payload.text = { content };
    } else if (msgType === 'markdown') {
      payload.markdown = { title: '通知', text: content };
    } else if (['image', 'voice', 'video', 'file'].includes(msgType)) {
      const buffer = Buffer.from(fileData.split(',')[1], 'base64');
      
      const mediaId = await uploadMedia(buffer, fileName || 'file', msgType === 'voice' ? 'voice' : (msgType as any));
      
      if (msgType === 'image') {
        payload.msgtype = 'markdown';
        payload.markdown = {
          title: fileName || '图片',
          text: `![${fileName || '图片'}](${mediaId})`
        };
      } else if (msgType === 'voice') {
        payload.voice = { mediaId: mediaId, duration: '60000' };
      } else if (msgType === 'video') {
        let picMediaId = '';
        if (picData) {
          const picBuffer = Buffer.from(picData.split(',')[1], 'base64');
          picMediaId = await uploadMedia(picBuffer, 'video_cover.jpg', 'image');
        } else {
           // 如果没有传入封面图数据，则上传一个空图片作为占位，避免钉钉报错
           const dummyImg = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
           picMediaId = await uploadMedia(dummyImg, 'cover.png', 'image');
        }
        payload.video = {
          videoMediaId: mediaId,
          videoType: 'mp4',
          duration: duration || '60000',
          picMediaId: picMediaId
        };
      } else if (msgType === 'file') {
        const extension = fileName?.includes('.') ? fileName.split('.').pop()?.toLowerCase() : 'file';
        payload.file = { 
          mediaId: mediaId, 
          fileName: fileName || 'file',
          fileType: extension
        };
      }
    }

    const headers = { 
      'x-acs-dingtalk-access-token': token, 
      'Content-Type': 'application/json' 
    };

    console.log('\x1b[33m%s\x1b[0m', '<<< [HTTP SEND REQUEST]');
    console.log(`Endpoint: ${sessionWebhook}`);
    console.log('Request Payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(sessionWebhook, payload, { headers });
    console.log('\x1b[32m%s\x1b[0m', '<<< [HTTP SEND RESPONSE]');
    console.log('Response Body:', JSON.stringify(response.data, null, 2));

    res.json({ success: true, data: response.data });
  } catch (err: any) {
    console.error('\x1b[31m%s\x1b[0m', '!!! [HTTP SEND ERROR]');
    console.error(err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(port, () => {
  console.log(`\x1b[1m\x1b[34m%s\x1b[0m`, `钉钉调试后端已启动: http://localhost:${port}`);
});
