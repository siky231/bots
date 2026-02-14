
export interface GroupConfig {
  id: string;
  groupId: string;
  users: string;
}

export interface WhitelistConfig {
  directUsers: string[];
  groups: GroupConfig[];
}

export interface DingTalkMessage {
  msgtype: string;
  senderId?: string;
  senderStaffId?: string;
  senderNick?: string;
  conversationId?: string;
  conversationTitle?: string; // 群名称
  conversationType: '1' | '2';
  text?: { content: string };
  markdown?: { title: string, text: string };
  content?: any;
  sessionWebhook?: string;
  timestamp: number;
  id: string;
  mediaUrl?: string;
  fileName?: string;
  isOutgoing?: boolean; 
  isInAtList?: boolean; // 是否在 @ 列表中
  atUsers?: { dingtalkId: string, staffId?: string }[];
}

export interface ConnectionStatus {
  connected: boolean;
  clientId: string | null;
}
