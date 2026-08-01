/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
"use client";

import { createDataBridge } from "@/lib/supabase/data-bridge";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Legend
} from "recharts";
import {
  Wallet, Plus, X, Trash2, CreditCard, Compass, LayoutDashboard, Receipt,
  Landmark, ChevronLeft, ChevronRight, RefreshCcw, Info, Check, Sun, Moon,
  ListChecks, AlertTriangle, Receipt as ReceiptIcon, Pencil, ArrowLeftRight, PiggyBank, Minus,
  TrendingUp as TrendingUpIcon, Settings, LogOut
} from "lucide-react";

/* ---------------------------------------------------------------------- */
/* Paletas - o usuário escolhe a cor de destaque, o resto é sempre neutro  */
/* ---------------------------------------------------------------------- */
const PALETTES = {
  indigo: { label: "Índigo", light: "#4F46E5", dark: "#818CF8" },
  petroleo: { label: "Verde-petróleo", light: "#0D7377", dark: "#35C7C2" },
  cobalto: { label: "Cobalto", light: "#2954E0", dark: "#6E93F7" },
  ameixa: { label: "Ameixa", light: "#7A5CC7", dark: "#B39DDB" },
};

function buildTokens(themeName, paletteKey) {
  const accentPair = PALETTES[paletteKey] || PALETTES.indigo;
  if (themeName === "dark") {
    return {
      bg: "#07080A", surface: "rgba(5,6,8,0.96)", surface2: "#111318", border: "rgba(255,255,255,0.075)",
      text: "#F4F5F7", textSoft: "#A5ABB6", textFaint: "#686F7C",
      accent: accentPair.dark, accentSoft: accentPair.dark + "1F",
      income: "#34D399", expense: "#F87171", warning: "#F59E0B",
      pageOverlay: "rgba(10,11,14,0.90)", panelShadow: "0 22px 54px rgba(0,0,0,0.46)",
      pageBase: "#08090C",
    };
  }
  return {
    bg: "#F4F1EA", surface: "rgba(255,255,255,0.97)", surface2: "#F3F1EC", border: "#E4E0D8",
    text: "#14161A", textSoft: "#6B7280", textFaint: "#9AA1AC",
    accent: accentPair.light, accentSoft: accentPair.light + "16",
    income: "#1F9D63", expense: "#D64545", warning: "#B45309",
    pageOverlay: "rgba(244,241,234,0.86)", panelShadow: "0 20px 50px rgba(55,48,38,0.10)",
    pageBase: "#F4F1EA",
  };
}

const VARIABLE_CATEGORIES = [
  { name: "Alimentação", weight: 30, color: "#B8873A" },
  { name: "Investimentos", weight: 20, color: "#2F8F6B" },
  { name: "Lazer", weight: 15, color: "#7C6FC4" },
  { name: "Transporte", weight: 15, color: "#4472A8" },
  { name: "Viagem", weight: 10, color: "#A85C7A" },
  { name: "Outros", weight: 10, color: "#767C86" },
];

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const fmtBRL = (n) => (n < 0 ? "-" : "") + "R$ " + Math.abs(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
function monthLabelFromKey(mk) {
  const [year, month] = mk.split("-").map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}
const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const parseNum = (v) => parseFloat(String(v).replace(",", ".")) || 0;

const STORAGE_KEY = "grana:v6";
const DEFAULT_DATA = {
  theme: "light", palette: "indigo",
  accounts: [], cards: [], bills: [], transactions: [],
  transfers: [], investments: [], investmentMoves: [],
  planning: {},
};
const emptyMonthPlan = () => ({ incomes: [], variablePlanned: {}, weights: {} });

// cada conta tem uma lista de meses do ano (1-12) em que ela é ativa; por padrão, o ano todo
const ALL_MONTHS_NUM = [1,2,3,4,5,6,7,8,9,10,11,12];
function monthsOf(bill) {
  if (Array.isArray(bill.months)) return bill.months;
  // compatibilidade com o formato antigo (recurring/onlyMonth)
  if (bill.recurring === false && bill.onlyMonth) return [parseInt(bill.onlyMonth.split("-")[1], 10)];
  return ALL_MONTHS_NUM;
}
function billActiveInMonth(bill, mk) {
  return monthsOf(bill).includes(parseInt(mk.split("-")[1], 10));
}
function billsForMonth(bills, mk) {
  return bills.filter((b) => billActiveInMonth(b, mk));
}
function billStatus(b, mKey, T) {
  if (b.paid[mKey]) return { label: "Pago", color: T.income };
  const isCurrentMonth = mKey === monthKey(new Date());
  if (!isCurrentMonth) return { label: "Pendente", color: T.textSoft };
  const diff = b.dueDay - new Date().getDate();
  if (diff < 0) return { label: `Atrasada há ${Math.abs(diff)}d`, color: T.expense, alert: true };
  if (diff === 0) return { label: "Vence hoje", color: T.warning, alert: true };
  if (diff <= 5) return { label: `Vence em ${diff}d`, color: T.warning, alert: true };
  return { label: "Pendente", color: T.textSoft };
}

// determina em qual mês (mKey) uma compra no cartão cai, considerando o dia de fechamento:
// compras depois do fechamento vão pra fatura do mês seguinte
function invoiceMonthOf(dateISO, closingDay) {
  const d = new Date(dateISO + "T00:00");
  let y = d.getFullYear(), m = d.getMonth();
  if (d.getDate() > closingDay) { m += 1; if (m > 11) { m = 0; y += 1; } }
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}
// valor itemizado (compras lançadas uma a uma) que caem na fatura daquele mês
function itemizedInvoiceOf(card, mKey, transactions) {
  return transactions.filter((t) => t.source?.type === "card" && t.source.id === card.id && (t.invoiceMonth || invoiceMonthOf(t.date, card.closingDay)) === mKey).reduce((s, t) => s + t.amount, 0);
}
// valor parcial (lançado de uma vez, sem detalhar item por item) pra aquele mês
function partialInvoiceOf(card, mKey) {
  return (card.partials && card.partials[mKey]) || 0;
}
// fatura total real (o que você deve pagar) = itemizado + parcial
function totalInvoiceOf(card, mKey, transactions) {
  return itemizedInvoiceOf(card, mKey, transactions) + partialInvoiceOf(card, mKey);
}

function useIsMobile(bp = 760) {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < bp : false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < bp);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [bp]);
  return isMobile;
}

/* carrega as fontes via <link>, mais confiável em iframes do que @import */
function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

function useGoogleFonts() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap";
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);
}

