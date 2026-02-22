import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const userData = req.body;

  if (!userData || !userData.id) {
    return res.status(400).json({ error: 'User data with id required' });
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .update({
        name: userData.name,
        avatar_url: userData.avatar_url,
        language: userData.language,
        theme: userData.theme,
        blocked_numbers: userData.blocked_numbers,
        privacy_settings: userData.privacy_settings
      })
      .eq('id', userData.id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message });
  }
}
