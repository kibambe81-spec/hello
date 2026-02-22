import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { senderId, receiverId, content, messageType = 'text' } = req.body || {};

  if (!senderId || !receiverId || !content) {
    return res.status(400).json({ error: 'senderId, receiverId and content required' });
  }

  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        content,
        message_type: messageType,
        deleted_for: '[]'
      })
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
}
