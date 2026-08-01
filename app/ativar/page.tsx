"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === "Failed to fetch") {
    return "Não foi possível conectar ao Supabase. Confira as variáveis de ambiente.";
  }
  return error instanceof Error ? error.message : "Não foi possível ativar o acesso.";
}

export default function AtivarPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const res = await fetch("/api/access/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Código inválido.");
      router.push("/dashboard");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", background: "#FAFAFA" }}>
      <div style={{ width: 380, maxWidth: "90vw", padding: 26, border: "1px solid #E6E8EC", borderRadius: 14, background: "#fff" }}>
        <h1 style={{ fontSize: 19, marginBottom: 8, fontWeight: 700 }}>Ativar acesso</h1>
        <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 18 }}>Insira o código de acesso recebido por e-mail após a compra.</p>
        <input placeholder="GRANA-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} style={{ width: "100%", padding: 10, marginBottom: 10, borderRadius: 7, border: "1px solid #E6E8EC", fontFamily: "monospace" }} />
        {error && <p style={{ color: "#D64545", fontSize: 12.5, marginBottom: 10 }}>{error}</p>}
        <button onClick={submit} disabled={loading} style={{ width: "100%", padding: 11, background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
          {loading ? "Verificando…" : "Ativar"}
        </button>
      </div>
    </div>
  );
}
