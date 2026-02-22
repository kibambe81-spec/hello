const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://akvnrjuecudsitvkktnr.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrdm5yanVlY3Vkc2l0dmtrdG5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgxMTc1MDAsImV4cCI6MjA1MzY5MzUwMH0.Nn0sG3zEZJqH6GQJ6QJZ6QJZ6QJZ6QJZ6QJZ6QJZ6Q';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async function handler(req, res) {
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

  try {
    // Find user by phone
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (findError) throw findError;

    if (existingUser) {
      return res.json(existingUser);
    }

    // Create new user
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        phone,
        name: name || phone,
        avatar_url: null,
        language: 'en',
        theme: 'light',
        blocked_numbers: '[]',
        privacy_settings: JSON.stringify({ publications: 'everyone' })
      })
      .select()
      .single();

    if (createError) throw createError;

    res.json(newUser);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
};
