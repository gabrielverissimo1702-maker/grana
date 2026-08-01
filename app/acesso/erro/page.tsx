import Link from "next/link";
import { XCircle } from "lucide-react";

export default function AcessoErroPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-5 text-[#14161a]">
      <section className="w-full max-w-md rounded-lg border border-[#dfe3ea] bg-white p-6 shadow-[0_18px_60px_rgba(20,22,26,0.10)]">
        <XCircle className="mb-4 text-[#d64545]" size={38} />
        <h1 className="text-2xl font-extrabold">Pagamento não concluído</h1>
        <p className="mt-3 leading-7 text-[#5f6673]">
          Não recebemos a confirmação do pagamento. Você pode tentar novamente pela página inicial.
        </p>
        <Link className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#4f46e5] text-sm font-bold text-white" href="/">
          Voltar ao início
        </Link>
      </section>
    </main>
  );
}
