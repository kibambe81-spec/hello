export interface User {
  id: string;
  phone: string;
  name: string;
  avatar_url?: string;
  language: string;
  theme: 'light' | 'dark';
  blocked_numbers: string; // JSON string
  privacy_settings: string; // JSON string
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  type: 'text' | 'file' | 'video' | 'audio' | 'image' | 'deleted';
  file_url?: string;
  file_name?: string;
  deleted_for_everyone: number;
  deleted_by: string; // JSON string
  reactions: string; // JSON string
  created_at: string;
}

export interface Publication {
  id: string;
  user_id: string;
  content_url: string;
  type: 'image' | 'video';
  name: string;
  avatar_url?: string;
  created_at: string;
}

export type ServerMessage = 
  | { type: 'chat'; message: Message }
  | { type: 'auth'; userId: string }
  | { type: 'call-signal'; senderId: string; signal: any; callType: 'audio' | 'video' };
