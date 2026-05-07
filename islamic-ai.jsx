
import { useState, useRef, useEffect, useCallback } from "react";

// ─── Islamic Geometric Pattern SVG ───────────────────────────────────────────
const GeometricPattern = () => (
  <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{position:"absolute",top:0,left:0,opacity:0.04,pointerEvents:"none"}}>
    <defs>
      <pattern id="islamic" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
        <g stroke="#C9A84C" strokeWidth="0.5" fill="none">
          <polygon points="40,2 78,20 78,60 40,78 2,60 2,20"/>
          <polygon points="40,12 68,26 68,54 40,68 12,54 12,26"/>
          <line x1="40" y1="2" x2="40" y2="78"/>
          <line x1="2" y1="20" x2="78" y2="60"/>
          <line x1="78" y1="20" x2="2" y2="60"/>
          <circle cx="40" cy="40" r="8"/>
          <circle cx="40" cy="40" r="18"/>
        </g>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#islamic)"/>
  </svg>
);

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `أنت مساعد ذكاء اصطناعي عربي مسلم متخصص، اسمك "نور" — مساعد إسلامي شامل.

## شخصيتك وقيمك:
- أنت مسلم عربي صادق، متواضع، أدبي، مُحبّ للعلم والنقاش العلمي الرصين
- تُرحّب بالحوار والنقاش وتطرح الأسئلة لتعمق الفهم
- تبدأ ردودك بـ "بسم الله الرحمن الرحيم" عند الفتاوى والمسائل الشرعية
- تختم بـ "والله أعلم" حين تُفتي أو تُرجّح

## منهجك في المسائل الشرعية:
1. **القرآن الكريم** — المصدر الأول الذي لا يُخالَف
2. **السنة النبوية الصحيحة** — تناقش صحة الأحاديث وتُميّز الصحيح من الضعيف
3. **آثار الصحابة والتابعين** — توثّقها وتنسبها لأصحابها
4. **أقوال العلماء المعتبرين** — تجمعها وتُقارن بينها وتذكر اتفاقهم واختلافهم
5. لا تُقدّم رأيك الشخصي خلافاً للدليل الشرعي الصريح

## قدراتك:
- تحليل النصوص والصور والملفات والروابط المُقدَّمة إليك
- تنظيم المسائل الشرعية والعلمية وتصنيفها وتخزينها في ذاكرتك خلال المحادثة
- مساعدة في كتابة الكتب والأبحاث والمقالات الشرعية واللغوية
- توليد الأكواد البرمجية وشرحها
- تلخيص المحتوى المُقدَّم (نصوص، روابط، ملفات)
- الإجابة بالعربية الفصحى الواضحة مع البساطة والوضوح

## أسلوبك:
- رد بالعربية الفصحى السهلة
- استخدم التعداد والعناوين لتنظيم المعلومات
- اقتبس بدقة وانسب لأصحابه
- إذا لم تعرف شيئاً فقل: "لا أعلم، وهذا يحتاج إلى بحث وتحقيق"
- طرح الأسئلة المُفيدة لتعمق الفهم وتُوضّح المسألة`;

