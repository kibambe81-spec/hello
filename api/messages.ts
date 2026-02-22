import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { userId, otherId } = req.query;

  if (!userId || !otherId) {
    return res.status(400).json({ error: 'userId and otherId required' });
  }

  try {
    // Get messages between two users
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Filter out deleted messages
    const messages = (data || []).filter((msg: any) => {
      const deletedFor = msg.deleted_for ? JSON.parse(msg.deleted_for) : [];
      return !deletedFor.includes(userId);
    });

    res.json(messages);
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
}
