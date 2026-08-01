"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Wallet, Mail, Lock, ArrowRight, Loader2, MessageCircle, KeyRound } from "lucide-react";

const WHATSAPP_NUMBER = "5561982897007";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === "Failed to fetch") {
    return "Nao foi possivel conectar ao Supabase. Confira a URL e a chave publica nas variaveis de ambiente.";
  }
  return error instanceof Error ? error.message : "Algo deu errado. Tente novamente.";
}

const C = {
  bg: "#F4F1EA",
  surface: "#FFFFFF",
  surface2: "#F3F1EC",
  border: "#E4E0D8",
  text: "#14161A",
  textSoft: "#6B7280",
  textFaint: "#9AA1AC",
  accent: "#4F46E5",
  accentSoft: "rgba(79,70,229,0.10)",
  expense: "#D64545",
};

export default function LoginPage({ initialMode = "login" }: { initialMode?: "login" | "signup" }) {
  const [mode] = useState<"login" | "signup">(initialMode);
  const [signupStep, setSignupStep] = useState<"code" | "account">("code");
  const [code, setCode] = useState("");
  const [validatedCode, setValidatedCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap";
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  function whatsappHref() {
    const message = encodeURIComponent("Ola! Quero comprar o acesso vitalicio ao Grana.");
    return "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + message;
  }

  async function validateCode() {
    setError("");
    if (!code.trim()) {
      setError("Informe o codigo de acesso.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/access/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Codigo invalido.");
      setValidatedCode(json.code || code.trim().toUpperCase());
      setSignupStep("account");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  const submit = async () => {
    setError("");

    if (mode === "signup" && signupStep === "code") {
      await validateCode();
      return;
    }

    if (!email || !password) {
      setError("Informe e-mail e senha.");
      return;
    }

    setLoading(true);
    const supabase = supabaseBrowser();
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        const userId = data.user?.id;
        if (!userId) throw new Error("Nao foi possivel identificar o usuario criado.");

        const res = await fetch("/api/access/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, code: validatedCode }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Nao foi possivel ativar o acesso.");
        window.location.replace("/dashboard");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.replace("/dashboard");
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submit();
  };

  const showCode = mode === "signup" && signupStep === "code";
  const showCredentials = mode === "login" || signupStep === "account";

  return (
    <div style={{
      position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Manrope', sans-serif", padding: 20, overflow: "hidden", background: C.bg,
    }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "url('/images/money-bg.jpg')", backgroundSize: "cover", backgroundPosition: "center", zIndex: 0 }} />
      <div style={{ position: "absolute", inset: 0, background: "rgba(244,241,234,0.84)", zIndex: 1 }} />

      <div style={{ position: "relative", zIndex: 2, width: 400, maxWidth: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, boxShadow: "0 10px 24px rgba(79,70,229,0.18)" }}>
            <Wallet size={26} color="#fff" />
          </div>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 24, color: C.text, letterSpacing: 0 }}>Grana</div>
          <div style={{ fontSize: 13, color: C.textSoft, marginTop: 4 }}>Seu controle financeiro, sem complicacao</div>
        </div>

        <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 18, padding: 30, boxShadow: "0 20px 50px rgba(55,48,38,0.10)" }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 22, background: C.surface2, borderRadius: 11, padding: 4 }}>
            <button
              type="button"
              onClick={() => { if (mode !== "login") window.location.href = "/login"; }}
              style={tabStyle(mode === "login")}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => { if (mode !== "signup") window.location.href = "/cadastro"; }}
              style={tabStyle(mode === "signup")}
            >
              Criar conta
            </button>
          </div>

          {showCode && (
            <>
              <label style={labelStyle}><KeyRound size={13} /> Codigo de acesso</label>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={onKeyDown} placeholder="GRANA-XXXX-XXXX" style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace" }} autoFocus />
              <p style={{ fontSize: 11.5, color: C.textFaint, marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>Valide o codigo para liberar os campos de e-mail e senha.</p>
            </>
          )}

          {showCredentials && (
            <>
              {mode === "signup" && <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 9, background: C.accentSoft, color: C.accent, fontSize: 12.5, fontWeight: 700 }}>Codigo validado. Agora crie seu login.</div>}
              <label style={labelStyle}><Mail size={13} /> E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onKeyDown} placeholder="voce@email.com" style={inputStyle} autoFocus={mode === "login"} />

              <label style={{ ...labelStyle, marginTop: 14 }}><Lock size={13} /> Senha</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onKeyDown} placeholder="********" style={inputStyle} />
            </>
          )}

          {error && <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: "#D6454514", border: "1px solid " + C.expense + "33", color: C.expense, fontSize: 12.5 }}>{error}</div>}

          <button onClick={submit} disabled={loading} style={{ width: "100%", marginTop: 20, padding: "12px 0", borderRadius: 10, border: "none", background: loading ? C.textFaint : C.accent, color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Manrope', sans-serif", cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.15s ease" }}>
            {loading ? <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : <>{showCode ? "Validar codigo" : mode === "signup" ? "Criar conta" : "Entrar"} <ArrowRight size={15} /></>}
          </button>

          {mode === "signup" && signupStep === "account" && <button type="button" onClick={() => { setSignupStep("code"); setValidatedCode(""); setError(""); }} style={{ marginTop: 10, width: "100%", border: "none", background: "transparent", color: C.textSoft, fontSize: 12.5, cursor: "pointer", fontFamily: "'Manrope', sans-serif" }}>Usar outro codigo</button>}
        </div>

        <a href={whatsappHref()} style={{ marginTop: 16, width: "100%", minHeight: 42, borderRadius: 10, border: "1px solid " + C.border, background: C.surface, color: C.text, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13, fontWeight: 700, fontFamily: "'Manrope', sans-serif", cursor: "pointer", boxShadow: "0 8px 22px rgba(55,48,38,0.06)", textDecoration: "none", boxSizing: "border-box" }}>
          <MessageCircle size={16} color={C.accent} /> Comprar acesso pelo WhatsApp
        </a>

        <p style={{ textAlign: "center", fontSize: 11.5, color: C.textFaint, marginTop: 16 }}>Seus dados ficam salvos de forma privada, so voce tem acesso.</p>
      </div>

      <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
    </div>
  );
}

function tabStyle(active: boolean): CSSProperties {
  return {
    flex: 1,
    padding: "9px 0",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontSize: 13.5,
    fontWeight: 600,
    fontFamily: "'Manrope', sans-serif",
    background: active ? C.surface : "transparent",
    color: active ? C.accent : C.textSoft,
    boxShadow: active ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
    transition: "all 0.15s ease",
  };
}

const labelStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
  color: "#6B7280", marginBottom: 6,
};
const inputStyle: CSSProperties = {
  width: "100%", padding: "11px 13px", borderRadius: 9, border: "1px solid #E4E0D8",
  fontSize: 14, fontFamily: "'Manrope', sans-serif", background: "#F9FAFB", color: "#14161A",
  outline: "none", boxSizing: "border-box",
};

