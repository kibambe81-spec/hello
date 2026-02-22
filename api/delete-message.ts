import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { messageId, userId, deleteForMe = true } = req.body || {};

  if (!messageId || !userId) {
    return res.status(400).json({ error: 'messageId and userId required' });
  }

  try {
    // Get current message
    const { data: message, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (fetchError) throw fetchError;

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user is sender or receiver
    if (message.sender_id !== userId && message.receiver_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    let deletedFor = message.deleted_for ? JSON.parse(message.deleted_for) : [];

    if (deleteForMe) {
      if (!deletedFor.includes(userId)) {
        deletedFor.push(userId);
      }
    } else {
      // Delete for everyone - remove the message completely
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (deleteError) throw deleteError;
      return res.json({ success: true });
    }

    // Update deleted_for
    const { error: updateError } = await supabase
      .from('messages')
      .update({ deleted_for: JSON.stringify(deletedFor) })
      .eq('id', messageId);

    if (updateError) throw updateError;

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: error.message });
  }
}
