"use client";



import React, { useEffect, useMemo, useRef, useState } from "react";
import { JSX } from 'react/jsx-runtime';
import { motion } from "framer-motion";
import { Mic, Send, Sparkles, Star, Volume2, Share2 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import domtoimage from "dom-to-image";
import Confetti from "react-confetti";
import { useWindowSize } from "react-use"; // to fit screen size
import FingerprintJS from "@fingerprintjs/fingerprintjs";



/* =========================================================
   TYPES
========================================================= */
type PageView = "chat" | "premium";

interface Option {
  label: string;
  emoji: string;
  pros: string[];
  cons: string[];
  likelihood: number; // 0-100
}

interface DecisionResult {
  title: string;
  summary: string;
  recommendation: string;
  options: Option[];
  hidden_viewpoints?: string[];
}

interface ChatTurn {
  role: "user" | "ai";
  content: string;
}

interface SpeechRecognitionEventMinimal {
  results: { [k: number]: { [k: number]: { transcript: string } } } & {
    length: number;
  };
}
interface SpeechRecognitionMinimal {
  lang: string;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventMinimal) => void) | null;
  onend: (() => void) | null;
}
type SRConstructor = new () => SpeechRecognitionMinimal;

interface Template {
  name: string;
  prompt: string;
}

const getDeviceId = async () => {
  const fp = await FingerprintJS.load();
  const result = await fp.get();
  return result.visitorId;
};



/* =========================================================
   HELPERS
========================================================= */
const safeJSON = (raw: string): DecisionResult | null => {
  try {
    return JSON.parse(raw) as DecisionResult;
  } catch {
    const a = raw.indexOf("{");
    const b = raw.lastIndexOf("}");
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(raw.slice(a, b + 1)) as DecisionResult;
      } catch {
        return null;
      }
    }
    return null;
  }
};

const buildPrompt = (
  pro: boolean,
  text: string,
  profile: { name: string; age: string }
): string =>
  `You are a concise decision-making oracle. Return ONLY JSON with keys:
title, summary, recommendation, options:[{label,emoji,pros,cons,likelihood(0-100)}]${
    pro ? ", hidden_viewpoints:[]" : ""
  }.
Keep language simple and helpful.
User context: ${profile.name} (${profile.age} years old)
Question: ${text}`;





/* --------- put this ONCE above the Page component --------- */
interface UserProfile {
  name: string;
  age: string;
}