/* ---------------------------------------------------------------------- */
export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [cursor, setCursor] = useState(new Date());
  const [toast, setToast] = useState(null);
  const [txPreset, setTxPreset] = useState(null);
  const [editingTx, setEditingTx] = useState(null);
  const isMobile = useIsMobile();
  useGoogleFonts();
  const storage = useMemo(() => createDataBridge(), []);

  useEffect(() => {
    (async () => {
      try {
        const res = await withTimeout(storage.get(STORAGE_KEY, false), 8000);
        setData(res ? { ...DEFAULT_DATA, ...JSON.parse(res.value) } : DEFAULT_DATA);
      } catch {
        setData(DEFAULT_DATA);
      } finally {
        setLoading(false);
      }
    })();
  }, [storage]);

  const persist = useCallback(async (next) => {
    setData(next);
    try {
      await storage.set(STORAGE_KEY, JSON.stringify(next), false);
    } catch {
      setToast("Não foi possível salvar agora. Tente novamente.");
      setTimeout(() => setToast(null), 2600);
    }
  }, [storage]);

  const T = buildTokens(data?.theme || "light", data?.palette || "indigo");

  if (loading || !data) {
    return (
      <div style={{ minHeight: "100vh", background: "#FAFAFA", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#6B7280", fontSize: 13 }}>carregando...</div>
      </div>
    );
  }

  const mKey = monthKey(cursor);
  const plan = data.planning[mKey] || emptyMonthPlan();
  const monthTx = data.transactions.filter((t) => t.date.slice(0, 7) === mKey);
  const realIncome = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const applicableBills = billsForMonth(data.bills, mKey);
  const fixedLabels = applicableBills.map((b) => b.name);
  const realFixedFromBills = monthTx.filter((t) => t.type === "expense" && fixedLabels.some((l) => l.toLowerCase() === t.category.toLowerCase())).reduce((s, t) => s + t.amount, 0);
  // a fatura inteira do cartão (compras lançadas + valor parcial) conta como saída fixa do mês
  const cardsFixedTotal = data.cards.reduce((s, c) => s + totalInvoiceOf(c, mKey, data.transactions), 0);
  const realFixed = realFixedFromBills + cardsFixedTotal;
  const projIncome = plan.incomes.reduce((s, i) => s + i.amount, 0);
  const projFixed = applicableBills.reduce((s, b) => s + b.amount, 0) + cardsFixedTotal;
  const saldoPlanejado = projIncome - projFixed;
  const saldoReal = realIncome - realFixed;
  const overallBalance = data.transactions.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
  const accountsAvailableBalance = data.accounts.reduce((sum, account) => {
    const fromTx = data.transactions
      .filter((t) => t.source?.type === "account" && t.source.id === account.id)
      .reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
    const transferOut = data.transfers.filter((tr) => tr.fromId === account.id).reduce((s, tr) => s + tr.amount, 0);
    const transferIn = data.transfers.filter((tr) => tr.toId === account.id).reduce((s, tr) => s + tr.amount, 0);
    return sum + (account.initialBalance || 0) + fromTx - transferOut + transferIn;
  }, 0);
  const availableBalance = data.accounts.length > 0 ? accountsAvailableBalance : overallBalance;

  const toggleTheme = () => persist({ ...data, theme: data.theme === "dark" ? "light" : "dark" });
  const setPalette = (key) => persist({ ...data, palette: key });

  async function handleSignOut() {
    try {
      await supabaseBrowser().auth.signOut();
    } finally {
      window.location.replace("/login");
    }
  }

  const updatePlan = (patch) => persist({ ...data, planning: { ...data.planning, [mKey]: { ...plan, ...patch } } });
  const addIncome = (label, amount) => updatePlan({ incomes: [...plan.incomes, { id: uid(), label, amount }] });
  const removeIncome = (id) => updatePlan({ incomes: plan.incomes.filter((i) => i.id !== id) });
  const setVariablePlanned = (cat, val) => updatePlan({ variablePlanned: { ...plan.variablePlanned, [cat]: val } });
  const setWeight = (cat, val) => updatePlan({ weights: { ...plan.weights, [cat]: val } });
  const recalcularComReal = () => {
    const next = {};
    VARIABLE_CATEGORIES.forEach((c) => {
      const w = plan.weights[c.name] ?? c.weight;
      next[c.name] = Math.max(0, Math.round((saldoReal * w) / 100));
    });
    updatePlan({ variablePlanned: next });
  };

  const addTransaction = (tx) => {
    const newTx = { id: uid(), ...tx };
    let bills = data.bills;
    if (tx.type === "expense") {
      bills = data.bills.map((b) => (b.name.toLowerCase() === tx.category.toLowerCase() ? { ...b, paid: { ...b.paid, [tx.date.slice(0, 7)]: true } } : b));
    }
    persist({ ...data, bills, transactions: [newTx, ...data.transactions] });
  };
  const updateTransaction = (id, patch) => persist({ ...data, transactions: data.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const deleteTransaction = (id) => persist({ ...data, transactions: data.transactions.filter((t) => t.id !== id) });
  const addAccount = (acc) => persist({ ...data, accounts: [...data.accounts, { id: uid(), ...acc }] });
  const deleteAccount = (id) => persist({ ...data, accounts: data.accounts.filter((a) => a.id !== id) });
  const addCard = (card) => persist({ ...data, cards: [...data.cards, { id: uid(), partials: {}, ...card }] });
  const deleteCard = (id) => persist({ ...data, cards: data.cards.filter((c) => c.id !== id) });
  // valor parcial é um "isso é tudo que eu sei, sem detalhar" - substitui o valor anterior, não soma
  const setCardPartial = (cardId, amount) => persist({
    ...data,
    cards: data.cards.map((c) => c.id === cardId ? { ...c, partials: { ...c.partials, [mKey]: amount } } : c),
  });
  const addBill = (bill) => persist({ ...data, bills: [...data.bills, { id: uid(), paid: {}, ...bill }] });
  const updateBill = (id, patch) => persist({ ...data, bills: data.bills.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  const deleteBill = (id) => persist({ ...data, bills: data.bills.filter((b) => b.id !== id) });
  const toggleBillPaid = (id) => persist({ ...data, bills: data.bills.map((b) => (b.id === id ? { ...b, paid: { ...b.paid, [mKey]: !b.paid[mKey] } } : b)) });

  const addTransfer = (transfer) => persist({ ...data, transfers: [{ id: uid(), ...transfer }, ...data.transfers] });

  const addInvestment = (inv) => persist({ ...data, investments: [...data.investments, { id: uid(), ...inv }] });
  const updateInvestment = (id, patch) => persist({ ...data, investments: data.investments.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  const deleteInvestment = (id) => persist({ ...data, investments: data.investments.filter((i) => i.id !== id), investmentMoves: data.investmentMoves.filter((m) => m.investmentId !== id) });
  const addInvestmentMove = (move) => {
    let transactions = data.transactions;
    // resgate com destino: o valor também entra como receita na conta escolhida
    if (move.type === "resgate" && move.destAccountId) {
      transactions = [{
        id: uid(), type: "income", amount: move.amount, category: "Resgate de investimento",
        description: `Resgate de ${move.investmentName || "reserva"}`, date: move.date,
        source: { type: "account", id: move.destAccountId },
      }, ...transactions];
    }
    persist({ ...data, transactions, investmentMoves: [{ id: uid(), ...move }, ...data.investmentMoves] });
  };

  const openTx = (preset) => setTxPreset(preset || {});

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: T.pageBase,
        backgroundImage: `linear-gradient(${T.pageOverlay}, ${T.pageOverlay}), url('/images/money-bg.jpg')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        color: T.text,
        fontFamily: "'Manrope', sans-serif",
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        padding: isMobile ? 0 : 20,
        gap: isMobile ? 0 : 20,
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid ${T.accent}; outline-offset: 1px; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }
        input, select { font-family: 'Manrope', sans-serif; }
        input::placeholder { color: ${T.textFaint}; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; appearance: textfield; }
      `}</style>

      {isMobile ? <TopBar T={T} theme={data.theme} onToggleTheme={toggleTheme} availableBalance={availableBalance} onOpenAppearance={() => setTab("aparencia")} /> : <Sidebar T={T} tab={tab} setTab={setTab} theme={data.theme} onToggleTheme={toggleTheme} availableBalance={availableBalance} onSignOut={handleSignOut} />}

      <main style={{ flex: 1, minWidth: 0, padding: isMobile ? "4px 12px 104px" : "8px 12px 18px", overflowY: "auto" }}>
        <MonthNav T={T} cursor={cursor} setCursor={setCursor} isMobile={isMobile} />

        {tab === "dashboard" && <Dashboard T={T} monthTx={monthTx} transactions={data.transactions} cursor={cursor} plan={plan} saldoReal={saldoReal} isMobile={isMobile} />}
        {tab === "planejamento" && (
          <Planejamento T={T} plan={plan} bills={applicableBills} cards={data.cards} transactions={data.transactions} mKey={mKey} projIncome={projIncome} projFixed={projFixed} saldoPlanejado={saldoPlanejado}
            saldoReal={saldoReal} onAddIncome={addIncome} onRemoveIncome={removeIncome} onAddBill={(b) => addBill({ ...b, months: [parseInt(mKey.split("-")[1], 10)] })} onDeleteBill={deleteBill}
            onSetVariablePlanned={setVariablePlanned} onSetWeight={setWeight} onRecalcular={recalcularComReal} isMobile={isMobile} />
        )}
        {tab === "transacoes" && <Transacoes T={T} monthTx={monthTx} onOpenEdit={setEditingTx} onOpenNew={() => openTx({})} isMobile={isMobile} />}
        {tab === "contas" && (
          <ContasFixas T={T} bills={applicableBills} mKey={mKey} onAddBill={addBill} onUpdateBill={updateBill} onDeleteBill={deleteBill} onTogglePaid={toggleBillPaid} />
        )}
        {tab === "bancos" && (
          <BancosCartoes T={T} accounts={data.accounts} cards={data.cards} transactions={data.transactions} transfers={data.transfers} mKey={mKey}
            onAddAccount={addAccount} onDeleteAccount={deleteAccount} onAddCard={addCard} onDeleteCard={deleteCard}
            onSetCardPartial={setCardPartial} onAddTransfer={addTransfer} onOpenEdit={setEditingTx}
            onOpenTx={openTx} isMobile={isMobile} />
        )}
        {tab === "investimentos" && (
          <Investimentos T={T} investments={data.investments} moves={data.investmentMoves} accounts={data.accounts}
            onAddInvestment={addInvestment} onUpdateInvestment={updateInvestment} onDeleteInvestment={deleteInvestment} onAddMove={addInvestmentMove} isMobile={isMobile} />
        )}
        {tab === "aparencia" && <Aparencia T={T} theme={data.theme} palette={data.palette} onToggleTheme={toggleTheme} onSetPalette={setPalette} />}
      </main>

      {isMobile && <BottomNav T={T} tab={tab} setTab={setTab} />}

      {(txPreset || editingTx) && (
        <TxModal T={T} preset={txPreset || {}} editingTx={editingTx} onClose={() => { setTxPreset(null); setEditingTx(null); }}
          onAdd={addTransaction} onUpdate={updateTransaction} onDelete={deleteTransaction}
          fixedLabels={fixedLabels} accounts={data.accounts} cards={data.cards} incomeLabels={plan.incomes.map((i) => i.label)} isMobile={isMobile} />
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: isMobile ? 92 : 24, right: 20, left: isMobile ? 20 : "auto", background: T.surface, color: T.text, padding: "12px 16px", borderRadius: 10, fontSize: 13, border: `1px solid ${T.border}`, boxShadow: T.panelShadow, display: "flex", alignItems: "center", gap: 8 }}>
          <Info size={15} color={T.accent} /> {toast}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
const NAV_ITEMS = [
  { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
  { id: "planejamento", label: "Planejamento", icon: Compass },
  { id: "transacoes", label: "Transações", icon: Receipt },
  { id: "contas", label: "Contas", icon: ListChecks },
  { id: "bancos", label: "Bancos & cartões", icon: Landmark },
  { id: "investimentos", label: "Investimentos", icon: PiggyBank },
];

function Logo({ T, size = 30 }) {
  return <div style={{ width: size, height: size, borderRadius: size * 0.28, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Wallet size={size * 0.55} color="#fff" /></div>;
}
function Sidebar({ T, tab, setTab, theme, onToggleTheme, availableBalance, onSignOut }) {
  const items = [...NAV_ITEMS, { id: "aparencia", label: "Aparência", icon: Sun }];
  return (
    <aside style={{ width: 244, height: "calc(100vh - 40px)", flexShrink: 0, background: T.surface, padding: "22px 16px", display: "flex", flexDirection: "column", gap: 5, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: T.panelShadow, backdropFilter: "blur(10px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px", marginBottom: 28 }}>
        <Logo T={T} />
        <div>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 20 }}>Grana</div>
          <div style={{ fontSize: 11.5, color: T.textSoft, marginTop: 1 }}>controle financeiro</div>
        </div>
      </div>
      {items.map((it) => {
        const Icon = it.icon;
        const active = tab === it.id;
        return (
          <button key={it.id} onClick={() => setTab(it.id)} style={{
            display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 8,
            background: active ? T.accentSoft : "transparent", color: active ? T.accent : T.textSoft,
            border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: active ? 600 : 500, textAlign: "left", width: "100%",
          }}><Icon size={16} /> {it.label}</button>
        );
      })}
      <div style={{ marginTop: "auto", display: "grid", gap: 12 }}>
        <BalancePill T={T} label="Saldo disponível" value={availableBalance} />
        <ThemeSwitch T={T} theme={theme} onToggleTheme={onToggleTheme} />
        <button onClick={onSignOut} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 38, borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface2, color: T.textSoft, cursor: "pointer", fontSize: 12.5, fontWeight: 700 }}><LogOut size={15} /> Sair</button>
        <div style={{ padding: "0 4px", fontSize: 10.5, color: T.textFaint, lineHeight: 1.5 }}>Dados salvos automaticamente e de forma privada.</div>
      </div>
    </aside>
  );
}
function BalancePill({ T, label, value, mobile = false }) {
  return (
    <div style={{ minWidth: mobile ? 210 : "auto", borderRadius: 13, border: `1px solid ${T.border}`, background: T.surface2, padding: mobile ? "9px 14px" : "11px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0 }}>{label}</div>
      <div style={{ marginTop: 2, fontFamily: "'IBM Plex Mono', monospace", fontSize: mobile ? 20 : 17, fontWeight: 800, color: value >= 0 ? T.income : T.expense }}>
        {fmtBRL(value)}
      </div>
    </div>
  );
}
function TopBar({ T, theme, onToggleTheme, availableBalance, onOpenAppearance }) {
  return (
    <div style={{ position: "sticky", top: 10, zIndex: 45, display: "grid", gap: 10, padding: "10px 12px 12px", margin: "10px 10px 10px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, boxShadow: T.panelShadow, backdropFilter: "blur(14px)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Logo T={T} size={26} />
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 17 }}>Grana</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <ThemeSwitch T={T} theme={theme} onToggleTheme={onToggleTheme} compact />
          <button
            onClick={onOpenAppearance}
            aria-label="Abrir aparência"
            title="Aparência"
            style={{ width: 38, height: 38, borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface2, color: T.textSoft, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <Settings size={17} />
          </button>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ minWidth: 210, borderRadius: 13, border: `1px solid ${T.border}`, background: T.surface2, padding: "9px 14px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0 }}>Saldo disponível</div>
          <div style={{ marginTop: 2, fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 800, color: availableBalance >= 0 ? T.income : T.expense }}>
            {fmtBRL(availableBalance)}
          </div>
        </div>
      </div>
    </div>
  );
}
function ThemeSwitch({ T, theme, onToggleTheme, compact = false }) {
  const options = [
    { id: "light", label: "Claro", icon: Sun },
    { id: "dark", label: "Escuro", icon: Moon },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: 4, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, minWidth: compact ? 96 : "auto" }}>
      {options.map((option) => {
        const Icon = option.icon;
        const active = theme === option.id;
        return (
          <button
            key={option.id}
            onClick={() => !active && onToggleTheme()}
            style={{
              height: compact ? 30 : 36,
              borderRadius: 9,
              border: "none",
              background: active ? T.surface : "transparent",
              color: active ? T.accent : T.textSoft,
              boxShadow: active ? "0 1px 5px rgba(0,0,0,0.10)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              cursor: active ? "default" : "pointer",
              fontSize: compact ? 11.5 : 12.5,
              fontWeight: 700,
            }}
          >
            <Icon size={14} /> {!compact && option.label}
          </button>
        );
      })}
    </div>
  );
}
function BottomNav({ T, tab, setTab }) {
  const items = NAV_ITEMS;
  return (
    <nav style={{ position: "fixed", bottom: "max(10px, env(safe-area-inset-bottom))", left: 10, right: 10, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, boxShadow: T.panelShadow, display: "flex", padding: "6px 2px", zIndex: 40, overflowX: "auto", backdropFilter: "blur(10px)" }}>
      {items.map((it) => {
        const Icon = it.icon;
        const active = tab === it.id;
        return (
          <button key={it.id} onClick={() => setTab(it.id)} style={{ flex: 1, minWidth: 54, minHeight: 48, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: "6px 2px", background: active ? T.accentSoft : "none", border: "none", borderRadius: 11, color: active ? T.accent : T.textFaint, cursor: "pointer" }}>
            <Icon size={17} /><span style={{ fontSize: 9, fontWeight: active ? 600 : 500 }}>{it.label.split(" ")[0]}</span>
          </button>
        );
      })}
    </nav>
  );
}
function MonthNav({ T, cursor, setCursor, isMobile }) {
  const move = (delta) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: isMobile ? 18 : 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <IconBtn T={T} onClick={() => move(-1)}><ChevronLeft size={16} /></IconBtn>
        <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: isMobile ? 17 : 20, minWidth: isMobile ? 130 : 160, textAlign: "center" }}>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</div>
        <IconBtn T={T} onClick={() => move(1)}><ChevronRight size={16} /></IconBtn>
      </div>
      {!isMobile && <div style={{ flex: 1, borderBottom: `1px solid ${T.border}` }} />}
    </div>
  );
}
function IconBtn({ T, onClick, children }) { return <button onClick={onClick} style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text }}>{children}</button>; }
function Card({ T, title, right, children }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, padding: "18px 20px", boxShadow: T.panelShadow, backdropFilter: "blur(10px)" }}>
      {title && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}><h3 style={{ fontFamily: "'Sora', sans-serif", fontSize: 15, fontWeight: 600, margin: 0 }}>{title}</h3>{right}</div>}
      {children}
    </div>
  );
}
function Empty({ T, text }) { return <div style={{ padding: "20px 0", textAlign: "center", color: T.textFaint, fontSize: 13 }}>{text}</div>; }
const btn = (T) => ({ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, background: T.accent, color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, boxShadow: "0 8px 20px " + T.accentSoft });
const ghostBtn = (T, color) => ({ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, background: T.surface2, color: color || T.textSoft, border: `1px solid ${color || T.border}`, cursor: "pointer", fontSize: 12.5, fontWeight: 600 });
const inputStyle = (T) => ({ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${T.border}`, fontSize: 13.5, color: T.text, background: T.surface2 });

/* ---------------------------------------------------------------------- */
/* Aparência - tema + paleta                                              */
/* ---------------------------------------------------------------------- */
function Aparencia({ T, theme, palette, onToggleTheme, onSetPalette }) {
  return (
    <div style={{ maxWidth: 560 }}>
      <Card T={T} title="Tema">
        <div style={{ display: "flex", gap: 10 }}>
          {[["light","Claro",Sun],["dark","Escuro",Moon]].map(([v,l,Icon]) => (
            <button key={v} onClick={() => (theme !== v) && onToggleTheme()} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 0", borderRadius: 9,
              border: `1.5px solid ${theme===v ? T.accent : T.border}`, background: theme===v ? T.accentSoft : "transparent",
              color: theme===v ? T.accent : T.textSoft, cursor: "pointer", fontSize: 13.5, fontWeight: 600,
            }}><Icon size={15} /> {l}</button>
          ))}
        </div>
      </Card>
      <div style={{ height: 16 }} />
      <Card T={T} title="Cor de destaque" right={<span style={{ fontSize: 11.5, color: T.textFaint }}>escolha e veja ao vivo</span>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {Object.entries(PALETTES).map(([key, p]) => {
            const active = palette === key;
            const swatch = theme === "dark" ? p.dark : p.light;
            return (
              <button key={key} onClick={() => onSetPalette(key)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10,
                border: `1.5px solid ${active ? swatch : T.border}`, background: active ? swatch + "14" : "transparent", cursor: "pointer",
              }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: swatch, flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, fontWeight: active ? 600 : 500, color: T.text }}>{p.label}</span>
                {active && <Check size={14} color={swatch} style={{ marginLeft: "auto" }} />}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Planejamento                                                            */
/* ---------------------------------------------------------------------- */
function Planejamento({ T, plan, bills, cards, transactions, mKey, projIncome, projFixed, saldoPlanejado, saldoReal, onAddIncome, onRemoveIncome, onAddBill, onDeleteBill, onSetVariablePlanned, onSetWeight, onRecalcular, isMobile }) {
  const [newIncomeLabel, setNewIncomeLabel] = useState("");
  const [newIncomeAmount, setNewIncomeAmount] = useState("");
  const [newFixedLabel, setNewFixedLabel] = useState("");
  const [newFixedAmount, setNewFixedAmount] = useState("");
  const [newFixedDay, setNewFixedDay] = useState("5");

  const totalWeight = VARIABLE_CATEGORIES.reduce((s, c) => s + (plan.weights[c.name] ?? c.weight), 0) || 100;
  const allocacoes = VARIABLE_CATEGORIES.map((c) => {
    const w = plan.weights[c.name] ?? c.weight;
    const recomendado = Math.max(0, Math.round((saldoPlanejado * w) / totalWeight));
    return { ...c, w, recomendado, planejado: plan.variablePlanned[c.name] ?? recomendado };
  });
  const totalPlanejadoVariavel = allocacoes.reduce((s, a) => s + a.planejado, 0);
  const naoAlocado = saldoPlanejado - totalPlanejadoVariavel;
  const diferenca = saldoReal - saldoPlanejado;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card T={T} title="Receitas projetadas" right={<span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: T.income, fontWeight: 600 }}>{fmtBRL(projIncome)}</span>}>
          {plan.incomes.length === 0 ? <Empty T={T} text="Adicione o que você espera receber este mês." /> : plan.incomes.map((i) => <LineRow key={i.id} T={T} label={i.label} amount={i.amount} color={T.income} onRemove={() => onRemoveIncome(i.id)} />)}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input placeholder="Ex: Salário" value={newIncomeLabel} onChange={(e) => setNewIncomeLabel(e.target.value)} style={{ ...inputStyle(T), flex: 2 }} />
            <input placeholder="0,00" value={newIncomeAmount} onChange={(e) => setNewIncomeAmount(e.target.value)} style={{ ...inputStyle(T), flex: 1 }} />
            <button style={ghostBtn(T, T.income)} onClick={() => { if (!newIncomeLabel.trim() || !parseNum(newIncomeAmount)) return; onAddIncome(newIncomeLabel.trim(), parseNum(newIncomeAmount)); setNewIncomeLabel(""); setNewIncomeAmount(""); }}><Plus size={13} /></button>
          </div>
        </Card>

        <Card T={T} title="Saídas fixas deste mês" right={<span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: T.expense, fontWeight: 600 }}>{fmtBRL(projFixed)}</span>}>
          {bills.length === 0 ? <Empty T={T} text="Cadastre suas contas fixas aqui; elas também aparecem em Contas." /> : bills.map((b) => <LineRow key={b.id} T={T} label={b.name} amount={b.amount} color={T.expense} onRemove={() => onDeleteBill(b.id)} />)}
          {cards.filter((c) => totalInvoiceOf(c, mKey, transactions) > 0).map((c) => (
            <LineRow key={c.id} T={T} label={`Fatura ${c.name}`} amount={totalInvoiceOf(c, mKey, transactions)} color={T.expense} />
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <input placeholder="Ex: Aluguel" value={newFixedLabel} onChange={(e) => setNewFixedLabel(e.target.value)} style={{ ...inputStyle(T), flex: 2, minWidth: 100 }} />
            <input placeholder="0,00" value={newFixedAmount} onChange={(e) => setNewFixedAmount(e.target.value)} style={{ ...inputStyle(T), flex: 1, minWidth: 70 }} />
            <input placeholder="dia" type="number" value={newFixedDay} onChange={(e) => setNewFixedDay(e.target.value)} style={{ ...inputStyle(T), width: 60 }} />
            <button style={ghostBtn(T, T.expense)} onClick={() => {
              if (!newFixedLabel.trim() || !parseNum(newFixedAmount)) return;
              onAddBill({ name: newFixedLabel.trim(), amount: parseNum(newFixedAmount), dueDay: parseInt(newFixedDay) || 1 });
              setNewFixedLabel(""); setNewFixedAmount("");
            }}><Plus size={13} /></button>
          </div>
          <p style={{ fontSize: 11, color: T.textFaint, marginTop: 8, marginBottom: 0 }}>Isso adiciona uma saída fixa só pra este mês. A fatura dos seus cartões entra aqui automaticamente.</p>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
        <StatBlock T={T} label="Projeção de receitas" value={projIncome} color={T.income} />
        <StatBlock T={T} label="Projeção de saídas fixas" value={projFixed} color={T.expense} />
        <StatBlock T={T} label="Saldo disponível projetado" value={saldoPlanejado} color={T.accent} big />
      </div>

      <Card T={T} title="Como o saldo disponível projetado se distribui">
        <AllocationBar T={T} projFixed={projFixed} projIncome={projIncome} allocacoes={allocacoes} naoAlocado={naoAlocado} />
      </Card>

      <div style={{ height: 16 }} />

      <Card T={T} title="Distribuição sugerida dos gastos variáveis">
        {allocacoes.map((a) => (
          <div key={a.name} style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 14, padding: "12px 0", borderBottom: `1px solid ${T.border}`, flexWrap: isMobile ? "wrap" : "nowrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, width: isMobile ? "100%" : 140 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: a.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13.5, fontWeight: 500 }}>{a.name}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, width: 66 }}>
              <input type="number" value={a.w} onChange={(e) => onSetWeight(a.name, parseFloat(e.target.value) || 0)} style={{ ...inputStyle(T), padding: "5px 6px", fontSize: 12, textAlign: "center" }} />
              <span style={{ fontSize: 11, color: T.textFaint }}>%</span>
            </div>
            <div style={{ fontSize: 12, color: T.textFaint, width: isMobile ? "100%" : 140, marginLeft: isMobile ? 16 : 0 }}>Recomendado: <span style={{ color: T.textSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtBRL(a.recomendado)}</span></div>
            <input
              value={plan.variablePlanned[a.name] ?? ""}
              placeholder={String(a.recomendado)}
              onChange={(e) => onSetVariablePlanned(a.name, e.target.value.trim() === "" ? undefined : parseNum(e.target.value))}
              style={{ ...inputStyle(T), width: isMobile ? "100%" : 110, fontFamily: "'IBM Plex Mono', monospace", marginLeft: isMobile ? 0 : "auto" }}
            />
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 14, fontSize: 13 }}>
          <span style={{ color: T.textSoft }}>Não alocado</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: naoAlocado < 0 ? T.expense : T.textSoft }}>{fmtBRL(naoAlocado)}</span>
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card T={T} title="Planejado x realizado até agora">
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr auto", gap: 18, alignItems: isMobile ? "stretch" : "center" }}>
          <div>
            <div style={{ fontSize: 12, color: T.textFaint, marginBottom: 4 }}>Saldo disponível planejado</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600 }}>{fmtBRL(saldoPlanejado)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: T.textFaint, marginBottom: 4 }}>Saldo disponível real (até agora)</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: diferenca < 0 ? T.expense : T.income }}>{fmtBRL(saldoReal)}</div>
            <div style={{ fontSize: 11.5, color: T.textFaint, marginTop: 2 }}>
              {diferenca === 0 ? "igual ao planejado" : diferenca > 0 ? `R$ ${diferenca.toFixed(2).replace(".", ",")} a mais que o planejado` : `R$ ${Math.abs(diferenca).toFixed(2).replace(".", ",")} a menos que o planejado`}
            </div>
          </div>
          <button style={btn(T)} onClick={onRecalcular}><RefreshCcw size={14} /> Recalcular com valores reais</button>
        </div>
      </Card>
    </div>
  );
}
function LineRow({ T, label, amount, color, onRemove }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 13.5 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color, fontWeight: 600 }}>{fmtBRL(amount)}</span>
        {onRemove && <button onClick={onRemove} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer" }}><Trash2 size={13} /></button>}
      </div>
    </div>
  );
}
function StatBlock({ T, label, value, color, big }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px", borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 12, color: T.textFaint, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: big ? 25 : 19, fontWeight: 700, color }}>{fmtBRL(value)}</div>
    </div>
  );
}
function AllocationBar({ T, projFixed, projIncome, allocacoes, naoAlocado }) {
  const total = projIncome > 0 ? projIncome : 1;
  const segs = [{ label: "Saídas fixas", value: projFixed, color: T.expense }, ...allocacoes.map((a) => ({ label: a.name, value: a.planejado, color: a.color }))];
  if (naoAlocado > 0) segs.push({ label: "Não alocado", value: naoAlocado, color: T.surface2 });
  return (
    <div>
      <div style={{ display: "flex", width: "100%", height: 28, borderRadius: 7, overflow: "hidden", border: `1px solid ${T.border}` }}>
        {segs.filter((s) => s.value > 0).map((s, i) => <div key={i} title={`${s.label}: ${fmtBRL(s.value)}`} style={{ width: `${Math.max(1, (s.value / total) * 100)}%`, background: s.color }} />)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 12 }}>
        {segs.map((s, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.textSoft }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: s.color }} /> {s.label}</div>)}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Dashboard                                                               */
/* ---------------------------------------------------------------------- */
function Dashboard({ T, monthTx, transactions, cursor, plan, saldoReal, isMobile }) {
  const income = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const pieData = useMemo(() => {
    const byCat = {};
    monthTx.filter((t) => t.type === "expense").forEach((t) => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
    return Object.entries(byCat).map(([name, value]) => ({ name, value }));
  }, [monthTx]);
  const barData = useMemo(() => {
    const out = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
      const k = monthKey(d);
      const inc = transactions.filter((t) => t.type === "income" && t.date.slice(0, 7) === k).reduce((s, t) => s + t.amount, 0);
      const exp = transactions.filter((t) => t.type === "expense" && t.date.slice(0, 7) === k).reduce((s, t) => s + t.amount, 0);
      out.push({ mes: MONTHS[d.getMonth()], Receitas: inc, Despesas: exp });
    }
    return out;
  }, [transactions, cursor]);
  const spentByCat = useMemo(() => {
    const out = {};
    monthTx.filter((t) => t.type === "expense").forEach((t) => { out[t.category] = (out[t.category] || 0) + t.amount; });
    return out;
  }, [monthTx]);
  const colorFor = (name) => VARIABLE_CATEGORIES.find((c) => c.name === name)?.color || T.textFaint;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatBlock T={T} label="Receitas do mês" value={income} color={T.income} />
        <StatBlock T={T} label="Despesas do mês" value={expense} color={T.expense} />
        <StatBlock T={T} label="Resultado do mês" value={income - expense} color={(income - expense) >= 0 ? T.income : T.expense} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card T={T} title="Receitas x despesas (6 meses)">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={barData}>
              <CartesianGrid stroke={T.border} vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: T.textSoft }} axisLine={{ stroke: T.border }} tickLine={false} />
              <YAxis tick={{ fontSize: 10.5, fill: T.textSoft }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12.5, color: T.text }} formatter={(v) => fmtBRL(v)} />
              <Legend wrapperStyle={{ fontSize: 11.5 }} />
              <Bar dataKey="Receitas" fill={T.income} radius={[3,3,0,0]} />
              <Bar dataKey="Despesas" fill={T.expense} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card T={T} title="Despesas por categoria">
          {pieData.length === 0 ? <Empty T={T} text="Nenhuma despesa lançada neste mês." /> : (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={74} paddingAngle={2}>
                  {pieData.map((d, i) => <Cell key={i} fill={colorFor(d.name)} />)}
                </Pie>
                <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12.5, color: T.text }} formatter={(v) => fmtBRL(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} layout={isMobile ? "horizontal" : "vertical"} align={isMobile ? "center" : "right"} verticalAlign={isMobile ? "bottom" : "middle"} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
      <Card T={T} title="Progresso do planejamento (gastos variáveis)">
        {VARIABLE_CATEGORIES.map((c) => {
          const planned = plan.variablePlanned[c.name] ?? Math.round((saldoReal * c.weight) / 100);
          const spent = spentByCat[c.name] || 0;
          const pct = planned > 0 ? Math.min(100, (spent / planned) * 100) : 0;
          const over = planned > 0 && spent > planned;
          return (
            <div key={c.name} style={{ padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: c.color }} />{c.name}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: over ? T.expense : T.textSoft }}>{fmtBRL(spent)} / {fmtBRL(planned)}</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: T.surface2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: over ? T.expense : c.color }} />
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Transações                                                              */
/* ---------------------------------------------------------------------- */
function TxRow({ T, t, onEdit }) {
  const isIncome = t.type === "income";
  const color = isIncome ? T.income : (VARIABLE_CATEGORIES.find((c) => c.name === t.category)?.color || T.expense);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.description || t.category}</div>
          <div style={{ fontSize: 11.5, color: T.textFaint }}>{t.category} · {new Date(t.date + "T00:00").toLocaleDateString("pt-BR")}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13.5, fontWeight: 600, color: isIncome ? T.income : T.expense }}>{isIncome ? "+" : "-"} {fmtBRL(t.amount)}</span>
        {onEdit && <button onClick={() => onEdit(t)} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer" }}><Pencil size={14} /></button>}
      </div>
    </div>
  );
}
function Transacoes({ T, monthTx, onOpenEdit, onOpenNew }) {
  const [filter, setFilter] = useState("all");
  const filtered = monthTx.filter((t) => filter === "all" || t.type === filter);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[["all","Todas"],["income","Receitas"],["expense","Despesas"]].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)} style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${filter===v?T.accent:T.border}`, background: filter===v?T.accentSoft:T.surface, color: filter===v?T.accent:T.textSoft, fontSize: 12.5, cursor: "pointer", fontWeight: 500 }}>{l}</button>
          ))}
        </div>
        <button onClick={onOpenNew} style={btn(T)}><Plus size={14} /> Novo lançamento</button>
      </div>
      <Card T={T} title={`Lançamentos (${filtered.length})`}>
        {filtered.length === 0 ? <Empty T={T} text="Nada por aqui ainda." /> : filtered.map((t) => <TxRow key={t.id} T={T} t={t} onEdit={onOpenEdit} />)}
      </Card>
    </div>
  );
}
function Modal({ T, title, children, onClose, isMobile }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,12,0.5)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 50, padding: isMobile ? 0 : 16 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: isMobile ? "18px 18px 0 0" : 18, padding: 22, width: isMobile ? "100%" : 420, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto", boxShadow: T.panelShadow, backdropFilter: "blur(10px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontFamily: "'Sora', sans-serif", fontSize: 16.5, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.textSoft }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({ T, label, children }) { return <div style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 12, color: T.textFaint, marginBottom: 5 }}>{label}</label>{children}</div>; }

