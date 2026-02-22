import type { VercelRequest, VercelResponse } from '@vercel/node';

const users = new Map();

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const allUsers = Array.from(users.values()).map((u: any) => ({
    id: u.id,
    phone: u.phone,
    name: u.name,
    avatar_url: u.avatar_url
  }));

  res.json(allUsers);
}