const OnboardingForm = ({
  userProfile,
  setUserProfile,
  setShowOnboarding,
}: {
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  setShowOnboarding: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  return (
    <div className="w-full max-w-medium rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 p-6 shadow-lg">
      <h2 className="text-xl font-bold mb-4 text-slate-800 text-white"><Sparkles className="w-5 h-5" /> Tell us about yourself </h2>

      <label className="block mb-1 text-medium font-medium text-slate-700 text-white">Name</label>
      <input
        autoFocus
        type="text"
        className="w-full rounded-full px-4 py-2 mb-3 border border-slate-300 text-slate-800 text-white placeholder-slate-500"
        placeholder="Charlie"
        value={userProfile.name}
        onChange={(e) => setUserProfile((p) => ({ ...p, name: e.target.value }))}
      />

      <label className="block mb-1 text-medium font-medium text-slate-700 text-white">Age</label>
      <input
        type="number"
        className="w-full rounded-full px-4 py-2 mb-4 border border-slate-300 text-slate-800 text-white placeholder-slate-500"
        placeholder="25"
        value={userProfile.age}
        onChange={(e) => setUserProfile((p) => ({ ...p, age: e.target.value }))}
      />

      <button
        onClick={() => {
          if (userProfile.name.trim() && userProfile.age.trim()) {
            setShowOnboarding(false);
          }
        }}
        className="w-full rounded-full bg-white text-black py-2 font-semibold cursor-pointer"
      >
        Continue
      </button>
    </div>
  );
};





/* =========================================================
   MAIN COMPONENT
========================================================= */
export default function Page(): JSX.Element {
  const [page, setPage] = useState<PageView>("chat");
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [language, setLanguage] = useState<string>("en");
const [requestSent, setRequestSent] = useState(false);
const [responseGenerated, setResponseGenerated] = useState(false);
const [showingResult, setShowingResult] = useState(false);
const [error, setError] = useState<string | null>(null);
const [showContact, setShowContact] = useState(false);


const [mounted, setMounted] = useState(false);

useEffect(() => {
  const expiry = localStorage.getItem("premiumExpiry");
  if (expiry && new Date(expiry) > new Date()) {
    setIsPremium(true);
  } else {
    setIsPremium(false);
    localStorage.removeItem("premium");
    localStorage.removeItem("premiumExpiry");
  }
}, []);

const [showConfetti, setShowConfetti] = useState(false);



const { width, height } = useWindowSize();

{showConfetti && <Confetti width={width} height={height} />}




  /* ---- onboarding ---- */
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [userProfile, setUserProfile] = useState({ name: "", age: "" });

  /* ---- for dom-to-image ---- */
  const resultRef = useRef<HTMLDivElement>(null);

  /* ---- free daily counter ---- */
  const [freeCount, setFreeCount] = useState<number>(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const today = new Date().toISOString().slice(0, 10);
//     const key = "lifetime-free-count";
// const current = Number.parseInt(localStorage.getItem(key) ?? "0", 10) || 0;
const key = `free-${new Date().toISOString().slice(0, 10)}`;
const current = Number(localStorage.getItem(key) ?? 0);
setFreeCount(current);
  }, []);

  

  /* ---- speech ---- */
  const recRef = useRef<SpeechRecognitionMinimal | null>(null);
  const [listening, setListening] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      webkitSpeechRecognition?: SRConstructor;
      SpeechRecognition?: SRConstructor;
    };
    const SR = w.webkitSpeechRecognition ?? w.SpeechRecognition;
    if (SR) {
      const r = new SR();
      r.lang = language;
      r.interimResults = false;
      r.onresult = (e) => {
        const out: string[] = [];
        for (let i = 0; i < e.results.length; i++) {
          const seg = e.results[i][0]?.transcript ?? "";
          if (seg) out.push(seg);
        }
        setInput((prev) => (prev ? prev + " " : "") + out.join(" "));
      };
      r.onend = () => setListening(false);
      recRef.current = r;
    }
  }, [language]);

  const startMic = () => {
    if (recRef.current) {
      setListening(true);
      recRef.current.start();
    }
  };
  const stopMic = () => recRef.current?.stop();

  const speakOut = () => {
    if (!result || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(
      `${result.title}. ${result.summary}. Recommendation: ${result.recommendation}`
    );
    u.lang = language;
    window.speechSynthesis.speak(u);
  };

  /* ---- share ---- */
  const handleShare = async () => {
    if (!resultRef.current) return;
    try {
      const dataUrl = await domtoimage.toPng(resultRef.current, { bgcolor: "#ffffff" });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "decision-result.png";
      link.click();
    } catch (e) {
      console.error("Share failed:", e);
    }
  };

const handleActivatePremium = async () => {
  const code = prompt("Enter your premium code:");
  if (!code) return;

  const res = await fetch("/api/verifycode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  const data = await res.json();
  if (data.success) {
    console.log("Verify response:", data);

    localStorage.setItem("premium", "true");
    localStorage.setItem("premiumExpiry", data.expiry);
    setIsPremium(true);
    setShowConfetti(true);
  setTimeout(() => setShowConfetti(false), 5000); // stop after 5 seconds
  alert("✅ Premium Activated! Valid until " + new Date(data.expiry).toLocaleDateString());
      if (!isPremium) bumpFree();


  } else {
    alert("❌ Invalid code");
  }
};
  const bumpFree = () => {
    // const key = "lifetime-free-count";
const n = freeCount + 1;
setFreeCount(n);
  // unique key per day (ex: free-2025-08-19)
  const key = `free-${new Date().toISOString().slice(0, 10)}`;

  // save updated count
  localStorage.setItem(key, String(n));
  };


const translateText = async (text: string, targetLang: string): Promise<string> => {
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `Translate to ${targetLang}: ${text}`,
        isPremium: false,
        userProfile,
      }),
    });
    const data = await res.json();
    return (
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      text
    );
  } catch {
    return text;
  }
};


