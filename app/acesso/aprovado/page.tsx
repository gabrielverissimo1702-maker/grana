import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function AcessoAprovadoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-5 text-[#14161a]">
      <section className="w-full max-w-md rounded-lg border border-[#dfe3ea] bg-white p-6 shadow-[0_18px_60px_rgba(20,22,26,0.10)]">
        <CheckCircle2 className="mb-4 text-[#1f9d63]" size={38} />
        <h1 className="text-2xl font-extrabold">Pagamento aprovado</h1>
        <p className="mt-3 leading-7 text-[#5f6673]">
          Seu código de acesso será enviado para o e-mail usado na compra. Depois, crie sua conta e informe o código na ativação.
        </p>
        <Link className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#4f46e5] text-sm font-bold text-white" href="/login">
          Criar conta ou entrar
        </Link>
      </section>
    </main>
  );
}
