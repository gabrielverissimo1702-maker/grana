"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import GranaApp from "@/components/GranaApp";

function withTimeout<T>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export default function DashboardPage() {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("carregando...");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const supabase = supabaseBrowser();
        setMessage("verificando login...");
        const { data: sessionData, error: sessionError } = await withTimeout(
          supabase.auth.getSession(),
          8000,
          "Tempo esgotado ao verificar o login."
        );
        if (sessionError) throw sessionError;

        const user = sessionData.session?.user;
        if (!user) {
          window.location.replace("/login");
          return;
        }

        setMessage("verificando acesso...");
        const accessResult = await withTimeout(
          supabase
            .from("user_access")
            .select("lifetime_access")
            .eq("user_id", user.id)
            .maybeSingle(),
          8000,
          "Tempo esgotado ao verificar o acesso."
        );

        if (accessResult.error) throw accessResult.error;
        const access = accessResult.data as { lifetime_access?: boolean } | null;

        if (!access?.lifetime_access) {
          window.location.replace("/ativar");
          return;
        }

        if (alive) setReady(true);
      } catch (error) {
        const text = error instanceof Error ? error.message : "Nao foi possivel abrir o sistema.";
        if (alive) {
          setMessage(text);
          setFailed(true);
        }
      }
    })();

    return () => { alive = false; };
  }, []);

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", color: failed ? "#D64545" : "#6B7280", background: "#F4F1EA", padding: 20, textAlign: "center" }}>
        <div>
          <div>{message}</div>
          {failed && <button type="button" onClick={() => window.location.replace("/login")} style={{ marginTop: 14, border: "none", borderRadius: 8, padding: "10px 14px", background: "#4F46E5", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Voltar para o login</button>}
        </div>
      </div>
    );
  }

  return <GranaApp />;
}