{isPremium && showConfetti && (
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="bg-white shadow-lg rounded-2xl p-6 text-center animate-bounce">
      <h2 className="text-2xl font-bold text-green-600">🌟 Premium Activated!</h2>
      <p className="mt-2 text-gray-700">
        Valid until {new Date(localStorage.getItem("premiumExpiry") || "").toLocaleDateString()}
      </p>
    </div>
  </div>
)}





  /* ---- templates ---- */
  const COLORS = useMemo<string[]>(
    () => ["#22d3ee", "#60a5fa", "#34d399", "#fbbf24", "#a78bfa"],
    []
  );
  const templates: Template[] = [
    { name: "Career", prompt: "Should I switch jobs or stay in my current role?" },
    { name: "Relationships", prompt: "How should I approach a conflict with a close friend?" },
    { name: "Investing", prompt: "Should I invest in stocks, bonds, or real estate?" },
  ];

  


const handleSend = async (): Promise<void> => {
  if (!input.trim() || loading) return;
  const deviceId = await getDeviceId(); // 👈 get unique device ID

  if (!isPremium && freeCount >= 2) {
    setResult({
      title: "⚠️ Daily Limit Reached",
      summary: "You have used your 2 free tries for today.",
      recommendation: "Upgrade to Premium / Buy a Coffee for me 🚀 for unlimited decisions.",
      options: [],
    });
    return;
  }

  if (!isPremium) {
    const today = new Date().toISOString().slice(0, 10);
    const key = `free-${today}`;
    const current = Number(localStorage.getItem(key) ?? 0);
    localStorage.setItem(key, String(current + 1));
    setFreeCount(current + 1);
  }


  setLoading(true);
  setResult(null);
  setHistory((h) => [...h, { role: "user", content: input }]);

  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: input,
        isPremium,
        userProfile,
              deviceId, // 👈 send to backend

      }),
    });

    const data = await res.json();
