import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // Get all publications
      const { data, error } = await supabase
        .from('publications')
        .select('*, users!inner(id, name, avatar_url)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.json(data || []);
    }

    if (req.method === 'POST') {
      const { userId, contentUrl, type } = req.body || {};

      if (!userId || !contentUrl) {
        return res.status(400).json({ error: 'userId and contentUrl required' });
      }

      const { data, error } = await supabase
        .from('publications')
        .insert({
          user_id: userId,
          content_url: contentUrl,
          type: type || 'image'
        })
        .select()
        .single();

      if (error) throw error;
      return res.json(data);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Publications error:', error);
    res.status(500).json({ error: error.message });
  }
}