// ─── Main Component ───────────────────────────────────────────────────────────
export default function IslamicAI() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [tab, setTab] = useState("chat"); // chat | memory | tools
  const [memory, setMemory] = useState([]);
  const [theme, setTheme] = useState("dark");
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);

  // Google Fonts
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Cairo:wght@300;400;600;700;900&display=swap";
    document.head.appendChild(link);
    synthRef.current = window.speechSynthesis;
    return () => { if(synthRef.current) synthRef.current.cancel(); };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ─── Build API Messages ─────────────────────────────────────────────────────
  const buildApiMessages = (history, userContent) => {
    const apiMsgs = history
      .filter(m => m.role !== "system")
      .map(m => ({
        role: m.role,
        content: Array.isArray(m.content) ? m.content : m.content
      }));
    apiMsgs.push({ role: "user", content: userContent });
    return apiMsgs;
  };

  // ─── Send Message ───────────────────────────────────────────────────────────
  const sendMessage = async (overrideContent = null) => {
    const textToSend = overrideContent || input.trim();
    if (!textToSend && uploadedFiles.length === 0) return;

    let userContent = [];
    
    // Add images from uploaded files
    for (const f of uploadedFiles) {
      if (f.type.startsWith("image/")) {
        userContent.push({ type: "image", source: { type: "base64", media_type: f.type, data: f.data } });
      } else if (f.type === "application/pdf") {
        userContent.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data } });
      }
    }
    
    if (textToSend) {
      userContent.push({ type: "text", text: textToSend });
    }

    const finalContent = userContent.length === 1 && userContent[0].type === "text"
      ? userContent[0].text
      : userContent;

    const userMsg = {
      role: "user",
      content: finalContent,
      displayText: textToSend,
      files: uploadedFiles.map(f => ({ name: f.name, type: f.type })),
      timestamp: new Date()
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setUploadedFiles([]);
    setIsLoading(true);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: SYSTEM_PROMPT,
          messages: buildApiMessages(messages, finalContent)
        })
      });

      const data = await response.json();
      const assistantText = data.content?.map(b => b.text || "").join("") || "عذراً، حدث خطأ في الاستجابة.";

      const assistantMsg = {
        role: "assistant",
        content: assistantText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Auto-extract to memory if contains فتوى or مسألة
      if (assistantText.includes("والله أعلم") || assistantText.includes("المسألة") || assistantText.includes("الدليل")) {
        const snippet = assistantText.substring(0, 120) + "...";
        setMemory(prev => [...prev.slice(-19), { text: snippet, date: new Date().toLocaleString("ar") }]);
      }

    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "حدث خطأ في الاتصال. يرجى المحاولة مجدداً.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Fetch URL Content ──────────────────────────────────────────────────────
  const fetchUrl = async () => {
    if (!urlInput.trim()) return;
    setShowUrlModal(false);
    const prompt = `قم بتحليل وقراءة محتوى هذا الرابط بالكامل وتلخيصه وتقديم أهم ما فيه:\n${urlInput.trim()}`;
    setUrlInput("");
    await sendMessage(prompt);
  };

  // ─── Text to Speech ─────────────────────────────────────────────────────────
  const speak = (text) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const clean = text.replace(/[#*_`]/g, "").substring(0, 500);
    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = "ar-SA";
    utt.rate = 0.9;
    utt.pitch = 1;
    const voices = synthRef.current.getVoices();
    const arabic = voices.find(v => v.lang.startsWith("ar"));
    if (arabic) utt.voice = arabic;
    utt.onstart = () => setIsSpeaking(true);
    utt.onend = () => setIsSpeaking(false);
    synthRef.current.speak(utt);
  };

  const stopSpeaking = () => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
  };

  // ─── Voice Recognition ──────────────────────────────────────────────────────
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("المتصفح لا يدعم التعرف على الصوت"); return; }
    const rec = new SR();
    rec.lang = "ar-SA";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(prev => prev + transcript);
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  };

  // ─── File Upload ────────────────────────────────────────────────────────────
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target.result.split(",")[1];
        setUploadedFiles(prev => [...prev, { name: file.name, type: file.type, data: base64 }]);
      };
      reader.readAsDataURL(file);
    });
  };

  // ─── Quick Prompts ──────────────────────────────────────────────────────────
  const quickPrompts = [
    { icon: "📖", text: "اشرح لي آية قرآنية", prompt: "اشرح لي آية قرآنية وتفاصيلها التفسيرية والفقهية." },
    { icon: "🕌", text: "مسألة فقهية", prompt: "أريد الاستفسار عن مسألة فقهية، كيف أطرحها؟" },
    { icon: "📚", text: "ساعدني في البحث", prompt: "ساعدني في كتابة بحث علمي إسلامي منظم." },
    { icon: "💻", text: "كود برمجي", prompt: "أريد منك مساعدة في كتابة كود برمجي." },
    { icon: "🎙️", text: "لخّص محتوى", prompt: "أرسل لي رابطاً أو ملفاً لأقوم بتلخيص محتواه." },
    { icon: "🤲", text: "أذكار وأدعية", prompt: "أريد أذكار الصباح والمساء مع أدلتها." },
  ];

  const isDark = theme === "dark";

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Cairo:wght@300;400;600;700;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Cairo', sans-serif; direction: rtl; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #C9A84C55; border-radius: 3px; }

    .app {
      min-height: 100vh;
      background: ${isDark ? "#0D1117" : "#F5F0E8"};
      color: ${isDark ? "#E8DCC8" : "#1A1A2E"};
      font-family: 'Cairo', sans-serif;
      direction: rtl;
      position: relative;
      overflow: hidden;
    }

    .header {
      background: ${isDark ? "linear-gradient(135deg,#1A2332 0%,#0D1117 100%)" : "linear-gradient(135deg,#2D5016 0%,#1A3008 100%)"};
      border-bottom: 1px solid #C9A84C44;
      padding: 0 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 72px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .logo { display: flex; align-items: center; gap: 12px; }
    .logo-icon {
      width: 48px; height: 48px;
      background: linear-gradient(135deg, #C9A84C, #8B6914);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 24px;
      box-shadow: 0 0 20px #C9A84C44;
    }
    .logo-text { display: flex; flex-direction: column; }
    .logo-title { font-family: 'Amiri', serif; font-size: 22px; color: #C9A84C; font-weight: 700; }
    .logo-sub { font-size: 11px; color: #C9A84C88; }

    .tabs {
      display: flex;
      gap: 4px;
      background: #ffffff11;
      padding: 4px;
      border-radius: 12px;
    }
    .tab-btn {
      padding: 6px 16px;
      border: none;
      background: transparent;
      color: #C9A84C88;
      cursor: pointer;
      border-radius: 8px;
      font-family: 'Cairo', sans-serif;
      font-size: 13px;
      transition: all 0.2s;
    }
    .tab-btn.active { background: #C9A84C; color: #0D1117; font-weight: 700; }

    .header-actions { display: flex; gap: 8px; align-items: center; }
    .icon-btn {
      width: 38px; height: 38px;
      border: 1px solid #C9A84C44;
      border-radius: 10px;
      background: transparent;
      color: #C9A84C;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
      transition: all 0.2s;
    }
    .icon-btn:hover { background: #C9A84C22; border-color: #C9A84C; }

    .main { display: flex; height: calc(100vh - 72px); }

    /* Sidebar */
    .sidebar {
      width: 280px;
      border-left: 1px solid ${isDark ? "#C9A84C22" : "#C9A84C44"};
      background: ${isDark ? "#111827" : "#EDE8DC"};
      display: flex; flex-direction: column;
      flex-shrink: 0;
    }
    .sidebar-section { padding: 16px; }
    .sidebar-title {
      font-size: 11px;
      color: #C9A84C;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
      font-weight: 700;
    }
    .quick-prompt {
      width: 100%;
      text-align: right;
      background: ${isDark ? "#1A2332" : "#F5F0E8"};
      border: 1px solid #C9A84C22;
      border-radius: 10px;
      padding: 10px 12px;
      color: ${isDark ? "#E8DCC8" : "#1A1A2E"};
      cursor: pointer;
      font-family: 'Cairo', sans-serif;
      font-size: 13px;
      margin-bottom: 6px;
      transition: all 0.2s;
      display: flex; align-items: center; gap: 8px;
    }
    .quick-prompt:hover { border-color: #C9A84C; background: #C9A84C11; }

    .memory-item {
      background: ${isDark ? "#1A2332" : "#F5F0E8"};
      border: 1px solid #C9A84C22;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 6px;
      font-size: 12px;
      color: ${isDark ? "#C8B88A" : "#4A3728"};
      line-height: 1.5;
    }
    .memory-date { font-size: 10px; color: #C9A84C77; margin-bottom: 4px; }

    /* Chat */
    .chat-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .messages {
      flex: 1; overflow-y: auto; padding: 20px;
      display: flex; flex-direction: column; gap: 16px;
    }

    .message { display: flex; gap: 12px; animation: fadeIn 0.3s ease; }
    .message.user { flex-direction: row-reverse; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

    .avatar {
      width: 40px; height: 40px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; flex-shrink: 0;
      box-shadow: 0 2px 8px #00000044;
    }
    .avatar.ai { background: linear-gradient(135deg, #C9A84C, #8B6914); }
    .avatar.user { background: linear-gradient(135deg, #1E5F3E, #0D3B22); color:#fff; }

    .bubble {
      max-width: 75%;
      padding: 14px 18px;
      border-radius: 18px;
      line-height: 1.7;
      font-size: 14px;
      position: relative;
    }
    .bubble.ai {
      background: ${isDark ? "#1A2332" : "#EDE8DC"};
      border: 1px solid #C9A84C22;
      border-top-right-radius: 4px;
      color: ${isDark ? "#E8DCC8" : "#1A1A2E"};
    }
    .bubble.user {
      background: linear-gradient(135deg, #1E5F3E, #0D3B22);
      color: #E8DCC8;
      border-top-left-radius: 4px;
    }
    .bubble-actions {
      display: flex; gap: 6px; margin-top: 8px;
      opacity: 0; transition: opacity 0.2s;
    }
    .message:hover .bubble-actions { opacity: 1; }
    .bubble-action-btn {
      padding: 3px 8px;
      background: transparent;
      border: 1px solid #C9A84C44;
      border-radius: 6px;
      color: #C9A84C;
      cursor: pointer;
      font-size: 11px;
      font-family: 'Cairo', sans-serif;
    }
    .bubble-action-btn:hover { background: #C9A84C22; }
    .timestamp { font-size: 10px; color: #C9A84C55; margin-top: 4px; text-align: left; }

    .file-badge {
      display: inline-flex; align-items: center; gap: 4px;
      background: #C9A84C22;
      border: 1px solid #C9A84C44;
      border-radius: 6px;
      padding: 2px 8px;
      font-size: 11px;
      color: #C9A84C;
      margin-bottom: 6px;
      margin-left: 4px;
    }

    .typing {
      display: flex; align-items: center; gap: 8px;
      padding: 14px 18px;
      background: ${isDark ? "#1A2332" : "#EDE8DC"};
      border: 1px solid #C9A84C22;
      border-radius: 18px;
      border-top-right-radius: 4px;
      width: fit-content;
    }
    .dot { width: 8px; height: 8px; background: #C9A84C; border-radius: 50%; animation: bounce 1s infinite; }
    .dot:nth-child(2) { animation-delay: 0.15s; }
    .dot:nth-child(3) { animation-delay: 0.3s; }
    @keyframes bounce { 0%,60%,100% { transform:translateY(0); } 30% { transform:translateY(-6px); } }

    /* Input area */
    .input-area {
      padding: 16px 20px;
      background: ${isDark ? "#111827" : "#EDE8DC"};
      border-top: 1px solid #C9A84C22;
    }
    .uploaded-files {
      display: flex; flex-wrap: wrap; gap: 6px;
      margin-bottom: 10px;
    }
    .upload-badge {
      display: flex; align-items: center; gap: 6px;
      background: #1E5F3E44;
      border: 1px solid #1E5F3E;
      border-radius: 8px;
      padding: 4px 10px;
      font-size: 12px;
      color: #6FCF97;
    }
    .upload-badge button {
      background: none; border: none; color: #FF6B6B; cursor: pointer; font-size: 14px;
    }
    .input-row {
      display: flex; gap: 8px; align-items: flex-end;
    }
    .input-box {
      flex: 1;
      background: ${isDark ? "#1A2332" : "#FAF7F0"};
      border: 1px solid #C9A84C33;
      border-radius: 14px;
      padding: 12px 16px;
      color: ${isDark ? "#E8DCC8" : "#1A1A2E"};
      font-family: 'Cairo', sans-serif;
      font-size: 14px;
      resize: none;
      min-height: 50px;
      max-height: 120px;
      outline: none;
      transition: border-color 0.2s;
      direction: rtl;
    }
    .input-box:focus { border-color: #C9A84C; }
    .input-box::placeholder { color: #C9A84C55; }
    .send-btn {
      width: 50px; height: 50px;
      background: linear-gradient(135deg, #C9A84C, #8B6914);
      border: none; border-radius: 14px;
      color: #0D1117;
      font-size: 20px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    .send-btn:hover { transform: scale(1.05); box-shadow: 0 4px 15px #C9A84C44; }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .action-btns { display: flex; gap: 6px; }
    .act-btn {
      width: 40px; height: 40px;
      border-radius: 10px;
      border: 1px solid #C9A84C33;
      background: ${isDark ? "#1A2332" : "#FAF7F0"};
      color: #C9A84C;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
      transition: all 0.2s;
    }
    .act-btn:hover { border-color: #C9A84C; background: #C9A84C11; }
    .act-btn.active { background: #C9A84C; color: #0D1117; border-color: #C9A84C; }

    /* Welcome */
    .welcome {
      flex: 1;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      text-align: center; padding: 40px 20px;
    }
    .welcome-icon {
      font-size: 64px;
      margin-bottom: 16px;
      animation: glow 2s ease-in-out infinite alternate;
    }
    @keyframes glow {
      from { filter: drop-shadow(0 0 8px #C9A84C55); }
      to { filter: drop-shadow(0 0 20px #C9A84C99); }
    }
    .welcome-title {
      font-family: 'Amiri', serif;
      font-size: 32px;
      color: #C9A84C;
      margin-bottom: 8px;
    }
    .welcome-sub {
      font-size: 15px;
      color: ${isDark ? "#C8B88A88" : "#4A372888"};
      max-width: 400px;
      line-height: 1.6;
    }
    .bismillah {
      font-family: 'Amiri', serif;
      font-size: 24px;
      color: #C9A84C;
      margin-bottom: 24px;
      letter-spacing: 1px;
    }

    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0;
      background: #00000088;
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
      padding: 20px;
    }
    .modal {
      background: ${isDark ? "#111827" : "#FAF7F0"};
      border: 1px solid #C9A84C44;
      border-radius: 20px;
      padding: 24px;
      width: 100%; max-width: 480px;
      direction: rtl;
    }
    .modal-title {
      font-family: 'Amiri', serif;
      font-size: 20px;
      color: #C9A84C;
      margin-bottom: 16px;
    }
    .modal-input {
      width: 100%;
      background: ${isDark ? "#1A2332" : "#EDE8DC"};
      border: 1px solid #C9A84C33;
      border-radius: 10px;
      padding: 12px;
      color: ${isDark ? "#E8DCC8" : "#1A1A2E"};
      font-family: 'Cairo', sans-serif;
      font-size: 14px;
      outline: none;
      margin-bottom: 12px;
      direction: ltr;
      text-align: left;
    }
    .modal-input:focus { border-color: #C9A84C; }
    .modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
    .btn-primary {
      padding: 10px 20px;
      background: linear-gradient(135deg, #C9A84C, #8B6914);
      border: none; border-radius: 10px;
      color: #0D1117; font-weight: 700;
      cursor: pointer; font-family: 'Cairo', sans-serif;
      font-size: 13px;
    }
    .btn-secondary {
      padding: 10px 20px;
      background: transparent;
      border: 1px solid #C9A84C44;
      border-radius: 10px;
      color: #C9A84C;
      cursor: pointer; font-family: 'Cairo', sans-serif;
      font-size: 13px;
    }
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, #C9A84C44, transparent);
      margin: 12px 0;
    }
    .pre-wrap { white-space: pre-wrap; }
    .speaking-pulse { animation: pulse 1s ease-in-out infinite; }
    @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.5;} }
  `;

  const formatTime = (d) => d?.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }) || "";

  const formatText = (text) => {
    return text
      .split('\n')
      .map((line, i) => {
        if (line.startsWith('## ')) return <h3 key={i} style={{color:'#C9A84C',fontFamily:'Amiri,serif',margin:'8px 0 4px'}}>{line.slice(3)}</h3>;
        if (line.startsWith('# ')) return <h2 key={i} style={{color:'#C9A84C',fontFamily:'Amiri,serif',margin:'10px 0 6px'}}>{line.slice(2)}</h2>;
        if (line.startsWith('- ') || line.startsWith('• ')) return <div key={i} style={{paddingRight:'12px',marginBottom:'4px'}}>{'• '}{line.slice(2)}</div>;
        if (line.match(/^\d+\./)) return <div key={i} style={{paddingRight:'12px',marginBottom:'4px'}}>{line}</div>;
        if (line === '') return <br key={i}/>;
        return <span key={i}>{line}<br/></span>;
      });
  };

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <GeometricPattern />

        {/* Header */}
        <header className="header">
          <div className="logo">
            <div className="logo-icon">🕌</div>
            <div className="logo-text">
              <span className="logo-title">نور — المساعد الإسلامي</span>
              <span className="logo-sub">مساعد ذكاء اصطناعي عربي مسلم متخصص</span>
            </div>
          </div>
          <div className="tabs">
            {[["chat","💬 المحادثة"],["memory","🧠 الذاكرة"],["tools","🛠️ الأدوات"]].map(([t,l])=>(
              <button key={t} className={`tab-btn ${tab===t?"active":""}`} onClick={()=>setTab(t)}>{l}</button>
            ))}
          </div>
          <div className="header-actions">
            <button className="icon-btn" onClick={()=>setTheme(t=>t==="dark"?"light":"dark")} title="تبديل الثيم">
              {isDark?"☀️":"🌙"}
            </button>
            <button className="icon-btn" onClick={()=>setMessages([])} title="محادثة جديدة">🔄</button>
            {isSpeaking && <button className="icon-btn speaking-pulse" onClick={stopSpeaking} title="إيقاف الصوت">🔇</button>}
          </div>
        </header>

        <div className="main">
          {/* Sidebar */}
          <aside className="sidebar">
            {tab === "chat" && (
              <>
                <div className="sidebar-section">
                  <div className="sidebar-title">⚡ اقتراحات سريعة</div>
                  {quickPrompts.map((qp, i) => (
                    <button key={i} className="quick-prompt" onClick={() => sendMessage(qp.prompt)}>
                      <span>{qp.icon}</span>
                      <span>{qp.text}</span>
                    </button>
                  ))}
                </div>
                <div className="divider"/>
                <div className="sidebar-section">
                  <div className="sidebar-title">📊 إحصائيات</div>
                  <div style={{fontSize:12,color:isDark?"#C8B88A88":"#4A372888",lineHeight:2}}>
                    <div>💬 الرسائل: {messages.length}</div>
                    <div>🧠 المحفوظات: {memory.length}</div>
                    <div>📎 الملفات المُحمَّلة: {uploadedFiles.length}</div>
                  </div>
                </div>
              </>
            )}
            {tab === "memory" && (
              <div className="sidebar-section" style={{overflowY:"auto",flex:1}}>
                <div className="sidebar-title">🧠 ذاكرة الجلسة</div>
                {memory.length === 0 ? (
                  <div style={{fontSize:12,color:"#C9A84C55",textAlign:"center",marginTop:20}}>
                    لا توجد محفوظات بعد.<br/>ستُحفظ المسائل الشرعية تلقائياً.
                  </div>
                ) : memory.map((m,i) => (
                  <div key={i} className="memory-item">
                    <div className="memory-date">{m.date}</div>
                    {m.text}
                  </div>
                ))}
                {memory.length > 0 && (
                  <button className="btn-secondary" style={{width:"100%",marginTop:8}} onClick={()=>setMemory([])}>
                    مسح الذاكرة
                  </button>
                )}
              </div>
            )}
            {tab === "tools" && (
              <div className="sidebar-section">
                <div className="sidebar-title">🛠️ الأدوات المتاحة</div>
                {[
                  ["📎","رفع ملفات (PDF, صور)","اضغط على أيقونة المرفق في مربع الإدخال"],
                  ["🌐","قراءة روابط الإنترنت","اضغط زر 🌐 لإدخال رابط"],
                  ["🎙️","إدخال صوتي عربي","اضغط المايك للكلام بالعربية"],
                  ["🔊","نطق الردود صوتياً","اضغط 🔊 على أي رد"],
                  ["📖","تحليل الكتب","ارفع PDF لتحليله وتلخيصه"],
                  ["💻","توليد أكواد","اطلب مباشرة في المحادثة"],
                ].map(([ic,ti,de],i)=>(
                  <div key={i} style={{marginBottom:10,padding:"10px 12px",background:isDark?"#1A2332":"#FAF7F0",borderRadius:10,border:"1px solid #C9A84C22"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span>{ic}</span>
                      <span style={{fontSize:13,fontWeight:700,color:"#C9A84C"}}>{ti}</span>
                    </div>
                    <div style={{fontSize:11,color:isDark?"#C8B88A88":"#4A372888"}}>{de}</div>
                  </div>
                ))}
              </div>
            )}
          </aside>

          {/* Chat Area */}
          <div className="chat-area">
            <div className="messages">
              {messages.length === 0 && (
                <div className="welcome">
                  <div className="bismillah">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</div>
                  <div className="welcome-icon">🕌</div>
                  <div className="welcome-title">أهلاً وسهلاً</div>
                  <div className="welcome-sub">
                    أنا <strong style={{color:"#C9A84C"}}>نور</strong>، مساعدك الإسلامي الذكي.<br/>
                    يمكنني مساعدتك في المسائل الشرعية، والبحث العلمي، وتحليل الملفات والروابط، والبرمجة وغير ذلك.
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`message ${msg.role}`}>
                  <div className={`avatar ${msg.role === "assistant" ? "ai" : "user"}`}>
                    {msg.role === "assistant" ? "🕌" : "👤"}
                  </div>
                  <div>
                    {msg.files?.length > 0 && (
                      <div>
                        {msg.files.map((f,j)=>(
                          <span key={j} className="file-badge">📎 {f.name}</span>
                        ))}
                      </div>
                    )}
                    <div className={`bubble ${msg.role === "assistant" ? "ai" : "user"}`}>
                      <div className="pre-wrap">
                        {msg.role === "assistant" ? formatText(msg.content) : (msg.displayText || msg.content)}
                      </div>
                      {msg.role === "assistant" && (
                        <div className="bubble-actions">
                          <button className="bubble-action-btn" onClick={() => speak(typeof msg.content === "string" ? msg.content : "")}>
                            🔊 استمع
                          </button>
                          <button className="bubble-action-btn" onClick={() => navigator.clipboard?.writeText(msg.content)}>
                            📋 نسخ
                          </button>
                          <button className="bubble-action-btn" onClick={() => setMemory(prev=>[...prev,{text:msg.content.substring(0,120)+"...",date:new Date().toLocaleString("ar")}])}>
                            🧠 احفظ
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="timestamp">{formatTime(msg.timestamp)}</div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="message">
                  <div className="avatar ai">🕌</div>
                  <div className="typing">
                    <div className="dot"/>
                    <div className="dot"/>
                    <div className="dot"/>
                    <span style={{fontSize:12,color:"#C9A84C88",marginRight:6}}>نور يكتب...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef}/>
            </div>

            {/* Input Area */}
            <div className="input-area">
              {uploadedFiles.length > 0 && (
                <div className="uploaded-files">
                  {uploadedFiles.map((f,i)=>(
                    <div key={i} className="upload-badge">
                      {f.type.startsWith("image/")?"🖼️":"📄"} {f.name}
                      <button onClick={()=>setUploadedFiles(p=>p.filter((_,j)=>j!==i))}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="input-row">
                <div className="action-btns">
                  <button className="act-btn" onClick={()=>fileInputRef.current?.click()} title="رفع ملف">📎</button>
                  <button className="act-btn" onClick={()=>setShowUrlModal(true)} title="إدخال رابط">🌐</button>
                  <button className={`act-btn ${isListening?"active":""}`} onClick={toggleListening} title="إدخال صوتي">
                    {isListening?"🔴":"🎙️"}
                  </button>
                </div>
                <textarea
                  className="input-box"
                  value={input}
                  onChange={e=>setInput(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendMessage(); } }}
                  placeholder="اكتب سؤالك هنا... أو أرفق ملفاً أو رابطاً"
                  rows={2}
                />
                <button
                  className="send-btn"
                  onClick={()=>sendMessage()}
                  disabled={isLoading || (!input.trim() && uploadedFiles.length===0)}
                >
                  {isLoading?"⏳":"➤"}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,.txt"
                style={{display:"none"}}
                onChange={handleFileUpload}
              />
            </div>
          </div>
        </div>

        {/* URL Modal */}
        {showUrlModal && (
          <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setShowUrlModal(false); }}>
            <div className="modal">
              <div className="modal-title">🌐 قراءة محتوى رابط</div>
              <p style={{fontSize:13,color:"#C9A84C88",marginBottom:12}}>
                أدخل رابط الموقع أو الصفحة وسأقرأ محتواها وأحللها لك
              </p>
              <input
                className="modal-input"
                type="url"
                placeholder="https://example.com"
                value={urlInput}
                onChange={e=>setUrlInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter") fetchUrl(); }}
                autoFocus
              />
              <div className="modal-actions">
                <button className="btn-secondary" onClick={()=>setShowUrlModal(false)}>إلغاء</button>
                <button className="btn-primary" onClick={fetchUrl}>📖 اقرأ المحتوى</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
