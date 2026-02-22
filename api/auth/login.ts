import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

// In-memory storage (resets on cold start - limitation of serverless)
const users = new Map();
const messages = new Map();
const publications: any[] = [];

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { phone, name } = req.body || {};

  if (!phone) {
    return res.status(400).json({ error: 'Phone required' });
  }

  // Find or create user
  let user = Array.from(users.values()).find((u: any) => u.phone === phone);
  
  if (!user) {
    user = {
      id: uuidv4(),
      phone,
      name: name || phone,
      avatar_url: null,
      language: 'en',
      theme: 'light',
      blocked_numbers: '[]',
      privacy_settings: '{"publications": "everyone"}'
    };
    users.set(user.id, user);
  }

  res.json(user);
}
