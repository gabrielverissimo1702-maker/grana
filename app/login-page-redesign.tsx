"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Wallet, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === "Failed to fetch") {
    return "Não foi possível conectar ao Supabase. Confira a URL e a chave pública nas variáveis de ambiente.";
  }
  return error instanceof Error ? error.message : "Algo deu errado. Tente novamente.";
}

const C = {
  bg: "#FAFAFA",
  surface: "#FFFFFF",
  surface2: "#F3F4F6",
  border: "#E6E8EC",
  text: "#14161A",
  textSoft: "#6B7280",
  textFaint: "#9AA1AC",
  accent: "#4F46E5",
  accentSoft: "rgba(79,70,229,0.10)",
  expense: "#D64545",
};

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Manrope:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  const submit = async () => {
    setError("");
    setLoading(true);
    const supabase = supabaseBrowser();
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        router.push("/ativar");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
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

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Manrope', sans-serif", background: `radial-gradient(circle at 20% 15%, ${C.accentSoft} 0%, ${C.bg} 45%)`,
      padding: 20,
    }}>
      <div style={{ width: 400, maxWidth: "100%" }}>
        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg, ${C.accent}, #6D63F0)`,
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
            boxShadow: `0 8px 20px ${C.accentSoft}`,
          }}>
            <Wallet size={26} color="#fff" />
          </div>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 24, color: C.text, letterSpacing: "-0.01em" }}>Grana</div>
          <div style={{ fontSize: 13, color: C.textSoft, marginTop: 4 }}>Seu controle financeiro, sem complicação</div>
        </div>

        {/* Card */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 30,
          boxShadow: "0 20px 50px rgba(20,22,26,0.06)",
        }}>
          {/* Segmented toggle */}
          <div style={{ display: "flex", gap: 4, marginBottom: 22, background: C.surface2, borderRadius: 11, padding: 4 }}>
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: 13.5, fontWeight: 600, fontFamily: "'Manrope', sans-serif",
                  background: mode === m ? C.surface : "transparent",
                  color: mode === m ? C.accent : C.textSoft,
                  boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {m === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <label style={labelStyle}><Mail size={13} /> E-mail</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onKeyDown}
            placeholder="voce@email.com" style={inputStyle} autoFocus
          />

          <label style={{ ...labelStyle, marginTop: 14 }}><Lock size={13} /> Senha</label>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onKeyDown}
            placeholder="••••••••" style={inputStyle}
          />

          {error && (
            <div style={{
              marginTop: 14, padding: "10px 12px", borderRadius: 8, background: "#D6454514",
              border: `1px solid ${C.expense}33`, color: C.expense, fontSize: 12.5,
            }}>
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading || !email || !password}
            style={{
              width: "100%", marginTop: 20, padding: "12px 0", borderRadius: 10, border: "none",
              background: loading || !email || !password ? C.textFaint : C.accent,
              color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Manrope', sans-serif",
              cursor: loading || !email || !password ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "background 0.15s ease",
            }}
          >
            {loading ? (
              <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />
            ) : (
              <>{mode === "signup" ? "Criar conta" : "Entrar"} <ArrowRight size={15} /></>
            )}
          </button>

          {mode === "signup" && (
            <p style={{ fontSize: 11.5, color: C.textFaint, marginTop: 14, marginBottom: 0, textAlign: "center", lineHeight: 1.5 }}>
              Depois de criar a conta, você vai precisar do código de acesso recebido na compra pra liberar o sistema.
            </p>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: 11.5, color: C.textFaint, marginTop: 20 }}>
          Seus dados ficam salvos de forma privada, só você tem acesso.
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
  color: "#6B7280", marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 13px", borderRadius: 9, border: "1px solid #E6E8EC",
  fontSize: 14, fontFamily: "'Manrope', sans-serif", background: "#F9FAFB", color: "#14161A",
  outline: "none", boxSizing: "border-box",
};
