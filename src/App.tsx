/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useMemo } from "react";
import Markdown from "react-markdown";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "motion/react";
import Lottie from "lottie-react";
import confetti from "canvas-confetti";
import { 
  Shield, Sparkles, AlertCircle, FileSearch, Loader2, Info, 
  Camera, Plus, X, FileText, LogOut, LogIn, ChevronRight,
  Wallet, Calendar, Lightbulb, History, Trash2, Edit3, 
  Columns, CheckCircle2, ChevronLeft, Save, Zap, MessageSquare, Send, User, Bot, Share, HelpCircle,
  Lock, ShieldCheck, CreditCard
} from "lucide-react";
import { initializeApp } from 'firebase/app';
import { analyzeLegalDocument, chatWithDocument } from "./geminiService";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp,
  getDocFromServer,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from './firebase';

/**
 * CONFIGURATION NOTES:
 * 1. Firebase API Keys: These are already configured in firebase-applet-config.json by the setup tool.
 * 2. Stripe: To implement live payments, you will need to add STRIPE_SECRET_KEY to your server-side .env
 *    and VITE_STRIPE_PUBLIC_KEY to your client-side .env.
 * 3. Payment Gateway: The handlePurchaseSuccess currently simulates a successful Google Play / Stripe flow.
 *    For production, you'd replace the timer with a call to your backend.
 */

// Contextual Tooltip Component
const ContextualTooltip = ({ text, position = "top", iconColor = "text-[#C7D2FE]" }: { text: string, position?: "top" | "bottom" | "left" | "right" | "top-left", iconColor?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const posClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-3",
    "top-left": "bottom-full right-0 mb-3",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-3",
    left: "right-full top-1/2 -translate-y-1/2 mr-3",
    right: "left-full top-1/2 -translate-y-1/2 ml-3",
  };

  return (
    <span className="relative inline-block align-middle z-[110]">
      <motion.span
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center ${iconColor} hover:bg-indigo-500/20 transition-colors relative cursor-help`}
      >
        <span className="absolute inset-0 rounded-full tooltip-ping opacity-50" />
        <HelpCircle className="w-3 h-3" />
      </motion.span>

      <AnimatePresence>
        {isOpen && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 5 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className={`absolute p-4 rounded-2xl text-white text-[11px] leading-relaxed font-bold tooltip-glass text-center pointer-events-none block ${posClasses[position]}`}
          >
            {/* Arrow */}
            <span className={`absolute w-2 h-2 bg-indigo-950/90 border-l border-t border-indigo-500/30 rotate-45 ${
              position === 'top' || position === 'top-left' ? 'top-full -translate-y-1/2 left-1/2 -translate-x-1/2 border-l-0 border-t-0 border-r border-b' : 
              position === 'bottom' ? 'bottom-full translate-y-1/2 left-1/2 -translate-x-1/2' :
              position === 'left' ? 'left-full -translate-x-1/2 top-1/2 -translate-y-1/2 border-t-0 border-l-0 border-r border-b' :
              position === 'right' ? 'right-full translate-x-1/2 top-1/2 -translate-y-1/2' : ''
            } ${position === 'top-left' ? 'left-auto right-[18px] translate-x-0' : ''}`} />
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
};

// Skeleton Component for Analysis
const AnalysisSkeleton = () => {
  return (
    <div className="space-y-12 p-4">
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 skeleton-premium rounded-2xl" />
        <div className="flex-1 space-y-3">
          <div className="h-8 skeleton-premium rounded-lg w-1/3" />
          <div className="h-4 skeleton-premium rounded-lg w-1/2" />
        </div>
      </div>
      
      <div className="space-y-6">
        <div className="h-4 skeleton-premium rounded-lg w-full" />
        <div className="h-4 skeleton-premium rounded-lg w-[95%]" />
        <div className="h-4 skeleton-premium rounded-lg w-[90%]" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-8 border border-zinc-800 rounded-3xl space-y-4">
          <div className="w-10 h-10 skeleton-premium rounded-xl" />
          <div className="h-6 skeleton-premium rounded-md w-1/2" />
          <div className="h-4 skeleton-premium rounded-md w-full" />
        </div>
        <div className="p-8 border border-zinc-800 rounded-3xl space-y-4">
          <div className="w-10 h-10 skeleton-premium rounded-xl" />
          <div className="h-6 skeleton-premium rounded-md w-1/2" />
          <div className="h-4 skeleton-premium rounded-md w-full" />
        </div>
      </div>
    </div>
  );
};

// Parallax Card Component for History
const ParallaxHistoryCard = ({ 
  item, 
  isActive, 
  isRenaming, 
  tempName, 
  setTempName, 
  saveRename, 
  startRename, 
  deleteHistoryItem, 
  loadFromHistory, 
  setComparisonItem 
}: any) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`group p-4 rounded-2xl border transition-all duration-300 relative ${
        isActive ? "bg-indigo-600/10 border-indigo-500/30" : "bg-zinc-800/30 border-zinc-800 hover:border-zinc-700"
      }`}
    >
      <div style={{ transform: "translateZ(20px)" }} className="flex items-start gap-4 mb-3">
        <div className={`p-2.5 rounded-xl ${item.hasRedFlags ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"}`}>
          {item.hasRedFlags ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0 pr-12">
          {isRenaming === item.id ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveRename(item.id)}
                className="bg-zinc-900 border border-indigo-500/30 rounded px-2 py-1 text-sm font-bold w-full text-white outline-none"
              />
              <button onClick={() => saveRename(item.id)} className="text-emerald-500"><Save className="w-4 h-4" /></button>
            </div>
          ) : (
            <h3 
              onClick={() => loadFromHistory(item)}
              className="text-sm font-black text-zinc-100 truncate cursor-pointer hover:text-white transition-colors"
            >
              {item.title}
            </h3>
          )}
          <p className="text-[10px] text-zinc-500 font-bold mt-1.5 uppercase tracking-widest">{item.date}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4 z-20">
        <button 
          onClick={() => startRename(item)}
          className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-500 hover:text-indigo-400 transition-colors"
          title="Zmień nazwę"
        >
          <Edit3 className="w-4 h-4" />
        </button>
        <button 
          onClick={() => deleteHistoryItem(item.id)}
          className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-500 hover:text-red-400 transition-colors"
          title="Usuń"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {!isActive && (
        <button 
          onClick={() => setComparisonItem(item)}
          className="mt-3 w-full py-2.5 bg-zinc-900/50 hover:bg-zinc-900 text-[10px] text-zinc-500 hover:text-indigo-400 font-black uppercase tracking-[0.2em] rounded-xl transition-all border border-transparent hover:border-zinc-700"
        >
          Porównaj archiwalny
        </button>
      )}
    </motion.div>
  );
};

interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  stripeCustomerId?: string;
  subscriptionStatus?: "active" | "canceled" | "none";
  dailyAnalysesCount?: number;
  isPro?: boolean;
}

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

