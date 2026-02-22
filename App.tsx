import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Paperclip, 
  Video, 
  Phone, 
  User as UserIcon, 
  Search, 
  MoreVertical, 
  ArrowLeft,
  File as FileIcon,
  Download,
  Check,
  ShieldCheck,
  Mic,
  Image as ImageIcon,
  Settings,
  Plus,
  X,
  Moon,
  Sun,
  Globe,
  Lock,
  Eye,
  Trash2,
  Ban,
  Camera,
  Play,
  Square,
  Smile
} from 'lucide-react';
import { User, Message, Publication } from './types';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// i18n initialization
const resources = {
  en: { translation: { "welcome": "Welcome to HELLO", "enter_nexus": "Enter HELLO", "phone": "Phone Number", "name": "Display Name", "search": "Search friends...", "online": "Online", "type_message": "Type a message...", "settings": "Settings", "theme": "Theme", "language": "Language", "privacy": "Privacy", "blocked": "Blocked Numbers", "publications": "Publications", "new_chat": "New Chat", "enter_phone": "Enter phone number to chat", "start": "Start Chat", "profile": "Profile", "dark": "Dark", "light": "Light" } },
  fr: { translation: { "welcome": "Bienvenue sur HELLO", "enter_nexus": "Entrer dans HELLO", "phone": "Numéro de téléphone", "name": "Nom d'affichage", "search": "Rechercher des amis...", "online": "En ligne", "type_message": "Écrire un message...", "settings": "Paramètres", "theme": "Thème", "language": "Langue", "privacy": "Confidentialité", "blocked": "Numéros bloqués", "publications": "Publications", "new_chat": "Nouveau Chat", "enter_phone": "Entrez le numéro pour discuter", "start": "Démarrer", "profile": "Profil", "dark": "Sombre", "light": "Clair" } },
  es: { translation: { "welcome": "Bienvenido a HELLO", "enter_nexus": "Entrar en HELLO", "phone": "Número de teléfono", "name": "Nombre", "search": "Buscar amigos...", "online": "En línea", "type_message": "Escribe un mensaje...", "settings": "Ajustes", "theme": "Tema", "language": "Idioma", "privacy": "Privacidad", "blocked": "Números bloqueados", "publications": "Publicaciones", "new_chat": "Nuevo Chat", "enter_phone": "Ingrese el número", "start": "Comenzar", "profile": "Perfil", "dark": "Oscuro", "light": "Claro" } }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: { escapeValue: false }
  });

const CHAT_BACKGROUNDS = [
  'https://picsum.photos/seed/chat1/1920/1080',
  'https://picsum.photos/seed/chat2/1920/1080',
  'https://picsum.photos/seed/chat3/1920/1080',
  'https://picsum.photos/seed/chat4/1920/1080',
  'https://picsum.photos/seed/chat5/1920/1080',
];

