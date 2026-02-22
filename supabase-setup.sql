-- =====================================================
-- SCRIPT DE CRÉATION DES TABLES POUR HELLO APP
-- =====================================================

-- Créer la table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  language TEXT DEFAULT 'en',
  theme TEXT DEFAULT 'light',
  blocked_numbers TEXT DEFAULT '[]',
  privacy_settings TEXT DEFAULT '{"publications": "everyone"}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Créer la table des messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  deleted_for TEXT DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Créer la table des publications
CREATE TABLE IF NOT EXISTS publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_url TEXT NOT NULL,
  type TEXT DEFAULT 'image',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Désactiver Row Level Security (pour le développement)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE publications DISABLE ROW LEVEL SECURITY;

-- Créer des index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_publications_user ON publications(user_id);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Confirmation
SELECT 'Tables créées avec succès!' AS result;