if (data.error) {
  console.error("API error:", data.error, data.details || "");
}

    console.log("RAW RESPONSE", data);

    const raw =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      JSON.stringify(data);

    let parsed = safeJSON(raw);
    // if (!parsed) throw new Error("Invalid JSON");

    // setResult(parsed);
    if (!parsed) {
  parsed = {
    title: "AI Response",
    summary: raw,
    recommendation: raw,
    options: [
      { label: "Option A", emoji: "💡", likelihood: 50, pros: [], cons: [] }
    ]
  };
}
setResult(parsed);




    setHistory((h) => [...h, { role: "ai", content: parsed.recommendation }]);
  } catch (err) {
    console.error("API error:", err);
    setResult({
      title: "Error",
      summary: "Something went wrong.",
      recommendation: "Check logs or keys.",
      options: [],
    });
  } finally {
    setLoading(false);
    setInput("");
  }
};



















  /* ---- chart helper ---- */
  const chartData = (result?.options ?? []).map((o) => ({
    name: `${o.emoji} ${o.label}`,
    value: Math.max(0, Math.min(100, Number(o.likelihood) || 0)),
  }));



  /* =========================================================
     RENDER
  ========================================================= */
  return (



    
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 md:p-8 relative overflow-hidden"
      
      style={{
        background:
          "linear-gradient(180deg, #7dd3fc 0%, #3b82f6 40%, #1e3a8a 70%, #7dd3fc 100%)",
      }}
    >
      {isPremium && (
  <div className="absolute top-10 right-10 bg-cyan-700 text-white font-bold px-3 py-1 rounded-full shadow-lg">
    🌟 Premium 🎊🎗️
  </div>
)}

      {/* subtle star field */}
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <svg width="100%" height="100%">
          {Array.from({ length: 24 }).map((_, i) => (
            <circle
              key={i}
              cx={`${(i * 37) % 100}%`}
              cy={`${(i * 53) % 100}%`}
              r="1.5"
              fill="#ffffff"
            />
          ))}
        </svg>
      </div>

      <div className="w-full max-w-3xl">
        {showOnboarding ? (
  <div className="flex justify-center items-center min-h-screen w-full">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg"
    >
      <OnboardingForm
        userProfile={userProfile}
        setUserProfile={setUserProfile}
        setShowOnboarding={setShowOnboarding}
      />
    </motion.div>
  </div>
        ) : (
          <>
            {/* Header */}


        




            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl px-6 py-4 mb-6 bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl"
            >
              <h1 className="text-center text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white bg-clip-text bg-gradient-to-r from-cyan-200 to-blue-300 flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5" /> Decision Maker Helper {" "}
                <Sparkles className="w-5 h-5" />
              </h1>
            </motion.div>

            {/* Language Selector */}
            <div className="mb-4 flex flex-wrap gap-2">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="rounded-full px-4 py-2 bg-white/90 text-slate-800 shadow"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>
       {/* Templates */}
            <div className="mb-4 flex flex-wrap gap-2">
              {templates.map((t) => (
                <button
                  key={t.name}
                  onClick={() => setInput(t.prompt)}
                  className="rounded-full px-4 py-2 text-sm bg-white/90 text-slate-800 hover:bg-white shadow"
                >
                  {t.name}
                </button>
              ))}
             
            </div>
 
                
     
            {/* Input Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[28px] p-4 sm:p-5 bg-gradient-to-r from-cyan-300 via-cyan-350 to-blue-700 shadow-xl border-y-3 border-white"
            >
              <div className="flex items-center gap-3 bg-white rounded-full px-4 py-3 shadow">
                <input
                  className="flex-1 bg-transparent outline-none text-slate-700 placeholder-slate-400 text-sm sm:text-base"
                  placeholder="Type your confusion here..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                />
                <button
                  onClick={handleSend}
                  disabled={loading}
                  className="shrink-0 rounded-full p-3 bg-blue-600 hover:bg-blue-700 text-white transition shadow"
                  aria-label="Send"
                  title="Send"
                >
                  {loading ? "…" : <Send className="w-4 h-4" />}
                </button>
              </div>
              {!isPremium && (
  <p className="text-sm text-white-100 text-center mt-2">
    Free tries left today: {Math.max(0, 2 - freeCount)} / 2
  </p>
)}



              {/* Voice + Upgrade Row */}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  onClick={listening ? stopMic : startMic}
                  className={`rounded-full px-4 py-2 text-sm flex items-center gap-2 shadow transition ${
                    listening
                      ? "bg-rose-500 text-white"
                      : "bg-white/90 text-slate-800 hover:bg-white"
                  }`}
                >
                  Voice {listening ? "(listening)" : ""}{" "}
                  <Mic className="w-4 h-4" />
                </button>

                <button
                  onClick={speakOut}
                  className="rounded-full px-4 py-2 text-sm bg-white/90 text-slate-800 hover:bg-white shadow flex items-center gap-2"
                >
                  <Volume2 className="w-4 h-4" /> Speak
                </button>

                <div className="ml-auto" />
                <button
                  onClick={() => setPage("premium")}
                  className="rounded-2xl px-4 py-2 text-sm font-semibold cursor-pointer bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow hover:scale-[1.02] transition flex items-center gap-2"
                >
                  <Star className="w-3 h-4"  />  Buy a coffee🍵...
                </button>
              

              </div>

                <button
  onClick={handleActivatePremium}
  className="w-full mt-3  bg-white-500 cursor-pointer hover:bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-bold rounded-2xl"
>
  Already Bought..? Activate Premium
</button>
            </motion.div>

            {result && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 max-h-[999999vh] overflow-y-auto rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 shadow-lg"
                
                style={{
                  backgroundColor: "#ffffff",
                  position: "relative",
                  zIndex: 10,
                  overflow: "visible",
                }}
                ref={resultRef}
              >
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-xl sm:text-2xl font-semibold text-[#1e293b]">
                    {result.title || "Insights"}
                  </h2>
                  <button
                    onClick={handleShare}
                    className="rounded-full p-2 bg-[#e0f7fa] text-[#155e75] hover:bg-[#b2ebf2] border border-[#a5f3fc]"
                    title="Share Result"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-[#374151] mb-3 text-base sm:text-lg">{result.summary}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(result.options ?? []).map((o, i) => (
                    <div
                      key={`${o.label}-${i}`}
                      className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{o.emoji}</span>
                        <span className="font-semibold text-[#1e293b]">{o.label}</span>
                        <span className="ml-auto text-sm px-2 py-0.5 rounded-full bg-[#e0f7fa] text-[#155e75]">
                          {o.likelihood}%
                        </span>
                      </div>
                      {o.pros?.length > 0 && (
                        <div className="text-sm text-[#047857] mt-2">
                          ✅ {o.pros.join(", ")}
                        </div>
                      )}
                      {o.cons?.length > 0 && (
                        <div className="text-sm text-[#be123c] mt-1">
                          ⚠️ {o.cons.join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {chartData.length > 0 && (
    <div className="mt-4 rounded-2xl bg-[#f1f5f9] border-2 border-[#e2e8f0] p-3" style={{ position: 'relative', zIndex: 11 }}>
      <p className="text-[#374151] text-sm mb-2">
        📊 Likelihood of each path
      </p>
      <div className="h-48 sm:h-64" style={{ position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              outerRadius={78}
              label
              style={{ fontSize: '24px', color: '#1e293b' }}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#374151' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )}


                <div className="mt-4 rounded-2xl bg-[#ecfeff] border border-[#a5f3fc] p-3 text-[#155e75]">
                  <span className="font-semibold">🧭 Recommendation:</span>{" "}
                  {result.recommendation}
                </div>

                {isPremium && (result.hidden_viewpoints?.length ?? 0) > 0 && (
                  <div className="mt-3 rounded-2xl bg-[#eef2ff] border border-[#c7d2fe] p-3 text-[#4f46e5]">
                    <p className="font-semibold mb-1">🛰️ Hidden viewpoints</p>
                    <ul className="list-disc ml-5 text-sm">
                      {result.hidden_viewpoints!.map((h, i) => (
                        <li key={`${h}-${i}`}>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}

            {/* Premium Page */}
            {page === "premium" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl p-6 text-white shadow-2xl"
              >
                <h3 className="text-xl sm:text-2xl font-bold mb-2">🌟 Go Premium</h3>
                <p className="text-cyan-100/90 mb-4 text-sm sm:text-base">
                  Unlimited decisions powered by OpenAI, richer likelihood charts, and exclusive
                  hidden viewpoints.
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
                  <li className="rounded-2xl bg-white/10 p-3">✅ Unlimited insights & No waiting / Queue</li>
                  <li className="rounded-2xl bg-white/10 p-3">🛰️ Hidden viewpoints &personalized suggestions</li>
                  <li className="rounded-2xl bg-white/10 p-3">📊 Detailed outcome charts</li>
                  <li className="rounded-2xl bg-white/10 p-3">🗣️ Voice playback</li>
                </ul>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setShowContact(true)}
                    className="rounded-full px-2 py-2 bg-gradient-to-r from-indigo-500 to-fuchsia-500 font-semibold shadow"
                  >
                    Contact to Upgrade
                  </button>
                  <button
                    onClick={() => {
                      setIsPremium(true);
                      setPage("chat");
                    }}
                    className="rounded-full px-5 py-3 bg-gradient-to-r from-indigo-500 to-fuchsia-500 font-semibold shadow"
                  >
                    Back
                  </button>



                  
                  {/* <button
                    onClick={() => setPage("chat")}
                    className="rounded-full px-5 py-3 bg-white/20"
                  >
                    Back
                  </button> */}
                    {/* <button
  onClick={() => setShowContact(true)}
  className="rounded-full px-5 py-3 bg-gradient-to-r from-indigo-500 to-fuchsia-500 font-semibold shadow"
>
  Contact to Upgrade
</button> */}

{showContact && (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="mt-4 rounded-2xl bg-black/20 backdrop-blur p-4 text-center"
  >
    <p className="text-white mb-2">Reach me via:</p>
    <a href="mailto:neurogenix187@gmail.com" className="text-white-300 underline">neurogenix187@gmail.com</a>
    <br />
    <a href="https://www.instagram.com/learnhustlelife/" className="text-white-300 underline">Instagram</a>
    <button
      onClick={() => setShowContact(false)}
      className="ml-3 text-xs underline"
    >
      Close
    </button>
  </motion.div>
)}



                </div>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Razorpay Script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />
    </div>
  );
}