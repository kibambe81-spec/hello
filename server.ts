import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("chat.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    phone TEXT UNIQUE,
    name TEXT,
    avatar_url TEXT,
    language TEXT DEFAULT 'en',
    theme TEXT DEFAULT 'light',
    blocked_numbers TEXT DEFAULT '[]', -- JSON array
    privacy_settings TEXT DEFAULT '{"publications": "everyone"}', -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT,
    receiver_id TEXT,
    content TEXT,
    type TEXT DEFAULT 'text', -- 'text', 'file', 'video', 'audio', 'deleted'
    file_url TEXT,
    file_name TEXT,
    deleted_for_everyone INTEGER DEFAULT 0,
    deleted_by TEXT DEFAULT '[]', -- JSON array of user IDs
    reactions TEXT DEFAULT '{}', -- JSON object: { emoji: [userIds] }
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES users(id),
    FOREIGN KEY(receiver_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS publications (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    content_url TEXT,
    type TEXT, -- 'image', 'video'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Migration: Add reactions column if it doesn't exist
try {
  db.prepare("ALTER TABLE messages ADD COLUMN reactions TEXT DEFAULT '{}'").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE messages ADD COLUMN deleted_for_everyone INTEGER DEFAULT 0").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE messages ADD COLUMN deleted_by TEXT DEFAULT '[]'").run();
} catch (e) {}

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

// File Upload Setup
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// API Routes
app.post("/api/auth/login", (req, res) => {
  const { phone, name } = req.body;
  if (!phone) return res.status(400).json({ error: "Phone required" });

  let user = db.prepare("SELECT * FROM users WHERE phone = ?").get(phone) as any;
  if (!user) {
    const id = uuidv4();
    db.prepare("INSERT INTO users (id, phone, name) VALUES (?, ?, ?)").run(id, phone, name || phone);
    user = { id, phone, name: name || phone, avatar_url: null, language: 'en', theme: 'light', blocked_numbers: '[]', privacy_settings: '{"publications": "everyone"}' };
  }
  res.json(user);
});

app.get("/api/users", (req, res) => {
  const users = db.prepare("SELECT id, phone, name, avatar_url FROM users").all();
  res.json(users);
});

app.get("/api/users/:phone", (req, res) => {
  const { phone } = req.params;
  let user = db.prepare("SELECT id, phone, name, avatar_url FROM users WHERE phone = ?").get(phone) as any;
  
  if (!user) {
    // Create a "shadow" user so they can be messaged
    const id = uuidv4();
    db.prepare("INSERT INTO users (id, phone, name) VALUES (?, ?, ?)").run(id, phone, phone);
    user = { id, phone, name: phone, avatar_url: null };
  }
  
  res.json(user);
});

app.post("/api/users/update", (req, res) => {
  const { id, name, language, theme, blocked_numbers, privacy_settings, avatar_url } = req.body;
  db.prepare(`
    UPDATE users 
    SET name = COALESCE(?, name), 
        language = COALESCE(?, language), 
        theme = COALESCE(?, theme), 
        blocked_numbers = COALESCE(?, blocked_numbers), 
        privacy_settings = COALESCE(?, privacy_settings),
        avatar_url = COALESCE(?, avatar_url)
    WHERE id = ?
  `).run(name, language, theme, blocked_numbers, privacy_settings, avatar_url, id);
  res.json({ success: true });
});

app.get("/api/messages/:userId/:otherId", (req, res) => {
  const { userId, otherId } = req.params;
  const messages = db.prepare(`
    SELECT * FROM messages 
    WHERE ((sender_id = ? AND receiver_id = ?) 
    OR (sender_id = ? AND receiver_id = ?))
    AND deleted_for_everyone = 0
    ORDER BY created_at ASC
  `).all(userId, otherId, otherId, userId) as any[];

  // Filter out messages deleted for the specific user
  const filtered = messages.filter(m => {
    const deletedBy = JSON.parse(m.deleted_by || '[]');
    return !deletedBy.includes(userId);
  });

  res.json(filtered);
});

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  
  const fileUrl = `/uploads/${req.file.filename}`;
  let type = "file";
  if (req.file.mimetype.startsWith("video/")) type = "video";
  else if (req.file.mimetype.startsWith("audio/")) type = "audio";
  else if (req.file.mimetype.startsWith("image/")) type = "image";

  res.json({ 
    url: fileUrl, 
    name: req.file.originalname,
    type: type
  });
});

app.get("/api/publications", (req, res) => {
  const pubs = db.prepare(`
    SELECT p.*, u.name, u.avatar_url 
    FROM publications p 
    JOIN users u ON p.user_id = u.id 
    ORDER BY p.created_at DESC
  `).all();
  res.json(pubs);
});