export default function App() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('currentUser');
    }
  }, [currentUser]);
  const [phoneInput, setPhoneInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [chatBackground, setChatBackground] = useState(CHAT_BACKGROUNDS[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [showPublications, setShowPublications] = useState(false);
  const [publications, setPublications] = useState<Publication[]>([]);
  
  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const pubInputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Theme effect
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Sync theme with user preference
  useEffect(() => {
    if (currentUser?.theme) {
      setTheme(currentUser.theme as 'light' | 'dark');
    }
  }, [currentUser?.theme]);

  // Fetch users
  const fetchUsers = useCallback(() => {
    if (currentUser) {
      fetch('/api/users')
        .then(res => res.json())
        .then(data => setUsers(data.filter((u: User) => u.id !== currentUser.id)));
    }
  }, [currentUser]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Fetch publications
  useEffect(() => {
    if (currentUser && showPublications) {
      fetch('/api/publications')
        .then(res => res.json())
        .then(data => setPublications(data));
    }
  }, [currentUser, showPublications]);

  // Polling for new messages (replaces WebSocket for Vercel)
  useEffect(() => {
    if (!currentUser || !selectedUser) return;

    const fetchMessages = () => {
      fetch(`/api/messages?userId=${currentUser.id}&otherId=${selectedUser.id}`)
        .then(res => res.json())
        .then(data => {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMessages = data.filter((m: Message) => !existingIds.has(m.id));
            if (newMessages.length > 0) {
              return [...prev, ...newMessages];
            }
            return data;
          });
        })
        .catch(console.error);
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [currentUser, selectedUser]);

  // Fetch messages when selecting a user
  useEffect(() => {
    if (currentUser && selectedUser) {
      fetch(`/api/messages?userId=${currentUser.id}&otherId=${selectedUser.id}`)
        .then(res => res.json())
        .then(data => setMessages(data));
    }
  }, [currentUser, selectedUser]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput) return;
    setIsLoggingIn(true);
    // Normalize phone number: keep only digits and +
    const normalizedPhone = phoneInput.replace(/[^\d+]/g, '');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone, name: nameInput }),
      });
      const user = await res.json();
      setCurrentUser(user);
      if (user.language) i18n.changeLanguage(user.language);
      if (user.theme) setTheme(user.theme);
    } catch (error) {
      console.error('Login failed', error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!currentUser) return;
    const newUser = { ...currentUser, ...updates };
    setCurrentUser(newUser);
    if (updates.theme) setTheme(updates.theme as 'light' | 'dark');
    await fetch('/api/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    });
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!messageInput.trim() || !currentUser || !selectedUser) return;

    try {
      await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          receiverId: selectedUser.id,
          content: messageInput,
          msgType: 'text'
        })
      });
      setMessageInput('');
      // Refresh messages
      const res = await fetch(`/api/messages?userId=${currentUser.id}&otherId=${selectedUser.id}`);
      const data = await res.json();
      setMessages(data);
    } catch (error) {
      console.error('Failed to send message', error);
    }
  };

  const deleteMessage = (messageId: string, forEveryone: boolean) => {
    if (!currentUser || !socketRef.current) return;
    socketRef.current.send(JSON.stringify({
      type: 'delete-message',
      messageId,
      userId: currentUser.id,
      forEveryone
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'chat' | 'avatar' | 'pub') => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (target === 'chat' && selectedUser && socketRef.current) {
        socketRef.current.send(JSON.stringify({
          type: 'chat',
          senderId: currentUser.id,
          receiverId: selectedUser.id,
          content: `Sent a ${data.type}`,
          msgType: data.type,
          fileUrl: data.url,
          fileName: data.name
        }));
      } else if (target === 'avatar') {
        updateUser({ avatar_url: data.url });
      } else if (target === 'pub') {
        await fetch('/api/publications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id, contentUrl: data.url, type: data.type === 'video' ? 'video' : 'image' }),
        });
        fetch('/api/publications').then(res => res.json()).then(setPublications);
      }
    } catch (error) {
      console.error('Upload failed', error);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], 'voice-note.webm', { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', file);
        
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        
        if (selectedUser && socketRef.current) {
          socketRef.current.send(JSON.stringify({
            type: 'chat',
            senderId: currentUser.id,
            receiverId: selectedUser.id,
            content: 'Voice note',
            msgType: 'audio',
            fileUrl: data.url,
            fileName: 'Voice note'
          }));
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const startNewChat = async () => {
    if (!newChatPhone) return;
    // Normalize phone number: keep only digits and +
    const normalizedPhone = newChatPhone.replace(/[^\d+]/g, '');
    if (!normalizedPhone) {
      alert("Please enter a valid phone number");
      return;
    }
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(normalizedPhone)}`);
      if (res.ok) {
        const user = await res.json();
        setSelectedUser(user);
        setShowNewChat(false);
        setNewChatPhone('');
        fetchUsers(); // Refresh list to include new user
      } else {
        alert("User not found");
      }
    } catch (error) {
      console.error('Failed to start new chat', error);
    }
  };

  const reactToMessage = (messageId: string, emoji: string) => {
    if (!currentUser || !socketRef.current) return;
    socketRef.current.send(JSON.stringify({
      type: 'reaction',
      messageId,
      userId: currentUser.id,
      emoji
    }));
  };

  const getCountryFlag = (phone: string) => {
    try {
      const phoneNumber = parsePhoneNumberFromString(phone);
      if (phoneNumber && phoneNumber.country) {
        return `https://flagcdn.com/w40/${phoneNumber.country.toLowerCase()}.png`;
      }
    } catch (e) {}
    return null;
  };

  if (!currentUser) {
    const flag = getCountryFlag(phoneInput);
    return (
      <div className={cn("min-h-screen bg-[#F5F5F7] dark:bg-zinc-950 flex items-center justify-center p-4 font-sans transition-colors", theme === 'dark' && 'dark')}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl shadow-black/5 p-10 border border-white/20 dark:border-white/5"
        >
          <div className="flex flex-col items-center mb-8">
            <motion.div 
              animate={{ 
                rotateY: [0, 360],
                scale: [1, 1.05, 1],
              }}
              transition={{ 
                duration: 6, 
                repeat: Infinity, 
                ease: "linear" 
              }}
              className="w-20 h-20 bg-black dark:bg-white rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl relative overflow-hidden group"
            >
              <motion.div 
                animate={{ x: [-100, 100] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
              />
              <ShieldCheck className="text-white dark:text-black w-10 h-10 relative z-10" />
            </motion.div>
            <h1 className="text-4xl font-bold text-black dark:text-white tracking-tighter mb-1">HELLO</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium tracking-wide uppercase">{t('welcome')}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-widest mb-2 ml-1">{t('phone')}</label>
              <div className="relative">
                <input 
                  type="tel"
                  placeholder="+33 6 12 34 56 78"
                  className="w-full px-6 py-4 bg-[#F5F5F7] dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none text-lg dark:text-white"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  required
                />
                {flag && (
                  <img src={flag} alt="flag" className="absolute right-4 top-1/2 -translate-y-1/2 w-6 rounded-sm" />
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-widest mb-2 ml-1">{t('name')}</label>
              <input 
                type="text"
                placeholder="Alex"
                className="w-full px-6 py-4 bg-[#F5F5F7] dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none text-lg dark:text-white"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />
            </div>
            <button 
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-semibold text-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-all disabled:opacity-50 shadow-lg shadow-black/10 mt-4"
            >
              {isLoggingIn ? 'Connecting...' : t('enter_nexus')}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.phone.includes(searchQuery)
  );

  return (
    <div className={cn("flex h-screen bg-white dark:bg-zinc-950 font-sans overflow-hidden transition-colors relative", theme === 'dark' && 'dark')}>
      {/* Background decorative elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Sidebar */}
      <div className={cn(
        "w-full md:w-[380px] border-r border-white/20 dark:border-white/5 flex flex-col bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl z-10",
        selectedUser || showSettings || showPublications ? 'hidden md:flex' : 'flex'
      )}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowSettings(true)} className="relative group">
                {currentUser.avatar_url ? (
                  <img key={currentUser.avatar_url} src={`${currentUser.avatar_url}?t=${Date.now()}`} className="w-10 h-10 rounded-xl object-cover" />
                ) : (
                  <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center text-white dark:text-black font-bold">
                    {currentUser.name[0].toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Settings className="w-4 h-4 text-white" />
                </div>
              </button>
              <div>
                <h2 className="font-semibold text-black dark:text-white leading-tight">{currentUser.name}</h2>
                <p className="text-xs text-gray-500">{currentUser.phone}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowPublications(true)} className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
                <ImageIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button onClick={() => setShowNewChat(true)} className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
                <Plus className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text"
              placeholder={t('search')}
              className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none text-sm shadow-sm dark:text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <div className="px-3 mb-2">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Recent Conversations</h3>
          </div>
          {filteredUsers.map(user => (
            <button
              key={user.id}
              onClick={() => setSelectedUser(user)}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-2xl transition-all mb-1",
                selectedUser?.id === user.id ? 'bg-white dark:bg-zinc-800 shadow-md' : 'hover:bg-white/50 dark:hover:bg-zinc-800/50'
              )}
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} className="w-12 h-12 rounded-2xl object-cover" />
              ) : (
                <div className="w-12 h-12 bg-gray-200 dark:bg-zinc-700 rounded-2xl flex items-center justify-center text-gray-600 dark:text-gray-400 font-semibold text-lg">
                  {user.name[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 text-left">
                <div className="flex justify-between items-start">
                  <h4 className="font-semibold text-black dark:text-white flex items-center gap-2">
                    {user.name}
                    {getCountryFlag(user.phone) && (
                      <img src={getCountryFlag(user.phone)!} className="w-4 rounded-sm" alt="flag" />
                    )}
                  </h4>
                  <span className="text-[10px] text-gray-400">Now</span>
                </div>
                <p className="text-xs text-gray-500 truncate max-w-[180px]">Tap to chat</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Settings View */}
        <AnimatePresence>
          {showSettings && (
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute inset-0 z-50 bg-white/40 dark:bg-zinc-950/40 backdrop-blur-3xl flex flex-col"
            >
              <div className="h-20 px-6 border-b border-white/20 dark:border-white/10 flex items-center gap-4">
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/20 dark:hover:bg-zinc-800/20 rounded-full transition-colors">
                  <ArrowLeft className="w-5 h-5 dark:text-white" />
                </button>
                <h2 className="text-xl font-semibold dark:text-white">{t('settings')}</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-8 max-w-2xl mx-auto w-full">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                    {currentUser.avatar_url ? (
                      <img key={currentUser.avatar_url} src={`${currentUser.avatar_url}?t=${Date.now()}`} className="w-24 h-24 rounded-[2rem] object-cover shadow-2xl border-2 border-white/20" />
                    ) : (
                      <div className="w-24 h-24 bg-black dark:bg-white rounded-[2rem] flex items-center justify-center text-white dark:text-black text-3xl font-bold shadow-2xl">
                        {currentUser.name[0].toUpperCase()}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 rounded-[2rem] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Camera className="w-6 h-6 text-white" />
                    </div>
                    <input type="file" ref={avatarInputRef} className="hidden" onChange={(e) => handleFileUpload(e, 'avatar')} />
                  </div>
                  <div className="w-full max-w-xs space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t('name')}</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 bg-white/50 dark:bg-zinc-800/50 border border-white/20 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none dark:text-white transition-all"
                      value={currentUser.name}
                      onChange={(e) => updateUser({ name: e.target.value })}
                    />
                    <p className="text-[10px] text-center text-gray-500">{currentUser.phone}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-[#F5F5F7] dark:bg-zinc-900 p-6 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white dark:bg-zinc-800 rounded-xl shadow-sm">
                          {currentUser.theme === 'dark' ? <Moon className="w-4 h-4 dark:text-white" /> : <Sun className="w-4 h-4" />}
                        </div>
                        <span className="font-medium dark:text-white">{t('theme')}</span>
                      </div>
                      <button 
                        onClick={() => updateUser({ theme: currentUser.theme === 'dark' ? 'light' : 'dark' })}
                        className="px-4 py-2 bg-white dark:bg-zinc-800 rounded-xl text-xs font-bold uppercase tracking-widest shadow-sm dark:text-white"
                      >
                        {currentUser.theme === 'dark' ? t('dark') : t('light')}
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white dark:bg-zinc-800 rounded-xl shadow-sm">
                          <Globe className="w-4 h-4 dark:text-white" />
                        </div>
                        <span className="font-medium dark:text-white">{t('language')}</span>
                      </div>
                      <select 
                        value={currentUser.language}
                        onChange={(e) => {
                          const lang = e.target.value;
                          updateUser({ language: lang });
                          i18n.changeLanguage(lang);
                        }}
                        className="bg-white dark:bg-zinc-800 border-none rounded-xl text-xs font-bold uppercase tracking-widest shadow-sm dark:text-white px-4 py-2 outline-none"
                      >
                        <option value="en">English</option>
                        <option value="fr">Français</option>
                        <option value="es">Español</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-[#F5F5F7] dark:bg-zinc-900 p-6 rounded-3xl space-y-4">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Chat Background</h4>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {CHAT_BACKGROUNDS.map((bg, i) => (
                        <button 
                          key={i} 
                          onClick={() => setChatBackground(bg)}
                          className={cn(
                            "w-16 h-16 rounded-xl flex-shrink-0 border-2 transition-all",
                            chatBackground === bg ? 'border-black dark:border-white scale-110 shadow-lg' : 'border-transparent opacity-60'
                          )}
                        >
                          <img src={bg} className="w-full h-full object-cover rounded-lg" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Publications View */}
        <AnimatePresence>
          {showPublications && (
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute inset-0 z-50 bg-white/40 dark:bg-zinc-950/40 backdrop-blur-3xl flex flex-col"
            >
              <div className="h-20 px-6 border-b border-white/20 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={() => setShowPublications(false)} className="p-2 hover:bg-white/20 dark:hover:bg-zinc-800/20 rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5 dark:text-white" />
                  </button>
                  <h2 className="text-xl font-semibold dark:text-white">{t('publications')}</h2>
                </div>
                <button 
                  onClick={() => pubInputRef.current?.click()}
                  className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg hover:scale-105 transition-transform"
                >
                  Post Status
                </button>
                <input type="file" ref={pubInputRef} className="hidden" onChange={(e) => handleFileUpload(e, 'pub')} />
              </div>
              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {publications.map(pub => (
                  <div key={pub.id} className="bg-[#F5F5F7] dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-sm group">
                    <div className="aspect-[3/4] relative">
                      {pub.type === 'video' ? (
                        <video src={pub.content_url} className="w-full h-full object-cover" controls />
                      ) : (
                        <img src={pub.content_url} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="p-4 flex items-center gap-3">
                      {pub.avatar_url ? (
                        <img src={pub.avatar_url} className="w-8 h-8 rounded-lg object-cover" />
                      ) : (
                        <div className="w-8 h-8 bg-gray-200 dark:bg-zinc-800 rounded-lg flex items-center justify-center text-[10px] font-bold">
                          {pub.name[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold dark:text-white">{pub.name}</p>
                        <p className="text-[10px] text-gray-500">{new Date(pub.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* New Chat Modal */}
        <AnimatePresence>
          {showNewChat && (
            <div className="absolute inset-0 z-[60] bg-black/20 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur-2xl w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-white/20 dark:border-white/10"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold dark:text-white">{t('new_chat')}</h3>
                  <button onClick={() => setShowNewChat(false)} className="p-2 hover:bg-white/20 dark:hover:bg-zinc-800/20 rounded-full transition-colors">
                    <X className="w-5 h-5 dark:text-white" />
                  </button>
                </div>
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">{t('enter_phone')}</p>
                  <div className="relative">
                    <input 
                      type="tel"
                      placeholder="+33 6 12 34 56 78"
                      className="w-full px-6 py-4 bg-[#F5F5F7] dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none dark:text-white"
                      value={newChatPhone}
                      onChange={(e) => setNewChatPhone(e.target.value)}
                    />
                    {getCountryFlag(newChatPhone) && (
                      <img 
                        src={getCountryFlag(newChatPhone)!} 
                        alt="flag" 
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-6 rounded-sm" 
                      />
                    )}
                  </div>
                  <button 
                    onClick={startNewChat}
                    className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold uppercase tracking-widest text-xs"
                  >
                    {t('start')}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Chat Area */}
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="h-20 px-6 border-b border-white/20 dark:border-white/10 flex items-center justify-between bg-white/40 dark:bg-zinc-950/40 backdrop-blur-3xl sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full"
                >
                  <ArrowLeft className="w-5 h-5 dark:text-white" />
                </button>
                {selectedUser.avatar_url ? (
                  <img src={selectedUser.avatar_url} className="w-10 h-10 rounded-xl object-cover" />
                ) : (
                  <div className="w-10 h-10 bg-gray-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-gray-600 dark:text-gray-400 font-bold">
                    {selectedUser.name[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-black dark:text-white flex items-center gap-2">
                    {selectedUser.name}
                    {getCountryFlag(selectedUser.phone) && (
                      <img src={getCountryFlag(selectedUser.phone)!} className="w-4 rounded-sm" alt="flag" />
                    )}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">{t('online')}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                  <Video className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <button className="p-2.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                  <Phone className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <button className="p-2.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                  <Ban className="w-5 h-5 text-red-500" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div 
              className="flex-1 overflow-y-auto p-6 space-y-4 relative"
              style={{ 
                backgroundImage: `linear-gradient(rgba(245, 245, 247, ${currentUser.theme === 'dark' ? '0.9' : '0.8'}), rgba(245, 245, 247, ${currentUser.theme === 'dark' ? '0.9' : '0.8'})), url(${chatBackground})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              {messages.map((msg) => {
                const isMe = msg.sender_id === currentUser.id;
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    key={msg.id}
                    className={cn("flex group", isMe ? 'justify-end' : 'justify-start')}
                  >
                    <div className={cn("max-w-[80%] md:max-w-[60%] flex flex-col relative", isMe ? 'items-end' : 'items-start')}>
                      {msg.type !== 'deleted' && (
                        <div className={cn(
                          "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-20",
                          isMe ? '-left-32' : '-right-32'
                        )}>
                          <div className="flex bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md rounded-full shadow-lg border border-white/20 dark:border-white/10 p-1">
                            {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => reactToMessage(msg.id, emoji)}
                                className="p-1 hover:scale-125 transition-transform text-xs"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                          <button 
                            onClick={() => deleteMessage(msg.id, false)}
                            className="p-1.5 hover:bg-white/20 dark:hover:bg-zinc-800/20 rounded-lg text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                            title="Delete for me"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {isMe && (
                            <button 
                              onClick={() => deleteMessage(msg.id, true)}
                              className="p-1.5 hover:bg-white/20 dark:hover:bg-zinc-800/20 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                              title="Delete for everyone"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}

                      <div className={cn(
                        "px-4 py-3 rounded-2xl shadow-sm relative",
                        isMe 
                          ? 'bg-black dark:bg-white text-white dark:text-black rounded-tr-none' 
                          : 'bg-white dark:bg-zinc-800 text-black dark:text-white rounded-tl-none border border-gray-100 dark:border-zinc-700',
                        msg.type === 'deleted' && 'opacity-50 italic'
                      )}>
                        {msg.type === 'deleted' && <p className="text-xs">Message deleted</p>}
                        {msg.type === 'text' && <p className="text-sm leading-relaxed">{msg.content}</p>}
                        
                        {msg.type === 'video' && (
                          <div className="space-y-2">
                            <video controls className="rounded-xl w-full max-h-64 bg-black">
                              <source src={msg.file_url} />
                            </video>
                            <p className="text-[10px] opacity-70 truncate">{msg.file_name}</p>
                          </div>
                        )}

                        {msg.type === 'image' && (
                          <img src={msg.file_url} className="rounded-xl w-full max-h-64 object-cover" />
                        )}

                        {msg.type === 'audio' && (
                          <div className="flex items-center gap-3 min-w-[200px]">
                            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", isMe ? 'bg-white/20' : 'bg-gray-100 dark:bg-zinc-700')}>
                              <Play className="w-4 h-4" />
                            </div>
                            <audio src={msg.file_url} controls className="h-8 w-full" />
                          </div>
                        )}

                        {msg.type === 'file' && (
                          <a 
                            href={msg.file_url} 
                            download={msg.file_name}
                            className={cn("flex items-center gap-3 p-2 rounded-xl", isMe ? 'bg-white/10' : 'bg-gray-50 dark:bg-zinc-900')}
                          >
                            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", isMe ? 'bg-white/20' : 'bg-gray-200 dark:bg-zinc-800')}>
                              <FileIcon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{msg.file_name}</p>
                              <p className="text-[10px] opacity-60">File</p>
                            </div>
                            <Download className="w-4 h-4 opacity-60" />
                          </a>
                        )}

                        {/* Reactions */}
                        {msg.reactions && Object.keys(JSON.parse(msg.reactions)).length > 0 && (
                          <div className={cn(
                            "absolute -bottom-3 flex gap-1 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md rounded-full px-1.5 py-0.5 shadow-sm border border-white/20 dark:border-white/10",
                            isMe ? 'right-0' : 'left-0'
                          )}>
                            {Object.entries(JSON.parse(msg.reactions) as Record<string, string[]>).map(([emoji, users]) => (
                              <span key={emoji} className="text-[10px] flex items-center gap-0.5">
                                {emoji} <span className="text-[8px] opacity-60">{users.length}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1 px-1">
                        <span className="text-[9px] text-gray-400">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMe && <Check className="w-3 h-3 text-emerald-500" />}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white/40 dark:bg-zinc-950/40 backdrop-blur-3xl border-t border-white/20 dark:border-white/10">
              <form 
                onSubmit={sendMessage}
                className="flex items-end gap-3 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md p-2 rounded-[2rem] border border-white/30 dark:border-white/10 focus-within:ring-2 focus-within:ring-black dark:focus-within:ring-white transition-all shadow-xl"
              >
                <div className="flex items-center gap-1">
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 hover:bg-white dark:hover:bg-zinc-800 rounded-full transition-all text-gray-500 hover:text-black dark:hover:text-white"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleFileUpload(e, 'chat')} />
                  
                  <button 
                    type="button"
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    className={cn(
                      "p-3 rounded-full transition-all",
                      isRecording ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-white dark:hover:bg-zinc-800 text-gray-500 hover:text-black dark:hover:text-white'
                    )}
                  >
                    {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                </div>
                
                <textarea 
                  rows={1}
                  placeholder={t('type_message')}
                  className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-3 px-2 text-sm max-h-32 outline-none dark:text-white"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />

                <button 
                  type="submit"
                  disabled={!messageInput.trim() && !isUploading}
                  className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-full hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:scale-100 shadow-lg shadow-black/10"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[#F5F5F7]/30 dark:bg-zinc-900/30">
            <div className="w-24 h-24 bg-white dark:bg-zinc-800 rounded-[2.5rem] shadow-xl flex items-center justify-center mb-8">
              <ShieldCheck className="w-12 h-12 text-black dark:text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-black dark:text-white mb-2">Welcome to HELLO</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">
              Select a friend or start a new chat to begin. Your privacy is our priority.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