function TxModal({ T, preset, editingTx, onClose, onAdd, onUpdate, onDelete, fixedLabels, accounts, cards, incomeLabels, isMobile }) {
  const isEdit = !!editingTx;
  const effectiveSource = editingTx?.source || preset.source;
  const lockType = effectiveSource?.type === "card"; // gasto lançado direto de um cartão só pode ser despesa
  const [type, setType] = useState(editingTx?.type || preset.type || "expense");
  const [amount, setAmount] = useState(editingTx ? String(editingTx.amount) : "");
  const [category, setCategory] = useState(editingTx?.category || "");
  const [description, setDescription] = useState(editingTx?.description || "");
  const [date, setDate] = useState(editingTx?.date || todayISO());
  const [source, setSource] = useState(effectiveSource ? `${effectiveSource.type}:${effectiveSource.id}` : "");
  const [error, setError] = useState("");

  const expenseCats = [...new Set([...fixedLabels, ...VARIABLE_CATEGORIES.map((c) => c.name), ...(editingTx?.type === "expense" ? [editingTx.category] : [])])];
  const incomeCats = [...new Set([...(incomeLabels.length ? incomeLabels : ["Salário", "Freelance", "Investimentos", "Outros"]), ...(editingTx?.type === "income" ? [editingTx.category] : [])])];
  const cats = type === "expense" ? expenseCats : incomeCats;
  const currentCat = category || cats[0] || "Outros";
  const selectedSourceType = source ? source.split(":")[0] : "";
  const selectedSourceId = source ? source.split(":")[1] : "";
  const selectedCard = selectedSourceType === "card" ? cards.find((card) => card.id === selectedSourceId) : null;
  const selectedInvoiceMonth = selectedCard ? invoiceMonthOf(date, selectedCard.closingDay) : "";

  const submit = () => {
    const val = parseNum(amount);
    if (!val || val <= 0) return;
    if (!source) {
      setError(type === "income" ? "Selecione em qual conta o dinheiro entrou." : "Selecione a conta ou o cartão da saída.");
      return;
    }
    let src = null;
    if (source) { const [t, id] = source.split(":"); src = { type: t, id }; }
    const invoiceMonth = src?.type === "card" ? invoiceMonthOf(date, cards.find((card) => card.id === src.id)?.closingDay || 31) : undefined;
    const payload = { type, amount: val, category: currentCat, description: description.trim(), date, source: src, ...(invoiceMonth ? { invoiceMonth } : {}) };
    if (isEdit) onUpdate(editingTx.id, payload); else onAdd(payload);
    onClose();
  };

  return (
    <Modal T={T} title={isEdit ? "Editar lançamento" : "Novo lançamento"} onClose={onClose} isMobile={isMobile}>
      {lockType ? (
        <div style={{ marginBottom: 16, padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${T.expense}`, background: T.expense + "1A", color: T.expense, fontSize: 13, fontWeight: 600, textAlign: "center" }}>
          Despesa no cartão
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[["expense","Despesa"],["income","Receita"]].map(([v,l]) => (
            <button key={v} onClick={() => { setType(v); setCategory(""); setSource(""); setError(""); }} style={{
              flex: 1, padding: "9px 0", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
              border: `1.5px solid ${type===v ? (v==="expense"?T.expense:T.income) : T.border}`,
              background: type===v ? (v==="expense"? T.expense+"1A" : T.income+"1A") : "transparent",
              color: type===v ? (v==="expense"?T.expense:T.income) : T.textSoft,
            }}>{l}</button>
          ))}
        </div>
      )}
      <Field T={T} label="Valor (R$)"><input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" style={inputStyle(T)} /></Field>
      <Field T={T} label="Categoria">
        <select value={currentCat} onChange={(e) => setCategory(e.target.value)} style={inputStyle(T)}>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select>
      </Field>
      <Field T={T} label="Descrição (opcional)"><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Supermercado" style={inputStyle(T)} /></Field>
      <Field T={T} label="Data"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle(T)} /></Field>
      {type === "income" ? (
        accounts.length > 0 && (
          <Field T={T} label="Recebido em qual conta?">
            <select value={source} onChange={(e) => { setSource(e.target.value); setError(""); }} style={inputStyle(T)}>
              <option value="">Selecione</option>
              {accounts.map((a) => <option key={a.id} value={`account:${a.id}`}>{a.name}</option>)}
            </select>
          </Field>
        )
      ) : (
        (accounts.length > 0 || cards.length > 0) && (
          <Field T={T} label="Pago com conta ou cartão de crédito">
            <select value={source} onChange={(e) => { setSource(e.target.value); setError(""); }} disabled={lockType} style={inputStyle(T)}>
              <option value="">Selecione</option>
              {accounts.map((a) => <option key={a.id} value={`account:${a.id}`}>{a.name}</option>)}
              {cards.map((c) => <option key={c.id} value={`card:${c.id}`}>{c.name} (cartão de crédito - entra na fatura)</option>)}
            </select>
          </Field>
        )
      )}
      {type === "expense" && selectedSourceType === "card" && selectedInvoiceMonth && (
        <p style={{ fontSize: 12, color: T.textSoft, marginTop: -6, marginBottom: 10 }}>Esse gasto será lançado automaticamente na fatura de {monthLabelFromKey(selectedInvoiceMonth)} do cartão selecionado.</p>
      )}
      {error && <p style={{ fontSize: 12, color: T.expense, marginTop: -4, marginBottom: 10 }}>{error}</p>}
      {type === "income" && accounts.length === 0 && <p style={{ fontSize: 12, color: T.expense, marginTop: -4, marginBottom: 10 }}>Cadastre uma conta bancária antes de lançar uma entrada.</p>}
      {type === "expense" && !lockType && accounts.length === 0 && cards.length === 0 && <p style={{ fontSize: 12, color: T.expense, marginTop: -4, marginBottom: 10 }}>Cadastre uma conta bancária ou cartão antes de lançar uma saída.</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button onClick={submit} style={{ ...btn(T), flex: 1, justifyContent: "center" }}>{isEdit ? "Salvar alterações" : "Salvar lançamento"}</button>
        {isEdit && (
          <button onClick={() => { onDelete(editingTx.id); onClose(); }} style={ghostBtn(T, T.expense)}><Trash2 size={14} /> Excluir</button>
        )}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/* Contas fixas - recorrentes ou só de um mês, com alerta de vencimento    */
/* ---------------------------------------------------------------------- */
function ContasFixas({ T, bills, mKey, onAddBill, onUpdateBill, onDeleteBill, onTogglePaid }) {
  const [modal, setModal] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => setModal(true)} style={btn(T)}><Plus size={14} /> Nova conta</button>
      </div>
      <Card T={T} title="Contas fixas deste mês">
        {bills.length === 0 ? <Empty T={T} text="Nenhuma conta cadastrada ainda. Elas entram automaticamente no Planejamento." /> : bills.map((b) => {
          const status = billStatus(b, mKey, T);
          const paid = !!b.paid[mKey];
          return (
            <div key={b.id} style={{ padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {b.name}
                    <span style={{ fontSize: 10, color: T.textFaint, fontWeight: 400, border: `1px solid ${T.border}`, borderRadius: 4, padding: "1px 6px" }}>
                      {(() => {
                        const ms = monthsOf(b);
                        if (ms.length === 12) return "ano todo";
                        return ms.map((n) => MONTHS[n - 1]).join(", ");
                      })()}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: T.textFaint, display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                    Vence dia {b.dueDay}
                    {status.alert && !paid && <span style={{ display: "flex", alignItems: "center", gap: 3, color: status.color, fontWeight: 600 }}><AlertTriangle size={11} /> {status.label}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13.5, fontWeight: 600 }}>{fmtBRL(b.amount)}</span>
                  <button onClick={() => onTogglePaid(b.id)} style={{ border: `1px solid ${paid ? T.income : T.accent}`, color: paid ? T.income : T.accent, borderRadius: 6, padding: "3px 9px", fontSize: 11, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                    {paid && <Check size={11} />} {paid ? "Pago" : "Pendente"}
                  </button>
                  <button onClick={() => setEditingBill(b)} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer" }}><Pencil size={14} /></button>
                </div>
              </div>
            </div>
          );
        })}
        <p style={{ fontSize: 11.5, color: T.textFaint, marginTop: 12, marginBottom: 0 }}>Dica: uma transação com o mesmo nome de uma conta daqui marca ela como paga automaticamente.</p>
      </Card>
      {modal && <BillModal T={T} mKey={mKey} onClose={() => setModal(false)} onAdd={onAddBill} />}
      {editingBill && (
        <BillModal T={T} mKey={mKey} editingBill={editingBill} onClose={() => setEditingBill(null)}
          onUpdate={onUpdateBill} onDelete={onDeleteBill} />
      )}
    </div>
  );
}
function BillModal({ T, mKey, editingBill, onClose, onAdd, onUpdate, onDelete }) {
  const isEdit = !!editingBill;
  const [name, setName] = useState(editingBill?.name || "");
  const [amount, setAmount] = useState(editingBill ? String(editingBill.amount) : "");
  const [dueDay, setDueDay] = useState(editingBill ? String(editingBill.dueDay) : "5");
  const [months, setMonths] = useState(editingBill ? monthsOf(editingBill) : ALL_MONTHS_NUM);
  const [error, setError] = useState("");
  const currentMonthNum = parseInt(mKey.split("-")[1], 10);

  const toggleMonth = (n) => setMonths((prev) => prev.includes(n) ? prev.filter((m) => m !== n) : [...prev, n].sort((a, b) => a - b));

  const submit = () => {
    const val = parseNum(amount);
    if (!name.trim() || !val) return;
    if (months.length === 0) { setError("Selecione ao menos um mês."); return; }
    const payload = { name: name.trim(), amount: val, dueDay: parseInt(dueDay)||1, months };
    if (isEdit) onUpdate(editingBill.id, payload); else onAdd(payload);
    onClose();
  };

  return (
    <Modal T={T} title={isEdit ? "Editar conta" : "Nova conta fixa"} onClose={onClose}>
      <Field T={T} label="Nome"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Aluguel" style={inputStyle(T)} /></Field>
      <Field T={T} label="Valor (R$)"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" style={inputStyle(T)} /></Field>
      <Field T={T} label="Dia de vencimento"><input type="number" value={dueDay} onChange={(e) => setDueDay(e.target.value)} style={inputStyle(T)} /></Field>
      <Field T={T} label="Em quais meses essa conta é fixa?">
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          <button onClick={() => setMonths(ALL_MONTHS_NUM)} style={{ ...ghostBtn(T), fontSize: 11, padding: "4px 9px" }}>Ano todo</button>
          <button onClick={() => setMonths([currentMonthNum])} style={{ ...ghostBtn(T), fontSize: 11, padding: "4px 9px" }}>Só este mês</button>
          <button onClick={() => setMonths([])} style={{ ...ghostBtn(T), fontSize: 11, padding: "4px 9px" }}>Limpar</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
          {MONTHS.map((label, i) => {
            const n = i + 1;
            const active = months.includes(n);
            return (
              <button key={n} onClick={() => { toggleMonth(n); setError(""); }} style={{
                padding: "7px 0", borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                border: `1.5px solid ${active ? T.accent : T.border}`, background: active ? T.accentSoft : "transparent",
                color: active ? T.accent : T.textSoft,
              }}>{label}</button>
            );
          })}
        </div>
        {error && <p style={{ fontSize: 11.5, color: T.expense, marginTop: 6, marginBottom: 0 }}>{error}</p>}
      </Field>

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button onClick={submit} style={{ ...btn(T), flex: 1, justifyContent: "center" }}>{isEdit ? "Salvar alterações" : "Salvar conta"}</button>
        {isEdit && (
          <button onClick={() => { onDelete(editingBill.id); onClose(); }} style={{ ...ghostBtn(T, T.expense) }}><Trash2 size={14} /> Excluir</button>
        )}
      </div>
      <button onClick={submit} style={{ ...btn(T), width: "100%", justifyContent: "center", marginTop: 6 }}>Salvar conta</button>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/* Bancos & cartões                                                        */
/* ---------------------------------------------------------------------- */
function BancosCartoes({ T, accounts, cards, transactions, transfers, mKey, onAddAccount, onDeleteAccount, onAddCard, onDeleteCard, onSetCardPartial, onAddTransfer, onOpenTx, onOpenEdit, isMobile }) {
  const [accModal, setAccModal] = useState(false);
  const [cardModal, setCardModal] = useState(false);
  const [partialCard, setPartialCard] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null);
  const [transferModal, setTransferModal] = useState(false);

  const balanceOf = (acc) => {
    const fromTx = transactions.filter((t) => t.source?.type === "account" && t.source.id === acc.id).reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
    const transferOut = transfers.filter((tr) => tr.fromId === acc.id).reduce((s, tr) => s + tr.amount, 0);
    const transferIn = transfers.filter((tr) => tr.toId === acc.id).reduce((s, tr) => s + tr.amount, 0);
    return acc.initialBalance + fromTx - transferOut + transferIn;
  };
  const itemsOf = (card) => transactions.filter((t) => t.source?.type === "card" && t.source.id === card.id && (t.invoiceMonth || invoiceMonthOf(t.date, card.closingDay)) === mKey);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card T={T} title="Contas bancárias" right={
          <div style={{ display: "flex", gap: 8 }}>
            {accounts.length >= 2 && <button onClick={() => setTransferModal(true)} style={{ ...ghostBtn(T, T.accent), padding: "6px 10px", fontSize: 12 }}><ArrowLeftRight size={13} />Transferir</button>}
            <button onClick={() => setAccModal(true)} style={{ ...btn(T), padding: "6px 12px", fontSize: 12 }}><Plus size={13}/>Nova</button>
          </div>
        }>
          {accounts.length === 0 ? <Empty T={T} text="Nenhuma conta cadastrada." /> : accounts.map((a) => (
            <div key={a.id} style={{ padding: "11px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><div style={{ fontSize: 13.5, fontWeight: 500 }}>{a.name}</div><div style={{ fontSize: 11.5, color: T.textFaint }}>{a.type}</div></div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13.5, fontWeight: 600, color: balanceOf(a) >= 0 ? T.income : T.expense }}>{fmtBRL(balanceOf(a))}</span>
                  <button onClick={() => onDeleteAccount(a.id)} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer" }}><Trash2 size={14} /></button>
                </div>
              </div>
              <button onClick={() => onOpenTx({ source: { type: "account", id: a.id } })} style={{ ...ghostBtn(T), marginTop: 8, fontSize: 11.5, padding: "5px 10px" }}><Plus size={12} /> Lançamento nesta conta</button>
            </div>
          ))}
          {transfers.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11.5, color: T.textFaint, marginBottom: 6 }}>Transferências recentes</div>
              {transfers.slice(0, 4).map((tr) => {
                const from = accounts.find((a) => a.id === tr.fromId)?.name || "?";
                const to = accounts.find((a) => a.id === tr.toId)?.name || "?";
                return (
                  <div key={tr.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", color: T.textSoft }}>
                    <span>{from} para {to}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtBRL(tr.amount)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card T={T} title="Cartões de crédito" right={<button onClick={() => setCardModal(true)} style={{ ...btn(T), padding: "6px 12px", fontSize: 12 }}><Plus size={13}/>Novo</button>}>
          {cards.length === 0 ? <Empty T={T} text="Nenhum cartão cadastrado." /> : cards.map((c) => {
            const items = itemsOf(c);
            const partial = partialInvoiceOf(c, mKey);
            const total = items.reduce((s, t) => s + t.amount, 0) + partial;
            const expanded = expandedCard === c.id;
            return (
              <div key={c.id} style={{ padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><CreditCard size={15} color={T.accent} /><span style={{ fontSize: 13.5, fontWeight: 500 }}>{c.name}</span></div>
                  <button onClick={() => onDeleteCard(c.id)} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer" }}><Trash2 size={14} /></button>
                </div>
                <button onClick={() => setExpandedCard(expanded ? null : c.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 4, textAlign: "left" }}>
                  <div style={{ fontSize: 11.5, color: T.textFaint }}>
                    Fatura deste mês: <span style={{ color: T.expense, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{fmtBRL(total)}</span> de {fmtBRL(c.limit)} · fecha dia {c.closingDay}, vence dia {c.dueDay} <span style={{ color: T.accent }}>{expanded ? "? ocultar" : "? detalhar"}</span>
                  </div>
                </button>
                {expanded && (
                  <div style={{ marginTop: 8, background: T.surface2, borderRadius: 8, padding: "8px 12px" }}>
                    {items.length === 0 && partial === 0 ? (
                      <div style={{ fontSize: 12, color: T.textFaint }}>Nenhum gasto lançado nesta fatura ainda.</div>
                    ) : (
                      <>
                        {items.map((t) => (
                          <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "4px 0" }}>
                            <span style={{ color: T.textSoft }}>{t.description || t.category} <span style={{ color: T.textFaint }}>· {new Date(t.date + "T00:00").toLocaleDateString("pt-BR")}</span></span>
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtBRL(t.amount)}</span>
                              <button onClick={() => onOpenEdit(t)} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", display: "flex" }}><Pencil size={12} /></button>
                            </span>
                          </div>
                        ))}
                        {partial > 0 && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", fontStyle: "italic" }}>
                            <span style={{ color: T.textSoft }}>Valor parcial (não detalhado)</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtBRL(partial)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button onClick={() => onOpenTx({ type: "expense", source: { type: "card", id: c.id } })} style={{ ...ghostBtn(T), fontSize: 11.5, padding: "5px 10px" }}><Plus size={12} /> Gasto neste cartão</button>
                  <button onClick={() => setPartialCard(c)} style={{ ...ghostBtn(T, T.accent), fontSize: 11.5, padding: "5px 10px" }}><ReceiptIcon size={12} /> {partial > 0 ? "Atualizar valor parcial" : "Adicionar valor parcial da fatura"}</button>
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      {accModal && <AccountModal T={T} onClose={() => setAccModal(false)} onAdd={onAddAccount} />}
      {cardModal && <CardModal T={T} onClose={() => setCardModal(false)} onAdd={onAddCard} />}
      {partialCard && <PartialInvoiceModal T={T} card={partialCard} currentValue={partialInvoiceOf(partialCard, mKey)} onClose={() => setPartialCard(null)} onSet={onSetCardPartial} />}
      {transferModal && <TransferModal T={T} accounts={accounts} onClose={() => setTransferModal(false)} onAdd={onAddTransfer} />}
    </div>
  );
}
function PartialInvoiceModal({ T, card, currentValue, onClose, onSet }) {
  const [amount, setAmount] = useState(currentValue > 0 ? String(currentValue) : "");
  const submit = () => {
    const val = parseNum(amount);
    onSet(card.id, val);
    onClose();
  };
  return (
    <Modal T={T} title={`Valor parcial da fatura - ${card.name}`} onClose={onClose}>
      <p style={{ fontSize: 12.5, color: T.textFaint, marginTop: 0 }}>
        Use isso pra representar o que você sabe da fatura sem detalhar item por item. Esse valor <strong>substitui</strong> o anterior - não soma. Se a fatura mudar, é só atualizar aqui de novo.
      </p>
      <Field T={T} label="Valor conhecido da fatura (R$)"><input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" style={inputStyle(T)} /></Field>
      <button onClick={submit} style={{ ...btn(T), width: "100%", justifyContent: "center", marginTop: 6 }}>Salvar valor</button>
    </Modal>
  );
}
function TransferModal({ T, accounts, onClose, onAdd }) {
  const [fromId, setFromId] = useState(accounts[0]?.id || "");
  const [toId, setToId] = useState(accounts[1]?.id || accounts[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState("");
  const submit = () => {
    const val = parseNum(amount);
    if (!val) return;
    if (fromId === toId) { setError("Escolha duas contas diferentes."); return; }
    onAdd({ fromId, toId, amount: val, date });
    onClose();
  };
  return (
    <Modal T={T} title="Transferir entre contas" onClose={onClose}>
      <p style={{ fontSize: 12.5, color: T.textFaint, marginTop: 0 }}>Isso só move o saldo entre suas próprias contas - não conta como receita nem despesa.</p>
      <Field T={T} label="De"><select value={fromId} onChange={(e) => setFromId(e.target.value)} style={inputStyle(T)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
      <Field T={T} label="Para"><select value={toId} onChange={(e) => setToId(e.target.value)} style={inputStyle(T)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
      <Field T={T} label="Valor (R$)"><input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" style={inputStyle(T)} /></Field>
      <Field T={T} label="Data"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle(T)} /></Field>
      {error && <p style={{ fontSize: 11.5, color: T.expense, marginTop: -6, marginBottom: 10 }}>{error}</p>}
      <button onClick={submit} style={{ ...btn(T), width: "100%", justifyContent: "center", marginTop: 6 }}>Transferir</button>
    </Modal>
  );
}
function AccountModal({ T, onClose, onAdd }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("Conta corrente");
  const [initialBalance, setInitialBalance] = useState("");
  const submit = () => { if (!name.trim()) return; onAdd({ name: name.trim(), type, initialBalance: parseNum(initialBalance) }); onClose(); };
  return (
    <Modal T={T} title="Nova conta bancária" onClose={onClose}>
      <Field T={T} label="Nome"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Nubank" style={inputStyle(T)} /></Field>
      <Field T={T} label="Tipo"><select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle(T)}><option>Conta corrente</option><option>Poupança</option><option>Carteira/dinheiro</option><option>Investimento</option></select></Field>
      <Field T={T} label="Saldo inicial (R$)"><input inputMode="decimal" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} placeholder="0,00" style={inputStyle(T)} /></Field>
      <button onClick={submit} style={{ ...btn(T), width: "100%", justifyContent: "center", marginTop: 6 }}>Salvar conta</button>
    </Modal>
  );
}
function CardModal({ T, onClose, onAdd }) {
  const [name, setName] = useState("");
  const [limit, setLimit] = useState("");
  const [closingDay, setClosingDay] = useState("20");
  const [dueDay, setDueDay] = useState("27");
  const submit = () => { if (!name.trim()) return; onAdd({ name: name.trim(), limit: parseNum(limit), closingDay: parseInt(closingDay)||1, dueDay: parseInt(dueDay)||1 }); onClose(); };
  return (
    <Modal T={T} title="Novo cartão" onClose={onClose}>
      <Field T={T} label="Nome do cartão"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Nubank" style={inputStyle(T)} /></Field>
      <Field T={T} label="Limite (R$)"><input inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="0,00" style={inputStyle(T)} /></Field>
      <Field T={T} label="Dia de fechamento"><input type="number" value={closingDay} onChange={(e) => setClosingDay(e.target.value)} style={inputStyle(T)} /></Field>
      <Field T={T} label="Dia de vencimento"><input type="number" value={dueDay} onChange={(e) => setDueDay(e.target.value)} style={inputStyle(T)} /></Field>
      <button onClick={submit} style={{ ...btn(T), width: "100%", justifyContent: "center", marginTop: 6 }}>Salvar cartão</button>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/* Investimentos - potes/reservas com objetivo (emergência, viagem, etc.) */
/* ---------------------------------------------------------------------- */
function Investimentos({ T, investments, moves, accounts, onAddInvestment, onUpdateInvestment, onDeleteInvestment, onAddMove, isMobile }) {
  const [modal, setModal] = useState(false);
  const [editingInv, setEditingInv] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null); // { investment, type }

  const balanceOf = (inv) => {
    const total = moves.filter((m) => m.investmentId === inv.id).reduce((s, m) => s + (m.type === "resgate" ? -m.amount : m.amount), 0);
    return (inv.initialBalance || 0) + total;
  };
  const totalGeral = investments.reduce((s, inv) => s + balanceOf(inv), 0);

  const moveLabel = { aporte: "Aporte", resgate: "Resgate", rendimento: "Rendimento" };
  const moveColor = (m) => (m.type === "resgate" ? T.expense : T.income);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <StatBlock T={T} label="Total guardado (todas as reservas)" value={totalGeral} color={T.accent} big />
        <button onClick={() => setModal(true)} style={btn(T)}><Plus size={14} /> Nova reserva</button>
      </div>

      <p style={{ fontSize: 12, color: T.textFaint, marginTop: -8, marginBottom: 18 }}>
        Isso é separado do saldo das suas contas - serve pra organizar onde seu dinheiro guardado tem destino (emergência, viagem, uma compra futura, etc.), mesmo que fisicamente esteja tudo na mesma conta.
      </p>

      {investments.length === 0 ? (
        <Card T={T}><Empty T={T} text="Nenhuma reserva criada ainda. Ex: Emergência, Viagem, Aquisição, Investimento..." /></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 14 }}>
          {investments.map((inv) => {
            const bal = balanceOf(inv);
            const invMoves = moves.filter((m) => m.investmentId === inv.id).slice(0, 4);
            return (
              <Card T={T} key={inv.id} title={inv.name} right={
                <button onClick={() => setEditingInv(inv)} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer" }}><Pencil size={14} /></button>
              }>
                {inv.heldAt && <div style={{ fontSize: 11.5, color: T.textFaint, marginTop: -8, marginBottom: 10 }}>Guardado em: {inv.heldAt}</div>}
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 700, color: T.accent, marginBottom: 12 }}>{fmtBRL(bal)}</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                  <button onClick={() => setMoveTarget({ investment: inv, type: "aporte" })} style={{ ...ghostBtn(T, T.income), flex: 1, justifyContent: "center" }}><Plus size={13} /> Aporte</button>
                  <button onClick={() => setMoveTarget({ investment: inv, type: "rendimento" })} style={{ ...ghostBtn(T, T.accent), flex: 1, justifyContent: "center" }}><TrendingUpIcon size={13} /> Rendimento</button>
                  <button onClick={() => setMoveTarget({ investment: inv, type: "resgate" })} style={{ ...ghostBtn(T, T.expense), flex: 1, justifyContent: "center" }}><Minus size={13} /> Resgate</button>
                </div>
                {invMoves.length > 0 && (
                  <div>
                    {invMoves.map((m) => (
                      <div key={m.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, padding: "4px 0", borderTop: `1px solid ${T.border}` }}>
                        <span style={{ color: T.textSoft }}>{moveLabel[m.type] || m.type} · {new Date(m.date + "T00:00").toLocaleDateString("pt-BR")}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: moveColor(m) }}>{m.type === "resgate" ? "-" : "+"} {fmtBRL(m.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {modal && <InvestmentModal T={T} onClose={() => setModal(false)} onAdd={onAddInvestment} />}
      {editingInv && <InvestmentModal T={T} editingInv={editingInv} onClose={() => setEditingInv(null)} onUpdate={onUpdateInvestment} onDelete={onDeleteInvestment} />}
      {moveTarget && (
        <MoveModal T={T} investment={moveTarget.investment} type={moveTarget.type} accounts={accounts}
          currentBalance={balanceOf(moveTarget.investment)} onClose={() => setMoveTarget(null)} onAdd={onAddMove} />
      )}
    </div>
  );
}
function InvestmentModal({ T, editingInv, onClose, onAdd, onUpdate, onDelete }) {
  const isEdit = !!editingInv;
  const [name, setName] = useState(editingInv?.name || "");
  const [heldAt, setHeldAt] = useState(editingInv?.heldAt || "");
  const [initialBalance, setInitialBalance] = useState(editingInv ? String(editingInv.initialBalance || 0) : "");
  const submit = () => {
    if (!name.trim()) return;
    const payload = { name: name.trim(), heldAt: heldAt.trim(), initialBalance: parseNum(initialBalance) };
    if (isEdit) onUpdate(editingInv.id, payload); else onAdd(payload);
    onClose();
  };
  return (
    <Modal T={T} title={isEdit ? "Editar reserva" : "Nova reserva"} onClose={onClose}>
      <Field T={T} label="Nome"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Emergência, Viagem, Aquisição..." style={inputStyle(T)} /></Field>
      <Field T={T} label="Onde fica guardado? (opcional)"><input value={heldAt} onChange={(e) => setHeldAt(e.target.value)} placeholder="Ex: Caixinha do Nubank, Cofrinho do MP" style={inputStyle(T)} /></Field>
      <Field T={T} label={isEdit ? "Valor inicial (R$)" : "Valor inicial (R$)"}><input inputMode="decimal" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} placeholder="0,00" style={inputStyle(T)} /></Field>

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button onClick={submit} style={{ ...btn(T), flex: 1, justifyContent: "center" }}>{isEdit ? "Salvar alterações" : "Criar reserva"}</button>
        {isEdit && <button onClick={() => { onDelete(editingInv.id); onClose(); }} style={ghostBtn(T, T.expense)}><Trash2 size={14} /> Excluir</button>}
      </div>
    </Modal>
  );
}
function MoveModal({ T, investment, type, accounts, currentBalance, onClose, onAdd }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [destAccountId, setDestAccountId] = useState("");
  const [error, setError] = useState("");

  const titleMap = { aporte: "Aporte em", resgate: "Resgate de", rendimento: "Rendimento em" };

  const submit = () => {
    const val = parseNum(amount);
    if (!val) return;
    if (type === "resgate" && val > currentBalance) {
      setError(`Essa reserva tem só ${fmtBRL(currentBalance)} disponível.`);
      return;
    }
    onAdd({ investmentId: investment.id, investmentName: investment.name, type, amount: val, date, note: note.trim(), destAccountId: destAccountId || undefined });
    onClose();
  };

  return (
    <Modal T={T} title={`${titleMap[type]} ${investment.name}`} onClose={onClose}>
      {type === "resgate" && (
        <p style={{ fontSize: 12, color: T.textFaint, marginTop: 0 }}>Disponível nesta reserva: <strong>{fmtBRL(currentBalance)}</strong></p>
      )}
      <Field T={T} label="Valor (R$)"><input autoFocus inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setError(""); }} placeholder="0,00" style={inputStyle(T)} /></Field>
      <Field T={T} label="Data"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle(T)} /></Field>
      {type === "resgate" && accounts.length > 0 && (
        <Field T={T} label="Depositar em qual conta? (opcional)">
          <select value={destAccountId} onChange={(e) => setDestAccountId(e.target.value)} style={inputStyle(T)}>
            <option value="">- não registrar em nenhuma conta -</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
      )}
      <Field T={T} label="Nota (opcional)"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: 13º salário" style={inputStyle(T)} /></Field>
      {error && <p style={{ fontSize: 12, color: T.expense, marginTop: -6, marginBottom: 10 }}>{error}</p>}
      <button onClick={submit} style={{ ...btn(T), width: "100%", justifyContent: "center", marginTop: 6 }}>Confirmar {type === "aporte" ? "aporte" : type === "resgate" ? "resgate" : "rendimento"}</button>
    </Modal>
  );
}