app.post("/api/publications", (req, res) => {
  const { userId, contentUrl, type } = req.body;
  const id = uuidv4();
  db.prepare("INSERT INTO publications (id, user_id, content_url, type) VALUES (?, ?, ?, ?)").run(id, userId, contentUrl, type);
  res.json({ id });
});

app.use("/uploads", express.static(uploadDir));

// WebSocket Logic
const clients = new Map<string, WebSocket>();

wss.on("connection", (ws) => {
  let userId: string | null = null;

  ws.on("message", (data) => {
    const message = JSON.parse(data.toString());

    if (message.type === "auth") {
      userId = message.userId;
      if (userId) clients.set(userId, ws);
    } else if (message.type === "chat") {
      const { senderId, receiverId, content, msgType, fileUrl, fileName } = message;
      
      // Check if blocked
      const receiver = db.prepare("SELECT blocked_numbers FROM users WHERE id = ?").get(receiverId) as any;
      if (receiver) {
        const blocked = JSON.parse(receiver.blocked_numbers || "[]");
        const sender = db.prepare("SELECT phone FROM users WHERE id = ?").get(senderId) as any;
        if (blocked.includes(sender.phone)) {
          return; // Silent drop if blocked
        }
      }

      const id = uuidv4();
      db.prepare(`
        INSERT INTO messages (id, sender_id, receiver_id, content, type, file_url, file_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, senderId, receiverId, content, msgType || 'text', fileUrl || null, fileName || null);

      const savedMsg = db.prepare("SELECT * FROM messages WHERE id = ?").get(id);
      
      const receiverWs = clients.get(receiverId);
      if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
        receiverWs.send(JSON.stringify({ type: "chat", message: savedMsg }));
      }
      ws.send(JSON.stringify({ type: "chat", message: savedMsg }));
    } else if (message.type === "call-signal") {
      // Forward WebRTC signaling
      const { targetId, signal, callType } = message;
      const targetWs = clients.get(targetId);
      if (targetWs && targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(JSON.stringify({ 
          type: "call-signal", 
          senderId: userId, 
          signal, 
          callType 
        }));
      }
    } else if (message.type === "delete-message") {
      const { messageId, userId: deleterId, forEveryone } = message;
      const msg = db.prepare("SELECT * FROM messages WHERE id = ?").get(messageId) as any;
      if (!msg) return;

      if (forEveryone) {
        if (msg.sender_id === deleterId) {
          db.prepare("UPDATE messages SET deleted_for_everyone = 1, content = 'Message deleted', type = 'deleted' WHERE id = ?").run(messageId);
        }
      } else {
        const deletedBy = JSON.parse(msg.deleted_by || '[]');
        if (!deletedBy.includes(deleterId)) {
          deletedBy.push(deleterId);
          db.prepare("UPDATE messages SET deleted_by = ? WHERE id = ?").run(JSON.stringify(deletedBy), messageId);
        }
      }

      // Broadcast deletion
      const updatedMsg = db.prepare("SELECT * FROM messages WHERE id = ?").get(messageId);
      const broadcast = JSON.stringify({ type: "delete-message", message: updatedMsg });
      
      const senderWs = clients.get(msg.sender_id);
      const receiverWs = clients.get(msg.receiver_id);
      if (senderWs && senderWs.readyState === WebSocket.OPEN) senderWs.send(broadcast);
      if (receiverWs && receiverWs.readyState === WebSocket.OPEN) receiverWs.send(broadcast);
    } else if (message.type === "reaction") {
      const { messageId, userId: reactorId, emoji } = message;
      const msg = db.prepare("SELECT * FROM messages WHERE id = ?").get(messageId) as any;
      if (!msg) return;

      const reactions = JSON.parse(msg.reactions || '{}');
      
      // Toggle reaction
      if (!reactions[emoji]) {
        reactions[emoji] = [];
      }
      
      const index = reactions[emoji].indexOf(reactorId);
      if (index > -1) {
        reactions[emoji].splice(index, 1);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        // Remove this user from other emojis if you want single reaction per user
        // For now, let's allow multiple reactions
        reactions[emoji].push(reactorId);
      }

      db.prepare("UPDATE messages SET reactions = ? WHERE id = ?").run(JSON.stringify(reactions), messageId);

      const updatedMsg = db.prepare("SELECT * FROM messages WHERE id = ?").get(messageId);
      const broadcast = JSON.stringify({ type: "chat", message: updatedMsg }); // Re-use chat type to update message
      
      const senderWs = clients.get(msg.sender_id);
      const receiverWs = clients.get(msg.receiver_id);
      if (senderWs && senderWs.readyState === WebSocket.OPEN) senderWs.send(broadcast);
      if (receiverWs && receiverWs.readyState === WebSocket.OPEN) receiverWs.send(broadcast);
    }
  });

  ws.on("close", () => {
    if (userId) clients.delete(userId);
  });
});

// Vite Integration
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

const PORT = 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