interface AnalysisHistoryItem {
  id: string;
  title: string;
  date: string;
  content: string;
  sourceText?: string;
  hasRedFlags: boolean;
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [dailyAnalysesCount, setDailyAnalysesCount] = useState(0);
  const [inputText, setInputText] = useState("");
  const [analysisResult, setAnalysisResult] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [comparisonItem, setComparisonItem] = useState<AnalysisHistoryItem | null>(null);
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [animationData, setAnimationData] = useState<any>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showPaymentOverlay, setShowPaymentOverlay] = useState(false);

  // Firestore Error Handler
  const handleFirestoreError = (err: any, operation: string, path: string | null) => {
    const errInfo = {
      error: err instanceof Error ? err.message : String(err),
      operationType: operation,
      path,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
      }
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    setToast({ message: "Błąd bazy danych. Sprawdź konsolę.", type: "error" });
  };

  // 1. Firebase Connection & Auth Observer (Production Standard)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const data = userSnap.data() as UserProfile;
            const holdsPremium = data.subscriptionStatus === "active" || data.isPro === true;
            setIsPro(holdsPremium);
            setDailyAnalysesCount(data.dailyAnalysesCount || 0);
            setUser(data);
          } else {
            const newUser: UserProfile = {
              name: firebaseUser.displayName || "Użytkownik",
              email: firebaseUser.email || "",
              avatar: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
              subscriptionStatus: "none",
              dailyAnalysesCount: 0,
              isPro: false
            };
            await setDoc(userRef, newUser);
            setUser(newUser);
            setIsPro(false);
          }
        } catch (err) {
          handleFirestoreError(err, 'get', `users/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
        setIsPro(false);
        setHistory([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. WebHook Simulator: Real-time Subscription Sync (Mirroring Custom Claims behavior)
  // This listener acts as a real-time bridge. Whenever the database is updated 
  // (by a server, webhook, or external process), the app reacts instantly.
  useEffect(() => {
    if (!auth.currentUser) return;
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as UserProfile;
        const hasPro = data.subscriptionStatus === "active" || data.isPro === true;
        
        // WebHook Simulation UI Response: If payment arrived while user was waiting
        if (!isPro && hasPro && showPaymentOverlay) {
          setIsPro(true);
          setToast({ message: "Witaj w wersji Premium! Dziękujemy za zaufanie.", type: "success" });
          
          // Victory Confetti
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            zIndex: 9999
          });

          // Elegant transition out of payment screen
          setTimeout(() => {
            setIsProcessingPayment(false);
            setTimeout(() => {
              setShowPaymentOverlay(false);
              setIsSubModalOpen(false);
            }, 1000);
          }, 1000);
        }
        
        setIsPro(hasPro);
        setUser(data);
      }
    });
    return () => unsubscribe();
  }, [isPro, showPaymentOverlay, auth.currentUser]);

  // 3. Real-time History Sync
  useEffect(() => {
    if (!user || !auth.currentUser) return;

    const historyRef = collection(db, 'users', auth.currentUser.uid, 'history');
    const q = query(historyRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: AnalysisHistoryItem[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AnalysisHistoryItem));
      setHistory(items);
    }, (err) => {
      handleFirestoreError(err, 'get', `users/${auth.currentUser?.uid}/history`);
    });

    return () => unsubscribe();
  }, [user]);

  // Production Billing Placeholder
  const initiateRealPurchase = async () => {
    // TUTAJ WSTAWISZ KOD: billingClient.launchBillingFlow()
    console.log("Inicjowanie sesji płatniczej...");
    
    // WebHook Simulator: This part simulates the external processing that eventually 
    // updates the database (e.g. Stripe Webhook or Play Store RTDN)
    setTimeout(async () => {
      if (!auth.currentUser) return;
      try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
          subscriptionStatus: "active",
          isPro: true,
          paymentCompletedAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, 'simulate:webhook', `users/${auth.currentUser.uid}`);
      }
    }, 6000); // 6 seconds delay to simulate real network/verification time
  };

  const handlePurchaseSuccess = async () => {
    if (!auth.currentUser) return;
    
    setShowPaymentOverlay(true);
    setIsProcessingPayment(true);
    
    // Call the skeleton integration
    await initiateRealPurchase();
  };
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentChatQuestion, setCurrentChatQuestion] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [activeDocumentText, setActiveDocumentText] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Fetch Lottie scan animation
  useEffect(() => {
    // Verified Lottie URL for a legal/document scan animation
    fetch("https://lottie.host/80e947c6-f6d8-4903-9d93-3ea73d096d92/wXn9pYf5bC.json")
      .then(res => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then(data => setAnimationData(data))
      .catch(err => {
        console.warn("Lottie load error, falling back to CSS animation:", err);
        setAnimationData(null);
      });
  }, []);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem("legal_check_history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save history to localStorage on change
  useEffect(() => {
    localStorage.setItem("legal_check_history", JSON.stringify(history));
  }, [history]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
      setToast({ message: "Logowanie nieudane. Spróbuj ponownie.", type: "error" });
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setAnalysisResult("");
    setInputText("");
    setSelectedFile(null);
    setComparisonItem(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("Plik jest za duży. Maksymalny rozmiar to 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = (event.target?.result as string).split(",")[1];
      setSelectedFile({
        data: base64Data,
        mimeType: file.type,
        name: file.name
      });
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!inputText.trim() && !selectedFile) return;

    // Paywall check for scanning
    if (!isPro && dailyAnalysesCount >= 2) {
      setIsSubModalOpen(true);
      setToast({ message: "Wykorzystano limit darmowy. Wykup Premium, aby skanować bez ograniczeń.", type: "info" });
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult("");
    setComparisonItem(null);

    try {
      const result = await analyzeLegalDocument(inputText, selectedFile || undefined);
      if (result) {
        const promoSuffix = !isPro ? "\n\n---\n💡 **WSKAZÓWKA PRO:** System wykrył wzorce sugerujące 2 ukryte ryzyka w sekcji kar umownych. Odblokuj pełny raport PRO, aby poznać szczegóły analizy głębokiej." : "";
        setAnalysisResult(result + promoSuffix);
        
        // Prioritize actual text, fallback to "Plik dokumentu" info
        const documentSource = inputText.trim() || (selectedFile ? `[Analizowany plik: ${selectedFile.name}]` : "");
        setActiveDocumentText(documentSource);
        setChatMessages([]);
        
        // Update Firestore Daily Count
        if (!isPro && auth.currentUser) {
          const newCount = dailyAnalysesCount + 1;
          setDailyAnalysesCount(newCount);
          await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            dailyAnalysesCount: newCount,
            lastAnalysisDate: serverTimestamp()
          });
        }

        // Add to history in Firestore
        const risksCount = (result.match(/🚩|CZERWONE/g) || []).length;
        if (auth.currentUser) {
          const historyRef = collection(db, 'users', auth.currentUser.uid, 'history');
          await addDoc(historyRef, {
            title: selectedFile ? `Analiza: ${selectedFile.name}` : `Analiza: ${inputText.substring(0, 20)}...`,
            date: new Date().toLocaleString("pl-PL"),
            content: result + promoSuffix,
            sourceText: inputText.trim(),
            hasRedFlags: risksCount > 0,
            createdAt: serverTimestamp()
          });
        }

        setToast({ 
          message: `Raport wygenerowany! Wykryto ${risksCount} ${risksCount === 1 ? 'ryzyko' : 'ryzyk'}.`, 
          type: "success" 
        });
      } else {
        setError("Analiza przerwana. Wystąpił błąd podczas procesowania treści.");
      }
    } catch (err) {
      console.error(err);
      setError("Wystąpił błąd podczas analizy. Sprawdź połączenie lub klucz API.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const deleteHistoryItem = async (id: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'history', id));
      if (comparisonItem?.id === id) setComparisonItem(null);
    } catch (err) {
      handleFirestoreError(err, 'delete', `users/${auth.currentUser.uid}/history/${id}`);
    }
  };

  const startRename = (item: AnalysisHistoryItem) => {
    setIsRenaming(item.id);
    setTempName(item.title);
  };

  const saveRename = async (id: string) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid, 'history', id), {
        title: tempName
      });
      setIsRenaming(null);
    } catch (err) {
      handleFirestoreError(err, 'update', `users/${auth.currentUser.uid}/history/${id}`);
    }
  };

  const loadFromHistory = (item: AnalysisHistoryItem) => {
    setAnalysisResult(item.content);
    setActiveDocumentText(item.sourceText || "");
    setChatMessages([]); // Reset chat for loaded history
    setIsSidebarOpen(false);
    setComparisonItem(null);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentChatQuestion.trim() || isChatLoading || !analysisResult) return;

    // PRO Check for Chat
    if (!isPro) {
      setIsSubModalOpen(true);
      setToast({ message: "Czat z ekspertem AI dostępny w wersji Premium.", type: "info" });
      return;
    }

    const userQuestion = currentChatQuestion.trim();
    setCurrentChatQuestion("");
    setChatMessages(prev => [...prev, { role: "user", content: userQuestion }]);
    setIsChatLoading(true);

    try {
      // Prepare history for API
      const apiHistory = chatMessages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }));

      // Use the actual document text if available, otherwise fall back to the analysis report 
      // (which contains the AI's summary of the document).
      const hasActualText = activeDocumentText && !activeDocumentText.startsWith("[Analizowany plik:");
      const context = hasActualText ? activeDocumentText : analysisResult;
      
      const response = await chatWithDocument(context, userQuestion, apiHistory);
      setChatMessages(prev => [...prev, { role: "model", content: response }]);
    } catch (err) {
      console.error("Chat error:", err);
      setToast({ message: "Błąd podczas czatu. Spróbuj ponownie.", type: "error" });
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleShare = async () => {
    // PRO Check for Sharing
    if (!isPro) {
      setIsSubModalOpen(true);
      setToast({ message: "Udostępnianie raportów dostępne w wersji Premium.", type: "info" });
      return;
    }

    // Explicitly copy to clipboard function to reuse
    const copyToClipboard = async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setToast({ message: "Link do raportu skopiowany do schowka!", type: "info" });
      } catch (err) {
        console.error("Clipboard copy failed", err);
        setToast({ message: "Nie udało się skopiować linku.", type: "error" });
      }
    };

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Raport Bezpieczeństwa Prawnego',
          text: `Wykryto ${ (analysisResult?.match(/🚩|CZERWONE/g) || []).length } ryzyk w dokumencie.`,
          url: window.location.href,
        });
      } catch (err: any) {
        // If user cancelled, don't show error toast or log warning
        if (err.name === 'AbortError') {
          return;
        }
        
        // For other errors (e.g. permission denied in iframe), fallback to clipboard
        console.warn("Native share failed, falling back to clipboard:", err);
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050506] flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-[2rem] border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          <Shield className="absolute inset-0 m-auto w-8 h-8 text-indigo-500 animate-pulse" />
        </div>
        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em] animate-pulse">Inicjalizacja Systemu Cyber-Prawnego...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050506] text-zinc-100 font-sans selection:bg-indigo-500/30 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-zinc-900/40 backdrop-blur-3xl border border-zinc-800/50 p-10 rounded-[3rem] shadow-2xl text-center relative z-10"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600/10 rounded-3xl border border-indigo-500/20 mb-8 shadow-inner">
            <Shield className="w-10 h-10 text-indigo-400" />
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-4 text-white">LegalCheck AI</h1>
          <p className="text-zinc-400 mb-10 leading-relaxed text-sm">
            Twój osobisty filtr bezpieczeństwa prawnego. Analizuj umowy, regulaminy i polisy w kilka sekund.
          </p>

          <button
            onClick={handleLogin}
            className="w-full group flex items-center justify-center gap-4 bg-white hover:bg-zinc-100 text-black py-4 px-6 rounded-2xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-white/5"
          >
            <div className="w-6 h-6 flex items-center justify-center bg-white border border-zinc-200 rounded-full shadow-sm">
              <svg viewBox="0 0 24 24" className="w-4 h-4">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
            </div>
            Zaloguj przez Google
            <ChevronRight className="w-4 h-4 ml-auto opacity-30 group-hover:opacity-100 transition-opacity" />
          </button>
          
          <p className="mt-8 text-zinc-600 text-xs uppercase tracking-widest font-black">
            Narzędzie informacyjne • Nie porada prawna
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050506] text-zinc-100 font-sans selection:bg-indigo-500/30 flex overflow-hidden">
      
      {/* Sidebar - History Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={`fixed inset-y-0 left-0 w-80 sm:w-96 bg-zinc-900 border-r border-zinc-800 z-[70] shadow-2xl flex flex-col ${analysisResult && !isAnalyzing ? 'focus-dim' : ''}`}
            >
              <div className="p-8 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-white">Moje Dokumenty</h2>
                  <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-1">Historia analiz ({history.length})</p>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
                  <ChevronLeft className="w-6 h-6 text-zinc-400" />
                </button>
              </div>

              {/* User Profile / Plan Status Section */}
              <div className="px-8 py-6 border-b border-zinc-800 bg-zinc-800/20">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative">
                    <img src={user?.avatar} className="w-12 h-12 rounded-2xl border-2 border-zinc-800 bg-zinc-900" alt="Avatar" />
                    {isPro && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center border-2 border-zinc-900">
                        <Zap className="w-3 h-3 text-white fill-current" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white truncate">{user?.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-tight ${isPro ? 'bg-yellow-500/10 text-yellow-500' : 'bg-zinc-700/30 text-zinc-500'}`}>
                        Plan: {isPro ? 'PRO' : 'FREE'}
                      </span>
                    </div>
                  </div>
                </div>
                {!isPro && (
                  <button 
                    onClick={() => setIsSubModalOpen(true)}
                    className="w-full py-2.5 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-yellow-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Zap className="w-3 h-3" />
                    UPGRADE TO PRO
                  </button>
                )}
              </div>

              {/* Search Bar */}
              <div className="px-6 py-4 border-b border-zinc-800/50">
                <div className="relative">
                  <FileSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input
                    type="text"
                    placeholder="Szukaj w historii..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-zinc-800/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all font-bold"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {history.filter(item => item.title.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                  <div className="text-center py-20 px-6 opacity-30">
                    <History className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-sm font-black uppercase tracking-widest">Brak wyników</p>
                  </div>
                ) : (
                  history
                    .filter(item => item.title.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((item) => (
                      <ParallaxHistoryCard 
                        key={item.id}
                        item={item}
                        isActive={analysisResult === item.content}
                        isRenaming={isRenaming}
                        tempName={tempName}
                        setTempName={setTempName}
                        saveRename={saveRename}
                        startRename={startRename}
                        deleteHistoryItem={deleteHistoryItem}
                        loadFromHistory={loadFromHistory}
                        setComparisonItem={setComparisonItem}
                      />
                    ))
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 h-screen overflow-y-auto custom-scrollbar relative">
        <div className="max-w-5xl mx-auto px-6 py-12 md:py-16">
          
          {/* Navigation / Header */}
          <header className={`flex items-center justify-between mb-16 px-4 py-2 bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/50 rounded-full sticky top-8 z-50 shadow-2xl shadow-black/50 relative ${analysisResult && !isAnalyzing ? 'focus-dim' : ''}`}>
            <div className="flex items-center gap-3 ml-2">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="w-10 h-10 bg-indigo-600 flex items-center justify-center rounded-full shadow-lg shadow-indigo-600/20 hover:scale-105 transition-transform group"
              >
                <History className="w-5 h-5 text-white group-hover:rotate-[-10deg] transition-transform" />
              </button>
              <div className="flex items-center gap-3 ml-2">
                <span className="font-black text-xl tracking-tighter hidden sm:block">LegalCheck AI</span>
              </div>
            </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end mr-1 text-right">
              <span className={`text-[9px] font-black uppercase tracking-widest leading-none mb-1 ${isPro ? 'text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded-sm' : 'text-zinc-500'}`}>
                {isPro ? 'PRO ACCOUNT' : 'FREE PLAN'}
              </span>
              <span className="text-xs font-black text-white uppercase tracking-tight">{user.name}</span>
            </div>
            <div className="relative group cursor-pointer" onClick={() => setIsSidebarOpen(true)}>
              <img src={user.avatar} className={`w-10 h-10 rounded-full border-2 bg-zinc-800 transition-all ${isPro ? 'border-yellow-500 shadow-lg shadow-yellow-500/20' : 'border-indigo-500/30'}`} alt="Avatar" />
              <div className="absolute inset-0 rounded-full bg-indigo-500/10 group-hover:block hidden animate-pulse" />
            </div>
            <button 
              onClick={handleLogout}
              className="p-2.5 hover:bg-zinc-800/80 text-zinc-400 hover:text-red-400 rounded-full transition-all border border-transparent hover:border-zinc-800"
              title="Wyloguj"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/5 border border-indigo-500/10 text-indigo-500 text-[10px] font-black uppercase tracking-[0.2em] mb-6 shadow-inner">
            <Sparkles className="w-3 h-3" />
            System Analizy Dokumentów
          </div>
          <h1 className="text-5xl md:text-7.5xl font-black tracking-tight text-white mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white via-zinc-100 to-zinc-600">
            Analizator Umów AI
          </h1>
          <p className="text-zinc-500 text-lg max-w-2xl mx-auto font-medium">
            Profesjonalny silnik AI do dezyfrowania żargonu prawnego. Skanuj dokumenty i wykrywaj ukryte ryzyka w czasie rzeczywistym.
          </p>
        </motion.div>

        {/* Input Section */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="space-y-6 relative premium-glow"
        >
          <div className={`relative group premium-interactive ${isAnalyzing ? "pointer-events-none" : ""}`}>
            {isAnalyzing && <div className="animate-scan" />}
            <div className="absolute top-3 right-3 z-20">
              <ContextualTooltip 
                text="Wklej tekst lub zrób zdjęcie. Nasze AI wykryje ukryte ryzyka." 
                position="left" 
                iconColor="text-[#A5B4FC]" 
              />
            </div>
            <textarea
              id="legal-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Wklej tutaj treść umowy lub fragment regulaminu..."
              className="w-full h-80 bg-zinc-900/30 backdrop-blur-2xl border border-zinc-800/80 rounded-[3rem] p-8 text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/40 transition-all resize-none shadow-2xl premium-glow"
            />
            
            <div className="absolute bottom-8 right-8 flex items-center gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,.pdf"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 py-3.5 px-6 bg-zinc-800/40 hover:bg-zinc-800 text-zinc-300 rounded-2xl transition-all shadow-xl active:scale-95 border border-zinc-700/50 backdrop-blur-sm group/plus"
                title="Dodaj plik"
              >
                <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                <span className="text-xs font-black uppercase tracking-widest">Plik</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-4 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white rounded-2xl transition-all shadow-xl active:scale-95 border border-indigo-500/20"
                title="Zrób zdjęcie"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>

            <div className="absolute top-8 left-8 text-zinc-800 pointer-events-none group-focus-within:text-indigo-500/20 transition-colors">
              <FileSearch className="w-6 h-6" />
            </div>
          </div>

          <AnimatePresence>
            {selectedFile && (
              <motion.div
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-4 p-5 bg-indigo-500/5 border border-indigo-500/10 rounded-[2rem] backdrop-blur-md shadow-lg"
              >
                <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-400 shadow-inner">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-zinc-200 truncate pr-4">{selectedFile.name}</p>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-black leading-none mt-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    Gotowy do głębokiej analizy
                  </p>
                </div>
                <button 
                  onClick={removeFile}
                  className="p-3 hover:bg-zinc-800/50 text-zinc-600 hover:text-red-400 rounded-xl transition-all border border-transparent hover:border-zinc-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col items-center w-full relative">
            {!isPro && (
              <div className="mb-4 flex items-center gap-2">
                <div className="h-1.5 w-24 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 transition-all duration-1000" 
                    style={{ width: `${(dailyAnalysesCount / 2) * 100}%` }}
                  />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${dailyAnalysesCount >= 2 ? 'text-red-400' : 'text-zinc-500'}`}>
                  Analizy: {dailyAnalysesCount}/2
                </span>
                {dailyAnalysesCount >= 2 && (
                  <motion.span 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="ml-2 text-[10px] text-yellow-500 font-black uppercase tracking-widest bg-yellow-500/10 px-2 py-0.5 rounded-sm"
                  >
                    Wykorzystano limit darmowy. [Kup PRO]
                  </motion.span>
                )}
              </div>
            )}
            
            {/* Help Icon moved OUTSIDE the button to avoid overflow-hidden clipping */}
            <div className="absolute top-2 right-3 z-30" onClick={(e) => {
              e.stopPropagation();
            }}>
              <ContextualTooltip 
                text="Głęboka analiza zajmuje zazwyczaj od 3 do 7 sekund." 
                position="top-left" 
                iconColor="text-indigo-200" 
              />
            </div>
            
            <button
              id="scan-button"
              onClick={handleAnalyze}
              disabled={isAnalyzing || (!isPro && dailyAnalysesCount >= 2) || (!inputText.trim() && !selectedFile)}
              className="w-full group py-7 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-900/40 disabled:text-zinc-800 disabled:cursor-not-allowed rounded-[2.5rem] text-2xl font-black tracking-tight transition-all active:scale-[0.99] flex flex-col items-center justify-center gap-1 shadow-2xl shadow-indigo-600/20 relative overflow-hidden active:shadow-inner animate-shimmer"
            >
              {isAnalyzing ? (
                <span className="flex items-center gap-4">
                  <Loader2 className="w-7 h-7 animate-[spin_0.8s_linear_infinite]" />
                  <span className="animate-pulse font-black">WYKRYWANIE KLUCZOWYCH ZAPISÓW...</span>
                </span>
              ) : (
                <span className="flex items-center gap-4">
                  <Sparkles className="w-7 h-7 group-hover:rotate-12 transition-transform" />
                  <span>SKANUJ I ANALIZUJ</span>
                </span>
              )}
              
              {isAnalyzing && (
                <motion.div 
                  className="absolute bottom-0 left-0 h-1.5 bg-indigo-400 shadow-[0_0_20px_rgba(129,140,248,0.6)]"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 15, ease: "linear" }}
                />
              )}
            </button>
          </div>
        </motion.div>

        {/* Results / Empty State */}
        <section className="mt-20">
          <AnimatePresence mode="wait">
            {!analysisResult && !isAnalyzing && !error ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-24 text-center border-2 border-dashed border-zinc-900/50 rounded-[4rem] bg-zinc-900/5 relative group cursor-default"
              >
                <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/[0.02] transition-colors rounded-[4rem] pointer-events-none" />
                <div className="flex justify-center mb-8 relative">
                  <FileSearch className="w-20 h-20 text-zinc-900 group-hover:text-zinc-800 transition-colors" />
                  <motion.div 
                    animate={{ y: [0, -10, 0] }} 
                    transition={{ repeat: Infinity, duration: 3 }}
                    className="absolute -top-3 -right-3 p-3 bg-zinc-900 rounded-3xl border border-zinc-800 shadow-xl"
                  >
                    <Sparkles className="w-7 h-7 text-indigo-500" />
                  </motion.div>
                </div>
                <h3 className="text-2xl font-black text-zinc-700 mb-3 tracking-tighter">System w gotowości</h3>
                <p className="text-zinc-800 text-xs font-black uppercase tracking-[0.3em] max-w-xs mx-auto">Dodaj treść dokumentu, aby wygenerować raport bezpieczeństwa</p>
              </motion.div>
            ) : (
              <div className="flex flex-col gap-8">
                {/* Action Bar for results */}
                {analysisResult && !isAnalyzing && (
                  <div className="flex justify-between items-center px-4">
                    <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-3">
                      <FileText className="w-5 h-5 text-indigo-500" />
                      Raport Końcowy
                    </h2>
                    <button 
                      onClick={() => setIsSidebarOpen(true)}
                      className="flex items-center gap-2 py-2.5 px-5 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 rounded-2xl text-[10px] font-black text-zinc-400 hover:text-white transition-all uppercase tracking-widest shadow-xl"
                    >
                      <Columns className="w-4 h-4" />
                      Porównaj z innym
                    </button>
                  </div>
                )}

                <div className={`grid gap-8 transition-all duration-1000 ${comparisonItem ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                  
                  {/* Primary/Current Result */}
                  <motion.div
                    layout
                    className="bg-zinc-900/30 backdrop-blur-3xl border border-zinc-800/50 rounded-[3.5rem] overflow-hidden shadow-2xl relative scroll-mt-24 premium-glow"
                  >
                    {/* Visual accents */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/3 blur-[100px] pointer-events-none" />

                    <div className="p-10 md:p-14">
                      {isAnalyzing && (
                        <div className="py-12 flex flex-col items-center gap-10">
                          <div className="flex flex-col items-center text-center max-w-lg mx-auto">
                            {animationData ? (
                              <div className="w-64 h-64 mb-6">
                                <Lottie animationData={animationData} loop={true} />
                              </div>
                            ) : (
                              <div className="relative flex items-center justify-center mb-10">
                                <div className="w-28 h-28 rounded-[2.5rem] border-[8px] border-zinc-800/50 border-t-indigo-500 animate-[spin_2s_cubic-bezier(.7,0,.3,1)_infinite]" />
                                <Shield className="absolute w-10 h-10 text-indigo-500 animate-pulse" />
                              </div>
                            )}
                            <div className="space-y-4">
                              <h3 className="text-4xl font-black text-white tracking-tight">Ewaluacja dokumentu</h3>
                              <p className="text-zinc-500 font-black text-[10px] tracking-[0.4em] uppercase">Mapowanie klauzul i ocena ryzyka systemowego</p>
                            </div>
                          </div>
                          
                          <div className="w-full">
                            <AnalysisSkeleton />
                          </div>
                        </div>
                      )}

                      {error && (
                        <div className="flex items-center gap-6 p-10 rounded-[2.5rem] bg-red-500/5 border border-red-500/10 text-red-400">
                          <div className="p-5 bg-red-500/10 rounded-[1.5rem] border border-red-500/20">
                            <AlertCircle className="w-10 h-10" />
                          </div>
                          <div>
                            <p className="text-2xl font-black tracking-tight mb-1">Przerwanie procesu</p>
                            <p className="text-zinc-500 font-medium leading-relaxed">{error}</p>
                            <button onClick={handleAnalyze} className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-red-400/80 hover:text-red-400 transition-colors">
                              <Plus className="w-4 h-4 rotate-45" /> Ponów skanowanie
                            </button>
                          </div>
                        </div>
                      )}

                      {analysisResult && !isAnalyzing && (
                        <motion.div 
                          variants={{
                            visible: { transition: { staggerChildren: 0.1 } }
                          }}
                          initial="hidden"
                          animate="visible"
                          className="prose-report"
                        >
                          {comparisonItem && <div className="mb-10 p-5 glass-card rounded-2xl text-xs font-black text-indigo-400 uppercase tracking-widest text-center flex items-center justify-center gap-3 border border-indigo-500/20">
                            <Zap className="w-4 h-4" /> Aktualna Analiza
                          </div>}
                          <div className={`prose prose-invert prose-indigo max-w-none 
                            prose-headings:font-black prose-headings:tracking-tighter prose-headings:text-white 
                            prose-p:text-zinc-400 prose-p:leading-relaxed ${comparisonItem ? "prose-p:text-base prose-p:font-medium" : "prose-p:text-xl prose-p:font-semibold"}
                            prose-li:text-zinc-400 prose-li:marker:text-indigo-600 prose-li:font-medium
                            prose-hr:border-zinc-800/80 prose-blockquote:border-l-indigo-600 prose-blockquote:bg-indigo-600/5 prose-blockquote:p-8 prose-blockquote:rounded-3xl prose-blockquote:italic`}>
                            <div className="markdown-body">
                              <Markdown
                                components={{
                                  h4: ({ children }) => {
                                  const title = children?.toString() || "";
                                  let icon = <FileText className="w-6 h-6" />;
                                  let colorClass = "text-indigo-400 bg-indigo-400/10 border-indigo-400/20";
                                  
                                  if (title.includes("CZERWONE")) {
                                    icon = <AlertCircle className="w-6 h-6" />;
                                    colorClass = "text-red-400 bg-red-400/10 border-red-400/20 shadow-[0_0_30px_rgba(239,68,68,0.15)] glass-card";
                                  } else if (title.includes("ZOBOWIĄZANIA")) {
                                    icon = <Wallet className="w-6 h-6" />;
                                    colorClass = "text-amber-500 bg-amber-500/10 border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.1)] glass-card";
                                  } else if (title.includes("TERMINY")) {
                                    icon = <Calendar className="w-6 h-6" />;
                                    colorClass = "text-sky-400 bg-sky-400/10 border-sky-400/20 shadow-[0_0_30px_rgba(56,189,248,0.1)] glass-card";
                                  } else if (title.includes("WSKAZÓWKA")) {
                                    icon = <Lightbulb className="w-6 h-6" />;
                                    colorClass = "text-emerald-400 bg-emerald-400/10 border-emerald-400/20 shadow-[0_0_30px_rgba(16,185,129,0.15)] glass-card";
                                  }

                                  return (
                                    <motion.div 
                                      variants={{ 
                                        hidden: { opacity: 0, x: -10 }, 
                                        visible: { opacity: 1, x: 0 } 
                                      }}
                                      className={`flex items-center gap-5 mt-20 mb-10 first:mt-0 group report-section ${comparisonItem ? "sm:gap-3 sm:mt-12 sm:mb-8" : ""}`}>
                                      <div className={`p-4 rounded-[1.5rem] border transition-all duration-500 group-hover:scale-110 ${colorClass} ${comparisonItem ? "p-2.5 rounded-xl [&>svg]:w-4 [&>svg]:h-4" : ""}`}>
                                        {icon}
                                      </div>
                                      <h4 className={`m-0 premium-header uppercase tracking-tighter ${comparisonItem ? "text-lg" : "text-3xl"}`}>{children}</h4>
                                    </motion.div>
                                  );
                                },
                                hr: () => <hr className="my-16 border-zinc-900" />,
                                p: ({ children }) => (
                                  <motion.p 
                                    variants={{ 
                                      hidden: { opacity: 0, y: 10 }, 
                                      visible: { opacity: 1, y: 0 } 
                                    }}
                                    className="mb-10 last:mb-0 leading-relaxed report-section"
                                  >
                                    {children}
                                  </motion.p>
                                ),
                                strong: ({ children }) => <strong className="text-white font-bold bg-white/5 px-1 rounded-sm">{children}</strong>,
                                li: ({ children }) => (
                                  <motion.li 
                                    variants={{ 
                                      hidden: { opacity: 0, y: 5 }, 
                                      visible: { opacity: 1, y: 0 } 
                                    }}
                                    className="mb-4 last:mb-0 pl-1 font-medium"
                                  >
                                    {children}
                                  </motion.li>
                                )
                              }}
                            >
                              {analysisResult}
                            </Markdown>
                          </div>
                        </div>
                              {/* Report Footer */}
                           {!comparisonItem && (
                             <motion.div 
                               variants={{ 
                                 hidden: { opacity: 0, y: 20 }, 
                                 visible: { opacity: 1, y: 0 } 
                               }}
                               className="mt-20 pt-10 border-t border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-6"
                             >
                               <div className="flex items-center gap-4 text-zinc-500">
                                 <Shield className="w-5 h-5 text-indigo-500" />
                                 <p className="text-[10px] font-black uppercase tracking-widest">Weryfikacja certyfikowana przez AI</p>
                               </div>
                               <div className="flex items-center gap-3">
                                 <button 
                                   onClick={handleShare}
                                   className="flex items-center gap-3 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-zinc-700 hover:border-zinc-600 premium-interactive"
                                 >
                                   <Share className="w-4 h-4" /> Udostępnij Raport
                                 </button>
                                 <button 
                                   onClick={() => {
                                     if (!isPro) {
                                       setIsSubModalOpen(true);
                                       setToast({ message: "Eksport PDF dostępny w planie PRO", type: "info" });
                                     } else {
                                       window.print();
                                     }
                                   }}
                                   className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 premium-interactive ${
                                     isPro 
                                       ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20" 
                                       : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700"
                                   }`}
                                 >
                                   {isPro ? <FileText className="w-4 h-4" /> : <Lock className="w-4 h-4 text-zinc-500" />} 
                                   Drukuj PDF
                                 </button>
                               </div>
                             </motion.div>
                           )}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>

                  {/* Chat Section - Only visible when we have results */}
                  <AnimatePresence>
                    {analysisResult && !isAnalyzing && !comparisonItem && (
                      <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-zinc-900/30 backdrop-blur-3xl border border-zinc-800/50 rounded-[3.5rem] overflow-hidden shadow-2xl flex flex-col h-[600px] premium-glow relative"
                      >
                        {!isPro && (
                          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-12 text-center bg-zinc-950/60 backdrop-blur-md">
                            <div className="w-20 h-20 bg-yellow-500/10 rounded-[2rem] flex items-center justify-center mb-8 border border-yellow-500/20 shadow-2xl shadow-yellow-500/10">
                              <Lock className="w-10 h-10 text-yellow-500" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-4 tracking-tight">Inteligentny Czat PRO</h3>
                            <p className="text-zinc-400 mb-10 leading-relaxed text-sm max-w-xs">
                              Zadawaj pytania, wyjaśniaj klauzule i rozmawiaj z dokumentem. Ta funkcja jest dostępna wyłącznie w pakiecie PRO.
                            </p>
                            <button 
                              onClick={() => setIsSubModalOpen(true)}
                              className="px-10 py-4 bg-gradient-to-r from-yellow-500 to-amber-600 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-2xl shadow-yellow-500/20 hover:scale-105 active:scale-95 flex items-center gap-3"
                            >
                              <Zap className="w-4 h-4" />
                              Odblokuj Teraz
                            </button>
                          </div>
                        )}
                        <div className="p-8 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/10">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-600/10 rounded-2xl border border-indigo-500/20">
                              <MessageSquare className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-xl font-black text-white tracking-tight">Rozmowa z Dokumentem</h3>
                                <ContextualTooltip text="Zadaj dowolne pytanie. AI odpowie tylko na podstawie treści tej umowy." position="top" />
                              </div>
                              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-1">Sztuczna Inteligencja wsparta treścią Twojej umowy</p>
                            </div>
                          </div>
                        </div>

                        {/* Messages Area */}
                                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                          {chatMessages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-30 px-10">
                              <div className="w-16 h-16 bg-zinc-800 rounded-3xl flex items-center justify-center mb-6">
                                <Sparkles className="w-8 h-8" />
                              </div>
                              <p className="text-sm font-black uppercase tracking-[0.2em] mb-2">Początek dyskusji</p>
                              <p className="text-xs font-medium text-zinc-500 max-w-xs">Zadaj pytanie dotyczące konkretnych zapisów, kar umownych lub terminów w tym dokumencie.</p>
                            </div>
                          ) : (
                            <motion.div 
                              variants={{
                                visible: { transition: { staggerChildren: 0.1 } }
                              }}
                              initial="hidden"
                              animate="visible"
                              className="space-y-6"
                            >
                              {chatMessages.map((msg, idx) => (
                                <motion.div
                                  key={idx}
                                  variants={{
                                    hidden: { opacity: 0, x: msg.role === "user" ? 20 : -20 },
                                    visible: { opacity: 1, x: 0 }
                                  }}
                                  className={`flex items-start gap-4 ${msg.role === "user" ? "flex-row-reverse text-right" : ""}`}
                                >
                                  <div className={`p-2.5 rounded-xl flex-shrink-0 ${msg.role === "user" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>
                                    {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                  </div>
                                  <div className={`max-w-[80%] p-5 rounded-3xl text-sm leading-relaxed ${
                                    msg.role === "user" ? "bg-indigo-600/20 text-white rounded-tr-none border border-indigo-500/10" : "bg-zinc-800/50 text-zinc-300 rounded-tl-none border border-zinc-800"
                                  }`}>
                                    <Markdown>{msg.content}</Markdown>
                                  </div>
                                </motion.div>
                              ))}
                            </motion.div>
                          )}
                          {isChatLoading && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-4">
                              <div className="p-2.5 rounded-xl bg-zinc-800 text-zinc-400">
                                <Loader2 className="w-4 h-4 animate-spin" />
                              </div>
                              <div className="bg-zinc-800/30 px-6 py-4 rounded-3xl rounded-tl-none border border-zinc-800 animate-pulse">
                                <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">Generowanie odpowiedzi...</span>
                              </div>
                            </motion.div>
                          )}
                          <div ref={chatEndRef} />
                        </div>

                        {/* Chat Input Area */}
                        <div className="p-8 border-t border-zinc-800 bg-zinc-900/10">
                          <form onSubmit={handleChatSubmit} className="relative">
                            <input
                              type="text"
                              value={currentChatQuestion}
                              onChange={(e) => setCurrentChatQuestion(e.target.value)}
                              placeholder="Zadaj pytanie dotyczące tej umowy..."
                              disabled={isChatLoading}
                              className="w-full bg-zinc-800/50 border border-zinc-800 rounded-2xl py-4 pl-6 pr-16 text-white text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-zinc-600"
                            />
                            <button
                              type="submit"
                              disabled={!currentChatQuestion.trim() || isChatLoading}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl transition-all shadow-lg active:scale-95"
                            >
                              <Send className="w-5 h-5" />
                            </button>
                          </form>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Comparison Item */}
                  <AnimatePresence>
                    {comparisonItem && (
                      <motion.div
                        key="comparison"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        layout
                        className="bg-zinc-900/20 backdrop-blur-3xl border border-zinc-800/80 rounded-[3.5rem] overflow-hidden shadow-2xl relative scroll-mt-24"
                      >
                        <button 
                          onClick={() => setComparisonItem(null)}
                          className="absolute top-8 right-8 z-10 p-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white rounded-2xl transition-all border border-zinc-800"
                        >
                          <X className="w-5 h-5" />
                        </button>
                        
                        <div className="p-10 md:p-14">
                          <div className="prose-report">
                            <div className="mb-8 p-3 bg-zinc-800 border border-zinc-700 rounded-2xl text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">
                              Porównanie: {comparisonItem.title}
                            </div>
                            <div className="prose prose-invert prose-indigo max-w-none 
                              prose-headings:font-black prose-headings:tracking-tighter prose-headings:text-white 
                              prose-p:text-zinc-500 prose-p:leading-relaxed prose-p:text-base prose-p:font-normal
                              prose-li:text-zinc-500 prose-li:marker:text-zinc-700 prose-li:font-medium
                              prose-hr:border-zinc-800/80 prose-blockquote:border-l-zinc-700 prose-blockquote:bg-zinc-800/5 prose-blockquote:p-6 prose-blockquote:rounded-3xl prose-blockquote:italic">
                              <Markdown
                                components={{
                                  h4: ({ children }) => {
                                    const title = children?.toString() || "";
                                    let icon = <FileText className="w-4 h-4" />;
                                    let colorClass = "text-zinc-500 bg-zinc-800 border-zinc-700";
                                    
                                    if (title.includes("CZERWONE")) icon = <AlertCircle className="w-4 h-4" />;
                                    else if (title.includes("ZOBOWIĄZANIA")) icon = <Wallet className="w-4 h-4" />;
                                    else if (title.includes("TERMINY")) icon = <Calendar className="w-4 h-4" />;
                                    else if (title.includes("WSKAZÓWKA")) icon = <Lightbulb className="w-4 h-4" />;

                                    return (
                                      <div className="flex items-center gap-3 mt-10 mb-6 first:mt-0 group">
                                        <div className={`p-2.5 rounded-xl border transition-all duration-500 group-hover:scale-110 ${colorClass}`}>
                                          {icon}
                                        </div>
                                        <h4 className="m-0 text-lg font-black uppercase tracking-tighter">{children}</h4>
                                      </div>
                                    );
                                  },
                                  hr: () => <hr className="my-10 border-zinc-900" />,
                                  p: ({ children }) => <p className="mb-6 last:mb-0 leading-relaxed">{children}</p>,
                                  li: ({ children }) => <li className="mb-4 last:mb-0 pl-1">{children}</li>
                                }}
                              >
                                {comparisonItem.content}
                              </Markdown>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </AnimatePresence>
        </section>

        {/* Footer / Social Proof */}
        <footer className="w-full max-w-7xl mx-auto px-6 py-32 border-t border-zinc-800/50">
          <div className="flex flex-col lg:flex-row justify-between items-start gap-16">
            <div className="flex flex-col items-center lg:items-start gap-6 max-w-sm w-full">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                  <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <span className="font-black text-2xl tracking-tighter">LegalCheck AI</span>
              </div>
              <p className="text-zinc-500 text-sm font-medium text-center lg:text-left leading-[1.6]">
                Najbardziej zaawansowana analiza dokumentów wspierana przez sztuczną inteligencję. 
                Nasze systemy codziennie chronią interesy setek użytkowników.
                <span className="block mt-4 text-[10px] uppercase tracking-widest text-zinc-600 font-black">Pamiętaj: Narzędzie służy do wsparcia, nie jest poradą prawną.</span>
              </p>
            </div>

            <div className="flex flex-col items-center lg:items-end gap-8 w-full lg:w-auto">
              <div className="bg-zinc-800/10 backdrop-blur-xl rounded-[2.5rem] p-8 border border-zinc-700/20 flex flex-col items-center lg:items-end gap-6 shadow-2xl">
                <div className="text-center lg:text-right">
                  <p className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-4">
                    Zaufało nam <span className="text-indigo-400">500+ użytkowników</span>
                  </p>
                  <div className="flex flex-row-reverse justify-center lg:justify-start items-center -space-x-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i} className="relative group transition-transform hover:-translate-y-1">
                        <img 
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=user${i + 22}`} 
                          className="w-12 h-12 rounded-full border-2 border-zinc-900 bg-zinc-800 object-cover shadow-xl" 
                          alt="User"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="h-px w-full bg-zinc-800/50" />

                <button 
                  onClick={() => setIsSubModalOpen(true)}
                  className="w-full lg:w-auto px-8 py-5 bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-yellow-500/10 hover:scale-[1.03] active:scale-95 transition-all flex items-center justify-center gap-3 animate-pulse-gentle"
                >
                  <Sparkles className="w-4 h-4" />
                  💎 Odblokuj pełną analizę PRO
                </button>
              </div>
            </div>
          </div>

          <div className="mt-24 pt-8 border-t border-zinc-800/30 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-[0.4em]">
              &copy; 2026 LEGALCHECK AI &bull; BEZPIECZEŃSTWO PRZEDE WSZYSTKIM
            </p>
            <div className="flex items-center gap-6">
              <span className="text-[9px] text-zinc-700 font-black uppercase tracking-widest">Wersja 2.4.0</span>
              <span className="text-[9px] text-zinc-700 font-black uppercase tracking-widest">KOD SZYFROWANY AES-256</span>
            </div>
          </div>
        </footer>

        {/* Full-Screen Payment Overlay (Production Style) */}
        <AnimatePresence>
          {showPaymentOverlay && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/90 backdrop-blur-2xl"
            >
              <div className="flex flex-col items-center gap-10 text-center px-6">
                <div className="relative">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="w-32 h-32 bg-indigo-600/10 rounded-[3rem] border border-indigo-500/20 flex items-center justify-center relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-indigo-500/5 animate-pulse" />
                    <CreditCard className="w-14 h-14 text-indigo-500 relative z-10" />
                  </motion.div>
                  
                  {/* Outer spinning ring */}
                  <div className="absolute -inset-4 border-2 border-indigo-500/10 rounded-[4rem] animate-[spin_8s_linear_infinite]" />
                  <div className="absolute -inset-4 border-t-2 border-indigo-500 rounded-[4rem] animate-[spin_2s_linear_infinite]" />
                </div>

                  <div className="space-y-4 max-w-sm">
                  <motion.h2 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-2xl font-black text-white tracking-tight"
                  >
                    {isPro ? "Płatność Zatwierdzona" : "Inicjowanie bezpiecznej płatności..."}
                  </motion.h2>
                  <motion.p 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] leading-relaxed"
                  >
                    {isPro 
                      ? "Synchronizacja Twojej licencji PRO z serwerami Google" 
                      : "Łączenie z Google Play Billing Engine & Stripe Secure Gateway"}
                  </motion.p>
                </div>

                <div className="flex items-center gap-4 py-4 px-8 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-green-500" />
                    <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">Szyfrowanie AES-256</span>
                  </div>
                  <div className="w-px h-4 bg-zinc-800" />
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-400" />
                    <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">PCI-DSS Compliant</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    
      {/* Subscription Modal */}
      <AnimatePresence>
        {isSubModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSubModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col md:flex-row"
            >
              {/* Pro Plan Column */}
              <div className="flex-1 p-8 md:p-12 relative overflow-hidden bg-gradient-to-br from-zinc-900 to-indigo-950/30">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -mr-32 -mt-32" />
                
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-6">
                    <Bot className="w-3 h-3" />
                    Wybierz przyszłość
                  </div>
                  
                  <h2 className="text-4xl font-black text-white mb-6 tracking-tight">Gotowy na PRO?</h2>
                  
                  <ul className="space-y-4 mb-8">
                    {[
                      { icon: Zap, text: "Nielimitowane analizy dokumentów" },
                      { icon: MessageSquare, text: "Inteligentny czat z dokumentem" },
                      { icon: FileText, text: "Eksport raportów do PDF" },
                      { icon: History, text: "Nielimitowana historia w chmurze" },
                      { icon: Sparkles, text: "Dostęp do modelu Ultra Precision" }
                    ].map((benefit, i) => (
                      <li key={i} className="flex items-center gap-3 text-zinc-300">
                        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                          <benefit.icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium">{benefit.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Pricing Column */}
              <div className="w-full md:w-72 bg-zinc-800/30 p-8 flex flex-col justify-center border-t md:border-t-0 md:border-l border-zinc-800">
                <div className="text-center mb-8">
                  <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-2">Płatność miesięczna</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-black text-white">29</span>
                    <span className="text-xl font-black text-zinc-400">PLN</span>
                  </div>
                </div>

               <button 
                  onClick={handlePurchaseSuccess}
                  disabled={isProcessingPayment}
                  className="w-full py-4 bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 disabled:from-zinc-700 disabled:to-zinc-800 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-yellow-500/20 hover:scale-[1.02] active:scale-95 transition-all mb-4 relative overflow-hidden group min-h-[60px] flex items-center justify-center"
                >
                  {isProcessingPayment ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-[9px]">Google Play...</span>
                    </div>
                  ) : (
                    <>
                      <span className="relative z-10">AKTYWUJ PRO</span>
                      <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12" />
                    </>
                  )}
                </button>
                
                <p className="text-[10px] text-zinc-600 text-center font-bold px-4">
                  Brak ukrytych kosztów. Możesz zrezygnować w dowolnym momencie.
                </p>

                <button 
                  onClick={() => setIsSubModalOpen(false)}
                  className="mt-6 text-zinc-500 hover:text-white text-xs font-black uppercase tracking-widest transition-colors"
                >
                  Może później
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-4 px-6 py-4 bg-zinc-900 border border-indigo-500/30 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl"
        >
          <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <p className="text-sm font-black text-white pr-4">{toast.message}</p>
          <button onClick={() => setToast(null)} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
  );
}

